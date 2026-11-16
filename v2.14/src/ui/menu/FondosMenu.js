// =============================================================
// FondosMenu.js — (v2.13–v2.14) El fondo del menú según la noche que toca jugar (plan
// informes/2026-11-16_09-36_plan-fondos-menu-por-noche.md).
//
// Manda la noche que se va a jugar (la siguiente a la última completada); sin partida, la Noche 1; con la noche 7
// superada, el del juego completado. Cada fondo es un render de su sala (tools/3d/menu/fondo_noche.py →
// integrar_fondos.py → assets/menu/<dir>/) con algo que se mueve poco, hecho en el motor o con pocas capas (nada de
// vídeos ni bucles con salto), una pista del enemigo de esa noche sin enseñarlo, su sonido (muy bajo, por debajo de la
// música) y un evento raro (1 de cada 20 veces que se abre el menú, o tras 90 s sin tocar nada; breve, sin sonido
// fuerte). Encima, la zona oscura detrás del título y los botones; el título, teñido del color de esa noche. Al
// cambiar de fondo, un fundido. Con 3 estrellas, en OPCIONES se puede elegir cualquier fondo ya visto o el clásico.
//
//   n1   la oficina (v2.13): el planeta que gira, la consola, la luz que parpadea · sin pista · sin sonido propio
//   n2   el Invernadero: una planta seca que se balancea y gotas · la rejilla arrancada y arañazos finos · goteo
//   n3   el pasillo central: la lámpara del fondo parpadea · la cámara rota colgando y el techo abollado · zumbido
//   n4   las taquillas: la puerta entreabierta se mueve · el piloto del panel de reinicio · crujidos del casco
//   n5   Comunicaciones: estática en los monitores (en uno, la sala vacía; a veces, una figura de pie) · estática
//   n6   el conducto: polvo en la luz de la rejilla, la chapa vibra · arrastre y huellas de manos · chapa
//   n7   el reactor: la alarma roja late, niebla baja · la consola al límite · un latido grave
//   fin  la oficina destrozada: ceniza, luz de emergencia, el planeta; si Slaimi vive, una luz pequeña fuera del ventanal
// =============================================================

import { CONFIG } from '../../config.js';
import { Random } from '../../core/Random.js';
import { colorDe } from '../../core/Colores.js';
import { SaveData, slaimiDe } from '../../core/SaveData.js';
import { ExtrasProgreso } from '../../core/ExtrasProgreso.js';

const RUTA = 'assets/menu/';
const CLAVE = 'vigia7.menuFondo';           // el último fondo enseñado (para el fundido al cambiar)
const CLAVE_ELEGIDO = 'vigia7.menuFondoElegido';   // (v2.14) el elegido en OPCIONES (con 3 estrellas)
const FUNDIDO = 2.5;                        // s
const RARO = { PROB: 1 / 20, QUIETO: 90, DESPUES: [5, 14] };
const TITULO = '#e8eef5';
export const ORDEN_FONDOS = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'fin'];

// Cada fondo: su carpeta, el color del título (el del enemigo de esa noche; null = sin tinte), lo oscuro (cada noche
// un poco más), las zonas oscuras detrás del texto, el polvo, lo que se mueve, su sonido y su evento raro.
//   sonido: [{ clave, cada: [s, s], vol }] sueltos; bucle: { clave, vol }; los que van con algo (la gota, el latido…)
//   los pide el propio fondo.
export const FONDOS = {
  n1: {
    dir: 'n1',
    color: null,                            // (Noche 1: «todo parece tranquilo», sin tinte)
    oscuro: 0,
    izq: [0.8, 0.5],                        // la zona oscura de la izquierda: alfa en x = 0 y en x = 490
    esquina: 0.72,
    polvo: { n: 80, luz: [1110, 300], radio: 650 },
    planeta: { vel: 0.08 },                 // grados por segundo
    consola: true,
    parpadeo: true,
    // (la cámara está en el umbral de la compuerta de atrás: alguien pasa por el pasillo, detrás, y su sombra cruza el
    // suelo de la oficina; dentro del umbral de la izquierda no se notaba: allí ya está oscuro)
    raro: { tipo: 'sombra', dur: 1.7 },
  },
  n2: {
    dir: 'n2', color: 'insecto', oscuro: 0.03, izq: [0.82, 0.52], esquina: 0.72,
    polvo: { n: 90, luz: [880, 420], radio: 620 },
    capas: ['hoja'], hoja: { grados: 1.3, periodo: 5.5 }, gotas: true,
    raro: { tipo: 'gota', dur: 2.2 },        // las plantas se quedan quietas y cae una gota más grande, del hueco
  },
  n3: {
    dir: 'n3', color: 'largo', oscuro: 0.06, izq: [0.82, 0.52], esquina: 0.72,
    polvo: { n: 100, luz: [810, 420], radio: 520 },
    capas: ['apagada'], lampara: true,
    bucle: { clave: 'final/cabina', vol: 0.022 },
    raro: { tipo: 'apagon', dur: 1.3 },      // la lámpara del fondo se apaga un segundo
  },
  n4: {
    dir: 'n4', color: null, oscuro: 0.09, izq: [0.84, 0.54], esquina: 0.74,
    polvo: { n: 110, luz: [820, 420], radio: 600 },
    capas: ['p1', 'p2', 'p3', 'raro'], puerta: { periodo: 9 }, piloto: true,
    sonido: [{ clave: 'ambiente/crujido', cada: [11, 24], vol: 0.035 }],
    raro: { tipo: 'taquilla', dur: 2.6 },    // la taquilla se abre un poco más
  },
  n5: {
    dir: 'n5', color: 'errante', oscuro: 0.12, izq: [0.84, 0.54], esquina: 0.74,
    polvo: { n: 120, luz: [1000, 420], radio: 560 },
    monitores: true,
    sonido: [{ clave: 'ambiente/interferencia', cada: [4, 9], vol: 0.028 }],
    raro: { tipo: 'figura', dur: 2.2 },      // la figura de la estática dura más
  },
  n6: {
    dir: 'n6', color: 'dislocado', oscuro: 0.13, izq: [0.84, 0.54], esquina: 0.74,
    polvo: { n: 160, luz: null, radio: 380 },   // (la luz: el centro de la rejilla, del .json)
    vibra: true,
    sonido: [{ clave: 'conductos/tic', cada: [5, 11], vol: 0.04 }],
    raro: { tipo: 'tapa', dur: 1.5 },        // algo tapa la luz de la rejilla un instante
  },
  n7: {
    dir: 'n7', color: 'aberracion', mezcla: 0.36, oscuro: 0.15, izq: [0.86, 0.56], esquina: 0.76,
    polvo: { n: 120, luz: [1300, 400], radio: 600 },
    capas: ['alarma'], alarma: { periodo: 1.7 }, niebla: true, consolaReactor: true,
    raro: { tipo: 'para', dur: 2.6 },        // la luz roja se para
  },
  fin: {
    dir: 'nfin', color: '#ffcc33', oscuro: 0.06, izq: [0.82, 0.52], esquina: 0.72,
    polvo: null, ceniza: { n: 150 },
    planeta: { vel: 0.08, tex: 'n1' },      // (el mismo planeta y el mismo encuadre que la Noche 1: su textura)
    parpadeo: true, slaimi: true,
    sonido: [{ clave: 'congelado/viento', cada: [14, 26], vol: 0.03 }, { clave: 'n7/crujido', cada: [18, 32], vol: 0.03 }],
    raro: { tipo: 'rafaga', dur: 2.2 },      // una ráfaga de ceniza
  },
  // (solo debug, v2.13) el de la Noche 1 más oscuro y con el título lima: para probar el fundido, el color del título y lo
  // oscuro (fondoQueToca nunca lo devuelve)
  prueba: {
    dir: 'n1', color: 'insecto', oscuro: 0.3, izq: [0.8, 0.5], esquina: 0.72,
    polvo: { n: 120, luz: [1110, 300], radio: 650 }, planeta: { vel: 0.08 }, consola: true, parpadeo: true,
    raro: { tipo: 'sombra', dur: 1.7 },
  },
};
const DISPONIBLE = (id) => (FONDOS[id] ? id : 'n1');

