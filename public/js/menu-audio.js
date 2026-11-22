// Botón de sonido de la barra y su menú: silenciar todo, efectos, música y volumen.

import { alCambiar, cambiarPreferencias, preferencias } from './audio.js';

/** @param {string} id */
const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

const boton = $('boton-audio');
const menu = /** @type {HTMLDialogElement} */ ($('menu-audio'));
const silencio = $('audio-silencio');
const efectos = $('audio-efectos');
const musica = $('audio-musica');
const volumen = /** @type {HTMLInputElement} */ ($('audio-volumen'));
const volumenValor = $('audio-volumen-valor');
/** @type {[HTMLElement, HTMLElement, string][]} */
const AYUDAS = [efectos, musica].map((el) => {
  const ayuda = /** @type {HTMLElement} */ (el.querySelector('.interruptor-ayuda'));
  return [el, ayuda, ayuda.textContent ?? ''];
});

/** @param {import('./audio-logica.js').PreferenciasAudio} p */
function pintar(p) {
  silencio.setAttribute('aria-checked', String(p.silencio));
  efectos.setAttribute('aria-checked', String(p.efectos));
  musica.setAttribute('aria-checked', String(p.musica));
  // Con todo silenciado los otros dos se ven apagados, pero conservan su valor.
  for (const [interruptor, ayuda, texto] of AYUDAS) {
    interruptor.classList.toggle('en-silencio', p.silencio);
    ayuda.textContent = p.silencio ? 'En pausa por «Silenciar todo».' : texto;
  }
  const pct = Math.round(p.volumen * 100);
  volumen.value = String(pct);
  volumenValor.textContent = String(pct);
  const callado = p.silencio || p.volumen === 0 || (!p.efectos && !p.musica);
  boton.classList.toggle('callado', callado);
  const partes = [p.efectos && 'efectos', p.musica && 'música'].filter(Boolean);
  boton.setAttribute('aria-label', callado ? 'Sonido: silenciado' : `Sonido: ${partes.join(' y ')} encendidos`);
}

boton.addEventListener('click', () => menu.showModal());
$('menu-audio-cerrar').addEventListener('click', () => menu.close());
menu.addEventListener('click', (e) => { if (e.target === menu) menu.close(); });
silencio.addEventListener('click', () => cambiarPreferencias({ silencio: !preferencias().silencio }));
efectos.addEventListener('click', () => {
  const p = preferencias();
  // Si estaba todo silenciado, prender un bus quita el silencio general: es lo que el jugador quiere oír.
  cambiarPreferencias(p.silencio ? { silencio: false, efectos: true } : { efectos: !p.efectos });
});
musica.addEventListener('click', () => {
  const p = preferencias();
  cambiarPreferencias(p.silencio ? { silencio: false, musica: true } : { musica: !p.musica });
});
volumen.addEventListener('input', () => cambiarPreferencias({ volumen: Number(volumen.value) / 100 }));

alCambiar(pintar);
pintar(preferencias());
