// =============================================================
// Night2Ending.js — FINAL DE LA NOCHE 2 (lo crea y lo usa Game en el
// estado 'final'). Valores ajustables en src/night/night2ending.js;
// dibujo en src/render/FirstPersonView.js, Flashlight.js y OfficeView.js.
//
// Controles: ESPACIO enciende/apaga la linterna (antes hay que cogerla
// de la mesa con un clic); el haz sigue al ratón. Todo lo demás, clic.
//
// SIN ENERGÍA en todo el final: los botones de las puertas de la oficina
// no responden ("Sin energía") y ninguna puerta se puede cerrar.
//
// FASE 1 — de la oficina al reactor, EXPLORANDO LIBREMENTE
//   'office'  → a oscuras. Clic en la linterna (mesa) para cogerla: en
//               ese instante empieza la CINTA DE LA MUJER ("audio 2.5",
//               CONFIG.TAPES.mujer; norma de voces: solo en minijuegos).
//               AQUÍ EMPIEZA EL MINIJUEGO.
//               ENEMIGO EN UNA PUERTA (N2END.OFFICE_ENEMY_*): a veces
//               alguien se asoma a una de las dos puertas (aviso por ese
//               lado). Invisible sin luz; se le aparta con la mecánica de
//               la luz. Salir con él ahí = fallo.
//               Clic en un pasillo para salir: izquierda → Corredor Oeste,
//               derecha → Corredor Este. El pasillo central (nuevo) está
//               sellado.
//   'room'    → cualquier sala. Sus SALIDAS son sus conexiones del plano
//               (LINKS de StationMap.js), cada una con la sala a la que
//               lleva al fondo. Al entrar puede haber un enemigo
//               (N2END.P1_ROOM_CHANCE; al menos uno antes del reactor).
//   'reactor' → consola (clic para escribir), pósit con /refresh y la
//               GRABADORA DEL HOMBRE (solo con la linterna; PUNTO DE LORE).
// FASE 2 — aguantar N2END.COOL_TIME s (2:00) en la sala del reactor
//   (iluminada), mirando a tres pasillos sin puertas con su sala real al
//   fondo. Haz más pequeño y más débil, sonidos más bajos y enemigos más
//   agresivos según sube el %. C abre la consola.
// FASE 3 — al 100 %: megafonía, luces rojas, puertas abriéndose por toda
//   la nave ('alarm') y HUIDA ('escape'): N2END.ESCAPE.TIME s para volver
//   a la oficina POR DONDE SE QUIERA, con menos enemigos
//   (ESCAPE.ROOM_CHANCE, como mucho ESCAPE.MAX_ENEMIES). En la oficina
//   ('escapeOffice') se para la cuenta atrás; puede haber alguien en una
//   puerta (se aparta con la luz). Las puertas no se pueden cerrar.
// FASE 4 — la vista se acerca al PASILLO NUEVO (abierto por el protocolo
//   de contención) y al fondo algo se mueve un instante ('scene'). Fin de
//   la noche 2: Game._finalWin guarda la noche 3 y el pasillo abierto.
//
// MECÁNICA DE LA LUZ (enemigos dentro de una sala y en los pasillos)
//   Invisibles hasta que les da la linterna. Hay un tiempo para darles
//   con la luz EN LA CARA; con la luz en la cara intentan apartarse:
//     - cambian de POSTURA → POSE_WINDOW s para volver a enfocar la cara
//     - cambian de SITIO   → MOVE_WINDOW s para encontrarlo y enfocarlo
//   Con RETIRE_TIME s de luz en la cara se retiran (la linterna parpadea
//   y mientras parpadea no aparece ninguno). Si no se reacciona, atacan.
// =============================================================

import { N2END } from '../night/night2ending.js';
import { Terminal } from '../ui/Terminal.js';
import { Flashlight } from '../render/Flashlight.js';
import { setEyeShine } from '../render/CreatureArt.js';
import {
  FirstPersonView, FLASH_DESK, OFFICE_EXITS, EXIT_SLOTS, exitLayout, REACTOR_CONSOLE, LORE_TERMINAL, RECORDER,
  CONSOLE_TAB, CORRIDORS, CORRIDOR_SPOTS, ROOM_SPOTS, OFFICE_SPOTS, p2Area, POSES, faceOf, drawEnemy, roomNotes,
} from '../render/FirstPersonView.js';
import { neighbors } from '../world/StationMap.js';

/** Salas que quedan hasta la oficina (contando esta), por el camino más corto. */
function distToOffice(room) {
  const seen = new Set([room]);
  let ring = [room];
  for (let d = 0; ring.length && d < 20; d++) {
    if (ring.includes('office')) return d;
    const next = [];
    for (const r of ring) {
      // los corredores dan a la oficina (por sus compuertas)
      for (const n of [...neighbors(r), ...(r === 'westHall' || r === 'eastHall' ? ['office'] : [])]) {
        if (!seen.has(n)) { seen.add(n); next.push(n); }
      }
    }
    ring = next;
  }
  return 99;
}
import { BackView, BACK_HATCH } from '../render/BackView.js';
import { OfficeTurn } from '../systems/OfficeTurn.js';
import { NoteOverlay } from '../ui/NoteOverlay.js';
import { OFFICE_NOTES, PLACA_DE_NOCHE } from '../world/Notes.js';
import { CONFIG } from '../config.js';

const rand = ([a, b]) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const PAN = { left: -0.75, center: 0, right: 0.75 };
// Puertas de la oficina y a qué sala lleva cada una
const OFFICE_DOOR_ROOM = { left: 'westHall', right: 'eastHall' };
const DOOR_HALL = { left_door: 'westHall', right_door: 'eastHall' };
const who = () => (Math.random() < 0.5 ? 'largo' : 'specimen');

/** Salas a las que se puede ir desde una sala (conexiones del plano). */
export function roomExits(room) {
  if (room === 'office') return ['westHall', 'eastHall'];
  return neighbors(room).map((id) => (id === 'left_door' || id === 'right_door' ? 'office' : id))
    .filter((id, i, list) => list.indexOf(id) === i && (id === 'office' || DOOR_HALL[id] === undefined));
}

