// =============================================================
// Night4Repair.js — NOCHE 4, CAMINO B: REPARAR LAS CÁMARAS.
// (Valores en NIGHT4.REPAIR y NIGHT4.LARGO, src/night/night4.js.)
// Es un minijuego (fuera del turno de cámaras): según la norma de voces,
// aquí no habla el hombre de la cinta.
//
// Exploración libre como en la noche 2.5: salidas = conexiones del plano
// (clic), linterna con ESPACIO (el haz sigue al ratón). Se llega por el
// PASILLO CENTRAL (v0.36): empieza en el Comedor. Las compuertas de los
// lados de la oficina no se mueven (sin energía) hasta reparar todas las
// cámaras; desde la oficina solo se sale por el pasillo central.
// Salas en 3D con las puertas hondas (rp_<sala>, tools/3d/salas/puertas_n4.py).
//
// v0.38: en cada sala hay que reparar SU CÁMARA DE SEGURIDAD, en una esquina
// alta (tools/3d/paneles.py: n4_camara, n4_camara_tapa, n4_camara_abierta).
// Como el panel del fusible:
//   - No se ve hasta que se la enfoca con la LINTERNA.
//   - CLIC en ella (iluminada): vista de cerca. Otro CLIC: vuelves a la sala
//     (es «girarse»); lo hecho se conserva.
//   - Ratón sobre un tornillo + MANTENER ESPACIO: desatornillar (SCREW_TIME s
//     cada uno). Con los 4 fuera se quita la tapa y se CAMBIA LA LENTE (clic
//     en la rota y clic en la de repuesto); luego se atornillan otra vez los 4.
// Al entrar en una sala NO hay enemigos: solo aparecen MIENTRAS SE REPARA,
// como Rat y Cat en FNaC 3:
//   1. Se ASOMA por la esquina de una de las puertas de la sala (se oye
//      por ese lado). Hay que soltar el panel y alumbrarlo ahí: con
//      PEEK_LIGHT s de luz se va. Si pasan PEEK_TIME s, entra.
//   2. DENTRO de la sala: la mecánica de la luz de la 2.5 (invisible hasta
//      que se le alumbra; luz en la cara; cambia de postura 2 s o de sitio
//      3,5 s; con RETIRE_TIME s de luz en la cara se va). Salir de la sala
//      con él dentro = muerte.
// En el minimapa (arriba a la derecha) se marcan las cámaras reparadas.
//
// Con todas reparadas, al ir a la oficina (desde un corredor, o desde el
// Comedor por el pasillo central) El Largo está en esa sala ATACANDO A UN
// SLIME. Enfrentamiento con la luz, más largo (NIGHT4.LARGO.CHANGES
// cambios antes de retirarse). Después el slime (Slaimi) te sigue a la
// oficina y empieza el turno: Game._n4Begin('B').
//
// Punto de control 'n4b' (Game): si mueres, Continuar vuelve a la oficina
// con las cámaras ya reparadas guardadas (flags n4rep_<sala>).
// =============================================================

import { CONFIG } from '../config.js';
import { NIGHT4 } from '../night/night4.js';
import { N2END } from '../night/night2ending.js';
import { Flashlight } from '../render/Flashlight.js';
import { setEyeShine } from '../render/CreatureArt.js';
import { FirstPersonView, OFFICE_EXITS, ROOM_SPOTS, POSES, faceOf, drawEnemy, exitLayout } from '../render/FirstPersonView.js';
import { roomExits } from './Night2Ending.js';
import { BackView, BACK_HATCH } from '../render/BackView.js';
import { OfficeTurn } from '../systems/OfficeTurn.js';
import { drawSlaimi, slaimiAnimReady } from '../systems/Slaimi.js';
import { ROOMS } from '../world/StationMap.js';

const R = NIGHT4.REPAIR;
const L = NIGHT4.LARGO;
const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const rand = ([a, b]) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const OFFICE_DOOR_ROOM = { left: 'westHall', right: 'eastHall' };
// Panel en una esquina de abajo de cada sala (las salidas están a media altura)
// v0.39: la cámara de seguridad está DENTRO del render de cada sala (colgada
// del techo en una esquina alta; rpcam_<sala> = la sala con la cámara). Su
// rectángulo sale de assets/salas/rp_datos.json (tools/3d/salas/puertas_n4.py).
const CAM_RECT = { left: { x: 279, y: 99, w: 146, h: 110 }, right: { x: 1175, y: 99, w: 146, h: 110 } };
let RP = {};
fetch('assets/salas/rp_datos.json').then((r) => r.json()).then((d) => { RP = d; }).catch(() => {});
// Vista de cerca (n4_camara_tapa / _abierta; assets/salas/n4_paneles.json → 'camara_cerca')
const SCREWS = [{ x: 564, y: 759, w: 51, h: 59 }, { x: 1115, y: 712, w: 37, h: 49 },
  { x: 564, y: 423, w: 51, h: 54 }, { x: 1115, y: 427, w: 37, h: 46 }];
// Enemigos asomados (tools/3d/asomarse.py): solo la cabeza y los dedos en el
// marco. El canto del marco está en la columna EDGE de la imagen; cz = altura
// (m) del centro de la imagen, span = m que cubre a lo alto.
const PEEK_ART = { edge: 0.42, span: 1.6, aspect: 600 / 900, cz: { specimen: 2.25, largo: 1.75 },
  face: { specimen: [0.35, 2.37], largo: [0.2, 1.75] } };
