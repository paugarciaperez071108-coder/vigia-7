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
    // (v2.10, noche 7: Night7Puertas) el daño de cada puerta (0–3; 3 = rota, se queda abierta), lo que tarda en bajar
    // según el daño (cierrePuerta[daño], s; null = la normal) y el atasco a mitad de bajada (atascoPuerta)
    this.dano = { left: 0, right: 0 };
    this.cierrePuerta = null;
    this.atascoPuerta = null;
  }

  /** (v2.10) s que tarda esa puerta en bajar (null: al momento, como siempre). */
  _bajada(side) {
    if (this.cierreLento) return this.cierreLento;
    return this.cierrePuerta?.[this.dano?.[side] ?? 0] ?? null;
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
    // (noche 7, la nave se rompe: atascada, no se puede cerrar; Night7Rotura)
    if (!d.closed && this.atascada?.[side] > 0) {
      this.events.emit('denied', side);
      return;
    }
    // (v2.10) rota: se queda abierta el resto de la noche
    if ((this.dano?.[side] ?? 0) >= 3) {
      this.events.emit('denied', side);
      this.events.emit('puertaRotaPulsada', { side });
      return;
    }
    // (v1.57, reto «Gigantes»; v2.10, una puerta dañada en la noche 7) la compuerta lenta no cierra hasta llegar
    // abajo; volver a pulsar la para
    if (this._bajada(side) && !d.closed) {
      d.bajando = !d.bajando;
      if (d.bajando) d.atascoHecho = false;
      else d.atasco = 0;
      this.events.emit('door', { side, closed: d.bajando });
      return;
    }
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
      const target = d.closed || d.bajando ? 1 : 0;
      // (v2.10) el daño 2: a mitad de bajada se atasca un instante
      const at = this.atascoPuerta;
      if (d.bajando && at && (this.dano?.[s] ?? 0) === at.DANO && !d.atascoHecho && d.anim >= at.EN) {
        d.atascoHecho = true;
        d.atasco = at.DURA;
        this.events.emit('puertaAtasco', { side: s });
      }
      if (d.atasco > 0) {
        d.atasco -= dt;
        continue;
      }
      const paso = d.bajando ? dt / (this._bajada(s) || CONFIG.DOOR_ANIM_TIME) : step;
      d.anim += Math.sign(target - d.anim) * Math.min(paso, Math.abs(target - d.anim));
      if (d.bajando && d.anim >= 1) {
        d.bajando = false;
        d.closed = true;
      }
    }
  }

  get doorsClosed() {
    return SIDES.filter((s) => this.doors[s].closed).length;
  }

  get lightsOn() {
    return SIDES.filter((s) => this.lights[s]).length;
  }
}
