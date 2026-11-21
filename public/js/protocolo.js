// Protocolo binario entre la sala y los jugadores. Little-endian.
// Lo importan el servidor, el navegador y los bots.

export const T = {
  ESTADO: 0x10,    // sala → jugador: foto completa (al conectar y al empezar cada ronda)
  CARTA: 0x11,     // sala → todos: carta cantada, 6 bytes
  STATS: 0x12,     // sala → todos: jugadores y ganadores
  RESULTADO: 0x13, // sala → jugador: respuesta a su "¡Lotería!"
  FIN: 0x14,       // sala → todos: fin de ronda y semilla revelada
  LOTERIA: 0x20,   // jugador → sala: reclamo con su tabla marcada
};

export const FASE = { ESPERA: 0, CANTANDO: 1, TERMINADA: 2 };

export const MOTIVO = { OK: 0, INCOMPLETA: 1, YA_GANASTE: 2, FUERA_DE_RONDA: 3, MUY_SEGUIDO: 4, MALFORMADO: 5 };

/** Posiciones de la tabla: 0 1 2 3 / 4 5 6 7 / 8 9 10 11 / 12 13 14 15.
 *  El juego es "pura llena": solo gana quien llena toda su tabla.
 *  El campo figura se queda en el protocolo por si algún día hay salas con otras figuras. */
export const FIGURAS = [
  { nombre: 'llena', descripcion: 'Gana quien llene toda su tabla', patrones: [0xffff] },
];

export function cumpleFigura(marcadas, figura) {
  const f = FIGURAS[figura];
  return !!f && f.patrones.some((p) => (marcadas & p) === p);
}

/** Máscara de las casillas de una tabla cuya carta ya salió. */
export function mascaraCantadas(tabla, cantadas) {
  const salieron = new Set(cantadas);
  let m = 0;
  tabla.forEach((carta, i) => { if (salieron.has(carta)) m |= 1 << i; });
  return m;
}

// ---- Codificación ----

export function codificarEstado(e) {
  const conSemilla = e.fase === FASE.TERMINADA && e.semilla;
  const largo = 22 + 32 + 16 + e.cantadas.length + (conSemilla ? 32 : 0);
  const b = new Uint8Array(largo);
  const v = new DataView(b.buffer);
  v.setUint8(0, T.ESTADO);
  v.setUint16(1, e.ronda, true);
  v.setUint8(3, e.fase);
  v.setUint8(4, e.figura);
  v.setUint8(5, e.catalogo);
  v.setUint8(6, e.cantadas.length);
  v.setUint32(7, e.msSiguiente, true);
  v.setUint32(11, e.jugadores, true);
  v.setUint32(15, e.ganadores, true);
  v.setUint16(19, e.lugar, true);
  v.setUint8(21, conSemilla ? 1 : 0);
  let p = 22;
  b.set(e.huella, p); p += 32;
  b.set(e.tabla, p); p += 16;
  b.set(e.cantadas, p); p += e.cantadas.length;
  if (conSemilla) b.set(e.semilla, p);
  return b;
}

export function codificarCarta(ronda, indice, carta, msSiguiente) {
  const b = new Uint8Array(6);
  const v = new DataView(b.buffer);
  v.setUint8(0, T.CARTA);
  v.setUint16(1, ronda, true);
  v.setUint8(3, indice);
  v.setUint8(4, carta);
  v.setUint8(5, Math.min(255, Math.round(msSiguiente / 100)));
  return b;
}

export function codificarStats(jugadores, ganadores) {
  const b = new Uint8Array(9);
  const v = new DataView(b.buffer);
  v.setUint8(0, T.STATS);
  v.setUint32(1, jugadores, true);
  v.setUint32(5, ganadores, true);
  return b;
}

export function codificarResultado(ok, motivo, lugar) {
  const b = new Uint8Array(5);
  const v = new DataView(b.buffer);
  v.setUint8(0, T.RESULTADO);
  v.setUint8(1, ok ? 1 : 0);
  v.setUint8(2, motivo);
  v.setUint16(3, lugar, true);
  return b;
}

export function codificarFin(ronda, ganadores, semilla, msSiguiente) {
  const b = new Uint8Array(43);
  const v = new DataView(b.buffer);
  v.setUint8(0, T.FIN);
  v.setUint16(1, ronda, true);
  v.setUint32(3, ganadores, true);
  v.setUint32(7, msSiguiente, true);
  b.set(semilla, 11);
  return b;
}

export function codificarLoteria(ronda, marcadas) {
  const b = new Uint8Array(5);
  const v = new DataView(b.buffer);
  v.setUint8(0, T.LOTERIA);
  v.setUint16(1, ronda, true);
  v.setUint16(3, marcadas, true);
  return b;
}

// ---- Decodificación ----

/** Devuelve el mensaje como objeto, o null si viene mal formado. */
export function decodificar(datos) {
  const b = datos instanceof Uint8Array ? datos : new Uint8Array(datos);
  if (b.length < 1) return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const tipo = b[0];
  try {
    switch (tipo) {
      case T.ESTADO: {
        const n = v.getUint8(6);
        const conSemilla = v.getUint8(21) === 1;
        const esperado = 22 + 32 + 16 + n + (conSemilla ? 32 : 0);
        if (b.length !== esperado) return null;
        let p = 22;
        const huella = b.slice(p, p + 32); p += 32;
        const tabla = Array.from(b.slice(p, p + 16)); p += 16;
        const cantadas = Array.from(b.slice(p, p + n)); p += n;
        const semilla = conSemilla ? b.slice(p, p + 32) : null;
        return {
          tipo, ronda: v.getUint16(1, true), fase: v.getUint8(3), figura: v.getUint8(4),
          catalogo: v.getUint8(5), msSiguiente: v.getUint32(7, true), jugadores: v.getUint32(11, true),
          ganadores: v.getUint32(15, true), lugar: v.getUint16(19, true), huella, tabla, cantadas, semilla,
        };
      }
      case T.CARTA:
        if (b.length !== 6) return null;
        return { tipo, ronda: v.getUint16(1, true), indice: b[3], carta: b[4], msSiguiente: b[5] * 100 };
      case T.STATS:
        if (b.length !== 9) return null;
        return { tipo, jugadores: v.getUint32(1, true), ganadores: v.getUint32(5, true) };
      case T.RESULTADO:
        if (b.length !== 5) return null;
        return { tipo, ok: b[1] === 1, motivo: b[2], lugar: v.getUint16(3, true) };
      case T.FIN:
        if (b.length !== 43) return null;
        return {
          tipo, ronda: v.getUint16(1, true), ganadores: v.getUint32(3, true),
          msSiguiente: v.getUint32(7, true), semilla: b.slice(11, 43),
        };
      case T.LOTERIA:
        if (b.length !== 5) return null;
        return { tipo, ronda: v.getUint16(1, true), marcadas: v.getUint16(3, true) };
      default:
        return null;
    }
  } catch {
    return null;
  }
}
