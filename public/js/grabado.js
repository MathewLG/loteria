// Herramienta para dibujar cartas en estilo de grabado:
// el color se imprime 2.5 px fuera de la línea (registro corrido) y la tinta va encima.

export const TINTA = '#1B1714';

export const TINTAS = {
  grana: '#B8322A',
  anil: '#2F4F8F',
  cempa: '#E3A21A',
  nopal: '#4E7A34',
  hueso: '#FBF5E6',
  papel: '#F3E7CB',
  madera: '#8A5A3C',
  piedra: '#CDBF9F',
  venado: '#A8713F',
  pielClara: '#E9BE94',
  pielMorena: '#C08A5E',
  pielCanela: '#A0663F',
  pielOscura: '#7B4B2C',
};

export const circ = (cx, cy, r) =>
  `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;

export const elipse = (cx, cy, rx, ry) =>
  `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z`;

/**
 * Dibuja una carta. `dibujar` recibe:
 *  forma(d, color)        relleno corrido + contorno de tinta
 *  color(d, color)        solo relleno corrido, sin contorno
 *  trazo(d, color, ancho) línea de color corrida, sin contorno
 *  linea(d, ancho)        solo tinta
 *  tinta(d)               relleno sólido de tinta (pelo, ojos, sombras)
 *  tapa(d, color)         relleno alineado que tapa lo de atrás, con contorno
 *  hueso(d, ancho, color) línea gruesa de tinta con alma de color (huesos, palos, ramas)
 *  claro(d, ancho)        línea clara encima de la tinta
 *  grupo(transform, fn)   aplica una transformación a lo que dibuje fn
 */
export function grabado(dibujar, transformacion = '') {
  const color = [];
  const linea = [];
  const ancho = (g) => (g ? ` stroke-width="${g}"` : '');
  dibujar({
    forma(d, relleno, grosor) {
      color.push(`<path d="${d}" fill="${relleno}"/>`);
      linea.push(`<path d="${d}"${ancho(grosor)}/>`);
    },
    color(d, relleno) {
      color.push(`<path d="${d}" fill="${relleno}"/>`);
    },
    trazo(d, relleno, grosor) {
      color.push(`<path d="${d}" fill="none" stroke="${relleno}" stroke-width="${grosor}" stroke-linecap="round" stroke-linejoin="round"/>`);
    },
    linea(d, grosor) {
      linea.push(`<path d="${d}"${ancho(grosor)}/>`);
    },
    tinta(d) {
      linea.push(`<path d="${d}" fill="${TINTA}" stroke="none"/>`);
    },
    tapa(d, relleno, grosor) {
      linea.push(`<path d="${d}" fill="${relleno}"${ancho(grosor)}/>`);
    },
    hueso(d, grosor = 10, relleno = TINTAS.hueso) {
      linea.push(`<path d="${d}" stroke-width="${grosor}"/>`);
      linea.push(`<path d="${d}" stroke="${relleno}" stroke-width="${grosor - 5}"/>`);
    },
    claro(d, grosor) {
      linea.push(`<path d="${d}" stroke="${TINTAS.hueso}"${ancho(grosor)}/>`);
    },
    grupo(transform, fn) {
      color.push(`<g transform="${transform}">`);
      linea.push(`<g transform="${transform}">`);
      fn();
      color.push('</g>');
      linea.push('</g>');
    },
  });
  const extra = transformacion ? ` ${transformacion}` : '';
  return `<g transform="translate(2.5 2)${extra}">${color.join('')}</g>` +
    `<g${transformacion ? ` transform="${transformacion}"` : ''} fill="none" stroke="${TINTA}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">${linea.join('')}</g>`;
}
