// =============================================================
// VentView.js — Dibujo de los conductos de ventilación (noche 2+).
//
//   drawDuct(ctx, decor, t)       imagen de una cámara de conducto
//   makeVentDecor(id)             detalles fijos de cada conducto
//   ductPoint(u, v, z)            punto 3D del conducto → pantalla
//   drawVentMap(ctx, active)      mapa de ventilación (botón TOGGLE)
//   drawDuctEntrance(ctx, spot, stage, t)  entrada de conducto de una
//                                 sala, más rota cuanto más golpes de
//                                 El Largo (stage 0..BREAK_STAGES)
//
// Todas las cámaras de conducto son la MISMA vista: un conducto
// metálico de sección cuadrada en perspectiva, viejo y abandonado
// (óxido, abolladuras, manchas, polvo acumulado, rejillas dobladas).
// Solo cambian pequeños detalles de cada una (una mancha, un tornillo
// suelto, un cable colgando, un rótulo...) para poder distinguirlas
// sin perder la sensación de laberinto. Esos detalles están en
// VENT_DETAILS y en makeVentDecor (semilla fija por conducto).
//
// Si existe una imagen propia cam_v1...cam_v5 en assets/manifest.json,
// CameraView la usa en lugar de este dibujo.
// =============================================================

import { CONFIG } from '../config.js';
import { Random } from '../core/Random.js';
import { VENTS, VENT_LINKS, OFFICE_RECT } from '../world/StationMap.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
// Punto de fuga y tamaño de la sección cuadrada a profundidad 1
const VX = 800;
const VY = 440;
const S = 820;
const Z_END = 11;                                    // fondo del conducto
const SEAMS = [1.25, 1.65, 2.2, 3, 4.1, 5.6, 7.8];  // juntas entre planchas

/** Punto del conducto (u, v ∈ [-1, 1] en la sección; z = profundidad) → pantalla. */
export function ductPoint(u, v, z) {
  return [VX + (u * S) / z, VY + (v * S) / z];
}

// -----------------------------------------------------------------
// Detalles propios de cada conducto (lo único que cambia entre ellos)
//   stencil   texto pintado en la pared
//   end       'grille' rejilla al fondo | 'turn' recodo oscuro |
//             'light' rejilla con luz de la oficina detrás
//   openings  bocas laterales hacia otros ramales: [lado, z]
//   cable     cable colgando del techo: [u, z] o null
//   screw     tornillo suelto en el suelo: [u, z] o null
//   bigStain  mancha grande: [superficie, a, z, radio]
//   insulation aislante rasgado colgando del techo
//   puddle    charco en el suelo
// -----------------------------------------------------------------
const VENT_DETAILS = {
  v1: { stencil: 'V-1  >> OFICINA', end: 'light', openings: [['left', 3], ['right', 3.4]], cable: [0.35, 2.6], screw: null, bigStain: ['floor', -0.3, 2.4, 70] },
  v2: { stencil: 'V-2', end: 'turn', openings: [['left', 4.4]], cable: null, screw: [0.4, 2.1], bigStain: ['left', -0.2, 2, 120] },
  v3: { stencil: 'V-3', end: 'grille', openings: [['right', 2.6], ['left', 5.2]], cable: null, screw: null, bigStain: ['right', 0.3, 2.8, 90], dent: true },
  v4: { stencil: 'V-4  NUDO', end: 'turn', openings: [['left', 2.8], ['right', 2.8]], cable: [-0.4, 3.4], screw: null, bigStain: ['floor', 0.2, 3.4, 60], insulation: true },
  v5: { stencil: 'V-5', end: 'grille', openings: [['right', 4]], cable: [0.1, 2.2], screw: [-0.5, 2.6], bigStain: ['floor', -0.1, 2.2, 90], puddle: true },
};

