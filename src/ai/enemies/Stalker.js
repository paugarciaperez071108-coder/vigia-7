// =============================================================
// Stalker.js — Criaturas que vagan por la estación hacia una
// compuerta concreta (El Alto y El Rastrero, nombres provisionales).
//
// En cada oportunidad ganada se mueven a una sala vecina:
//   - con probabilidad STALKER_FORWARD_BIAS, a la vecina que más las
//     acerca a su compuerta (distancia calculada con BFS);
//   - el resto de veces, a una vecina al azar (pueden retroceder).
// Así no son predecibles, pero acaban llegando.
//
// useVents = true → pueden usar los conductos ocultos del mapa.
// =============================================================

import { CONFIG } from '../../config.js';
import { DoorEnemy, DOOR_SIDE } from '../Enemy.js';
import { neighbors } from '../../world/StationMap.js';

/** Distancia (en saltos) de cada sala a `goal`, por búsqueda en anchura. */
function distancesTo(goal, useVents) {
  const dist = { [goal]: 0 };
  const queue = [goal];
  while (queue.length) {
    const cur = queue.shift();
    for (const n of neighbors(cur, useVents)) {
      if (!(n in dist)) {
        dist[n] = dist[cur] + 1;
        queue.push(n);
      }
    }
  }
  return dist;
}

export class Stalker extends DoorEnemy {
  constructor({ id, name, level, interval, start, door, useVents }) {
    super({ id, name, level, interval, start });
    this.door = door;
    this.useVents = useVents;
    this.dist = distancesTo(door, useVents);
  }

  step(world) {
    // Salas posibles: vecinas, sin contar la compuerta que no es la suya.
    const options = neighbors(this.room, this.useVents)
      .filter((n) => !(n in DOOR_SIDE) || n === this.door);
    if (!options.length) return;

    let next;
    if (world.rng.next() < CONFIG.STALKER_FORWARD_BIAS) {
      next = options.reduce((best, n) => (this.dist[n] < this.dist[best] ? n : best));
    } else {
      next = options[world.rng.int(0, options.length - 1)];
    }
    this.moveTo(next, world);
  }
}
