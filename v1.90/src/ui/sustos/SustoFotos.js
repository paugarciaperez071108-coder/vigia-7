// =============================================================
// SustoFotos.js — (v1.82) Lo común de los SUSTOS NUEVOS hechos con fotogramas de Blender (El Congelado, El Espécimen,
// El Largo, El Dislocado; El Insecto, el primero, va aparte en SustoInsecto.js con la misma interfaz):
//   - carga las carpetas assets/sustos/v2/<carpeta>/ (indice.json + NN.webp: un recorte o la imagen entera);
//   - el tiempo: PRE s quietos (o lo que tarda en girarse la vista), los fotogramas a FPS, NEGRO s al final;
//   - el temblor, los fotogramas que se pierden (PIERDE), la oficina de fondo (Extras) y el apagón;
//   - cada susto pone encima sus efectos de lente (lente()).
// Interfaz (la de registro.js): new Clase({ …variante, giro, fondo, oscuro }) · .dura · .draw(ctx, t, effects) ·
// .sonido(audio, k) · static miniatura(ctx, r) · conOficina.
// =============================================================

import { CONFIG } from '../../config.js';
import * as L from './EfectosLente.js';

export const W = CONFIG.WIDTH;
export const H = CONFIG.HEIGHT;
const CARP = 'assets/sustos/v2/';
const DATOS = {};

/** Pide (una vez) el índice y los fotogramas de una carpeta. */
export function carga(carpeta) {
  if (DATOS[carpeta]) return DATOS[carpeta];
  const d = { ind: null, fotos: {} };
  DATOS[carpeta] = d;
  fetch(`${CARP}${carpeta}/indice.json`).then((r) => (r.ok ? r.json() : null)).then((ind) => {
    if (!ind) return;
    d.ind = ind;
    for (const [n, fo] of Object.entries(ind.fotogramas)) {
      if (!fo.archivo) continue;
      const im = new Image();
      im.decoding = 'async';
      im.src = `${CARP}${carpeta}/${fo.archivo}`;
      d.fotos[n] = im;
    }
  }).catch(() => {});
  return d;
}

export function listaCarpeta(carpeta) {
  const d = carga(carpeta);
  return !!(d.ind && Object.keys(d.fotos).length > 0);
}

export const lista = (im) => im && im.complete && im.naturalWidth > 0;
const IMGS = {};
export function imagen(src) {
  if (!IMGS[src]) {
    IMGS[src] = new Image();
    IMGS[src].src = src;
  }
  return IMGS[src];
}
export const miniaturaDe = (nombre) => (ctx, r) => {
  const im = imagen(`${CARP}${nombre}_miniatura.webp`);
  if (lista(im)) ctx.drawImage(im, r.x, r.y, r.w, r.h);
};

/**
 * Base. La subclase define C (la configuración: FPS, PRE, PRE_GIRO, ULTIMO, GOLPE, NEGRO, SONIDO, PIERDE, APAGON…),
 * this.carpeta, this.fondoSrc (la oficina de Extras) y lente(ctx, f, u, effects).
 */
export class SustoFotos {
  constructor(C, { giro = 0, fondo = false, oscuro = false } = {}) {
    this.C = C;
    this.giro = giro;
    this.fondoPropio = !!fondo;
    this.conOficina = !fondo;
    this.oscuro = !!oscuro;
    this.ini = C.DESDE ?? 0;
    this.t0 = giro + (giro > 0 ? (C.PRE_GIRO ?? 0.1) : C.PRE);
    this.tGolpe = this.t0 + (C.GOLPE - this.ini) / C.FPS;
    this.dura = this.t0 + (C.ULTIMO + 1 - this.ini) / C.FPS + C.NEGRO;
    this.visto = this.dura - C.NEGRO;
    this.ultima = null;
  }

  /** El índice del fotograma (para las subclases que leen datos de él: palmas, garras…). */
  datos(f) {
    return carga(this.carpeta).ind?.fotogramas?.[f] ?? null;
  }

