// Cartas con personas (y La Mano). Retratos de busto, distintos de cualquier baraja comercial.
import { TINTAS as T, circ, elipse, grabado } from './grabado.js';

// Hombros y cara se repiten en varios retratos.
const HOMBROS = 'M44 238 C46 200 68 184 90 180 L100 196 L110 180 C132 184 154 200 156 238 Z';
const CUELLO = 'M90 156 L90 179 L100 195 L110 179 L110 156 Z';
const CARA = 'M76 122 C76 99 87 88 100 88 C113 88 124 99 124 122 C124 146 113 162 100 162 C87 162 76 146 76 122 Z';
// Disco de fondo: solo se dibuja el arco de arriba para que no cruce la ropa.
const disco = (api, relleno) => {
  api.color(circ(100, 126, 64), relleno);
  api.linea('M45 158 A64 64 0 1 1 155 158');
};

export const PERSONAS = {
  // 2 · El Diablito
  2: grabado(({ forma, linea, tinta, tapa, trazo }) => {
    trazo('M58 234 L150 66', T.cempa, 6);
    linea('M56 232 L148 64 M62 236 L154 68', 2.5);
    trazo('M136 56 L164 76 M136 56 L144 38 M164 76 L172 58 M150 66 L158 46', T.cempa, 6);
    linea('M136 56 L164 76 M136 56 L144 38 M164 76 L172 58 M150 66 L158 46', 4);
    tapa('M50 238 C52 202 72 188 100 186 C128 188 148 202 150 238 Z', T.grana);
    forma('M72 124 L56 112 L72 138 Z M128 124 L144 112 L128 138 Z', T.grana);
    tapa('M72 128 C72 100 84 88 100 88 C116 88 128 100 128 128 C128 156 116 174 100 176 C84 174 72 156 72 128 Z', T.grana);
    forma('M80 102 C66 90 64 72 70 58 C74 76 84 86 92 92 Z', T.cempa);
    forma('M120 102 C134 90 136 72 130 58 C126 76 116 86 108 92 Z', T.cempa);
    linea('M80 116 L95 123 M120 116 L105 123');
    tinta(elipse(89, 130, 4, 5));
    tinta(elipse(111, 130, 4, 5));
    forma('M82 150 C90 164 110 164 118 150 C110 155 90 155 82 150 Z', T.hueso);
    tinta('M93 174 L100 194 L107 174 Z');
    linea('M64 206 L72 214 M128 210 L136 202', 3);
  }),

  // 3 · La Dama
  3: grabado(({ forma, linea, tinta, color }) => {
    const api = { color, linea };
    disco(api, T.grana);
    forma('M44 238 C46 198 68 182 88 177 L100 193 L112 177 C132 182 154 198 156 238 Z', T.anil);
    linea('M58 204 L66 238 M76 194 L82 238 M124 194 L118 238 M142 204 L134 238', 2.5);
    forma(CUELLO, T.pielMorena);
    forma(CARA, T.pielMorena);
    tinta('M74 124 C70 94 84 78 100 78 C116 78 130 94 126 124 C122 106 112 97 100 96 C88 97 78 106 74 124 Z');
    tinta(circ(100, 70, 13));
    forma(circ(121, 80, 9), T.grana);
    tinta(circ(121, 80, 2.5));
    linea('M86 124 C89 121 93 121 95 124 M105 124 C107 121 111 121 114 124', 3);
    linea('M100 128 C99 134 98 137 101 139', 2.5);
    forma('M93 147 C97 144 103 144 107 147 C103 151 97 151 93 147 Z', T.grana);
    forma(circ(77, 140, 4), T.cempa);
    forma(circ(123, 140, 4), T.cempa);
    forma('M118 234 L148 190 A54 54 0 0 1 172 234 Z', T.cempa);
    linea('M118 234 L156 196 M118 234 L164 207 M118 234 L169 220', 2.5);
  }),

  // 4 · El Catrín
  4: grabado(({ forma, linea, tinta, color, tapa }) => {
    disco({ color, linea }, T.cempa);
    forma('M44 238 C46 200 66 184 88 180 L100 210 L112 180 C134 184 154 200 156 238 Z', T.anil);
    forma('M88 180 L100 210 L112 180 Z', T.hueso);
    forma('M90 183 L100 189 L110 183 L110 195 L100 189 L90 195 Z', T.grana);
    forma('M92 158 L91 181 L109 181 L108 158 Z', T.pielClara);
    forma(CARA, T.pielClara);
    tinta('M64 96 C80 87 120 87 136 96 C120 101 80 101 64 96 Z');
    tinta('M80 94 L82 44 C94 40 106 40 118 44 L120 94 Z');
    tapa('M81 80 L119 80 L119.5 88 L80.5 88 Z', T.grana, 2);
    linea('M86 122 C89 119 93 119 95 122', 3);
    linea(circ(110, 122, 8), 2.5);
    tinta(circ(110, 122, 2.5));
    linea('M118 125 C126 142 122 162 118 180', 1.8);
    linea('M100 126 L97 138 L102 139', 2.5);
    tinta('M100 144 C92 140 84 142 80 150 C78 144 84 136 92 138 C96 139 99 141 100 142 C101 141 104 139 108 138 C116 136 122 144 120 150 C116 142 108 140 100 144 Z');
    forma(circ(132, 204, 6), T.grana);
  }),

  // 6 · La Sirena
  6: grabado(({ forma, linea, tinta, tapa }) => {
    forma('M18 214 C34 204 50 220 66 210 C82 200 98 216 114 206 C130 196 146 212 162 202 C170 198 176 200 182 204 L182 238 L18 238 Z', T.anil);
    linea('M30 226 C40 222 50 230 60 226 M120 224 C130 220 140 228 150 224', 2.5);
    forma('M34 220 C38 200 62 192 86 196 C108 200 118 212 116 222 Z', T.piedra);
    tapa('M80 192 L116 192 C132 188 142 176 146 162 C150 152 158 146 168 146 C162 152 160 160 162 170 C156 164 152 166 150 172 C142 196 114 210 86 206 C78 204 76 198 80 192 Z', T.nopal);
    linea('M96 196 q5 6 10 0 M108 194 q5 6 10 0 M120 190 q5 6 10 0 M102 202 q5 6 10 0 M114 200 q5 6 10 0', 2);
    forma('M80 192 C78 168 82 146 90 136 L110 136 C118 148 120 170 116 192 Z', T.pielMorena);
    forma(elipse(93, 152, 7, 6), T.cempa);
    forma(elipse(107, 152, 7, 6), T.cempa);
    forma(elipse(100, 112, 15, 18), T.pielMorena);
    tinta('M84 112 C80 90 94 80 104 82 C120 84 124 100 116 116 C116 106 108 98 98 98 C90 100 86 106 84 112 Z');
    tinta('M84 110 C78 130 76 150 70 170 C80 156 86 140 88 124 Z');
    tinta('M116 110 C124 128 128 150 132 166 C122 154 116 138 113 124 Z');
    linea('M92 112 C94 110 97 110 98 112 M103 112 C104 110 107 110 109 112', 2.5);
    linea('M96 122 C98 124 102 124 104 122', 2.5);
  }),

  // 12 · El Valiente
  12: grabado(({ forma, linea, tinta, tapa, trazo }) => {
    forma(HOMBROS, T.grana);
    trazo('M52 214 L148 214 M48 226 L152 226', T.anil, 5);
    trazo('M56 204 L144 204', T.cempa, 4);
    forma(CUELLO, T.pielMorena);
    forma(CARA, T.pielMorena);
    forma('M80 94 C80 70 88 56 100 56 C112 56 120 70 120 94 Z', T.cempa);
    tapa('M48 98 C60 84 140 84 152 98 C140 110 60 110 48 98 Z', T.cempa);
    linea('M82 88 C94 92 106 92 118 88', 3);
    linea('M84 116 L95 120 M116 116 L105 120');
    tinta(elipse(90, 126, 3, 3.5));
    tinta(elipse(110, 126, 3, 3.5));
    linea('M100 128 L97 140 L102 141', 2.5);
    tinta('M100 146 C92 143 86 146 84 154 C90 150 96 150 100 150 C104 150 110 150 116 154 C114 146 108 143 100 146 Z');
    forma('M160 64 L170 60 L174 160 L164 161 Z', T.hueso);
    forma('M162 161 L176 159 L178 186 L164 188 Z', T.madera);
    forma(circ(170, 176, 10), T.pielMorena);
  }),

  // 14 · La Muerte
  14: grabado(({ forma, linea, tinta, hueso }) => {
    hueso('M142 48 L120 234', 9, T.cempa);
    forma('M142 48 C122 36 90 38 66 54 C90 50 116 54 136 64 Z', T.hueso);
    hueso('M96 98 L96 160', 9);
    hueso('M82 112 C90 108 102 108 110 112', 7);
    hueso('M80 123 C90 119 102 119 112 123', 7);
    hueso('M82 134 C90 130 102 130 110 134', 7);
    hueso('M84 106 L70 136 L82 160', 8);
    hueso('M108 106 L124 120 L134 112', 8);
    forma('M84 158 C88 168 104 168 108 158 L104 172 L88 172 Z', T.hueso);
    hueso('M90 172 L82 202 L74 230', 8);
    hueso('M102 172 L112 202 L106 230', 8);
    linea('M66 232 L78 232 M104 232 L116 232', 4);
    forma(circ(96, 82, 16), T.hueso);
    tinta(elipse(90, 82, 4, 5));
    tinta(elipse(103, 82, 4, 5));
    tinta('M96 88 L93 93 L99 93 Z');
    linea('M89 96 L103 96 M93 94 L93 98 M99 94 L99 98', 2);
    forma(circ(50, 226, 7), T.cempa);
    forma(circ(150, 228, 6), T.grana);
  }),

  // 21 · La Mano
  21: grabado(({ forma, linea, tapa }) => {
    forma('M78 232 L78 170 C70 160 52 138 48 128 C44 118 54 112 62 120 L78 140 L78 76 C78 68 90 68 90 76 L90 128 L92 62 C92 54 104 54 104 62 L104 126 L108 68 C108 60 120 60 120 68 L118 130 L124 88 C124 80 136 80 136 88 L130 150 C128 176 122 196 120 232 Z', T.pielMorena);
    linea('M86 186 C96 180 110 182 116 190 M84 168 C94 160 110 160 120 166 M96 200 C100 208 108 210 114 206', 2.5);
    linea('M82 80 q2 -4 5 0 M95 66 q2 -4 5 0 M111 72 q2 -4 5 0 M127 92 q2 -4 5 0', 2);
    tapa('M72 216 L126 216 L127 238 L71 238 Z', T.anil);
    linea('M76 226 L122 226', 2.5);
    linea('M44 92 L36 84 M40 108 L28 106 M150 70 L160 60 M156 92 L168 90', 3);
  }),

  // 25 · El Borracho
  25: grabado(({ forma, linea, tinta, tapa }) => {
    forma(HOMBROS, T.hueso);
    forma('M60 214 L76 210 L78 226 L62 230 Z', T.anil);
    forma(CUELLO, T.pielClara);
    forma(elipse(100, 132, 25, 30), T.pielClara);
    forma(circ(100, 136, 6), T.grana);
    linea('M84 124 L95 126 M105 126 L116 124', 3);
    tinta('M86 128 C89 131 93 131 95 128 Z M105 128 C107 131 111 131 114 128 Z');
    linea('M88 152 C94 156 100 150 106 154 C108 156 110 156 112 154', 2.5);
    forma('M84 102 C82 82 92 72 104 72 C116 72 124 82 124 96 Z', T.cempa);
    tapa('M64 106 C80 94 126 88 142 96 C132 106 84 112 64 106 Z', T.cempa);
    forma('M138 136 L144 134 L148 146 L136 150 Z', T.nopal);
    forma('M134 150 L148 146 L160 186 L146 190 Z', T.nopal);
    forma(circ(146, 192, 9), T.pielClara);
    linea(circ(126, 150, 3) + ' ' + circ(132, 138, 4), 2);
    linea('M50 70 c-6 -6 4 -14 10 -6 c4 6 -6 10 -8 4 M150 60 c6 -6 -4 -14 -10 -6 c-4 6 6 10 8 4', 2.5);
  }, 'rotate(-7 100 160)'),

  // 26 · El Negrito: retrato digno, sin rasgos exagerados
  26: grabado(({ forma, linea, tinta, color, claro }) => {
    disco({ color, linea }, T.anil);
    forma(HOMBROS, T.hueso);
    linea('M62 206 L62 238 M138 206 L138 238', 2.5);
    forma(CUELLO, T.pielOscura);
    forma('M86 177 L114 177 L108 196 L100 204 L92 196 Z', T.grana);
    color(circ(96, 184, 1.6) + ' ' + circ(104, 186, 1.6) + ' ' + circ(100, 194, 1.6), T.hueso);
    forma(elipse(76, 124, 4, 8), T.pielOscura);
    forma(elipse(124, 124, 4, 8), T.pielOscura);
    forma(CARA, T.pielOscura);
    tinta('M76 114 C73 92 85 80 100 80 C115 80 127 92 124 114 C120 101 111 96 100 96 C89 96 80 101 76 114 Z');
    claro('M86 90 q3 -3 6 0 M98 86 q3 -3 6 0 M110 90 q3 -3 6 0 M92 96 q2 -2 4 0', 1.5);
    forma(elipse(89, 122, 5, 3.5), T.hueso);
    forma(elipse(111, 122, 5, 3.5), T.hueso);
    tinta(circ(89, 122, 2.2));
    tinta(circ(111, 122, 2.2));
    linea('M82 113 L95 112 M105 112 L118 113', 3);
    linea('M100 126 C98 133 96 137 99 140 C101 141 103 140 105 138', 2.5);
    linea('M91 148 C96 153 104 153 109 148', 2.5);
  }),

  // 32 · El Músico
  32: grabado(({ forma, linea, tinta, tapa, hueso }) => {
    forma(HOMBROS, T.anil);
    linea('M70 196 L66 238 M130 196 L134 238', 2.5);
    forma(CUELLO, T.pielMorena);
    forma(CARA, T.pielMorena);
    forma('M82 94 C82 72 90 60 100 60 C110 60 118 72 118 94 Z', T.cempa);
    tapa('M46 98 C58 82 142 82 154 98 C142 112 58 112 46 98 Z', T.cempa);
    linea('M52 98 C70 106 130 106 148 98', 2);
    linea('M86 122 C89 119 93 119 95 122 M105 122 C107 119 111 119 114 122', 3);
    linea('M100 126 L98 138 L102 139', 2.5);
    tinta('M100 144 C94 141 88 143 86 149 C92 147 97 148 100 148 C103 148 108 147 114 149 C112 143 106 141 100 144 Z');
    hueso('M124 196 L170 172', 9, T.madera);
    forma('M166 168 L178 161 L181 169 L170 176 Z', T.madera);
    linea('M170 164 L166 158 M176 160 L174 154', 2.5);
    tapa('M54 206 C54 188 70 180 84 186 C92 176 112 174 124 182 C136 190 136 206 124 212 C114 220 98 218 92 214 C82 232 54 228 54 206 Z', T.cempa);
    tinta(circ(98, 200, 7));
    linea('M68 207 L172 167 M69 212 L173 171', 1.2);
    linea('M66 200 L72 216', 4);
    forma(circ(150, 182, 8), T.pielMorena);
    forma(circ(104, 214, 8), T.pielMorena);
  }),

  // 34 · El Soldado
  34: grabado(({ forma, linea, tinta, hueso, trazo }) => {
    hueso('M126 236 L164 62', 9, T.madera);
    linea('M156 96 L168 42', 3);
    forma(HOMBROS, T.anil);
    trazo('M100 198 L100 238', T.grana, 4);
    forma(circ(92, 212, 3.5) + ' ' + circ(92, 228, 3.5), T.cempa);
    linea('M126 190 L70 238', 2.5);
    forma(CUELLO, T.pielClara);
    forma(CARA, T.pielClara);
    forma('M80 96 L83 60 L117 60 L120 96 Z', T.anil);
    tinta('M78 96 C90 104 110 104 122 96 L122 101 C110 109 90 109 78 101 Z');
    forma(circ(100, 76, 6), T.cempa);
    linea('M86 120 L95 121 M105 121 L114 120', 3);
    tinta(circ(90, 126, 2.5));
    tinta(circ(110, 126, 2.5));
    linea('M100 128 L98 139 L102 140 M92 150 L108 150', 2.5);
  }),

  // 38 · El Apache: retrato digno, sin penacho ni rasgos exagerados
  38: grabado(({ forma, linea, tinta, tapa, color }) => {
    disco({ color, linea }, T.nopal);
    forma(HOMBROS, T.cempa);
    linea('M56 214 L66 206 L76 214 L86 206 L96 214 L104 206 L114 214 L124 206 L134 214 L144 206', 2.5);
    tinta('M72 122 C70 92 84 78 100 78 C116 78 130 92 128 122 L134 198 L120 196 L116 152 L84 152 L80 196 L66 198 Z');
    tapa(CUELLO, T.pielCanela);
    tapa(CARA, T.pielCanela);
    tinta('M76 112 C76 96 86 88 100 88 C114 88 124 96 124 112 C116 104 108 101 100 101 C92 101 84 104 76 112 Z');
    tapa('M73 104 C88 97 112 97 127 104 L127 113 C112 106 88 106 73 113 Z', T.grana, 2.5);
    linea('M84 123 C88 120 92 120 95 122 M105 122 C108 120 112 120 116 123', 3);
    tinta(elipse(90, 126, 2.6, 2));
    tinta(elipse(110, 126, 2.6, 2));
    linea('M100 128 C99 135 97 139 101 141 C103 141 104 140 105 139', 2.5);
    linea('M92 150 C97 152 103 152 108 150', 2.5);
    forma(circ(86, 182, 4) + ' ' + circ(95, 186, 4) + ' ' + circ(105, 186, 4) + ' ' + circ(114, 182, 4), T.anil);
  }),
};
