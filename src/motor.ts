// El motor de una sala. No sabe nada de Cloudflare: recibe un Entorno con
// conexiones, alarma y almacenamiento. Así corre igual en el Durable Object,
// en el servidor local con Bun y en las pruebas.

import {
  FASE, LARGO_PASE, MAX_MS_CARTA, MOTIVO, T, codificarCarta, codificarEleccion, codificarEstado, codificarFin,
  codificarResultado, codificarStats, cumpleFigura, decodificar, mascaraCantadas,
} from '../public/js/protocolo.js';
import { NUMEROS_DE_CARTA, TABLAS_OFRECIDAS, aHex, barajar, deHex, igualesBytes, numeroDeCarta, sha256, tablaDe, tablasOfrecidas } from '../public/js/baraja.js';

export interface Adjunto {
  token: string;
  ronda: number;
  lugar: number;
  ultimoReclamo: number;
  /** Momento del último reclamo: a lo más un reclamo por segundo por conexión. */
  ultimoReclamoEn?: number;
  /** Gritó ¡Lotería! sin tener la carta llena: queda fuera el resto de la ronda. */
  descalificado?: boolean;
  /** Índice de la tabla elegida entre las ofrecidas (0..2). */
  elegida: number;
  /** Número de carta (0..999) de la primera ofrecida. La carta en juego es (base + elegida) mod 1000. */
  base?: number;
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
  /** Todas las claves con un prefijo, con su valor. Leer filas es barato; escribirlas no. */
  leerPrefijo<V>(prefijo: string): Promise<Map<string, V>>;
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
  /** Tiempo para gritar después de la última carta, antes de cerrar la ronda. A pura llena casi todos llenan al final. */
  graciaMs?: number;
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
// Los ganadores se guardan en lotes, una fila por lote, nunca una por jugador:
// el plan gratuito permite 100,000 filas escritas al día en Durable Objects con SQLite.
const prefijoGanadores = (ronda: number) => `ganadores:${ronda}:`;
// Los descalificados también van en lotes: a lo más una fila por paso del reloj, sin importar
// cuántos griten en falso. Así una descalificación sobrevive a la reconexión sin escribir por jugador.
const prefijoDescalificados = (ronda: number) => `descalificados:${ronda}:`;
const MAX_POR_LOTE = 1500; // ~60 KB por fila, debajo del límite de 128 KiB por valor
const DIA_MS = 86_400_000;

export const TOKEN_VALIDO = /^[0-9a-f]{32}$/;
export const PASE_VALIDO = /^[0-9a-f]{32}$/;

/**
 * Lee de la URL del WebSocket lo que el cliente guardó: c (número de carta que conserva),
 * y para volver a su ronda r (ronda) y p (pase).
 */
export function reanudarDeUrl(url: URL): Reanudar {
  const ronda = Number.parseInt(url.searchParams.get('r') ?? '', 10);
  const carta = Number.parseInt(url.searchParams.get('c') ?? '0', 10);
  const pase = url.searchParams.get('p') ?? undefined;
  return {
    ronda: Number.isInteger(ronda) && ronda > 0 ? ronda : 0,
    carta: Number.isInteger(carta) && carta >= 0 && carta < NUMEROS_DE_CARTA ? carta : 0,
    pase,
  };
}

/** Lo que un cliente manda al conectar: la carta que conserva y, si vuelve a su ronda, el pase. */
export interface Reanudar {
  /** Ronda a la que vuelve, 0 si no vuelve a ninguna. */
  ronda: number;
  /** Número de carta (0..999) que el jugador conserva entre rondas. */
  carta: number;
  pase?: string;
}

/** Número de carta en juego de un jugador. */
const cartaEnJuego = (a: Adjunto) => numeroDeCarta((a.base ?? 0) + a.elegida);

/** Ganadores de la ronda en memoria; se guardan en lotes en cada paso del reloj. */
interface Ganadores {
  ronda: number;
  lugares: Map<string, number>;
  pendientes: Map<string, number>;
  lotes: number;
  ultimoGuardado: number;
  descalificados: Set<string>;
  descalificadosPendientes: Set<string>;
  lotesDescalificados: number;
}

const codificador = new TextEncoder();

/**
 * Pase de un jugador para una ronda. Depende de la semilla, que es secreta hasta el final,
 * así que solo la sala puede emitirlo. Sustituye a guardar la tabla elegida de cada jugador.
 */
export function calcularPase(semilla: string, token: string, carta: number): Uint8Array {
  return sha256(codificador.encode(`pase:${semilla}:${token}:${carta}`)).slice(0, LARGO_PASE);
}

export class Motor {
  private env: Entorno;
  private cfg: Required<Config>;
  private cacheBaraja: { semilla: string; cartas: number[] } | null = null;
  private cuota: Cuota | null = null;
  private ganadores: Ganadores | null = null;

