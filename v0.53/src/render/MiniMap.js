// =============================================================
// MiniMap.js — Dónde se DIBUJA el plano de cámaras (v0.50): pequeño, en
// la esquina de abajo a la derecha, girado (estilo FNAF).
//
// Las posiciones LÓGICAS de las salas (mapRect en StationMap.js) no
// cambian: las sigue usando el sonido 3D (Spatial.js) y la IA. Aquí solo
// se convierten a la posición en pantalla:
//   mp(x, y)          punto del plano lógico → punto en pantalla
//   miniBox(rect)     recuadro (pequeño, de tamaño fijo) de una sala
//   officeBox()       recuadro «TÚ» (el de la oficina, girado: ahí llegan
//                     los pasillos)
//   officeSide(side)  punto junto a «TÚ» por el lado de: 'left' (compuerta
//                     izquierda), 'right', 'back' (pasillo central),
//                     'front' (conductos)
// MINIMAP.ROTATE: 'ccw' = 90° hacia la izquierda (antihorario); 'cw' =
// hacia la derecha.
// =============================================================

import { OFFICE_RECT } from '../world/StationMap.js';

export const MINIMAP = {
  ROTATE: 'ccw',
  CENTER: { x: 1307, y: 667 },   // centro del plano lógico (salas)
  AT: { x: 1408, y: 714 },       // dónde queda ese centro en pantalla
  SCALE: 0.75,
  BOX: { w: 62, h: 27 },         // casilla de cada cámara
  PANEL: { x: 1252, y: 520, w: 330, h: 362 },   // fondo semitransparente
  // El plano de los conductos (mismo sitio y mismo giro; es algo más grande)
  VENT: { CENTER: { x: 1300, y: 687 }, SCALE: 0.68 },
};

const M = MINIMAP;

/** Punto del plano lógico → pantalla. */
export function mp(x, y, k = M) {
  const dx = x - k.CENTER.x;
  const dy = y - k.CENTER.y;
  const [u, v] = M.ROTATE === 'cw' ? [-dy, dx] : [dy, -dx];
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

export function officeBox() {
  return rectBox(OFFICE_RECT);
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

/** Esquina de arriba a la derecha de la casilla (para los triángulos). */
export function boxCorner(rect, k = M) {
  const b = miniBox(rect, M.BOX, k);
  return { x: b.x + b.w - 9, y: b.y + 9 };
}

export const insideBox = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
