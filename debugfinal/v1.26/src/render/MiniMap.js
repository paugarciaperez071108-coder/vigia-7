// =============================================================
// MiniMap.js — Dónde y cómo se DIBUJA el plano de cámaras: pequeño, en
// la esquina de abajo a la derecha y girado (estilo FNAF). v0.54: «TÚ»
// abajo del todo, la compuerta izquierda a la izquierda y la derecha a la
// derecha, pasillos como tubos y casillas sólidas (el mismo estilo en el
// plano de los conductos).
//
// Las posiciones LÓGICAS de las salas (mapRect en StationMap.js) no
// cambian: las sigue usando el sonido 3D (Spatial.js) y la IA. Aquí solo
// se convierten a la posición en pantalla:
//   mp(x, y)          punto del plano lógico → punto en pantalla
//   miniBox(rect)     recuadro (pequeño, de tamaño fijo) de una sala
//   officeBox()       recuadro «TÚ» (en pantalla, abajo del todo)
//   officeSide(side)  punto junto a «TÚ» por el lado de: 'left' (compuerta
//                     izquierda), 'right', 'back' (pasillo central),
//                     'front' (conductos)
//   doorPath(side)    recorrido del pasillo de cada compuerta hasta «TÚ»
//   centralPath()     el pasillo central (del Comedor a «TÚ»)
// MINIMAP.ROTATE: 'cw' = 90° hacia la derecha (horario); 'ccw' = hacia la
// izquierda.
// =============================================================

import { ROOMS } from '../world/StationMap.js';

export const MINIMAP = {
  ROTATE: 'cw',
  CENTER: { x: 1307, y: 667 },   // centro del plano lógico (salas)
  AT: { x: 1417, y: 700 },       // dónde queda ese centro en pantalla
  SCALE: 0.75,
  BOX: { w: 64, h: 28 },         // casilla de cada cámara
  PANEL: { x: 1258, y: 516, w: 318, h: 366 },   // fondo del plano
  OFFICE: { dy: 132, w: 63, h: 84 },           // «TÚ», bajo el centro (el recuadro de siempre)
  // El plano de los conductos (mismo sitio y mismo giro; es algo más grande)
  VENT: { CENTER: { x: 1300, y: 687 }, SCALE: 0.68 },
};

const M = MINIMAP;

/** Punto del plano lógico → pantalla. */
export function mp(x, y, k = M) {
  const dx = x - k.CENTER.x;
  const dy = y - k.CENTER.y;
  const [u, v] = dir(dx, dy);
  return { x: M.AT.x + u * k.SCALE, y: M.AT.y + v * k.SCALE };
}

/** Lo mismo para el plano de los conductos. */
export const vmp = (x, y) => mp(x, y, M.VENT);

/** Dirección lógica (dx, dy) → dirección en pantalla. */
function dir(dx, dy) {
  return M.ROTATE === 'cw' ? [-dy, dx] : [dy, -dx];
}

export function miniBox(rect, size = M.BOX, k = M) {
  const c = mp(rect.x + rect.w / 2, rect.y + rect.h / 2, k);
  return { x: c.x - size.w / 2, y: c.y - size.h / 2, w: size.w, h: size.h, cx: c.x, cy: c.y };
}

