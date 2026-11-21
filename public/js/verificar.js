import { NOMBRES, svgCarta } from './cartas.js';
import { verificarRonda } from './verificacion.js';

const formulario = document.getElementById('formulario');
const campo = document.getElementById('clave');
const salida = document.getElementById('salida');
const CLAVE = /^\d{4}-\d{2}-\d{2}\/\d{1,5}-[0-9a-f]{8}$/;

function mostrar(html) { salida.innerHTML = html; }
const escapar = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

async function verificar(clave) {
  if (clave && !CLAVE.test(clave)) {
    mostrar('<p>Esa ronda no tiene el formato esperado: <b>AAAA-MM-DD/ronda-huella</b>, por ejemplo 2026-11-21/12-ab12cd34.</p>');
    return;
  }
  mostrar('<p>Buscando la ronda…</p>');
  let r;
  try {
    r = await fetch(`/api/rondas/${clave || 'ultima'}`, { cache: 'no-store' });
  } catch {
    mostrar('<p>No pudimos conectarnos. Revisa tu internet e intenta de nuevo.</p>');
    return;
  }
  if (r.status === 404) {
    mostrar(clave
      ? '<p>No encontramos esa ronda. Revisa la fecha, el número y la huella.</p>'
      : '<p>Todavía no termina ninguna ronda. Vuelve cuando acabe la primera.</p>');
    return;
  }
  if (!r.ok) {
    mostrar('<p>La sala no pudo entregar la ronda en este momento. Intenta en unos segundos.</p>');
    return;
  }
  const ronda = await r.json();
  const v = verificarRonda(ronda);
  const veredicto = v.ok
    ? '<h2>Ronda verificada</h2><p>La semilla revelada da exactamente la huella publicada antes de cantar, y revolver con ella produce las mismas cartas en el mismo orden.</p>'
    : `<h2>No coincide</h2><p>${!v.huellaOk ? 'La semilla no corresponde a la huella publicada.' : 'Las cartas cantadas no son las que produce la semilla.'}</p>`;
  const fecha = (t) => (t ? new Date(t).toLocaleString('es-MX') : 'sin dato');
  mostrar(`<section class="resultado-verificacion">${veredicto}
    <dl>
      <dt>Ronda</dt><dd>${escapar(ronda.ronda)}</dd>
      <dt>Terminó</dt><dd>${escapar(fecha(ronda.fin))}</dd>
      <dt>Ganadores</dt><dd>${escapar(ronda.ganadores)}</dd>
      <dt>Huella</dt><dd class="huella">${escapar(ronda.huella)}</dd>
      <dt>Semilla</dt><dd class="huella">${escapar(ronda.semilla)}</dd>
    </dl>
    <h2>Cartas en el orden en que salieron</h2>
    <ol class="cartas-verificadas">${ronda.cantadas.map((c) => `<li aria-label="${escapar(NOMBRES[c - 1] ?? c)}" style="list-style:none">${svgCarta(c, { compacta: true })}</li>`).join('')}</ol>
  </section>`);
  if (ronda.clave) history.replaceState(null, '', `?clave=${encodeURIComponent(ronda.clave)}`);
}

formulario.addEventListener('submit', (e) => {
  e.preventDefault();
  verificar(campo.value.trim());
});

const inicial = new URLSearchParams(location.search).get('clave') ?? '';
campo.value = inicial;
verificar(inicial);
