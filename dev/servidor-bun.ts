// Servidor local alterno, sin Cloudflare: el mismo motor con Bun.
// Úsalo si no quieres instalar wrangler. La ruta oficial es `npm run dev`.

import { join, normalize } from 'node:path';
import { Motor, TOKEN_VALIDO, type Adjunto, type Conexion } from '../src/motor.ts';

type Datos = { token: string; adjunto: Adjunto | null };
type Socket = import('bun').ServerWebSocket<Datos>;

const PUERTO = Number(process.env.PORT ?? 8787);
const PUBLICO = join(import.meta.dir, '..', 'public');
const sockets = new Set<Socket>();
const almacen = new Map<string, unknown>();
let temporizador: ReturnType<typeof setTimeout> | undefined;
let alarmaPendiente = false;

const conexionDe = (ws: Socket): Conexion => ({
  enviar: (datos) => { ws.send(datos); },
  adjunto: () => ws.data.adjunto,
  guardarAdjunto: (a) => { ws.data.adjunto = { ...a }; },
});

const motor = new Motor(
  {
    conexiones: () => [...sockets].map(conexionDe),
    programarAlarma: async (enMs) => {
      clearTimeout(temporizador);
      alarmaPendiente = true;
      temporizador = setTimeout(() => {
        alarmaPendiente = false;
        motor.alarma().catch(console.error);
      }, enMs);
    },
    hayAlarma: async () => alarmaPendiente,
    leer: async <V>(clave: string) => structuredClone(almacen.get(clave)) as V | undefined,
    escribir: async (clave, valor) => { almacen.set(clave, structuredClone(valor)); },
    borrarPrefijo: async (prefijo) => {
      for (const clave of [...almacen.keys()]) if (clave.startsWith(prefijo)) almacen.delete(clave);
    },
    ahora: () => Date.now(),
    aleatorio: (n) => crypto.getRandomValues(new Uint8Array(n)),
  },
  {
    esperaMs: Number(process.env.ESPERA_MS ?? 10000),
    cartaMs: Number(process.env.CARTA_MS ?? 6000),
    finMs: Number(process.env.FIN_MS ?? 12000),
    catalogo: 54,
  },
);

Bun.serve<Datos, never>({
  port: PUERTO,
  async fetch(peticion, servidor) {
    const url = new URL(peticion.url);
    if (url.pathname === '/ws') {
      const token = url.searchParams.get('t') ?? '';
      if (!TOKEN_VALIDO.test(token)) return new Response('Token inválido', { status: 400 });
      if (servidor.upgrade(peticion, { data: { token, adjunto: null } })) return undefined;
      return new Response('Se esperaba una conexión WebSocket', { status: 426 });
    }
    const ruta = normalize(decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (ruta.includes('..')) return new Response('No encontrado', { status: 404 });
    const archivo = Bun.file(join(PUBLICO, ruta));
    return (await archivo.exists()) ? new Response(archivo) : new Response('No encontrado', { status: 404 });
  },
  websocket: {
    async open(ws) {
      sockets.add(ws);
      await motor.conectar(conexionDe(ws), ws.data.token);
    },
    async message(ws, mensaje) {
      if (typeof mensaje === 'string') return;
      await motor.mensaje(conexionDe(ws), new Uint8Array(mensaje));
    },
    close(ws) {
      sockets.delete(ws);
    },
  },
});

console.log(`Lotería local en http://localhost:${PUERTO}`);