/** Detalles fijos (semilla por conducto): óxido, abolladuras, polvo... */
export function makeVentDecor(id) {
  const seed = 300 + Object.keys(VENTS).indexOf(id) * 131;
  const rng = new Random(seed);
  const surfaces = ['left', 'right', 'floor', 'ceil'];
  return {
    id,
    details: VENT_DETAILS[id] ?? VENT_DETAILS.v2,
    // Manchas de óxido (en paredes y techo, sobre todo cerca de las juntas)
    rust: Array.from({ length: 10 }, () => ({
      surf: surfaces[rng.int(0, 3)], a: rng.range(-0.8, 0.8), z: rng.range(1.3, 6), r: rng.range(25, 70),
      alpha: rng.range(0.25, 0.5),
    })),
    // Chorretones de óxido que bajan por las paredes desde una junta
    drips: Array.from({ length: 6 }, () => ({
      side: rng.next() < 0.5 ? -1 : 1, seam: rng.int(0, 3), v: rng.range(-0.9, -0.3), len: rng.range(0.3, 0.9),
      w: rng.range(3, 8),
    })),
    // Abolladuras (sombra + brillo)
    dents: Array.from({ length: 3 }, () => ({
      side: rng.next() < 0.5 ? -1 : 1, v: rng.range(-0.5, 0.6), z: rng.range(1.4, 3.5), r: rng.range(30, 60),
    })),
    // Motas de polvo acumulado en el suelo
    dust: Array.from({ length: 120 }, () => ({
      u: rng.range(-0.95, 0.95), z: rng.range(1.75, 9), s: rng.range(1, 3), a: rng.range(0.15, 0.45),
    })),
    // Pelusas/borras de polvo pegadas en las esquinas del suelo
    clumps: Array.from({ length: 8 }, () => ({
      side: rng.next() < 0.5 ? -1 : 1, z: rng.range(1.8, 7), r: rng.range(10, 26),
    })),
  };
}

// -----------------------------------------------------------------
// Imagen de una cámara de conducto
// -----------------------------------------------------------------

