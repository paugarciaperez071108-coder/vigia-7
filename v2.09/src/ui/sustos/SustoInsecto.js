// =============================================================
// SustoInsecto.js — (v1.81) EL SUSTO NUEVO DE EL INSECTO (encargo del usuario del 2026-11-11: «sale del conducto. La
// rejilla salta con un golpe y se arrastra por el techo y las paredes. Se deja caer y se te pega a la pantalla: las
// patas agarran los bordes y el anillo de dientes de la boca se cierra alrededor de la lente»; nunca la cara que se
// acerca). El mismo en el juego (encima de la oficina de verdad), en Extras (encima de su imagen) y en el debug.
//
// Guion (24 fps; tools/3d/sustos_v2/insecto.py, en Cycles sobre la oficina única):
//   PRE   0,35 s de silencio con la oficina quieta (y antes, si hace falta, la vista se gira al frente)
//   f00–f12  dos golpes dentro del conducto (la rejilla se abomba)
//   f13–f22  la rejilla salta y cae al suelo (donde la deja El Dislocado en la noche 5)
//   f14–f33  sale boca abajo, se agarra por encima del hueco y trepa a trompicones
//   f33–f52  la vista se levanta y lo sigue por el techo hasta que cuelga delante del fluorescente
//   f53–f57  se deja caer con las patas abiertas
//   f58      EL GOLPE (el único sonido fuerte): las garras en las 4 esquinas del cristal (grietas, baba), el destello
//            rojo, los colores que se separan, temblor y fotogramas que se pierden; el anillo de dientes se cierra
//   f70      corte a negro
// Con la rejilla ya rota (noche 5, retos) empieza en f13 con su propia salida (insecto_<lado>_rota) y sigue igual.
// Fotogramas: assets/sustos/v2/insecto_<lado>[_rota]/ (integrar.py); sonido 'sustos/insecto[_rota]'
// (tools/sonidos_sustos.py), una sola pista a tiempo.
// =============================================================

import { CONFIG } from '../../config.js';
import * as L from './EfectosLente.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
export const INSECTO = {
  FPS: 24,
  PRE: 0.35,                 // s de silencio antes del primer fotograma
  PRE_GIRO: 0.1,             // (si antes hay que girar la vista al frente)
  ULTIMO: 70,                // último fotograma (luego, negro)
  GOLPE: 58,                 // el fotograma del golpe
  NEGRO: 0.45,               // s de negro al final, antes de la pantalla de muerte
  ROTA_DESDE: 13,            // con la rejilla rota empieza aquí…
  COMUN_DESDE: 25,           // …y desde aquí usa los fotogramas de la versión entera
  SONIDO: 'sustos/insecto',
  SONIDO_ROTA: 'sustos/insecto_rota',
  PIERDE: { 33: 32, 59: 58, 64: 63, 65: 63 },   // fotogramas que se pierden (el que toca → el que se ve)
  // al levantar la vista se pasa de la oficina del juego (con sus textos) al render entero: la señal se pierde un
  // instante (estática fuerte y bandas) y se salta un fotograma
  SENAL_VISTA: { 34: 0.85, 35: 0.6, 36: 0.32 },
  BABA: [150, 160, 92],      // color de la baba en la lente
  REJILLA_ROTA: { left: [36, 330, 384, 570], right: [1180, 330, 392, 570] },
  // en el apagón: la luz normal × esto por canal (medido entre normal_front y normal_apagon_front junto a las
  // rejillas: la luz roja de emergencia) y los bordes del recorte fundidos para que no se note
  APAGON: [112, 26, 14],
  APAGON_BORDE: 24,
};
const I = INSECTO;
// (v2.08, el usuario: «en la sala de las válvulas y en los conductos se sigue usando el susto antiguo del Insecto.
// Hazle una variante con el estilo de los nuevos (sin la cara que se acerca), saliendo de la trampilla o del conducto por
// el que llega») tools/3d/n6/susto_insecto_n6.py, en la misma escena que su llegada: quieto donde te alcanzó (f00–f09),
// se suelta y se lanza con las patas abiertas (f10–f21; se queda a ~0,8 m: lo que llega a la lente son las patas) y
// EL GOLPE en f22: las garras en las esquinas del cristal y el anillo de dientes que se cierra; f34 negro. Imágenes
// enteras (sin la oficina debajo); antes del primer fotograma, el primero quieto.
export const VARIANTES_N6 = {
  // VINETA: el mismo haz de la linterna que pinta encima el juego en ese sitio (Night6Ducts con el haz cerrado sobre él;
  // Night6Sala mirando a la boca), para que el susto empiece igual que lo que se veía
  conducto: { CARPETA: 'insecto_n6_conducto', GOLPE: 22, ULTIMO: 34, SONIDO: 'sustos/insecto_conducto', PIERDE: { 23: 22, 28: 27 }, SENAL_VISTA: {}, SENAL_DESDE: 10, SALTO: 10,
    VINETA: { x: 0.53, y: 0.56, r0: 0.108, r1: 0.57, medio: 0.62, borde: 0.88 } },
  trampilla: { CARPETA: 'insecto_n6_trampilla', GOLPE: 22, ULTIMO: 34, SONIDO: 'sustos/insecto_trampilla', PIERDE: { 23: 22, 28: 27 }, SENAL_VISTA: {}, SENAL_DESDE: 10, SALTO: 10,
    VINETA: { x: 0.5, y: 0.5, r0: 0.192, r1: 0.57, medio: null, borde: 0.65 } },
};
const CARP = 'assets/sustos/v2/';
const DATOS = {};

