// Protocolo binario entre la sala y los jugadores. Little-endian.
// Lo importan el servidor, el navegador y los bots.

export const T = {
  ESTADO: 0x10,    // sala → jugador: foto completa (al conectar y al empezar cada ronda)
  CARTA: 0x11,     // sala → todos: carta cantada, 6 bytes
  STATS: 0x12,     // sala → todos: jugadores y ganadores
  RESULTADO: 0x13, // sala → jugador: respuesta a su "¡Lotería!"
  FIN: 0x14,       // sala → todos: fin de ronda y semilla revelada
  ELECCION: 0x15,  // sala → jugador: respuesta a ELIJO, 3 bytes
  LOTERIA: 0x20,   // jugador → sala: reclamo con su tabla marcada
  ELIJO: 0x21,     // jugador → sala: elige una de las tablas ofrecidas, 4 bytes
};

export const FASE = { ESPERA: 0, CANTANDO: 1, TERMINADA: 2 };

export const MOTIVO = { OK: 0, INCOMPLETA: 1, YA_GANASTE: 2, FUERA_DE_RONDA: 3, MUY_SEGUIDO: 4, MALFORMADO: 5, ESPECTADOR: 6 };

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

/*
 * ESTADO, sala → jugador. Little-endian.
 *
 *  byte  campo
 *  0     tipo (0x10)
 *  1-2   ronda (u16)
 *  3     fase (0 espera, 1 cantando, 2 terminada)
 *  4     figura (0 = llena)
 *  5     catálogo: cartas en la baraja (54)
 *  6     n: cartas cantadas hasta ahora
 *  7-10  ms hasta el siguiente evento (u32)
 *  11-14 jugadores conectados (u32)
 *  15-18 ganadores de la ronda (u32)
 *  19-20 tu lugar, 0 si no has ganado (u16)
 *  21    banderas: bit 0 = trae semilla, bit 1 = eres espectador
 *  22    índice de la tabla elegida (0..2)
 *  23    t: tablas que siguen. 3 en la espera (las ofrecidas, en orden de índice),
 *        1 al cantar o terminar (solo la elegida), 0 si eres espectador
 *  24-55 huella SHA-256 de la semilla (32)
 *  56    t × 16 bytes: tablas, una carta por byte, en orden de casilla
 *  ...   n bytes: cartas cantadas en orden
 *  ...   32 bytes: semilla, solo si la bandera 0 está prendida (fase terminada)
 */
export const BANDERA = { SEMILLA: 1, ESPECTADOR: 2 };
const CABECERA_ESTADO = 24;

export function codificarEstado(e) {
  const conSemilla = e.fase === FASE.TERMINADA && e.semilla;
  const tablas = e.tablas ?? [];
  const largo = CABECERA_ESTADO + 32 + tablas.length * 16 + e.cantadas.length + (conSemilla ? 32 : 0);
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
  v.setUint8(21, (conSemilla ? BANDERA.SEMILLA : 0) | (e.espectador ? BANDERA.ESPECTADOR : 0));
  v.setUint8(22, e.elegida ?? 0);
  v.setUint8(23, tablas.length);
  let p = CABECERA_ESTADO;
  b.set(e.huella, p); p += 32;
  for (const t of tablas) { b.set(t, p); p += 16; }
  b.set(e.cantadas, p); p += e.cantadas.length;
  if (conSemilla) b.set(e.semilla, p);
  return b;
}

/** ELECCION, sala → jugador: [0x15, ok (1/0), índice que quedó elegido]. */
export function codificarEleccion(ok, indice) {
  return new Uint8Array([T.ELECCION, ok ? 1 : 0, indice]);
}

/** ELIJO, jugador → sala: [0x21, ronda u16, índice 0..2]. */
export function codificarElijo(ronda, indice) {
  const b = new Uint8Array(4);
  const v = new DataView(b.buffer);
  v.setUint8(0, T.ELIJO);
  v.setUint16(1, ronda, true);
  v.setUint8(3, indice);
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
        if (b.length < CABECERA_ESTADO + 32) return null;
        const n = v.getUint8(6);
        const banderas = v.getUint8(21);
        const conSemilla = (banderas & BANDERA.SEMILLA) !== 0;
        const elegida = v.getUint8(22);
        const t = v.getUint8(23);
        const esperado = CABECERA_ESTADO + 32 + t * 16 + n + (conSemilla ? 32 : 0);
        if (b.length !== esperado || t > 3) return null;
        let p = CABECERA_ESTADO;
        const huella = b.slice(p, p + 32); p += 32;
        const tablas = [];
        for (let k = 0; k < t; k++) { tablas.push(Array.from(b.slice(p, p + 16))); p += 16; }
        const cantadas = Array.from(b.slice(p, p + n)); p += n;
        const semilla = conSemilla ? b.slice(p, p + 32) : null;
        // `tabla` es la tabla con la que juegas: la elegida entre las ofrecidas, o la única que llega.
        const tabla = t === 3 ? tablas[elegida] ?? tablas[0] : tablas[0] ?? [];
        return {
          tipo, ronda: v.getUint16(1, true), fase: v.getUint8(3), figura: v.getUint8(4),
          catalogo: v.getUint8(5), msSiguiente: v.getUint32(7, true), jugadores: v.getUint32(11, true),
          ganadores: v.getUint32(15, true), lugar: v.getUint16(19, true),
          espectador: (banderas & BANDERA.ESPECTADOR) !== 0, elegida, tablas, tabla, huella, cantadas, semilla,
        };
      }
      case T.ELECCION:
        if (b.length !== 3) return null;
        return { tipo, ok: b[1] === 1, indice: b[2] };
      case T.ELIJO:
        if (b.length !== 4) return null;
        return { tipo, ronda: v.getUint16(1, true), indice: b[3] };
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