const DOOR_H_M = 3.6;   // alto de una compuerta (m)
// Con la tapa quitada se CAMBIA LA LENTE (v0.40, como dice la cinta de la mujer):
// clic en la lente rota para sacarla y clic en la de repuesto para ponerla.
const LENS = { x: 110, y: 450, w: 290, h: 390 };      // la lente (a la izquierda de la carcasa)
const LENS_C = { x: 285, y: 648, rx: 80, ry: 175 };   // su cristal, para dibujar encima
const SPARE = { x: 1330, y: 640, w: 200, h: 170 };    // la lente de repuesto (de la bolsa)
const LENS_TIME = 0.5;                                // s que tarda en encajar la nueva
// Comedor: salida al pasillo central (a la derecha; en 3D en rp_mess, v0.39)
const MESS_CENTRAL_DEF = { x: 1295, y: 344, w: 167, h: 212 };
const messCentral = () => RP.mess?.central ?? MESS_CENTRAL_DEF;
// Sonidos de la biblioteca de cada enemigo
const SND = {
  largo: { breath: 'largo/respiracion', steps: 'largo/pasos', growl: 'largo/grunido', stepGap: 1.1 },
  specimen: { breath: 'criaturas/respiracion', steps: 'pasos/metal', growl: 'criaturas/grunido', stepGap: 0.45 },
};
// Dónde está el slime en el enfrentamiento y dónde El Largo le ataca
const SLIME_SPOT = [760, 860];
const LARGO_SPOTS = [[930, 880, 620], [560, 860, 600], [1080, 860, 640], [700, 830, 560]];

export class Night4Repair {
  constructor(game) {
    this.g = game;
    this.flash = new Flashlight();
    this.view = new FirstPersonView(game.cameraView);
    this.look = new OfficeTurn();
    this.backView = new BackView();
    this.backView.sprites = game.sprites;
    this.start();
  }

  start() {
    const flags = this.g.save?.flags ?? {};
    // Paneles reparados (se conservan si se vuelve desde el punto de control)
    this.repaired = new Set(R.ROOMS.filter((r) => flags[`n4rep_${r}`]));
    this.progress = {};          // sala → 0..1 de su cámara
    this.screws = {};            // sala → { stage: 'abrir'|'lente'|'cerrar', s: [4 × 0..1], t }
    this.spaceDown = false;
    this.where = 'office';       // 'office' | 'room' | 'panel' | 'encounter' | 'follow'
    this.room = 'office';
    this.peek = null;            // enemigo asomado: { exit, enemy, t, lit }
    this.peekIn = null;          // s de botón mantenido hasta el siguiente aviso
    this.enemy = null;           // enemigo dentro de la sala (mecánica de la luz)
    this.mouse = { x: W / 2, y: H / 2 };
    this.time = 0;
    this.msg = null;
    this.msgTime = 0;
    this.calm = 0;
    this.done = false;
    this.log = [];               // registro (pruebas automáticas)
    this.flash.reset();
    this.flash.taken = true;
    this.look.reset();
    this.look.enabled = true;
    this.view.officeDrawer = (c) => this._drawOffice(c, 'front');
    // La cinta de la mujer (ruta B), al empezar a reparar
    this.g.tape.schedule('4B', { autoplay: true, contexto: 'minijuego' });
    // Se llega por el pasillo central: al Comedor
    this._enter('mess');
    this._say(this.repaired.size ? `Camaras reparadas: ${this.repaired.size}/${R.ROOMS.length}` : 'Repara la camara de cada sala. ESPACIO: linterna', 3.5);
  }

  get allRepaired() {
    return R.ROOMS.every((r) => this.repaired.has(r));
  }

  _note(type, data = {}) {
    this.log.push({ t: +this.time.toFixed(2), type, ...data });
  }

  _say(text, time = 2.5) {
    this.msg = text;
    this.msgTime = time;
  }

  _play(key, opts = {}) {
    return this.g.audio.lib?.play(key, opts) ?? false;
  }

  // ---------------------------------------------------------------
  // Salidas
  // ---------------------------------------------------------------

  /** [{ slot, to, rect }] de la sala actual (el Comedor tiene además el pasillo central). */
  _exits() {
    if (this.room === 'office') return [];
    const list = exitLayout(roomExits(this.room), this.room, this.view.cam.sprites);
    if (this.room === 'mess') list.push({ slot: 'central', to: 'office', rect: messCentral() });
    return list;
  }

  _exitAt(x, y) {
    return this._exits().find(({ rect }) => inside(rect, x, y)) ?? null;
  }

  /** La cámara de seguridad de la sala (rectángulo en pantalla). */
  _camRect(room = this.room) {
    return RP[room]?.camara ?? CAM_RECT[R.CORNER[room] ?? 'right'];
  }

  /** ¿La linterna está sobre la cámara? (solo así se ve y se puede abrir) */
  _camLit() {
    const r = this._camRect();
    return this.flash.on && !this.flash.blinkOff && inside({ x: r.x - 20, y: r.y - 20, w: r.w + 40, h: r.h + 40 }, this.mouse.x, this.mouse.y);
  }

