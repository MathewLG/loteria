// Easter egg: muchos toques seguidos en la misma casilla tiran todos los frijoles.
// Lógica pura para poder probarla; la animación vive en app.js.

export const TOQUES_PARA_TIRAR = 7;
export const VENTANA_TIRAR_MS = 3000;

/**
 * Registra un toque y dice si hay que tirar los frijoles.
 * Solo cuentan los toques seguidos en la misma casilla dentro de la ventana:
 * tocar otra casilla reinicia la cuenta, así que marcar y desmarcar normal no lo dispara.
 * @param {{ casilla: number, tiempos: number[] }} racha racha anterior
 * @param {number} casilla casilla tocada (0..15)
 * @param {number} ahora tiempo del toque en ms
 * @returns {{ racha: { casilla: number, tiempos: number[] }, tirar: boolean }}
 */
export function registrarToque(racha, casilla, ahora, toques = TOQUES_PARA_TIRAR, ventanaMs = VENTANA_TIRAR_MS) {
  const previos = racha.casilla === casilla ? racha.tiempos.filter((t) => ahora - t <= ventanaMs) : [];
  const tiempos = [...previos, ahora];
  if (tiempos.length >= toques) return { racha: { casilla: -1, tiempos: [] }, tirar: true };
  return { racha: { casilla, tiempos }, tirar: false };
}

/** @type {{ casilla: number, tiempos: number[] }} */
export const RACHA_VACIA = { casilla: -1, tiempos: [] };
