// =============================================================
// FirstPersonView.js — Lo que se ve en el FINAL DE LA NOCHE 2.
//
// Las salas son las mismas que se ven por las cámaras (CameraView
// .drawInterior), pero desde dentro y a oscuras: solo la linterna
// (Flashlight.js) deja verlas. Aquí están además:
//   - la oficina a las 6 AM con la linterna sobre la mesa;
//   - las SALIDAS de cada sala: una por cada conexión del plano (LINKS),
//     repartidas por las paredes (EXIT_LAYOUT): laterales y del fondo. Sin
//     flechas: se distinguen a la luz de la linterna. Por cada una se ve un
//     tramo de pasillo y, al fondo, la SALA A LA QUE LLEVA de verdad (más
//     pequeña, difuminada y más oscura cuanto más lejos);
//   - la grabadora del hombre en el reactor (PUNTO DE LORE);
//   - los enemigos (drawEnemy) y dónde tienen la cara (faceOf), para la
//     mecánica de la luz;
//   - Comunicaciones con más detalle y el PUNTO DE LORE;
//   - el reactor: consola y pósit con el comando;
//   - Fase 2: la sala del reactor (iluminada) con tres pasillos, cada
//     uno con su sala real al fondo (a oscuras), y el panel de la consola.
// Las zonas en las que se puede hacer clic se exportan (rectángulos en
// coordenadas lógicas 1600×900).
// =============================================================

import { CONFIG } from '../config.js';
import { ROOMS, neighbors } from '../world/StationMap.js';
import { drawCreature } from './CreatureArt.js';
import { N2END } from '../night/night2ending.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const FONT = '"Courier New", monospace';

// --- Zonas de clic ---
export const FLASH_DESK = { x: 985, y: 690, w: 140, h: 46 };          // linterna sobre la mesa
export const OFFICE_EXITS = {
  left: { x: 70, y: 150, w: 300, h: 610 },
  right: { x: 1230, y: 150, w: 300, h: 610 },
};
// Huecos de salida de las salas: dos en las paredes laterales (en
// perspectiva) y tres en la pared del fondo.
export const EXIT_SLOTS = {
  left: { x: 30, y: 230, w: 250, h: 470 },
  right: { x: 1320, y: 230, w: 250, h: 470 },
  backLeft: { x: 445, y: 300, w: 160, h: 290 },
  back: { x: 720, y: 290, w: 160, h: 300 },
  backRight: { x: 995, y: 300, w: 160, h: 290 },
};
// Cómo se reparten según cuántas salidas tenga la sala
const EXIT_LAYOUT = {
  1: ['back'],
  2: ['left', 'right'],
  3: ['left', 'back', 'right'],
  4: ['left', 'backLeft', 'backRight', 'right'],
  5: ['left', 'backLeft', 'back', 'backRight', 'right'],
};
const MAP_X = (id) => (id === 'office' ? 1500 : ROOMS[id]?.mapRect.x ?? 0) + (ROOMS[id]?.mapRect.y ?? 0) * 0.01;
/** [{ slot, to }] de una sala: sus conexiones, ordenadas de izquierda a derecha según el plano. */
export function exitLayout(destinations) {
  const list = [...destinations].sort((a, b) => MAP_X(a) - MAP_X(b));
  const slots = EXIT_LAYOUT[list.length] ?? EXIT_LAYOUT[5];
  return list.slice(0, slots.length).map((to, i) => ({ slot: slots[i], to }));
}
export const REACTOR_CONSOLE = { x: 1040, y: 520, w: 300, h: 190 };
export const POSTIT = { x: 1352, y: 548, w: 84, h: 74 };
// PUNTO DE LORE: COMUNICACIONES — la terminal apagada de la sala de
// Comunicaciones (CAM 10). Ver Night2Ending._clickLore().
export const LORE_TERMINAL = { x: 1215, y: 365, w: 210, h: 150 };
// PUNTO DE LORE: GRABADORA DEL HOMBRE — tirada en el suelo del reactor
// (Fase 1). Solo se ve con la linterna. Ver Night2Ending._clickRecorder().
export const RECORDER = { x: 360, y: 780, w: 150, h: 70 };
export const CONSOLE_TAB = { x: 560, y: 842, w: 480, h: 52 };          // Fase 2: abrir/cerrar la consola

