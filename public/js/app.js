import {
  T, FASE, MOTIVO, decodificar, codificarElijo, codificarLoteria,
} from './protocolo.js';
import { aHex, igualesBytes } from './baraja.js';
import { NOMBRES, SVG_FRIJOL, svgCarta, svgReverso } from './cartas.js';
import { RACHA_VACIA, registrarToque } from './frijoles.js';
import { gritoPara } from './versos.js';
import { generarApodo } from './apodos.js';
import { agacharMusica, sonar } from './audio.js';
import './menu-audio.js';
import { claveDeRonda, verificarRonda } from './verificacion.js';
import { duracionAproximada, msHastaSiguienteRonda, textoBoton } from './estado-ui.js';

const $ = (id) => document.getElementById(id);
const ui = {
  aviso: $('aviso-conexion'),
  avisoTexto: $('aviso-texto'),
  reintentar: $('boton-reintentar'),
  botonHistorial: $('boton-historial'),
  contadorCantadas: $('contador-cantadas'),
  cantorCarta: $('cantor-carta'),
  cantorEtiqueta: $('cantor-etiqueta'),
  cantorNombre: $('cantor-nombre'),
  cantorVerso: $('cantor-verso'),
  barraTiempo: $('barra-tiempo'),
  infoSala: $('info-sala'),
  apodo: $('apodo'),
  botonApodo: $('boton-apodo'),
  anuncio: $('anuncio'),
  cargando: $('tabla-cargando'),
  eleccion: $('eleccion'),
  eleccionOpciones: $('eleccion-opciones'),
  espectador: $('espectador'),
  espectadorCuenta: $('espectador-cuenta'),
  espectadorCartas: $('espectador-cartas'),
  apodoLinea: $('apodo-linea'),
  tabla: $('tabla'),
  pie: $('pie'),
  mensaje: $('mensaje'),
  botonLoteria: $('boton-loteria'),
  fin: $('panel-fin'),
  finTitulo: $('fin-titulo'),
  finResultado: $('fin-resultado'),
  finVerificacion: $('fin-verificacion'),
  finSiguiente: $('fin-siguiente'),
  historial: $('historial'),
  historialLista: $('historial-lista'),
  historialVacio: $('historial-vacio'),
  historialCerrar: $('historial-cerrar'),
};

const s = {
  conectado: false,
  ronda: 0,
  fase: -1,
  figura: 0,
  catalogo: 54,
  tablas: [],
  elegida: 0,
  base: 0,
  eligiendo: false,
  tabla: [],
  espectador: false,
  /** Gritó en falso: queda fuera hasta la siguiente ronda. */
  descalificado: false,
  cantadas: [],
  huella: null,
  semilla: null,
  marcadas: 0,
  lugar: 0,
  jugadores: 0,
  ganadores: 0,
  limite: 0,
  msEntreCartas: 6000,
  verificacion: null,
  esperandoResultado: false,
};

// ---- Identidad del jugador: token y apodo guardados en este navegador ----

const guardado = {
  leer(clave) { try { return localStorage.getItem(clave); } catch { return null; } },
  escribir(clave, valor) { try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ } },
};

function obtenerToken() {
  let t = guardado.leer('loteria:token');
  if (!/^[0-9a-f]{32}$/.test(t ?? '')) {
    t = aHex(crypto.getRandomValues(new Uint8Array(16)));
    guardado.escribir('loteria:token', t);
  }
  return t;
}
const token = obtenerToken();

let apodo = guardado.leer('loteria:apodo') || generarApodo();
guardado.escribir('loteria:apodo', apodo);
ui.apodo.textContent = apodo;
ui.botonApodo.addEventListener('click', () => {
  apodo = generarApodo();
  guardado.escribir('loteria:apodo', apodo);
  ui.apodo.textContent = apodo;
  anunciar(`Tu nuevo apodo es ${apodo}.`);
});

// Los frijoles sobreviven a recargar la página, pero solo dentro de la misma ronda y tabla.
const claveMarcas = () => `${aHex(s.huella)}:${(s.base + s.elegida) % 1000}`;
function guardarMarcas() {
  guardado.escribir('loteria:marcas', JSON.stringify({ clave: claveMarcas(), marcadas: s.marcadas }));
}
function cargarMarcas() {
  try {
    const g = JSON.parse(guardado.leer('loteria:marcas') ?? 'null');
    if (g && g.clave === claveMarcas()) return g.marcadas & 0xffff;
  } catch { /* nada guardado */ }
  return 0;
}