// Sonidos de la biblioteca de cada enemigo (El Largo: los suyos, graves)
const SND = {
  largo: { breath: 'largo/respiracion', steps: 'largo/pasos', growl: 'largo/grunido', stepGap: 1.1 },
  specimen: { breath: 'criaturas/respiracion', steps: 'pasos/metal', growl: 'criaturas/grunido', stepGap: 0.45 },
};

export class Night2Ending {
  constructor(game) {
    this.g = game;
    this.flash = new Flashlight();
    this.term = new Terminal();
    this.term.onType = () => game.audio.keyClick();
    this.view = new FirstPersonView(game.cameraView);
    this.look = new OfficeTurn();   // las 4 paredes de la oficina
    this.backView = new BackView();
    this.backView.noche = 2;      // v0.58: el cartel de la noche 2
    this.backView.sprites = game.sprites;
    this.note = new NoteOverlay();   // notas legibles (clic en el papel)
    this.mouse = { x: W / 2, y: H / 2 };
    this.start();
  }

  start() {
    this.phase = 1;
    this.firstMet = false;    // el primer enemigo, fácil (v0.51)
    this.flashAt = null;      // cuándo se cogió la linterna (margen seguro)
    this.where = 'office';
    this.room = 'office';     // sala en la que está
    this.roomEnemy = null;    // enemigo dentro de la sala actual
    this.rolled = new Set();  // salas en las que ya se ha tirado el dado (no se repiten)
    this.met = 0;             // enemigos encontrados en esta fase
    this.officeEnemy = null;  // enemigo en una puerta de la oficina
    this.arriveT = 0;         // Fase 3: s en la oficina sin nadie en las puertas
    this.path = ['office'];   // salas recorridas (pruebas)
    this.flash.reset();
    this.look.reset();
    this.look.enabled = false;
    this.backView.dust = [];
    this.view.officeDrawer = (c) => this._drawOffice(c, { far: true });
    this.term.reset();
    this.term.print('SISTEMA EN REPOSO');
    this.msg = null;
    this.msgTime = 0;
    this.time = 0;
    this.calm = 0;            // s de parpadeo tras retirarse un enemigo (no aparece ninguno)
    this.log = [];            // registro (pruebas automáticas)
    this.tune = this._baseTune();
    // Fase 2
    this.cool = 0;
    this.turn = 0;
    this.camX = W;
    this.edge = null;
    this.panel = false;
    this.panelAnim = 0;
    this.slots = { left: null, center: null, right: null };
    this.spawnIn = N2END.FIRST_SPAWN;
    this.aggro = 0;
    this.refreshIn = null;
    // Fases 3 y 4
    this.alarmT = 0;
    this.alarmSounds = [];
    this.escapeLeft = 0;
    this.sceneT = 0;
    this.sceneSteps = {};
    this.done = false;
  }

  /** Depuración (?fase=2 o 3): empieza directamente en esa fase del final. */
  debugJump(phase) {
    this.flash.taken = true;
    this.officeEnemy = null;
    this._enter('reactor');
    this._startPhase2();
    if (phase >= 3) {
      this.cool = 1;
      this._startAlarm();
    }
    this._note('salto de depuración', { fase: phase });
  }

  _baseTune() {
    return { find: N2END.FIND_TIME, pose: N2END.POSE_WINDOW, move: N2END.MOVE_WINDOW, retire: N2END.RETIRE_TIME };
  }

  _note(type, data = {}) {
    this.log.push({ t: +this.time.toFixed(2), type, ...data });
  }

  _say(text, time = 2.5) {
    this.msg = text;
    this.msgTime = time;
  }

  /** Sonido de la biblioteca. cue: aviso de enemigo (en la Fase 2 se baja menos). */
  _play(key, opts = {}, cue = false) {
    if (cue && this.phase === 2) opts = { ...opts, volume: (opts.volume ?? 1) * N2END.P2_CUE_BOOST };
    return this.g.audio.lib?.play(key, opts) ?? false;
  }

  // ---------------------------------------------------------------
  // Entrada
  // ---------------------------------------------------------------

  move(x, y) {
    this.mouse.x = x;
    this.mouse.y = y;
    this.look.hover(x, y);
  }

  click(x, y) {
    this.move(x, y);
    if (this.done) return;
    if (this.note.active) return this.note.close();
    if (this.phase === 2) {
      if (inside(CONSOLE_TAB, x, y)) this.togglePanel();
      return;
    }
    switch (this.where) {
      case 'office':
        if (!this.flash.taken) {
          if (inside(FLASH_DESK, x, y)) this._takeFlashlight();
          return;
        }
        if (this.look.moving) return;
        const id = NoteOverlay.hit(OFFICE_NOTES[this.look.face], x, y);
        if (this.note.open(id === 'protocolo' ? PLACA_DE_NOCHE[2] : id)) return;   // v0.58: su placa
        if (this.look.face === 'back') return this._clickBack(x, y);
        if (this.look.face === 'front') return;
        // Pared de una compuerta: sus botones (sin energía) o salir por ella
        if (this._clickOfficeButton(x, y)) return;
        if (inside(OFFICE_EXITS[this.look.face], x, y)) return this._leaveOffice(this.look.face);
        return;
      case 'room':
      case 'escape': {
        const room = this.room;
        if (this.note.open(NoteOverlay.hit(roomNotes(room, this.g.sprites), x, y))) return;
        if (this.where === 'room' && room === 'comms' && inside(LORE_TERMINAL, x, y) && !this._exitAt(x, y)) return this._clickLore();
        if (this.where === 'escape' && room === 'reactor' && this._clickRecorder(x, y)) return;
        const to = this._exitAt(x, y);
        if (to) this._go(to);
        return;
      }
      case 'reactor':
        if (this._clickRecorder(x, y)) return;
        if (inside(REACTOR_CONSOLE, x, y)) this.term.focus();
        else this.term.blur();
        return;
      case 'escapeOffice':
        if (this.look.moving) return;
        if (this.look.face === 'back') return this._clickBack(x, y);
        this._clickOfficeButton(x, y);
    }
  }