// --- Enemigos: posturas y dónde queda la cara en cada una ---
// (posiciones de la cabeza en "unidades" = 1 % de la altura, respecto a
// los pies; ver CreatureArt.js)
// El Largo, en el final, cambia de pose quieto (no golpea: eso es solo
// para cuando quiere entrar por los conductos, en las cámaras).
export const POSES = {
  specimen: ['front', 'hall', 'crouch', 'lean'],
  largo: ['stand', 'crouch', 'lean'],
};
const FACE = {
  specimen: { front: [0, -98], hall: [6.4, -98], crouch: [40, -70], lean: [-17, -96.6] },
  largo: { stand: [1, -95], crouch: [-17, -64], lean: [-27.1, -91.1], hit: [1, -95], kneel: [-17, -64] },
};
const KIND_H = { specimen: 1, largo: 1.2 };   // El Largo es más alto

/** Cara (centro y radio del "blanco") de un enemigo en (x, y) con altura h. */
export function faceOf(enemy, pose, x, y, h, radiusPct, radiusMin) {
  const hh = h * KIND_H[enemy];
  const u = hh / 100;
  const [fx, fy] = FACE[enemy][pose];
  return { x: x + fx * u, y: y + fy * u, r: Math.max(radiusMin, radiusPct * u) };
}

export function drawEnemy(ctx, enemy, pose, x, y, h, t) {
  drawCreature(ctx, enemy, x, y, h * KIND_H[enemy], t, {
    pose, look: true,
    // Solo las poses de golpear llevan objetivo (las del final son quietas)
    target: pose === 'kneel' ? { x: -40, y: -50 } : pose === 'hit' ? { x: -30, y: -80 } : undefined,
  });
}

// Sitios de los enemigos dentro de una sala (Fase 1): [x, y de los pies],
// cerca del jugador. La altura sale de N2END.ENEMY_HEIGHT.
export const ROOM_SPOTS = [[560, 880], [800, 900], [1050, 880], [680, 820], [930, 830]];
// Sitios en las puertas de la oficina: en el marco (cerca) o al fondo del
// pasillo (lejos), de las dos puertas. [x, y de los pies, altura]
export const OFFICE_SPOTS = [[220, 770, 540], [235, 600, 250], [1380, 770, 540], [1365, 600, 250]];

// --- Fase 2: la sala del reactor con tres pasillos ---
export const CORRIDORS = ['left', 'center', 'right'];
// La sala del fondo de cada pasillo: las tres conexiones del reactor en el
// plano (StationMap.js), en el mismo orden que sus salidas en la huida.
export const P2_ROOMS = Object.fromEntries(exitLayout(neighbors('reactor')).map(({ slot, to }) => [slot === 'back' ? 'center' : slot, to]));
const CORRIDOR_LABEL = Object.fromEntries(Object.entries(P2_ROOMS).map(([id, room]) => [
  id, ROOMS[room].name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase(),
]));
// Hueco de cada pasillo (lo de dentro está a oscuras)
export const P2_OPEN = { x: 330, y: 110, w: 940, h: 660 };
// La sala del fondo, dentro del hueco (escala 0,5)
const P2_ROOM = { x: P2_OPEN.x + (P2_OPEN.w - W * 0.5) / 2, y: P2_OPEN.y + 70, s: 0.5 };
const toRoom = (x, y) => [P2_ROOM.x + x * P2_ROOM.s, P2_ROOM.y + y * P2_ROOM.s];
// Sitios de un pasillo (en su panel): [x, y de los pies, altura]. Los 3
// primeros, dentro de la sala del fondo; los otros, por el pasillo.
export const CORRIDOR_SPOTS = [
  [...toRoom(560, 640), 130], [...toRoom(1040, 640), 130], [...toRoom(800, 600), 120],
  [600, 690, 270], [1000, 690, 270], [800, 740, 340],
];

export class FirstPersonView {
  constructor(cameraView) {
    this.cam = cameraView;
    this.time = 0;
  }

  update(dt) {
    this.time += dt;
  }

  // ---------------------------------------------------------------
  // Oficina a las 6 AM
  // ---------------------------------------------------------------

  drawOffice(ctx, officeView, office, terminal, reactor) {
    officeView.draw(ctx, office, {
      blackout: false, terminal, reactor, locked: false, night: 2, doorEnemies: { left: [], right: [] },
    });
  }

