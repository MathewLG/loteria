import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOMBRES, svgCarta } from '../public/js/cartas.js';

test('las 54 cartas tienen arte propio', () => {
  for (let n = 1; n <= 54; n++) assert.ok(!svgCarta(n).includes('arte pendiente'), `carta ${n}`);
  assert.equal(NOMBRES.length, 54);
});

test('la variante compacta agranda nombre y número', () => {
  const normal = svgCarta(18);
  const compacta = svgCarta(18, { compacta: true });
  assert.match(normal, /font-size="16"/);
  assert.match(compacta, /font-size="28"/);
  assert.match(compacta, /textLength="168"/);
  assert.match(compacta, /font-size="22"/);
});

test('cada carta pintada tiene su propio recorte, aunque se repita en la página', () => {
  const ids = [svgCarta(1), svgCarta(1)].map((s) => s.match(/clipPath id="([^"]+)"/)[1]);
  assert.notEqual(ids[0], ids[1]);
});
