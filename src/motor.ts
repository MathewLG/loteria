// El motor de una sala. No sabe nada de Cloudflare: recibe un Entorno con
// conexiones, alarma y almacenamiento. Así corre igual en el Durable Object,
// en el servidor local con Bun y en las pruebas.

import {
  FASE, MOTIVO, T, codificarCarta, codificarEstado, codificarFin, codificarResultado,
  codificarStats, cumpleFigura, decodificar, mascaraCantadas,
} from '../public/js/protocolo.js';
import { aHex, barajar, deHex, sha256, tablaDe } from '../public/js/baraja.js';

export interface Adjunto {
  token: string;
  ronda: number;
  lugar: number;
  ultimoReclamo: number;
}

export interface Conexion {
  enviar(datos: Uint8Array): void;
  adjunto(): Adjunto | null;
  guardarAdjunto(a: Adjunto): void;
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
}

export interface Config {
  esperaMs: number;
  cartaMs: number;
  finMs: number;
  catalogo: number;
}

export interface EstadoSala {
  ronda: number;
  fase: number;
  semilla: string;
  figura: number;
  cantadas: number;
  siguienteEn: number;
  ganadores: number;
}

const CLAVE_ESTADO = 'estado';
const claveLugar = (ronda: number, token: string) => `lugar:${ronda}:${token}`;

export const TOKEN_VALIDO = /^[0-9a-f]{32}$/;

export class Motor {
  private env: Entorno;
  private cfg: Config;
  private cacheBaraja: { semilla: string; cartas: number[] } | null = null;

  constructor(env: Entorno, cfg: Config) {
    this.env = env;
    this.cfg = cfg;
  }

  private baraja(semilla: string): number[] {
    if (this.cacheBaraja?.semilla !== semilla) {
      this.cacheBaraja = { semilla, cartas: barajar(deHex(semilla), this.cfg.catalogo) };
    }
    return this.cacheBaraja.cartas;
  }

  /** Un jugador entra. Si la sala dormía, arranca una ronda nueva. */
  async conectar(c: Conexion, token: string): Promise<void> {
    let e = await this.env.leer<EstadoSala>(CLAVE_ESTADO);
    if (!e || !(await this.env.hayAlarma())) {
      e = await this.nuevaRonda(e, false);
    }
    const lugar = (await this.env.leer<number>(claveLugar(e.ronda, token))) ?? 0;
    c.guardarAdjunto({ token, ronda: e.ronda, lugar, ultimoReclamo: -1 });
    c.enviar(this.estadoPara(e, token, lugar));
  }

  async mensaje(c: Conexion, datos: Uint8Array): Promise<void> {
    const m = decodificar(datos);
    const a = c.adjunto();
    if (!m || !a) return;
    if (m.tipo !== T.LOTERIA) return;

    const e = await this.env.leer<EstadoSala>(CLAVE_ESTADO);
    if (!e || e.fase !== FASE.CANTANDO || m.ronda !== e.ronda) {
      c.enviar(codificarResultado(false, MOTIVO.FUERA_DE_RONDA, 0));
      return;
    }
    if (a.ronda !== e.ronda) {
      a.ronda = e.ronda;
      a.lugar = 0;
      a.ultimoReclamo = -1;
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

    const tabla = tablaDe(a.token, e.ronda, this.cfg.catalogo);
    const salieron = this.baraja(e.semilla).slice(0, e.cantadas);
    const validas = (m.marcadas ?? 0) & mascaraCantadas(tabla, salieron);
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

  /** El reloj de la sala: cada alarma avanza la ronda un paso. */
  async alarma(): Promise<void> {
    const e = await this.env.leer<EstadoSala>(CLAVE_ESTADO);
    if (!e) return;
    // Nadie conectado: la sala se duerme y no gasta cuota. Al volver alguien, arranca otra ronda.
    if (this.env.conexiones().length === 0) return;

    if (e.fase === FASE.ESPERA) {
      e.fase = FASE.CANTANDO;
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
    e.siguienteEn = this.env.ahora() + this.cfg.finMs;
    await this.env.escribir(CLAVE_ESTADO, e);
    await this.env.programarAlarma(this.cfg.finMs);
    this.difundir(this.env.conexiones(), codificarFin(e.ronda, e.ganadores, deHex(e.semilla), this.cfg.finMs));
  }

  private async nuevaRonda(prev: EstadoSala | undefined, avisar: boolean): Promise<EstadoSala> {
    const ronda = ((prev?.ronda ?? 0) % 65535) + 1;
    if (prev) await this.env.borrarPrefijo(`lugar:${prev.ronda}:`);
    const e: EstadoSala = {
      ronda,
      fase: FASE.ESPERA,
      semilla: aHex(this.env.aleatorio(32)),
      figura: 0, // pura llena
      cantadas: 0,
      siguienteEn: this.env.ahora() + this.cfg.esperaMs,
      ganadores: 0,
    };
    await this.env.escribir(CLAVE_ESTADO, e);
    await this.env.programarAlarma(this.cfg.esperaMs);
    if (avisar) {
      for (const c of this.env.conexiones()) {
        const a = c.adjunto();
        if (!a) continue;
        c.guardarAdjunto({ token: a.token, ronda, lugar: 0, ultimoReclamo: -1 });
        c.enviar(this.estadoPara(e, a.token, 0));
      }
    }
    return e;
  }

  private estadoPara(e: EstadoSala, token: string, lugar: number): Uint8Array {
    const semilla = deHex(e.semilla);
    return codificarEstado({
      ronda: e.ronda,
      fase: e.fase,
      figura: e.figura,
      catalogo: this.cfg.catalogo,
      msSiguiente: Math.max(0, e.siguienteEn - this.env.ahora()),
      jugadores: this.env.conexiones().length,
      ganadores: e.ganadores,
      lugar,
      huella: sha256(semilla),
      tabla: tablaDe(token, e.ronda, this.cfg.catalogo),
      cantadas: this.baraja(e.semilla).slice(0, e.cantadas),
      semilla: e.fase === FASE.TERMINADA ? semilla : null,
    });
  }

  private difundir(conexiones: Conexion[], datos: Uint8Array): void {
    for (const c of conexiones) c.enviar(datos);
  }
}
