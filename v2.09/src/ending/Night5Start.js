// =============================================================
// Night5Start.js — INICIO DE LA NOCHE 5: sales de la taquilla (v0.46).
// (Valores en NIGHT5.START.)
//
// La noche 4 acabó dentro de la taquilla (las dos rutas). Ahora:
//   'inside' dentro, a oscuras, con las rendijas de la luz de la oficina.
//            Si Slaimi sigue vivo, está contigo: su luz violeta, tranquila.
//            Si murió (ruta A), estás solo. (Modo debug: congelado, quieto
//            y helado.)
//   'open'   la puerta se abre: entra la luz y se ve la oficina, el frente.
//   'out'    sales (la vista se aleja de la puerta) y empieza el turno.
// Distinto del inicio de la noche 4 (dentro de la taquilla eligiendo
// camino): aquí no hay que hacer nada, es un despertar.
// =============================================================

import { CONFIG } from '../config.js';
import { NIGHT5 } from '../night/night5.js';
import { drawSlaimi } from '../systems/Slaimi.js';

const S = NIGHT5.START;
const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const VIOLET = '143,107,255';

export class Night5Start {
  constructor(game) {
    this.g = game;
  }

  /** slaimi: 'vivo' | 'muerto' | 'congelado'. */
  start(slaimi) {
    this.slaimi = slaimi;
    this.t = 0;
    this.done = false;
    this.g.slaimi.active = false;          // lo dibuja esta escena hasta salir
    this.g.audio.lib?.play('ambiente/ventilacion', { volume: 0.25, muffle: 0.7 });
    if (slaimi === 'vivo') this.g.audio.lib?.play('slaimi/calma', { volume: 0.35, when: 1.2 });
  }

  update(dt) {
    if (this.done) return;
    const before = this.t;
    this.t += dt;
    if (before < S.INSIDE && this.t >= S.INSIDE) {
      this.g.audio.door?.('center', false);
      this.g.audio.lib?.play('puertas/apertura', { volume: 0.5 });
    }
    if (this.t >= S.INSIDE + S.OPEN + S.TURN) {
      this.done = true;
      this.g._n5StartDone();
    }
  }

  draw(ctx) {
    const t = this.t;
    if (t < S.INSIDE) return this._drawInside(ctx, 1);
    const u = Math.min(1, (t - S.INSIDE) / S.OPEN);
    const v = Math.max(0, Math.min(1, (t - S.INSIDE - S.OPEN) / S.TURN));
    // La oficina (el frente), primero muy cerca y oscura; sales hacia atrás… hacia delante
    ctx.save();
    const z = 1.25 - 0.25 * (v * v * (3 - 2 * v));
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2);
    this.g._drawOfficeFront(ctx, 'front');
    ctx.restore();
    ctx.fillStyle = `rgba(0,0,0,${0.55 * (1 - v)})`;
    ctx.fillRect(0, 0, W, H);
    // La puerta de la taquilla abriéndose (hacia la izquierda)
    if (u < 1) {
      const door = W * (1 - u * u * (3 - 2 * u));
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, door, H);
      ctx.clip();
      this._drawInside(ctx, 1 - u);
      ctx.restore();
      ctx.fillStyle = '#05070a';
      ctx.fillRect(door - 16, 0, 16, H);
    }
    if (this.slaimi === 'vivo') {
      // Slaimi sale contigo (abajo, saltando hacia su sitio)
      const hop = Math.abs(Math.sin(t * 5)) * (1 - v);
      drawSlaimi(ctx, W * 0.62 + 120 * v, H - 40 - hop * 60, 170 - 40 * v, { t, stretch: hop * 0.15, sprites: this.g.sprites });
    }
    this.g.effects.vignette(ctx, 1.1 - 0.3 * v);
  }

  /** Dentro de la taquilla: negro, rendijas, y Slaimi (o nadie). */
  _drawInside(ctx, a) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    for (let i = 0; i < 6; i++) {
      const y = 170 + i * 26;
      const g = ctx.createLinearGradient(0, y, W, y);
      g.addColorStop(0, 'rgba(120,130,140,0)');
      g.addColorStop(0.5, `rgba(170,180,190,${(0.35 - i * 0.03) * a})`);
      g.addColorStop(1, 'rgba(120,130,140,0)');
      ctx.fillStyle = g;
      ctx.fillRect(320, y, W - 640, 7);
    }
    ctx.restore();
    const t = this.t;
    if (this.slaimi === 'vivo') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const gl = ctx.createRadialGradient(W / 2, 760, 0, W / 2, 760, 520);
      gl.addColorStop(0, `rgba(${VIOLET},${0.32 * a})`);
      gl.addColorStop(1, `rgba(${VIOLET},0)`);
      ctx.fillStyle = gl;
      ctx.fillRect(0, 200, W, H);
      ctx.restore();
      drawSlaimi(ctx, W / 2, 930, 300, { t, phase: (t * 0.35) % 1, pose: 'lento', sprites: this.g.sprites });
    } else if (this.slaimi === 'congelado') {
      // (modo debug) helado, quieto, sin luz
      ctx.save();
      ctx.globalAlpha = 0.85 * a;
      drawSlaimi(ctx, W / 2, 930, 300, { t: 0, sad: true, sprites: this.g.sprites });
      ctx.fillStyle = 'rgba(200,225,250,0.35)';
      ctx.fillRect(W / 2 - 200, 600, 400, 340);
      ctx.restore();
    }
    this.g.effects.vignette(ctx, 1.25);
    // Despertar: los ojos se abren al principio
    if (t < 1.2) {
      ctx.fillStyle = `rgba(0,0,0,${1 - t / 1.2})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}
