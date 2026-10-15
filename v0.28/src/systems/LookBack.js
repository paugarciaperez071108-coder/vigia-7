// =============================================================
// LookBack.js — GIRARSE HACIA ATRÁS para mirar el PASILLO CENTRAL, que
// está detrás de la oficina (sistema reutilizable: final de la noche 2 y,
// desde la noche 3, en cualquier momento del turno).
//
// Control: dos franjas abajo, en las esquinas (TURN_STRIPS; la del
// centro es la pestaña de las cámaras). Al dejar el ratón en una
// CONFIG.LOOK_BACK.DWELL s, la vista se gira; hay que sacarlo y volver a
// pasarlo para girarse otra vez. También con la tecla CONFIG.LOOK_BACK.KEY.
//
// Mientras se mira hacia atrás (k > 0) no se ven las puertas, los botones
// ni la pestaña de las cámaras: quien lo use debe bloquearlos (k > 0).
//
// Uso:
//   lb.hover(x, y)             al mover el ratón
//   lb.update(dt)              cada fotograma
//   lb.toggle() / lb.turn(b)   girarse (b = true: hacia atrás)
//   lb.draw(ctx, front, back)  dibuja la vista (con el giro animado)
//   lb.drawStrips(ctx)         las franjas (encima de todo)
// =============================================================

import { CONFIG } from '../config.js';

const W = CONFIG.WIDTH;
export const TURN_STRIPS = [
  { x: 0, y: 846, w: 540, h: 54, side: 'left' },
  { x: 1060, y: 846, w: 540, h: 54, side: 'right' },
];
const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export class LookBack {
  constructor() {
    this.enabled = false;
    this.onTurn = null;     // callback(back) al girarse
    this.reset();
  }

  reset() {
    this.back = false;      // hacia dónde mira (o hacia dónde se está girando)
    this.k = 0;             // 0 = de frente, 1 = mirando atrás
    this.hoverT = 0;
    this.armed = true;
    this.inStrip = null;
    this.time = 0;
  }

  /** ¿Está mirando (o girándose) hacia atrás? */
  get turned() {
    return this.k > 0 || this.back;
  }

  get facingBack() {
    return this.k >= 1;
  }

  hover(x, y) {
    this.inStrip = this.enabled ? TURN_STRIPS.find((r) => inside(r, x, y)) ?? null : null;
    return !!this.inStrip;
  }

  toggle() {
    if (!this.enabled) return false;
    return this.turn(!this.back);
  }

  /** Girarse (también si el control está desactivado: escenas automáticas). */
  turn(back) {
    if (this.back === back) return false;
    this.back = back;
    this.armed = false;
    this.hoverT = 0;
    this.onTurn?.(back);
    return true;
  }

  update(dt) {
    this.time += dt;
    if (this.inStrip && this.armed && this.enabled) {
      this.hoverT += dt;
      if (this.hoverT >= CONFIG.LOOK_BACK.DWELL) this.toggle();
    } else if (!this.inStrip) {
      this.armed = true;
      this.hoverT = 0;
    }
    const step = dt / CONFIG.LOOK_BACK.TURN_TIME;
    this.k = this.back ? Math.min(1, this.k + step) : Math.max(0, this.k - step);
  }

  /** front(ctx) y back(ctx) dibujan cada vista a pantalla completa. */
  draw(ctx, front, back) {
    if (this.k <= 0) return front(ctx);
    if (this.k >= 1) return back(ctx);
    // Giro: la vista de frente se va hacia un lado y entra la de atrás
    const e = this.k * this.k * (3 - 2 * this.k);
    ctx.save();
    ctx.translate(-e * W, 0);
    front(ctx);
    ctx.restore();
    ctx.save();
    ctx.translate((1 - e) * W, 0);
    back(ctx);
    ctx.restore();
    // Barrido: se oscurece en mitad del giro
    ctx.fillStyle = `rgba(0,0,0,${0.55 * Math.sin(Math.PI * this.k)})`;
    ctx.fillRect(0, 0, W, CONFIG.HEIGHT);
  }

  drawStrips(ctx) {
    if (!this.enabled) return;
    ctx.save();
    for (const r of TURN_STRIPS) {
      const hot = this.inStrip === r;
      const fill = hot ? Math.min(1, this.hoverT / CONFIG.LOOK_BACK.DWELL) : 0;
      ctx.fillStyle = `rgba(20,30,26,${hot ? 0.55 : 0.28})`;
      ctx.fillRect(r.x, r.y + 14, r.w, r.h - 14);
      if (fill > 0 && this.armed) {
        ctx.fillStyle = 'rgba(125,255,176,0.25)';
        ctx.fillRect(r.x, r.y + 14, r.w * fill, r.h - 14);
      }
      // Flecha de giro
      const cx = r.side === 'left' ? r.x + 60 : r.x + r.w - 60;
      const cy = r.y + 34;
      ctx.strokeStyle = `rgba(125,255,176,${hot ? 0.9 : 0.45})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 11, Math.PI * 0.15, Math.PI * 1.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 9, cy - 13);
      ctx.lineTo(cx + 13, cy - 4);
      ctx.lineTo(cx + 3, cy - 5);
      ctx.stroke();
      ctx.fillStyle = `rgba(125,255,176,${hot ? 0.9 : 0.5})`;
      ctx.font = '14px "Courier New", monospace';
      ctx.textAlign = r.side === 'left' ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.back ? 'VOLVER (V)' : 'GIRARSE (V)', r.side === 'left' ? cx + 22 : cx - 22, cy);
    }
    ctx.restore();
  }
}
