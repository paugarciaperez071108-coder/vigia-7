// =============================================================
// CameraView.js — Imagen de las cámaras y minimapa.
//
// Cada sala se dibuja con una función propia (ROOM_DRAWERS) sobre
// una "caja" en perspectiva de un punto: pared del fondo, suelo,
// techo y paredes laterales. Encima se aplican los efectos de
// cámara de seguridad: tinte, estática, banda de interferencia,
// viñeta y rótulos.
//
// Si existe una imagen propia en assets (clave cam_<sala>), se usa
// en lugar del dibujo procedural (ver Sprites.js).
//
// Noches con conductos: botón TOGGLE (arriba del mapa) para cambiar
// entre el mapa de salas y el de ventilación (dibujo en VentView.js).
// En cada sala se ve su entrada de conducto (la que golpea El Largo)
// y el botón de GOLPES METÁLICOS; en los conductos, el de INSECTICIDA.
// =============================================================

import { CONFIG } from '../config.js';
import { ROOMS, LINKS, LINK_PATHS, OFFICE_RECT, ROOM_IDS, VENTS, VENT_IDS, isVent } from '../world/StationMap.js';
import { Random } from '../core/Random.js';
import { drawCreature, drawFace } from './CreatureArt.js';
import { drawDuct, makeVentDecor, ductPoint, drawVentMap, drawDuctEntrance } from './VentView.js';
import { NIGHT2 } from '../night/night2.js';
import { NIGHT3 } from '../night/night3.js';
import { NIGHT4 } from '../night/night4.js';
import { drawSlaimi } from '../systems/Slaimi.js';
import { Dust, glitchSlices } from './Atmosphere.js';
import { CamPoses, progressOf, NEARNESS } from './CamPoses.js';

export const MONITOR_TAB = { x: 560, y: 846, w: 480, h: 42 };

// Panel de temperatura de El Congelado (CAM 05)
const CRYO_PANEL = { x: 1150, y: 120, w: 330, h: 310 };
const CRYO_UP = { x: 1396, y: 150, w: 66, h: 66 };
const CRYO_DOWN = { x: 1396, y: 228, w: 66, h: 66 };
// Enfriamiento del reactor (CAM 04)
const COOL_PANEL = { x: 1150, y: 120, w: 330, h: 310 };
const COOL_BUTTON = { x: 1170, y: 300, w: 290, h: 70 };
// Muro de contención del laboratorio (CAM 02)
const LAB_WALL = { x: 800, y: 262, w: 230, h: 338 };
// Botón TOGGLE (mapa de salas ↔ ventilación), en la cabecera del mapa
const TOGGLE_BUTTON = { x: 1404, y: 452, w: 158, h: 32 };
// Botón de acción de la cámara: GOLPES METÁLICOS (salas) o INSECTICIDA (conductos)
const ACTION_PANEL = { x: 560, y: 742, w: 480, h: 96 };
const ACTION_BUTTON = { x: 790, y: 754, w: 236, h: 72 };

// Entrada de conducto de cada sala (x, y, w, h: rejilla en la imagen de
// la cámara) y dónde se pone El Largo cuando la golpea (lx, ly: pies).
// Solo salas: los pasillos no tienen. Casi todas aprovechan la rejilla
// que ya había en la pared izquierda.
const DUCT_SPOTS = {
  hangar: { x: 330, y: 300, w: 120, h: 80, lx: 520, ly: 660 },
  lab: { x: 300, y: 290, w: 120, h: 80, lx: 470, ly: 660 },
  greenhouse: { x: 70, y: 300, w: 120, h: 80, lx: 270, ly: 640 },
  reactor: { x: 60, y: 450, w: 130, h: 80, lx: 290, ly: 690 },
  cryo: { x: 80, y: 320, w: 120, h: 80, lx: 290, ly: 690 },
  mess: { x: 70, y: 330, w: 120, h: 80, lx: 280, ly: 650 },
  medbay: { x: 450, y: 430, w: 100, h: 70, lx: 620, ly: 700 },
  comms: { x: 70, y: 300, w: 120, h: 80, lx: 270, ly: 650 },
};
const LARGO_HEIGHT = 300;

// Dónde se colocan las criaturas en cada cámara: [x, y del suelo, altura].
// Si hay varias en la misma sala, cada una ocupa un hueco.
const ANCHORS = {
  hangar: [[430, 700, 300], [760, 640, 240], [980, 660, 260]],
  lab: [[900, 650, 250], [420, 720, 290], [660, 700, 270]],
  greenhouse: [[640, 610, 230], [880, 620, 230], [420, 720, 290]],
  reactor: [[560, 650, 250], [960, 650, 250], [420, 760, 300]],
  cryo: [[650, 680, 240], [960, 680, 240], [420, 780, 300]],
  mess: [[620, 620, 220], [880, 620, 220], [400, 770, 300]],
  westHall: [[800, 520, 160], [690, 640, 270], [910, 720, 340]],
  eastHall: [[800, 520, 160], [910, 640, 270], [690, 720, 340]],
  medbay: [[560, 690, 250], [880, 660, 230], [400, 780, 300]],
  comms: [[640, 650, 230], [900, 650, 230], [420, 770, 300]],
};
// El Largo es más alto que el resto; El Insecto, bajo y alargado
const KIND_SCALE = { specimen: 1, largo: 1.35, insecto: 0.75, frozen: 1.1 };

// Postura de cada enemigo en cada cámara (como los animatrónicos de FNaF:
// en cada cámara se le ve de una forma distinta). Las posturas están en
// CreatureArt.js; si una cámara no aparece, se usa la postura por defecto.
const POSES = {
  // Ruta A: invernadero → corredor oeste → comedor; ruta B: reactor →
  // invernadero → comunicaciones → corredor este. Sale por el laboratorio.
  specimen: { lab: 'crouch', greenhouse: 'lean', reactor: 'ceiling', mess: 'stand', comms: 'front', westHall: 'hall', eastHall: 'hall' },
  // Corre de la criogenia a la oficina por la enfermería
  frozen: { cryo: 'leap', medbay: 'crawl', reactor: 'run', mess: 'leap', comms: 'run', westHall: 'front', eastHall: 'front' },
  // Siempre golpeando la entrada del conducto: de pie con un brazo, con
  // los dos o de rodillas (rejillas bajas)
  largo: { hangar: 'hit', lab: 'claw', greenhouse: 'hit', reactor: 'kneel', cryo: 'claw', mess: 'hit', medbay: 'kneel', comms: 'claw' },
  insecto: { v1: 'rear', v2: 'crawl', v3: 'ceiling', v4: 'coiled', v5: 'crawl', v6: 'reach', v7: 'reach' },
};
// Salas donde El Largo gira la cabeza hacia la cámara mientras golpea
const LARGO_LOOKS = ['hangar', 'cryo', 'medbay'];
// Altura del techo (y en pantalla) para la postura 'ceiling' en las salas
const CEILING_Y = { reactor: 190 };

const DOOR_POINTS = {
  left_door: { x: OFFICE_RECT.x, y: OFFICE_RECT.y + 64 },
  right_door: { x: OFFICE_RECT.x, y: OFFICE_RECT.y + 20 },
};

// Detalles de nave espacial de cada sala (se dibujan encima de la
// sala y debajo de la suciedad). Tipos:
//   pipe     [y, x1, x2, grosor]          tubería horizontal con juntas
//   vent     [x, y, w, h]                 rejilla de ventilación
//   beacon   [x, y]                       luz de emergencia giratoria
//   porthole [x, y, radio]                ojo de buey con estrellas
//   stencil  [texto, x, y]                rótulo pintado y gastado
//   hazard   [x, y, w, h]                 franja de peligro
// Las posiciones evitan el minimapa, los paneles y las criaturas.
const SHIP_DETAILS = {
  hangar: [
    ['pipe', 24, 0, 1600, 16], ['beacon', 1460, 70], ['beacon', 140, 70],
    ['porthole', 190, 420, 62], ['vent', 1330, 520, 130, 70],
    ['stencil', 'MODULO H-2 // CARGA', 800, 168], ['hazard', 300, 632, 1000, 12],
  ],
  lab: [
    ['pipe', 22, 0, 1600, 14], ['pipe', 48, 0, 1600, 8], ['beacon', 1460, 70],
    ['porthole', 170, 360, 56], ['vent', 1210, 270, 150, 80],
    ['stencil', 'BIOCONTENCION NIVEL 4', 1285, 240], ['hazard', 790, 600, 250, 12],
  ],
  greenhouse: [
    ['pipe', 30, 0, 1600, 14], ['beacon', 150, 70], ['porthole', 1440, 340, 64],
    ['vent', 70, 300, 120, 80], ['stencil', 'O2 // CULTIVO HIDROPONICO', 800, 200],
  ],
  reactor: [
    ['beacon', 120, 70], ['beacon', 1500, 60], ['vent', 60, 470, 130, 90],
    ['stencil', 'NUCLEO // SOLO PERSONAL', 800, 150], ['hazard', 470, 640, 660, 14],
  ],
  cryo: [
    ['pipe', 26, 0, 1600, 16], ['beacon', 110, 70], ['vent', 80, 320, 120, 80],
    ['stencil', 'CRIOGENIA // -196 C', 800, 205], ['hazard', 420, 620, 760, 10],
  ],
  mess: [
    ['pipe', 24, 0, 1600, 12], ['beacon', 150, 70], ['porthole', 1450, 210, 58],
    ['vent', 70, 330, 120, 80], ['stencil', 'COMEDOR // TURNO C', 800, 222],
  ],
  westHall: [
    ['beacon', 90, 110], ['beacon', 1510, 110], ['porthole', 150, 430, 52],
    ['vent', 1400, 380, 110, 90], ['stencil', 'SECTOR 3-O', 800, 760], ['hazard', 300, 840, 1000, 14],
  ],
  eastHall: [
    ['beacon', 90, 110], ['beacon', 1510, 110], ['porthole', 1450, 430, 52],
    ['vent', 90, 380, 110, 90], ['stencil', 'SECTOR 3-E', 800, 760], ['hazard', 300, 840, 1000, 14],
  ],
  medbay: [
    ['pipe', 26, 0, 1600, 12], ['beacon', 1470, 70],
    ['stencil', 'ENFERMERIA // SECTOR 2', 800, 205],
  ],
  comms: [
    ['pipe', 24, 0, 1600, 14], ['beacon', 1460, 70], ['vent', 70, 300, 120, 80],
    ['porthole', 1440, 330, 56], ['stencil', 'ENLACE ORBITAL', 800, 214],
  ],
};

const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

// Tinte de cada cámara (da personalidad a cada sala).
const TINTS = {
  hangar: '200,170,90', lab: '90,200,140', greenhouse: '170,90,200', reactor: '80,170,230',
  cryo: '150,210,255', mess: '220,190,140', westHall: '160,170,180', eastHall: '160,170,180',
  medbay: '170,215,200', comms: '100,220,180',
  // Conductos: todos el mismo tono (laberinto)
  v1: '150,165,140', v2: '150,165,140', v3: '150,165,140', v4: '150,165,140', v5: '150,165,140',
  v6: '150,165,140', v7: '150,165,140',
};

export class CameraView {
  constructor(sprites) {
    this.sprites = sprites;
    this.poses = new CamPoses(sprites);   // poses hechas para cada cámara (3D)
    this.near = 0;                        // lo cerca de la lente que está el enemigo visible (0..1)
    // Rejillas de conducto reales de las salas (modelo 3D): sustituyen a las de DUCT_SPOTS
    fetch('assets/salas/salidas.json').then((r) => (r.ok ? r.json() : {})).then((d) => {
      for (const [room, r] of Object.entries(d._rejillas ?? {})) {
        if (DUCT_SPOTS[room]) Object.assign(DUCT_SPOTS[room], r);   // (salidas.json solo existe con las salas 3D)
      }
    }).catch(() => {});
    this.time = 0;
    const rng = new Random(42);
    // Hojas del invernadero precalculadas (si no, "bailarían").
    this.leaves = Array.from({ length: 70 }, () => ({
      row: rng.int(0, 2), u: rng.next(), r: rng.range(10, 26), shade: rng.range(0.5, 1),
    }));
    // Decoración de abandono por sala (manchas, cables, escombros),
    // generada una vez con una semilla distinta para cada sala.
    this.decor = {};
    ROOM_IDS.forEach((id, i) => { this.decor[id] = makeDecor(new Random(1000 + i * 77)); });
    // Grietas del muro del laboratorio: una lista de trazos por etapa.
    this.cracks = makeCracks(new Random(5));
    // Conductos: detalles fijos de cada uno y nubes de insecticida
    this.ventDecor = {};
    for (const id of VENT_IDS) this.ventDecor[id] = makeVentDecor(id);
    this.clouds = {};     // { conducto: segundos que le quedan a la nube }
    // Polvo flotando en cada cámara
    this.dust = {};
    [...ROOM_IDS, ...VENT_IDS].forEach((id, i) => { this.dust[id] = new Dust(300 + i * 13, 60); });
    // Escarcha de la lente de la CAM 05 (cristales que crecen desde los bordes)
    this.lensFrost = makeLensFrost(new Random(9));
    this.clockElapsed = 0;
    // Noche 2 en adelante: la nave está peor (más destrozos por sala)
    this.nightLevel = 1;
    this.worse = {};
    ROOM_IDS.forEach((id, i) => { this.worse[id] = makeWorse(new Random(2000 + i * 31)); });
    // Color del núcleo del reactor: 0 = frío (azul), 1 = al límite (rojo)
    this.reactorHeat = 0.1;
    // Lienzo auxiliar para la sombra de El Largo en la pared
    this.shadowCanvas = document.createElement('canvas');
    this.shadowCanvas.width = CONFIG.WIDTH;
    this.shadowCanvas.height = CONFIG.HEIGHT;
    this.shadowCtx = this.shadowCanvas.getContext('2d');
  }

