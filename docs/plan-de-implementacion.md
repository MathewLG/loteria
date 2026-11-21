# Plan de implementación

Este plan convierte la [especificación técnica](https://claude.ai/artifact/WYLgVTR9DkndjiPZUmu18Z) en historias de usuario y tareas. Los identificadores RF y RNF son los requerimientos funcionales y no funcionales de esa especificación.

Cada historia vive también como issue en GitHub, dentro del milestone de su fase. Este archivo es el mapa; los issues son donde se trabaja y se cierra.

## Decisiones que el plan da por tomadas

- **Juego:** pura llena. Gana quien llena las 16 cartas de su tabla. Baraja de 54 cartas con los nombres y el orden tradicionales, arte propio.
- **Plataforma:** PWA móvil, sin instalación, distribuida por link.
- **Servidor:** Cloudflare Workers y Durable Objects en el plan gratuito. Costo de cómputo 0 USD (RNF-13). Una sola sala para 5,000 jugadores (RNF-01); ruta documentada a 100,000 en el plan de pago sin reescribir código.
- **Motor:** independiente del runtime (`src/motor.ts`). El Durable Object y el servidor con Bun son adaptadores.
- **Protocolo:** binario. Una carta cantada pesa 6 bytes.
- **Baraja verificable:** ChaCha20 + Fisher-Yates, huella SHA-256 publicada al inicio, semilla revelada al final.
- **Tablas:** derivadas de `SHA-256(token + ronda)`; la sala no las guarda.
- **Calidad visual:** reglas antislop en todo cambio de interfaz (RNF-15).

## Cómo trabajamos

**Flujo de cambios**

1. Cada tarea sale de un issue y se hace en una rama `tipo/descripcion-corta` (`feat/`, `fix/`, `docs/`, `test/`, `chore/`).
2. Se abre un pull request que menciona el issue (`Cierra #12`).
3. CI debe pasar: pruebas unitarias y revisión de tipos. `main` está protegida: no se sube directo y no se fuerza.
4. Se fusiona con squash para que el historial de `main` quede lineal.
5. Al llegar a `main`, el workflow de despliegue publica en Cloudflare (cuando existan los secretos).

**Una historia está lista para empezar cuando** tiene criterios de aceptación verificables, se sabe qué requerimientos cubre y no depende de algo sin terminar.

**Una historia está terminada cuando:**

- Cumple todos sus criterios de aceptación.
- Tiene pruebas automáticas para la lógica nueva (motor, protocolo, baraja) y CI pasa.
- Si toca la interfaz: pasa el Delivery Gate de antislop, funciona con teclado, tiene estados vacío, cargando y error, y se ve bien a 360 px de ancho.
- La documentación afectada (README, este plan, la especificación) está al día.

**Revisión al cierre de cada fase**

Al terminar las historias de una fase, antes de abrir la siguiente:

1. **Equipo de QA:** prueba de punta a punta en navegador de escritorio y móvil, casos borde del protocolo, reconexión, carga con bots. Abre un issue por hallazgo con pasos para reproducir.
2. **Equipo de desarrollo:** corrige los hallazgos en PRs. QA confirma cada corrección.
3. **Equipo de UI/UX y diseño:** evalúa interfaz, cartas, accesibilidad y textos contra las reglas antislop y WCAG 2.2 AA (RNF-10). Sus hallazgos siguen el mismo ciclo.

La fase se cierra cuando no quedan hallazgos de prioridad alta abiertos.

**Tamaños:** S (menos de medio día), M (uno o dos días), L (tres días o más; conviene partirla).

---

## Fase 0 · Cimientos y costo cero

Objetivo: probar que el diseño de costo cero aguanta 5,000 jugadores y dejar la maquinaria de desarrollo lista. Es la fase que confirma o descarta la arquitectura.

### HU-01 · Entrega continua confiable

*Como desarrollador quiero que cada cambio pase por pruebas automáticas y se despliegue solo, para no romper el juego en producción.*

Criterios de aceptación:
- Un PR no se puede fusionar si fallan las pruebas o los tipos.
- Nadie puede subir directo a `main` ni forzar su historial.
- Un cambio en `main` se despliega en Cloudflare sin pasos manuales.
- Las dependencias quedan fijadas con `package-lock.json`.

Tareas:
- [x] T-01.1 Workflow de CI: pruebas unitarias y tipos (S)
- [x] T-01.2 Workflow de despliegue con `wrangler-action`, que se salta si faltan secretos (S)
- [ ] T-01.3 Protección de `main`: PR obligatorio, checks requeridos, historial lineal, sin push forzado (S)
- [ ] T-01.4 Generar y subir `package-lock.json`; cambiar CI a `npm ci` (S)
- [ ] T-01.5 Crear cuenta de Cloudflare, token con permiso de Workers y secretos `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` (S)
- [x] T-01.6 Plantillas de issue (historia, error) y de PR con la definición de terminado (S)

### HU-02 · Prueba de carga de 5,000 jugadores

*Como desarrollador quiero simular 5,000 jugadores contra una sala, para saber si el plan gratuito aguanta antes de invitar a nadie.* Cubre RNF-01, RNF-02, RNF-03, RNF-04, RNF-16.

Criterios de aceptación:
- Un script levanta N clientes con ritmos humanos y reporta latencia de entrega de cartas (p50, p95, p99), tiempo de respuesta a reclamos y desconexiones.
- Corre contra `wrangler dev` y contra el despliegue real.
- El reporte incluye cuántas solicitudes de la cuota diaria consume una ronda y cuántas rondas caben en un día.
- Con 5,000 clientes: carta a todos en < 500 ms p95 y < 1 s p99; respuesta a reclamos < 1 s p95.

Tareas:
- [x] T-02.1 Generador de carga escalable a partir de `scripts/bots.mjs`, con métricas y salida en JSON (M)
- [ ] T-02.2 Marca de tiempo del servidor en CARTA para medir latencia de punta a punta sin romper el formato de 6 bytes (S)
- [x] T-02.3 Escenarios: entrada masiva en 30 s, reconexión del 50%, sala al 100% de cupo (M)
- [ ] T-02.4 Correr en local y en el despliegue; documentar resultados en `docs/pruebas-de-carga.md` (M)

### HU-03 · Sala en producción

*Como jugador quiero entrar a una dirección pública y jugar, para no depender de la laptop de nadie.*

Criterios de aceptación:
- El juego responde en una URL pública de `workers.dev`.
- La sala se duerme cuando no hay nadie y vuelve a arrancar al entrar alguien.
- Las tipografías se sirven desde el propio sitio, no desde Google Fonts (RNF-11).

Tareas:
- [ ] T-03.1 Primer despliegue y prueba de humo (S)
- [ ] T-03.2 Servir las tipografías desde `public/` con licencia OFL incluida (S)
- [ ] T-03.3 Encabezados de seguridad y caché para estáticos (S)

---

## Fase 1 · Juego completo

Objetivo: todo lo que una persona necesita para jugar una ronda completa, sola o con su familia, con la experiencia final.

### HU-04 · Entrar sin cuenta · RF-01, RNF-11

*Como jugador quiero entrar sin registrarme y tener un apodo, para jugar de inmediato sin dar datos.*

Criterios de aceptación:
- Al entrar por primera vez se genera un apodo con el formato "Nopal Valiente 482".
- El apodo se guarda en el dispositivo y se puede regenerar.
- No se pide correo, teléfono ni ubicación.

Tareas:
- [ ] T-04.1 Generador de apodos con listas propias de sustantivos y adjetivos (S)
- [ ] T-04.2 Mostrar y regenerar el apodo en la interfaz (S)
- [ ] T-04.3 Mandar el apodo en el resultado de ganador para el ranking (S)

### HU-05 · Elegir tabla · RF-02

*Como jugador quiero escoger una de tres tablas antes de la ronda, para sentir que la tabla es mía.*

Criterios de aceptación:
- En la espera se ofrecen 3 tablas distintas, derivadas del token y la ronda.
- La elección se manda a la sala y se valida; sin elección, se usa la primera.
- No se puede cambiar de tabla una vez que empieza a cantar.

Tareas:
- [ ] T-05.1 Motor: ofrecer 3 tablas y aceptar el mensaje ELIJO durante la espera (M)
- [ ] T-05.2 Protocolo: mensaje ELIJO y pruebas (S)
- [ ] T-05.3 Interfaz de selección con las tres tablas en miniatura (M)

### HU-06 · Versos del cantor · RF-03

*Como jugador quiero leer el verso de cada carta, como lo canta el gritón, para que se sienta como la lotería de feria.*

Criterios de aceptación:
- Cada una de las 54 cartas tiene un verso original.
- El verso aparece junto a la carta cantada y lo lee el lector de pantalla.

Tareas:
- [ ] T-06.1 Escribir los 54 versos originales (M)
- [ ] T-06.2 Mostrar el verso en el cantor (S)

### HU-07 · Historial de la ronda · RF-09

*Como jugador quiero ver qué cartas han salido, para revisar si me faltó un frijol.*

Criterios de aceptación:
- Un panel muestra las cartas cantadas en orden, la más reciente primero.
- Funciona con teclado y lector de pantalla.

Tareas:
- [ ] T-07.1 Panel desplegable con miniaturas (M)
- [ ] T-07.2 Resaltar en el historial las cartas que están en mi tabla (S)

### HU-08 · Llegar a mitad de ronda · RF-07

*Como jugador que llega tarde quiero ver la ronda en curso y entrar a la siguiente, para no quedarme esperando con la pantalla vacía.*

Criterios de aceptación:
- Quien entra mientras se canta ve las cartas como espectador y no puede reclamar.
- Al empezar la siguiente ronda recibe su tabla y juega normal.

Tareas:
- [ ] T-08.1 Motor: marcar como espectador a quien conecta con la ronda en canto (S)
- [ ] T-08.2 Interfaz de espectador con cuenta regresiva a la siguiente ronda (S)

### HU-09 · Sala llena en lugar de caída · RF-16, RNF-06, RNF-13

*Como jugador quiero un mensaje claro si la sala está llena, para saber cuándo volver.*

Criterios de aceptación:
- Con el cupo alcanzado, las conexiones nuevas reciben una página estática de "sala llena" con la hora del siguiente intento.
- Si la cuota diaria llega a 90%, se cierran entradas nuevas hasta el reinicio de las 18:00 de Guadalajara; los jugadores conectados terminan.

Tareas:
- [ ] T-09.1 Cupo configurable en la sala (S)
- [ ] T-09.2 Página estática de sala llena (S)
- [ ] T-09.3 Contador de solicitudes del día y cierre al 90% (M)

### HU-10 · Rondas verificables después · RF-11, RNF-14

*Como jugador desconfiado quiero verificar cualquier ronda pasada, para comprobar que nadie hizo trampa.*

Criterios de aceptación:
- Cada ronda guarda huella, semilla, cartas cantadas y ganadores en R2.
- Una página pública recibe el número de ronda y repite la verificación en el navegador.

Tareas:
- [ ] T-10.1 Escribir el registro de la ronda en R2 al terminar (M)
- [ ] T-10.2 Página de verificación (M)

### HU-11 · Instalable y rápida · RF-14, RNF-07, RNF-08

*Como jugador con datos limitados quiero que el juego cargue rápido y gaste poco, para jugar en 4G.*

Criterios de aceptación:
- Manifest y service worker: se puede instalar y la segunda visita carga del caché.
- Jugable en < 3 s en un Android de gama media con 4G; descarga inicial < 1.5 MB; < 1 MB por ronda.

Tareas:
- [ ] T-11.1 Manifest e iconos [requieren diseño aprobado] (S)
- [ ] T-11.2 Service worker con caché de estáticos (M)
- [ ] T-11.3 Medir peso y tiempos con Lighthouse en móvil (S)

---

## Fase 2 · Lanzamiento

Objetivo: que el juego aguante gente real, sea accesible y quede listo para compartir.

### HU-12 · El gritón · RF-03, RF-10, RNF-10

*Como jugador quiero oír al gritón cantar cada carta, y poder silenciarlo, para jugar como en la feria o en silencio.*

Criterios de aceptación:
- Cada carta tiene audio original con su verso, en Opus y precargado.
- Un botón silencia o activa el audio; el juego completo funciona solo con audio o solo con imagen.

Tareas:
- [ ] T-12.1 Grabar o producir los 54 audios con voz propia y licencia clara (L)
- [ ] T-12.2 Reproducción con Web Audio sincronizada a la carta (M)
- [ ] T-12.3 Control de silencio recordado en el dispositivo (S)

### HU-13 · Accesible para todos · RNF-10

*Como jugador con baja visión o que usa lector de pantalla quiero jugar completo, para no quedarme fuera.*

Criterios de aceptación:
- Auditoría WCAG 2.2 AA sin hallazgos altos: contraste, objetivos de 44 px, foco visible, lector de pantalla.
- Una ronda completa se puede jugar solo con teclado.

Tareas:
- [ ] T-13.1 Auditoría con axe y revisión manual con lector de pantalla (M)
- [ ] T-13.2 Correcciones (M)

### HU-14 · Protección contra abuso · RNF-12

*Como operador quiero bloquear bots y abusos, para que no agoten la cuota gratuita.*

Criterios de aceptación:
- Turnstile se valida antes de abrir el WebSocket.
- Límites por conexión: un reclamo por carta y mensajes malformados cierran la conexión.

Tareas:
- [ ] T-14.1 Integrar Turnstile en la entrada (M)
- [ ] T-14.2 Límites y cierre por abuso en el motor, con pruebas (S)

### HU-15 · Panel de administración · RF-15

*Como operador quiero pausar rondas y cambiar la cadencia sin desplegar, para reaccionar a lo que pase en vivo.*

Criterios de aceptación:
- Ruta protegida con Cloudflare Access.
- Pausar y reanudar rondas, cambiar segundos entre cartas, ver jugadores y consumo de cuota.

Tareas:
- [ ] T-15.1 Endpoints de administración en la sala (M)
- [ ] T-15.2 Página del panel (M)

### HU-16 · Observabilidad · RNF-16

*Como operador quiero ver métricas y recibir alertas, para enterarme antes que los jugadores.*

Criterios de aceptación:
- Métricas de la especificación: conexiones por sala, cuota consumida, difusión p99, desfase del reloj.
- Alertas al 70% de la cuota diaria y con difusión p99 > 800 ms.

Tareas:
- [ ] T-16.1 Registrar métricas con Workers Analytics Engine o logs estructurados (M)
- [ ] T-16.2 Runbook de una página (S)

### HU-17 · Arte final y legal · RNF-15

*Como responsable del proyecto quiero arte final y la revisión legal hecha, para lanzar sin riesgo.*

Criterios de aceptación:
- Las 54 cartas pasan la revisión del equipo de diseño y la prueba de parecido contra la baraja clásica.
- Revisión en el IMPI de los nombres de las cartas; consulta legal; registro ante INDAUTOR.

Tareas:
- [ ] T-17.1 Revisión de diseño de las 54 cartas y correcciones (L)
- [ ] T-17.2 Búsqueda en el IMPI y consulta legal (M)
- [ ] T-17.3 Registro de las ilustraciones ante INDAUTOR (M)

### HU-18 · Ensayo general y lanzamiento

*Como responsable quiero un ensayo con carga real antes del día del lanzamiento, para no estrenar en vivo.*

Criterios de aceptación:
- 3 rondas completas con 5,000 clientes simulados sin violar los RNF de latencia.
- Despliegues congelados la semana del lanzamiento.

Tareas:
- [ ] T-18.1 Ensayo con carga y cuotas medidas (M)
- [ ] T-18.2 Página de inicio con el link para compartir (S)

---

## Fase 3 · Después del lanzamiento

### HU-19 · Compartir el resultado · RF-13
*Como ganador quiero compartir una imagen con mi lugar, para presumirlo.*
- [ ] T-19.1 Imagen generada en el cliente con lugar, ronda y link (M)

### HU-20 · Mapa de ganadores · RF-12
*Como jugador quiero ver de qué estados juega la gente, para sentir el tamaño del juego.*
- [ ] T-20.1 Estado opcional, sin ubicación precisa (S)
- [ ] T-20.2 Mapa por estado al final de la ronda (M)

### HU-21 · Salas privadas
*Como familia quiero una sala solo para nosotros, para jugar en una reunión.*
- [ ] T-21.1 Salas con código, una por Durable Object (L)

### HU-22 · Post técnico
*Como autor quiero contar cómo se construyó, con los números reales, para compartirlo en LinkedIn.*
- [ ] T-22.1 Artículo con arquitectura, costos medidos y resultados de carga (M)

---

## Ya hecho antes de este plan

- Especificación técnica, arquitectura en Cloudflare y dirección visual.
- MVP: motor de sala, Durable Object con hibernación, protocolo binario, baraja verificable, cliente con frijoles, reconexión, bots y pruebas.
- Pura llena con baraja de 54 cartas y arte propio en primera versión para las 54.
- CI con pruebas y tipos; despliegue automático preparado.
