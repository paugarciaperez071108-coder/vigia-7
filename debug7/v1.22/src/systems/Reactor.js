// =============================================================
// Reactor.js — Temperatura del reactor (sustituye a la energía).
//
// La temperatura SUBE sola poco a poco durante la noche y, además,
// mientras usas compuertas y luces:
//   subida/s = (PASSIVE_RATE
//             + compuertas cerradas × DOOR_RATE
//             + luces encendidas    × LIGHT_RATE
//             + monitor abierto     × MONITOR_RATE) × SPEED
// SPEED (CONFIG.REACTOR) es el mismo en todas las noches.
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
    this.reset({ coolCharges: 3 });
  }

  reset(nightCfg) {
    const R = CONFIG.REACTOR;
    this.level = R.START;
    this.charges = nightCfg.coolCharges;
    this.used = 0;
    this.cooling = 0;          // segundos de enfriamiento que quedan
    this.blackoutRisk = 0;     // 0..1, sube con cada enfriamiento
    this.bars = 0;
    this.warning = false;
    this.exploded = false;
    this.n7 = null;            // v0.82, noche 7: { rate, tope } (lo pone Night7: nunca explota durante la noche)
  }

  /** Número de cosas que están calentando el reactor ahora mismo. */
  computeBars(office, monitorOpen) {
    return office.doorsClosed + office.lightsOn + (monitorOpen && CONFIG.REACTOR.MONITOR_RATE > 0 ? 1 : 0);
  }

  update(dt, office, monitorOpen) {
    if (this.exploded) return;
    const R = CONFIG.REACTOR;
    this.bars = this.computeBars(office, monitorOpen);
    const rate = this.n7 ? (this.n7.rate + office.doorsClosed * R.DOOR_RATE + office.lightsOn * R.LIGHT_RATE) * R.SPEED : (R.PASSIVE_RATE +
        office.doorsClosed * R.DOOR_RATE +
        office.lightsOn * R.LIGHT_RATE +
        (monitorOpen ? R.MONITOR_RATE : 0)) * R.SPEED;
    // Mientras enfría no se calienta (v0.51: antes seguía calentándose y el
    // enfriamiento bajaba un 10-12 % en vez del COOL_AMOUNT)
    if (this.cooling <= 0) this.level += rate * dt;

    if (this.cooling > 0) {
      const step = Math.min(dt, this.cooling);
      this.level = Math.max(0, this.level - (R.COOL_AMOUNT / R.COOL_DURATION) * step);
      this.cooling -= step;
      if (this.cooling <= 0) this.events.emit('coolingEnd', { risk: this.blackoutRisk });
    }

    const warn = !this.n7 && this.level >= R.WARNING_LEVEL;   // (noche 7: sin la sirena de siempre; la suya es la alarma de sabotaje)
    if (warn !== this.warning) {
      this.warning = warn;
      this.events.emit('reactorWarning', { on: warn });
    }
    if (this.n7) {
      // (la noche 7: se queda en su tope; lo que decide el 100 % es Night7, a las 3:00)
      this.level = Math.max(0, Math.min(this.n7.tope, this.level));
      return;
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