/** Un recuadro del plano lógico, girado y escalado (sus lados, donde llegan los pasillos). */
export function rectBox(rect, k = M) {
  const a = mp(rect.x, rect.y, k);
  const b = mp(rect.x + rect.w, rect.y + rect.h, k);
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.abs(a.x - b.x);
  const h = Math.abs(a.y - b.y);
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

/** «TÚ»: abajo del todo (solo en pantalla; la oficina lógica no se mueve). */
export function officeBox() {
  const { dy, w, h } = M.OFFICE;
  const cx = M.AT.x;
  const cy = M.AT.y + dy;
  return { x: cx - w / 2, y: cy - h / 2, w, h, cx, cy };
}

// En el plano lógico: la compuerta izquierda sale por abajo, la derecha por
// arriba, el pasillo central por la izquierda y los conductos por la derecha.
const SIDE_DIR = { left: [0, 1], right: [0, -1], back: [-1, 0], front: [1, 0] };

/** Punto pegado a «TÚ» por el lado `side` (para triángulos y Slaimi). */
export function officeSide(side, out = -6) {
  const o = officeBox();
  const [sx, sy] = dir(...SIDE_DIR[side]);
  return { x: o.cx + sx * (o.w / 2 + out), y: o.cy + sy * (o.h / 2 + out) };
}

const roomCenter = (id) => miniBox(ROOMS[id].mapRect);

/** Pasillo de la compuerta ('left' | 'right'): baja del corredor y entra por el lado de «TÚ». */
export function doorPath(side) {
  const r = roomCenter(side === 'left' ? 'westHall' : 'eastHall');
  const o = officeBox();
  const ex = side === 'left' ? o.x : o.x + o.w;
  return [[r.cx, r.cy], [r.cx, o.cy], [ex, o.cy]];
}

/** Pasillo central: baja recto desde el Comedor hasta el borde de arriba de «TÚ». */
export function centralPath() {
  const r = roomCenter('mess');
  const o = officeBox();
  const x = o.x + o.w - 12;
  return [[x, r.y + r.h], [x, o.y]];
}

/** Esquina de arriba a la derecha de la casilla, por fuera (para que el triángulo no tape el número). */
export function boxCorner(rect, k = M) {
  const b = miniBox(rect, M.BOX, k);
  return { x: b.x + b.w - 3, y: b.y - 4 };
}

export const insideBox = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

// -----------------------------------------------------------------
// Dibujo (común al plano de las salas y al de los conductos)
// -----------------------------------------------------------------

const C = {
  LINE: 'rgba(150,255,195,0.85)',
  DIM: 'rgba(150,255,195,0.45)',
  TEXT: '#d4ffe4',
  ACTIVE: '#7dffb0',
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Fondo: cristal oscuro con cuadrícula tenue y esquinas marcadas. */
export function drawMapPanel(ctx) {
  const P = M.PANEL;
  ctx.save();
  roundRect(ctx, P.x, P.y, P.w, P.h, 8);
  ctx.fillStyle = 'rgba(2,7,5,0.66)';
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = 'rgba(150,255,195,0.05)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = P.x + 12; x < P.x + P.w; x += 16) { ctx.moveTo(x + 0.5, P.y); ctx.lineTo(x + 0.5, P.y + P.h); }
  for (let y = P.y + 12; y < P.y + P.h; y += 16) { ctx.moveTo(P.x, y + 0.5); ctx.lineTo(P.x + P.w, y + 0.5); }
  ctx.stroke();
  ctx.restore();
  ctx.save();
  roundRect(ctx, P.x + 0.5, P.y + 0.5, P.w - 1, P.h - 1, 8);
  ctx.strokeStyle = 'rgba(150,255,195,0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Esquinas
  ctx.strokeStyle = 'rgba(150,255,195,0.7)';
  ctx.lineWidth = 2;
  const L = 14;
  ctx.beginPath();
  for (const [x, y, sx, sy] of [[P.x, P.y, 1, 1], [P.x + P.w, P.y, -1, 1], [P.x, P.y + P.h, 1, -1], [P.x + P.w, P.y + P.h, -1, -1]]) {
    ctx.moveTo(x + sx * 2, y + sy * (L + 2));
    ctx.lineTo(x + sx * 2, y + sy * 2);
    ctx.lineTo(x + sx * (L + 2), y + sy * 2);
  }
  ctx.stroke();
  ctx.restore();
}

/** Pasillos o conductos: tubo con borde claro e interior oscuro. paths = [[[x, y], …], …] en pantalla. */
export function drawMapTubes(ctx, paths, { outer = 9, inner = 4, color = C.DIM, dash = null } = {}) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'butt';
  for (const [width, stroke] of [[outer, color], [inner, 'rgba(3,10,7,0.95)']]) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    if (dash && width === outer) ctx.setLineDash(dash);
    ctx.beginPath();
    for (const p of paths) p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

/** Casilla de una cámara. tone: null (normal) o un color de borde/texto (p. ej. sin señal). */
export function drawCamBox(ctx, r, label, active, tone = null) {
  ctx.save();
  roundRect(ctx, r.x, r.y, r.w, r.h, 4);
  if (active) {
    ctx.shadowColor = C.ACTIVE;
    ctx.shadowBlur = 12;
  }
  ctx.fillStyle = active ? C.ACTIVE : 'rgba(6,18,12,0.94)';
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = active ? '#eafff2' : tone ?? C.LINE;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = active ? '#03110a' : tone ?? C.TEXT;
  ctx.font = 'bold 14px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, r.cx, r.cy + 1);
  ctx.restore();
}

/** «TÚ»: la oficina, con el recuadro y el estilo de siempre. */
export function drawOfficeBox(ctx, o) {
  ctx.save();
  ctx.fillStyle = 'rgba(20,50,34,0.85)';
  ctx.fillRect(o.x, o.y, o.w, o.h);
  ctx.strokeStyle = 'rgba(160,255,200,0.7)';
  ctx.lineWidth = 1;
  ctx.strokeRect(o.x + 0.5, o.y + 0.5, o.w - 1, o.h - 1);
  ctx.fillStyle = 'rgba(190,255,215,0.9)';
  ctx.font = 'bold 14px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TÚ', o.cx, o.cy);
  ctx.restore();
}
