// =============================================================
// Night3Ending.js — FINAL DE LA NOCHE 3: esconderse en las taquillas.
// (Valores en NIGHT3.ENDING, src/night/night3.js.)
//
// A las 6 AM no se gana todavía: las cámaras siguen rotas, se va la luz,
// suena la alarma y El Largo viene por el pasillo central.
//
//   1. 'hide'   HIDE_TIME s para girarse hasta la pared de atrás y hacer
//               clic en una de las dos taquillas (a los lados de la
//               compuerta). Se le ve acercarse por el pasillo con la luz
//               roja. Si no te escondes a tiempo, te encuentra.
//   2. 'inside' Dentro de la taquilla, a oscuras, solo se ve la oficina por
//               las rendijas. El Largo entra y pasa por delante varias
//               veces (PASSES). Cuando se acerca hay que AGUANTAR LA
//               RESPIRACIÓN (mantener ESPACIO), pero el aire se acaba
//               (BREATH_MAX). Si respiras mientras está delante, te oye.
//   3. Pasados INSIDE_TIME s se va, vuelve la luz y amanece: noche 3
//               superada (la noche 4 queda desbloqueada).
//
// Al empezar se guarda un punto de control ('n3final'): si mueres,
// Continue vuelve aquí.
// =============================================================

import { CONFIG } from '../config.js';
import { NIGHT3 } from '../night/night3.js';
import { drawCreature } from '../render/CreatureArt.js';
import { BACK_HATCH } from '../render/BackView.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const E = NIGHT3.ENDING;

// Las dos taquillas de la pared de atrás, a los lados de la compuerta
export const LOCKERS = [
  { x: 300, y: 236, w: 200, h: 540 },
  { x: 1100, y: 236, w: 200, h: 540 },
];
// Rendijas de la puerta de la taquilla (vista desde dentro)
const SLITS = Array.from({ length: 6 }, (_, i) => ({ x: 520, y: 300 + i * 46, w: 560, h: 15 }));
// Dónde está El Largo en el pasillo según lo que queda para que llegue
const CORRIDOR = [
  { at: 0, x: 812, y: 512, h: 120, pose: 'stand', room: 'central1' },
  { at: 0.4, x: 780, y: 604, h: 250, pose: 'stand', room: 'central2' },
  { at: 0.75, x: 800, y: BACK_HATCH.y + BACK_HATCH.h + 30, h: 500, pose: 'crouch', room: 'central3' },
];

const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const smooth = (k) => k * k * (3 - 2 * k);

export class Night3Ending {
  constructor(game) {
    this.g = game;
    this.start();
  }

  start() {
    const g = this.g;
    this.phase = 'hide';
    this.t = 0;
    this.stage = -1;          // tramo del pasillo en el que va El Largo
    this.holding = false;     // ESPACIO mantenido = aguantando la respiración
    this.breath = E.BREATH_MAX;
    this.gasp = 0;            // s sin poder aguantar (se ha quedado sin aire)
    this.warned = new Set();
    this.mouse = { x: W / 2, y: H / 2 };
    g.lookBack.reset();
    g.lookBack.enabled = true;
    g.audio.powerDown();
    g.audio.setLoop('n3alarm', true, () => g.audio._sirenLoop());
  }

  get corridorSpot() {
    return CORRIDOR[Math.max(0, this.stage)];
  }

  /** Pasada de El Largo por delante de la taquilla en curso: { k 0..1 } o null. */
  get pass() {
    for (const [a, b] of E.PASSES) {
      if (this.t >= a && this.t <= b) return { k: (this.t - a) / (b - a) };
    }
    return null;
  }

