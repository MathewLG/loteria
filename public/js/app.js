import {
  T, FASE, MOTIVO, decodificar, codificarLoteria, cumpleFigura, mascaraCantadas,
} from './protocolo.js';
import { aHex, barajar, igualesBytes, sha256 } from './baraja.js';
import { NOMBRES, SVG_FRIJOL, svgCarta, svgReverso } from './cartas.js';

const $ = (id) => document.getElementById(id);
const ui = {
  infoSala: $('info-sala'),
  aviso: $('aviso-conexion'),
  avisoTexto: $('aviso-texto'),
  reintentar: $('boton-reintentar'),
  cantorCarta: $('cantor-carta'),
  cantorEtiqueta: $('cantor-etiqueta'),
  cantorNombre: $('cantor-nombre'),
  barraTiempo: $('barra-tiempo'),
  figura: $('cantor-figura'),
  conteoFrijoles: $('conteo-frijoles'),
  anuncio: $('anuncio'),
  cargando: $('tabla-cargando'),
  tabla: $('tabla'),
  pie: $('pie'),
  mensaje: $('mensaje'),
  botonLoteria: $('boton-loteria'),
  fin: $('panel-fin'),
  finTitulo: $('fin-titulo'),
  finResultado: $('fin-resultado'),
  finVerificacion: $('fin-verificacion'),
  finSiguiente: $('fin-siguiente'),
};

const s = {
  conectado: false,
  ronda: 0,
  fase: -1,
  figura: 0,
  catalogo: 16,
  tabla: [],
  cantadas: [],
  huella: null,
  semilla: null,
  marcadas: 0,
  lugar: 0,
  jugadores: 0,
  ganadores: 0,
  limite: 0,
  verificacion: null,
  esperandoResultado: false,
};

// ---- Identidad del jugador: un token al azar guardado en este navegador ----

function nuevoToken() {
  return aHex(crypto.getRandomValues(new Uint8Array(16)));
}

function obtenerToken() {
  try {
    let t = localStorage.getItem('loteria:token');
    if (!/^[0-9a-f]{32}$/.test(t ?? '')) {
      t = nuevoToken();
      localStorage.setItem('loteria:token', t);
    }
    return t;
  } catch {
    return nuevoToken();
  }
}
const token = obtenerToken();

// Los frijoles sobreviven a recargar la página, pero solo dentro de la misma ronda.
function guardarMarcas() {
  try {
    localStorage.setItem('loteria:marcas', JSON.stringify({ huella: aHex(s.huella), marcadas: s.marcadas }));
  } catch { /* sin almacenamiento: los frijoles viven solo en memoria */ }
}

function cargarMarcas() {
  try {
    const guardado = JSON.parse(localStorage.getItem('loteria:marcas') ?? 'null');
    if (guardado && guardado.huella === aHex(s.huella)) return guardado.marcadas & 0xffff;
  } catch { /* nada guardado */ }
  return 0;
}

// ---- Conexión ----

let ws = null;
let intentos = 0;
let temporizadorReconexion = 0;
let proximoIntento = 0;

function conectar() {
  clearTimeout(temporizadorReconexion);
  proximoIntento = 0;
  if (s.conectado || !s.huella) mostrarAviso(null);
  const protocolo = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${protocolo}://${location.host}/ws?t=${token}`);
  ws.binaryType = 'arraybuffer';
  ws.addEventListener('message', (evento) => {
    const m = decodificar(evento.data);
    if (m) manejar(m);
  });
  ws.addEventListener('close', programarReconexion);
}

function programarReconexion() {
  s.conectado = false;
  s.esperandoResultado = false;
  const espera = Math.min(15000, 1000 * 2 ** intentos) + Math.random() * 400;
  intentos += 1;
  proximoIntento = Date.now() + espera;
  temporizadorReconexion = setTimeout(conectar, espera);
  pintarAvisoConexion();
  actualizarBoton();
}

