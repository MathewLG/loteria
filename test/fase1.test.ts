// Fase 1 del motor: elegir tabla, espectadores, cupo, cuota diaria y registro de rondas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Motor, type Adjunto, type Conexion, type Config, type Entorno, type RegistroRonda } from '../src/motor.ts';
import {
  FASE, MOTIVO, T, codificarElijo, codificarEstado, codificarLoteria, decodificar, mascaraCantadas,
} from '../public/js/protocolo.js';
import { aHex, barajar, sha256, tablaDe } from '../public/js/baraja.js';

class ConexionFalsa implements Conexion {
  recibidos: any[] = [];
  private a: Adjunto | null = null;
  enviar(datos: Uint8Array) { this.recibidos.push(decodificar(datos)); }
  adjunto() { return this.a ? { ...this.a } : null; }
  guardarAdjunto(a: Adjunto) { this.a = { ...a }; }
  ultimo(tipo: number) { return [...this.recibidos].reverse().find((m) => m.tipo === tipo); }
}

function crearSala(extra: Partial<Config> = {}, catalogo = 54) {
  const conexiones: ConexionFalsa[] = [];
  const almacen = new Map<string, unknown>();
  const registros: RegistroRonda[] = [];
  let alarma = false;
  let reloj = Date.UTC(2026, 10, 21, 12, 0, 0);
  const entorno: Entorno = {
    conexiones: () => conexiones,
    programarAlarma: async () => { alarma = true; },
    hayAlarma: async () => alarma,
    leer: async (k) => structuredClone(almacen.get(k)) as any,
    escribir: async (k, v) => { almacen.set(k, structuredClone(v)); },
    borrarPrefijo: async (p) => { for (const k of [...almacen.keys()]) if (k.startsWith(p)) almacen.delete(k); },
    ahora: () => reloj,
    aleatorio: (n) => new Uint8Array(n).fill(9),
    guardarRonda: async (r) => { registros.push(r); },
  };
  const motor = new Motor(entorno, { esperaMs: 1000, cartaMs: 1000, finMs: 1000, catalogo, ...extra });
  return {
    motor,
    almacen,
    registros,
    conexiones,
    async entra(token: string, rondaPrevia = 0) {
      const c = new ConexionFalsa();
      conexiones.push(c);
      await motor.conectar(c, token, rondaPrevia);
      return c;
    },
    sale(c: ConexionFalsa) { conexiones.splice(conexiones.indexOf(c), 1); },
    async tic() { reloj += 1000; await motor.alarma(); },
    avanzarReloj(ms: number) { reloj += ms; },
  };
}

const TOKEN_A = 'a'.repeat(32);
const TOKEN_B = 'b'.repeat(32);

test('el formato de ESTADO ida y vuelta conserva tablas, banderas y elección', () => {
  const tablas = [Array.from({ length: 16 }, (_, i) => i + 1), Array.from({ length: 16 }, (_, i) => i + 20)];
  const b = codificarEstado({
    ronda: 7, fase: FASE.TERMINADA, figura: 0, catalogo: 54, msSiguiente: 1234, jugadores: 9, ganadores: 2,
    lugar: 1, espectador: true, elegida: 1, huella: new Uint8Array(32).fill(3), tablas,
    cantadas: [5, 6, 7], semilla: new Uint8Array(32).fill(4),
  });
  assert.equal(b.length, 24 + 32 + 2 * 16 + 3 + 32);
  const m = decodificar(b) as any;
  assert.equal(m.espectador, true);
  assert.equal(m.elegida, 1);
  assert.deepEqual(m.tablas, tablas);
  assert.deepEqual(m.cantadas, [5, 6, 7]);
  assert.equal(aHex(m.semilla), '04'.repeat(32));
});

test('en la espera se ofrecen 3 tablas distintas y deterministas', async () => {
  const sala = crearSala();
  const e = (await sala.entra(TOKEN_A)).ultimo(T.ESTADO);
  assert.equal(e.fase, FASE.ESPERA);
  assert.equal(e.tablas.length, 3);
  const unicas = new Set(e.tablas.map((t: number[]) => t.join(',')));
  assert.equal(unicas.size, 3);
  for (const t of e.tablas) assert.equal(new Set(t).size, 16);
  assert.deepEqual(e.tablas[2], tablaDe(TOKEN_A, e.ronda, 54, 2));
  assert.equal(e.elegida, 0);
  assert.equal(e.espectador, false);
});

