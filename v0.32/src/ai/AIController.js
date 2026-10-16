// =============================================================
// AIController.js — Crea y actualiza a todos los enemigos.
//
// - Al empezar la noche fija el nivel de IA de cada uno.
// - Cada hora aplica las subidas de nivel de la noche (nights.js).
// - Cada fotograma actualiza a todos (temporizadores y tiradas).
// =============================================================

import { Specimen } from './enemies/Specimen.js';
import { Frozen } from './enemies/Frozen.js';
import { Insect } from './enemies/Insect.js';
import { Largo } from './enemies/Largo.js';
import { LargoOido } from './enemies/LargoOido.js';

export class AIController {
  constructor(world) {
    this.world = world;
    this.enemies = [];
  }

  setup(nightCfg) {
    this.night = nightCfg;
    this.specimen = new Specimen({ level: nightCfg.ai.specimen ?? 0 });
    if (nightCfg.doorWait) this.specimen.doorWait = nightCfg.doorWait;
    this.frozen = new Frozen(nightCfg.cryo);
    // El Insecto y El Largo: noche 2 en adelante (IA 0 = no aparecen)
    this.insecto = new Insect({ level: nightCfg.ai.insecto ?? 0 });
    // El Largo: en la noche 2 golpea los conductos (Largo.js, solo en la 2.5);
    // desde la noche 3 va «por el oído» (LargoOido.js, largoMode: 'oido')
    const LargoClass = nightCfg.largoMode === 'oido' ? LargoOido : Largo;
    this.largo = new LargoClass({ level: nightCfg.ai.largo ?? 0 });
    this.enemies = [this.specimen, this.frozen, this.insecto, this.largo];
  }

  /**
   * Evento de las 3 AM de la noche 3: todos más agresivos. Las
   * oportunidades llegan antes (intervalMult) y hay menos tiempo para
   * reaccionar (reactionMult: fases de El Largo, compuertas, conductos).
   */
  setAggro(intervalMult, reactionMult) {
    for (const e of this.enemies) {
      e.interval *= intervalMult;
      e.timer = Math.min(e.timer, e.interval);
    }
    this.largo.reactionMult = reactionMult;
    this.insecto.enterMult = reactionMult;
    if (this.specimen.doorWait) this.specimen.doorWait = this.specimen.doorWait.map((t) => t * reactionMult);
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

  /**
   * Enemigos visibles en las cámaras: los de las salas y El Insecto
   * (su `room` es una sección de conducto, 'v1'...'v7').
   */
  get roamers() {
    return this.enemies.filter((e) => e.room);
  }

  /** Enemigos esperando en una compuerta ('left' / 'right'). */
  atDoor(side) {
    return this.roamers.filter((e) => e.atDoor === side);
  }
}
