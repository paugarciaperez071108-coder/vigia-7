// =============================================================
// Night4Sleep.js — FINAL DE LA NOCHE 4, RUTA A: TE DUERMES (v0.38).
// (Valores en NIGHT4.SLEEP, src/night/night4.js.)
//
// Empieza a las SLEEP.START (5:30) en lugar de a las 6:00, sin ningún
// texto en pantalla:
//   - PÁRPADOS como en FNaF 3: negros, uno baja desde arriba y otro sube
//     desde abajo, lentos y pesados (cerrar, quedarse, abrir aún más lento).
//   - A los DILATE_AT s la visión se DILATA: bordes oscuros que se cierran
//     y laten, desenfoque y la imagen que se ondula.
//   - El protagonista dice en voz alta «Estoy cansado, debo ir a un sitio
//     seguro.» (protagonista/cansado; tools/voz_protagonista.py).
//   - Fase larga (DURATION s) llena de ALUCINACIONES QUE NO ATACAN:
//       · enemigos asomados en las puertas que desaparecen al alumbrarlos
//         (linterna, ESPACIO) o al parpadear;
//       · fantasmas de la tripulación (assets/n4/fantasmas, de
//         tools/3d/fantasmas.py) que cruzan la oficina o se quedan mirando;
//       · pasos, susurros y las voces de las 4 AM.
//   - Los enemigos DE VERDAD se acercan solo con los ojos cerrados, cada
//     vez en otra postura y otro sitio coherente (como si hubieran dado
//     unos pasos); con los ojos abiertos se quedan quietos, respirando.
// Hay que volver a la TAQUILLA (pared de atrás) donde empezó la noche.
// Si no llega a tiempo: CAE AL SUELO (la vista cae de golpe y queda
// ladeada, a ras de suelo, borrosa) y ve a El Largo acercarse por el
// pasillo central (assets/n4/caida, tools/3d/largo_suelo.py) mientras se
// le cierran los ojos. Fundido a negro y se repite desde las 3 AM.
// =============================================================

import { CONFIG } from '../config.js';
import { NIGHT4 } from '../night/night4.js';
import { drawCreature, setEyeShine } from '../render/CreatureArt.js';
import { Flashlight } from '../render/Flashlight.js';
import { OfficeTurn } from '../systems/OfficeTurn.js';

const SL = NIGHT4.SLEEP;
const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const lerp = (a, b, k) => a + (b - a) * k;
const rand = ([a, b]) => a + Math.random() * (b - a);
const pick = (l) => l[Math.floor(Math.random() * l.length)];
// Las taquillas de la pared de atrás (render de la oficina, OF_HUECOS)
const LOCKERS = { x: 140, y: 290, w: 374, h: 442 };
const FADE = 3.0;
// Los enemigos de verdad: en cada pared, una postura y un sitio por etapa
// (0 = lejos en la puerta … 3 = dentro de la oficina). [pose, x, pie, alto]
const REAL = {
  left: { kind: 'specimen', stages: [['stand', 800, 610, 250], ['lean', 760, 690, 400], ['crouch', 820, 770, 360], ['front', 800, 900, 760]] },
  right: { kind: 'frozen', stages: [['crawl', 800, 640, 200], ['front', 790, 650, 300], ['front', 820, 760, 520], ['front', 800, 905, 780]] },
  back: { kind: 'largo', stages: [['stand', 800, 620, 300], ['lean', 760, 700, 470], ['stand', 800, 800, 640], ['crouch', 800, 900, 700]] },
};
// Las falsas: se asoman por el marco de una puerta (no atacan)
const FAKE_SPOTS = { left: [700, 720, 470], right: [905, 720, 470], back: [690, 725, 480] };
const FAKE_KINDS = [['largo', 'lean'], ['specimen', 'lean'], ['frozen', 'front'], ['largo', 'stand']];

export class Night4Sleep {
  constructor(game) {
    this.g = game;
    this.look = new OfficeTurn();
    this.flash = new Flashlight();
    this.buf = document.createElement('canvas');
    this.buf.width = W;
    this.buf.height = H;
    this.bctx = this.buf.getContext('2d');
    this.buf2 = document.createElement('canvas');   // la imagen ya ondulada (un solo desenfoque al final)
    this.buf2.width = W;
    this.buf2.height = H;
    this.b2ctx = this.buf2.getContext('2d');
    this._loadSheets();
    this.start();
  }

