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

// ---------------------------------------------------------------- hielo en la lente (v1.98)
/**
 * (v1.98, el usuario: «hielo de verdad sobre el cristal de la lente») El hielo de una lente de cámara:
 *   - cristales con forma de helecho que crecen desde los bordes hacia el centro; opacos donde llevan más rato
 *     helados (escarcha acumulada) y translúcidos en el frente;
 *   - vaho por debajo, que va por delante del hielo: empaña y desenfoca la imagen;
 *   - brillos pequeños en las puntas de los cristales con la luz de la sala;
 *   - al derretirse se retira hacia los bordes (el mismo frente, al revés) y deja gotas que resbalan.
 * `k` va de 0 (lente limpia) a 1 (casi tapada; el `hueco` no se tapa nunca). La forma se calcula una sola vez por
 * semilla (como las grietas): al crecer o al derretirse no cambia, solo avanza o se retira. Las zonas de `protege`
 * (rectángulos a 1600×900) no se hielan nunca; la de `tapa` se hiela antes y más opaca.
 * Uso: const h = new HieloLente({...}); cada fotograma h.avanza(objetivo, tiempo) → evento | null; h.dibuja(ctx).
 */
export class HieloLente {
  constructor({ semilla = 9, protege = [], hueco = null, tapa = null, brillo = [255, 80, 64], niveles = 16,
    sube = 0.22, baja = 0.24 } = {}) {
    this.o = { semilla, protege, hueco, tapa, brillo, niveles };
    this.sube = sube;            // lo que crece por segundo (k)
    this.baja = baja;            // lo que se derrite por segundo
    this.k = 0;
    this.objetivo = 0;
    this.tPrev = null;
    this.gotas = [];
    this.listo = false;
    this._goteoEn = 0;
  }

  /** Etapa de un valor de k: 0 limpia, 1 cerca del límite, 2 alerta, 3 fuera de rango. */
  static etapa(k) {
    return k < 0.06 ? 0 : k < 0.36 ? 1 : k < 0.78 ? 2 : 3;
  }

