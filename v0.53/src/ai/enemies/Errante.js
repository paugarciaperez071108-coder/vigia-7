// =============================================================
// Errante.js — EL ERRANTE (noche 5; valores en NIGHT5.ERRANTE).
//
// No se le ve nunca en la oficina: la luz de la puerta no lo muestra.
// Estados:
//   'idle'  → recorriendo su RUTA (v0.49, como El Espécimen): sale de la
//             Criogenia (START), elige al azar ROUTES.A (→ compuerta
//             izquierda) o ROUTES.B (→ derecha) y avanza una sala cada
//             STEP s. En las cámaras SÍ se le ve en su sala
//             (Night5.drawRoom): si se mira su cámara STARE_TIME s
//             seguidos, desactiva TODAS las cámaras (como su cara); mientras
//             le miran no avanza. Al llegar al final de la ruta:
//   'door'  → en una de las dos puertas laterales (doorSide). Solo se le
//             OYE: una estática distorsionada por ese lado (Game/Night5).
//             Si al acabar DOOR_WINDOW s la puerta de ese lado está
//             cerrada, vuelve a la Criogenia y elige ruta otra vez; si
//             no, entra (game over).
//   'cam'   → su cara ocupa la imagen de la cámara que se está mirando.
//             Si en CAM_GRACE s no bajas el monitor ni cambias de cámara,
//             desactiva TODAS las cámaras (evento 'erranteCams'; se
//             reparan con «resetcam» en la consola).
// La dificultad sube con la hora (k = 0 a las 12 AM → 1 a las 6 AM).
// =============================================================

import { Enemy } from '../Enemy.js';
import { CONFIG } from '../../config.js';
import { NIGHT5 } from '../../night/night5.js';

const E = NIGHT5.ERRANTE;
const lerp = (a, b, k) => a + (b - a) * k;
const between = (pair, k) => [lerp(pair[0][0], pair[1][0], k), lerp(pair[0][1], pair[1][1], k)];

export class Errante extends Enemy {
  constructor({ level }) {
    super({ id: 'errante', name: NIGHT5.ENEMY_NAME, level, interval: 1e9 });
    this.state = 'idle';
    this.room = null;
    this.doorSide = null;
    this.route = null;     // la ruta elegida (NIGHT5.ERRANTE.ROUTES)
    this.routeName = null;
    this.routeIndex = 0;
    this.stepIn = null;    // s hasta la siguiente sala de la ruta
    this.camIn = null;
    this.t = 0;
    this.stare = 0;        // s que llevan mirando su cámara
  }

  k(world) {
    return Math.min(1, world.clock.elapsed / (CONFIG.NIGHT_HOURS * CONFIG.SECONDS_PER_HOUR));
  }

  _rand(world, pair) {
    return world.rng.range(pair[0], pair[1]);
  }

  /** (modo debug) Fuerza su ataque en una puerta. */
  forceDoor(world, side) {
    this.state = 'door';
    this.doorSide = side;
    this.t = lerp(E.DOOR_WINDOW[0], E.DOOR_WINDOW[1], this.k(world));
    this.room = side === 'left' ? 'left_door' : 'right_door';
    world.events.emit('erranteDoor', { side });
  }

  /** (modo debug, o al tocarle) Fuerza su cara en la cámara que se mira. */
  forceCam(world) {
    if (!world.cameras.open) return false;
    this.state = 'cam';
    this.camRoom = world.cameras.active;
    this.t = E.CAM_GRACE;
    world.events.emit('erranteFace', { room: this.camRoom });
    return true;
  }

  /** Siguiente sala de la ruta (al final, la compuerta). */
  _step(world) {
    if (!this.route) {
      this.routeName = world.rng.next() < 0.5 ? 'A' : 'B';
      this.route = E.ROUTES[this.routeName];
      this.routeIndex = 0;
    }
    const next = this.route[this.routeIndex++];
    this.stepIn = this._rand(world, between(E.STEP, this.k(world)));
    if (next === 'left_door' || next === 'right_door') this.forceDoor(world, next === 'left_door' ? 'left' : 'right');
    else this.room = next;
  }

  /** Vuelve a la Criogenia (la compuerta estaba cerrada) y elegirá ruta otra vez. */
  _back(world) {
    this.route = null;
    this.room = E.START;
    this.stepIn = this._rand(world, between(E.STEP, this.k(world)));
  }

  _idle(world, why) {
    const k = this.k(world);
    if (this.state === 'door') {
      world.events.emit('erranteGone', { side: this.doorSide, why });
      this._back(world);
    } else if (this.state === 'cam') {
      this.camIn = this._rand(world, between(E.CAM_EVERY, k));
      world.events.emit('erranteFaceEnd', { why });
    }
    this.state = 'idle';
    this.doorSide = null;
    this.stare = 0;
  }

  tick(dt, world) {
    if (this.level <= 0) {
      this.room = null;
      return;
    }
    if (this.stepIn === null) {
      this.room = E.START;
      this.stepIn = this._rand(world, E.FIRST);
      this.camIn = this._rand(world, E.FIRST) + 15;
    }
    const k = this.k(world);
    if (this.state === 'idle') {
      // ¿Están mirando su cámara? (con señal)
      const cams = world.cameras;
      const watched = cams.open && cams.fullyOpen && cams.active === this.room && !cams.broken.has(cams.active);
      this.stare = watched ? this.stare + dt : 0;
      if (this.stare >= E.STARE_TIME) {
        world.events.emit('erranteCams', { why: 'mirado' });
        this._idle(world, 'mirado demasiado');
        return;
      }
      // Avanza por su ruta (mientras le miran se queda en su sala)
      if (!watched) this.stepIn -= dt;
      if (this.stepIn <= 0) {
        this._step(world);
        if (this.state === 'door') return;
      }
      // Su cara en las cámaras: solo si se están mirando (y con señal)
      if (cams.open && cams.fullyOpen && (cams.openTime ?? 0) >= E.CAM_MIN_OPEN && !cams.broken.has(cams.active)) {
        this.camIn -= dt;
        if (this.camIn <= 0) this.forceCam(world);
      }
      return;
    }
    if (this.state === 'door') {
      this.t -= dt;
      if (this.t <= 0) {
        const closed = world.office.doors[this.doorSide].closed;
        if (closed) this._idle(world, 'puerta cerrada');
        else world.attack(this);
      }
      return;
    }
    if (this.state === 'cam') {
      const cams = world.cameras;
      if (!cams.open || cams.active !== this.camRoom) {
        this._idle(world, cams.open ? 'cambió de cámara' : 'bajó el monitor');
        return;
      }
      this.t -= dt;
      if (this.t <= 0) {
        world.events.emit('erranteCams', {});
        this._idle(world, 'cámaras desactivadas');
      }
    }
  }
}
