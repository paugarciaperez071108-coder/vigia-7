// =============================================================
// MusicaReto.js — (v1.99) La música de un reto: «Lunar Abyss» (Lchavasse) en el «Duelo maestro» (id 'todos').
// El usuario (2026-11-14): «que suene durante toda la noche del Duelo maestro y que dure lo mismo que la noche»; que
// empiece a las 12:00 y su final caiga justo a las 6:00 (el archivo ya está ajustado a 360 s: tools/musica/
// duelo_maestro.py); que se pause con el menú de pausa, se corte al morir y vuelva a empezar al reintentar; que respete
// el volumen de música de las opciones (VolumenMusica) y que los sonidos importantes se oigan por encima (baja con los
// avisos, los pasos, los golpes y las criaturas). Si la velocidad de la noche cambia (el modo debug), la música va a
// la misma velocidad y se recoloca con el reloj: nunca se desincroniza.
// SOLO EN LOCAL hasta que el usuario confirme el permiso: el archivo está en assets/audio/musica/privada/, que no se
// publica; sin el archivo, el reto va sin música (sin errores). CONFIG.MUSICA_RETOS[id].ACTIVA: false la quita.
// =============================================================

import { CONFIG } from '../config.js';
import { VolumenMusica } from './VolumenMusica.js';

// Los sonidos de la biblioteca que la hacen bajar (los importantes del juego)
const IMPORTANTES = /^(pasos|largo|congelado|especimen|insecto|errante|dislocado|criaturas|metal\/golpe|golpes?|puerta|alarma|sustos)/;

export class MusicaReto {
  constructor(game) {
    this.g = game;
    this.m = null;          // { el, gain, cfg }
    this.bajada = 0;        // s que le quedan bajada
    VolumenMusica.escucha(() => this._ajusta(0.05));
  }

  /** Al empezar la noche de un reto: su música, si tiene (y está el archivo). */
  empieza(idReto) {
    this.para();
    const cfg = CONFIG.MUSICA_RETOS?.[idReto];
    const ctx = this.g.audio?.ctx;
    if (!cfg?.ACTIVA || !ctx) return;
    const el = new Audio(cfg.ARCHIVO);
    el.preload = 'auto';
    el.preservesPitch = true;                         // (con el modo debug a ×4 va más rápida, sin pitufos)
    el.addEventListener('error', () => this.para(), { once: true });     // (sin el archivo: sin música)
    const gain = ctx.createGain();
    gain.gain.value = 0;
    ctx.createMediaElementSource(el).connect(gain).connect(ctx.destination);
    this.m = { el, gain, cfg };
    el.currentTime = this.g.clock?.elapsed ?? 0;
    // los sonidos importantes de la biblioteca la bajan un momento
    if (this.g.audio.lib) this.g.audio.lib.onPlay = (key) => { if (IMPORTANTES.test(key)) this.aviso(1.6); };
    el.play().catch(() => {});
    this._ajusta(0.4);
  }

  /** Al morir, al salir de la noche o al acabar: se corta (al reintentar, empieza() la vuelve a poner desde el principio). */
  para() {
    if (this.g.audio?.lib?.onPlay) this.g.audio.lib.onPlay = null;
    if (!this.m) return;
    this.m.el.pause();
    this.m.el.removeAttribute('src');
    this.m.gain.disconnect();
    this.m = null;
  }

  /** Un aviso o un sonido importante: la música baja un momento para que se oiga. */
  aviso(s = 2.6) {
    if (!this.m) return;
    this.bajada = Math.max(this.bajada, s);
    this._ajusta(0.06);
  }

  get activa() {
    return !!this.m;
  }

  /** Cada fotograma: con el reloj de la noche, a su velocidad, en pausa con el juego. */
  update(dt) {
    const m = this.m;
    if (!m) return;
    const g = this.g;
    const t = g.clock.elapsed;
    const fin = CONFIG.NIGHT_HOURS * g.clock.sph;
    const parada = g.pausa || g.speed === 0 || g.state !== 'night' || document.hidden || t >= fin;
    if (parada) {
      if (!m.el.paused) m.el.pause();
      return;
    }
    if (m.el.paused) m.el.play().catch(() => {});
    m.el.playbackRate = Math.min(4, Math.max(0.25, g.speed || 1));
    if (Math.abs(m.el.currentTime - t) > m.cfg.DESFASE && !m.el.seeking && m.el.readyState >= 1) m.el.currentTime = t;
    const antes = this.bajada > 0;
    this.bajada = Math.max(0, this.bajada - dt);
    if (antes && this.bajada === 0) this._ajusta(0.5);
  }

  _ajusta(tau) {
    const m = this.m;
    const ctx = this.g.audio?.ctx;
    if (!m || !ctx) return;
    const objetivo = m.cfg.VOLUMEN * VolumenMusica.get() * (this.bajada > 0 ? m.cfg.BAJADA : 1);
    m.gain.gain.setTargetAtTime(objetivo, ctx.currentTime, tau);
  }
}