  constructor(env: Entorno, cfg: Config) {
    this.env = env;
    this.cfg = { cupo: 5000, cuotaDiaria: 100_000, umbralCuota: 0.9, graciaMs: 10000, ...cfg };
    // La carta anuncia el tiempo en un byte de 200 ms: más de 51 s no cabe.
    for (const campo of ['cartaMs', 'graciaMs'] as const) {
      if (this.cfg[campo] > MAX_MS_CARTA) {
        console.warn(`${campo} = ${this.cfg[campo]} ms no cabe en el mensaje de carta; se usa ${MAX_MS_CARTA} ms.`);
        this.cfg[campo] = MAX_MS_CARTA;
      }
    }
  }

  // ---- Ganadores ----

  /** Carga los ganadores de la ronda si la memoria se perdió (el objeto pudo dormir). */
  private async ganadoresDe(ronda: number): Promise<Ganadores> {
    if (this.ganadores?.ronda === ronda) return this.ganadores;
    const lugares = new Map<string, number>();
    const lotes = await this.env.leerPrefijo<Record<string, number>>(prefijoGanadores(ronda));
    for (const lote of lotes.values()) for (const [token, lugar] of Object.entries(lote)) lugares.set(token, lugar);
    const descalificados = new Set<string>();
    const lotesD = await this.env.leerPrefijo<string[]>(prefijoDescalificados(ronda));
    for (const lote of lotesD.values()) for (const token of lote) descalificados.add(token);
    this.ganadores = {
      ronda, lugares, pendientes: new Map(), lotes: lotes.size, ultimoGuardado: this.env.ahora(),
      descalificados, descalificadosPendientes: new Set(), lotesDescalificados: lotesD.size,
    };
    return this.ganadores;
  }

  /** Escribe los ganadores nuevos como una fila (o pocas). Se llama en cada paso del reloj. */
  private async guardarGanadores(): Promise<void> {
    const g = this.ganadores;
    if (!g || (g.pendientes.size === 0 && g.descalificadosPendientes.size === 0)) return;
    g.ultimoGuardado = this.env.ahora();
    if (g.descalificadosPendientes.size > 0) {
      const tokens = [...g.descalificadosPendientes];
      g.descalificadosPendientes = new Set();
      for (let i = 0; i < tokens.length; i += MAX_POR_LOTE) {
        await this.env.escribir(`${prefijoDescalificados(g.ronda)}${String(g.lotesDescalificados).padStart(4, '0')}`, tokens.slice(i, i + MAX_POR_LOTE));
        g.lotesDescalificados += 1;
      }
    }
    if (g.pendientes.size === 0) return;
    const pendientes = [...g.pendientes];
    g.pendientes = new Map();
    for (let i = 0; i < pendientes.length; i += MAX_POR_LOTE) {
      const lote = Object.fromEntries(pendientes.slice(i, i + MAX_POR_LOTE));
      await this.env.escribir(`${prefijoGanadores(g.ronda)}${String(g.lotes).padStart(4, '0')}`, lote);
      g.lotes += 1;
    }
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
    const gracia = this.graciaMs() - cartaMs;
    if (e.fase === FASE.ESPERA) return resta + catalogo * cartaMs + gracia + finMs;
    if (e.fase === FASE.CANTANDO) return resta + (catalogo - e.cantadas) * cartaMs + gracia + finMs;
    return resta;
  }

  // ---- Jugadores ----

