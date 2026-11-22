import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Motor, type Adjunto, type Conexion, type Entorno } from '../src/motor.ts';
import {
  FASE, FIGURAS, MOTIVO, T, codificarLoteria, decodificar, mascaraCantadas,
} from '../public/js/protocolo.js';
import { aHex, barajar, sha256 } from '../public/js/baraja.js';

class ConexionFalsa implements Conexion {
  recibidos: any[] = [];
  private a: Adjunto | null = null;
  enviar(datos: Uint8Array) { this.recibidos.push(decodificar(datos)); }
  adjunto() { return this.a ? { ...this.a } : null; }
  guardarAdjunto(a: Adjunto) { this.a = { ...a }; }
  ultimo(tipo: number) { return [...this.recibidos].reverse().find((m) => m.tipo === tipo); }
}

function crearSala(catalogo = 16) {
  const conexiones: ConexionFalsa[] = [];
  const almacen = new Map<string, unknown>();
  let alarma = false;
  let reloj = 1_000_000;
  const entorno: Entorno = {
    conexiones: () => conexiones,
    programarAlarma: async () => { alarma = true; },
    hayAlarma: async () => alarma,
    leer: async (k) => structuredClone(almacen.get(k)) as any,
    escribir: async (k, v) => { almacen.set(k, structuredClone(v)); },
    borrarPrefijo: async (p) => { for (const k of [...almacen.keys()]) if (k.startsWith(p)) almacen.delete(k); },
    leerPrefijo: async (p) => new Map([...almacen].filter(([k]) => k.startsWith(p)).map(([k, v]) => [k, structuredClone(v)])) as any,
    ahora: () => reloj,
    aleatorio: (n) => new Uint8Array(n).fill(7),
  };
  const motor = new Motor(entorno, { esperaMs: 1000, cartaMs: 1000, finMs: 1000, catalogo });
  return {
    motor,
    almacen,
    async entra(token: string) {
      const c = new ConexionFalsa();
      conexiones.push(c);
      await motor.conectar(c, token);
      return c;
    },
    async tic() { reloj += 1000; await motor.alarma(); },
  };
}

const TOKEN_A = 'a'.repeat(32);
const TOKEN_B = 'b'.repeat(32);

test('al entrar, el jugador recibe su tabla y la huella de la baraja', async () => {
  const sala = crearSala();
  const c = await sala.entra(TOKEN_A);
  const e = c.ultimo(T.ESTADO);
  assert.equal(e.fase, FASE.ESPERA);
  assert.equal(e.tabla.length, 16);
  assert.equal(aHex(e.huella), aHex(sha256(new Uint8Array(32).fill(7))));
  assert.equal(e.semilla, null, 'la semilla no se revela antes del final');
});

test('la sala canta toda la baraja en orden, termina y revela la semilla', async () => {
  const sala = crearSala();
  const c = await sala.entra(TOKEN_A);
  for (let i = 0; i < 17; i++) await sala.tic();
  const cartas = c.recibidos.filter((m) => m.tipo === T.CARTA).map((m) => m.carta);
  assert.deepEqual(cartas, barajar(new Uint8Array(32).fill(7), 16));
  const fin = c.ultimo(T.FIN);
  assert.equal(aHex(fin.semilla), '07'.repeat(32));
});

test('un reclamo con la figura completa gana; uno incompleto no', async () => {
  const sala = crearSala();
  const a = await sala.entra(TOKEN_A);
  const b = await sala.entra(TOKEN_B);
  const tablaA = a.ultimo(T.ESTADO).tabla;
  const figura = a.ultimo(T.ESTADO).figura;

  // Se cantan cartas hasta que A puede completar la figura.
  let cantadas: number[] = [];
  let posible = 0;
  while (true) {
    await sala.tic();
    const carta = a.ultimo(T.CARTA);
    if (!carta) continue;
    cantadas.push(carta.carta);
    const m = mascaraCantadas(tablaA, cantadas);
    const patron = FIGURAS[figura].patrones.find((p: number) => (m & p) === p);
    if (patron) { posible = patron; break; }
  }
  const ronda = a.ultimo(T.ESTADO).ronda;

  await sala.motor.mensaje(b, codificarLoteria(ronda, 0));
  assert.equal(b.ultimo(T.RESULTADO).motivo, MOTIVO.INCOMPLETA);

  await sala.motor.mensaje(a, codificarLoteria(ronda, posible));
  const r = a.ultimo(T.RESULTADO);
  assert.equal(r.ok, true);
  assert.equal(r.lugar, 1);

  await sala.motor.mensaje(a, codificarLoteria(ronda, posible));
  assert.equal(a.ultimo(T.RESULTADO).motivo, MOTIVO.YA_GANASTE);
});

