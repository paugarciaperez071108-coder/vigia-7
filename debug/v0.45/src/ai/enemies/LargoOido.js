// =============================================================
// LargoOido.js — El Largo «por el oído» (noche 3 en adelante).
//
// No ve bien: se guía por el sonido. Recorre el plano de la estación
// (salas y corredores) y el PASILLO CENTRAL que llega a la pared de
// atrás de la oficina (StationMap.js: LARGO_LINKS, LARGO_GOAL_DIST).
// Valores en NIGHT3.LARGO y NIGHT3.CORRIDOR (night3.js).
//
// OBJETIVO: cada vez que aparece, se retira o acaba de ir hacia un sonido,
// elige si va hacia el pasillo central (CORRIDOR_BIAS, 75 %) o hacia las
// compuertas laterales (25 %). Según lo que le falte para llegar:
//   - Lejos: DEAMBULA. En cada oportunidad ganada (tirada 1-20 <= IA cada
//     INTERVAL s) va a una sala vecina, normalmente hacia su objetivo. A
//     veces se esconde en la rejilla del conducto de la sala (VENT_HIDE_CHANCE):
//     en la cámara solo se le ven los ojos, los dedos o parte de la silueta.
//   - Cerca: FASES lejos / medio / cerca (PHASE_TIME: 5 / 3,5 / 2 s). Si
//     nadie lo aleja, avanza una sala hacia su objetivo.
//       compuertas: lejos = Hangar/Comedor, medio = Comunicaciones/
//                   Invernadero, cerca = corredores. Desde un corredor llega
//                   a la compuerta: cerrada → se va lejos; abierta → ataca.
//       pasillo:    lejos = Reactor/Invernadero, medio = Comedor. Del
//                   Comedor entra en el pasillo central.
//   - En el PASILLO CENTRAL: 6 posiciones (cpos 0..5), cada una con su pose.
//     Avanza cada CORRIDOR.FAIL_EVERY[cpos] s. Si se le está alumbrando
//     (lit), el avance llega con un fallo de la linterna (evento
//     'largoCorridorFail'): se corta la luz y, a mitad del corte, cambia de
//     sitio. Pasada la posición 5, ataca.
//
// Audio (botón de la cámara o del minimapa): si suena a LURE_RANGE salas o
// menos de él, camina hacia allí (una sala cada STEP_TIME s) y su tiempo
// vuelve a empezar al llegar. En su misma sala no le hace nada.
//
// Inicio de la noche 3 (startCorridor): empieza al fondo del pasillo, con
// los tiempos ×INTRO.SLOW. Con el primer audio se va al Comedor y se queda
// un rato escuchando.
//
// Para las cámaras: `room` es su sala ('central1-3' en el pasillo,
// 'left_door' / 'right_door' en una compuerta), `cpos` su posición en el
// pasillo, `phase` su fase, `ventHidden` si está tras la rejilla y
// `camPose` el grupo de poses de cámara que le toca (CamPoses.js).
// =============================================================

import { Enemy, DOOR_SIDE } from '../Enemy.js';
import { NIGHT3 } from '../../night/night3.js';
import { LARGO_GOAL_DIST, largoNeighbors, largoPath, isCentral, ROOM_VENT } from '../../world/StationMap.js';

const CFG = NIGHT3.LARGO;
const COR = NIGHT3.CORRIDOR;
const PHASES = {
  puertas: { 1: 'cerca', 2: 'medio', 3: 'lejos' },
  pasillo: { 1: 'medio', 2: 'lejos' },
};
const CAM_POSE = { lejos: 'lejos', medio: 'media', cerca: 'cerca' };
const sectionOf = (cpos) => `central${Math.min(3, Math.floor(cpos / 2) + 1)}`;

export class LargoOido extends Enemy {
  constructor({ level }) {
    super({ id: 'largo', name: 'El Largo', level, interval: CFG.INTERVAL });
    this.mode = 'oido';
    this.state = 'inactive';
    this.room = null;
    this.goal = 'pasillo';
    this.cpos = 0;             // posición dentro del pasillo central (0..POSITIONS-1)
    this.timer2 = 0;           // s que le quedan en la fase actual (o en la compuerta / posición)
    this.path = null;          // camino hacia un sonido
    this.stepIn = 0;
    this.calm = 0;             // s escuchando (sin avanzar) tras el primer audio de la noche
    this.intro = false;        // inicio de la noche 3 en el pasillo central
    this.lit = false;          // ¿le está alumbrando la linterna? (lo pone Game cada fotograma)
    this.failMove = null;      // s hasta cambiar de sitio durante un fallo de la linterna
    this.flickersLeft = 0;     // parpadeos de aviso que quedan en esta posición
    this.ventHidden = false;   // escondido tras la rejilla de su sala
    this.reactionMult = 1;     // evento de las 3 AM: menos tiempo de reacción
    this.breakStage = 0;       // (la cámara la usa para la rejilla del conducto: aquí siempre 0)
    this.lureCooldown = CFG.LURE_COOLDOWN;
  }

