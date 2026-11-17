// =============================================================
// lore/FotosLore.js — (v2.20, el lore, fase B) Las fotos del laboratorio (catalogo.js FOTOS).
//   · lienzo(id): la foto con lo escrito a mano en el idioma de ahora (se rehace si cambia el idioma). La imagen y la
//     zona donde se escribe salen de assets/lore/fotos/ (integrar_fotos.py: <id>.webp + fotos.json).
//   · FotosConducto: las fotos pegadas en la chapa de los conductos de la Noche 6. Se dibujan con su perspectiva (el
//     conducto mide 1,2 × 1,2 m, los ojos a 0,45 m y 82° de campo, como conductos.py), antes que los enemigos (no los
//     tapan) y bajo la oscuridad de la linterna: sin luz no se ven. Cerca y alumbrada, «R» para mirarla de cerca
//     (Lectura) y queda en Extras > Archivo.
// =============================================================

import { CONFIG } from '../config.js';
import { dice, Idioma } from '../core/Idioma.js';
import { ExtrasProgreso } from '../core/ExtrasProgreso.js';
import { FOTOS } from './catalogo.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const BASE = 'assets/lore/fotos/';
const A = 0.6;                                   // medio ancho del conducto (conductos.py)
const OJOS = 0.45;
const FOCAL = (W / 2) / Math.tan((82 / 2) * Math.PI / 180);
export const FOTO_CONDUCTO = { ANCHO: 0.2, Z: 0.72, CERCA: [0.45, 2.3], TIRAS: 24 };

let DATOS = null;
const IMG = {};
function datos() {
  if (DATOS === null) {
    DATOS = {};
    fetch(BASE + 'fotos.json').then((r) => (r.ok ? r.json() : {})).then((d) => { DATOS = d; }).catch(() => {});
  }
  return DATOS;
}
function imagen(id) {
  let i = IMG[id];
  if (!i) {
    i = IMG[id] = new Image();
    i.src = BASE + id + '.webp';
  }
  return i.complete && i.naturalWidth ? i : null;
}
export function precargaFotos() {
  datos();
  for (const f of FOTOS) imagen(f.id);
}

