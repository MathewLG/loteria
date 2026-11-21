// El motor de una sala. No sabe nada de Cloudflare: recibe un Entorno con
// conexiones, alarma y almacenamiento. Así corre igual en el Durable Object,
// en el servidor local con Bun y en las pruebas.

import {
  FASE, MOTIVO, T, codificarCarta, codificarEleccion, codificarEstado, codificarFin,
  codificarResultado, codificarStats, cumpleFigura, decodificar, mascaraCantadas,
} from '../public/js/protocolo.js';
import { TABLAS_OFRECIDAS, aHex, barajar, deHex, sha256, tablaDe, tablasOfrecidas } from '../public/js/baraja.js';

export interface Adjunto {
  token: string;
  ronda: number;
  lugar: number;
  ultimoReclamo: number;
  /** Índice de la tabla elegida entre las ofrecidas (0..2). */
  elegida: number;
  /** Llegó con la ronda ya cantándose: mira pero no puede reclamar. */
  espectador: boolean;
}

export interface Conexion {
  enviar(datos: Uint8Array): void;
  adjunto(): Adjunto | null;
  guardarAdjunto(a: Adjunto): void;
}

/** Lo que se guarda de cada ronda terminada para poder verificarla después. */
export interface RegistroRonda {
  ronda: number;
  huella: string;
  semilla: string;
  cantadas: number[];
  ganadores: number;
  inicio: number;
  fin: number;
}

export interface Entorno {
  conexiones(): Conexion[];
  programarAlarma(enMs: number): Promise<void>;
  hayAlarma(): Promise<boolean>;
  leer<V>(clave: string): Promise<V | undefined>;
  escribir(clave: string, valor: unknown): Promise<void>;
  borrarPrefijo(prefijo: string): Promise<void>;
  ahora(): number;
  aleatorio(n: number): Uint8Array;
  /** Opcional: guardar el registro de una ronda terminada (R2 en producción). */
  guardarRonda?(registro: RegistroRonda): Promise<void>;
}

export interface Config {
  esperaMs: number;
  cartaMs: number;
  finMs: number;
  catalogo: number;
  /** Conexiones simultáneas máximas en la sala. */
  cupo?: number;
  /** Solicitudes diarias del plan gratuito de Durable Objects. */
  cuotaDiaria?: number;
  /** Fracción de la cuota a partir de la cual ya no entra nadie nuevo. */
  umbralCuota?: number;
}

export interface EstadoSala {
  ronda: number;
  fase: number;
  semilla: string;
  figura: number;
  cantadas: number;
  siguienteEn: number;
  ganadores: number;
  /** Momento en que se cantó la primera carta (0 mientras espera). */
  inicio: number;
}

/**
 * Solicitudes del día según el modelo de cobro de Cloudflare:
 * cada conexión cuenta 1 y los mensajes entrantes cuentan 1 por cada 20.
 */
export interface Cuota {
  dia: string;
  conexiones: number;
  mensajes: number;
}

/** Respuesta cuando no se admite a alguien: va como JSON en un HTTP 503. */
export interface Rechazo {
  razon: 'llena' | 'cuota';
  reintentarEnMs: number;
}

const CLAVE_ESTADO = 'estado';
const CLAVE_CUOTA = 'cuota';
const claveLugar = (ronda: number, token: string) => `lugar:${ronda}:${token}`;
const claveTabla = (ronda: number, token: string) => `tabla:${ronda}:${token}`;
const DIA_MS = 86_400_000;

export const TOKEN_VALIDO = /^[0-9a-f]{32}$/;

export class Motor {
  private env: Entorno;
  private cfg: Required<Config>;
  private cacheBaraja: { semilla: string; cartas: number[] } | null = null;
  private cuota: Cuota | null = null;

  constructor(env: Entorno, cfg: Config) {
    this.env = env;
    this.cfg = { cupo: 5000, cuotaDiaria: 100_000, umbralCuota: 0.9, ...cfg };
  }

