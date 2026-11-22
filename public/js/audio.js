// Sonido del juego, todo sintetizado con Web Audio: sin archivos ni descargas.
// Buses: efectos, música y voz (reservado para el gritón con voz, HU-12).
// Cuando se canta una carta la música se agacha para no tapar el canto.

import {
  compasesPendientes, debeSonar, DURACION_COMPAS_S, ganancia, guardarPreferencias,
  leerPreferencias, musicaActiva, notasDelCompas,
} from './audio-logica.js';

/** @typedef {import('./audio-logica.js').PreferenciasAudio} PreferenciasAudio */

const almacen = (() => { try { return localStorage; } catch { return null; } })();

/** @type {PreferenciasAudio} */
let prefs = leerPreferencias(almacen);
/** @type {Set<(p: PreferenciasAudio) => void>} */
const oyentes = new Set();

/** @type {AudioContext | null} */
let ctx = null;
/** @type {{ maestro: GainNode, efectos: GainNode, musica: GainNode, voz: GainNode, agacha: GainNode, medidores: Record<string, AnalyserNode> } | null} */
let buses = null;
/** @type {AudioBuffer | null} */
let ruido = null;

const MEZCLA = { efectos: 0.55, musica: 0.16, voz: 1 };

function crearContexto() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  const maestro = ctx.createGain();
  const efectos = ctx.createGain();
  const musica = ctx.createGain();
  const agacha = ctx.createGain();
  const voz = ctx.createGain();
  const compresor = ctx.createDynamicsCompressor();
  compresor.threshold.value = -14;
  compresor.ratio.value = 4;
  efectos.connect(maestro);
  musica.connect(agacha).connect(maestro);
  voz.connect(maestro);
  maestro.connect(compresor).connect(ctx.destination);
  /** @type {Record<string, AnalyserNode>} */
  const medidores = {};
  for (const [nombre, nodo] of /** @type {[string, AudioNode][]} */ ([['efectos', efectos], ['musica', agacha], ['voz', voz]])) {
    const a = ctx.createAnalyser();
    a.fftSize = 512;
    nodo.connect(a);
    medidores[nombre] = a;
  }
  buses = { maestro, efectos, musica, voz, agacha, medidores };
  // Ruido blanco de 1 s para golpes de madera, tarima y frijoles.
  ruido = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const datos = ruido.getChannelData(0);
  for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
  aplicarGanancias(true);
  return ctx;
}

function aplicarGanancias(inmediato = false) {
  if (!ctx || !buses) return;
  const t = ctx.currentTime;
  const fijar = (/** @type {AudioParam} */ param, /** @type {number} */ valor) => {
    param.cancelScheduledValues(t);
    if (inmediato) param.setValueAtTime(valor, t);
    else param.setTargetAtTime(valor, t, 0.05);
  };
  const general = prefs.silencio ? 0 : ganancia(prefs.volumen);
  fijar(buses.maestro.gain, general);
  fijar(buses.efectos.gain, prefs.efectos ? MEZCLA.efectos : 0);
  fijar(buses.musica.gain, prefs.musica ? MEZCLA.musica : 0);
  fijar(buses.voz.gain, MEZCLA.voz);
}

/** Despierta el audio con el primer gesto del jugador (política de autoplay). */
function despertar() {
  const c = crearContexto();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
  revisarMusica();
}
for (const tipo of ['pointerdown', 'keydown']) {
  document.addEventListener(tipo, despertar, { capture: true, passive: true });
}
document.addEventListener('visibilitychange', () => revisarMusica());

// ---- Efectos ----