/** El fondo que toca: la noche que se va a jugar. @param save la partida (o null) */
export function fondoQueToca(save) {
  if (!save) return 'n1';
  if (save.flags?.n7superada) return 'fin';
  return `n${Math.min(7, Math.max(1, save.night | 0 || 1))}`;
}

const lee = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const guarda = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
// (con prioridad alta: al arrancar, el juego pide cientos de archivos y el fondo quedaba a la cola varios segundos)
const carga = (src) => { const i = new Image(); i.fetchPriority = 'high'; i.src = src; return i; };
const lista = (i) => i && i.complete && i.naturalWidth > 0;
const suave = (k) => k * k * (3 - 2 * k);

function pixeles(img, w = img.naturalWidth, h = img.naturalHeight) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, w, h);
  return x.getImageData(0, 0, w, h).data;
}

/** Unos cuantos lienzos de estática (ruido gris), hechos una vez: los monitores de Comunicaciones. */
let ESTATICA = null;
function estatica() {
  if (ESTATICA) return ESTATICA;
  ESTATICA = [0, 1, 2, 3].map(() => {
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 64;
    const x = c.getContext('2d');
    const im = x.createImageData(96, 64);
    for (let i = 0; i < 96 * 64; i++) {
      const v = 30 + Math.random() * 170;
      im.data[i * 4] = v * 0.9;
      im.data[i * 4 + 1] = v;
      im.data[i * 4 + 2] = v * 0.95;
      im.data[i * 4 + 3] = 255;
    }
    x.putImageData(im, 0, 0);
    return c;
  });
  return ESTATICA;
}

/** La niebla baja del reactor: manchas suaves en un lienzo que se repite en horizontal (hecho una vez). */
let NIEBLA = null;
function niebla() {
  if (NIEBLA) return NIEBLA;
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 200;
  const x = c.getContext('2d');
  const rnd = new Random(31);
  for (let k = 0; k < 70; k++) {
    const cx = rnd.next() * 1024;
    const cy = 60 + rnd.next() * 120;
    const r = 60 + rnd.next() * 120;
    for (const dx of [-1024, 0, 1024]) {
      const g = x.createRadialGradient(cx + dx, cy, 0, cx + dx, cy, r);
      g.addColorStop(0, `rgba(190,170,200,${0.05 + rnd.next() * 0.05})`);
      g.addColorStop(1, 'rgba(190,170,200,0)');
      x.fillStyle = g;
      x.fillRect(cx + dx - r, cy - r, r * 2, r * 2);
    }
  }
  NIEBLA = c;
  return c;
}

// ------------------------------------------------------------------ el planeta que gira
/** Por cada píxel del ventanal, el punto del planeta que ve (en el marco del giro: θ desde el eje y φ alrededor);
 *  el color = las tres capas del render (los tres tonos de la rampa de su material) mezcladas según el ruido de las
 *  nubes en (θ, φ + giro). Sin bucle: gira sin fin. */
class PlanetaGira {
  constructor(dir, J, texDir = dir) {
    this.J = J;
    this.capas = [0, 1, 2].map((k) => carga(`${RUTA}${dir}/planeta${k}.webp`));
    this.tex = carga(`${RUTA}${texDir}/planeta_tex.webp`);
    this.listo = false;
  }

