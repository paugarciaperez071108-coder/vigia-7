// =============================================================
// Hallucinations.js — ALUCINACIONES DE LAS 3 AM (noche 4, ruta A).
// (Valores en NIGHT4.HALLU, src/night/night4.js.)
//
// Durante HALLU.DURATION s las cámaras rotas no muestran «SIN SEÑAL» sino
// «grabaciones» de hace una semana: lo que le pasó a la tripulación en
// esa misma sala. Cada cámara tiene su escena (assets/alucinaciones/
// <sala>.webp: una hoja con todos los fotogramas, de
// tools/3d/alucinaciones.py + tools/3d/alucinaciones_hojas.py).
// Cada escena empieza la primera vez que se mira esa cámara; al acabar,
// unos instantes de estática y vuelve a empezar.
//
// Encima, el aspecto de cámara de seguridad real: grano y ruido, algo de
// desaturación, saltos de imagen (fotogramas repetidos o perdidos, la
// imagen que se descuadra), bandas de interferencia y la fecha y hora de
// hace una semana sobreimpresas.
// Al acabar los 30 s las cámaras vuelven de golpe a «SIN SEÑAL».
// =============================================================

import { CONFIG } from '../config.js';
import { NIGHT4 } from '../night/night4.js';

const HL = NIGHT4.HALLU;
const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const BASE = 'assets/alucinaciones/';
// Minuto y segundo de partida de la hora sobreimpresa en cada cámara (03:mm:ss)
const CLOCK = {
  hangar: [2, 14], lab: [0, 41], greenhouse: [4, 3], reactor: [1, 27], cryo: [5, 50],
  mess: [3, 9], westHall: [6, 32], eastHall: [0, 12], medbay: [2, 55], comms: [7, 18],
};
const GAP = 1.4;   // s de estática entre una repetición y la siguiente

export class Hallucinations {
  constructor() {
    this.index = null;
    this.sheets = {};
    this.loading = null;
    this.reset();
  }

  reset() {
    this.active = false;
    this.done = false;
    this.t = 0;
    this.started = {};     // sala → t en que empezó su escena
    this.glitch = 0;
    this.hold = null;      // fotograma congelado (salto de imagen)
  }

  /** Carga el índice y las hojas (antes de las 3 AM, para que no haya espera). */
  load() {
    if (this.loading) return this.loading;
    this.loading = fetch(BASE + 'indice.json').then((r) => r.json()).then((idx) => {
      this.index = idx;
      for (const [room, d] of Object.entries(idx)) {
        const img = new Image();
        img.onload = () => { this.sheets[room] = img; };
        img.src = BASE + d.archivo;
      }
    }).catch(() => console.warn('Hallucinations: no hay grabaciones (assets/alucinaciones/indice.json)'));
    return this.loading;
  }

  start() {
    this.load();
    this.active = true;
    this.done = false;
    this.t = 0;
    this.started = {};
  }

  /** Devuelve true en el instante en que se acaban. */
  update(dt) {
    if (!this.active) return false;
    this.t += dt;
    this.glitch = Math.max(0, this.glitch - dt);
    if (Math.random() < dt * 0.6) this.glitch = 0.08 + Math.random() * 0.25;
    if (this.t >= HL.DURATION) {
      this.active = false;
      this.done = true;
      return true;
    }
    return false;
  }

  has(room) {
    return !!this.index?.[room];
  }

  /** Dibuja la grabación de `room` en lugar de la imagen de la cámara. */
  draw(ctx, room, effects) {
    const d = this.index?.[room];
    const img = this.sheets[room];
    ctx.fillStyle = '#050506';
    ctx.fillRect(0, 0, W, H);
    if (this.started[room] === undefined) this.started[room] = this.t;
    const local = this.t - this.started[room];
    const loop = d ? d.frames / d.fps + GAP : 1;
    const tt = local % loop;
    if (!d || !img || tt > loop - GAP) {
      // Entre repeticiones (o mientras carga): estática
      effects.static(ctx, 0.6);
      this._overlay(ctx, room, local, effects);
      return;
    }
    let f = Math.min(d.frames - 1, Math.floor(tt * d.fps));
    // Saltos de imagen: a veces se repite un fotograma o se pierde uno
    if (this.glitch > 0 && Math.random() < 0.5) f = Math.max(0, f - 1);
    const sx = (f % d.cols) * d.w;
    const sy = Math.floor(f / d.cols) * d.h;
    ctx.save();
    ctx.filter = 'grayscale(0.45) contrast(1.18) brightness(0.92) sepia(0.12)';
    const jy = this.glitch > 0 ? (Math.random() - 0.5) * 26 : 0;
    ctx.drawImage(img, sx, sy, d.w, d.h, 0, jy, W, H);
    ctx.filter = 'none';
    // Imagen descuadrada: una franja desplazada
    if (this.glitch > 0) {
      const y = Math.random() * H;
      const h = 20 + Math.random() * 90;
      ctx.drawImage(img, sx, sy + (y / H) * d.h, d.w, (h / H) * d.h, (Math.random() - 0.5) * 60, y, W, h);
    }
    ctx.restore();
    this._overlay(ctx, room, local, effects);
  }

  _overlay(ctx, room, local, effects) {
    // Grano, líneas de barrido y una banda de interferencia que baja
    effects.static(ctx, 0.16);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    const by = (this.t * 140) % (H + 200) - 100;
    const g = ctx.createLinearGradient(0, by - 60, 0, by + 60);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.07)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, by - 60, W, 120);
    // Viñeta de lente barata
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    // Fecha y hora de hace una semana (y que corre)
    const [mm, ss] = CLOCK[room] ?? [0, 0];
    const tot = mm * 60 + ss + Math.floor(local);
    const hora = `03:${String(Math.floor(tot / 60) % 60).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`;
    ctx.font = 'bold 30px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.fillStyle = '#f2f2e8';
    const txt = `${HL.DATE}   ${hora}`;
    ctx.strokeText(txt, 1010, 118);
    ctx.fillText(txt, 1010, 118);
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.strokeText('▶ PLAY   ARCHIVO', 40, 230);
    ctx.fillText('▶ PLAY   ARCHIVO', 40, 230);
    ctx.restore();
  }
}
