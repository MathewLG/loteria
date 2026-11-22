// Prueba de carga: N jugadores simulados contra una sala.
//
// Uso:
//   node scripts/carga.mjs 5000 --escenario=entrada --salida=carga.json
//   node scripts/carga.mjs 2000 --escenario=reconexion --url=wss://loteria.example.workers.dev/ws
//
// Opciones:
//   --url=ws://localhost:8787/ws   dirección de la sala
//   --escenario=entrada            entrada (repartida en 30 s), reconexion o cupo
//   --procesos=N                   procesos hijos (por defecto uno por cada 1,000 clientes)
//   --entrada-s=30                 segundos para repartir las entradas
//   --duracion-s=600               tope de tiempo total
//   --pid=1234                     PID del servidor local para medir CPU y memoria
//   --salida=archivo.json          guarda el reporte completo
//
// Mide sin cambiar el protocolo: la latencia de difusión es la dispersión de llegada
// de cada carta entre todos los clientes (última llegada menos primera).

import { fork } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MOTIVO, T, decodificar, codificarLoteria, mascaraCantadas } from '../public/js/protocolo.js';
import { aHex } from '../public/js/baraja.js';

const ahora = () => performance.timeOrigin + performance.now();

// ---- Lectura de mensajes: el formato de ESTADO puede cambiar; solo se toca aquí ----
function leerEstado(m) {
  return {
    ronda: m.ronda,
    fase: m.fase,
    catalogo: m.catalogo,
    tabla: m.tabla,
    cantadas: m.cantadas,
    lugar: m.lugar ?? 0,
    // Pase firmado por la sala: al reconectar evita entrar como espectador.
    pase: m.pase ? { ronda: m.ronda, elegida: m.elegida ?? 0, hex: aHex(m.pase) } : null,
  };
}

function opciones(argv) {
  const o = { n: 500, url: 'ws://localhost:8787/ws', escenario: 'entrada', entradaS: 30, duracionS: 600, procesos: 0, salida: '', pid: 0 };
  for (const a of argv) {
    if (/^\d+$/.test(a)) o.n = Number(a);
    const [k, v] = a.replace(/^--/, '').split('=');
    if (k === 'url') o.url = v;
    if (k === 'escenario') o.escenario = v;
    if (k === 'entrada-s') o.entradaS = Number(v);
    if (k === 'duracion-s') o.duracionS = Number(v);
    if (k === 'procesos') o.procesos = Number(v);
    if (k === 'salida') o.salida = v;
    if (k === 'pid') o.pid = Number(v);
  }
  if (!['entrada', 'reconexion', 'cupo'].includes(o.escenario)) throw new Error(`Escenario desconocido: ${o.escenario}`);
  if (!o.procesos) o.procesos = Math.max(1, Math.ceil(o.n / 1000));
  return o;
}

const percentil = (valores, p) => {
  if (!valores.length) return null;
  const v = [...valores].sort((a, b) => a - b);
  return Math.round(v[Math.min(v.length - 1, Math.floor((p / 100) * v.length))] * 10) / 10;
};

