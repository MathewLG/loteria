// Correcciones del QA de cierre de la Fase 1: issues #42 a #46 y escrituras por jugador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Motor, calcularPase, type Adjunto, type Conexion, type Config, type Entorno, type Reanudar } from '../src/motor.ts';
import { MOTIVO, T, codificarCarta, codificarElijo, codificarLoteria, decodificar, mascaraCantadas } from '../public/js/protocolo.js';
import { aHex, tablaDe } from '../public/js/baraja.js';

class ConexionFalsa implements Conexion {
  recibidos: any[] = [];
  private a: Adjunto | null = null;
  enviar(datos: Uint8Array) { this.recibidos.push(decodificar(datos)); }
  adjunto() { return this.a ? { ...this.a } : null; }
  guardarAdjunto(a: Adjunto) { this.a = { ...a }; }
  ultimo(tipo: number) { return [...this.recibidos].reverse().find((m) => m.tipo === tipo); }
}

function crearSala(extra: Partial<Config> = {}, catalogo = 16) {
  const conexiones: ConexionFalsa[] = [];
  const almacen = new Map<string, unknown>();
  const escrituras: string[] = [];
  let alarma = false;
  let reloj = Date.UTC(2026, 10, 21, 12, 0, 0);
  const entorno: Entorno = {
    conexiones: () => conexiones,
    programarAlarma: async () => { alarma = true; },
    hayAlarma: async () => alarma,
    leer: async (k) => structuredClone(almacen.get(k)) as any,
    escribir: async (k, v) => { escrituras.push(k); almacen.set(k, structuredClone(v)); },
    borrarPrefijo: async (p) => { for (const k of [...almacen.keys()]) if (k.startsWith(p)) almacen.delete(k); },
    leerPrefijo: async (p) => new Map([...almacen].filter(([k]) => k.startsWith(p)).map(([k, v]) => [k, structuredClone(v)])) as any,
    ahora: () => reloj,
    aleatorio: (n) => new Uint8Array(n).fill(5),
  };
  const config = { esperaMs: 1000, cartaMs: 1000, finMs: 1000, catalogo, ...extra };
  let motor = new Motor(entorno, config);
  return {
    get motor() { return motor; },
    /** Un motor nuevo sobre el mismo almacenamiento, como un Durable Object que despertó. */
    olvidar() { motor = new Motor(entorno, config); },
    almacen,
    escrituras,
    async entra(token: string, reanudar?: Reanudar) {
      const c = new ConexionFalsa();
      conexiones.push(c);
      await motor.conectar(c, token, reanudar);
      return c;
    },
    sale(c: ConexionFalsa) { conexiones.splice(conexiones.indexOf(c), 1); },
    async tic() { reloj += 1000; await motor.alarma(); },
    avanzar(ms: number) { reloj += ms; },
  };
}

const TOKEN_A = 'a'.repeat(32);
const TOKEN_B = 'b'.repeat(32);
const SEMILLA = '05'.repeat(32);

/** Canta hasta que la tabla de `c` está llena y devuelve la ronda. */
async function cantarHastaLlenar(sala: ReturnType<typeof crearSala>, c: ConexionFalsa) {
  const ronda = c.ultimo(T.ESTADO).ronda;
  const tabla = c.ultimo(T.ESTADO).tabla;
  const cantadas: number[] = [];
  while (mascaraCantadas(tabla, cantadas) !== 0xffff) {
    await sala.tic();
    const carta = c.ultimo(T.CARTA);
    if (carta && carta.indice > cantadas.length) cantadas.push(carta.carta);
  }
  return ronda;
}

test('#42: el mismo token en dos conexiones gana un solo lugar', async () => {
  const sala = crearSala();
  const uno = await sala.entra(TOKEN_A);
  const dos = await sala.entra(TOKEN_A, { ronda: 1, carta: 0 });
  const ronda = await cantarHastaLlenar(sala, uno);
  await sala.motor.mensaje(uno, codificarLoteria(ronda, 0xffff));
  await sala.motor.mensaje(dos, codificarLoteria(ronda, 0xffff));
  assert.equal(uno.ultimo(T.RESULTADO).lugar, 1);
  const r2 = dos.ultimo(T.RESULTADO);
  assert.equal(r2.motivo, MOTIVO.YA_GANASTE);
  assert.equal(r2.lugar, 1, 'la segunda conexión recibe el mismo lugar, no uno nuevo');
  await sala.tic();
  const conteo = uno.ultimo(T.FIN) ?? uno.ultimo(T.STATS);
  assert.equal(conteo.ganadores, 1);
});

test('#43: quien no eligió tabla y recarga durante el canto sigue jugando con su pase', async () => {
  const sala = crearSala();
  await sala.entra(TOKEN_B); // alguien más se queda conectado para que la sala siga cantando
  const a = await sala.entra(TOKEN_A);
  const e0 = a.ultimo(T.ESTADO);
  const pase = aHex(e0.pase);
  sala.sale(a);
  await sala.tic(); // empieza el canto
  await sala.tic();
  const otra = await sala.entra(TOKEN_A, { ronda: e0.ronda, carta: 0, pase });
  const e = otra.ultimo(T.ESTADO);
  assert.equal(e.espectador, false);
  assert.deepEqual(e.tabla, tablaDe(TOKEN_A, 0, 16));
  assert.ok(e.pase, 'el ESTADO del canto también trae el pase');
});

