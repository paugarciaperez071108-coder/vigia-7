// =============================================================
// Blackout.js — Evento aleatorio: apagón de la oficina.
//
// Al empezar la noche se programan N apagones (blackouts en
// nights.js) en horas DISTINTAS elegidas al azar entre
// BLACKOUT_EARLIEST_HOUR y BLACKOUT_LATEST_HOUR, en un minuto
// aleatorio de esa hora.
//
// Durante el apagón:
//   - Solo se ven la pantalla verde de la consola y el ventanal.
//   - Las luces del pasillo y las cámaras no funcionan.
//   - Las compuertas se ABREN solas y no se pueden cerrar.
//   - Los enemigos siguen moviéndose.
// Se arregla escribiendo el comando (reset; v2.02: sin barra, con ella también vale) en la consola.
// (v2.02) Nunca empieza durante un ataque: update() recibe `ataque` y, si toca, espera a que acabe y
// CONFIG.BLACKOUT_TRAS_ATAQUE s más.
//
// Además, enfriar el reactor puede provocar apagones extra
// (scheduleExtra, lo llama Game según el riesgo del reactor).
// =============================================================

import { CONFIG, limpiaComando } from '../config.js';

export class Blackout {
  constructor(events, rng) {
    this.events = events;
    this.rng = rng;
    this.reset(0);
  }

  reset(count) {
    this.active = false;
    this.elapsed = 0;
    const hours = [];
    for (let h = CONFIG.BLACKOUT_EARLIEST_HOUR; h <= CONFIG.BLACKOUT_LATEST_HOUR; h++) hours.push(h);
    // Barajamos las horas y nos quedamos con las `count` primeras.
    for (let i = hours.length - 1; i > 0; i--) {
      const j = this.rng.int(0, i);
      [hours[i], hours[j]] = [hours[j], hours[i]];
    }
    this.schedule = hours
      .slice(0, Math.min(count, hours.length))
      .map((h) => (h + this.rng.range(0.1, 0.85)) * CONFIG.SECONDS_PER_HOUR)
      .sort((a, b) => a - b);
    this.extraIn = null; // segundos hasta un apagón extra (o null)
    this.trasAtaque = 0; // (v2.02) s que faltan para poder empezar después de un ataque
  }

  /** Programa un apagón extra dentro de `seconds` segundos. */
  scheduleExtra(seconds) {
    if (this.extraIn === null || seconds < this.extraIn) this.extraIn = seconds;
  }

  /** `nightTime`: segundos transcurridos de la noche. */
  update(dt, nightTime, ataque = false) {
    if (this.active) {
      this.elapsed += dt;
      return;
    }
    // (v2.02) con un enemigo atacando no empieza ninguno: espera a que se vaya (y unos segundos más)
    if (ataque) this.trasAtaque = CONFIG.BLACKOUT_TRAS_ATAQUE;
    else if (this.trasAtaque > 0) this.trasAtaque = Math.max(0, this.trasAtaque - dt);
    const puede = !ataque && this.trasAtaque <= 0;
    if (this.extraIn !== null) {
      this.extraIn = Math.max(0, this.extraIn - dt);
      if (this.extraIn <= 0 && puede) {
        this.extraIn = null;
        this.trigger();
        return;
      }
    }
    if (puede && this.schedule.length && nightTime >= this.schedule[0]) {
      this.schedule.shift();
      this.trigger();
    }
  }

  trigger() {
    if (this.active) return;
    this.active = true;
    this.elapsed = 0;
    this.events.emit('blackout', { on: true });
  }

  /** Comando escrito en la consola. Devuelve true si arregla el apagón. */
  tryCommand(text) {
    if (!this.active) return false;
    if (limpiaComando(text) !== CONFIG.BLACKOUT_COMMAND) return false;
    this.active = false;
    this.events.emit('blackout', { on: false });
    return true;
  }
}
