// Cartas de objetos, plantas y lugares.
import { TINTAS as T, circ, elipse, grabado } from './grabado.js';

const r1 = (n) => Math.round(n * 10) / 10;

/** Una flecha de la cola (x1, y1) a la punta (x2, y2). */
function flecha(api, x1, y1, x2, y2, pluma) {
  const largo = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / largo;
  const uy = (y2 - y1) / largo;
  const px = -uy;
  const py = ux;
  const bx = x2 - 16 * ux;
  const by = y2 - 16 * uy;
  api.hueso(`M${x1} ${y1} L${r1(bx)} ${r1(by)}`, 7, T.madera);
  api.forma(`M${x2} ${y2} L${r1(bx + 7 * px)} ${r1(by + 7 * py)} L${r1(bx - 7 * px)} ${r1(by - 7 * py)} Z`, T.hueso);
  for (const lado of [1, -1]) {
    const ax = x1 + 4 * ux;
    const ay = y1 + 4 * uy;
    const cx = x1 + 22 * ux;
    const cy = y1 + 22 * uy;
    api.forma(`M${r1(ax)} ${r1(ay)} L${r1(ax + lado * 8 * px - 4 * ux)} ${r1(ay + lado * 8 * py - 4 * uy)} L${r1(cx + lado * 8 * px)} ${r1(cy + lado * 8 * py)} L${r1(cx)} ${r1(cy)} Z`, pluma);
  }
}