  private baraja(semilla: string): number[] {
    if (this.cacheBaraja?.semilla !== semilla) {
      this.cacheBaraja = { semilla, cartas: barajar(deHex(semilla), this.cfg.catalogo) };
    }
    return this.cacheBaraja.cartas;
  }

  // ---- Cuota diaria ----

  private dia(): string {
    return new Date(this.env.ahora()).toISOString().slice(0, 10);
  }

  private async cuotaDeHoy(): Promise<Cuota> {
    const hoy = this.dia();
    if (!this.cuota) this.cuota = (await this.env.leer<Cuota>(CLAVE_CUOTA)) ?? null;
    if (!this.cuota || this.cuota.dia !== hoy) this.cuota = { dia: hoy, conexiones: 0, mensajes: 0 };
    return this.cuota;
  }

  /** Solicitudes consumidas hoy. */
  async solicitudesHoy(): Promise<number> {
    const q = await this.cuotaDeHoy();
    return q.conexiones + Math.ceil(q.mensajes / 20);
  }

  /** El contador vive en memoria y se guarda en cada paso del reloj, no en cada mensaje. */
  private async guardarCuota(): Promise<void> {
    if (this.cuota) await this.env.escribir(CLAVE_CUOTA, this.cuota);
  }

  /**
   * Decide si una conexión nueva entra. Se llama antes de aceptar el WebSocket.
   * Toda petición que llega a la sala cuenta para la cuota, entre o no.
   */
  async admitir(): Promise<Rechazo | null> {
    const q = await this.cuotaDeHoy();
    q.conexiones += 1;
    const ahora = this.env.ahora();
    if ((await this.solicitudesHoy()) >= this.cfg.cuotaDiaria * this.cfg.umbralCuota) {
      await this.guardarCuota();
      const manana = Math.floor(ahora / DIA_MS + 1) * DIA_MS;
      return { razon: 'cuota', reintentarEnMs: manana - ahora };
    }
    if (this.env.conexiones().length >= this.cfg.cupo) {
      // Al menos 5 s, para que nadie reintente en ráfaga.
      return { razon: 'llena', reintentarEnMs: Math.max(5000, await this.msHastaSiguienteRonda()) };
    }
    return null;
  }

  private async msHastaSiguienteRonda(): Promise<number> {
    const e = await this.env.leer<EstadoSala>(CLAVE_ESTADO);
    if (!e) return 0;
    const resta = Math.max(0, e.siguienteEn - this.env.ahora());
    const { catalogo, cartaMs, finMs } = this.cfg;
    if (e.fase === FASE.ESPERA) return resta + catalogo * cartaMs + finMs;
    if (e.fase === FASE.CANTANDO) return resta + (catalogo - e.cantadas) * cartaMs + finMs;
    return resta;
  }

  // ---- Jugadores ----

  /**
   * Un jugador entra. Si la sala dormía, arranca una ronda nueva.
   * `rondaPrevia` es la ronda que el cliente estaba jugando antes de perder la conexión:
   * quien vuelve a su misma ronda no queda como espectador.
   */
  async conectar(c: Conexion, token: string, rondaPrevia = 0): Promise<void> {
    let e = await this.env.leer<EstadoSala>(CLAVE_ESTADO);
    if (!e || !(await this.env.hayAlarma())) {
      e = await this.nuevaRonda(e, false);
    }
    const lugar = (await this.env.leer<number>(claveLugar(e.ronda, token))) ?? 0;
    const guardada = await this.env.leer<number>(claveTabla(e.ronda, token));
    const elegida = guardada ?? 0;
    const volvio = rondaPrevia === e.ronda || guardada !== undefined || lugar > 0;
    const espectador = e.fase === FASE.CANTANDO && !volvio;
    const a: Adjunto = { token, ronda: e.ronda, lugar, ultimoReclamo: -1, elegida, espectador };
    c.guardarAdjunto(a);
    c.enviar(this.estadoPara(e, a));
  }