  release() {}

  keyUp() {}

  key(code, e) {
    if (this.done) return;
    const tape = this.g.tape;
    if (tape.playing && code === 'KeyM') return tape.stop();
    if (tape.playing && code === 'KeyC' && this.phase !== 2) return tape.toggleSubtitles();
    if (this.term.focused) {
      this.g.audio.keyClick();
      const cmd = this.term.key(e);
      if (cmd !== null) this._command(cmd);
      return;
    }
    if (this.note.active && (code === 'Escape' || code === 'Enter')) return this.note.close();
    if (code === 'Space') this.toggleFlash();
    else if (code === CONFIG.LOOK_BACK.KEY) this.look.toggle();
    else if ((code === 'ArrowLeft' || code === 'ArrowRight') && this.look.enabled) this.look.step(code === 'ArrowLeft' ? -1 : 1);
    else if (code === 'KeyC' && this.phase === 2) this.togglePanel();
    else if ((code === 'Enter' || code === 'NumpadEnter') && this.where === 'reactor') this.term.focus();
  }

  toggleFlash() {
    if (!this.flash.taken) return;
    if (this.phase === 2 && this.panel) return;
    this.flash.toggle();
    this.g.audio.keyClick();
    this._note('luz', { on: this.flash.on });
  }

  /** Botones de las puertas de la oficina: SIN ENERGÍA, no hacen nada. */
  _clickOfficeButton(x, y) {
    const hit = this.g.officeView.hitTest(x, y, this.look.face);
    if (hit?.type !== 'door' && hit?.type !== 'light') return false;
    this.g.events.emit('denied', hit.side);
    this._say('Sin energía', 1.5);
    this._note('botón sin energía', { lado: hit.side, tipo: hit.type });
    return true;
  }

  /** Mirando hacia atrás: la compuerta del pasillo central está sellada. */
  _clickBack(x, y) {
    if (this.look.facingBack && inside(BACK_HATCH, x, y)) this._blocked();
  }

  /** El pasillo central (detrás de la oficina): no se puede entrar. */
  _blocked() {
    this._say('Algo bloquea el paso.', 2);
    this.g.events.emit('denied', 'center');
    this._note('pasillo bloqueado');
  }

  // ---------------------------------------------------------------
  // Enemigos con la mecánica de la luz
  // ---------------------------------------------------------------

  /** Nuevo enemigo. spots: [[x, y, h?]...]; corridor: pasillo (Fase 2) o null. */
  _newEnemy(enemy, spots, findTime, corridor = null) {
    const e = {
      enemy, spots, corridor, spot: Math.floor(Math.random() * spots.length), pose: pick(POSES[enemy]),
      state: 'waiting', findLeft: findTime, lit: 0, evadeIn: rand(N2END.EVADE_EVERY), window: 0,
      heights: spots.map((s) => s[2] ?? rand(N2END.ENEMY_HEIGHT)),
    };
    if (corridor) e.spot = Math.floor(Math.random() * 3); // aparece en la sala del fondo
    // El primero de la Fase 1, fácil (v0.51): más tiempo para encontrarlo,
    // se retira antes y no se aparta
    if (this.phase === 1 && !this.firstMet) {
      this.firstMet = true;
      const F = N2END.FIRST_ENEMY;
      e.easy = { retire: F.RETIRE, find: F.FIND };
      e.findLeft = F.FIND;
    }
    return e;
  }

  _pos(e) {
    const [x, y] = e.spots[e.spot];
    const ox = e.corridor ? CORRIDORS.indexOf(e.corridor) * W - this.camX : 0;
    return [x + ox, y, e.heights[e.spot]];
  }

  _face(e) {
    const [x, y, h] = this._pos(e);
    return faceOf(e.enemy, e.pose, x, y, h, N2END.FACE_RADIUS, N2END.FACE_RADIUS_MIN);
  }

  _faceLit(e, visible) {
    if (!visible || !this.flash.on) return false;
    const f = this._face(e);
    return Math.hypot(this.mouse.x - f.x, this.mouse.y - f.y) < f.r;
  }

