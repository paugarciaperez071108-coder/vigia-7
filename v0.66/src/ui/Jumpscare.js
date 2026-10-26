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

// -------------------------------------------------------------
// v0.66: el salto de El Congelado, en 3 variantes (tools/3d/susto_congelado.py
// → assets/sustos/frozen_v1..3.webp). Se mueve hasta el final: empuja hacia
// la lente, la cabeza tiembla, las garras se cierran y la boca se abre más,
// con sacudida y aberración cromática; al final la pantalla se congela (se
// agrieta como un cristal helado) y corta a negro. Entre 0,8 y 1 s.
// -------------------------------------------------------------
const SALTO_FPS = 24;
const CONGELA = 0.16;          // s del final con la pantalla helada y agrietada

/** Variantes del salto que ya están cargadas. */
export function saltosCongelado() {
  return ['frozen_v1', 'frozen_v2', 'frozen_v3'].filter(hasJumpscare);
}

/** Lo que dura el salto `kind` (s, con la pantalla que se congela). */
export function duracionSalto(kind) {
  return META[kind] ? META[kind].frames / SALTO_FPS + CONGELA : 0;
}

// Grietas del hielo: líneas quebradas desde unos cuantos puntos de impacto
// (fijas para cada salto; se generan al empezar)
function grietas(semilla) {
  let s = semilla;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const lineas = [];
  for (let c = 0; c < 3; c++) {
    const ox = 300 + rnd() * 1000;
    const oy = 200 + rnd() * 500;
    for (let k = 0; k < 9; k++) {
      let a = rnd() * Math.PI * 2;
      let x = ox;
      let y = oy;
      const pts = [[x, y]];
      for (let j = 0; j < 7; j++) {
        a += (rnd() - 0.5) * 0.9;
        const l = 40 + rnd() * 110;
        x += Math.cos(a) * l;
        y += Math.sin(a) * l;
        pts.push([x, y]);
      }
      lineas.push(pts);
    }
  }
  return lineas;
}
let GRIETAS = null;

export function drawSaltoCongelado(ctx, kind, time, effects, semilla = 7) {
  const W = CONFIG.WIDTH;
  const H = CONFIG.HEIGHT;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const m = META[kind];
  if (!m) return;
  const dur = m.frames / SALTO_FPS;
  if (time >= dur + CONGELA) return;                          // corte a negro
  const helado = time >= dur;
  const f = Math.min(m.frames - 1, Math.floor(time * SALTO_FPS));
  const k = Math.min(1, time / dur);
  const shake = helado ? 0 : 12 + 46 * k;
  const sx = (Math.random() - 0.5) * shake;
  const sy = (Math.random() - 0.5) * shake;
  const scale = 1 + 0.04 * k;
  // aberración cromática: dos copias desplazadas en rojo y azul
  const ab = helado ? 0 : 4 + 14 * k;
  ctx.save();
  drawFrame(ctx, kind, f, scale, sx, sy);
  if (ab > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = 'sepia(1) saturate(6) hue-rotate(-50deg) brightness(0.45)';
    drawFrame(ctx, kind, f, scale, sx + ab, sy, 0.35);
    ctx.filter = 'sepia(1) saturate(6) hue-rotate(170deg) brightness(0.45)';
    drawFrame(ctx, kind, f, scale, sx - ab, sy, 0.35);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
  if (helado) {
    // la pantalla se congela: velo blanco azulado y grietas de hielo
    const u = (time - dur) / CONGELA;
    GRIETAS ??= grietas(semilla);
    ctx.fillStyle = `rgba(200,225,255,${0.18 + 0.22 * u})`;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.strokeStyle = 'rgba(235,245,255,0.9)';
    ctx.shadowColor = 'rgba(160,210,255,0.9)';
    ctx.shadowBlur = 6;
    for (const pts of GRIETAS) {
      const n = Math.max(2, Math.ceil(pts.length * Math.min(1, u * 2.2)));
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let j = 1; j < n; j++) ctx.lineTo(pts[j][0], pts[j][1]);
      ctx.stroke();
    }
    ctx.restore();
  } else if (Math.random() < 0.35) glitchSlices(ctx, 0.3 + 0.4 * k);
  effects.static(ctx, 0.1 + 0.15 * k);
  effects.vignette(ctx, 0.85);
}

/** Empieza un salto nuevo (grietas distintas cada vez). */
export function nuevoSalto() {
  GRIETAS = null;
}
