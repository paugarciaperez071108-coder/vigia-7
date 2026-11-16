// =============================================================
// PuntoN7.js — (v2.11, el usuario) EL PUNTO DE CONTROL DE LAS 3 AM DE LA NOCHE 7.
// Valores en NIGHT7.PUNTO (src/night/night7.js). Lo usa Game.js.
//
// Al dar las 3:00 —y solo si el núcleo llega al 100 %: si no llega, la noche ya se
// pierde a esa hora, así que nunca se guarda una partida imposible— se hace una FOTO
// de la noche tal como está (crea): el reloj, el reactor, la temperatura (sale de la
// hora), los enfriamientos, cada enemigo (la Aberración, El Dislocado, El Errante) y su
// nivel, la oficina (rejillas, cámaras rotas, saboteadas o quemadas, salas dañadas), el
// daño de cada puerta (el contador de las dos cerradas, a cero) y los sucesos ya
// ocurridos (la cinta, el monitor del Laboratorio, la estática del Errante, las frases
// de la grabadora…), que no se repiten. Va en la partida, aparte: flags.n7tres, con
// checkpoint 'n7tres'. Los datos de la historia (flags.slaimi, flags.erranteEnCabeza)
// no se tocan: viven fuera de la foto.
//
// Al cargarla (pon): la noche se vuelve a montar (startNight sin cinta) y se le ponen
// encima los datos de la foto. Un inicio justo (justo): unos segundos sin que ningún
// enemigo se mueva (Night7.margen) y nadie pegado a la oficina: si la Aberración estaba
// en el pasillo central, en la compuerta, en una puerta de un lado o en el pasillo de
// una de ellas, vuelve a su casa (el Laboratorio) con su espera de siempre; si El
// Dislocado estaba en la rejilla o en un conducto de la oficina, se va lejos con su
// tiempo de vuelta. Las puertas, abiertas y con las luces apagadas (su daño se queda).
//
// La foto copia SOLO datos (números, textos, listas, objetos simples, Set y Map) de
// cada parte; lo que es audio, imágenes o enlaces a otras partes se queda como lo deja
// startNight. Así no hay que ir campo por campo (y lo que se añada a la noche 7 entra solo).
// =============================================================

import { NIGHT7 } from '../night/night7.js';
import { VENTS } from '../world/StationMap.js';

const V = 1;                     // versión del formato de la foto
const P = () => NIGHT7.PUNTO;

/** ¿Es un dato que se puede guardar tal cual (sin clases, audio ni imágenes)? */
function plano(v, prof = 0) {
  if (v === null || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return true;
  if (prof > 7 || v === undefined || typeof v === 'function') return false;
  if (Array.isArray(v)) return v.every((x) => plano(x, prof + 1));
  if (v instanceof Set) return [...v].every((x) => plano(x, prof + 1));
  if (v instanceof Map) return [...v].every(([k, x]) => plano(k, prof + 1) && plano(x, prof + 1));
  if (typeof v === 'object') {
    const pr = Object.getPrototypeOf(v);
    if (pr !== Object.prototype && pr !== null) return false;
    return Object.values(v).every((x) => x === undefined || plano(x, prof + 1));
  }
  return false;
}

/** A JSON (los Set, Map e infinitos, marcados para volver). */
function copia(v) {
  if (typeof v === 'number' && !Number.isFinite(v)) return { __num: String(v) };
  if (v instanceof Set) return { __set: [...v].map(copia) };
  if (v instanceof Map) return { __map: [...v].map(([k, x]) => [copia(k), copia(x)]) };
  if (Array.isArray(v)) return v.map(copia);
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) if (x !== undefined) o[k] = copia(x);
    return o;
  }
  return v;
}

function vuelve(v) {
  if (Array.isArray(v)) return v.map(vuelve);
  if (v && typeof v === 'object') {
    if ('__num' in v) return Number(v.__num);
    if ('__set' in v) return new Set(v.__set.map(vuelve));
    if ('__map' in v) return new Map(v.__map.map(([k, x]) => [vuelve(k), vuelve(x)]));
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = vuelve(x);
    return o;
  }
  return v;
}

/** Los datos de un objeto (sin `fuera`; con `solo`, solo esos campos). */
export function foto(obj, { fuera = [], solo = null } = {}) {
  const d = {};
  if (!obj) return d;
  for (const [k, v] of Object.entries(obj)) {
    if (fuera.includes(k) || (solo && !solo.includes(k))) continue;
    if (plano(v)) d[k] = copia(v);
  }
  return d;
}

/** Pone los datos de la foto en el objeto. */
export function pon(obj, d) {
  if (!obj || !d) return;
  for (const [k, v] of Object.entries(d)) obj[k] = vuelve(v);
}