function carga(carpeta, prioridad = false) {
  if (DATOS[carpeta]) return DATOS[carpeta];
  const d = { ind: null, fotos: {} };
  DATOS[carpeta] = d;
  // (v2.09) prioridad: delante de los cientos de fotogramas de los enemigos que piden a la vez los conductos
  fetch(`${CARP}${carpeta}/indice.json`, prioridad ? { priority: 'high' } : undefined).then((r) => (r.ok ? r.json() : null)).then((ind) => {
    if (!ind) return;
    d.ind = ind;
    for (const [n, fo] of Object.entries(ind.fotogramas)) {
      if (!fo.archivo) continue;
      const im = new Image();
      im.decoding = 'async';
      if (prioridad) im.fetchPriority = 'high';
      im.src = `${CARP}${carpeta}/${fo.archivo}`;
      d.fotos[n] = im;
    }
  }).catch(() => {});
  return d;
}

/** Las imágenes, pedidas ya (al empezar una noche con El Insecto): que el susto no espere a cargar. */
export function precargaInsecto() {
  for (const l of ['left', 'right']) {
    carga(`insecto_${l}`);
    carga(`insecto_${l}_rota`);
  }
}

/** (v2.08) Los de la noche 6 (al empezar los conductos o la sala oculta). */
export function precargaInsectoN6() {
  for (const v of Object.values(VARIANTES_N6)) carga(v.CARPETA, true);
}

/** (v2.08) ¿Están ya los fotogramas del susto de la noche 6 ('conducto' | 'trampilla')? (v2.09) Cargados de verdad (casi
 * todos): si no, el juego usa el susto antiguo en vez de enseñar negro. */
export function insectoN6Listo(sitio) {
  const v = VARIANTES_N6[sitio];
  const d = v && carga(v.CARPETA);
  if (!(d?.ind && Object.keys(d.fotos).length > 0)) return false;
  const fotos = Object.values(d.fotos);
  return fotos.filter((im) => im.complete && im.naturalWidth > 0).length >= fotos.length * 0.9;
}

/** ¿Están ya los fotogramas de esa variante? */
export function insectoListo(lado = 'right', rota = false) {
  const d = carga(`insecto_${lado}`);
  const ok = (dd) => dd.ind && Object.keys(dd.fotos).length > 0;
  return ok(d) && (!rota || ok(carga(`insecto_${lado}_rota`)));
}

const lista = (im) => im && im.complete && im.naturalWidth > 0;
const IMGS = {};
function imagen(src) {
  if (!IMGS[src]) {
    IMGS[src] = new Image();
    IMGS[src].src = src;
  }
  return IMGS[src];
}