test('#44: con la ronda en la URL pero sin pase válido se entra como espectador', async () => {
  const sala = crearSala();
  await sala.entra(TOKEN_B);
  const a = await sala.entra(TOKEN_A);
  const e0 = a.ultimo(T.ESTADO);
  sala.sale(a);
  await sala.tic(); // canto
  for (const reanudar of [
    { ronda: e0.ronda, carta: 0 },
    { ronda: e0.ronda, carta: 0, pase: '00'.repeat(16) },
    { ronda: e0.ronda, carta: 1, pase: aHex(e0.pase) }, // pase de otra carta
    { ronda: e0.ronda, carta: 0, pase: aHex(calcularPase(SEMILLA, TOKEN_B, 0)) }, // pase de otro jugador
  ]) {
    const c = await sala.entra(TOKEN_A, reanudar);
    assert.equal(c.ultimo(T.ESTADO).espectador, true, JSON.stringify(reanudar));
    await sala.motor.mensaje(c, codificarLoteria(e0.ronda, 0xffff));
    assert.equal(c.ultimo(T.RESULTADO).motivo, MOTIVO.ESPECTADOR);
    sala.sale(c);
  }
  const buena = await sala.entra(TOKEN_A, { ronda: e0.ronda, carta: 0, pase: aHex(e0.pase) });
  assert.equal(buena.ultimo(T.ESTADO).espectador, false);
});

test('#44: un pase de la ronda anterior no sirve en la siguiente', async () => {
  const sala = crearSala({}, 4);
  await sala.entra(TOKEN_B);
  const a = await sala.entra(TOKEN_A);
  const e0 = a.ultimo(T.ESTADO);
  for (let i = 0; i < 7; i++) await sala.tic(); // 4 cartas, gracia, fin, nueva ronda y canto
  sala.sale(a);
  const c = await sala.entra(TOKEN_A, { ronda: e0.ronda, carta: 0, pase: aHex(e0.pase) });
  const e = c.ultimo(T.ESTADO);
  assert.notEqual(e.ronda, e0.ronda);
});

test('#45: el tiempo de la carta alcanza más de 25.5 s', () => {
  const m = decodificar(codificarCarta(1, 54, 7, 30_000));
  assert.equal(m?.msSiguiente, 30_000);
  assert.equal(codificarCarta(1, 54, 7, 30_000).length, 6, 'la carta sigue pesando 6 bytes');
});

test('#46: durante la gracia final todavía se puede gritar con la carta llena', async () => {
  const sala = crearSala({ graciaMs: 10_000 });
  const a = await sala.entra(TOKEN_A);
  const ronda = a.ultimo(T.ESTADO).ronda;
  for (let i = 0; i < 16; i++) await sala.tic(); // 16 cartas: ya en la gracia
  sala.avanzar(5000);
  await sala.motor.mensaje(a, codificarLoteria(ronda, 0xffff));
  assert.equal(a.ultimo(T.RESULTADO).ok, true);
});

test('la sala no escribe nada por jugador que elige tabla o entra', async () => {
  const sala = crearSala({}, 54);
  const conexiones: ConexionFalsa[] = [];
  for (let i = 0; i < 200; i++) conexiones.push(await sala.entra(i.toString(16).padStart(32, '0')));
  const ronda = conexiones[0].ultimo(T.ESTADO).ronda;
  for (const [i, c] of conexiones.entries()) await sala.motor.mensaje(c, codificarElijo(ronda, i % 3));
  for (let i = 0; i < 5; i++) await sala.tic();
  const porJugador = sala.escrituras.filter((k) => /[0-9a-f]{32}/.test(k));
  assert.deepEqual(porJugador, []);
  // Con 200 jugadores, en la espera y 4 cartas se escriben pocas filas: estado, cuota y nada más.
  assert.ok(sala.escrituras.length <= 12, `escrituras: ${sala.escrituras.length}`);
});

test('los ganadores se guardan en lotes, no una fila por ganador', async () => {
  const sala = crearSala({}, 16);
  const conexiones: ConexionFalsa[] = [];
  for (let i = 0; i < 50; i++) conexiones.push(await sala.entra(i.toString(16).padStart(32, '0')));
  for (let i = 0; i < 16; i++) await sala.tic(); // todos llenan con 16 cartas
  const ronda = conexiones[0].ultimo(T.ESTADO).ronda;
  for (const c of conexiones) await sala.motor.mensaje(c, codificarLoteria(ronda, 0xffff));
  await sala.tic();
  const lotes = [...sala.almacen.keys()].filter((k) => k.startsWith(`ganadores:${ronda}:`));
  assert.ok(lotes.length <= 2, `filas de ganadores: ${lotes.length}`);
  const total = lotes.reduce((n, k) => n + Object.keys(sala.almacen.get(k) as object).length, 0);
  assert.equal(total, 50);
});