  _screwState(room = this.room) {
    if (!this.screws[room]) this.screws[room] = { stage: 'abrir', s: [0, 0, 0, 0], t: 0 };
    return this.screws[room];
  }

  /** Tornillo bajo el ratón (índice) o -1. */
  _screwAt(x, y) {
    return SCREWS.findIndex((r) => inside({ x: r.x - 18, y: r.y - 18, w: r.w + 36, h: r.h + 36 }, x, y));
  }


  _enter(room) {
    this.room = room;
    this.peek = null;
    this.enemy = null;
    this.where = room === 'office' ? 'office' : 'room';
    this.look.reset();
    this.look.enabled = room === 'office';
    this.peekIn = rand(R.PEEK_FIRST);
    this._play('pasos/metal', { volume: 0.25 });
    this._note('entra', { sala: room });
    if (room === 'office') {
      this._say(this.allRepaired ? 'Camaras en linea' : `Faltan ${R.ROOMS.length - this.repaired.size} camaras por reparar`, 2.5);
    } else if (!this.repaired.has(room)) this._say(`${ROOMS[room].name}: la camara esta arriba, en una esquina`, 2);
  }

  _go(exit) {
    if (this.enemy && this.enemy.state !== 'gone') return this._die(this.enemy.enemy, 'salir');
    if (exit.to === 'office' && this.allRepaired && !this.met) return this._startEncounter();
    this._enter(exit.to);
  }

  // ---------------------------------------------------------------
  // Enemigos (mecánica de la luz de la noche 2.5)
  // ---------------------------------------------------------------

  _newEnemy(enemy, spots, tune) {
    return {
      enemy, spots, spot: Math.floor(Math.random() * spots.length), pose: pick(POSES[enemy]),
      state: 'waiting', findLeft: tune.find, lit: 0, evadeIn: rand(N2END.EVADE_EVERY), window: 0, changes: 0, tune,
      heights: spots.map((s) => s[2] ?? rand(N2END.ENEMY_HEIGHT)),
    };
  }

  _pos(e) {
    const [x, y] = e.spots[e.spot];
    return [x, y, e.heights[e.spot]];
  }

  _face(e) {
    const [x, y, h] = this._pos(e);
    return faceOf(e.enemy, e.pose, x, y, h, N2END.FACE_RADIUS, N2END.FACE_RADIUS_MIN);
  }

  _faceLit(e) {
    if (this.where === 'panel' || !this.flash.on || this.flash.blinkOff) return false;
    const f = this._face(e);
    return Math.hypot(this.mouse.x - f.x, this.mouse.y - f.y) < f.r;
  }

  /** La mecánica de la luz. Devuelve 'retirado' si se va. */
  _updateLight(e, dt) {
    const lit = this._faceLit(e);
    const T = e.tune;
    switch (e.state) {
      case 'waiting':
        if (lit) {
          e.state = 'lit';
          this._note('enfocado', { enemigo: e.enemy });
          return null;
        }
        e.findLeft -= dt;
        if (e.findLeft <= 0) this._die(e.enemy, 'no lo encontró');
        return null;
      case 'lit':
        if (!lit) {
          e.state = 'lost';
          e.window = T.pose;
          return null;
        }
        e.lit += dt;
        if (e.lit >= T.retire && e.changes >= (T.changes ?? 0)) return this._retire(e);
        e.evadeIn -= dt;
        if (e.evadeIn <= 0) this._evade(e);
        return null;
      case 'dodge':
      case 'lost':
        if (lit) {
          e.state = 'lit';
          return null;
        }
        e.window -= dt;
        if (e.window <= 0) this._die(e.enemy, e.why ?? 'perdió la cara');
        return null;
    }
    return null;
  }

  _evade(e) {
    e.movedAt = this.time;
    e.evadeIn = rand(N2END.EVADE_EVERY);
    e.state = 'dodge';
    e.changes++;
    if (Math.random() < N2END.MOVE_CHANCE && e.spots.length > 1) {
      let s = e.spot;
      while (s === e.spot) s = Math.floor(Math.random() * e.spots.length);
      e.spot = s;
      e.pose = pick(POSES[e.enemy]);
      e.window = e.tune.move;
      e.why = 'cambió de sitio';
      this._play(SND[e.enemy].steps, { volume: 0.5, pitchVar: 0.05 });
      this._note('cambia de sitio', { enemigo: e.enemy, cambios: e.changes });
    } else {
      const others = POSES[e.enemy].filter((p) => p !== e.pose);
      e.pose = pick(others);
      e.window = e.tune.pose;
      e.why = 'cambió de postura';
      this._note('cambia de postura', { enemigo: e.enemy, cambios: e.changes });
    }
  }

  _retire(e) {
    e.state = 'gone';
    const s = SND[e.enemy];
    [0.8, 0.5, 0.25].forEach((v, i) => this._play(s.steps, { volume: v, when: 0.2 + i * s.stepGap, muffle: 0.2 + i * 0.25 }));
    this.flash.blink(N2END.RETIRE_FLICKERS, N2END.RETIRE_FLICKER_TIME);
    this.calm = N2END.RETIRE_FLICKER_TIME + 1;
    this._note('se retira', { enemigo: e.enemy });
    return 'retirado';
  }

