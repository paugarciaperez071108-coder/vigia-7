// =============================================================
// Jumpscare.js — Susto al ser atrapado.
//
// La cara de la criatura entra a toda velocidad hasta llenar la
// pantalla, con temblor, destellos rojos y estática. Dura
// CONFIG.JUMPSCARE_TIME segundos; después aparece la pantalla de
// derrota. El sonido lo genera AudioEngine.scream().
// =============================================================

import { CONFIG } from '../config.js';
import { drawFace } from '../render/CreatureArt.js';
import { glitchSlices } from '../render/Atmosphere.js';

export function drawJumpscare(ctx, kind, time, effects) {
  const W = CONFIG.WIDTH;
  const H = CONFIG.HEIGHT;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // Crece muy rápido los primeros 0,25 s y luego "respira"
  const grow = Math.min(1, time / 0.25);
  const size = 200 + 900 * grow * grow + Math.sin(time * 40) * 30;
  const shake = 40 * (1 - Math.min(1, time / CONFIG.JUMPSCARE_TIME) * 0.5);
  const sx = (Math.random() - 0.5) * shake;
  const sy = (Math.random() - 0.5) * shake;

  // Varios "fotogramas": cada 0,07 s cambia un poco la inclinación y el
  // tamaño, como una animación entrecortada
  const frame = Math.floor(time / 0.07);
  const tilt = ((frame * 37) % 9 - 4) * 0.012;
  const bump = 1 + ((frame * 53) % 7) * 0.012;
  ctx.save();
  ctx.translate(W / 2 + sx, H / 2 + 60 + sy);
  ctx.rotate(tilt);
  // Imagen fantasma desplazada detrás (efecto de vibración)
  ctx.globalAlpha = 0.25;
  drawFace(ctx, kind, -sx * 0.6, sy * 0.4, size * bump * 1.04, time);
  ctx.globalAlpha = 1;
  drawFace(ctx, kind, 0, 0, size * bump, time);
  ctx.restore();

  // Destello rojo al principio y destellos intermitentes después
  if (time < 0.12) {
    ctx.fillStyle = `rgba(220,0,0,${0.6 * (1 - time / 0.12)})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (Math.floor(time * 14) % 2 === 0) {
    ctx.fillStyle = 'rgba(160,0,0,0.25)';
    ctx.fillRect(0, 0, W, H);
  }
  glitchSlices(ctx, 0.5 + 0.5 * Math.random());
  effects.static(ctx, 0.25);
  effects.vignette(ctx, 0.9);
}
