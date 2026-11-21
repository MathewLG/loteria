import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERSOS } from '../public/js/versos.js';
import { NOMBRES } from '../public/js/cartas.js';
import { ADJETIVOS, SUSTANTIVOS, armarApodo, generarApodo } from '../public/js/apodos.js';

test('hay un verso por carta, corto, sin guion largo y sin repetir', () => {
  assert.equal(VERSOS.length, 54);
  assert.equal(VERSOS.length, NOMBRES.length);
  for (const verso of VERSOS) {
    assert.ok(verso.trim().length > 0);
    assert.ok(verso.length <= 80, `verso largo: ${verso}`);
    assert.ok(!verso.includes('—'), `guion largo: ${verso}`);
  }
  assert.equal(new Set(VERSOS).size, VERSOS.length);
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