  // --- Fase 1: asomado en una puerta ---
  _startPeek() {
    const exits = this._exits().filter((x) => x.slot !== 'central' || this.room === 'mess');
    if (!exits.length) return;
    const exit = pick(exits);
    const pool = R.ENEMIES.filter((e) => !this.g.n4dbg?.off.has(e));   // (modo debug: enemigos apagados)
    if (!pool.length) return;
    const enemy = pick(pool);
    const pan = (exit.rect.x + exit.rect.w / 2) / W * 1.6 - 0.8;
    if (Math.random() >= R.PEEK_CHANCE) {
      // Solo un ruido por ese lado (tensión sin enemigo)
      this._play('ambiente/crujido', { volume: 0.5, pan });
      this._note('ruido', { puerta: exit.to });
      return;
    }
    // Asomado NO hace ningún ruido (v0.39): solo se le descubre mirando
    this.peek = { exit, enemy, t: R.PEEK_TIME, lit: 0, pan, side: exit.rect.x + exit.rect.w / 2 < W / 2 ? 1 : -1 };
    this._note('se asoma', { enemigo: enemy, puerta: exit.to });
  }

  /** Punto donde se le ve asomado: su cara, junto al canto del marco. */
  _peekPoint(p) {
    const r = p.exit.rect;
    const e = this._peekEdge(p);
    const pxm = r.h / DOOR_H_M;
    const [fx, fz] = PEEK_ART.face[p.enemy];
    return { x: e.x + e.dir * fx * pxm, y: r.y + r.h - fz * pxm };
  }

  _peekLit(p) {
    if (this.where !== 'room' || !this.flash.on || this.flash.blinkOff) return false;
    const pt = this._peekPoint(p);
    return Math.hypot(this.mouse.x - pt.x, this.mouse.y - pt.y) < Math.max(70, p.exit.rect.w * 0.45);
  }

  _updatePeek(dt) {
    const p = this.peek;
    if (this._peekLit(p)) {
      p.lit += dt;
      if (p.lit >= R.PEEK_LIGHT) {
        this.peek = null;            // (se retira en silencio)
        this.flash.blink(2, 0.4);
        this.calm = 1.2;
        this._note('se va de la puerta', { enemigo: p.enemy });
      }
      return;
    }
    p.t -= dt;
    if (p.t <= 0) {
      // Entra en la sala: la mecánica de la luz normal
      this.peek = null;
      this.enemy = this._newEnemy(p.enemy, ROOM_SPOTS, { find: R.INSIDE_KILL, pose: R.POSE_WINDOW, move: R.MOVE_WINDOW, retire: R.RETIRE_TIME });
      // Al entrar, un sonido MUY leve: un paso suave, un roce o una respiración
      const leve = pick([SND[p.enemy].steps, SND[p.enemy].breath, 'ambiente/crujido']);
      this._play(leve, { volume: R.ENTER_VOLUME, pan: p.pan * 0.5, muffle: 0.55, volVar: 0.05 });
      this._note('entra en la sala', { enemigo: p.enemy });
    }
  }

  // ---------------------------------------------------------------
  // El Largo y el slime
  // ---------------------------------------------------------------

  _startEncounter() {
    this.where = 'encounter';
    this.met = true;
    this.encT = 0;
    this.peek = null;
    this.enemy = null;
    this.largo = this._newEnemy('largo', LARGO_SPOTS, {
      find: L.FIND_TIME, pose: L.POSE_WINDOW, move: L.MOVE_WINDOW, retire: L.RETIRE_TIME, changes: L.CHANGES,
    });
    this.largo.spot = 0;
    this.largo.pose = 'crouch';
    this.largo.state = 'intro';
    this._play('largo/grunido', { volume: 1 });
    this._play('criaturas/chillido', { volume: 0.5, when: 0.3, pitch: 1.8 });
    this._say('¡El Largo esta atacando a algo!', 2.2);
    this._note('enfrentamiento', { sala: this.room });
    this.g._n4Checkpoint?.('n4b');
  }

  _updateEncounter(dt) {
    this.encT += dt;
    const e = this.largo;
    if (e.state === 'intro') {
      if (this.encT >= L.INTRO) {
        e.state = 'waiting';
        e.pose = 'stand';
        this._play('largo/respiracion', { volume: 1 });
      }
      return;
    }
    if (this._updateLight(e, dt) === 'retirado') {
      this.where = 'follow';
      this.followT = 0;
      this._say('Se ha ido... El slime te sigue', 3);
      this.g._setFlag?.('slaimiAliado');
    }
  }

  // ---------------------------------------------------------------
  // Bucle
  // ---------------------------------------------------------------

  update(dt) {
    if (this.done) return;
    this.time += dt;
    this.flash.update(dt);
    this.view.update(dt);
    this.look.update(dt);
    this.backView.update(dt);
    this.msgTime = Math.max(0, this.msgTime - dt);
    this.calm = Math.max(0, this.calm - dt);
    if (this.where === 'encounter') return this._updateEncounter(dt);
    if (this.where === 'follow') {
      this.followT += dt;
      if (this.followT >= L.FOLLOW_TIME) {
        this.done = true;
        this.g._n4Begin('B');
      }
      return;
    }
    if (this.room === 'office') return;
    // Reparando: ESPACIO mantenido sobre un tornillo; corre el aviso de los enemigos
    if (this.where === 'panel' && this._updateScrews(dt)) {
      if (!this.peek && !this.enemy && this.calm <= 0) {
        this.peekIn -= dt;
        if (this.peekIn <= 0) {
          this.peekIn = rand(R.PEEK_EVERY);
          this._startPeek();
        }
      }
    }
    if (this.peek) this._updatePeek(dt);
    if (this.done) return;
    if (this.enemy && this.enemy.state !== 'gone' && this._updateLight(this.enemy, dt) === 'retirado') this.enemy = null;
  }

