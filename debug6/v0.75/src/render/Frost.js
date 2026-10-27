// =============================================================
// Frost.js — El frío de la fuga de Criogenia (noche 5, v0.46) y la
// oficina «después de la fuga» (preparada para la noche 6).
//
//   drawFog(ctx, k, t)          niebla blanca a ras de suelo (k: altura 0-1)
//   drawWallFrost(ctx, k)       escarcha que se extiende por las paredes
//   drawEdgeFrost(ctx, k)       la pantalla congelándose por los bordes
//   drawBreath(ctx, puffs)      vaho de la respiración (lista de soplos)
//   drawPostLeak(ctx, face, o)  la oficina tras la fuga: escarcha en
//                               paredes y suelo, cristales empañados,
//                               chispas y la taquilla cubierta de hielo
// Las texturas se generan una vez (lienzos con semilla fija).
// =============================================================

import { CONFIG } from '../config.js';
import { Random } from '../core/Random.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
let TEX = null;

function lienzo(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Cristales de hielo: ramas finas que salen de un punto. */
function cristal(g, rng, x, y, len, ang, depth) {
  if (depth <= 0 || len < 3) return;
  const x2 = x + Math.cos(ang) * len;
  const y2 = y + Math.sin(ang) * len;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x2, y2);
  g.stroke();
  const n = 2 + rng.int(0, 2);
  for (let i = 0; i < n; i++) {
    const t = rng.range(0.3, 0.9);
    cristal(g, rng, x + (x2 - x) * t, y + (y2 - y) * t, len * rng.range(0.35, 0.6), ang + rng.range(-1.1, 1.1), depth - 1);
  }
}

function texturas() {
  if (TEX) return TEX;
  const rng = new Random(55);
  // Bordes de la pantalla congelados (más denso cuanto más cerca del borde)
  const edge = lienzo(W, H);
  const g = edge.getContext('2d');
  const grad = (x0, y0, x1, y1) => {
    const l = g.createLinearGradient(x0, y0, x1, y1);
    l.addColorStop(0, 'rgba(225,240,255,0.85)');
    l.addColorStop(1, 'rgba(225,240,255,0)');
    return l;
  };
  g.fillStyle = grad(0, 0, 0, 160); g.fillRect(0, 0, W, 160);
  g.fillStyle = grad(0, H, 0, H - 200); g.fillRect(0, H - 200, W, 200);
  g.fillStyle = grad(0, 0, 220, 0); g.fillRect(0, 0, 220, H);
  g.fillStyle = grad(W, 0, W - 220, 0); g.fillRect(W - 220, 0, 220, H);
  g.strokeStyle = 'rgba(245,252,255,0.55)';
  g.lineWidth = 1.2;
  for (let i = 0; i < 260; i++) {
    const side = rng.int(0, 3);
    const x = side === 0 ? rng.range(0, 60) : side === 1 ? rng.range(W - 60, W) : rng.range(0, W);
    const y = side === 2 ? rng.range(0, 50) : side === 3 ? rng.range(H - 60, H) : rng.range(0, H);
    const ang = Math.atan2(H / 2 - y, W / 2 - x) + rng.range(-0.7, 0.7);
    cristal(g, rng, x, y, rng.range(40, 140), ang, 4);
  }
  // Escarcha de pared: manchas blancas con ruido y cristales
  const wall = lienzo(W, H);
  const w = wall.getContext('2d');
  for (let i = 0; i < 70; i++) {
    const x = rng.range(0, W);
    const y = rng.range(0, H * 0.85);
    const r = rng.range(60, 220);
    const rg = w.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(220,235,250,0.32)');
    rg.addColorStop(1, 'rgba(220,235,250,0)');
    w.fillStyle = rg;
    w.fillRect(x - r, y - r, r * 2, r * 2);
  }
  w.strokeStyle = 'rgba(240,250,255,0.35)';
  w.lineWidth = 1;
  for (let i = 0; i < 120; i++) cristal(w, rng, rng.range(0, W), rng.range(0, H), rng.range(20, 90), rng.range(0, Math.PI * 2), 3);
  // Niebla: bandas de ruido suave (se desplaza)
  const fog = lienzo(W, 400);
  const f = fog.getContext('2d');
  for (let i = 0; i < 160; i++) {
    // (se repite en horizontal: las manchas de los bordes se copian al otro lado)
    const x = rng.range(0, W);
    const y = rng.range(190, 400);
    const r = rng.range(70, 180);
    const rg = f.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(235,245,255,0.22)');
    rg.addColorStop(1, 'rgba(235,245,255,0)');
    f.fillStyle = rg;
    for (const dx of [-W, 0, W]) f.fillRect(x + dx - r, y - r, r * 2, r * 2);
  }
  // Arriba se desvanece (sin borde)
  f.globalCompositeOperation = 'destination-in';
  const fade = f.createLinearGradient(0, 0, 0, 400);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(0.55, 'rgba(0,0,0,1)');
  f.fillStyle = fade;
  f.fillRect(0, 0, W, 400);
  TEX = { edge, wall, fog };
  return TEX;
}