  _loadSheets() {
    this.ghosts = null;
    this.fall = null;
    const load = (base, set) => fetch(base + '.json').then((r) => r.json()).then((d) => {
      const img = new Image();
      img.onload = () => set({ ...d, img });
      img.src = base + '.webp';
    }).catch(() => {});
    load('assets/n4/fantasmas', (d) => { this.ghosts = d; });
    load('assets/n4/caida', (d) => { this.fall = d; });
  }

  start() {
    this.t = 0;
    this.phase = 'sleepy';      // 'sleepy' → 'hidden' | 'falling' → 'floor'
    this.look.reset();
    this.look.enabled = true;
    this.flash.reset();
    this.flash.taken = true;
    this.flash.on = true;
    this.mouse = { x: W / 2, y: H / 2 };
    this.blinkIn = SL.FIRST_BLINK;
    this.blink = null;           // { t, closed, moved }
    this.stage = -1;             // etapa de los de verdad (-1 = aún no se ven)
    this.fakes = [];             // { face, kind, pose, x, y, h, t, lit, gone }
    this.ghostList = [];         // { name, mode, face, x, y, h, t, dur, dir }
    this.fakeIn = rand(SL.FAKE_EVERY) * 0.5;
    this.ghostIn = rand(SL.GHOST_EVERY) * 0.4;
    this.stepIn = 2;
    this.said = false;
    this.done = false;
    this.log = [];
    this.hideT = 0;
    this.fallT = 0;
  }

  /** 0..1 de la fase (para el ritmo de los parpadeos y las alucinaciones). */
  get k() {
    return Math.min(1, this.t / SL.DURATION);
  }

  _note(type, data = {}) {
    this.log.push({ t: +this.t.toFixed(2), type, ...data });
  }

  _play(key, opts = {}) {
    return this.g.audio.lib?.play(key, opts) ?? false;
  }

  /** 0 = ojos abiertos … 1 = cerrados (FNaF 3: cerrar, quedarse, abrir más lento). */
  get lids() {
    const b = this.blink;
    if (!b) return 0;
    const c = SL.CLOSE_TIME;
    const o = SL.OPEN_TIME;
    const ease = (u) => u * u * (3 - 2 * u);
    if (b.t < c) return ease(b.t / c);
    if (b.t < c + b.closed) return 1;
    const u = (b.t - c - b.closed) / o;
    // Al abrir, los párpados pesan: se vuelven a caer un poco a mitad
    return Math.max(0, 1 - ease(Math.min(1, u)) + 0.18 * Math.sin(Math.min(1, u) * Math.PI));
  }

  get dilation() {
    return this.t < SL.DILATE_AT ? 0 : Math.min(1, (this.t - SL.DILATE_AT) / SL.DILATE_RAMP);
  }

  // ---------------------------------------------------------------
  update(dt) {
    if (this.done) return;
    this.t += dt;
    this.flash.update(dt);
    if (this.phase === 'hidden') {
      this.hideT += dt;
      if (this.hideT >= FADE) {
        this.done = true;
        this.g._n4SleepEnd();
      }
      return;
    }
    if (this.phase === 'falling' || this.phase === 'floor') return this._updateFall(dt);
    // Cansado: gira más despacio
    this.look.update(dt * SL.TURN_SLOW);
    const k = this.k;
    if (!this.said && this.t >= SL.VOICE_AT) {
      this.said = true;
      this._play('protagonista/cansado', { volume: 1, pitchVar: 0, volVar: 0 });
      this._note('frase', {});
    }
    // Susurros y voces de las 4 AM, cada vez más
    if (this.g.voices?.active && this.g.audio.ctx) this.g.voices.update(dt, 0.55 + 0.45 * k);
    this.stepIn -= dt;
    if (this.stepIn <= 0) {
      this.stepIn = rand([2.5, 5.5]) * (1 - 0.5 * k);
      this._play(pick(['pasos/metal', 'largo/pasos']), { volume: rand([0.08, 0.25]), pan: rand([-1, 1]), muffle: rand([0.3, 0.8]) });
    }
    this._updateBlink(dt, k);
    this._updateFakes(dt);
    this._updateGhosts(dt);
    if (this.t >= SL.DURATION) this._startFall();
  }