  /** Lo que le falta para llegar, según su objetivo (99 = no está en ese camino). */
  get dist() {
    if (!this.room) return 99;
    if (this.inCorridor) return 0;
    return LARGO_GOAL_DIST[this.goal][this.room] ?? 99;
  }

  /** 'lejos' | 'medio' | 'cerca' | null (deambulando, en el pasillo o en una compuerta). */
  get phase() {
    if (!this.room || this.atDoor || this.inCorridor) return null;
    return PHASES[this.goal][this.dist] ?? null;
  }

  /** Grupo de poses de cámara que le toca (CamPoses.js); null = la que salga. */
  get camPose() {
    if (this.ventHidden) return 'rejilla';
    if (this.path) return 'media';
    return CAM_POSE[this.phase] ?? null;
  }

  get atDoor() {
    return DOOR_SIDE[this.room] ?? null;
  }

  get inCorridor() {
    return isCentral(this.room);
  }

  _chooseGoal(world) {
    this.goal = world.rng.next() < CFG.CORRIDOR_BIAS ? 'pasillo' : 'puertas';
  }

  /** Arranca en `room` (al empezar la noche si no hay inicio en el pasillo). */
  activate(world, room = CFG.START) {
    this.state = 'room';
    this._chooseGoal(world);
    this._arrive(room, world);
  }

  /** Inicio de la noche 3: al fondo del pasillo central. */
  startCorridor(world) {
    this.intro = true;
    this.state = 'room';
    this.goal = 'pasillo';
    this.cpos = 0;
    this._arrive(NIGHT3.INTRO.START, world);
  }

  /** Lo vuelve a poner en `room` (fin de la cinemática de las 3 AM). */
  placeAt(room, world) {
    this.path = null;
    this.calm = 0;
    this.intro = false;
    this._chooseGoal(world);
    this._arrive(room, world);
  }

  _corridorTime() {
    return COR.FAIL_EVERY[this.cpos] * (this.intro ? NIGHT3.INTRO.SLOW : 1) * this.reactionMult;
  }

  /** Llega a una sala: emite el movimiento y empieza su espera. */
  _arrive(room, world) {
    const from = this.room;
    if (isCentral(room) && !isCentral(from)) this.cpos = 0;              // entra desde el Comedor
    else if (isCentral(room) && isCentral(from) && room !== sectionOf(this.cpos)) {
      this.cpos = (Number(room.slice(-1)) - 1) * 2;                      // sale hacia el Comedor (audio)
    }
    this.room = room;
    this.ventHidden = false;
    this.failMove = null;
    world.events.emit('enemyMove', { enemy: this, from, to: room });
    world.cameras.glitchIfWatching([from, room], 0.8);
    if (this.atDoor) {
      const [a, b] = CFG.DOOR_WAIT;
      this.timer2 = world.rng.range(a, b) * this.reactionMult;
      world.events.emit('enemyAtDoor', { enemy: this, side: this.atDoor });
    } else if (this.inCorridor) {
      this._startPosition();
    } else {
      this.timer2 = (CFG.PHASE_TIME[this.phase] ?? 0) * this.reactionMult;
      // Deambulando lejos: a veces se esconde tras la rejilla del conducto
      if (!this.phase && !this.path && ROOM_VENT[room] && world.rng.next() < CFG.VENT_HIDE_CHANCE) this.ventHidden = true;
    }
  }

  _startPosition() {
    this.timer2 = this._corridorTime();
    this.flickersLeft = COR.FLICKERS[this.cpos] ?? 0;
  }

  /** Un audio en `roomId` (cámara elegida). Devuelve true si va hacia allí. */
  hearLure(roomId, world) {
    if (this.state !== 'room' || !this.room || roomId === this.room) return false;
    const path = largoPath(this.room, roomId);
    if (!path || !path.length || path.length > CFG.LURE_RANGE) return false;
    this.path = path;
    this.failMove = null;
    this.stepIn = CFG.STEP_TIME * 0.5;   // se pone en marcha enseguida
    if (this.intro) {
      // Primer audio de la noche: se va al Comedor y se queda escuchando
      this.intro = false;
      this.calm = NIGHT3.INTRO.CALM_TIME;
    }
    world.events.emit('largoHeard', { from: this.room, to: roomId });
    return true;
  }