/** @param {number} f @param {number} t @param {number} dur @param {OscillatorType} tipo @param {number} fuerza */
function tono(f, t, dur, tipo, fuerza, destino = buses?.efectos) {
  if (!ctx || !destino) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(fuerza, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(destino);
  o.start(t);
  o.stop(t + dur + 0.02);
  return o;
}

/**
 * Golpe de ruido filtrado: madera, frijol, tarima.
 * @param {number} t @param {number} frecuencia @param {number} q @param {number} dur @param {number} fuerza
 */
function golpe(t, frecuencia, q, dur, fuerza, destino = buses?.efectos) {
  if (!ctx || !destino || !ruido) return;
  const fuente = ctx.createBufferSource();
  fuente.buffer = ruido;
  const filtro = ctx.createBiquadFilter();
  filtro.type = 'bandpass';
  filtro.frequency.value = frecuencia;
  filtro.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(fuerza, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  fuente.connect(filtro).connect(g).connect(destino);
  fuente.start(t, Math.random() * 0.5);
  fuente.stop(t + dur + 0.02);
}

/** @type {Record<string, (t: number) => void>} */
const EFECTOS = {
  // Frijol que cae en el cartón: golpecito seco al tocar la carta y otro más suave
  // en el rebote, sincronizados con la animación «caer» (62 % y 100 % de 420 ms).
  frijol(t) {
    const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const impacto = quieto ? 0 : 0.25;
    golpe(t + impacto, 2400, 6, 0.05, 0.9);
    if (!quieto) golpe(t + 0.41, 1900, 6, 0.035, 0.3);
  },
  // Quitar un frijol: un roce corto y suave.
  quitar(t) {
    golpe(t, 3200, 3, 0.04, 0.3);
  },
  // Carta nueva: campanita breve, dos parciales.
  carta(t) {
    tono(1318.5, t, 0.5, 'sine', 0.35);
    tono(2637, t, 0.25, 'sine', 0.12);
    golpe(t, 5000, 2, 0.03, 0.15);
  },
  // Error o sacudida: un "toc-toc" grave de madera.
  error(t) {
    golpe(t, 600, 8, 0.07, 0.8);
    golpe(t + 0.11, 500, 8, 0.07, 0.6);
  },
  // Falsa lotería: tres notas que bajan, sin ser estridentes.
  falsa(t) {
    [392, 349.2, 293.7].forEach((f, i) => tono(f, t + i * 0.16, 0.3, 'triangle', 0.35));
  },
  // ¡Lotería!: fanfarria corta de feria (arpegio que sube y acorde final).
  ganar(t) {
    [392, 493.9, 587.3, 784].forEach((f, i) => tono(f, t + i * 0.11, 0.25, 'triangle', 0.35));
    [392, 493.9, 587.3, 784].forEach((f) => tono(f, t + 0.5, 0.9, 'triangle', 0.18));
    golpe(t + 0.5, 4000, 1, 0.3, 0.2);
  },
  // Tirar los frijoles: repiqueteo de muchos frijoles que rebotan y se apagan.
  tirar(t) {
    for (let i = 0; i < 18; i++) {
      const dt = i * 0.035 + Math.random() * 0.03;
      golpe(t + dt, 1800 + Math.random() * 1600, 6, 0.04, 0.7 * (1 - i / 22));
    }
  },
};

/**
 * Hace sonar un evento del juego si las preferencias lo permiten.
 * @param {'frijol' | 'quitar' | 'carta' | 'error' | 'falsa' | 'ganar' | 'tirar'} evento
 */
export function sonar(evento) {
  if (!debeSonar(evento, prefs)) return;
  const c = crearContexto();
  if (!c || c.state !== 'running') return;
  EFECTOS[evento](c.currentTime + 0.01);
}

/** Baja la música mientras se canta una carta (y, en el futuro, mientras habla el gritón). */
export function agacharMusica(segundos = 1.6) {
  if (!ctx || !buses) return;
  const t = ctx.currentTime;
  const g = buses.agacha.gain;
  g.cancelScheduledValues(t);
  g.setTargetAtTime(0.35, t, 0.04);
  g.setTargetAtTime(1, t + segundos, 0.3);
}

/** Bus reservado para la voz del gritón (HU-12). */
export function busDeVoz() {
  crearContexto();
  return buses?.voz ?? null;
}

// ---- Música ----

let siguienteCompas = 0;
let inicioSiguiente = 0;
/** @type {ReturnType<typeof setInterval> | null} */
let reloj = null;
const ADELANTO_S = 0.25;

/** @param {import('./audio-logica.js').NotaMusica} n */
function tocarNota(n) {
  const c = ctx;
  if (!c || !buses) return;
  const destino = buses.musica;
  if (n.instrumento === 'tarima') {
    golpe(n.tiempo, 900, 4, 0.06, 0.5 * n.fuerza, destino);
    return;
  }
  if (n.instrumento === 'bajo') {
    tono(n.frecuencias[0], n.tiempo, n.duracion, 'sine', 0.6 * n.fuerza, destino);
    return;
  }
  // Jarana: cuerdas punteadas con un leve desfase entre ellas, como un rasgueo.
  n.frecuencias.forEach((f, i) => {
    const t = n.tiempo + i * 0.012;
    const o = c.createOscillator();
    const filtro = c.createBiquadFilter();
    const g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f, t);
    filtro.type = 'lowpass';
    filtro.frequency.setValueAtTime(2600, t);
    filtro.frequency.exponentialRampToValueAtTime(600, t + n.duracion);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09 * n.fuerza, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + n.duracion);
    o.connect(filtro).connect(g).connect(destino);
    o.start(t);
    o.stop(t + n.duracion + 0.02);
  });
}

function programar() {
  if (!ctx) return;
  const hasta = ctx.currentTime + ADELANTO_S;
  for (const { compas, inicio } of compasesPendientes(siguienteCompas, inicioSiguiente, hasta)) {
    notasDelCompas(compas, inicio).forEach(tocarNota);
    siguienteCompas = compas + 1;
    inicioSiguiente = inicio + DURACION_COMPAS_S;
  }
}

function revisarMusica() {
  const debe = musicaActiva(prefs, document.visibilityState !== 'hidden');
  if (debe && !reloj && ctx && ctx.state === 'running') {
    siguienteCompas = 0;
    inicioSiguiente = ctx.currentTime + 0.1;
    programar();
    reloj = setInterval(programar, 60);
  } else if (!debe && reloj) {
    clearInterval(reloj);
    reloj = null;
  }
}

// ---- Preferencias ----

export function preferencias() {
  return { ...prefs };
}

/** @param {Partial<PreferenciasAudio>} cambio */
export function cambiarPreferencias(cambio) {
  prefs = { ...prefs, ...cambio };
  guardarPreferencias(almacen, prefs);
  despertar();
  aplicarGanancias();
  revisarMusica();
  oyentes.forEach((f) => f(preferencias()));
}

/** @param {(p: PreferenciasAudio) => void} f */
export function alCambiar(f) {
  oyentes.add(f);
}

// Medición para pruebas automáticas: solo con ?depurar-audio en la URL.
if (new URLSearchParams(location.search).has('depurar-audio')) {
  /** @type {any} */ (window).__audioLoteria = {
    estado: () => ctx?.state ?? 'sin-crear',
    nivel(/** @type {string} */ bus) {
      const a = buses?.medidores[bus];
      if (!a) return 0;
      const datos = new Float32Array(a.fftSize);
      a.getFloatTimeDomainData(datos);
      let suma = 0;
      for (const x of datos) suma += x * x;
      return Math.sqrt(suma / datos.length);
    },
    sonar,
  };
}