  /** Tornillos (y la tapa). Devuelve true mientras se está trabajando. */
  _updateScrews(dt) {
    const room = this.room;
    const st = this._screwState(room);
    if (st.stage === 'lente') {
      if (st.lens === 'nueva') {
        st.t += dt;
        if (st.t >= LENS_TIME) {
          st.stage = 'cerrar';
          st.s = [0, 0, 0, 0];
          this._play('metal/panel', { volume: 0.35 });
          this._note('lente cambiada', { sala: room });
        }
      }
      this._syncProgress(room);
      return st.lens !== 'rota';
    }
    const i = this._screwAt(this.mouse.x, this.mouse.y);
    if (!this.spaceDown || i < 0 || st.s[i] >= 1) return false;
    st.s[i] = Math.min(1, st.s[i] + dt / R.SCREW_TIME);
    if (Math.random() < dt * 5) this._play('metal/panel', { volume: 0.06, rate: 2.2 });
    if (st.s[i] >= 1) {
      this._play('metal/panel', { volume: 0.25, rate: 1.6 });
      this._note(st.stage === 'abrir' ? 'tornillo fuera' : 'tornillo dentro', { sala: room, tornillo: i });
      if (st.s.every((v) => v >= 1)) {
        if (st.stage === 'abrir') {
          st.stage = 'lente';
          st.lens = 'rota';
          st.t = 0;
          this._play('ambiente/chispazo', { volume: 0.3 });
        } else {
          this._syncProgress(room);
          this._repaired(room);
          return false;
        }
      }
    }
    this._syncProgress(room);
    return true;
  }

  /** 0..1 de la sala: 4 tornillos fuera (40 %), la lente (20 %) y 4 dentro (40 %). */
  _syncProgress(room) {
    const st = this._screwState(room);
    const sum = st.s.reduce((a, b) => a + b, 0) / 4;
    const lente = st.lens === 'fuera' ? 0.1 : st.lens === 'nueva' ? 0.1 + 0.1 * Math.min(1, st.t / LENS_TIME) : 0;
    this.progress[room] = st.stage === 'abrir' ? 0.4 * sum : st.stage === 'lente' ? 0.4 + lente : 0.6 + 0.4 * sum;
  }

  /** Clic con la tapa quitada: sacar la lente rota / poner la de repuesto. true si se usó. */
  _lensClick(x, y) {
    const st = this._screwState();
    if (st.stage !== 'lente') return false;
    if (st.lens === 'rota' && inside(LENS, x, y)) {
      st.lens = 'fuera';
      this._play('metal/cristal', { volume: 0.4 });
      this._note('lente rota fuera', { sala: this.room });
      this._syncProgress(this.room);
      return true;
    }
    if (st.lens === 'fuera' && (inside(SPARE, x, y) || inside(LENS, x, y))) {
      st.lens = 'nueva';
      st.t = 0;
      this._play('metal/panel', { volume: 0.3, rate: 1.4 });
      this._note('lente nueva', { sala: this.room });
      return true;
    }
    return false;
  }

  _repaired(room) {
    this.repaired.add(room);
    this.where = 'room';
    this.spaceDown = false;
    this.g.audio.chime?.();
    this.g._setFlag?.(`n4rep_${room}`);
    this._note('reparada', { sala: room, total: this.repaired.size });
    this._say(this.allRepaired ? 'Todas las camaras reparadas. Vuelve a la oficina' : `Camara reparada (${this.repaired.size}/${R.ROOMS.length})`, 3);
  }

  _die(enemy, why) {
    if (this.done || this.g.n4dbg?.invincible) return;
    this.done = true;
    this._note('muerte', { enemigo: enemy, por: why });
    this.g._n4Death(enemy, why);
  }

  // ---------------------------------------------------------------
  // Entrada
  // ---------------------------------------------------------------

  move(x, y) {
    this.mouse = { x, y };
    if (this.where === 'office') {
      const edge = this.look.hover(x, y);
      if (edge) return true;
      const f = this.look.face;
      return !this.look.moving && ((f === 'left' || f === 'right') ? inside(OFFICE_EXITS[f], x, y) : f === 'back' && inside(BACK_HATCH, x, y));
    }
    if (this.where === 'room') return !!this._exitAt(x, y) || (!this.repaired.has(this.room) && this._camLit());
    if (this.where === 'panel') return true;
    return false;
  }