// un generador con semilla (el temblor de la letra, siempre igual)
function azar(semilla) {
  let s = 0;
  for (const ch of String(semilla)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const CACHE = {};
/** La foto con su texto a mano, en el idioma de ahora (un canvas; null si aún no ha cargado). */
export function lienzo(id) {
  const f = FOTOS.find((x) => x.id === id);
  const im = imagen(id);
  const d = datos()?.[id];
  if (!f || !im || !d) return null;
  const clave = `${id}:${Idioma.actual()}`;
  if (CACHE[clave]) return CACHE[clave];
  const c = document.createElement('canvas');
  c.width = im.naturalWidth;
  c.height = im.naturalHeight;
  const ctx = c.getContext('2d');
  ctx.drawImage(im, 0, 0);
  escribe(ctx, f, d, c.width, c.height);
  CACHE[clave] = c;
  return c;
}

/** Lo escrito a mano: rotulador en las ordenadas; con `nervio`, letra que tiembla y se tuerce. Las partes entre [u]…[/u]
 *  van subrayadas; «¶» separa una segunda anotación (más abajo, otra letra). */
function escribe(ctx, f, d, w, h) {
  const r = azar(f.id);
  const z = d.escribe;
  const x0 = z.x * w, y0 = z.y * h, ancho = z.w * w, alto = z.h * h;
  const partes = dice(`lore.${f.id}_texto`).split('¶');
  const tinta = d.tinta ?? (f.tipo === 'radiografia' ? '#1b1b1b' : '#1d2a52');
  const letra = (k, t) => (k ? `italic ${Math.round(t * 1.1)}px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive`
    : `${f.nervio > 0.4 ? 'italic ' : ''}${t}px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive`);
  // las líneas de cada parte con un tamaño de letra; se baja hasta que todo quepa en la zona
  const parte = (t) => partes.map((p, k) => {
    ctx.font = letra(k, t);
    const ancho_k = k ? ancho * 0.75 : ancho;
    const lineas = [];
    let l = '';
    for (const pal of p.replace(/\[\/?u\]/g, '').trim().split(/\s+/)) {
      const prueba = l ? l + ' ' + pal : pal;
      if (ctx.measureText(prueba).width > ancho_k && l) { lineas.push(l); l = pal; } else l = prueba;
    }
    if (l) lineas.push(l);
    return lineas;
  });
  let tam = Math.round(alto / 2.2);
  let todas = parte(tam);
  const alturaDe = (t, ls) => ls.reduce((a, x) => a + x.length * t * 1.12, 0) + (ls.length - 1) * t * 0.2;
  while (tam > 12 && alturaDe(tam, todas) > alto * 0.98) todas = parte(--tam);
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  let y = y0 + tam * 0.95;
  partes.forEach((p, k) => {
    ctx.font = letra(k, tam);
    const subr = (p.match(/\[u\](.*?)\[\/u\]/) ?? [])[1];
    ctx.fillStyle = k ? '#7a140e' : tinta;
    for (const li of todas[k]) {
      let x = x0 + (k ? ancho * 0.25 : 0);
      for (const ch of li) {
        const n = f.nervio;
        ctx.save();
        ctx.translate(x, y + (r() - 0.5) * tam * 0.18 * n);
        ctx.rotate((r() - 0.5) * 0.25 * n - 0.03 * n);
        ctx.fillText(ch, 0, 0);
        ctx.restore();
        x += ctx.measureText(ch).width * (1 + (r() - 0.5) * 0.12 * n);
      }
      // el subrayado (las palabras entre [u]…[/u] que caen en esta línea)
      if (subr) {
        const pals = subr.trim().split(/\s+/);
        const ini = li.indexOf(pals[0]);
        if (ini >= 0) {
          const xa = x0 + ctx.measureText(li.slice(0, ini)).width;
          const xb = xa + Math.min(ctx.measureText(subr).width, ctx.measureText(li.slice(ini)).width);
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = Math.max(2, tam * 0.08);
          ctx.beginPath();
          ctx.moveTo(xa, y + tam * 0.2);
          ctx.quadraticCurveTo((xa + xb) / 2, y + tam * 0.28, xb, y + tam * 0.16);
          ctx.stroke();
        }
      }
      y += tam * 1.12;
    }
    y += tam * 0.2;
  });
  ctx.restore();
}

/** Las fotos de la Noche 6 en la chapa de los conductos (Night6Ducts la crea y la llama). */
export class FotosConducto {
  constructor(game) {
    this.g = game;
    this.cerca = null;
    precargaFotos();
  }

  /** Las que hay en este tramo, con su distancia por delante (m) y su lado. */
  _aqui(tramo, s) {
    const out = [];
    for (const f of FOTOS) {
      for (const [t, sf, lado] of f.sitios) if (t === tramo) out.push({ f, d: sf - s, lado });
    }
    return out;
  }

  update(tramo, s, luz) {
    this.cerca = null;
    if (!luz) return;
    for (const e of this._aqui(tramo, s)) {
      if (e.d >= FOTO_CONDUCTO.CERCA[0] && e.d <= FOTO_CONDUCTO.CERCA[1] && (!this.cerca || e.d < this.cerca.d)) this.cerca = e;
    }
  }

  /** R: mirarla de cerca. true si la ha abierto. */
  tecla(code) {
    if (code !== 'KeyR' || !this.cerca || !this.g.lectura) return false;
    this.g.lectura.abre(this.cerca.f.id, { foto: this.cerca.f });
    if (!this.g.esReto?.()) ExtrasProgreso.loreDa('fotos', this.cerca.f.id);
    return true;
  }

  /** Las fotos de este tramo en su pared (dentro de la transformación de la vista: se mueven con el balanceo). */
  draw(ctx, tramo, s) {
    for (const e of this._aqui(tramo, s)) {
      if (e.d < 0.3 || e.d > 7) continue;
      const c = lienzo(e.f.id) ?? imagen(e.f.id);
      if (!c) continue;
      const ancho = FOTO_CONDUCTO.ANCHO;
      const alto = ancho * (c.height / c.width);
      const zt = FOTO_CONDUCTO.Z + alto / 2, zb = FOTO_CONDUCTO.Z - alto / 2;
      const N = FOTO_CONDUCTO.TIRAS;
      const x = e.lado * A;
      for (let i = 0; i < N; i++) {
        // a la izquierda, la izquierda de la foto es la parte de cerca; a la derecha, la de lejos
        const ka = i / N, kb = (i + 1) / N;
        const ya = e.d - ancho / 2 + ancho * (e.lado < 0 ? ka : 1 - kb);
        const yb = e.d - ancho / 2 + ancho * (e.lado < 0 ? kb : 1 - ka);
        if (ya < 0.25) continue;
        const ym = (ya + yb) / 2;
        const sxa = W / 2 + FOCAL * x / ya, sxb = W / 2 + FOCAL * x / yb;
        const syt = H / 2 - FOCAL * (zt - OJOS) / ym, syb = H / 2 - FOCAL * (zb - OJOS) / ym;
        const dx = Math.min(sxa, sxb), dw = Math.abs(sxb - sxa) + 0.6;
        ctx.drawImage(c, ka * c.width, 0, c.width / N + 0.5, c.height, dx, syt, dw, syb - syt);
        // lo lejos, más oscuro (la linterna no llega)
        const k = Math.min(0.85, (ym / 5.5) ** 1.5);
        if (k > 0.02) {
          ctx.fillStyle = `rgba(0,0,0,${k})`;
          ctx.fillRect(dx, syt, dw, syb - syt);
        }
      }
    }
  }

  /** La «R» junto a la que está cerca y alumbrada (después de la oscuridad, para que se vea). */
  drawPista(ctx) {
    const e = this.cerca;
    if (!e) return;
    const sx = W / 2 + FOCAL * (e.lado * A) / Math.max(0.3, e.d);
    const sy = H / 2 - FOCAL * (FOTO_CONDUCTO.Z - OJOS) / Math.max(0.3, e.d);
    const x = Math.max(40, Math.min(W - 80, sx + (e.lado < 0 ? 60 : -100)));
    const y = Math.max(40, Math.min(H - 80, sy));
    ctx.save();
    ctx.strokeStyle = 'rgba(232,238,245,0.8)';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x, y, 34, 34);
    ctx.strokeRect(x, y, 34, 34);
    ctx.fillStyle = '#e8eef5';
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('R', x + 17, y + 18);
    ctx.restore();
  }
}

/** La foto a pantalla (Lectura): grande, un poco torcida, con su sombra. */
export function dibujaFoto(ctx, id, t) {
  const f = FOTOS.find((x) => x.id === id);
  const c = lienzo(id);
  const k = Math.min(1, t / 0.18);
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${0.82 * k})`;
  ctx.fillRect(0, 0, W, H);
  if (!c) {
    ctx.restore();
    return;
  }
  const esc = Math.min((H * 0.86) / c.height, (W * 0.7) / c.width);
  const w = c.width * esc, h = c.height * esc;
  const r = azar(id + 'g');
  ctx.translate(W / 2, H / 2 + (1 - k) * 30);
  ctx.rotate((r() - 0.5) * 0.04 * (1 + 2 * (f?.nervio ?? 0)));
  ctx.globalAlpha = k;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(-w / 2 + 12, -h / 2 + 14, w, h);
  ctx.drawImage(c, -w / 2, -h / 2, w, h);
  ctx.restore();
}
