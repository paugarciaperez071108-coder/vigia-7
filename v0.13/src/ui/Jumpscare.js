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

  drawFace(ctx, kind, W / 2 + sx, H / 2 + 60 + sy, size, time);

  // Destellos rojos intermitentes
  if (Math.floor(time * 14) % 2 === 0) {
    ctx.fillStyle = 'rgba(160,0,0,0.25)';
    ctx.fillRect(0, 0, W, H);
  }
  effects.static(ctx, 0.25);
  effects.vignette(ctx, 0.9);
}