// La carta (tabla de 16) se conserva entre rondas: el jugador guarda su número de carta
// y la sala se la ofrece primero, ya elegida, en cada ronda nueva.
function cartaPreferida() {
  const n = Number.parseInt(guardado.leer('loteria:carta') ?? '0', 10);
  return Number.isInteger(n) && n >= 0 && n < 1000 ? n : 0;
}
function guardarCartaPreferida(n) {
  if (Number.isInteger(n) && n >= 0 && n < 1000) guardado.escribir('loteria:carta', String(n));
}

// El pase de la ronda lo firma la sala para la carta en juego. Con él, al volver (también tras
// recargar la página) el jugador conserva su carta en lugar de entrar como espectador.
function guardarPase(ronda, carta, pase) {
  if (pase) guardado.escribir('loteria:pase', JSON.stringify({ ronda, carta, pase: aHex(pase) }));
}
function parametrosDeVuelta() {
  const carta = cartaPreferida();
  let vuelta = `&c=${carta}`;
  try {
    const g = JSON.parse(guardado.leer('loteria:pase') ?? 'null');
    if (g && Number.isInteger(g.ronda) && g.carta === carta && /^[0-9a-f]{32}$/.test(g.pase)) {
      vuelta += `&r=${g.ronda}&p=${g.pase}`;
    }
  } catch { /* sin pase guardado */ }
  return vuelta;
}

// ---- Conexión ----

let ws = null;
let abrio = false;
let intentos = 0;
let temporizadorReconexion = 0;
let proximoIntento = 0;

function conectar() {
  clearTimeout(temporizadorReconexion);
  proximoIntento = 0;
  abrio = false;
  const protocolo = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${protocolo}://${location.host}/ws?t=${token}${parametrosDeVuelta()}`);
  ws.binaryType = 'arraybuffer';
  ws.addEventListener('open', () => { abrio = true; });
  ws.addEventListener('message', (evento) => {
    const m = decodificar(evento.data);
    if (m) manejar(m);
  });
  ws.addEventListener('close', alCerrar);
}

async function alCerrar() {
  s.conectado = false;
  s.esperandoResultado = false;
  s.eligiendo = false;
  // Un rechazo antes de abrir puede ser sala llena o cuota agotada: la sala lo explica con un 503.
  if (!abrio && await revisarAdmision()) return;
  programarReconexion();
}

/** Pregunta a /ws sin pedir WebSocket. Si la sala responde 503 con su razón, manda a la página de sala llena. */
async function revisarAdmision() {
  try {
    const r = await fetch(`/ws?t=${token}`, { cache: 'no-store' });
    if (r.status !== 503) return false;
    const { razon, reintentarEnMs } = await r.json();
    if (razon !== 'llena' && razon !== 'cuota') return false;
    location.assign(`/sala-llena.html?razon=${encodeURIComponent(razon)}&ms=${Math.max(5000, Number(reintentarEnMs) || 0)}`);
    return true;
  } catch {
    return false;
  }
}

function programarReconexion() {
  const espera = Math.min(15000, 1000 * 2 ** intentos) + Math.random() * 400;
  intentos += 1;
  proximoIntento = Date.now() + espera;
  temporizadorReconexion = setTimeout(conectar, espera);
  congelarCuentas();
  pintarAvisoConexion();
  actualizarBoton();
}

function pintarAvisoConexion() {
  if (s.conectado || !proximoIntento) return;
  const seg = Math.max(1, Math.ceil((proximoIntento - Date.now()) / 1000));
  if (!s.huella) ui.cargando.textContent = `No pudimos conectar con la sala. Reintentamos en ${seg} s.`;
  mostrarAviso(`Sin conexión con la sala. Reintentamos en ${seg} s.`);
}

function mostrarAviso(texto) {
  ui.aviso.hidden = !texto;
  if (texto) ui.avisoTexto.textContent = texto;
}

ui.reintentar.addEventListener('click', () => {
  intentos = 0;
  if (ws && ws.readyState === WebSocket.OPEN) return;
  conectar();
});