  update(dt) {
    this.time += dt;
    this.poses.update(dt);
    for (const d of Object.values(this.dust)) d.update(dt);
    for (const id of Object.keys(this.clouds)) {
      this.clouds[id] -= dt;
      if (this.clouds[id] <= 0) delete this.clouds[id];
    }
  }

  /**
   * La sala vista "desde dentro" (final de la noche 2): el mismo dibujo
   * de su cámara, sin la interfaz (etiquetas, mapa, REC, estática).
   */
  drawInterior(ctx, room, far = false) {
    // Solo se usa en el final de la noche 2 (nave destrozada). Las salas
    // lejanas (al fondo de una salida, pequeñas y borrosas) no llevan los
    // destrozos extra: no se distinguirían y cuestan rendimiento.
    this.nightLevel = far ? 1 : 2;
    if (this.sprites.draw(ctx, `cam_${room}`, 0, 0, CONFIG.WIDTH, CONFIG.HEIGHT)) return;
    (ROOM_DRAWERS[room] ?? genericRoom).call(this, ctx, this.time);
    drawShipDetails(ctx, SHIP_DETAILS[room], this.time);
    this._decorate(ctx, room);
  }

  /** Nube de insecticida en un conducto (se ve unos segundos). */
  sprayCloud(ventId) {
    this.clouds[ventId] = NIGHT2.GAS.CLOUD_TIME;
  }

  /**
   * ¿Qué hay bajo (x, y)? Una cámara del mapa, la pestaña, o un
   * control de la cámara activa (flechas de temperatura, barras).
   */
  hitTest(x, y, cameras) {
    const activeRoom = cameras.active;
    if (cameras.hasVents && inside(TOGGLE_BUTTON, x, y)) return { type: 'toggle' };
    if (inside(MONITOR_TAB, x, y)) return { type: 'monitor' };
    if (cameras.mapMode === 'vent') {
      for (const [id, v] of Object.entries(VENTS)) {
        if (inside(v.mapRect, x, y)) return { type: 'cam', id };
      }
      if (cameras.ventsUnlocked && NIGHT2.GAS.VENTS.includes(activeRoom) && inside(ACTION_BUTTON, x, y)) return { type: 'gas' };
      return null;
    }
    for (const [id, room] of Object.entries(ROOMS)) {
      if (inside(room.mapRect, x, y)) return { type: 'cam', id };
    }
    if (cameras.hasLure && inside(ACTION_BUTTON, x, y)) return { type: 'lure' };
    if (activeRoom === 'cryo') {
      if (inside(CRYO_UP, x, y)) return { type: 'cryo', dir: 1 };
      if (inside(CRYO_DOWN, x, y)) return { type: 'cryo', dir: -1 };
    }
    if (activeRoom === 'reactor' && inside(COOL_BUTTON, x, y)) return { type: 'cool' };
    return null;
  }

  /**
   * Dibuja el monitor. Mientras sube o baja (anim entre 0 y 1) se
   * ve la carcasa negra deslizándose; con anim = 1, la imagen.
   */
  draw(ctx, cameras, effects, scene) {
    if (!cameras.fullyOpen) {
      // Carcasa del monitor subiendo desde abajo
      const y = CONFIG.HEIGHT * (1 - cameras.anim);
      ctx.fillStyle = '#07090c';
      ctx.fillRect(40, y, CONFIG.WIDTH - 80, CONFIG.HEIGHT);
      ctx.strokeStyle = '#1f252d';
      ctx.lineWidth = 10;
      ctx.strokeRect(40, y, CONFIG.WIDTH - 80, CONFIG.HEIGHT);
      return;
    }

    const room = cameras.active;
    this.clockElapsed = scene.clockElapsed ?? 0;
    this.nightLevel = scene.night ?? 1;
    if (scene.reactor) this.reactorHeat = scene.reactor.level / 100;
    // Noche 4, ruta B, 6:00 (Night4Dark): la escena dibuja la imagen ella misma
    // (batería de emergencia, la retirada, El Errante); la interfaz, la de siempre
    if (scene.feed && ROOMS[room]) {
      scene.feed(ctx, room);
      this._drawLabels(ctx, room);
      this._drawMinimap(ctx, room, cameras, scene);
      this._drawTab(ctx, '▼  BAJAR MONITOR  (Espacio)');
      return;
    }
    if (isVent(room)) {
      this._drawVentCam(ctx, cameras, effects, scene);
      return;
    }
    if (!ROOMS[room]) {
      // Cámara desconocida: en vez de fallar, "sin señal" y el mapa para cambiar
      ctx.fillStyle = '#050607';
      ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
      effects.static(ctx, 0.5);
      ctx.fillStyle = '#e8eef5';
      ctx.font = 'bold 44px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SIN SEÑAL', 520, 450);
      this._drawMinimap(ctx, room);
      this._drawTab(ctx, '▼  BAJAR MONITOR  (Espacio)');
      return;
    }
    if (cameras.broken?.has(room)) {
      // Rota por El Largo (evento de las 3 AM): sin imagen hasta el final de la noche.
      // Noche 4, ruta A, 3 AM: en su lugar, las grabaciones de hace una semana
      if (scene.hallu?.has(room)) {
        scene.hallu.draw(ctx, room, effects);
        this._drawLabels(ctx, room, { live: false });
      } else this._drawBroken(ctx, room, effects);
      // Los controles de la CAM 04 (enfriar) y la CAM 05 (temperatura) no
      // dependen de la imagen: siguen visibles y usables encima de la estática
      if (room === 'cryo') this._drawCryoPanel(ctx, scene.cryo, scene.frozen);
      if (room === 'reactor') this._drawCoolPanel(ctx, scene.reactor);
      if (cameras.hasLure) this._drawLurePanel(ctx, room, scene.lureCooldown, scene, true);
      this._drawMinimap(ctx, cameras.active, cameras, scene);
      if (cameras.hasVents) this._drawToggle(ctx, 'main');
      this._drawTab(ctx, '▼  BAJAR MONITOR  (Espacio)');
      return;
    }
    ctx.save();
    // Pequeño temblor de la imagen, como una señal inestable (más fuerte
    // con un enemigo pegado a la lente)
    const P = CONFIG.CAM_POSES;
    if (Math.random() < 0.03 + 0.3 * this.near) ctx.translate((Math.random() - 0.5) * (8 + P.NEAR_SHAKE * 2 * this.near), (Math.random() - 0.5) * P.NEAR_SHAKE * this.near);
    this.near = 0;
    // CAM 02: una imagen por fase del muro de contención (tools/3d/salas/muro_lab.py)
    const labKey = room === 'lab' ? this._labWallKey(scene.specimen) : null;
    if (!this.sprites.draw(ctx, labKey ?? `cam_${room}`, 0, 0, CONFIG.WIDTH, CONFIG.HEIGHT)) {
      // Si una sala no tiene dibujo propio, se usa una sala genérica
      (ROOM_DRAWERS[room] ?? genericRoom).call(this, ctx, this.time);
      drawShipDetails(ctx, SHIP_DETAILS[room], this.time);
      this._decorate(ctx, room);
    }
    if (room === 'lab' && !labKey) this._drawLabWall(ctx, scene.specimen);   // (sin renders 3D: el dibujo 2D)
    if (room === 'cryo') this._drawCryoPod(ctx, scene.frozen);
    // Entrada de conducto de la sala (noches con conductos)
    // (en las salas 3D la rejilla ya está en el render, con su conducto detrás)
    if (cameras.hasVents && DUCT_SPOTS[room] && !this.sprites.has(`cam_${room}`)) {
      const largo = scene.largo;
      const stage = largo?.state === 'room' && largo.room === room ? largo.breakStage : 0;
      drawDuctEntrance(ctx, DUCT_SPOTS[room], stage, NIGHT2.LARGO.BREAK_STAGES, this.time);
    }
    this._drawCreatures(ctx, room, scene.roamers);
    if (scene.slaimiDead && room === NIGHT4.SLAIMI.DEAD_CAM) drawSlaimi(ctx, 1010, 800, 120, { dead: true, sprites: this.sprites });
    if (cameras.breaking?.[room]) {
      // El Largo, pegado a la lente, la está rompiendo a golpes
      this.poses.draw(ctx, 'largo', room, 'cerca', this.time);
      this.near = 1;
      ctx.translate((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 18);
    }
    this.dust[room]?.draw(ctx, { alpha: 0.4, lights: [{ x: 800, y: 260, r: 760 }] });
    ctx.restore();

    this._postProcess(ctx, room, cameras.switchStatic, effects);
    this._poseEffects(ctx, effects);
    if (cameras.breaking?.[room]) {
      effects.static(ctx, 0.22 + Math.random() * 0.2);
      glitchSlices(ctx, 1);
    }
    if (room === 'cryo') this._drawLensFrost(ctx, scene.cryo, scene.frozen);
    this._drawLabels(ctx, room);
    // Paneles de control (se ven nítidos, encima de la imagen)
    if (room === 'cryo') this._drawCryoPanel(ctx, scene.cryo, scene.frozen);
    if (room === 'reactor') this._drawCoolPanel(ctx, scene.reactor);
    if (cameras.hasLure) this._drawLurePanel(ctx, room, scene.lureCooldown, scene);
    this._drawMinimap(ctx, cameras.active, cameras, scene);
    if (cameras.hasVents) this._drawToggle(ctx, 'main');
    this._drawTab(ctx, '▼  BAJAR MONITOR  (Espacio)');
  }

  // ---------------------------------------------------------------
  // Conductos de ventilación (noche 2+)
  // ---------------------------------------------------------------