  sonido(audio, k = 1) {
    audio?.lib?.play(this.C.SONIDO, { volume: 1, pitch: 1 / k, pitchVar: 0, volVar: 0, when: this.t0 * k });
  }

  fotograma(t) {
    const tt = t - this.t0;
    if (tt < 0) return null;
    const f = this.ini + Math.floor(tt * this.C.FPS);
    if (f > this.C.ULTIMO) return 'negro';
    return this.C.PIERDE?.[f] ?? f;
  }

  /** La oficina de fondo (Extras): la cara que toca, sin textos. */
  fondo(ctx) {
    const of = imagen(this.fondoSrc);
    if (lista(of)) ctx.drawImage(of, 0, 0, W, H);
    else L.negro(ctx);
  }

  /** El temblor en el fotograma f (u: s desde el golpe). */
  temblor(f, u) {
    return u >= 0 ? 0.35 + Math.exp(-u / 0.22) : 0;
  }

  /** Lo que se pinta debajo de los fotogramas (después de la oficina): nada por defecto. */
  debajo() {}

  draw(ctx, t, effects = null) {
    const f = this.fotograma(t);
    this.fActual = f;
    if (f === 'negro') {
      L.negro(ctx);
      return;
    }
    if (this.fondoPropio) this.fondo(ctx);
    const u = t - this.tGolpe;
    this.debajo(ctx, f, u, effects);
    if (f !== null) {
      const d = carga(this.carpeta);
      const fo = d.ind?.fotogramas?.[f];
      const im = d.fotos[f];
      const k = this.temblor(f, u);
      ctx.save();
      if (k > 0) {
        const [dx, dy] = L.temblor(k, this.C.TEMBLOR_PX ?? 46);
        ctx.translate(W / 2 + dx, H / 2 + dy);
        ctx.scale(1 + 0.04 * Math.min(1, k), 1 + 0.04 * Math.min(1, k));
        ctx.translate(-W / 2, -H / 2);
      }
      // (v1.87) «base»: con la cámara ya quieta en otro sitio (en el suelo…), los recortes van encima de ese fotograma
      // entero, no de la oficina
      if (fo && fo.base !== undefined) {
        const fb = d.ind.fotogramas[fo.base];
        const ib = d.fotos[fo.base];
        const b = fb && lista(ib) ? { im: ib, fo: fb } : this.ultima;
        if (b) {
          const { x = 0, y = 0, w = W, h = H } = b.fo;
          if (this.oscuro) ctx.drawImage(this._aOscuras(b.im, x, y, w, h), x, y, w, h);
          else ctx.drawImage(b.im, x, y, w, h);
        }
      }
      let pinta = null;
      if (fo && !fo.vacio && lista(im)) pinta = { im, fo };
      else if (this.ultima && (!fo || !fo.vacio)) pinta = this.ultima;      // (si aún no ha llegado, la anterior)
      if (pinta) {
        const { x = 0, y = 0, w = W, h = H } = pinta.fo;
        if (this.oscuro) ctx.drawImage(this._aOscuras(pinta.im, x, y, w, h), x, y, w, h);
        else ctx.drawImage(pinta.im, x, y, w, h);
        if (w >= W) this.ultima = pinta;
      }
      ctx.restore();
    }
    this.lente(ctx, f, u, effects);
    // (al pasar de recorte a imagen entera desaparecen los textos que pinta el juego —la consola, los carteles—: un
    // chispazo de estática lo tapa)
    if (typeof f === 'number' && this.C.SENAL?.[f]) L.senal(ctx, effects, this.C.SENAL[f]);
  }

  lente() {}

