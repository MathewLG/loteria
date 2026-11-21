// Adaptador del motor a un Durable Object con WebSockets hibernables:
// mientras nadie manda nada, el objeto puede dormir sin cerrar las conexiones.

import { DurableObject } from 'cloudflare:workers';
import { Motor, TOKEN_VALIDO, type Adjunto, type Conexion, type Config } from './motor.ts';

export interface Env {
  SALA: DurableObjectNamespace<Sala>;
  ESPERA_MS?: string;
  CARTA_MS?: string;
  FIN_MS?: string;
}

// 54 cartas, con los nombres y el orden de la baraja tradicional. Las que no tienen arte se ven provisionales.
const CATALOGO = 54;

function config(env: Env): Config {
  return {
    esperaMs: Number(env.ESPERA_MS ?? 10000),
    cartaMs: Number(env.CARTA_MS ?? 6000),
    finMs: Number(env.FIN_MS ?? 12000),
    catalogo: CATALOGO,
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

export class Sala extends DurableObject<Env> {
  private motor: Motor;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const almacen = ctx.storage;
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
      },
      config(env),
    );
  }

  async fetch(peticion: Request): Promise<Response> {
    if (peticion.headers.get('Upgrade') !== 'websocket') {
      return new Response('Se esperaba una conexión WebSocket', { status: 426 });
    }
    const token = new URL(peticion.url).searchParams.get('t') ?? '';
    if (!TOKEN_VALIDO.test(token)) return new Response('Token inválido', { status: 400 });

    const par = new WebSocketPair();
    const [cliente, servidor] = [par[0], par[1]];
    this.ctx.acceptWebSocket(servidor);
    await this.motor.conectar(conexionDe(servidor), token);
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
