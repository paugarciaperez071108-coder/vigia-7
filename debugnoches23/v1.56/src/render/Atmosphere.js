// =============================================================
// Atmosphere.js — Efectos de ambiente reutilizables (solo visuales).
//
//   Dust          motas de polvo flotando en el aire. Brillan más
//                 cerca de las fuentes de luz que se le pasan.
//   glitchSlices  fallo de imagen: franjas horizontales de la imagen
//                 ya dibujada que se desplazan, con bordes rojo/cian.
//   lightPool     mancha de luz suave (pantallas, paneles, ventanas).
//
// Nada de esto afecta a la jugabilidad: solo cambia lo que se ve.
// =============================================================

import { CONFIG } from '../config.js';
import { Random } from '../core/Random.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;

export class Dust {
  /**
   * @param seed  semilla (cada sitio tiene su polvo)
   * @param n     número de motas
   * @param area  { x, y, w, h } zona por la que flotan
   */
  constructor(seed, n = 70, area = { x: 0, y: 0, w: W, h: H }) {
    const rng = new Random(seed);
    this.area = area;
    this.motes = Array.from({ length: n }, () => ({
      x: rng.next(), y: rng.next(),
      z: rng.range(0.3, 1),            // profundidad: las cercanas, más grandes y rápidas
      vx: rng.range(-0.006, 0.006), vy: rng.range(-0.004, 0.008),
      ph: rng.range(0, Math.PI * 2), sp: rng.range(0.3, 1),
    }));
    this.time = 0;
  }

  update(dt) {
    this.time += dt;
    for (const m of this.motes) {
      m.x = (m.x + m.vx * dt * m.z + 1) % 1;
      m.y = (m.y + m.vy * dt * m.z + 1) % 1;
    }
  }

  /**
   * @param opts.alpha    opacidad máxima
   * @param opts.color    'r,g,b'
   * @param opts.lights   [{ x, y, r }] fuentes de luz: cerca brillan más
   *                      (sin luces, todas con la misma opacidad)
   * @param opts.px, py   desplazamiento de paralaje (se multiplica por z)
   */
  draw(ctx, { alpha = 0.35, color = '220,225,230', lights = null, px = 0, py = 0 } = {}) {
    const a = this.area;
    ctx.save();
    for (const m of this.motes) {
      const x = a.x + m.x * a.w + Math.sin(this.time * m.sp + m.ph) * 6 + px * m.z;
      const y = a.y + m.y * a.h + Math.cos(this.time * m.sp * 0.7 + m.ph) * 4 + py * m.z;
      let k = 1;
      if (lights) {
        k = 0;
        for (const l of lights) {
          const d = Math.hypot(x - l.x, y - l.y) / l.r;
          if (d < 1) k = Math.max(k, 1 - d);
        }
        if (k <= 0.02) continue;
      }
      const tw = 0.6 + 0.4 * Math.sin(this.time * 2 * m.sp + m.ph * 3);
      ctx.fillStyle = `rgba(${color},${alpha * k * tw * m.z})`;
      const s = 1 + m.z * 2.2;
      ctx.fillRect(x, y, s, s);
    }
    ctx.restore();
  }
}

/**
 * Fallo de imagen sobre lo que ya hay dibujado: franjas desplazadas
 * a los lados y líneas de color separadas (rojo/cian). k = 0..1.
 */
export function glitchSlices(ctx, k) {
  if (k <= 0.02) return;
  const m = ctx.getTransform();
  const c = ctx.canvas;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const n = Math.ceil(2 + 7 * k);
  for (let i = 0; i < n; i++) {
    if (Math.random() > 0.3 + 0.6 * k) continue;
    const y = m.f + Math.random() * H * m.d;
    const h = (4 + Math.random() * 46 * k) * m.d;
    const dx = (Math.random() - 0.5) * 90 * k * m.a;
    try {
      ctx.drawImage(c, m.e, y, W * m.a, h, m.e + dx, y, W * m.a, h);
    } catch { /* canvas sin tamaño todavía */ }
    // Separación de color en el borde de la franja
    ctx.fillStyle = Math.random() < 0.5 ? `rgba(255,40,60,${0.18 * k})` : `rgba(40,220,255,${0.18 * k})`;
    ctx.fillRect(m.e, y, W * m.a, Math.max(1, 2 * m.d));
  }
  ctx.restore();
}

/** Mancha de luz suave con centro en (x, y). */
export function lightPool(ctx, x, y, r, color, alpha, sy = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, sy);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, `rgba(${color},${alpha})`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
}
