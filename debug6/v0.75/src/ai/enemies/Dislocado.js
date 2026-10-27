// =============================================================
// Dislocado.js — EL DISLOCADO (noche 5, desde las 2 AM; NIGHT5.DISLOCADO).
//
// Un técnico de mantenimiento partido por la mitad que se arrastra con
// los brazos por los conductos. Estados:
//   'off'   → antes de las 2 AM (no existe todavía).
//   'event' → golpeando las rejillas de la oficina (eventos de las 2 y las
//             4 AM; los lleva Night5.js).
//   'away'  → fuera de la red de conductos (tras alumbrarlo). Vuelve a los
//             RETURN s por uno de SPAWN_VENTS.
//   'vent'  → en una sección de conducto (room = 'v1'...'v7'; se le ve en
//             las cámaras de ventilación). Avanza hacia las rejillas ROTAS
//             (izquierda = V7, lateral sur; derecha = V6, lateral norte).
//   'grille'→ en V6/V7, a punto de asomarse (peekIn s).
//   'peek'  → asomado por la rejilla rota (side). Hay que alumbrarlo
//             (ratón encima de la rejilla) LIGHT_TIME s; si pasan
//             ATTACK_TIME s, ataca. Igual con luz que en el apagón (v0.47).
// world.n5: { grilles: {left: {broken}, right: {broken}}, lit(side) }.
// =============================================================

import { Enemy } from '../Enemy.js';
import { NIGHT5 } from '../../night/night5.js';
import { VENTS, VENT_DIST, ventNeighbors } from '../../world/StationMap.js';

const D = NIGHT5.DISLOCADO;
export const GRILLE_VENT = { left: 'v7', right: 'v6' };
const VENT_SIDE = { v7: 'left', v6: 'right' };

export class Dislocado extends Enemy {
  constructor({ level }) {
    super({ id: 'dislocado', name: 'El Dislocado', level, interval: D.INTERVAL });
    this.state = 'off';
    this.room = null;
    this.side = null;
    this.returnIn = 0;
    this.peekIn = 0;
    this.attackT = 0;
    this.lit = 0;
    this.noiseIn = 1;
  }

  /** Lados por los que puede entrar (rejillas rotas). */
  _open(world) {
    const g = world.n5?.grilles;
    return ['left', 'right'].filter((s) => g?.[s]?.broken);
  }

  /** Aparece en los conductos (tras el evento de las 2 AM o al volver). */
  appear(world, room = null) {
    this.state = 'vent';
    this.room = room ?? D.SPAWN_VENTS[world.rng.int(0, D.SPAWN_VENTS.length - 1)];
    this.side = null;
    this.lit = 0;
    world.cameras.glitchIfWatching([this.room], 0.6);
    world.events.emit('dislocadoMove', { to: this.room, dist: VENT_DIST[this.room] });
  }

  /** Se asoma ya por la rejilla `side` (al romperla, o en el modo debug). */
  peek(world, side) {
    this.state = 'peek';
    this.side = side;
    this.room = GRILLE_VENT[side];
    this.attackT = 0;
    this.lit = 0;
    world.events.emit('dislocadoPeek', { side });
  }

  _retreat(world) {
    const side = this.side;
    this.state = 'away';
    this.room = null;
    this.side = null;
    this.lit = 0;
    this.returnIn = world.rng.range(D.RETURN[0], D.RETURN[1]);
    world.events.emit('dislocadoRetreat', { side });
  }

  onOpportunity(world) {
    if (this.state !== 'vent') return;
    const open = this._open(world);
    if (!open.length) return;
    const targets = open.map((s) => GRILLE_VENT[s]);
    let options = ventNeighbors(this.room).filter((n) => n !== 'office');
    // V6/V7 solo si su rejilla está rota
    options = options.filter((n) => !VENTS[n]?.officeAccess || targets.includes(n));
    const entries = options.filter((n) => targets.includes(n));
    if (entries.length) options = entries;
    if (!options.length) return;
    let next;
    if (world.rng.next() < D.FORWARD_BIAS) {
      const best = Math.min(...options.map((n) => VENT_DIST[n]));
      const closest = options.filter((n) => VENT_DIST[n] === best);
      next = closest[world.rng.int(0, closest.length - 1)];
    } else next = options[world.rng.int(0, options.length - 1)];
    const from = this.room;
    this.room = next;
    world.cameras.glitchIfWatching([from, next], 0.6);
    world.events.emit('dislocadoMove', { from, to: next, dist: VENT_DIST[next] });
    if (VENT_SIDE[next]) {
      this.state = 'grille';
      this.side = VENT_SIDE[next];
      this.peekIn = world.rng.range(D.PEEK_DELAY[0], D.PEEK_DELAY[1]);
    }
  }

  tick(dt, world) {
    if (this.level <= 0 || this.state === 'off' || this.state === 'event') return;
    if (this.state === 'away') {
      this.returnIn -= dt;
      if (this.returnIn <= 0) this.appear(world);
      return;
    }
    if (this.state === 'vent' || this.state === 'grille') {
      this.noiseIn -= dt;
      if (this.noiseIn <= 0) {
        this.noiseIn = world.rng.range(D.NOISE_EVERY[0], D.NOISE_EVERY[1]);
        world.events.emit('dislocadoNoise', { dist: VENT_DIST[this.room] ?? 3, side: this.side });
      }
    }
    if (this.state === 'grille') {
      this.peekIn -= dt;
      if (this.peekIn <= 0) this.peek(world, this.side);
      return;
    }
    if (this.state === 'peek') {
      // (el apagón no cambia nada: las rejillas se alumbran igual con el ratón, v0.47)
      if (world.n5?.lit(this.side)) {
        this.lit += dt;
        if (this.lit >= D.LIGHT_TIME) return this._retreat(world);
      } else this.lit = Math.max(0, this.lit - D.LIGHT_DECAY * dt);
      this.attackT += dt;
      if (this.attackT >= D.ATTACK_TIME && !world.n5?.lit(this.side)) world.attack(this);
    }
  }
}
