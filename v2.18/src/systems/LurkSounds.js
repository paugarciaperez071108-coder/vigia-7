// =============================================================
// LurkSounds.js — Enemigos a oscuras que SE OYEN (v0.45).
// (Valores en CONFIG.LURK.)
//
// En las fases con linterna los enemigos solo se ven dentro del haz
// (Flashlight.reveal). Para poder anticiparse, mientras uno está ahí y
// NO se le alumbra, cada LURK.EVERY s suena bajito su respiración o sus
// pasos, por su lado: izquierda / derecha en estéreo; atrás (o al fondo),
// en el centro y más apagado. Al alumbrarle, se calla.
//
// Lo usan: Ruta B, defensa de 5:00 a 6:00 (Night4Dark) y el enemigo que
// entra al reparar (Night4Repair); Ruta A, El Largo en el panel del fusible
// (Night4Start). NO lo usan, a propósito (decisión del usuario): la noche
// 2.5, el final del sueño de la Ruta A, El Largo a contraluz de Slaimi y
// los asomados de la Ruta B (silenciosos desde la v0.39).
// =============================================================

import { CONFIG } from '../config.js';

const rand = ([a, b]) => a + Math.random() * (b - a);
const pick = (l) => l[Math.floor(Math.random() * l.length)];

// Qué suena de cada uno (sonidos de la biblioteca, assets/audio/sfx)
const KINDS = {
  largo: ['largo/respiracion', 'largo/pasos'],
  specimen: ['criaturas/respiracion', 'pasos/metal'],
  frozen: ['criaturas/respiracion', 'pasos/metal'],
  insecto: ['criaturas/aranazos', 'pasos/metal'],
};

export class LurkSounds {
  /** play(key, opts): la función de sonido de la fase. */
  constructor(play) {
    this.play = play;
    this.timers = new Map();
  }

  reset() {
    this.timers.clear();
  }

  /**
   * list: los enemigos presentes, [{ ref, kind, side, lit }].
   * ref: el objeto del enemigo (para llevar su cuenta); side: 'left' |
   * 'right' | 'back' | 'center' o un pan numérico (-1 … 1).
   */
  update(dt, list) {
    const L = CONFIG.LURK;
    const now = new Set();
    for (const s of list) {
      if (!s?.ref) continue;
      now.add(s.ref);
      let t = this.timers.get(s.ref) ?? rand(L.FIRST);
      t -= dt;
      if (t <= 0) {
        t = rand(L.EVERY);
        if (!s.lit) this._sound(s);
      }
      this.timers.set(s.ref, t);
    }
    for (const ref of [...this.timers.keys()]) if (!now.has(ref)) this.timers.delete(ref);
  }

  _sound(s) {
    const L = CONFIG.LURK;
    const back = s.side === 'back' || s.side === 'center';
    const pan = typeof s.side === 'number' ? s.side : s.side === 'left' ? -L.SIDE_PAN : s.side === 'right' ? L.SIDE_PAN : 0;
    this.play(pick(KINDS[s.kind] ?? KINDS.specimen), {
      volume: L.VOLUME * (back ? L.BACK_VOLUME : 1),
      pan: pan + rand([-0.08, 0.08]),
      muffle: back ? L.BACK_MUFFLE : L.MUFFLE,
      volVar: 0.04,
      pitchVar: 0.05,
    });
  }
}
