// Gritos del cantor. Cada carta puede tener varias frases; en cada ronda se canta una.
//
// Origen de las frases:
//  - García Cubas (1904): los gritos más antiguos documentados, en dominio público.
//  - Tradición oral: frases populares que aparecen en varias fuentes independientes.
//    La Ley Federal del Derecho de Autor (art. 14, fr. III) no protege frases aisladas;
//    lo que sí se evita es copiar en bloque una compilación moderna de un solo sitio.
//  - Aportadas por el equipo: frases que alguien del proyecto conoce de su familia.
// Cada frase guarda su origen para poder revisarla o quitarla.

export const FUENTES = {
  garciaCubas: {
    nombre: 'Antonio García Cubas, El libro de mis recuerdos (México, 1904), p. 351',
    url: 'https://archive.org/details/ellibrodemisrecu00garc',
  },
  tradicion: { nombre: 'Tradición oral; registrada en varias fuentes independientes (ver docs/gritos.md)' },
  equipo: { nombre: 'Aportada por el equipo del proyecto, de tradición familiar' },
};

/**
 * Frases por número de carta.
 * @type {Record<number, { texto: string, fuente: keyof typeof FUENTES }[]>}
 */
export const GRITOS = {
  1: [{ texto: "El que le cantó a San Pedro.", fuente: "garciaCubas" }],
  2: [{ texto: "Pórtate bien, cuatito, si no te lleva el coloradito.", fuente: "tradicion" }, { texto: "Más sabe el diablo por viejo que por diablo.", fuente: "tradicion" }, { texto: "¡Ave María Purísima!", fuente: "garciaCubas" }],
  3: [{ texto: "Puliendo el paso, por toda la calle real.", fuente: "tradicion" }, { texto: "La perdición de los hombres.", fuente: "garciaCubas" }],
  4: [{ texto: "Don Ferruco en la Alameda.", fuente: "garciaCubas" }],
  5: [{ texto: "Para el sol y para el agua.", fuente: "tradicion" }],
  6: [{ texto: "Con los cantos de sirena, no te vayas a marear.", fuente: "tradicion" }],
  7: [{ texto: "Súbeme paso a pasito, no quieras pegar brinquitos.", fuente: "tradicion" }],
  8: [{ texto: "La herramienta del borracho.", fuente: "tradicion" }],
  9: [{ texto: "Tanto bebió el albañil, que quedó como barril.", fuente: "tradicion" }],
  10: [{ texto: "El que a buen árbol se arrima, buena sombra le cobija.", fuente: "tradicion" }],
  11: [{ texto: "¡Me lo das o me lo quitas!", fuente: "tradicion" }],
  12: [{ texto: "¿Por qué le corres, cobarde, trayendo tan buen puñal?", fuente: "tradicion" }],
  13: [{ texto: "Ponle su gorrito al nene, no se nos vaya a resfriar.", fuente: "tradicion" }],
  14: [{ texto: "La Pelona.", fuente: "garciaCubas" }, { texto: "¡La tilica y flaca!", fuente: "tradicion" }],
  15: [{ texto: "El que espera, desespera.", fuente: "tradicion" }],
  16: [{ texto: "Verde, blanco y colorado, la bandera del soldado.", fuente: "tradicion" }],
  17: [{ texto: "Tocando su bandolón, está el mariachi Simón.", fuente: "tradicion" }],
  18: [{ texto: "Creciendo se fue hasta el cielo, y como no fue violín, tuvo que ser violoncello.", fuente: "tradicion" }],
  20: [{ texto: "Tú me traes a puros brincos, como pájaro en la rama.", fuente: "tradicion" }],
  22: [{ texto: "Una bota igual que la otra.", fuente: "tradicion" }],
  23: [{ texto: "El farol de los enamorados.", fuente: "tradicion" }],
  24: [{ texto: "Cotorro, cotorro, saca la pata, y empiézame a platicar.", fuente: "tradicion" }],
  25: [{ texto: "¡Ah, qué borracho tan necio, ya no lo puedo aguantar!", fuente: "tradicion" }],
  27: [{ texto: "No me extrañes, corazón, que regreso en el camión.", fuente: "tradicion" }],
  29: [{ texto: "No te arrugues, cuero viejo, que te quiero pa' tambor.", fuente: "tradicion" }],
  30: [{ texto: "Camarón que se duerme, se lo lleva la corriente.", fuente: "tradicion" }],
  33: [{ texto: "Atarántamela a palos, no me la dejes llegar.", fuente: "tradicion" }],
  34: [{ texto: "Uno, dos y tres, el soldado p'al cuartel.", fuente: "tradicion" }],
  35: [{ texto: "La guía de los marineros.", fuente: "tradicion" }],
  36: [{ texto: "El caso que me haces poco, y el caso es averiguarlo.", fuente: "equipo" }, { texto: "El caso que te hago es poco.", fuente: "tradicion" }],
  37: [{ texto: "Este mundo es una bola, y nosotros un bolón.", fuente: "tradicion" }],
  39: [{ texto: "Al nopal lo van a ver nomás cuando tiene tunas.", fuente: "tradicion" }],
  40: [{ texto: "El que con la cola pica, le dan una paliza.", fuente: "tradicion" }],
  41: [{ texto: "Rosita, Rosaura, ven que te quiero ahora.", fuente: "tradicion" }],
  42: [{ texto: "Al pasar por el panteón, me encontré un calaverón.", fuente: "tradicion" }],
  43: [{ texto: "Tú con la campana y yo con tu hermana.", fuente: "tradicion" }],
  44: [{ texto: "Tanto va el cántaro al agua, que se quiebra y te moja las enaguas.", fuente: "tradicion" }],
  45: [{ texto: "Saltando va buscando, pero no ve nada.", fuente: "tradicion" }],
  46: [{ texto: "El abrigo de los pobres.", fuente: "garciaCubas" }, { texto: "La cobija de los pobres.", fuente: "tradicion" }],
  47: [{ texto: "El sombrero de los reyes.", fuente: "tradicion" }],
  48: [{ texto: "Rema que rema Lupita, sentada en su chalupita.", fuente: "tradicion" }],
  49: [{ texto: "Fresco y oloroso, en todo tiempo hermoso.", fuente: "tradicion" }],
  50: [{ texto: "El que por la boca muere, aunque mudo fuera.", fuente: "tradicion" }],
  51: [{ texto: "Palmero, sube a la palma y bájame un coco real.", fuente: "tradicion" }],
  52: [{ texto: "El que nace pa' maceta, no sale del corredor.", fuente: "tradicion" }],
  53: [{ texto: "Arpa vieja de mi suegra, ya no sirves pa' tocar.", fuente: "tradicion" }],
  54: [{ texto: "Al ver a la verde rana, qué brinco pegó tu hermana.", fuente: "tradicion" }],
};

/**
 * La frase que se canta para una carta en una ronda. Todos los jugadores ven la misma,
 * porque sale de la huella pública de la ronda. Devuelve null si la carta no tiene frase.
 * @param {number} carta
 * @param {Uint8Array | null} huella
 * @returns {string | null}
 */
export function gritoPara(carta, huella) {
  const opciones = GRITOS[carta];
  if (!opciones || opciones.length === 0) return null;
  const semilla = huella && huella.length ? huella[carta % huella.length] + huella[0] * 7 : 0;
  return opciones[(semilla + carta) % opciones.length].texto;
}