// =====================================================================
// Proceso hijo: maneja un grupo de clientes
// =====================================================================
function hijo() {
  const { url, inicio, cuantos, escenario, entradaS } = JSON.parse(process.env.CARGA_CONFIG);
  const llegadas = {}; // "ronda:indice" -> [tiempos]
  const reclamos = []; // ms de LOTERIA a RESULTADO
  const cont = { conexiones: 0, fallidas: 0, desconexiones: 0, enviados: 0, ganadores: 0, rechazos: {} };
  let conectadosEn = Infinity; // lo avisa el padre
  let objetivo = 0; // ronda medida
  const primeraCarta = {}; // ronda -> tiempo
  const clientes = [];

  function crear(i) {
    const token = aHex(crypto.getRandomValues(new Uint8Array(16)));
    const c = { i, token, ws: null, e: null, cantadas: [], marcadas: 0, gritado: false, envio: 0, reconecta: i % 2 === 0, reconectado: false, vivo: false };
    clientes.push(c);
    conectar(c);
  }

  function conectar(c) {
    let ws;
    try {
      const p = c.e?.pase;
      ws = new WebSocket(`${url}?t=${c.token}${p ? `&r=${p.ronda}&e=${p.elegida}&p=${p.hex}` : ''}`);
    } catch {
      cont.fallidas += 1;
      return;
    }
    ws.binaryType = 'arraybuffer';
    c.ws = ws;
    ws.addEventListener('open', () => { cont.conexiones += 1; c.vivo = true; });
    ws.addEventListener('error', () => { if (!c.vivo) cont.fallidas += 1; });
    ws.addEventListener('close', () => {
      if (c.vivo && !c.cerrandoAPropósito) cont.desconexiones += 1;
      c.cerrandoAPropósito = false;
      c.vivo = false;
    });
    ws.addEventListener('message', (ev) => manejar(c, decodificar(ev.data)));
  }

  function manejar(c, m) {
    if (!m) return;
    const t = ahora();
    if (m.tipo === T.ESTADO) {
      c.e = leerEstado(m);
      c.cantadas = [...c.e.cantadas];
      c.marcadas = mascaraCantadas(c.e.tabla, c.cantadas);
      c.gritado = c.e.lugar > 0;
    } else if (m.tipo === T.CARTA) {
      if (!c.e || m.ronda !== c.e.ronda) return;
      const clave = `${m.ronda}:${m.indice}`;
      (llegadas[clave] ??= []).push(t);
      if (m.indice === 1 && !primeraCarta[m.ronda]) {
        primeraCarta[m.ronda] = t;
        if (!objetivo && t > conectadosEn) {
          objetivo = m.ronda;
          process.send({ tipo: 'objetivo', ronda: m.ronda });
        }
      }
      c.cantadas.push(m.carta);
      c.marcadas = mascaraCantadas(c.e.tabla, c.cantadas);
      if (escenario === 'reconexion' && m.ronda === objetivo && c.reconecta && !c.reconectado && m.indice === Math.floor(c.e.catalogo / 2)) {
        c.reconectado = true;
        c.cerrandoAPropósito = true;
        c.ws.close();
        setTimeout(() => conectar(c), Math.random() * 3000);
        return;
      }
      if (!c.gritado && c.marcadas === 0xffff) {
        c.gritado = true;
        // Reflejos humanos: tarda entre 0.3 y 2.5 s en gritar.
        setTimeout(() => {
          if (!c.vivo || c.ws.readyState !== WebSocket.OPEN) return;
          c.envio = ahora();
          c.envioRonda = c.e.ronda;
          c.ws.send(codificarLoteria(c.e.ronda, c.marcadas));
          if (c.e.ronda === objetivo) cont.enviados += 1;
        }, 300 + Math.random() * 2200);
      }
    } else if (m.tipo === T.RESULTADO) {
      const medida = c.envioRonda === objetivo;
      if (c.envio && medida) reclamos.push(t - c.envio);
      c.envio = 0;
      if (!medida) return;
      if (m.ok) cont.ganadores += 1;
      else cont.rechazos[m.motivo] = (cont.rechazos[m.motivo] ?? 0) + 1;
    } else if (m.tipo === T.FIN) {
      if (m.ronda === objetivo) process.send({ tipo: 'fin', ronda: m.ronda, ganadores: m.ganadores });
    }
  }

  process.on('message', (msg) => {
    if (msg.tipo === 'conectados') conectadosEn = msg.t;
    if (msg.tipo === 'objetivo' && !objetivo) objetivo = msg.ronda;
    if (msg.tipo === 'terminar') {
      const mias = {};
      for (const [clave, ts] of Object.entries(llegadas)) if (clave.startsWith(`${objetivo}:`)) mias[clave] = ts;
      process.send({ tipo: 'resultado', llegadas: mias, reclamos, cont, vivos: clientes.filter((c) => c.vivo).length });
      for (const c of clientes) { c.cerrandoAPropósito = true; try { c.ws?.close(); } catch { /* ya cerrada */ } }
      setTimeout(() => process.exit(0), 500);
    }
  });

  // Reparto de entradas en el tiempo según el escenario.
  const ventana = escenario === 'cupo' ? 2000 : entradaS * 1000;
  for (let k = 0; k < cuantos; k++) {
    const retraso = escenario === 'cupo' ? (k / cuantos) * ventana : Math.random() * ventana;
    setTimeout(() => {
      crear(inicio + k);
      if (clientes.length === cuantos) setTimeout(() => process.send({ tipo: 'listo' }), 1500);
    }, retraso);
  }
}

// =====================================================================
// Proceso padre: reparte, coordina y agrega
// =====================================================================
function cpuServidor(pid) {
  try {
    const campos = readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ');
    const ticks = Number(campos[11]) + Number(campos[12]);
    const rss = Number(readFileSync(`/proc/${pid}/statm`, 'utf8').split(' ')[1]) * 4096;
    return { ticks, rss };
  } catch {
    return null;
  }
}