  async mensaje(c: Conexion, datos: Uint8Array): Promise<void> {
    (await this.cuotaDeHoy()).mensajes += 1;
    const m = decodificar(datos);
    const a = c.adjunto();
    if (!m || !a) return;
    if (m.tipo === T.ELIJO) return this.elegir(c, a, m.ronda ?? 0, m.indice ?? 0);
    if (m.tipo === T.LOTERIA) return this.reclamar(c, a, m.ronda ?? 0, m.marcadas ?? 0);
  }

  private async elegir(c: Conexion, a: Adjunto, ronda: number, indice: number): Promise<void> {
    const e = await this.env.leer<EstadoSala>(CLAVE_ESTADO);
    const valido = !!e && e.fase === FASE.ESPERA && ronda === e.ronda && a.ronda === e.ronda
      && !a.espectador && Number.isInteger(indice) && indice >= 0 && indice < TABLAS_OFRECIDAS;
    if (!valido || !e) {
      c.enviar(codificarEleccion(false, a.elegida));
      return;
    }
    a.elegida = indice;
    c.guardarAdjunto(a);
    await this.env.escribir(claveTabla(e.ronda, a.token), indice);
    c.enviar(codificarEleccion(true, indice));
  }

  private async reclamar(c: Conexion, a: Adjunto, ronda: number, marcadas: number): Promise<void> {
    const e = await this.env.leer<EstadoSala>(CLAVE_ESTADO);
    if (!e || e.fase !== FASE.CANTANDO || ronda !== e.ronda) {
      c.enviar(codificarResultado(false, MOTIVO.FUERA_DE_RONDA, 0));
      return;
    }
    if (a.ronda !== e.ronda) {
      // El adjunto quedó de una ronda anterior: en esta ronda juega con su tabla 0.
      Object.assign(a, { ronda: e.ronda, lugar: 0, ultimoReclamo: -1, elegida: 0, espectador: false });
    }
    if (a.espectador) {
      c.enviar(codificarResultado(false, MOTIVO.ESPECTADOR, 0));
      return;
    }
    if (a.lugar > 0) {
      c.enviar(codificarResultado(true, MOTIVO.YA_GANASTE, a.lugar));
      return;
    }
    if (a.ultimoReclamo === e.cantadas) {
      c.enviar(codificarResultado(false, MOTIVO.MUY_SEGUIDO, 0));
      return;
    }
    a.ultimoReclamo = e.cantadas;

    const tabla = tablaDe(a.token, e.ronda, this.cfg.catalogo, a.elegida);
    const salieron = this.baraja(e.semilla).slice(0, e.cantadas);
    const validas = marcadas & mascaraCantadas(tabla, salieron);
    if (!cumpleFigura(validas, e.figura)) {
      c.guardarAdjunto(a);
      c.enviar(codificarResultado(false, MOTIVO.INCOMPLETA, 0));
      return;
    }

    e.ganadores += 1;
    a.lugar = e.ganadores;
    await this.env.escribir(CLAVE_ESTADO, e);
    await this.env.escribir(claveLugar(e.ronda, a.token), a.lugar);
    c.guardarAdjunto(a);
    c.enviar(codificarResultado(true, MOTIVO.OK, a.lugar));
  }

  // ---- Reloj ----

  /** El reloj de la sala: cada alarma avanza la ronda un paso. */
  async alarma(): Promise<void> {
    const e = await this.env.leer<EstadoSala>(CLAVE_ESTADO);
    if (!e) return;
    await this.guardarCuota();
    // Nadie conectado: la sala se duerme y no gasta cuota. Al volver alguien, arranca otra ronda.
    if (this.env.conexiones().length === 0) return;

    if (e.fase === FASE.ESPERA) {
      e.fase = FASE.CANTANDO;
      e.inicio = this.env.ahora();
      await this.cantar(e);
    } else if (e.fase === FASE.CANTANDO) {
      if (e.cantadas < this.cfg.catalogo) await this.cantar(e);
      else await this.terminar(e);
    } else {
      await this.nuevaRonda(e, true);
    }
  }

