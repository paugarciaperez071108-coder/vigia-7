// =============================================================
// AIController.js — Crea y actualiza a todos los enemigos.
//
// - Al empezar la noche fija el nivel de IA de cada uno.
// - Cada hora aplica las subidas de nivel de la noche (nights.js).
// - Cada fotograma actualiza a todos (temporizadores y tiradas).
// =============================================================

import { CONFIG } from '../config.js';
import { Specimen } from './enemies/Specimen.js';
import { Stalker } from './enemies/Stalker.js';
import { Frozen } from './enemies/Frozen.js';

export class AIController {
  constructor(world) {
    this.world = world;
    this.enemies = [];
  }

  setup(nightCfg) {
    this.night = nightCfg;
    this.specimen = new Specimen({ level: nightCfg.ai.specimen ?? 0 });
    this.alto = new Stalker({
      id: 'alto', name: 'El Alto', level: nightCfg.ai.alto ?? 0,
      interval: CONFIG.INTERVALS.alto, ...CONFIG.ALTO,
    });
    this.rastrero = new Stalker({
      id: 'rastrero', name: 'El Rastrero', level: nightCfg.ai.rastrero ?? 0,
      interval: CONFIG.INTERVALS.rastrero, ...CONFIG.RASTRERO,
    });
    this.frozen = new Frozen(nightCfg.cryo);
    this.enemies = [this.specimen, this.alto, this.rastrero, this.frozen];
    // Una criatura con IA 0 esa noche no aparece en las cámaras.
    for (const e of [this.alto, this.rastrero]) e.visible = e.level > 0;
  }

  /** Subidas de IA programadas para la hora `hour`. */
  onHour(hour) {
    const bumps = this.night?.hourly?.[hour];
    if (!bumps) return;
    for (const [id, amount] of Object.entries(bumps)) {
      const e = this[id];
      if (e && e.level > 0) e.setLevel(e.level + amount); // nivel 0 = desactivado esa noche
    }
  }

  update(dt) {
    for (const e of this.enemies) e.update(dt, this.world);
  }

  /** Enemigos que andan por el mapa (para dibujarlos en las cámaras). */
  get roamers() {
    return [this.specimen, this.alto, this.rastrero, this.frozen].filter((e) => e.room && e.visible !== false);
  }

  /** Enemigos esperando en una compuerta ('left' / 'right'). */
  atDoor(side) {
    return this.roamers.filter((e) => e.atDoor === side);
  }
}