  _drawVentCam(ctx, cameras, effects, scene) {
    const id = cameras.active;
    if (cameras.broken?.has(id)) {
      // Sin señal desde las 3 AM de la noche 3: el insecticida se suelta a ciegas
      this._drawBroken(ctx, id, effects);
      if (NIGHT2.GAS.VENTS.includes(id)) this._drawGasPanel(ctx, scene.gas);
    } else if (!cameras.ventsUnlocked) {
      // Sin señal hasta escribir get-update en la consola
      ctx.fillStyle = '#050607';
      ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
      effects.static(ctx, 0.6);
      ctx.fillStyle = '#ffb050';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 48px "Courier New", monospace';
      ctx.fillText('SIN SEÑAL', 520, 400);
      ctx.font = '24px "Courier New", monospace';
      ctx.fillText(`Actualiza el sistema: ${NIGHT2.UPDATE_COMMAND}`, 520, 460);
      ctx.fillText('(baja el monitor y usa la consola)', 520, 494);
      this._drawLabels(ctx, id);
    } else {
      ctx.save();
      if (Math.random() < 0.03) ctx.translate((Math.random() - 0.5) * 8, 0);
      if (!this.sprites.draw(ctx, `cam_${id}`, 0, 0, CONFIG.WIDTH, CONFIG.HEIGHT)) {
        drawDuct(ctx, this.ventDecor[id], this.time);
      }
      // El Insecto, agazapado en el suelo del conducto (en V6/V7, cada
      // vez más cerca de la cámara mientras se prepara para entrar)
      if (scene.insect?.state === 'vent' && scene.insect.room === id && this.poses.has('insecto', id)) {
        // Pose 3D del conducto: más cerca cuanto más cerca de la oficina; pegado
        // a la lente cuando está a punto de entrar (V6/V7)
        const ins = scene.insect;
        const prog = { v4: 0.15, v5: 0.15, v2: 0.35, v3: 0.35, v1: 0.6, v6: 0.85, v7: 0.85 }[id] ?? 0.5;
        const pose = this.poses.pick('insecto', id, prog, ins.enterIn !== null ? 'cerca' : null);
        this.poses.draw(ctx, 'insecto', id, pose, this.time);
        this.near = Math.max(this.near, NEARNESS[pose] ?? 0);
      } else if (scene.insect?.state === 'vent' && scene.insect.room === id) {
        const ins = scene.insect;
        const k = ins.enterIn !== null ? 1 - ins.enterIn / NIGHT2.INSECTO.ENTER_TIME : 0;
        const pose = POSES.insecto[id];
        // En el techo se agarra a la plancha de arriba (se dibuja boca abajo)
        const [x, y] = ductPoint(0.12, pose === 'ceiling' ? -1 : 1, 2.3 - 0.6 * k);
        drawCreature(ctx, 'insecto', x - 90, y, 330 * (1 + 0.35 * k), this.time, { alpha: 0.95, pose });
      }
      // Nube de insecticida
      if (this.clouds[id]) {
        const k = this.clouds[id] / NIGHT2.GAS.CLOUD_TIME;
        for (let i = 0; i < 6; i++) {
          const cx = 800 + Math.sin(this.time * 1.3 + i * 2) * 220;
          const cy = 470 + Math.cos(this.time + i) * 120;
          const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, 260);
          g.addColorStop(0, `rgba(190,210,120,${0.35 * k})`);
          g.addColorStop(1, 'rgba(190,210,120,0)');
          ctx.fillStyle = g;
          ctx.fillRect(cx - 260, cy - 260, 520, 520);
        }
      }
      this.dust[id]?.draw(ctx, { alpha: 0.3, color: '200,210,190', lights: [{ x: 800, y: 470, r: 600 }] });
      ctx.restore();
      this._postProcess(ctx, id, cameras.switchStatic, effects);
      this._poseEffects(ctx, effects);
      this._drawLabels(ctx, id);
      // El insecticida solo se puede soltar en V6 y V7
      if (NIGHT2.GAS.VENTS.includes(id)) this._drawGasPanel(ctx, scene.gas);
    }
    drawVentMap(ctx, id, cameras.ventsUnlocked);
    if (cameras.warnings && warningsVisible(cameras) && scene.insect?.state === 'vent') {
      // El Insecto en el plano de los conductos (triángulo ⚠)
      this._drawWarnings(ctx, [scene.insect], (v) => VENTS[v] && { x: VENTS[v].mapRect.x + VENTS[v].mapRect.w - 13, y: VENTS[v].mapRect.y + 13 });
    }
    this._drawToggle(ctx, 'vent');
    this._drawTab(ctx, '▼  BAJAR MONITOR  (Espacio)');
  }

  /** Botón TOGGLE en la cabecera del mapa. */
  _drawToggle(ctx, mode) {
    const r = TOGGLE_BUTTON;
    ctx.save();
    ctx.fillStyle = mode === 'vent' ? '#7dffb0' : 'rgba(20,40,30,0.9)';
    ctx.strokeStyle = '#7dffb0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = mode === 'vent' ? '#06120b' : '#bfffd6';
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(mode === 'vent' ? 'TOGGLE: SALAS (Tab)' : 'TOGGLE: VENT (Tab)', r.x + r.w / 2, r.y + r.h / 2 + 1);
    ctx.restore();
  }

  /** Panel con un botón grande, título y líneas de estado. */
  _actionPanel(ctx, title, button, lines, ready) {
    const p = ACTION_PANEL;
    const b = ACTION_BUTTON;
    ctx.save();
    ctx.fillStyle = 'rgba(5,8,10,0.85)';
    ctx.strokeStyle = 'rgba(120,255,170,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.w, p.h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(120,255,170,0.8)';
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, p.x + 14, p.y + 12);
    ctx.font = '13px "Courier New", monospace';
    lines.forEach((l, i) => ctx.fillText(l, p.x + 14, p.y + 38 + i * 18));
    ctx.fillStyle = ready ? '#1f4a33' : '#1a1d1b';
    ctx.strokeStyle = ready ? '#7dffb0' : '#4a524d';
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = ready ? '#d8ffe8' : '#7d857f';
    ctx.font = `bold ${button.length > 14 ? 16 : 19}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(button, b.x + b.w / 2, b.y + b.h / 2);
    ctx.restore();
  }

  _drawLurePanel(ctx, room, cooldown, scene = {}, broken = false) {
    // Noche 3+: El Largo va por el oído (audio que le atrae hacia esta sala)
    const oido = scene.largo?.mode === 'oido';
    const max = scene.lureMax ?? NIGHT2.LARGO.LURE_COOLDOWN;
    // En una cámara rota el altavoz sigue funcionando (se elige la sala en el plano)
    const ready = cooldown <= 0;
    let label = ready ? (oido ? '▶ AUDIO  (G)' : '▶ GOLPES  (G)') : `RECARGANDO ${Math.ceil(cooldown)} s`;
    if (!ready && cooldown > max - 1.5) label = '▶ EMITIENDO...';
    this._actionPanel(ctx, oido ? 'AUDIO SEÑUELO' : 'GOLPES METALICOS', label, [
      `En: ${ROOMS[room].name}`,
      broken ? 'Camara rota: altavoz OK' : oido ? 'Le atrae hacia aqui' : 'Echa lo de una sala vecina',
    ], ready);
  }

  /** Cámara rota (evento de las 3 AM de la noche 3): estática y SIN SEÑAL. */
  _drawBroken(ctx, room, effects) {
    ctx.fillStyle = '#040505';
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    effects.static(ctx, 0.55);
    if (Math.random() < 0.08) glitchSlices(ctx, 0.6);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff5a4a';
    ctx.font = 'bold 52px "Courier New", monospace';
    ctx.fillText('SIN SEÑAL', 520, 400);
    ctx.font = '24px "Courier New", monospace';
    ctx.fillStyle = '#e8b0a8';
    ctx.fillText('CAMARA DAÑADA', 520, 456);
    ctx.fillText('Guiate por los avisos del plano', 520, 490);
    ctx.restore();
    this._drawLabels(ctx, room);
  }

  _drawGasPanel(ctx, gas) {
    const ready = gas.canSpray;
    const label = gas.active ? 'BLOQUEADO: FUGA' : ready ? '▶ INSECTICIDA  (G)' : `RECARGANDO ${Math.ceil(gas.cooldown)} s`;
    this._actionPanel(ctx, 'INSECTICIDA', label, [
      `Soltadas: ${gas.uses}`,
      'Gas en este conducto',
    ], ready);
  }

  // ---------------------------------------------------------------
  // Criaturas en cámara
  // ---------------------------------------------------------------

  /** Más estática, fallos de imagen y distorsión con un enemigo cerca de la lente. */
  _poseEffects(ctx, effects) {
    const P = CONFIG.CAM_POSES;
    const g = this.poses.glitch / P.GLITCH_TIME;
    if (this.near > 0 || g > 0) effects.static(ctx, P.NEAR_STATIC * this.near + 0.35 * g);
    if (g > 0) glitchSlices(ctx, 0.6 * g + 0.2);
    else if (this.near >= 1 && Math.random() < 0.06) glitchSlices(ctx, 0.5);
  }

  _drawCreatures(ctx, room, roamers) {
    // Enemigos con poses 3D hechas para esta cámara: su pose (según su avance)
    const posed = roamers.filter((e) => e.room === room && this.poses.has(e.id, room));
    for (const e of posed) {
      // El Largo de la noche 3 enseña su fase (lejos / media / cerca)
      const pose = this.poses.pick(e.id, room, progressOf(e), e.camPose ?? null);
      if (pose && this.poses.draw(ctx, e.id, room, pose, this.time)) this.near = Math.max(this.near, NEARNESS[pose] ?? 0);
    }
    const here = roamers.filter((e) => e.room === room && !posed.includes(e));
    // El Largo, de pie junto a la entrada de conducto que golpea
    const largo = here.find((e) => e.id === 'largo');
    const spot = DUCT_SPOTS[room];
    if (largo && spot) {
      const hit = Math.max(0, Math.sin(this.time * 9)) * 6 * Math.min(1, largo.breakStage);
      const h = LARGO_HEIGHT * KIND_SCALE.largo;
      const u = h / 100;
      // La rejilla que golpea, relativa a sus pies (en unidades de altura)
      const target = { x: (spot.x + spot.w / 2 - spot.lx) / u, y: (spot.y + spot.h / 2 - spot.ly) / u };
      const opts = { alpha: 0.92, pose: POSES.largo[room], target, look: LARGO_LOOKS.includes(room) };
      // Su sombra, enorme, en la pared (la luz está baja y delante de él)
      this._wallShadow(ctx, spot.lx - hit, spot.ly, (c) => drawCreature(c, 'largo', spot.lx - hit, spot.ly, h, this.time, opts));
      drawCreature(ctx, 'largo', spot.lx - hit, spot.ly, h, this.time, opts);
    }
    here.filter((e) => !(e === largo && spot)).forEach((e, i) => {
      const spots = ANCHORS[room] ?? ANCHORS.lab;
      const [x, y, h] = spots[i % spots.length];
      const pose = POSES[e.id]?.[room];
      const py = pose === 'ceiling' ? CEILING_Y[room] ?? 180 : y;
      drawCreature(ctx, e.id, x, py, h * KIND_SCALE[e.id], this.time, { alpha: 0.92, pose });
    });
  }

  /**
   * Sombra de una criatura proyectada en la pared, más grande y estirada
   * hacia arriba. drawFn(ctx) dibuja la criatura; (fx, fy) son sus pies.
   */
  _wallShadow(ctx, fx, fy, drawFn) {
    const s = this.shadowCtx;
    s.globalCompositeOperation = 'source-over';
    s.clearRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    drawFn(s);
    s.globalCompositeOperation = 'source-in';
    s.fillStyle = '#000';
    s.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    ctx.save();
    ctx.globalAlpha = 0.62;
    ctx.filter = 'blur(3px)';
    ctx.translate(fx + 70, fy - 30);
    ctx.transform(1.55, 0, -0.18, 1.7, 0, 0);
    ctx.translate(-fx, -fy);
    ctx.drawImage(this.shadowCanvas, 0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    ctx.restore();
  }

  // ---------------------------------------------------------------
  // CAM 02 — Muro de contención de El Espécimen
  // ---------------------------------------------------------------

  /**
   * Imagen de la CAM 02 según cómo va el muro (null si no hay renders 3D).
   * Fases del juego (0..WALL_STAGES-1) → renders s0, s1, s3, s4 (la última,
   * la más rota) y 'roto' cuando ha salido. En s3/s4 a veces se ve un
   * instante la variante b (la silueta de detrás en otro sitio).
   */
  _labWallKey(specimen) {
    if (!this.sprites.has('cam_lab_s0')) return null;
    if (specimen?.emerged) return 'cam_lab_roto';
    const ws = specimen?.wallStage ?? 0;
    const n = CONFIG.WALL_STAGES;
    const k = ws <= 0 ? 0 : Math.min(4, Math.round(1 + ((ws - 1) * 3) / Math.max(1, n - 2)));
    const key = `cam_lab_s${k === 2 ? 3 : k}`;
    if (k >= 3) {
      this.labAlt ??= { t: 0, on: false };
      this.labAlt.t -= 1 / 60;
      if (this.labAlt.t <= 0) {
        this.labAlt.on = !this.labAlt.on;
        this.labAlt.t = this.labAlt.on ? 0.5 + Math.random() * 0.8 : 3 + Math.random() * 5;
        this.poses.glitch = Math.max(this.poses.glitch, 0.15);
      }
      if (this.labAlt.on && this.sprites.has(`${key}b`)) return `${key}b`;
    }
    return key;
  }

  _drawLabWall(ctx, specimen) {
    const w = LAB_WALL;
    const broken = specimen.emerged;
    // Placa de contención reforzada
    ctx.fillStyle = '#2b3330';
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeStyle = '#151a18';
    ctx.lineWidth = 6;
    ctx.strokeRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let y = w.y + 40; y < w.y + w.h; y += 70) ctx.fillRect(w.x, y, w.w, 6);
    sign(ctx, 'CONTENCION', w.x + w.w / 2, w.y - 28, '#e0b422');

    if (broken) {
      // Agujero irregular con escombros en el suelo
      ctx.fillStyle = '#030303';
      ctx.beginPath();
      const cx = w.x + w.w / 2;
      const cy = w.y + w.h * 0.6;
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const r = 80 + ((i * 37) % 30);
        const px = cx + Math.cos(a) * r * 0.9;
        const py = cy + Math.sin(a) * r * 1.2;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#3a423e';
      [[-90, 340, 40, 18], [60, 350, 55, 22], [-20, 360, 30, 14], [110, 368, 26, 12]].forEach(([dx, dy, ww, hh]) => {
        ctx.fillRect(cx + dx, w.y + dy, ww, hh);
      });
      return;
    }

    const stage = Math.min(specimen.wallStage, this.cracks.length);
    const k = stage / CONFIG.WALL_STAGES;
    // La placa se abomba: trozos desplazados alrededor del centro
    if (stage >= 2) {
      const cx = w.x + w.w / 2;
      const cy = w.y + w.h * 0.5;
      ctx.fillStyle = 'rgba(70,82,77,0.9)';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 2;
      const n = Math.min(6, stage + 1);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + 0.4;
        const r = 26 + 10 * k;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6);
        ctx.lineTo(cx + Math.cos(a - 0.35) * r, cy + Math.sin(a - 0.35) * r);
        ctx.lineTo(cx + Math.cos(a + 0.35) * r * 1.1, cy + Math.sin(a + 0.35) * r * 1.1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
    // Luz verdosa que se cuela por las grietas (más cuanto más rotas)
    const glow = 0.25 + 0.5 * k + 0.12 * Math.sin(this.time * 2.3);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(140,255,190,0.9)';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = `rgba(150,255,195,${glow})`;
    ctx.lineWidth = 5;
    for (let s = 0; s < stage; s++) {
      for (const path of this.cracks[s]) {
        ctx.beginPath();
        path.forEach(([px, py], i) => (i ? ctx.lineTo(w.x + px, w.y + py) : ctx.moveTo(w.x + px, w.y + py)));
        ctx.stroke();
      }
    }
    ctx.restore();
    // Grietas acumuladas hasta la etapa actual (el trazo oscuro encima)
    ctx.strokeStyle = 'rgba(10,10,10,0.9)';
    ctx.lineWidth = 2;
    for (let s = 0; s < stage; s++) {
      for (const path of this.cracks[s]) {
        ctx.beginPath();
        path.forEach(([px, py], i) => (i ? ctx.lineTo(w.x + px, w.y + py) : ctx.moveTo(w.x + px, w.y + py)));
        ctx.stroke();
      }
    }
    // Trozos del muro caídos al pie (uno más por cada etapa)
    ctx.fillStyle = '#3a423e';
    for (let i = 0; i < stage * 2; i++) {
      const dx = ((i * 53) % 200) - 100;
      const s = 6 + ((i * 17) % 10);
      ctx.fillRect(w.x + w.w / 2 + dx, w.y + w.h - 4 - (i % 3) * 3, s, s * 0.6);
    }
    // Polvo que cae de la grieta de vez en cuando
    if (stage > 0) {
      const fall = (this.time * 0.9) % 1;
      ctx.fillStyle = `rgba(190,200,195,${0.5 * (1 - fall)})`;
      ctx.fillRect(w.x + w.w / 2 + 4, w.y + w.h * 0.55 + fall * w.h * 0.45, 2, 6);
    }
    // En la última etapa antes de romperse: unos ojos brillan dentro
    if (specimen.wallStage >= CONFIG.WALL_STAGES - 1) {
      const blink = Math.sin(this.time * 0.8) > -0.7;
      if (blink) {
        const ex = w.x + w.w / 2;
        const ey = w.y + w.h * 0.45;
        ctx.save();
        ctx.fillStyle = '#020302';
        ctx.beginPath();
        ctx.ellipse(ex - 3, ey + 2, 26, 12, 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = 'rgba(200,255,215,1)';
        ctx.shadowBlur = 16;
        ctx.fillStyle = 'rgba(235,255,240,0.95)';
        ctx.beginPath();
        ctx.arc(ex - 12, ey, 3.2, 0, Math.PI * 2);
        ctx.arc(ex + 8, ey + 3, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // ---------------------------------------------------------------
  // CAM 05 — Cápsula y panel de El Congelado
  // ---------------------------------------------------------------

  _drawCryoPod(ctx, frozen) {
    const x = 800;
    const escaped = frozen.state === 'escaped';
    const warn = frozen.warningProgress;
    const shake = warn > 0 && !escaped ? (Math.random() - 0.5) * 10 * warn : 0;
    ctx.save();
    ctx.translate(shake, 0);
    if (escaped) {
      // Cápsula abierta y vacía, cristal roto
      ctx.fillStyle = '#05080b';
      ctx.beginPath();
      ctx.roundRect(x - 75, 290, 150, 320, 70);
      ctx.fill();
      ctx.strokeStyle = 'rgba(220,240,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const [a, b, c, d] of [[-60, 320, -10, 400], [40, 300, 0, 380], [-50, 560, 20, 470]]) {
        ctx.moveTo(x + a, b);
        ctx.lineTo(x + c, d);
      }
      ctx.stroke();
    } else {
      // Silueta de El Congelado tras el cristal: cabeza, hombros y cuerpo
      ctx.fillStyle = 'rgba(25,38,50,0.85)';
      ctx.beginPath();
      ctx.ellipse(x, 362, 40, 48, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 30, 400);
      ctx.quadraticCurveTo(x - 70, 420, x - 62, 600);
      ctx.lineTo(x + 62, 600);
      ctx.quadraticCurveTo(x + 70, 420, x + 30, 400);
      ctx.closePath();
      ctx.fill();
      // Su cara se va viendo a medida que se derrite la escarcha;
      // abre los ojos con la alarma
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.7 * warn;
      drawFace(ctx, 'frozen', x, 360, 70, this.time, { eyesOpen: warn > 0.35 });
      ctx.restore();
      // Escarcha del cristal (con vetas): se derrite con la alarma
      const fa = 0.6 * (1 - warn);
      const fg = ctx.createLinearGradient(0, 290, 0, 610);
      fg.addColorStop(0, `rgba(225,242,255,${fa})`);
      fg.addColorStop(0.5, `rgba(200,228,250,${fa * 0.75})`);
      fg.addColorStop(1, `rgba(225,242,255,${fa})`);
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.roundRect(x - 75, 290, 150, 320, 70);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${fa * 0.6})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const sx = x - 60 + ((i * 41) % 120);
        const sy = 300 + ((i * 67) % 300);
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 14, sy + 10);
        ctx.moveTo(sx + 7, sy + 5);
        ctx.lineTo(sx + 2, sy + 16);
      }
      ctx.stroke();
      // Gotas de agua que bajan por el cristal cuando se derrite
      if (warn > 0) {
        ctx.fillStyle = 'rgba(200,230,255,0.6)';
        for (let i = 0; i < 4; i++) {
          const dy = ((this.time * 40 + i * 77) % 300);
          ctx.fillRect(x - 50 + i * 30, 300 + dy, 2, 8);
        }
      }
    }
    if (warn > 0 && !escaped && Math.floor(this.time * 4) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,40,40,0.18)';
      ctx.fillRect(x - 110, 250, 220, 400);
    }
    ctx.restore();
  }

  /**
   * Escarcha en la lente de la CAM 05: crece cuanto más cerca está la
   * temperatura de incumplir el requisito, y con la alarma invade la
   * pantalla. Solo visual (el panel se ve encima).
   */
  _drawLensFrost(ctx, cryo, frozen) {
    if (!cryo || !frozen) return;
    let k;
    if (frozen.state === 'escaped') k = 0.55;
    else if (frozen.warningProgress > 0) k = 0.5 + 0.5 * frozen.warningProgress;
    else if (!cryo.ok) k = 0.5;
    else k = Math.max(0, (4 - cryo.margin) / 4) * 0.45;
    if (k <= 0.02) return;
    ctx.save();
    // Velo blanco desde los bordes
    const g = ctx.createRadialGradient(800, 450, 300 + 260 * (1 - k), 800, 450, 980);
    g.addColorStop(0, 'rgba(220,240,255,0)');
    g.addColorStop(1, `rgba(220,240,255,${0.55 * k})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    // Cristales de hielo que crecen hacia dentro
    ctx.strokeStyle = `rgba(240,250,255,${0.25 + 0.45 * k})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (const c of this.lensFrost) {
      const len = c.len * k;
      if (len < 4) continue;
      const ex = c.x + Math.cos(c.a) * len;
      const ey = c.y + Math.sin(c.a) * len;
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(ex, ey);
      // Ramitas a los lados
      for (let b = 1; b <= 3; b++) {
        const t = b / 4;
        const bx = c.x + Math.cos(c.a) * len * t;
        const by = c.y + Math.sin(c.a) * len * t;
        const bl = len * 0.25 * (1 - t);
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(c.a + 0.7) * bl, by + Math.sin(c.a + 0.7) * bl);
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(c.a - 0.7) * bl, by + Math.sin(c.a - 0.7) * bl);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  _drawCryoPanel(ctx, cryo, frozen) {
    const p = CRYO_PANEL;
    panel(ctx, p, 'CRIOGENIA // CAPSULA 2');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = cryo.ok ? '#9fe2ff' : '#ff6060';
    ctx.font = 'bold 64px "Courier New", monospace';
    ctx.fillText(`${cryo.temp}°C`, p.x + 20, p.y + 120);

    arrowButton(ctx, CRYO_UP, '▲');
    arrowButton(ctx, CRYO_DOWN, '▼');

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '20px "Courier New", monospace';
    ctx.fillStyle = '#d8e8f0';
    const label = cryo.mode === 'min' ? 'MINIMA' : 'MAXIMA';
    ctx.fillText(`REQUISITO: ${label} ${cryo.target}°C`, p.x + 20, p.y + 205);

    // Estado + barra de la cuenta atrás
    const warn = frozen.warningProgress;
    if (frozen.state === 'escaped') {
      ctx.fillStyle = '#ff3030';
      ctx.font = 'bold 22px "Courier New", monospace';
      ctx.fillText('CAPSULA ABIERTA', p.x + 20, p.y + 245);
    } else if (warn > 0) {
      if (Math.floor(this.time * 4) % 2 === 0) {
        ctx.fillStyle = '#ff5050';
        ctx.font = 'bold 22px "Courier New", monospace';
        ctx.fillText('!! ALERTA: CORRIGE', p.x + 20, p.y + 245);
      }
      ctx.fillStyle = '#3a0d0d';
      ctx.fillRect(p.x + 20, p.y + 268, p.w - 40, 16);
      ctx.fillStyle = '#ff4040';
      ctx.fillRect(p.x + 20, p.y + 268, (p.w - 40) * warn, 16);
    } else {
      ctx.fillStyle = '#7dffb0';
      ctx.font = 'bold 22px "Courier New", monospace';
      ctx.fillText(`ESTABLE  (margen ${cryo.margin}°C)`, p.x + 20, p.y + 245);
    }
    ctx.fillStyle = 'rgba(216,232,240,0.5)';
    ctx.font = '14px "Courier New", monospace';
    ctx.fillText('Flechas del teclado o clic', p.x + 20, p.y + 296);
  }

  // ---------------------------------------------------------------
  // CAM 04 — Enfriamiento del reactor
  // ---------------------------------------------------------------

  _drawCoolPanel(ctx, reactor) {
    const R = CONFIG.REACTOR;
    const p = COOL_PANEL;
    panel(ctx, p, 'REACTOR // ENFRIAMIENTO');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 54px "Courier New", monospace';
    ctx.fillStyle = reactor.level >= R.WARNING_LEVEL ? '#ff5050' : '#9fe2ff';
    ctx.fillText(`${Math.floor(reactor.level)}%`, p.x + 20, p.y + 95);
    ctx.font = '18px "Courier New", monospace';
    ctx.fillStyle = '#d8e8f0';
    ctx.fillText(`Enfriamientos restantes: ${reactor.charges}`, p.x + 20, p.y + 136);
    const risk = Math.round(reactor.blackoutRisk * 100);
    ctx.fillStyle = risk ? '#ffb070' : 'rgba(216,232,240,0.6)';
    ctx.fillText(`Riesgo de apagon: ${risk}%`, p.x + 20, p.y + 162);

    const b = COOL_BUTTON;
    const usable = reactor.canCool;
    ctx.fillStyle = usable ? '#123344' : '#222';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    if (reactor.isCooling) {
      ctx.fillStyle = '#7fd8ff';
      ctx.fillRect(b.x, b.y, b.w * reactor.coolProgress, b.h);
    }
    ctx.strokeStyle = usable || reactor.isCooling ? '#7fd8ff' : '#555';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = usable || reactor.isCooling ? '#ffffff' : '#777';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 5;
    ctx.font = 'bold 17px "Courier New", monospace';
    ctx.textAlign = 'center';
    let text = `ENFRIAR -${R.COOL_AMOUNT}%  (R)`;
    if (reactor.isCooling) text = `ENFRIANDO... ${Math.ceil(reactor.cooling)} s`;
    else if (reactor.charges <= 0) text = 'SIN USOS ESTA NOCHE';
    ctx.fillText(text, b.x + b.w / 2, b.y + b.h / 2);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(216,232,240,0.55)';
    ctx.font = '14px "Courier New", monospace';
    ctx.fillText(`Bloquea compuertas y luces ${R.COOL_DURATION} s`, p.x + 20, p.y + 268);
    ctx.fillText('y aumenta el riesgo de apagon', p.x + 20, p.y + 286);
  }

  // ---------------------------------------------------------------
  // Decoración de abandono (común a todas las salas)
  // ---------------------------------------------------------------

  _decorate(ctx, room) {
    const d = this.decor[room];
    if (!d) return; // sala sin decoración propia (p. ej. la oficina)
    // Manchas de suciedad y humedad
    for (const s of d.stains) {
      const g = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, s.r);
      g.addColorStop(0, `rgba(${s.color},${s.a})`);
      g.addColorStop(1, `rgba(${s.color},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
    }
    // Arañazos en las paredes
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    for (const sc of d.scratches) {
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(sc.x + k * 9, sc.y);
        ctx.lineTo(sc.x + k * 9 + sc.dx, sc.y + sc.len);
        ctx.stroke();
      }
    }
    // Escombros y objetos tirados por el suelo
    for (const o of d.debris) {
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(o.rot);
      ctx.fillStyle = o.color;
      if (o.kind === 0) ctx.fillRect(-o.s, -o.s * 0.4, o.s * 2, o.s * 0.8);
      else {
        ctx.beginPath();
        ctx.moveTo(-o.s, o.s * 0.5);
        ctx.lineTo(o.s, o.s * 0.3);
        ctx.lineTo(0, -o.s * 0.6);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    // Cables sueltos colgando del techo (se balancean un poco)
    ctx.strokeStyle = '#0c0d0e';
    ctx.lineWidth = 4;
    for (const c of d.cables) {
      const swing = Math.sin(this.time * c.speed + c.phase) * 12;
      ctx.beginPath();
      ctx.moveTo(c.x, 0);
      ctx.quadraticCurveTo(c.x + c.bend + swing * 0.5, c.len * 0.6, c.x + swing, c.len);
      ctx.stroke();
      // Chispa ocasional en la punta pelada
      if (c.spark && Math.random() < 0.015) {
        ctx.fillStyle = 'rgba(200,230,255,0.9)';
        ctx.beginPath();
        ctx.arc(c.x + swing, c.len, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (this.nightLevel >= 2) this._decorateWorse(ctx, room);
    // Parpadeo de la iluminación de la sala (desde la noche 2, más a menudo)
    if (Math.random() < d.flicker * (this.nightLevel >= 2 ? 2.2 : 1)) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    }
  }

  /**
   * Noche 2 en adelante: paneles del techo caídos, uno colgando, una
   * silla volcada, más escombros y marcas de arrastre (sin sangre).
   */
  _decorateWorse(ctx, room) {
    const d = this.worse[room];
    if (!d) return;
    ctx.save();
    // Marcas de arrastre en el suelo
    ctx.strokeStyle = 'rgba(8,8,8,0.35)';
    ctx.lineWidth = 4;
    for (const m of d.marks) {
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(m.x + k * 9, m.y);
        ctx.quadraticCurveTo(m.x + m.dx * 0.5 + k * 9, m.y + 30, m.x + m.dx + k * 9, m.y + 60);
        ctx.stroke();
      }
    }
    // Paneles del techo tirados en el suelo
    for (const p of d.panels) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = '#2c3136';
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, 5);
      ctx.restore();
    }
    // Silla volcada (antes estaba en su sitio)
    const c = d.chair;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(c.flip ? -1 : 1, 1);
    ctx.rotate(1.35);
    ctx.fillStyle = '#23282e';
    ctx.fillRect(-30, -6, 60, 12);           // asiento
    ctx.fillRect(-30, -60, 10, 56);          // respaldo
    ctx.fillRect(18, 4, 7, 34);              // patas
    ctx.fillRect(-26, 4, 7, 34);
    ctx.restore();
    // Más escombros
    for (const o of d.debris) {
      ctx.fillStyle = o.color;
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(o.rot);
      ctx.fillRect(-o.s, -o.s * 0.35, o.s * 2, o.s * 0.7);
      ctx.restore();
    }
    // Un panel del techo colgando de una esquina, balanceándose
    const h = d.hang;
    const sw = Math.sin(this.time * h.speed + h.phase) * 0.06;
    ctx.save();
    ctx.translate(h.x, 0);
    ctx.rotate(0.9 + sw);
    ctx.fillStyle = '#2a2f35';
    ctx.fillRect(0, -8, h.len, 16 + h.w * 0.12);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, -8, h.len, 16 + h.w * 0.12);
    ctx.restore();
    // Cable pelado junto al hueco, con chispas
    if (Math.random() < 0.04) {
      ctx.fillStyle = 'rgba(210,235,255,0.95)';
      for (let k = 0; k < 4; k++) ctx.fillRect(h.x + 40 + Math.random() * 30, 10 + Math.random() * 40, 3, 3);
    }
    ctx.restore();
  }

  /** Pestaña inferior para subir/bajar el monitor (también en la oficina). */
  drawOfficeTab(ctx) {
    this._drawTab(ctx, '▲  MONITOR  (Espacio)');
  }

  // ---------------------------------------------------------------
  // Efectos de cámara
  // ---------------------------------------------------------------

  _postProcess(ctx, room, switchStatic, effects) {
    // Tinte de color + oscurecimiento general (las cámaras son de mala calidad)
    ctx.fillStyle = `rgba(${TINTS[room] ?? '160,170,180'},0.12)`;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    const flicker = 0.25 + Math.random() * 0.06;
    ctx.fillStyle = `rgba(0,0,0,${flicker})`;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

    // Líneas de barrido
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < CONFIG.HEIGHT; y += 4) ctx.fillRect(0, y, CONFIG.WIDTH, 2);

    // Banda de interferencia que baja lentamente
    const bandY = ((this.time * 140) % (CONFIG.HEIGHT + 200)) - 100;
    const bg = ctx.createLinearGradient(0, bandY - 60, 0, bandY + 60);
    bg.addColorStop(0, 'rgba(255,255,255,0)');
    bg.addColorStop(0.5, 'rgba(255,255,255,0.06)');
    bg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, bandY - 60, CONFIG.WIDTH, 120);

    // Estática: base constante + ráfaga fuerte al cambiar de cámara
    effects.static(ctx, 0.14 + Math.min(1, switchStatic * 3) * 0.85);
    effects.grain(ctx, 0.18);
    // Fallo de imagen: al cambiar de cámara o cuando algo se mueve en
    // ella (switchStatic), y de vez en cuando uno pequeño
    glitchSlices(ctx, Math.min(1, switchStatic * 2.2) || (Math.random() < 0.012 ? 0.3 : 0));
    effects.vignette(ctx, 0.8);
  }

  _drawLabels(ctx, room, { live = true } = {}) {
    const r = ROOMS[room] ?? VENTS[room];
    ctx.save();
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#e8eef5';
    ctx.font = 'bold 44px "Courier New", monospace';
    ctx.fillText(`CAM ${r.cam}`, 40, 130);
    ctx.font = '26px "Courier New", monospace';
    ctx.fillText(r.name.toUpperCase(), 40, 180);
    if (!live) {
      // Grabación de archivo (alucinaciones): sin REC ni la hora de ahora
      ctx.restore();
      return;
    }
    // Punto de grabación parpadeante
    if (Math.floor(this.time * 1.5) % 2 === 0) {
      ctx.fillStyle = '#ff2a2a';
      ctx.beginPath();
      ctx.arc(52, 236, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8eef5';
      ctx.font = '20px "Courier New", monospace';
      ctx.fillText('REC', 70, 226);
    }
    // Hora de la grabación (la de la noche, con segundos)
    const sph = CONFIG.SECONDS_PER_HOUR;
    const e = this.clockElapsed;
    const h = Math.floor(e / sph);
    const mm = Math.floor((e % sph) / sph * 60);
    const ss = Math.floor(((e % sph) / sph * 3600) % 60);
    const two = (n) => String(n).padStart(2, '0');
    ctx.fillStyle = 'rgba(232,238,245,0.85)';
    ctx.font = '20px "Courier New", monospace';
    ctx.fillText(`${two(h === 0 ? 12 : h)}:${two(mm)}:${two(ss)} AM`, 120, 226);
    ctx.restore();
  }

  _drawMinimap(ctx, active, cameras = null, scene = null) {
    ctx.save();
    // Panel
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
    ctx.fillText('VIGIA-7 // PLANO DE CAMARAS', 1062, 458);

    // Conexiones
    ctx.strokeStyle = 'rgba(120,255,170,0.35)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (const [a, b] of LINKS) {
      const pa = ROOMS[a] ? center(ROOMS[a].mapRect) : DOOR_POINTS[a];
      const pb = ROOMS[b] ? center(ROOMS[b].mapRect) : DOOR_POINTS[b];
      const via = LINK_PATHS[`${a}|${b}`];
      if (via) {
        // Pasillo con recodos (para no cruzar por encima de otra sala)
        via.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        continue;
      }
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
    }
    ctx.stroke();

    // Pasillo central: del Comedor a la oficina. Sellado en las noches 1 y 2
    // (tachado); abierto desde la noche 3.
    const sealed = (scene?.night ?? this.nightLevel ?? 1) < 3 && !scene?.corridorOpen;
    const m = ROOMS.mess.mapRect;
    // En L: sale por debajo del Comedor y entra en la oficina por su lado
    const via = [[m.x + m.w - 18, m.y + m.h], [m.x + m.w - 18, m.y + m.h + 24], [OFFICE_RECT.x, m.y + m.h + 24]];
    ctx.save();
    ctx.lineWidth = 8;
    ctx.lineJoin = 'miter';
    ctx.strokeStyle = sealed ? 'rgba(255,90,70,0.5)' : 'rgba(120,255,170,0.55)';
    if (sealed) ctx.setLineDash([6, 4]);
    ctx.beginPath();
    via.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.setLineDash([]);
    const [mx, cy] = [(via[1][0] + via[2][0]) / 2, via[2][1]];
    if (sealed) {
      ctx.strokeStyle = '#ff5a46';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(mx - 7, cy - 7);
      ctx.lineTo(mx + 7, cy + 7);
      ctx.moveTo(mx + 7, cy - 7);
      ctx.lineTo(mx - 7, cy + 7);
      ctx.stroke();
    }
    ctx.restore();
    this.corridorPoint = { x: mx, y: cy - 12 };

    // Oficina (el jugador)
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
    ctx.font = '10px "Courier New", monospace';
    ctx.fillStyle = sealed ? 'rgba(255,140,120,0.85)' : 'rgba(170,255,200,0.8)';
    ctx.fillText(sealed ? 'PASILLO SELLADO' : '< PASILLO CENTRAL', o.x + o.w / 2, o.y + o.h - 10);
    ctx.font = 'bold 18px "Courier New", monospace';

    // Botones de cámara
    for (const [id, room] of Object.entries(ROOMS)) {
      const r = room.mapRect;
      const isActive = id === active;
      ctx.fillStyle = isActive ? '#7dffb0' : '#0f1a14';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = isActive ? '#d8ffe8' : 'rgba(120,255,170,0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = isActive ? '#06120b' : '#bfffd6';
      ctx.font = 'bold 18px "Courier New", monospace';
      ctx.fillText(`CAM ${room.cam}`, r.x + r.w / 2, r.y + 19);
      ctx.font = '12px "Courier New", monospace';
      ctx.fillText(room.name, r.x + r.w / 2, r.y + 39);
      if (cameras?.repaired?.has(id)) {
        // Reparada (noche 4, camino B): ✓ verde
        ctx.strokeStyle = '#4dff7a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(r.x + r.w - 30, r.y + r.h - 22);
        ctx.lineTo(r.x + r.w - 21, r.y + r.h - 12);
        ctx.lineTo(r.x + r.w - 6, r.y + r.h - 34);
        ctx.stroke();
      }
      if (cameras?.broken?.has(id)) {
        // Cámara rota: cruz roja
        ctx.strokeStyle = 'rgba(255,80,60,0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(r.x + 6, r.y + 6);
        ctx.lineTo(r.x + r.w - 6, r.y + r.h - 6);
        ctx.moveTo(r.x + r.w - 6, r.y + 6);
        ctx.lineTo(r.x + 6, r.y + r.h - 6);
        ctx.stroke();
      }
    }
    if (cameras?.warnings) {
      if (scene?.roamers && warningsVisible(cameras)) this._drawWarnings(ctx, scene.roamers);
      drawWarningLegend(ctx);
    }
    if (scene?.slaimi) {
      // Slaimi (noche 4, camino B): su triángulo, siempre visible, en el lado
      // de la oficina donde está
      const p = scene.slaimi.mapPoint();
      drawWarnTriangle(ctx, p.x, p.y, NIGHT4.SLAIMI.COLOR, 1, 0.9);
      ctx.fillStyle = NIGHT4.SLAIMI.COLOR;
      ctx.font = '11px "Courier New", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText('▲ Slaimi', 1556, 864);
    }
    ctx.restore();
  }

  /**
   * Triángulos de aviso ⚠ (desde el evento de las 3 AM de la noche 3): uno
   * en cada sala con un enemigo, también en las de cámara rota. Las
   * compuertas y el pasillo central se marcan junto a la oficina.
   */
  _drawWarnings(ctx, roamers, whereFn = null) {
    const o = OFFICE_RECT;
    const where = whereFn ?? ((id) => {
      if (ROOMS[id]) return { x: ROOMS[id].mapRect.x + ROOMS[id].mapRect.w - 14, y: ROOMS[id].mapRect.y + 14 };
      if (id === 'left_door') return { x: o.x + 14, y: o.y + o.h - 14 };
      if (id === 'right_door') return { x: o.x + 14, y: o.y + 14 };
      if (id?.startsWith('central')) return this.corridorPoint ?? { x: o.x - 10, y: o.y + o.h / 2 };
      return null;
    });
    const alpha = 0.8 + 0.2 * Math.sin(this.time * 6);
    const count = {};
    for (const e of roamers) {
      if (isVent(e.room) && !whereFn) continue;    // El Insecto tiene su propio plano
      const p = where(e.room);
      if (!p) continue;
      const k = (count[e.room] = (count[e.room] ?? 0) + 1) - 1;
      drawWarnTriangle(ctx, p.x - k * 22, p.y, warnColor(e.id), alpha);
    }
  }

  /**
   * Cinemática de llegada (6 AM de la noche 3): el plano en grande, todas
   * las cámaras tachadas y los triángulos de los enemigos (markers:
   * [{ id, at, pulse }]) donde estén ahora. Ver Night3Ending.js.
   */
  drawArrivalMap(ctx, markers, effects, time) {
    const W = CONFIG.WIDTH;
    const H = CONFIG.HEIGHT;
    ctx.fillStyle = '#030404';
    ctx.fillRect(0, 0, W, H);
    effects.static(ctx, 0.18);
    const S = 1.55;
    const broken = { broken: new Set(ROOM_IDS), warnings: true };
    ctx.save();
    ctx.translate(W / 2 - 1307 * S, H / 2 + 20 - 662 * S);
    ctx.scale(S, S);
    this._drawMinimap(ctx, null, broken, { night: 3 });
    for (const m of markers) {
      const p = this._arrivalPoint(m.at);
      if (!p) continue;
      const size = 1 + 0.6 * (m.pulse ?? 0);
      drawWarnTriangle(ctx, p.x + (m.dx ?? 0), p.y, warnColor(m.id), 1, size);
    }
    ctx.restore();
    if (Math.random() < 0.05) glitchSlices(ctx, 0.4);
  }

  /** Punto del plano para la cinemática de llegada (salas, pasillo central, conducto, oficina). */
  _arrivalPoint(at) {
    const o = OFFICE_RECT;
    if (ROOMS[at]) return center(ROOMS[at].mapRect);
    if (at === 'central') return this.corridorPoint ?? { x: o.x - 30, y: o.y + o.h + 20 };
    // El conducto que rodea la oficina (El Insecto), por el borde derecho del plano
    if (at === 'duct1') return { x: 1556, y: 478 };
    if (at === 'duct2') return { x: 1556, y: 540 };
    if (at === 'duct3') return { x: 1556, y: 592 };
    if (at === 'office') return { x: o.x + o.w / 2, y: o.y + o.h / 2 + 22 };
    return null;
  }

  _drawTab(ctx, label) {
    const t = MONITOR_TAB;
    ctx.save();
    ctx.fillStyle = 'rgba(20,40,30,0.75)';
    ctx.strokeStyle = 'rgba(125,255,176,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(t.x, t.y, t.w, t.h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#bfffd6';
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, t.x + t.w / 2, t.y + t.h / 2);
    ctx.restore();
  }
}