export class SustoInsecto {
  /**
   * lado: 'left' | 'right' (la rejilla); rota: la rejilla ya estaba arrancada; giro: s que tarda la vista en ponerse
   * de frente; fondo: true = pinta él la oficina (Extras); si no, debajo va la del juego. oscuro: en el apagón.
   */
  constructor({ lado = 'right', rota = false, giro = 0, fondo = false, oscuro = false, variante = null } = {}) {
    // (v2.08) variante: 'conducto' | 'trampilla' (la noche 6): sus fotogramas y sus tiempos, sin la oficina debajo
    this.variante = VARIANTES_N6[variante] ? variante : null;
    this.I = this.variante ? { ...INSECTO, ...VARIANTES_N6[this.variante] } : INSECTO;
    const I = this.I;
    this.lado = lado === 'left' ? 'left' : 'right';
    this.rota = !this.variante && !!rota;
    this.giro = giro;
    this.fondoPropio = !this.variante && !!fondo;
    this.conOficina = !this.variante && !fondo;
    this.oscuro = !this.variante && !!oscuro;
    this.ini = this.rota ? I.ROTA_DESDE : 0;
    this.d = carga(this.variante ? I.CARPETA : `insecto_${this.lado}`);
    this.dr = this.rota ? carga(`insecto_${this.lado}_rota`) : null;
    this.t0 = giro + (giro > 0 ? I.PRE_GIRO : I.PRE);    // (si la vista se gira, el giro ya es la pausa)
    this.tGolpe = this.t0 + (I.GOLPE - this.ini) / I.FPS;
    this.dura = this.t0 + (I.ULTIMO + 1 - this.ini) / I.FPS + I.NEGRO;
    this.visto = this.dura - I.NEGRO;
    this.ultima = null;
    this.garras = null;
  }

  /** Su pista de sonido, a tiempo con los fotogramas (k: cámara lenta). */
  sonido(audio, k = 1) {
    const I = this.I;
    audio?.lib?.play(this.rota ? I.SONIDO_ROTA : I.SONIDO, { volume: 1, pitch: 1 / k, pitchVar: 0, volVar: 0, when: this.t0 * k });
  }

  /** El fotograma que toca en t (null: todavía la oficina quieta; 'negro': ya ha acabado). */
  fotograma(t) {
    const I = this.I;
    const tt = t - this.t0;
    if (tt < 0) return null;
    const f = this.ini + Math.floor(tt * I.FPS);
    if (f > I.ULTIMO) return 'negro';
    return I.PIERDE[f] ?? f;
  }

  _entrada(f) {
    const d = this.rota && f < this.I.COMUN_DESDE ? this.dr : this.d;
    return { fo: d.ind?.fotogramas?.[f], im: d.fotos[f] };
  }

  _fondo(ctx) {
    const of = imagen('assets/salas/unica/normal_front.webp');
    if (lista(of)) ctx.drawImage(of, 0, 0, W, H);
    else L.negro(ctx);
    if (this.rota) {
      const r = imagen(`assets/salas/unica/n5/rejilla_${this.lado}_rota.webp`);
      const [x, y, w, h] = I.REJILLA_ROTA[this.lado];
      if (lista(r)) ctx.drawImage(r, x, y, w, h);
    }
  }

