// =============================================================
// Night3Ending.js — FINAL DE LA NOCHE 3: esconderse en las taquillas.
// (Valores en NIGHT3.ENDING, src/night/night3.js.)
//
// A las 6 AM no se gana todavía: las cámaras siguen rotas, se va la luz,
// suena la alarma y El Largo viene por el pasillo central.
//
//   0. 'arrival' Cinemática de llegada (NIGHT3.ARRIVAL, unos 9 s): en el
//               plano de las cámaras, en grande, los triángulos de colores
//               de cada enemigo aparecen y avanzan sala a sala hasta la
//               oficina, con pitidos cada vez más rápidos. Se puede saltar
//               (Enter o SALTAR). Al acabar, la fase 1 empieza sin pausa.
//               Solo se ve viniendo de la noche: Continuar desde el punto
//               de control va directo a la fase 1.
//   1. 'hide'   HIDE_TIME s para girarse hasta la pared de atrás y hacer
//               clic en una de las dos taquillas (a los lados de la
//               compuerta). Se le ve acercarse por el pasillo con la luz
//               roja. Si no te escondes a tiempo, te encuentra.
//   2. 'inside' Dentro de la taquilla, a oscuras, solo se ve la oficina por
//               las rendijas. El Largo entra y pasa por delante varias
//               veces (PASSES), por un lado y luego por el otro. Antes de
//               cada pasada sale un triángulo de aviso en el lado por el
//               que va a entrar y WARN_TRIANGLE s después aparece. Hay que AGUANTAR LA
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
import { warnColor, drawWarnTriangle } from '../render/CameraView.js';
import { drawSkipButton, SKIP_BUTTON } from '../ui/HUD.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const E = NIGHT3.ENDING;
const A = NIGHT3.ARRIVAL;

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

/**
 * Guion de la cinemática de llegada: cada enemigo aparece en la primera sala
 * de su ruta (por orden) y luego avanzan por turnos, una sala cada vez, con
 * pasos cada vez más seguidos (de STEP_FIRST a STEP_LAST s).
 */
function arrivalScript() {
  const steps = A.ORDER.map((id) => ({ id, to: 0 }));
  const pos = Object.fromEntries(A.ORDER.map((id) => [id, 0]));
  let moving = true;
  while (moving) {
    moving = false;
    for (const id of A.ORDER) {
      if (pos[id] < A.ROUTES[id].length - 1) {
        steps.push({ id, to: ++pos[id] });
        moving = true;
      }
    }
  }
  const r = Math.pow(A.STEP_LAST / A.STEP_FIRST, 1 / Math.max(1, steps.length - 2));
  let t = 0.4;
  steps.forEach((st, i) => {
    st.t = t;
    t += A.STEP_FIRST * Math.pow(r, i);
  });
  return { steps, end: steps[steps.length - 1].t + A.END_HOLD };
}

export class Night3Ending {
  constructor(game, opts = {}) {
    this.g = game;
    this.start(opts);
  }

  start({ arrival = false } = {}) {
    this.mouse = { x: W / 2, y: H / 2 };
    if (arrival) {
      this.phase = 'arrival';
      this.t = 0;
      this.script = arrivalScript();
      this.next = 0;                       // siguiente paso del guion
      this.at = {};                        // id → índice en su ruta (si ya ha aparecido)
      this.movedAt = {};                   // id → t del último paso (para el pulso)
      return;
    }
    this._beginHide();
  }

