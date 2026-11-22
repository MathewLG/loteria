// Reglas de presentación sin DOM, para poder probarlas.
import { FASE } from './protocolo.js';

/** Texto y estado del botón principal: siempre dice por qué no se puede gritar. */
export function textoBoton(s) {
  if (!s.conectado) return { texto: s.ronda ? 'Sin conexión' : 'Conectando…', deshabilitado: true };
  if (s.espectador) return { texto: 'Juegas en la siguiente ronda', deshabilitado: true };
  if (s.lugar) return { texto: `Ganaste: lugar ${s.lugar}`, deshabilitado: true };
  if (s.esperandoResultado) return { texto: 'Revisando tu tabla…', deshabilitado: true };
  if (s.fase === FASE.ESPERA) return { texto: 'Espera la primera carta', deshabilitado: true };
  if (s.fase === FASE.TERMINADA) return { texto: 'Ronda terminada', deshabilitado: true };
  return { texto: '¡Lotería!', deshabilitado: false };
}

/** Estimación del tiempo hasta la siguiente ronda para quien mira como espectador. */
export function msHastaSiguienteRonda({ catalogo, cantadas, msEntreCartas, msParaSiguienteCarta }) {
  const restantes = Math.max(0, catalogo - cantadas);
  if (restantes === 0) return Math.max(0, msParaSiguienteCarta);
  return Math.max(0, msParaSiguienteCarta + (restantes - 1) * msEntreCartas + msEntreCartas);
}

/** "3 min", "45 s": suficiente para una estimación, sin falsa precisión. */
export function duracionAproximada(ms) {
  const seg = Math.ceil(ms / 1000);
  if (seg < 60) return `${seg} s`;
  return `${Math.round(seg / 60)} min`;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Etiqueta de una ronda reciente para el selector de verificar.html:
 * "Ronda 12 · 21 nov · 3 ganadores". Toma la fecha de la clave (AAAA-MM-DD/…) si no viene aparte.
 */
export function textoRondaReciente({ clave = '', ronda, fecha, ganadores }) {
  const iso = String(fecha ?? clave).slice(0, 10);
  const [, mes, dia] = iso.split('-').map(Number);
  const partes = [`Ronda ${ronda}`];
  if (mes >= 1 && mes <= 12 && dia >= 1) partes.push(`${dia} ${MESES[mes - 1]}`);
  const n = Number(ganadores);
  if (Number.isFinite(n)) partes.push(n === 0 ? 'sin ganadores' : `${n} ${n === 1 ? 'ganador' : 'ganadores'}`);
  return partes.join(' · ');
}