/** Sin conexión, las cuentas regresivas no avanzan con datos viejos. */
function congelarCuentas() {
  ui.barraTiempo.style.animationPlayState = 'paused';
  if (s.huella) {
    ui.cantorEtiqueta.textContent = 'Sin conexión con la sala';
    if (s.fase === FASE.ESPERA) ui.cantorNombre.textContent = 'En pausa';
  }
}

// ---- Mensajes de la sala ----

function manejar(m) {
  switch (m.tipo) {
    case T.ESTADO: alEstado(m); break;
    case T.ELECCION:
      s.eligiendo = false;
      guardarPase(s.ronda, (s.base + m.indice) % 1000, m.pase);
      if (m.ok) guardarCartaPreferida((s.base + m.indice) % 1000);
      // La sala responde con la tabla que quedó elegida: si rechazó el cambio, es la anterior.
      if (s.tablas[m.indice] && m.indice !== s.elegida) {
        s.elegida = m.indice;
        s.tabla = s.tablas[m.indice];
        s.marcadas = 0;
        construirTabla();
      }
      pintarEleccion();
      if (m.ok) anunciar(m.indice === 0 ? 'Juegas con tu carta de siempre.' : `Cambiaste a ${textoOpcion(m.indice).toLowerCase()}. Te la guardamos para las siguientes rondas.`);
      else decir('Ya no se puede cambiar de carta.');
      break;
    case T.CARTA: {
      if (m.ronda !== s.ronda || m.indice <= s.cantadas.length) return;
      s.cantadas.push(m.carta);
      s.fase = FASE.CANTANDO;
      s.msEntreCartas = m.msSiguiente || s.msEntreCartas;
      s.limite = Date.now() + m.msSiguiente;
      ui.eleccion.hidden = true;
      anunciar(`Salió ${NOMBRES[m.carta - 1]}. ${gritoPara(m.carta, s.huella) ?? ''}`);
      agacharMusica();
      sonar('carta');
      pintarCantor(true);
      pintarInerte();
      pintarInfo();
      pintarHistorial();
      pintarEspectador();
      actualizarBoton();
      break;
    }
    case T.STATS:
      s.jugadores = m.jugadores;
      s.ganadores = m.ganadores;
      pintarInfo();
      break;
    case T.RESULTADO:
      s.esperandoResultado = false;
      if (m.ok) {
        s.lugar = m.lugar;
        decir(`¡Lotería! Llegaste en el lugar ${m.lugar}.`, true);
        sonar('ganar');
      } else if (m.motivo === MOTIVO.DESCALIFICADO) {
        s.descalificado = true;
        sacudir(ui.botonLoteria);
        sonar('falsa');
        decir('¡Te equivocaste! Quedas fuera de esta ronda; juega la siguiente.');
        anunciar('Falsa lotería: tu carta no estaba llena. Quedas fuera de esta ronda.');
      } else if (m.motivo === MOTIVO.MUY_SEGUIDO) {
        decir('Espera un momento para volver a gritar.');
      } else if (m.motivo === MOTIVO.ESPECTADOR) {
        decir('En esta ronda estás mirando. Juegas en la siguiente.');
      } else {
        decir('Esta ronda ya no está en juego.');
      }
      actualizarBoton();
      break;
    case T.FIN:
      if (m.ronda !== s.ronda) return;
      s.fase = FASE.TERMINADA;
      s.semilla = m.semilla;
      s.ganadores = m.ganadores;
      s.limite = Date.now() + m.msSiguiente;
      verificar();
      pintarTodo(false);
      anunciar(`Terminó la ronda. ${textoResultado()}${s.verificacion?.ok ? ' La baraja no se tocó.' : ''}`);
      break;
  }
}