  /** La mecánica de la luz para un enemigo. Devuelve 'retirado' si se va. */
  _updateLight(e, dt, visible, pan = 0) {
    const lit = this._faceLit(e, visible);
    const T = e.easy ? { ...this.tune, ...e.easy } : this.tune;
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
          this._note('pierde la cara', { enemigo: e.enemy });
          return null;
        }
        e.lit += dt;
        if (e.lit >= T.retire) return this._retire(e, pan);
        if (e.easy) return null;           // el primero no se aparta: se aprende la mecánica
        e.evadeIn -= dt;
        if (e.evadeIn <= 0) this._evade(e, pan);
        return null;
      case 'dodge':
      case 'lost':
        if (lit) {
          e.state = 'lit';
          this._note('vuelve a enfocar', { enemigo: e.enemy });
          return null;
        }
        e.window -= dt;
        if (e.window <= 0) this._die(e.enemy, e.why ?? 'perdió la cara');
        return null;
    }
    return null;
  }

  _evade(e, pan) {
    e.movedAt = this.time; // solo para el dibujo (paso atrás)
    e.evadeIn = rand(N2END.EVADE_EVERY);
    e.state = 'dodge';
    if (Math.random() < N2END.MOVE_CHANCE && e.spots.length > 1) {
      let s = e.spot;
      while (s === e.spot) s = Math.floor(Math.random() * e.spots.length);
      e.spot = s;
      e.pose = pick(POSES[e.enemy]);
      e.window = this.tune.move;
      e.why = 'cambió de sitio';
      this._play(SND[e.enemy].steps, { volume: 0.5, pan, pitchVar: 0.05 }, true);
      this._note('cambia de sitio', { enemigo: e.enemy });
    } else {
      const f0 = this._face(e);
      const others = POSES[e.enemy].filter((p) => p !== e.pose);
      e.pose = pick(others);
      const f = this._face(e);
      if (Math.hypot(f.x - f0.x, f.y - f0.y) < f.r) e.pose = others.find((p) => p !== e.pose) ?? e.pose;
      e.window = this.tune.pose;
      e.why = 'cambió de postura';
      this._note('cambia de postura', { enemigo: e.enemy, postura: e.pose });
    }
  }

  /** Se retira: pasos alejándose y la linterna parpadea (peligro pasado). */
  _retire(e, pan) {
    e.state = 'gone';
    const s = SND[e.enemy];
    [0.8, 0.5, 0.25].forEach((v, i) => this._play(s.steps, { volume: v, pan, when: 0.2 + i * s.stepGap, muffle: 0.2 + i * 0.25, pitchVar: 0.04 }));
    this.flash.blink(N2END.RETIRE_FLICKERS, N2END.RETIRE_FLICKER_TIME);
    this.calm = N2END.RETIRE_FLICKER_TIME;
    this._play('ambiente/chispazo', { volume: 0.18 });
    this._note('se retira', { enemigo: e.enemy, pasillo: e.corridor });
    return 'retirado';
  }

  // ---------------------------------------------------------------
  // Fase 1
  // ---------------------------------------------------------------

  _takeFlashlight() {
    this.flash.taken = true;
    this.flashAt = this.time;
    this.g.audio.keyClick();
    this._note('linterna');
    // "Audio 2.5": la cinta de la mujer empieza AHORA (si no se ha escuchado ya)
    if (!this.g.save?.tapesHeard?.mujer) {
      this.g.tape.schedule('mujer', { contexto: 'minijuego' });
      this._note('cinta mujer');
    }
    // AQUÍ EMPIEZA EL MINIJUEGO (camino al reactor)
    this.look.enabled = true;   // ya se puede girar hacia el pasillo central
    this._planOfficeEnemy(N2END.OFFICE_ENEMY_CHANCE);
  }

  /** Puede que alguien se asome a una puerta de la oficina (tras un rato). */
  _planOfficeEnemy(chance) {
    if (Math.random() >= chance) return;
    // Fase 1: margen seguro al coger la linterna (la cinta y aprender a usarla)
    const safe = this.phase === 1 ? Math.max(0, N2END.START_SAFE - (this.time - (this.flashAt ?? this.time))) : 0;
    this.officeEnemy = { state: 'coming', t: safe + rand(N2END.OFFICE_ENEMY_DELAY), enemy: who() };
    this._note('enemigo de puerta en camino', { enemigo: this.officeEnemy.enemy });
  }

  _sideOf(e) {
    return e.spots[e.spot][3] ?? (e.spots[e.spot][0] < W / 2 ? 'left' : 'right');
  }

  /** El enemigo de las puertas de la oficina: aparece y se aparta con la luz. */
  _updateOfficeEnemy(dt) {
    const o = this.officeEnemy;
    if (!o || o.state === 'gone') return;
    if (o.state === 'coming') {
      o.t -= dt;
      if (o.t > 0 || this.calm > 0) return;
      const e = this._newEnemy(o.enemy, OFFICE_SPOTS, N2END.OFFICE_ENEMY_FIND);
      this.officeEnemy = e;
      const pan = PAN[this._sideOf(e)];
      this._play(SND[e.enemy].steps, { volume: 0.6, pan, muffle: 0.3 }, true);
      this._play(SND[e.enemy].breath, { volume: 0.8, pan, when: 0.8 }, true);
      this._note('aparece', { sala: 'office', lado: this._sideOf(e), enemigo: e.enemy });
      return;
    }
    // Solo se le puede alumbrar mirando a la pared de su compuerta
    const side = this._sideOf(o);
    if (this._updateLight(o, dt, this.look.isFacing(side), PAN[side]) === 'retirado') this.officeEnemy = { state: 'gone' };
  }

  _officeEnemyActive() {
    const o = this.officeEnemy;
    return o && o.state !== 'gone' && o.state !== 'coming';
  }

  _leaveOffice(side) {
    if (this._officeEnemyActive()) return this._die(this.officeEnemy.enemy, 'salió con él en la puerta');
    if (this.officeEnemy?.state === 'coming') this.officeEnemy = null; // ha salido antes de que llegara
    this._enter(OFFICE_DOOR_ROOM[side]);
  }

  _roomNow() {
    return this.room;
  }

  /** Salidas de la sala actual: [{ slot, to }] (ninguna en el reactor de la Fase 1). */
  _exits() {
    if (this.where === 'reactor' || this.room === 'office') return [];
    return exitLayout(roomExits(this.room), this.room, this.view.cam.sprites);
  }

  _exitAt(x, y) {
    return this._exits().find(({ rect }) => inside(rect, x, y))?.to ?? null;
  }

  _spawnRoomEnemy(enemy, room) {
    this.roomEnemy = this._newEnemy(enemy, ROOM_SPOTS, this.tune.find);
    this.met++;
    this._play(SND[enemy].breath, { volume: 0.9 }, true);
    if (enemy === 'largo') this._play(SND.largo.growl, { volume: 0.6, when: 0.4 }, true);
    this._note('aparece', { sala: room, enemigo: enemy });
  }

  /** ¿Hay enemigo al entrar en esta sala? */
  _rollEnemy(room) {
    if (room === 'reactor' || room === 'office') return null;
    if (this.phase === 1) {
      // Margen seguro tras coger la linterna (v0.51): sin enemigos
      if (this.time - (this.flashAt ?? 0) < N2END.START_SAFE) return null;
      // Al menos uno antes del reactor: junto al reactor, si aún no ha habido ninguno, seguro
      const forced = this.met === 0 && neighbors('reactor').includes(room);
      if (!forced && this.rolled.has(room)) return null;
      this.rolled.add(room);
      return forced || Math.random() < N2END.P1_ROOM_CHANCE ? who() : null;
    }
    const E = N2END.ESCAPE;
    if (this.rolled.has(room) || this.met >= E.MAX_ENEMIES) return null;
    this.rolled.add(room);
    // v0.51: al menos MIN_ENEMIES encuentros en la huida: si quedan tantas
    // salas hasta la oficina como encuentros por cumplir, seguro
    const forced = this.met < E.MIN_ENEMIES && distToOffice(room) <= E.MIN_ENEMIES - this.met;
    return forced || Math.random() < E.ROOM_CHANCE ? who() : null;
  }

  /** Entra en una sala (o en la oficina). */
  _enter(room) {
    this.room = room;
    this.look.reset();
    this.look.enabled = room === 'office';
    this.path.push(room);
    this.roomEnemy = null;
    this._play('pasos/metal', { volume: this.phase === 3 ? 0.3 : 0.25 });
    this._note('entra', { sala: room, huida: this.phase === 3 });
    if (room === 'office') return this.phase === 3 ? this._arriveOffice() : (this.where = 'office');
    if (this.phase === 1 && room === 'reactor') {
      this.where = 'reactor';
      this._say('El reactor. La consola...', 2.5);
      return;
    }
    this.where = this.phase === 3 ? 'escape' : 'room';
    const enemy = this._rollEnemy(room);
    if (enemy) this._spawnRoomEnemy(enemy, room);
  }

  /** Clic en una salida. */
  _go(to) {
    if (this.roomEnemy && this.roomEnemy.state !== 'gone') return this._die(this.roomEnemy.enemy, 'salir');
    this._enter(to);
  }

  /** PUNTO DE LORE: COMUNICACIONES — la terminal apagada de la CAM 10.
   *  De momento no tiene contenido: solo dice "Sin señal". Aquí se
   *  añadirá el lore (grabaciones, mensajes...). */
  _clickLore() {
    this._say('SIN SEÑAL', 2.5);
    this.g.audio.keyClick();
    this._note('lore');
  }

  /** PUNTO DE LORE: GRABADORA DEL HOMBRE — tirada en el reactor (CAM 04).
   *  Solo se puede examinar si la linterna la ilumina. No reproduce voz
   *  (en un minijuego el hombre no habla: norma de voces). Se guarda en
   *  la partida (save.flags.grabadoraHombre) para usarlo en noches
   *  siguientes (por ejemplo, recuperar su cinta). */
  _clickRecorder(x, y) {
    if (!inside(RECORDER, x, y)) return false;
    const c = [RECORDER.x + RECORDER.w / 2, RECORDER.y + RECORDER.h / 2];
    if (!this.flash.on || Math.hypot(this.mouse.x - c[0], this.mouse.y - c[1]) > this.flash.radius * 0.8) return false;
    this._say('Una grabadora. La cinta está atascada.', 3.5);
    this._play('caidas/herramienta', { volume: 0.25 });
    this.g._setFlag('grabadoraHombre');
    this._note('grabadora');
    return true;
  }

  _command(text) {
    const cmd = text.trim().toLowerCase();
    if (cmd === N2END.COMMAND) {
      this.term.print('Enfriamiento iniciado... OK');
      this.term.blur();
      this._note('refresh');
      this.refreshIn = 1.5;
      this._play('ambiente/ventilacion', { volume: 0.9 });
    } else {
      this.term.print('Comando no reconocido');
      this._note('comando erróneo', { cmd });
    }
  }

  // ---------------------------------------------------------------
  // Fase 2
  // ---------------------------------------------------------------

  _startPhase2() {
    this.phase = 2;
    this.where = 'corridors';
    this.turn = 0;
    this.camX = W;
    this.flash.scale = N2END.P2_FLASH_SCALE;
    this.flash.intensity = N2END.P2_FLASH_INTENSITY;
    this.g.audio.setMasterLevel(N2END.P2_VOLUME);
    this.tune = { ...this._baseTune(), find: N2END.FIND_TIME_P2 };
    this._note('fase2');
  }

  togglePanel() {
    this.panel = !this.panel;
    if (this.panel) this.flash.on = false;
    this._note('consola', { abierta: this.panel });
  }

  get facing() {
    if (this.phase !== 2 || this.panelAnim > 0) return null;
    const target = (this.turn + 1) * W;
    return Math.abs(this.camX - target) < 60 ? CORRIDORS[this.turn + 1] : null;
  }

  /** Agresividad según el %: más apariciones y menos tiempo para reaccionar. */
  _updateAggro() {
    let level = 0;
    N2END.P2_AGGRO.forEach((a, i) => { if (this.cool >= a.AT) level = i + 1; });
    if (level === this.aggro) return;
    this.aggro = level;
    const a = N2END.P2_AGGRO[level - 1];
    const base = this._baseTune();
    this.tune = { find: N2END.FIND_TIME_P2 * a.WINDOW, pose: base.pose * a.WINDOW, move: base.move * a.WINDOW, retire: base.retire };
    this._note('más agresivos', { nivel: level });
  }

  _spawnInterval() {
    const a = N2END.P2_AGGRO[this.aggro - 1];
    return rand(N2END.SPAWN_EVERY) * (a ? a.SPAWN : 1);
  }

  _spawn() {
    const free = CORRIDORS.filter((c) => !this.slots[c]);
    if (!free.length || CORRIDORS.length - free.length >= N2END.MAX_ENEMIES) return;
    const id = pick(free);
    const enemy = Math.random() < 0.5 ? 'largo' : 'specimen';
    this.slots[id] = this._newEnemy(enemy, CORRIDOR_SPOTS, this.tune.find, id);
    this._play(SND[enemy].growl, { volume: 0.6, pan: PAN[id], muffle: 0.45 }, true);
    this._play(SND[enemy].steps, { volume: 0.4, pan: PAN[id], when: 0.6, muffle: 0.4 }, true);
    this._note('aparece', { pasillo: id, enemigo: enemy });
  }

  // ---------------------------------------------------------------
  // Fase 3: alarma y huida
  // ---------------------------------------------------------------

  /** 100 %: reinicio completado; se levanta el protocolo de contención. */
  _startAlarm() {
    this.phase = 3;
    this.where = 'alarm';
    this.alarmT = 0;
    this.panel = false;
    this.panelAnim = 0;
    this.slots = { left: null, center: null, right: null };
    this.flash.scale = 1;
    this.flash.intensity = 1;
    this.g.audio.setMasterLevel(1);
    this.g.audio.playFile(N2END.PA_FILE, { volume: 1 });
    this.g.audio.setLoop('n2alarma', true, () => this.g.audio._sirenLoop());
    // Puertas pesadas abriéndose por toda la nave, a distintas distancias
    this.alarmSounds = [
      [2.2, 'puertas/apertura', 0.9, -0.6, 0.2], [2.9, 'puertas/golpe', 0.6, 0.7, 0.5],
      [3.5, 'puertas/apertura', 0.5, 0.3, 0.6], [4.1, 'criaturas/grunido', 0.5, -0.4, 0.5],
      [4.6, 'puertas/apertura', 0.7, 0.8, 0.35], [5.2, 'largo/grunido', 0.6, -0.8, 0.6],
      [5.8, 'metal/golpe_pared', 0.6, 0.2, 0.5], [6.3, 'puertas/apertura', 0.4, -0.2, 0.75],
    ];
    this._note('reinicio');
  }

  _startEscape() {
    this.where = 'escape';
    this.room = 'reactor';
    this.path.push('reactor');
    this.escapeLeft = N2END.ESCAPE.TIME;
    const E = N2END.ESCAPE;
    this.tune = { find: E.FIND_TIME, pose: E.POSE_WINDOW, move: E.MOVE_WINDOW, retire: E.RETIRE_TIME };
    this.rolled = new Set();
    this.met = 0;
    this.roomEnemy = null;
    this.officeEnemy = null;
    this._note('huida');
  }

  /** Llega a la oficina: se para la cuenta atrás. Puede haber alguien en una puerta. */
  _arriveOffice() {
    this.where = 'escapeOffice';
    this.arriveT = 0;
    this.officeEnemy = null;
    this._planOfficeEnemy(N2END.ESCAPE.OFFICE_ENEMY_CHANCE);
    if (this.officeEnemy) this.officeEnemy.t = Math.min(this.officeEnemy.t, 2);
    this._note('llega a la oficina', { quedaban: +this.escapeLeft.toFixed(1) });
  }

  /** Escena final (automática): golpe detrás, giro, compuerta y silueta. */
  _startScene() {
    this.phase = 4;
    this.where = 'scene';
    this.sceneT = 0;
    this.sceneSteps = {};
    this.look.enabled = false;
    this.g.audio.setLoop('n2alarma', false);
    // Un golpe metálico pesado DETRÁS
    this._play('puertas/golpe', { volume: 0.95, muffle: 0.2 });
    this._play('metal/golpe_pared', { volume: 0.6, when: 0.35, muffle: 0.35 });
    this._note('pasillo');
  }

  /** 0..1: cuánto ha subido la compuerta del pasillo central. */
  _hatchOpen() {
    const S = N2END.CORRIDOR_SCENE;
    const k = Math.max(0, Math.min(1, (this.sceneT - S.OPEN_AT) / S.OPEN_TIME));
    return k * k * (3 - 2 * k);
  }

  _updateScene(dt) {
    const S = N2END.CORRIDOR_SCENE;
    const t = (this.sceneT += dt);
    const once = (id, at, fn) => {
      if (!this.sceneSteps[id] && t >= at) {
        this.sceneSteps[id] = true;
        fn();
      }
    };
    // v0.51: el giro se ve: primero a un lado (el del golpe), una pausa, y atrás
    once('giro', S.TURN_AT, () => {
      this.sceneSide = Math.random() < 0.5 ? 'left' : 'right';
      this.look.goTo(this.sceneSide);
      this._note('se gira', { lado: this.sceneSide });
    });
    once('giro2', S.TURN2_AT, () => {
      this.look.goTo('back');
      this._note('mira atrás');
    });
    once('abre', S.OPEN_AT, () => {
      // Sonido metálico pesado y vapor al soltarse los cierres
      this._play('puertas/apertura', { volume: 1, muffle: 0.1 });
      this._play('ambiente/ventilacion', { volume: 0.8, when: 0.15 });
      this._play('metal/tuberia', { volume: 0.55, when: 1.0, muffle: 0.2 });
      this._play('puertas/apertura', { volume: 0.7, when: 2.0, muffle: 0.3, pitchVar: 0.05 });
      this._play('metal/tuberia', { volume: 0.45, when: 3.0, muffle: 0.3 });
      this.backView.emitDust(30, 0);
      this._note('se abre la compuerta');
    });
    const open = this._hatchOpen();
    if (open > 0 && open < 1 && Math.random() < dt * 25) this.backView.emitDust(1, open);
    once('tope', S.OPEN_AT + S.OPEN_TIME, () => {
      this._play('puertas/golpe', { volume: 0.55, muffle: 0.3 });
      this.backView.emitDust(14, 1);
    });
    once('silueta', S.GLIMPSE_AT, () => {
      this._play('pasos/metal', { volume: 0.22, muffle: 0.75, pan: -0.15 });
      this._play('pasos/metal', { volume: 0.2, muffle: 0.75, pan: 0.15, when: 0.5 });
      this._play('criaturas/respiracion', { volume: 0.14, muffle: 0.8, when: 0.2 });
      this._note('algo se mueve', { como: 'silueta' });
    });
    // AQUÍ IRÍA UNA CINTA (norma de voces: en un minijuego solo la mujer;
    // de momento no hay ninguna prevista para este momento).
    if (t >= S.END_AT) this._win();
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
    this.note.update(dt);
    this.backView.update(dt);
    this.msgTime = Math.max(0, this.msgTime - dt);
    this.hintT = (this.hintT ?? 0) + dt;
    this.calm = Math.max(0, this.calm - dt);
    switch (this.phase) {
      case 1:
        if (this.refreshIn !== null) {
          this.refreshIn -= dt;
          if (this.refreshIn <= 0) {
            this.refreshIn = null;
            this._startPhase2();
          }
          return;
        }
        if (this.where === 'office') this._updateOfficeEnemy(dt);
        if (this.where === 'room' && this.roomEnemy && this.roomEnemy.state !== 'gone') this._updateLight(this.roomEnemy, dt, true);
        return;
      case 2:
        return this._updatePhase2(dt);
      case 3:
        return this._updateEscape(dt);
      case 4:
        this._updateScene(dt);
    }
  }

  _updatePhase2(dt) {
    const zone = this.mouse.x < N2END.TURN_EDGE ? 'left' : this.mouse.x > W - N2END.TURN_EDGE ? 'right' : null;
    if (zone !== this.edge && !this.panel) {
      if (zone === 'left') this.turn = Math.max(-1, this.turn - 1);
      if (zone === 'right') this.turn = Math.min(1, this.turn + 1);
    }
    this.edge = zone;
    const target = (this.turn + 1) * W;
    this.camX += (target - this.camX) * Math.min(1, dt * N2END.TURN_SPEED * 2);
    if (Math.abs(target - this.camX) < 1) this.camX = target;
    this.panelAnim = Math.max(0, Math.min(1, this.panelAnim + (this.panel ? 1 : -1) * dt / 0.25));
    this.cool = Math.min(1, this.cool + dt / N2END.COOL_TIME);
    if (this.cool >= 1) return this._startAlarm();
    this._updateAggro();
    this.spawnIn -= dt;
    if (this.spawnIn <= 0 && this.calm <= 0) {
      this.spawnIn = this._spawnInterval();
      this._spawn();
    }
    const facing = this.facing;
    for (const id of CORRIDORS) {
      const e = this.slots[id];
      if (!e) continue;
      if (this._updateLight(e, dt, facing === id, PAN[id]) === 'retirado') this.slots[id] = null;
      if (this.done) return;
    }
  }

  _updateEscape(dt) {
    if (this.where === 'alarm') {
      this.alarmT += dt;
      while (this.alarmSounds.length && this.alarmSounds[0][0] <= this.alarmT) {
        const [, key, volume, pan, muffle] = this.alarmSounds.shift();
        this._play(key, { volume, pan, muffle });
      }
      if (this.alarmT >= N2END.ALARM_TIME) this._startEscape();
      return;
    }
    if (this.where === 'escapeOffice') {
      // En la oficina ya no corre el tiempo. Cuando no queda nadie en las puertas, la escena.
      this._updateOfficeEnemy(dt);
      if (this.done) return;
      const o = this.officeEnemy;
      if (!o || o.state === 'gone') {
        this.arriveT += dt;
        if (this.arriveT >= N2END.ESCAPE.ARRIVE_CALM) this._startScene();
      }
      return;
    }
    // Cuenta atrás hasta llegar a la oficina
    this.escapeLeft -= dt;
    if (this.escapeLeft <= 0) return this._die('largo', 'tiempo');
    if (this.where === 'escape' && this.roomEnemy && this.roomEnemy.state !== 'gone') this._updateLight(this.roomEnemy, dt, true);
  }

  _die(enemy, why) {
    if (this.done) return;
    this.done = true;
    this._note('muerte', { enemigo: enemy, por: why });
    this.g.audio.setLoop('n2alarma', false);
    this.g._finalDeath(enemy, why === 'tiempo' ? 'final_tiempo' : null);
  }

  _win() {
    if (this.done) return;
    this.done = true;
    this._note('fin de la noche 2');
    this.g._finalWin();
  }

  // ---------------------------------------------------------------
  // Dibujo
  // ---------------------------------------------------------------

  _drawEnemy(ctx, e) {
    let [x, y, h] = this._pos(e);
    // Solo visual: con la luz en la cara tiembla, y al cambiar de postura
    // o de sitio da un paso atrás (se ve un poco más pequeño un instante)
    if (e.state === 'lit') x += Math.sin(this.time * 38) * 2.5 * Math.min(1, e.lit);
    const back = e.movedAt !== undefined ? Math.max(0, 1 - (this.time - e.movedAt) / 0.4) : 0;
    // Los ojos brillan con la linterna (como los de un gato): los enemigos
    // solo se dibujan dentro del haz, así que solo brillan con luz
    setEyeShine(true);
    drawEnemy(ctx, e.enemy, e.pose, x, y, h * (1 - 0.07 * back), this.time);
    setEyeShine(false);
  }

  /** 0..1: destello de la luz roja de alarma. */
  _red() {
    const k = (this.time % N2END.ESCAPE.RED_PERIOD) / N2END.ESCAPE.RED_PERIOD;
    return Math.pow(Math.max(0, Math.sin(k * Math.PI)), 3);
  }

  _redTint(ctx, strength) {
    ctx.fillStyle = `rgba(255,25,15,${strength})`;
    ctx.fillRect(0, 0, W, H);
  }

  /** La oficina, sin energía. far: vista desde un pasillo (salida de un corredor). */
  _drawOffice(ctx, { red = 0, far = false, face = 'front' } = {}) {
    const g = this.g;
    g.officeView.draw(ctx, g.office, {
      face,
      blackout: false, terminal: g.terminal, reactor: g.reactor, locked: false, noPower: true, night: 2,
      doorEnemies: { left: [], right: [] },
    });
    if (red && !far) this._redTint(ctx, 0.1 + 0.18 * red);
  }

  /** La oficina mirando al frente o (girándose) hacia el pasillo central. */
  _drawOfficeLook(ctx, red = 0) {
    this.look.draw(ctx, {
      front: (c) => this._drawOffice(c, { red }),
      left: (c) => this._drawOffice(c, { red, face: 'left' }),
      right: (c) => this._drawOffice(c, { red, face: 'right' }),
      back: (c) => this.backView.draw(c, { sealed: true, red }),
    });
  }

  _drawOfficeEnemy(ctx, mx, my) {
    const o = this.officeEnemy;
    if (o && o.spots && o.state !== 'gone' && this.look.isFacing(this._sideOf(o))) this.flash.reveal(ctx, mx, my, (c) => this._drawEnemy(c, o));
  }

  draw(ctx) {
    const g = this.g;
    const { x: mx, y: my } = this.mouse;
    const v = this.view;
    const darkness = N2END.FLASH_DARKNESS;
    // Color del reactor: al límite (rojo) hasta que se enfría (azul)
    g.cameraView.reactorHeat = 1 - this.cool;
    let hint = '';
    switch (this.where) {
      case 'office': {
        this._drawOfficeLook(ctx);
        this.flash.draw(ctx, mx, my);
        this._drawOfficeEnemy(ctx, mx, my);   // (solo si se mira a su compuerta)
        if (this.flash.taken) this.look.drawStrips(ctx);
        // v0.51: sin texto que diga qué hacer; la linterna brilla en la mesa
        if (!this.flash.taken) v.drawDeskFlashlight(ctx);
        else hint = 'ESPACIO: linterna';
        break;
      }
      case 'room':
      case 'escape': {
        const room = this.room;
        const exits = this._exits();
        v.drawRoom(ctx, room, exits, { console: this.where !== 'escape' });
        if (this.where === 'escape') {
          const red = this._red();
          v.drawEscapeSteam(ctx);
          this._redTint(ctx, 0.08 + 0.2 * red);
          this.flash.draw(ctx, mx, my, null, darkness - N2END.ESCAPE.RED_REVEAL * red);
          v.drawEscapeLights(ctx, red);
        } else this.flash.draw(ctx, mx, my);
        // Orientarse a oscuras (v0.51): luces junto a las salidas y franjas reflectantes
        v.drawExitLights(ctx, room, exits);
        this.flash.reveal(ctx, mx, my, (c) => v.drawExitStrips(c, exits));
        if (room === 'reactor') {
          v.drawCoreGlow(ctx, 1 - this.cool);
          this.flash.reveal(ctx, mx, my, (c) => v.drawRecorder(c));
          v.drawRecorderLed(ctx);
        }
        if (this.roomEnemy && this.roomEnemy.state !== 'gone') this.flash.reveal(ctx, mx, my, (c) => this._drawEnemy(c, this.roomEnemy));
        hint = 'ESPACIO: linterna';
        break;
      }
      case 'reactor':
        v.drawRoom(ctx, 'reactor', []);
        this.flash.draw(ctx, mx, my);
        v.drawCoreGlow(ctx, 1 - this.cool);
        this.flash.reveal(ctx, mx, my, (c) => v.drawRecorder(c));
        v.drawRecorderLed(ctx);
        v.drawConsoleScreen(ctx, this.term, this.term.focused);
        hint = this.term.focused ? 'Enter · Esc' : 'ESPACIO: linterna';
        break;
      case 'corridors':
      case 'alarm': {
        if (this.panelAnim < 1) {
          v.drawCorridors(ctx, this.camX, 1 - this.cool);
          if (this.where === 'alarm') this._redTint(ctx, 0.12 + 0.25 * this._red());
          CORRIDORS.forEach((id, i) => {
            const ox = i * W - this.camX;
            const area = p2Area(id);   // v0.51: el hueco real de la compuerta (antes, un rectángulo que no cuadraba)
            if (ox > -W && ox < W) this.flash.draw(ctx, mx, my, { ...area, x: area.x + ox });
          });
          this.flash.reveal(ctx, mx, my, (c) => {
            for (const id of CORRIDORS) if (this.slots[id]) this._drawEnemy(c, this.slots[id]);
          });
        }
        if (this.where === 'corridors') {
          v.drawCoolingPanel(ctx, this.cool, this.panelAnim, N2END.COOL_TIME);
          v.drawConsoleTab(ctx, this.panel);
          hint = 'ESPACIO: linterna   ·   C: consola';
        }
        break;
      }
      case 'escapeOffice': {
        const red = this._red();
        this._drawOfficeLook(ctx, red);
        this.flash.draw(ctx, mx, my, null, darkness - N2END.ESCAPE.RED_REVEAL * red);
        this._drawOfficeEnemy(ctx, mx, my);   // (solo si se mira a su compuerta)
        this.look.drawStrips(ctx);
        hint = 'ESPACIO: linterna';
        break;
      }
      case 'scene': {
        // Se gira hacia el pasillo central: la compuerta sube y algo cruza
        const S = N2END.CORRIDOR_SCENE;
        const red = this._red();
        const gt = (this.sceneT - S.GLIMPSE_AT) / S.GLIMPSE_TIME;
        this.look.draw(ctx, {
          front: (c) => this._drawOffice(c, { red }),
          left: (c) => this._drawOffice(c, { red, face: 'left' }),
          right: (c) => this._drawOffice(c, { red, face: 'right' }),
          back: (c) => this.backView.draw(c, {
            open: this._hatchOpen(), sealed: this.sceneT < S.OPEN_AT, red: Math.max(red, 0.4),
            glimpse: gt >= 0 && gt <= 1 ? gt : null,
          }),
        });
        // Penumbra: solo la luz roja de alarma
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(0, 0, W, H);
        const fade = Math.max(0, (this.sceneT - (S.END_AT - 1.4)) / 1.4);
        if (fade > 0) {
          ctx.fillStyle = `rgba(0,0,0,${Math.min(1, fade)})`;
          ctx.fillRect(0, 0, W, H);
        }
        break;
      }
    }
    // Cuenta atrás de la huida (hasta llegar a la oficina)
    if (this.where === 'escape') {
      const s = Math.max(0, Math.ceil(this.escapeLeft));
      ctx.save();
      ctx.fillStyle = s <= 10 && Math.floor(this.time * 4) % 2 ? '#ffffff' : '#ff3b30';
      ctx.font = 'bold 54px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.shadowColor = 'rgba(255,40,30,0.8)';
      ctx.shadowBlur = 16;
      ctx.fillText(`0:${String(s).padStart(2, '0')}`, W / 2, 124);
      ctx.restore();
    }
    g.effects.vignette(ctx, 0.8);
    g.effects.static(ctx, 0.04);
    // La ayuda de controles solo los primeros segundos de cada fase (v0.51)
    if (this.hintKey !== this.where + '|' + hint) {
      this.hintKey = this.where + '|' + hint;
      this.hintT = 0;
    }
    const hintA = Math.max(0, Math.min(1, (N2END.HINT_TIME - (this.hintT ?? 0)) / 1.2));
    if (this.where !== 'scene') v.drawHint(ctx, hintA > 0 ? hint : '', this.msgTime > 0 ? this.msg : null, hintA);
    this.note.draw(ctx);
  }
}