export const OBJETOS = {
  // 8 · La Botella
  8: grabado(({ forma, linea, trazo, color }) => {
    forma('M90 44 L110 44 L112 60 L88 60 Z', T.cempa);
    forma('M88 60 L112 60 L112 96 C130 106 136 120 136 140 L136 222 C136 230 130 234 122 234 L78 234 C70 234 64 230 64 222 L64 140 C64 120 70 106 88 96 Z', T.nopal);
    color('M64 150 L136 150 L136 196 L64 196 Z', T.hueso);
    linea('M64 150 L136 150 M64 196 L136 196');
    linea('M80 166 L120 166 M86 178 L114 178', 2.5);
    trazo('M74 128 C72 150 72 200 74 222', T.hueso, 4);
    linea('M126 206 L132 212 M124 218 L130 224 M126 120 L132 128', 2.5);
  }),

  // 9 · El Barril
  9: grabado(({ forma, linea }) => {
    forma('M62 76 C80 70 120 70 138 76 C148 110 148 190 138 224 C120 230 80 230 62 224 C52 190 52 110 62 76 Z', T.madera);
    forma(elipse(100, 76, 38, 8), T.cempa);
    linea('M80 82 C74 120 74 180 80 226 M100 84 L100 230 M120 82 C126 120 126 180 120 226', 2.5);
    linea('M57 104 C80 112 120 112 143 104 M54 150 C80 158 120 158 146 150 M57 196 C80 204 120 204 143 196', 6);
    linea('M50 234 C80 240 120 240 150 234', 3);
  }),

  // 10 · El Árbol
  10: grabado(({ forma, linea, color }) => {
    color('M90 236 C94 210 94 190 92 168 L108 168 C106 190 106 210 110 236 Z', T.madera);
    linea('M90 236 C94 210 94 190 92 170 M110 236 C106 210 106 190 108 170');
    linea('M96 220 L98 200 M104 210 L103 190', 2);
    forma('M100 50 C128 50 150 68 152 94 C168 102 172 128 160 144 C160 164 140 176 120 170 C110 180 90 180 80 170 C60 176 40 164 40 144 C28 128 32 102 48 94 C50 68 72 50 100 50 Z', T.nopal);
    linea('M62 110 q6 -8 12 0 M100 80 q6 -8 12 0 M120 120 q6 -8 12 0 M70 148 q6 -8 12 0 M136 96 q6 -8 12 0', 2.5);
    forma(circ(84, 96, 6) + ' ' + circ(128, 142, 6) + ' ' + circ(104, 126, 6) + ' ' + circ(58, 134, 6), T.cempa);
    linea('M38 236 L162 236', 3);
  }),

  // 11 · El Melón
  11: grabado(({ forma, linea, tinta, trazo }) => {
    forma('M100 92 C106 82 116 78 124 80 C118 88 110 92 100 92 Z', T.nopal);
    linea('M94 90 C94 82 98 76 104 72', 4);
    forma(circ(94, 142, 54), T.nopal);
    linea('M50 118 C70 132 70 160 52 172 M72 92 C88 118 88 168 70 194 M110 90 C100 118 102 168 116 194 M136 112 C120 132 120 160 138 176', 1.8);
    linea('M44 142 L144 142 M52 112 L136 112 M52 172 L136 172', 1.8);
    forma('M74 212 C104 232 156 226 176 186 Z', T.cempa);
    trazo('M74 212 C104 232 156 226 176 186', T.nopal, 7);
    linea('M74 212 C104 232 156 226 176 186');
    tinta(elipse(110, 214, 2.2, 3.5) + ' ' + elipse(130, 210, 2.2, 3.5) + ' ' + elipse(150, 202, 2.2, 3.5) + ' ' + elipse(96, 212, 2, 3));
  }),

  // 13 · El Gorrito
  13: grabado(({ forma, linea, trazo }) => {
    forma('M54 188 C54 124 74 88 100 88 C126 88 146 124 146 188 Z', T.grana);
    trazo('M66 140 L134 140 M60 162 L140 162', T.cempa, 7);
    linea('M76 120 L76 186 M100 92 L100 186 M124 120 L124 186', 2);
    forma('M46 184 L154 184 L154 210 L46 210 Z', T.anil);
    linea('M58 186 L58 208 M70 186 L70 208 M82 186 L82 208 M94 186 L94 208 M106 186 L106 208 M118 186 L118 208 M130 186 L130 208 M142 186 L142 208', 2);
    forma(circ(100, 78, 14), T.hueso);
    linea('M92 70 L96 76 M104 68 L102 76 M110 80 L104 80 M90 84 L96 81', 2);
  }),

  // 15 · La Pera
  15: grabado(({ forma, linea, trazo }) => {
    linea('M100 72 C100 62 104 56 110 50', 4);
    forma('M104 60 C116 48 132 48 140 54 C130 64 116 66 104 60 Z', T.nopal);
    linea('M106 60 C116 56 128 55 138 55', 2);
    forma('M100 70 C108 70 112 80 112 92 C112 110 130 124 136 150 C142 182 124 214 100 214 C76 214 58 182 64 150 C70 124 88 110 88 92 C88 80 92 70 100 70 Z', T.cempa);
    trazo('M78 146 C74 164 78 182 88 194', T.hueso, 5);
    linea('M124 168 L132 176 M120 186 L128 194 M116 200 L122 206', 2.5);
    linea('M70 226 C90 230 110 230 130 226', 3);
  }),

  // 16 · La Bandera
  16: grabado(({ forma, linea, hueso }) => {
    hueso('M50 238 L50 48', 8, T.cempa);
    forma(circ(50, 42, 6), T.cempa);
    forma('M52 56 C64 52 78 52 91 56 L91 146 C78 142 64 142 52 146 Z', T.nopal);
    forma('M91 56 C104 60 117 60 130 56 L130 146 C117 150 104 150 91 146 Z', T.hueso);
    forma('M130 56 C143 52 157 52 170 56 L170 146 C157 142 143 142 130 146 Z', T.grana);
    linea('M70 70 L70 132 M150 70 L150 132', 2);
  }),

  // 17 · El Bandolón
  17: grabado(({ forma, linea, tinta, color }) => {
    color('M93 122 L107 122 L106 54 L94 54 Z', T.madera);
    linea('M93 122 L94 54 M107 122 L106 54');
    forma('M90 54 L110 54 L112 34 L88 34 Z', T.madera);
    linea('M88 40 L82 40 M88 48 L82 48 M112 40 L118 40 M112 48 L118 48', 3);
    forma(elipse(100, 172, 46, 52), T.cempa);
    linea(circ(100, 160, 15), 2.5);
    tinta(circ(100, 160, 10));
    linea('M86 204 L114 204', 4);
    linea('M96 204 L97 36 M100 204 L100 36 M104 204 L103 36', 1.3);
    linea('M64 150 C60 170 64 196 76 210', 2);
  }, 'rotate(-18 100 140)'),

  // 18 · El Violoncello
  18: grabado(({ forma, linea, tinta, color }) => {
    linea('M36 212 L170 82', 3);
    linea('M40 216 L172 88', 1.5);
    color('M95 92 L105 92 L105 50 L95 50 Z', T.madera);
    linea('M95 92 L95 52 M105 92 L105 52');
    forma(circ(100, 44, 8), T.madera);
    linea('M100 44 m-3 0 a3 3 0 1 1 3 3', 2);
    forma('M100 92 C122 92 132 104 128 124 C126 134 118 138 118 146 C118 154 138 160 140 186 C142 214 122 232 100 232 C78 232 58 214 60 186 C62 160 82 154 82 146 C82 138 74 134 72 124 C68 104 78 92 100 92 Z', T.grana);
    tinta('M96 92 L104 92 L104 190 L96 190 Z');
    linea('M84 166 C80 178 88 188 84 200 M116 166 C120 178 112 188 116 200', 2.5);
    linea('M88 200 L112 200', 4);
    tinta('M94 206 L106 206 L104 222 L96 222 Z');
    linea('M100 232 L100 240', 3);
  }),

  // 22 · La Bota
  22: grabado(({ forma, linea, tinta, color, trazo }) => {
    forma('M70 54 L120 54 L118 160 C138 166 160 176 168 196 C172 210 166 222 150 222 L70 222 C62 222 58 216 60 208 L64 160 Z', T.madera);
    color('M70 54 L120 54 L119 78 L69 78 Z', T.grana);
    linea('M69 78 L119 78');
    trazo('M82 98 C98 112 98 132 86 146 M106 98 C94 114 98 132 110 142 M132 184 C142 186 152 192 156 202', T.cempa, 3);
    tinta('M70 222 L98 222 L98 236 L72 236 Z');
    linea('M98 230 L160 228', 3);
  }),

  // 29 · El Tambor
  29: grabado(({ forma, linea, color, trazo, hueso }) => {
    color('M52 112 L148 112 L148 196 C148 206 126 212 100 212 C74 212 52 206 52 196 Z', T.grana);
    linea('M52 112 L52 196 C52 206 74 212 100 212 C126 212 148 206 148 196 L148 112');
    trazo('M52 128 L68 196 L84 128 L100 196 L116 128 L132 196 L148 128', T.cempa, 4);
    linea('M52 128 L68 196 L84 128 L100 196 L116 128 L132 196 L148 128', 1.8);
    linea('M52 124 C74 132 126 132 148 124 M52 194 C74 202 126 202 148 194', 3);
    forma(elipse(100, 112, 48, 12), T.hueso);
    hueso('M56 58 L118 102', 7, T.madera);
    hueso('M144 58 L82 102', 7, T.madera);
    forma(circ(56, 58, 6) + ' ' + circ(144, 58, 6), T.hueso);
  }),

  // 31 · Las Jaras
  31: grabado((api) => {
    flecha(api, 60, 228, 148, 58, T.grana);
    flecha(api, 100, 232, 100, 50, T.anil);
    flecha(api, 140, 228, 52, 58, T.grana);
    api.forma('M84 150 C94 146 106 146 116 150 L116 162 C106 158 94 158 84 162 Z', T.cempa);
  }),

  // 36 · El Cazo
  36: grabado(({ forma, linea, tinta, trazo }) => {
    forma('M70 236 C62 222 70 212 76 202 C80 214 88 218 84 230 Z M100 238 C92 222 98 208 100 196 C104 208 112 220 104 236 Z M130 236 C126 222 132 214 128 202 C136 212 140 224 132 236 Z', T.cempa);
    linea('M40 116 C24 110 20 134 38 138 M160 116 C176 110 180 134 162 138', 5);
    forma('M40 112 L160 112 C160 162 136 196 100 196 C64 196 40 162 40 112 Z', T.grana);
    trazo('M54 128 C56 152 70 174 88 184', T.cempa, 5);
    tinta(elipse(100, 112, 60, 9));
    linea('M38 112 C60 104 140 104 162 112', 3);
    tinta(circ(110, 150, 1.6) + ' ' + circ(126, 138, 1.6) + ' ' + circ(122, 166, 1.6) + ' ' + circ(140, 150, 1.6) + ' ' + circ(96, 172, 1.6));
    linea('M80 96 C74 84 86 76 80 64 M100 92 C94 80 106 72 100 60 M120 96 C114 84 126 76 120 64', 2.5);
  }),

  // 37 · El Mundo
  37: grabado(({ forma, linea, trazo }) => {
    forma('M80 212 L120 212 L130 226 L70 226 Z', T.cempa);
    linea('M100 190 L100 212', 6);
    trazo('M44 92 A64 64 0 0 0 132 184', T.cempa, 6);
    linea('M44 92 A64 64 0 0 0 132 184', 2);
    forma(circ(100, 128, 56), T.anil);
    forma('M70 94 C82 82 102 86 104 98 C106 110 94 114 90 126 C86 138 74 142 68 132 C62 122 60 104 70 94 Z', T.nopal);
    forma('M112 134 C124 128 140 134 142 148 C144 160 132 172 120 170 C110 168 104 146 112 134 Z', T.nopal);
    forma('M116 84 C126 80 138 86 142 96 C132 100 120 98 116 84 Z', T.nopal);
    linea(elipse(100, 128, 24, 56) + ' M44 128 L156 128', 1.5);
  }),

  // 47 · La Corona
  47: grabado(({ forma, linea }) => {
    forma('M48 196 L42 100 L74 140 L100 84 L126 140 L158 100 L152 196 Z', T.cempa);
    forma('M46 176 L154 176 L152 206 L48 206 Z', T.grana);
    forma(circ(42, 96, 6) + ' ' + circ(100, 80, 7) + ' ' + circ(158, 96, 6), T.hueso);
    forma(circ(74, 191, 6), T.anil);
    forma(circ(100, 191, 7), T.nopal);
    forma(circ(126, 191, 6), T.anil);
    linea('M100 100 L100 150 M66 142 L70 168 M134 142 L130 168', 2);
    linea('M100 62 L100 54 M76 70 L72 64 M124 70 L128 64', 3);
  }),

  // 48 · La Chalupa
  48: grabado(({ forma, linea, hueso }) => {
    forma('M18 206 C40 198 60 214 82 206 C104 198 124 214 146 206 C160 200 172 204 182 206 L182 238 L18 238 Z', T.anil);
    hueso('M150 96 L118 226', 6, T.madera);
    forma(elipse(114, 228, 7, 12), T.madera);
    forma('M56 178 C54 164 66 158 76 162 C80 150 98 150 102 162 C110 152 128 154 130 168 C140 166 148 174 144 184 L56 186 Z', T.nopal);
    forma(circ(74, 166, 10), T.grana);
    forma(circ(96, 160, 11), T.cempa);
    forma(circ(118, 166, 10), T.hueso);
    forma(circ(136, 176, 8), T.grana);
    forma(circ(62, 178, 7), T.cempa);
    forma('M28 182 C60 198 140 198 172 182 L160 208 C130 216 70 216 40 208 Z', T.madera);
    linea('M44 196 C80 206 120 206 156 196', 2);
  }),

  // 49 · El Pino
  49: grabado(({ forma, linea, color }) => {
    color('M92 196 L92 230 L108 230 L108 196 Z', T.madera);
    linea('M92 196 L92 230 L108 230 L108 196');
    forma('M100 48 L130 100 L114 100 L144 148 L124 148 L156 198 L44 198 L76 148 L56 148 L86 100 L70 100 Z', T.nopal);
    linea('M92 80 L86 92 M108 80 L114 92 M84 124 L76 138 M116 124 L124 138 M78 170 L68 186 M122 170 L132 186 M100 150 L100 166', 2.5);
    linea('M40 232 L160 232', 3);
  }),

  // 51 · La Palma
  51: grabado(({ forma, linea }) => {
    forma('M28 238 C60 222 140 222 172 238 Z', T.cempa);
    forma('M92 230 C96 188 104 148 122 102 L132 106 C116 150 108 190 108 230 Z', T.madera);
    linea('M95 210 L107 212 M97 186 L110 190 M101 162 L113 166 M107 138 L119 142 M114 118 L125 122', 2.5);
    forma('M126 100 C104 74 74 70 50 82 C74 88 100 96 126 100 Z', T.nopal);
    forma('M126 100 C118 72 100 56 78 50 C96 66 112 82 126 100 Z', T.nopal);
    forma('M126 100 C138 70 158 58 178 60 C160 72 142 86 126 100 Z', T.nopal);
    forma('M126 100 C150 96 170 104 180 122 C160 112 142 106 126 100 Z', T.nopal);
    forma('M126 100 C106 108 90 124 84 146 C100 128 112 114 126 100 Z', T.nopal);
    forma(circ(120, 110, 6) + ' ' + circ(132, 112, 6), T.madera);
  }),

  // 53 · El Arpa
  53: grabado(({ forma, linea }) => {
    forma('M158 70 L170 76 L76 228 L62 222 Z', T.cempa);
    linea('M74 72 L74 217 M86 64 L86 198 M98 64 L98 179 M110 70 L110 159 M122 76 L122 140 M134 80 L134 121 M146 80 L146 102', 1.4);
    forma('M52 224 L62 224 L66 70 L56 70 Z', T.madera);
    forma('M56 70 C70 52 96 56 116 70 C134 82 150 76 160 64 L166 74 C152 92 130 92 112 80 C94 68 72 66 62 78 Z', T.madera);
    linea('M44 230 L84 230', 4);
  }),
};