  private async cantar(e: EstadoSala): Promise<void> {
    e.cantadas += 1;
    const carta = this.baraja(e.semilla)[e.cantadas - 1];
    e.siguienteEn = this.env.ahora() + this.cfg.cartaMs;
    await this.env.escribir(CLAVE_ESTADO, e);
    await this.env.programarAlarma(this.cfg.cartaMs);
    const conexiones = this.env.conexiones();
    this.difundir(conexiones, codificarCarta(e.ronda, e.cantadas, carta, this.cfg.cartaMs));
    this.difundir(conexiones, codificarStats(conexiones.length, e.ganadores));
  }

  private async terminar(e: EstadoSala): Promise<void> {
    e.fase = FASE.TERMINADA;
    const fin = this.env.ahora();
    e.siguienteEn = fin + this.cfg.finMs;
    await this.env.escribir(CLAVE_ESTADO, e);
    await this.env.programarAlarma(this.cfg.finMs);
    const semilla = deHex(e.semilla);
    this.difundir(this.env.conexiones(), codificarFin(e.ronda, e.ganadores, semilla, this.cfg.finMs));
    if (this.env.guardarRonda) {
      try {
        await this.env.guardarRonda({
          ronda: e.ronda,
          huella: aHex(sha256(semilla)),
          semilla: e.semilla,
          cantadas: this.baraja(e.semilla).slice(0, e.cantadas),
          ganadores: e.ganadores,
          inicio: e.inicio,
          fin,
        });
      } catch {
        // Si el registro falla, el juego sigue: perder un registro no debe detener la sala.
      }
    }
  }

  private async nuevaRonda(prev: EstadoSala | undefined, avisar: boolean): Promise<EstadoSala> {
    const ronda = ((prev?.ronda ?? 0) % 65535) + 1;
    if (prev) {
      await this.env.borrarPrefijo(`lugar:${prev.ronda}:`);
      await this.env.borrarPrefijo(`tabla:${prev.ronda}:`);
    }
    const e: EstadoSala = {
      ronda,
      fase: FASE.ESPERA,
      semilla: aHex(this.env.aleatorio(32)),
      figura: 0, // pura llena
      cantadas: 0,
      siguienteEn: this.env.ahora() + this.cfg.esperaMs,
      ganadores: 0,
      inicio: 0,
    };
    await this.env.escribir(CLAVE_ESTADO, e);
    await this.env.programarAlarma(this.cfg.esperaMs);
    if (avisar) {
      for (const c of this.env.conexiones()) {
        const anterior = c.adjunto();
        if (!anterior) continue;
        const a: Adjunto = { token: anterior.token, ronda, lugar: 0, ultimoReclamo: -1, elegida: 0, espectador: false };
        c.guardarAdjunto(a);
        c.enviar(this.estadoPara(e, a));
      }
    }
    return e;
  }

  private estadoPara(e: EstadoSala, a: Adjunto): Uint8Array {
    const semilla = deHex(e.semilla);
    const { catalogo } = this.cfg;
    let tablas: number[][];
    if (a.espectador) tablas = [];
    else if (e.fase === FASE.ESPERA) tablas = tablasOfrecidas(a.token, e.ronda, catalogo);
    else tablas = [tablaDe(a.token, e.ronda, catalogo, a.elegida)];
    return codificarEstado({
      ronda: e.ronda,
      fase: e.fase,
      figura: e.figura,
      catalogo,
      msSiguiente: Math.max(0, e.siguienteEn - this.env.ahora()),
      jugadores: this.env.conexiones().length,
      ganadores: e.ganadores,
      lugar: a.lugar,
      espectador: a.espectador,
      elegida: a.elegida,
      huella: sha256(semilla),
      tablas,
      cantadas: this.baraja(e.semilla).slice(0, e.cantadas),
      semilla: e.fase === FASE.TERMINADA ? semilla : null,
    });
  }

  private difundir(conexiones: Conexion[], datos: Uint8Array): void {
    for (const c of conexiones) c.enviar(datos);
  }
}