  /** (el apagón) el fotograma con la luz roja de emergencia; si es un recorte, con los bordes fundidos. */
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
    // (v1.89) cada susto puede cambiar el tono del apagón según el fotograma (colorApagon)
    g.fillStyle = `rgb(${(this.colorApagon?.(this.fActual) ?? this.C.APAGON ?? [112, 26, 14]).join(',')})`;
    g.fillRect(0, 0, w, h);
    if (w < W || h < H) {
      const b = this.C.APAGON_BORDE ?? 24;
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
}

// ---------------------------------------------------------------- efectos de lente nuevos (v1.82–v1.86)
/** Marcas de hielo de dos palmas en el cristal (puntos: el centro de cada palma, px), k 0 → 1. */
export function palmasHielo(ctx, puntos, k, { semilla = 21 } = {}) {
  if (k <= 0) return;
  const rn = L.azar(semilla);
  ctx.save();
  for (const [px, py] of puntos) {
    // la palma y cinco dedos hacia arriba, escarcha blanca con el borde más denso
    const forma = (dx, dy, rx, ry, rot = 0) => {
      ctx.beginPath();
      ctx.ellipse(px + dx, py + dy, rx, ry, rot, 0, Math.PI * 2);
    };
    const partes = [[0, 40, 120, 140, 0], [-95, -120, 26, 95, -0.25], [-38, -165, 25, 110, -0.08],
      [22, -170, 25, 112, 0.05], [78, -140, 24, 100, 0.2], [125, 20, 24, 75, 0.9]];
    for (const [dx, dy, rx, ry, rot] of partes) {
      forma(dx, dy, rx, ry, rot);
      const gr = ctx.createRadialGradient(px + dx, py + dy, 0, px + dx, py + dy, Math.max(rx, ry));
      gr.addColorStop(0, `rgba(205,230,255,${0.32 * k})`);
      gr.addColorStop(0.75, `rgba(225,242,255,${0.5 * k})`);
      gr.addColorStop(1, 'rgba(225,242,255,0)');
      ctx.fillStyle = gr;
      ctx.fill();
    }
    // cristales que salen de la marca
    ctx.strokeStyle = `rgba(240,250,255,${0.65 * k})`;
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 18; i++) {
      let a = rn() * Math.PI * 2;
      let x = px + Math.cos(a) * 110;
      let y = py + Math.sin(a) * 120;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let d = 0; d < 140 * k; d += 14) {
        a += (rn() - 0.5) * 0.7;
        x += Math.cos(a) * 14;
        y += Math.sin(a) * 14;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Arañazos en el cristal (los dedos que se arrastran): desde cada punto hacia abajo, k 0 → 1. */
export function aranazos(ctx, puntos, k, { semilla = 31, largo = 220, color = '235,245,255' } = {}) {
  if (k <= 0) return;
  const rn = L.azar(semilla);
  ctx.save();
  ctx.lineCap = 'round';
  for (const [px, py] of puntos) {
    for (let i = 0; i < 4; i++) {
      const x0 = px - 54 + i * 36 + (rn() - 0.5) * 10;
      const y0 = py - 150 + (rn() - 0.5) * 20;
      ctx.strokeStyle = `rgba(${color},${0.55 * k})`;
      ctx.lineWidth = 1.6 + rn() * 1.5;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x0 + (rn() - 0.5) * 30, y0 + largo * k * 0.5, x0 + (rn() - 0.5) * 24, y0 + largo * k);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** El luz de una puerta que parpadea (todo se apaga a ratos y se tiñe), k: fuerza. */
export function parpadeo(ctx, k, { color = '255,120,40', semilla = null } = {}) {
  if (k <= 0) return;
  const on = Math.random() < 0.55;
  ctx.fillStyle = on ? `rgba(${color},${0.08 * k})` : `rgba(0,0,0,${0.5 * k})`;
  ctx.fillRect(0, 0, W, H);
}

/** Aplastado: los lados de la imagen se cierran (las manos que aprietan), k 0 → 1. */
export function aplasta(ctx, k) {
  if (k <= 0) return;
  ctx.save();
  const ancho = W * 0.5 * k;
  for (const lado of [0, 1]) {
    const x0 = lado ? W - ancho : 0;
    const gr = ctx.createLinearGradient(lado ? W : 0, 0, lado ? W - ancho : ancho, 0);
    gr.addColorStop(0, 'rgba(0,0,0,1)');
    gr.addColorStop(0.7, `rgba(0,0,0,${0.85 * k})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(x0, 0, ancho, H);
  }
  ctx.restore();
}