  click(x, y) {
    this.move(x, y);
    if (this.done) return;
    if (this.where === 'office') {
      if (this.look.moving) return;
      const f = this.look.face;
      if ((f === 'left' || f === 'right') && inside(OFFICE_EXITS[f], x, y)) {
        // Sin energía las compuertas no se mueven: solo el pasillo central
        if (!this.allRepaired) {
          this.g.audio.denied?.(f);
          return this._say('La compuerta no se mueve. Sal por el pasillo central', 2.5);
        }
        return this._enter(OFFICE_DOOR_ROOM[f]);
      }
      if (f === 'back' && inside(BACK_HATCH, x, y)) return this._enter('mess');   // por el pasillo central
      return;
    }
    if (this.where === 'room') {
      if (!this.repaired.has(this.room) && this._camLit()) {
        this.where = 'panel';
        this._screwState();
        this._play('metal/panel', { volume: 0.4 });
        this._note('abre la camara', { sala: this.room });
        return;
      }
      const exit = this._exitAt(x, y);
      if (exit) this._go(exit);
      return;
    }
    // Clic con la cámara abierta: la lente (si toca) o se cierra la vista (girarse)
    if (this.where === 'panel' && !this._lensClick(x, y)) this._closeCam();
  }

  _closeCam() {
    this.where = 'room';
    this.spaceDown = false;
    this._play('metal/panel', { volume: 0.25 });
    this._note('cierra la camara', { sala: this.room, progreso: +(this.progress[this.room] ?? 0).toFixed(2) });
  }

  release() {
    this.spaceDown = false;
  }

  key(code) {
    if (this.done) return;
    if (code === 'Space' && this.where === 'panel') {
      this.spaceDown = true;
    } else if (code === 'Space') {
      this.flash.toggle();
      this.g.audio.keyClick();
    } else if (this.where === 'office') {
      if (code === CONFIG.LOOK_BACK.KEY) this.look.toggle();
      else if (code === 'ArrowLeft' || code === 'ArrowRight') this.look.step(code === 'ArrowLeft' ? -1 : 1);
    } else if (this.where === 'panel' && (code === 'Escape' || code === 'KeyS')) this._closeCam();
  }

  keyUp(code) {
    if (code === 'Space') this.spaceDown = false;
  }

  // ---------------------------------------------------------------
  // Dibujo
  // ---------------------------------------------------------------

  _drawOffice(ctx, face) {
    const g = this.g;
    g.officeView.draw(ctx, g.office, {
      face, blackout: false, noPower: true, locked: true, night: 4, terminal: g.terminal, reactor: g.reactor,
      doorEnemies: { left: [], right: [] }, cameras: g.cameras,
    });
  }

  _drawEnemy(ctx, e) {
    let [x, y, h] = this._pos(e);
    if (e.state === 'lit') x += Math.sin(this.time * 38) * 2.5 * Math.min(1, e.lit);
    const back = e.movedAt !== undefined ? Math.max(0, 1 - (this.time - e.movedAt) / 0.4) : 0;
    setEyeShine(true);
    drawEnemy(ctx, e.enemy, e.pose, x, y, h * (1 - 0.07 * back), this.time);
    setEyeShine(false);
  }

  /** Canto del marco por el que se asoma y hacia dónde sale la cabeza (+1 derecha). */
  _peekEdge(p) {
    const r = p.exit.rect;
    // Puerta a la izquierda de la pantalla: se asoma desde el canto derecho, hacia la izquierda
    return p.side > 0 ? { x: r.x + r.w, dir: -1 } : { x: r.x, dir: 1 };
  }