// =================================================================
// Ayudas de dibujo
// =================================================================

/**
 * Habitación en perspectiva de un punto. `back` es el rectángulo de
 * la pared del fondo; el resto de superficies se construyen uniendo
 * sus esquinas con las de la pantalla.
 */
function roomBox(ctx, back, { wall = '#20262c', floor = '#15181b', ceil = '#0e1013', side = '#191d22' } = {}) {
  const W = CONFIG.WIDTH;
  const H = CONFIG.HEIGHT;
  const b = { l: back.x, r: back.x + back.w, t: back.y, btm: back.y + back.h };
  const poly = (pts, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  };
  poly([[0, 0], [W, 0], [b.r, b.t], [b.l, b.t]], ceil);
  poly([[0, H], [W, H], [b.r, b.btm], [b.l, b.btm]], floor);
  poly([[0, 0], [b.l, b.t], [b.l, b.btm], [0, H]], side);
  poly([[W, 0], [b.r, b.t], [b.r, b.btm], [W, H]], side);
  ctx.fillStyle = wall;
  ctx.fillRect(back.x, back.y, back.w, back.h);
  // Aristas
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const [x, y, px, py] of [[0, 0, b.l, b.t], [W, 0, b.r, b.t], [0, H, b.l, b.btm], [W, H, b.r, b.btm]]) {
    ctx.moveTo(x, y);
    ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.strokeRect(back.x, back.y, back.w, back.h);
}