/** Rellena el polígono de una superficie entre dos profundidades. */
function surface(ctx, surf, z1, z2) {
  const c = {
    floor: [[-1, 1], [1, 1]],
    ceil: [[-1, -1], [1, -1]],
    left: [[-1, -1], [-1, 1]],
    right: [[1, -1], [1, 1]],
  }[surf];
  const [a, b] = c;
  const p = [ductPoint(a[0], a[1], z1), ductPoint(b[0], b[1], z1), ductPoint(b[0], b[1], z2), ductPoint(a[0], a[1], z2)];
  ctx.beginPath();
  p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

/** Punto de una superficie: `a` recorre el ancho (-1..1) y z la profundidad. */
function onSurface(surf, a, z) {
  switch (surf) {
    case 'floor': return ductPoint(a, 1, z);
    case 'ceil': return ductPoint(a, -1, z);
    case 'left': return ductPoint(-1, a, z);
    default: return ductPoint(1, a, z);
  }
}

function blob(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 1, x, y, r);
  g.addColorStop(0, `rgba(${color},${alpha})`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export function drawDuct(ctx, decor, t) {
  const d = decor.details;
  ctx.fillStyle = '#050605';
  ctx.fillRect(0, 0, W, H);

  // Planchas de chapa: paredes, techo y suelo (con polvo, más claro)
  const grad = (x1, y1, x2, y2, near, far) => {
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, near);
    g.addColorStop(1, far);
    return g;
  };
  surface(ctx, 'ceil', 1, Z_END);
  ctx.fillStyle = grad(0, 0, 0, VY, '#4a4f4b', '#151715');
  ctx.fill();
  surface(ctx, 'left', 1, Z_END);
  ctx.fillStyle = grad(0, 0, VX, 0, '#626862', '#1a1d1a');
  ctx.fill();
  surface(ctx, 'right', 1, Z_END);
  ctx.fillStyle = grad(W, 0, VX, 0, '#5a605b', '#181b18');
  ctx.fill();
  surface(ctx, 'floor', 1, Z_END);
  ctx.fillStyle = grad(0, H, 0, VY, '#7d7563', '#24221b');
  ctx.fill();
  // Brillo metálico a lo largo de las paredes (reflejo de la luz de la cámara)
  for (const side of [-1, 1]) {
    const [x1, y1] = ductPoint(side, -0.2, 1.3);
    const [x2, y2] = ductPoint(side, 0.2, 4);
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, 'rgba(200,210,200,0.10)');
    g.addColorStop(1, 'rgba(200,210,200,0)');
    ctx.fillStyle = g;
    surface(ctx, side < 0 ? 'left' : 'right', 1.3, 4);
    ctx.fill();
  }

  // Fondo del conducto
  const [ex1, ey1] = ductPoint(-1, -1, Z_END);
  const [ex2, ey2] = ductPoint(1, 1, Z_END);
  ctx.fillStyle = '#030303';
  ctx.fillRect(ex1, ey1, ex2 - ex1, ey2 - ey1);
  if (d.end === 'light') {
    // Luz de la oficina filtrándose por la rejilla del final
    blob(ctx, VX, VY, 90, '150,190,210', 0.35 + Math.sin(t * 3) * 0.05);
  }
  if (d.end === 'grille' || d.end === 'light') drawEndGrille(ctx, ex1, ey1, ex2 - ex1, ey2 - ey1, d.end === 'grille');
  if (d.end === 'turn') {
    // Recodo: se ve el inicio de la pared que gira
    ctx.fillStyle = '#121412';
    ctx.fillRect(ex1, ey1, (ex2 - ex1) * 0.45, ey2 - ey1);
  }

  // Polvo acumulado en el suelo (más en las esquinas)
  for (const m of decor.dust) {
    const [x, y] = ductPoint(m.u, 1, m.z);
    ctx.fillStyle = `rgba(185,175,150,${m.a / Math.sqrt(m.z)})`;
    ctx.fillRect(x, y, m.s * 2 / Math.sqrt(m.z), m.s / Math.sqrt(m.z));
  }
  for (const c of decor.clumps) {
    const [x, y] = ductPoint(c.side * 0.93, 0.97, c.z);
    blob(ctx, x, y, c.r * 4 / Math.sqrt(c.z), '160,150,125', 0.5);
  }

  // Óxido y suciedad
  for (const r of decor.rust) {
    const [x, y] = onSurface(r.surf, r.a, r.z);
    blob(ctx, x, y, (r.r * 2.6) / Math.sqrt(r.z), '125,58,18', r.alpha + 0.15);
  }
  const [bs, ba, bz, br] = d.bigStain;
  const [sx, sy] = onSurface(bs, ba, bz);
  blob(ctx, sx, sy, (br * 2) / bz, bs === 'floor' ? '20,16,10' : '90,45,15', 0.6);
  if (d.puddle) {
    const [px, py] = ductPoint(0.15, 1, 2.4);
    ctx.fillStyle = 'rgba(10,14,12,0.7)';
    ctx.beginPath();
    ctx.ellipse(px, py, 120, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(160,190,180,${0.08 + Math.sin(t * 2) * 0.03})`;
    ctx.beginPath();
    ctx.ellipse(px - 30, py - 4, 50, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Chorretones de óxido desde las juntas
  for (const dr of decor.drips) {
    const z = SEAMS[dr.seam];
    const [x1, y1] = ductPoint(dr.side, dr.v, z);
    const [, y2] = ductPoint(dr.side, dr.v + dr.len, z);
    const g = ctx.createLinearGradient(0, y1, 0, y2);
    g.addColorStop(0, 'rgba(120,60,20,0.55)');
    g.addColorStop(1, 'rgba(120,60,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x1 - dr.w / 2 + dr.side * 6, y1, dr.w, y2 - y1);
  }

  // Abolladuras: sombra a un lado y brillo al otro
  const dents = d.dent ? [...decor.dents, { side: 1, v: 0, z: 1.6, r: 90 }] : decor.dents;
  for (const dn of dents) {
    const [x, y] = ductPoint(dn.side, dn.v, dn.z);
    const r = (dn.r * 2) / dn.z;
    blob(ctx, x - dn.side * r * 0.2, y, r, '0,0,0', 0.45);
    blob(ctx, x + dn.side * r * 0.25, y - r * 0.2, r * 0.6, '200,205,195', 0.12);
  }

  // Bocas laterales hacia otros ramales (con su rejilla doblada)
  for (const [side, z] of d.openings) drawSideOpening(ctx, side === 'left' ? -1 : 1, z, t);

  // Juntas entre planchas, con remaches
  for (const z of SEAMS) {
    const [x1, y1] = ductPoint(-1, -1, z);
    const [x2, y2] = ductPoint(1, 1, z);
    ctx.strokeStyle = `rgba(0,0,0,${0.7})`;
    ctx.lineWidth = 9 / z;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    ctx.strokeStyle = `rgba(190,195,185,${0.16 / Math.sqrt(z)})`;
    ctx.lineWidth = 3 / z;
    ctx.strokeRect(x1 + 6 / z, y1 + 6 / z, x2 - x1 - 12 / z, y2 - y1 - 12 / z);
    ctx.fillStyle = `rgba(150,150,140,${0.5 / Math.sqrt(z)})`;
    for (let k = -0.8; k <= 0.81; k += 0.4) {
      for (const [u, v] of [[k, -1], [k, 1], [-1, k], [1, k]]) {
        const [rx, ry] = ductPoint(u * 0.97, v * 0.97, z);
        ctx.beginPath();
        ctx.arc(rx, ry, 5 / z, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Aristas del conducto
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 3;
  for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const [x1, y1] = ductPoint(u, v, 1);
    const [x2, y2] = ductPoint(u, v, Z_END);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Rótulo pintado en la pared izquierda, medio borrado
  const [tx, ty] = ductPoint(-1, -0.25, 1.9);
  ctx.save();
  ctx.translate(tx + 14, ty);
  ctx.transform(1, -0.12, 0, 1, 0, 0);
  ctx.font = 'bold 34px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(210,180,60,0.35)';
  ctx.fillText(d.stencil, 0, 0);
  ctx.restore();

  // Aislante rasgado colgando del techo
  if (d.insulation) {
    const [ix, iy] = ductPoint(0.2, -1, 2.1);
    ctx.fillStyle = 'rgba(170,150,110,0.55)';
    for (let i = 0; i < 6; i++) {
      const sway = Math.sin(t * 1.5 + i) * 4;
      ctx.beginPath();
      ctx.moveTo(ix + i * 18, iy);
      ctx.lineTo(ix + i * 18 + 14, iy);
      ctx.lineTo(ix + i * 18 + 6 + sway, iy + 50 + (i % 3) * 25);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Cable colgando del techo (se balancea con la corriente de aire)
  if (d.cable) {
    const [cu, cz] = d.cable;
    const [cx, cy] = ductPoint(cu, -1, cz);
    const swing = Math.sin(t * 1.1 + cu * 5) * 14;
    ctx.strokeStyle = '#0b0b0b';
    ctx.lineWidth = 7 / Math.sqrt(cz);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(cx + 20, cy + 120, cx + swing, cy + 230 / Math.sqrt(cz));
    ctx.stroke();
    if (Math.random() < 0.01) blob(ctx, cx + swing, cy + 230 / Math.sqrt(cz), 18, '200,230,255', 0.9);
  }

  // Tornillo suelto en el suelo
  if (d.screw) {
    const [su, sz] = d.screw;
    const [x, y] = ductPoint(su, 0.995, sz);
    ctx.fillStyle = '#8a8a80';
    ctx.beginPath();
    ctx.ellipse(x, y, 14 / sz * 2, 6 / sz * 2, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a5a52';
    ctx.fillRect(x, y - 3, 26 / sz * 2, 5 / sz * 2);
  }

  // Oscuridad hacia el fondo (la luz de la cámara no llega lejos)
  const dark = ctx.createRadialGradient(VX, VY, 20, VX, VY, 380);
  dark.addColorStop(0, 'rgba(0,0,0,0.8)');
  dark.addColorStop(0.4, 'rgba(0,0,0,0.35)');
  dark.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = dark;
  ctx.fillRect(0, 0, W, H);
}

/** Rejilla del fondo del conducto; `bent` = con lamas dobladas. */
function drawEndGrille(ctx, x, y, w, h, bent) {
  ctx.strokeStyle = 'rgba(120,125,115,0.6)';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  for (let i = 1; i < 7; i++) {
    const yy = y + (h * i) / 7;
    ctx.beginPath();
    ctx.moveTo(x + 4, yy);
    if (bent && i >= 3 && i <= 5) ctx.quadraticCurveTo(x + w * 0.5, yy + 14, x + w - 4, yy - 4);
    else ctx.lineTo(x + w - 4, yy);
    ctx.stroke();
  }
}

/** Boca lateral hacia otro ramal, con la rejilla doblada hacia dentro. */
function drawSideOpening(ctx, side, z, t) {
  const z1 = z;
  const z2 = z + 0.9;
  const pts = [ductPoint(side, -0.55, z1), ductPoint(side, 0.75, z1), ductPoint(side, 0.75, z2), ductPoint(side, -0.55, z2)];
  ctx.fillStyle = '#020202';
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,60,55,0.9)';
  ctx.lineWidth = 6 / z;
  ctx.stroke();
  // Lamas de la rejilla, dobladas y alguna arrancada
  ctx.strokeStyle = 'rgba(130,130,120,0.55)';
  ctx.lineWidth = 5 / z;
  for (let k = 0; k < 5; k++) {
    if (k === 3) continue; // lama que falta
    const v = -0.45 + k * 0.27;
    const [x1, y1] = ductPoint(side, v, z1);
    const [x2, y2] = ductPoint(side, v, z2);
    const bend = (k === 1 ? 26 : 8) / z;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo((x1 + x2) / 2 - side * bend, (y1 + y2) / 2 + bend, x2, y2);
    ctx.stroke();
  }
  // Corriente de aire que sale de la boca (polvo en suspensión)
  const [mx, my] = ductPoint(side * 0.9, 0.1, z + 0.45);
  blob(ctx, mx, my + Math.sin(t * 2 + z) * 6, 60 / z * 2, '120,115,100', 0.12);
}

// -----------------------------------------------------------------
// Mapa de ventilación
// -----------------------------------------------------------------

const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** Recorrido de un tramo en el mapa: con recodos en ángulo recto. */
function ventLinkPath(a, b) {
  const pa = a === 'office' ? { x: OFFICE_RECT.x, y: OFFICE_RECT.y + OFFICE_RECT.h / 2 } : center(VENTS[a].mapRect);
  const pb = b === 'office' ? { x: OFFICE_RECT.x, y: OFFICE_RECT.y + OFFICE_RECT.h / 2 } : center(VENTS[b].mapRect);
  return [[pa.x, pa.y], [pb.x, pa.y], [pb.x, pb.y]];
}

export function drawVentMap(ctx, active, unlocked) {
  ctx.save();
  ctx.fillStyle = 'rgba(5,8,10,0.82)';
  ctx.strokeStyle = 'rgba(120,255,170,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(1042, 446, 530, 432, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(120,255,170,0.7)';
  ctx.font = '16px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('VIGIA-7 // VENTILACION', 1062, 458);

  // Conductos: tubo hueco (borde claro, interior oscuro)
  for (const [width, color] of [[22, 'rgba(120,255,170,0.45)'], [12, '#07100b']]) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'square';
    ctx.beginPath();
    for (const [a, b] of VENT_LINKS) {
      ventLinkPath(a, b).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    }
    ctx.stroke();
  }

  // Oficina (el jugador), a la derecha
  const o = OFFICE_RECT;
  ctx.fillStyle = '#1b3a2a';
  ctx.fillRect(o.x, o.y, o.w, o.h);
  ctx.strokeStyle = '#7dffb0';
  ctx.lineWidth = 2;
  ctx.strokeRect(o.x, o.y, o.w, o.h);
  ctx.fillStyle = '#7dffb0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 18px "Courier New", monospace';
  ctx.fillText('TU', o.x + o.w / 2, o.y + o.h / 2);

  // Secciones (botones de cámara)
  for (const [id, v] of Object.entries(VENTS)) {
    const r = v.mapRect;
    const isActive = id === active;
    ctx.fillStyle = isActive ? '#7dffb0' : '#0f1a14';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = isActive ? '#d8ffe8' : unlocked ? 'rgba(120,255,170,0.6)' : 'rgba(255,170,80,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = isActive ? '#06120b' : unlocked ? '#bfffd6' : '#ffcf99';
    ctx.font = 'bold 17px "Courier New", monospace';
    ctx.fillText(`CAM ${v.cam}`, r.x + r.w / 2, r.y + 17);
    ctx.font = '11px "Courier New", monospace';
    ctx.fillText(v.name, r.x + r.w / 2, r.y + 36);
  }
  if (!unlocked) {
    ctx.fillStyle = '#ffb050';
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SIN SEÑAL', 1310, 806);
    ctx.font = '13px "Courier New", monospace';
    ctx.fillText('consola: get-update', 1310, 830);
  }
  ctx.restore();
}

// -----------------------------------------------------------------
// Entrada de conducto en las salas (la que intenta romper El Largo)
// -----------------------------------------------------------------

/**
 * Rejilla atornillada a la pared. stage = golpes recibidos de 0 a
 * `max`: se abolla, pierde tornillos, las lamas se doblan y al final
 * cuelga de un lado dejando ver el agujero.
 */
export function drawDuctEntrance(ctx, spot, stage, max, t) {
  const { x, y, w, h } = spot;
  const k = Math.min(1, stage / max);
  ctx.save();
  // Hueco oscuro del conducto
  ctx.fillStyle = '#030303';
  ctx.fillRect(x, y, w, h);
  // Marco metálico
  ctx.strokeStyle = '#5b5f5a';
  ctx.lineWidth = 8;
  ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 9, y - 9, w + 18, h + 18);
  // Óxido en el marco
  blob(ctx, x + w * 0.8, y + h, 30, '110,55,20', 0.4);

  // Rejilla: gira sobre su esquina izquierda a medida que cede
  ctx.translate(x, y);
  ctx.rotate(k >= 0.8 ? 0.35 + Math.sin(t * 2) * 0.02 : k * 0.06);
  const lamas = 6;
  for (let i = 0; i < lamas; i++) {
    if (k >= 0.6 && i === 4) continue;    // lama arrancada
    if (k >= 0.8 && i === 2) continue;
    const ly = (h * (i + 0.5)) / lamas;
    const bend = (i % 2 ? 1 : -1) * k * 16 + (i === 3 ? k * 22 : 0);
    ctx.strokeStyle = '#8b8f88';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(4, ly);
    ctx.quadraticCurveTo(w / 2, ly + bend, w - 4, ly - bend * 0.3);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(4, ly + 4);
    ctx.quadraticCurveTo(w / 2, ly + bend + 4, w - 4, ly - bend * 0.3 + 4);
    ctx.stroke();
  }
  ctx.restore();

  // Tornillos: van saltando con los golpes
  ctx.fillStyle = '#9a9a90';
  const screws = [[x + 6, y + 6], [x + w - 6, y + 6], [x + 6, y + h - 6], [x + w - 6, y + h - 6]];
  screws.forEach(([sx, sy], i) => {
    if (i >= 4 - Math.floor(k * 4)) return;
    ctx.beginPath();
    ctx.arc(sx, sy, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  // Arañazos y abolladuras alrededor cuanto más golpeado está
  if (stage > 0) {
    ctx.strokeStyle = `rgba(0,0,0,${0.3 + 0.4 * k})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < stage * 2; i++) {
      const sx = x - 20 + ((i * 37) % (w + 40));
      const sy = y - 25 + ((i * 53) % 20);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + 10, sy + 30);
      ctx.stroke();
    }
  }
  // Rótulo
  ctx.fillStyle = 'rgba(210,180,60,0.55)';
  ctx.font = 'bold 13px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('VENT', x + w / 2, y - 12);
}