  /** Fase 1: se va la luz, suena la alarma y hay que esconderse. */
  _beginHide() {
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

  /** Pasada de El Largo por delante de la taquilla en curso: { k 0..1, side } o null. */
  get pass() {
    for (let i = 0; i < E.PASSES.length; i++) {
      const [a, b] = E.PASSES[i];
      if (this.t >= a && this.t <= b) return { k: (this.t - a) / (b - a), side: i % 2 ? 'right' : 'left' };
    }
    return null;
  }

  /** Aviso antes de una pasada: { side, k 0..1 hasta que aparece } o null. */
  get warning() {
    for (let i = 0; i < E.PASSES.length; i++) {
      const a = E.PASSES[i][0];
      if (this.t >= a - E.WARN_TRIANGLE && this.t < a) {
        return { side: i % 2 ? 'right' : 'left', k: 1 - (a - this.t) / E.WARN_TRIANGLE };
      }
    }
    return null;
  }

  update(dt) {
    const g = this.g;
    this.t += dt;
    if (this.phase === 'arrival') {
      const st = this.script.steps;
      while (this.next < st.length && this.t >= st[this.next].t) {
        const s = st[this.next];
        this.at[s.id] = s.to;
        this.movedAt[s.id] = this.t;
        // Pitido en cada paso, cada vez más agudo
        const k = this.next / Math.max(1, st.length - 1);
        g.audio.beep(A.BEEP_FROM + (A.BEEP_TO - A.BEEP_FROM) * k, 0.1 + 0.06 * k, 0.11);
        this.next++;
      }
      if (this.t >= this.script.end) this._beginHide();   // sin pausa: a esconderse
      return;
    }
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
    // Antes de cada pasada: triángulo de aviso (se dibuja) y se oye que se acerca
    E.PASSES.forEach(([a], i) => {
      if (!this.warned.has(i) && this.t >= a - E.WARN_TRIANGLE) {
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
    if (this.phase === 'arrival') return inside(SKIP_BUTTON, x, y);
    if (this.phase !== 'hide') return false;
    const strip = this.g.lookBack.hover(x, y);
    return strip || (this.g.lookBack.facingBack && !this.g.lookBack.moving && LOCKERS.some((r) => inside(r, x, y)));
  }

  click(x, y) {
    if (this.phase === 'arrival') {
      if (inside(SKIP_BUTTON, x, y)) this._beginHide();
      return;
    }
    if (this.phase !== 'hide' || !this.g.lookBack.facingBack || this.g.lookBack.moving) return;
    if (LOCKERS.some((r) => inside(r, x, y))) this._hide();
  }

  key(code) {
    const look = this.g.lookBack;
    if (this.phase === 'arrival') {
      if (code === 'Enter' || code === 'NumpadEnter') this._beginHide();
      return;
    }
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
    if (this.phase === 'arrival') this._drawArrival(ctx);
    else if (this.phase === 'hide') this._drawHide(ctx);
    else this._drawInside(ctx);
  }

  /** Cinemática de llegada: el plano en grande y los triángulos acercándose. */
  _drawArrival(ctx) {
    const g = this.g;
    const markers = [];
    const here = {};
    for (const id of A.ORDER) {
      if (!(id in this.at)) continue;
      const room = A.ROUTES[id][this.at[id]];
      const n = (here[room] = (here[room] ?? 0) + 1) - 1;
      const dx = room === 'office' ? -42 + n * 28 : -n * 24;
      const pulse = Math.max(0, 1 - (this.t - this.movedAt[id]) / 0.3);
      markers.push({ id, at: room, dx, pulse });
    }
    g.cameraView.drawArrivalMap(ctx, markers, g.effects, this.t);
    // Amenaza creciente: luz roja que late cada vez más rápido y más fuerte
    const k = Math.min(1, this.t / this.script.end);
    const beat = 0.5 + 0.5 * Math.sin(this.t * (4 + 10 * k));
    ctx.fillStyle = `rgba(255,20,10,${(0.04 + 0.14 * k) * beat})`;
    ctx.fillRect(0, 0, W, H);
    g.effects.vignette(ctx);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ff6a5a';
    ctx.font = 'bold 30px "Courier New", monospace';
    ctx.fillText('6:00 AM — LAS CAMARAS SIGUEN ROTAS', W / 2, 72);
    ctx.font = '22px "Courier New", monospace';
    ctx.fillStyle = '#ffd0c8';
    ctx.fillText(k < 0.55 ? 'Algo se mueve por la nave...' : 'Vienen todos a por ti', W / 2, 114);
    ctx.restore();
    drawSkipButton(ctx);
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
      // Entra por un lado (se le ve asomar desde el primer momento), se para
      // delante olisqueando y sale por el otro. Las pasadas alternan el lado.
      const k = p.k;
      let x = k < 0.3 ? 430 + 370 * smooth(k / 0.3) : k < 0.7 ? 800 + Math.sin((k - 0.3) * 20) * 18 : 800 + 1100 * smooth((k - 0.7) / 0.3);
      if (p.side === 'right') x = W - x;
      drawCreature(ctx, 'largo', x, 1350, 1500, this.t, { pose: k > 0.3 && k < 0.7 ? 'lean' : 'stand', alpha: 0.95 });
    }
    ctx.restore();
    // Bordes de las rendijas
    ctx.strokeStyle = 'rgba(60,70,80,0.5)';
    ctx.lineWidth = 2;
    for (const s of SLITS) ctx.strokeRect(s.x, s.y, s.w, s.h);
    g.effects.vignette(ctx);
    g.effects.static(ctx, 0.04);
    // Aviso especial: triángulo (color de El Largo) en el lado por el que va a
    // entrar; WARN_TRIANGLE s después aparece. Sale siempre, sin el ciclo del plano.
    const w = this.warning;
    if (w) {
      const x = w.side === 'left' ? SLITS[0].x + 40 : SLITS[0].x + SLITS[0].w - 40;
      const y = SLITS[0].y - 46;
      const pulse = 0.88 + 0.12 * Math.sin(this.t * (8 + 10 * w.k));
      drawWarnTriangle(ctx, x, y, warnColor('largo'), pulse, 2.2 + 0.4 * w.k);
    }
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
