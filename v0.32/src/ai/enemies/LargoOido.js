// =============================================================
// LargoOido.js — El Largo «por el oído» (noche 3 en adelante).
//
// No ve bien: se guía por el sonido. Recorre el plano de la estación
// (salas y corredores) y el PASILLO CENTRAL que llega a la pared de
// atrás de la oficina (StationMap.js: LARGO_LINKS, LARGO_DIST).
//
// Lo que hace según dónde está (valores en NIGHT3.LARGO):
//   - Lejos de la oficina (4 salas o más): DEAMBULA. En cada oportunidad
//     ganada (tirada 1-20 <= IA cada INTERVAL s) va a una sala vecina,
//     normalmente hacia la oficina (FORWARD_BIAS).
//   - A 3, 2 o 1 salas: FASES lejos / medio / cerca. Espera su tiempo de
//     reacción (PHASE_TIME: 5 / 3,5 / 2 s) y, si nadie lo aleja, avanza
//     una sala hacia la oficina.
//   - Desde un corredor llega a una COMPUERTA: espera DOOR_WAIT s; si está
//     cerrada se va lejos (RETREAT_TO), si está abierta ataca.
//   - Desde el último tramo del pasillo central ataca directamente.
//
// Audio (botón de la cámara): si suena a LURE_RANGE salas o menos de él,
// camina hacia allí (una sala cada STEP_TIME s) y su tiempo vuelve a
// empezar al llegar. En su misma sala no le hace nada.
//
// Inicio de la noche 3 (startCorridor): empieza al fondo del pasillo
// central y se acerca tramo a tramo con tiempos generosos (NIGHT3.INTRO).
// Con el primer audio se va al Comedor y se queda un rato escuchando.
//
// Para las cámaras: `room` es su sala (o 'central1-3' / 'left_door' /
// 'right_door'), `phase` su fase y `camPose` la pose de cámara que le
// toca (lejos / media / cerca). `state` es 'room' mientras está en la
// estación (lo usan los sonidos de ambiente).
// =============================================================

import { Enemy, DOOR_SIDE } from '../Enemy.js';
import { NIGHT3 } from '../../night/night3.js';
import { LARGO_DIST, largoNeighbors, largoPath, isCentral } from '../../world/StationMap.js';

const CFG = NIGHT3.LARGO;
const PHASES = { 1: 'cerca', 2: 'medio', 3: 'lejos' };
const CAM_POSE = { lejos: 'lejos', medio: 'media', cerca: 'cerca' };

export class LargoOido extends Enemy {
  constructor({ level }) {
    super({ id: 'largo', name: 'El Largo', level, interval: CFG.INTERVAL });
    this.mode = 'oido';
    this.state = 'inactive';
    this.room = null;
    this.timer2 = 0;           // s que le quedan en la fase actual (o en la compuerta)
    this.path = null;          // camino hacia un sonido
    this.stepIn = 0;
    this.calm = 0;             // s escuchando (sin avanzar) tras el primer audio de la noche
    this.intro = false;        // inicio de la noche 3 en el pasillo central
    this.reactionMult = 1;     // evento de las 3 AM: menos tiempo de reacción
    this.breakStage = 0;       // (la usa la cámara para la rejilla del conducto: aquí siempre 0)
    this.lureCooldown = CFG.LURE_COOLDOWN;
  }

  get dist() {
    return LARGO_DIST[this.room] ?? 99;
  }

  /** 'lejos' | 'medio' | 'cerca' | null (deambulando o en una compuerta). */
  get phase() {
    if (!this.room || this.atDoor) return null;
    return PHASES[this.dist] ?? null;
  }

  /** Pose de cámara que le toca (CamPoses.js); null = la que salga. */
  get camPose() {
    if (this.path) return 'media';
    return CAM_POSE[this.phase] ?? null;
  }

  get atDoor() {
    return DOOR_SIDE[this.room] ?? null;
  }

  get inCorridor() {
    return isCentral(this.room);
  }

  /** Arranca en `room` (al empezar la noche si no hay inicio en el pasillo). */
  activate(world, room = CFG.START) {
    this.state = 'room';
    this._arrive(room, world);
  }

  /** Inicio de la noche 3: al fondo del pasillo central. */
  startCorridor(world) {
    this.intro = true;
    this.state = 'room';
    this._arrive(NIGHT3.INTRO.START, world);
  }