/** Cono de luz desde el techo. */
function lampCone(ctx, x, y, w, h, alpha, color = '255,240,210') {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, `rgba(${color},${alpha})`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - 20, y);
  ctx.lineTo(x + 20, y);
  ctx.lineTo(x + w / 2, y + h);
  ctx.lineTo(x - w / 2, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = `rgba(${color},${Math.min(1, alpha * 2.5)})`;
  ctx.fillRect(x - 26, y - 6, 52, 8);
}

/** Caja/contenedor visto de frente con la tapa en perspectiva. */
function crate(ctx, x, y, w, h, color = '#3a3326') {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - w * 0.12, y - h * 0.18);
  ctx.lineTo(x + w * 0.12, y - h * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y + h);
  ctx.moveTo(x + w, y);
  ctx.lineTo(x, y + h);
  ctx.stroke();
}

/** Panel de control superpuesto a la imagen. */
function panel(ctx, p, title) {
  ctx.fillStyle = 'rgba(5,10,14,0.88)';
  ctx.strokeStyle = 'rgba(159,226,255,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(p.x, p.y, p.w, p.h, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(159,226,255,0.8)';
  ctx.font = '15px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(title, p.x + 16, p.y + 12);
}

function arrowButton(ctx, r, label) {
  ctx.fillStyle = '#12303f';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = '#9fe2ff';
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = '#d8f2ff';
  ctx.font = 'bold 30px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 2);
}

