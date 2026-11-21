// Apodos para jugar sin cuenta (RF-01): "Sustantivo Adjetivo NNN", con concordancia de género.
// Las listas evitan palabras con doble sentido común en México.

/** Cosas mexicanas cotidianas. g: 'm' masculino, 'f' femenino. */
export const SUSTANTIVOS = [
  { palabra: 'Nopal', g: 'm' }, { palabra: 'Elote', g: 'm' }, { palabra: 'Tamal', g: 'm' },
  { palabra: 'Molcajete', g: 'm' }, { palabra: 'Comal', g: 'm' }, { palabra: 'Jarrito', g: 'm' },
  { palabra: 'Huarache', g: 'm' }, { palabra: 'Sombrero', g: 'm' }, { palabra: 'Trompo', g: 'm' },
  { palabra: 'Balero', g: 'm' }, { palabra: 'Mango', g: 'm' }, { palabra: 'Frijol', g: 'm' },
  { palabra: 'Aguacate', g: 'm' }, { palabra: 'Colibrí', g: 'm' }, { palabra: 'Ajolote', g: 'm' },
  { palabra: 'Cántaro', g: 'm' }, { palabra: 'Bolillo', g: 'm' }, { palabra: 'Pozole', g: 'm' },
  { palabra: 'Volcán', g: 'm' }, { palabra: 'Maguey', g: 'm' }, { palabra: 'Mezquite', g: 'm' },
  { palabra: 'Guajolote', g: 'm' },
  { palabra: 'Tortilla', g: 'f' }, { palabra: 'Piñata', g: 'f' }, { palabra: 'Calabaza', g: 'f' },
  { palabra: 'Jícama', g: 'f' }, { palabra: 'Guayaba', g: 'f' }, { palabra: 'Tuna', g: 'f' },
  { palabra: 'Cazuela', g: 'f' }, { palabra: 'Olla', g: 'f' }, { palabra: 'Canica', g: 'f' },
  { palabra: 'Matraca', g: 'f' }, { palabra: 'Paleta', g: 'f' }, { palabra: 'Mazorca', g: 'f' },
  { palabra: 'Lima', g: 'f' }, { palabra: 'Pitaya', g: 'f' }, { palabra: 'Marimba', g: 'f' },
  { palabra: 'Tostada', g: 'f' }, { palabra: 'Mariposa', g: 'f' }, { palabra: 'Campana', g: 'f' },
  { palabra: 'Jarana', g: 'f' }, { palabra: 'Palma', g: 'f' },
];

/** Adjetivos con su forma masculina y femenina (iguales cuando no cambian). */
export const ADJETIVOS = [
  { m: 'Valiente', f: 'Valiente' }, { m: 'Alegre', f: 'Alegre' }, { m: 'Veloz', f: 'Veloz' },
  { m: 'Feliz', f: 'Feliz' }, { m: 'Sabio', f: 'Sabia' }, { m: 'Bravo', f: 'Brava' },
  { m: 'Dorado', f: 'Dorada' }, { m: 'Risueño', f: 'Risueña' }, { m: 'Travieso', f: 'Traviesa' },
  { m: 'Tranquilo', f: 'Tranquila' }, { m: 'Atento', f: 'Atenta' }, { m: 'Astuto', f: 'Astuta' },
  { m: 'Brillante', f: 'Brillante' }, { m: 'Noble', f: 'Noble' }, { m: 'Fuerte', f: 'Fuerte' },
  { m: 'Ligero', f: 'Ligera' }, { m: 'Curioso', f: 'Curiosa' }, { m: 'Generoso', f: 'Generosa' },
  { m: 'Sereno', f: 'Serena' }, { m: 'Cantor', f: 'Cantora' }, { m: 'Bailador', f: 'Bailadora' },
  { m: 'Madrugador', f: 'Madrugadora' }, { m: 'Afortunado', f: 'Afortunada' }, { m: 'Elegante', f: 'Elegante' },
  { m: 'Puntual', f: 'Puntual' }, { m: 'Paciente', f: 'Paciente' }, { m: 'Sonriente', f: 'Sonriente' },
  { m: 'Amable', f: 'Amable' }, { m: 'Audaz', f: 'Audaz' }, { m: 'Leal', f: 'Leal' },
  { m: 'Tenaz', f: 'Tenaz' }, { m: 'Platicador', f: 'Platicadora' }, { m: 'Viajero', f: 'Viajera' },
  { m: 'Valeroso', f: 'Valerosa' }, { m: 'Juguetón', f: 'Juguetona' }, { m: 'Celeste', f: 'Celeste' },
  { m: 'Fino', f: 'Fina' }, { m: 'Honesto', f: 'Honesta' }, { m: 'Despierto', f: 'Despierta' },
  { m: 'Contento', f: 'Contenta' },
];

/** Arma el apodo con la forma del adjetivo que concuerda con el sustantivo. */
export function armarApodo(sustantivo, adjetivo, numero) {
  return `${sustantivo.palabra} ${adjetivo[sustantivo.g]} ${numero}`;
}

/** `aleatorio` devuelve un número en [0, 1); se puede fijar en las pruebas. */
export function generarApodo(aleatorio = Math.random) {
  const elegir = (lista) => lista[Math.min(lista.length - 1, Math.floor(aleatorio() * lista.length))];
  const sustantivo = elegir(SUSTANTIVOS);
  const adjetivo = elegir(ADJETIVOS);
  const numero = 100 + Math.min(899, Math.floor(aleatorio() * 900));
  return armarApodo(sustantivo, adjetivo, numero);
}
