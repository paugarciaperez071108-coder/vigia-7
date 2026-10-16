// =============================================================
// Night3Events.js — Lo propio de la NOCHE 3 durante el turno de cámaras
// (valores en src/night/night3.js):
//
//   - Inicio: El Largo al fondo del pasillo central. Se le oye detrás
//     (pasos y respiración) hasta que se le aleja con un audio.
//   - Pasillo central: dibuja a El Largo dentro (solo se ve con la
//     linterna, desde la pared de atrás) según el tramo en el que está.
//   - Evento de las 3 AM: El Largo rompe las cámaras de los corredores
//     (golpes, distorsión y SIN SEÑAL), el minimapa pasa a marcar con
//     triángulos ⚠ las salas con enemigos, todos son más agresivos y
//     suena la cinta 3.5.
//
// Game lo crea una vez; reset(night) al empezar cada noche.
// =============================================================

import { NIGHT3 } from '../night/night3.js';
import { drawCreature } from '../render/CreatureArt.js';
import { BACK_HATCH } from '../render/BackView.js';

const rand = ([a, b]) => a + Math.random() * (b - a);

// Dónde se dibuja El Largo en cada tramo del pasillo (pies y altura en px,
// dentro del hueco de la compuerta de atrás): cuanto más cerca, más grande.
const CORRIDOR_SPOTS = {
  central1: { x: 812, y: 512, h: 120, pose: 'stand' },
  central2: { x: 780, y: 604, h: 250, pose: 'stand' },
  central3: { x: 800, y: BACK_HATCH.y + BACK_HATCH.h + 30, h: 500, pose: 'crouch' },
};

export class Night3Events {
  constructor({ events, audio, cameras, ai, tape }) {
    this.events = events;
    this.audio = audio;
    this.cameras = cameras;
    this.ai = ai;
    this.tape = tape;
    this.active = false;
    events.on('hour', (h) => this._onHour(h));
  }

  reset(night) {
    this.night = night;
    this.active = !!(night.event3am || night.corridorStart);
    this.soundIn = 1.5;
    this.breaking = [];        // [{ room, t }] cámaras que se están rompiendo
    this.event = false;        // ¿ha pasado ya el evento de las 3 AM?
    this.seenInCorridor = false;
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

  update(dt) {
    if (!this.active) return;
    const largo = this.largo;
    // Se le oye en el pasillo central, detrás de la oficina
    if (largo?.inCorridor) {
      this.soundIn -= dt;
      if (this.soundIn <= 0) {
        this.soundIn = rand(NIGHT3.INTRO.SOUND_EVERY);
        const key = Math.random() < 0.55 ? 'largo/pasos' : 'largo/respiracion';
        this.audio.playAt(key, largo.room, 0.9);
      }
    }
    // Cámaras rompiéndose (evento de las 3 AM)
    for (const b of this.breaking) {
      b.t -= dt;
      if (b.t <= 0 && !b.done) {
        b.done = true;
        this.cameras.broken.add(b.room);
        delete this.cameras.breaking[b.room];
        this.events.emit('camBroken', { room: b.room });
      } else if (!b.done && b.t <= NIGHT3.EVENT_3AM.BREAK_TIME && !b.started) {
        b.started = true;
        this.cameras.breaking[b.room] = true;
        this.events.emit('camBreaking', { room: b.room });
      }
      if (this.cameras.breaking[b.room]) this.cameras.glitchIfWatching([b.room], 0.25);
    }
    this.breaking = this.breaking.filter((b) => !b.done);
  }

  _onHour(h) {
    if (!this.night?.event3am || this.event || h !== NIGHT3.EVENT_3AM.HOUR) return;
    this.start3am();
  }

  /** Evento de las 3 AM (también con la tecla de depuración). */
  start3am() {
    if (this.event) return;
    const E = NIGHT3.EVENT_3AM;
    this.event = true;
    E.BREAK.forEach((room, i) => {
      this.breaking.push({ room, t: E.BREAK_TIME + i * E.BREAK_GAP });
    });
    this.cameras.warnings = true;
    this.ai.setAggro(E.INTERVAL_MULT, E.REACTION_MULT);
    this.events.emit('event3am');
    // Cinta 3.5: el hombre, exaltado, nada más empezar
    this.tape.schedule('3_5', { autoplay: true });
  }

  /** El Largo dentro del pasillo central (Game lo dibuja dentro del haz de la linterna). */
  drawCorridor(ctx, time) {
    const largo = this.largo;
    const spot = largo?.inCorridor && CORRIDOR_SPOTS[largo.room];
    if (!spot) return;
    ctx.save();
    // Solo dentro del hueco de la compuerta (y, en el último tramo, asomando por debajo)
    const r = BACK_HATCH;
    ctx.beginPath();
    ctx.rect(r.x - 40, r.y, r.w + 80, r.h + 200);
    ctx.clip();
    drawCreature(ctx, 'largo', spot.x, spot.y, spot.h, time, { pose: spot.pose, alpha: 0.96 });
    ctx.restore();
  }
}
