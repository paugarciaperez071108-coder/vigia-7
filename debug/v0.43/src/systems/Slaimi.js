// =============================================================
// Slaimi.js — SLAIMI, el slime aliado (noche 4, camino B; valores en
// NIGHT4.SLAIMI, src/night/night4.js).
//
// En la oficina salta en la pared por la que está el enemigo más cercano:
//   left  = compuerta izquierda (Corredor Oeste)
//   right = compuerta derecha (Corredor Este)
//   back  = pasillo central (la pared de atrás)
//   front = los conductos (El Insecto)
// Cuanto más cerca está ese enemigo, más rápido salta. No defiende: avisa.
// En el plano de cámaras tiene su propio triángulo, fijo (sin parpadeo),
// en el lado del recuadro «TÚ» donde está.
//
// Dibujo (v0.37): el diseño elegido, el cubo 11 «Arándano», en 3D
// (tools/3d/slaimi/anim.py → assets/slaimi/): animaciones lento, rapido,
// seguir, triste y muerto, con los ojos grandes, luz propia (y un halo
// azul en el juego) y estirándose / aplastándose en cada salto. Mientras
// no han cargado, un dibujo provisional en 2D.
// =============================================================

import { NIGHT4 } from '../night/night4.js';
import { largoNeighbors, OFFICE_RECT } from '../world/StationMap.js';

const S = NIGHT4.SLAIMI;

// --- Las animaciones 3D (se cargan solas al importar este módulo) ---
const ANIM_BASE = 'assets/slaimi/';
const ANIM = {};
fetch(ANIM_BASE + 'slaimi.json').then((r) => r.json()).then((idx) => {
  for (const [name, d] of Object.entries(idx)) {
    const img = new Image();
    img.onload = () => { ANIM[name] = { ...d, img }; };
    img.src = `${ANIM_BASE}slaimi_${name}.webp`;
  }
}).catch(() => {});

/** ¿Está cargada la animación 3D `name`? */
export function slaimiAnimReady(name = 'lento') {
  return !!ANIM[name];
}
const SIDE_START = { left: 'left_door', right: 'right_door', back: 'central3' };

// Salas que le faltan a un enemigo para llegar a cada lado de la oficina
const DIST = (() => {
  const out = {};
  for (const [side, start] of Object.entries(SIDE_START)) {
    const dist = { [start]: 0 };
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift();
      for (const n of largoNeighbors(cur)) {
        if (n === 'office' || n in dist) continue;
        dist[n] = dist[cur] + 1;
        queue.push(n);
      }
    }
    out[side] = dist;
  }
  return out;
})();
const VENT_DIST = { v6: 0, v7: 0, v1: 1, v2: 2, v3: 2, v4: 3, v5: 3 };

/** El enemigo más cercano a la oficina: { side, dist } o null. */
export function nearestThreat(enemies) {
  let best = null;
  const consider = (side, dist) => {
    if (dist !== undefined && (!best || dist < best.dist)) best = { side, dist };
  };
  for (const e of enemies) {
    if (!e.room) continue;
    if (e.id === 'specimen' && !e.emerged) continue;       // aún dentro de la contención
    if (e.id === 'frozen' && e.state !== 'escaped') continue; // dormido en su cápsula
    if (e.atDoor === 'left' || e.atDoor === 'right') {
      consider(e.atDoor, 0);
      continue;
    }
    if (e.id === 'insecto') {
      if (e.state === 'vent') consider('front', VENT_DIST[e.room]);
      continue;
    }
    for (const side of Object.keys(SIDE_START)) consider(side, DIST[side][e.room]);
  }
  return best;
}

export class Slaimi {
  constructor() {
    this.reset();
  }

  reset() {
    this.active = false;
    this.side = 'front';
    this.from = null;          // pared de la que viene (cambio de lado)
    this.moveT = 0;
    this.t = 0;
    this.hopT = 0;
    this.period = S.HOP_SLOW;
    this.threat = null;
  }

