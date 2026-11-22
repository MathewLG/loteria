import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FUENTES, GRITOS, gritoPara } from '../public/js/versos.js';
import { NOMBRES } from '../public/js/cartas.js';
import { ADJETIVOS, SUSTANTIVOS, armarApodo, generarApodo } from '../public/js/apodos.js';

test('cada frase del cantor es corta, con origen conocido y sin guion largo', () => {
  for (const [carta, frases] of Object.entries(GRITOS)) {
    const n = Number(carta);
    assert.ok(n >= 1 && n <= NOMBRES.length, `carta fuera de rango: ${carta}`);
    assert.ok(frases.length > 0);
    assert.equal(new Set(frases.map((f) => f.texto)).size, frases.length, `frases repetidas en ${carta}`);
    for (const f of frases) {
      assert.ok(f.texto.trim().length > 0);
      assert.ok(f.texto.length <= 80, `frase larga: ${f.texto}`);
      assert.ok(!f.texto.includes('—'), `guion largo: ${f.texto}`);
      assert.ok(f.fuente in FUENTES, `fuente desconocida: ${f.fuente}`);
    }
  }
  assert.equal(GRITOS[1][0].texto, 'El que le cantó a San Pedro.');
});

test('todos los jugadores ven la misma frase en una ronda', () => {
  const huella = new Uint8Array(32).map((_, i) => i * 13);
  for (let carta = 1; carta <= NOMBRES.length; carta++) {
    assert.equal(gritoPara(carta, huella), gritoPara(carta, huella));
    const frases = GRITOS[carta] ?? [];
    const g = gritoPara(carta, huella);
    if (frases.length === 0) assert.equal(g, null);
    else assert.ok(frases.some((f) => f.texto === g));
  }
});

test('generarApodo es determinista con un aleatorio fijo y tiene el formato correcto', () => {
  const fijo = () => 0.5;
  const a = generarApodo(fijo);
  assert.equal(generarApodo(fijo), a);
  assert.match(a, /^\S+ \S+ [1-9]\d{2}$/);
  for (let i = 0; i < 200; i++) assert.match(generarApodo(), /^\S+ \S+ [1-9]\d{2}$/);
  assert.match(generarApodo(() => 0), / 100$/);
  assert.match(generarApodo(() => 0.9999999), / 999$/);
});

test('el adjetivo concuerda con el género del sustantivo en todas las combinaciones', () => {
  for (const adj of ADJETIVOS) {
    if (adj.m !== adj.f) {
      assert.ok(!adj.f.endsWith('o'), `femenino mal formado: ${adj.f}`);
      assert.ok(!adj.m.endsWith('a'), `masculino mal formado: ${adj.m}`);
    }
  }
  for (const s of SUSTANTIVOS) {
    assert.ok(s.g === 'm' || s.g === 'f');
    for (const adj of ADJETIVOS) {
      const apodo = armarApodo(s, adj, 123);
      assert.equal(apodo, `${s.palabra} ${s.g === 'f' ? adj.f : adj.m} 123`);
    }
  }
  assert.ok(SUSTANTIVOS.length >= 40 && ADJETIVOS.length >= 40);
});