function alEstado(m) {
  const otraRonda = !s.huella || !igualesBytes(s.huella, m.huella);
  const otraTabla = otraRonda || m.elegida !== s.elegida || m.base !== s.base || m.tablas.length !== s.tablas.length;
  Object.assign(s, {
    ronda: m.ronda, fase: m.fase, figura: m.figura, catalogo: m.catalogo,
    tablas: m.tablas, elegida: m.elegida, base: m.base, tabla: m.tabla, espectador: m.espectador, descalificado: !!m.descalificado,
    cantadas: m.cantadas, huella: m.huella, semilla: m.semilla, lugar: m.lugar,
    jugadores: m.jugadores, ganadores: m.ganadores, limite: Date.now() + m.msSiguiente,
    conectado: true, esperandoResultado: false, eligiendo: false,
  });
  guardarPase(m.ronda, m.numeroCarta, m.pase);
  if (!m.espectador && m.tablas.length) guardarCartaPreferida(m.numeroCarta);
  intentos = 0;
  proximoIntento = 0;
  mostrarAviso(null);
  ui.barraTiempo.style.animationPlayState = 'running';
  if (otraRonda) {
    s.verificacion = null;
    decir('');
  }
  ui.pie.classList.toggle('gano', !!s.lugar && s.fase === FASE.CANTANDO);
  if (otraTabla) {
    s.marcadas = cargarMarcas();
    construirTabla();
  }
  if (s.fase === FASE.TERMINADA && s.semilla) verificar();
  pintarTodo(otraRonda);
  if (otraRonda && s.fase === FASE.ESPERA) anunciar('Nueva ronda. Elige tu carta. Gana quien llene toda su carta.');
}

function verificar() {
  const r = verificarRonda({ semilla: s.semilla, huella: s.huella, cantadas: s.cantadas, catalogo: s.catalogo });
  s.verificacion = { ok: r.ok, huella: aHex(s.huella) };
}

// ---- Tabla, elección y frijoles ----

/** Cartas chicas (tabla, miniaturas, historial): variante compacta con nombre y número legibles. */
function cartaChica(carta) {
  return svgCarta(carta, { compacta: true });
}

// Con teclado la tabla es una sola parada de Tab: las flechas se mueven entre casillas
// y Enter o Espacio ponen el frijol (tabindex itinerante).
let casillaConFoco = 0;

function construirTabla() {
  ui.tabla.replaceChildren();
  casillaConFoco = 0;
  if (s.espectador || !s.tabla.length) {
    ui.tabla.hidden = true;
    return;
  }
  s.tabla.forEach((carta, i) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'casilla';
    boton.tabIndex = i === 0 ? 0 : -1;
    boton.innerHTML = cartaChica(carta);
    boton.addEventListener('click', () => { casillaConFoco = i; tocar(i); });
    boton.addEventListener('keydown', (e) => moverEnTabla(e, i));
    ui.tabla.append(boton);
    if (s.marcadas & (1 << i)) ponerFrijol(boton, i, false);
    etiquetarCasilla(boton, i);
  });
  ui.cargando.hidden = true;
  ui.tabla.hidden = false;
  pintarInerte();
}

function moverEnTabla(e, i) {
  const pasos = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 4, ArrowUp: -4 };
  let destino;
  if (e.key in pasos) destino = i + pasos[e.key];
  else if (e.key === 'Home') destino = i - (i % 4);
  else if (e.key === 'End') destino = i - (i % 4) + 3;
  else return;
  e.preventDefault();
  if (destino < 0 || destino > 15) return;
  const casillas = ui.tabla.children;
  casillas[i].tabIndex = -1;
  casillas[destino].tabIndex = 0;
  casillas[destino].focus();
  casillaConFoco = destino;
}

/** En la espera la tabla es una vista previa y al final ya no se juega: fuera del foco y del lector. */
function pintarInerte() {
  ui.tabla.inert = s.fase !== FASE.CANTANDO;
}

function etiquetarCasilla(boton, i) {
  const marcada = !!(s.marcadas & (1 << i));
  boton.setAttribute('aria-label', `${NOMBRES[s.tabla[i] - 1]}${marcada ? ', con frijol' : ''}`);
  boton.setAttribute('aria-pressed', String(marcada));
}

function ponerFrijol(boton, i, animar) {
  // Cada casilla tiene su propio giro y desacomodo, como si el frijol se pusiera a mano.
  const giro = ((i * 47 + s.ronda * 29) % 70) - 35;
  const x = 50 + (((i * 13 + s.ronda) % 9) - 4);
  const y = 50 + (((i * 7 + s.ronda) % 7) - 3);
  const frijol = document.createElement('span');
  frijol.className = animar ? 'frijol cae' : 'frijol';
  frijol.style.left = `${x}%`;
  frijol.style.top = `${y}%`;
  frijol.innerHTML = `<span class="frijol-sombra"></span><span class="frijol-cuerpo"><span class="frijol-giro" style="transform: rotate(${giro}deg)">${SVG_FRIJOL}</span></span>`;
  boton.append(frijol);
}