  /** Vecina que le acerca a su objetivo (o null). */
  _towardGoal(world) {
    const d = LARGO_GOAL_DIST[this.goal];
    const options = largoNeighbors(this.room).filter((n) => n in d && d[n] < (d[this.room] ?? 99));
    return options.length ? options[world.rng.int(0, options.length - 1)] : null;
  }

  onOpportunity(world) {
    // Solo decide por su cuenta cuando deambula (lejos de su objetivo)
    if (this.state !== 'room' || this.path || this.phase || this.atDoor || this.inCorridor || this.calm > 0) return;
    let next = world.rng.next() < CFG.FORWARD_BIAS ? this._towardGoal(world) : null;
    if (!next) {
      const options = largoNeighbors(this.room).filter((n) => n !== 'office' && !DOOR_SIDE[n] && !isCentral(n));
      next = options[world.rng.int(0, options.length - 1)];
    }
    if (next) this._arrive(next, world);
  }

  /** Se acabó su tiempo de reacción: avanza una sala hacia su objetivo. */
  _advance(world) {
    if (this.goal === 'pasillo' && this.room === 'mess') {
      this._arrive('central1', world);
      return;
    }
    if (this.goal === 'puertas' && this.dist <= 1) {
      const door = largoNeighbors(this.room).find((n) => DOOR_SIDE[n]);
      if (door) {
        this._arrive(door, world);
        return;
      }
    }
    const next = this._towardGoal(world);
    if (next) this._arrive(next, world);
  }

  /** Un paso dentro del pasillo central (con o sin fallo de la linterna). */
  _corridorStep(world) {
    this.cpos += COR.STEPS_PER_FAIL;
    if (this.cpos >= COR.POSITIONS) {
      world.attack(this);
      return;
    }
    const room = sectionOf(this.cpos);
    if (room !== this.room) {
      const from = this.room;
      this.room = room;
      world.events.emit('enemyMove', { enemy: this, from, to: room });
    } else {
      world.events.emit('largoCorridorStep', { room, cpos: this.cpos });
    }
    this._startPosition();
  }

  tick(dt, world) {
    if (this.state !== 'room') return;
    // Caminando hacia un sonido
    if (this.path) {
      this.stepIn -= dt;
      if (this.stepIn <= 0) {
        const next = this.path.shift();
        this.stepIn = CFG.STEP_TIME;
        if (!this.path.length) {
          this.path = null;
          if (!this.intro && this.calm <= 0) this._chooseGoal(world);
        }
        this._arrive(next, world);
      }
      return;
    }
    if (this.calm > 0) {
      this.calm -= dt;
      if (this.calm <= 0) this._arrive(this.room, world);   // vuelve a empezar su espera
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
        this._chooseGoal(world);
        this._arrive(r[world.rng.int(0, r.length - 1)], world);
      } else {
        world.attack(this);
      }
      return;
    }
    // En el pasillo central
    if (this.inCorridor) {
      if (this.failMove !== null) {
        // La linterna está cortada: cambia de sitio a mitad del corte
        this.failMove -= dt;
        if (this.failMove <= 0) {
          this.failMove = null;
          this._corridorStep(world);
        }
        return;
      }
      this.timer2 -= dt;
      // Parpadeos de aviso (sin avanzar), más cuanto más cerca
      const total = this._corridorTime();
      if (this.lit && this.flickersLeft > 0 && this.timer2 < total * (this.flickersLeft / ((COR.FLICKERS[this.cpos] ?? 0) + 1))) {
        this.flickersLeft--;
        world.events.emit('largoCorridorFlicker', { cpos: this.cpos });
      }
      if (this.timer2 > 0) return;
      if (this.lit) {
        // Fallo de la linterna: se corta y, en la oscuridad, se acerca
        const dark = world.rng.range(COR.FAIL_DARK[0], COR.FAIL_DARK[1]);
        this.failMove = dark * 0.5;
        world.events.emit('largoCorridorFail', { dark, cpos: this.cpos });
      } else {
        this._corridorStep(world);
      }
      return;
    }
    // En una fase: cuenta atrás y avanza
    if (this.phase) {
      this.timer2 -= dt;
      if (this.timer2 <= 0) this._advance(world);
    }
  }

  /** (Noche 2: golpear la rejilla del conducto. Aquí no lo hace.) */
  hit() {}
}
