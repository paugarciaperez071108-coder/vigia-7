// =============================================================
// BackView.js — Lo que hay DETRÁS de la oficina: la pared trasera con la
// compuerta del PASILLO CENTRAL (estaba sellada por el protocolo de
// contención; se abre al final de la noche 2 y se usa desde la noche 3).
// Se ve al girarse (src/systems/LookBack.js).
//
// draw(ctx, opts):
//   open      0..1  cuánto ha subido la compuerta (0 = cerrada)
//   sealed    true  barras de bloqueo puestas (antes de abrirse)
//   red       0..1  destello de la luz roja de alarma
//   glimpse   0..1 o null: una silueta cruza el fondo del pasillo
//   inCorridor(ctx, rect, vp)  para dibujar cosas DENTRO del pasillo
//             (enemigos de la noche 3); rect = hueco, vp = punto de fuga
// emitDust(n): suelta polvo/vapor por la compuerta (al abrirse).
// =============================================================

import { CONFIG } from '../config.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
export const BACK_HATCH = { x: 620, y: 250, w: 360, h: 500 };
const VP = { x: 800, y: 470 };   // punto de fuga del pasillo

export class BackView {
  constructor() {
    this.time = 0;
    this.dust = [];
  }

  update(dt) {
    this.time += dt;
    for (const p of this.dust) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.985;
      p.vy *= 0.985;
    }
    this.dust = this.dust.filter((p) => p.t < p.life);
  }

  /** Polvo y vapor que salen por la compuerta al subir. */
  emitDust(n, open = 0) {
    const r = BACK_HATCH;
    for (let i = 0; i < n; i++) {
      const fromBottom = Math.random() < 0.7;
      const x = r.x + Math.random() * r.w;
      const y = fromBottom ? r.y + r.h - 10 - Math.random() * 30 : r.y + r.h * (1 - open) + Math.random() * 20;
      this.dust.push({
        x, y, t: 0, life: 1.6 + Math.random() * 1.8,
        vx: (x - (r.x + r.w / 2)) * (0.4 + Math.random() * 0.6) + (Math.random() - 0.5) * 40,
        vy: fromBottom ? -10 - Math.random() * 40 : 20 + Math.random() * 30,
        r0: 8 + Math.random() * 14, r1: 50 + Math.random() * 60,
        steam: Math.random() < 0.4,
      });
    }
  }

  draw(ctx, { open = 0, sealed = false, red = 0, glimpse = null, inCorridor = null } = {}) {
    this._room(ctx);
    this._corridor(ctx, open, red, glimpse, inCorridor);
    this._hatch(ctx, open, sealed);
    this._frame(ctx, sealed, red);
    this._drawDust(ctx);
    if (red > 0) {
      ctx.fillStyle = `rgba(255,30,20,${0.1 * red})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // --- Pared trasera de la oficina ---
  _room(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0c0f13');
    g.addColorStop(0.5, '#171c22');
    g.addColorStop(1, '#0d1013');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Techo con tuberías
    ctx.fillStyle = '#0a0c0f';
    ctx.fillRect(0, 0, W, 110);
    for (const [y, th] of [[48, 16], [80, 10]]) {
      ctx.fillStyle = '#262c33';
      ctx.fillRect(0, y, W, th);
      ctx.fillStyle = '#323a42';
      for (let x = 60; x < W; x += 210) ctx.fillRect(x, y - 3, 14, th + 6);
    }
    // Suelo con rejilla
    ctx.fillStyle = '#0e1114';
    ctx.fillRect(0, 760, W, H - 760);
    ctx.strokeStyle = 'rgba(80,90,100,0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 16; i++) {
      ctx.beginPath();
      ctx.moveTo(VP.x + (i - 8) * 30, 760);
      ctx.lineTo(VP.x + (i - 8) * 190, H);
      ctx.stroke();
    }
    for (const y of [790, 830, 880]) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    // Paneles de la pared
    ctx.strokeStyle = 'rgba(60,70,80,0.5)';
    for (let x = 0; x < W; x += 200) {
      if (x > 520 && x < 1080) continue;
      ctx.strokeRect(x + 6, 130, 188, 620);
    }
    // Taquillas a la izquierda
    for (let i = 0; i < 3; i++) {
      const x = 90 + i * 120;
      ctx.fillStyle = '#20262c';
      ctx.fillRect(x, 300, 108, 450);
      ctx.strokeStyle = '#2e353c';
      ctx.strokeRect(x, 300, 108, 450);
      ctx.fillStyle = '#11151a';
      for (let k = 0; k < 4; k++) ctx.fillRect(x + 24, 330 + k * 10, 60, 4);
      ctx.fillStyle = '#3a424a';
      ctx.fillRect(x + 90, 520, 6, 30);
    }
    // Armario eléctrico apagado a la derecha, con cables colgando
    ctx.fillStyle = '#1d2329';
    ctx.fillRect(1140, 280, 300, 470);
    ctx.strokeStyle = '#2c333a';
    ctx.strokeRect(1140, 280, 300, 470);
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = k % 2 ? '#141a1f' : '#181e24';
      ctx.fillRect(1160, 300 + k * 72, 260, 60);
      ctx.fillStyle = '#3a1512';
      ctx.fillRect(1180, 322 + k * 72, 10, 10);
    }
    ctx.strokeStyle = '#0b0d10';
    ctx.lineWidth = 4;
    for (const [x, len] of [[1190, 220], [1260, 300], [1380, 180]]) {
      ctx.beginPath();
      ctx.moveTo(x, 110);
      ctx.quadraticCurveTo(x + 20, 110 + len * 0.6, x - 10, 110 + len);
      ctx.stroke();
    }
  }

  // --- El pasillo (detrás de la compuerta) ---
  _corridor(ctx, open, red, glimpse, inCorridor) {
    if (open <= 0) return;
    const r = BACK_HATCH;
    const pulse = 0.55 + 0.45 * Math.sin(this.time * 3.2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.fillStyle = '#050304';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    // Marcos que se alejan, teñidos por la luz roja del fondo
    for (let i = 6; i >= 1; i--) {
      const k = Math.pow(0.7, i);
      const w = r.w * k;
      const h = r.h * k;
      const x = VP.x - w / 2;
      const y = VP.y - h * 0.55;
      ctx.fillStyle = `rgba(${30 + 40 * k},${8 + 6 * k},${8 + 6 * k},1)`;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = `rgba(170,45,35,${(0.25 + 0.35 * (1 - k)) * pulse})`;
      ctx.lineWidth = 8 * k + 1;
      ctx.strokeRect(x, y, w, h);
    }
    // Suelo del pasillo
    ctx.strokeStyle = 'rgba(120,40,35,0.35)';
    ctx.lineWidth = 2;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(VP.x + i * 6, VP.y + 30);
      ctx.lineTo(VP.x + i * 70, r.y + r.h);
      ctx.stroke();
    }
    // Luz roja al fondo
    const g = ctx.createRadialGradient(VP.x, VP.y - 20, 4, VP.x, VP.y - 20, 160);
    g.addColorStop(0, `rgba(255,50,35,${0.35 * pulse + 0.25 * red})`);
    g.addColorStop(1, 'rgba(255,50,35,0)');
    ctx.fillStyle = g;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    inCorridor?.(ctx, r, VP);
    // Una silueta cruza el fondo: casi negra contra el rojo (solo se insinúa)
    if (glimpse !== null && glimpse >= 0 && glimpse <= 1) {
      const sw = r.w * Math.pow(0.7, 3);
      const x = VP.x - sw * 0.9 + sw * 1.8 * glimpse;
      const base = VP.y + 34;
      const hgt = 120;
      const bob = Math.sin(glimpse * Math.PI * 6) * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.94)';
      ctx.beginPath();
      ctx.ellipse(x, base - hgt + 10 + bob, 8, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 13, base - hgt + 22 + bob);
      ctx.lineTo(x + 13, base - hgt + 22 + bob);
      ctx.lineTo(x + 10, base - 44);
      ctx.lineTo(x - 10, base - 44);
      ctx.fill();
      const step = Math.sin(glimpse * Math.PI * 6) * 7;
      ctx.fillRect(x - 8 + step, base - 46, 6, 46);
      ctx.fillRect(x + 2 - step, base - 46, 6, 46);
      // Brazos muy largos
      ctx.fillRect(x - 17, base - hgt + 26 + bob, 5, 70);
      ctx.fillRect(x + 12, base - hgt + 26 + bob, 5, 70);
    }
    ctx.restore();
  }

  // --- La compuerta: plancha que sube ---
  _hatch(ctx, open, sealed) {
    if (open >= 1) return;
    const r = BACK_HATCH;
    const shift = r.h * open;
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.translate(0, -shift);
    const g = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
    g.addColorStop(0, '#22282e');
    g.addColorStop(0.5, '#2f363d');
    g.addColorStop(1, '#22282e');
    ctx.fillStyle = g;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = '#1a1e23';
    ctx.lineWidth = 3;
    for (let y = r.y + 40; y < r.y + r.h - 50; y += 46) {
      ctx.beginPath();
      ctx.moveTo(r.x, y);
      ctx.lineTo(r.x + r.w, y);
      ctx.stroke();
    }
    // Remaches
    ctx.fillStyle = '#4a525a';
    for (let y = r.y + 20; y < r.y + r.h - 50; y += 46) {
      for (const x of [r.x + 14, r.x + r.w - 14]) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Franjas abajo
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y + r.h - 46, r.w, 46);
    ctx.clip();
    for (let x = r.x - 60; x < r.x + r.w + 60; x += 30) {
      ctx.fillStyle = '#c9a21f';
      ctx.beginPath();
      ctx.moveTo(x, r.y + r.h);
      ctx.lineTo(x + 15, r.y + r.h);
      ctx.lineTo(x + 61, r.y + r.h - 46);
      ctx.lineTo(x + 46, r.y + r.h - 46);
      ctx.fill();
    }
    ctx.restore();
    // Rótulo en la plancha
    ctx.fillStyle = 'rgba(200,190,170,0.35)';
    ctx.font = 'bold 26px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('C-00', r.x + r.w / 2, r.y + r.h * 0.42);
    ctx.restore();
    // Barras de bloqueo (antes de abrirse)
    if (sealed) {
      for (const y of [r.y + r.h * 0.3, r.y + r.h * 0.68]) {
        ctx.fillStyle = '#5a1e1a';
        ctx.fillRect(r.x - 30, y, r.w + 60, 26);
        ctx.fillStyle = '#2a0e0c';
        for (let x = r.x - 20; x < r.x + r.w + 30; x += 40) ctx.fillRect(x, y + 4, 18, 18);
        ctx.fillStyle = '#8a8f94';
        for (const x of [r.x - 22, r.x + r.w + 14]) {
          ctx.beginPath();
          ctx.arc(x + 4, y + 13, 7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // --- Marco, cartel y luz de alarma ---
  _frame(ctx, sealed, red) {
    const r = BACK_HATCH;
    ctx.save();
    ctx.strokeStyle = '#3e464d';
    ctx.lineWidth = 18;
    ctx.strokeRect(r.x - 9, r.y - 9, r.w + 18, r.h + 18);
    ctx.strokeStyle = '#1b1f23';
    ctx.lineWidth = 3;
    ctx.strokeRect(r.x - 19, r.y - 19, r.w + 38, r.h + 38);
    // Cartel
    ctx.fillStyle = '#7a1c18';
    ctx.fillRect(r.x, r.y - 78, r.w, 40);
    ctx.fillStyle = '#f0d9c8';
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sealed ? 'ZONA EN CONTENCIÓN' : 'CONTENCIÓN LEVANTADA', r.x + r.w / 2, r.y - 58);
    // Baliza roja encima: gira y barre la pared
    const on = Math.max(red, sealed ? 0 : 0.35);
    const a = this.time * 4;
    const bx = r.x + r.w / 2;
    const by = r.y - 112;
    ctx.fillStyle = '#14181d';
    ctx.fillRect(bx - 26, by + 8, 52, 12);
    ctx.fillStyle = `rgba(255,40,30,${0.3 + 0.7 * on})`;
    ctx.shadowColor = 'rgba(255,40,30,0.9)';
    ctx.shadowBlur = 30 * on;
    ctx.beginPath();
    ctx.arc(bx, by, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (on > 0) {
      ctx.globalCompositeOperation = 'lighter';
      for (const off of [0, Math.PI]) {
        const ang = a + off;
        const g = ctx.createRadialGradient(bx, by, 10, bx, by, 700);
        g.addColorStop(0, `rgba(255,40,25,${0.22 * on})`);
        g.addColorStop(1, 'rgba(255,40,25,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.arc(bx, by, 700, ang - 0.25, ang + 0.25);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  _drawDust(ctx) {
    if (!this.dust.length) return;
    ctx.save();
    for (const p of this.dust) {
      const f = p.t / p.life;
      const rad = p.r0 + (p.r1 - p.r0) * f;
      const alpha = (p.steam ? 0.22 : 0.16) * (1 - f) * Math.min(1, p.t * 4);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
      const c = p.steam ? '200,205,210' : '150,140,128';
      g.addColorStop(0, `rgba(${c},${alpha})`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(p.x - rad, p.y - rad, rad * 2, rad * 2);
    }
    ctx.restore();
  }
}