function sacudir(elemento) {
  elemento.classList.remove('sacude');
  void elemento.offsetWidth;
  elemento.classList.add('sacude');
}

/** La primera opción es la carta que el jugador conserva; las otras dos son para cambiar. */
function textoOpcion(i) {
  return ['Tu carta', 'Otra', 'Otra más'][i] ?? `Carta ${i + 1}`;
}

// Easter egg: siete toques seguidos en la misma casilla tiran todos los frijoles.
let racha = RACHA_VACIA;

function tirarFrijoles() {
  const frijoles = [...ui.tabla.querySelectorAll('.frijol')];
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  frijoles.forEach((f, k) => {
    if (quieto) { f.remove(); return; }
    // Cada frijol sale disparado en su propia dirección, como si se volteara la carta.
    const angulo = (k * 137.5 + Math.random() * 40) * (Math.PI / 180);
    const distancia = 160 + Math.random() * 140;
    f.style.setProperty('--dx', `${Math.round(Math.cos(angulo) * distancia)}px`);
    f.style.setProperty('--dy', `${Math.round(Math.sin(angulo) * distancia - 120)}px`);
    f.style.setProperty('--giro', `${Math.round(Math.random() * 720 - 360)}deg`);
    f.classList.add('vuela');
    f.addEventListener('animationend', () => f.remove(), { once: true });
  });
  sonar('tirar');
  s.marcadas = 0;
  [...ui.tabla.children].forEach((b, i) => etiquetarCasilla(b, i));
  guardarMarcas();
  pintarHistorial();
  decir('¡Se tiraron todos los frijoles!');
  anunciar('Se tiraron todos los frijoles.');
}

function tocar(i) {
  const boton = ui.tabla.children[i];
  const nombre = NOMBRES[s.tabla[i] - 1];
  const bit = 1 << i;
  if (s.fase === FASE.ESPERA) {
    sacudir(boton);
    sonar('error');
    decir('Espera a que salga la primera carta.');
    return;
  }
  if (s.fase === FASE.TERMINADA) {
    decir('La ronda ya terminó.');
    return;
  }
  const toque = registrarToque(racha, i, performance.now());
  racha = toque.racha;
  if (toque.tirar) {
    tirarFrijoles();
    return;
  }
  // Como en la mesa: el frijol se pone donde uno quiera; equivocarse se paga al gritar.
  if (s.marcadas & bit) {
    s.marcadas &= ~bit;
    boton.querySelector('.frijol')?.remove();
    sonar('quitar');
    decir(`Quitaste el frijol de ${nombre}.`);
  } else {
    s.marcadas |= bit;
    ponerFrijol(boton, i, true);
    sonar('frijol');
    decir('');
  }
  etiquetarCasilla(boton, i);
  guardarMarcas();
  pintarHistorial();
}

function pintarEleccion() {
  const visible = s.conectado && s.fase === FASE.ESPERA && !s.espectador && s.tablas.length === 3;
  ui.eleccion.hidden = !visible;
  if (!visible) return;
  if (ui.eleccionOpciones.children.length !== 3 || ui.eleccionOpciones.dataset.ronda !== String(s.ronda)) {
    ui.eleccionOpciones.dataset.ronda = String(s.ronda);
    ui.eleccionOpciones.replaceChildren(...s.tablas.map((tabla, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'opcion-tabla';
      b.setAttribute('role', 'radio');
      // La tabla elegida se ve abajo a tamaño de juego; aquí basta el número y, para el lector, sus primeras cartas.
      b.setAttribute('aria-label', `${textoOpcion(i)}: empieza con ${tabla.slice(0, 4).map((c) => NOMBRES[c - 1]).join(', ')}`);
      b.textContent = textoOpcion(i);
      b.addEventListener('click', () => elegirTabla(i));
      b.addEventListener('keydown', (e) => moverEleccion(e, i));
      return b;
    }));
  }
  [...ui.eleccionOpciones.children].forEach((b, i) => {
    const elegida = i === s.elegida;
    b.setAttribute('aria-checked', String(elegida));
    b.tabIndex = elegida ? 0 : -1;
    b.setAttribute('aria-busy', String(s.eligiendo));
  });
}