  _phaseTime() {
    if (this.intro && this.inCorridor) return NIGHT3.INTRO.SECTION_TIME;
    return (CFG.PHASE_TIME[this.phase] ?? 0) * this.reactionMult;
  }

  /** Llega a una sala: emite el movimiento y empieza su espera. */
  _arrive(room, world) {
    const from = this.room;
    this.room = room;
    world.events.emit('enemyMove', { enemy: this, from, to: room });
    world.cameras.glitchIfWatching([from, room], 0.8);
    if (this.atDoor) {
      const [a, b] = CFG.DOOR_WAIT;
      this.timer2 = world.rng.range(a, b) * this.reactionMult;
      world.events.emit('enemyAtDoor', { enemy: this, side: this.atDoor });
    } else {
      this.timer2 = this._phaseTime();
    }
  }

  /** Un audio en `roomId` (cámara que se está viendo). Devuelve true si va hacia allí. */
  hearLure(roomId, world) {
    if (this.state !== 'room' || !this.room || roomId === this.room) return false;
    const path = largoPath(this.room, roomId);
    if (!path || !path.length || path.length > CFG.LURE_RANGE) return false;
    this.path = path;
    this.stepIn = CFG.STEP_TIME * 0.5;   // se pone en marcha enseguida
    if (this.intro) {
      // Primer audio de la noche: se va al Comedor y se queda escuchando
      this.intro = false;
      this.calm = NIGHT3.INTRO.CALM_TIME;
    }
    world.events.emit('largoHeard', { from: this.room, to: roomId });
    return true;
  }

  onOpportunity(world) {
    // Solo decide por su cuenta cuando deambula (lejos de la oficina)
    if (this.state !== 'room' || this.path || this.phase || this.atDoor || this.calm > 0) return;
    const options = largoNeighbors(this.room).filter((n) => n !== 'office' && !DOOR_SIDE[n]);
    if (!options.length) return;
    let next;
    if (world.rng.next() < CFG.FORWARD_BIAS) {
      const best = Math.min(...options.map((n) => LARGO_DIST[n]));
      const closest = options.filter((n) => LARGO_DIST[n] === best);
      next = closest[world.rng.int(0, closest.length - 1)];
    } else {
      next = options[world.rng.int(0, options.length - 1)];
    }
    this._arrive(next, world);
  }

  /** Avanza una sala hacia la oficina (se acabó su tiempo de reacción). */
  _advance(world) {
    if (this.dist <= 1) {
      // Siguiente paso: la oficina. Por un corredor, a su compuerta; por el
      // pasillo central, directamente.
      const door = largoNeighbors(this.room).find((n) => DOOR_SIDE[n]);
      if (door) this._arrive(door, world);
      else world.attack(this);
      return;
    }
    const options = largoNeighbors(this.room).filter((n) => LARGO_DIST[n] === this.dist - 1 && n !== 'office');
    this._arrive(options[world.rng.int(0, options.length - 1)], world);
  }

  tick(dt, world) {
    if (this.state !== 'room') return;
    // Caminando hacia un sonido
    if (this.path) {
      this.stepIn -= dt;
      if (this.stepIn <= 0) {
        const next = this.path.shift();
        this.stepIn = CFG.STEP_TIME;
        if (!this.path.length) this.path = null;
        this._arrive(next, world);
      }
      return;
    }
    if (this.calm > 0) {
      this.calm -= dt;
      if (this.calm <= 0) this.timer2 = this._phaseTime();
      return;
    }
    // En una compuerta
    if (this.atDoor) {
      this.timer2 -= dt;
      if (this.timer2 > 0) return;
      const side = this.atDoor;
      if (world.office.doors[side].closed) {
        world.events.emit('doorBlocked', { enemy: this, side });
        const r = CFG.RETREAT_TO;
        this._arrive(r[world.rng.int(0, r.length - 1)], world);
      } else {
        world.attack(this);
      }
      return;
    }
    // En una fase (a 3 salas o menos): cuenta atrás y avanza
    if (this.phase) {
      this.timer2 -= dt;
      if (this.timer2 <= 0) this._advance(world);
    }
  }

  /** (Noche 2: golpear la rejilla del conducto. Aquí no lo hace.) */
  hit() {}
}
