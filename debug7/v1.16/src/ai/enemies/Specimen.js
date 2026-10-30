// =============================================================
// Specimen.js — El Espécimen (CAM 02, Laboratorio).
//
// Fase 1 — EL MURO: cada oportunidad ganada añade una grieta al
//   muro del laboratorio. Con WALL_STAGES grietas, el muro cede y
//   El Espécimen sale.
//
// Fase 2 — LA RUTA: al ponerse en marcha elige al azar una de las
//   dos rutas de config.js y avanza una sala por oportunidad:
//     A: CAM 04 → CAM 06 → CAM 03 → CAM 07 → compuerta IZQUIERDA
//     B: CAM 04 → CAM 09 → CAM 01 → CAM 10 → CAM 08 → compuerta DERECHA
//
// Fase 3 — LA COMPUERTA (lógica común en DoorEnemy): espera unos
//   segundos y, si la compuerta está cerrada, vuelve al laboratorio y
//   elige ruta otra vez. Si está abierta, ataca.
// =============================================================

import { CONFIG } from '../../config.js';
import { DoorEnemy } from '../Enemy.js';

export class Specimen extends DoorEnemy {
  constructor({ level }) {
    super({ id: 'specimen', name: 'El Espécimen', level, interval: CONFIG.INTERVALS.specimen, start: 'lab' });
    this.room = null;        // null = todavía dentro del muro
    this.wallStage = 0;
    this.route = null;
    this.routeIndex = 0;
  }

  get emerged() {
    return this.room !== null;
  }

  onOpportunity(world) {
    if (!this.emerged) {
      this.wallStage++;
      world.events.emit('wallCrack', { stage: this.wallStage });
      world.cameras.glitchIfWatching(['lab'], 0.5);
      if (this.wallStage >= CONFIG.WALL_STAGES) {
        this.room = 'lab';
        world.events.emit('specimenEmerged', { enemy: this });
        world.cameras.glitchIfWatching(['lab'], 1.2);
      }
      return;
    }
    super.onOpportunity(world);
  }

  step(world) {
    if (!this.route) {
      this.routeName = world.rng.next() < 0.5 ? 'A' : 'B';
      this.route = CONFIG.SPECIMEN_ROUTES[this.routeName];
      this.routeIndex = 0;
    }
    this.moveTo(this.route[this.routeIndex++], world);
  }

  retreat(world) {
    this.route = null;
    this.moveTo('lab', world);
  }
}
