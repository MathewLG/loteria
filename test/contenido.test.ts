import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FUENTE, VERSOS } from '../public/js/versos.js';
import { NOMBRES } from '../public/js/cartas.js';
import { ADJETIVOS, SUSTANTIVOS, armarApodo, generarApodo } from '../public/js/apodos.js';

test('los gritos son solo los documentados, uno por carta o ninguno', () => {
  assert.equal(VERSOS.length, 54);
  assert.equal(VERSOS.length, NOMBRES.length);
  const documentados = VERSOS.filter((v) => v !== null);
  assert.equal(documentados.length, 6, 'solo los seis de García Cubas (1904)');
  for (const verso of documentados) {
    assert.ok(verso.trim().length > 0);
    assert.ok(verso.length <= 80, `verso largo: ${verso}`);
    assert.ok(!verso.includes('—'), `guion largo: ${verso}`);
  }
  assert.equal(VERSOS[0], 'El que le cantó a San Pedro.');
  assert.equal(VERSOS[45], 'El abrigo de los pobres.');
  assert.match(FUENTE.obra, /García Cubas/);
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
