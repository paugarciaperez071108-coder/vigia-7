// =============================================================
// Jumpscare.js — Susto al ser atrapado (rehecho en la v0.51).
//
// Cada enemigo tiene su propia secuencia 3D (tools/3d/sustos.py →
// assets/sustos/<enemigo>.webp, una tira de fotogramas, y sustos.json):
// se abalanza sobre la cámara con la cara deformada, luz dura desde
// abajo y desenfoque de movimiento. Ritmo (CONFIG.JUMPSCARE):
//   0 → LUNGE      la secuencia, acelerando, con estela de movimiento
//   LUNGE → CUT    impacto: destello, temblor fuerte, último fotograma
//   CUT → final    negro (silencio) hasta la pantalla de derrota
// Si un enemigo aún no tiene secuencia, se usa su cara (face_<enemigo>)
// con el mismo ritmo. El sonido lo genera AudioEngine.scream().
// =============================================================

import { CONFIG } from '../config.js';
import { drawFace } from '../render/CreatureArt.js';
import { glitchSlices } from '../render/Atmosphere.js';

let META = {};
const SHEETS = {};
fetch('assets/sustos/sustos.json').then((r) => (r.ok ? r.json() : {})).then((d) => {
  META = d;
  for (const kind of Object.keys(d)) {
    const img = new Image();
    img.src = `assets/sustos/${kind}.webp`;
    SHEETS[kind] = img;
  }
}).catch(() => {});

/** ¿Hay secuencia 3D para este enemigo? */
export function hasJumpscare(kind) {
  const img = SHEETS[kind];
  return !!(img && img.complete && img.naturalWidth && META[kind]);
}

/** Un fotograma de la tira, a pantalla completa, escalado y desplazado. */
function drawFrame(ctx, kind, i, scale, dx, dy, alpha = 1) {
  const m = META[kind];
  const n = Math.max(0, Math.min(m.frames - 1, i));
  const W = CONFIG.WIDTH;
  const H = CONFIG.HEIGHT;
  const w = W * scale;
  const h = H * scale;
  ctx.globalAlpha = alpha;
  ctx.drawImage(SHEETS[kind], n * m.w, 0, m.w, m.h, (W - w) / 2 + dx, (H - h) / 2 + dy, w, h);
  ctx.globalAlpha = 1;
}

export function drawJumpscare(ctx, kind, time, effects) {
  const J = CONFIG.JUMPSCARE;
  const W = CONFIG.WIDTH;
  const H = CONFIG.HEIGHT;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  // Corte a negro después del impacto
  if (time >= J.CUT) return;

  const lunge = Math.min(1, time / J.LUNGE);
  const hit = time >= J.LUNGE;
  const shake = hit ? J.SHAKE : J.SHAKE * 0.25 * lunge;
  const sx = (Math.random() - 0.5) * shake;
  const sy = (Math.random() - 0.5) * shake;

  ctx.save();
  if (hasJumpscare(kind)) {
    const n = META[kind].frames;
    // Acelera: los primeros fotogramas pasan lentos, los últimos de golpe
    const f = hit ? n - 1 : Math.floor(Math.pow(lunge, 1.6) * (n - 1));
    const scale = hit ? 1.06 + 0.03 * Math.sin(time * 70) : 1;
    // Estela: los dos fotogramas anteriores, más grandes y transparentes
    if (!hit) {
      drawFrame(ctx, kind, f - 2, 1.05, -sx * 1.5, -sy * 1.5, J.BLUR * 0.5);
      drawFrame(ctx, kind, f - 1, 1.025, -sx, -sy, J.BLUR);
    }
    drawFrame(ctx, kind, f, scale, sx, sy);
  } else {
    // Sin secuencia todavía: su cara entra a toda velocidad
    const size = 200 + 1000 * lunge * lunge * lunge + (hit ? Math.sin(time * 60) * 40 : 0);
    ctx.translate(W / 2 + sx, H / 2 + 60 + sy);
    ctx.globalAlpha = J.BLUR;
    drawFace(ctx, kind, -sx * 0.8, sy * 0.5, size * 0.92, time);
    ctx.globalAlpha = 1;
    drawFace(ctx, kind, 0, 0, size, time);
  }
  ctx.restore();

  // Luz dura desde abajo: oscuridad arriba
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.55, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (hit) {
    // Destello blanco del impacto y luego rojo
    const k = (time - J.LUNGE) / Math.max(0.01, J.CUT - J.LUNGE);
    ctx.fillStyle = k < 0.25 ? `rgba(255,255,255,${0.85 * (1 - k / 0.25)})` : `rgba(170,0,0,${0.3 * (1 - k)})`;
    ctx.fillRect(0, 0, W, H);
    glitchSlices(ctx, 0.6 + 0.4 * Math.random());
  }
  effects.static(ctx, hit ? 0.3 : 0.12);
  effects.vignette(ctx, 0.9);
}