  _prepara() {
    const J = this.J;
    const V = J.ventanal;
    const P = J.planeta;
    const T = P.tex;
    const L = this.capas.map((im) => pixeles(im, V.w, V.h));
    this.L = L;
    const tx = pixeles(this.tex, T.ancho, T.alto);
    this.f = new Float32Array(T.ancho * T.alto);
    for (let i = 0; i < this.f.length; i++) this.f[i] = T.fac_min + (tx[i * 4] / 255) * (T.fac_max - T.fac_min);
    // los píxeles en los que las tres capas no son iguales: el planeta (con su borde)
    const idx = [];
    for (let i = 0; i < V.w * V.h; i++) {
      const o = i * 4;
      const d = Math.max(Math.abs(L[0][o] - L[2][o]), Math.abs(L[0][o + 1] - L[2][o + 1]), Math.abs(L[0][o + 2] - L[2][o + 2]));
      if (d > 3) idx.push(i);
    }
    const n = idx.length;
    this.idx = Int32Array.from(idx);
    this.u0 = new Float32Array(n);
    this.v = new Float32Array(n);
    const [c0, c1, c2] = J.rot;
    const th = Math.tan(J.angulo / 2);
    const W = J.ancho;
    const H = J.alto;
    const C = P.centro;
    const r = P.radio;
    const oc = [J.pos[0] - C[0], J.pos[1] - C[1], J.pos[2] - C[2]];
    const ococ = oc[0] * oc[0] + oc[1] * oc[1] + oc[2] * oc[2];
    const [a, e1, e2] = [T.eje, T.e1, T.e2];
    for (let k = 0; k < n; k++) {
      const i = idx[k];
      const X = V.x + (i % V.w);
      const Y = V.y + Math.floor(i / V.w);
      const nx = ((X + 0.5) / W) * 2 - 1;
      const ny = 1 - ((Y + 0.5) / H) * 2;
      const dc = [nx * th, ny * th * H / W, -1];
      let d = [0, 1, 2].map((j) => dc[0] * c0[j] + dc[1] * c1[j] + dc[2] * c2[j]);
      const dl = Math.hypot(d[0], d[1], d[2]);
      d = d.map((q) => q / dl);
      const b = d[0] * oc[0] + d[1] * oc[1] + d[2] * oc[2];
      const disc = b * b - (ococ - r * r);
      const t = -b - Math.sqrt(Math.max(disc, 0));
      let p = [oc[0] + d[0] * t, oc[1] + d[1] * t, oc[2] + d[2] * t];
      const pl = Math.hypot(p[0], p[1], p[2]);
      p = p.map((q) => q / pl);
      const ca = Math.max(-1, Math.min(1, p[0] * a[0] + p[1] * a[1] + p[2] * a[2]));
      const TH = (Math.acos(ca) * 180) / Math.PI;
      const PH = Math.atan2(p[0] * e2[0] + p[1] * e2[1] + p[2] * e2[2], p[0] * e1[0] + p[1] * e1[1] + p[2] * e1[2]);
      this.u0[k] = ((PH + Math.PI) / (2 * Math.PI)) * T.ancho - 0.5;
      this.v[k] = Math.max(0, Math.min(T.alto - 1.001, ((TH - T.theta0) / (T.theta1 - T.theta0)) * T.alto - 0.5));
    }
    this.lienzo = document.createElement('canvas');
    this.lienzo.width = V.w;
    this.lienzo.height = V.h;
    this.cx = this.lienzo.getContext('2d');
    this.salida = this.cx.createImageData(V.w, V.h);
    this.rampa = P.rampa.map((e) => e[0]);
    this.listo = true;
  }

  draw(ctx, t, vel) {
    if (!this.listo) {
      if (!this.capas.every(lista) || !lista(this.tex)) return;
      this._prepara();
    }
    // (cada fotograma, una cuarta parte de los píxeles, entrelazados: el giro es de décimas de píxel por fotograma y así
    // no hay tirones; antes, todo de golpe cada 0,1 s eran ~8 ms)
    {
      this.turno = ((this.turno ?? -1) + 1) & 3;
      const T = this.J.planeta.tex;
      const A = T.ancho;
      const du = (((t * vel) / 360) * A) % A;
      const [p0, p1, p2] = this.rampa;
      const [L0, L1, L2] = this.L;
      const o = this.salida.data;
      const f = this.f;
      for (let k = this.turno; k < this.idx.length; k += 4) {
        let u = this.u0[k] + du;
        u -= Math.floor(u / A) * A;
        const v = this.v[k];
        const ui = u | 0;
        const vi = v | 0;
        const fu = u - ui;
        const fv = v - vi;
        const u1 = ui + 1 === A ? 0 : ui + 1;
        const r0 = vi * A;
        const r1 = r0 + A;
        const q = f[r0 + ui] * (1 - fu) * (1 - fv) + f[r0 + u1] * fu * (1 - fv) + f[r1 + ui] * (1 - fu) * fv + f[r1 + u1] * fu * fv;
        const i4 = this.idx[k] * 4;
        let X;
        let Y;
        let w;
        if (q <= p1) { X = L0; Y = L1; w = Math.max(0, Math.min(1, (q - p0) / (p1 - p0))); } else { X = L1; Y = L2; w = Math.max(0, Math.min(1, (q - p1) / (p2 - p1))); }
        o[i4] = X[i4] + (Y[i4] - X[i4]) * w;
        o[i4 + 1] = X[i4 + 1] + (Y[i4 + 1] - X[i4 + 1]) * w;
        o[i4 + 2] = X[i4 + 2] + (Y[i4 + 2] - X[i4 + 2]) * w;
        o[i4 + 3] = 255;
      }
      this.cx.putImageData(this.salida, 0, 0);
    }
    const V = this.J.ventanal;
    ctx.drawImage(this.lienzo, V.x, V.y);
  }
}

// ------------------------------------------------------------------ un fondo
class Fondo {
  constructor(id) {
    this.id = id;
    this.F = FONDOS[id];
    const F = this.F;
    const d = `${RUTA}${F.dir}/`;
    this.base = carga(`${d}base.webp`);
    this.apagon = F.parpadeo ? carga(`${d}apagon.webp`) : null;
    this.capas = {};
    for (const c of F.capas ?? []) this.capas[c] = carga(`${d}${c}.webp`);
    this.J = null;
    fetch(`${d}fondo.json`, { priority: 'high' }).then((r) => r.json()).then((J) => {
      this.J = J;
      if (J.planeta && F.planeta) this.planeta = new PlanetaGira(F.dir, J, F.planeta.tex ?? F.dir);
    }).catch(() => { this.J = {}; });
    const rnd = new Random(77);
    const P = F.polvo;
    this.polvo = Array.from({ length: P?.n ?? 0 }, () => ({ x: rnd.next() * 1600, y: rnd.next() * 900, z: 0.3 + rnd.next() * 0.7, f: rnd.next() * 6.28 }));
    this.ceniza = Array.from({ length: F.ceniza?.n ?? 0 }, () => ({ x: rnd.next() * 1600, y: rnd.next() * 900, z: 0.3 + rnd.next() * 0.7, f: rnd.next() * 6.28 }));
    this.parpadeo = { siguiente: 4 + Math.random() * 6, hasta: 0 };
    this.tPrev = null;
    this.sonoro = true;
    this.suena = null;           // (clave, vol): lo pone FondoMenu
    this.est = { gotas: [], proxGota: null, lamp: { prox: 2 + Math.random() * 3, hasta: 0, sono: false }, vibra: { prox: 4 + Math.random() * 4, hasta: 0 },
      figura: { prox: 5 + Math.random() * 6, hasta: 0 }, latido: -1, raroSono: false };
  }

  listo() { return lista(this.base) && this.J !== null; }

  _suena(clave, vol) { if (this.sonoro) this.suena?.(clave, vol); }

