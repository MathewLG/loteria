import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aHex, barajar, sha256 } from '../public/js/baraja.js';
import { FASE } from '../public/js/protocolo.js';
import { claveDeRonda, verificarRonda } from '../public/js/verificacion.js';
import { duracionAproximada, msHastaSiguienteRonda, textoBoton, textoRondaReciente } from '../public/js/estado-ui.js';

const semilla = new Uint8Array(32).fill(9);
const huella = sha256(semilla);

test('verificarRonda acepta una ronda honesta, en bytes o en hex', () => {
  const cantadas = barajar(semilla, 54).slice(0, 20);
  assert.equal(verificarRonda({ semilla, huella, cantadas }).ok, true);
  assert.equal(verificarRonda({ semilla: aHex(semilla), huella: aHex(huella), cantadas }).ok, true);
});

test('verificarRonda detecta una semilla que no corresponde a la huella', () => {
  const otra = new Uint8Array(32).fill(1);
  const r = verificarRonda({ semilla: otra, huella, cantadas: barajar(otra, 54).slice(0, 5) });
  assert.equal(r.huellaOk, false);
  assert.equal(r.ok, false);
});

test('verificarRonda detecta cartas cambiadas de orden', () => {
  const cantadas = barajar(semilla, 54).slice(0, 10);
  [cantadas[0], cantadas[1]] = [cantadas[1], cantadas[0]];
  const r = verificarRonda({ semilla, huella, cantadas });
  assert.equal(r.huellaOk, true);
  assert.equal(r.ordenOk, false);
});

test('verificarRonda rechaza datos incompletos sin lanzar', () => {
  assert.equal(verificarRonda({ semilla: 'abc', huella: '', cantadas: null } as any).ok, false);
});

test('claveDeRonda usa la fecha UTC y 8 caracteres de la huella', () => {
  assert.equal(claveDeRonda(7, 'abcdef0123456789', new Date('2026-11-21T23:30:00Z')), '2026-11-21/7-abcdef01');
});

test('el botón siempre dice por qué no se puede gritar', () => {
  const base = { conectado: true, ronda: 3, espectador: false, lugar: 0, esperandoResultado: false, fase: FASE.CANTANDO };
  assert.deepEqual(textoBoton(base), { texto: '¡Lotería!', deshabilitado: false });
  assert.equal(textoBoton({ ...base, fase: FASE.ESPERA }).texto, 'Espera la primera carta');
  assert.equal(textoBoton({ ...base, conectado: false, ronda: 0 }).texto, 'Conectando…');
  assert.equal(textoBoton({ ...base, conectado: false }).texto, 'Sin conexión');
  assert.equal(textoBoton({ ...base, espectador: true }).texto, 'Juegas en la siguiente ronda');
  assert.equal(textoBoton({ ...base, lugar: 4 }).texto, 'Ganaste: lugar 4');
  for (const s of [{ ...base, fase: FASE.ESPERA }, { ...base, conectado: false }, { ...base, espectador: true }]) {
    assert.equal(textoBoton(s).deshabilitado, true);
  }
});

test('la estimación para espectadores crece con las cartas que faltan', () => {
  const a = msHastaSiguienteRonda({ catalogo: 54, cantadas: 50, msEntreCartas: 6000, msParaSiguienteCarta: 2000 });
  const b = msHastaSiguienteRonda({ catalogo: 54, cantadas: 10, msEntreCartas: 6000, msParaSiguienteCarta: 2000 });
  assert.ok(b > a);
  assert.equal(duracionAproximada(45_000), '45 s');
  assert.equal(duracionAproximada(4 * 60_000 + 10_000), '4 min');
});

test('etiqueta de ronda reciente en lenguaje de jugador', () => {
  assert.equal(textoRondaReciente({ clave: '2026-11-21/12-ab12cd34', ronda: 12, ganadores: 3 }), 'Ronda 12 · 21 nov · 3 ganadores');
  assert.equal(textoRondaReciente({ clave: '2026-01-05/1-00000000', ronda: 1, fecha: '2026-01-05', ganadores: 1 }), 'Ronda 1 · 5 ene · 1 ganador');
  assert.equal(textoRondaReciente({ clave: 'x', ronda: 7, ganadores: 0 }), 'Ronda 7 · sin ganadores');
});
