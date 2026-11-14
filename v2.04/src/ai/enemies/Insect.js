// =============================================================
// Insect.js — El Insecto (conductos de ventilación).
//
// Estados:
//   'away'  → fuera de la red de conductos. Al acabar su espera
//             (NIGHT2.INSECTO.RETURN_MIN/MAX) aparece en uno de los
//             conductos de SPAWN_VENTS (V2-V5).
//   'vent'  → dentro de un conducto (this.room = 'v1'...'v7'). En cada
//             oportunidad ganada avanza una sección por el grafo
//             VENT_LINKS, normalmente hacia la oficina. Para llegar a V6
//             o V7 (las únicas entradas a la oficina) pasa siempre por
//             V1, y desde V1 SOLO puede ir a V6 o V7 (nunca vuelve
//             atrás a V2/V3); elige al azar uno de los dos lados.
//             Al llegar a V6/V7 se queda quieto ENTER_TIME segundos
//             (enterIn) y, si nadie le suelta insecticida, entra en la
//             oficina: game over.
//
// Solo se puede ver en las cámaras de ventilación (desbloqueadas con
// get-update) y se ahuyenta soltando insecticida en V6/V7 mientras
// está ahí (repel). Mientras está dentro, se le oye arrastrarse por los
// conductos: más fuerte cuanto más cerca de la oficina.
//
// Al empezar la noche está fuera ('away'): Game fija returnIn con
// NIGHT2.INSECTO.FIRST_APPEAR (ya no hay ataque inicial).
// =============================================================

import { Enemy } from '../Enemy.js';
import { NIGHT2 } from '../../night/night2.js';
import { VENTS, VENT_DIST, ventNeighbors } from '../../world/StationMap.js';

const CFG = NIGHT2.INSECTO;

export class Insect extends Enemy {
  constructor({ level }) {
    super({ id: 'insecto', name: 'El Insecto', level, interval: CFG.INTERVAL });
    this.state = 'away';
    this.room = null;
    this.returnIn = Infinity;   // Game lo fija al empezar la noche (FIRST_APPEAR)
    this.enterIn = null;        // segundos para entrar en la oficina (en V6/V7)
    this.noiseIn = 1;
  }

  /** Insecticida en su sección: se aleja de la red de conductos. */
  repel(world) {
    const from = this.room;
    this.state = 'away';
    this.room = null;
    this.enterIn = null;
    this.returnIn = world.rng.range(CFG.RETURN_MIN, CFG.RETURN_MAX);
    world.events.emit('insectRepelled', { from });
  }

  /** Vuelve a uno de los conductos de aparición (V2-V5). */
  appear(world) {
    const options = CFG.SPAWN_VENTS;
    this.room = options[world.rng.int(0, options.length - 1)];
    this.state = 'vent';
    this.enterIn = null;
    this.noiseIn = 0.3;
    world.events.emit('insectAppear', { room: this.room });
    world.cameras.glitchIfWatching([this.room], 0.6);
  }

  /** Pasa a la sección `to` (y, si es V6/V7, empieza la cuenta para entrar). */
  moveTo(to, world) {
    const from = this.room;
    this.room = to;
    if (VENTS[to]?.officeAccess) {
      this.enterIn = CFG.ENTER_TIME * (this.enterMult ?? 1);
      world.events.emit('insectAtOffice', { room: to });
    }
    world.events.emit('insectMove', { from, to, dist: VENT_DIST[to] });
    world.cameras.glitchIfWatching([from, to], 0.6);
  }

  onOpportunity(world) {
    // En V6/V7 ya no se mueve: espera para entrar (ver tick)
    if (this.state !== 'vent' || this.enterIn !== null) return;
    let options = ventNeighbors(this.room).filter((n) => n !== 'office');
    // Desde V1 (junto a las entradas) solo puede seguir hacia V6 o V7
    const entries = options.filter((n) => VENTS[n]?.officeAccess);
    if (entries.length) options = entries;
    let next;
    if (world.rng.next() < CFG.FORWARD_BIAS) {
      // Hacia la oficina; si hay empate (en V1: V6 o V7), uno al azar
      const best = Math.min(...options.map((n) => VENT_DIST[n]));
      const closest = options.filter((n) => VENT_DIST[n] === best);
      next = closest[world.rng.int(0, closest.length - 1)];
    } else {
      next = options[world.rng.int(0, options.length - 1)];
    }
    this.moveTo(next, world);
  }

  tick(dt, world) {
    if (this.state === 'away') {
      if (this.level <= 0) return;
      this.returnIn -= dt;
      if (this.returnIn <= 0) this.appear(world);
      return;
    }
    if (this.enterIn !== null) {
      this.enterIn -= dt;
      if (this.enterIn <= 0) {
        world.attack(this);
        return;
      }
    }
    // Se le oye moverse por los conductos de vez en cuando
    this.noiseIn -= dt;
    if (this.noiseIn <= 0) {
      this.noiseIn = world.rng.range(CFG.NOISE_MIN, CFG.NOISE_MAX);
      world.events.emit('insectNoise', { dist: VENT_DIST[this.room] });
    }
  }
}
