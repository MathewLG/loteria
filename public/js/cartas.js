// Arte original de las cartas: grabado a cuatro tintas,
// con el color impreso 2.5 px fuera de la línea (registro corrido).

// Los 54 nombres y el orden de la lotería tradicional. El arte es propio:
// ninguna imagen copia los diseños de ninguna baraja comercial.
export const NOMBRES = [
  'El Gallo', 'El Diablito', 'La Dama', 'El Catrín', 'El Paraguas', 'La Sirena', 'La Escalera', 'La Botella',
  'El Barril', 'El Árbol', 'El Melón', 'El Valiente', 'El Gorrito', 'La Muerte', 'La Pera', 'La Bandera',
  'El Bandolón', 'El Violoncello', 'La Garza', 'El Pájaro', 'La Mano', 'La Bota', 'La Luna', 'El Cotorro',
  'El Borracho', 'El Negrito', 'El Corazón', 'La Sandía', 'El Tambor', 'El Camarón', 'Las Jaras', 'El Músico',
  'La Araña', 'El Soldado', 'La Estrella', 'El Cazo', 'El Mundo', 'El Apache', 'El Nopal', 'El Alacrán',
  'La Rosa', 'La Calavera', 'La Campana', 'El Cantarito', 'El Venado', 'El Sol', 'La Corona', 'La Chalupa',
  'El Pino', 'El Pescado', 'La Palma', 'La Maceta', 'El Arpa', 'La Rana',
];

/** Cartas que ya tienen arte. Las demás se ven con su número y "arte pendiente". */
const TINTA = '#1B1714';
const LINEA = `fill="none" stroke="${TINTA}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"`;
const rayos = (cierre) => Array.from({ length: 12 }, (_, i) =>
  `<path d="M-9 -44 L0 -72 L9 -44${cierre}" transform="rotate(${i * 30})"/>`).join('');