  /** Calcula la forma (una vez; ~0,1 s). Se puede llamar antes para que no se note al abrir la cámara. */
  prepara() {
    if (this.listo || typeof document === 'undefined') return;
    const { semilla, protege, hueco, tapa, niveles } = this.o;
    const w = 800, h = 450, S = 0.5;            // a media resolución (se dibuja ampliado)
    const rn = azar(semilla);
    // --- ruido suave (dos octavas) para que el frente sea irregular
    const rejilla = (nx, ny) => { const g = new Float32Array((nx + 1) * (ny + 1)); for (let i = 0; i < g.length; i++) g[i] = rn(); return { g, nx, ny }; };
    const o1 = rejilla(16, 9), o2 = rejilla(40, 23), o3 = rejilla(120, 68);
    const lee = ({ g, nx, ny }, u, v) => {
      const x = u * nx, y = v * ny, i = Math.min(nx - 1, Math.floor(x)), j = Math.min(ny - 1, Math.floor(y));
      const fx = x - i, fy = y - j, a = g[j * (nx + 1) + i], b = g[j * (nx + 1) + i + 1], c = g[(j + 1) * (nx + 1) + i], d = g[(j + 1) * (nx + 1) + i + 1];
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
    const rect = (r, x, y, borde) => {     // 1 dentro de r (a 1600×900), 0 fuera, con borde suave
      const X = x / S, Y = y / S;
      const dx = Math.max(r.x - X, 0, X - (r.x + r.w)), dy = Math.max(r.y - Y, 0, Y - (r.y + r.h));
      return 1 - Math.min(1, Math.hypot(dx, dy) / borde);
    };
    // --- G: cuándo se hiela cada punto (0 = lo primero, en los bordes y las esquinas; >1 = nunca)
    const G = new Float32Array(w * h);
    const grano = new Float32Array(w * h);
    const tapaW = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h;
        const borde = Math.min(Math.min(x, w - 1 - x) / (w / 2) * 1.35, Math.min(y, h - 1 - y) / (h / 2));
        const r = Math.hypot((u - 0.5) / 0.5, (v - 0.5) / 0.5) / Math.SQRT2;            // 0 en el centro, 1 en las esquinas
        let g = 0.55 * borde + 0.45 * (1 - r);
        g += 0.26 * (lee(o1, u, v) - 0.5) + 0.12 * (lee(o2, u, v) - 0.5);
        let t = 0;
        if (tapa) { t = rect(tapa, x, y, 60); g -= 0.16 * t; }
        if (hueco) {
          const d = Math.hypot(x - hueco.x * S, y - hueco.y * S) / (hueco.r * S);
          g += 0.65 * Math.max(0, 1 - d) ** 1.5;
        }
        for (const p of protege) g += 4 * rect(p, x, y, 48);
        const i = y * w + x;
        G[i] = g;
        grano[i] = 0.7 * lee(o2, u, v) + 0.3 * lee(o3, u, v);
        tapaW[i] = t;
      }
    }
    // --- los cristales de helecho (trazos), a su propio lienzo
    const cris = document.createElement('canvas');
    cris.width = w; cris.height = h;
    const c = cris.getContext('2d');
    c.lineCap = 'round';
    const gEn = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? -1 : G[(y | 0) * w + (x | 0)];
    const puntas = [];
    let bri = 1;
    const rama = (x, y, a, largo, nivel, ancho) => {
      const paso = nivel === 0 ? 3 : 2.2;
      let hecho = 0, lado = rn() < 0.5 ? 1 : -1, sig = 4 + rn() * 4;
      c.lineWidth = ancho;
      c.strokeStyle = `rgba(236,246,255,${(nivel === 0 ? 0.55 : 0.42) + 0.4 * rn() * bri})`;
      c.beginPath();
      c.moveTo(x, y);
      const hijos = [];
      while (hecho < largo) {
        a += (rn() - 0.5) * (nivel === 0 ? 0.16 : 0.24);
        const nx = x + Math.cos(a) * paso, ny = y + Math.sin(a) * paso;
        const g = gEn(nx, ny);
        if (g < 0 || g > 1.04) break;               // ni fuera de la lente, ni en el hueco, ni sobre el indicador
        c.lineTo(nx, ny);
        x = nx; y = ny; hecho += paso;
        if (nivel < 2 && hecho > sig) {               // las hojas del helecho: alternas, a unos 50–60°, más cortas hacia la punta
          sig = hecho + (nivel === 0 ? 4 + rn() * 3 : 6 + rn() * 6);
          const resto = largo - hecho;
          const hoja = nivel === 0 ? Math.min(resto * 0.5, 40) * (0.55 + 0.45 * rn()) : Math.min(resto * 0.45, 9) * (0.5 + 0.5 * rn());
          if (nivel === 0 || rn() < 0.55) hijos.push([x, y, a + lado * (0.85 + rn() * 0.25), hoja, nivel + 1, ancho * (nivel === 0 ? 0.55 : 0.6)]);
          lado = -lado;
        }
      }
      c.stroke();
      if (nivel > 0 && rn() < 0.5) puntas.push([x, y, gEn(x, y)]);
      for (const hj of hijos) rama(...hj);
    };
    const nSem = 58;
    for (let n = 0; n < nSem; n++) {
      bri = 0.35 + 0.65 * rn();                       // unos helechos más blancos que otros
      const lado = n % 4, u = (n + rn()) / nSem;
      const [x, y] = lado === 0 ? [u * w, 1] : lado === 1 ? [w - 2, ((u * 4) % 1) * h] : lado === 2 ? [(1 - u) * w, h - 2] : [1, ((u * 4 + 0.5) % 1) * h];
      if (gEn(x, y) > 1) continue;
      const a = Math.atan2(h / 2 - y, w / 2 - x) + (rn() - 0.5) * 1.1;
      rama(x, y, a, 90 + rn() * 230, 0, 1.15 + rn() * 0.55);
    }
    // cristales sueltos que nacen ya dentro (gotas heladas que crecen en estrella)
    for (let n = 0; n < 16; n++) {
      const x = rn() * w, y = rn() * h, g = gEn(x, y);
      if (g < 0.15 || g > 0.95) continue;
      const brazos = 5 + Math.floor(rn() * 2), a0 = rn() * 6.28;
      for (let b = 0; b < brazos; b++) rama(x, y, a0 + (b / brazos) * 6.28, 10 + rn() * 22, 1, 0.8);
    }
    const cd = c.getImageData(0, 0, w, h).data;
    // --- los niveles: hielo (cristales + escarcha acumulada) y la máscara del vaho, ya recortados por el frente
    this.niveles = [];
    this.vaho = [];
    this.frentes = [];
    const vw = 400, vh = 225;
    for (let n = 0; n < niveles; n++) {
      const kn = (n + 1) / niveles;
      const lv = document.createElement('canvas'); lv.width = w; lv.height = h;
      const lc = lv.getContext('2d'), img = lc.createImageData(w, h), d = img.data;
      const frente = [];
      for (let i = 0; i < w * h; i++) {
        const g = G[i];
        const dentro = (kn - g) / 0.045;                       // el frente, suave
        if (dentro <= 0) continue;
        const rev = Math.min(1, dentro);
        const hondo = Math.min(1, (kn - g) / 0.32);            // cuánto rato lleva helado
        const ac = (cd[i * 4 + 3] / 255) * rev;                // los cristales
        const tb = 1 + 0.5 * tapaW[i];
        const ah = Math.min(0.86, hondo ** 1.4 * (0.22 + 0.42 * grano[i]) * tb) * rev;   // la escarcha acumulada
        const a = 1 - (1 - ac) * (1 - ah);
        if (a <= 0.004) continue;
        const mezcla = ac / (ac + ah + 1e-6);
        d[i * 4] = 196 + 40 * mezcla;
        d[i * 4 + 1] = 208 + 36 * mezcla;
        d[i * 4 + 2] = 222 + 31 * mezcla;
        d[i * 4 + 3] = a * 255;
        if (dentro < 1.2 && (i % 7) === 0 && frente.length < 260 && rn() < 0.12) frente.push([(i % w) / S, Math.floor(i / w) / S]);
      }
      lc.putImageData(img, 0, 0);
      this.niveles.push(lv);
      this.frentes.push(frente);
      // el vaho va por delante del hielo (a un cuarto de resolución)
      const vc = document.createElement('canvas'); vc.width = vw; vc.height = vh;
      const vx = vc.getContext('2d'), vi = vx.createImageData(vw, vh), vd = vi.data;
      for (let y = 0; y < vh; y++) {
        for (let x = 0; x < vw; x++) {
          const g = G[(y * 2) * w + x * 2];
          const f = Math.max(0, Math.min(1, (kn + 0.2 - g) / 0.3));
          vd[(y * vw + x) * 4 + 3] = f * 255;
        }
      }
      vx.putImageData(vi, 0, 0);
      this.vaho.push(vc);
    }
    this.puntas = puntas.filter((p) => p[2] >= 0 && p[2] <= 1).slice(0, 140)
      .map(([x, y, g]) => ({ x: x / S, y: y / S, g, fase: rn() * 6.28, vel: 1.5 + rn() * 3, tam: 1.2 + rn() * 2 }));
    this.peque = document.createElement('canvas'); this.peque.width = 200; this.peque.height = 113;
    this.capaVaho = document.createElement('canvas'); this.capaVaho.width = vw; this.capaVaho.height = vh;
    this.listo = true;
  }

  /** Lleva k hacia el objetivo (sube y baja poco a poco). Devuelve 'crece' (sube de etapa), 'derrite' o null. */
  avanza(objetivo, t) {
    const dt = this.tPrev === null ? 0 : Math.max(0, t - this.tPrev);
    this.tPrev = t;
    let ev = null;
    if (HieloLente.etapa(objetivo) > HieloLente.etapa(this.objetivo) && objetivo > this.k) ev = 'crece';
    if (objetivo < this.k - 0.05 && this.objetivo >= this.k - 0.05 && this.k > 0.08) { ev = 'derrite'; this._goteoEn = t + 1.6; }
    this.objetivo = objetivo;
    const antes = this.k;
    if (dt > 0.5) this.k = objetivo;                       // (sin mirar un rato: ya está donde tenía que estar)
    else if (objetivo > this.k) this.k = Math.min(objetivo, this.k + this.sube * dt);
    else this.k = Math.max(objetivo, this.k - this.baja * dt);
    // al derretirse: gotas que nacen en el frente que se retira y resbalan
    if (this.listo && this.k < antes && dt <= 0.5 && this.k > 0.01) {
      const n = (antes - this.k) * 38 + (Math.random() < 0.12 ? 1 : 0);
      const fr = this.frentes[Math.max(0, Math.min(this.frentes.length - 1, Math.round(antes * this.o.niveles) - 1))] ?? [];
      for (let i = 0; i < n && fr.length && this.gotas.length < 40; i++) {
        const [x, y] = fr[Math.floor(Math.random() * fr.length)];
        this.gotas.push({ x, y, vy: 0, vida: 2.4 + Math.random() * 1.8, r: 3 + Math.random() * 3.5, para: Math.random() * 0.6, rastro: [] });
      }
      if (t > this._goteoEn && this.k > 0.1) { this._goteoEn = t + 1.8; ev = ev ?? 'goteo'; }
    }
    for (const g of this.gotas) {
      g.vida -= dt;
      if (g.para > 0) { g.para -= dt; continue; }
      g.vy = Math.min(150, g.vy + (55 + 95 * Math.random()) * dt);
      if (Math.random() < 0.03) g.para = 0.15 + Math.random() * 0.4;        // se engancha un momento
      g.rastro.push([g.x, g.y]);
      if (g.rastro.length > 16) g.rastro.shift();
      g.x += (Math.random() - 0.5) * 0.8;
      g.y += g.vy * dt;
    }
    this.gotas = this.gotas.filter((g) => g.vida > 0 && g.y < H + 20);
    return ev;
  }

  /** Dibuja el hielo con el k actual sobre lo que ya hay en `ctx` (la imagen de la cámara). */
  dibuja(ctx, tiempo = 0) {
    const k = this.k;
    if (k <= 0.004 && !this.gotas.length) return;
    this.prepara();
    if (!this.listo) return;
    const L = this.o.niveles;
    ctx.save();
    ctx.imageSmoothingEnabled = true;                 // (el juego amplía sin suavizar: aquí, suave)
    ctx.imageSmoothingQuality = 'high';
    if (k > 0.004) {
      const x = k * L - 1, i0 = Math.max(0, Math.floor(x)), i1 = Math.min(L - 1, i0 + 1), t = x < 0 ? 0 : x - Math.floor(x);
      const a0 = x < 0 ? k * L : 1;
      // 1) el vaho: la imagen, desenfocada (reducida y ampliada) y más lechosa, por delante del hielo
      const src = ctx.canvas;
      const p = this.peque.getContext('2d');
      p.imageSmoothingEnabled = true;
      p.globalCompositeOperation = 'copy';
      p.drawImage(src, 0, 0, src.width, src.height, 0, 0, 200, 113);
      p.globalCompositeOperation = 'screen';          // la luz que se esparce en el vaho: aclara lo oscuro
      p.fillStyle = `rgb(${Math.round(70 + 60 * k)},${Math.round(80 + 62 * k)},${Math.round(92 + 64 * k)})`;
      p.fillRect(0, 0, 200, 113);
      p.globalCompositeOperation = 'source-over';
      const v = this.capaVaho.getContext('2d');
      v.imageSmoothingEnabled = true;
      v.imageSmoothingQuality = 'high';
      v.globalCompositeOperation = 'copy';
      v.drawImage(this.peque, 0, 0, 400, 225);
      v.globalCompositeOperation = 'destination-in';
      v.drawImage(this.vaho[Math.round(Math.max(0, x))] ?? this.vaho[0], 0, 0);
      ctx.globalAlpha = Math.min(1, a0) * 0.85;
      ctx.drawImage(this.capaVaho, 0, 0, W, H);
      // la imagen pierde contraste según avanza (desde la alerta)
      const lecho = 0.22 * suave(0.36, 0.92, k);
      if (lecho > 0) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = `rgba(150,165,182,${lecho})`;
        ctx.fillRect(0, 0, W, H);
      }
      // 2) el hielo: el nivel de k y el siguiente, fundidos
      ctx.globalAlpha = Math.min(1, a0);
      ctx.drawImage(this.niveles[i0], 0, 0, W, H);
      if (t > 0 && i1 !== i0) {
        ctx.globalAlpha = t;
        ctx.drawImage(this.niveles[i1], 0, 0, W, H);
      }
      // 3) los brillos de las puntas, con la luz de la sala
      ctx.globalCompositeOperation = 'lighter';
      const [r, g, b] = this.o.brillo;
      for (const q of this.puntas) {
        if (q.g > k - 0.04) continue;
        const tw = Math.max(0, Math.sin(tiempo * q.vel + q.fase));
        if (tw < 0.55) continue;
        const al = (tw - 0.55) / 0.45;
        ctx.globalAlpha = 0.75 * al;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.tam * 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.9 * al;
        ctx.fillStyle = '#fff2ee';
        ctx.fillRect(q.x - q.tam * 2.2, q.y - 0.5, q.tam * 4.4, 1);
        ctx.fillRect(q.x - 0.5, q.y - q.tam * 2.2, 1, q.tam * 4.4);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // 4) las gotas del deshielo, con su rastro mojado
    for (const g of this.gotas) {
      const al = Math.min(1, g.vida / 0.8);
      if (g.rastro.length > 1) {
        ctx.globalAlpha = 0.3 * al;
        ctx.strokeStyle = '#d6e6f5';
        ctx.lineWidth = g.r * 0.7;
        ctx.beginPath();
        ctx.moveTo(g.rastro[0][0], g.rastro[0][1]);
        for (const [x, y] of g.rastro) ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.55 * al;
      ctx.fillStyle = '#cfe0f0';
      ctx.beginPath();
      ctx.ellipse(g.x, g.y, g.r * 0.8, g.r * 1.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.8 * al;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(g.x - g.r * 0.35, g.y - g.r * 0.6, Math.max(1, g.r * 0.35), Math.max(1, g.r * 0.45));
    }
    ctx.restore();
  }
}
