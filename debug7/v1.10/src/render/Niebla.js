// =============================================================
// Niebla.js — Niebla de suelo CON VOLUMEN (v0.77; el usuario: «la niebla
// del suelo de la sala oculta es una franja blanca plana»).
//
// Varias capas de volutas (texturas de ruido suave hechas una vez, que se
// repiten en horizontal) a distintas alturas, escalas y velocidades: las de
// delante, más grandes, más bajas y más rápidas (paralaje). La niebla no
// tiene luz propia: es oscura, y SOLO se aclara donde la alcanzan las luces
// de la sala (se pinta la luz encima, recortada a la propia niebla).
//
//   drawNiebla(ctx, k, t, luces)   k: densidad (0–1) · t: tiempo (s)
//   luces: [{ x, y, r, color: [r, g, b], fuerza }] en coordenadas de pantalla
// =============================================================

import { CONFIG } from '../config.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const TW = 1024;
const TH = 320;

let texturas = null;
let lienzo = null;

/** Una textura de volutas que se repite en horizontal (sin costura). */
function volutas(semilla, manchas) {
  const c = document.createElement('canvas');
  c.width = TW;
  c.height = TH;
  const g = c.getContext('2d');
  let s = semilla;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < manchas; i++) {
    const x = rnd() * TW;
    const y = TH * (0.25 + 0.75 * rnd() ** 0.7);       // (más denso abajo)
    const r = 40 + rnd() * 150;
    const a = 0.05 + 0.12 * rnd();
    for (const dx of [-TW, 0, TW]) {                    // (repetida a los lados: sin costura)
      const gr = g.createRadialGradient(x + dx, y, 0, x + dx, y, r);
      gr.addColorStop(0, `rgba(255,255,255,${a})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(x + dx, y, r, r * (0.35 + 0.3 * rnd()), 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  return c;
}

function preparar() {
  if (texturas) return;
  texturas = [volutas(7, 260), volutas(131, 200), volutas(977, 150)];
  lienzo = document.createElement('canvas');
  lienzo.width = W;
  lienzo.height = H;
}

// Capas: [textura, techo de la capa (× H), alto (× H), velocidad px/s, escala, opacidad]
const CAPAS = [
  [0, 0.6, 0.42, 7, 1.3, 0.55],
  [1, 0.66, 0.4, -11, 1.7, 0.6],
  [2, 0.74, 0.34, 18, 2.3, 0.7],
];

export function drawNiebla(ctx, k, t, luces = []) {
  if (k <= 0) return;
  preparar();
  const g = lienzo.getContext('2d');
  g.clearRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
  for (const [i, y0, alto, vel, esc, op] of CAPAS) {
    const tex = texturas[i];
    const tw = TW * esc;
    const th = Math.min(H * alto, TH * esc * 0.9);
    const y = H * y0 + Math.sin(t * 0.25 + i) * 6;
    let x = -((t * vel) % tw);
    if (x > 0) x -= tw;
    g.globalAlpha = Math.min(1, op * (0.35 + 0.9 * k));
    for (; x < W; x += tw) g.drawImage(tex, x, y, tw, th);
    // (y lo que queda por debajo de la capa, para que no se vea el borde)
    g.fillStyle = `rgba(255,255,255,${0.05 * k})`;
    g.fillRect(0, y + th * 0.85, W, H);
  }
  g.globalAlpha = 1;
  // La niebla, oscura (gris azulado): sin luz propia
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = 'rgba(96,108,124,0.9)';
  g.fillRect(0, 0, W, H);
  // Y donde la alcanzan las luces de la sala, se aclara con su color
  g.globalCompositeOperation = 'source-atop';
  for (const l of luces) {
    const [r, gg, b] = l.color;
    const a = (l.fuerza ?? 1) * (0.85 + 0.15 * Math.sin(t * 1.7 + l.x));
    const gr = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
    gr.addColorStop(0, `rgba(${r},${gg},${b},${0.75 * a})`);
    gr.addColorStop(0.5, `rgba(${r},${gg},${b},${0.3 * a})`);
    gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = gr;
    g.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
  }
  g.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.globalAlpha = Math.min(1, 0.5 + 0.6 * k);
  ctx.drawImage(lienzo, 0, 0);
  ctx.restore();
}
