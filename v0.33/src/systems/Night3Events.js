// =============================================================
// Night3Events.js — Lo propio de la NOCHE 3 durante el turno de cámaras
// (valores en src/night/night3.js):
//
//   - Pasillo central: El Largo dentro, en 6 posiciones con una pose
//     distinta cada una (renders pose_largo_pasillo_p<0-5>; solo se ve con la
//     linterna, desde la pared de atrás). Cuando avanza mientras se le
//     alumbra, la linterna falla (se corta) y al volver la luz ya está en
//     otro sitio. Se le oye detrás (pasos y respiración).
//   - Evento de las 3 AM (noche 3.5): cinemática en la que El Largo rompe
//     TODAS las cámaras, una a una y cada vez más rápido. Empieza al abrir
//     las cámaras o a los CINE_WAIT s. Al terminar: ninguna cámara tiene
//     imagen, el minimapa marca con triángulos ⚠ dónde hay enemigos, los
//     audios siguen funcionando, todos son más agresivos (menos El Insecto,
//     más lento) y suena la cinta 3.5.
//
// Game lo crea una vez; reset(night) al empezar cada noche.
// =============================================================

import { NIGHT3 } from '../night/night3.js';
import { drawCreature } from '../render/CreatureArt.js';
import { BACK_HATCH } from '../render/BackView.js';
import { VENT_IDS } from '../world/StationMap.js';

const rand = ([a, b]) => a + Math.random() * (b - a);
const E = NIGHT3.EVENT_3AM;

// Si no están los renders del pasillo (pose_largo_pasillo_p<n>), se dibuja con las
// posturas que ya tiene: pies, altura y postura de cada posición.
const CORRIDOR_FALLBACK = [
  { x: 830, y: 500, h: 95, pose: 'stand' },
  { x: 770, y: 528, h: 140, pose: 'lean' },
  { x: 840, y: 566, h: 200, pose: 'crouch' },
  { x: 760, y: 612, h: 270, pose: 'lean' },
  { x: 812, y: 680, h: 380, pose: 'crouch' },
  { x: 795, y: BACK_HATCH.y + BACK_HATCH.h + 40, h: 520, pose: 'stand' },
];

export class Night3Events {
  constructor({ events, audio, cameras, ai, tape, flash, sprites, world }) {
    this.events = events;
    this.world = world;
    this.audio = audio;
    this.cameras = cameras;
    this.ai = ai;
    this.tape = tape;
    this.flash = flash;        // linterna del pasillo central (Flashlight)
    this.sprites = sprites;
    this.active = false;
    events.on('hour', (h) => this._onHour(h));
    // El Largo avanza por el pasillo mientras se le alumbra: la linterna se corta
    events.on('largoCorridorFail', ({ dark }) => {
      this.flash.cutOut(dark);
      this.audio.playAt('largo/pasos', 'central3', 0.5, { when: dark * 0.45 });
    });
    events.on('largoCorridorFlicker', () => this.flash.cutOut(0.08 + Math.random() * 0.1));
    events.on('largoCorridorStep', ({ room }) => this.audio.playAt('largo/pasos', room, 0.7));
  }

  reset(night) {
    this.night = night;
    this.active = !!(night.event3am || night.corridorStart);
    this.soundIn = 1.5;
    this.event = false;        // ¿han dado ya las 3 AM?
    this.cine = null;          // cinemática en curso: { i, t, durs }
    this.cineWait = null;      // s hasta que empiece aunque no se abran las cámaras
    this.cameras.broken = new Set();
    this.cameras.breaking = {};
    this.cameras.warnings = false;
  }

  get largo() {
    return this.ai.largo;
  }

  /** ¿Está El Largo en el pasillo central al empezar (para los avisos)? */
  get introRunning() {
    return !!this.largo?.intro;
  }

  /** ¿Se está viendo la cinemática? (Game congela la noche y bloquea los controles) */
  get cineRunning() {
    return !!this.cine;
  }

  /** Cada fotograma (también durante la cinemática). lit: ¿alumbra la linterna el pasillo? */
  update(dt, lit = false) {
    if (!this.active) return;
    const largo = this.largo;
    if (largo?.mode === 'oido') largo.lit = lit && largo.inCorridor;
    // Se le oye en el pasillo central, detrás de la oficina
    if (largo?.inCorridor && !this.cine) {
      this.soundIn -= dt;
      if (this.soundIn <= 0) {
        this.soundIn = rand(NIGHT3.INTRO.SOUND_EVERY) * (1 - 0.1 * largo.cpos);
        const key = Math.random() < 0.55 ? 'largo/pasos' : 'largo/respiracion';
        this.audio.playAt(key, largo.room, 0.75 + 0.05 * largo.cpos);
      }
    }
    // 3 AM: la cinemática empieza al abrir las cámaras (o al acabarse la espera)
    if (this.cineWait !== null) {
      this.cineWait -= dt;
      if (this.cameras.open || this.cineWait <= 0) this._startCine();
    }
    if (this.cine) this._updateCine(dt);
  }