  /** La linterna en la mesa (se dibuja ENCIMA de la oscuridad: brilla un poco). */
  drawDeskFlashlight(ctx) {
    const r = FLASH_DESK;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 2.2);
    ctx.save();
    ctx.fillStyle = '#2a2d30';
    ctx.fillRect(r.x + 30, r.y + 12, 100, 24);
    ctx.fillStyle = '#3a3e42';
    ctx.beginPath();
    ctx.moveTo(r.x, r.y + 4);
    ctx.lineTo(r.x + 34, r.y + 10);
    ctx.lineTo(r.x + 34, r.y + 38);
    ctx.lineTo(r.x, r.y + 44);
    ctx.closePath();
    ctx.fill();
    // Tira fosforescente para encontrarla a oscuras
    ctx.fillStyle = `rgba(140,255,170,${0.35 + 0.35 * pulse})`;
    ctx.shadowColor = 'rgba(140,255,170,0.8)';
    ctx.shadowBlur = 14;
    ctx.fillRect(r.x + 45, r.y + 21, 70, 5);
    ctx.restore();
  }

  // ---------------------------------------------------------------
  // Salas de la ruta
  // ---------------------------------------------------------------

  /** exits: [{ slot, to }] (exitLayout). console: dibujar la consola del reactor. */
  drawRoom(ctx, room, exits = [], { console: withConsole = true } = {}) {
    this.cam.drawInterior(ctx, room);
    if (room === 'comms') this._commsExtras(ctx);
    if (room === 'reactor' && withConsole) this._reactorConsole(ctx);
    for (const { slot, to } of exits) {
      if (slot === 'left' || slot === 'right') this._sideExit(ctx, slot, true, to);
      else this._backExit(ctx, EXIT_SLOTS[slot], to);
    }
  }

  /** La sala que se ve al fondo de una salida (la oficina, con su dibujo). */
  _drawFar(ctx, room) {
    if (room === 'office' && this.officeDrawer) this.officeDrawer(ctx);
    else this.cam.drawInterior(ctx, room);
  }

  /** Salida en la pared del fondo: marco de compuerta, tramo de pasillo y la sala. */
  _backExit(ctx, r, next) {
    ctx.save();
    ctx.fillStyle = '#05070a';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    // Boca del fondo, más pequeña (lejos)
    const ew = r.w * 0.58;
    const eh = r.h * 0.6;
    const ex = r.x + (r.w - ew) / 2;
    const ey = r.y + r.h * 0.18;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ex, ey, ew, eh);
    ctx.clip();
    const k = eh / CONFIG.HEIGHT;
    ctx.translate(ex + ew / 2 - (CONFIG.WIDTH / 2) * k, ey);
    ctx.scale(k, k);
    ctx.filter = 'blur(3px)';
    this._drawFar(ctx, next);
    ctx.filter = 'none';
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fillRect(ex, ey, ew, eh);
    // Tramo de pasillo: techo, suelo con rejilla y paredes
    const quad = (pts, color) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    quad([[r.x, r.y], [r.x + r.w, r.y], [ex + ew, ey], [ex, ey]], '#1a1f24');
    quad([[r.x, r.y + r.h], [r.x + r.w, r.y + r.h], [ex + ew, ey + eh], [ex, ey + eh]], '#14181c');
    quad([[r.x, r.y], [ex, ey], [ex, ey + eh], [r.x, r.y + r.h]], '#1d2329');
    quad([[r.x + r.w, r.y], [ex + ew, ey], [ex + ew, ey + eh], [r.x + r.w, r.y + r.h]], '#171c21');
    ctx.strokeStyle = 'rgba(110,120,130,0.45)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 6; i++) {
      const f = i / 6;
      const y = r.y + r.h + (ey + eh - r.y - r.h) * f;
      ctx.beginPath();
      ctx.moveTo(r.x + (ex - r.x) * f, y);
      ctx.lineTo(r.x + r.w + (ex + ew - r.x - r.w) * f, y);
      ctx.stroke();
    }
    // Luz de emergencia apagada
    ctx.fillStyle = '#3a1512';
    ctx.beginPath();
    ctx.ellipse(r.x + r.w / 2, r.y + (ey - r.y) / 2, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Penumbra hacia el fondo
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
    // Marco con la plancha levantada arriba (franjas) y el cartel
    ctx.save();
    ctx.strokeStyle = '#4d555c';
    ctx.lineWidth = 12;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.beginPath();
    ctx.rect(r.x - 6, r.y - 26, r.w + 12, 22);
    ctx.fillStyle = '#2a3036';
    ctx.fill();
    ctx.clip();
    for (let x = r.x - 30; x < r.x + r.w + 30; x += 22) {
      ctx.fillStyle = '#c9a21f';
      ctx.beginPath();
      ctx.moveTo(x, r.y - 4);
      ctx.lineTo(x + 11, r.y - 4);
      ctx.lineTo(x + 31, r.y - 26);
      ctx.lineTo(x + 20, r.y - 26);
      ctx.fill();
    }
    ctx.restore();
    this._exitSign(ctx, next, r.x + r.w / 2, r.y - 40);
  }

  _exitSign(ctx, next, cx, cy) {
    if (!next) return;
    const name = (ROOMS[next]?.name ?? (next === 'office' ? 'Modulo de control' : next)).toUpperCase();
    ctx.save();
    ctx.font = 'bold 13px "Courier New", monospace';
    const w = ctx.measureText(name).width + 14;
    ctx.fillStyle = 'rgba(30,40,46,0.9)';
    ctx.fillRect(cx - w / 2, cy - 10, w, 20);
    ctx.fillStyle = '#c9b56a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, cx, cy);
    ctx.restore();
  }

  /**
   * Salida en una pared lateral, en perspectiva. Abierta: marco de
   * puerta con la boca de un pasillo que se aleja (rejilla en el suelo).
   * Cerrada: la compuerta por la que se ha llegado.
   */
  _sideExit(ctx, side, open, next = null) {
    const r = EXIT_SLOTS[side];
    const s = side === 'left' ? 1 : -1;
    // Trapecio: el borde exterior más alto que el interior (pared lateral)
    const outer = side === 'left' ? r.x : r.x + r.w;
    const inner = side === 'left' ? r.x + r.w : r.x;
    const pts = [[outer, r.y - 40], [inner, r.y + 30], [inner, r.y + r.h - 30], [outer, r.y + r.h + 40]];
    const path = () => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
    };
    ctx.save();
    if (open) {
      path();
      ctx.fillStyle = '#05070a';
      ctx.fill();
      ctx.clip();
      this._exitView(ctx, side, r, outer, inner, next);
    } else {
      // Compuerta cerrada (por donde se ha llegado)
      path();
      ctx.fillStyle = '#262c32';
      ctx.fill();
      ctx.clip();
      ctx.fillStyle = '#c9a21f';
      ctx.fillRect(r.x, r.y + r.h / 2 - 12, r.w, 24);
      ctx.fillStyle = '#15181b';
      for (let x = r.x; x < r.x + r.w; x += 40) ctx.fillRect(x, r.y + r.h / 2 - 12, 20, 24);
    }
    ctx.restore();
    // Marco de la compuerta (con la plancha levantada arriba si está abierta)
    ctx.save();
    path();
    ctx.strokeStyle = '#4d555c';
    ctx.lineWidth = 14;
    ctx.stroke();
    if (open) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.lineTo(pts[1][0], pts[1][1]);
      ctx.lineTo(pts[1][0], pts[1][1] + 26);
      ctx.lineTo(pts[0][0], pts[0][1] + 30);
      ctx.closePath();
      ctx.fillStyle = '#2a3036';
      ctx.fill();
      ctx.clip();
      for (let x = r.x - 40; x < r.x + r.w + 40; x += 26) {
        ctx.fillStyle = '#c9a21f';
        ctx.beginPath();
        ctx.moveTo(x, r.y + 40);
        ctx.lineTo(x + 13, r.y + 40);
        ctx.lineTo(x + 33, r.y - 50);
        ctx.lineTo(x + 20, r.y - 50);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /**
   * Lo que se ve por una salida abierta: un tramo corto de pasillo (rejilla
   * en el suelo, luz de emergencia apagada, cables, cartel) y al fondo la
   * sala siguiente con su decoración, pequeña, difuminada y más oscura.
   */
  _exitView(ctx, side, r, outer, inner, next) {
    const s = side === 'left' ? 1 : -1;
    // Boca del fondo (donde empieza la sala siguiente)
    const ew = r.w * 0.5;
    const eh = r.h * 0.56;
    const ex = (outer + inner) / 2 - ew / 2 + s * 22;
    const ey = r.y + r.h * 0.5 - eh / 2 + 8;
    // Sala siguiente al fondo
    if (next) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(ex, ey, ew, eh);
      ctx.clip();
      const k = eh / CONFIG.HEIGHT;
      ctx.translate(ex + ew / 2 - (CONFIG.WIDTH / 2) * k, ey);
      ctx.scale(k, k);
      ctx.filter = 'blur(3px)';
      this._drawFar(ctx, next);
      ctx.filter = 'none';
      ctx.restore();
      // Más lejos, más oscuro
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.fillRect(ex, ey, ew, eh);
    }
    // Tramo de pasillo: suelo, techo y paredes entre la puerta y el fondo
    const T = [[outer, r.y - 40], [inner, r.y + 30], [inner, r.y + r.h - 30], [outer, r.y + r.h + 40]];
    const E = side === 'left'
      ? [[ex, ey], [ex + ew, ey], [ex + ew, ey + eh], [ex, ey + eh]]
      : [[ex + ew, ey], [ex, ey], [ex, ey + eh], [ex + ew, ey + eh]];
    const quad = (a, b, c, d, color) => {
      ctx.beginPath();
      ctx.moveTo(...a);
      ctx.lineTo(...b);
      ctx.lineTo(...c);
      ctx.lineTo(...d);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    quad(T[0], T[1], E[1], E[0], '#1a1f24');   // techo
    quad(T[3], T[2], E[2], E[3], '#14181c');   // suelo
    quad(T[0], E[0], E[3], T[3], '#1d2329');   // pared exterior
    quad(T[1], E[1], E[2], T[2], '#171c21');   // pared interior
    // Rejilla del suelo
    ctx.strokeStyle = 'rgba(110,120,130,0.45)';
    ctx.lineWidth = 2;
    for (let k = 1; k < 8; k++) {
      const f = k / 8;
      const lx = T[3][0] + (E[3][0] - T[3][0]) * f;
      const ly = T[3][1] + (E[3][1] - T[3][1]) * f;
      const rx = T[2][0] + (E[2][0] - T[2][0]) * f;
      const ry = T[2][1] + (E[2][1] - T[2][1]) * f;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(rx, ry);
      ctx.stroke();
    }
    // Cables colgando del techo y una tubería por la pared
    ctx.strokeStyle = '#0c0f12';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo((T[0][0] + E[0][0]) / 2, (T[0][1] + E[0][1]) / 2 + 4);
    ctx.quadraticCurveTo((T[1][0] + E[0][0]) / 2, ey + 30, (T[1][0] + E[1][0]) / 2, (T[1][1] + E[1][1]) / 2 + 6);
    ctx.stroke();
    ctx.strokeStyle = '#2a333b';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(T[0][0], T[0][1] + r.h * 0.35);
    ctx.lineTo(E[0][0], E[0][1] + eh * 0.3);
    ctx.stroke();
    // Luz de emergencia apagada en el techo
    const lx = (T[0][0] + T[1][0] + E[0][0] + E[1][0]) / 4;
    const ly = (T[0][1] + T[1][1] + E[0][1] + E[1][1]) / 4 + 4;
    ctx.fillStyle = '#3a1512';
    ctx.beginPath();
    ctx.ellipse(lx, ly, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Cartel con la sala siguiente, encima de la boca del fondo
    this._exitSign(ctx, next, ex + ew / 2, ey - 16);
    // Penumbra: el pasillo se oscurece hacia el fondo
    const g = ctx.createLinearGradient(outer, 0, ex + ew / 2, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(r.x - 60, r.y - 60, r.w + 120, r.h + 120);
  }

  /**
   * La grabadora del hombre tirada en el suelo del reactor: abollada, con
   * la tapa rota y la cinta asomando; marcas de arrastre en el suelo y un
   * jirón de tela de su ropa enganchado. Sin sangre. Se dibuja con
   * Flashlight.reveal (solo se ve con la linterna).
   */
  drawRecorder(ctx) {
    const r = RECORDER;
    ctx.save();
    // Marcas de arrastre en el suelo (hacia el pasillo)
    ctx.strokeStyle = 'rgba(20,22,24,0.85)';
    ctx.lineWidth = 3;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(r.x - 260 + k * 8, r.y + 70 + k * 5);
      ctx.bezierCurveTo(r.x - 150, r.y + 40 + k * 6, r.x - 60, r.y + 64 + k * 4, r.x + 10 + k * 6, r.y + 44 + k * 3);
      ctx.stroke();
    }
    // Jirón de tela (su mono de trabajo), enganchado en un tornillo
    ctx.fillStyle = '#4a5560';
    ctx.beginPath();
    ctx.moveTo(r.x + r.w + 40, r.y + 30);
    ctx.lineTo(r.x + r.w + 95, r.y + 18);
    ctx.lineTo(r.x + r.w + 88, r.y + 46);
    ctx.lineTo(r.x + r.w + 104, r.y + 62);
    ctx.lineTo(r.x + r.w + 52, r.y + 58);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#2c333a';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#8a8f94';
    ctx.beginPath();
    ctx.arc(r.x + r.w + 46, r.y + 32, 4, 0, Math.PI * 2);
    ctx.fill();
    // La grabadora, de lado y abollada
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.rotate(-0.22);
    ctx.fillStyle = '#262a2e';
    ctx.beginPath();
    ctx.moveTo(-62, -22);
    ctx.lineTo(48, -26);
    ctx.lineTo(60, -10);       // esquina abollada
    ctx.lineTo(58, 24);
    ctx.lineTo(-60, 26);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#4b5258';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Ventanilla del casete rota, con la cinta enredada saliendo
    ctx.fillStyle = '#0d0f11';
    ctx.fillRect(-40, -14, 56, 26);
    ctx.strokeStyle = 'rgba(200,210,215,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-40, -14);
    ctx.lineTo(-18, 2);
    ctx.lineTo(-30, 12);
    ctx.moveTo(-18, 2);
    ctx.lineTo(4, -12);
    ctx.stroke();
    ctx.strokeStyle = '#3a2416';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, 12);
    ctx.bezierCurveTo(30, 40, 70, 10, 80, 40);
    ctx.bezierCurveTo(90, 60, 50, 64, 64, 30);
    ctx.stroke();
    // Botones
    ctx.fillStyle = '#5a6066';
    for (let k = 0; k < 4; k++) ctx.fillRect(22 + k * 9, -20, 7, 5);
    ctx.restore();
  }

  /**
   * Comunicaciones (CAM 10): más detalle que el resto — paneles de radio,
   * pantallas rotas, auriculares tirados, papeles y una terminal apagada
   * (el PUNTO DE LORE, LORE_TERMINAL).
   */
  _commsExtras(ctx) {
    ctx.save();
    // Paneles de radio en la pared del fondo, con diales y conmutadores
    for (let i = 0; i < 3; i++) {
      const x = 330 + i * 105;
      const y = 250 + (i % 2) * 18;
      ctx.fillStyle = '#1b2422';
      ctx.fillRect(x, y, 95, 160);
      ctx.strokeStyle = '#38463f';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, 95, 160);
      for (let k = 0; k < 2; k++) {
        ctx.fillStyle = '#4a5550';
        ctx.beginPath();
        ctx.arc(x + 28 + k * 40, y + 40, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#141a18';
        ctx.beginPath();
        ctx.moveTo(x + 28 + k * 40, y + 40);
        ctx.lineTo(x + 28 + k * 40 + Math.cos(i + k) * 12, y + 40 + Math.sin(i + k) * 12);
        ctx.stroke();
      }
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = k % 2 ? '#6b5a2a' : '#2e3833';
        ctx.fillRect(x + 12 + k * 19, y + 80, 12, 26);
      }
      ctx.strokeStyle = '#111614';
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        ctx.moveTo(x + 14, y + 120 + k * 7);
        ctx.lineTo(x + 81, y + 120 + k * 7);
        ctx.stroke();
      }
    }
    // Pantallas rotas encima de la consola: cristal astillado
    for (const [x, y] of [[520, 470], [830, 470]]) {
      ctx.strokeStyle = 'rgba(220,240,235,0.55)';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 7; k++) {
        const a = k * 0.9 + 0.3;
        ctx.beginPath();
        ctx.moveTo(x + 120, y + 55);
        ctx.lineTo(x + 120 + Math.cos(a) * 110, y + 55 + Math.sin(a) * 50);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x, y + 10, 240, 100);
    }
    // Terminal apagada (PUNTO DE LORE)
    const t = LORE_TERMINAL;
    ctx.fillStyle = '#1e2725';
    ctx.fillRect(t.x, t.y, t.w, t.h);
    ctx.fillStyle = '#050807';
    ctx.fillRect(t.x + 18, t.y + 16, t.w - 36, t.h - 50);
    ctx.strokeStyle = '#3d4a45';
    ctx.lineWidth = 4;
    ctx.strokeRect(t.x, t.y, t.w, t.h);
    ctx.fillStyle = '#2b3532';
    ctx.fillRect(t.x + 30, t.y + t.h - 26, t.w - 60, 14);
    // Auriculares tirados en el suelo, con el cable enredado
    ctx.strokeStyle = '#2f3533';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(560, 800, 46, Math.PI * 1.1, Math.PI * 1.95);
    ctx.stroke();
    ctx.fillStyle = '#20252a';
    for (const x of [516, 604]) {
      ctx.beginPath();
      ctx.ellipse(x, 806, 18, 24, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#151918';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(604, 826);
    ctx.bezierCurveTo(660, 870, 700, 790, 760, 850);
    ctx.bezierCurveTo(800, 880, 840, 830, 880, 860);
    ctx.stroke();
    // Papeles por el suelo
    [[950, 790, 0.3], [1010, 820, -0.5], [1100, 770, 0.1], [400, 840, 0.7], [470, 800, -0.2]].forEach(([x, y, a]) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = 'rgba(205,200,180,0.55)';
      ctx.fillRect(-34, -22, 68, 44);
      ctx.strokeStyle = 'rgba(60,60,60,0.5)';
      ctx.lineWidth = 1;
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        ctx.moveTo(-26, -12 + k * 7);
        ctx.lineTo(18 - (k % 2) * 14, -12 + k * 7);
        ctx.stroke();
      }
      ctx.restore();
    });
    ctx.restore();
  }

  /** Consola del reactor y el pósit con el comando (solo se lee con la linterna). */
  _reactorConsole(ctx) {
    const c = REACTOR_CONSOLE;
    ctx.save();
    ctx.fillStyle = '#1c2228';
    ctx.fillRect(c.x - 20, c.y + c.h - 10, c.w + 40, 120);
    ctx.fillStyle = '#242c33';
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = '#04100a';
    ctx.fillRect(c.x + 16, c.y + 16, c.w - 32, c.h - 56);
    ctx.fillStyle = '#323b44';
    ctx.fillRect(c.x + 30, c.y + c.h - 30, c.w - 60, 16);
    const p = POSTIT;
    ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
    ctx.rotate(0.08);
    ctx.fillStyle = '#e8d860';
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, 10);
    ctx.fillStyle = '#1a1a3a';
    ctx.font = `italic bold 17px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('/refresh', 0, 4);
    ctx.font = `italic 11px ${FONT}`;
    ctx.fillText('(enfriar)', 0, 24);
    ctx.restore();
  }

  /** Pantalla de la consola del reactor (emite luz: se dibuja ENCIMA de la oscuridad). */
  drawConsoleScreen(ctx, terminal, focused) {
    const c = REACTOR_CONSOLE;
    const x = c.x + 16;
    const y = c.y + 16;
    const w = c.w - 32;
    const h = c.h - 56;
    ctx.save();
    ctx.fillStyle = focused ? 'rgba(10,40,24,0.95)' : 'rgba(8,26,16,0.9)';
    ctx.fillRect(x, y, w, h);
    ctx.shadowColor = 'rgba(80,255,150,0.5)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#7dffb0';
    ctx.font = `14px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('REACTOR // CONTROL', x + 8, y + 6);
    ctx.shadowBlur = 0;
    terminal.lines.slice(-3).forEach((l, i) => ctx.fillText(l.slice(0, 26), x + 8, y + 30 + i * 18));
    if (focused) {
      const cursor = Math.floor(this.time * 2) % 2 ? '_' : ' ';
      ctx.fillText(`> ${terminal.input}${cursor}`.slice(0, 26), x + 8, y + h - 22);
    } else {
      ctx.fillStyle = 'rgba(125,255,176,0.6)';
      ctx.fillText('[clic para escribir]', x + 8, y + h - 22);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------
  // Fase 2: sala del reactor (iluminada) con tres pasillos
  // ---------------------------------------------------------------

  /** camX: 0 = pasillo izquierdo, 1600 = central, 3200 = derecho. */
  drawCorridors(ctx, camX) {
    CORRIDORS.forEach((id, i) => {
      const ox = i * W - camX;
      if (ox <= -W || ox >= W) return;
      ctx.save();
      ctx.translate(ox, 0);
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.clip();
      this._reactorWall(ctx, i);
      this._corridor(ctx, id);
      ctx.restore();
    });
  }

  /** Pared de la sala del reactor alrededor del pasillo: con el brillo del núcleo. */
  _reactorWall(ctx, i) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1b2733');
    g.addColorStop(1, '#0d141b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Brillo azulado del núcleo (está detrás del jugador)
    const glow = ctx.createRadialGradient(W / 2, H + 200, 100, W / 2, H + 200, 1100);
    glow.addColorStop(0, `rgba(90,190,255,${0.32 + 0.05 * Math.sin(this.time * 1.7 + i)})`);
    glow.addColorStop(1, 'rgba(90,190,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    // Tubos, paneles y franjas de peligro
    ctx.strokeStyle = '#2c3a47';
    ctx.lineWidth = 18;
    for (const x of [110, 190, 1410, 1490]) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.fillStyle = '#22303c';
    ctx.fillRect(0, 800, W, 100);
    for (let x = 0; x < W; x += 60) {
      ctx.fillStyle = '#c9a21f';
      ctx.fillRect(x, 800, 30, 14);
    }
    ctx.fillStyle = 'rgba(125,255,176,0.5)';
    for (let k = 0; k < 5; k++) ctx.fillRect(230 + k * 16, 300 + (k % 2) * 40, 8, 8);
  }

  /** Hueco del pasillo: suelo y paredes que se alejan hasta la sala del fondo. */
  _corridor(ctx, id) {
    const o = P2_OPEN;
    ctx.save();
    ctx.beginPath();
    ctx.rect(o.x, o.y, o.w, o.h);
    ctx.clip();
    ctx.fillStyle = '#0b0e11';
    ctx.fillRect(o.x, o.y, o.w, o.h);
    // La sala del fondo (la misma que en las cámaras)
    ctx.save();
    ctx.translate(P2_ROOM.x, P2_ROOM.y);
    ctx.scale(P2_ROOM.s, P2_ROOM.s);
    this.cam.drawInterior(ctx, P2_ROOMS[id]);
    ctx.restore();
    // Paredes y suelo del pasillo hasta la sala
    const rx0 = P2_ROOM.x;
    const rx1 = P2_ROOM.x + W * P2_ROOM.s;
    const ry0 = P2_ROOM.y;
    const ry1 = P2_ROOM.y + H * P2_ROOM.s;
    ctx.fillStyle = '#151b21';
    for (const [a, b, c, d] of [
      [[o.x, o.y], [rx0, ry0], [rx0, ry1], [o.x, o.y + o.h]],
      [[o.x + o.w, o.y], [rx1, ry0], [rx1, ry1], [o.x + o.w, o.y + o.h]],
    ]) {
      ctx.beginPath();
      ctx.moveTo(...a);
      ctx.lineTo(...b);
      ctx.lineTo(...c);
      ctx.lineTo(...d);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#10151a';
    ctx.beginPath();
    ctx.moveTo(o.x, o.y + o.h);
    ctx.lineTo(rx0, ry1);
    ctx.lineTo(rx1, ry1);
    ctx.lineTo(o.x + o.w, o.y + o.h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,160,170,0.25)';
    ctx.lineWidth = 3;
    for (let k = 1; k < 4; k++) {
      const f = k / 4;
      const x0 = o.x + (rx0 - o.x) * f;
      const x1 = o.x + o.w + (rx1 - o.x - o.w) * f;
      const y0 = o.y + (ry0 - o.y) * f;
      const y1 = o.y + o.h + (ry1 - o.y - o.h) * f;
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    }
    ctx.restore();
    // Marco del hueco y el cartel
    ctx.strokeStyle = '#3e464d';
    ctx.lineWidth = 30;
    ctx.strokeRect(o.x - 15, o.y - 15, o.w + 30, o.h + 30);
    ctx.fillStyle = '#c9a21f';
    ctx.font = `bold 22px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`→ ${CORRIDOR_LABEL[id]}`, W / 2, o.y - 46);
  }

  /** Panel de la consola del reactor (Fase 2): porcentaje de enfriamiento. */
  drawCoolingPanel(ctx, progress, anim, total) {
    if (anim <= 0) return;
    const y = H * (1 - anim);
    ctx.save();
    ctx.translate(0, y);
    ctx.fillStyle = '#05080a';
    ctx.fillRect(40, 0, W - 80, H);
    ctx.strokeStyle = '#1f252d';
    ctx.lineWidth = 10;
    ctx.strokeRect(40, 0, W - 80, H);
    if (anim >= 1) {
      ctx.fillStyle = '#7dffb0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold 34px ${FONT}`;
      ctx.fillText('REACTOR // ENFRIAMIENTO DE EMERGENCIA', W / 2, 200);
      ctx.font = `bold 150px ${FONT}`;
      ctx.fillText(`${Math.floor(progress * 100)} %`, W / 2, 420);
      ctx.strokeStyle = '#7dffb0';
      ctx.lineWidth = 4;
      ctx.strokeRect(300, 560, 1000, 50);
      ctx.fillRect(306, 566, 988 * progress, 38);
      ctx.font = `22px ${FONT}`;
      ctx.fillStyle = 'rgba(125,255,176,0.7)';
      const left = Math.max(0, Math.ceil((1 - progress) * total));
      ctx.fillText(`Tiempo estimado: ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, W / 2, 660);
      ctx.fillText('Mientras miras la consola no ves los pasillos', W / 2, 720);
    }
    ctx.restore();
  }

  /** Pestaña para abrir/cerrar la consola (como la del monitor de cámaras). */
  drawConsoleTab(ctx, open) {
    const r = CONSOLE_TAB;
    ctx.save();
    ctx.fillStyle = 'rgba(10,30,20,0.85)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = '#7dffb0';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = '#7dffb0';
    ctx.font = `bold 20px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(open ? '▼  VOLVER A LOS PASILLOS  (C)' : '▲  CONSOLA DEL REACTOR  (C)', r.x + r.w / 2, r.y + r.h / 2);
    ctx.restore();
  }

  // ---------------------------------------------------------------
  // Interfaz común
  // ---------------------------------------------------------------

  drawHint(ctx, text, msg) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (msg) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(W / 2 - 330, 60, 660, 56);
      ctx.fillStyle = '#e8eef5';
      ctx.font = `bold 26px ${FONT}`;
      ctx.fillText(msg, W / 2, 88);
    }
    if (text) {
      ctx.fillStyle = 'rgba(232,238,245,0.55)';
      ctx.font = `17px ${FONT}`;
      ctx.fillText(text, W / 2, 24);
    }
    ctx.restore();
  }
}
