// =============================================================
// Clock.js — Reloj de la noche.
//
// Cuenta segundos de JUEGO (no reales): Game le pasa un dt que ya
// viene multiplicado por la velocidad de depuración, y que vale 0 si
// el juego está en pausa. Toda la IA usará este mismo tiempo, así
// que acelerar el reloj acelera también a los enemigos.
// =============================================================

import { CONFIG } from '../config.js';

export class NightClock {
  constructor(events) {
    this.events = events;
    this.reset();
  }

  reset() {
    this.elapsed = 0;
    this.lastHour = 0;
  }

  update(dt) {
    this.elapsed += dt;
    const h = this.hour;
    if (h !== this.lastHour) {
      this.lastHour = h;
      this.events.emit('hour', h); // la IA subirá de nivel con esto
    }
  }

  /** Hora actual: 0 = 12 AM, 1 = 1 AM ... 6 = 6 AM. */
  get hour() {
    return Math.min(CONFIG.NIGHT_HOURS, Math.floor(this.elapsed / CONFIG.SECONDS_PER_HOUR));
  }

  get label() {
    const h = this.hour;
    return h === 0 ? '12 AM' : `${h} AM`;
  }

  get finished() {
    return this.elapsed >= CONFIG.NIGHT_HOURS * CONFIG.SECONDS_PER_HOUR;
  }
}
