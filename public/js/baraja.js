// Baraja verificable. Este archivo lo usan el servidor y el navegador,
// por eso no depende de crypto.subtle (no existe en http fuera de localhost).

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const ror = (x, n) => (x >>> n) | (x << (32 - n));
const rol = (x, n) => (x << n) | (x >>> (32 - n));

/** SHA-256 de un Uint8Array. */
export function sha256(datos) {
  const largo = datos.length;
  const relleno = ((largo + 9 + 63) >> 6) << 6;
  const m = new Uint8Array(relleno);
  m.set(datos);
  m[largo] = 0x80;
  const dv = new DataView(m.buffer);
  const bits = largo * 8;
  dv.setUint32(relleno - 8, Math.floor(bits / 0x100000000));
  dv.setUint32(relleno - 4, bits >>> 0);

  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const W = new Uint32Array(64);
  for (let off = 0; off < relleno; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const x = W[i - 15];
      const y = W[i - 2];
      const s0 = ror(x, 7) ^ ror(x, 18) ^ (x >>> 3);
      const s1 = ror(y, 17) ^ ror(y, 19) ^ (y >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let i = 0; i < 64; i++) {
      const S1 = ror(e, 6) ^ ror(e, 11) ^ ror(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) | 0;
      const S0 = ror(a, 2) ^ ror(a, 13) ^ ror(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0;
      d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d;
    H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  const salida = new Uint8Array(32);
  const dvs = new DataView(salida.buffer);
  for (let i = 0; i < 8; i++) dvs.setUint32(i * 4, H[i]);
  return salida;
}

function cuarto(s, a, b, c, d) {
  s[a] = (s[a] + s[b]) | 0; s[d] = rol(s[d] ^ s[a], 16);
  s[c] = (s[c] + s[d]) | 0; s[b] = rol(s[b] ^ s[c], 12);
  s[a] = (s[a] + s[b]) | 0; s[d] = rol(s[d] ^ s[a], 8);
  s[c] = (s[c] + s[d]) | 0; s[b] = rol(s[b] ^ s[c], 7);
}

/** Un bloque de 64 bytes de ChaCha20 (RFC 8439). */
export function chacha20Bloque(llave, contador, nonce = new Uint8Array(12)) {
  const kv = new DataView(llave.buffer, llave.byteOffset, 32);
  const nv = new DataView(nonce.buffer, nonce.byteOffset, 12);
  const ini = new Uint32Array(16);
  ini[0] = 0x61707865; ini[1] = 0x3320646e; ini[2] = 0x79622d32; ini[3] = 0x6b206574;
  for (let i = 0; i < 8; i++) ini[4 + i] = kv.getUint32(i * 4, true);
  ini[12] = contador >>> 0;
  for (let i = 0; i < 3; i++) ini[13 + i] = nv.getUint32(i * 4, true);
  const s = new Uint32Array(ini);
  for (let r = 0; r < 10; r++) {
    cuarto(s, 0, 4, 8, 12); cuarto(s, 1, 5, 9, 13); cuarto(s, 2, 6, 10, 14); cuarto(s, 3, 7, 11, 15);
    cuarto(s, 0, 5, 10, 15); cuarto(s, 1, 6, 11, 12); cuarto(s, 2, 7, 8, 13); cuarto(s, 3, 4, 9, 14);
  }
  const salida = new Uint8Array(64);
  const sv = new DataView(salida.buffer);
  for (let i = 0; i < 16; i++) sv.setUint32(i * 4, (s[i] + ini[i]) >>> 0, true);
  return salida;
}

/** Generador de enteros de 32 bits a partir del flujo de ChaCha20. */
function generador(semilla) {
  let contador = 0;
  let bloque = null;
  let pos = 64;
  return function u32() {
    if (pos >= 64) {
      bloque = new DataView(chacha20Bloque(semilla, contador++).buffer);
      pos = 0;
    }
    const x = bloque.getUint32(pos, true);
    pos += 4;
    return x;
  };
}

/** Entero uniforme en [0, m) sin sesgo de módulo. */
function uniforme(u32, m) {
  const limite = 0x100000000 - (0x100000000 % m);
  let x;
  do { x = u32(); } while (x >= limite);
  return x % m;
}

/** Revuelve las cartas 1..n con Fisher-Yates. Misma semilla, mismo orden, en cualquier lugar. */
export function barajar(semilla, n) {
  const u32 = generador(semilla);
  const cartas = Array.from({ length: n }, (_, i) => i + 1);
  for (let i = n - 1; i > 0; i--) {
    const j = uniforme(u32, i + 1);
    const t = cartas[i]; cartas[i] = cartas[j]; cartas[j] = t;
  }
  return cartas;
}

const codificador = new TextEncoder();

/** La tabla de un jugador sale de su token y la ronda: no hay que guardarla en ningún lado. */
export function tablaDe(token, ronda, catalogo) {
  return barajar(sha256(codificador.encode(`tabla:${token}:${ronda}`)), catalogo).slice(0, 16);
}

export function aHex(bytes) {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

export function deHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export function igualesBytes(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
