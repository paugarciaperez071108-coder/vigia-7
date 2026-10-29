// =============================================================
// Night7Cuerpo.js — EL CUERPO del protagonista en la noche 7 (v0.99, Fase 6).
// Valores en NIGHT7.CUERPO (src/night/night7.js). Lo lleva Night7.
//
// El miedo (0..1) sube con la hora, con la Aberración (más cuanto más cerca:
// el pasillo, la compuerta, una puerta de los lados), con las sacudidas de las
// explosiones y, del todo, en el silencio de las 5:59. Con él:
//   - el corazón (n7/latido): de unas 60 pulsaciones a más de 140, más fuerte;
//   - la respiración (n7/respira): más seguida y más alta; al alumbrar a la
//     Aberración, se contiene (y suelta el aire al echarla).
// Sin texto ni nada en pantalla: solo se oye (y, con mucho miedo, la vista late
// un poco: un borde oscuro que se cierra con cada latido).
// =============================================================

import { CONFIG } from '../config.js';
import { NIGHT7 } from '../night/night7.js';

const C = NIGHT7.CUERPO;
const lerp = (a, b, k) => a + (b - a) * k;

export class Night7Cuerpo {
  constructor(n7) {
    this.n7 = n7;
    this.g = n7.g;
    this.reset();
  }

  reset() {
    this.miedo = 0;
    this.latidoIn = 1;
    this.respiraIn = 2;
    this.pulso = 0;                // 0..1, el golpe de cada latido (para el borde de la vista)
    this.contiene = false;
  }

  /** Lo que pide el miedo ahora mismo (sin suavizar). */
  _objetivo() {
    const g = this.g;
    const c = g.clock;
    const h = c.elapsed / c.sph;
    if (h >= NIGHT7.HORAS.SILENCIO) return 1;
    let m = lerp(C.MIEDO_HORA[0], C.MIEDO_HORA[1], Math.min(1, h / 6));
    const ab = this.n7.ab;
    if (ab?.activa) {
      if (ab.sala === 'puerta') m += C.MIEDO_PUERTA;
      else if (ab.sala === 'lado') m += C.MIEDO_LADO;
      else if (ab.sala === 'pasillo') m += C.MIEDO_PASILLO * ((ab.pos + 1) / NIGHT7.ABERRACION.POSICIONES);
    }
    m += Math.min(0.3, (this.n7.rotura?.sacudida ?? 0) * 0.6);
    return Math.min(1, m);
  }

  update(dt) {
    const g = this.g;
    const obj = this._objetivo();
    // (sube deprisa y baja despacio: el susto tarda en pasarse)
    this.miedo += (obj - this.miedo) * Math.min(1, dt * (obj > this.miedo ? 2.5 : 0.25));
    this.pulso = Math.max(0, this.pulso - dt * 5);
    const m = this.miedo;
    const lib = g.audio.lib;
    if (!lib) return;
    // El corazón (solo se oye con algo de miedo; en el silencio final, mucho)
    this.latidoIn -= dt;
    if (this.latidoIn <= 0) {
      this.latidoIn = 60 / lerp(C.PULSO[0], C.PULSO[1], m);
      if (m >= C.OYE_DESDE) {
        lib.play('n7/latido', { volume: C.LATIDO_VOL * (0.25 + 0.75 * m) });
        this.pulso = 1;
      }
    }
    // La respiración: al alumbrar a la Aberración se contiene; al echarla, suelta el aire
    const lit = !!this.n7.ab?.lit;
    if (lit && !this.contiene) this.contiene = true;
    if (!lit && this.contiene) {
      this.contiene = false;
      this.respiraIn = 0.15;
    }
    this.respiraIn -= dt;
    if (this.respiraIn <= 0 && !this.contiene) {
      this.respiraIn = lerp(C.RESPIRA_CADA[0], C.RESPIRA_CADA[1], m) * (0.85 + Math.random() * 0.3);
      if (m >= C.OYE_DESDE) lib.play('n7/respira', { volume: C.RESPIRA_VOL * (0.3 + 0.7 * m), pitch: 0.95 + m * 0.12 });
    }
  }

  /** Con mucho miedo, la vista late: un borde oscuro que se cierra con cada latido. */
  draw(ctx) {
    const k = Math.max(0, this.miedo - C.BORDE_DESDE) / (1 - C.BORDE_DESDE);
    if (k <= 0) return;
    const W = CONFIG.WIDTH;
    const H = CONFIG.HEIGHT;
    const a = k * (0.25 + 0.35 * this.pulso);
    const g = ctx.createRadialGradient(W / 2, H / 2, H * (0.55 - 0.08 * this.pulso), W / 2, H / 2, H * 1.05);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(10,0,0,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}
