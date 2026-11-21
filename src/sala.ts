// Adaptador del motor a un Durable Object con WebSockets hibernables:
// mientras nadie manda nada, el objeto puede dormir sin cerrar las conexiones.

import { DurableObject } from 'cloudflare:workers';
import { Motor, TOKEN_VALIDO, type Adjunto, type Conexion, type Config, type RegistroRonda } from './motor.ts';

export interface Env {
  SALA: DurableObjectNamespace<Sala>;
  RONDAS?: R2Bucket;
  ESPERA_MS?: string;
  CARTA_MS?: string;
  FIN_MS?: string;
  CUPO?: string;
  CUOTA_DIARIA?: string;
  UMBRAL_CUOTA?: string;
}

// 54 cartas, con los nombres y el orden de la baraja tradicional.
const CATALOGO = 54;

function numero(valor: string | undefined, porDefecto: number): number {
  const n = Number(valor);
  return valor !== undefined && Number.isFinite(n) ? n : porDefecto;
}

function config(env: Env): Config {
  return {
    esperaMs: numero(env.ESPERA_MS, 10000),
    cartaMs: numero(env.CARTA_MS, 6000),
    finMs: numero(env.FIN_MS, 12000),
    catalogo: CATALOGO,
    cupo: numero(env.CUPO, 5000),
    cuotaDiaria: numero(env.CUOTA_DIARIA, 100_000),
    umbralCuota: numero(env.UMBRAL_CUOTA, 0.9),
  };
}

function conexionDe(ws: WebSocket): Conexion {
  return {
    enviar(datos) {
      try { ws.send(datos); } catch { /* la conexión ya se cerró */ }
    },
    adjunto: () => (ws.deserializeAttachment() as Adjunto | null) ?? null,
    guardarAdjunto: (a) => ws.serializeAttachment(a),
  };
}

/** Clave en R2 de una ronda: rondas/AAAA-MM-DD/{ronda}-{huella8}.json */
export function claveRonda(r: RegistroRonda): string {
  return `rondas/${new Date(r.fin).toISOString().slice(0, 10)}/${r.ronda}-${r.huella.slice(0, 8)}.json`;
}

export class Sala extends DurableObject<Env> {
  private motor: Motor;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const almacen = ctx.storage;
    const rondas = env.RONDAS;
    this.motor = new Motor(
      {
        conexiones: () => ctx.getWebSockets().map(conexionDe),
        programarAlarma: async (enMs) => { await almacen.setAlarm(Date.now() + enMs); },
        hayAlarma: async () => (await almacen.getAlarm()) !== null,
        leer: (clave) => almacen.get(clave),
        escribir: (clave, valor) => almacen.put(clave, valor),
        borrarPrefijo: async (prefijo) => {
          const claves = [...(await almacen.list({ prefix: prefijo })).keys()];
          for (let i = 0; i < claves.length; i += 128) await almacen.delete(claves.slice(i, i + 128));
        },
        ahora: () => Date.now(),
        aleatorio: (n) => crypto.getRandomValues(new Uint8Array(n)),
        guardarRonda: rondas
          ? async (registro) => {
            const clave = claveRonda(registro);
            const cuerpo = JSON.stringify({ ...registro, clave: clave.slice('rondas/'.length, -'.json'.length) });
            const opciones = { httpMetadata: { contentType: 'application/json' } };
            await rondas.put(clave, cuerpo, opciones);
            await rondas.put('rondas/ultima.json', cuerpo, opciones);
          }
          : undefined,
      },
      config(env),
    );
  }

  async fetch(peticion: Request): Promise<Response> {
    if (peticion.headers.get('Upgrade') !== 'websocket') {
      return new Response('Se esperaba una conexión WebSocket', { status: 426 });
    }
    const url = new URL(peticion.url);
    const token = url.searchParams.get('t') ?? '';
    if (!TOKEN_VALIDO.test(token)) return new Response('Token inválido', { status: 400 });
    const rondaPrevia = Number.parseInt(url.searchParams.get('r') ?? '0', 10) || 0;

    const rechazo = await this.motor.admitir();
    if (rechazo) {
      return new Response(JSON.stringify(rechazo), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(rechazo.reintentarEnMs / 1000)),
        },
      });
    }

    const par = new WebSocketPair();
    const [cliente, servidor] = [par[0], par[1]];
    this.ctx.acceptWebSocket(servidor);
    await this.motor.conectar(conexionDe(servidor), token, rondaPrevia);
    return new Response(null, { status: 101, webSocket: cliente });
  }

  async webSocketMessage(ws: WebSocket, mensaje: string | ArrayBuffer): Promise<void> {
    if (typeof mensaje === 'string') return;
    await this.motor.mensaje(conexionDe(ws), new Uint8Array(mensaje));
  }

  async webSocketClose(ws: WebSocket, codigo: number): Promise<void> {
    try { ws.close(codigo === 1005 ? 1000 : codigo, 'adiós'); } catch { /* ya cerrada */ }
  }

  async alarm(): Promise<void> {
    await this.motor.alarma();
  }
}
