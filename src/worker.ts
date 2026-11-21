// Worker de entrada. Los archivos de public/ los sirve Cloudflare antes de llegar aquí;
// este código solo recibe /ws y lo pasa a la sala.
// En el plan gratuito hay una sola sala; con más salas, aquí se elegiría una por el token.

import { Sala, type Env } from './sala.ts';

export { Sala };

export default {
  async fetch(peticion: Request, env: Env): Promise<Response> {
    const url = new URL(peticion.url);
    if (url.pathname === '/ws') {
      const sala = env.SALA.get(env.SALA.idFromName('principal'));
      return sala.fetch(peticion);
    }
    return new Response('No encontrado', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
