// Lógica pura del audio: preferencias, qué sonido toca cada evento y la partitura
// de la música. No toca Web Audio, así se prueba con node:test.

/**
 * @typedef {{ efectos: boolean, musica: boolean, silencio: boolean, volumen: number }} PreferenciasAudio
 */

/**
 * Por defecto suenan los efectos y la música queda apagada: la música es una
 * decisión del jugador (juega en el trabajo, en el camión, con la familia platicando),
 * mientras que los efectos son retroalimentación corta de lo que acaba de hacer.
 * @type {PreferenciasAudio}
 */
export const PREFERENCIAS_INICIALES = { efectos: true, musica: false, silencio: false, volumen: 0.8 };

export const CLAVE_PREFERENCIAS = 'loteria:audio';

/**
 * Lee las preferencias guardadas; cualquier dato roto vuelve al valor inicial.
 * @param {{ getItem(clave: string): string | null } | null | undefined} almacen
 * @returns {PreferenciasAudio}
 */
export function leerPreferencias(almacen) {
  /** @type {any} */
  let guardado = null;
  try {
    guardado = JSON.parse(almacen?.getItem(CLAVE_PREFERENCIAS) ?? 'null');
  } catch {
    guardado = null;
  }
  const p = { ...PREFERENCIAS_INICIALES };
  if (guardado && typeof guardado === 'object') {
    if (typeof guardado.efectos === 'boolean') p.efectos = guardado.efectos;
    if (typeof guardado.musica === 'boolean') p.musica = guardado.musica;
    if (typeof guardado.silencio === 'boolean') p.silencio = guardado.silencio;
    if (typeof guardado.volumen === 'number' && Number.isFinite(guardado.volumen)) {
      p.volumen = Math.min(1, Math.max(0, guardado.volumen));
    }
  }
  return p;
}

/**
 * @param {{ setItem(clave: string, valor: string): void } | null | undefined} almacen
 * @param {PreferenciasAudio} p
 */
export function guardarPreferencias(almacen, p) {
  try {
    almacen?.setItem(CLAVE_PREFERENCIAS, JSON.stringify(p));
  } catch {
    // Sin almacenamiento: las preferencias viven solo en esta visita.
  }
}

/** Eventos del juego que pueden sonar. */
export const EVENTOS = ['frijol', 'quitar', 'carta', 'error', 'falsa', 'ganar', 'tirar'];

/**
 * Si un evento debe sonar con estas preferencias.
 * @param {string} evento
 * @param {PreferenciasAudio} p
 */
export function debeSonar(evento, p) {
  return EVENTOS.includes(evento) && p.efectos && !p.silencio && p.volumen > 0;
}

/**
 * Si la música debe estar corriendo.
 * @param {PreferenciasAudio} p
 * @param {boolean} visible  la pestaña está a la vista
 */
export function musicaActiva(p, visible) {
  return p.musica && !p.silencio && p.volumen > 0 && visible;
}

/**
 * Ganancia real de cada bus a partir del volumen general (curva más natural al oído).
 * @param {number} volumen
 */
export function ganancia(volumen) {
  const v = Math.min(1, Math.max(0, volumen));
  return v * v;
}

// ---- Música: un son en 6/8 ----
// Una vuelta son 4 compases (I, IV, V7, I en Sol mayor). Cada compás tiene 6 corcheas.
// La jarana rasguea el acorde con acentos de son; el bajo marca 1 y 4; la tarima
// golpea suave. Cada vuelta cambia un poco el rasgueo y el bajo para no cansar.

export const TEMPO_CORCHEA_S = 0.2; // 6 corcheas = 1.2 s por compás

/** @param {number} midi */
const NOTA = (midi) => 440 * 2 ** ((midi - 69) / 12);

/** Acordes por compás en notas MIDI (Sol mayor). */
const ACORDES = [
  [55, 59, 62, 67], // G
  [60, 64, 67, 72], // C
  [62, 66, 69, 72], // D7
  [55, 59, 62, 67], // G
];
const BAJOS = [43, 48, 50, 43];

/** Patrones de rasgueo: 1 = golpe fuerte, 0.5 = golpe suave, 0 = silencio. */
const RASGUEOS = [
  [1, 0, 0.5, 1, 0.5, 0.5],
  [1, 0.5, 0.5, 1, 0, 0.5],
  [1, 0, 0.5, 0.5, 1, 0],
];

/**
 * @typedef {{ tiempo: number, instrumento: 'jarana' | 'bajo' | 'tarima', frecuencias: number[], fuerza: number, duracion: number }} NotaMusica
 */

/**
 * Las notas de un compás. `compas` cuenta desde 0 sin fin; `inicio` es su tiempo de arranque.
 * @param {number} compas
 * @param {number} inicio
 * @returns {NotaMusica[]}
 */
export function notasDelCompas(compas, inicio) {
  const enVuelta = ((compas % 4) + 4) % 4;
  const vuelta = Math.floor(compas / 4);
  const acorde = ACORDES[enVuelta];
  const rasgueo = RASGUEOS[vuelta % RASGUEOS.length];
  /** @type {NotaMusica[]} */
  const notas = [];
  for (let i = 0; i < 6; i++) {
    const t = inicio + i * TEMPO_CORCHEA_S;
    if (rasgueo[i] > 0) {
      notas.push({ tiempo: t, instrumento: 'jarana', frecuencias: acorde.map(NOTA), fuerza: rasgueo[i], duracion: 0.18 });
    }
  }
  // Bajo en 1 y 4; en vueltas impares camina a la quinta en el 4.
  const bajo = BAJOS[enVuelta];
  notas.push({ tiempo: inicio, instrumento: 'bajo', frecuencias: [NOTA(bajo)], fuerza: 1, duracion: 0.5 });
  const segundo = vuelta % 2 === 1 ? bajo + 7 : bajo;
  notas.push({ tiempo: inicio + 3 * TEMPO_CORCHEA_S, instrumento: 'bajo', frecuencias: [NOTA(segundo)], fuerza: 0.8, duracion: 0.45 });
  // Tarima: zapateado suave en 1, 3 y 4; en el cierre de la vuelta, un remate en 6.
  for (const i of [0, 2, 3]) {
    notas.push({ tiempo: inicio + i * TEMPO_CORCHEA_S, instrumento: 'tarima', frecuencias: [], fuerza: i === 0 ? 1 : 0.6, duracion: 0.05 });
  }
  if (enVuelta === 3) {
    notas.push({ tiempo: inicio + 5 * TEMPO_CORCHEA_S, instrumento: 'tarima', frecuencias: [], fuerza: 0.8, duracion: 0.05 });
  }
  return notas;
}

/** Duración de un compás en segundos. */
export const DURACION_COMPAS_S = 6 * TEMPO_CORCHEA_S;

/**
 * Qué compases hay que programar para cubrir hasta `hasta` (lookahead), dado el
 * siguiente compás pendiente y cuándo empieza.
 * @param {number} siguiente
 * @param {number} inicioSiguiente
 * @param {number} hasta
 * @returns {{ compas: number, inicio: number }[]}
 */
export function compasesPendientes(siguiente, inicioSiguiente, hasta) {
  /** @type {{ compas: number, inicio: number }[]} */
  const lista = [];
  let c = siguiente;
  let t = inicioSiguiente;
  while (t < hasta) {
    lista.push({ compas: c, inicio: t });
    c += 1;
    t += DURACION_COMPAS_S;
  }
  return lista;
}