const ARTE = {
  1: `<g transform="translate(2.5 2)">
<path d="M62 168 C40 152 34 118 48 90 C54 112 62 126 74 134 Z" fill="#2F4F8F"/>
<path d="M60 162 C34 156 24 130 30 104 C42 124 52 138 70 146 Z" fill="#4E7A34"/>
<path d="M66 172 C46 176 30 166 24 148 C42 160 54 162 70 160 Z" fill="#2F4F8F"/>
<path d="M60 170 C55 135 75 115 100 118 C118 120 124 110 126 96 L140 98 C144 120 142 150 127 170 C112 190 76 192 60 170 Z" fill="#E3A21A"/>
<circle cx="133" cy="86" r="12" fill="#B8322A"/>
<path d="M123 76 C120 64 129 64 131 70 C132 61 141 63 140 70 C145 66 150 73 143 79 Z" fill="#B8322A"/>
<path d="M144 83 L157 88 L144 93 Z" fill="#E3A21A"/>
<path d="M138 96 C141 106 133 108 131 99 Z" fill="#B8322A"/>
<path d="M80 150 C90 134 113 137 119 152 C108 163 90 165 80 150 Z" fill="#B8322A"/>
</g><g ${LINEA}>
<path d="M62 168 C40 152 34 118 48 90 C54 112 62 126 74 134"/>
<path d="M60 162 C34 156 24 130 30 104 C42 124 52 138 70 146"/>
<path d="M66 172 C46 176 30 166 24 148 C42 160 54 162 70 160"/>
<path d="M60 170 C55 135 75 115 100 118 C118 120 124 110 126 96 L140 98 C144 120 142 150 127 170 C112 190 76 192 60 170 Z"/>
<circle cx="133" cy="86" r="12"/>
<path d="M123 76 C120 64 129 64 131 70 C132 61 141 63 140 70 C145 66 150 73 143 79"/>
<path d="M144 83 L157 88 L144 93"/>
<path d="M138 96 C141 106 133 108 131 99"/>
<path d="M80 150 C90 134 113 137 119 152 C108 163 90 165 80 150 Z"/>
<path d="M90 153 L109 149 M93 159 L110 156 M70 178 L76 172 M78 184 L84 178"/>
<path d="M95 186 L92 214 M111 186 L114 214 M83 216 L99 216 M107 216 L123 216"/>
<path d="M38 224 C80 219 122 227 166 221" stroke-width="3"/>
<circle cx="136" cy="83" r="2.2" fill="${TINTA}" stroke="none"/>
</g>`,

  23: `<g transform="translate(2.5 2)">
<circle cx="100" cy="140" r="72" fill="#2F4F8F"/>
<path d="M122 72 C80 78 60 112 66 148 C72 186 108 210 142 202 C110 194 90 170 90 140 C90 108 104 84 122 72 Z" fill="#E3A21A"/>
<path d="M148 92 L151 101 L160 104 L151 107 L148 116 L145 107 L136 104 L145 101 Z" fill="#FBF5E6"/>
<path d="M152 150 L154 157 L161 159 L154 161 L152 168 L150 161 L143 159 L150 157 Z" fill="#FBF5E6"/>
</g><g ${LINEA}>
<circle cx="100" cy="140" r="72"/>
<path d="M122 72 C80 78 60 112 66 148 C72 186 108 210 142 202 C110 194 90 170 90 140 C90 108 104 84 122 72 Z"/>
<path d="M76 128 C79 132 85 132 87 128 M80 160 C83 163 87 162 88 159"/>
<path d="M148 92 L151 101 L160 104 L151 107 L148 116 L145 107 L136 104 L145 101 Z" stroke-width="2"/>
<path d="M152 150 L154 157 L161 159 L154 161 L152 168 L150 161 L143 159 L150 157 Z" stroke-width="2"/>
<path d="M120 196 L130 186 M108 200 L118 190" stroke-width="3"/>
</g>`,

  46: `<g transform="translate(102.5 142)" fill="#B8322A">${rayos(' Z')}
<circle r="42" fill="#E3A21A"/><circle cx="-24" cy="8" r="6"/><circle cx="24" cy="8" r="6"/>
</g><g transform="translate(100 140)" ${LINEA}>${rayos('')}
<circle r="42"/>
<path d="M-20 -10 C-15 -16 -8 -16 -4 -10 M4 -10 C8 -16 15 -16 20 -10"/>
<path d="M0 -6 L-4 6 L3 6"/>
<path d="M-16 16 C-8 26 8 26 16 16"/>
</g>`,

  27: `<g transform="translate(2.5 2)">
<path d="M100 120 C88 104 94 88 100 70 C106 86 116 96 110 112 C108 117 104 119 100 120 Z" fill="#E3A21A"/>
<path d="M84 116 C74 106 76 94 80 86 C84 96 92 100 90 112 Z" fill="#E3A21A"/>
<path d="M116 116 C126 106 124 94 120 86 C116 96 108 100 110 112 Z" fill="#E3A21A"/>
<path d="M100 216 C60 186 44 160 50 132 C55 108 82 102 100 126 C118 102 145 108 150 132 C156 160 140 186 100 216 Z" fill="#B8322A"/>
<path d="M64 132 C66 122 74 118 82 119" stroke="#FBF5E6" stroke-width="5" fill="none" stroke-linecap="round"/>
</g><g ${LINEA}>
<path d="M100 120 C88 104 94 88 100 70 C106 86 116 96 110 112 C108 117 104 119 100 120 Z"/>
<path d="M84 116 C74 106 76 94 80 86 C84 96 92 100 90 112"/>
<path d="M116 116 C126 106 124 94 120 86 C116 96 108 100 110 112"/>
<path d="M100 216 C60 186 44 160 50 132 C55 108 82 102 100 126 C118 102 145 108 150 132 C156 160 140 186 100 216 Z"/>
<path d="M54 150 C78 164 122 164 146 150"/>
<path d="M68 154 L65 147 M84 160 L82 153 M100 162 L100 155 M116 160 L118 153 M132 154 L135 147" stroke-width="3"/>
<path d="M112 190 L122 180 M120 196 L132 184 M104 200 L112 192" stroke-width="3"/>
</g>`,

  28: `<g transform="translate(2.5 2) rotate(-12 100 150)">
<path d="M30 150 A70 70 0 0 0 170 150 Z" fill="#4E7A34"/>
<path d="M37 150 A63 63 0 0 0 163 150 Z" fill="#FBF5E6"/>
<path d="M44 150 A56 56 0 0 0 156 150 Z" fill="#B8322A"/>
</g><g transform="rotate(-12 100 150)" ${LINEA}>
<path d="M30 150 A70 70 0 0 0 170 150 Z"/>
<path d="M44 150 A56 56 0 0 0 156 150"/>
<path d="M50 190 L45 196 M70 210 L67 217 M100 218 L100 225 M130 210 L133 217 M150 190 L155 196" stroke-width="2.5"/>
<g fill="${TINTA}" stroke="none">
<ellipse cx="72" cy="164" rx="3" ry="5" transform="rotate(-30 72 164)"/>
<ellipse cx="100" cy="164" rx="3" ry="5"/>
<ellipse cx="128" cy="164" rx="3" ry="5" transform="rotate(30 128 164)"/>
<ellipse cx="86" cy="184" rx="3" ry="5" transform="rotate(-15 86 184)"/>
<ellipse cx="114" cy="184" rx="3" ry="5" transform="rotate(15 114 184)"/>
<ellipse cx="100" cy="196" rx="3" ry="5"/>
</g></g>`,

  39: `<g transform="translate(2.5 2)">
<ellipse cx="66" cy="118" rx="21" ry="30" transform="rotate(-28 66 118)" fill="#4E7A34"/>
<ellipse cx="134" cy="116" rx="21" ry="30" transform="rotate(28 134 116)" fill="#4E7A34"/>
<ellipse cx="100" cy="172" rx="30" ry="42" fill="#4E7A34"/>
<ellipse cx="56" cy="86" rx="7" ry="9" transform="rotate(-20 56 86)" fill="#B8322A"/>
<ellipse cx="146" cy="84" rx="7" ry="9" transform="rotate(20 146 84)" fill="#B8322A"/>
<ellipse cx="100" cy="124" rx="7" ry="9" fill="#B8322A"/>
</g><g ${LINEA}>
<ellipse cx="66" cy="118" rx="21" ry="30" transform="rotate(-28 66 118)"/>
<ellipse cx="134" cy="116" rx="21" ry="30" transform="rotate(28 134 116)"/>
<ellipse cx="100" cy="172" rx="30" ry="42"/>
<ellipse cx="56" cy="86" rx="7" ry="9" transform="rotate(-20 56 86)"/>
<ellipse cx="146" cy="84" rx="7" ry="9" transform="rotate(20 146 84)"/>
<ellipse cx="100" cy="124" rx="7" ry="9"/>
<path d="M90 158 L94 154 M108 174 L112 170 M94 192 L98 188 M108 148 L112 144 M62 110 L66 106 M70 128 L74 124 M130 108 L134 104 M138 126 L142 122" stroke-width="2.5"/>
<path d="M40 216 C80 212 120 218 160 214" stroke-width="3"/>
</g>`,

  50: `<g transform="translate(2.5 2)">
<path d="M98 110 C106 92 124 94 128 114 Z" fill="#B8322A"/>
<path d="M42 140 C68 104 120 104 146 134 L176 110 L169 140 L176 170 L146 146 C120 176 68 176 42 140 Z" fill="#2F4F8F"/>
<path d="M50 148 C72 168 116 170 142 144 C116 158 76 158 50 148 Z" fill="#E3A21A"/>
<circle cx="64" cy="134" r="7" fill="#FBF5E6"/>
</g><g ${LINEA}>
<path d="M98 110 C106 92 124 94 128 114"/>
<path d="M42 140 C68 104 120 104 146 134 L176 110 L169 140 L176 170 L146 146 C120 176 68 176 42 140 Z"/>
<path d="M50 148 C72 168 116 170 142 144" stroke-width="2.5"/>
<circle cx="64" cy="134" r="7"/>
<circle cx="65" cy="134" r="2.5" fill="${TINTA}" stroke="none"/>
<path d="M80 118 C88 132 88 148 80 162"/>
<path d="M96 124 q6 8 12 0 M110 124 q6 8 12 0 M102 136 q6 8 12 0 M116 136 q6 8 12 0 M124 124 q6 8 12 0" stroke-width="2.5"/>
<path d="M152 138 L166 128 M152 142 L166 152" stroke-width="2.5"/>
<path d="M40 205 C55 198 70 212 85 205 C100 198 115 212 130 205 C145 198 155 210 165 205" stroke-width="3"/>
<circle cx="40" cy="110" r="4" stroke-width="2.5"/>
<circle cx="32" cy="96" r="3" stroke-width="2.5"/>
</g>`,

  42: `<g transform="translate(2.5 2)">
<path d="M68 112 C68 80 132 80 132 112 C132 130 126 138 122 142 L122 160 L78 160 L78 142 C74 138 68 130 68 112 Z" fill="#FBF5E6"/>
<circle cx="78" cy="88" r="12" fill="#E3A21A"/><circle cx="122" cy="88" r="12" fill="#E3A21A"/>
<circle cx="100" cy="80" r="13" fill="#B8322A"/>
<circle cx="76" cy="132" r="5" fill="#B8322A"/><circle cx="124" cy="132" r="5" fill="#B8322A"/>
</g><g ${LINEA}>
<path d="M58 208 L142 180" stroke-width="15"/><path d="M58 180 L142 208" stroke-width="15"/>
<path d="M58 208 L142 180" stroke="#FBF5E6" stroke-width="8"/><path d="M58 180 L142 208" stroke="#FBF5E6" stroke-width="8"/>
<path d="M68 112 C68 80 132 80 132 112 C132 130 126 138 122 142 L122 160 L78 160 L78 142 C74 138 68 130 68 112 Z" fill="#FBF5E6"/>
<circle cx="78" cy="88" r="12" fill="#E3A21A"/><circle cx="122" cy="88" r="12" fill="#E3A21A"/>
<circle cx="100" cy="80" r="13" fill="#B8322A"/>
<path d="M78 80 L78 84 M86 88 L82 88 M78 96 L78 92 M70 88 L74 88 M122 80 L122 84 M130 88 L126 88 M122 96 L122 92 M114 88 L118 88 M100 71 L100 75 M109 80 L105 80 M100 89 L100 85 M91 80 L95 80" stroke-width="2.5"/>
<path d="M80 112 C80 102 96 102 96 114 C96 122 82 124 80 112 Z" fill="${TINTA}"/>
<path d="M104 114 C104 102 120 102 120 112 C118 124 104 122 104 114 Z" fill="${TINTA}"/>
<path d="M100 124 L95 134 L105 134 Z" fill="${TINTA}"/>
<path d="M86 146 L114 146 M90 146 L90 158 M97 146 L97 158 M104 146 L104 158 M111 146 L111 158" stroke-width="2.5"/>
<circle cx="76" cy="132" r="5" stroke-width="2.5"/><circle cx="124" cy="132" r="5" stroke-width="2.5"/>
</g>`,

  41: `<g transform="translate(2.5 2)">
<path d="M100 136 C97 170 104 196 100 228" stroke="#4E7A34" stroke-width="8" fill="none" stroke-linecap="round"/>
<path d="M100 172 C82 160 66 164 58 176 C74 182 88 182 100 172 Z" fill="#4E7A34"/>
<path d="M101 196 C118 182 136 186 144 198 C128 206 112 204 101 196 Z" fill="#4E7A34"/>
<path d="M100 72 C124 72 134 92 130 110 C126 128 110 136 100 136 C86 136 70 126 70 106 C70 88 82 72 100 72 Z" fill="#B8322A"/>
</g><g ${LINEA}>
<path d="M100 136 C97 170 104 196 100 228"/>
<path d="M99 150 L93 146 M102 212 L108 208" stroke-width="3"/>
<path d="M100 172 C82 160 66 164 58 176 C74 182 88 182 100 172 Z"/>
<path d="M101 196 C118 182 136 186 144 198 C128 206 112 204 101 196 Z"/>
<path d="M60 176 C76 174 88 174 100 172 M144 198 C128 196 114 196 101 196" stroke-width="2.5"/>
<path d="M100 72 C124 72 134 92 130 110 C126 128 110 136 100 136 C86 136 70 126 70 106 C70 88 82 72 100 72 Z"/>
<path d="M101 104 C107 100 112 106 108 112 C102 120 90 114 92 104 C95 92 114 90 118 104 C122 120 104 130 90 124"/>
<path d="M74 96 C82 98 86 106 84 116 M126 96 C118 100 116 108 120 116" stroke-width="3"/>
</g>`,

  44: `<g transform="translate(2.5 2)">
<path d="M134 104 C162 100 166 134 146 148" stroke="#E3A21A" stroke-width="10" fill="none"/>
<path d="M82 80 L118 80 L115 93 C148 106 156 150 140 184 C130 204 70 204 60 184 C44 150 52 106 85 93 Z" fill="#E3A21A"/>
<path d="M56 140 C70 132 80 148 92 140 C104 132 114 148 126 140 C136 134 142 142 146 140" stroke="#2F4F8F" stroke-width="7" fill="none" stroke-linecap="round"/>
</g><g ${LINEA}>
<path d="M134 99 C166 93 172 138 146 153 M136 110 C158 107 160 130 146 142" stroke-width="3"/>
<path d="M82 80 L118 80 L115 93 C148 106 156 150 140 184 C130 204 70 204 60 184 C44 150 52 106 85 93 Z"/>
<ellipse cx="100" cy="80" rx="18" ry="5"/>
<g fill="${TINTA}" stroke="none"><circle cx="70" cy="160" r="2.4"/><circle cx="85" cy="166" r="2.4"/><circle cx="100" cy="168" r="2.4"/><circle cx="115" cy="166" r="2.4"/><circle cx="130" cy="160" r="2.4"/></g>
<path d="M132 120 L140 128 M136 160 L142 166 M126 182 L132 188" stroke-width="3"/>
<path d="M64 208 C80 212 120 212 136 208" stroke-width="3"/>
</g>`,

  43: `<g transform="translate(2.5 2)">
<path d="M100 82 C76 82 70 112 68 150 C66 172 58 182 50 190 L150 190 C142 182 134 172 132 150 C130 112 124 82 100 82 Z" fill="#E3A21A"/>
<path d="M48 190 L152 190 L152 200 L48 200 Z" fill="#B8322A"/>
<circle cx="100" cy="211" r="9" fill="#2F4F8F"/>
</g><g ${LINEA}>
<circle cx="100" cy="74" r="8"/>
<path d="M100 82 C76 82 70 112 68 150 C66 172 58 182 50 190 L150 190 C142 182 134 172 132 150 C130 112 124 82 100 82 Z"/>
<path d="M48 190 L152 190 L152 200 L48 200 Z"/>
<circle cx="100" cy="211" r="9"/>
<path d="M68 150 C88 156 112 156 132 150" stroke-width="3"/>
<path d="M118 110 L124 116 M120 130 L128 138 M120 152 L130 162" stroke-width="3"/>
<path d="M36 120 C30 132 30 148 36 160 M26 112 C18 130 18 150 26 168 M164 120 C170 132 170 148 164 160 M174 112 C182 130 182 150 174 168" stroke-width="3"/>
</g>`,

  35: `<g transform="translate(2.5 2)">
<path d="M100 75 L115.9 118.2 L161.8 119.9 L125.7 148.3 L138.2 192.6 L100 167 L61.8 192.6 L74.3 148.3 L38.2 119.9 L84.1 118.2 Z" fill="#E3A21A"/>
<g fill="#B8322A">
<path d="M100 140 L100 75 L115.9 118.2 Z"/><path d="M100 140 L161.8 119.9 L125.7 148.3 Z"/>
<path d="M100 140 L138.2 192.6 L100 167 Z"/><path d="M100 140 L61.8 192.6 L74.3 148.3 Z"/>
<path d="M100 140 L38.2 119.9 L84.1 118.2 Z"/>
</g></g><g ${LINEA}>
<path d="M100 75 L115.9 118.2 L161.8 119.9 L125.7 148.3 L138.2 192.6 L100 167 L61.8 192.6 L74.3 148.3 L38.2 119.9 L84.1 118.2 Z"/>
<path d="M100 140 L100 75 M100 140 L161.8 119.9 M100 140 L138.2 192.6 M100 140 L61.8 192.6 M100 140 L38.2 119.9 M100 140 L115.9 118.2 M100 140 L125.7 148.3 M100 140 L100 167 M100 140 L74.3 148.3 M100 140 L84.1 118.2" stroke-width="2.5"/>
<path d="M100 60 L100 48 M172 112 L183 108 M146 204 L152 213 M54 204 L48 213 M28 112 L17 108" stroke-width="3"/>
</g>`,

  7: `<g transform="translate(2.5 2)" fill="#E3A21A">
<path d="M70 225 L80 225 L93 60 L83 60 Z"/><path d="M120 225 L130 225 L143 60 L133 60 Z"/>
<path d="M82 196.5 L122 196.5 L122 203.5 L82 203.5 Z"/><path d="M84.2 168.5 L124.2 168.5 L124.2 175.5 L84.2 175.5 Z"/>
<path d="M86.4 140.5 L126.4 140.5 L126.4 147.5 L86.4 147.5 Z"/><path d="M88.6 112.5 L128.6 112.5 L128.6 119.5 L88.6 119.5 Z"/>
<path d="M90.8 84.5 L130.8 84.5 L130.8 91.5 L90.8 91.5 Z"/>
</g><g ${LINEA}>
<path d="M70 225 L80 225 L93 60 L83 60 Z"/><path d="M120 225 L130 225 L143 60 L133 60 Z"/>
<path d="M82 196.5 L122 196.5 M82 203.5 L122 203.5 M84.2 168.5 L124.2 168.5 M84.2 175.5 L124.2 175.5 M86.4 140.5 L126.4 140.5 M86.4 147.5 L126.4 147.5 M88.6 112.5 L128.6 112.5 M88.6 119.5 L128.6 119.5 M90.8 84.5 L130.8 84.5 M90.8 91.5 L130.8 91.5" stroke-width="3"/>
<path d="M76 200 L77.5 182 M88 110 L89.5 92 M126 205 L127.5 187 M138 100 L139 88" stroke-width="2"/>
<path d="M40 227 L170 227" stroke-width="3"/>
<path d="M54 227 L48 235 M74 227 L68 235 M94 227 L88 235 M114 227 L108 235 M134 227 L128 235 M154 227 L148 235" stroke-width="2.5"/>
</g>`,

  5: `<g stroke="#2F4F8F" stroke-width="3" stroke-linecap="round">
<path d="M40 52 L34 66 M70 40 L64 54 M152 46 L146 60 M172 84 L166 98 M30 150 L24 164 M164 176 L158 190 M40 196 L34 210"/>
</g><g transform="translate(2.5 2) rotate(-14 100 140)">
<path d="M40 122 C55 72 145 72 160 122 Q145 110 130 122 Q115 110 100 122 Q85 110 70 122 Q55 110 40 122 Z" fill="#B8322A"/>
<path d="M100 80 L70 122 Q85 110 100 122 Q115 110 130 122 Z" fill="#E3A21A"/>
</g><g transform="rotate(-14 100 140)" ${LINEA}>
<path d="M40 122 C55 72 145 72 160 122 Q145 110 130 122 Q115 110 100 122 Q85 110 70 122 Q55 110 40 122 Z"/>
<path d="M100 80 L70 122 M100 80 L130 122 M100 80 L100 122" stroke-width="3"/>
<path d="M100 80 L100 66"/>
<path d="M100 122 L100 206 C100 220 84 222 82 208"/>
</g>`,

  52: `<g transform="translate(2.5 2)">
<g stroke="#4E7A34" stroke-width="6" fill="none" stroke-linecap="round"><path d="M100 150 L100 89 M100 150 C94 130 84 116 78 110 M100 150 C106 130 116 116 122 110"/></g>
<path d="M100 150 C88 136 76 136 70 142 C80 150 90 152 100 150 Z" fill="#4E7A34"/>
<path d="M100 150 C112 134 126 134 132 142 C120 150 110 152 100 150 Z" fill="#4E7A34"/>
<circle cx="76" cy="100" r="14" fill="#B8322A"/><circle cx="124" cy="100" r="14" fill="#B8322A"/>
<circle cx="100" cy="76" r="15" fill="#2F4F8F"/>
<circle cx="76" cy="100" r="5" fill="#E3A21A"/><circle cx="124" cy="100" r="5" fill="#E3A21A"/><circle cx="100" cy="76" r="5" fill="#E3A21A"/>
<path d="M70 166 L130 166 L122 226 L78 226 Z" fill="#E3A21A"/>
<path d="M62 152 L138 152 L138 166 L62 166 Z" fill="#B8322A"/>
</g><g ${LINEA}>
<path d="M100 150 L100 91 M100 150 C94 130 84 116 79 112 M100 150 C106 130 116 116 121 112" stroke-width="3"/>
<path d="M100 150 C88 136 76 136 70 142 C80 150 90 152 100 150 Z"/>
<path d="M100 150 C112 134 126 134 132 142 C120 150 110 152 100 150 Z"/>
<circle cx="76" cy="100" r="14"/><circle cx="124" cy="100" r="14"/><circle cx="100" cy="76" r="15"/>
<path d="M80 96 L86 90 M72 96 L66 90 M72 104 L66 110 M80 104 L86 110 M128 96 L134 90 M120 96 L114 90 M120 104 L114 110 M128 104 L134 110 M104 72 L110 66 M96 72 L90 66 M96 80 L90 86 M104 80 L110 86" stroke-width="2.5"/>
<path d="M70 166 L130 166 L122 226 L78 226 Z"/>
<path d="M62 152 L138 152 L138 166 L62 166 Z"/>
<path d="M76 196 L82 190 L88 196 L94 190 L100 196 L106 190 L112 196 L118 190 L124 196" stroke-width="3"/>
</g>`,
};

