// =============================================================
// Reactor.js — Temperatura del reactor (sustituye a la energía).
//
// La temperatura SUBE sola poco a poco durante la noche y, además,
// mientras usas compuertas y luces:
//   subida/s = (PASSIVE_RATE
//             + compuertas cerradas × DOOR_RATE
//             + luces encendidas    × LIGHT_RATE
//             + monitor abierto     × MONITOR_RATE) × reactorMultiplier
// Si llega a 100, la nave explota (game over).
//
// ENFRIAMIENTO (botón en la CAM 04, o R mirando esa cámara):
//   - Baja la temperatura COOL_AMOUNT % repartido en COOL_DURATION s.
//   - Usos limitados por noche (coolCharges en nights.js).
//   - Coste: mientras dura, compuertas y luces bloqueadas (eso lo
//     aplica Game al recibir 'coolingStart'/'coolingEnd') y cada uso
//     suma COOL_BLACKOUT_RISK al riesgo de apagón.
// =============================================================

import { CONFIG } from '../config.js';

export class Reactor {
  constructor(events) {
    this.events = events;
    this.reset({ reactorMultiplier: 1, coolCharges: 3 });
  }

  reset(nightCfg) {
    const R = CONFIG.REACTOR;
    this.level = R.START;
    this.multiplier = nightCfg.reactorMultiplier;
    this.charges = nightCfg.coolCharges;
    this.used = 0;
    this.cooling = 0;          // segundos de enfriamiento que quedan
    this.blackoutRisk = 0;     // 0..1, sube con cada enfriamiento
    this.bars = 0;
    this.warning = false;
    this.exploded = false;
  }

  /** Número de cosas que están calentando el reactor ahora mismo. */
  computeBars(office, monitorOpen) {
    return office.doorsClosed + office.lightsOn + (monitorOpen && CONFIG.REACTOR.MONITOR_RATE > 0 ? 1 : 0);
  }

  update(dt, office, monitorOpen) {
    if (this.exploded) return;
    const R = CONFIG.REACTOR;
    this.bars = this.computeBars(office, monitorOpen);
    const rate =
      (R.PASSIVE_RATE +
        office.doorsClosed * R.DOOR_RATE +
        office.lightsOn * R.LIGHT_RATE +
        (monitorOpen ? R.MONITOR_RATE : 0)) * this.multiplier;
    this.level += rate * dt;

    if (this.cooling > 0) {
      const step = Math.min(dt, this.cooling);
      this.level = Math.max(0, this.level - (R.COOL_AMOUNT / R.COOL_DURATION) * step);
      this.cooling -= step;
      if (this.cooling <= 0) this.events.emit('coolingEnd', { risk: this.blackoutRisk });
    }

    const warn = this.level >= R.WARNING_LEVEL;
    if (warn !== this.warning) {
      this.warning = warn;
      this.events.emit('reactorWarning', { on: warn });
    }
    if (this.level >= 100) {
      this.level = 100;
      this.exploded = true;
      this.events.emit('reactorExplode');
    }
  }

  get isCooling() {
    return this.cooling > 0;
  }

  get canCool() {
    return this.charges > 0 && !this.isCooling && !this.exploded;
  }

  /** 0..1: progreso del enfriamiento en curso. */
  get coolProgress() {
    return this.isCooling ? 1 - this.cooling / CONFIG.REACTOR.COOL_DURATION : 0;
  }

  /** Empieza un enfriamiento. Devuelve false si no quedan usos o ya hay uno. */
  startCooling() {
    if (!this.canCool) return false;
    const R = CONFIG.REACTOR;
    this.charges--;
    this.used++;
    this.cooling = R.COOL_DURATION;
    this.blackoutRisk = Math.min(1, this.blackoutRisk + R.COOL_BLACKOUT_RISK);
    this.events.emit('coolingStart', { charges: this.charges });
    return true;
  }
}
