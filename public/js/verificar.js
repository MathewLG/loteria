import { NOMBRES, svgCarta } from './cartas.js';
import { verificarRonda } from './verificacion.js';
import { textoRondaReciente } from './estado-ui.js';

const salida = document.getElementById('salida');
const anuncio = document.getElementById('anuncio');
const estadoRecientes = document.getElementById('estado-recientes');
const listaRecientes = document.getElementById('lista-recientes');
const CLAVE = /^\d{4}-\d{2}-\d{2}\/\d{1,5}-[0-9a-f]{8}$/;

const escapar = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fecha = (t) => {
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? 'sin dato' : d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
};

function mostrar(html, aviso) {
  salida.innerHTML = html;
  // Solo la conclusión se anuncia; el detalle se lee si la persona quiere.
  if (aviso) anuncio.textContent = aviso;
}

let claveActual = '';

/** Rondas recientes para elegir con un toque: la clave técnica viaja en la URL, no la escribe nadie. */
async function cargarRecientes() {
  let r;
  try {
    r = await fetch('/api/rondas/recientes', { cache: 'no-store' });
  } catch {
    estadoRecientes.textContent = 'No pudimos cargar las rondas recientes. Abajo está la última ronda terminada.';
    return;
  }
  if (r.status === 503) {
    estadoRecientes.textContent = 'El registro de rondas pasadas todavía no está activado. Al final de cada ronda tu propio dispositivo comprueba la baraja en el juego.';
    return;
  }
  if (!r.ok) {
    estadoRecientes.textContent = 'No pudimos cargar las rondas recientes. Abajo está la última ronda terminada.';
    return;
  }
  let rondas;
  try {
    rondas = await r.json();
  } catch {
    rondas = null;
  }
  if (!Array.isArray(rondas)) {
    estadoRecientes.textContent = 'No pudimos leer las rondas recientes. Abajo está la última ronda terminada.';
    return;
  }
  const validas = rondas.filter((x) => x && CLAVE.test(String(x.clave)));
  if (!validas.length) {
    estadoRecientes.textContent = 'Todavía no termina ninguna ronda. Vuelve cuando acabe la primera.';
    return;
  }
  estadoRecientes.hidden = true;
  listaRecientes.hidden = false;
  listaRecientes.replaceChildren(...validas.map((ronda) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'boton-ronda';
    b.dataset.clave = ronda.clave;
    b.textContent = textoRondaReciente(ronda);
    b.addEventListener('click', () => verificar(ronda.clave));
    li.append(b);
    return li;
  }));
  marcarElegida();
}

function marcarElegida() {
  for (const b of listaRecientes.querySelectorAll('.boton-ronda')) {
    b.setAttribute('aria-pressed', String(b.dataset.clave === claveActual));
  }
}

async function verificar(clave) {
  if (clave && !CLAVE.test(clave)) {
    mostrar('<p>Ese enlace no corresponde a ninguna ronda. Elige una de la lista.</p>', 'Enlace de ronda no válido.');
    return;
  }
  mostrar('<p>Buscando la ronda…</p>');
  let r;
  try {
    r = await fetch(`/api/rondas/${clave || 'ultima'}`, { cache: 'no-store' });
  } catch {
    mostrar('<p>No pudimos conectarnos. Revisa tu internet e intenta de nuevo.</p>', 'Sin conexión.');
    return;
  }
  if (r.status === 503) {
    mostrar('<p>El registro de rondas pasadas todavía no está activado. Al final de cada ronda tu propio dispositivo comprueba la baraja en el juego.</p>', 'Registro de rondas apagado.');
    return;
  }
  if (r.status === 404) {
    mostrar(clave
      ? '<p>No encontramos esa ronda. Puede que sea de hace mucho; elige una de la lista.</p>'
      : '<p>Todavía no termina ninguna ronda. Vuelve cuando acabe la primera.</p>', 'No hay ronda para comprobar.');
    return;
  }
  if (!r.ok) {
    mostrar('<p>La sala no pudo entregar la ronda en este momento. Intenta en unos segundos.</p>', 'La sala no respondió.');
    return;
  }
  const ronda = await r.json();
  const v = verificarRonda(ronda);
  claveActual = ronda.clave || clave;
  marcarElegida();
  const veredicto = v.ok
    ? `<h2>La baraja no se tocó</h2><p>Las ${ronda.cantadas.length} cartas de la ronda ${escapar(ronda.ronda)} salieron exactamente en el orden sorteado antes de empezar.</p>`
    : `<h2>No coincide</h2><p>${!v.huellaOk ? 'El orden revelado al final no corresponde al sello publicado al inicio.' : 'Las cartas cantadas no son las del orden sorteado.'}</p>`;
  // El detalle técnico va plegado; el lector de pantalla no deletrea los códigos, solo dice qué son.
  const codigo = (hex) => `<code class="huella" aria-hidden="true">${escapar(hex)}</code><span class="solo-lector">código de ${String(hex).length} caracteres, visible en pantalla</span>`;
  mostrar(`<section class="resultado-verificacion">${veredicto}
    <dl>
      <dt>Ronda</dt><dd>${escapar(ronda.ronda)}</dd>
      <dt>Terminó</dt><dd>${escapar(fecha(ronda.fin))}</dd>
      <dt>Ganadores</dt><dd>${escapar(ronda.ganadores)}</dd>
    </dl>
    <h3>Cartas en el orden en que salieron</h3>
    <ol class="cartas-verificadas">${ronda.cantadas.map((c) => `<li>${svgCarta(c, { compacta: true })}<span class="solo-lector">${escapar(NOMBRES[c - 1] ?? c)}</span></li>`).join('')}</ol>
    <details class="detalle-tecnico">
      <summary>Ver detalles técnicos</summary>
      <p>El sello es el SHA-256 de la semilla. La semilla revuelve la baraja con ChaCha20 y Fisher-Yates. Puedes repetir el cálculo con el código abierto del juego.</p>
      <dl>
        <dt>Sello publicado al inicio</dt><dd>${codigo(ronda.huella)}</dd>
        <dt>Semilla revelada al final</dt><dd>${codigo(ronda.semilla)}</dd>
      </dl>
    </details>
  </section>`, v.ok ? `Ronda ${ronda.ronda}: la baraja no se tocó.` : `Ronda ${ronda.ronda}: no coincide.`);
  if (ronda.clave) history.replaceState(null, '', `?clave=${encodeURIComponent(ronda.clave)}`);
}

const inicial = new URLSearchParams(location.search).get('clave') ?? '';
cargarRecientes();
verificar(inicial);