// ---- Falsa lotería: gritar sin la carta llena deja fuera de la ronda ----

test('falsa lotería: queda descalificado y no puede volver a reclamar en la ronda', async () => {
  const sala = crearSala();
  const a = await sala.entra(TOKEN_A);
  const ronda = a.ultimo(T.ESTADO).ronda;
  await sala.tic();
  await sala.motor.mensaje(a, codificarLoteria(ronda, 0xffff));
  assert.equal(a.ultimo(T.RESULTADO).motivo, MOTIVO.DESCALIFICADO);
  for (let i = 0; i < 15; i++) await sala.tic(); // su carta ya está llena de verdad
  await sala.motor.mensaje(a, codificarLoteria(ronda, 0xffff));
  assert.equal(a.ultimo(T.RESULTADO).motivo, MOTIVO.DESCALIFICADO);
});

test('las 16 cartas salieron pero no tiene frijol en todas: es falsa lotería', async () => {
  const sala = crearSala();
  const a = await sala.entra(TOKEN_A);
  const ronda = a.ultimo(T.ESTADO).ronda;
  for (let i = 0; i < 16; i++) await sala.tic();
  await sala.motor.mensaje(a, codificarLoteria(ronda, 0x7fff)); // le falta un frijol
  assert.equal(a.ultimo(T.RESULTADO).motivo, MOTIVO.DESCALIFICADO);
});

test('el descalificado sigue fuera aunque se reconecte con un pase válido', async () => {
  const sala = crearSala();
  const a = await sala.entra(TOKEN_A);
  const ronda = a.ultimo(T.ESTADO).ronda;
  await sala.tic();
  await sala.motor.mensaje(a, codificarLoteria(ronda, 0xffff));
  sala.sale(a);
  const pase = aHex(calcularPase(SEMILLA, TOKEN_A, 0));
  const otra = await sala.entra(TOKEN_A, { ronda, carta: 0, pase });
  const e = otra.ultimo(T.ESTADO);
  assert.equal(e.espectador, false);
  assert.equal(e.descalificado, true, 'el estado avisa que está fuera');
  for (let i = 0; i < 15; i++) await sala.tic();
  await sala.motor.mensaje(otra, codificarLoteria(ronda, 0xffff));
  assert.equal(otra.ultimo(T.RESULTADO).motivo, MOTIVO.DESCALIFICADO);
});

test('la descalificación sobrevive a que la sala pierda su memoria', async () => {
  const sala = crearSala();
  const a = await sala.entra(TOKEN_A);
  const ronda = a.ultimo(T.ESTADO).ronda;
  await sala.tic();
  await sala.motor.mensaje(a, codificarLoteria(ronda, 0xffff));
  await sala.tic(); // el reloj guarda el lote de descalificados
  sala.olvidar(); // como si el Durable Object hubiera dormido
  const otra = await sala.entra(TOKEN_A);
  assert.equal(otra.ultimo(T.ESTADO).descalificado, true);
});

test('muchos gritos falsos cuestan pocas filas: un lote por paso del reloj', async () => {
  const sala = crearSala({}, 54);
  const tramposos: ConexionFalsa[] = [];
  for (let i = 0; i < 300; i++) tramposos.push(await sala.entra(i.toString(16).padStart(32, '0')));
  const ronda = tramposos[0].ultimo(T.ESTADO).ronda;
  await sala.tic();
  const antes = sala.escrituras.length;
  for (const c of tramposos) await sala.motor.mensaje(c, codificarLoteria(ronda, 0xffff));
  await sala.tic();
  const filas = sala.escrituras.slice(antes).filter((k) => k.startsWith('descalificados:'));
  assert.ok(filas.length <= 2, `filas de descalificados: ${filas.length}`);
  assert.deepEqual(sala.escrituras.filter((k) => /[0-9a-f]{32}/.test(k)), [], 'ninguna fila lleva un token en la clave');
  for (const c of tramposos) assert.equal(c.ultimo(T.RESULTADO).motivo, MOTIVO.DESCALIFICADO);
});

test('en la ronda siguiente el descalificado vuelve a jugar', async () => {
  const sala = crearSala();
  const a = await sala.entra(TOKEN_A);
  const ronda = a.ultimo(T.ESTADO).ronda;
  await sala.tic();
  await sala.motor.mensaje(a, codificarLoteria(ronda, 0xffff));
  for (let i = 0; i < 17; i++) await sala.tic(); // termina la ronda (16 cartas + fin)
  await sala.tic(); // nueva ronda
  const e = a.ultimo(T.ESTADO);
  assert.equal(e.ronda, ronda + 1);
  assert.equal(e.descalificado, false);
});

test('gritar cuando la ronda ya terminó no descalifica', async () => {
  const sala = crearSala();
  const a = await sala.entra(TOKEN_A);
  const ronda = a.ultimo(T.ESTADO).ronda;
  for (let i = 0; i < 17; i++) await sala.tic(); // 16 cartas y fin de la gracia
  await sala.motor.mensaje(a, codificarLoteria(ronda, 0xffff));
  assert.equal(a.ultimo(T.RESULTADO).motivo, MOTIVO.FUERA_DE_RONDA);
});