  /** dt; enemies: ai.enemies. Devuelve true en cada aterrizaje (para el sonido). */
  update(dt, enemies) {
    if (!this.active) return false;
    this.t += dt;
    this.threat = nearestThreat(enemies);
    const target = this.threat?.side ?? this.side;
    if (target !== this.side && this.moveT <= 0) {
      this.from = this.side;
      this.side = target;
      this.moveT = S.MOVE_TIME;
    }
    this.moveT = Math.max(0, this.moveT - dt);
    const d = this.threat ? Math.min(S.FAR, this.threat.dist) : S.FAR;
    const k = 1 - d / S.FAR;   // 0 = lejos, 1 = pegado
    this.period = S.HOP_SLOW + (S.HOP_FAST - S.HOP_SLOW) * k;
    const before = this.hopT;
    this.hopT = (this.hopT + dt / this.period) % 1;
    return this.hopT < before && this.moveT <= 0;
  }

  /** Altura del salto (0..1) y aplastamiento al caer. */
  get hop() {
    const p = this.hopT;
    const up = p < 0.75 ? Math.sin((p / 0.75) * Math.PI) : 0;
    const squash = p >= 0.75 ? Math.sin(((p - 0.75) / 0.25) * Math.PI) : 0;
    return { up, squash };
  }

  /** Punto del plano para su triángulo: el lado del recuadro «TÚ» donde está. */
  mapPoint() {
    const o = OFFICE_RECT;
    // En el plano: la compuerta izquierda sale por abajo, la derecha por
    // arriba, el pasillo central entra por la izquierda y los conductos
    // rodean la oficina por la derecha.
    return {
      left: { x: o.x + o.w / 2, y: o.y + o.h - 9 },
      right: { x: o.x + o.w / 2, y: o.y + 11 },
      back: { x: o.x + 11, y: o.y + o.h / 2 + 14 },
      front: { x: o.x + o.w - 11, y: o.y + o.h / 2 + 14 },
    }[this.side];
  }

  /** Dibuja a Slaimi saltando en la pared `face` (si está en ella). */
  drawInOffice(ctx, face, sprites = null) {
    if (!this.active || face !== this.side) return;
    const spot = { front: [1230, 836], left: [330, 850], right: [1270, 850], back: [1290, 850] }[face];
    let [x, y] = spot;
    // Entrando desde otra pared: se desliza desde el borde
    if (this.moveT > 0) {
      const k = 1 - this.moveT / S.MOVE_TIME;
      x = x + (1 - k) * (x < 800 ? -420 : 420);
    }
    const pose = this.period < 0.7 ? 'rapido' : 'lento';
    if (slaimiAnimReady(pose)) {
      // La animación ya lleva el salto, el estirado y el aplastado
      drawSlaimi(ctx, x, y, 150, { t: this.t, phase: this.hopT, pose });
      return;
    }
    const { up, squash } = this.hop;
    drawSlaimi(ctx, x, y - up * 70, 150, { t: this.t, squash, stretch: up * 0.18, sprites, pose });
  }
}

