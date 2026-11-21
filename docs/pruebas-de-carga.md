# Pruebas de carga

`scripts/carga.mjs` simula N jugadores contra una sala y mide si cumple los requerimientos de la especificación: RNF-01 (5,000 simultáneos), RNF-02 (latencia del canto), RNF-03 (respuesta a reclamos), RNF-04 (picos de entrada) y RNF-16 (cuota diaria).

## Cómo correrla

```bash
# 1. Una sala local. Con wrangler (la referencia):
npx wrangler dev --var CARTA_MS:500 --var ESPERA_MS:5000 --var FIN_MS:3000
#    o con Bun, más ligero:
PORT=8787 CARTA_MS=500 ESPERA_MS=5000 FIN_MS=3000 bun dev/servidor-bun.ts

# 2. La carga, en otra terminal:
npm run carga -- 5000 --escenario=entrada --salida=carga.json
```

La prueba espera a que todos los clientes entren y mide **la siguiente ronda completa**. Termina tres segundos después del FIN de esa ronda.

| Opción | Qué hace |
| --- | --- |
| `--url=ws://…/ws` | Dirección de la sala. Por defecto `ws://localhost:8787/ws` |
| `--escenario=entrada` | Los clientes entran repartidos en `--entrada-s` segundos (30 por defecto) |
| `--escenario=reconexion` | A la mitad de la ronda medida, la mitad de los clientes se desconecta y vuelve en 0 a 3 s |
| `--escenario=cupo` | Todos entran en 2 segundos, para probar picos de entrada y el cupo de la sala |
| `--procesos=N` | Reparte los clientes en N procesos. Por defecto uno por cada 1,000 |
| `--pid=N` | PID del servidor local: agrega CPU y memoria al reporte |
| `--salida=archivo.json` | Guarda el reporte completo |

## Qué mide

- **Dispersión por carta:** para cada carta, la diferencia entre el cliente que la recibió primero y el último. Es la latencia de difusión sin necesitar una marca de tiempo del servidor, porque todos los clientes corren en la misma máquina con el mismo reloj.
- **Retraso por cliente:** cuánto tardó cada recepción respecto a la primera de esa carta.
- **Respuesta a reclamos:** de enviar LOTERIA a recibir RESULTADO.
- **Cuota de Cloudflare:** solicitudes estimadas por ronda con este modelo: cada conexión WebSocket cuenta 1, los mensajes entrantes cuentan 1 por cada 20, los salientes son gratis y cada alarma del Durable Object cuenta 1 (una por carta, más la espera y el fin). La entrada inicial se cuenta aparte porque una conexión se queda abierta varias rondas.

## Resultados locales

Medido el 21 de noviembre de 2026 contra `dev/servidor-bun.ts` con `CARTA_MS=500`, en un contenedor con 2 vCPU Intel Xeon a 2.1 GHz y 8 GB de RAM. Servidor y clientes corrieron en la misma máquina.

| Escenario | Clientes | Conexiones fallidas | Dispersión p50 / p95 / p99 | Respuesta a reclamos p50 / p95 | CPU del servidor (promedio / pico) | Memoria del servidor |
| --- | --- | --- | --- | --- | --- | --- |
| entrada (10 s) | 500 | 0 | 8.6 / 14.4 / 15.6 ms | 0.3 / 0.7 ms | 1.7% / 6% | 35 MB |
| entrada (20 s) | 2,000 | 0 | 25.3 / 36.9 / 44.4 ms | 0.3 / 0.8 ms | 6.7% / 69% | 40 MB |
| entrada (30 s) | 5,000 | 0 | 62.8 / 91.0 / 96.2 ms | 0.3 / 56.1 ms | 18.7% / 123%* | 55 MB |
| reconexión | 2,000 | 0 | 30.3 / 47.4 / 55.0 ms | 0.3 / 9.7 ms | 7.6% / 64% | 40 MB |
| cupo (2 s) | 5,000 | 0 | 67.4 / 111.4 / 156.7 ms | 0.3 / 66.2 ms | 19.7% / 101%* | 49 MB |

\* El pico pasa de 100% porque el contenedor tiene dos núcleos.

Con 5,000 clientes, cada carta llegó a todos en menos de 100 ms en el 99% de los casos, muy por debajo de la meta de RNF-02 (< 500 ms p95, < 1 s p99). El límite de este entorno no fue el servidor: 5,000 sockets en 5 procesos de Node más el servidor caben en 2 núcleos, y el límite de descriptores (`ulimit -n`) es 20,000.

**Cuota estimada** (modelo de arriba, 54 cartas por ronda):

| Clientes | Solicitudes por ronda | Entrada inicial | Rondas que caben en 100,000 al día |
| --- | --- | --- | --- |
| 500 | 81 | 500 | ~1,228 |
| 2,000 | 156 | 2,000 | ~628 |
| 5,000 | 306 | 5,000 | ~310 |

Una ronda de 5,000 jugadores a pura llena cuesta unas 300 solicitudes: 56 alarmas más 250 por los gritos (5,000 mensajes entrantes / 20). La entrada de los 5,000 cuesta 5,000 solicitudes una sola vez. En el escenario de reconexión, cada reconexión vuelve a costar 1, por eso las caídas masivas son lo más caro para la cuota.

## Hallazgo: se rechaza la mitad de los gritos

En todas las corridas, cerca de la mitad de los reclamos regresaron `FUERA_DE_RONDA`. A pura llena con 54 cartas, casi todos llenan su tabla en las últimas cartas. El motor termina la ronda `CARTA_MS` después de la última carta, y quien llena con ella tiene solo ese tiempo para gritar. Los bots tardan de 0.3 a 2.5 s en reaccionar, más que los 500 ms de esta prueba.

Con la cadencia real de 6 s el efecto es menor, pero el problema de fondo sigue: alguien que llena con la carta 54 y tarda unos segundos pierde su lugar. Propuesta para el equipo de backend: dar un periodo de gracia para reclamar después de la última carta (por ejemplo, aceptar reclamos durante los primeros segundos de la fase TERMINADA, o esperar más antes del FIN).

## Qué NO dicen estos números

- **Bun en local no es Cloudflare.** En un Durable Object el envío a 5,000 sockets, el límite blando de 1,000 solicitudes por segundo por objeto y la red real se comportan distinto. Estos números validan el motor y el protocolo, no la plataforma.
- **No hay red de por medio.** Todo corre en la misma máquina, sin latencia ni pérdida de paquetes de un celular en 4G.
- **La cuota es una estimación** con el modelo de precios publicado, no una lectura del panel de Cloudflare.
- **El escenario de cupo** todavía no prueba el rechazo por sala llena, porque el cupo se está agregando en otra rama; cuando exista, los clientes rechazados aparecerán como conexiones fallidas.

## Pendiente: medir en el despliegue real

Cuando existan las credenciales de Cloudflare (T-01.5) y el primer despliegue (HU-03):

1. Desplegar con la cadencia de prueba (`CARTA_MS=500`) en un ambiente separado del de producción.
2. Correr la carga desde fuera de Cloudflare, idealmente desde 2 o 3 máquinas, con `--url=wss://<ambiente>.workers.dev/ws` y sumar los resultados.
3. Anotar en el panel de Cloudflare las solicitudes y los GB-s consumidos antes y después de cada corrida, y compararlos con la estimación del reporte.
4. Hacer las corridas justo después del reinicio de cuota de las 18:00 de Guadalajara, y nunca el día del lanzamiento.
5. Agregar los resultados a este documento junto a los locales.