  /**
   * Un jugador entra. Si la sala dormía, arranca una ronda nueva.
   * `reanudar` es lo que el cliente guardó: el número de carta que conserva entre rondas y,
   * si vuelve a su ronda durante el canto, un pase válido para no quedar como espectador.
   * No se escribe nada por jugador: la carta vive en el cliente, en el adjunto y en el pase.
   */
  async conectar(c: Conexion, token: string, reanudar?: Reanudar): Promise<void> {
    let e = await this.env.leer<EstadoSala>(CLAVE_ESTADO);
    if (!e || !(await this.env.hayAlarma())) {
      e = await this.nuevaRonda(e, false);
    }
    const g = await this.ganadoresDe(e.ronda);
    const lugar = g.lugares.get(token) ?? 0;
    const descalificado = g.descalificados.has(token);
    // La carta que el jugador conserva viene en la URL; en la espera se le ofrece primero.
    const base = numeroDeCarta(reanudar?.carta ?? 0);
    let espectador = false;
    if (e.fase !== FASE.ESPERA) {
      // Durante el canto solo juega quien trae un pase válido para esta ronda y esa carta.
      const paseOk = !!reanudar && reanudar.ronda === e.ronda && !!reanudar.pase && PASE_VALIDO.test(reanudar.pase)
        && igualesBytes(deHex(reanudar.pase), calcularPase(e.semilla, token, base));
      espectador = e.fase === FASE.CANTANDO && !paseOk && lugar === 0;
    }
    const a: Adjunto = { token, ronda: e.ronda, lugar, ultimoReclamo: -1, elegida: 0, base, espectador, descalificado };
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
      c.enviar(codificarEleccion(false, a.elegida, a.espectador || !e ? null : this.paseDe(e, a)));
      return;
    }
    a.elegida = indice;
    c.guardarAdjunto(a);
    c.enviar(codificarEleccion(true, indice, this.paseDe(e, a)));
  }

  private async reclamar(c: Conexion, a: Adjunto, ronda: number, marcadas: number): Promise<void> {
    const e = await this.env.leer<EstadoSala>(CLAVE_ESTADO);
    if (!e || e.fase !== FASE.CANTANDO || ronda !== e.ronda) {
      c.enviar(codificarResultado(false, MOTIVO.FUERA_DE_RONDA, 0));
      return;
    }
    if (a.ronda !== e.ronda) {
      // El adjunto quedó de una ronda anterior: en esta ronda juega con la misma carta.
      Object.assign(a, { ronda: e.ronda, lugar: 0, ultimoReclamo: -1, base: cartaEnJuego(a), elegida: 0, espectador: false, descalificado: false });
    }
    if (a.espectador) {
      c.enviar(codificarResultado(false, MOTIVO.ESPECTADOR, 0));
      return;
    }
    if (a.lugar > 0) {
      c.enviar(codificarResultado(true, MOTIVO.YA_GANASTE, a.lugar));
      return;
    }
    const g = await this.ganadoresDe(e.ronda);
    if (a.descalificado || g.descalificados.has(a.token)) {
      a.descalificado = true;
      c.guardarAdjunto(a);
      c.enviar(codificarResultado(false, MOTIVO.DESCALIFICADO, 0));
      return;
    }
    // A lo más un reclamo por segundo por conexión, para que nadie gaste la cuota a gritos.
    const ahora = this.env.ahora();
    if (ahora - (a.ultimoReclamoEn ?? -Infinity) < 1000) {
      c.enviar(codificarResultado(false, MOTIVO.MUY_SEGUIDO, 0));
      return;
    }
    a.ultimoReclamo = e.cantadas;
    a.ultimoReclamoEn = ahora;

    // Como en la mesa: gana quien grita con su carta llena, es decir, con frijol en las 16
    // casillas y las 16 cartas ya cantadas. Gritar sin eso es una falsa lotería y deja fuera
    // al jugador el resto de la ronda (también si se reconecta).
    const tabla = tablaDe(a.token, cartaEnJuego(a), this.cfg.catalogo);
    const salieron = this.baraja(e.semilla).slice(0, e.cantadas);
    const llena = (marcadas & 0xffff) === 0xffff && cumpleFigura(mascaraCantadas(tabla, salieron), e.figura);
    if (!llena) {
      a.descalificado = true;
      g.descalificados.add(a.token);
      g.descalificadosPendientes.add(a.token);
      c.guardarAdjunto(a);
      c.enviar(codificarResultado(false, MOTIVO.DESCALIFICADO, 0));
      if (ahora - g.ultimoGuardado >= 1000 || g.descalificadosPendientes.size >= MAX_POR_LOTE) await this.guardarGanadores();
      return;
    }

    // Un token gana una sola vez por ronda, aunque grite desde varias conexiones (#42).
    // Leer y apartar el lugar ocurre sin pausas intermedias, así que dos conexiones no se cruzan.
    const previo = g.lugares.get(a.token);
    if (previo) {
      a.lugar = previo;
      c.guardarAdjunto(a);
      c.enviar(codificarResultado(true, MOTIVO.YA_GANASTE, previo));
      return;
    }
    a.lugar = g.lugares.size + 1;
    g.lugares.set(a.token, a.lugar);
    g.pendientes.set(a.token, a.lugar);
    c.guardarAdjunto(a);
    c.enviar(codificarResultado(true, MOTIVO.OK, a.lugar));
    // Se guardan en lote; si llevan más de un segundo esperando, se guardan ya.
    if (ahora - g.ultimoGuardado >= 1000 || g.pendientes.size >= MAX_POR_LOTE) await this.guardarGanadores();
  }

