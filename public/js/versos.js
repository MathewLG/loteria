// Gritos tradicionales del cantor, solo los documentados en fuentes de dominio público.
// Las cartas sin grito documentado se cantan con su nombre, como lo haría cualquier gritón.
//
// No usamos la lista de 54 versos que circula en sitios modernos: al menos una nota
// periodística de 2026 la atribuye a un autor contemporáneo, así que puede estar protegida.

export const FUENTE = {
  obra: 'Antonio García Cubas, El libro de mis recuerdos (México, 1904), segunda parte, cap. V, "Las fiestas de Tlalpan", p. 351',
  url: 'https://archive.org/details/ellibrodemisrecu00garc',
  nota: 'Dominio público: el autor murió en 1912. Ortografía modernizada (á → a). En 1904 El Catrín aparece como "un petimetre" y El Diablito como "el diablo".',
};

/** Un grito por carta, en el orden de NOMBRES; null donde no hay uno documentado. */
export const VERSOS = Array.from({ length: 54 }, () => null);

const DOCUMENTADOS = {
  1: 'El que le cantó a San Pedro.',
  2: '¡Ave María Purísima!',
  3: 'La perdición de los hombres.',
  4: 'Don Ferruco en la Alameda.',
  14: 'La Pelona.',
  46: 'El abrigo de los pobres.',
};

for (const [carta, grito] of Object.entries(DOCUMENTADOS)) VERSOS[Number(carta) - 1] = grito;