  update(dt) {
    const g = this.g;
    this.t += dt;
    if (this.phase === 'hide') {
      g.lookBack.update(dt);
      g.backView.update(dt);
      const k = this.t / E.HIDE_TIME;
      const stage = CORRIDOR.reduce((s, c, i) => (k >= c.at ? i : s), 0);
      if (stage !== this.stage) {
        this.stage = stage;
        g.audio.playAt('largo/pasos', CORRIDOR[stage].room, 1);
        if (stage === 2) g.audio.playAt('largo/respiracion', 'central3', 1, { when: 0.8 });
      }
      if (this.t >= E.HIDE_TIME) g._lockersDeath('n3_noescondido');
      return;
    }
    // Dentro de la taquilla: la respiración
    this.gasp = Math.max(0, this.gasp - dt);
    if (this.holding && this.gasp <= 0) {
      this.breath -= dt;
      if (this.breath <= 0) {
        // Sin aire: hay que respirar (y no se puede volver a aguantar enseguida)
        this.breath = 0;
        this.holding = false;
        this.gasp = 1.2;
      }
    } else {
      this.breath = Math.min(E.BREATH_MAX, this.breath + E.BREATH_RECOVER * dt);
    }
    // Se oye que se acerca antes de cada pasada
    E.PASSES.forEach(([a], i) => {
      if (!this.warned.has(i) && this.t >= a - E.WARN_BEFORE) {
        this.warned.add(i);
        for (let s = 0; s < 3; s++) g.audio.playAt('largo/pasos', 'central3', 0.7 + s * 0.15, { when: s * 0.55 });
      }
    });
    const p = this.pass;
    if (p && !this.sniffed && p.k > 0.35) {
      this.sniffed = true;
      g.audio.playAt('largo/respiracion', 'central3', 1.1);
    }
    if (!p) this.sniffed = false;
    // Delante de la taquilla (la parte central de la pasada) y respirando: te oye
    if (p && p.k > 0.15 && p.k < 0.85 && !(this.holding && this.gasp <= 0)) {
      g._lockersDeath('n3_taquilla');
      return;
    }
    if (this.t >= E.INSIDE_TIME) g._lockersWin();
  }

  // --- Entrada ---
  move(x, y) {
    this.mouse = { x, y };
    if (this.phase !== 'hide') return false;
    const strip = this.g.lookBack.hover(x, y);
    return strip || (this.g.lookBack.facingBack && !this.g.lookBack.moving && LOCKERS.some((r) => inside(r, x, y)));
  }

  click(x, y) {
    if (this.phase !== 'hide' || !this.g.lookBack.facingBack || this.g.lookBack.moving) return;
    if (LOCKERS.some((r) => inside(r, x, y))) this._hide();
  }

  key(code) {
    const look = this.g.lookBack;
    if (this.phase === 'hide') {
      if (code === CONFIG.LOOK_BACK.KEY) look.toggle();
      else if (code === 'ArrowLeft' || code === 'ArrowRight') {
        look.queue = [];
        look.step(code === 'ArrowLeft' ? -1 : 1);
      } else if ((code === 'KeyE' || code === 'Enter') && look.facingBack && !look.moving) this._hide();
    } else if (code === 'Space') {
      this.holding = true;
    }
  }

  keyUp(code) {
    if (code === 'Space') this.holding = false;
  }

  _hide() {
    this.phase = 'inside';
    this.t = 0;
    this.g.audio.door('center', true);
    this.g.audio.setLoop('n3alarm', false);
  }

  // --- Dibujo ---
  draw(ctx) {
    if (this.phase === 'hide') this._drawHide(ctx);
    else this._drawInside(ctx);
  }

  _drawHide(ctx) {
    const g = this.g;
    const office = (face) => (c) => g.officeView.draw(c, g.office, {
      face, blackout: true, noPower: true, locked: true, night: 3, terminal: g.terminal, reactor: g.reactor,
      doorEnemies: { left: [], right: [] }, cameras: g.cameras, mouse: this.mouse,
    });
    g.lookBack.draw(ctx, {
      front: office('front'), left: office('left'), right: office('right'),
      back: (c) => this._drawBack(c),
    });
    // Luz roja de alarma
    const red = 0.5 + 0.5 * Math.sin(this.t * 5);
    ctx.fillStyle = `rgba(255,20,10,${0.06 + 0.12 * red})`;
    ctx.fillRect(0, 0, W, H);
    g.effects.vignette(ctx);
    g.lookBack.drawStrips(ctx);
    // Aviso
    const left = Math.max(0, Math.ceil(E.HIDE_TIME - this.t));
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ff6a5a';
    ctx.font = 'bold 30px "Courier New", monospace';
    ctx.fillText('6:00 AM — LAS CAMARAS SIGUEN ROTAS', W / 2, 40);
    ctx.font = '22px "Courier New", monospace';
    ctx.fillStyle = '#ffd0c8';
    ctx.fillText(g.lookBack.facingBack
      ? `¡Escondete en una TAQUILLA! (clic o E)  ${left} s`
      : `Viene por el pasillo central: escondete en una taquilla (pared de atras)  ${left} s`, W / 2, 84);
    ctx.restore();
  }

