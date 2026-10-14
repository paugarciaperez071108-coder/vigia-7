// =============================================================
// Game.js — Bucle principal y máquina de estados.
//
// Estados:
//   'menu'      → menú principal: NEW GAME / CONTINUE (el primer clic
//                 o tecla desbloquea el audio)
//   'night'     → turno en curso
//   'jumpscare' → te han atrapado (animación del susto)
//   'explosion' → el reactor ha llegado al 100 %
//   'ending'    → 6:00 AM con final del conducto: algo se acerca y se
//                 va la luz (solo en las noches con endingDuct)
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
import { AIController } from '../ai/AIController.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { TapePlayer } from '../audio/TapePlayer.js';
import { Renderer } from '../render/Renderer.js';
import { Effects } from '../render/Effects.js';
import { OfficeView } from '../render/OfficeView.js';
import { CameraView, MONITOR_TAB } from '../render/CameraView.js';
import { Sprites } from '../render/Sprites.js';
import { ROOMS } from '../world/StationMap.js';
import { drawHUD, TAPE_SKIP, TAPE_SUBS, TAPE_PLAY } from '../ui/HUD.js';
import { drawJumpscare } from '../ui/Jumpscare.js';
import { Terminal } from '../ui/Terminal.js';
import { getNight, NIGHTS } from '../night/nights.js';
import { SaveData } from './SaveData.js';
import { Menu } from '../ui/Menu.js';

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

const DEATH_TEXT = {
  specimen: 'El Espécimen te ha atrapado.',
  alto: 'El Alto te ha encontrado.',
  rastrero: 'El Rastrero ha entrado arrastrándose.',
  frozen: 'El Congelado ha llegado corriendo a la oficina.',
  explosion: 'El reactor ha hecho explotar la nave.',
};