/** Elementos de abandono de una sala, generados con su semilla. */
function makeDecor(rng) {
  const W = CONFIG.WIDTH;
  return {
    stains: Array.from({ length: rng.int(5, 9) }, () => ({
      x: rng.range(0, W), y: rng.range(100, 880), r: rng.range(40, 160),
      a: rng.range(0.25, 0.5), color: rng.next() < 0.5 ? '25,18,10' : '10,14,8',
    })),
    scratches: Array.from({ length: rng.int(0, 2) }, () => ({
      x: rng.range(150, 1300), y: rng.range(250, 450), len: rng.range(60, 120), dx: rng.range(-25, 25),
    })),
    debris: Array.from({ length: rng.int(8, 16) }, () => ({
      x: rng.range(80, W - 80), y: rng.range(720, 890), s: rng.range(6, 22), rot: rng.range(0, Math.PI),
      kind: rng.int(0, 1), color: ['#2a2622', '#3a3530', '#1d1f22', '#4a4038'][rng.int(0, 3)],
    })),
    cables: Array.from({ length: rng.int(1, 3) }, () => ({
      x: rng.range(150, 1450), len: rng.range(150, 380), bend: rng.range(-60, 60),
      speed: rng.range(0.4, 1.1), phase: rng.range(0, 6), spark: rng.next() < 0.5,
    })),
    flicker: rng.range(0.01, 0.05),
  };
}

/** Color del reactor según su temperatura (0..1): azul → naranja → rojo. */
function heatRGB(heat) {
  const k = Math.max(0, Math.min(1, (heat - 0.3) / 0.65));
  const s = k * k * (3 - 2 * k);
  const cold = [120, 220, 255];
  const hot = [255, 70, 40];
  return cold.map((c, i) => Math.round(c + (hot[i] - c) * s)).join(',');
}
export { heatRGB };

/** Destrozos extra de una sala (noche 2 en adelante). */
function makeWorse(rng) {
  const W = CONFIG.WIDTH;
  return {
    panels: Array.from({ length: rng.int(2, 3) }, () => ({
      x: rng.range(150, W - 150), y: rng.range(740, 870), w: rng.range(90, 160), h: rng.range(22, 36), rot: rng.range(-0.4, 0.4),
    })),
    hang: { x: rng.range(220, W - 400), w: rng.range(120, 180), len: rng.range(110, 180), phase: rng.range(0, 6), speed: rng.range(0.6, 1.2) },
    chair: { x: rng.range(200, W - 200), y: rng.range(770, 850), flip: rng.next() < 0.5 },
    debris: Array.from({ length: 14 }, () => ({
      x: rng.range(60, W - 60), y: rng.range(700, 890), s: rng.range(4, 14), rot: rng.range(0, Math.PI),
      color: ['#2a2622', '#3a3530', '#1d1f22', '#4a4038', '#2f353b'][rng.int(0, 4)],
    })),
    marks: Array.from({ length: rng.int(1, 2) }, () => ({ x: rng.range(200, W - 300), y: rng.range(720, 800), dx: rng.range(-120, 120) })),
  };
}

/** Cristales de escarcha de la lente: salen de los bordes hacia dentro. */
function makeLensFrost(rng) {
  const W = CONFIG.WIDTH;
  const H = CONFIG.HEIGHT;
  const list = [];
  for (let i = 0; i < 70; i++) {
    const side = rng.int(0, 3);
    const x = side === 0 ? 0 : side === 1 ? W : rng.range(0, W);
    const y = side === 2 ? 0 : side === 3 ? H : rng.range(0, H);
    // Hacia el centro, con algo de desviación
    const a = Math.atan2(H / 2 - y, W / 2 - x) + rng.range(-0.7, 0.7);
    list.push({ x, y, a, len: rng.range(80, 340) });
  }
  return list;
}

/**
 * Grietas del muro de contención: para cada etapa, unos trazos que
 * parten del centro del muro y se van ramificando hacia fuera.
 */
function makeCracks(rng) {
  const stages = [];
  const cx = LAB_WALL.w / 2;
  const cy = LAB_WALL.h * 0.5;
  for (let s = 0; s < CONFIG.WALL_STAGES; s++) {
    const paths = [];
    const n = 2 + s;
    for (let k = 0; k < n; k++) {
      let x = cx + rng.range(-15, 15);
      let y = cy + rng.range(-15, 15);
      const angle = rng.range(0, Math.PI * 2);
      const len = 30 + s * 25;
      const path = [[x, y]];
      for (let seg = 0; seg < 4; seg++) {
        const a = angle + rng.range(-0.6, 0.6);
        x = Math.max(4, Math.min(LAB_WALL.w - 4, x + Math.cos(a) * len / 3));
        y = Math.max(4, Math.min(LAB_WALL.h - 4, y + Math.sin(a) * len / 3));
        path.push([x, y]);
      }
      paths.push(path);
    }
    stages.push(paths);
  }
  return stages;
}

// =================================================================
// Detalles de nave espacial (ver SHIP_DETAILS)
// =================================================================

function drawShipDetails(ctx, list = [], t) {
  ctx.save();
  for (const [type, ...a] of list) SHIP_PARTS[type](ctx, ...a, t);
  ctx.restore();
}

