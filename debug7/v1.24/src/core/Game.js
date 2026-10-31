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
//   'lockers'   → FINAL DE LA NOCHE 3 (noches con lockersEnding): a las 6 AM
//                 las cámaras siguen rotas y hay que esconderse en una
//                 taquilla y aguantar la respiración (src/ending/Night3Ending.js).
//                 Punto de control 'n3final'.
//   'n4start'   → INICIO DE LA NOCHE 4 (noches con lockerStart): dentro de la
//                 taquilla se elige el camino (src/ending/Night4Start.js).
//                 A = reactivar la luz → turno con las cámaras rotas.
//                 B = 'n4repair': reparar las cámaras (src/ending/Night4Repair.js)
//                 → El Largo y el slime → turno con Slaimi (src/systems/Slaimi.js).
//                 Puntos de control 'n4a', 'n4b' y 'n4turno'.
//                 v0.36: se sale de la taquilla a la oficina y al PASILLO
//                 CENTRAL: panel de reinicio de la pared (A, punto de
//                 control 'n4reboot') o seguir al Comedor (B).
//                 Ruta A: 3 AM alucinaciones (src/systems/Hallucinations.js),
//                 4 AM voces (src/systems/Voices4am.js) y a las 6 AM:
//   'n4sleep'   → FINAL DE LA RUTA A: te duermes (desde las 5:30), hay que
//                 volver a la taquilla (src/ending/Night4Sleep.js). Si caes,
//                 se repite desde las 3 AM (punto de control 'n4tres').
//   'n4dark'    → FINAL DE LA RUTA B (Slaimi): aviso a las 4:50 (en 'night'),
//                 apagón a las 5:00, esconder a Slaimi en la taquilla, defensa
//                 hasta las 6:00 y la escena de las 6:00 con El Errante
//                 (src/ending/Night4Dark.js). Puntos de control 'n4cinco' y 'n4seis'.
//   'n2done'    → noche 2 superada: negro, el reactor se apaga, "6:00 AM"
//   'win'       → 6:00 AM, turno superado
//   'n7final'   → 6:00 de la noche 7: el final (v0.82: pantalla provisional; Game._n7Final)
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
// Noches con conductos (vents en nights.js, desde la 2): El Insecto
// empieza fuera de los conductos y aparece a los NIGHT2.INSECTO.
// FIRST_APPEAR s (ya no hay ataque al empezar, desde la v0.32). En la
// noche 2 la ventilación empieza sin señal hasta escribir get-update.
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
import { CameraView, MONITOR_TAB, requisitoCryo } from '../render/CameraView.js';
import { Sprites } from '../render/Sprites.js';
import { ROOMS, VENTS, ROOM_IDS, VENT_IDS } from '../world/StationMap.js';
import { drawHUD, drawTapeOverlay, drawSkipButton, TAPE_SKIP, TAPE_SUBS, TAPE_PLAY, SKIP_BUTTON } from '../ui/HUD.js';
import { drawJumpscare, hasJumpscare, saltosCongelado, duracionSalto, drawSaltoCongelado, nuevoSalto } from '../ui/Jumpscare.js';
import { Terminal } from '../ui/Terminal.js';
import { EasterEgg } from '../ui/EasterEgg.js';
import { getNight, NIGHTS } from '../night/nights.js';
import { NIGHT2 } from '../night/night2.js';
import { SaveData, slaimiDe, ponSlaimi } from './SaveData.js';
import { Menu } from '../ui/Menu.js';
import { Night2Ending } from '../ending/Night2Ending.js';
import { Night3Ending } from '../ending/Night3Ending.js';
import { Night4Start } from '../ending/Night4Start.js';
import { Night4Repair } from '../ending/Night4Repair.js';
import { Night4Sleep } from '../ending/Night4Sleep.js';
import { ErranteCabeza } from '../systems/ErranteCabeza.js';
import { Night4Dark, drawErrante, drawErranteFace } from '../ending/Night4Dark.js';
import { Night5 } from '../systems/Night5.js';
import { Night6 } from '../systems/Night6.js';
import { Night7 } from '../systems/Night7.js';
import { OficinaV2 } from '../render/OficinaV2.js';
import { NIGHT7 } from '../night/night7.js';
import { NIGHT6 } from '../night/night6.js';
import { Night5Start } from '../ending/Night5Start.js';
import { Night5Leak } from '../ending/Night5Leak.js';
import { Final1 } from '../ending/Final1.js';
import { Night6Ducts } from '../ending/Night6Ducts.js';
import { Night6Sala } from '../ending/Night6Sala.js';
import { Night6Final, precargarCine } from '../ending/Night6Final.js';
import { NIGHT5 } from '../night/night5.js';
import { textBar } from '../render/CRT.js';
import { drawPostLeak, drawEdgeFrost, drawWallFrost, drawBreath } from '../render/Frost.js';
import { Hallucinations } from '../systems/Hallucinations.js';
import { Voices4am } from '../systems/Voices4am.js';
import { Slaimi } from '../systems/Slaimi.js';
import { NIGHT4 } from '../night/night4.js';
import { OfficeTurn } from '../systems/OfficeTurn.js';
import { NoteOverlay } from '../ui/NoteOverlay.js';
import { OFFICE_NOTES, PLACA_DE_NOCHE } from '../world/Notes.js';
import { BackView, BACK_HATCH } from '../render/BackView.js';
import { Flashlight } from '../render/Flashlight.js';
import { Night3Events } from '../systems/Night3Events.js';
import { NIGHT3 } from '../night/night3.js';
import { glitchSlices as cortesGlitch } from '../render/Atmosphere.js';
import { sustoPuertaListo, sustoPuertaSalto, drawSustoPuerta } from '../render/SustoPuerta.js';
import { MenuMusic } from '../audio/MenuMusic.js';

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
  largo_oido: 'El Largo ha llegado hasta la oficina.',
  n3_noescondido: 'No te has escondido a tiempo.',
  n3_taquilla: 'El Largo te ha oido respirar.',
  gas: 'La fuga de gas ha llenado la oficina.',
  frozen: 'El Congelado ha llegado corriendo a la oficina.',
  explosion: 'El reactor ha hecho explotar la nave.',
  nucleo: 'NÚCLEO ESTABILIZADO. La Aberración ha enfriado el reactor.',
  aberracion: 'La Aberración ha entrado en el Módulo de Control.',
  final_largo: 'El Largo te ha encontrado en la oscuridad.',
  final_specimen: 'El Espécimen te ha encontrado en la oscuridad.',
  final_tiempo: 'No has llegado a tiempo a la oficina.',
  n4_specimen: 'El Espécimen te ha encontrado reparando.',
  n4_largo: 'El Largo te ha encontrado reparando.',
  n4_reboot: 'El Largo te ha encontrado junto al panel.',
  n4_sleep: 'Te has dormido antes de llegar a la taquilla.',
  errante: 'Algo ha entrado por la puerta abierta.',
  dislocado: 'El Dislocado ha salido de la rejilla.',
  n6_insecto: 'El Insecto te ha alcanzado en el conducto.',
  n6_dislocado: 'El Dislocado te ha alcanzado en el conducto.',
  n6_insecto_detras: 'El Insecto te ha alcanzado por detrás.',
  n6_dislocado_detras: 'El Dislocado te ha alcanzado por detrás.',
  n6_fuga: 'La fuga de Criogenia ha llenado la sala.',
  n6_sala_insecto: 'El Insecto ha salido del conducto.',
  n6_sala_dislocado: 'El Dislocado ha salido del conducto.',
};

const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// v0.58: lo que se oye por el altavoz de cada cámara rota: [sonido, volumen, cada s]
const SONIDO_ROTA = {
  hangar: ['metal/tuberia', 0.3, 4.5], comms: ['mira/zumbido', 0.28, 3.5], eastHall: ['pasos/metal', 0.22, 5],
  westHall: ['pasos/rejilla', 0.22, 5.5], medbay: ['ambiente/goteo', 0.35, 2.5], reactor: ['ambiente/chispazo', 0.3, 3],
  mess: ['ambiente/crujido', 0.3, 4], greenhouse: ['criaturas/aranazos', 0.22, 4.5], lab: ['ambiente/ventilacion', 0.3, 4],
  cryo: ['metal/panel', 0.25, 5],
};