test('ELIJO en la espera cambia la tabla y se confirma con ELECCION', async () => {
  const sala = crearSala();
  const a = await sala.entra(TOKEN_A);
  const ronda = a.ultimo(T.ESTADO).ronda;
  await sala.motor.mensaje(a, codificarElijo(ronda, 2));
  assert.deepEqual(a.ultimo(T.ELECCION), { tipo: T.ELECCION, ok: true, indice: 2 });
  assert.equal(a.adjunto()!.elegida, 2);
  assert.equal(sala.almacen.get(`tabla:${ronda}:${TOKEN_A}`), 2);
});

test('ELIJO inválido se rechaza y conserva la elección anterior', async () => {
  const sala = crearSala();
  const a = await sala.entra(TOKEN_A);
  const ronda = a.ultimo(T.ESTADO).ronda;
  await sala.motor.mensaje(a, codificarElijo(ronda, 1));
  await sala.motor.mensaje(a, codificarElijo(ronda, 3));
  assert.deepEqual(a.ultimo(T.ELECCION), { tipo: T.ELECCION, ok: false, indice: 1 });
  await sala.motor.mensaje(a, codificarElijo(ronda + 1, 0));
  assert.equal(a.ultimo(T.ELECCION).ok, false);
  await sala.tic(); // empieza a cantar
  await sala.motor.mensaje(a, codificarElijo(ronda, 0));
  assert.deepEqual(a.ultimo(T.ELECCION), { tipo: T.ELECCION, ok: false, indice: 1 });
  assert.equal(a.adjunto()!.elegida, 1);
});

test('al cantar, ESTADO trae solo la tabla elegida', async () => {
  const sala = crearSala();
  const a = await sala.entra(TOKEN_A);
  const ronda = a.ultimo(T.ESTADO).ronda;
  await sala.motor.mensaje(a, codificarElijo(ronda, 1));
  await sala.tic();
  const otra = await sala.entra(TOKEN_A, ronda);
  const e = otra.ultimo(T.ESTADO);
  assert.equal(e.fase, FASE.CANTANDO);
  assert.equal(e.tablas.length, 1);
  assert.equal(e.elegida, 1);
  assert.deepEqual(e.tabla, tablaDe(TOKEN_A, ronda, 54, 1));
});

test('al reconectar se conserva la tabla elegida aunque no mande la ronda previa', async () => {
  const sala = crearSala();
  const a = await sala.entra(TOKEN_A);
  const ronda = a.ultimo(T.ESTADO).ronda;
  await sala.motor.mensaje(a, codificarElijo(ronda, 2));
  sala.sale(a);
  await sala.tic();
  const otra = await sala.entra(TOKEN_A);
  const e = otra.ultimo(T.ESTADO);
  assert.equal(e.espectador, false);
  assert.equal(e.elegida, 2);
});

test('el reclamo se valida contra la tabla elegida, no contra otra', async () => {
  const sala = crearSala({}, 20);
  const a = await sala.entra(TOKEN_A);
  const ronda = a.ultimo(T.ESTADO).ronda;
  const baraja = barajar(new Uint8Array(32).fill(9), 20);
  // Carta con la que se llena cada tabla ofrecida.
  const llenaEn = [0, 1, 2].map((i) => {
    const tabla = tablaDe(TOKEN_A, ronda, 20, i);
    return Math.max(...tabla.map((c) => baraja.indexOf(c))) + 1;
  });
  const orden = [0, 1, 2].sort((x, y) => llenaEn[x] - llenaEn[y]);
  const [primera, , ultima] = orden;
  assert.ok(llenaEn[primera] < llenaEn[ultima], 'con esta semilla las tablas se llenan en momentos distintos');
  await sala.motor.mensaje(a, codificarElijo(ronda, ultima));
  for (let i = 1; i <= 20; i++) {
    await sala.tic();
    if (i === llenaEn[primera]) {
      await sala.motor.mensaje(a, codificarLoteria(ronda, 0xffff));
      assert.equal(a.ultimo(T.RESULTADO).motivo, MOTIVO.INCOMPLETA, 'otra tabla llena no cuenta');
    }
    if (i === llenaEn[ultima]) {
      await sala.motor.mensaje(a, codificarLoteria(ronda, 0xffff));
      assert.equal(a.ultimo(T.RESULTADO).ok, true, 'la tabla elegida llena gana');
      return;
    }
  }
  assert.fail('la tabla elegida nunca se llenó');
});

