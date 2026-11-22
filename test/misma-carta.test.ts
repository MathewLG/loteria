// #64 conservar la misma carta entre rondas y #65 easter egg de los frijoles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Motor, calcularPase, reanudarDeUrl, type Adjunto, type Conexion, type Entorno, type Reanudar } from '../src/motor.ts';
import { FASE, T, codificarElijo, decodificar } from '../public/js/protocolo.js';
import { aHex, tablaDe } from '../public/js/baraja.js';
import { RACHA_VACIA, registrarToque } from '../public/js/frijoles.js';

class ConexionFalsa implements Conexion {
  recibidos: any[] = [];
  private a: Adjunto | null = null;
  enviar(datos: Uint8Array) { this.recibidos.push(decodificar(datos)); }
  adjunto() { return this.a ? { ...this.a } : null; }
  guardarAdjunto(a: Adjunto) { this.a = { ...a }; }
  ultimo(tipo: number) { return [...this.recibidos].reverse().find((m) => m.tipo === tipo); }
}

const SEMILLA = '09'.repeat(32);
const TOKEN = 'c'.repeat(32);
const CATALOGO = 16;

function crearSala() {
  const conexiones: ConexionFalsa[] = [];
  const almacen = new Map<string, unknown>();
  let escrituras: string[] = [];
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
    aleatorio: (n) => new Uint8Array(n).fill(9),
  };
  const motor = new Motor(entorno, { esperaMs: 1000, cartaMs: 1000, finMs: 1000, catalogo: CATALOGO });
  return {
    motor,
    escrituras: () => escrituras,
    async entra(reanudar?: Reanudar) {
      const c = new ConexionFalsa();
      conexiones.push(c);
      await motor.conectar(c, TOKEN, reanudar);
      return c;
    },
    sale(c: ConexionFalsa) { conexiones.splice(conexiones.indexOf(c), 1); },
    async tic() { reloj += 1000; await motor.alarma(); },
    /** Avanza hasta la espera de la ronda siguiente. */
    async siguienteRonda(c: ConexionFalsa) {
      const ronda = c.ultimo(T.ESTADO).ronda;
      for (let i = 0; i < CATALOGO + 5 && c.ultimo(T.ESTADO).ronda === ronda; i++) await this.tic();
    },
  };
}

test('la ronda siguiente empieza con la misma carta, ya elegida', async () => {
  const sala = crearSala();
  const a = await sala.entra({ ronda: 0, carta: 7 });
  const e1 = a.ultimo(T.ESTADO);
  assert.equal(e1.base, 7);
  assert.equal(e1.elegida, 0);
  assert.deepEqual(e1.tablas[0], tablaDe(TOKEN, 7, CATALOGO));
  await sala.siguienteRonda(a);
  const e2 = a.ultimo(T.ESTADO);
  assert.equal(e2.fase, FASE.ESPERA);
  assert.equal(e2.ronda, e1.ronda + 1);
  assert.equal(e2.numeroCarta, 7);
  assert.equal(e2.elegida, 0);
  assert.deepEqual(e2.tablas[0], e1.tablas[0], 'la misma carta que la ronda anterior');
});

test('cambiar de carta en la espera se conserva en las rondas siguientes', async () => {
  const sala = crearSala();
  const a = await sala.entra({ ronda: 0, carta: 7 });
  const ronda = a.ultimo(T.ESTADO).ronda;
  await sala.motor.mensaje(a, codificarElijo(ronda, 2));
  assert.equal(a.ultimo(T.ELECCION).ok, true);
  await sala.siguienteRonda(a);
  const e = a.ultimo(T.ESTADO);
  assert.equal(e.numeroCarta, 9);
  assert.deepEqual(e.tablas[0], tablaDe(TOKEN, 9, CATALOGO));
  await sala.siguienteRonda(a);
  assert.equal(a.ultimo(T.ESTADO).numeroCarta, 9, 'sigue siendo la misma dos rondas después');
});

test('quien vuelve otro día con su número de carta recibe la misma carta', async () => {
  const s1 = crearSala();
  const t1 = (await s1.entra({ ronda: 0, carta: 42 })).ultimo(T.ESTADO).tablas[0];
  const s2 = crearSala();
  const t2 = (await s2.entra({ ronda: 0, carta: 42 })).ultimo(T.ESTADO).tablas[0];
  assert.deepEqual(t1, t2);
  const t3 = (await crearSala().entra({ ronda: 0, carta: 43 })).ultimo(T.ESTADO).tablas[0];
  assert.notDeepEqual(t1, t3, 'otro número es otra carta');
});

test('el pase cubre la carta elegida: con otro número se queda de espectador', async () => {
  const sala = crearSala();
  const a = await sala.entra({ ronda: 0, carta: 5 });
  const ronda = a.ultimo(T.ESTADO).ronda;
  await sala.motor.mensaje(a, codificarElijo(ronda, 1));
  const pase = aHex(a.ultimo(T.ELECCION).pase);
  assert.equal(pase, aHex(calcularPase(SEMILLA, TOKEN, 6)));
  await sala.tic(); // empieza a cantar (la conexión original sigue para que la sala no duerma)
  assert.equal(a.ultimo(T.CARTA)?.indice, 1);
  const buena = (await sala.entra({ ronda, carta: 6, pase })).ultimo(T.ESTADO);
  assert.equal(buena.espectador, false);
  assert.equal(buena.numeroCarta, 6);
  const mala = (await sala.entra({ ronda, carta: 5, pase })).ultimo(T.ESTADO);
  assert.equal(mala.espectador, true);
});

test('el número de carta de la URL se valida', () => {
  const u = (q: string) => reanudarDeUrl(new URL(`https://x/ws?t=${TOKEN}${q}`));
  assert.equal(u('&c=12').carta, 12);
  assert.equal(u('&c=1000').carta, 0);
  assert.equal(u('&c=-1').carta, 0);
  assert.equal(u('&c=abc').carta, 0);
  assert.equal(u('').ronda, 0);
});

test('conservar la carta no escribe nada por jugador', async () => {
  const sala = crearSala();
  const a = await sala.entra({ ronda: 0, carta: 3 });
  await sala.motor.mensaje(a, codificarElijo(a.ultimo(T.ESTADO).ronda, 1));
  await sala.siguienteRonda(a);
  assert.ok(!sala.escrituras().some((k) => k.includes(TOKEN)));
});

test('easter egg: 7 toques seguidos en la misma casilla en 3 s tiran los frijoles', () => {
  let racha = RACHA_VACIA;
  let tirar = false;
  for (let i = 0; i < 7; i++) ({ racha, tirar } = registrarToque(racha, 4, 1000 + i * 300));
  assert.equal(tirar, true);
  assert.deepEqual(racha.tiempos, [], 'la cuenta se reinicia después de tirar');
});

test('easter egg: marcar casillas distintas o tocar despacio no lo dispara', () => {
  let racha = RACHA_VACIA;
  let tirar = false;
  for (let i = 0; i < 20; i++) {
    ({ racha, tirar } = registrarToque(racha, i % 2, i * 200));
    assert.equal(tirar, false, 'alternar casillas no cuenta');
  }
  racha = RACHA_VACIA;
  for (let i = 0; i < 20; i++) {
    ({ racha, tirar } = registrarToque(racha, 3, i * 600));
    assert.equal(tirar, false, 'un toque cada 600 ms son 6 en 3 s, no alcanza');
  }
});