test('marcar casillas que no han salido no sirve para ganar', async () => {
  const sala = crearSala();
  const a = await sala.entra(TOKEN_A);
  await sala.tic(); // empieza a cantar: una carta
  const ronda = a.ultimo(T.ESTADO).ronda;
  await sala.motor.mensaje(a, codificarLoteria(ronda, 0xffff));
  assert.equal(a.ultimo(T.RESULTADO).motivo, MOTIVO.INCOMPLETA);
  await sala.motor.mensaje(a, codificarLoteria(ronda, 0xffff));
  assert.equal(a.ultimo(T.RESULTADO).motivo, MOTIVO.MUY_SEGUIDO, 'un reclamo por carta');
});

test('una conexión que vuelve recupera su lugar de ganador', async () => {
  const sala = crearSala();
  // Los ganadores viven en lotes; la primera ronda es la 1. Simula que el objeto durmió con un ganador guardado.
  sala.almacen.set('ganadores:1:0000', { [TOKEN_A]: 3 });
  const a = await sala.entra(TOKEN_A);
  assert.equal(a.ultimo(T.ESTADO).ronda, 1);
  const otra = await sala.entra(TOKEN_A);
  assert.equal(otra.ultimo(T.ESTADO).lugar, 3);
});

test('pura llena: con 54 cartas nadie gana hasta que salen sus 16', async () => {
  const sala = crearSala(54);
  const a = await sala.entra(TOKEN_A);
  const tabla: number[] = a.ultimo(T.ESTADO).tabla;
  const ronda = a.ultimo(T.ESTADO).ronda;
  const cantadas: number[] = [];
  let reclamosFallidos = 0;
  while (true) {
    await sala.tic();
    const carta = a.ultimo(T.CARTA);
    if (!carta || carta.indice === cantadas.length) continue;
    cantadas.push(carta.carta);
    const m = mascaraCantadas(tabla, cantadas);
    await sala.motor.mensaje(a, codificarLoteria(ronda, m));
    const r = a.ultimo(T.RESULTADO);
    if (m !== 0xffff) { assert.equal(r.ok, false); reclamosFallidos += 1; continue; }
    assert.equal(r.ok, true);
    assert.ok(tabla.every((c) => cantadas.includes(c)));
    break;
  }
  assert.ok(reclamosFallidos >= 15, 'hacen falta al menos 16 cartas para llenar');
});

test('después de la última carta hay tiempo de gracia para gritar', async () => {
  const programadas: number[] = [];
  const almacen = new Map<string, unknown>();
  let alarma = false;
  const conexion = new ConexionFalsa();
  const motor = new Motor({
    conexiones: () => [conexion],
    programarAlarma: async (ms) => { programadas.push(ms); alarma = true; },
    hayAlarma: async () => alarma,
    leer: async (k) => structuredClone(almacen.get(k)) as any,
    escribir: async (k, v) => { almacen.set(k, structuredClone(v)); },
    borrarPrefijo: async () => {},
    leerPrefijo: async () => new Map(),
    ahora: () => 0,
    aleatorio: (n) => new Uint8Array(n).fill(3),
  }, { esperaMs: 1000, cartaMs: 1000, finMs: 1000, catalogo: 16, graciaMs: 9000 });
  await motor.conectar(conexion, TOKEN_A);
  for (let i = 0; i < 16; i++) await motor.alarma();
  const cartas = conexion.recibidos.filter((m) => m.tipo === T.CARTA);
  assert.equal(cartas.length, 16);
  assert.equal(programadas[programadas.length - 1], 9000, 'la última carta deja 9 s');
  assert.equal(cartas[15].msSiguiente, 9000);
  assert.equal(cartas[14].msSiguiente, 1000);
  const ronda = conexion.ultimo(T.ESTADO).ronda;
  const tabla = conexion.ultimo(T.ESTADO).tabla;
  await motor.mensaje(conexion, codificarLoteria(ronda, mascaraCantadas(tabla, cartas.map((c) => c.carta))));
  assert.equal(conexion.ultimo(T.RESULTADO).ok, true, 'todavía se puede ganar durante la gracia');
});