async function padre() {
  const o = opciones(process.argv.slice(2));
  console.log(`Carga: ${o.n} clientes, escenario ${o.escenario}, ${o.procesos} procesos, contra ${o.url}`);
  const inicioPrueba = ahora();
  const hijos = [];
  const porHijo = Math.ceil(o.n / o.procesos);
  let listos = 0;
  let objetivo = 0;
  let finObjetivo = null;
  let resolverFin;
  const terminado = new Promise((r) => { resolverFin = r; });
  const muestrasCpu = [];
  const cpu0 = o.pid ? cpuServidor(o.pid) : null;
  const relojCpu = o.pid ? setInterval(() => { const m = cpuServidor(o.pid); if (m) muestrasCpu.push({ t: ahora(), ...m }); }, 1000) : null;

  for (let h = 0; h < o.procesos; h++) {
    const cuantos = Math.min(porHijo, o.n - h * porHijo);
    if (cuantos <= 0) break;
    const proceso = fork(fileURLToPath(import.meta.url), [], {
      env: { ...process.env, CARGA_ROL: 'hijo', CARGA_CONFIG: JSON.stringify({ url: o.url, inicio: h * porHijo, cuantos, escenario: o.escenario, entradaS: o.entradaS }) },
    });
    hijos.push(proceso);
    proceso.on('message', (msg) => {
      if (msg.tipo === 'listo') {
        listos += 1;
        if (listos === hijos.length) {
          const t = ahora();
          console.log(`Todos los clientes lanzados en ${((t - inicioPrueba) / 1000).toFixed(1)} s. Se mide la siguiente ronda completa.`);
          for (const p of hijos) p.send({ tipo: 'conectados', t });
        }
      }
      if (msg.tipo === 'objetivo' && !objetivo) {
        objetivo = msg.ronda;
        console.log(`Ronda medida: ${objetivo}`);
        for (const p of hijos) p.send({ tipo: 'objetivo', ronda: objetivo });
      }
      if (msg.tipo === 'fin' && !finObjetivo) {
        finObjetivo = msg;
        resolverFin();
      }
    });
  }

  const tope = setTimeout(() => { console.log('Se alcanzó el tope de tiempo.'); resolverFin(); }, o.duracionS * 1000);
  await terminado;
  clearTimeout(tope);
  // Unos segundos más para recoger las respuestas a reclamos enviados al final.
  await new Promise((r) => setTimeout(r, 3000));
  if (relojCpu) clearInterval(relojCpu);

  const resultados = await Promise.all(hijos.map((p) => new Promise((r) => {
    p.on('message', (msg) => { if (msg.tipo === 'resultado') r(msg); });
    p.send({ tipo: 'terminar' });
  })));

  // ---- Agregar ----
  const llegadas = {};
  const reclamos = [];
  const cont = { conexiones: 0, fallidas: 0, desconexiones: 0, enviados: 0, ganadores: 0, rechazos: {}, vivos: 0 };
  for (const r of resultados) {
    for (const [clave, ts] of Object.entries(r.llegadas)) (llegadas[clave] ??= []).push(...ts);
    reclamos.push(...r.reclamos);
    for (const k of ['conexiones', 'fallidas', 'desconexiones', 'enviados', 'ganadores']) cont[k] += r.cont[k];
    for (const [m, n] of Object.entries(r.cont.rechazos)) cont.rechazos[m] = (cont.rechazos[m] ?? 0) + n;
    cont.vivos += r.vivos;
  }
  const dispersiones = [];
  const retrasos = [];
  const recibidasPorCarta = [];
  for (const ts of Object.values(llegadas)) {
    const min = Math.min(...ts);
    dispersiones.push(Math.max(...ts) - min);
    for (const t of ts) retrasos.push(t - min);
    recibidasPorCarta.push(ts.length);
  }
  const cartas = Object.keys(llegadas).length;
  const nombreMotivo = Object.fromEntries(Object.entries(MOTIVO).map(([k, v]) => [v, k]));
  cont.rechazos = Object.fromEntries(Object.entries(cont.rechazos).map(([m, n]) => [nombreMotivo[m] ?? m, n]));

  // Cuota de Cloudflare: cada conexión WebSocket cuenta 1 solicitud; los mensajes entrantes 1 por cada 20;
  // los salientes son gratis. Cada alarma del Durable Object también cuenta 1 (una por carta, más espera y fin).
  const alarmasPorRonda = cartas + 2;
  const reconexiones = o.escenario === 'reconexion' ? Math.max(0, cont.conexiones - o.n) : 0;
  const porRondaEstable = alarmasPorRonda + Math.ceil(cont.enviados / 20) + reconexiones;
  const entradaInicial = o.n;
  const cuotaDiaria = 100000;
  const rondasPorDia = porRondaEstable > 0 ? Math.floor((cuotaDiaria - entradaInicial) / porRondaEstable) : null;

  let servidor = null;
  if (cpu0 && muestrasCpu.length) {
    const ultimo = muestrasCpu[muestrasCpu.length - 1];
    const segundos = (ultimo.t - inicioPrueba) / 1000;
    const hz = 100;
    servidor = {
      cpuPromedioPct: Math.round(((ultimo.ticks - cpu0.ticks) / hz / segundos) * 1000) / 10,
      cpuPicoPct: Math.max(...muestrasCpu.slice(1).map((m, i) => ((m.ticks - muestrasCpu[i].ticks) / hz) * 100)).toFixed(1),
      memoriaMaxMB: Math.round(Math.max(...muestrasCpu.map((m) => m.rss)) / 1048576),
    };
  }

  const reporte = {
    fecha: new Date().toISOString(),
    escenario: o.escenario,
    url: o.url,
    clientes: o.n,
    procesos: hijos.length,
    rondaMedida: objetivo || null,
    rondaCompleta: !!finObjetivo,
    conexiones: { exitosas: cont.conexiones, fallidas: cont.fallidas, desconexionesInesperadas: cont.desconexiones, vivasAlFinal: cont.vivos },
    cartas: { cantadasEnLaRonda: cartas, recepcionMinimaPorCarta: recibidasPorCarta.length ? Math.min(...recibidasPorCarta) : 0 },
    dispersionPorCartaMs: { p50: percentil(dispersiones, 50), p95: percentil(dispersiones, 95), p99: percentil(dispersiones, 99), max: dispersiones.length ? Math.round(Math.max(...dispersiones)) : null },
    retrasoPorClienteMs: { p50: percentil(retrasos, 50), p95: percentil(retrasos, 95), p99: percentil(retrasos, 99) },
    reclamos: { enviadosEnLaRonda: cont.enviados, ganadores: cont.ganadores, rechazos: cont.rechazos, respuestaMs: { p50: percentil(reclamos, 50), p95: percentil(reclamos, 95), p99: percentil(reclamos, 99) } },
    cuota: { entradaInicial, alarmasPorRonda, mensajesEntrantes: cont.enviados, reconexiones, solicitudesPorRonda: porRondaEstable, rondasPorDia, nota: 'Modelo: conexión WebSocket = 1, entrantes 1 por cada 20, salientes gratis, cada alarma = 1. Cuota gratuita: 100,000 solicitudes diarias.' },
    servidorLocal: servidor,
  };

  console.log('\n=== Resultados ===');
  console.log(`Conexiones: ${cont.conexiones} exitosas, ${cont.fallidas} fallidas, ${cont.desconexiones} desconexiones inesperadas`);
  console.log(`Ronda ${objetivo || '-'}: ${cartas} cartas; cada carta llegó como mínimo a ${reporte.cartas.recepcionMinimaPorCarta} clientes`);
  console.log(`Dispersión de llegada por carta: p50 ${reporte.dispersionPorCartaMs.p50} ms, p95 ${reporte.dispersionPorCartaMs.p95} ms, p99 ${reporte.dispersionPorCartaMs.p99} ms`);
  console.log(`Retraso de cada cliente contra el primero: p50 ${reporte.retrasoPorClienteMs.p50} ms, p95 ${reporte.retrasoPorClienteMs.p95} ms, p99 ${reporte.retrasoPorClienteMs.p99} ms`);
  console.log(`Reclamos: ${cont.enviados} enviados, ${cont.ganadores} ganadores; respuesta p50 ${reporte.reclamos.respuestaMs.p50} ms, p95 ${reporte.reclamos.respuestaMs.p95} ms; rechazos ${JSON.stringify(cont.rechazos)}`);
  console.log(`Cuota: ${porRondaEstable} solicitudes por ronda + ${entradaInicial} de entrada; caben ~${rondasPorDia} rondas al día`);
  if (servidor) console.log(`Servidor local: CPU promedio ${servidor.cpuPromedioPct}%, pico ${servidor.cpuPicoPct}%, memoria máx ${servidor.memoriaMaxMB} MB`);
  if (o.salida) {
    writeFileSync(o.salida, JSON.stringify(reporte, null, 2));
    console.log(`Reporte guardado en ${o.salida}`);
  }
  setTimeout(() => process.exit(0), 800);
}

if (process.env.CARGA_ROL === 'hijo') hijo();
else padre();