const BASE = `<rect x="1" y="1" width="198" height="298" rx="10" fill="${TINTA}"/>
<rect x="7" y="7" width="186" height="286" rx="5" fill="#F3E7CB"/>`;

function marco(numero, nombre) {
  return `<rect x="12" y="12" width="176" height="276" rx="3" fill="none" stroke="${TINTA}" stroke-width="1.5"/>
<path d="M12 12 L54 12 L12 54 Z M188 12 L180 12 L188 20 Z" fill="${TINTA}"/>
<text x="17" y="31" font-family="'Alfa Slab One', serif" font-size="15" fill="#F3E7CB">${numero}</text>
<rect x="12" y="246" width="176" height="42" fill="#F3E7CB"/>
<path d="M12 246 L188 246" stroke="${TINTA}" stroke-width="2.5"/>
<path d="M188 288 L180 288 L188 280 Z M12 288 L20 288 L12 280 Z" fill="${TINTA}"/>
<text x="100" y="275" text-anchor="middle" font-family="'Alfa Slab One', serif" font-size="${nombre.length > 12 ? 16 : 20}" fill="${TINTA}">${nombre}</text>`;
}

const PENDIENTE = (n) => `<text x="102.5" y="160" text-anchor="middle" font-family="'Alfa Slab One', serif" font-size="72" fill="#E3A21A">${n}</text>
<text x="100" y="158" text-anchor="middle" font-family="'Alfa Slab One', serif" font-size="72" fill="none" stroke="${TINTA}" stroke-width="3">${n}</text>
<text x="100" y="196" text-anchor="middle" font-family="'Atkinson Hyperlegible', sans-serif" font-size="15" fill="#4A3F36">arte pendiente</text>`;

