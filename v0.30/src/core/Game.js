// =============================================================
// Game.js — Bucle principal y máquina de estados.
//
// Estados:
//   'menu'      → menú principal: NEW GAME / CONTINUE (el primer clic
//                 o tecla desbloquea el audio)
//   'night'     → turno en curso
//   'jumpscare' → te han atrapado (animación del susto)
//   'explosion' → el reactor ha llegado al 100 %
//   'gasDeath'  → la fuga de gas no se ha sellado a tiempo
//   'ending'    → 6:00 AM con final del conducto: algo se acerca y se
//                 va la luz (solo en las noches con endingDuct)
//   'final'     → FINAL DE LA NOCHE 2 (noches con finalSequence): a las
//                 6 AM se va la luz; linterna, ruta hasta el reactor y
//                 aguantar mientras se enfría (src/ending/Night2Ending.js).
//                 Al empezar se guarda un PUNTO DE CONTROL: si mueres o
//                 cierras el juego, Continue vuelve aquí.
//   'n2done'    → noche 2 superada: negro, el reactor se apaga, "6:00 AM"
//   'win'       → 6:00 AM, turno superado
//   'lose'      → pantalla de derrota (con la causa)
//
// Guardado (SaveData): al empezar una noche se guarda esa noche (si
// mueres, Continue la repite); al llegar a las 6 AM se guarda la
// siguiente. También qué cintas se han escuchado enteras.
//
// El tiempo de juego es el tiempo real × velocidad (×1 normal,
// ×4 en depuración). Reloj, reactor, temperatura e IA usan SIEMPRE
// este tiempo de juego.
//
// Noches con conductos (vents en nights.js, desde la 2): la noche
// empieza en INTRODUCCIÓN (this.intro): reloj, reactor y enemigos
// parados, cámaras de ventilación sin señal y El Insecto en un
// conducto. Hay que escribir get-update, encontrarlo (TOGGLE) y
// soltarle insecticida; entonces empieza la noche de verdad. Si se
// acaba NIGHT2.INTRO.TIME_LIMIT, El Insecto te mata.
// =============================================================

import { CONFIG } from '../config.js';
import { Events } from './Events.js';
import { NightClock } from './Clock.js';
import { Input } from './Input.js';
import { Random } from './Random.js';
import { Office } from '../systems/Office.js';
import { Reactor } from '../systems/Reactor.js';
import { CryoPanel } from '../systems/CryoPanel.js';
import { Blackout } from '../systems/Blackout.js';
import { CameraSystem } from '../systems/CameraSystem.js';
import { GasLeak } from '../systems/GasLeak.js';
import { AIController } from '../ai/AIController.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { TapePlayer } from '../audio/TapePlayer.js';
import { setCreatureSprites } from '../render/CreatureArt.js';
import { AmbientSounds } from '../audio/AmbientSounds.js';
import { Renderer } from '../render/Renderer.js';
import { Effects } from '../render/Effects.js';
import { OfficeView } from '../render/OfficeView.js';
import { CameraView, MONITOR_TAB } from '../render/CameraView.js';
import { Sprites } from '../render/Sprites.js';
import { ROOMS, VENTS } from '../world/StationMap.js';
import { drawHUD, drawTapeOverlay, TAPE_SKIP, TAPE_SUBS, TAPE_PLAY } from '../ui/HUD.js';
import { drawJumpscare } from '../ui/Jumpscare.js';
import { Terminal } from '../ui/Terminal.js';
import { EasterEgg } from '../ui/EasterEgg.js';
import { getNight, NIGHTS } from '../night/nights.js';
import { NIGHT2 } from '../night/night2.js';
import { SaveData } from './SaveData.js';
import { Menu } from '../ui/Menu.js';
import { Night2Ending } from '../ending/Night2Ending.js';
import { OfficeTurn } from '../systems/OfficeTurn.js';
import { NoteOverlay } from '../ui/NoteOverlay.js';
import { OFFICE_NOTES } from '../world/Notes.js';
import { BackView, BACK_HATCH } from '../render/BackView.js';
import { Flashlight } from '../render/Flashlight.js';

const KEYMAP = {
  KeyQ: { type: 'door', side: 'left' },
  KeyA: { type: 'light', side: 'left' },
  KeyE: { type: 'door', side: 'right' },
  KeyD: { type: 'light', side: 'right' },
};

// Teclas 1..9 y 0 → CAM 01..10
const CAM_KEYS = {};
for (const [id, room] of Object.entries(ROOMS)) {
  const n = parseInt(room.cam, 10) % 10;
  CAM_KEYS[`Digit${n}`] = id;
  CAM_KEYS[`Numpad${n}`] = id;
}
// En el mapa de ventilación: teclas 1..7 → V1..V7
const VENT_KEYS = {};
for (const [id, vent] of Object.entries(VENTS)) {
  const n = vent.cam.slice(1);
  VENT_KEYS[`Digit${n}`] = id;
  VENT_KEYS[`Numpad${n}`] = id;
}

const DEATH_TEXT = {
  specimen: 'El Espécimen te ha atrapado.',
  insecto: 'El Insecto ha salido del conducto.',
  largo: 'El Largo ha llegado por los conductos.',
  gas: 'La fuga de gas ha llenado la oficina.',
  frozen: 'El Congelado ha llegado corriendo a la oficina.',
  explosion: 'El reactor ha hecho explotar la nave.',
  final_largo: 'El Largo te ha encontrado en la oscuridad.',
  final_specimen: 'El Espécimen te ha encontrado en la oscuridad.',
  final_tiempo: 'No has llegado a tiempo a la oficina.',
};