  _drawBack(ctx) {
    const g = this.g;
    const red = 0.5 + 0.5 * Math.sin(this.t * 5);
    g.backView.draw(ctx, { open: 1, red });
    // El Largo en el pasillo, recortado contra la luz roja
    const s = this.corridorSpot;
    ctx.save();
    const r = BACK_HATCH;
    ctx.beginPath();
    ctx.rect(r.x - 40, r.y, r.w + 80, r.h + 200);
    ctx.clip();
    ctx.globalAlpha = 0.85;
    drawCreature(ctx, 'largo', s.x, s.y, s.h, this.t, { pose: s.pose, alpha: 0.8 });
    ctx.restore();
    for (const l of LOCKERS) this._drawLocker(ctx, l, inside(l, this.mouse.x, this.mouse.y));
  }

  _drawLocker(ctx, r, hover) {
    ctx.save();
    const g = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
    g.addColorStop(0, '#20262c');
    g.addColorStop(0.5, '#323a42');
    g.addColorStop(1, '#1a1f24');
    ctx.fillStyle = g;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = hover ? '#ffb0a0' : '#0b0d10';
    ctx.lineWidth = hover ? 4 : 3;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    // Rendijas de ventilación y asa
    ctx.fillStyle = '#07090b';
    for (let i = 0; i < 6; i++) ctx.fillRect(r.x + 40, r.y + 60 + i * 22, r.w - 80, 8);
    ctx.fillStyle = '#5a646e';
    ctx.fillRect(r.x + r.w - 34, r.y + r.h / 2 - 30, 10, 60);
    // Abolladuras y óxido
    ctx.fillStyle = 'rgba(90,50,30,0.35)';
    ctx.fillRect(r.x + 12, r.y + r.h - 70, 60, 40);
    ctx.restore();
  }

  _drawInside(ctx) {
    const g = this.g;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    // Lo que se ve por las rendijas: la oficina a oscuras (y El Largo)
    ctx.save();
    ctx.beginPath();
    for (const s of SLITS) ctx.rect(s.x, s.y, s.w, s.h);
    ctx.clip();
    g.officeView.draw(ctx, g.office, {
      face: 'front', blackout: true, noPower: true, locked: true, night: 3, terminal: g.terminal, reactor: g.reactor,
      doorEnemies: { left: [], right: [] }, cameras: g.cameras,
    });
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    const p = this.pass;
    if (p) {
      // Entra por un lado, se para delante olisqueando y sale por el otro
      const k = p.k;
      const x = k < 0.3 ? -300 + 1100 * smooth(k / 0.3) : k < 0.7 ? 800 + Math.sin((k - 0.3) * 20) * 18 : 800 + 1100 * smooth((k - 0.7) / 0.3);
      drawCreature(ctx, 'largo', x, 1350, 1500, this.t, { pose: k > 0.3 && k < 0.7 ? 'lean' : 'stand', alpha: 0.95 });
    }
    ctx.restore();
    // Bordes de las rendijas
    ctx.strokeStyle = 'rgba(60,70,80,0.5)';
    ctx.lineWidth = 2;
    for (const s of SLITS) ctx.strokeRect(s.x, s.y, s.w, s.h);
    g.effects.vignette(ctx);
    g.effects.static(ctx, 0.04);
    // Respiración
    const held = this.holding && this.gasp <= 0;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '22px "Courier New", monospace';
    ctx.fillStyle = this.gasp > 0 ? '#ff6a5a' : '#c8d2dc';
    ctx.fillText(this.gasp > 0 ? 'Te has quedado sin aire...' : held ? 'Aguantando la respiracion' : 'MANTEN ESPACIO para aguantar la respiracion', W / 2, 700);
    const bw = 360;
    ctx.strokeStyle = '#6a7680';
    ctx.strokeRect(W / 2 - bw / 2, 740, bw, 16);
    ctx.fillStyle = this.breath < E.BREATH_MAX * 0.3 ? '#ff6a5a' : '#8fd0ff';
    ctx.fillRect(W / 2 - bw / 2 + 2, 742, (bw - 4) * (this.breath / E.BREATH_MAX), 12);
    ctx.restore();
  }
}