const SHIP_PARTS = {
  pipe(ctx, y, x1, x2, th) {
    const g = ctx.createLinearGradient(0, y, 0, y + th);
    g.addColorStop(0, '#3b434c');
    g.addColorStop(0.4, '#2a3038');
    g.addColorStop(1, '#14181d');
    ctx.fillStyle = g;
    ctx.fillRect(x1, y, x2 - x1, th);
    // Juntas con bridas cada cierto tramo
    ctx.fillStyle = '#20262d';
    for (let x = x1 + 90; x < x2; x += 210) ctx.fillRect(x, y - 3, 12, th + 6);
    // Gotera de condensación (está abandonada)
    ctx.fillStyle = 'rgba(40,30,20,0.6)';
    ctx.fillRect(x1 + 300, y + th, 3, 22);
  },

  vent(ctx, x, y, w, h) {
    ctx.fillStyle = '#0a0c0e';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#3a424b';
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, w, h);
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let yy = y + 10; yy < y + h - 4; yy += 10) {
      ctx.moveTo(x + 6, yy);
      ctx.lineTo(x + w - 6, yy);
    }
    ctx.stroke();
    // Tornillos (falta uno)
    ctx.fillStyle = '#56606b';
    for (const [bx, by] of [[x + 6, y + 6], [x + w - 6, y + 6], [x + 6, y + h - 6]]) {
      ctx.beginPath();
      ctx.arc(bx, by, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  beacon(ctx, x, y, t) {
    // Luz de emergencia giratoria: el destello pasa cada ~1,6 s
    const phase = (t * 0.62 + x * 0.001) % 1;
    const flash = Math.max(0, Math.cos(phase * Math.PI * 2));
    ctx.fillStyle = '#1b1f24';
    ctx.fillRect(x - 18, y + 14, 36, 10);
    const glow = ctx.createRadialGradient(x, y, 4, x, y, 140);
    glow.addColorStop(0, `rgba(255,60,40,${0.45 * flash})`);
    glow.addColorStop(1, 'rgba(255,60,40,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 140, y - 140, 280, 280);
    ctx.fillStyle = `rgb(${120 + 135 * flash},${30 + 40 * flash},${25 + 20 * flash})`;
    ctx.beginPath();
    ctx.arc(x, y + 14, 14, Math.PI, 0);
    ctx.fill();
  },

  porthole(ctx, x, y, r, t) {
    const space = ctx.createRadialGradient(x - r * 0.4, y + r * 0.5, 2, x, y, r * 1.2);
    space.addColorStop(0, '#16305a');
    space.addColorStop(0.5, '#050a1c');
    space.addColorStop(1, '#01020a');
    ctx.fillStyle = space;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // Estrellas que derivan despacio (la estación gira)
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#eef3ff';
    for (let i = 0; i < 22; i++) {
      const sx = x - r + (((i * 37 + t * 4) % (2 * r)) + 2 * r) % (2 * r);
      const sy = y - r + ((i * 53) % (2 * r));
      const size = i % 4 === 0 ? 3 : 2;
      ctx.fillRect(sx, sy, size, size);
    }
    ctx.restore();
    // Marco con remaches
    ctx.strokeStyle = '#3d4650';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#5a646f';
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Reflejo en el cristal
    ctx.strokeStyle = 'rgba(200,220,255,0.12)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.7, Math.PI * 1.1, Math.PI * 1.4);
    ctx.stroke();
  },

  stencil(ctx, text, x, y) {
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(205,195,170,0.32)';
    ctx.fillText(text, x, y);
  },

  hazard(ctx, x, y, w, h) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = 'rgba(200,160,30,0.55)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(15,15,15,0.8)';
    for (let xx = x - h; xx < x + w + h; xx += h * 2.4) {
      ctx.beginPath();
      ctx.moveTo(xx, y + h);
      ctx.lineTo(xx + h * 1.2, y + h);
      ctx.lineTo(xx + h * 2.4, y);
      ctx.lineTo(xx + h * 1.2, y);
      ctx.fill();
    }
    ctx.restore();
  },
};

/** Sala genérica (por si una sala no tiene dibujo propio). */
function genericRoom(ctx) {
  roomBox(ctx, { x: 480, y: 240, w: 640, h: 360 });
  lampCone(ctx, 800, 40, 600, 650, 0.1);
}

/** Texto rotulado en la pared. */
function sign(ctx, text, x, y, color = '#e0b422') {
  ctx.font = 'bold 26px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 30;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x - w / 2, y - 22, w, 44);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x - w / 2, y - 22, w, 44);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

// =================================================================
// Una función por sala. `this` es el CameraView; t = tiempo.
// =================================================================

const ROOM_DRAWERS = {
  hangar(ctx, t) {
    const back = { x: 300, y: 200, w: 1000, h: 440 };
    roomBox(ctx, back, { wall: '#262620', floor: '#1b1a16', side: '#1e1e19' });
    // Portón de la bahía con lamas y franja de peligro
    ctx.fillStyle = '#34342c';
    ctx.fillRect(500, 250, 600, 390);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 4;
    for (let y = 280; y < 640; y += 40) {
      ctx.beginPath();
      ctx.moveTo(500, y);
      ctx.lineTo(1100, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#c9a21f';
    ctx.fillRect(500, 250, 600, 18);
    sign(ctx, 'BAHIA 2', 800, 222);
    // Brazo de acoplamiento
    ctx.strokeStyle = '#4a4a40';
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.moveTo(1300, 120);
    ctx.lineTo(1120, 330);
    ctx.lineTo(1160, 470);
    ctx.stroke();
    // Cajas
    crate(ctx, 120, 640, 220, 170);
    crate(ctx, 330, 690, 150, 120, '#2f2a20');
    crate(ctx, 1240, 660, 240, 180, '#352f22');
    // Foco que parpadea de vez en cuando
    const on = Math.sin(t * 13) > -0.9 || Math.random() > 0.5;
    lampCone(ctx, 800, 40, 700, 700, on ? 0.18 : 0.03);
  },

  lab(ctx, t) {
    const back = { x: 480, y: 240, w: 640, h: 360 };
    roomBox(ctx, back, { wall: '#1f2a26', floor: '#141a18', side: '#18201d' });
    // Mesa de trabajo
    ctx.fillStyle = '#2b3531';
    ctx.fillRect(180, 600, 1240, 40);
    ctx.fillStyle = '#1c2421';
    ctx.fillRect(220, 640, 40, 180);
    ctx.fillRect(1340, 640, 40, 180);
    // Monitores sobre la mesa
    for (const x of [260, 1180]) {
      ctx.fillStyle = '#0b100e';
      ctx.fillRect(x, 500, 150, 100);
      ctx.fillStyle = `rgba(90,255,150,${0.25 + 0.1 * Math.sin(t * 3 + x)})`;
      ctx.fillRect(x + 10, 510, 130, 80);
    }
    // Tanque de muestras: vacío y con el cristal roto
    // (el muro de contención de El Espécimen se dibuja aparte, a la derecha)
    const cx = 610;
    ctx.fillStyle = 'rgba(120,255,180,0.08)';
    ctx.fillRect(cx - 90, 250, 180, 350);
    const level = 470 + Math.sin(t * 0.7) * 4;
    ctx.fillStyle = 'rgba(60,200,120,0.35)';
    ctx.fillRect(cx - 90, level, 180, 600 - level);
    ctx.strokeStyle = 'rgba(180,255,210,0.5)';
    ctx.lineWidth = 4;
    ctx.strokeRect(cx - 90, 250, 180, 350);
    // Grietas
    ctx.strokeStyle = 'rgba(220,255,235,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 30, 330);
    ctx.lineTo(cx + 10, 380);
    ctx.lineTo(cx - 20, 420);
    ctx.lineTo(cx + 40, 470);
    ctx.moveTo(cx + 10, 380);
    ctx.lineTo(cx + 70, 360);
    ctx.stroke();
    sign(ctx, 'MUESTRAS', cx, 215, '#7dffb0');
    // Papeles por el suelo
    ctx.fillStyle = 'rgba(220,230,225,0.25)';
    [[430, 760, 0.3], [600, 820, -0.5], [1010, 780, 0.8]].forEach(([x, y, a]) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillRect(-40, -28, 80, 56);
      ctx.restore();
    });
  },

  greenhouse(ctx, t) {
    const back = { x: 460, y: 230, w: 680, h: 380 };
    roomBox(ctx, back, { wall: '#21182a', floor: '#15111a', side: '#1b1422' });
    // Luz de cultivo violeta
    const g = ctx.createLinearGradient(0, 0, 0, 500);
    g.addColorStop(0, 'rgba(190,90,255,0.35)');
    g.addColorStop(1, 'rgba(190,90,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CONFIG.WIDTH, 500);
    for (const x of [500, 800, 1100]) {
      ctx.fillStyle = 'rgba(230,170,255,0.8)';
      ctx.fillRect(x - 90, 120, 180, 10);
    }
    // Tres bancales en perspectiva
    const rows = [
      { y: 610, x1: 520, x2: 1080, h: 30 },
      { y: 690, x1: 380, x2: 1220, h: 40 },
      { y: 790, x1: 200, x2: 1400, h: 55 },
    ];
    rows.forEach((r) => {
      ctx.fillStyle = '#2a1f17';
      ctx.fillRect(r.x1, r.y, r.x2 - r.x1, r.h);
    });
    // Hojas (balanceándose muy levemente)
    for (const leaf of this.leaves) {
      const r = rows[leaf.row];
      const x = r.x1 + leaf.u * (r.x2 - r.x1) + Math.sin(t + leaf.u * 10) * 2;
      const size = leaf.r * (0.6 + leaf.row * 0.3);
      ctx.fillStyle = `rgba(40,${Math.floor(110 * leaf.shade)},60,0.9)`;
      ctx.beginPath();
      ctx.ellipse(x, r.y - size * 0.4, size, size * 0.6, leaf.u * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  reactor(ctx, t) {
    const back = { x: 470, y: 180, w: 660, h: 460 };
    roomBox(ctx, back, { wall: '#161d26', floor: '#10151b', side: '#131a21' });
    // Tuberías
    ctx.strokeStyle = '#2a3440';
    ctx.lineWidth = 22;
    for (const y of [260, 320]) {
      ctx.beginPath();
      ctx.moveTo(0, y - 100);
      ctx.lineTo(470, y);
      ctx.lineTo(1130, y);
      ctx.lineTo(1600, y - 100);
      ctx.stroke();
    }
    // Núcleo que late: azul si está frío, rojo si está al límite (y late
    // más deprisa cuanto más caliente)
    const heat = this.reactorHeat;
    const col = heatRGB(heat);
    const pulse = 0.6 + 0.4 * Math.sin(t * (2.2 + 3 * heat));
    const glow = ctx.createRadialGradient(800, 430, 20, 800, 430, 380);
    glow.addColorStop(0, `rgba(${col},${0.55 * pulse})`);
    glow.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(400, 100, 800, 700);
    ctx.fillStyle = '#0d1a24';
    ctx.fillRect(700, 210, 200, 430);
    ctx.fillStyle = `rgba(${col},${0.5 + 0.4 * pulse})`;
    ctx.fillRect(740, 230, 120, 390);
    // Centro más blanco
    ctx.fillStyle = `rgba(255,255,255,${0.12 + 0.12 * pulse})`;
    ctx.fillRect(780, 240, 40, 370);
    // Vapor que sale por arriba del núcleo y por las juntas de las tuberías
    for (const [vx, vy, sz] of [[800, 205, 70], [470, 255, 40], [1130, 315, 40]]) {
      for (let i = 0; i < 3; i++) {
        const p = (t * 0.35 + i / 3 + vx * 0.0007) % 1;
        const py = vy - p * 120;
        const r = sz * (0.4 + p);
        const sg = ctx.createRadialGradient(vx, py, 2, vx, py, r);
        sg.addColorStop(0, `rgba(210,220,230,${0.2 * (1 - p)})`);
        sg.addColorStop(1, 'rgba(210,220,230,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(vx - r, py - r, r * 2, r * 2);
      }
    }
    ctx.strokeStyle = '#3c4a58';
    ctx.lineWidth = 8;
    for (let y = 240; y < 640; y += 60) {
      ctx.beginPath();
      ctx.moveTo(700, y);
      ctx.lineTo(900, y);
      ctx.stroke();
    }
    sign(ctx, '! RADIACION', 560, 690, '#ffd84a');
  },

  cryo(ctx, t) {
    const back = { x: 420, y: 230, w: 760, h: 390 };
    roomBox(ctx, back, { wall: '#1d2630', floor: '#121820', side: '#171f28' });
    // Cápsulas criogénicas
    [520, 800, 1080].forEach((x, i) => {
      ctx.fillStyle = '#26313d';
      ctx.beginPath();
      ctx.roundRect(x - 100, 260, 200, 380, 90);
      ctx.fill();
      const frost = ctx.createLinearGradient(0, 290, 0, 610);
      frost.addColorStop(0, 'rgba(200,235,255,0.55)');
      frost.addColorStop(1, 'rgba(120,170,210,0.25)');
      ctx.fillStyle = frost;
      ctx.beginPath();
      ctx.roundRect(x - 75, 290, 150, 320, 70);
      ctx.fill();
      // (El Congelado, en la cápsula central, se dibuja en _drawCryoPod)
      ctx.fillStyle = i === 1 ? '#7dffb0' : '#2a3a46';
      ctx.fillRect(x - 30, 650, 60, 10);
    });
    // Tubos criogénicos del techo a cada cápsula, con escarcha
    [520, 800, 1080].forEach((x) => {
      for (const dx of [-36, 36]) {
        ctx.fillStyle = '#2c3946';
        ctx.fillRect(x + dx - 7, 0, 14, 268);
        ctx.fillStyle = 'rgba(220,240,255,0.25)';
        ctx.fillRect(x + dx - 7, 0, 4, 268);
        ctx.fillStyle = '#3a4a58';
        for (let y = 40; y < 260; y += 70) ctx.fillRect(x + dx - 10, y, 20, 8);
      }
      // Vaho que sale de la junta de la cápsula y sube
      for (let i = 0; i < 3; i++) {
        const p = (t * 0.25 + i / 3 + x * 0.001) % 1;
        const py = 270 - p * 150;
        const r = 18 + p * 50;
        const vg = ctx.createRadialGradient(x, py, 2, x, py, r);
        vg.addColorStop(0, `rgba(210,235,255,${0.22 * (1 - p)})`);
        vg.addColorStop(1, 'rgba(210,235,255,0)');
        ctx.fillStyle = vg;
        ctx.fillRect(x - r, py - r, r * 2, r * 2);
      }
    });
    // Neblina en el suelo, que se mueve despacio
    const fog = ctx.createLinearGradient(0, 640, 0, 900);
    fog.addColorStop(0, 'rgba(190,225,255,0)');
    fog.addColorStop(1, 'rgba(190,225,255,0.22)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 640, CONFIG.WIDTH, 260);
    for (let i = 0; i < 6; i++) {
      const fx = ((t * 18 + i * 300) % 1900) - 150;
      const fy = 760 + Math.sin(t * 0.5 + i) * 30;
      const fgr = ctx.createRadialGradient(fx, fy, 10, fx, fy, 220);
      fgr.addColorStop(0, 'rgba(200,230,255,0.12)');
      fgr.addColorStop(1, 'rgba(200,230,255,0)');
      ctx.fillStyle = fgr;
      ctx.fillRect(fx - 220, fy - 220, 440, 440);
    }
  },

  mess(ctx, t) {
    const back = { x: 480, y: 250, w: 640, h: 350 };
    roomBox(ctx, back, { wall: '#2a241c', floor: '#1b1712', side: '#221d16' });
    // Mesas con sillas
    [[420, 680, 300], [880, 680, 300], [600, 620, 220], [960, 620, 200]].forEach(([x, y, w]) => {
      ctx.fillStyle = '#3d3427';
      ctx.fillRect(x, y, w, 20);
      ctx.fillStyle = '#2a241b';
      ctx.fillRect(x + 20, y + 20, 14, 90);
      ctx.fillRect(x + w - 34, y + 20, 14, 90);
      ctx.fillStyle = '#332b20';
      ctx.fillRect(x + w * 0.3, y - 40, 40, 70);
    });
    // Bandeja tirada
    ctx.fillStyle = 'rgba(200,190,170,0.3)';
    ctx.fillRect(700, 800, 120, 40);
    // Máquina expendedora iluminada
    ctx.fillStyle = '#1d1a14';
    ctx.fillRect(1150, 300, 160, 340);
    ctx.fillStyle = `rgba(255,220,150,${0.35 + 0.05 * Math.sin(t * 20)})`;
    ctx.fillRect(1165, 320, 100, 220);
    lampCone(ctx, 800, 30, 650, 650, 0.12, '255,220,170');
  },

  westHall(ctx, t) {
    drawCorridor(ctx, t, '← LABORATORIO', 0.6);
  },

  eastHall(ctx, t) {
    drawCorridor(ctx, t, 'HANGAR →', 1.7);
  },

  // Enfermería: camillas abandonadas, cortina medio arrancada, gotero,
  // armario con la cruz, monitor cardíaco y la rejilla del conducto que
  // viene de Criogenia, arrancada (por ahí sale El Congelado).
  medbay(ctx, t) {
    const back = { x: 470, y: 230, w: 660, h: 380 };
    roomBox(ctx, back, { wall: '#26302d', floor: '#171d1b', side: '#1e2623', ceil: '#101413' });
    // Azulejos de la pared del fondo
    ctx.strokeStyle = 'rgba(200,230,215,0.07)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = back.x; x <= back.x + back.w; x += 44) {
      ctx.moveTo(x, back.y);
      ctx.lineTo(x, back.y + back.h);
    }
    for (let y = back.y; y <= back.y + back.h; y += 44) {
      ctx.moveTo(back.x, y);
      ctx.lineTo(back.x + back.w, y);
    }
    ctx.stroke();

    // Rejilla arrancada en la pared del fondo: agujero negro y la rejilla en el suelo
    ctx.fillStyle = '#030404';
    ctx.fillRect(560, 300, 130, 90);
    ctx.strokeStyle = '#4a5550';
    ctx.lineWidth = 4;
    ctx.strokeRect(560, 300, 130, 90);
    ctx.save();
    ctx.translate(600, 640);
    ctx.rotate(0.25);
    ctx.fillStyle = '#39423f';
    ctx.fillRect(-70, -12, 140, 24);
    ctx.strokeStyle = '#1a1f1d';
    ctx.lineWidth = 3;
    for (let x = -62; x < 70; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, -10);
      ctx.lineTo(x, 10);
      ctx.stroke();
    }
    ctx.restore();
    // Arañazos saliendo del conducto
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(575 + k * 9, 392);
      ctx.lineTo(565 + k * 11, 450);
      ctx.stroke();
    }

    // Armario de medicinas con la cruz
    ctx.fillStyle = '#2d3532';
    ctx.fillRect(770, 270, 150, 210);
    ctx.strokeStyle = '#151a18';
    ctx.lineWidth = 3;
    ctx.strokeRect(770, 270, 150, 210);
    ctx.beginPath();
    ctx.moveTo(845, 270);
    ctx.lineTo(845, 480);
    ctx.stroke();
    ctx.fillStyle = 'rgba(190,60,55,0.75)';
    ctx.fillRect(833, 300, 24, 70);
    ctx.fillRect(810, 323, 70, 24);
    // Puerta del armario entreabierta
    ctx.fillStyle = '#353f3b';
    ctx.beginPath();
    ctx.moveTo(920, 270);
    ctx.lineTo(965, 285);
    ctx.lineTo(965, 470);
    ctx.lineTo(920, 480);
    ctx.closePath();
    ctx.fill();

    // Monitor cardíaco: línea plana con un pitido de vez en cuando
    ctx.fillStyle = '#0b100e';
    ctx.fillRect(990, 300, 120, 80);
    ctx.strokeStyle = 'rgba(120,255,170,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const beat = (t % 3.2) / 3.2;
    for (let x = 0; x <= 110; x += 2) {
      const d = Math.abs(x / 110 - beat);
      const y = 340 + (d < 0.03 ? -22 * (1 - d / 0.03) * Math.sin(x) : 0);
      x ? ctx.lineTo(995 + x, y) : ctx.moveTo(995 + x, y);
    }
    ctx.stroke();

    // Camillas
    for (const [x, y, w, h, lump] of [[180, 650, 330, 50, true], [700, 600, 260, 38, false]]) {
      ctx.fillStyle = '#3a423f';
      ctx.fillRect(x + 20, y + h, 10, 120 * (h / 50));
      ctx.fillRect(x + w - 30, y + h, 10, 120 * (h / 50));
      ctx.fillStyle = '#8f9893';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(70,45,35,0.55)'; // manchas en la sábana
      ctx.beginPath();
      ctx.ellipse(x + w * 0.6, y + h * 0.4, w * 0.12, h * 0.35, 0.3, 0, Math.PI * 2);
      ctx.fill();
      if (lump) {
        // Bulto tapado con la sábana
        ctx.fillStyle = '#a3aca7';
        ctx.beginPath();
        ctx.ellipse(x + w * 0.45, y + 2, w * 0.35, h * 0.55, 0, Math.PI, 0);
        ctx.fill();
      }
    }

    // Gotero
    ctx.strokeStyle = '#5a6560';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(1000, 760);
    ctx.lineTo(1000, 440);
    ctx.moveTo(975, 760);
    ctx.lineTo(1025, 760);
    ctx.stroke();
    ctx.fillStyle = 'rgba(200,220,215,0.45)';
    ctx.fillRect(985, 445, 30, 50);
    ctx.strokeStyle = 'rgba(200,220,215,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(1000, 495);
    ctx.quadraticCurveTo(960, 600, 880, 610);
    ctx.stroke();

    // Cortina en su riel, medio arrancada, que se mueve un poco
    ctx.strokeStyle = '#4a5550';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(150, 140);
    ctx.lineTo(560, 160);
    ctx.stroke();
    const sway = Math.sin(t * 0.8) * 6;
    ctx.fillStyle = 'rgba(150,175,165,0.55)';
    ctx.beginPath();
    ctx.moveTo(160, 142);
    for (let k = 0; k <= 8; k++) ctx.lineTo(160 + k * 30, 143 + k + (k % 2 ? 8 : 0));
    ctx.lineTo(400 + sway, 520);
    ctx.lineTo(330 + sway * 1.5, 600);
    ctx.lineTo(250 + sway, 540);
    ctx.lineTo(180 + sway * 0.5, 610);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,50,45,0.6)';
    ctx.lineWidth = 2;
    for (let k = 1; k < 8; k++) {
      ctx.beginPath();
      ctx.moveTo(160 + k * 30, 150);
      ctx.lineTo(170 + k * 28 + sway, 560);
      ctx.stroke();
    }

    // Lámpara quirúrgica que parpadea
    const on = Math.sin(t * 9) > -0.8 || Math.random() > 0.6;
    lampCone(ctx, 830, 30, 620, 680, on ? 0.16 : 0.03, '210,240,230');
  },

  comms(ctx, t) {
    const back = { x: 500, y: 240, w: 600, h: 360 };
    roomBox(ctx, back, { wall: '#18221f', floor: '#111816', side: '#151e1b' });
    // Ventanilla con la antena
    ctx.fillStyle = '#020407';
    ctx.beginPath();
    ctx.roundRect(640, 270, 320, 160, 30);
    ctx.fill();
    ctx.strokeStyle = '#7a8a90';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(800, 470, 120, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(800, 470);
    ctx.lineTo(800, 300);
    ctx.stroke();
    // Consola con pantallas de onda
    ctx.fillStyle = '#1f2a27';
    ctx.fillRect(160, 600, 1280, 60);
    for (let i = 0; i < 4; i++) {
      const x = 220 + i * 300;
      ctx.fillStyle = '#06100d';
      ctx.fillRect(x, 480, 240, 110);
      ctx.strokeStyle = 'rgba(100,255,190,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k <= 240; k += 6) {
        const y = 535 + Math.sin(k * 0.08 + t * (3 + i)) * 20 * Math.sin(t * 0.7 + i);
        k ? ctx.lineTo(x + k, y) : ctx.moveTo(x + k, y);
      }
      ctx.stroke();
    }
    // Silla del operador
    ctx.fillStyle = '#26312d';
    ctx.fillRect(720, 690, 160, 30);
    ctx.fillRect(785, 720, 30, 120);
  },
};

/** Pasillo largo con marcos que se alejan y una compuerta al fondo. */
export function drawCorridor(ctx, t, label, phase) {
  ctx.fillStyle = '#0b0d10';
  ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
  const vx = 800;
  const vy = 430;
  for (let i = 0; i < 9; i++) {
    const k = Math.pow(0.7, i);
    const w = 1500 * k;
    const h = 860 * k;
    const x = vx - w / 2;
    const y = vy - h / 2;
    ctx.strokeStyle = `rgba(150,160,170,${0.5 * k + 0.08})`;
    ctx.lineWidth = 18 * k + 1;
    ctx.strokeRect(x, y, w, h);
    // Tubos de luz del techo; algunos fallan
    const working = Math.sin(t * 7 + i * 3 + phase) > -0.95;
    ctx.fillStyle = working ? `rgba(220,235,255,${0.55 * k + 0.1})` : 'rgba(40,40,40,0.4)';
    ctx.fillRect(vx - w * 0.15, y + 6 * k, w * 0.3, 10 * k + 2);
  }
  // Compuerta del fondo
  ctx.fillStyle = '#1a1e22';
  ctx.fillRect(vx - 55, vy - 80, 110, 160);
  ctx.fillStyle = '#c9a21f';
  ctx.fillRect(vx - 55, vy + 64, 110, 16);
  sign(ctx, label, vx, 150, '#bfd2e0');
}

// -------------------------------------------------------------
// Triángulos de aviso (desde las 3 AM de la noche 3): color por enemigo,
// visibles NIGHT3.WARNINGS.SHOW s y ocultos HIDE s, todos a la vez.
// -------------------------------------------------------------

/** Color del triángulo de un enemigo ('largo', 'specimen', 'frozen', 'insecto'). */
export function warnColor(id) {
  return NIGHT3.WARNINGS.COLORS[id] ?? '#ffffff';
}

/** ¿Están en su fase visible los triángulos del plano? (cameras.warnT cuenta desde que se activaron) */
export function warningsVisible(cameras) {
  const { SHOW, HIDE } = NIGHT3.WARNINGS;
  return ((cameras.warnT ?? 0) % (SHOW + HIDE)) < SHOW;
}

/** Un triángulo de aviso ⚠ centrado en (x, y). */
export function drawWarnTriangle(ctx, x, y, color, alpha = 1, size = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.strokeStyle = '#120a10';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(11, 9);
  ctx.lineTo(-11, 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#120a10';
  ctx.font = 'bold 14px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', 0, 1);
  ctx.restore();
}

/** Leyenda pequeña abajo del plano: color = enemigo. */
function drawWarningLegend(ctx) {
  const { COLORS, LEGEND } = NIGHT3.WARNINGS;
  ctx.save();
  ctx.font = '11px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let x = 1060;
  const y = 864;
  for (const [id, name] of Object.entries(LEGEND)) {
    ctx.save();
    ctx.translate(x + 6, y);
    ctx.scale(0.5, 0.5);
    ctx.fillStyle = COLORS[id];
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(11, 9);
    ctx.lineTo(-11, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(200,215,205,0.75)';
    ctx.fillText(name, x + 15, y + 1);
    x += 18 + ctx.measureText(name).width + 14;
  }
  ctx.restore();
}
