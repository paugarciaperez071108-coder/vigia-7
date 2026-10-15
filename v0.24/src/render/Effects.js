// =============================================================
// Effects.js — Efectos de pantalla: grano/estática y viñeta.
//
// La estática se genera una sola vez en varios canvas pequeños de
// ruido aleatorio; cada fotograma se elige uno y se repite como
// patrón por toda la pantalla. Es muy barato y da sensación de
// imagen "viva".
// =============================================================

import { CONFIG } from '../config.js';

const NOISE_SIZE = 160;
const NOISE_FRAMES = 6;

export class Effects {
  constructor(ctx) {
    this.patterns = [];
    for (let i = 0; i < NOISE_FRAMES; i++) {
      const c = document.createElement('canvas');
      c.width = c.height = NOISE_SIZE;
      const nctx = c.getContext('2d');
      const img = nctx.createImageData(NOISE_SIZE, NOISE_SIZE);
      for (let p = 0; p < img.data.length; p += 4) {
        const v = Math.random() * 255;
        img.data[p] = img.data[p + 1] = img.data[p + 2] = v;
        img.data[p + 3] = 255;
      }
      nctx.putImageData(img, 0, 0);
      this.patterns.push(ctx.createPattern(c, 'repeat'));
    }
    this.frame = 0;
  }

  /** Superpone ruido con la opacidad indicada (0..1). */
  static(ctx, alpha) {
    if (alpha <= 0) return;
    this.frame = (this.frame + 1) % NOISE_FRAMES;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.patterns[this.frame];
    // Desplazamiento aleatorio para que el patrón no se note repetido.
    ctx.translate(-Math.random() * NOISE_SIZE, -Math.random() * NOISE_SIZE);
    ctx.fillRect(0, 0, CONFIG.WIDTH + NOISE_SIZE, CONFIG.HEIGHT + NOISE_SIZE);
    ctx.restore();
  }

  /** Grano fino de película (se mezcla con la imagen, no la tapa). */
  grain(ctx, alpha) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    this.static(ctx, alpha);
    ctx.restore();
  }

  /** Oscurece los bordes de la pantalla. */
  vignette(ctx, strength = 0.75) {
    const g = ctx.createRadialGradient(
      CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, CONFIG.HEIGHT * 0.3,
      CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, CONFIG.WIDTH * 0.62,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
  }
}
