// =============================================================
// Insect.js — El Insecto (conductos de ventilación).
//
// Estados:
//   'away'  → fuera de la red de conductos. Al acabar su espera
//             (NIGHT2.INSECTO.RETURN_MIN/MAX) aparece en un conducto
//             al azar (nunca en el de la oficina).
//   'vent'  → dentro de un conducto (this.room = 'v1'...'v5'). En cada
//             oportunidad ganada avanza una sección, normalmente hacia
//             la oficina. Si gana una oportunidad estando en V1, entra
//             en la oficina: game over.
//
// Solo se puede ver en las cámaras de ventilación (desbloqueadas con
// get-update) y se ahuyenta soltando insecticida en la sección donde
// está (repel). Mientras está dentro, se le oye arrastrarse por los
// conductos: más fuerte cuanto más cerca de la oficina.
//
// Al empezar la noche (introducción) espera quieto en un conducto al
// azar; Game controla el tiempo límite.
// =============================================================

import { Enemy } from '../Enemy.js';
import { NIGHT2 } from '../../night/night2.js';
import { VENT_IDS, VENT_DIST, ventNeighbors } from '../../world/StationMap.js';

const CFG = NIGHT2.INSECTO;

export class Insect extends Enemy {
  constructor({ level }) {
    super({ id: 'insecto', name: 'El Insecto', level, interval: CFG.INTERVAL });
    this.state = 'away';
    this.room = null;
    this.returnIn = Infinity;   // hasta que se ahuyente la primera vez no vuelve solo
    this.noiseIn = 1;
  }

  /** Introducción de la noche: aparece en un conducto cualquiera y espera. */
  placeIntro(world) {
    this.room = VENT_IDS[world.rng.int(0, VENT_IDS.length - 1)];
    this.state = 'vent';
    this.noiseIn = 0.5;
  }

  /** Insecticida en su sección: se aleja de la red de conductos. */
  repel(world) {
    const from = this.room;
    this.state = 'away';
    this.room = null;
    this.returnIn = world.rng.range(CFG.RETURN_MIN, CFG.RETURN_MAX);
    world.events.emit('insectRepelled', { from });
  }

  /** Vuelve a un conducto al azar (no el de la oficina). */
  appear(world) {
    const options = VENT_IDS.filter((v) => v !== 'v1');
    this.room = options[world.rng.int(0, options.length - 1)];
    this.state = 'vent';
    this.noiseIn = 0.3;
    world.events.emit('insectAppear', { room: this.room });
    world.cameras.glitchIfWatching([this.room], 0.6);
  }

  onOpportunity(world) {
    if (this.state !== 'vent') return;
    const options = ventNeighbors(this.room);
    let next;
    if (world.rng.next() < CFG.FORWARD_BIAS) {
      next = options.reduce((best, n) => (VENT_DIST[n] < VENT_DIST[best] ? n : best));
    } else {
      next = options[world.rng.int(0, options.length - 1)];
    }
    if (next === 'office') {
      world.attack(this);
      return;
    }
    const from = this.room;
    this.room = next;
    world.events.emit('insectMove', { from, to: next, dist: VENT_DIST[next] });
    world.cameras.glitchIfWatching([from, next], 0.6);
  }

  tick(dt, world) {
    if (this.state === 'away') {
      if (this.level <= 0) return;
      this.returnIn -= dt;
      if (this.returnIn <= 0) this.appear(world);
      return;
    }
    // Se le oye moverse por los conductos de vez en cuando
    this.noiseIn -= dt;
    if (this.noiseIn <= 0) {
      this.noiseIn = world.rng.range(CFG.NOISE_MIN, CFG.NOISE_MAX);
      world.events.emit('insectNoise', { dist: VENT_DIST[this.room] });
    }
  }
}