/** Un fotograma de la animación 3D, con su halo de luz propia. */
function drawAnim(ctx, a, x, y, size, { t, phase, dead, squash }) {
  const h = size / a.body;                      // alto del fotograma (size = alto del cuerpo en reposo)
  const w = h * (a.w / a.h);
  const i = a.frames > 1 && phase !== null ? Math.floor(((phase % 1) + 1) % 1 * a.frames) : 0;
  // Estáticos (triste): el temblor de miedo se hace escalando
  const sx = a.frames > 1 ? 1 : 1 + 0.12 * squash;
  const sy = a.frames > 1 ? 1 : 1 - 0.14 * squash;
  ctx.save();
  if (!dead) {
    // Luz propia: un halo azul que respira e ilumina el suelo
    const k = 0.85 + 0.15 * Math.sin(t * 2.2);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y - size * 0.45, size * 0.1, x, y - size * 0.45, size * 1.6);
    g.addColorStop(0, `rgba(90,140,255,${0.32 * k})`);
    g.addColorStop(0.5, `rgba(70,110,255,${0.1 * k})`);
    g.addColorStop(1, 'rgba(60,90,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - size * 1.6, y - size * 2.05, size * 3.2, size * 3.2);
    const f = ctx.createRadialGradient(x, y, 0, x, y, size * 0.9);
    f.addColorStop(0, `rgba(110,150,255,${0.28 * k})`);
    f.addColorStop(1, 'rgba(110,150,255,0)');
    ctx.fillStyle = f;
    ctx.beginPath();
    ctx.ellipse(x, y, size * 0.9, size * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  // Sombra en el suelo
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y, size * 0.55, size * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  ctx.drawImage(a.img, i * a.w, 0, a.w, a.h, -w * a.foot[0], -h * a.foot[1], w, h);
  ctx.restore();
}

/**
 * Slaimi (dibujo provisional, mientras no cargan las animaciones 3D).
 * (x, y) = punto de apoyo en el suelo; size = alto en px.
 * opts: squash 0..1 (aplastado al caer), stretch 0..1 (estirado al saltar),
 * dead (camino A: aplastado y sin brillo), sad, glow.
 */
export function drawSlaimi(ctx, x, y, size, opts = {}) {
  const { t = 0, squash = 0, stretch = 0, dead = false, sad = false, sprites = null, pose = 'lento', phase = null } = opts;
  const anim = ANIM[dead ? 'muerto' : sad ? 'triste' : pose];
  if (anim) return drawAnim(ctx, anim, x, y, size, { t, phase, dead, squash });
  const key = dead ? 'slaimi_muerto' : sad ? 'slaimi_triste' : `slaimi_${pose}`;
  const sx = 1 + 0.22 * squash - 0.1 * stretch;
  const sy = 1 - 0.25 * squash + stretch;
  if (sprites?.has?.(key)) {
    const w = size * 1.2 * sx;
    const h = size * 1.2 * sy;
    sprites.draw(ctx, key, x - w / 2, y - h, w, h);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  if (dead) {
    // Aplastado, sin brillo, ojos en X y un charco
    ctx.fillStyle = 'rgba(90,150,140,0.55)';
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.06, size * 0.85, size * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(120,190,175,0.85)';
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.16, size * 0.55, size * 0.2, 0, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#1a1a22';
    ctx.lineWidth = Math.max(2, size * 0.03);
    for (const s of [-1, 1]) {
      const ex = s * size * 0.18;
      const ey = -size * 0.22;
      const r = size * 0.05;
      ctx.beginPath();
      ctx.moveTo(ex - r, ey - r);
      ctx.lineTo(ex + r, ey + r);
      ctx.moveTo(ex + r, ey - r);
      ctx.lineTo(ex - r, ey + r);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  ctx.scale(sx, sy);
  const w = size * 0.62;
  const h = size;
  // Sombra
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 4 / sy, w * 0.95, size * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  // Cuerpo de gelatina (gota)
  const g = ctx.createRadialGradient(-w * 0.3, -h * 0.65, size * 0.05, 0, -h * 0.4, size * 0.75);
  g.addColorStop(0, 'rgba(210,255,240,0.98)');
  g.addColorStop(0.5, 'rgba(110,235,200,0.92)');
  g.addColorStop(1, 'rgba(40,160,140,0.9)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-w, 0);
  ctx.bezierCurveTo(-w * 1.1, -h * 0.55, -w * 0.35, -h * 0.98, 0, -h);
  ctx.bezierCurveTo(w * 0.35, -h * 0.98, w * 1.1, -h * 0.55, w, 0);
  ctx.closePath();
  ctx.fill();
  // Brillo
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-w * 0.42, -h * 0.62, w * 0.12, h * 0.16, -0.5, 0, Math.PI * 2);
  ctx.fill();
  // Ojos grandes con brillos (parpadea de vez en cuando)
  const blink = (t % 4.2) < 0.12;
  for (const s of [-1, 1]) {
    const ex = s * w * 0.36;
    const ey = -h * 0.4;
    if (blink) {
      ctx.strokeStyle = '#141018';
      ctx.lineWidth = size * 0.025;
      ctx.beginPath();
      ctx.moveTo(ex - w * 0.13, ey);
      ctx.lineTo(ex + w * 0.13, ey);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#141018';
    ctx.beginPath();
    ctx.ellipse(ex, ey, w * 0.15, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex + w * 0.04, ey - h * 0.04, w * 0.055, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex - w * 0.05, ey + h * 0.05, w * 0.025, 0, Math.PI * 2);
    ctx.fill();
    // Mofletes
    ctx.fillStyle = 'rgba(255,120,160,0.55)';
    ctx.beginPath();
    ctx.ellipse(s * w * 0.58, -h * 0.27, w * 0.12, h * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Boca
  ctx.strokeStyle = '#7a2038';
  ctx.lineWidth = size * 0.02;
  ctx.beginPath();
  if (sad) ctx.arc(0, -h * 0.18, w * 0.1, Math.PI * 1.15, Math.PI * 1.85);
  else ctx.arc(0, -h * 0.29, w * 0.1, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  ctx.restore();
}
