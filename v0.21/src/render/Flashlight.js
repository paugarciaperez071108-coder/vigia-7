// =============================================================
// Flashlight.js — Linterna del final de la noche 2.
//
// Todo queda a oscuras salvo un círculo de luz con bordes suaves que
// sigue al ratón (como en FNaF 4). Fuera del haz, como mucho, se
// adivinan siluetas casi negras (N2END.FLASH_DARKNESS).
//
// Parpadea de vez en cuando (solo se ve: para la mecánica sigue
// encendida, así no es injusto).
//
// Los enemigos se dibujan con reveal(): solo aparecen DENTRO del haz
// (sin luz no se ve ni su silueta).
// =============================================================

import { CONFIG } from '../config.js';
import { N2END } from '../night/night2ending.js';

const rand = ([a, b]) => a + Math.random() * (b - a);

export class Flashlight {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = CONFIG.WIDTH;
    this.canvas.height = CONFIG.HEIGHT;
    this.dark = this.canvas.getContext('2d');
    this.revealCanvas = document.createElement('canvas');
    this.revealCanvas.width = CONFIG.WIDTH;
    this.revealCanvas.height = CONFIG.HEIGHT;
    this.rev = this.revealCanvas.getContext('2d');
    this.reset();
  }

  reset() {
    this.taken = false;     // ¿la ha cogido de la mesa?
    this.on = false;
    this.scale = 1;         // tamaño del haz (Fase 2: N2END.P2_FLASH_SCALE)
    this.intensity = 1;     // fuerza de la luz (Fase 2: N2END.P2_FLASH_INTENSITY)
    this.burst = 0;         // s que quedan de parpadeo rápido (enemigo retirado)
    this.burstTime = 1;
    this.burstCount = 3;
    this.flickerIn = rand(N2END.FLICKER_EVERY);
    this.flicker = 0;
  }

  toggle() {
    if (!this.taken) return false;
    this.on = !this.on;
    return true;
  }

  /** Parpadeo rápido (count parpadeos en time s): un enemigo se ha retirado. */
  blink(count, time) {
    this.burst = time;
    this.burstTime = time;
    this.burstCount = count;
  }

  /** ¿Está apagada en este instante por el parpadeo rápido? (solo visual) */
  get blinkOff() {
    if (this.burst <= 0) return false;
    const k = 1 - this.burst / this.burstTime;
    return Math.floor(k * this.burstCount * 2) % 2 === 0;
  }

  get radius() {
    return N2END.FLASH_RADIUS * this.scale;
  }

  update(dt) {
    this.burst = Math.max(0, this.burst - dt);
    this.flicker = Math.max(0, this.flicker - dt);
    if (!this.on) return;
    this.flickerIn -= dt;
    if (this.flickerIn <= 0) {
      this.flickerIn = rand(N2END.FLICKER_EVERY);
      this.flicker = rand(N2END.FLICKER_TIME);
    }
  }

  /** ¿Ilumina el punto (x, y)? (lo que usa la mecánica) */
  lights(mx, my, x, y, extra = 0) {
    return this.on && Math.hypot(x - mx, y - my) < this.radius * 0.8 + extra;
  }

  /**
   * Oscuridad encima de la escena, con el agujero del haz en (mx, my).
   * area (opcional): solo esa zona queda a oscuras (el resto se ve).
   */
  draw(ctx, mx, my, area = null, darkness = N2END.FLASH_DARKNESS) {
    const d = this.dark;
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    d.fillStyle = `rgba(0,0,0,${darkness})`;
    d.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    if (this.on && !this.blinkOff) {
      // Durante el parpadeo, el haz casi se apaga (y tiembla un poco)
      const k = (this.flicker > 0 ? 0.25 + Math.random() * 0.2 : 1) * this.intensity;
      const r = this.radius * (this.flicker > 0 ? 0.9 : 1);
      d.globalCompositeOperation = 'destination-out';
      const g = d.createRadialGradient(mx, my, r * (1 - N2END.FLASH_SOFT), mx, my, r);
      g.addColorStop(0, `rgba(0,0,0,${k})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g;
      d.beginPath();
      d.arc(mx, my, r, 0, Math.PI * 2);
      d.fill();
    }
    ctx.save();
    if (area) {
      ctx.beginPath();
      ctx.rect(area.x, area.y, area.w, area.h);
      ctx.clip();
    }
    ctx.drawImage(this.canvas, 0, 0);
    if (this.on && this.flicker <= 0 && !this.blinkOff) {
      // Tono cálido de la bombilla dentro del haz
      const R = this.radius;
      ctx.save();
      ctx.globalCompositeOperation = 'soft-light';
      const g = ctx.createRadialGradient(mx, my, 0, mx, my, R);
      g.addColorStop(0, `rgba(255,235,190,${0.55 * this.intensity})`);
      g.addColorStop(1, 'rgba(255,235,190,0)');
      ctx.fillStyle = g;
      ctx.fillRect(mx - R, my - R, R * 2, R * 2);
      ctx.restore();
    }
    ctx.restore();
  }

  /** Dibuja con drawFn(ctx) SOLO lo que cae dentro del haz (los enemigos). */
  reveal(ctx, mx, my, drawFn) {
    if (!this.on || this.blinkOff) return;
    const r = this.rev;
    r.globalCompositeOperation = 'source-over';
    r.clearRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    drawFn(r);
    const R = this.radius;
    const k = (this.flicker > 0 ? 0.3 : 1) * this.intensity;
    r.globalCompositeOperation = 'destination-in';
    const g = r.createRadialGradient(mx, my, R * (1 - N2END.FLASH_SOFT), mx, my, R);
    g.addColorStop(0, `rgba(0,0,0,${k})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    r.fillStyle = g;
    r.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    ctx.drawImage(this.revealCanvas, 0, 0);
  }
}
