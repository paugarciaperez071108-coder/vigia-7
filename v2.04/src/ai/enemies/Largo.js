// =============================================================
// Largo.js — El Largo (salas de la nave, desde las 2:00 AM).
//
// Estados:
//   'inactive' → todavía no son las START_HOUR (2 AM).
//   'room'     → en una SALA (nunca en un pasillo). En cada
//                oportunidad ganada golpea la entrada del conducto de
//                esa sala (breakStage +1); a veces, en vez de eso, se
//                va solo a una sala adyacente (WANDER_CHANCE). Con
//                BREAK_STAGES golpes, la entrada cede.
//   'hidden'   → se ha ido tras oír los golpes metálicos: no está en
//                ninguna cámara. A los HIDE_MIN-HIDE_MAX s vuelve a
//                atacar desde una sala al azar (distinta de la que dejó)
//                y empieza de cero con su entrada.
//   'crawling' → se ha metido en los conductos: se le oye acercarse
//                (cada vez más grave) durante CRAWL_TIME s y te mata.
//                No hay forma de pararlo.
//
// Cómo se le evita (lure): golpes metálicos en una sala ADYACENTE a
// la suya (ROOM_ADJACENCY en StationMap.js). Desaparece AL INSTANTE
// de la cámara donde golpeaba, sin transición, y no aparece en la del
// sonido. Si los golpes suenan en su misma sala, en una sala lejana o
// en un pasillo, no le afectan y sigue golpeando.
// =============================================================

import { Enemy } from '../Enemy.js';
import { NIGHT2 } from '../../night/night2.js';
import { ROOM_ADJACENCY, ROOM_VENT, isRoom } from '../../world/StationMap.js';

const CFG = NIGHT2.LARGO;

export class Largo extends Enemy {
  constructor({ level }) {
    super({ id: 'largo', name: 'El Largo', level, interval: CFG.INTERVAL });
    this.state = 'inactive';
    this.room = null;
    this.breakStage = 0;
    this.hiddenIn = 0;        // segundos hasta volver a atacar (estado 'hidden')
    this.leftRoom = null;     // sala que dejó al irse (no vuelve a la misma)
    this.crawlLeft = 0;
  }

  /** Empieza un ataque en una sala al azar (al activarse o al volver). */
  activate(world) {
    const rooms = Object.keys(ROOM_ADJACENCY).filter((r) => r !== this.leftRoom);
    this.room = null;
    this.moveTo(rooms[world.rng.int(0, rooms.length - 1)], world);
    this.state = 'room';
    world.events.emit('largoActive', { room: this.room });
  }

  moveTo(room, world) {
    const from = this.room;
    this.room = room;
    this.breakStage = 0;
    world.events.emit('enemyMove', { enemy: this, from, to: room });
    world.cameras.glitchIfWatching([from, room], 0.8);
  }

  /**
   * Golpes metálicos en `roomId`. Devuelve true si le atraen
   * (solo se usa para depuración: el jugador lo ve en las cámaras).
   */
  hearLure(roomId, world) {
    if (this.state !== 'room') return false;
    if (!isRoom(roomId) || roomId === this.room) return false;
    if (!ROOM_ADJACENCY[this.room]?.includes(roomId)) return false;
    // Desaparece al instante de todas las cámaras (sin estática ni sonido)
    this.leftRoom = this.room;
    this.room = null;
    this.breakStage = 0;
    this.state = 'hidden';
    this.hiddenIn = world.rng.range(CFG.HIDE_MIN, CFG.HIDE_MAX);
    world.events.emit('largoHidden', { from: this.leftRoom });
    return true;
  }

  onOpportunity(world) {
    if (this.state !== 'room') return;
    if (world.rng.next() < CFG.WANDER_CHANCE) {
      const adj = ROOM_ADJACENCY[this.room];
      this.moveTo(adj[world.rng.int(0, adj.length - 1)], world);
      return;
    }
    this.hit(world);
  }

  /** Un golpe a la entrada del conducto de su sala. */
  hit(world) {
    this.breakStage++;
    world.events.emit('ductBreak', { room: this.room, stage: this.breakStage });
    world.cameras.glitchIfWatching([this.room], 0.5);
    if (this.breakStage >= CFG.BREAK_STAGES) this._enterVents(world);
  }

  _enterVents(world) {
    const from = this.room;
    this.state = 'crawling';
    this.vent = ROOM_VENT[from];
    this.room = null;
    this.crawlLeft = CFG.CRAWL_TIME;
    world.cameras.glitchIfWatching([from], 1.2);
    world.events.emit('largoInVents', { from, duration: CFG.CRAWL_TIME });
  }

  tick(dt, world) {
    if (this.state === 'inactive') {
      if (this.level > 0 && world.clock.hour >= CFG.START_HOUR) this.activate(world);
      return;
    }
    if (this.state === 'hidden') {
      this.hiddenIn -= dt;
      if (this.hiddenIn <= 0) this.activate(world);
      return;
    }
    if (this.state === 'crawling') {
      this.crawlLeft -= dt;
      if (this.crawlLeft <= 0) world.attack(this);
    }
  }
}