const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    const params = new URLSearchParams(location.search);
    this.debug = params.has('debug');
    // ?debug=1&noche=2 → NEW GAME / CONTINUE empiezan en esa noche (sin guardar)
    this.debugNight = this.debug && params.has('noche') ? Number(params.get('noche')) : null;
    if (this.debug) window.game = this; // para probar desde la consola del navegador
    // ?debug=1&girar=1 → se puede girar hacia el pasillo central en cualquier noche
    this.debugLook = this.debug && params.has('girar');
    // ?debug=1&final=1&fase=2 (o 3) → el final empieza en esa fase
    this.debugPhase = this.debug && params.has('fase') ? Number(params.get('fase')) : 1;
    this.speed = 1;
    this.rng = new Random(params.has('seed') ? Number(params.get('seed')) : Date.now());

    this.events = new Events();
    this.renderer = new Renderer(canvas);
    this.effects = new Effects(this.renderer.ctx);
    this.audio = new AudioEngine(this.events);
    this.tape = new TapePlayer(this.audio, this.events);
    this.ambient = new AmbientSounds(this.audio);
    this.clock = new NightClock(this.events);
    this.office = new Office(this.events);
    this.reactor = new Reactor(this.events);
    this.cryo = new CryoPanel(this.events, this.rng);
    this.blackout = new Blackout(this.events, this.rng);
    this.cameras = new CameraSystem(this.events);
    this.gas = new GasLeak(this.events, this.rng);
    this.intro = null;
    this.lureCooldown = 0;
    this.terminal = new Terminal();
    this.easterEgg = new EasterEgg(this.events);
    this.officeView = new OfficeView();
    this.sprites = new Sprites();
    this.sprites.load(); // imágenes opcionales de assets/manifest.json
    setCreatureSprites(this.sprites); // enemigos en 3D (crt_<enemigo>_<postura>)
    this.officeView.sprites = this.sprites; // fondo 3D de la oficina
    this.cameraView = new CameraView(this.sprites);
    // Las 4 paredes de la oficina (frente, compuertas a los lados y el PASILLO
    // CENTRAL detrás). Mirando al pasillo, desde la noche CONFIG.LOOK_BACK.
    // FROM_NIGHT, ESPACIO enciende la linterna.
    this.lookBack = new OfficeTurn();   // las 4 paredes de la oficina
    this.backView = new BackView();
    this.backView.sprites = this.sprites;   // fondo 3D del pasillo central
    this.note = new NoteOverlay();            // notas legibles de la oficina
    this.backFlash = new Flashlight();
    this.mouse = { x: CONFIG.WIDTH / 2, y: CONFIG.HEIGHT / 2 };
    // NOCHE 3: AQUÍ IRÁN LOS ENEMIGOS DEL PASILLO CENTRAL. drawCorridorEnemies(ctx)
    // dibuja dentro del pasillo (solo se ven con la linterna).
    this.drawCorridorEnemies = null;

    // "Mundo" que ven los enemigos: lo que pueden consultar y cómo atacan.
    this.world = {
      rng: this.rng,
      events: this.events,
      office: this.office,
      cameras: this.cameras,
      cryo: this.cryo,
      clock: this.clock,
      attack: (enemy) => this._attack(enemy),
    };
    this.ai = new AIController(this.world);

    this.input = new Input(canvas, this.renderer, {
      onClick: (x, y) => this._onClick(x, y),
      onRelease: () => this.state === 'final' && this.final.release(),
      onKey: (code, e) => this._onKey(code, e),
      onKeyUp: (code) => this.state === 'final' && this.final.keyUp(code),
      onMove: (x, y) => this._onMove(x, y),
    });
    // ?debug=1&final=1 → NEW GAME / CONTINUE empiezan en el final de la noche 2
    this.debugFinal = this.debug && params.has('final');

    this.events.on('hour', (h) => this.ai.onHour(h));
    // Apagón: compuertas abiertas y bloqueadas, sin luces ni cámaras.
    this.events.on('blackout', ({ on }) => {
      this.office.setLock('blackout', on, { openDoors: true });
      this.cameras.setEnabled(!on);
      if (on) {
        this.terminal.reset();
      } else {
        this.terminal.blur();
      }
    });
    this.events.on('reactorExplode', () => this._explode());
    this.events.on('gasLeakDeath', () => this._gasDeath());
    // Enfriamiento del reactor: bloquea compuertas y luces mientras
    // dura y, al acabar, puede provocar un apagón según el riesgo.
    this.events.on('coolingStart', () => {
      this.office.setLock('cooling', true, { openDoors: CONFIG.REACTOR.COOL_OPENS_DOORS });
    });
    this.events.on('coolingEnd', ({ risk }) => {
      this.office.setLock('cooling', false);
      if (this.rng.next() < risk) {
        const [min, max] = CONFIG.REACTOR.COOL_BLACKOUT_DELAY;
        this.blackout.scheduleExtra(this.rng.range(min, max));
      }
    });

    // Cinta escuchada entera: se guarda para no repetirla sola
    this.events.on('tapeFinished', ({ night }) => {
      if (!this.save) return;
      this.save.tapesHeard[night] = true;
      if (this.saveEnabled !== false) SaveData.save(this.save);
    });

    this.menu = new Menu();
    this.save = SaveData.load(); // null si no hay partida (o está dañada)
    this.menu.selected = this.save ? 'continue' : 'newGame';
    this.state = 'menu';
    this.nightNumber = 1;
    this.stateTime = 0;
    this.lastTime = null;
    this._frame = this._frame.bind(this);
    requestAnimationFrame(this._frame);
  }

  // ---------------------------------------------------------------
  // Transiciones
  // ---------------------------------------------------------------

  startNight(n, { save = true } = {}) {
    this.nightNumber = n;
    // Se guarda la noche en curso: si mueres, Continue vuelve a ella.
    this.save = { ...(this.save ?? SaveData.fresh()), night: n, checkpoint: null };
    this.saveEnabled = save;
    if (save) SaveData.save(this.save);
    const night = getNight(n);
    this.audio.stopAll();
    this.clock.reset();
    this.office.reset();
    this.cameras.reset();
    this.terminal.reset();
    this.easterEgg.reset();
    this.reactor.reset(night);
    this.cryo.reset(night.cryo);
    this.blackout.reset(night.blackouts);
    this.ai.setup(night);
    this.gas.reset();
    // Oficina de 4 paredes: se gira en todas las noches (las puertas están
    // en las paredes de los lados y el pasillo central detrás)
    this.lookBack.reset();
    this.lookBack.enabled = true;
    this.lookBack.onTurn = (face) => {
      if (face !== 'back') this.backFlash.on = false;
      this.terminal.blur?.();
    };
    this.backFlash.reset();
    this.backFlash.taken = true;
    this.lureCooldown = 0;
    this.cameras.hasVents = !!night.vents;
    // Golpes metálicos solo si El Largo juega esa noche en las cámaras
    // (en la noche 2 no: allí solo sale en el final, la noche 2.5)
    this.cameras.hasLure = !!night.vents && (night.ai.largo ?? 0) > 0;
    // get-update solo existe en la noche 2: después, la ventilación ya está en línea
    if (night.vents && !night.ventsUpdate) this.cameras.ventsUnlocked = true;
    this.intro = null;
    if (night.vents) {
      // Introducción: El Insecto espera en un conducto y el reloj no arranca
      this.intro = { time: 0 };
      this.ai.insecto.placeIntro(this.world);
    }
    this.audio.startAmbience();
    this.ambient.reset(night);
    // Cinta del hombre de la cinta: suena SIEMPRE sola al empezar la noche
    // (aunque ya se haya escuchado); se puede volver a poner con L o el botón.
    this.tape.schedule(n, { autoplay: true });
    this.attacker = null;
    this.deathCause = null;
    this._setState('night');
  }

  /** Un enemigo te alcanza: susto y fin de la partida. */
  _attack(enemy) {
    if (this.state !== 'night') return;
    this.cameras.forceClose();
    this.tape.stop();
    this.attacker = enemy.id;
    this.deathCause = enemy.id;
    this.audio.scream();
    this._setState('jumpscare');
  }

  /** La fuga de gas no se ha sellado a tiempo. */
  _gasDeath() {
    if (this.state !== 'night') return;
    this.cameras.forceClose();
    this.tape.stop();
    this.deathCause = 'gas';
    this.audio.stopAll();
    this.audio.gasDeath();
    this._setState('gasDeath');
  }

  _explode() {
    if (this.state !== 'night') return;
    this.cameras.forceClose();
    this.tape.stop();
    this.deathCause = 'explosion';
    this.audio.explosion();
    this._setState('explosion');
  }

  _setState(s) {
    if (s !== 'night') this.easterEgg.reset(); // fuera de la noche no queda nada
    this.state = s;
    this.stateTime = 0;
  }

  // ---------------------------------------------------------------
  // Entrada
  // ---------------------------------------------------------------

  _onClick(x, y) {
    switch (this.state) {
      case 'menu':
        this._ensureAudio();
        this._menuAction(this.menu.hitTest(x, y, this.save));
        break;
      case 'night':
        if (this._tapeAvailable() && inside(TAPE_PLAY, x, y)) {
          this.tape.playNow();
          break;
        }
        // Botones de la cinta (encima de todo, con o sin monitor)
        if (this.tape.playing && inside(TAPE_SKIP, x, y)) {
          this.tape.stop();
          break;
        }
        if (this.tape.playing && inside(TAPE_SUBS, x, y)) {
          this.tape.toggleSubtitles();
          break;
        }
        if (this.note.active) {
          this.note.close();
          break;
        }
        if (this.lookBack.moving) break; // girando: nada
        if (!this.cameras.open && this.note.open(NoteOverlay.hit(OFFICE_NOTES[this.lookBack.face], x, y))) break;
        if (this.lookBack.face === 'left' || this.lookBack.face === 'right') {
          // Pared de una compuerta: sus botones PUERTA y LUZ
          const action = this.officeView.hitTest(x, y, this.lookBack.face);
          if (action && action.type !== 'doorway') this._doAction(action);
          break;
        }
        if (this.lookBack.face === 'back') break; // el pasillo central
        if (this.cameras.open) {
          // Con el monitor subido: mapa, pestaña y controles de la cámara activa.
          const hit = this.cameraView.hitTest(x, y, this.cameras);
          if (hit?.type === 'cam') this.cameras.select(hit.id);
          else if (hit?.type === 'monitor') this.cameras.toggle();
          else if (hit?.type === 'toggle') this._toggleMap();
          else if (hit?.type === 'gas' && this.cameras.fullyOpen) this._spray();
          else if (hit?.type === 'lure' && this.cameras.fullyOpen) this._lure();
          else if (hit?.type === 'cryo' && this.cameras.fullyOpen) this._adjustCryo(hit.dir);
          else if (hit?.type === 'cool' && this.cameras.fullyOpen) this._cool();
        } else {
          const action = this.officeView.hitTest(x, y);
          if (action?.type === 'terminal') {
            this.terminal.focus();
          } else if (action) {
            this._doAction(action);
          } else if (inside(MONITOR_TAB, x, y)) {
            this._toggleMonitor();
          }
        }
        break;
      case 'final':
        // Botones de la cinta (la de la mujer suena en el minijuego)
        if (this.tape.playing && inside(TAPE_SKIP, x, y)) this.tape.stop();
        else if (this.tape.playing && inside(TAPE_SUBS, x, y)) this.tape.toggleSubtitles();
        else this.final.click(x, y);
        break;
      case 'win':
      case 'lose':
        if (this.stateTime > 1.5) this._toMenu();
        break;
    }
  }

  // ---------------------------------------------------------------
  // Menú principal
  // ---------------------------------------------------------------

  /** El navegador solo deja sonar tras un clic o tecla: el primero lo activa. */
  _ensureAudio() {
    if (this.audio.ctx) return;
    this.audio.init();
    this.audio.startAmbience();
  }

  _toMenu() {
    this.audio.stopAll();
    this.audio.setMasterLevel(1);
    this.audio.startAmbience();
    this.save = SaveData.load();
    this.menu.confirming = false;
    this.menu.selected = this.save ? 'continue' : 'newGame';
    this._setState('menu');
  }

  _menuAction(action) {
    switch (action) {
      case 'newGame':
        this.menu.selected = 'newGame';
        if (this.save) {
          // Hay partida: pedir confirmación antes de borrarla
          this.menu.confirming = true;
          this.menu.confirmChoice = 'no';
        } else {
          this._newGame();
        }
        break;
      case 'continue':
        if (this.debugFinal) this._startFinal({ save: false });
        else if (this.debugNight) this.startNight(this.debugNight, { save: false });
        else if (this.save?.checkpoint === 'n2final') this._startFinal(); // punto de control: 6 AM de la noche 2
        else if (this.save) this.startNight(this.save.night);
        break;
      case 'yes':
        this.menu.confirming = false;
        this._newGame();
        break;
      case 'no':
        this.menu.confirming = false;
        break;
    }
  }

  /**
   * Final de la noche con el conducto. La partida ya está guardada: no
   * hay peligro, el jugador solo escucha y no puede hacer nada.
   */
  _startDuctEnding() {
    this.cameras.forceClose();
    this.office.setLightsOff();
    this.terminal.blur();
    this.audio.stopAll(); // alarmas, zumbido de luces...
    this.audio.startAmbience();
    this.audio.ductApproach(CONFIG.ENDING.APPROACH_TIME);
    this.endingDark = false;
    this._setState('ending');
  }

  /**
   * FINAL DE LA NOCHE 2 (6 AM): se va la luz y empieza la Fase 1. Se
   * guarda el punto de control para que Continue vuelva aquí.
   */
  _startFinal({ save = true } = {}) {
    this.nightNumber = 2;
    this.saveEnabled = save;  // en depuración no se guarda nada
    this.save = { ...(this.save ?? SaveData.fresh()), night: 2, checkpoint: 'n2final' };
    this.save.flags ??= {};
    this.save.tapesHeard ??= {};
    if (save) SaveData.save(this.save);
    this.tape.stop();
    this.audio.setMasterLevel(1);
    this.cameras.reset();
    this.office.reset();
    this.terminal.reset();
    this.audio.stopAll();
    this.audio.powerDown(); // se apagan todas las luces
    this.ambient.reset(getNight(2));
    if (!this.final) this.final = new Night2Ending(this);
    else this.final.start();
    if (this.debugFinal && this.debugPhase > 1) this.final.debugJump(this.debugPhase);
    this.attacker = null;
    this.deathCause = null;
    this._setState('final');
  }

  /** Te atrapan durante el final (o se acaba el tiempo de la huida): susto y derrota. */
  _finalDeath(enemy, cause = null) {
    this.attacker = enemy;
    this.deathCause = cause ?? `final_${enemy}`;
    this.tape.stop();
    this.audio.setMasterLevel(1);
    this.audio.scream();
    this._setState('jumpscare');
  }

  /** Algo que pasa y se recuerda en la partida (save.flags). */
  _setFlag(name) {
    this.save.flags = { ...(this.save.flags ?? {}), [name]: true };
    if (this.saveEnabled) SaveData.save(this.save);
  }

  /**
   * Fin de la noche 2 (tras la huida y el pasillo): noche 3 desbloqueada y
   * el pasillo abierto pasa a formar parte de la partida (flags).
   */
  _finalWin() {
    this.save = {
      ...this.save, night: Math.min(3, NIGHTS.length), checkpoint: null,
      flags: { ...(this.save.flags ?? {}), pasilloAbierto: true },
    };
    if (this.saveEnabled) SaveData.save(this.save);
    this.audio.stopAll();
    this.audio.setMasterLevel(1);
    // AQUÍ IRÁ LA ESCENA FINAL DE LA NOCHE 2 (por ahora: negro y
    // "6:00 AM"; ver _drawNight2Done).
    this._setState('n2done');
  }

  _newGame() {
    if (this.debugFinal) {
      this._startFinal({ save: false });
      return;
    }
    if (this.debugNight) {
      this.startNight(this.debugNight, { save: false });
      return;
    }
    SaveData.clear();
    this.save = SaveData.fresh();
    this.startNight(1);
  }

  _menuKey(code) {
    this._ensureAudio();
    const m = this.menu;
    if (code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight') {
      m.move(1, this.save);
    } else if (code === 'Enter' || code === 'Space' || code === 'NumpadEnter') {
      this._menuAction(m.confirming ? m.confirmChoice : m.selected);
    } else if (code === 'Escape' && m.confirming) {
      m.confirming = false;
    }
  }

  /** Cinta ya escuchada: se ofrece el botón para ponerla (primera hora). */
  _tapeAvailable() {
    return this.tape.available && !this.tape.playing && this.tape.pending === null && this.clock.elapsed < CONFIG.SECONDS_PER_HOUR;
  }

  _onKey(code, e) {
    if (this.state === 'menu') {
      this._menuKey(code);
      return;
    }
    if (this.state === 'final') {
      this.final.key(code, e);
      return;
    }
    if ((this.state === 'win' || this.state === 'lose') && this.stateTime > 1.5 && (code === 'Enter' || code === 'Space')) {
      this._toMenu();
      return;
    }
    if (this.state === 'night') {
      // Mientras se escribe en la consola, el teclado es solo para ella.
      if (this.terminal.focused) {
        this.audio.keyClick();
        const cmd = this.terminal.key(e);
        if (cmd !== null) this._runCommand(cmd);
        return;
      }
      if (this.note.active && (code === 'Escape' || code === 'Enter')) this.note.close();
      else if (code === CONFIG.LOOK_BACK.KEY && this.lookBack.enabled && !this.cameras.open) this.lookBack.toggle();
      else if ((code === 'ArrowLeft' || code === 'ArrowRight') && this.lookBack.enabled && !this.cameras.open) {
        this.lookBack.queue = [];
        this.lookBack.step(code === 'ArrowLeft' ? -1 : 1);
      } else if (this.lookBack.turned && KEYMAP[code]) this._doAction(KEYMAP[code]);
      else if (this.lookBack.turned) {
        // Mirando a otra pared: linterna (ESPACIO, en el pasillo central desde
        // la noche 3) y la cinta. Las puertas y luces siguen con Q/A/E/D.
        if (code === 'Space' && this.lookBack.facingBack && this.nightNumber >= CONFIG.LOOK_BACK.FROM_NIGHT) {
          this.backFlash.toggle();
          this.audio.keyClick();
        } else if (code === 'KeyM' && this.tape.playing) this.tape.stop();
        else if (code === 'KeyC' && this.tape.playing) this.tape.toggleSubtitles();
      } else if (code === 'KeyL' && this._tapeAvailable()) this.tape.playNow();
      else if (code === 'KeyM' && this.tape.playing) this.tape.stop();
      else if (code === 'KeyC' && this.tape.playing) this.tape.toggleSubtitles();
      else if ((code === 'Enter' || code === 'NumpadEnter') && !this.cameras.open) this.terminal.focus();
      else if (code === 'Space' || code === 'KeyS') this._toggleMonitor();
      else if (this.cameras.open && code === 'Tab') this._toggleMap();
      else if (this.cameras.open && code === 'KeyG') {
        if (this.cameras.fullyOpen) this.cameras.mapMode === 'vent' ? this._spray() : this._lure();
      } else if (this.cameras.open && this.cameras.mapMode === 'vent' && VENT_KEYS[code]) this.cameras.select(VENT_KEYS[code]);
      else if (this.cameras.open && this.cameras.mapMode === 'main' && CAM_KEYS[code]) this.cameras.select(CAM_KEYS[code]);
      else if (this.cameras.open && this.cameras.active === 'cryo' && (code === 'ArrowUp' || code === 'ArrowDown')) {
        if (this.cameras.fullyOpen) this._adjustCryo(code === 'ArrowUp' ? 1 : -1);
      } else if (this.cameras.open && this.cameras.active === 'reactor' && code === 'KeyR') {
        if (this.cameras.fullyOpen) this._cool();
      } else if (!this.cameras.open && KEYMAP[code]) {
        // Los botones de la oficina no se ven con el monitor subido.
        this._doAction(KEYMAP[code]);
      }
    }

    if (this.debug && this.state === 'night') {
      if (code === 'KeyT') this.speed = this.speed === 1 ? CONFIG.DEBUG_SPEED : 1;
      if (code === 'KeyP') this.reactor.level = Math.max(this.reactor.level, 97);
      if (code === 'KeyH') this.clock.elapsed += CONFIG.SECONDS_PER_HOUR;
      if (code === 'KeyB') this.blackout.trigger();
      if (code === 'KeyW') this.ai.specimen.onOpportunity(this.world);
      if (code === 'KeyK') this.cryo.temp = this.cryo.mode === 'min' ? this.cryo.target - 1 : this.cryo.target + 1;
      // Noche 2 (conductos)
      if (code === 'KeyN' && this.intro) this._endIntro();
      if (code === 'KeyJ') {
        // Saltar a las 2:00 AM (El Largo se activa)
        if (this.intro) this._endIntro();
        this.clock.elapsed = Math.max(this.clock.elapsed, NIGHT2.LARGO.START_HOUR * CONFIG.SECONDS_PER_HOUR);
      }
      if (code === 'KeyF') this.gas.trigger();
      if (code === 'KeyX') this.clock.elapsed = CONFIG.NIGHT_HOURS * CONFIG.SECONDS_PER_HOUR - 2; // a las 5:59
      if (code === 'KeyI') {
        // El Insecto paso a paso: aparece (V2-V5) → V1 → V6 o V7
        const ins = this.ai.insecto;
        if (ins.state === 'away') ins.appear(this.world);
        else if (ins.room !== 'v1' && ins.enterIn === null) ins.moveTo('v1', this.world);
        else if (ins.room === 'v1') ins.moveTo(this.rng.next() < 0.5 ? 'v6' : 'v7', this.world);
      }
      if (code === 'KeyY' && this.ai.largo.state === 'room') this.ai.largo.hit(this.world);
    }
  }

  _onMove(x, y) {
    let over = false;
    if (this.state === 'final') this.final.move(x, y);
    this.mouse.x = x;
    this.mouse.y = y;
    if (this.state === 'night') {
      const strip = !this.cameras.open && !this.terminal.focused && this.lookBack.hover(x, y);
      const face = this.lookBack.face;
      over = this.lookBack.turned ? strip || (face !== 'back' && !!this.officeView.hitTest(x, y, face)) : this.cameras.open
        ? this.cameraView.hitTest(x, y, this.cameras)
        : strip || this.officeView.hitTest(x, y, 'front') || inside(MONITOR_TAB, x, y);
      if (this.tape.playing && (inside(TAPE_SKIP, x, y) || inside(TAPE_SUBS, x, y))) over = true;
      if (this._tapeAvailable() && inside(TAPE_PLAY, x, y)) over = true;
    } else if (this.state === 'menu') {
      const hit = this.menu.hitTest(x, y, this.save);
      over = !!hit;
      // Al pasar el ratón, la opción queda seleccionada (como con las flechas)
      if (hit === 'newGame' || hit === 'continue') this.menu.selected = hit;
      if (hit === 'yes' || hit === 'no') this.menu.confirmChoice = hit;
    }
    this.canvas.style.cursor = over ? 'pointer' : 'default';
  }

  _toggleMonitor() {
    if (!this.cameras.enabled || this.lookBack.turned) {
      this.events.emit('denied', 'center');
      return;
    }
    this.cameras.toggle();
  }

  _toggleMap() {
    if (!this.cameras.toggleMap()) this.events.emit('denied', 'center');
  }

  /**
   * Suelta insecticida en el conducto que se está viendo (solo V6/V7,
   * NIGHT2.GAS.VENTS). Si El Insecto está ahí, se aleja (y, en la
   * introducción, empieza la noche). Cada soltada cuenta para la fuga.
   */
  _spray() {
    const cams = this.cameras;
    if (cams.mapMode !== 'vent' || !cams.signal || !NIGHT2.GAS.VENTS.includes(cams.active) || !this.gas.spray()) {
      this.events.emit('denied', 'center');
      return;
    }
    this.events.emit('gasSpray', { room: cams.active });
    this.cameraView.sprayCloud(cams.active);
    const ins = this.ai.insecto;
    if (ins.state === 'vent' && ins.room === cams.active) {
      ins.repel(this.world);
      if (this.intro) this._endIntro();
    }
  }

  /** Golpes metálicos en la sala que se está viendo (atraen a El Largo). */
  _lure() {
    if (!this.cameras.hasLure || this.cameras.mapMode !== 'main' || this.lureCooldown > 0) {
      this.events.emit('denied', 'center');
      return;
    }
    this.lureCooldown = NIGHT2.LARGO.LURE_COOLDOWN;
    this.events.emit('lure', { room: this.cameras.active });
    this.ai.largo.hearLure(this.cameras.active, this.world);
  }

  /** El Insecto se ha ido: arranca la noche de verdad. */
  _endIntro() {
    if (!this.intro) return;
    this.intro = null;
    const ins = this.ai.insecto;
    if (ins.state === 'vent') ins.repel(this.world);
    this.events.emit('nightStart');
  }

  _cool() {
    if (!this.reactor.startCooling()) this.events.emit('denied', 'center');
  }

  /**
   * Comando escrito en la consola. Los comandos disponibles se listan
   * en CONFIG.TERMINAL_COMMANDS (y en el cartel de la oficina).
   */
  _runCommand(text) {
    const cmd = text.trim().toLowerCase();
    if (cmd === CONFIG.BLACKOUT_COMMAND) {
      if (this.blackout.tryCommand(cmd)) this.terminal.print('Sistema restaurado');
      else this.terminal.print('No hay ningun fallo activo');
      return;
    }
    if (cmd === NIGHT2.UPDATE_COMMAND && getNight(this.nightNumber).ventsUpdate) {
      if (!this.cameras.hasVents) this.terminal.print('No hay actualizaciones');
      else if (this.cameras.ventsUnlocked) this.terminal.print('Ventilacion ya en linea');
      else {
        this.cameras.ventsUnlocked = true;
        this.terminal.print('Ventilacion en linea');
        this.terminal.print('Monitor > TOGGLE');
        this.events.emit('ventsUnlocked');
      }
      return;
    }
    if (cmd === NIGHT2.LEAK.COMMAND.toLowerCase()) {
      if (this.gas.tryCommand(cmd)) this.terminal.print('Fuga sellada');
      else this.terminal.print('No hay ninguna fuga');
      return;
    }
    // Comando secreto (solo durante el apagón); si no, desconocido normal
    const secret = this.easterEgg.tryCommand(cmd, this.blackout.active);
    if (secret) {
      this.terminal.print(secret);
      return;
    }
    this.terminal.print('Comando no reconocido');
  }

  _adjustCryo(dir) {
    if (this.cryo.adjust(dir)) this.audio.keyClick();
    else this.events.emit('denied', 'center');
  }

  _doAction({ type, side }) {
    if (type === 'door') this.office.toggleDoor(side);
    else this.office.toggleLight(side);
  }

  // ---------------------------------------------------------------
  // Bucle
  // ---------------------------------------------------------------

  _frame(now) {
    if (this.lastTime === null) this.lastTime = now;
    // dt limitado: si la pestaña estuvo oculta, no saltamos minutos.
    const realDt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    // Un error en un fotograma no debe parar el bucle (antes la pantalla
    // se quedaba negra para siempre). Se avisa en la consola una vez.
    try {
      this.update(realDt * this.speed);
      this.render();
    } catch (err) {
      if (!this._errorShown) console.error('Vigía-7: error en el bucle del juego', err);
      this._errorShown = true;
      this.renderer.ctx.reset?.(); // limpia transformaciones a medias
    }
    requestAnimationFrame(this._frame);
  }

  update(dt) {
    this.stateTime += dt;
    this.officeView.update(dt);
    this.cameraView.update(dt);

    switch (this.state) {
      case 'menu':
        this.menu.update(dt);
        break;
      case 'night':
        this.tape.update(dt, !!this.intro);
        this.office.update(dt);
        this.cameras.update(dt);
        if (this.lookBack.enabled) {
          if (this.cameras.open || this.terminal.focused) this.lookBack.edge = null;
          this.lookBack.update(dt);
          this.backView.update(dt);
          this.backFlash.update(dt);
        }
        this.easterEgg.update(dt);
        this.note.update(dt);
        this.lureCooldown = Math.max(0, this.lureCooldown - dt);
        this.gas.update(dt);
        if (this.state !== 'night') return; // la fuga de gas ha acabado contigo
        if (this.audio.ctx) this.ambient.update(dt, this.ai);
        if (this.intro) {
          this._updateIntro(dt);
          break;
        }
        this.clock.update(dt);
        this.blackout.update(dt, this.clock.elapsed);
        this.cryo.update(dt);
        this.ai.update(dt);
        if (this.state !== 'night') return; // un enemigo ha atacado
        this.reactor.update(dt, this.office, this.cameras.open);
        if (this.state !== 'night') return; // el reactor ha explotado
        if (this.clock.finished && getNight(this.nightNumber).finalSequence) {
          // Noche 2: a las 6 AM empieza el final (no se gana todavía)
          this._startFinal({ save: !this.debugNight });
          break;
        }
        if (this.clock.finished) {
          // Noche superada: se desbloquea la siguiente
          const last = this.nightNumber >= NIGHTS.length;
          this.save = { ...this.save, night: last ? this.nightNumber : this.nightNumber + 1, completed: this.save.completed || last };
          SaveData.save(this.save);
          this.tape.stop();
          if (getNight(this.nightNumber).endingDuct) {
            this._startDuctEnding();
          } else {
            this.audio.stopAll();
            this.audio.chime();
            this._setState('win');
          }
        }
        break;
      case 'final':
        this.tape.update(dt);
        this.office.update(dt);
        this.final.update(dt);
        if (this.state === 'final' && this.audio.ctx) this.ambient.update(dt, {});
        break;
      case 'n2done':
        // Negro y el reactor apagándose; luego la pantalla de turno superado
        if (this.stateTime >= 5) this._setState('win');
        break;
      case 'ending':
        this.office.update(dt);
        if (!this.endingDark && this.stateTime >= CONFIG.ENDING.APPROACH_TIME) {
          // Llega por el conducto: golpe y se va la luz
          this.endingDark = true;
          this.audio.ductSlam();
        }
        if (this.stateTime >= CONFIG.ENDING.APPROACH_TIME + CONFIG.ENDING.DARK_TIME) {
          this.audio.stopAll();
          this.audio.chime();
          this._setState('win');
        }
        break;
      case 'jumpscare':
        if (this.stateTime >= CONFIG.JUMPSCARE_TIME) this._setState('lose');
        break;
      case 'explosion':
      case 'gasDeath':
        if (this.stateTime >= 2.5) this._setState('lose');
        break;
    }
  }

  /**
   * Introducción de las noches con conductos: solo corre el tiempo
   * límite. El Insecto espera (se le oye) hasta que se le ahuyenta.
   */
  _updateIntro(dt) {
    this.intro.time += dt;
    this.ai.insecto.tick(dt, this.world);
    if (this.intro.time >= NIGHT2.INTRO.TIME_LIMIT) this._attack(this.ai.insecto);
  }

  // ---------------------------------------------------------------
  // Dibujo
  // ---------------------------------------------------------------

  render() {
    const { ctx } = this.renderer;
    this.renderer.begin();

    switch (this.state) {
      case 'menu':
        this.menu.draw(ctx, { save: this.save, effects: this.effects, audioReady: !!this.audio.ctx });
        break;
      case 'night':
        this._drawNight(ctx);
        break;
      case 'jumpscare':
        drawJumpscare(ctx, this.attacker, this.stateTime, this.effects);
        break;
      case 'explosion':
        this._drawExplosion(ctx);
        break;
      case 'gasDeath':
        this._drawGasDeath(ctx);
        break;
      case 'ending':
        this._drawEnding(ctx);
        break;
      case 'final':
        this.final.draw(ctx);
        drawTapeOverlay(ctx, this.tape);
        break;
      case 'n2done':
        this._drawNight2Done(ctx);
        break;
      case 'win':
        this._drawEndScreen(ctx, '6:00 AM', 'Turno completado', '#e8eef5');
        break;
      case 'lose':
        this._drawEndScreen(ctx, 'FIN DEL TURNO', DEATH_TEXT[this.deathCause] ?? '', '#ff5050');
        break;
    }

    this.renderer.end();
  }

  _drawNight(ctx) {
    // Con el monitor subido del todo no hace falta dibujar la oficina.
    if (!this.cameras.fullyOpen) {
      this.lookBack.draw(ctx, {
        front: (c) => this._drawOfficeFront(c, 'front'),
        left: (c) => this._drawOfficeFront(c, 'left'),
        right: (c) => this._drawOfficeFront(c, 'right'),
        back: (c) => this._drawBack(c),
      });
      if (this.lookBack.facingBack) {
        // El pasillo está a oscuras: solo se ve con la linterna
        const { x: mx, y: my } = this.mouse;
        this.backFlash.draw(ctx, mx, my, BACK_HATCH, 0.93);
        if (this.drawCorridorEnemies) this.backFlash.reveal(ctx, mx, my, (c) => this.drawCorridorEnemies(c));
      }
      this.effects.vignette(ctx);
      this.effects.static(ctx, 0.05);
    }
    if (!this.cameras.open) this.lookBack.drawStrips(ctx);
    if (this.cameras.anim > 0) {
      this._drawCameraLayer(ctx);
    } else if (!this.blackout.active && !this.lookBack.turned) {
      this.cameraView.drawOfficeTab(ctx);
    }
    this._drawNightOverlay(ctx);
    this.note.draw(ctx);
  }

  /** Una pared de la oficina ('front', 'left' o 'right'). */
  _drawOfficeFront(ctx, face = 'front') {
    this.officeView.draw(ctx, this.office, {
      face,
      blackout: this.blackout.active,
      terminal: this.terminal,
      reactor: this.reactor,
      locked: this.office.locked,
      night: this.nightNumber,
      doorEnemies: { left: this.ai.atDoor('left'), right: this.ai.atDoor('right') },
      cameras: this.cameras,
      gasLeak: this.gas.active,
      easterEgg: this.easterEgg,
      mouse: this.mouse,
      introProgress: this.intro ? Math.min(1, this.intro.time / NIGHT2.INTRO.TIME_LIMIT) : 0,
    });
  }

  /** Detrás de la oficina: el pasillo central, abierto desde el final de la noche 2. */
  _drawBack(ctx) {
    const open = this.save?.flags?.pasilloAbierto || this.nightNumber >= 3;
    this.backView.draw(ctx, { open: open ? 1 : 0, sealed: !open, red: 0 });
  }

  _drawCameraLayer(ctx) {
    this.cameraView.draw(ctx, this.cameras, this.effects, {
      roamers: this.ai.roamers,
      specimen: this.ai.specimen,
      frozen: this.ai.frozen,
      cryo: this.cryo,
      reactor: this.reactor,
      insect: this.ai.insecto,
      largo: this.ai.largo,
      gas: this.gas,
      lureCooldown: this.lureCooldown,
      night: this.nightNumber,
      clockElapsed: this.clock.elapsed,
    });
  }

  _drawNightOverlay(ctx) {
    const warnings = [];
    if (this.gas.active) warnings.push(`FUGA DE GAS: escribe ${NIGHT2.LEAK.COMMAND} (${Math.ceil(this.gas.countdown)} s)`);
    if (this.intro) {
      const left = Math.ceil(NIGHT2.INTRO.TIME_LIMIT - this.intro.time);
      warnings.push(this.cameras.ventsUnlocked
        ? `Busca a El Insecto en los conductos y echale gas (${left} s)`
        : `Algo en los conductos: escribe ${NIGHT2.UPDATE_COMMAND} (${left} s)`);
    }
    if (this.blackout.active) warnings.push(`APAGON: escribe ${CONFIG.BLACKOUT_COMMAND} en la consola`);
    if (this.ai.frozen.state === 'warning') warnings.push('CRIOGENIA: temperatura fuera de rango (CAM 05)');
    if (this.ai.frozen.state === 'escaped') warnings.push('CRIOGENIA: capsula vacia. Algo corre hacia aqui');
    if (this.reactor.warning) warnings.push('REACTOR: temperatura critica (CAM 04)');
    if (this.reactor.isCooling) warnings.push('ENFRIANDO REACTOR: compuertas y luces bloqueadas');

    let hint;
    if (this.terminal.focused) hint = 'Escribiendo en la consola...   Enter: ejecutar   Esc: salir';
    else if (this.lookBack.facingBack) hint = 'Pasillo central   ' + (this.nightNumber >= CONFIG.LOOK_BACK.FROM_NIGHT ? 'Espacio: linterna   ' : '') + 'Ratón a un borde: girar   V: volver';
    else if (this.lookBack.turned) hint = 'Clic: PUERTA / LUZ   Q/A: izq.   E/D: der.   Ratón a un borde: girar';
    else if (this.cameras.open && this.cameras.mapMode === 'vent') hint = 'Teclas 1-7: conducto   G: insecticida (V6/V7)   Tab: mapa de salas   Espacio: bajar';
    else if (this.cameras.open && this.cameras.hasVents) hint = 'Teclas 1-0: camara   G: golpes metalicos   Tab: ventilacion   Espacio: bajar';
    else if (this.cameras.open) hint = 'Clic en el mapa o teclas 1-0: cambiar camara   Espacio: bajar monitor';
    else if (this.blackout.active) hint = 'Enter: escribir en la consola';
    else hint = 'Ratón a un borde: girar   Q/A: puerta/luz izq.   E/D: der.   Espacio: monitor   Enter: consola';

    // Fuga de gas: la imagen se tiñe de gas y parpadea en rojo
    if (this.gas.active) {
      const k = 1 - this.gas.countdown / NIGHT2.LEAK.COUNTDOWN;
      ctx.fillStyle = `rgba(150,170,40,${0.08 + 0.25 * k})`;
      ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
      if (Math.floor(this.stateTime * 3) % 2 === 0) {
        ctx.fillStyle = 'rgba(200,0,0,0.18)';
        ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
      }
    }

    drawHUD(ctx, {
      clockLabel: this.clock.label,
      night: this.nightNumber,
      reactor: this.reactor,
      warnings,
      hint,
      tape: this.tape,
      tapeAvailable: this._tapeAvailable(),
      debug: this.debug ? this._debugLines() : null,
    });
  }

  /** 6 AM: la oficina tiembla cada vez más y parpadea; luego, negro total. */
  _drawEnding(ctx) {
    if (this.endingDark) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
      return;
    }
    const k = Math.min(1, this.stateTime / CONFIG.ENDING.APPROACH_TIME);
    ctx.save();
    ctx.translate((Math.random() - 0.5) * 14 * k * k, (Math.random() - 0.5) * 10 * k * k);
    this.officeView.draw(ctx, this.office, {
      blackout: false,
      terminal: this.terminal,
      reactor: this.reactor,
      locked: false,
      night: this.nightNumber,
      doorEnemies: { left: [], right: [] },
    });
    ctx.restore();
    // Las luces fallan cada vez más a medida que se acerca
    if (Math.random() < 0.02 + 0.3 * k * k) {
      ctx.fillStyle = `rgba(0,0,0,${0.5 + 0.4 * k})`;
      ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    }
    this.effects.vignette(ctx);
    this.effects.static(ctx, 0.05 + 0.1 * k);
    drawHUD(ctx, { clockLabel: this.clock.label, night: this.nightNumber, reactor: null, warnings: [] });
  }

  /** Noche 2 superada: negro y "6:00 AM" que aparece despacio. */
  _drawNight2Done(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    if (this.stateTime < 2) return;
    ctx.globalAlpha = Math.min(1, (this.stateTime - 2) / 1.5);
    ctx.fillStyle = '#e8eef5';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 110px "Courier New", monospace';
    ctx.fillText('6:00 AM', CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2);
    ctx.globalAlpha = 1;
  }

  _drawExplosion(ctx) {
    // Destello blanco que se apaga a negro con temblor
    const k = Math.min(1, this.stateTime / 2.5);
    ctx.fillStyle = `rgb(${255 * (1 - k)},${230 * (1 - k)},${200 * (1 - k)})`;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    this.effects.static(ctx, 0.3 * (1 - k));
  }

  /** Gas en la oficina: la imagen se vuelve verdosa y se apaga. */
  _drawGasDeath(ctx) {
    const k = Math.min(1, this.stateTime / 2.5);
    this.officeView.draw(ctx, this.office, {
      blackout: false, terminal: this.terminal, reactor: this.reactor, locked: false,
      night: this.nightNumber, doorEnemies: { left: [], right: [] }, cameras: this.cameras, gasLeak: true,
    });
    ctx.fillStyle = `rgba(120,140,30,${0.3 + 0.5 * k})`;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    ctx.fillStyle = `rgba(0,0,0,${k * k})`;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    this.effects.vignette(ctx, 0.6 + 0.4 * k);
  }

  _drawEndScreen(ctx, title, subtitle, color) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    this.effects.static(ctx, 0.08);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = Math.min(1, this.stateTime);
    ctx.fillStyle = color;
    ctx.font = 'bold 110px "Courier New", monospace';
    ctx.fillText(title, CONFIG.WIDTH / 2, 380);
    ctx.font = '28px "Courier New", monospace';
    ctx.fillText(subtitle, CONFIG.WIDTH / 2, 490);
    if (this.stateTime > 1.5) {
      ctx.fillStyle = 'rgba(232,238,245,0.6)';
      ctx.font = '22px "Courier New", monospace';
      ctx.fillText('Haz clic o pulsa Enter para volver al menú', CONFIG.WIDTH / 2, 640);
    }
    ctx.globalAlpha = 1;
  }

  _debugNight2() {
    const ins = this.ai.insecto;
    const lg = this.ai.largo;
    const back = ins.state === 'away' && isFinite(ins.returnIn) ? ` vuelve en ${ins.returnIn.toFixed(0)} s` : '';
    const intro = this.intro ? `   INTRO ${this.intro.time.toFixed(0)}/${NIGHT2.INTRO.TIME_LIMIT} s` : '';
    const crawl = lg.state === 'crawling' ? ` llega en ${lg.crawlLeft.toFixed(1)} s`
      : lg.state === 'hidden' ? ` vuelve en ${lg.hiddenIn.toFixed(0)} s` : '';
    const enter = ins.enterIn !== null ? ` ENTRA en ${ins.enterIn.toFixed(1)} s` : '';
    const leak = this.gas.active ? ` FUGA ${this.gas.countdown.toFixed(1)} s` : '';
    return `Insecto: ${ins.state} ${ins.room ?? ''} IA ${ins.level}${back}${enter}${intro}   `
      + `Largo: ${lg.state} ${lg.room ?? ''} golpes ${lg.breakStage}/${NIGHT2.LARGO.BREAK_STAGES} IA ${lg.level}${crawl}   `
      + `Gas: usos ${this.gas.uses} riesgo ${Math.round(this.gas.nextRisk * 100)}%${leak}`;
  }

  _debugLines() {
    const sp = this.ai.specimen;
    const where = (e) => `${e.room ?? '-'}${e.atDoor ? ` (entra en ${e.doorTimer.toFixed(1)}s)` : ''} IA ${e.level}`;
    return [
      `[DEBUG] x${this.speed}  T:acelerar P:reactor 97% H:+1h B:apagon W:grieta K:romper temp`,
      `        N:saltar intro  J:ir a las 2:00  X:ir a las 5:59  F:fuga de gas  I:insecto aparece > V1 > V6/V7  Y:Largo golpea`,
      `noche ${this.clock.elapsed.toFixed(1)} s   reactor ${this.reactor.level.toFixed(1)}%  usos ${this.reactor.bars}  riesgo apagon ${Math.round(this.reactor.blackoutRisk * 100)}%`,
      `Especimen: muro ${sp.wallStage}/${CONFIG.WALL_STAGES} ruta ${sp.routeName ?? '-'} sala ${where(sp)}`,
      this._debugNight2(),
      `Congelado: ${this.ai.frozen.state} sala ${this.ai.frozen.room ?? '-'} temp ${this.cryo.temp} req ${this.cryo.mode} ${this.cryo.target}`,
      `apagones pendientes: ${this.blackout.schedule.map((s) => (s / CONFIG.SECONDS_PER_HOUR).toFixed(2) + 'h').join(', ') || '-'}${this.blackout.extraIn !== null ? `  extra en ${this.blackout.extraIn.toFixed(1)} s` : ''}`,
    ];
  }
}