// Las partes de la noche que entran en la foto: [cómo llegar a ella, { fuera | solo }]
const PARTES = {
  clock: [(g) => g.clock, { solo: ['elapsed', 'lastHour'] }],
  reactor: [(g) => g.reactor, {}],
  n7: [(g) => g.n7, { fuera: ['active', 'musicaToken', 'bajada', 'fragTexto', 'slaimi', 'n6', 'parpadeo', 'avisoNivel', 'nivelAplicado',
    'puedeSaltar', 'sinEnemigos', 'margen', 'avisoPunto', 'arranque', 'cintaEspera', 'cintaVista', 'silencioT', 'fase'] }],
  ab: [(g) => g.n7.ab, { fuera: ['activa', 'lit'] }],
  rotura: [(g) => g.n7.rotura, { fuera: ['activa'] }],
  conductos: [(g) => g.n7.conductos, { fuera: ['activa', 'activo'] }],
  muerteDis: [(g) => g.n7.muerteDis, { fuera: ['on'] }],
  puertas: [(g) => g.n7.puertas, { fuera: ['activa'] }],
  cuerpo: [(g) => g.n7.cuerpo, {}],
  dislocado: [(g) => g.ai.dislocado, {}],
  errante: [(g) => g.ai.errante, {}],
  n5: [(g) => g.n5, { fuera: ['active'] }],
  cameras: [(g) => g.cameras, { solo: ['broken', 'breaking', 'warnings', 'saboteadas', 'ventsUnlocked'] }],
  office: [(g) => g.office, { solo: ['dano', 'atascada'] }],
  ofv2: [(g) => g.ofv2, { solo: ['hojaVar', 'hojaRota'] }],
};

/** La foto de la noche, ahora (para guardarla en flags.n7tres). */
export function crea(g) {
  const d = { v: V, hora: +(g.clock.elapsed / g.clock.sph).toFixed(3), cuando: new Date().toISOString(), partes: {} };
  for (const [nombre, [ruta, opts]] of Object.entries(PARTES)) {
    try {
      const obj = ruta(g);
      if (obj) d.partes[nombre] = foto(obj, opts);
    } catch { /* (una parte que no existe en esta noche: se deja) */ }
  }
  // (el contador de las dos puertas cerradas, a cero: se empieza con ellas abiertas)
  if (d.partes.puertas) {
    d.partes.puertas.cuenta = 0;
    d.partes.puertas.avisada = false;
    d.partes.puertas.empujonIn = 0;
    d.partes.puertas.abomba = { left: -1, right: -1 };
    d.partes.puertas.chispas = [];
    d.partes.puertas.cerradaDesde = { left: null, right: null };
  }
  return d;
}

/** ¿Es una foto que se puede cargar? */
export function valida(d) {
  return !!(d && d.v === V && d.partes && d.partes.clock && Number.isFinite(d.partes.clock.elapsed));
}

/** Pone la foto encima de una noche 7 recién empezada (sin cinta). Devuelve lo que ha hecho «justo». */
export function carga(g, d) {
  for (const [nombre, [ruta]] of Object.entries(PARTES)) {
    const datos = d.partes[nombre];
    if (!datos) continue;
    try { pon(ruta(g), datos); } catch { /* (una parte que ya no existe) */ }
  }
  const n7 = g.n7;
  n7.fase = 'noche';
  n7.arranque = false;              // (el primer momento de la noche no se repite: nada de «que vengan ya»)
  n7.nivelAplicado = null;          // (el nivel de esa hora se aplica sin aviso: no ha subido)
  n7.fragSonando = null;
  n7.fragTexto = null;
  return justo(g);
}

/** Un inicio justo: nadie pegado a la oficina, las puertas abiertas y unos segundos sin que se muevan. */
export function justo(g) {
  const hecho = [];
  const A = g.n7.ab;
  const cerca = ['pasillo', 'puerta', 'lado', 'westHall', 'eastHall', 'huye'];
  if (A && cerca.includes(A.sala)) {
    hecho.push(`la Aberración (${A.sala}${A.sala === 'pasillo' ? ' ' + A.pos : ''}) → su casa`);
    A.sala = NIGHT7.ABERRACION.CASA;
    A.ruta = null;
    A.paso = 0;
    A.pos = 0;
    A.objetivo = 'oficina';
    A.t = Math.max(P().ABERRACION_ESPERA, A._r?.('EN_CASA') ?? P().ABERRACION_ESPERA);
  }
  if (A) {
    A.luz = 0;
    A.luzRetro = 0;
    A.lit = false;
  }
  const D = g.ai.dislocado;
  if (D && (D.state === 'grille' || D.state === 'peek' || (D.state === 'vent' && VENTS[D.room]?.officeAccess))) {
    hecho.push(`El Dislocado (${D.state} ${D.room ?? ''}) → lejos`);
    D.state = 'away';
    D.room = null;
    D.side = null;
    D.lit = 0;
    D.attackT = 0;
  }
  if (D && D.state === 'away') D.returnIn = Math.max(Number.isFinite(D.returnIn) ? D.returnIn : 0, P().DISLOCADO_VUELVE);
  // Las puertas, abiertas y las luces apagadas (el daño de cada una se queda)
  const of = g.office;
  for (const s of ['left', 'right']) {
    const dr = of.doors?.[s];
    if (dr?.closed && of.toggleDoor) of.toggleDoor(s);
    if (dr) dr.closed = false;
  }
  of.setLightsOff?.();
  g.n7.margen = P().MARGEN;
  return hecho;
}