/** Flechas dentro del grupo de radio, como pide el patrón de ARIA. */
function moverEleccion(e, i) {
  const pasos = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
  if (!(e.key in pasos)) return;
  e.preventDefault();
  const siguiente = (i + pasos[e.key] + 3) % 3;
  elegirTabla(siguiente);
  ui.eleccionOpciones.children[siguiente]?.focus();
}

function elegirTabla(i) {
  if (s.fase !== FASE.ESPERA || s.espectador || i === s.elegida) return;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(codificarElijo(s.ronda, i));
  s.eligiendo = true;
  // Se muestra de inmediato; si la sala la rechaza, ELECCION la regresa.
  s.elegida = i;
  s.tabla = s.tablas[i];
  s.marcadas = 0;
  construirTabla();
  pintarEleccion();
}

ui.botonLoteria.addEventListener('click', () => {
  if (s.fase !== FASE.CANTANDO || s.espectador || s.lugar || s.descalificado || s.esperandoResultado) return;
  // La sala decide: gana con la carta llena (16 frijoles y las 16 cartas cantadas);
  // si no, es falsa lotería y el jugador queda fuera de la ronda.
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    decir('No hay conexión con la sala. Espera a que regrese.');
    return;
  }
  ws.send(codificarLoteria(s.ronda, s.marcadas));
  s.esperandoResultado = true;
  actualizarBoton();
  setTimeout(() => {
    if (!s.esperandoResultado) return;
    s.esperandoResultado = false;
    actualizarBoton();
    decir('La sala no respondió. Intenta otra vez.');
  }, 6000);
});

// ---- Historial ----

ui.botonHistorial.addEventListener('click', () => {
  ui.historial.showModal();
  pintarHistorial();
});
ui.historialCerrar.addEventListener('click', () => ui.historial.close());
ui.historial.addEventListener('click', (e) => { if (e.target === ui.historial) ui.historial.close(); });

function pintarHistorial() {
  ui.contadorCantadas.textContent = String(s.cantadas.length);
  if (!ui.historial.open) return;
  const mias = new Set(s.tabla);
  ui.historialVacio.hidden = s.cantadas.length > 0;
  ui.historialLista.replaceChildren(...s.cantadas.map((carta, i) => ({ carta, orden: i + 1 })).reverse().map(({ carta, orden }) => {
    const li = document.createElement('li');
    const mia = mias.has(carta) && !s.espectador;
    if (mia) li.className = 'mia';
    li.innerHTML = `<span class="orden">${orden}.</span>${cartaChica(carta)}<span>${NOMBRES[carta - 1]}</span>${mia ? '<span class="etiqueta-mia">En tu carta</span>' : ''}`;
    return li;
  }));
}

// ---- Pintar ----

// El pie muestra un solo mensaje. Durante la gracia final el aviso urgente es el mensaje de base,
// y cualquier otro mensaje lo reemplaza unos segundos antes de que el aviso regrese.
let mensajeTemporalHasta = 0;

function decir(texto, gano = false) {
  mensajeTemporalHasta = texto && enGracia() ? Date.now() + 3000 : 0;
  ui.mensaje.textContent = texto;
  ui.mensaje.classList.toggle('gano', gano);
  ui.mensaje.classList.remove('urgente');
  ui.pie.classList.toggle('gano', gano);
  if (!texto) pintarMensajeGracia();
}

function pintarMensajeGracia() {
  const urgente = enGracia() && !s.lugar && !s.espectador && s.conectado;
  if (!urgente) {
    if (ui.mensaje.classList.contains('urgente')) {
      ui.mensaje.classList.remove('urgente');
      ui.mensaje.textContent = '';
    }
    return;
  }
  if (Date.now() < mensajeTemporalHasta) return;
  const seg = segundosRestantes();
  const texto = seg > 0 ? `¡Última carta! Tienes ${seg} s para gritar` : 'La ronda está por cerrar';
  if (!ui.mensaje.classList.contains('urgente')) {
    ui.mensaje.classList.add('urgente');
    // La raya de tiempo debajo del aviso sigue el tiempo real de la gracia aunque el aviso se haya interrumpido.
    const total = Math.max(1000, s.msEntreCartas);
    const transcurrido = Math.min(total, Math.max(0, total - (s.limite - Date.now())));
    ui.mensaje.style.setProperty('--gracia-total', `${total}ms`);
    ui.mensaje.style.setProperty('--gracia-transcurrido', `-${transcurrido}ms`);
  }
  if (ui.mensaje.textContent !== texto) ui.mensaje.textContent = texto;
}

