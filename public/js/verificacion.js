// Verificación de una ronda: la usan el juego al terminar cada ronda y verificar.html.
import { barajar, deHex, igualesBytes, sha256 } from './baraja.js';

const aBytes = (valor) => (typeof valor === 'string' ? deHex(valor) : valor);

/**
 * Comprueba que la semilla revelada da la huella publicada al inicio
 * y que revolver con ella produce exactamente las cartas que salieron, en orden.
 */
export function verificarRonda({ semilla, huella, cantadas, catalogo = 54 }) {
  const s = aBytes(semilla);
  const h = aBytes(huella);
  if (!s || s.length !== 32 || !h || h.length !== 32 || !Array.isArray(cantadas)) {
    return { ok: false, huellaOk: false, ordenOk: false };
  }
  const huellaOk = igualesBytes(sha256(s), h);
  const baraja = barajar(s, catalogo);
  const ordenOk = cantadas.length <= catalogo && cantadas.every((carta, i) => baraja[i] === carta);
  return { ok: huellaOk && ordenOk, huellaOk, ordenOk };
}

/** Clave del registro de una ronda en /api/rondas: AAAA-MM-DD/{ronda}-{huella8}. */
export function claveDeRonda(ronda, huellaHex, fecha = new Date()) {
  return `${fecha.toISOString().slice(0, 10)}/${ronda}-${huellaHex.slice(0, 8)}`;
}
