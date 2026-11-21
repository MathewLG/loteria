// Servidor local alterno, sin Cloudflare: el mismo motor con Bun.
// Úsalo si no quieres instalar wrangler. La ruta oficial es `npm run dev`.

import { join, normalize } from 'node:path';
import { Motor, TOKEN_VALIDO, type Adjunto, type Conexion, type RegistroRonda } from '../src/motor.ts';

type Datos = { token: string; rondaPrevia: number; adjunto: Adjunto | null };
type Socket = import('bun').ServerWebSocket<Datos>;

const PUERTO = Number(process.env.PORT ?? 8787);
const PUBLICO = join(import.meta.dir, '..', 'public');
const sockets = new Set<Socket>();
const almacen = new Map<string, unknown>();
let temporizador: ReturnType<typeof setTimeout> | undefined;
let alarmaPendiente = false;
// Registros de rondas terminadas, en memoria (en producción van a R2).
const rondas = new Map<string, string>();

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
    guardarRonda: async (r: RegistroRonda) => {
      const clave = `${new Date(r.fin).toISOString().slice(0, 10)}/${r.ronda}-${r.huella.slice(0, 8)}`;
      const cuerpo = JSON.stringify({ ...r, clave });
      rondas.set(clave, cuerpo);
      rondas.set('ultima', cuerpo);
    },
  },
  {
    esperaMs: Number(process.env.ESPERA_MS ?? 10000),
    cartaMs: Number(process.env.CARTA_MS ?? 6000),
    finMs: Number(process.env.FIN_MS ?? 12000),
    graciaMs: Number(process.env.GRACIA_MS ?? 10000),
    catalogo: 54,
    cupo: Number(process.env.CUPO ?? 5000),
    cuotaDiaria: Number(process.env.CUOTA_DIARIA ?? 100_000),
    umbralCuota: Number(process.env.UMBRAL_CUOTA ?? 0.9),
  },
);

Bun.serve<Datos, never>({
  port: PUERTO,
  async fetch(peticion, servidor) {
    const url = new URL(peticion.url);
    if (url.pathname === '/ws') {
      const token = url.searchParams.get('t') ?? '';
      if (!TOKEN_VALIDO.test(token)) return new Response('Token inválido', { status: 400 });
      const rondaPrevia = Number.parseInt(url.searchParams.get('r') ?? '0', 10) || 0;
      const rechazo = await motor.admitir();
      if (rechazo) {
        return new Response(JSON.stringify(rechazo), {
          status: 503,
          headers: { 'Content-Type': 'application/json', 'Retry-After': String(Math.ceil(rechazo.reintentarEnMs / 1000)) },
        });
      }
      if (servidor.upgrade(peticion, { data: { token, rondaPrevia, adjunto: null } })) return undefined;
      return new Response('Se esperaba una conexión WebSocket', { status: 426 });
    }
    if (url.pathname.startsWith('/api/rondas/')) {
      const cuerpo = rondas.get(decodeURIComponent(url.pathname.slice('/api/rondas/'.length)));
      return new Response(cuerpo ?? JSON.stringify({ error: 'No encontrado' }), {
        status: cuerpo ? 200 : 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const ruta = normalize(decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (ruta.includes('..')) return new Response('No encontrado', { status: 404 });
    const archivo = Bun.file(join(PUBLICO, ruta));
    return (await archivo.exists()) ? new Response(archivo) : new Response('No encontrado', { status: 404 });
  },
  websocket: {
    async open(ws) {
      sockets.add(ws);
      await motor.conectar(conexionDe(ws), ws.data.token, ws.data.rondaPrevia);
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
