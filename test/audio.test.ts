import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLAVE_PREFERENCIAS, DURACION_COMPAS_S, EVENTOS, PREFERENCIAS_INICIALES, compasesPendientes,
  debeSonar, ganancia, guardarPreferencias, leerPreferencias, musicaActiva, notasDelCompas,
} from '../public/js/audio-logica.js';

/** Almacén en memoria con la misma forma que localStorage. */
function almacenFalso(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => { datos.set(k, v); },
  };
}

test('sin nada guardado: efectos encendidos y música apagada', () => {
  assert.deepEqual(leerPreferencias(almacenFalso()), PREFERENCIAS_INICIALES);
  assert.equal(PREFERENCIAS_INICIALES.efectos, true);
  assert.equal(PREFERENCIAS_INICIALES.musica, false);
  assert.deepEqual(leerPreferencias(null), PREFERENCIAS_INICIALES);
});

test('un JSON roto o con tipos raros vuelve a los valores iniciales', () => {
  assert.deepEqual(leerPreferencias(almacenFalso({ [CLAVE_PREFERENCIAS]: '{no es json' })), PREFERENCIAS_INICIALES);
  const raro = leerPreferencias(almacenFalso({ [CLAVE_PREFERENCIAS]: JSON.stringify({ efectos: 'sí', musica: 1, volumen: 'alto' }) }));
  assert.deepEqual(raro, PREFERENCIAS_INICIALES);
});

test('el volumen guardado se acota entre 0 y 1', () => {
  assert.equal(leerPreferencias(almacenFalso({ [CLAVE_PREFERENCIAS]: '{"volumen": 7}' })).volumen, 1);
  assert.equal(leerPreferencias(almacenFalso({ [CLAVE_PREFERENCIAS]: '{"volumen": -2}' })).volumen, 0);
});

test('guardar y leer conserva la elección', () => {
  const almacen = almacenFalso();
  const p = { efectos: false, musica: true, silencio: false, volumen: 0.4 };
  guardarPreferencias(almacen, p);
  assert.deepEqual(leerPreferencias(almacen), p);
});

test('guardar sin almacenamiento disponible no truena', () => {
  const roto = { setItem() { throw new Error('lleno'); } };
  assert.doesNotThrow(() => guardarPreferencias(roto, PREFERENCIAS_INICIALES));
});

test('solo efectos, solo música, todo silenciado', () => {
  const soloEfectos = { efectos: true, musica: false, silencio: false, volumen: 0.8 };
  const soloMusica = { efectos: false, musica: true, silencio: false, volumen: 0.8 };
  const silenciado = { efectos: true, musica: true, silencio: true, volumen: 0.8 };
  for (const e of EVENTOS) {
    assert.equal(debeSonar(e, soloEfectos), true);
    assert.equal(debeSonar(e, soloMusica), false);
    assert.equal(debeSonar(e, silenciado), false);
  }
  assert.equal(musicaActiva(soloEfectos, true), false);
  assert.equal(musicaActiva(soloMusica, true), true);
  assert.equal(musicaActiva(silenciado, true), false);
});

test('la música se pausa con la pestaña oculta y con volumen 0', () => {
  const p = { efectos: true, musica: true, silencio: false, volumen: 0.8 };
  assert.equal(musicaActiva(p, false), false);
  assert.equal(musicaActiva({ ...p, volumen: 0 }, true), false);
  assert.equal(debeSonar('carta', { ...p, volumen: 0 }), false);
});

test('un evento desconocido no suena', () => {
  assert.equal(debeSonar('trompeta', PREFERENCIAS_INICIALES), false);
});

test('la ganancia sigue una curva cuadrática acotada', () => {
  assert.equal(ganancia(0), 0);
  assert.equal(ganancia(1), 1);
  assert.equal(ganancia(0.5), 0.25);
  assert.equal(ganancia(3), 1);
  assert.equal(ganancia(-1), 0);
});

test('cada compás en 6/8 trae jarana, bajo y tarima dentro de su duración', () => {
  for (let c = 0; c < 24; c++) {
    const inicio = 10 + c * DURACION_COMPAS_S;
    const notas = notasDelCompas(c, inicio);
    for (const n of notas) {
      assert.ok(n.tiempo >= inicio && n.tiempo < inicio + DURACION_COMPAS_S, `nota fuera del compás ${c}`);
      assert.ok(n.fuerza > 0 && n.fuerza <= 1);
      if (n.instrumento !== 'tarima') assert.ok(n.frecuencias.every((f) => f > 40 && f < 1200));
    }
    const de = (i: string) => notas.filter((n) => n.instrumento === i).length;
    assert.ok(de('jarana') >= 4);
    assert.equal(de('bajo'), 2);
    assert.ok(de('tarima') >= 3);
    assert.equal(notas.filter((n) => n.tiempo === inicio && n.instrumento === 'jarana').length, 1, 'golpe fuerte al inicio');
  }
});

test('la música varía entre vueltas y se repite después del ciclo', () => {
  const patron = (c: number) => JSON.stringify(notasDelCompas(c, 0));
  assert.notEqual(patron(0), patron(4), 'la segunda vuelta cambia');
  assert.notEqual(patron(4), patron(8));
  assert.equal(patron(0), patron(24), 'el ciclo completo dura 6 vueltas');
  // El último compás de cada vuelta lleva un remate de tarima.
  const tarimas = (c: number) => notasDelCompas(c, 0).filter((n) => n.instrumento === 'tarima').length;
  assert.equal(tarimas(3), tarimas(2) + 1);
});

test('el lookahead pide justo los compases que caen antes del límite', () => {
  assert.deepEqual(compasesPendientes(0, 1, 1), []);
  const l = compasesPendientes(5, 1, 1 + DURACION_COMPAS_S * 2 + 0.01);
  assert.deepEqual(l.map((x) => x.compas), [5, 6, 7]);
  assert.ok(Math.abs(l[2].inicio - (1 + 2 * DURACION_COMPAS_S)) < 1e-9);
});