// v0.58: avisos que salen en rojo en el registro de la terminal (el resto, en amarillo)
const PELIGRO = /APAGON|FUGA|VACIA|CRITIC|DAÑADA|SIN ENERGIA|FALLO DE ENERGIA|ALGO SE ACERCA|ALGO CORRE|FUERA DE RANGO|ESCONDETE/i;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    const params = new URLSearchParams(location.search);
    this.debug = params.has('debug');
    // ?debug=1&noche=2 → NEW GAME / CONTINUE empiezan en esa noche (sin guardar)
    this.debugNight = this.debug && params.has('noche') ? Number(params.get('noche')) : null;
    // ?debug=1&noche=4&camino=A|B → la noche 4 sin la taquilla (B: directo a reparar)
    this.debugN4Path = this.debug && /^[AB]$/i.test(params.get('camino') ?? '') ? params.get('camino').toUpperCase() : null;
    this.slaimi = new Slaimi();
    if (this.debug) window.game = this; // para probar desde la consola del navegador
    // ?n4debug=1 → MODO DEBUG DE LA NOCHE 4 (src/debug/N4Debug.js; Ctrl+Shift+F4).
    // Ese archivo NO va en lo que se publica (build.py / publicar_web.py):
    // sin él, esto no hace nada.
    if (params.has('n4debug')) {
      import('../debug/N4Debug.js').then((m) => m.install(this)).catch(() => {});
    }
    // ?novedades=1 → PRUEBA DE LAS NOVEDADES (src/debug/Novedades.js; tampoco se publica)
    if (params.has('novedades')) {
      import('../debug/Novedades.js').then((m) => m.install(this)).catch((e) => console.warn(e));
    }
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
    this.menuMusic = new MenuMusic(this.audio);   // v0.77: «Clair de lune» por la radio de la nave
    this.tape = new TapePlayer(this.audio, this.events);
    this.ambient = new AmbientSounds(this.audio);
    this.clock = new NightClock(this.events);
    this.office = new Office(this.events);
    this.reactor = new Reactor(this.events);
    this.cryo = new CryoPanel(this.events, this.rng);
    this.blackout = new Blackout(this.events, this.rng);
    this.cameras = new CameraSystem(this.events);
    this.gas = new GasLeak(this.events, this.rng);
    this.lureCooldown = 0;
    this.terminal = new Terminal();
    // Sonido de tecla al escribir y la línea viva de la reparación de cámaras
    this.terminal.onType = () => this.audio.keyClick();
    this.terminal.statusFn = () => {
      if (this.n5?.repair) return `REINICIANDO CAMARAS...\n${textBar(Math.min(1, this.n5.repair.t / NIGHT5.ERRANTE.REPAIR_TIME))}`;
      // v0.58: inicio de la noche 2, la cuenta atrás de la actualización
      const it = this.n2intro;
      if (it && !it.won) return `ACTUALIZAR: ${NIGHT2.UPDATE_COMMAND}\nQUEDAN ${Math.max(0, Math.ceil(NIGHT2.ENTRADA.TIME - it.t))} s`;
      return null;
    };
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
    // Noche 5: rejillas, El Errante y El Dislocado (src/systems/Night5.js)
    this.n5 = new Night5(this);
    this.n6 = new Night6(this);
    this.n7 = new Night7(this);
    this.ofv2 = new OficinaV2(this);   // (v1.00) la oficina entera de Blender, por estados
    // (v1.12) la misma oficina en todas las escenas y vistas (también detrás)
    this.officeView.v2src = this.ofv2;
    this.backView.v2 = this.ofv2;
    this.cabeza = new ErranteCabeza(this);   // (v1.10) El Errante en tu cabeza (noche 4)
    this.world.n5 = this.n5.world();
    this.events.on('hour', (h) => this.n5.onHour(h));
    // Noche 3: inicio en el pasillo central y evento de las 3 AM
    this.n3 = new Night3Events({
      events: this.events, audio: this.audio, cameras: this.cameras, ai: this.ai, tape: this.tape,
      flash: this.backFlash, sprites: this.sprites, world: this.world,
    });
    // Cinemática de las 3 AM: se mira al frente con el monitor subido
    this.events.on('cineStart', () => {
      this.lookBack.reset();
      this.backFlash.on = false;
      this.terminal.blur?.();
    });
    // Enemigos dentro del pasillo central (solo se ven con la linterna)
    this.drawCorridorEnemies = (c) => {
      this.n3.drawCorridor(c, this.stateTime);
      this.n7?.drawCorridor(c);        // (noche 7: la Aberración)
    };

    this.input = new Input(canvas, this.renderer, {
      onClick: (x, y) => this._onClick(x, y),
      onRelease: () => {
        if (this.state === 'final') this.final.release();
        else if (this.state === 'n4start') this.n4start.release();
        else if (this.state === 'n4repair') this.n4repair.release();
        else if (this.state === 'n4sleep') this.n4sleep.release();
        else if (this.state === 'n4dark') this.n4dark.release();
      },
      onKey: (code, e) => this._onKey(code, e),
      onKeyUp: (code) => {
        if (this.state === 'final') this.final.keyUp(code);
        else if (this.state === 'lockers') this.lockers.keyUp(code);
        else if (this.state === 'n4start') this.n4start.keyUp(code);
        else if (this.state === 'n4repair') this.n4repair.keyUp(code);
        else if (this.state === 'n4dark') this.n4dark.keyUp(code);
        else if (this.state === 'n6ducts') this.n6ducts.keyUp(code);
        else if (this.state === 'n6sala') this.n6sala.keyUp(code);
      },
      onMove: (x, y) => this._onMove(x, y),
    });
    // ?debug=1&final=1 → NEW GAME / CONTINUE empiezan en el final de la noche 2
    this.debugFinal = this.debug && params.has('final');

    this.events.on('hour', (h) => this.ai.onHour(h));
    // v0.58: cuando cambia el rango de la criogenia, aviso con sonido (y el
    // panel parpadea: CryoPanel.cambioReciente)
    // v0.66b: El Congelado en su compuerta: pisadas por ese lado y, al final, silencio
    this.events.on('frozenPuerta', ({ side }) => this.audio.frozenCarrera?.(side, CONFIG.CRYO.PUERTA.MARGEN - 0.1));
    this.events.on('frozenSilencio', () => this.audio.stopAll());
    // v0.58: cada cámara que rompe El Largo queda en el registro
    this.events.on('camBroken', ({ room }) => {
      if (ROOMS[room]) this.alerta(`CAMARA DAÑADA (CAM ${ROOMS[room].cam})`, 'danger');
    });
    this.events.on('cryoRequirement', ({ inicio }) => {
      if (inicio || this.state !== 'night') return;
      this.audio.beep(660, 0.14, 0.16);
      this.audio.beep(990, 0.14, 0.22);
    });
    // Noche 4, ruta A: alucinaciones a las 3 AM y voces desde las 4 AM
    this.hallu = new Hallucinations();
    this.voices = new Voices4am(this.audio);
    this.events.on('hour', (h) => {
      if (this.nightNumber !== 4 || this.n4path !== 'A') return;
      if (h === NIGHT4.HALLU.HOUR) {
        this._n4Save('n4tres');   // si te duermes y caes, se repite desde aquí
        this._halluStart();
      }
      if (h === NIGHT4.VOICES.HOUR) this.voices.start();
    });
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

  startNight(n, { save = true, n4path = null, skipStart = false, n7 = {} } = {}) {
    // Noche 4: empieza en la taquilla (se elige el camino); el turno de
    // cámaras empieza después, con n4path 'A' o 'B'
    if (getNight(n).lockerStart && !n4path) {
      if (this.debugN4Path === 'B') return this._startN4Repair({ save });
      if (this.debugN4Path === 'A') n4path = 'A';
      else return this._startN4({ save });
    }
    this.nightNumber = n;
    // Se guarda la noche en curso: si mueres, Continue vuelve a ella.
    this.save = { ...(this.save ?? SaveData.fresh()), night: n, checkpoint: n === 6 ? 'n6turno' : null };   // (noche 6: el turno, tras la sala oculta)
    this.saveEnabled = save;
    if (save) SaveData.save(this.save);
    const night = getNight(n);
    this.audio.stopAll();
    this.clock.reset(night.secondsPerHour);
    this.office.reset();
    this.cameras.reset();
    this.terminal.reset();
    this._avisosVistos = new Map();
    this.backView.noche = n;           // v0.58: su cartel y su placa
    this.easterEgg.reset();
    this.reactor.reset(night);
    this.cryo.reset(night.cryo);
    this.blackout.reset(night.blackouts);
    this.ai.setup(night);
    this.n3.reset(night);
    // Noche 3 (largoMode 'oido'): El Largo empieza al fondo del pasillo central
    if (night.largoMode === 'oido' && this.ai.largo.level > 0) {
      if (night.corridorStart) this.ai.largo.startCorridor(this.world);
      else this.ai.largo.activate(this.world);
    }
    this.gas.reset();
    // Oficina de 4 paredes: se gira en todas las noches (las puertas están
    // en las paredes de los lados y el pasillo central detrás)
    this.lookBack.reset();
    this.cameraView.poses.reset();
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
    // El Insecto ya no ataca al empezar (v0.32): la noche arranca con él
    // fuera de los conductos y aparece por primera vez a los
    // NIGHT2.INSECTO.FIRST_APPEAR s, con su mecánica normal.
    if (night.vents) this.ai.insecto.returnIn = this.rng.range(...NIGHT2.INSECTO.FIRST_APPEAR);
    // Noche 2 (v0.58): la terminal pide actualizar y El Insecto se acerca por
    // el conducto derecho: get-update a tiempo o te mata
    this.n2intro = night.vents && night.ventsUpdate ? { t: 0, next: 0.3, hit: false, won: false, t2: 0 } : null;
    if (this.n2intro) {
      this.terminal.print('Actualizacion critica pendiente');
      this.alerta(`ACTUALIZA EL SISTEMA: ${NIGHT2.UPDATE_COMMAND} (${NIGHT2.ENTRADA.TIME} s)`, 'danger');
    }
    this.audio.startAmbience();
    this.ambient.reset(night);
    // Noche 4: según el camino elegido en la taquilla
    this.n4path = n4path;
    this.n4warn = null;          // aviso de las 4:50 (ruta B)
    this.slaimi.reset();
    this.cabeza.reset();         // (v1.10) su cara, a otra hora y en otro sitio
    this.n5.reset(!!night.n5);
    this.world.n5 = this.n5.world();
    // Noche 6 (v0.74–v0.75): Slaimi según la noche 5, las desapariciones del turno
    const n6slaimi = this._n6SlaimiState();
    this.n6.reset(!!night.n6, n6slaimi);
    if (night.n6 || night.n7) {
      // Las rejillas del frente siguen rotas (la noche 5) y El Dislocado ya está en los conductos
      for (const s of ['left', 'right']) this.n5.grilles[s].broken = true;
      this.n5.done2 = this.n5.done4 = true;
      const dis = this.ai.dislocado;
      if (dis?.level > 0) {
        dis.state = 'away';
        dis.returnIn = 18;
      }
      this.ai.setAggro(...(night.n7 ? NIGHT7.AGGRO : NIGHT6.TURNO.AGGRO));
    }
    // Noche 7 (v0.82): la cinta, las horas, el reactor y Slaimi (src/systems/Night7.js).
    // El Congelado está muerto (su cadáver, en la Criogenia): el panel, apagado
    this.n7.reset(!!night.n7, n7);
    // El Dislocado: en la noche 7 su arrastre suena más fuerte y más cerca
    this.n5.snd.dragVol = night.n7 ? NIGHT7.DISLOCADO_ARRASTRE.VOL : 1;
    this.n5.snd.dragCerca = night.n7 ? NIGHT7.DISLOCADO_ARRASTRE.CERCA : 1;
    if (night.n7) {
      this.cryo.enabled = false;
      this.ai.frozen.state = 'muerto';   // (sin caso en Frozen.update: no se despierta nunca)
      if (this.ai.errante) {
        this.ai.errante.soloCamaras = true;   // (el usuario: en la noche 7 El Errante no mata, solo desactiva cámaras)
        this.ai.errante.stareTime = NIGHT7.ERRANTE.STARE_TIME;   // (v0.93: y las apaga más a menudo)
        this.ai.errante.camEvery = NIGHT7.ERRANTE.CAM_EVERY;
        this.ai.errante.camGrace = NIGHT7.ERRANTE.CAM_GRACE;   // (v1.18)
        this.ai.errante.camSiempre = true;
      }
      this.cameras.hasLure = true;       // (el señuelo: saca a la Aberración del reactor)
    }
    this.hallu.reset();
    this.voices.stop();
    this.voices.reset();
    if (n4path === 'A') {
      // Las grabaciones de las 3 AM y las voces de las 4 AM se cargan ya
      this.hallu.load();
      if (this.audio.ctx) this.voices.load();
      // Cámaras rotas toda la noche (solo los triángulos) y más agresivos
      for (const id of [...ROOM_IDS, ...VENT_IDS]) this.cameras.broken.add(id);
      this.cameras.warnings = true;
      this.cameras.warnT = 0;
      this.ai.setAggro(NIGHT4.A.INTERVAL_MULT, NIGHT4.A.REACTION_MULT, { insectSpeed: NIGHT4.A.INSECT_SPEED });
    } else if (n4path === 'B') {
      this.slaimi.active = true;   // cámaras reparadas: sin triángulos, Slaimi avisa
    }
    if (n4path) this._n4Save(n4path === 'A' ? 'n4a' : 'n4turno');
    // Noche 5: Slaimi sigue contigo si lo salvaste (ruta B de la noche 4)
    const n5slaimi = this._n5SlaimiState();
    if (night.n5 && !night.n6 && !night.n7 && n5slaimi === 'vivo') this.slaimi.active = true;
    if (night.n6) this.slaimi.active = n6slaimi === 'salvado';
    // Cinta del hombre de la cinta: suena SIEMPRE sola al empezar la noche
    // (aunque ya se haya escuchado); se puede volver a poner con L o el botón.
    // Noche 4: CONFIG.TAPES[4] está preparada, pero aún no hay guion ni audio.
    // Noche 7: si se ha saltado ya desde el debug, no suena
    if (!(night.n7 && n7.saltarCinta)) this.tape.schedule(n, { autoplay: true });
    this.attacker = null;
    this.deathCause = null;
    if (night.n6 && !skipStart) {
      // Noche 6: vuelves de la sala oculta por la rejilla rota (Fase 3)
      this.n6vueltaT = 0;
      this._setState('n6vuelta');
      return;
    }
    if (night.n5 && !night.n7 && !skipStart) {
      // Noche 5: sales de la taquilla (src/ending/Night5Start.js)
      if (!this.n5start) this.n5start = new Night5Start(this);
      this.n5start.start(n5slaimi);
      this._setState('n5start');
      return;
    }
    this._setState('night');
  }

  // --- Noche 5 ---
  /** Estado de Slaimi al empezar la noche 5: 'vivo' | 'muerto' | 'congelado'. */
  _n5SlaimiState() {
    // (v0.82: del estado único de Slaimi, SaveData.slaimiDe)
    const s = slaimiDe(this.save?.flags);
    if (s?.estado === 'muerto' && s.donde === 'n5') return 'congelado';
    return s?.estado === 'vivo' ? 'vivo' : 'muerto';
  }

  /** Fase 3: la vista sale de la rejilla rota (la izquierda) y se aleja hasta la oficina. */
  _drawN6Vuelta(ctx) {
    const k = Math.min(1, this.n6vueltaT / NIGHT6.VUELTA.TIME);
    const s = k * k * (3 - 2 * k);
    const r = { x: 110, y: 380, w: 250, h: 200 };     // la rejilla izquierda del frente (OfficeTurn: conductos)
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    ctx.save();
    const z = 3.4 - 2.4 * s;
    ctx.translate(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 + 240 * (1 - s));
    ctx.scale(z, z);
    ctx.translate(-((r.x + r.w / 2) * (1 - s) + CONFIG.WIDTH / 2 * s), -((r.y + r.h / 2) * (1 - s) + CONFIG.HEIGHT / 2 * s));
    this._drawOfficeFront(ctx, 'front');
    ctx.restore();
    ctx.fillStyle = `rgba(0,0,0,${Math.max(0, 1 - k * 1.8)})`;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
  }

  /** Noche 6, Fase 5 (v0.76): a las 6:00, la cinemática en las cámaras (src/ending/Night6Final.js). */
  _startN6Final({ save = this.saveEnabled !== false && !this.debugNight } = {}) {
    this.tape.stop();
    this.cameras.forceClose();
    this.saveEnabled = save;
    this.save = { ...(this.save ?? SaveData.fresh()), night: 6, checkpoint: 'n6final' };
    if (save) SaveData.save(this.save);
    if (!this.n6final) this.n6final = new Night6Final(this);
    this.n6final.start();
    this.attacker = null;
    this.deathCause = null;
    this._setState('n6final');
  }

  /**
   * Fin de la noche 6. Se guarda para la noche 7: dónde quedó cada cadáver
   * (n6cadaveres: { frozen, specimen, insecto, largo } → su sala), cuáles vio
   * morir el jugador (n6vistos), la lente rota del Hangar (n6lenteRota), que
   * la Aberración ya ha salido (n6aberracion) y Slaimi como estaba.
   */
  _n6FinalDone(muertes) {
    const flags = { ...(this.save?.flags ?? {}) };
    flags.n6cadaveres = Object.fromEntries(muertes.map((m) => [m.id, m.room]));
    flags.n6vistos = muertes.filter((m) => m.visto).map((m) => m.id);
    flags.n6lenteRota = 'hangar';
    flags.n6salas = { cryo: 'capsula_rota', lab: 'rejilla_caida', greenhouse: 'patas_esparcidas', hangar: 'lente_rota' };
    flags.n6aberracion = true;
    flags.n6superada = true;
    this.save = { ...this.save, flags, night: 7, checkpoint: null };
    // v0.79 (el usuario: al terminar, el menú decía «No hay partida guardada»): se guarda
    // SIEMPRE (en las versiones de depuración va a su memoria aparte: la partida real no se toca)
    SaveData.save(this.save);
    this.audio.stopAll();
    this._toMenu();
  }

  /** Slaimi en la noche 6: 'salvado' (en la taquilla en la noche 5), 'congelado' o null (no se salvó en la noche 4). */
  _n6SlaimiState() {
    // (v0.82: del estado único de Slaimi, SaveData.slaimiDe)
    const s = slaimiDe(this.save?.flags);
    if (s?.estado === 'vivo') return 'salvado';
    if (s?.estado === 'muerto' && s.donde === 'n5') return 'congelado';
    return null;
  }

  // --- Noche 7 ---
  /**
   * 6:00 de la noche 7: el punto de enlace del final (lo diseña el usuario más
   * adelante). Emite 'finalNoche7' con el estado de la partida (Slaimi, la
   * noche 6, el reactor) y, mientras no haya final, la pantalla provisional.
   */
  _n7Final() {
    const estado = this.n7.estado();
    this.tape.stop();
    this.cameras.forceClose();
    const flags = { ...(this.save?.flags ?? {}), n7superada: true };
    this.save = { ...this.save, flags, night: 7, checkpoint: 'n7final' };
    if (this.saveEnabled !== false && !this.debugNight) SaveData.save(this.save);
    this.audio.stopAll();
    this.events.emit('finalNoche7', estado);
    // (v1.20) Fase 1 del final: las 6:00 (el estallido, el suelo, el aturdimiento, levantarse)
    if (!this.final1) this.final1 = new Final1(this);
    this.final1.start();
    this._setState('n7final');
  }

  /** Noche 7: se pierde sin jumpscare (a las 3:00, el reactor por debajo del umbral). */
  _n7Perder(cause) {
    if (this.state !== 'night') return;
    this.cameras.forceClose();
    this.tape.stop();
    this.deathCause = cause;
    this.audio.stopAll();
    this._setState('lose');
  }

  /** Ha salido de la taquilla: empieza el turno. */
  _n5StartDone() {
    this.lookBack.reset();
    if (this._n5SlaimiState() === 'vivo') {
      this.slaimi.active = true;
      this.slaimi.side = 'front';
    }
    this._setState('night');
  }

  /** 6:00 de la noche 5: la fuga de Criogenia (src/ending/Night5Leak.js). */
  _startN5Leak({ save = this.saveEnabled !== false } = {}) {
    this.tape.stop();
    this.cameras.forceClose();
    this.n5.snd.errStaticStop(0.05);
    this.save = { ...this.save, checkpoint: 'n5seis' };
    this.saveEnabled = save;
    if (save) SaveData.save(this.save);
    if (!this.n5leak) this.n5leak = new Night5Leak(this);
    this.n5leak.start(this._n5SlaimiState());
    this.attacker = null;
    this.deathCause = null;
    this._setState('n5leak');
  }

  /** Congelado: se repite desde las 6:00 (las rejillas siguen rotas). */
  _n5LeakRetry() {
    this.audio.stopAll();
    this.audio.setMasterLevel(1, 0.1);
    const save = this.saveEnabled !== false;
    this.startNight(5, { save, skipStart: true });
    this._startN5Leak({ save });
  }

  /**
   * Ha escapado por el conducto: fin de la noche 5. Se guarda el estado
   * para la noche 6 (la oficina sellada; Slaimi en la taquilla, congelado
   * o muerto). La noche 6 empezará en el conducto (punto de control
   * 'n6conducto').
   */
  _n5End({ slaimi }) {
    this.n5.snd.stop();
    const flags = { ...(this.save.flags ?? {}), n5fuga: true, oficinaSellada: true };
    // (v1.11: el dato único de Slaimi; si no estaba en la noche 5 —murió en la 4— no cambia)
    if (slaimi === 'taquilla') ponSlaimi(flags, 'salvado');
    else if (slaimi === 'congelado') ponSlaimi(flags, 'n5');
    this.save = { ...this.save, flags, night: 6, checkpoint: 'n6conducto' };
    if (this.saveEnabled !== false) SaveData.save(this.save);
    this.audio.stopAll();
    this.audio.setMasterLevel(1, 0.1);
    this._toMenu();
  }

  // --- Noche 6 ---
  /**
   * Noche 6, Fase 1 (v0.72): los conductos, desde la oficina sellada hasta
   * la sala oculta de V4 (src/ending/Night6Ducts.js). Punto de control
   * 'n6conducto' (lo dejó guardado el final de la noche 5).
   */
  _startN6({ save = this.saveEnabled !== false && !this.debugNight } = {}) {
    this.nightNumber = 6;
    this.saveEnabled = save;
    this.save = { ...(this.save ?? SaveData.fresh()), night: 6, checkpoint: 'n6conducto' };
    this.save.flags ??= {};
    if (save) SaveData.save(this.save);
    this.tape.stop();
    this.cameras.forceClose();
    this.audio.stopAll();
    this.audio.setMasterLevel(1, 0.1);
    this.attacker = null;
    this.deathCause = null;
    if (!this.n6ducts) this.n6ducts = new Night6Ducts(this);
    this.n6ducts.start();
    this._setState('n6ducts');
  }

  /** Te alcanzan en los conductos o en la sala: su susto (o la escarcha) y la causa. */
  _n6Death(enemy, cause) {
    this.attacker = enemy;
    this.deathCause = cause;
    if (!enemy) {
      // (la fuga: sin susto, la pantalla se congela)
      this.audio.lib?.play('congelado/viento', { volume: 0.9 });
      this._setState('lose');
      return;
    }
    this.audio.scream();
    this._setState('jumpscare');
  }

  /** Has bajado a la sala oculta (Fase 2): punto de control 'n6sala'. */
  _n6DuctsDone() {
    this._startN6Sala();
  }

  /** Noche 6, Fase 2 (v0.73): la sala oculta y sus válvulas (src/ending/Night6Sala.js). */
  _startN6Sala({ save = this.saveEnabled !== false && !this.debugNight } = {}) {
    this.nightNumber = 6;
    this.saveEnabled = save;
    this.save = { ...(this.save ?? SaveData.fresh()), night: 6, checkpoint: 'n6sala' };
    this.save.flags ??= {};
    if (save) SaveData.save(this.save);
    this.audio.stopAll();
    this.audio.setMasterLevel(1, 0.1);
    this.attacker = null;
    this.deathCause = null;
    if (!this.n6ducts) this.n6ducts = new Night6Ducts(this);   // (sus imágenes: la subida al conducto)
    if (!this.n6sala) this.n6sala = new Night6Sala(this);
    this.n6sala.start();
    this._setState('n6sala');
  }

  /**
   * La fuga está parada y has vuelto a subir al conducto: de vuelta a la
   * oficina (Fase 3, Slaimi según la noche 5) y el turno de 12 a 6 (Fase 4).
   */
  _n6SalaDone() {
    const flags = { ...(this.save?.flags ?? {}) };
    delete flags.oficinaSellada;
    flags.n6fugaParada = true;
    this.save = { ...this.save, flags, night: 6, checkpoint: 'n6turno' };
    if (this.saveEnabled !== false) SaveData.save(this.save);
    this.audio.stopAll();
    this.startNight(6, { save: this.saveEnabled !== false });
  }

  /** Un enemigo te alcanza: susto y fin de la partida. */
  _attack(enemy) {
    if (this.state !== 'night') return;
    this.cameras.forceClose();
    this.tape.stop();
    this.attacker = enemy.id;
    this.deathCause = enemy.mode === 'oido' ? 'largo_oido' : enemy.id;
    // v0.64 (pedido por el usuario): El Congelado en una compuerta abierta.
    // La vista se gira sola hacia ella y se te echa encima desde su pasillo
    // (src/render/SustoPuerta.js); el grito, cuando llega a la puerta.
    // v0.66b: el margen (correr por el pasillo + silencio en la puerta) ya ha
    // pasado durante la noche (Frozen._enPuerta); aquí, solo si no cerraste,
    // la vista se gira JUSTO antes del salto
    const side = enemy.id === 'frozen' ? (enemy.puerta?.side ?? enemy.atDoor) : null;
    if (side) {
      enemy.room = null;           // (que no se pinte también quieto en la compuerta)
      enemy.puerta = null;
      const gira = this.lookBack.goTo(side);
      // (lo que tarda en girarse: 0, 1 o 2 giros de 90°)
      const giros = gira ? this.lookBack.queue.length + 1 : 0;
      this.frozenDoor = { side, grito: false, giro: giros * CONFIG.OFFICE_TURN.TURN_TIME };
      this._setState('frozenDoor');
      return;
    }
    this.saltoVar = null;          // (v0.66: el Congelado elige variante al dibujar)
    nuevoSalto();
    if (enemy.id === 'frozen' && this.audio.frozenGrito) this.audio.frozenGrito();
    else if (enemy.id === 'aberracion' && this.audio.lib?.buffers?.['aberracion/grito']?.length) {
      // (noche 7: su grito de muchas voces, tools/sonidos_aberracion.py)
      this.audio.stopAll();
      this.audio.lib.play('aberracion/grito', { volume: 1, pitchVar: 0, volVar: 0 });
    } else this.audio.scream();
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
    if (s !== 'night') {
      this.n7?.pararGrabadora();
      this.n7?.pararMusica();
    }
    if (s !== 'night') this.easterEgg.reset(); // fuera de la noche no queda nada
    if (s !== 'night' && s !== 'n4sleep') {
      this.voices?.stop();
      if (this.hallu?.active) this._halluEnd();
    }
    if (this.state === 'menu' && s !== 'menu') this.menuMusic?.stop();   // (fundido al empezar a jugar)
    this.state = s;
    this.stateTime = 0;
  }

  /** v0.77: la noche de la partida guardada (para los fallos de la radio del menú). */
  _nocheGuardada() {
    return this.save ? Math.min(7, this.save.night + (this.save.completed ? 1 : 0)) : 1;
  }

  /** v0.77: con ?debug, ?n4debug o ?novedades no sale el «Pulsa cualquier tecla» (arrancan solos). */
  get _splashMenu() {
    if (this.audio.ctx) return false;
    const q = location.search;
    if (/[?&]splash=1/.test(q)) return true;         // (para probarlo en depuración)
    return !/[?&](debug|n4debug|novedades)=/.test(q);
  }

  // ---------------------------------------------------------------
  // Entrada
  // ---------------------------------------------------------------

  _onClick(x, y) {
    switch (this.state) {
      case 'menu': {
        const splash = this._splashMenu;
        this._ensureAudio();
        if (splash) break;                       // (el primer clic solo despierta la radio)
        const hit = this.menu.hitTest(x, y, this.save);
        if (hit === 'musica') this.menuMusic.toggleMute();
        else if (hit === 'creditos') this.menu.creditos = !this.menu.creditos;
        else if (hit === 'finales') this.menu.finales = !this.menu.finales;
        else this._menuAction(hit);
        break;
      }
      case 'night':
        if (this.n3.cineRunning) {
          // Cinemática de las 3 AM: solo el botón SALTAR
          if (inside(SKIP_BUTTON, x, y)) this.n3.skipCine();
          break;
        }
        if (this._tapeAvailable() && inside(TAPE_PLAY, x, y)) {
          this.tape.playNow();
          break;
        }
        // Botones de la cinta (encima de todo, con o sin monitor)
        if (this.tape.playing && !this.tape.sinSaltar && inside(TAPE_SKIP, x, y)) {
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
        if (!this.cameras.open && this.note.open(this._placa(NoteOverlay.hit(OFFICE_NOTES[this.lookBack.face], x, y)))) break;
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
      case 'n4start':
        this._ensureAudio();
        if (this._tapeMinigameClick(x, y)) break;
        this.n4start.click(x, y);
        break;
      case 'n4repair':
        if (this._tapeMinigameClick(x, y)) break;
        this.n4repair.click(x, y);
        break;
      case 'n4sleep':
        this.n4sleep.click(x, y);
        break;
      case 'n4dark':
        this.n4dark.click(x, y);
        break;
      case 'n6final':
        this.n6final.click(x, y);
        break;
      case 'n7final':
        if (this.final1?.activa && !this.final1.acabada) { this.final1.click?.(x, y); break; }   // (durante la Fase 1, el clic no sale)
        if (this.stateTime > 2) this._toMenu();
        break;
      case 'n6sala':
        this.n6sala.click(x, y);
        break;
      case 'n5leak':
        this.n5leak.click(x, y);
        break;
      case 'lockers':
        this.lockers.click(x, y);
        break;
      case 'final':
        // Botones de la cinta (la de la mujer suena en el minijuego)
        if (this.tape.playing && inside(TAPE_SKIP, x, y)) this.tape.stop();
        else if (this.tape.playing && inside(TAPE_SUBS, x, y)) this.tape.toggleSubtitles();
        else this.final.click(x, y);
        break;
      case 'win':
        if (this.stateTime > 1.5) this._toMenu();
        break;
      case 'lose':
        if (this.stateTime > 1.5) this._retry();
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
    if (this.state === 'menu') this.menuMusic.start(this._nocheGuardada());
  }

  /**
   * Tras morir: SIEMPRE se reintenta desde el último punto de control (v0.51;
   * antes unas muertes volvían a la oficina y otras al menú). Es lo mismo
   * que «Continuar» en el menú.
   */
  _retry() {
    this._toMenu();
    if (this.save || this.debugNight || this.debugFinal) this._menuAction('continue');
  }

  _toMenu() {
    this.audio.stopAll();
    this.audio.setMasterLevel(1);
    this.audio.startAmbience();
    this.save = SaveData.load();
    this.menu.confirming = false;
    this.menu.selected = this.save ? 'continue' : 'newGame';
    this._setState('menu');
    if (this.audio.ctx) this.menuMusic.start(this._nocheGuardada());
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
        else if (this.debugNight === 6) this._startN6({ save: false }); // (noche 6: empieza en los conductos)
        else if (this.debugNight) this.startNight(this.debugNight, { save: false });
        else if (this.save?.checkpoint === 'n2final') this._startFinal(); // punto de control: 6 AM de la noche 2
        else if (this.save?.checkpoint === 'n3final') this._startLockers(); // punto de control: 6 AM de la noche 3
        else if (this.save?.checkpoint === 'n4a') this.startNight(4, { n4path: 'A' }); // noche 4, camino A (turno)
        else if (this.save?.checkpoint === 'n4reboot') this._startN4({ at: 'reboot' }); // noche 4, ruta A: delante del panel
        else if (this.save?.checkpoint === 'n4tres' || this.save?.checkpoint === 'n4sleep') this._restartN4At3(); // noche 4, ruta A: desde las 3 AM
        else if (this.save?.checkpoint === 'n4b') this._startN4Repair(); // noche 4, camino B (reparando)
        else if (this.save?.checkpoint === 'n4turno') this.startNight(4, { n4path: 'B' }); // noche 4, camino B (turno con Slaimi)
        else if (this.save?.checkpoint === 'n4cinco') this._startN4Dark({ at: 'cinco' }); // noche 4, ruta B: el apagón de las 5:00
        else if (this.save?.checkpoint === 'n4seis') this._startN4Dark({ at: 'seis' }); // noche 4, ruta B: la escena de las 6:00
        else if (this.save?.checkpoint === 'n5seis') this._n5LeakRetry(); // noche 5: la fuga de las 6:00
        else if (this.save?.checkpoint === 'n6conducto') this._startN6(); // noche 6: los conductos
        else if (this.save?.checkpoint === 'n6sala') this._startN6Sala(); // noche 6: la sala oculta
        else if (this.save?.checkpoint === 'n6turno') this.startNight(6); // noche 6: el turno (vuelta a la oficina)
        else if (this.save?.checkpoint === 'n6final') this._startN6Final(); // noche 6: el final
        else if (this.save?.checkpoint === 'n7final') {          // noche 7: el final (v1.20: desde la Fase 1)
          if (!this.final1) this.final1 = new Final1(this);
          this.final1.start();
          this._setState('n7final');
        }
        else if (this.save && (this.save.night > NIGHTS.length || getNight(this.save.night).placeholder)) this.menu.notice = `La noche ${this.save.night} aun no esta disponible`;
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

  /**
   * FINAL DE LA NOCHE 3 (6 AM): las cámaras siguen rotas y hay que
   * esconderse en una taquilla. Se guarda el punto de control 'n3final'.
   */
  _startLockers({ save = this.saveEnabled !== false, arrival = false } = {}) {
    this.nightNumber = 3;
    this.saveEnabled = save;
    this.save = { ...(this.save ?? SaveData.fresh()), night: 3, checkpoint: 'n3final' };
    this.save.flags ??= {};
    this.save.tapesHeard ??= {};
    if (save) SaveData.save(this.save);
    this.tape.stop();
    this.audio.setMasterLevel(1);
    this.cameras.forceClose();
    this.cameras.reset();
    this.office.reset();
    this.terminal.reset();
    this.audio.stopAll();
    // La cinemática de llegada solo se ve viniendo de la noche: el punto de
    // control se guarda antes, así que Continuar va directo a esconderse
    if (!this.lockers) this.lockers = new Night3Ending(this, { arrival });
    else this.lockers.start({ arrival });
    this.attacker = null;
    this.deathCause = null;
    this._setState('lockers');
  }

  // ---------------------------------------------------------------
  // Noche 4
  // ---------------------------------------------------------------

  /** Inicio de la noche 4: dentro de la taquilla, se elige el camino. */
  _startN4({ save = this.saveEnabled !== false, at = null } = {}) {
    this.nightNumber = 4;
    this.saveEnabled = save && !this.debugNight;
    this.save = { ...(this.save ?? SaveData.fresh()), night: 4, checkpoint: null };
    this.save.flags ??= {};
    this.save.tapesHeard ??= {};
    if (this.saveEnabled) SaveData.save(this.save);
    this._n4Reset();
    if (!this.n4start) this.n4start = new Night4Start(this);
    this.n4start.start({ at });
    this.attacker = null;
    this.deathCause = null;
    this._setState('n4start');
  }

  /** Deja la oficina y el sistema como al empezar un minijuego (sin cinta ni ambiente). */
  _n4Reset() {
    this.tape.stop();
    this.audio.stopAll();
    this.audio.setMasterLevel(1);
    this.cameras.forceClose();
    this.cameras.reset();
    this.office.reset();
    this.terminal.reset();
    this.slaimi.reset();
  }

  /** Se ha elegido camino en la taquilla: se guarda (afecta a las noches siguientes). */
  _n4Choose(path) {
    const flags = { ...(this.save.flags ?? {}) };
    for (const k of Object.keys(flags)) if (/^(n4luz|n4camaras|slaimiAliado|slaimiMuerto|n4rep_)/.test(k)) delete flags[k];
    if (path === 'A') {
      flags.n4luz = true;
      // Sin reparar las cámaras, Slaimi no se salva: aparecerá muerto en una
      // cámara cuando vuelvan a funcionar (noche 5, NIGHT4.SLAIMI.DEAD_CAM)
      ponSlaimi(flags, 'n4');
    } else {
      flags.n4camaras = true;
      ponSlaimi(flags, 'aliado');
    }
    this.save = { ...this.save, flags };
    if (this.saveEnabled) SaveData.save(this.save);
  }

  /** Empieza el turno de cámaras de la noche 4 por el camino elegido. */
  _n4Begin(path, { headStart = 0 } = {}) {
    this.startNight(4, { save: this.saveEnabled !== false, n4path: path });
    // Ruta A: mientras se reiniciaba el panel, los demás enemigos seguían
    // moviéndose. Se adelanta su IA ese tiempo (sin que nadie llegue a la
    // puerta de la oficina: eso sería morir sin poder hacer nada).
    const t = headStart * NIGHT4.REBOOT.HEAD_START;
    if (path !== 'A' || t <= 0) return;
    // (se para en cuanto alguien queda a una sala de la oficina: así nadie
    // empieza el turno pegado a una puerta)
    const near = (e) => e.atDoor || ['central2', 'central3', 'eastHall', 'westHall', 'v1', 'v6', 'v7', 'left_door', 'right_door', 'office'].includes(e.room);
    const attack = this.world.attack;
    this.world.attack = () => {};
    const before = this.ai.enemies.map((e) => e.room);
    for (let s = 0; s < t; s += 0.1) {
      this.ai.update(0.1);
      if (this.ai.enemies.some(near)) break;
    }
    this.world.attack = attack;
    this.n4HeadStart = { segundos: +t.toFixed(1), antes: before, despues: this.ai.enemies.map((e) => e.room) };
  }

  // --- Ruta A: alucinaciones de las 3 AM ---
  _halluStart() {
    if (this.hallu.active || this.hallu.done) return;   // una sola vez por noche
    this.hallu.start();
    // Sin FREEZE, los enemigos siguen activos, algo menos agresivos
    for (const e of this.ai.enemies) e.interval /= NIGHT4.HALLU.AGGRO;
    this.audio.camSwitch?.();
  }

  _halluEnd() {
    this.hallu.active = false;
    for (const e of this.ai.enemies) e.interval *= NIGHT4.HALLU.AGGRO;
    if (this.state === 'night') this.audio.camSwitch?.();
  }

  // --- Ruta A, 6 AM: te duermes ---
  _startN4Sleep() {
    this.nightNumber = 4;
    this.n4path = 'A';
    this.cameras.forceClose();
    this.tape.stop();
    if (!this.n4sleep) this.n4sleep = new Night4Sleep(this);
    else this.n4sleep.start();
    if (!this.voices.active) {
      this.voices.load();
      this.voices.start();
    }
    this.attacker = null;
    this.deathCause = null;
    this._setState('n4sleep');
  }

  /** Se ha metido en la taquilla: fin de la noche 4 (ruta A), sin pantalla de victoria. */
  _n4SleepEnd() {
    this.voices.stop();
    const flags = { ...(this.save.flags ?? {}), n4luz: true };
    this.save = { ...this.save, flags, night: 5, checkpoint: null };
    if (this.saveEnabled !== false) SaveData.save(this.save);
    this.audio.stopAll();
    this.audio.setMasterLevel(1, 0.1);
    this._toMenu();
  }

  /** Ruta A: no llegó a la taquilla, cayó al suelo; se repite desde las 3 AM. */
  _n4SleepFall() {
    this.voices.stop();
    this.audio.stopAll();
    this.audio.setMasterLevel(1, 0.1);
    this._restartN4At3();
  }

  /** Noche 4, ruta A, desde las 3 AM (punto de control 'n4tres'). */
  _restartN4At3() {
    this.startNight(4, { save: this.saveEnabled !== false && !this.debugNight, n4path: 'A' });
    const sph = CONFIG.SECONDS_PER_HOUR;
    for (const h of [1, 2]) this.ai.onHour(h);
    this.clock.elapsed = NIGHT4.HALLU.HOUR * sph;
    this.clock.lastHour = NIGHT4.HALLU.HOUR - 1;   // en el siguiente paso salta la hora 3 (alucinaciones)
    this.tape.stop();                               // (la cinta es del principio de la noche)
  }

  _n4SleepCaught(enemy) {
    this.voices.stop();
    this.attacker = enemy;
    this.deathCause = 'n4_sleep';
    this.audio.setMasterLevel(1, 0.05);
    this.audio.scream();
    this._setState('jumpscare');
  }

  /** Camino B: salir de la oficina a reparar las cámaras. */
  _startN4Repair({ save = this.saveEnabled !== false } = {}) {
    this.nightNumber = 4;
    this.saveEnabled = save && !this.debugNight;
    this.save = { ...(this.save ?? SaveData.fresh()), night: 4 };
    this.save.flags = { ...(this.save.flags ?? {}), n4camaras: true };
    this._n4Save('n4b');
    this._n4Reset();
    if (!this.n4repair) this.n4repair = new Night4Repair(this);
    else this.n4repair.start();
    this.attacker = null;
    this.deathCause = null;
    this._setState('n4repair');
  }

  // --- Ruta B, final: aviso (4:50), apagón (5:00) y la escena de las 6:00 ---

  /** 4:50 → 5:00: las luces parpadean, interferencias en la consola y un zumbido lejano. */
  _n4Warn(dt) {
    const D = NIGHT4.DARK;
    const w = this.n4warn ?? (this.n4warn = { flickerIn: 1, flick: 0, humIn: 0, noise: 0 });
    w.flick = Math.max(0, w.flick - dt);
    w.noise = Math.max(0, w.noise - dt);
    w.flickerIn -= dt;
    if (w.flickerIn <= 0) {
      w.flickerIn = D.WARN_FLICKER[0] + Math.random() * (D.WARN_FLICKER[1] - D.WARN_FLICKER[0]);
      w.flick = 0.06 + Math.random() * 0.22;
      if (Math.random() < 0.55) {
        w.noise = 0.4 + Math.random() * 0.8;
        this.audio.lib?.play('ambiente/interferencia', { volume: 0.25 });
      }
    }
    w.humIn -= dt;
    if (w.humIn <= 0) {
      w.humIn = 4.5;
      this.audio.lib?.play('mira/zumbido', { volume: D.WARN_HUM, muffle: 0.6, pitchVar: 0 });
    }
  }

  /** El apagón de las 5:00 (at 'cinco') o la escena de las 6:00 (at 'seis'). */
  _startN4Dark({ at = 'cinco', save = this.saveEnabled !== false } = {}) {
    this.nightNumber = 4;
    this.n4path = 'B';
    this.saveEnabled = save && !this.debugNight;
    this.save = { ...(this.save ?? SaveData.fresh()), night: 4 };
    this.save.flags = ponSlaimi({ ...(this.save.flags ?? {}), n4camaras: true }, 'aliado');
    delete this.save.flags.n4luz;      // (ruta B: no se reactivó la luz)
    this.save.tapesHeard ??= {};
    this._n4Save(at === 'seis' ? 'n4seis' : 'n4cinco');
    const side = this.slaimi.side;
    this.cameras.forceClose();
    this.tape.stop();
    this.audio.stopAll();
    this.audio.setMasterLevel(1);
    this.voices.stop();
    this.n4warn = null;
    this.slaimi.active = false;     // Slaimi lo dibuja Night4Dark
    this.slaimi.side = side;
    if (!this.n4dark) this.n4dark = new Night4Dark(this);
    this.n4dark.start(at);
    this.attacker = null;
    this.deathCause = null;
    this._setState('n4dark');
  }

  /** Se han llevado a Slaimi: se repite desde las 5:00. */
  _n4DarkRetry(at) {
    this.audio.stopAll();
    this.audio.setMasterLevel(1, 0.1);
    this._startN4Dark({ at, save: this.saveEnabled !== false });
  }

  /**
   * Fin de la noche 4 (ruta B), sin pantalla de victoria: dormido en la
   * taquilla con Slaimi, o el FINAL DEL DESMAYO (faint: se guarda finalDesmayo
   * para usarlo en noches futuras; también desbloquea la noche 5).
   */
  _n4DarkEnd({ seen = false, faint = false } = {}) {
    this.voices.stop();
    this.cameras.forceClose();
    this.cameras.reset();
    const flags = ponSlaimi({ ...(this.save.flags ?? {}), n4camaras: true, nuevoEnemigo: true, vioNuevoEnemigo: !!seen }, 'aliado');
    if (faint) flags.finalDesmayo = true;
    this.save = { ...this.save, flags, night: 5, checkpoint: null };
    if (this.saveEnabled !== false) SaveData.save(this.save);
    this.audio.stopAll();
    this.audio.setMasterLevel(1, 0.1);
    this._toMenu();
  }

  _n4Save(checkpoint) {
    this.save = { ...this.save, checkpoint };
    if (this.saveEnabled) SaveData.save(this.save);
  }

  /** Te atrapan reparando (camino B). */
  _n4Death(enemy) {
    this.attacker = enemy;
    this.deathCause = this.state === 'n4start' ? 'n4_reboot' : `n4_${enemy}`;
    this.audio.scream();
    this._setState('jumpscare');
  }

  /** Te encuentra en el final de la noche 3. */
  _lockersDeath(cause) {
    this.audio.setLoop('n3alarm', false);
    this.attacker = 'largo';
    this.deathCause = cause;
    this.audio.scream();
    this._setState('jumpscare');
  }

  /** Noche 3 superada: vuelve la luz, amanece y se desbloquea la noche 4. */
  _lockersWin() {
    this.save = { ...this.save, night: Math.min(4, NIGHTS.length), checkpoint: null };
    if (this.saveEnabled !== false) SaveData.save(this.save);
    this.audio.stopAll();
    this.audio.powerUp();
    this.audio.chime();
    this._setState('win');
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
    // v0.51: sin «6:00 AM» (la noche 2.5 ya empezó a las 6): negro y un
    // golpe grave, el reactor apagándose (ver _drawNight2Done)
    this.audio.lib?.play('metal/golpe_pared', { volume: 0.9, pitch: 0.55, muffle: 0.4 });
    this.audio.explosion?.();
    this._setState('n2done');
  }

  _newGame() {
    if (this.debugFinal) {
      this._startFinal({ save: false });
      return;
    }
    if (this.debugNight === 6) {
      this._startN6({ save: false });
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
    const splash = this._splashMenu;
    this._ensureAudio();
    if (splash) return;                          // (la primera tecla solo despierta la radio)
    if (this.menu.creditos || this.menu.finales) {
      this.menu.creditos = false;               // (créditos o finales abiertos: cualquier tecla los cierra)
      this.menu.finales = false;
      return;
    }
    if (code === 'KeyM') {
      this.menuMusic.toggleMute();
      return;
    }
    if (code === 'KeyC' && !this.menu.confirming) {
      this.menu.creditos = true;
      return;
    }
    if (code === 'KeyF' && !this.menu.confirming) {
      this.menu.finales = true;                 // (v1.10) los finales vistos
      return;
    }
    const m = this.menu;
    if (code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight') {
      m.move(1, this.save);
    } else if (code === 'Enter' || code === 'Space' || code === 'NumpadEnter') {
      this._menuAction(m.confirming ? m.confirmChoice : m.selected);
    } else if (code === 'Escape' && m.confirming) {
      m.confirming = false;
    }
  }

  /** Noche 4 (panel del fusible y reparar): la cinta encima, con SALTAR, SUBT. y volver a ponerla. */
  _tapeMinigameClick(x, y) {
    if (!this.tape.playing) return false;
    if (inside(TAPE_SKIP, x, y)) { if (!this.tape.sinSaltar) this.tape.stop(); }
    else if (inside(TAPE_SUBS, x, y)) this.tape.toggleSubtitles();
    else return false;
    return true;
  }

  _tapeMinigameKey(code) {
    if (code === 'KeyL' && this.tape.available && !this.tape.playing) this.tape.playNow();
    else if (code === 'KeyM' && this.tape.playing && !this.tape.sinSaltar) this.tape.stop();
    else if (code === 'KeyC' && this.tape.playing) this.tape.toggleSubtitles();
    else return false;
    return true;
  }

  _drawTapeMinigame(ctx) {
    drawTapeOverlay(ctx, this.tape);
    if (this.tape.available && !this.tape.playing && this.tape.pending === null) {
      ctx.save();
      ctx.font = '13px "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(230,200,140,0.75)';
      ctx.fillText('L: volver a escuchar la cinta', 20, CONFIG.HEIGHT - 18);
      ctx.restore();
    }
  }

  /** Cinta ya escuchada: se ofrece el botón para ponerla (primera hora). */
  _tapeAvailable() {
    return this.tape.available && !this.tape.playing && this.tape.pending === null && this.clock.elapsed < this.clock.sph;
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
    if (this.state === 'lockers') {
      this.lockers.key(code);
      return;
    }
    if (this.state === 'n4start') {
      if (this._tapeMinigameKey(code)) return;
      this.n4start.key(code);
      return;
    }
    if (this.state === 'n4repair') {
      if (this._tapeMinigameKey(code)) return;
      this.n4repair.key(code);
      return;
    }
    if (this.state === 'n4sleep') {
      this.n4sleep.key(code);
      return;
    }
    if (this.state === 'n5leak') {
      this.n5leak.key(code);
      return;
    }
    if (this.state === 'n6ducts') {
      this.n6ducts.key(code);
      return;
    }
    if (this.state === 'n6final') {
      this.n6final.key(code);
      return;
    }
    if (this.state === 'n6sala') {
      this.n6sala.key(code);
      return;
    }
    if (this.state === 'n4dark') {
      this.n4dark.key(code);
      return;
    }
    if (this.state === 'lose' && this.stateTime > 1.5 && (code === 'Enter' || code === 'Space' || code === 'Escape')) {
      if (code === 'Escape') this._toMenu();
      else this._retry();
      return;
    }
    if (this.state === 'n7final' && this.final1?.activa && !this.final1.acabada) {
      this.final1.tecla(code);
      return;
    }
    if ((this.state === 'win' || (this.state === 'n7final' && this.stateTime > 2)) && this.stateTime > 1.5 && (code === 'Enter' || code === 'Space')) {
      this._toMenu();
      return;
    }
    if (this.state === 'night' && this.n3.cineRunning) {
      // Cinemática de las 3 AM: Enter la salta
      if (code === 'Enter' || code === 'NumpadEnter') this.n3.skipCine();
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
        } else if (code === 'KeyM' && this.tape.playing && !this.tape.sinSaltar) this.tape.stop();
        else if (code === 'KeyC' && this.tape.playing) this.tape.toggleSubtitles();
      } else if (code === 'KeyL' && this._tapeAvailable()) this.tape.playNow();
      else if (code === 'KeyM' && this.tape.playing && !this.tape.sinSaltar) this.tape.stop();
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
      if (code === 'KeyH') this.clock.elapsed += this.clock.sph;
      if (code === 'KeyB') this.blackout.trigger();
      if (code === 'KeyW') this.ai.specimen.onOpportunity(this.world);
      if (code === 'KeyK') this.cryo.temp = this.cryo.mode === 'min' ? this.cryo.target - 1 : this.cryo.target + 1;
      // Noche 2 (conductos)
      if (code === 'KeyJ') {
        // Saltar a las 2:00 AM (El Largo se activa)
        this.clock.elapsed = Math.max(this.clock.elapsed, NIGHT2.LARGO.START_HOUR * CONFIG.SECONDS_PER_HOUR);
      }
      if (code === 'KeyF') this.gas.trigger();
      if (code === 'KeyX') this.clock.elapsed = CONFIG.NIGHT_HOURS * this.clock.sph - 2; // a las 5:59
      if (code === 'KeyI') {
        // El Insecto paso a paso: aparece (V2-V5) → V1 → V6 o V7
        const ins = this.ai.insecto;
        if (ins.state === 'away') ins.appear(this.world);
        else if (ins.room !== 'v1' && ins.enterIn === null) ins.moveTo('v1', this.world);
        else if (ins.room === 'v1') ins.moveTo(this.rng.next() < 0.5 ? 'v6' : 'v7', this.world);
      }
      if (code === 'KeyY' && this.ai.largo.state === 'room') this.ai.largo.hit(this.world);
      if (code === 'KeyU' && getNight(this.nightNumber).event3am) this.n3.start3am();
    }
  }

  _onMove(x, y) {
    let over = false;
    if (this.state === 'final') this.final.move(x, y);
    if (this.state === 'lockers') over = this.lockers.move(x, y);
    if (this.state === 'n4start') over = this.n4start.move(x, y);
    if (this.state === 'n4repair') over = this.n4repair.move(x, y);
    if (this.state === 'n4sleep') over = this.n4sleep.move(x, y);
    if (this.state === 'n4dark') over = this.n4dark.move(x, y);
    if (this.state === 'n5leak') over = this.n5leak.move(x, y);
    if (this.state === 'n6sala') this.n6sala.move(x, y);
    if (this.state === 'n6final') over = this.n6final.move(x, y);
    this.mouse.x = x;
    this.mouse.y = y;
    if (this.state === 'night') {
      const strip = !this.cameras.open && this.lookBack.hover(x, y);
      const face = this.lookBack.face;
      over = this.lookBack.turned ? strip || (face !== 'back' && !!this.officeView.hitTest(x, y, face)) : this.cameras.open
        ? this.cameraView.hitTest(x, y, this.cameras)
        : strip || this.officeView.hitTest(x, y, 'front') || inside(MONITOR_TAB, x, y);
      if (this.tape.playing && (inside(TAPE_SKIP, x, y) || inside(TAPE_SUBS, x, y))) over = true;
      if (this._tapeAvailable() && inside(TAPE_PLAY, x, y)) over = true;
    } else if (this.state === 'menu') {
      const hit = this._splashMenu ? null : this.menu.hitTest(x, y, this.save);
      over = !!hit;
      this.menu.hoverMusica = hit === 'musica';
      this.menu.hoverCreditos = hit === 'creditos';
      this.menu.hoverFinales = hit === 'finales';
      // v0.77: por «Continue – Noche 6» o «Noche 7», la radio se ralentiza y desafina un instante
      if (hit === 'continue' && !this._hoverCont && this.save && this.save.night >= 6) this.menuMusic.interferir();
      this._hoverCont = hit === 'continue';
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
   * NIGHT2.GAS.VENTS). Si El Insecto está ahí, se aleja. Cada soltada
   * cuenta para la fuga.
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
    if (ins.state === 'vent' && ins.room === cams.active) ins.repel(this.world);
  }

  /**
   * Golpes metálicos (noche 2) o audio (noche 3+) en la sala elegida en el
   * plano: atraen a El Largo. Funciona aunque la cámara esté rota (los
   * altavoces siguen funcionando).
   */
  _lure() {
    if (!this.cameras.hasLure || this.cameras.mapMode !== 'main' || this.lureCooldown > 0) {
      this.events.emit('denied', 'center');
      return;
    }
    this.lureCooldown = this.ai.largo.lureCooldown ?? NIGHT2.LARGO.LURE_COOLDOWN;
    this.events.emit('lure', { room: this.cameras.active });
    this.ai.largo.hearLure(this.cameras.active, this.world);
  }

  /** (v1.18, el usuario) Con las cámaras desactivadas por El Errante no se puede enfriar el reactor
   *  ni tocar el rango de la Criogenia (todas las noches en que sale). */
  _sinCamaras() {
    if (!this.n5?.active || !this.n5.camsDead) return false;
    this.events.emit('denied', 'center');
    this.terminal.print?.('Error: sin conexion con las camaras (resetcam)');
    return true;
  }

  _cool() {
    if (this._sinCamaras()) return;
    if (!this.reactor.startCooling()) this.events.emit('denied', 'center');
  }

  /**
   * Comando escrito en la consola. Los comandos disponibles se listan
   * en CONFIG.TERMINAL_COMMANDS (y en el cartel de la oficina).
   */
  _runCommand(text) {
    const cmd = text.trim().toLowerCase();
    if (cmd === CONFIG.BLACKOUT_COMMAND) {
      if (this.blackout.tryCommand(cmd)) this.terminal.print('Reinicio de energia... OK');
      else this.terminal.print('Error: no hay ningun fallo activo');
      return;
    }
    if (cmd === NIGHT2.UPDATE_COMMAND && getNight(this.nightNumber).ventsUpdate) {
      if (!this.cameras.hasVents) this.terminal.print('Error: no hay actualizaciones');
      else if (this.cameras.ventsUnlocked) this.terminal.print('Ventilacion ya en linea');
      else {
        this.cameras.ventsUnlocked = true;
        this.terminal.print('Instalando parche... OK');
        this.terminal.print('Ventilacion en linea > TOGGLE');
        this.events.emit('ventsUnlocked');
      }
      return;
    }
    if (this.n5.active && cmd === NIGHT5.ERRANTE.REPAIR_COMMAND) {
      this.terminal.print(this.n5.startRepair());
      // (noche 7: las quemadas por el calor no tienen arreglo)
      const q = this.n7.active ? this.n7.rotura.quemadas() : [];
      if (q.length) this.terminal.print(`${q.join(', ')}: quemada${q.length > 1 ? 's' : ''} por sobrecalentamiento. No responde${q.length > 1 ? 'n' : ''}.`);
      return;
    }
    if (cmd === NIGHT2.LEAK.COMMAND.toLowerCase()) {
      if (this.gas.tryCommand(cmd)) this.terminal.print('Sellando fuga... OK');
      else this.terminal.print('Error: no hay ninguna fuga');
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
    if (!this.cryo.enabled) return;            // (noche 7: sin termostato)
    if (this._sinCamaras()) return;
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
        this.menuMusic.update(dt);
        break;
      case 'night':
        this.tape.update(dt);
        this.office.update(dt);
        this._updateFrio(dt);
        this.cameras.update(dt);
        this._sonidoCamRota(dt);
        if (this.lookBack.enabled) {
          // (v0.90: con la consola activa también se gira: al llegar al borde se suelta sola;
          // antes, tras escribir un comando —resetcam— no se podía girar a las puertas)
          if (this.cameras.open) this.lookBack.edge = null;
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
        // Noche 3: ¿la linterna alumbra el pasillo central? (El Largo avanza con sus fallos)
        this.n3.update(dt, this.lookBack.facingBack && this.backFlash.on && !this.backFlash.blinkOff
          && inside({ x: BACK_HATCH.x - 120, y: BACK_HATCH.y - 80, w: BACK_HATCH.w + 240, h: BACK_HATCH.h + 200 }, this.mouse.x, this.mouse.y));
        if (this.n3.cineRunning) break;   // cinemática de las 3 AM: la noche espera
        this.n7.update(dt);
        this.ofv2?.update(dt);
        this._dtOf = dt;
        this.cabeza.update(dt);
        if (this.n7.parada) break;        // noche 7: la cinta (y el segundo de silencio): nada se mueve
        this.clock.update(dt);
        this.blackout.update(dt, this.clock.elapsed);
        this.cryo.update(dt);
        // Noche 4, ruta A: durante las alucinaciones los enemigos se quedan
        // quietos (HALLU.FREEZE): se pueden mirar todas las cámaras sin miedo
        if (!(this.hallu.active && NIGHT4.HALLU.FREEZE) && !this.n7.enemigosQuietos) this.ai.update(dt);
        // Noche 4, camino B: Slaimi salta por donde viene el peligro
        if (this.slaimi.update(dt, this.ai.enemies)) {
          const pan = { left: -0.7, right: 0.7, front: 0, back: 0 }[this.slaimi.side];
          this.audio.boing?.(pan, this.slaimi.side === 'back' ? 0.08 : 0.13);
        }
        if (this.state !== 'night') return; // un enemigo ha atacado
        this._updateN2Intro(dt);
        this.n5.update(dt);
        this.n6.update(dt);
        // Noche 4, ruta A: alucinaciones (3 AM) y voces (4 AM → final)
        if (this.hallu.update(dt)) this._halluEnd();
        if (this.voices.active && this.audio.ctx) {
          const sph = CONFIG.SECONDS_PER_HOUR;
          const ini = NIGHT4.VOICES.HOUR * sph;
          this.voices.update(dt, Math.max(0, Math.min(1, (this.clock.elapsed - ini) / (CONFIG.NIGHT_HOURS * sph - ini))));
        }
        this.reactor.update(dt, this.office, this.cameras.open);
        if (this.state !== 'night') return; // el reactor ha explotado
        if (this.clock.finished && getNight(this.nightNumber).lockersEnding) {
          // Noche 3: a las 6 AM hay que esconderse en una taquilla
          // (antes, la cinemática de llegada de los enemigos en el plano)
          this._startLockers({ save: this.saveEnabled !== false && !this.debugNight, arrival: true });
          break;
        }
        if (this.clock.finished && getNight(this.nightNumber).finalSequence) {
          // Noche 2: a las 6 AM empieza el final (no se gana todavía)
          this._startFinal({ save: !this.debugNight });
          break;
        }
        if (this.nightNumber === 4 && this.n4path === 'A' && this.clock.elapsed >= NIGHT4.SLEEP.START * CONFIG.SECONDS_PER_HOUR) {
          // Ruta A: antes de las 6 (SLEEP.START) el vigilante se duerme (Night4Sleep)
          this._startN4Sleep();
          break;
        }
        if (this.nightNumber === 4 && this.n4path === 'B') {
          // Ruta B: aviso a las 4:50 y apagón a las 5:00 (src/ending/Night4Dark.js)
          const hour = this.clock.elapsed / CONFIG.SECONDS_PER_HOUR;
          if (hour >= NIGHT4.DARK.START) {
            this._startN4Dark({ at: 'cinco', save: this.saveEnabled !== false && !this.debugNight });
            break;
          }
          if (hour >= NIGHT4.DARK.WARN_AT) this._n4Warn(dt);
        }
        // v0.79: los clips de la cinemática, precargados antes de las 6:00 (sin tirones ni negros)
        if (this.n6.active && !this._n6Precarga && this.clock.elapsed > 5 * CONFIG.SECONDS_PER_HOUR) {
          this._n6Precarga = true;
          precargarCine();
        }
        if (this.clock.finished && this.n7.active) {
          // Noche 7: a las 6:00, el final (lo diseña el usuario; ahora, la pantalla provisional)
          this._n7Final();
          break;
        }
        if (this.clock.finished && this.n6.active) {
          // Noche 6: a las 6:00, la cinemática en las cámaras (Fase 5)
          this._startN6Final({ save: this.saveEnabled !== false && !this.debugNight });
          break;
        }
        if (this.clock.finished && this.n5.active) {
          // Noche 5: a las 6:00, sin texto, revienta una tubería de Criogenia
          this._startN5Leak({ save: this.saveEnabled !== false && !this.debugNight });
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
      case 'lockers':
        this.lockers.update(dt);
        break;
      case 'n4start':
        this.tape.update(dt);
        this.n4start.update(dt);
        break;
      case 'n4repair':
        this.tape.update(dt);
        this.n4repair.update(dt);
        break;
      case 'n4sleep':
        this.n4sleep.update(dt);
        if (this.audio.ctx) this.voices.update(dt, 1);
        break;
      case 'n4dark':
        this.n4dark.update(dt);
        break;
      case 'n5start':
        this.n5start.update(dt);
        break;
      case 'n5leak':
        this.office.update(dt);
        this.n5leak.update(dt);
        break;
      case 'n6ducts':
        this.n6ducts.update(dt);
        break;
      case 'n6sala':
        this.n6sala.update(dt);
        break;
      case 'n6vuelta':
        // Fase 3: sales del conducto a la oficina; luego, el turno
        this.n6vueltaT += dt;
        if (this.n6vueltaT >= NIGHT6.VUELTA.TIME) {
          this.lookBack.reset();
          this._setState('night');
        }
        break;
      case 'n6final':
        this.n6final.update(dt);
        break;
      case 'n7final':
        if (this.final1?.activa && !this.final1.acabada) {
          this.final1.update(dt);
          this._f1Fin = this.stateTime;
          break;
        }
        if (this.stateTime - (this._f1Fin ?? 0) >= NIGHT7.FINAL.PANTALLA) this._toMenu();
        break;
      case 'n2done':
        // Negro y el reactor apagándose; luego al menú (con la noche 3 desbloqueada)
        if (this.stateTime >= 4.5) this._toMenu();
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
      case 'frozenDoor': {
        // v0.66b: la vista se gira hacia su compuerta y, en cuanto está de
        // frente, salta (una de las 3 variantes)
        this.lookBack.update(dt);
        this.office.update(dt);
        this._updateFrio(dt);
        const fd = this.frozenDoor;
        const t = this.stateTime - fd.giro;
        if (!fd.grito && t >= 0) {
          fd.grito = true;
          const vs = saltosCongelado();
          fd.var = vs.length ? vs[Math.floor(Math.random() * vs.length)] : null;
          nuevoSalto();
          this.audio.frozenGrito?.() ?? this.audio.scream();
        }
        if (t >= (fd.var ? duracionSalto(fd.var) : 0.9) + 0.45) {
          this._setState('lose');
          this.audio.frozenViento?.();      // la pantalla de muerte no se queda en silencio
        }
        break;
      }
      case 'explosion':
      case 'gasDeath':
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
        this.menu.draw(ctx, { save: this.save, effects: this.effects, audioReady: !!this.audio.ctx, splash: this._splashMenu, musicaMuda: this.menuMusic.muted });
        break;
      case 'night':
        this._drawNight(ctx);
        break;
      case 'frozenDoor': {
        // La pared de la compuerta (sin el movimiento del ratón: los
        // fotogramas van a pantalla completa, en su sitio) y él encima
        const raton = this.mouse;
        this.mouse = null;
        this.lookBack.draw(ctx, {
          front: (c) => this._drawOfficeFront(c, 'front'),
          left: (c) => this._drawOfficeFront(c, 'left'),
          right: (c) => this._drawOfficeFront(c, 'right'),
          back: (c) => this._drawBack(c),
        });
        this.mouse = raton;
        this._drawFrio(ctx);
        const fd = this.frozenDoor;
        const t = this.stateTime - fd.giro;
        if (t < 0) {
          // girándose hacia su compuerta (en la puerta no se le ve: pedido del usuario)
        } else if (fd.var) {
          // v0.66c: el salto ENCIMA de la oficina (los fotogramas tienen fondo transparente)
          drawSaltoCongelado(ctx, fd.var, t, this.effects, 7, true);
        } else {
          drawSustoPuerta(ctx, fd.side, 99, CONFIG.CRYO.PUERTA);
          cortesGlitch(ctx, 0.5);
          this.effects.static(ctx, 0.25);
        }
        break;
      }
      case 'jumpscare':
        if (this.attacker === 'errante' && !hasJumpscare('errante')) {
          if (this.stateTime >= CONFIG.JUMPSCARE.CUT) {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
            break;
          }
          // El Errante: su cara, de golpe, ocupándolo todo
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
          drawErranteFace(ctx, 1, 1 + 0.35 * Math.min(1, this.stateTime / 0.2) + 0.04 * Math.sin(this.stateTime * 60));
          this.effects.static(ctx, 0.3);
        } else if (this.attacker === 'frozen' && saltosCongelado().length) {
          this.saltoVar ??= saltosCongelado()[Math.floor(Math.random() * saltosCongelado().length)];
          drawSaltoCongelado(ctx, this.saltoVar, this.stateTime, this.effects);
        } else drawJumpscare(ctx, this.attacker, this.stateTime, this.effects);
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
      case 'lockers':
        this.lockers.draw(ctx);
        break;
      case 'n4start':
        this.n4start.draw(ctx);
        this._drawTapeMinigame(ctx);
        break;
      case 'n4repair':
        this.n4repair.draw(ctx);
        this._drawTapeMinigame(ctx);
        break;
      case 'n4sleep':
        this.n4sleep.draw(ctx);
        break;
      case 'n4dark':
        this.n4dark.draw(ctx);
        this.cabeza.drawDestello(ctx, this.effects);
        break;
      case 'n5start':
        this.n5start.draw(ctx);
        break;
      case 'n5leak':
        this.n5leak.draw(ctx);
        break;
      case 'n6ducts':
        this.n6ducts.draw(ctx);
        break;
      case 'n6sala':
        this.n6sala.draw(ctx);
        break;
      case 'n6vuelta':
        this._drawN6Vuelta(ctx);
        break;
      case 'n6final':
        this.n6final.draw(ctx);
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
      case 'n7final':
        if (this.final1?.activa && !this.final1.acabada) this.final1.draw(ctx);
        else this._drawEndScreen(ctx, 'CONTINUARÁ', 'La huida (Fase 2 del final), en preparación', '#e8eef5');
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
      // (noche 7: las explosiones hacen temblar la oficina)
      const sac = this.n7?.active ? this.n7.rotura.sacudida : 0;
      ctx.save();
      if (sac > 0) ctx.translate((Math.random() - 0.5) * 26 * sac, (Math.random() - 0.5) * 16 * sac);
      this.lookBack.draw(ctx, {
        front: (c) => this._drawOfficeFront(c, 'front'),
        left: (c) => this._drawOfficeFront(c, 'left'),
        right: (c) => this._drawOfficeFront(c, 'right'),
        back: (c) => this._drawBack(c),
      });
      ctx.restore();
      if (this.lookBack.facingBack && (this.save?.flags?.pasilloAbierto || this.nightNumber >= 3)) {
        // El pasillo está a oscuras: solo se ve con la linterna (con la
        // compuerta cerrada no hay hueco que oscurecer: es la plancha)
        const { x: mx, y: my } = this.mouse;
        this.backFlash.draw(ctx, mx, my, BACK_HATCH, 0.93);
        if (this.drawCorridorEnemies) this.backFlash.reveal(ctx, mx, my, (c) => this.drawCorridorEnemies(c));
      }
      this._drawFrio(ctx);
      this.effects.vignette(ctx);
      this.effects.static(ctx, 0.05);
    }
    if (!this.cameras.open) this.lookBack.drawStrips(ctx);
    if (this.cameras.anim > 0) {
      this._drawCameraLayer(ctx);
    } else if (!this.blackout.active && !this.lookBack.turned) {
      this.cameraView.drawOfficeTab(ctx);
    }
    // Ruta B, 4:50: las luces parpadean y la consola se llena de interferencias
    const w = this.n4warn;
    if (w) {
      if (w.flick > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.82)';
        ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
      }
      if (w.noise > 0) this.effects.static(ctx, 0.12 + 0.1 * Math.random());
    }
    this._drawNightOverlay(ctx);
    this.note.draw(ctx);
    if (this.n3.cineRunning) drawSkipButton(ctx);
  }

  /** Una pared de la oficina ('front', 'left' o 'right'). */
  /**
   * Inicio de la noche 2 (v0.58): sus arañazos acercándose por el conducto
   * derecho mientras corre la cuenta atrás de get-update. A tiempo: se
   * retira; si no, llega a la rejilla y ataca.
   */
  _updateN2Intro(dt) {
    const it = this.n2intro;
    if (!it) return;
    const E = NIGHT2.ENTRADA;
    if (it.won) {
      it.t2 += dt;
      if (it.t2 >= E.GONE) this.n2intro = null;
      return;
    }
    if (this.cameras.ventsUnlocked) {
      // v0.63 (pedido por el usuario): actualizar ya no lo echa. Con las
      // cámaras de ventilación en línea, El Insecto sigue en el conducto
      // derecho (V6) y hay que ahuyentarlo como en el resto de la noche:
      // insecticida en su conducto antes de que entre. Le queda lo que
      // faltaba de la cuenta (como mínimo, lo normal: INSECTO.ENTER_TIME).
      this.n2intro = null;
      const ins = this.ai.insecto;
      ins.state = 'vent';
      ins.room = 'v1';
      ins.moveTo('v6', this.world);
      ins.enterIn = Math.max(NIGHT2.INSECTO.ENTER_TIME, E.TIME - it.t);
      ins.noiseIn = 0.3;
      this.alerta('VENTILACION EN LINEA: EL INSECTO ESTA EN V6', 'danger');
      return;
    }
    it.t += dt;
    const k = Math.min(1, it.t / E.TIME);
    it.next -= dt;
    if (it.next <= 0) {
      // Cada vez más cerca: más fuerte, menos apagado y más seguido
      it.next = E.SCRATCH * (1 - 0.55 * k) * (0.7 + Math.random() * 0.6);
      this.audio.lib?.play('criaturas/aranazos', { volume: 0.15 + 0.75 * k, pan: 0.6, muffle: 0.6 * (1 - k) });
      if (k > 0.6 && Math.random() < 0.4) this.audio.lib?.play('criaturas/chillido', { volume: 0.15 + 0.4 * k, pan: 0.6, muffle: 0.3 });
    }
    if (it.t >= E.TIME) {
      // No ha llegado a tiempo: rompe la rejilla y entra
      this.n2intro = null;
      this.audio.lib?.play('metal/golpe_pared', { volume: 1, pan: 0.65 });
      this.alerta('EL INSECTO HA ENTRADO', 'danger');
      this._attack({ id: 'insecto' });
    }
  }

  /** 0..1: lo cerca que está El Insecto de la rejilla (y de vuelta a 0 al irse). */
  get n2introProgress() {
    const it = this.n2intro;
    if (!it) return 0;
    const E = NIGHT2.ENTRADA;
    if (it.won) return Math.max(0, (it.k0 ?? 1) * (1 - it.t2 / E.GONE));
    return Math.max(0.01, Math.min(1, it.t / E.TIME));
  }

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
      v2: this.ofv2,
      overlay: (c, f) => {
        this.ofv2?.drawFuego(c, f);              // (v1.00: el fuego de la oficina, simulado en Blender)
        this.ofv2?.drawChispas(c, f, this._dtOf ?? 1 / 60);   // (v1.12: las chispas de los cables cortados)
        if (f === 'front' && this.n5.active) this.n5.drawFront(c);
        if (f === 'front' && this.n7.active) this.n7.rotura.drawRejillas(c);   // (v0.97: las rejillas que explotan)
        if (f === 'front' && this.n7.active) this.n7.muerteDis.drawRejilla(c);  // (v1.24: El Dislocado muere en el hueco)
      },
      introProgress: this.n2introProgress,
    });
    this.slaimi.drawInOffice(ctx, face, this.sprites);
    if (this.n6preview) drawPostLeak(ctx, face, { time: this.stateTime, slaimi: this.save?.flags?.slaimiTaquilla ? 'taquilla' : null });
    if (this.n6.active) {
      // (v0.80, el usuario: «quita la escarcha de la oficina de la noche 6»: ya no se pinta _n6Escarcha)
      this.n6.drawOffice(ctx, face);
    }
    this.n7.drawOffice(ctx, face);
    this.cabeza?.draw(ctx, face);
    this.ofv2?.drawCambio(ctx);
  }

  /**
   * v0.77 (el usuario: «la escarcha y la niebla tapan toda la pantalla»): el
   * frío de la fuga entra fuerte al volver a la oficina y se despeja en
   * NIGHT6.VUELTA.DESPEJE s; después solo queda escarcha en los bordes.
   */
  _n6Escarcha(ctx, face) {
    const V = NIGHT6.VUELTA;
    const k = this.state === 'n6vuelta' ? 1 : Math.max(0, 1 - (this.n6.time ?? 0) / V.DESPEJE);
    const s = k * k * (3 - 2 * k);
    if (s > 0) drawPostLeak(ctx, face, { time: this.stateTime, fuerza: 0.95 * s });
    drawEdgeFrost(ctx, V.ESCARCHA);
  }

  /** Detrás de la oficina: el pasillo central, abierto desde el final de la noche 2. */
  _drawBack(ctx) {
    const open = this.save?.flags?.pasilloAbierto || this.nightNumber >= 3;
    this.backView.draw(ctx, { open: open ? 1 : 0, sealed: !open, red: 0 });
    this.slaimi.drawInOffice(ctx, 'back', this.sprites);
    if (this.n6preview) drawPostLeak(ctx, 'back', { time: this.stateTime, slaimi: this.save?.flags?.slaimiTaquilla ? 'taquilla' : null });
    if (this.n6.active) {
      this.n6.drawOffice(ctx, 'back');
    }
    this.n7.drawOffice(ctx, 'back');
  }

  _drawCameraLayer(ctx) {
    this.cameraView.draw(ctx, this.cameras, this.effects, {
      roamers: this.ai.roamers,
      n2intro: this.n2intro && !this.n2intro.won ? this.n2introProgress : null,   // v0.58
      specimen: this.ai.specimen,
      frozen: this.ai.frozen,
      cryo: this.cryo,
      reactor: this.reactor,
      insect: this.ai.insecto,
      largo: this.ai.largo,
      gas: this.gas,
      lureCooldown: this.lureCooldown,
      lureMax: this.ai.largo.lureCooldown ?? NIGHT2.LARGO.LURE_COOLDOWN,
      night: this.nightNumber,
      clockElapsed: this.clock.elapsed,
      slaimi: this.slaimi.active ? this.slaimi : null,
      slaimiDead: slaimiDe(this.save?.flags)?.causa === 'n4' && this.nightNumber >= 5,
      hallu: this.hallu.active ? this.hallu : null,
      n5: this.n5.active ? this.n5 : null,
      n6: this.n6.active ? this.n6 : null,
      fondo: this.n7.active ? (room) => this.n7.fondoSala(room) : null,
      n7: this.n7.active ? this.n7 : null,
    });
    // (modo debug de la noche 4) El Errante en la cámara que se mire
    if (this.n4dbg?.errante && this.cameras.fullyOpen && this.cameras.mapMode === 'main') {
      drawErrante(ctx, 820, 760, 420, { alpha: 0.85, dark: 0.35 });
    }
  }

  /**
   * v0.58: todos los avisos quedan en el registro de la terminal (con la
   * hora de la noche). Los de la pantalla se apuntan al aparecer (si ya
   * estaban hace menos de 3 s, no se repiten).
   */
  /**
   * v0.58: mirando una cámara rota por El Largo, cada sala suena distinta
   * (lo único que llega es el audio): goteo, zumbido, pasos lejanos...
   */
  _sonidoCamRota(dt) {
    const id = this.cameras.active;
    if (!this.cameras.open || !this.cameras.broken?.has(id) || this.n5.camsDead || !ROOMS[id]) {
      this._rotaT = 0.6;
      return;
    }
    this._rotaT = (this._rotaT ?? 0.6) - dt;
    if (this._rotaT > 0) return;
    const [clave, vol, cada] = SONIDO_ROTA[id] ?? ['ambiente/interferencia', 0.25, 4];
    this.audio.lib?.play(clave, { volume: vol, radio: true });
    this._rotaT = cada * (0.7 + Math.random() * 0.6);
  }

  /** v0.58: la placa de la compuerta de atrás es la de esta noche. */
  _placa(id) {
    return id === 'protocolo' ? PLACA_DE_NOCHE[this.nightNumber] ?? id : id;
  }

  // --- v0.66: el frío llega antes que El Congelado ------------------------
  /** Lado de la oficina por el que viene (o null si no corre). */
  get _ladoFrio() {
    const F = this.ai.frozen;
    if (F?.state !== 'escaped' || !F.route) return this.state === 'frozenDoor' ? this.frozenDoor?.side ?? null : null;
    return F.route[F.route.length - 1] === 'left_door' ? 'left' : 'right';
  }

  _updateFrio(dt) {
    const fr = (this.frio ??= { k: 0, puffs: [], breathIn: 2, aviso: false });
    const F = this.ai.frozen;
    let meta = 0;
    if (this.state === 'frozenDoor' || F?.puerta) meta = 1;
    else if (F?.state === 'escaped' && F.route) {
      const paso = ['westHall', 'eastHall'].includes(F.room) ? CONFIG.CRYO.HALL_RUN_TIME : CONFIG.CRYO.RUN_STEP_TIME;
      meta = Math.min(1, (F.routeIndex + Math.max(0, 1 - F.stepTimer / paso)) / (F.route.length - 1));
      // el aviso, a mitad de camino (una vez por carrera)
      if (!fr.aviso && F.routeIndex >= F.route.length - 3) {
        fr.aviso = true;
        this.alerta('TEMPERATURA DE LA OFICINA BAJANDO', 'warn');
      }
    } else fr.aviso = false;
    // (v0.66b, pedido del usuario: cuando se va, el frío desaparece en ~1 s)
    fr.k += (meta - fr.k) * Math.min(1, dt * (meta > fr.k ? 0.9 : 3.0));
    if (!Number.isFinite(fr.k)) fr.k = 0;
    if (meta === 0 && fr.k < 0.05) { fr.k = 0; fr.puffs = []; }
    if (this.audio) this.audio.frozenK = meta;      // (pisadas que aceleran: AudioEngine._enemySteps)
    // vaho del protagonista: un soplo cada pocos segundos (más seguido cuanto más frío)
    if (fr.k > 0.12 && meta > 0) {
      fr.breathIn -= dt;
      if (fr.breathIn <= 0) {
        fr.breathIn = 3.2 - 1.6 * fr.k;
        fr.puffs.push({ t: 0, dur: 1.8, x: CONFIG.WIDTH / 2 + (Math.random() - 0.5) * 160 });
      }
    }
    for (const p of fr.puffs) p.t += dt;
    fr.puffs = fr.puffs.filter((p) => p.t < p.dur);
  }

  _drawFrio(ctx) {
    const fr = this.frio;
    if (!fr || (fr.k < 0.01 && !fr.puffs.length)) return;
    const lado = this._ladoFrio;
    const face = this.lookBack.face;
    if (lado && face === lado && !this.cameras.fullyOpen && !this.lookBack.moving) {   // (girando no: el marco quedaba en mitad)
      // la escarcha trepa por el marco de su compuerta
      ctx.save();
      ctx.beginPath();
      ctx.rect(566, 196, 468, 548);       // (el marco: entre esto y el hueco)
      ctx.rect(608, 242, 384, 480);
      ctx.clip('evenodd');
      drawWallFrost(ctx, 0.3 * fr.k);
      drawEdgeFrost(ctx, 0.5 * fr.k);
      ctx.restore();
      // la luz de emergencia de esa puerta parpadea mientras corre hacia ella
      const corre = this.ai.frozen?.room === (lado === 'left' ? 'westHall' : 'eastHall') || this.ai.frozen?.puerta || this.state === 'frozenDoor';
      if (corre) {
        const on = Math.random() < 0.55;
        ctx.fillStyle = on ? 'rgba(255,120,40,0.10)' : 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
        if (on) {
          const g = ctx.createRadialGradient(800, 140, 0, 800, 140, 260);
          g.addColorStop(0, 'rgba(255,150,60,0.35)');
          g.addColorStop(1, 'rgba(255,150,60,0)');
          ctx.fillStyle = g;
          ctx.fillRect(540, 0, 520, 400);
        }
      }
    }
    if (!this.cameras.fullyOpen) {
      drawEdgeFrost(ctx, 0.45 * fr.k);     // (más, y la oficina se veía blanca)
      drawBreath(ctx, fr.puffs);
    }
  }

  alerta(text, nivel = 'warn') {
    this.n7?.aviso();                          // (noche 7: la música baja con cada aviso)
    this.terminal.alert(this.clock.stamp, text, nivel);
  }

  _registrarAvisos(lista) {
    if (!this._avisosVistos) this._avisosVistos = new Map();
    const t = this.clock.elapsed;
    for (const w of lista) {
      const k = w.replace(/\s*\(\d+ s\)/, '');
      const antes = this._avisosVistos.get(k);
      if (antes === undefined || t - antes > 3) this.alerta(k, PELIGRO.test(k) ? 'danger' : 'warn');
      this._avisosVistos.set(k, t);
    }
  }

  _drawNightOverlay(ctx) {
    const warnings = [];
    if (this.gas.active) warnings.push(`FUGA DE GAS (${Math.ceil(this.gas.countdown)} s)`);   // v0.51: sin decir el comando
    // Noche 3: El Largo en el pasillo central al empezar (enseña la mecánica)
    if (this.n3.introRunning) {
      warnings.push(this.lookBack.facingBack && this.backFlash.on
        ? `Aleja a El Largo: pon un audio en la CAM ${ROOMS[NIGHT3.INTRO.HINT_CAM].cam} (${ROOMS[NIGHT3.INTRO.HINT_CAM].name})`
        : 'Algo se acerca por el PASILLO CENTRAL (detras de ti): girate y enciende la linterna');
    }
    // Noche 2: la ventilación empieza sin señal hasta escribir get-update
    if (this.cameras.hasVents && !this.cameras.ventsUnlocked) warnings.push('Ventilacion sin señal');
    if (this.blackout.active) warnings.push('APAGON');
    if (this.cryo.enabled && this.cryo.cambioReciente) warnings.push(`CRIOGENIA: nuevo rango (CAM 05): ${requisitoCryo(this.cryo).toLowerCase()}`);
    if (this.ai.frozen.state === 'warning') warnings.push('CRIOGENIA: temperatura fuera de rango (CAM 05)');
    if (this.ai.frozen.state === 'escaped' && !this.ai.frozen.n6Fuera) warnings.push('CRIOGENIA: capsula vacia. Algo corre hacia aqui');
    // (noche 7: subir es lo que se busca; el aviso es el del núcleo, o que lo están enfriando)
    if (this.n7.active) {
      if (this.n7.nucleo) warnings.push('NÚCLEO AL 100 % – EVACUACIÓN INMEDIATA');
      else if (this.n7.ab.enElNucleo) warnings.push('⚠ REACTOR – temperatura descendiendo (CAM 04)');
    } else if (this.reactor.warning) warnings.push('REACTOR: temperatura critica (CAM 04)');
    if (this.reactor.isCooling) warnings.push('ENFRIANDO REACTOR: compuertas y luces bloqueadas');
    warnings.push(...this.n5.warnings());
    this._registrarAvisos(warnings);

    let hint;
    if (this.terminal.focused) hint = 'Escribiendo en la consola...   Enter: ejecutar   Esc: salir';
    else if (this.lookBack.facingBack) hint = 'Pasillo central   ' + (this.nightNumber >= CONFIG.LOOK_BACK.FROM_NIGHT ? 'Espacio: linterna   ' : '') + 'Ratón a un borde: girar   V: volver';
    else if (this.lookBack.turned) hint = 'Clic: PUERTA / LUZ   Q/A: izq.   E/D: der.   Ratón a un borde: girar';
    else if (this.cameras.open && this.cameras.mapMode === 'vent') hint = 'Teclas 1-7: conducto   G: insecticida (V6/V7)   Tab: mapa de salas   Espacio: bajar';
    // (G solo cuando sirve: El Largo en las cámaras, desde la noche 3; v0.51)
    else if (this.cameras.open && this.cameras.hasVents) hint = `Teclas 1-0: camara   ${this.cameras.hasLure ? `G: ${this.ai.largo.mode === 'oido' ? 'audio' : 'golpes metalicos'}   ` : ''}Tab: ventilacion   Espacio: bajar`;
    else if (this.cameras.open) hint = 'Clic en el mapa o teclas 1-0: cambiar camara   Espacio: bajar monitor';
    else if (this.blackout.active) hint = 'Enter: consola';
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
    this.n5.drawHud(ctx);
    this.n7.drawHud(ctx);
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
    // (v0.51: solo negro; un último resplandor rojo del reactor que se apaga)
    const k = Math.max(0, 1 - this.stateTime / 1.6);
    if (k > 0) {
      ctx.fillStyle = `rgba(120,10,6,${0.25 * k})`;
      ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    }
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
    // v0.66: El Congelado deja la pantalla cubierta de escarcha, que se va
    // derritiendo mientras aparece el texto, y una pista para el siguiente intento
    if (this.state === 'lose' && this.deathCause === 'n6_fuga') drawEdgeFrost(ctx, Math.max(0, 1 - this.stateTime / 4) * 1.4);
    if (this.state === 'lose' && this.deathCause === 'frozen') {
      ctx.globalAlpha = 1;
      drawEdgeFrost(ctx, Math.max(0, 1 - this.stateTime / 4) * 1.4);
      ctx.globalAlpha = Math.min(1, Math.max(0, this.stateTime - 1.2));
      ctx.fillStyle = 'rgba(160,215,255,0.85)';
      ctx.font = '22px "Courier New", monospace';
      ctx.fillText('Cuando se vacía la cápsula, vigila los pasillos y cierra la puerta.', CONFIG.WIDTH / 2, 560);
    }
    if (this.stateTime > 1.5) {
      ctx.fillStyle = 'rgba(232,238,245,0.6)';
      ctx.font = '22px "Courier New", monospace';
      ctx.fillText(this.state === 'lose' ? 'Clic o Enter: reintentar   ·   Esc: menú' : 'Haz clic o pulsa Enter para volver al menú', CONFIG.WIDTH / 2, 640);
    }
    ctx.globalAlpha = 1;
  }

  _debugNight2() {
    const ins = this.ai.insecto;
    const lg = this.ai.largo;
    const back = ins.state === 'away' && isFinite(ins.returnIn) ? ` vuelve en ${ins.returnIn.toFixed(0)} s` : '';
    const crawl = lg.state === 'crawling' ? ` llega en ${lg.crawlLeft.toFixed(1)} s`
      : lg.state === 'hidden' ? ` vuelve en ${lg.hiddenIn.toFixed(0)} s` : '';
    const enter = ins.enterIn !== null ? ` ENTRA en ${ins.enterIn.toFixed(1)} s` : '';
    const leak = this.gas.active ? ` FUGA ${this.gas.countdown.toFixed(1)} s` : '';
    return `Insecto: ${ins.state} ${ins.room ?? ''} IA ${ins.level}${back}${enter}   `
      + (lg.mode === 'oido'
        ? `Largo (oido): ${lg.room ?? '-'} fase ${lg.phase ?? (lg.path ? 'camina' : lg.atDoor ? 'puerta' : 'deambula')} ${lg.timer2.toFixed(1)} s${lg.calm > 0 ? ` calma ${lg.calm.toFixed(0)}` : ''} IA ${lg.level}   `
        : `Largo: ${lg.state} ${lg.room ?? ''} golpes ${lg.breakStage}/${NIGHT2.LARGO.BREAK_STAGES} IA ${lg.level}${crawl}   `)
      + `Gas: usos ${this.gas.uses} riesgo ${Math.round(this.gas.nextRisk * 100)}%${leak}`;
  }

  _debugLines() {
    const sp = this.ai.specimen;
    const where = (e) => `${e.room ?? '-'}${e.atDoor ? ` (entra en ${e.doorTimer.toFixed(1)}s)` : ''} IA ${e.level}`;
    return [
      `[DEBUG] x${this.speed}  T:acelerar P:reactor 97% H:+1h B:apagon W:grieta K:romper temp`,
      `        J:ir a las 2:00  X:ir a las 5:59  F:fuga de gas  I:insecto aparece > V1 > V6/V7  Y:Largo golpea  U:evento 3 AM (N3)`,
      `noche ${this.clock.elapsed.toFixed(1)} s   reactor ${this.reactor.level.toFixed(1)}%  usos ${this.reactor.bars}  riesgo apagon ${Math.round(this.reactor.blackoutRisk * 100)}%`,
      `Especimen: muro ${sp.wallStage}/${CONFIG.WALL_STAGES} ruta ${sp.routeName ?? '-'} sala ${where(sp)}`,
      this._debugNight2(),
      `Congelado: ${this.ai.frozen.state} sala ${this.ai.frozen.room ?? '-'} temp ${this.cryo.temp} req ${this.cryo.mode} ${this.cryo.target}`,
      `apagones pendientes: ${this.blackout.schedule.map((s) => (s / CONFIG.SECONDS_PER_HOUR).toFixed(2) + 'h').join(', ') || '-'}${this.blackout.extraIn !== null ? `  extra en ${this.blackout.extraIn.toFixed(1)} s` : ''}`,
    ];
  }
}
