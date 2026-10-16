// =============================================================
// AmbientSounds.js — Ruidos de la nave abandonada durante la noche.
//
// Cada cierto tiempo (night.ambient = [mín, máx] segundos, en
// nights.js: más seguidos en las noches avanzadas) suena algo en una
// sala al azar: una lata que cae, una tubería suelta, un crujido de la
// estructura, un chispazo... (CONFIG.AMBIENT.SOUNDS, con su peso). No
// repite el mismo tipo dos veces seguidas y la biblioteca ya evita
// repetir variante.
//
// Además, mientras El Largo está en una sala, de vez en cuando se le
// oye respirar o gruñir desde allí (CONFIG.AMBIENT.LARGO_IDLE): así se
// le reconoce de oído sin mirar las cámaras.
// =============================================================

import { CONFIG } from '../config.js';
import { ROOM_IDS } from '../world/StationMap.js';

const rand = ([min, max]) => min + Math.random() * (max - min);

export class AmbientSounds {
  constructor(audio) {
    this.audio = audio;
    this.reset({});
  }

  reset(night) {
    this.range = night.ambient ?? CONFIG.AMBIENT.DEFAULT_INTERVAL;
    this.next = rand(this.range) * 0.5; // el primero llega antes
    this.lastKey = null;
    this.largoNext = rand(CONFIG.AMBIENT.LARGO_IDLE);
  }

  update(dt, ai) {
    this.next -= dt;
    if (this.next <= 0) {
      this.next = rand(this.range);
      const key = this._pick();
      const room = ROOM_IDS[Math.floor(Math.random() * ROOM_IDS.length)];
      this.audio.playAt(key, room, CONFIG.AMBIENT.VOLUME, { ambience: true });
    }
    const largo = ai.largo;
    if (largo?.state === 'room' && largo.room) {
      this.largoNext -= dt;
      if (this.largoNext <= 0) {
        this.largoNext = rand(CONFIG.AMBIENT.LARGO_IDLE);
        const key = Math.random() < 0.6 ? 'largo/respiracion' : 'largo/grunido';
        this.audio.playAt(key, largo.room, CONFIG.AMBIENT.LARGO_VOLUME);
      }
    }
  }

  /** Tipo al azar según los pesos, distinto del anterior. */
  _pick() {
    const list = CONFIG.AMBIENT.SOUNDS.filter(([key]) => key !== this.lastKey);
    let r = Math.random() * list.reduce((s, [, w]) => s + w, 0);
    for (const [key, w] of list) {
      r -= w;
      if (r <= 0) return (this.lastKey = key);
    }
    return (this.lastKey = list[0][0]);
  }
}