  _onHour(h) {
    if (!this.night?.event3am || this.event || h !== E.HOUR) return;
    this.start3am();
  }

  /** Dan las 3 AM (también con la tecla de depuración U). */
  start3am() {
    if (this.event) return;
    this.event = true;
    this.cineWait = E.CINE_WAIT;
    this.events.emit('event3am');
  }

  _startCine() {
    this.cineWait = null;
    this.tape.stop();
    if (!this.cameras.enabled) this.cameras.setEnabled(true);
    if (!this.cameras.open) this.cameras.toggle();
    this.cameras.mapMode = 'main';
    // Duraciones cada vez más cortas (de CINE_FIRST a CINE_LAST)
    const n = E.BREAK.length;
    const r = Math.pow(E.CINE_LAST / E.CINE_FIRST, 1 / Math.max(1, n - 1));
    this.cine = { i: -1, t: 0, durs: E.BREAK.map((_, i) => E.CINE_FIRST * Math.pow(r, i)) };
    this._nextCam();
    this.events.emit('cineStart');
  }

  _nextCam() {
    const c = this.cine;
    c.i++;
    c.t = 0;
    c.hit = false;
    if (c.i >= E.BREAK.length) {
      this._endCine();
      return;
    }
    const room = E.BREAK[c.i];
    this.cameras.active = room;
    this.cameras.switchStatic = 0.12;
    this.events.emit('camSwitch', room);
  }

  /**
   * Cada cámara: se ve un momento, aparece El Largo pegado a la lente, la
   * golpea (distorsión) y se queda en SIN SEÑAL antes de pasar a la siguiente.
   */
  _updateCine(dt) {
    const c = this.cine;
    if (!this.cameras.open) this.cameras.toggle();
    c.t += dt;
    const d = c.durs[c.i];
    const room = E.BREAK[c.i];
    const k = c.t / d;
    if (k >= 0.3 && !c.hit) {
      c.hit = true;
      this.cameras.breaking[room] = true;
      this.events.emit('camBreaking', { room, fast: c.i > 3 });
    }
    if (k >= 0.72 && this.cameras.breaking[room]) {
      delete this.cameras.breaking[room];
      this.cameras.broken.add(room);
      this.events.emit('camBroken', { room, quiet: c.i > 5 });
    }
    if (k >= 1) this._nextCam();
  }

  _endCine() {
    this.cine = null;
    // Los conductos también se quedan sin señal (no se ven romperse)
    for (const v of VENT_IDS) this.cameras.broken.add(v);
    this.cameras.warnings = true;
    // Todos más agresivos... menos El Insecto, que va más lento
    this.ai.setAggro(E.INTERVAL_MULT, E.REACTION_MULT, { insectSpeed: E.INSECT_SPEED });
    if (this.largo?.mode === 'oido') this.largo.placeAt(E.LARGO_AFTER, this.world);
    this.events.emit('cineEnd');
    // Cinta 3.5: el hombre, exaltado, al terminar la cinemática
    this.tape.schedule('3_5', { autoplay: true });
  }

  /** El Largo dentro del pasillo central (Game lo dibuja dentro del haz de la linterna). */
  drawCorridor(ctx, time) {
    const largo = this.largo;
    if (!largo?.inCorridor) return;
    const n = Math.min(largo.cpos, CORRIDOR_FALLBACK.length - 1);
    // Pose renderizada para esa posición del pasillo (tools/3d/poses/poses.py,
    // sala 'pasillo'): imagen a pantalla completa
    if (this.sprites?.draw(ctx, `pose_largo_pasillo_p${n}`, 0, 0, 1600, 900)) return;
    const spot = CORRIDOR_FALLBACK[n];
    ctx.save();
    const r = BACK_HATCH;
    ctx.beginPath();
    ctx.rect(r.x - 40, r.y, r.w + 80, r.h + 200);
    ctx.clip();
    drawCreature(ctx, 'largo', spot.x, spot.y, spot.h, time, { pose: spot.pose, alpha: 0.96 });
    ctx.restore();
  }
}
