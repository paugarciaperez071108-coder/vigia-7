// =============================================================
// CryoPanel.js — Panel de temperatura de la cápsula (CAM 05).
//
// El Congelado exige un REQUISITO que cambia durante la noche:
//   - "mínima X °C" → la temperatura debe ser >= X
//   - "máxima X °C" → la temperatura debe ser <= X
//
// Cada `driftInterval` segundos la temperatura se desvía 1 °C
// SIEMPRE en contra del requisito (como una caja de música que se
// va desenrollando): si pide mínima, baja; si pide máxima, sube.
// El jugador la corrige con las flechas del panel.
//
// Cuando el requisito cambia, el nuevo se elige con unos grados de
// margen respecto a la temperatura actual (marginMin..marginMax),
// para que nunca se incumpla de golpe sin aviso.
// =============================================================

import { CONFIG } from '../config.js';

export class CryoPanel {
  constructor(events, rng) {
    this.events = events;
    this.rng = rng;
    this.reset({ changeEveryHours: 2, driftInterval: 7, marginMin: 4, marginMax: 6 });
  }

  reset(cfg) {
    this.cfg = cfg;
    this.temp = CONFIG.CRYO.START_TEMP;
    this.driftTimer = cfg.driftInterval;
    this.reqTimer = cfg.changeEveryHours * CONFIG.SECONDS_PER_HOUR;
    this.enabled = true;
    this._inicio = true;          // (el primero de la noche no es un «cambio»)
    this._pickRequirement();
    this.cambioEn = -1e9;
  }

  _pickRequirement() {
    const C = CONFIG.CRYO;
    this.mode = this.rng.next() < 0.5 ? 'min' : 'max';
    const margin = this.rng.int(this.cfg.marginMin, this.cfg.marginMax);
    this.target = this.mode === 'min' ? this.temp - margin : this.temp + margin;
    // Si el objetivo se sale del rango del panel, usamos el modo contrario.
    if (this.target < C.MIN_TEMP || this.target > C.MAX_TEMP) {
      this.mode = this.mode === 'min' ? 'max' : 'min';
      this.target = this.mode === 'min' ? this.temp - margin : this.temp + margin;
    }
    this.cambioEn = performance.now();
    this.events.emit('cryoRequirement', { mode: this.mode, target: this.target, inicio: !!this._inicio });
    this._inicio = false;
  }

  update(dt) {
    // Deriva automática en contra del requisito
    this.driftTimer -= dt;
    while (this.driftTimer <= 0) {
      this.driftTimer += this.cfg.driftInterval;
      this._setTemp(this.temp + (this.mode === 'min' ? -1 : 1));
    }
    // Cambio de requisito cada X horas de juego
    this.reqTimer -= dt;
    if (this.reqTimer <= 0) {
      this.reqTimer += this.cfg.changeEveryHours * CONFIG.SECONDS_PER_HOUR;
      this._pickRequirement();
    }
  }

  /** Flechas del panel: dir = +1 (subir) o -1 (bajar). */
  adjust(dir) {
    if (!this.enabled) return false;
    const C = CONFIG.CRYO;
    let t = this.temp + dir;
    // No se puede "adelantar" más de MAX_SAFE_MARGIN grados por el lado seguro.
    if (this.mode === 'min') t = Math.min(t, this.target + C.MAX_SAFE_MARGIN);
    else t = Math.max(t, this.target - C.MAX_SAFE_MARGIN);
    if (t === this.temp) return false;
    this._setTemp(t);
    return true;
  }

  /** Deja la temperatura dentro del requisito, con `margin` grados de sobra. */
  makeSafe(margin) {
    this._setTemp(this.mode === 'min' ? this.target + margin : this.target - margin);
    this.driftTimer = this.cfg.driftInterval;
  }

  _setTemp(t) {
    this.temp = Math.max(CONFIG.CRYO.MIN_TEMP, Math.min(CONFIG.CRYO.MAX_TEMP, t));
  }

  /** ¿Se cumple el requisito? */
  get ok() {
    return this.mode === 'min' ? this.temp >= this.target : this.temp <= this.target;
  }

  /** Grados que faltan para incumplir el requisito (0 = ya incumplido). */
  /** v0.58: ¿acaba de cambiar el rango? (el panel parpadea unos segundos) */
  get cambioReciente() {
    return performance.now() - this.cambioEn < 4000;
  }

  get margin() {
    const m = this.mode === 'min' ? this.temp - this.target : this.target - this.temp;
    return Math.max(0, m);       // v0.58: la distancia real hasta el límite (antes contaba un grado de más)
  }
}