  _updateBlink(dt, k) {
    if (this.blink) {
      this.blink.t += dt;
      if (!this.blink.moved && this.blink.t >= SL.CLOSE_TIME) {
        // Con los ojos cerrados: lo falso se va, lo de verdad avanza
        this.blink.moved = true;
        for (const f of this.fakes) f.gone = Math.min(f.gone ?? 1, 0.01);
        this.ghostList = this.ghostList.filter(() => Math.random() < 0.5);
        const target = Math.min(3, Math.floor(k * 4.2) - 1);
        if (target > this.stage) {
          this.stage = target;
          // Unos pasos con peso, cada uno con su sonido
          const steps = { left: 'pasos/metal', right: 'pasos/metal', back: 'largo/pasos' };
          for (const [face, key] of Object.entries(steps)) {
            const pan = { left: -0.8, right: 0.8, back: 0 }[face];
            [0, 0.45].forEach((w, i) => this._play(key, { volume: 0.18 + 0.1 * this.stage, pan, when: w + Math.random() * 0.1, muffle: 0.5 - 0.1 * this.stage + i * 0.1 }));
          }
          this._note('se acercan', { etapa: this.stage });
        }
      }
      if (this.blink.t >= SL.CLOSE_TIME + this.blink.closed + SL.OPEN_TIME) this.blink = null;
    } else {
      this.blinkIn -= dt;
      if (this.blinkIn <= 0) {
        this.blink = { t: 0, closed: lerp(SL.BLINK_CLOSED[0], SL.BLINK_CLOSED[1], k), moved: false };
        this.blinkIn = lerp(SL.BLINK_EVERY[0], SL.BLINK_EVERY[1], k);
        this._note('parpadeo', {});
      }
    }
  }

  _updateFakes(dt) {
    this.fakeIn -= dt;
    const busy = new Set(this.fakes.map((f) => f.face));
    if (this.fakeIn <= 0) {
      this.fakeIn = rand(SL.FAKE_EVERY) * (1 - 0.4 * this.k);
      const faces = ['left', 'right', 'back'].filter((f) => !busy.has(f));
      if (faces.length) {
        const face = pick(faces);
        const [kind, pose] = pick(FAKE_KINDS);
        const [x, y, h] = FAKE_SPOTS[face];
        this.fakes.push({ face, kind, pose, x, y, h, t: 0, lit: 0, gone: null });
        this._note('alucinacion', { tipo: kind, pared: face });
      }
    }
    for (const f of this.fakes) {
      f.t += dt;
      if (f.gone !== null) f.gone -= dt;
      else if (this.look.isFacing(f.face) && this.flash.on && !this.flash.blinkOff &&
               Math.hypot(this.mouse.x - f.x, this.mouse.y - (f.y - f.h * 0.75)) < 160) {
        f.lit += dt;
        if (f.lit >= SL.FAKE_LIGHT) {
          f.gone = 0.25;            // se desvanece con un temblor
          this.flash.blink(1, 0.15);
        }
      }
      if (f.t > 14 && f.gone === null) f.gone = 0.6;
    }
    this.fakes = this.fakes.filter((f) => f.gone === null || f.gone > 0);
  }

