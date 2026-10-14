// =============================================================
// Frozen.js — El Congelado (CAM 05, Criogenia).
//
// No usa oportunidades de movimiento: depende del panel de
// temperatura (CryoPanel). Estados:
//
//   'asleep'  → la temperatura cumple el requisito; duerme.
//   'warning' → no lo cumple: suena la alarma y corre la cuenta
//               atrás (grace). Si lo corriges a tiempo, vuelve a
//               'asleep' y la cuenta se reinicia.
//   'escaped' → la cuenta llegó a 0: sale de la cápsula y CORRE
//               hacia la oficina por una de las rutas de
//               CONFIG.CRYO.RUN_ROUTES, una sala cada RUN_STEP_TIME
//               segundos. Se le ve en las cámaras y se le oye.
//               Tocar la temperatura ya no sirve: solo la compuerta.
//                 - Llega y la compuerta está ABIERTA → te mata al
//                   instante (no espera como los demás).
//                 - Está CERRADA → golpea, vuelve a su cápsula y la
//                   temperatura queda en zona segura.
// =============================================================

import { CONFIG } from '../../config.js';
import { Enemy, DOOR_SIDE } from '../Enemy.js';

export class Frozen extends Enemy {
  constructor(cryoCfg) {
    super({ id: 'frozen', name: 'El Congelado', level: 0 });
    this.cfg = cryoCfg;
    this.state = 'asleep';
    this.alarm = 0;
    this.room = null;   // sala por la que corre (null = en su cápsula)
  }

  get atDoor() {
    return DOOR_SIDE[this.room] ?? null;
  }

  update(dt, world) {
    const cryo = world.cryo;
    switch (this.state) {
      case 'asleep':
        if (!cryo.ok) {
          this.state = 'warning';
          this.alarm = 0;
          world.events.emit('cryoAlarm', { on: true });
        }
        break;

      case 'warning':
        if (cryo.ok) {
          this.state = 'asleep';
          world.events.emit('cryoAlarm', { on: false });
          break;
        }
        this.alarm += dt;
        if (this.alarm >= this.cfg.grace) this._escape(world);
        break;

      case 'escaped':
        this.stepTimer -= dt;
        if (this.stepTimer <= 0) this._run(world);
        break;
    }
  }

  _escape(world) {
    const routes = CONFIG.CRYO.RUN_ROUTES;
    const side = world.rng.next() < 0.5 ? 'left' : 'right';
    this.state = 'escaped';
    this.route = routes[side];
    this.routeIndex = 0;
    this.room = 'cryo';
    this.stepTimer = CONFIG.CRYO.RUN_STEP_TIME;
    world.events.emit('cryoAlarm', { on: false });
    world.events.emit('frozenEscape', { enemy: this, side });
    world.cameras.glitchIfWatching(['cryo'], 1.5);
  }

  /** Avanza una sala de su ruta; al llegar a la compuerta, decide. */
  _run(world) {
    const from = this.room;
    this.room = this.route[this.routeIndex++];
    this.stepTimer = CONFIG.CRYO.RUN_STEP_TIME;
    world.events.emit('enemyMove', { enemy: this, from, to: this.room });
    world.cameras.glitchIfWatching([from, this.room], CONFIG.CAMERA_MOVE_GLITCH);
    const side = this.atDoor;
    if (!side) return;
    if (world.office.doors[side].closed) {
      world.events.emit('doorBlocked', { enemy: this, side });
      this._returnToPod(world);
    } else {
      world.attack(this);
    }
  }

  _returnToPod(world) {
    this.state = 'asleep';
    this.room = null;
    world.cryo.makeSafe(CONFIG.CRYO.RETURN_SAFE_MARGIN);
    world.events.emit('frozenReturned', { enemy: this });
  }

  /** 0..1: cuánto ha avanzado la cuenta atrás de la alarma. */
  get warningProgress() {
    if (this.state === 'escaped') return 1;
    return this.state === 'warning' ? Math.min(1, this.alarm / this.cfg.grace) : 0;
  }
}