  /** Lo que no se mueve encima de todo: lo oscuro de la noche y las zonas oscuras detrás del texto (una vez). */
  _capaOscura() {
    if (this.oscura) return this.oscura;
    const W = CONFIG.WIDTH;
    const H = CONFIG.HEIGHT;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const x = c.getContext('2d');
    const F = this.F;
    if (F.oscuro > 0) { x.fillStyle = `rgba(0,0,0,${F.oscuro})`; x.fillRect(0, 0, W, H); }
    const izq = x.createLinearGradient(0, 0, 980, 0);
    izq.addColorStop(0, `rgba(2,4,8,${F.izq[0]})`);
    izq.addColorStop(0.5, `rgba(2,4,8,${F.izq[1]})`);
    izq.addColorStop(1, 'rgba(2,4,8,0)');
    x.fillStyle = izq;
    x.fillRect(0, 0, 980, H);
    const esq = x.createRadialGradient(1440, 770, 40, 1440, 770, 460);
    esq.addColorStop(0, `rgba(2,4,8,${F.esquina})`);
    esq.addColorStop(1, 'rgba(2,4,8,0)');
    x.fillStyle = esq;
    x.fillRect(900, 380, 700, 520);
    this.oscura = c;
    return c;
  }

  draw(ctx, t, raro, extra = {}) {
    const W = CONFIG.WIDTH;
    const H = CONFIG.HEIGHT;
    const F = this.F;
    const J = this.J;
    const dt = this.tPrev === null ? 0 : Math.max(0, Math.min(0.1, t - this.tPrev));
    this.tPrev = t;
    const rk = raro && raro.tipo === F.raro?.tipo ? raro.k : null;
    if (rk === null) this.est.raroSono = false;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.base, 0, 0, W, H);
    // la luz que parpadea: a ratos, unos instantes, la de emergencia
    const p = this.parpadeo;
    if (F.parpadeo && t >= p.siguiente) { p.hasta = t + 0.15 + Math.random() * 0.55; p.siguiente = t + 6 + Math.random() * 10; }
    if (F.parpadeo && t < p.hasta && lista(this.apagon)) {
      ctx.globalAlpha = Math.random() < 0.55 ? 1 : Math.random() * 0.6;
      ctx.drawImage(this.apagon, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    if (F.lampara) this._lampara(ctx, t, rk);
    if (F.alarma) this._alarma(ctx, t, rk);
    if (F.puerta) this._puerta(ctx, t, rk);
    if (F.hoja) this._hoja(ctx, t, rk);
    this.planeta?.draw(ctx, t, F.planeta.vel);
    if (F.consola) this._consola(ctx, t);
    if (F.monitores) this._monitores(ctx, t, rk);
    if (F.consolaReactor) this._consolaReactor(ctx, t);
    if (F.piloto) this._piloto(ctx, t);
    if (F.vibra) this._vibra(ctx, t, rk);
    if (F.gotas) this._gotas(ctx, t, dt, rk);
    if (F.slaimi && extra.slaimi) this._slaimi(ctx, t);
    if (rk !== null && F.raro.tipo === 'sombra') this._sombra(ctx, rk);
    if (F.niebla) this._niebla(ctx, t);
    this._particulas(ctx, t, dt, rk);
    ctx.drawImage(this._capaOscura(), 0, 0);
    ctx.restore();
  }

  // --- n1: la pantalla de la consola, encendida: un brillo verde que respira, unas líneas y el cursor
  _consola(ctx, t) {
    const s = this.J?.pantalla;
    if (!s) return;
    const cx = s.x + s.w / 2;
    const cy = s.y + s.h / 2;
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, Math.max(s.w, s.h) * 0.9);
    g.addColorStop(0, `rgba(90,255,150,${0.16 + 0.05 * Math.sin(t * 2.1)})`);
    g.addColorStop(1, 'rgba(90,255,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(s.x - s.w, s.y - s.h, s.w * 3, s.h * 3);
    ctx.fillStyle = 'rgba(150,255,190,0.55)';
    for (let k = 0; k < 4; k++) ctx.fillRect(s.x + s.w * 0.16, s.y + s.h * (0.2 + k * 0.15), s.w * (0.25 + ((k * 37) % 40) / 100), Math.max(1, s.h * 0.05));
    if (Math.floor(t * 2) % 2 === 0) ctx.fillRect(s.x + s.w * 0.16, s.y + s.h * 0.8, s.w * 0.08, Math.max(1, s.h * 0.06));
  }

  // --- n1: una sombra larga cruza el suelo, de derecha a izquierda (alguien pasa por detrás de la cámara)
  _sombra(ctx, k) {
    const e = suave(k);
    const x = 1650 - e * 1500;
    const a = Math.sin(Math.PI * k);
    ctx.save();
    ctx.filter = 'blur(18px)';
    ctx.globalAlpha = 0.82 * Math.min(1, a * 1.6);
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(x - 60, 650);
    ctx.lineTo(x + 60, 650);
    ctx.lineTo(x + 280, 930);
    ctx.lineTo(x - 220, 930);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // --- n2: la planta seca se balancea desde su base (o la enredadera desde arriba)
  _hoja(ctx, t, rk) {
    const im = this.capas.hoja;
    const h = this.J?.hoja;
    if (!lista(im) || !h) return;
    const quieta = rk !== null;                                // (el evento raro: todo se queda quieto)
    const ang = quieta ? 0 : this.F.hoja.grados * Math.sin((2 * Math.PI * t) / this.F.hoja.periodo) * (0.7 + 0.3 * Math.sin(t * 0.37));
    const [px, py] = h.pivote;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate((ang * Math.PI) / 180);
    ctx.drawImage(im, h.rect.x - px, h.rect.y - py);
    ctx.restore();
  }

  // --- n2: gotas que caen del techo y del borde del hueco del conducto (con su goteo al llegar al suelo)
  _gotas(ctx, t, dt, rk) {
    const G = this.J?.gotas ?? [];
    if (!G.length) return;
    const E = this.est;
    E.proxGota ??= G.map(() => t + 0.5 + Math.random() * 3);
    G.forEach((g, i) => {
      if (rk === null && t >= E.proxGota[i]) {
        E.gotas.push({ g, t0: t, grande: false });
        E.proxGota[i] = t + 1.8 + Math.random() * 3.2;
      }
    });
    if (rk !== null && !E.raroSono) {
      E.raroSono = true;
      E.gotas.push({ g: G[G.length - 1], t0: t, grande: true });
    }
    ctx.save();
    for (const d of E.gotas) {
      const [x0, y0] = d.g.de;
      const [x1, y1] = d.g.a;
      const caida = Math.sqrt((2 * Math.max(10, y1 - y0)) / (d.grande ? 1500 : 1900));
      const k = (t - d.t0) / caida;
      if (k < 1) {
        const y = y0 + (y1 - y0) * k * k;
        const x = x0 + (x1 - x0) * k;
        ctx.fillStyle = d.grande ? 'rgba(170,150,190,0.8)' : 'rgba(210,200,230,0.55)';
        const r = d.grande ? 2.6 : 1.3;
        ctx.fillRect(x - r / 2, y - r * 3, r, r * (d.grande ? 4 : 5));
      } else {
        if (!d.sono) { d.sono = true; this._suena('ambiente/goteo', d.grande ? 0.07 : 0.04); }
        const s = (t - d.t0 - caida) / 0.35;
        if (s < 1) {
          ctx.strokeStyle = `rgba(210,200,230,${0.45 * (1 - s)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(x1, y1, 3 + s * (d.grande ? 22 : 12), 1 + s * (d.grande ? 5 : 3), 0, 0, Math.PI * 2);
          ctx.stroke();
        } else d.fin = true;
      }
    }
    ctx.restore();
    E.gotas = E.gotas.filter((d) => !d.fin);
  }

  // --- n3: la lámpara del fondo parpadea (el pase con ella apagada encima); a ratos, el zumbido y el relé
  _lampara(ctx, t, rk) {
    const im = this.capas.apagada;
    if (!lista(im)) return;
    const L = this.est.lamp;
    let a = 0;
    if (rk !== null) {
      a = rk > 0.08 && rk < 0.86 ? 1 : 0;
      if (!this.est.raroSono) { this.est.raroSono = true; this._suena('apagon/apagado', 0.03); }
    } else {
      if (t >= L.prox) { L.hasta = t + 0.15 + Math.random() * 0.8; L.prox = t + 3 + Math.random() * 6; L.sono = false; }
      if (t < L.hasta) {
        a = Math.random() < 0.5 ? 1 : Math.random() * 0.5;
        if (!L.sono && L.hasta - t > 0.45) { L.sono = true; this._suena('apagon/apagado', 0.012); }
      }
    }
    if (a > 0) {
      ctx.globalAlpha = a;
      ctx.drawImage(im, 0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
      ctx.globalAlpha = 1;
    }
  }

  // --- n4: la puerta de la taquilla, entreabierta, se mueve muy poco (recortes a varios ángulos, fundidos)
  _puerta(ctx, t, rk) {
    const r = this.J?.taquilla;
    if (!r) return;
    const fr = [null, this.capas.p1, this.capas.p2, this.capas.p3];
    if (!fr.slice(1).every(lista)) return;
    const s = (Math.sin((2 * Math.PI * t) / this.F.puerta.periodo) * 0.5 + 0.5) * 2.999;
    const i = Math.floor(s);
    const w = s - i;
    if (fr[i]) ctx.drawImage(fr[i], r.x, r.y);
    if (fr[i + 1]) { ctx.globalAlpha = w; ctx.drawImage(fr[i + 1], r.x, r.y); ctx.globalAlpha = 1; }
    if (rk !== null && lista(this.capas.raro)) {
      if (!this.est.raroSono) { this.est.raroSono = true; this._suena('ambiente/crujido', 0.06); }
      const e = rk < 0.25 ? suave(rk / 0.25) : rk > 0.7 ? suave(1 - (rk - 0.7) / 0.3) : 1;
      ctx.globalAlpha = e;
      ctx.drawImage(this.capas.raro, r.x, r.y);
      ctx.globalAlpha = 1;
    }
  }

  // --- n4: el piloto rojo del panel de reinicio, al fondo del pasillo
  _piloto(ctx, t) {
    const p = this.J?.piloto_panel;
    if (!p) return;
    const on = (t % 1.3) < 0.75 ? 0.75 + 0.25 * Math.sin(t * 9) : 0.08;
    const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], 14);
    g.addColorStop(0, `rgba(255,60,40,${0.85 * on})`);
    g.addColorStop(0.3, `rgba(255,40,30,${0.35 * on})`);
    g.addColorStop(1, 'rgba(255,40,30,0)');
    ctx.fillStyle = g;
    ctx.fillRect(p[0] - 14, p[1] - 14, 28, 28);
  }

  // --- n5: estática en los monitores; en el del centro, la propia sala vacía (la CAM 10); a veces, una figura de pie
  _monitores(ctx, t, rk) {
    const J = this.J;
    if (!J?.monitores?.length) return;
    const E = estatica();
    const fr = E[Math.floor(t * 18) % E.length];
    this.sala ??= carga(this.idioma === 'en' ? 'assets/salas/en/cam_comms.jpg' : 'assets/salas/cam_comms.jpg');
    const F = this.est.figura;
    if (rk === null && t >= F.prox) { F.hasta = t + 0.16 + Math.random() * 0.22; F.prox = t + 7 + Math.random() * 7; this._suena('ambiente/interferencia', 0.04); }
    if (rk !== null && !this.est.raroSono) { this.est.raroSono = true; this._suena('ambiente/interferencia', 0.05); }
    const figura = rk !== null ? rk > 0.05 && rk < 0.95 : t < F.hasta;
    // (la pantalla grande rota de la pared, primero y muy tenue: está detrás de los monitores)
    const todas = [...(J.grande ? [{ q: J.grande, i: -1 }] : []), ...J.monitores.map((q, i) => ({ q, i }))];
    for (const { q, i } of todas) {
      const xs = q.map((p) => p[0]);
      const ys = q.map((p) => p[1]);
      const x0 = Math.min(...xs);
      const y0 = Math.min(...ys);
      const w = Math.max(...xs) - x0;
      const h = Math.max(...ys) - y0;
      ctx.save();
      ctx.beginPath();
      q.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.clip();
      if (i !== -1) {
        ctx.fillStyle = '#05060a';
        ctx.fillRect(x0, y0, w, h);
      }
      if (i === 1 && lista(this.sala)) {
        ctx.globalAlpha = 0.75;
        ctx.drawImage(this.sala, x0, y0 + Math.sin(t * 3) * 0.6, w, h);
        ctx.globalAlpha = 0.32;
      } else ctx.globalAlpha = i === -1 ? 0.14 : 0.8;
      ctx.drawImage(fr, (i + 2) * 7 % 20, 0, 60, 40, x0, y0, w, h);
      ctx.globalAlpha = 1;
      // la figura de pie, entre la estática, en el monitor de la derecha
      if (figura && i === 2) {
        ctx.globalAlpha = 0.8 + 0.2 * Math.random();
        ctx.fillStyle = '#040306';
        const cx = x0 + w * 0.52;
        const pie = y0 + h * 1.0;
        const alto = h * 0.92;
        ctx.beginPath();
        ctx.ellipse(cx + w * 0.025, pie - alto + h * 0.08, w * 0.065, h * 0.1, 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx - w * 0.1, pie);
        ctx.lineTo(cx - w * 0.075, pie - alto * 0.62);
        ctx.quadraticCurveTo(cx - w * 0.02, pie - alto * 0.88, cx + w * 0.04, pie - alto * 0.8);
        ctx.lineTo(cx + w * 0.085, pie - alto * 0.6);
        ctx.lineTo(cx + w * 0.1, pie);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      // un tinte violeta y líneas de barrido
      ctx.fillStyle = 'rgba(160,92,255,0.1)';
      ctx.fillRect(x0, y0, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let y = y0 + ((t * 40) % 4); y < y0 + h; y += 4) ctx.fillRect(x0, y, w, 1);
      ctx.restore();
    }
  }

  // --- n6: la chapa vibra a ratos (un trozo de la pared derecha tiembla) y algo tapa la luz de la rejilla (raro)
  _vibra(ctx, t, rk) {
    const V = this.est.vibra;
    if (rk === null && t >= V.prox) { V.hasta = t + 0.6 + Math.random() * 0.4; V.prox = t + 6 + Math.random() * 7; this._suena('final/vibra', 0.045); }
    if (t < V.hasta) {
      const dx = Math.sin(t * 73) * 1.3;
      const dy = Math.cos(t * 61) * 0.6;
      ctx.drawImage(this.base, 1080, 120, 440, 700, 1080 + dx, 120 + dy, 440, 700);
    }
    const r = this.J?.rejilla;
    if (rk !== null && r) {
      if (!this.est.raroSono) { this.est.raroSono = true; this._suena('conductos/tic', 0.05); }
      const e = Math.sin(Math.PI * rk);
      const x = r.x - 80 + suave(rk) * (r.w + 160);
      const g = ctx.createLinearGradient(x - 120, 0, x + 120, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, `rgba(0,0,0,${0.85 * e})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x - 10, r.y - 10, r.w + 20, r.h + 20);
      ctx.clip();
      ctx.fillStyle = g;
      ctx.fillRect(r.x - 10, r.y - 10, r.w + 20, r.h + 20);
      ctx.restore();
      ctx.fillStyle = `rgba(0,0,0,${0.35 * e})`;     // (y la luz del conducto baja)
      ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    }
  }

  // --- n7: la alarma roja late (el pase «alarma» encima, con dos golpes por ciclo, como un corazón) y el latido grave
  _alarma(ctx, t, rk) {
    const im = this.capas.alarma;
    if (!lista(im)) return;
    if (rk !== null && rk > 0.04 && rk < 0.96) return;          // (el evento raro: se para)
    const P = this.F.alarma.periodo;
    const ph = (t % P) / P;
    const ciclo = Math.floor(t / P);
    if (ciclo !== this.est.latido) { this.est.latido = ciclo; this._suena('menu/latido', 0.07); }
    const a = Math.min(1, Math.exp(-(((ph - 0.04) / 0.07) ** 2)) + 0.7 * Math.exp(-(((ph - 0.24) / 0.08) ** 2)));
    if (a > 0.01) {
      ctx.globalAlpha = a;
      ctx.drawImage(im, 0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
      ctx.globalAlpha = 1;
    }
  }

  // --- n7: la consola de la 2.5, al límite: tres barras llenas y una alarma muda que parpadea
  _consolaReactor(ctx, t) {
    const r = this.J?.consola;
    if (!r) return;
    ctx.save();
    ctx.fillStyle = 'rgba(12,2,2,0.9)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    for (let k = 0; k < 3; k++) {
      const y = r.y + r.h * (0.28 + k * 0.2);
      ctx.fillStyle = `rgba(255,${60 + k * 30},40,${0.75 + 0.2 * Math.sin(t * 5 + k)})`;
      ctx.fillRect(r.x + r.w * 0.1, y, r.w * 0.8, Math.max(2, r.h * 0.1));
    }
    if (Math.floor(t * 1.6) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,40,30,0.95)';
      ctx.fillRect(r.x + r.w * 0.1, r.y + r.h * 0.08, r.w * 0.16, r.h * 0.12);
    }
    const g = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, 2, r.x + r.w / 2, r.y + r.h / 2, r.w);
    g.addColorStop(0, 'rgba(255,50,30,0.16)');
    g.addColorStop(1, 'rgba(255,50,30,0)');
    ctx.fillStyle = g;
    ctx.fillRect(r.x - r.w, r.y - r.h, r.w * 3, r.h * 3);
    ctx.restore();
  }

  // --- n7: la niebla baja (dos capas que se deslizan, sin salto: el lienzo se repite)
  _niebla(ctx, t) {
    const c = niebla();
    ctx.save();
    ctx.globalAlpha = 0.6;
    for (const [v, y, al] of [[14, 690, 1], [-8, 735, 0.7]]) {
      ctx.globalAlpha = 0.55 * al;
      const off = ((t * v) % 1024 + 1024) % 1024;
      for (let x = -off; x < CONFIG.WIDTH; x += 1024) ctx.drawImage(c, x, y, 1024, 200);
    }
    ctx.restore();
  }

  // --- fin: si Slaimi vive, una luz pequeña azulada que se aleja despacio por fuera del ventanal
  _slaimi(ctx, t) {
    const V = this.J?.ventanal;
    if (!V) return;
    const vuelta = V.w + 80;
    const x = V.x - 40 + ((t * 5) % vuelta);
    const y = V.y + V.h * 0.3 + Math.sin(t * 0.21) * 7;
    const a = 0.7 + 0.3 * Math.sin(t * 1.3);
    ctx.save();
    ctx.beginPath();
    ctx.rect(V.x + 6, V.y + 6, V.w - 12, V.h * 0.62);
    ctx.clip();
    const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
    g.addColorStop(0, `rgba(200,225,255,${a})`);
    g.addColorStop(0.25, `rgba(140,180,255,${0.55 * a})`);
    g.addColorStop(1, 'rgba(140,180,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 9, y - 9, 18, 18);
    ctx.restore();
  }

  // --- el polvo en el aire (más claro cerca de la luz) y la ceniza que cae (fin), con el tiempo de verdad
  _particulas(ctx, t, dt, rk) {
    const W = CONFIG.WIDTH;
    const H = CONFIG.HEIGHT;
    const P = this.F.polvo;
    if (P && this.polvo.length) {
      const r = this.J?.rejilla;
      const luz = P.luz ?? (r ? [r.x + r.w / 2, r.y + r.h / 2] : [800, 450]);
      for (const q of this.polvo) {
        q.x += (Math.sin(t * 0.3 + q.f) * 3 + 1.5) * q.z * dt;
        q.y += (Math.cos(t * 0.23 + q.f) * 2 + 0.8) * q.z * dt;
        if (q.x > W) q.x -= W;
        if (q.y > H) q.y -= H;
        const l = Math.max(0, 1 - Math.hypot(q.x - luz[0], q.y - luz[1]) / P.radio);
        ctx.globalAlpha = (0.05 + 0.22 * l) * q.z * (0.6 + 0.4 * Math.sin(t * 1.7 + q.f));
        ctx.fillStyle = '#e6eef8';
        ctx.fillRect(q.x, q.y, 1.6 * q.z + 0.6, 1.6 * q.z + 0.6);
      }
    }
    if (this.ceniza.length) {
      const rafaga = rk !== null && this.F.raro?.tipo === 'rafaga' ? Math.sin(Math.PI * rk) : 0;
      for (const q of this.ceniza) {
        q.x += (Math.sin(t * 0.21 + q.f) * 6 + 4 + rafaga * 170) * q.z * dt;
        q.y += (7 + 6 * q.z + Math.cos(t * 0.5 + q.f) * 3 - rafaga * 25) * dt;
        if (q.x > W) q.x -= W;
        if (q.y > H) { q.y -= H; q.x = Math.random() * W; }
        ctx.globalAlpha = (0.12 + 0.2 * q.z) * (0.7 + 0.3 * Math.sin(t * 2 + q.f));
        ctx.fillStyle = q.f > 3 ? '#cfcac4' : '#8f8984';
        const s = 1 + q.z * 1.6;
        ctx.fillRect(q.x, q.y, s, s * 0.8);
      }
    }
    ctx.globalAlpha = 1;
  }
}

// ------------------------------------------------------------------ el que decide
export class FondoMenu {
  constructor() {
    this.cache = {};
    this.actual = null;          // id del que se ve
    this.siguiente = null;       // id al que se funde
    this.k = 0;                  // fundido 0..1
    this.forzado = null;         // (debug) un fondo fijo ('ninguno' = el de reserva)
    this.elegido = lee(CLAVE_ELEGIDO) || 'auto';     // (v2.14) el de OPCIONES (con 3 estrellas)
    this.recompensa = false;     // (v2.14) ¿hay 3 estrellas? (lo pone el menú)
    this.raro = null;            // { t0, dur } mientras pasa
    this.raroHecho = false;
    this.raroCuando = null;
    this.quieto = 0;
    this.time = 0;
    this.capa = null;
    this.visto = 0;              // aparece con un fundido corto sobre el de reserva (cuando acaba de cargar)
    this.audio = null;           // (lo pone Game: el sonido de cada sala, muy bajo)
    this.activo = false;
    this.bucle = null;
    this.proxSon = {};
    this.slaimiVivo = false;
    this.abre();
    // el que tocará, ya: que empiece a cargar antes que todo lo demás
    try { this._fondo(fondoQueToca(SaveData.load())); } catch { /* sin partida legible */ }
  }

  _fondo(id) {
    const r = DISPONIBLE(id);
    if (!this.cache[r]) {
      const f = new Fondo(r);
      f.suena = (clave, vol) => this._suena(clave, vol);
      this.cache[r] = f;
    }
    return this.cache[r];
  }

  /** Al entrar en el menú (también al volver de una noche): tira el dado del evento raro. */
  abre() {
    this.raro = null;
    this.raroHecho = false;
    this.quieto = 0;
    this.raroCuando = Math.random() < RARO.PROB ? this.time + RARO.DESPUES[0] + Math.random() * (RARO.DESPUES[1] - RARO.DESPUES[0]) : null;
    this.activo = true;
  }

  /** Al salir del menú: fuera el sonido. */
  calla() {
    this.activo = false;
    try { this.bucle?.stop?.(); } catch { /* ya parado */ }
    this.bucle = null;
    this.bucleDe = null;
  }

  /** Una tecla, un clic o el ratón: para contar el rato sin tocar nada. */
  actividad() { this.quieto = 0; }

  fuerzaRaro() { this.raroHecho = false; this._empiezaRaro(); }

  _empiezaRaro() {
    if (this.raroHecho || this._clasico()) return;
    const F = FONDOS[DISPONIBLE(this.actual ?? 'n1')];
    if (!F.raro) return;
    this.raroHecho = true;
    this.raro = { t0: this.time, dur: F.raro.dur, tipo: F.raro.tipo };
  }

  /** ¿El clásico (el de la v0.2, dibujado con código)? En el debug, o elegido en OPCIONES. */
  _clasico() { return this.forzado === 'ninguno' || (!this.forzado && this.recompensa && this.elegido === 'clasico'); }

  /** El que toca ahora: el forzado (debug), el elegido en OPCIONES (con 3 estrellas) o el de la noche. */
  quiere(save) {
    if (this.forzado && this.forzado !== 'ninguno') return DISPONIBLE(this.forzado);
    if (this.recompensa && this.elegido && !['auto', 'clasico'].includes(this.elegido)) return DISPONIBLE(this.elegido);
    return DISPONIBLE(fondoQueToca(save));
  }

  /** (v2.14) Los fondos que se pueden elegir en OPCIONES: «según la noche», los ya vistos y el clásico. */
  opcionesFondo() {
    const vistos = new Set(ExtrasProgreso.fondosVistos?.() ?? []);
    return ['auto', ...ORDEN_FONDOS.filter((id) => vistos.has(id)), 'clasico'];
  }

  elige(id) {
    this.elegido = id;
    guarda(CLAVE_ELEGIDO, id);
  }

  _suena(clave, vol) {
    const lib = this.audio?.lib;
    if (!lib || !this.activo) return;
    try { lib.play(clave, { volume: vol, pitchVar: 0.06 }); } catch { /* sin ese sonido */ }
  }

  /** Los sonidos sueltos de cada sala (cada tanto) y su bucle (si tiene). */
  _sonidos() {
    const id = this.siguiente && this.k > 0.5 ? this.siguiente : this.actual;
    const F = !this._clasico() && id ? FONDOS[DISPONIBLE(id)] : null;
    const lib = this.audio?.lib;
    if (!lib || !this.activo || !F) {
      if (this.bucle && (!F || !this.activo)) this.calla();
      return;
    }
    if (this.bucleDe !== id) {
      try { this.bucle?.stop?.(); } catch { /* ya parado */ }
      this.bucle = null;
      this.bucleDe = id;
      this.proxSon = {};
    }
    // (el bucle: si su sonido aún no ha cargado, play devuelve false; se vuelve a intentar)
    if (F.bucle && !this.bucle && this.time >= (this.bucleIntento ?? 0)) {
      this.bucleIntento = this.time + 1;
      try { this.bucle = lib.play(F.bucle.clave, { volume: F.bucle.vol, loop: true, pitchVar: 0, volVar: 0 }) || null; } catch { this.bucle = null; }
    }
    for (const [i, s] of (F.sonido ?? []).entries()) {
      const k = `${id}${i}`;
      this.proxSon[k] ??= this.time + s.cada[0] * 0.5 + Math.random() * s.cada[1] * 0.5;
      if (this.time >= this.proxSon[k]) {
        this._suena(s.clave, s.vol);
        this.proxSon[k] = this.time + s.cada[0] + Math.random() * (s.cada[1] - s.cada[0]);
      }
    }
  }

  update(dt, save) {
    this.time += dt;
    this.quieto += dt;
    this.slaimiVivo = !!save && slaimiDe(save.flags ?? {})?.estado === 'vivo';
    const id = this.quiere(save);
    if (this.actual === null) {
      // la primera vez: si el último que se enseñó era otro, se empieza con él y se funde al nuevo
      const antes = lee(CLAVE);
      this.actual = antes && FONDOS[antes] && antes !== id ? antes : id;
    }
    if (id !== this.actual && id !== this.siguiente) { this.siguiente = id; this.k = 0; }
    if (this.siguiente) {
      const A = this._fondo(this.actual);
      const B = this._fondo(this.siguiente);
      if (!A.listo()) { this.actual = this.siguiente; this.siguiente = null; } else if (B.listo()) {
        this.k += dt / FUNDIDO;
        if (this.k >= 1) { this.actual = this.siguiente; this.siguiente = null; this.k = 0; }
      }
    }
    const A = this.actual && this._fondo(this.actual);
    if (A && A.listo()) this.visto = Math.min(1, this.visto + dt / 0.8);
    if (!this.siguiente && A && A.listo()) {
      guarda(CLAVE, this.actual);
      // (v2.14) el fondo de la noche, ya visto: se podrá elegir en OPCIONES (no cuenta el forzado ni el elegido)
      if (!this.forzado && !(this.recompensa && this.elegido !== 'auto') && this._vistoDe !== this.actual && this.actual !== 'prueba') {
        this._vistoDe = this.actual;
        ExtrasProgreso.fondoVisto?.(this.actual);
      }
    }
    if (!this.raro && !this.raroHecho && ((this.raroCuando !== null && this.time >= this.raroCuando) || this.quieto >= RARO.QUIETO)) this._empiezaRaro();
    if (this.raro && this.time - this.raro.t0 >= this.raro.dur) this.raro = null;
    this._sonidos();
  }

  /** ¿Hace falta pintar antes el de reserva? (mientras carga, durante su fundido de entrada y con el clásico) */
  reserva() {
    if (this._clasico()) return true;
    const A = this.actual && this._fondo(this.actual);
    return !A || !A.listo() || this.visto < 1;
  }

  _capa() {
    if (!this.capa) {
      this.capa = document.createElement('canvas');
      this.capa.width = CONFIG.WIDTH;
      this.capa.height = CONFIG.HEIGHT;
    }
    return this.capa;
  }

  draw(ctx, t, idioma = 'es') {
    if (this._clasico()) return;
    const A = this.actual && this._fondo(this.actual);
    if (!A || !A.listo()) return;
    const raro = this.raro ? { k: Math.min(1, (this.time - this.raro.t0) / this.raro.dur), tipo: this.raro.tipo } : null;
    const extra = { slaimi: this.slaimiVivo };
    A.idioma = idioma;
    A.sonoro = true;
    if (this.visto < 1) {
      const c = this._capa();
      A.draw(c.getContext('2d'), t, null, extra);
      ctx.save();
      ctx.globalAlpha = suave(this.visto);
      ctx.drawImage(c, 0, 0);
      ctx.restore();
      return;
    }
    A.draw(ctx, t, this.siguiente ? null : raro, extra);
    if (this.siguiente && this.k > 0) {
      const c = this._capa();
      const B = this._fondo(this.siguiente);
      B.idioma = idioma;
      B.sonoro = false;
      B.draw(c.getContext('2d'), t, null, extra);
      ctx.save();
      ctx.globalAlpha = suave(this.k);
      ctx.drawImage(c, 0, 0);
      ctx.restore();
    }
  }

  /** El color del título: un poco del color del enemigo de esa noche (mezclado con el blanco de siempre). */
  colorTitulo() {
    if (this._clasico()) return { fill: TITULO, glow: null };
    const id = this.siguiente && this.k > 0.5 ? this.siguiente : this.actual;
    const F = id && FONDOS[DISPONIBLE(id)];
    const c = F?.color;
    if (!c) return { fill: TITULO, glow: null };
    const hex = c.startsWith('#') ? c : colorDe(c);
    const n = parseInt(hex.slice(1), 16);
    const b = parseInt(TITULO.slice(1), 16);
    const m = F.mezcla ?? 0.28;
    const mez = (s) => Math.round(((b >> s) & 255) * (1 - m) + ((n >> s) & 255) * m);
    return { fill: `rgb(${mez(16)},${mez(8)},${mez(0)})`, glow: `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0.45)` };
  }

  /** (debug) qué hay: el que se ve, al que se funde, el que toca y si pasa el evento raro */
  estado(save) {
    return { actual: this.actual, siguiente: this.siguiente, k: +this.k.toFixed(2), toca: fondoQueToca(save), forzado: this.forzado, elegido: this.recompensa ? this.elegido : '-', raro: this.raro?.tipo ?? false, raroCuando: this.raroCuando, quieto: Math.round(this.quieto), slaimi: this.slaimiVivo, bucle: this.bucleDe ?? null };
  }
}
