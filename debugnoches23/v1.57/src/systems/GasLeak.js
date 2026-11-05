// =============================================================
// GasLeak.js — Insecticida y evento aleatorio: fuga de gas.
//
// Cada soltada de insecticida (spray) cuenta. A partir de
// NIGHT2.LEAK.SAFE_USES soltadas, cada nueva puede provocar una fuga
// (más probable cuantas más llevas). La fuga salta unos segundos
// después de la soltada:
//   - alarma visual y sonora y cuenta atrás de COUNTDOWN segundos;
//   - se arregla escribiendo /InsecP en la consola;
//   - si llega a 0 → game over ('gasLeakDeath').
// Mientras hay fuga no se puede soltar más insecticida. Al arreglarla,
// la cuenta de soltadas vuelve a 0.
// =============================================================

import { NIGHT2 } from '../night/night2.js';

const LEAK = NIGHT2.LEAK;

export class GasLeak {
  constructor(events, rng) {
    this.events = events;
    this.rng = rng;
    this.reset();
  }

  reset() {
    this.uses = 0;          // soltadas desde la última fuga
    this.cooldown = 0;      // segundos hasta poder volver a soltar
    this.pendingIn = null;  // fuga programada (segundos) o null
    this.active = false;
    this.countdown = 0;
  }

  get canSpray() {
    return this.cooldown <= 0 && !this.active;
  }

  /** Probabilidad de fuga de la PRÓXIMA soltada. */
  get nextRisk() {
    const over = this.uses + 1 - LEAK.SAFE_USES;
    return over > 0 ? Math.min(LEAK.MAX_RISK, over * LEAK.RISK_PER_USE) : 0;
  }

  /** Se suelta insecticida. Devuelve false si no se puede ahora. */
  spray() {
    if (!this.canSpray) return false;
    const risk = this.nextRisk;
    this.uses++;
    this.cooldown = NIGHT2.GAS.COOLDOWN;
    if (this.pendingIn === null && this.rng.next() < risk) {
      this.pendingIn = this.rng.range(LEAK.DELAY_MIN, LEAK.DELAY_MAX);
    }
    return true;
  }

  /** Provoca la fuga ya (también lo usa la depuración). */
  trigger() {
    if (this.active) return;
    this.pendingIn = null;
    this.active = true;
    this.countdown = LEAK.COUNTDOWN;
    this.events.emit('gasLeak', { on: true });
  }

  /** Comando de la consola. Devuelve true si arregla la fuga. */
  tryCommand(text) {
    if (!this.active || text.trim().toLowerCase() !== LEAK.COMMAND.toLowerCase()) return false;
    this.active = false;
    this.uses = 0;
    this.events.emit('gasLeak', { on: false });
    return true;
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.pendingIn !== null) {
      this.pendingIn -= dt;
      if (this.pendingIn <= 0) this.trigger();
    }
    if (this.active) {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.active = false;
        this.events.emit('gasLeak', { on: false });
        this.events.emit('gasLeakDeath');
      }
    }
  }
}
