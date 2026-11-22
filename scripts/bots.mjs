// Jugadores simulados para que la sala no se sienta vacía y para ver el ranking.
// Uso: npm run bots -- 50          (50 bots contra http://localhost:8787)
//      SALA=ws://192.168.1.20:8787/ws npm run bots -- 200

import { FASE, T, codificarElijo, codificarLoteria, cumpleFigura, decodificar, mascaraCantadas } from '../public/js/protocolo.js';
import { aHex } from '../public/js/baraja.js';

const N = Number.parseInt(process.argv[2] ?? '20', 10);
const URL_SALA = process.env.SALA ?? 'ws://localhost:8787/ws';
const azar = (min, max) => min + Math.random() * (max - min);

function crearBot(numero) {
  const token = aHex(crypto.getRandomValues(new Uint8Array(16)));
  // Cada bot tiene su ritmo: unos marcan rápido, otros se distraen.
  const reflejos = azar(300, 2200);
  const distraido = Math.random() < 0.15;
  let b = { ronda: 0, fase: FASE.ESPERA, figura: 0, tablas: [], tabla: [], cantadas: [], marcadas: 0, gritando: false, gano: false, espectador: false };
  let ws;
  let pase = null;

  const revisar = () => {
    if (b.gano || b.gritando || b.espectador || b.fase !== FASE.CANTANDO) return;
    if (!cumpleFigura(b.marcadas, b.figura)) return;
    b.gritando = true;
    setTimeout(() => ws.readyState === WebSocket.OPEN && ws.send(codificarLoteria(b.ronda, b.marcadas)), azar(200, 1500));
  };

  // Cada bot conserva su carta entre rondas, como un jugador real.
  let carta = Math.floor(Math.random() * 1000);
  let base = carta;
  const conectar = () => {
    // Con el pase firmado por la sala, el bot vuelve a su ronda sin quedar de espectador.
    const vuelta = `&c=${carta}` + (pase && pase.carta === carta ? `&r=${pase.ronda}&p=${pase.hex}` : '');
    ws = new WebSocket(`${URL_SALA}?t=${token}${vuelta}`);
    ws.binaryType = 'arraybuffer';
    ws.addEventListener('message', (evento) => {
      const m = decodificar(evento.data);
      if (!m) return;
      if (m.tipo === T.ESTADO) {
        base = m.base ?? 0;
        if (m.tablas.length) carta = m.numeroCarta ?? 0;
        if (m.pase) pase = { ronda: m.ronda, carta, hex: aHex(m.pase) };
        b = {
          ronda: m.ronda, fase: m.fase, figura: m.figura, tablas: m.tablas, tabla: m.tabla, cantadas: m.cantadas,
          marcadas: mascaraCantadas(m.tabla, m.cantadas), gritando: false, gano: m.lugar > 0, espectador: m.espectador,
        };
        // En la espera casi todos conservan su carta; uno de cada cinco la cambia.
        if (m.fase === FASE.ESPERA && m.tablas.length === 3 && Math.random() < 0.2) {
          const indice = 1 + Math.floor(Math.random() * 2);
          setTimeout(() => ws.readyState === WebSocket.OPEN && ws.send(codificarElijo(b.ronda, indice)), azar(100, 1000));
        }
      } else if (m.tipo === T.ELECCION && m.ok) {
        if (m.ok) carta = (base + m.indice) % 1000;
        if (m.pase) pase = { ronda: b.ronda, carta: (base + m.indice) % 1000, hex: aHex(m.pase) };
        b.tabla = b.tablas[m.indice] ?? b.tabla;
        b.marcadas = mascaraCantadas(b.tabla, b.cantadas);
      } else if (m.tipo === T.CARTA && m.ronda === b.ronda) {
        b.fase = FASE.CANTANDO;
        b.cantadas.push(m.carta);
        const pos = b.tabla.indexOf(m.carta);
        if (pos >= 0 && !(distraido && Math.random() < 0.4)) {
          setTimeout(() => { b.marcadas |= 1 << pos; revisar(); }, reflejos);
        }
      } else if (m.tipo === T.RESULTADO) {
        b.gritando = false;
        if (m.ok && !b.gano) {
          b.gano = true;
          console.log(`  bot ${String(numero).padStart(3)} gritó ¡Lotería! y quedó en el lugar ${m.lugar}`);
        }
      } else if (m.tipo === T.FIN && numero === 0) {
        console.log(`Ronda ${m.ronda} terminada: ${m.ganadores} ganadores. Semilla revelada ${aHex(m.semilla).slice(0, 16)}…`);
      }
    });
    ws.addEventListener('close', () => setTimeout(conectar, azar(1000, 3000)));
    ws.addEventListener('error', () => {});
  };
  conectar();
}

console.log(`Conectando ${N} bots a ${URL_SALA}…`);
for (let i = 0; i < N; i++) setTimeout(() => crearBot(i), i * 15);