function pintarAvisoConexion() {
  if (s.conectado || !proximoIntento) return;
  const seg = Math.max(1, Math.ceil((proximoIntento - Date.now()) / 1000));
  if (!s.huella) {
    ui.cargando.textContent = `No pudimos conectar con la sala. Reintentamos en ${seg} s.`;
  }
  mostrarAviso(`Se perdió la conexión con la sala. Reintentamos en ${seg} s.`);
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

// ---- Mensajes de la sala ----

function manejar(m) {
  switch (m.tipo) {
    case T.ESTADO: {
      const otraRonda = !s.huella || !igualesBytes(s.huella, m.huella);
      Object.assign(s, {
        ronda: m.ronda, fase: m.fase, figura: m.figura, catalogo: m.catalogo, tabla: m.tabla,
        cantadas: m.cantadas, huella: m.huella, semilla: m.semilla, lugar: m.lugar,
        jugadores: m.jugadores, ganadores: m.ganadores, limite: Date.now() + m.msSiguiente,
        conectado: true, esperandoResultado: false,
      });
      intentos = 0;
      proximoIntento = 0;
      mostrarAviso(null);
      if (otraRonda) {
        s.marcadas = cargarMarcas();
        s.verificacion = null;
        construirTabla();
        decir('');
      }
      if (s.fase === FASE.TERMINADA && s.semilla) verificar();
      pintarTodo(otraRonda);
      if (otraRonda && s.fase === FASE.ESPERA) anunciar('Nueva ronda. Pura llena: gana quien llene toda su tabla.');
      break;
    }
    case T.CARTA: {
      if (m.ronda !== s.ronda || m.indice <= s.cantadas.length) return;
      s.cantadas.push(m.carta);
      s.fase = FASE.CANTANDO;
      s.limite = Date.now() + m.msSiguiente;
      anunciar(`Salió ${NOMBRES[m.carta - 1]}.`);
      pintarCantor(true);
      pintarInfo();
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
      } else if (m.motivo === MOTIVO.INCOMPLETA) {
        decir('La sala no ve tu tabla llena. Revisa tus frijoles.');
      } else if (m.motivo === MOTIVO.MUY_SEGUIDO) {
        decir('Espera la siguiente carta para volver a gritar.');
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
      anunciar(`Terminó la ronda. ${textoResultado()}`);
      break;
  }
}

/** Comprueba que la semilla revelada da la huella publicada y exactamente las cartas que salieron. */
function verificar() {
  const huellaOk = igualesBytes(sha256(s.semilla), s.huella);
  const baraja = barajar(s.semilla, s.catalogo);
  const ordenOk = s.cantadas.every((carta, i) => baraja[i] === carta);
  s.verificacion = { ok: huellaOk && ordenOk, huella: aHex(s.huella) };
}

// ---- Tabla y frijoles ----

function construirTabla() {
  ui.tabla.replaceChildren();
  s.tabla.forEach((carta, i) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'casilla';
    boton.innerHTML = svgCarta(carta);
    boton.addEventListener('click', () => tocar(i));
    ui.tabla.append(boton);
    if (s.marcadas & (1 << i)) ponerFrijol(boton, i, false);
    etiquetarCasilla(boton, i);
  });
  ui.cargando.hidden = true;
  ui.tabla.hidden = false;
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

function tocar(i) {
  const boton = ui.tabla.children[i];
  const nombre = NOMBRES[s.tabla[i] - 1];
  const bit = 1 << i;
  if (s.fase === FASE.ESPERA) {
    sacudir(boton);
    decir('Espera a que salga la primera carta.');
    return;
  }
  if (s.fase === FASE.TERMINADA) {
    decir('La ronda ya terminó.');
    return;
  }
  if (s.marcadas & bit) {
    s.marcadas &= ~bit;
    boton.querySelector('.frijol')?.remove();
    decir(`Quitaste el frijol de ${nombre}.`);
  } else if (!s.cantadas.includes(s.tabla[i])) {
    sacudir(boton);
    decir(`Todavía no sale ${nombre}.`);
    return;
  } else {
    s.marcadas |= bit;
    ponerFrijol(boton, i, true);
    decir('');
  }
  etiquetarCasilla(boton, i);
  guardarMarcas();
  pintarFigura();
}

ui.botonLoteria.addEventListener('click', () => {
  if (s.fase !== FASE.CANTANDO) {
    decir(s.fase === FASE.ESPERA ? 'La ronda todavía no empieza.' : 'Esta ronda ya terminó.');
    return;
  }
  const validas = s.marcadas & mascaraCantadas(s.tabla, s.cantadas);
  if (!cumpleFigura(validas, s.figura)) {
    sacudir(ui.botonLoteria);
    const faltan = 16 - contarFrijoles(validas);
    decir(`Todavía no llenas tu tabla: ${faltan === 1 ? 'te falta 1 frijol' : `te faltan ${faltan} frijoles`}.`);
    return;
  }
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    decir('No hay conexión con la sala. Espera a que regrese.');
    return;
  }
  ws.send(codificarLoteria(s.ronda, validas));
  s.esperandoResultado = true;
  actualizarBoton();
  setTimeout(() => {
    if (!s.esperandoResultado) return;
    s.esperandoResultado = false;
    actualizarBoton();
    decir('La sala no respondió. Intenta otra vez.');
  }, 6000);
});

// ---- Pintar ----

function decir(texto, gano = false) {
  ui.mensaje.textContent = texto;
  ui.mensaje.classList.toggle('gano', gano);
}

function anunciar(texto) {
  ui.anuncio.textContent = texto;
}

function textoResultado() {
  if (s.lugar) return `¡Ganaste! Llegaste en el lugar ${s.lugar} de ${s.ganadores}.`;
  if (s.ganadores === 0) return 'Nadie llenó su tabla esta vez.';
  return `Ganaron ${s.ganadores} ${s.ganadores === 1 ? 'persona' : 'personas'}. Esta vez no te tocó.`;
}

function segundosRestantes() {
  return Math.max(0, Math.ceil((s.limite - Date.now()) / 1000));
}

function pintarTodo(otraRonda) {
  pintarInfo();
  pintarCantor(otraRonda || s.fase === FASE.CANTANDO);
  pintarFigura();
  pintarFin();
  actualizarBoton();
}

function pintarInfo() {
  const gente = `${s.jugadores} ${s.jugadores === 1 ? 'jugador' : 'jugadores'}`;
  const ganadores = s.fase === FASE.CANTANDO && s.ganadores > 0 ? ` · ${s.ganadores} ${s.ganadores === 1 ? 'ganador' : 'ganadores'}` : '';
  ui.infoSala.textContent = `Ronda ${s.ronda} · ${gente}${ganadores}`;
}

let ultimoSegundo = -1;

function pintarCantor(animar) {
  ultimoSegundo = -1;
  if (s.fase === FASE.ESPERA) {
    ui.cantorEtiqueta.textContent = `Ronda ${s.ronda}`;
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
  if (s.fase === FASE.CANTANDO) {
    ui.cantorEtiqueta.textContent = `Salió, carta ${s.cantadas.length} de ${s.catalogo}:`;
    ui.cantorNombre.textContent = NOMBRES[ultima - 1];
    reiniciarBarra(s.cantadas.length < s.catalogo ? s.limite - Date.now() : 0);
  } else {
    ui.cantorEtiqueta.textContent = `Última carta, ${s.cantadas.length} de ${s.catalogo}:`;
    ui.cantorNombre.textContent = NOMBRES[ultima - 1];
    reiniciarBarra(0);
  }
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
}

function contarFrijoles(mascara) {
  let n = 0;
  for (let m = mascara; m; m &= m - 1) n += 1;
  return n;
}

function pintarFigura() {
  ui.figura.hidden = false;
  const n = contarFrijoles(s.marcadas);
  ui.conteoFrijoles.textContent = n === 0
    ? 'Gana quien llene toda su tabla.'
    : `Llevas ${n} de 16 frijoles.`;
}

function pintarFin() {
  const terminada = s.fase === FASE.TERMINADA;
  ui.fin.hidden = !terminada;
  ui.pie.hidden = terminada;
  if (!terminada) return;
  ui.finTitulo.textContent = `Terminó la ronda ${s.ronda}`;
  ui.finResultado.textContent = textoResultado();
  const v = s.verificacion;
  if (v) {
    const sello = v.ok
      ? '<svg class="sello" viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="13" fill="#2F4F8F"/><path d="M8 14.5 L12.5 19 L20.5 9.5" fill="none" stroke="#F3E7CB" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg class="sello" viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="13" fill="#B8322A"/><path d="M9 9 L19 19 M19 9 L9 19" stroke="#F3E7CB" stroke-width="3" stroke-linecap="round"/></svg>';
    const texto = v.ok
      ? '<p><b>Baraja verificada en tu dispositivo.</b> Antes de cantar, la sala publicó esta huella. Con la semilla que reveló al final, tu dispositivo volvió a revolver las cartas y salió exactamente el mismo orden.</p>'
      : '<p><b>La verificación no coincide.</b> La semilla revelada no produce las cartas que salieron.</p>';
    ui.finVerificacion.innerHTML = `${sello}<div>${texto}<p class="huella">${v.huella.slice(0, 32)}…</p></div>`;
  }
  pintarCuentaFin();
}

function pintarCuentaFin() {
  const seg = segundosRestantes();
  ui.finSiguiente.textContent = seg > 0 ? `La siguiente ronda empieza en ${seg} s.` : 'La siguiente ronda está por empezar.';
}

function actualizarBoton() {
  const b = ui.botonLoteria;
  if (s.lugar) {
    b.disabled = true;
    b.textContent = `Ganaste: lugar ${s.lugar}`;
  } else if (s.esperandoResultado) {
    b.disabled = true;
    b.textContent = 'Revisando tu tabla…';
  } else {
    b.disabled = !s.conectado || s.fase !== FASE.CANTANDO;
    b.textContent = '¡Lotería!';
  }
}

// Un solo reloj para las cuentas regresivas.
setInterval(() => {
  if (!s.conectado) { pintarAvisoConexion(); return; }
  if (s.fase === FASE.ESPERA) pintarCuentaEspera();
  else if (s.fase === FASE.TERMINADA) pintarCuentaFin();
}, 250);

conectar();