  draw(ctx, t, effects = null) {
    const I = this.I;
    let f = this.fotograma(t);
    if (f === 'negro') {
      L.negro(ctx);
      return;
    }
    if (this.fondoPropio) this._fondo(ctx);
    if (f === null) {
      if (!this.variante) return;
      f = 0;                                         // (v2.08: antes de empezar, su primer fotograma quieto)
    }
    const { fo, im } = this._entrada(f);
    if (fo?.garras) this.garras = fo.garras;
    const u = t - this.tGolpe;                       // s desde el golpe
    // el temblor: fuerte en el golpe y algo al saltar la rejilla
    let k = 0;
    if (u >= 0) k = 0.35 + Math.exp(-u / 0.22);
    else if (this.variante && f >= I.SALTO && f <= I.SALTO + 2) k = 0.12 * (I.SALTO + 3 - f) / 3;
    else if (!this.variante && f >= 13 && f <= 15 && !this.rota) k = 0.18 * (16 - f) / 3;
    ctx.save();
    if (k > 0) {
      const [dx, dy] = L.temblor(k, 46);
      ctx.translate(W / 2 + dx, H / 2 + dy);
      ctx.scale(1 + 0.04 * Math.min(1, k), 1 + 0.04 * Math.min(1, k));
      ctx.translate(-W / 2, -H / 2);
    }
    let pinta = null;
    if (fo && !fo.vacio && lista(im)) pinta = { im, fo };
    else if ((this.variante || f >= 33) && this.ultima) pinta = this.ultima;          // (si aún no ha llegado, la anterior entera)
    if (pinta) {
      const { x = 0, y = 0, w = W, h = H } = pinta.fo;
      if (this.oscuro) ctx.drawImage(this._aOscuras(pinta.im, x, y, w, h), x, y, w, h);
      else ctx.drawImage(pinta.im, x, y, w, h);
      if (w >= W) this.ultima = pinta;
    }
    ctx.restore();
    if (I.VINETA) {
      // (v2.08) el haz de la linterna, como en el juego en ese sitio
      const v = I.VINETA;
      const g = ctx.createRadialGradient(W * v.x, H * v.y, H * v.r0, W * v.x, H * v.y, H * v.r1);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      if (v.medio != null) g.addColorStop(0.55, `rgba(0,0,0,${v.medio})`);
      g.addColorStop(1, `rgba(0,0,0,${v.borde})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    // ---- la lente
    if (u >= 0) {
      const g = this.garras ?? [[160, 90], [1440, 90], [160, 810], [1440, 810]];
      L.manchas(ctx, g, Math.min(1, u / 0.5), { color: I.BABA, semilla: 9, tam: 1.3, alfa: 0.85 });
      L.grietas(ctx, g, Math.min(1, u / 0.1), { semilla: 11, tam: 560 });
      L.separaColores(ctx, Math.max(0, 1 - u / 0.3));
      L.golpeRojo(ctx, Math.max(0, 1 - u / 0.4));
      L.senal(ctx, effects, 0.55 * Math.max(0, 1 - u / 0.45) + (Math.random() < 0.12 ? 0.35 : 0));
      L.cierra(ctx, L.suave(0.12, 0.5, u));
    } else if (I.SENAL_VISTA[f]) {
      L.senal(ctx, effects, I.SENAL_VISTA[f]);
      if (f === 34) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, 0, W, H);
      }
    } else if (f >= (I.SENAL_DESDE ?? 48)) {
      // (algo se mueve encima de ti: la señal empieza a fallar)
      L.senal(ctx, effects, 0.04 + 0.12 * Math.min(1, (f - (I.SENAL_DESDE ?? 48)) / 10));
    }
    effects?.vignette?.(ctx, 0.75);
  }

  /** (el apagón) el fotograma con la luz roja de emergencia y, si es un recorte, con los bordes fundidos. */
  _aOscuras(im, x, y, w, h) {
    this.lienzo ??= document.createElement('canvas');
    const c = this.lienzo;
    if (c.width !== Math.round(w) || c.height !== Math.round(h)) {
      c.width = Math.round(w);
      c.height = Math.round(h);
    }
    const g = c.getContext('2d');
    g.globalCompositeOperation = 'copy';
    g.drawImage(im, 0, 0, w, h);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = `rgb(${I.APAGON.join(',')})`;
    g.fillRect(0, 0, w, h);
    if (w < W || h < H) {
      // (los bordes que dan a la oficina, fundidos; los que dan al borde de la pantalla, no)
      const b = I.APAGON_BORDE;
      g.globalCompositeOperation = 'destination-in';
      const lin = (x0, y0, x1, y1, ini, fin) => {
        const gr = g.createLinearGradient(x0, y0, x1, y1);
        const largo = Math.hypot(x1 - x0, y1 - y0);
        gr.addColorStop(0, ini ? 'rgba(0,0,0,0)' : '#000');
        gr.addColorStop(Math.min(0.49, b / largo), '#000');
        gr.addColorStop(Math.max(0.51, 1 - b / largo), '#000');
        gr.addColorStop(1, fin ? 'rgba(0,0,0,0)' : '#000');
        g.fillStyle = gr;
        g.fillRect(0, 0, w, h);
      };
      lin(0, 0, w, 0, x > 0, x + w < W);
      lin(0, 0, 0, h, y > 0, y + h < H);
    }
    g.globalCompositeOperation = 'source-over';
    return c;
  }

  /** La miniatura de Extras (un fotograma del techo). */
  static miniatura(ctx, r) {
    const im = imagen(`${CARP}insecto_miniatura.webp`);
    if (lista(im)) ctx.drawImage(im, r.x, r.y, r.w, r.h);
  }
}