  _drawPeek(ctx, p) {
    // Solo la cabeza y los dedos en el marco (modelo 3D, asomarse.py)
    const r = p.exit.rect;
    const e = this._peekEdge(p);
    const pxm = r.h / DOOR_H_M;               // píxeles por metro en esa puerta
    const h = PEEK_ART.span * pxm;
    const w = h * PEEK_ART.aspect;
    const k = Math.min(1, (R.PEEK_TIME - p.t) / 0.9);   // sale despacio de detrás del marco
    const cy = r.y + r.h - PEEK_ART.cz[p.enemy] * pxm;
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y - 20, r.w, r.h + 20);
    ctx.clip();
    ctx.translate(e.x - e.dir * (1 - k) * w * 0.25, cy);
    ctx.scale(e.dir, 1);
    this.g.sprites?.draw(ctx, `asoma_${p.enemy}`, -PEEK_ART.edge * w, -h / 2, w, h);
    ctx.restore();
  }

  /** La cámara de la sala (render 3D: la misma sala con la cámara), solo en su sitio. */
  _drawCamCorner(ctx) {
    const r = this._camRect();
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x - 30, 0, r.w + 60, r.y + r.h + 20);   // (con el tubo hasta el techo)
    ctx.clip();
    this.g.sprites?.draw(ctx, `rpcam_${this.room}`, 0, 0, W, H);
    ctx.restore();
    // Piloto: rojo parpadeando (rota) o verde (reparada)
    const done = this.repaired.has(this.room);
    if (done || Math.floor(this.time * 2.5) % 2) {
      ctx.save();
      ctx.fillStyle = done ? 'rgba(77,255,122,0.9)' : 'rgba(255,58,42,0.9)';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(r.x + r.w * 0.5, r.y + r.h * 0.45, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /** Vista de cerca: la tapa con sus tornillos (o abierta, con la placa). */
  _drawCamClose(ctx) {
    const st = this._screwState();
    const key = st.stage === 'lente' ? 'n4_camara_abierta' : 'n4_camara_tapa';
    if (!this.g.sprites?.draw(ctx, key, 0, 0, W, H)) {
      ctx.fillStyle = '#101414';
      ctx.fillRect(0, 0, W, H);
    }
    const hover = this._screwAt(this.mouse.x, this.mouse.y);
    if (st.stage !== 'lente') {
      SCREWS.forEach((r, i) => {
        const v = st.s[i];
        // abrir: el tornillo sale (gira y sube) hasta desaparecer; cerrar: al revés
        const out = st.stage === 'abrir' ? v : 1 - v;
        if (out >= 1) {
          if (st.stage === 'cerrar' && hover === i) this._screwGhost(ctx, r);
          return;
        }
        this._screwHead(ctx, r, out, (st.stage === 'abrir' ? v : -v) * Math.PI * 6, hover === i);
      });
    } else this._drawLens(ctx, st);
    // Progreso de la reparación (abajo)
    const prog = this.progress[this.room] ?? 0;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(W / 2 - 220, 790, 440, 14);
    ctx.fillStyle = '#7dffb0';
    ctx.fillRect(W / 2 - 220, 790, 440 * prog, 14);
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#bfffd6';
    const label = st.stage === 'abrir' ? 'DESATORNILLAR LA TAPA' : st.stage === 'lente'
      ? (st.lens === 'rota' ? 'CLIC EN LA LENTE ROTA' : st.lens === 'fuera' ? 'CLIC EN LA LENTE DE REPUESTO' : 'ENCAJANDO LA LENTE...')
      : 'ATORNILLAR LA TAPA';
    ctx.fillText(`CAM ${ROOMS[this.room].cam}  ·  ${label}  ·  ${Math.floor(prog * 100)}%`, W / 2, 780);
    ctx.restore();
  }

  /** La lente: rota (resaltada), fuera (hueco oscuro) o la nueva encajando; y la de repuesto. */
  _drawLens(ctx, st) {
    const c = LENS_C;
    const hot = inside(LENS, this.mouse.x, this.mouse.y);
    ctx.save();
    if (st.lens === 'rota' && hot) {
      ctx.strokeStyle = 'rgba(255,216,74,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.rx + 14, c.ry + 14, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (st.lens !== 'rota') {
      // Hueco: la lente rota ya no está (el aro vacío y el fondo del tubo)
      ctx.fillStyle = '#020202';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.rx + 6, c.ry + 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(170,175,180,0.75)';
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(60,62,66,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(c.x + 6, c.y, c.rx * 0.55, c.ry * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // La de repuesto: en la esquina (de la bolsa) o llegando a su sitio
    const k = st.lens === 'nueva' ? Math.min(1, st.t / LENS_TIME) : 0;
    {
      const sx = SPARE.x + SPARE.w / 2;
      const sy = SPARE.y + SPARE.h / 2;
      const x = sx + (c.x - sx) * k;
      const y = sy + (c.y - sy) * k;
      const rx = 70 + (c.rx - 70) * k;
      const ry = 70 + (c.ry - 70) * k;
      if (st.lens !== 'nueva' || k < 1) {
        if (k === 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(SPARE.x - 10, SPARE.y - 34, SPARE.w + 20, SPARE.h + 44);
          ctx.fillStyle = '#cfd6dc';
          ctx.font = 'bold 13px "Courier New", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('LENTE DE REPUESTO', sx, SPARE.y - 14);
        }
      }
      {
        const g = ctx.createRadialGradient(x - rx * 0.3, y - ry * 0.3, 2, x, y, Math.max(rx, ry));
        g.addColorStop(0, '#6d7f8f');
        g.addColorStop(0.5, '#1b2530');
        g.addColorStop(1, '#05080b');
        ctx.fillStyle = '#2b2f33';
        ctx.beginPath();
        ctx.ellipse(x, y, rx + 8, ry + 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.ellipse(x - rx * 0.35, y - ry * 0.4, rx * 0.18, ry * 0.12, -0.5, 0, Math.PI * 2);
        ctx.fill();
        if (st.lens === 'fuera' && (inside(SPARE, this.mouse.x, this.mouse.y))) {
          ctx.strokeStyle = 'rgba(255,216,74,0.8)';
          ctx.lineWidth = 3;
          ctx.strokeRect(SPARE.x - 6, SPARE.y - 6, SPARE.w + 12, SPARE.h + 12);
        }
      }
    }
    ctx.restore();
  }

  _screwHead(ctx, r, out, ang, hot) {
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2 - out * 10;
    const rad = r.w * 0.42;
    ctx.save();
    // sombra (más separada cuanto más fuera está)
    ctx.fillStyle = `rgba(0,0,0,${0.35 + out * 0.2})`;
    ctx.beginPath();
    ctx.ellipse(cx + 4 + out * 8, r.y + r.h / 2 + 5 + out * 4, rad, rad * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(cx - rad * 0.35, cy - rad * 0.35, 2, cx, cy, rad);
    g.addColorStop(0, '#e2e4e6');
    g.addColorStop(0.6, '#8a8e92');
    g.addColorStop(1, '#3b3e42');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.fillStyle = '#1b1d20';
    ctx.fillRect(-rad * 0.7, -rad * 0.12, rad * 1.4, rad * 0.24);
    ctx.fillRect(-rad * 0.12, -rad * 0.7, rad * 0.24, rad * 1.4);
    ctx.restore();
    if (hot) {
      ctx.save();
      ctx.strokeStyle = this.spaceDown ? '#ffd84a' : 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, rad + 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  _screwGhost(ctx, r) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r.x + r.w / 2, r.y + r.h / 2, r.w * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /** Minimapa pequeño (arriba a la derecha): cámaras reparadas ✓ y pendientes ✗. */
  _drawMinimap(ctx) {
    const S = 0.5;
    ctx.save();
    ctx.translate(1300 - 1042 * S, 14 - 446 * S);
    ctx.scale(S, S);
    const pending = new Set(R.ROOMS.filter((r) => !this.repaired.has(r)));
    this.g.cameraView._drawMinimap(ctx, this.room === 'office' ? null : this.room, { broken: pending, repaired: this.repaired }, { night: 4 });
    ctx.restore();
    ctx.save();
    ctx.fillStyle = '#bfffd6';
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`REPARADAS ${this.repaired.size}/${R.ROOMS.length}`, 1565, 250);
    ctx.restore();
  }

  draw(ctx) {
    const g = this.g;
    const { x: mx, y: my } = this.mouse;
    let hint = '';
    switch (this.where) {
      case 'office':
        this.look.draw(ctx, {
          front: (c) => this._drawOffice(c, 'front'),
          left: (c) => this._drawOffice(c, 'left'),
          right: (c) => this._drawOffice(c, 'right'),
          back: (c) => this.backView.draw(c, { open: 1 }),
        });
        this.flash.draw(ctx, mx, my);
        this.look.drawStrips(ctx);
        hint = 'ESPACIO: linterna   ·   Clic en una compuerta (o en el pasillo central) para salir   ·   Ratón a un borde: girar';
        break;
      case 'room':
      case 'encounter':
      case 'follow': {
        const exits = this._exits();
        this.view.drawRoom(ctx, this.room, exits.filter((x) => x.slot !== 'central'), { image: `rp_${this.room}`, signs: false, extras: false });
        this.flash.draw(ctx, mx, my);
        if (this.where === 'room') {
          // La cámara de la esquina solo existe dentro del haz
          this.flash.reveal(ctx, mx, my, (c) => this._drawCamCorner(c));
          if (this.peek) this.flash.reveal(ctx, mx, my, (c) => this._drawPeek(c, this.peek));
          if (this.enemy && this.enemy.state !== 'gone') this.flash.reveal(ctx, mx, my, (c) => this._drawEnemy(c, this.enemy));
          hint = this.repaired.has(this.room) ? 'ESPACIO: linterna   ·   Clic en una salida' : 'Busca la camara con la linterna y haz clic en ella   ·   ESPACIO: linterna';
        } else this._drawEncounter(ctx, mx, my);
        break;
      }
      case 'panel':
        this._drawCamClose(ctx);
        hint = 'Raton sobre un tornillo + MANTEN ESPACIO   ·   Clic: cerrar y mirar la sala';
        break;
    }
    if (this.where !== 'follow' && this.where !== 'encounter') this._drawMinimap(ctx);
    g.effects.vignette(ctx, 0.8);
    g.effects.static(ctx, 0.04);
    this.view.drawHint(ctx, hint, this.msgTime > 0 ? this.msg : null);
  }

  _drawEncounter(ctx, mx, my) {
    // El slime brilla un poco (se le ve sin linterna); El Largo, inclinado sobre él
    const e = this.largo;
    const glow = ctx.createRadialGradient(SLIME_SPOT[0], SLIME_SPOT[1] - 60, 10, SLIME_SPOT[0], SLIME_SPOT[1] - 60, 260);
    glow.addColorStop(0, 'rgba(100,150,255,0.22)');
    glow.addColorStop(1, 'rgba(100,150,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    if (this.where === 'follow') {
      // Slaimi se acerca saltando hacia ti
      const k = Math.min(1, this.followT / L.FOLLOW_TIME);
      const hop = Math.abs(Math.sin(this.followT * 5));
      if (slaimiAnimReady('seguir')) {
        // La animación «seguir» ya lleva los saltos (uno cada π/5 s)
        drawSlaimi(ctx, SLIME_SPOT[0] + 40 * k, SLIME_SPOT[1] + 30 * k, 130 + 260 * k, { t: this.time, pose: 'seguir', phase: this.followT * 5 / Math.PI });
      } else {
        drawSlaimi(ctx, SLIME_SPOT[0] + 40 * k, SLIME_SPOT[1] + 30 * k - hop * 60, 130 + 260 * k, { t: this.time, stretch: hop * 0.15, squash: 1 - hop, sprites: this.g.sprites });
      }
      return;
    }
    const scared = e.state === 'intro';
    drawSlaimi(ctx, SLIME_SPOT[0], SLIME_SPOT[1], 120, { t: this.time, sad: true, squash: scared ? 0.5 + 0.5 * Math.sin(this.time * 18) : 0.2, sprites: this.g.sprites });
    if (scared) {
      // Se le ve atacando a contraluz del slime
      ctx.save();
      ctx.globalAlpha = 0.85;
      this._drawEnemy(ctx, e);
      ctx.restore();
    } else if (e.state !== 'gone') this.flash.reveal(ctx, mx, my, (c) => this._drawEnemy(c, e));
    // Cambios que faltan (para saber cuánto queda)
    if (!scared && e.state !== 'gone') {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(232,238,245,0.6)';
      ctx.font = '16px "Courier New", monospace';
      ctx.fillText('Mantenle la luz en la cara', W / 2, 860);
      ctx.restore();
    }
  }
}