function anunciar(texto) {
  ui.anuncio.textContent = texto;
}

function contarFrijoles(mascara) {
  let n = 0;
  for (let m = mascara; m; m &= m - 1) n += 1;
  return n;
}

function textoResultado() {
  if (s.lugar) return `¡Ganaste! Llegaste en el lugar ${s.lugar} de ${s.ganadores}.`;
  if (s.ganadores === 0) return 'Nadie llenó su carta esta vez.';
  return `Ganaron ${s.ganadores} ${s.ganadores === 1 ? 'persona' : 'personas'}.${s.espectador ? '' : ' Esta vez no te tocó.'}`;
}

function segundosRestantes() {
  return Math.max(0, Math.ceil((s.limite - Date.now()) / 1000));
}

function pintarTodo(otraRonda) {
  pintarInfo();
  pintarCantor(otraRonda || s.fase === FASE.CANTANDO);
  pintarEleccion();
  pintarEspectador();
  pintarHistorial();
  pintarFin();
  actualizarBoton();
}

function pintarApodo() {
  // El apodo vive en el pie durante la espera, donde todavía no hay mensajes del juego;
  // así no compite con la cuenta regresiva ni con la elección de tabla.
  ui.apodoLinea.hidden = !s.conectado || s.fase !== FASE.ESPERA || s.espectador;
}

function pintarInfo() {
  const gente = `${s.jugadores} ${s.jugadores === 1 ? 'jugador' : 'jugadores'}`;
  const ganadores = s.fase === FASE.CANTANDO && s.ganadores > 0 ? ` · ${s.ganadores} ${s.ganadores === 1 ? 'ganador' : 'ganadores'}` : '';
  const marcadas = s.fase === FASE.CANTANDO && !s.espectador ? ` · ${contarFrijoles(s.marcadas)} de 16 frijoles` : '';
  ui.infoSala.textContent = `Ronda ${s.ronda} · ${gente}${ganadores}${marcadas}`;
  pintarApodo();
}

let ultimoSegundo = -1;

function pintarCantor(animar) {
  ultimoSegundo = -1;
  if (s.fase === FASE.ESPERA) {
    ui.cantorEtiqueta.textContent = 'Pura llena';
    ui.cantorVerso.textContent = 'Gana quien llene toda su carta.';
    pintarCuentaEspera();
    reiniciarBarra(s.limite - Date.now());
    return;
  }
  const ultima = s.cantadas[s.cantadas.length - 1];
  if (!ultima) return;
  ui.cantorCarta.innerHTML = svgCarta(ultima);
  if (animar && s.fase === FASE.CANTANDO) {
    ui.cantorCarta.classList.remove('entra');
    void ui.cantorCarta.offsetWidth;
    ui.cantorCarta.classList.add('entra');
  }
  ui.cantorNombre.textContent = NOMBRES[ultima - 1];
  ui.cantorVerso.textContent = gritoPara(ultima, s.huella) ?? '';
  if (s.fase === FASE.CANTANDO) {
    // Tras la última carta la sala da unos segundos de gracia para gritar: la barra los cuenta.
    if (enGracia()) pintarCuentaGracia();
    else ui.cantorEtiqueta.textContent = `Salió, carta ${s.cantadas.length} de ${s.catalogo}:`;
    reiniciarBarra(s.limite - Date.now());
  } else {
    ui.cantorEtiqueta.textContent = `Última carta, ${s.cantadas.length} de ${s.catalogo}:`;
    reiniciarBarra(0);
  }
}

function enGracia() {
  return s.fase === FASE.CANTANDO && s.cantadas.length >= s.catalogo;
}

function pintarCuentaGracia() {
  ui.cantorEtiqueta.textContent = `Última carta, ${s.cantadas.length} de ${s.catalogo}:`;
  pintarMensajeGracia();
}

function pintarCuentaEspera() {
  const seg = segundosRestantes();
  if (seg === ultimoSegundo) return;
  ultimoSegundo = seg;
  ui.cantorCarta.innerHTML = svgReverso(String(seg));
  ui.cantorNombre.textContent = seg > 0 ? `Empieza en ${seg} s` : 'Ya casi';
}

