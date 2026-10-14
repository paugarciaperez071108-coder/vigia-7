// =============================================================
// Enemy.js — Clases base de los enemigos.
//
// ── Oportunidades de movimiento ──────────────────────────────
// Cada enemigo tiene un temporizador propio (`interval`). Cada vez
// que llega a 0 tiene una "oportunidad": se tira un número del 1 al
// 20 y, si sale MENOR O IGUAL que su nivel de IA, actúa
// (onOpportunity). Por tanto:
//     nivel 0  → nunca actúa
//     nivel 5  → 25 % de probabilidad en cada oportunidad
//     nivel 20 → actúa siempre
// Con un intervalo de 5 s y nivel 3, actúa de media cada ~33 s.
//
// ── DoorEnemy: enemigos que atacan por una compuerta ─────────
// Se mueven de sala en sala. Al llegar a un nodo de puerta
// ('left_door' / 'right_door') esperan un tiempo aleatorio y luego
// intentan entrar:
//     compuerta cerrada → golpe, se retiran a su sala de inicio
//     compuerta abierta → ataque (game over)
// =============================================================

import { CONFIG } from '../config.js';

export class Enemy {
  constructor({ id, name, level = 0, interval = 5 }) {
    this.id = id;
    this.name = name;
    this.level = level;
    this.interval = interval;
    this.timer = interval;
  }

  setLevel(level) {
    this.level = Math.max(0, Math.min(20, level));
  }

  update(dt, world) {
    this.timer -= dt;
    while (this.timer <= 0) {
      this.timer += this.interval;
      // Tirada de la oportunidad de movimiento
      if (this.level > 0 && world.rng.int(1, 20) <= this.level) {
        this.onOpportunity(world);
      }
    }
    this.tick(dt, world);
  }

  /** Qué hace el enemigo cuando gana una oportunidad. */
  onOpportunity(world) {}

  /** Lógica continua (temporizadores propios), cada fotograma. */
  tick(dt, world) {}
}

export const DOOR_SIDE = { left_door: 'left', right_door: 'right' };

export class DoorEnemy extends Enemy {
  constructor(opts) {
    super(opts);
    this.room = opts.start;     // sala actual (id de StationMap o nodo de puerta)
    this.home = opts.start;     // a dónde vuelve al ser bloqueado
    this.doorTimer = 0;
  }

  /** Lado de la compuerta en la que está ('left'/'right') o null. */
  get atDoor() {
    return DOOR_SIDE[this.room] ?? null;
  }

  /** Mueve el enemigo y avisa (sonido, estática en la cámara...). */
  moveTo(room, world) {
    const from = this.room;
    this.room = room;
    world.events.emit('enemyMove', { enemy: this, from, to: room });
    // Si estás mirando la sala de la que sale o a la que entra, la
    // imagen se llena de estática: sabes que algo se ha movido.
    world.cameras.glitchIfWatching([from, room], CONFIG.CAMERA_MOVE_GLITCH);
    if (this.atDoor) {
      this.doorTimer = world.rng.range(CONFIG.DOOR_WAIT_MIN, CONFIG.DOOR_WAIT_MAX);
      world.events.emit('enemyAtDoor', { enemy: this, side: this.atDoor });
    }
  }

  tick(dt, world) {
    if (!this.atDoor) return;
    // Esperando junto a la compuerta: cuando acaba la espera, intenta entrar.
    this.doorTimer -= dt;
    if (this.doorTimer > 0) return;
    const side = this.atDoor;
    if (world.office.doors[side].closed) {
      world.events.emit('doorBlocked', { enemy: this, side });
      this.retreat(world);
    } else {
      world.attack(this);
    }
  }

  /** Tras ser bloqueado, vuelve a su sala de inicio. */
  retreat(world) {
    this.moveTo(this.home, world);
  }

  /** Mientras espera en la puerta, no "pierde el tiempo" moviéndose. */
  onOpportunity(world) {
    if (!this.atDoor) this.step(world);
  }

  /** Avanza una sala. Lo implementa cada enemigo. */
  step(world) {}
}
