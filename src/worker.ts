// Worker de entrada. Los archivos de public/ los sirve Cloudflare antes de llegar aquí;
// este código recibe /ws (lo pasa a la sala) y /api/rondas (registros en R2).
// En el plan gratuito hay una sola sala; con más salas, aquí se elegiría una por el token.

import { Sala, type Env } from './sala.ts';

export { Sala };

const CLAVE_RONDA = /^\d{4}-\d{2}-\d{2}\/\d{1,5}-[0-9a-f]{8}$/;

function json(cuerpo: string | null, status = 200): Response {
  return new Response(cuerpo ?? JSON.stringify({ error: 'No encontrado' }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': status === 200 ? 'public, max-age=60' : 'no-store' },
  });
}

async function leerRonda(env: Env, clave: string): Promise<Response> {
  if (!env.RONDAS) return json(null, 404);
  const objeto = await env.RONDAS.get(clave);
  return objeto ? json(await objeto.text()) : json(null, 404);
}

export default {
  async fetch(peticion: Request, env: Env): Promise<Response> {
    const url = new URL(peticion.url);
    if (url.pathname === '/ws') {
      const sala = env.SALA.get(env.SALA.idFromName('principal'));
      return sala.fetch(peticion);
    }
    if (url.pathname.startsWith('/api/rondas/') && peticion.method === 'GET') {
      const resto = decodeURIComponent(url.pathname.slice('/api/rondas/'.length));
      if (resto === 'ultima') return leerRonda(env, 'rondas/ultima.json');
      if (CLAVE_RONDA.test(resto)) return leerRonda(env, `rondas/${resto}.json`);
      return json(null, 404);
    }
    return new Response('No encontrado', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