function reiniciarBarra(ms) {
  const barra = ui.barraTiempo;
  barra.style.animation = 'none';
  void barra.offsetWidth;
  barra.style.animation = ms > 0 ? `avance ${Math.round(ms)}ms linear forwards` : 'none';
  barra.style.animationPlayState = 'running';
}

function pintarEspectador() {
  // Al terminar, el panel de fin ya dice cuándo empieza la siguiente ronda: la caja se va para no repetirlo.
  ui.espectador.hidden = !s.espectador || s.fase !== FASE.CANTANDO;
  if (ui.espectador.hidden) return;
  ui.cargando.hidden = true;
  const recientes = s.cantadas.slice(-4).reverse();
  if (ui.espectadorCartas.dataset.ultima !== String(s.cantadas.length)) {
    ui.espectadorCartas.dataset.ultima = String(s.cantadas.length);
    ui.espectadorCartas.replaceChildren(...recientes.map((carta) => {
      const li = document.createElement('li');
      li.innerHTML = `${cartaChica(carta)}<span class="solo-lector">${NOMBRES[carta - 1]}</span>`;
      return li;
    }));
  }
  const ms = msHastaSiguienteRonda({
    catalogo: s.catalogo,
    cantadas: s.cantadas.length,
    msEntreCartas: s.msEntreCartas,
    msParaSiguienteCarta: Math.max(0, s.limite - Date.now()),
  });
  ui.espectadorCuenta.textContent = `Faltan ${s.catalogo - s.cantadas.length} cartas: tu ronda empieza en unos ${duracionAproximada(ms)}.`;
}

function pintarFin() {
  const terminada = s.fase === FASE.TERMINADA;
  ui.fin.hidden = !terminada;
  // El pie conserva su lugar (invisible) para que la tabla no cambie de tamaño al terminar.
  ui.pie.classList.toggle('oculto', terminada);
  ui.pie.inert = terminada;
  pintarInerte();
  if (!terminada) return;
  ui.finTitulo.textContent = `Terminó la ronda ${s.ronda}`;
  ui.finResultado.textContent = textoResultado();
  const v = s.verificacion;
  if (v) {
    const enlace = `/verificar.html?clave=${encodeURIComponent(claveDeRonda(s.ronda, v.huella))}`;
    const sello = v.ok
      ? '<svg class="sello" viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="13" fill="#2F4F8F"/><path d="M8 14.5 L12.5 19 L20.5 9.5" fill="none" stroke="#F3E7CB" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg class="sello" viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="13" fill="#B8322A"/><path d="M9 9 L19 19 M19 9 L9 19" stroke="#F3E7CB" stroke-width="3" stroke-linecap="round"/></svg>';
    const texto = v.ok
      ? `<p><b>La baraja no se tocó.</b> Este dispositivo comprobó que las cartas salieron en el orden sorteado antes de empezar. <a href="${enlace}">¿Cómo lo sabemos?</a></p>`
      : `<p><b>No pudimos confirmar el orden de la baraja.</b> Las cartas que salieron no coinciden con el sorteo del inicio. <a href="${enlace}">Ver detalles</a></p>`;
    ui.finVerificacion.innerHTML = `${sello}<div>${texto}</div>`;
  }
  pintarCuentaFin();
}

function pintarCuentaFin() {
  const seg = segundosRestantes();
  ui.finSiguiente.textContent = seg > 0 ? `La siguiente ronda empieza en ${seg} s.` : 'La siguiente ronda está por empezar.';
}

function actualizarBoton() {
  const { texto, deshabilitado } = textoBoton(s);
  ui.botonLoteria.textContent = texto;
  ui.botonLoteria.disabled = deshabilitado;
  // Al ganar, el aviso grana ocupa el lugar del botón: un solo elemento dice el resultado.
  ui.botonLoteria.hidden = !!s.lugar && s.fase === FASE.CANTANDO;
  pintarInfo();
}

// Un solo reloj para las cuentas regresivas. Sin conexión no avanza.
setInterval(() => {
  if (!s.conectado) { pintarAvisoConexion(); return; }
  if (s.fase === FASE.ESPERA) pintarCuentaEspera();
  else if (s.fase === FASE.TERMINADA) { pintarCuentaFin(); pintarEspectador(); }
  else {
    if (enGracia()) pintarMensajeGracia();
    if (s.espectador) pintarEspectador();
  }
}, 250);

conectar();
