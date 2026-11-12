// =============================================================
// EfectosLente.js — (v1.81) Lo que le pasa a la LENTE en los sustos nuevos (encargo del usuario del 2026-11-11:
// «efectos en la pantalla que dejan claro que te alcanza: grietas en el cristal de la cámara, sangre o escarcha en la
// lente, estática, fotogramas que se pierden, temblor y un golpe de luz roja»). Común a todos los sustos nuevos
// (src/ui/sustos/): cada uno decide dónde y cuándo; aquí solo se dibuja. Todo es determinista por `semilla` (la
// misma grieta en cada fotograma del mismo susto).
// =============================================================

import { CONFIG } from '../../config.js';
import { glitchSlices } from '../../render/Atmosphere.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;

export const suave = (a, b, t) => {
  const k = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** Números «aleatorios» repetibles. */
export function azar(semilla) {
  let s = Math.max(1, Math.floor(semilla * 7919) % 2147483647);
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// ---------------------------------------------------------------- grietas del cristal
const GRIETAS = new Map();

function geometriaGrieta(px, py, semilla, tam) {
  const r = azar(semilla + px * 0.13 + py * 0.71);
  const radiales = [];
  const n = 9 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    let a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.5;
    let x = px;
    let y = py;
    const pts = [[x, y]];
    const largo = tam * (0.45 + r() * 0.75);
    let hecho = 0;
    while (hecho < largo) {
      const l = 14 + r() * 34;
      a += (r() - 0.5) * 0.55;
      x += Math.cos(a) * l;
      y += Math.sin(a) * l;
      hecho += l;
      pts.push([x, y, hecho / largo]);
      // ramas cortas
      if (r() < 0.18) radiales.push({ rama: true, pts: [[x, y, hecho / largo], [x + Math.cos(a + 0.9) * l * 0.8, y + Math.sin(a + 0.9) * l * 0.8, hecho / largo + 0.1]] });
    }
    radiales.push({ pts });
  }
  // anillos rotos (la tela de araña)
  const anillos = [];
  for (const rr of [tam * 0.12, tam * 0.27, tam * 0.45]) {
    for (let i = 0; i < n; i++) {
      if (r() < 0.35) continue;
      const a0 = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.3;
      const a1 = a0 + (Math.PI * 2 / n) * (0.6 + r() * 0.4);
      const rad = rr * (0.85 + r() * 0.3);
      anillos.push({ x0: px + Math.cos(a0) * rad, y0: py + Math.sin(a0) * rad, x1: px + Math.cos(a1) * rad * (0.9 + r() * 0.2), y1: py + Math.sin(a1) * rad * (0.9 + r() * 0.2), u: rr / tam });
    }
  }
  return { radiales, anillos };
}

/**
 * Grietas en el cristal de la lente desde cada punto de impacto. k: 0 → 1 (cuánto se han abierto).
 * opciones: semilla, tam (px de las más largas), alfa.
 */
export function grietas(ctx, puntos, k, { semilla = 1, tam = 420, alfa = 1 } = {}) {
  if (k <= 0 || !puntos?.length) return;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const [px, py] of puntos) {
    const clave = `${px}|${py}|${semilla}|${tam}`;
    if (!GRIETAS.has(clave)) GRIETAS.set(clave, geometriaGrieta(px, py, semilla, tam));
    const g = GRIETAS.get(clave);
    // el centro del golpe, astillado
    const cg = ctx.createRadialGradient(px, py, 0, px, py, tam * 0.12);
    cg.addColorStop(0, `rgba(235,240,245,${0.55 * alfa * k})`);
    cg.addColorStop(1, 'rgba(235,240,245,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(px - tam * 0.12, py - tam * 0.12, tam * 0.24, tam * 0.24);
    for (const pasada of [0, 1]) {
      ctx.strokeStyle = pasada === 0 ? `rgba(0,0,0,${0.55 * alfa})` : `rgba(225,235,240,${0.85 * alfa})`;
      for (const rd of g.radiales) {
        ctx.lineWidth = (rd.rama ? 0.9 : 1.7) + (pasada === 0 ? 1.2 : 0);
        ctx.beginPath();
        let empezado = false;
        for (const [x, y, u = 0] of rd.pts) {
          if (u > k) break;
          const ox = pasada === 0 ? 1.2 : 0;
          if (!empezado) { ctx.moveTo(x + ox, y + ox); empezado = true; } else ctx.lineTo(x + ox, y + ox);
        }
        ctx.stroke();
      }
      ctx.lineWidth = pasada === 0 ? 2 : 1;
      ctx.beginPath();
      for (const an of g.anillos) {
        if (an.u > k) continue;
        const ox = pasada === 0 ? 1.2 : 0;
        ctx.moveTo(an.x0 + ox, an.y0 + ox);
        ctx.lineTo(an.x1 + ox, an.y1 + ox);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- baba / sangre en la lente
/**
 * Manchas que escurren por el cristal desde cada punto. k: 0 → 1 (lo que han escurrido).
 * color: [r, g, b] (la baba de El Insecto, la sangre…).
 */
export function manchas(ctx, puntos, k, { semilla = 3, color = [175, 185, 120], tam = 1, alfa = 0.8 } = {}) {
  if (k <= 0 || !puntos?.length) return;
  const [r, g, b] = color;
  ctx.save();
  for (const [px, py] of puntos) {
    const rn = azar(semilla + px + py * 3);
    const n = 3 + Math.floor(rn() * 3);
    for (let i = 0; i < n; i++) {
      const x = px + (rn() - 0.5) * 120 * tam;
      const y = py + (rn() - 0.5) * 60 * tam;
      const rad = (14 + rn() * 26) * tam;
      // la gota
      const gr = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.3, rad * 0.1, x, y, rad);
      gr.addColorStop(0, `rgba(${r + 60},${g + 60},${b + 60},${alfa * 0.9})`);
      gr.addColorStop(0.5, `rgba(${r},${g},${b},${alfa * 0.75})`);
      gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.ellipse(x, y, rad, rad * (0.8 + rn() * 0.4), rn() * 3, 0, Math.PI * 2);
      ctx.fill();
      // el chorro que baja
      const largo = (60 + rn() * 220) * tam * k;
      const ancho = rad * (0.25 + rn() * 0.2);
      const lg = ctx.createLinearGradient(x, y, x, y + largo);
      lg.addColorStop(0, `rgba(${r},${g},${b},${alfa * 0.75})`);
      lg.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(x - ancho, y);
      ctx.quadraticCurveTo(x - ancho * 0.6, y + largo * 0.6, x + (rn() - 0.5) * 6, y + largo);
      ctx.quadraticCurveTo(x + ancho * 0.6, y + largo * 0.6, x + ancho, y);
      ctx.fill();
      // brillo
      ctx.fillStyle = `rgba(255,255,255,${0.35 * alfa})`;
      ctx.beginPath();
      ctx.ellipse(x - rad * 0.35, y - rad * 0.35, rad * 0.22, rad * 0.12, -0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- escarcha
/** Hielo que crece desde los bordes de la lente (k 0 → 1). */
export function escarcha(ctx, k, { semilla = 5, desde = null } = {}) {
  if (k <= 0) return;
  ctx.save();
  const gr = ctx.createRadialGradient(W / 2, H / 2, H * (0.75 - 0.55 * k), W / 2, H / 2, H * (1.15 - 0.2 * k));
  gr.addColorStop(0, 'rgba(200,225,255,0)');
  gr.addColorStop(1, `rgba(215,235,255,${0.75 * k})`);
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, W, H);
  // cristales: ramas desde los bordes (o desde los puntos `desde`)
  const rn = azar(semilla);
  const origenes = desde ?? Array.from({ length: 26 }, (_, i) => {
    const lado = i % 4;
    const u = rn();
    return lado === 0 ? [u * W, 0] : lado === 1 ? [W, u * H] : lado === 2 ? [u * W, H] : [0, u * H];
  });
  ctx.strokeStyle = `rgba(235,248,255,${0.7 * k})`;
  ctx.lineWidth = 1.2;
  for (const [ox, oy] of origenes) {
    let a = Math.atan2(H / 2 - oy, W / 2 - ox) + (rn() - 0.5) * 1.2;
    let x = ox;
    let y = oy;
    const largo = (80 + rn() * 260) * k;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let d = 0; d < largo; d += 18) {
      a += (rn() - 0.5) * 0.6;
      x += Math.cos(a) * 18;
      y += Math.sin(a) * 18;
      ctx.lineTo(x, y);
      if (rn() < 0.4) {
        const b = a + (rn() < 0.5 ? 0.9 : -0.9);
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(b) * 12, y + Math.sin(b) * 12);
        ctx.moveTo(x, y);
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- golpes de luz, temblor, colores
/** El golpe de luz: un destello blanco muy corto que pasa a rojo (k: 1 en el golpe → 0). */
export function golpeRojo(ctx, k, { blanco = 0.12 } = {}) {
  if (k <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (k > 1 - blanco) ctx.fillStyle = `rgba(255,255,255,${(0.75 * (k - (1 - blanco)) / blanco).toFixed(3)})`;
  else ctx.fillStyle = `rgba(255,20,10,${(0.42 * k).toFixed(3)})`;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = `rgba(120,0,0,${(0.25 * k).toFixed(3)})`;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** Desplazamiento del temblor (px) para la fuerza k. */
export function temblor(k, px = 40) {
  return [(Math.random() - 0.5) * px * k, (Math.random() - 0.5) * px * 0.7 * k];
}

let COPIA = null;
/** Los colores se separan (el sensor de la cámara golpeado): copia de lo dibujado, desplazada en rojo y azul. */
export function separaColores(ctx, k) {
  if (k <= 0.02) return;
  if (!COPIA) {
    COPIA = document.createElement('canvas');
    COPIA.width = W;
    COPIA.height = H;
  }
  const c = COPIA.getContext('2d');
  c.globalCompositeOperation = 'copy';
  c.drawImage(ctx.canvas, 0, 0, W, H);
  const d = 4 + 14 * k;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.28 * k;
  ctx.filter = 'sepia(1) saturate(8) hue-rotate(-50deg)';
  ctx.drawImage(COPIA, d, 0, W, H);
  ctx.filter = 'sepia(1) saturate(8) hue-rotate(160deg)';
  ctx.drawImage(COPIA, -d, d * 0.3, W, H);
  ctx.restore();
}

/** Estática y bandas rotas de la señal (k 0 → 1). */
export function senal(ctx, effects, k) {
  if (k <= 0) return;
  effects?.static?.(ctx, Math.min(0.6, 0.08 + 0.4 * k));
  if (Math.random() < 0.25 + 0.6 * k) glitchSlices(ctx, 0.2 + 0.6 * k);
}

/** Viñeta que se cierra (k 0 → 1). */
export function cierra(ctx, k) {
  if (k <= 0) return;
  const gr = ctx.createRadialGradient(W / 2, H / 2, H * (0.75 - 0.7 * k), W / 2, H / 2, H * (1.25 - 0.6 * k));
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(1, `rgba(0,0,0,${Math.min(1, 0.95 * k + 0.05)})`);
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, W, H);
}

export function negro(ctx) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- (v1.87) efectos nuevos, comunes (encargo del 2026-11-12)
let COPIA2 = null;
function copiaDe(ctx) {
  if (!COPIA2) {
    COPIA2 = document.createElement('canvas');
    COPIA2.width = W;
    COPIA2.height = H;
  }
  const c = COPIA2.getContext('2d');
  c.globalCompositeOperation = 'copy';
  c.drawImage(ctx.canvas, 0, 0, W, H);
  return COPIA2;
}

/**
 * Visión doble (un golpe en la cabeza): una copia de lo dibujado, desplazada y algo girada, que tiembla y se va
 * juntando con la buena. k: 1 recién golpeado → 0 (la vista se recompone).
 */
export function desdobla(ctx, k, { dx = 52, dy = 12, giro = 0.025, alfa = 0.5 } = {}) {
  if (k <= 0.02) return;
  const c = copiaDe(ctx);
  const t = performance.now() / 1000;
  const vaiven = 0.75 + 0.25 * Math.sin(t * 9.0);
  ctx.save();
  ctx.globalAlpha = alfa * Math.min(1, k * 1.4);
  ctx.translate(W / 2 + dx * k * vaiven, H / 2 + dy * k * Math.sin(t * 6.3));
  ctx.rotate(giro * k * vaiven);
  ctx.scale(1 + 0.03 * k, 1 + 0.03 * k);
  ctx.drawImage(c, -W / 2, -H / 2, W, H);
  ctx.restore();
  // (y la imagen buena, algo borrosa mientras dura)
  if (k > 0.3) {
    ctx.save();
    ctx.globalAlpha = 0.25 * k;
    ctx.filter = `blur(${(3 * k).toFixed(1)}px)`;
    ctx.drawImage(c, 0, 0, W, H);
    ctx.restore();
  }
}

const SALPICADURAS = new Map();
function geometriaSalpicadura(g, semilla) {
  const r = azar(semilla + g.x * 0.37 + g.y * 0.91);
  const f = g.fuerza ?? 1;
  const gauss = () => (r() + r() + r() - 1.5) / 1.5;
  // la mancha: muchas gotas de tamaños distintos, apiñadas sin forma (nada de dos círculos que parezcan un corazón)
  const nucleo = [];
  const n = 12 + Math.floor(r() * 7);
  for (let i = 0; i < n; i++) {
    const g0 = i === 0 ? 0 : 1;
    nucleo.push({ x: g.x + gauss() * 38 * f * g0, y: g.y + gauss() * 30 * f * g0, rx: (5 + r() * 20) * f, ry: (4 + r() * 14) * f, rot: r() * 3.14 });
  }
  // salpicaduras alargadas que salen del centro (dedos) y gotas sueltas lanzadas hacia fuera
  const dedos = [];
  for (let i = 0; i < 5 + Math.floor(r() * 5); i++) {
    const a = r() * Math.PI * 2;
    const largo = (30 + r() * 95) * f;
    dedos.push({ a, largo, ancho: (2.5 + r() * 6) * f, x0: g.x + Math.cos(a) * 10 * f, y0: g.y + Math.sin(a) * 10 * f });
  }
  const gotas = [];
  for (let i = 0; i < 22 + Math.floor(r() * 16); i++) {
    const a = r() * Math.PI * 2;
    const d = (45 + r() * 270) * f;
    const tam = (1.5 + r() * 7) * f * (1 - d / (360 * f)) + 1.2;
    gotas.push({ x: g.x + Math.cos(a) * d, y: g.y + Math.sin(a) * d, a, tam, cola: tam * (1.4 + r() * 3) });
  }
  // chorretones que escurren hacia abajo
  const chorros = [];
  for (let i = 0; i < 2 + Math.floor(r() * 3); i++) {
    const p = nucleo[Math.floor(r() * nucleo.length)];
    chorros.push({ x: p.x + (r() - 0.5) * p.rx, y: p.y + p.ry * 0.5, ancho: (3 + r() * 5) * f, largo: (90 + r() * 260) * f, vel: 0.6 + r() * 0.8, serpentea: (r() - 0.5) * 14 });
  }
  return { nucleo, dedos, gotas, chorros };
}

/**
 * Sangre que SALPICA la lente: cada golpe {t (s), x, y, fuerza} deja su mancha con la corona de gotas y unos
 * chorretones que escurren despacio; t: el tiempo ahora (s, el mismo reloj que los golpes). La sangre se queda.
 */
export function salpica(ctx, golpes, t, { semilla = 9, color = [96, 5, 4], alfa = 0.92 } = {}) {
  if (!golpes?.length) return;
  const [r, g, b] = color;
  ctx.save();
  for (const gp of golpes) {
    const edad = t - gp.t;
    if (edad < 0) continue;
    const clave = `${gp.x}|${gp.y}|${gp.fuerza ?? 1}|${semilla}`;
    if (!SALPICADURAS.has(clave)) SALPICADURAS.set(clave, geometriaSalpicadura(gp, semilla));
    const s = SALPICADURAS.get(clave);
    const llega = Math.min(1, edad / 0.05);                  // (en 2 fotogramas ya está)
    // los chorretones (debajo de la mancha)
    for (const c of s.chorros) {
      const L = c.largo * Math.min(1, (edad * c.vel) / 1.6) ** 0.7;
      if (L < 2) continue;
      const lg = ctx.createLinearGradient(c.x, c.y, c.x, c.y + L);
      lg.addColorStop(0, `rgba(${r},${g},${b},${alfa * 0.85})`);
      lg.addColorStop(0.85, `rgba(${r * 0.8},${g},${b},${alfa * 0.7})`);
      lg.addColorStop(1, `rgba(${r * 0.8},${g},${b},0)`);
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(c.x - c.ancho, c.y);
      ctx.bezierCurveTo(c.x - c.ancho * 0.7 + c.serpentea, c.y + L * 0.4, c.x - c.ancho * 0.5 - c.serpentea, c.y + L * 0.75, c.x, c.y + L);
      ctx.bezierCurveTo(c.x + c.ancho * 0.5 - c.serpentea, c.y + L * 0.75, c.x + c.ancho * 0.7 + c.serpentea, c.y + L * 0.4, c.x + c.ancho, c.y);
      ctx.fill();
      // la gota gorda de la punta
      ctx.fillStyle = `rgba(${r},${g},${b},${alfa * 0.8})`;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y + L, c.ancho * 0.75, c.ancho * 0.95, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // la mancha: gotas apiñadas, oscuras y algo translúcidas (sangre sobre un cristal), y los dedos que salen de ella
    for (const p of s.nucleo) {
      ctx.fillStyle = `rgba(${r},${g},${b},${alfa * 0.86})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.rx * llega, p.ry * llega, p.rot, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const d of s.dedos) {
      const L = d.largo * llega;
      const x1 = d.x0 + Math.cos(d.a) * L;
      const y1 = d.y0 + Math.sin(d.a) * L;
      const nx = -Math.sin(d.a) * d.ancho;
      const ny = Math.cos(d.a) * d.ancho;
      ctx.fillStyle = `rgba(${r},${g},${b},${alfa * 0.8})`;
      ctx.beginPath();
      ctx.moveTo(d.x0 + nx, d.y0 + ny);
      ctx.lineTo(x1, y1);
      ctx.lineTo(d.x0 - nx, d.y0 - ny);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x1, y1, d.ancho * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // la corona de gotas
    for (const d of s.gotas) {
      const x = gp.x + (d.x - gp.x) * llega;
      const y = gp.y + (d.y - gp.y) * llega;
      ctx.fillStyle = `rgba(${r},${g},${b},${alfa * 0.9})`;
      ctx.beginPath();
      ctx.ellipse(x, y, d.cola * 0.5 + d.tam * 0.5, d.tam, d.a, 0, Math.PI * 2);
      ctx.fill();
    }
    // brillos (el cristal mojado), pequeños
    ctx.fillStyle = `rgba(255,225,220,${0.18 * alfa})`;
    for (const p of s.nucleo.slice(0, 4)) {
      ctx.beginPath();
      ctx.ellipse(p.x - p.rx * 0.3, p.y - p.ry * 0.35, p.rx * 0.18, p.ry * 0.1, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Los bordes que se oscurecen (aturdido, a punto de perder el sentido); latido 0 → 1 los cierra un poco más. */
export function oscureceBordes(ctx, k, latido = 0) {
  if (k <= 0) return;
  const kk = Math.min(1, k * (1 + 0.25 * latido));
  const gr = ctx.createRadialGradient(W / 2, H / 2, H * (0.62 - 0.38 * kk), W / 2, H / 2, H * (1.05 - 0.25 * kk));
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(0.6, `rgba(0,0,0,${(0.55 * kk).toFixed(3)})`);
  gr.addColorStop(1, `rgba(0,0,0,${Math.min(1, 0.95 * kk).toFixed(3)})`);
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, W, H);
}

/** Se apaga poco a poco (no un corte): los bordes primero y después el centro, sin colores; k 0 → 1 (negro). */
export function funde(ctx, k) {
  if (k <= 0) return;
  if (k >= 1) {
    negro(ctx);
    return;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'saturation';
  ctx.fillStyle = `rgba(128,128,128,${(0.7 * k).toFixed(3)})`;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  oscureceBordes(ctx, Math.min(1, k * 1.5));
  ctx.fillStyle = `rgba(0,0,0,${(k ** 1.6).toFixed(3)})`;
  ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- (v1.88) más efectos comunes
let COPIA3 = null;
/**
 * La imagen se ESTIRA y se curva, como si tiraran de ti (la lente que se alarga): franjas horizontales de lo dibujado,
 * más anchas en el centro (se abomba) y separadas desde el centro hacia arriba y abajo (se alarga). k 0 → 1.
 * hacia: -1 / 1 tira hacia un lado (la imagen se ladea hacia ese lado), 0 hacia los dos.
 */
export function estira(ctx, k, { hacia = 0, franjas = 36 } = {}) {
  if (k <= 0.01) return;
  if (!COPIA3) {
    COPIA3 = document.createElement('canvas');
    COPIA3.width = W;
    COPIA3.height = H;
  }
  const c = COPIA3.getContext('2d');
  c.globalCompositeOperation = 'copy';
  c.drawImage(ctx.canvas, 0, 0, W, H);
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const alto = H / franjas;
  const largo = 1 + 0.35 * k;                       // (se alarga en vertical desde el centro)
  for (let i = 0; i < franjas; i++) {
    const y0 = i * alto;
    const yc = (y0 + alto / 2 - H / 2) / (H / 2);  // -1 arriba … 1 abajo
    const ancho = W * (1 + 0.42 * k * (1 - yc * yc));                   // (se abomba en el centro)
    const dx = (W - ancho) / 2 + hacia * 120 * k * (1 - Math.abs(yc));  // (y se va hacia un lado)
    const yd = H / 2 + (y0 - H / 2) * largo;
    ctx.drawImage(COPIA3, 0, y0, W, alto + 1, dx, yd, ancho, alto * largo + 1);
  }
  ctx.restore();
}

/** Las luces se apagan a tirones: parpadeos cada vez más largos hasta el negro (k 0 → 1; t: s, para el parpadeo). */
export function apagaLuces(ctx, k, t = 0) {
  if (k <= 0) return;
  if (k >= 1) {
    negro(ctx);
    return;
  }
  const r = azar(Math.floor(t * 24) + 7)();
  const apagada = r < 0.25 + 0.7 * k;               // (cada vez más rato apagada)
  ctx.fillStyle = `rgba(0,0,0,${(apagada ? 0.82 + 0.18 * k : 0.15 + 0.6 * k * k).toFixed(3)})`;
  ctx.fillRect(0, 0, W, H);
}
