// =============================================================
// Office.js — Estado del Módulo de Control: compuertas y luces.
//
// Solo guarda estado y emite eventos; no dibuja nada (eso lo hace
// OfficeView). Las luces son excluyentes: encender una apaga la
// otra, como un único foco que apuntas a un lado u otro.
//
// Bloqueos: mientras haya algún bloqueo activo ('blackout' para el
// apagón, 'cooling' para el enfriamiento del reactor), compuertas y
// luces no responden. Cada sistema pone y quita el suyo.
// =============================================================

import { CONFIG } from '../config.js';

const SIDES = ['left', 'right'];

export class Office {
  constructor(events) {
    this.events = events;
    this.reset();
  }

  reset() {
    // closed: estado lógico (bloquea al instante al pulsar).
    // anim:   0 = abierta, 1 = cerrada; solo para la animación.
    this.doors = {
      left: { closed: false, anim: 0 },
      right: { closed: false, anim: 0 },
    };
    this.lights = { left: false, right: false };
    this.locks = new Set();
  }

  /** ¿Están compuertas y luces bloqueadas ahora mismo? */
  get locked() {
    return this.locks.size > 0;
  }

  /**
   * Activa o quita un bloqueo. Al bloquear se apagan las luces;
   * con `openDoors` además se abren las compuertas.
   */
  setLock(reason, on, { openDoors = false } = {}) {
    if (on) {
      this.locks.add(reason);
      this.setLightsOff();
      if (openDoors) this.openDoors();
    } else {
      this.locks.delete(reason);
    }
  }

  openDoors() {
    for (const s of SIDES) {
      if (this.doors[s].closed) {
        this.doors[s].closed = false;
        this.events.emit('door', { side: s, closed: false });
      }
    }
  }

  toggleDoor(side) {
    if (this.locked) {
      this.events.emit('denied', side);
      return;
    }
    const d = this.doors[side];
    d.closed = !d.closed;
    this.events.emit('door', { side, closed: d.closed });
  }

  toggleLight(side) {
    if (this.locked) {
      this.events.emit('denied', side);
      return;
    }
    const on = !this.lights[side];
    this.setLightsOff();
    this.lights[side] = on;
    this.events.emit('light', { side, on });
  }

  setLightsOff() {
    for (const s of SIDES) {
      if (this.lights[s]) {
        this.lights[s] = false;
        this.events.emit('light', { side: s, on: false });
      }
    }
  }

  update(dt) {
    // La animación avanza hacia el estado lógico a velocidad fija.
    const step = dt / CONFIG.DOOR_ANIM_TIME;
    for (const s of SIDES) {
      const d = this.doors[s];
      const target = d.closed ? 1 : 0;
      d.anim += Math.sign(target - d.anim) * Math.min(step, Math.abs(target - d.anim));
    }
  }

  get doorsClosed() {
    return SIDES.filter((s) => this.doors[s].closed).length;
  }

  get lightsOn() {
    return SIDES.filter((s) => this.lights[s]).length;
  }
}