  _updateGhosts(dt) {
    this.ghostIn -= dt;
    if (this.ghostIn <= 0 && this.ghosts) {
      this.ghostIn = rand(SL.GHOST_EVERY) * (1 - 0.4 * this.k);
      const name = pick(Object.keys(this.ghosts.gente));
      // La mayoría, en la pared que estás mirando (que se vean)
      const face = Math.random() < 0.7 ? this.look.face : pick(['front', 'left', 'right', 'back']);
      if (Math.random() < 0.55) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        this.ghostList.push({ name, mode: 'andar', face, dir, x: dir > 0 ? -150 : W + 150, y: 880, h: 560, t: 0, dur: 99 });
      } else {
        this.ghostList.push({ name, mode: 'quieto', face, x: rand([380, 1220]), y: 870, h: 600, t: 0, dur: rand([2.5, 4.5]) });
      }
      this._note('fantasma', { quien: name, pared: face });
    }
    for (const g of this.ghostList) {
      g.t += dt;
      if (g.mode === 'andar') g.x += g.dir * SL.GHOST_SPEED * dt;
    }
    this.ghostList = this.ghostList.filter((g) => g.t < g.dur && g.x > -300 && g.x < W + 300);
  }

  _startFall() {
    this.phase = 'falling';
    this.fallT = 0;
    this.blink = null;
    this.g.voices?.stop();
    this._play('tropiezos/tropiezo', { volume: 0.9 });
    this._play('caidas/silla', { volume: 0.6, when: 0.35 });
    this._note('cae', {});
  }

  _updateFall(dt) {
    this.fallT += dt;
    if (this.phase === 'falling' && this.fallT >= SL.FALL_DROP) {
      this.phase = 'floor';
      this.fallT = 0;
      [0, 1.6, 3.1, 4.5, 5.9, 7.2].forEach((w, i) => this._play('largo/pasos', { volume: 0.25 + i * 0.1, when: 0.9 + w, muffle: 0.5 - i * 0.07 }));
      this._play('largo/respiracion', { volume: 0.7, when: 8.5 });
    }
    if (this.phase === 'floor' && this.fallT >= SL.FLOOR_TIME + FADE) {
      this.done = true;
      this._note('fin caida', {});
      this.g._n4SleepFall();
    }
  }

  // ---------------------------------------------------------------
  move(x, y) {
    this.mouse = { x, y };
    if (this.phase !== 'sleepy') return false;
    if (this.look.hover(x, y)) return true;
    return this.look.isFacing('back') && inside(LOCKERS, x, y);
  }

  click(x, y) {
    this.move(x, y);
    if (this.done || this.phase !== 'sleepy') return;
    if (this.look.isFacing('back') && inside(LOCKERS, x, y)) {
      this.phase = 'hidden';
      this.hideT = 0;
      this.g.audio.door?.('center', true);
      this.g.voices?.stop();
      this.g.audio.setMasterLevel?.(0.0, FADE);
      this._note('taquilla', {});
    }
  }

  release() {}

  key(code) {
    if (this.phase !== 'sleepy') return;
    if (code === 'Space') {
      this.flash.toggle();
      this.g.audio.keyClick?.();
    } else if (code === CONFIG.LOOK_BACK.KEY) this.look.toggle();
    else if (code === 'ArrowLeft' || code === 'ArrowRight') this.look.step(code === 'ArrowLeft' ? -1 : 1);
  }

  keyUp() {}

  // ---------------------------------------------------------------
  draw(ctx) {
    if (this.phase === 'falling' || this.phase === 'floor') return this._drawFall(ctx);
    const g = this.g;
    const k = this.k;
    const d = this.dilation;
    // 1. La oficina (con lo que haya en cada pared) en un lienzo aparte
    const b = this.bctx;
    b.save();
    b.clearRect(0, 0, W, H);
    const sway = SL.SWAY * (0.4 + k);
    b.translate(Math.sin(this.t * 0.9) * sway, Math.sin(this.t * 1.3) * sway * 0.5);
    b.rotate(Math.sin(this.t * 0.7) * 0.006 * (1 + 2 * k));
    this.look.draw(b, {
      front: (c) => { g._drawOfficeFront(c, 'front'); this._drawFace(c, 'front'); },
      left: (c) => { g._drawOfficeFront(c, 'left'); this._drawFace(c, 'left'); },
      right: (c) => { g._drawOfficeFront(c, 'right'); this._drawFace(c, 'right'); },
      back: (c) => { g._drawBack(c); this._drawFace(c, 'back'); },
    });
    b.restore();
    this.flash.draw(b, this.mouse.x, this.mouse.y, null, SL.DARKNESS);
    // 2. La imagen que se ondula (en otro lienzo) y un único desenfoque
    let src = this.buf;
    const amp = d * SL.WARP;
    if (amp > 0.2) {
      const b2 = this.b2ctx;
      b2.fillStyle = '#000';
      b2.fillRect(0, 0, W, H);
      const zoom = 1 + 0.02 * d * Math.sin(this.t * 0.8);
      for (let y = 0; y < H; y += 12) {
        const dx = Math.sin(y * 0.013 + this.t * 1.6) * amp + Math.sin(y * 0.041 - this.t * 2.3) * amp * 0.35;
        b2.drawImage(this.buf, 0, y, W, 12, dx - (zoom - 1) * W / 2, (y - H / 2) * zoom + H / 2, W * zoom, 12 * zoom + 1);
      }
      src = this.buf2;
    }
    ctx.save();
    const blur = d * SL.BLUR_MAX * (0.7 + 0.3 * Math.sin(this.t * 1.1));
    if (blur > 0.2) ctx.filter = `blur(${blur.toFixed(1)}px)`;
    ctx.drawImage(src, 0, 0);
    ctx.restore();
    this.look.drawStrips(ctx);
    // 3. Visión que se cierra: bordes oscuros que laten
    g.effects.vignette(ctx, 0.9 + 0.4 * k);
    if (d > 0) {
      const r = lerp(W * 0.75, W * 0.36, d) * (1 + 0.05 * Math.sin(this.t * 2.4));
      const grd = ctx.createRadialGradient(W / 2, H / 2, r * 0.45, W / 2, H / 2, r);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(1, `rgba(0,0,0,${0.55 + 0.4 * d})`);
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
    }
    // 4. Párpados
    this._drawLids(ctx, this.phase === 'hidden' ? 1 : this.lids);
    if (this.phase === 'hidden') {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, this.hideT / (FADE * 0.6))})`;
      ctx.fillRect(0, 0, W, H);
      return;
    }
    if (this.look.isFacing('back') && inside(LOCKERS, this.mouse.x, this.mouse.y)) {
      ctx.save();
      ctx.strokeStyle = 'rgba(232,238,245,0.3)';
      ctx.lineWidth = 3;
      ctx.strokeRect(LOCKERS.x, LOCKERS.y, LOCKERS.w, LOCKERS.h);
      ctx.restore();
    }
  }

  /** Párpados de FNaF 3: negro opaco con el borde suave y curvado. */
  _drawLids(ctx, lid) {
    if (lid <= 0) return;
    const h = (H / 2 + 60) * lid;
    const curve = 90 * lid;
    for (const top of [true, false]) {
      ctx.save();
      if (!top) {
        ctx.translate(0, H);
        ctx.scale(1, -1);
      }
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.moveTo(-10, -10);
      ctx.lineTo(W + 10, -10);
      ctx.lineTo(W + 10, h - curve * 0.3);
      ctx.quadraticCurveTo(W / 2, h + curve, -10, h - curve * 0.3);
      ctx.closePath();
      ctx.fill();
      // borde suave (pestañas, sombra)
      const g = ctx.createLinearGradient(0, h - 10, 0, h + 50);
      g.addColorStop(0, 'rgba(0,0,0,0.85)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-10, h - curve * 0.3);
      ctx.quadraticCurveTo(W / 2, h + curve, W + 10, h - curve * 0.3);
      ctx.lineTo(W + 10, h - curve * 0.3 + 50);
      ctx.quadraticCurveTo(W / 2, h + curve + 50, -10, h - curve * 0.3 + 50);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  /** Lo que hay en una pared: los de verdad, los falsos y los fantasmas. */
  _drawFace(ctx, face) {
    // Fantasmas (detrás de todo, translúcidos y azulados)
    for (const g of this.ghostList) if (g.face === face) this._drawGhost(ctx, g);
    // De verdad: quietos con los ojos abiertos (solo respiran)
    const real = REAL[face];
    if (real && this.stage >= 0 && !this.g.n4dbg?.off.has(real.kind)) {
      const [pose, x, y, h] = real.stages[this.stage];
      ctx.save();
      setEyeShine(true);
      drawCreature(ctx, real.kind, x, y, h, this.t * 0.6, { pose, look: true, alpha: 0.95 });
      setEyeShine(false);
      ctx.restore();
    }
    if (face === 'front' && this.stage >= 1 && !this.g.n4dbg?.off.has('insecto')) {
      // El Insecto: ojos en los conductos del frente
      const s = this.stage / 3;
      for (const [x, y] of [[235, 470], [1365, 470]]) {
        ctx.save();
        ctx.fillStyle = `rgba(255,220,90,${0.35 + 0.6 * s})`;
        ctx.shadowColor = '#ffd84a';
        ctx.shadowBlur = 14;
        for (const dx of [-12 - 10 * s, 12 + 10 * s]) {
          ctx.beginPath();
          ctx.arc(x + dx, y, 4 + 5 * s, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }
    // Falsos (se asoman por el marco)
    for (const f of this.fakes) {
      if (f.face !== face) continue;
      const a = f.gone !== null ? Math.max(0, f.gone / 0.6) : Math.min(1, f.t / 0.8);
      ctx.save();
      if (f.gone !== null) ctx.translate((Math.random() - 0.5) * 10, 0);
      setEyeShine(true);
      drawCreature(ctx, f.kind, f.x, f.y, f.h, this.t, { pose: f.pose, look: true, alpha: 0.95 * a });
      setEyeShine(false);
      ctx.restore();
    }
  }

  _drawGhost(ctx, g) {
    const G = this.ghosts;
    if (!G) return;
    const info = G.gente[g.name]?.[g.mode];
    if (!info) return;
    const fi = g.mode === 'andar' ? Math.floor(g.t * G.fps) % info.frames : 0;
    const h = g.h;
    const w = h * G.w / G.h;
    const fadeIn = Math.min(1, g.t / 0.9);
    const fadeOut = g.mode === 'quieto' ? Math.min(1, (g.dur - g.t) / 1.0) : 1;
    const flick = 0.75 + 0.25 * Math.sin(g.t * 13 + g.x);
    ctx.save();
    ctx.globalAlpha = SL.GHOST_ALPHA * fadeIn * fadeOut * flick;
    ctx.filter = 'grayscale(1) brightness(1.5) sepia(0.35) hue-rotate(165deg) saturate(1.6)';
    ctx.translate(g.x, g.y);
    if (g.mode === 'andar' && g.dir < 0) ctx.scale(-1, 1);
    ctx.drawImage(G.img, fi * G.w, info.fila * G.h, G.w, G.h, -w / 2, -h * 0.97, w, h);
    ctx.restore();
  }

  _drawFall(ctx) {
    const g = this.g;
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (this.phase === 'falling') {
      // La vista cae de golpe al suelo y se ladea
      const u = Math.min(1, this.fallT / SL.FALL_DROP);
      const e = u * u;
      ctx.translate(W / 2, H / 2);
      ctx.rotate(-0.42 * e);
      ctx.translate(-W / 2, -H / 2 - 520 * e);
      ctx.filter = `blur(${(2 + 6 * e).toFixed(1)}px)`;
      ctx.drawImage(this.buf, 0, 0);
      ctx.restore();
      ctx.fillStyle = `rgba(0,0,0,${0.5 * e})`;
      ctx.fillRect(0, 0, W, H);
      return;
    }
    // En el suelo: El Largo se acerca por el pasillo (render 3D), borroso
    const F = this.fall;
    const t = this.fallT;
    if (F) {
      const i = Math.min(F.frames - 1, Math.floor(t * F.fps));
      const sx = (i % F.cols) * F.w;
      const sy = Math.floor(i / F.cols) * F.h;
      const shake = Math.max(0, 1 - t / 0.5) * 18;
      ctx.filter = `blur(${(2.2 + 0.8 * Math.sin(t * 1.3)).toFixed(1)}px)`;
      ctx.drawImage(F.img, sx, sy, F.w, F.h, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, W, H);
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';   // casi sin luz: a ras de suelo, medio inconsciente
    ctx.fillRect(0, 0, W, H);
    g.effects.vignette(ctx, 1.4);
    // Los ojos se van cerrando (cada vez más) hasta quedarse cerrados
    const closing = Math.min(1, Math.max(0, (t - SL.FLOOR_TIME * 0.45) / (SL.FLOOR_TIME * 0.55)));
    const flutter = closing < 1 ? 0.25 * Math.max(0, Math.sin(t * 1.7)) : 0;
    this._drawLids(ctx, Math.min(1, closing * 0.92 + flutter));
    if (t > SL.FLOOR_TIME) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (t - SL.FLOOR_TIME) / (FADE * 0.7))})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}
