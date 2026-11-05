// =============================================================
// comun.js — (v1.56) Lo que comparten los apartados de Extras: los textos (extras.json), el aspecto de terminal y
// unas ayudas de dibujo. Los textos se editan en programa/extras.json, sin tocar el código.
// =============================================================

import { ExtrasProgreso } from '../../core/ExtrasProgreso.js';
import { SaveData, slaimiDe } from '../../core/SaveData.js';

export const VERDE = '#7dffb0';
export const VERDE_OSC = 'rgba(125,255,176,0.45)';
export const TINTA = '#d8ffe8';
export const GRIS = 'rgba(150,160,170,0.55)';
export const FUENTE = '"Courier New", monospace';
export const MANO = '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive';

/** Lo que hay en extras.json (vacío hasta que carga). */
export const TEXTOS = { personajes: [], cintas: { lista: [] }, sustos: { lista: [] }, beta: { categorias: [] }, retos: [] };
export const textosListos = fetch('extras.json')
  .then((r) => (r.ok ? r.json() : {}))
  .then((d) => Object.assign(TEXTOS, d))
  .catch((e) => console.warn('Extras: no se pudo leer extras.json', e));

export const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/** Parte un texto en líneas que quepan en w (con la fuente ya puesta). */
export function lineas(ctx, texto, w) {
  const sal = [];
  let l = '';
  for (const p of String(texto).split(' ')) {
    const k = l ? `${l} ${p}` : p;
    if (ctx.measureText(k).width > w && l) {
      sal.push(l);
      l = p;
    } else l = k;
  }
  if (l) sal.push(l);
  return sal;
}

/** «1, 2, 3 y 5» */
export function listaNoches(n) {
  if (!n.length) return '—';
  if (n.length === 1) return String(n[0]);
  return `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`;
}

/** Las noches de un personaje o susto: hasta la 5, y las que se van añadiendo al completar la 6 y la 7. */
export function nochesDe(p, vivo = true) {
  const n = [...(p.noches ?? [])];
  if (vivo && p.al6 && ExtrasProgreso.n6() && !n.includes(6)) n.push(6);
  if (vivo && p.al7 && ExtrasProgreso.aberracion() && !n.includes(7)) n.push(7);
  return n;
}

/** Slaimi en esta partida: 'vivo', 'muerto' (en la 5) o 'sinver' (nunca salió, o murió en la 4: como si no apareciera). */
export function estadoSlaimi(game) {
  const dbg = ExtrasProgreso.slaimiDebug();
  if (dbg) return dbg;
  const s = slaimiDe(game?.save?.flags ?? SaveData.load()?.flags);
  if (!s) return 'sinver';
  if (s.estado === 'vivo') return 'vivo';
  return s.donde === 'n5' ? 'muerto' : 'sinver';
}

/** Una imagen que se pide una sola vez y se puede preguntar si ya está. */
const IMGS = new Map();
export function imagen(src) {
  let im = IMGS.get(src);
  if (!im) {
    im = new Image();
    im.src = src;
    IMGS.set(src, im);
  }
  return im;
}
export const lista = (im) => im && im.complete && im.naturalWidth > 0;

/** Dibuja la imagen encajada en un rectángulo, sin deformarla. */
export function encaja(ctx, im, r) {
  const k = Math.min(r.w / im.naturalWidth, r.h / im.naturalHeight);
  const w = im.naturalWidth * k;
  const h = im.naturalHeight * k;
  ctx.drawImage(im, r.x + (r.w - w) / 2, r.y + (r.h - h) / 2, w, h);
}

/** Un botón de terminal. */
export function boton(ctx, r, texto, { activo = false, encima = false, tam = 17, color = VERDE } = {}) {
  ctx.fillStyle = activo ? 'rgba(125,255,176,0.16)' : 'rgba(10,16,14,0.6)';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = activo || encima ? color : 'rgba(125,255,176,0.35)';
  ctx.lineWidth = activo ? 2 : 1.5;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.font = `bold ${tam}px ${FUENTE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = activo || encima ? TINTA : '#9fd8b4';
  ctx.fillText(texto, r.x + r.w / 2, r.y + r.h / 2 + 1);
}

/** Un triángulo de alerta como los del plano. */
export function triangulo(ctx, x, y, t, color, borde = null, grosor = 2) {
  ctx.beginPath();
  ctx.moveTo(x, y - t);
  ctx.lineTo(x + t * 0.9, y + t * 0.7);
  ctx.lineTo(x - t * 0.9, y + t * 0.7);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (borde) {
    ctx.strokeStyle = borde;
    ctx.lineWidth = grosor;
    ctx.stroke();
  }
}

/** Una silueta negra de fondo verde tenue con «???» (assets/extras/giro/<id>_sil.webp). */
export function silueta(ctx, id, r, tam = 40) {
  ctx.fillStyle = 'rgba(125,255,176,0.05)';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  const im = imagen(`assets/extras/giro/${id}_sil.webp`);
  if (lista(im)) encaja(ctx, im, { x: r.x + 6, y: r.y + 6, w: r.w - 12, h: r.h - 12 });
  ctx.font = `bold ${tam}px ${FUENTE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(216,255,232,0.85)';
  ctx.fillText('???', r.x + r.w / 2, r.y + r.h / 2);
}
