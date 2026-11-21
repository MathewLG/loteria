# La Lotería más grande del mundo

Una lotería mexicana en tiempo real para miles de personas a la vez, a pura llena, con baraja verificable y costo de cómputo cero en el plan gratuito de Cloudflare.

## Estado

- [x] Especificación técnica y arquitectura en Cloudflare
- [x] Dirección visual: grabado de feria a cuatro tintas
- [x] MVP local: sala en Durable Object, cliente web, frijoles, baraja verificable, bots
- [ ] Arte de las 39 cartas que faltan
- [ ] Fase 0: prueba de carga con 5,000 clientes y medición de cuotas gratuitas
- [ ] Audio del gritón, PWA instalable, Turnstile
- [ ] Revisión legal (marcas en el IMPI) y lanzamiento

## MVP local

Una sola sala de lotería en tiempo real. El servidor canta las cartas en un orden al azar que cualquiera puede verificar al terminar la ronda. Tú juegas desde el navegador con la interfaz y las animaciones finales.

## Cómo correrlo

Requisitos: Node 22.18 o más nuevo.

```bash
npm install
npm run dev
```

Abre http://localhost:8787. La primera ronda empieza 10 segundos después de que entra alguien. Se juega a pura llena: solo gana quien llena toda su tabla.

`npm run dev` levanta el Worker y el Durable Object con `wrangler dev`, que usa el mismo runtime de Cloudflare que producción. No hace falta cuenta de Cloudflare para correrlo en local.

### Jugar contra otros

En otra terminal:

```bash
npm run bots -- 30
```

Conecta 30 jugadores simulados que marcan con distintos reflejos y gritan "¡Lotería!" cuando llenan su tabla.

### Probar en tu teléfono

```bash
npm run dev:telefono
```

Abre `http://<IP de tu laptop>:8787` desde el teléfono, en la misma red Wi-Fi.

### Cambiar la velocidad

En `wrangler.jsonc`, sección `vars`: `ESPERA_MS` (antes de la ronda), `CARTA_MS` (entre cartas) y `FIN_MS` (pantalla de resultados).

### Sin wrangler

Si tienes [Bun](https://bun.sh), `npm run dev:bun` corre el mismo motor sin Cloudflare. Sirve para iterar rápido; la referencia sigue siendo `npm run dev`.

## Pruebas

```bash
npm test
```

Verifican SHA-256 y ChaCha20 contra vectores de referencia, que la baraja sea una permutación determinista y las reglas de la sala: reclamos válidos, inválidos, repetidos y reconexión.

## Cómo está armado

```
public/            Lo que ve el jugador (estático, sin compilar)
  js/baraja.js     SHA-256, ChaCha20 y Fisher-Yates. Lo usan servidor y navegador
  js/protocolo.js  Mensajes binarios y figuras. Lo usan servidor, navegador y bots
  js/cartas.js     Nombres tradicionales y arte propio de las cartas, en SVG
  js/app.js        El juego en el navegador
src/
  motor.ts         Reglas de la sala, independiente del runtime
  sala.ts          Adaptador a Durable Object con WebSockets hibernables y alarmas
  worker.ts        Entrada: manda /ws a la sala
dev/servidor-bun.ts  El mismo motor con Bun
scripts/bots.mjs     Jugadores simulados
test/                Pruebas con node:test
```

**Baraja verificable.** Al empezar cada ronda la sala genera una semilla de 32 bytes y publica solo su SHA-256 (la huella). Las cartas salen de revolver con Fisher-Yates usando ChaCha20 con esa semilla. Al final se revela la semilla y cada navegador repite el cálculo: si la huella o el orden no coinciden, lo dice.

**Tablas sin guardar.** La tabla de cada jugador sale de `SHA-256(token + ronda)`. La sala no guarda tablas: las recalcula cuando hace falta, también después de hibernar.

**Mensajes.** Binarios y pequeños. Una carta cantada pesa 6 bytes. El navegador solo grita "¡Lotería!" cuando su tabla ya cumple la figura, para no gastar cuota con reclamos inútiles. La sala valida contra las cartas que de verdad salieron.

**Sala dormida.** Si no queda nadie conectado, la alarma no se reprograma y el objeto se duerme. La siguiente persona que entra arranca una ronda nueva.

## Límites de esta versión

- La baraja usa los 54 nombres y el orden de la lotería tradicional, con arte propio. Por ahora 15 cartas tienen dibujo; las demás se ven con su número y la leyenda "arte pendiente".
- Una ronda completa dura unos 5 minutos y medio (54 cartas a 6 segundos). Para probar más rápido, baja `CARTA_MS`.
- Una sola sala, sin Turnstile, sin audio y sin instalación como PWA.
- Las tipografías vienen de Google Fonts; sin internet se ven con la tipografía del sistema.