  // ---- Reloj ----

  /** El reloj de la sala: cada alarma avanza la ronda un paso. */
  async alarma(): Promise<void> {
    const e = await this.env.leer<EstadoSala>(CLAVE_ESTADO);
    if (!e) return;
    await this.guardarCuota();
    await this.guardarGanadores();
    // Si el objeto durmió, la memoria de ganadores se recarga de sus lotes.
    e.ganadores = (await this.ganadoresDe(e.ronda)).lugares.size;
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

  /** Después de la última carta la ronda espera al menos esto antes de cerrar. */
  private graciaMs(): number {
    return Math.max(this.cfg.cartaMs, this.cfg.graciaMs);
  }

  private async cantar(e: EstadoSala): Promise<void> {
    e.cantadas += 1;
    const carta = this.baraja(e.semilla)[e.cantadas - 1];
    const espera = e.cantadas >= this.cfg.catalogo ? this.graciaMs() : this.cfg.cartaMs;
    e.siguienteEn = this.env.ahora() + espera;
    await this.env.escribir(CLAVE_ESTADO, e);
    await this.env.programarAlarma(espera);
    const conexiones = this.env.conexiones();
    this.difundir(conexiones, codificarCarta(e.ronda, e.cantadas, carta, espera));
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
      await this.env.borrarPrefijo(prefijoGanadores(prev.ronda));
      await this.env.borrarPrefijo(prefijoDescalificados(prev.ronda));
    }
    this.ganadores = null;
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
        // La ronda nueva empieza con la misma carta que jugó en la anterior, ya elegida.
        const a: Adjunto = { token: anterior.token, ronda, lugar: 0, ultimoReclamo: -1, base: cartaEnJuego(anterior), elegida: 0, espectador: false };
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
    else if (e.fase === FASE.ESPERA) tablas = tablasOfrecidas(a.token, a.base ?? 0, catalogo);
    else tablas = [tablaDe(a.token, cartaEnJuego(a), catalogo)];
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
      descalificado: !!a.descalificado,
      pase: e.fase !== FASE.TERMINADA && !a.espectador ? this.paseDe(e, a) : null,
      elegida: e.fase === FASE.ESPERA ? a.elegida : 0,
      base: e.fase === FASE.ESPERA ? (a.base ?? 0) : cartaEnJuego(a),
      huella: sha256(semilla),
      tablas,
      cantadas: this.baraja(e.semilla).slice(0, e.cantadas),
      semilla: e.fase === FASE.TERMINADA ? semilla : null,
    });
  }

  private paseDe(e: EstadoSala, a: Adjunto): Uint8Array {
    return calcularPase(e.semilla, a.token, cartaEnJuego(a));
  }

  private difundir(conexiones: Conexion[], datos: Uint8Array): void {
    for (const c of conexiones) c.enviar(datos);
  }
}