export function drawFog(ctx, k, t = 0) {
  if (k <= 0) return;
  const T = texturas();
  const top = H - H * k;
  ctx.save();
  const g = ctx.createLinearGradient(0, top - 80, 0, H);
  g.addColorStop(0, 'rgba(225,238,250,0)');
  g.addColorStop(0.35, 'rgba(225,238,250,0.35)');
  g.addColorStop(1, 'rgba(235,245,255,0.82)');
  ctx.fillStyle = g;
  ctx.fillRect(0, top - 80, W, H - top + 80);
  // Volutas que se mueven despacio
  const off = (t * 40) % W;
  const fh = Math.max(120, H * k + 120);
  ctx.globalAlpha = Math.min(1, 0.4 + k);
  ctx.drawImage(T.fog, -off, H - fh, W, fh);
  ctx.drawImage(T.fog, W - off, H - fh, W, fh);
  ctx.restore();
}

export function drawWallFrost(ctx, k) {
  if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, k);
  ctx.drawImage(texturas().wall, 0, 0);
  ctx.restore();
}

export function drawEdgeFrost(ctx, k) {
  if (k <= 0) return;
  const T = texturas();
  ctx.save();
  // Crece desde los bordes hacia el centro
  const s = 1 + 0.6 * (1 - Math.min(1, k));
  ctx.globalAlpha = Math.min(1, k * 1.2);
  ctx.translate(W / 2, H / 2);
  ctx.scale(s, s);
  ctx.drawImage(T.edge, -W / 2, -H / 2);
  ctx.restore();
  if (k > 0.6) {
    // Al final, todo se vuelve blanco por los bordes
    const r = ctx.createRadialGradient(W / 2, H / 2, H * (0.75 - 0.5 * (k - 0.6)), W / 2, H / 2, H);
    r.addColorStop(0, 'rgba(235,245,255,0)');
    r.addColorStop(1, `rgba(235,245,255,${(k - 0.6) * 1.8})`);
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, W, H);
  }
}

/** Soplos de vaho: [{ t, dur, x }] (abajo en el centro, suben y se deshacen). */
export function drawBreath(ctx, puffs) {
  ctx.save();
  for (const p of puffs) {
    const u = p.t / p.dur;
    if (u < 0 || u > 1) continue;
    const r = 60 + 220 * u;
    const y = H + 20 - 240 * u;
    const a = 0.22 * Math.sin(Math.PI * u);
    const g = ctx.createRadialGradient(p.x, y, 0, p.x, y, r);
    g.addColorStop(0, `rgba(240,248,255,${a})`);
    g.addColorStop(1, 'rgba(240,248,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(p.x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
}

// --- La oficina tras la fuga (noche 6) ---
const WINDOW = { x: 540, y: 110, w: 520, h: 300 };
const LOCKERS = { x: 140, y: 290, w: 374, h: 442 };
const CONSOLE = { x: 650, y: 560, w: 300, h: 180 };

/**
 * opts: { time, slaimi: 'taquilla' | 'congelado' | null }.
 * Se dibuja encima de la pared ya pintada (sin el movimiento de la vista).
 */
export function drawPostLeak(ctx, face, opts = {}) {
  const t = opts.time ?? 0;
  // (v0.74) fuerza < 1: la escarcha medio fundida (la noche 6, al volver)
  ctx.save();
  ctx.globalAlpha = opts.fuerza ?? 1;
  try {
    _postLeak(ctx, face, opts, t);
  } finally {
    ctx.restore();
  }
}

function _postLeak(ctx, face, opts, t) {
  drawWallFrost(ctx, 0.85);
  // Suelo helado
  const g = ctx.createLinearGradient(0, H * 0.72, 0, H);
  g.addColorStop(0, 'rgba(220,235,250,0)');
  g.addColorStop(1, 'rgba(220,235,250,0.4)');
  ctx.fillStyle = g;
  ctx.fillRect(0, H * 0.72, W, H * 0.28);
  if (face === 'front') {
    // Cristal del ventanal empañado
    ctx.save();
    ctx.fillStyle = 'rgba(210,225,240,0.42)';
    ctx.fillRect(WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h);
    ctx.restore();
    // La consola con chispas de vez en cuando
    if (Math.sin(t * 7.3) > 0.93 || Math.sin(t * 3.1 + 1) > 0.97) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,240,170,0.95)';
      ctx.lineWidth = 2;
      const x = CONSOLE.x + CONSOLE.w * (0.2 + 0.6 * ((Math.sin(t * 13) + 1) / 2));
      const y = CONSOLE.y + 10;
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.35;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * 40, y + Math.sin(a) * 40);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  if (face === 'back') {
    // La taquilla cubierta de hielo
    ctx.save();
    ctx.fillStyle = 'rgba(205,228,250,0.45)';
    ctx.fillRect(LOCKERS.x, LOCKERS.y, LOCKERS.w, LOCKERS.h);
    ctx.strokeStyle = 'rgba(245,252,255,0.6)';
    ctx.lineWidth = 2;
    const rng = new Random(9);
    for (let i = 0; i < 26; i++) {
      cristal(ctx, rng, LOCKERS.x + rng.range(0, LOCKERS.w), LOCKERS.y + rng.range(0, LOCKERS.h), rng.range(15, 60), rng.range(0, 6.3), 3);
    }
    if (opts.slaimi === 'taquilla') {
      // Slaimi dentro: su luz violeta, débil, por las rendijas
      const cx = 266 + 61;
      const rg = ctx.createRadialGradient(cx, 420, 0, cx, 420, 160);
      rg.addColorStop(0, `rgba(143,107,255,${0.28 + 0.06 * Math.sin(t * 2)})`);
      rg.addColorStop(1, 'rgba(143,107,255,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rg;
      ctx.fillRect(cx - 160, 260, 320, 320);
    }
    ctx.restore();
  }
}
