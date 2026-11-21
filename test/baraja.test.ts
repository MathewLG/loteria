import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { aHex, barajar, chacha20Bloque, deHex, sha256, tablaDe } from '../public/js/baraja.js';

test('sha256 coincide con node:crypto, incluidos los bordes del relleno', () => {
  for (const largo of [0, 3, 55, 56, 63, 64, 65, 200]) {
    const texto = 'a'.repeat(largo);
    const esperado = createHash('sha256').update(texto).digest('hex');
    assert.equal(aHex(sha256(new TextEncoder().encode(texto))), esperado);
  }
});

test('chacha20 cumple el vector de prueba del RFC 8439, sección 2.3.2', () => {
  const llave = deHex('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f');
  const nonce = deHex('000000090000004a00000000');
  assert.equal(
    aHex(chacha20Bloque(llave, 1, nonce)),
    '10f1e7e4d13b5915500fdd1fa32071c4c7d1f4c733c068030422aa9ac3d46c4e' +
      'd2826446079faa0914c2d705d98b02a2b5129cd1de164eb9cbd083e8a2503c4e',
  );
});

test('barajar es una permutación y es determinista', () => {
  const semilla = sha256(new TextEncoder().encode('ronda de prueba'));
  const a = barajar(semilla, 54);
  assert.deepEqual([...a].sort((x, y) => x - y), Array.from({ length: 54 }, (_, i) => i + 1));
  assert.deepEqual(barajar(semilla, 54), a);
  assert.notDeepEqual(barajar(sha256(new TextEncoder().encode('otra')), 54), a);
});

test('la tabla depende del token y de la ronda', () => {
  const token = '0123456789abcdef0123456789abcdef';
  const t1 = tablaDe(token, 1, 16);
  assert.equal(new Set(t1).size, 16);
  assert.deepEqual(tablaDe(token, 1, 16), t1);
  assert.notDeepEqual(tablaDe(token, 2, 16), t1);
});