test('quien llega con la ronda cantándose es espectador y no puede reclamar', async () => {
  const sala = crearSala();
  await sala.entra(TOKEN_A);
  await sala.tic(); // primera carta
  const b = await sala.entra(TOKEN_B);
  const e = b.ultimo(T.ESTADO);
  assert.equal(e.espectador, true);
  assert.equal(e.tablas.length, 0);
  await sala.motor.mensaje(b, codificarLoteria(e.ronda, 0xffff));
  assert.equal(b.ultimo(T.RESULTADO).motivo, MOTIVO.ESPECTADOR);
});

test('el espectador juega normal desde la siguiente ronda', async () => {
  const sala = crearSala({}, 16);
  await sala.entra(TOKEN_A);
  await sala.tic();
  const b = await sala.entra(TOKEN_B);
  for (let i = 0; i < 17; i++) await sala.tic(); // termina de cantar y llega el fin
  await sala.tic(); // nueva ronda
  const e = b.ultimo(T.ESTADO);
  assert.equal(e.fase, FASE.ESPERA);
  assert.equal(e.espectador, false);
  assert.equal(e.tablas.length, 3);
});

test('quien vuelve a su misma ronda (r=ronda) no es espectador', async () => {
  const sala = crearSala();
  const a = await sala.entra(TOKEN_A);
  const ronda = a.ultimo(T.ESTADO).ronda;
  sala.sale(a);
  await sala.tic();
  const otra = await sala.entra(TOKEN_A, ronda);
  assert.equal(otra.ultimo(T.ESTADO).espectador, false);
});

test('con el cupo lleno, admitir rechaza con razón "llena" y tiempo de reintento', async () => {
  const sala = crearSala({ cupo: 2 });
  assert.equal(await sala.motor.admitir(), null);
  await sala.entra(TOKEN_A);
  assert.equal(await sala.motor.admitir(), null);
  await sala.entra(TOKEN_B);
  const r = await sala.motor.admitir();
  assert.equal(r?.razon, 'llena');
  assert.ok((r?.reintentarEnMs ?? 0) > 0);
});

test('al 90% de la cuota diaria ya no entra nadie, y se reinicia al día siguiente', async () => {
  const sala = crearSala({ cuotaDiaria: 100, umbralCuota: 0.9 });
  for (let i = 0; i < 89; i++) assert.equal(await sala.motor.admitir(), null);
  const r = await sala.motor.admitir();
  assert.equal(r?.razon, 'cuota');
  assert.ok((r?.reintentarEnMs ?? 0) > 0 && (r?.reintentarEnMs ?? 0) <= 86_400_000);
  sala.avanzarReloj(86_400_000);
  assert.equal(await sala.motor.admitir(), null);
});

test('los mensajes entrantes cuentan 1 solicitud por cada 20', async () => {
  const sala = crearSala();
  const a = await sala.entra(TOKEN_A);
  const ronda = a.ultimo(T.ESTADO).ronda;
  const antes = await sala.motor.solicitudesHoy();
  for (let i = 0; i < 40; i++) await sala.motor.mensaje(a, codificarElijo(ronda, 0));
  assert.equal(await sala.motor.solicitudesHoy(), antes + 2);
});

test('al terminar la ronda se guarda su registro completo', async () => {
  const sala = crearSala({}, 16);
  const a = await sala.entra(TOKEN_A);
  const ronda = a.ultimo(T.ESTADO).ronda;
  for (let i = 0; i < 17; i++) await sala.tic();
  assert.equal(sala.registros.length, 1);
  const r = sala.registros[0];
  const semilla = new Uint8Array(32).fill(9);
  assert.equal(r.ronda, ronda);
  assert.equal(r.semilla, aHex(semilla));
  assert.equal(r.huella, aHex(sha256(semilla)));
  assert.deepEqual(r.cantadas, barajar(semilla, 16));
  assert.equal(r.ganadores, 0);
  assert.ok(r.inicio > 0 && r.fin > r.inicio);
});

test('las elecciones de tabla de la ronda anterior se borran al empezar otra', async () => {
  const sala = crearSala({}, 16);
  const a = await sala.entra(TOKEN_A);
  const ronda = a.ultimo(T.ESTADO).ronda;
  await sala.motor.mensaje(a, codificarElijo(ronda, 2));
  for (let i = 0; i < 18; i++) await sala.tic();
  assert.equal(sala.almacen.has(`tabla:${ronda}:${TOKEN_A}`), false);
  assert.equal(a.ultimo(T.ESTADO).elegida, 0);
});