/** SVG completo de una carta, sin texto accesible: quien lo usa pone su propia etiqueta. */
export function svgCarta(n) {
  return `<svg class="carta" viewBox="0 0 200 300" aria-hidden="true" focusable="false">${BASE}${ARTE[n] ?? PENDIENTE(n)}${marco(n, NOMBRES[n - 1].toUpperCase())}</svg>`;
}

/** Reverso para la espera entre rondas: muestra la cuenta regresiva. */
export function svgReverso(texto) {
  return `<svg class="carta" viewBox="0 0 200 300" aria-hidden="true" focusable="false">${BASE}
<rect x="12" y="12" width="176" height="276" rx="3" fill="none" stroke="${TINTA}" stroke-width="1.5"/>
<path d="M12 12 L54 12 L12 54 Z M188 12 L146 12 L188 54 Z M12 288 L54 288 L12 246 Z M188 288 L146 288 L188 246 Z" fill="${TINTA}"/>
<text x="102.5" y="177" text-anchor="middle" font-family="'Alfa Slab One', serif" font-size="96" fill="#B8322A">${texto}</text>
<text x="100" y="175" text-anchor="middle" font-family="'Alfa Slab One', serif" font-size="96" fill="none" stroke="${TINTA}" stroke-width="3">${texto}</text>
</svg>`;
}

export const SVG_FRIJOL = `<svg viewBox="0 0 40 26" aria-hidden="true" focusable="false"><path d="M5 14 C3 6 11 1 19 3 C25 4 27 8 31 6 C36 4 39 10 37 16 C34 23 24 25 16 23 C9 22 6 19 5 14 Z" fill="#C99A6B" stroke="${TINTA}" stroke-width="1.8"/><ellipse cx="12" cy="12" rx="2.2" ry="1.4" fill="#6B3F26"/><ellipse cx="18" cy="17" rx="1.8" ry="1.2" fill="#6B3F26"/><ellipse cx="26" cy="15" rx="2.4" ry="1.5" fill="#6B3F26"/><ellipse cx="31" cy="12" rx="1.5" ry="1" fill="#6B3F26"/><ellipse cx="14" cy="19" rx="1.3" ry="0.9" fill="#6B3F26"/><ellipse cx="22" cy="10" rx="1.4" ry="1" fill="#6B3F26"/><path d="M24 7 C26 9 28 9 30 7.5" stroke="#F3E7CB" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M9 11 C11 8 14 7 17 7" stroke="#F3E7CB" stroke-opacity="0.7" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>`;