const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    const params = new URLSearchParams(location.search);
    this.debug = params.has('debug');
    this.speed = 1;
    this.rng = new Random(params.has('seed') ? Number(params.get('seed')) : Date.now());

    this.events = new Events();
    this.renderer = new Renderer(canvas);
    this.effects = new Effects(this.renderer.ctx);
    this.audio = new AudioEngine(this.events);
    this.tape = new TapePlayer(this.audio, this.events);
    this.clock = new NightClock(this.events);
    this.office = new Office(this.events);
    this.reactor = new Reactor(this.events);
    this.cryo = new CryoPanel(this.events, this.rng);
    this.blackout = new Blackout(this.events, this.rng);
    this.cameras = new CameraSystem(this.events);
    this.terminal = new Terminal();
    this.officeView = new OfficeView();
    this.sprites = new Sprites();
    this.sprites.load(); // imágenes opcionales de assets/manifest.json
    this.cameraView = new CameraView(this.sprites);

    // "Mundo" que ven los enemigos: lo que pueden consultar y cómo atacan.
    this.world = {
      rng: this.rng,
      events: this.events,
      office: this.office,
      cameras: this.cameras,
      cryo: this.cryo,
      attack: (enemy) => this._attack(enemy),
    };
    this.ai = new AIController(this.world);

    this.input = new Input(canvas, this.renderer, {
      onClick: (x, y) => this._onClick(x, y),
      onKey: (code, e) => this._onKey(code, e),
      onMove: (x, y) => this._onMove(x, y),
    });

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
      SaveData.save(this.save);
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

  startNight(n) {
    this.nightNumber = n;
    // Se guarda la noche en curso: si mueres, Continue vuelve a ella.
    this.save = { ...(this.save ?? SaveData.fresh()), night: n };
    SaveData.save(this.save);
    const night = getNight(n);
    this.audio.stopAll();
    this.clock.reset();
    this.office.reset();
    this.cameras.reset();
    this.terminal.reset();
    this.reactor.reset(night);
    this.cryo.reset(night.cryo);
    this.blackout.reset(night.blackouts);
    this.ai.setup(night);
    this.audio.startAmbience();
    // Cinta del hombre de la cinta: suena sola solo si no se ha escuchado entera
    this.tape.schedule(n, { autoplay: !this.save.tapesHeard[n] });
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

  _explode() {
    if (this.state !== 'night') return;
    this.cameras.forceClose();
    this.tape.stop();
    this.deathCause = 'explosion';
    this.audio.explosion();
    this._setState('explosion');
  }

  _setState(s) {
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
        if (this.cameras.open) {
          // Con el monitor subido: mapa, pestaña y controles de la cámara activa.
          const hit = this.cameraView.hitTest(x, y, this.cameras.active);
          if (hit?.type === 'cam') this.cameras.select(hit.id);
          else if (hit?.type === 'monitor') this.cameras.toggle();
          else if (hit?.type === 'cryo' && this.cameras.fullyOpen) this._adjustCryo(hit.dir);
          else if (hit?.type === 'cool' && this.cameras.fullyOpen) this._cool();
        } else {
          const action = this.officeView.hitTest(x, y);
          if (action?.type === 'terminal') {
            if (this.blackout.active) this.terminal.focus();
          } else if (action) {
            this._doAction(action);
          } else if (inside(MONITOR_TAB, x, y)) {
            this._toggleMonitor();
          }
        }
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
        if (this.save) this.startNight(this.save.night);
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

  _newGame() {
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
      if (code === 'KeyL' && this._tapeAvailable()) this.tape.playNow();
      else if (code === 'KeyM' && this.tape.playing) this.tape.stop();
      else if (code === 'KeyC' && this.tape.playing) this.tape.toggleSubtitles();
      else if (code === 'Enter' && this.blackout.active && !this.cameras.open) this.terminal.focus();
      else if (code === 'Space' || code === 'KeyS') this._toggleMonitor();
      else if (this.cameras.open && CAM_KEYS[code]) this.cameras.select(CAM_KEYS[code]);
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
    }
  }

  _onMove(x, y) {
    let over = false;
    if (this.state === 'night') {
      over = this.cameras.open
        ? this.cameraView.hitTest(x, y, this.cameras.active)
        : this.officeView.hitTest(x, y) || inside(MONITOR_TAB, x, y);
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
    if (!this.cameras.enabled) {
      this.events.emit('denied', 'center');
      return;
    }
    this.cameras.toggle();
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
        this.clock.update(dt);
        this.tape.update(dt);
        this.office.update(dt);
        this.cameras.update(dt);
        this.blackout.update(dt, this.clock.elapsed);
        this.cryo.update(dt);
        this.ai.update(dt);
        if (this.state !== 'night') return; // un enemigo ha atacado
        this.reactor.update(dt, this.office, this.cameras.open);
        if (this.state !== 'night') return; // el reactor ha explotado
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
        if (this.stateTime >= 2.5) this._setState('lose');
        break;
    }
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
      case 'ending':
        this._drawEnding(ctx);
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
      this.officeView.draw(ctx, this.office, {
        blackout: this.blackout.active,
        terminal: this.terminal,
        reactor: this.reactor,
        locked: this.office.locked,
        night: this.nightNumber,
        doorEnemies: { left: this.ai.atDoor('left'), right: this.ai.atDoor('right') },
      });
      this.effects.vignette(ctx);
      this.effects.static(ctx, 0.05);
    }
    if (this.cameras.anim > 0) {
      this.cameraView.draw(ctx, this.cameras, this.effects, {
        roamers: this.ai.roamers,
        specimen: this.ai.specimen,
        frozen: this.ai.frozen,
        cryo: this.cryo,
        reactor: this.reactor,
      });
    } else if (!this.blackout.active) {
      this.cameraView.drawOfficeTab(ctx);
    }

    const warnings = [];
    if (this.blackout.active) warnings.push(`APAGON: escribe ${CONFIG.BLACKOUT_COMMAND} en la consola`);
    if (this.ai.frozen.state === 'warning') warnings.push('CRIOGENIA: temperatura fuera de rango (CAM 05)');
    if (this.ai.frozen.state === 'escaped') warnings.push('CRIOGENIA: capsula vacia. Algo corre hacia aqui');
    if (this.reactor.warning) warnings.push('REACTOR: temperatura critica (CAM 04)');
    if (this.reactor.isCooling) warnings.push('ENFRIANDO REACTOR: compuertas y luces bloqueadas');

    let hint;
    if (this.terminal.focused) hint = 'Escribiendo en la consola...';
    else if (this.cameras.open) hint = 'Clic en el mapa o teclas 1-0: cambiar camara   Espacio: bajar monitor';
    else if (this.blackout.active) hint = 'Enter: escribir en la consola';
    else hint = 'Q/A: puerta/luz izq.   E/D: puerta/luz der.   Espacio: monitor';

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

  _drawExplosion(ctx) {
    // Destello blanco que se apaga a negro con temblor
    const k = Math.min(1, this.stateTime / 2.5);
    ctx.fillStyle = `rgb(${255 * (1 - k)},${230 * (1 - k)},${200 * (1 - k)})`;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    this.effects.static(ctx, 0.3 * (1 - k));
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

  _debugLines() {
    const sp = this.ai.specimen;
    const where = (e) => `${e.room ?? '-'}${e.atDoor ? ` (entra en ${e.doorTimer.toFixed(1)}s)` : ''} IA ${e.level}`;
    return [
      `[DEBUG] x${this.speed}  T:acelerar P:reactor 97% H:+1h B:apagon W:grieta K:romper temp`,
      `noche ${this.clock.elapsed.toFixed(1)} s   reactor ${this.reactor.level.toFixed(1)}%  usos ${this.reactor.bars}  riesgo apagon ${Math.round(this.reactor.blackoutRisk * 100)}%`,
      `Especimen: muro ${sp.wallStage}/${CONFIG.WALL_STAGES} ruta ${sp.routeName ?? '-'} sala ${where(sp)}`,
      `Alto: ${where(this.ai.alto)}   Rastrero: ${where(this.ai.rastrero)}`,
      `Congelado: ${this.ai.frozen.state} sala ${this.ai.frozen.room ?? '-'} temp ${this.cryo.temp} req ${this.cryo.mode} ${this.cryo.target}`,
      `apagones pendientes: ${this.blackout.schedule.map((s) => (s / CONFIG.SECONDS_PER_HOUR).toFixed(2) + 'h').join(', ') || '-'}${this.blackout.extraIn !== null ? `  extra en ${this.blackout.extraIn.toFixed(1)} s` : ''}`,
    ];
  }
}
