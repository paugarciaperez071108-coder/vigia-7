// =============================================================
// Night5Leak.js — FINAL DE LA NOCHE 5: FUGA DE CRIOGENIA (v0.46).
// (Valores en NIGHT5.LEAK.)
//
// A las 6:00 no sale el texto de «6 AM»: se oye un instante la estática
// de El Errante (¿la ha roto él, o los golpes de estas noches?) y revienta
// una tubería de Criogenia (CAM 05). El refrigerante entra por debajo de
// las puertas:
//   - niebla blanca a ras de suelo que sube, escarcha en las paredes, la
//     pantalla congelándose por los bordes, vaho al respirar y temblor;
//   - alarma y megafonía: «Fuga criogénica. Sellando sección.»;
//   - las compuertas y el pasillo central se bloquean solos. Las rejillas
//     rotas por El Dislocado son la única salida (clic en una).
// Slaimi (si sigue vivo): hay que cogerlo (clic) y meterlo en la taquilla
// (pared de atrás, clic) antes de escapar; si no, se congela.
// Escapar: la vista se agacha y entra en el conducto, la niebla se queda
// atrás y se oye a la mujer desde el fondo, distorsionada por el metal
// (más aún si en la noche 4 hubo desmayo: ¿es ella o El Errante
// imitándola?). Unos segundos avanzando y fundido a negro.
// Si se acaba LEAK.TIME: muere congelado (pantalla blanca de escarcha) y
// se repite desde las 6:00 (punto de control 'n5seis').
// =============================================================

import { CONFIG } from '../config.js';
import { NIGHT5 } from '../night/night5.js';
import { OfficeTurn } from '../systems/OfficeTurn.js';
import { drawSlaimi } from '../systems/Slaimi.js';
import { GRILLES } from '../systems/Night5.js';
import { drawFog, drawWallFrost, drawEdgeFrost, drawBreath } from '../render/Frost.js';

const L = NIGHT5.LEAK;
const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const LOCKERS = { x: 140, y: 290, w: 374, h: 442 };
const DOOR = { x: 266, y: 300, w: 122, h: 424 };
const SLAIMI_AT = { front: [1230, 836], left: [330, 850], right: [1270, 850], back: [1290, 850] };
const VIOLET = '143,107,255';

export class Night5Leak {
  constructor(game) {
    this.g = game;
    this.look = new OfficeTurn();
    this.mouse = { x: W / 2, y: H / 2 };
  }

  /** slaimi: 'vivo' | 'muerto' | 'congelado'. */
  start(slaimi) {
    const g = this.g;
    this.phase = 'leak';
    this.t = 0;
    this.time = 0;
    this.done = false;
    this.look.reset();
    this.look.enabled = true;
    this.slaimi = slaimi;
    this.slaimiFace = g.slaimi.side && SLAIMI_AT[g.slaimi.side] ? g.slaimi.side : 'front';
    this.carried = false;
    this.stored = false;
    this.frozenT = slaimi === 'vivo' ? -1 : 0;     // ≥0: congelándose / congelado
    this.puffs = [];
    this.breathIn = 1.5;
    this.crackIn = 1;
    this.cues = new Set();
    this.locked = false;
    g.slaimi.active = false;                // lo dibuja esta escena
    g.cameras.forceClose();
    g.cameras.setEnabled(false);
    g.terminal.blur?.();
    // Las dos rejillas tienen que estar rotas (son la salida)
    for (const s of ['left', 'right']) g.n5.grilles[s].broken = true;
    g.ai.dislocado && (g.ai.dislocado.state = 'off', g.ai.dislocado.room = null);
    // ¿La ha roto El Errante? Un instante de su estática antes de reventar
    g.n5.snd.errBlip(L.STATIC_BLIP, 0.55);
  }

  _cue(id, at, fn) {
    if (this.t >= at && !this.cues.has(id)) {
      this.cues.add(id);
      fn();
    }
  }

  get k() {
    return Math.min(1, this.t / L.TIME);
  }

  update(dt) {
    if (this.done) return;
    this.time += dt;
    const g = this.g;
    const snd = g.n5.snd;
    if (this.phase === 'leak') {
      this.t += dt;
      this.look.update(dt);
      this._cue('burst', L.STATIC_BLIP + 0.05, () => {
        snd.pipeBurst();
        g.audio.powerDown?.();
      });
      this._cue('pa', L.PA_AT, () => {
        snd.alarm(true);
        snd.playFile(L.PA_FILE, 0.9);
      });
      this._cue('lock', L.LOCK_AT, () => {
        // Se sellan las compuertas y el pasillo central
        for (const s of ['left', 'right']) {
          if (!g.office.doors[s].closed) g.office.toggleDoor(s);
        }
        g.office.setLock('leak', true);
        g.audio.door?.('center', true);
        this.locked = true;
      });
      // Vaho y temblor
      this.breathIn -= dt;
      if (this.breathIn <= 0) {
        this.breathIn = 2.6 - 1.2 * this.k;
        this.puffs.push({ t: 0, dur: 1.8, x: W / 2 + (Math.random() - 0.5) * 160 });
        if (this.k > 0.25) snd.shiver(0.12 + 0.25 * this.k);
      }
      this.crackIn -= dt;
      if (this.crackIn <= 0) {
        this.crackIn = 1.5 + Math.random() * 2.5 * (1 - this.k);
        snd.crackle(0.1 + 0.2 * this.k);
      }
      // Slaimi se congela si no está en la taquilla a tiempo
      if (this.slaimi === 'vivo' && !this.stored && this.frozenT < 0 && this.t >= L.SLAIMI_TIME) this._freezeSlaimi();
      if (this.frozenT >= 0 && this.slaimi === 'vivo') this.frozenT += dt;
      if (this.t >= L.TIME) {
        this.phase = 'dead';
        this.deadT = 0;
        snd.stop();
        g.audio.lib?.play('caidas/silla', { volume: 0.5, muffle: 0.6 });
      }
    } else if (this.phase === 'dead') {
      this.deadT += dt;
      if (this.deadT >= L.DEATH_TIME) {
        this.done = true;
        g._n5LeakRetry();
      }
    } else if (this.phase === 'duct') {
      this.ductT += dt;
      if (this.ductT >= L.VOICE_AT && !this.cues.has('voz')) {
        this.cues.add('voz');
        const desmayo = !!g.save?.flags?.finalDesmayo;
        snd.playVoice(desmayo ? L.VOICE_FILE_DESMAYO : L.VOICE_FILE, desmayo);
      }
      if (Math.random() < dt * 1.4) g.audio.lib?.play('metal/golpe_pared', { volume: 0.12, pitch: 1.6, muffle: 0.6 });
      if (this.ductT >= L.DUCT_TIME + L.FADE && !this.done) {
        this.done = true;
        g._n5End({ slaimi: this._slaimiResult() });
      }
    }
    for (const p of this.puffs) p.t += dt;
    this.puffs = this.puffs.filter((p) => p.t < p.dur);
  }

  _freezeSlaimi() {
    this.frozenT = 0;
    this.carried = false;
    this.g.audio.lib?.play('slaimi/gemido', { volume: 0.35, pitch: 0.8 });
    this.g.n5.snd.crackle(0.5);
  }

  _slaimiResult() {
    if (this.slaimi === 'muerto') return 'muerto';
    if (this.slaimi === 'congelado') return 'congelado';
    return this.stored ? 'taquilla' : 'congelado';
  }

  /** Clic en una rejilla rota: se mete en el conducto. */
  _escape(side) {
    const g = this.g;
    if (this.slaimi === 'vivo' && !this.stored && this.frozenT < 0) this._freezeSlaimi();   // lo deja atrás
    this.phase = 'duct';
    this.ductT = 0;
    this.side = side;
    g.n5.snd.alarm(false);
    g.audio.lib?.play('metal/panel', { volume: 0.6, pan: side === 'left' ? -0.5 : 0.5 });
    g.audio.lib?.play('pasos/metal', { volume: 0.4, when: 0.4, muffle: 0.4 });
    g.audio.setMasterLevel?.(0, L.DUCT_TIME + L.FADE);
  }

  // ---------------------------------------------------------------
  _slaimiScreen() {
    if (this.carried) return { x: Math.max(260, Math.min(W - 260, this.mouse.x)), y: H - 40, size: 190 };
    const [x, y] = SLAIMI_AT[this.slaimiFace];
    return { x, y, size: 150 };
  }

  _grilleAt(x, y) {
    if (!this.look.isFacing('front')) return null;
    const p = this.g.officeView.pan;
    const sx = (x - 800 - p.x) / p.s + 800;
    const sy = (y - 450 - p.y) / p.s + 450;
    return ['left', 'right'].find((s) => inside(GRILLES[s], sx, sy)) ?? null;
  }

  move(x, y) {
    this.mouse = { x, y };
    if (this.phase !== 'leak') return false;
    if (this.look.hover(x, y)) return true;
    if (this._grilleAt(x, y)) return true;
    if (this.slaimi === 'vivo' && this.frozenT < 0 && !this.stored && !this.carried && this.look.isFacing(this.slaimiFace)) {
      const s = this._slaimiScreen();
      if (Math.hypot(x - s.x, y - (s.y - s.size * 0.45)) < s.size * 0.75) return true;
    }
    return this.look.isFacing('back') && this.carried && inside(LOCKERS, x, y);
  }

  click(x, y) {
    if (this.phase !== 'leak') return;
    const over = this.move(x, y);
    const side = this._grilleAt(x, y);
    if (side) return this._escape(side);
    if (!over) return;
    if (this.slaimi === 'vivo' && this.frozenT < 0 && !this.stored && !this.carried && this.look.isFacing(this.slaimiFace)) {
      this.carried = true;
      this.g.audio.lib?.play('slaimi/gemido', { volume: 0.3 });
      return;
    }
    if (this.carried && this.look.isFacing('back') && inside(LOCKERS, x, y)) {
      this.carried = false;
      this.stored = true;
      this.g.audio.door?.('center', true);
      this.g.audio.lib?.play('slaimi/calma', { volume: 0.4, when: 0.4 });
    }
  }

  key(code) {
    if (this.phase !== 'leak') return;
    if (code === CONFIG.LOOK_BACK.KEY) this.look.toggle();
    else if (code === 'ArrowLeft' || code === 'ArrowRight') {
      this.look.queue = [];
      this.look.step(code === 'ArrowLeft' ? -1 : 1);
    }
  }

  // ---------------------------------------------------------------
  draw(ctx) {
    if (this.phase === 'duct') return this._drawDuct(ctx);
    const k = this.k;
    const g = this.g;
    const shake = this.phase === 'leak' ? (0.6 + 3.5 * k) * (this.t < 0.9 && this.t > L.STATIC_BLIP ? 6 : 1) : 0;
    ctx.save();
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    this.look.draw(ctx, {
      front: (c) => this._wall(c, 'front'),
      left: (c) => this._wall(c, 'left'),
      right: (c) => this._wall(c, 'right'),
      back: (c) => this._wall(c, 'back'),
    });
    ctx.restore();
    if (this.carried) this._drawSlaimi(ctx, this._slaimiScreen());
    // El frío
    drawFog(ctx, L.FOG_MAX * Math.min(1, k * 1.3), this.time);
    drawBreath(ctx, this.puffs);
    drawEdgeFrost(ctx, Math.pow(k, 1.3));
    // Luz roja de la alarma
    if (this.t > L.PA_AT && Math.floor(this.time * 1.6) % 2 === 0) {
      ctx.fillStyle = 'rgba(160,0,0,0.12)';
      ctx.fillRect(0, 0, W, H);
    }
    g.effects.vignette(ctx, 1.1 + 0.3 * k);
    if (this.phase === 'leak') this.look.drawStrips(ctx);
    // Contorno de lo que se puede tocar
    if (this.phase === 'leak') {
      const side = this._grilleAt(this.mouse.x, this.mouse.y);
      if (side) this._outline(ctx, GRILLES[side], true);
      if (this.carried && this.look.isFacing('back') && inside(LOCKERS, this.mouse.x, this.mouse.y)) this._outline(ctx, DOOR);
    }
    if (this.phase === 'dead') {
      const u = Math.min(1, this.deadT / 1.4);
      drawEdgeFrost(ctx, 1);
      ctx.fillStyle = `rgba(238,246,255,${u})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  _wall(c, face) {
    const g = this.g;
    if (face === 'back') {
      g.backView.draw(c, { open: 0, sealed: this.locked, red: 0.3 });
    } else {
      g._drawOfficeFront(c, face);
    }
    drawWallFrost(c, Math.min(1, this.k * 1.4));
    if (face === 'back') this._drawLockerState(c);
    if (!this.carried && (this.slaimi === 'vivo') && !this.stored && face === this.slaimiFace) this._drawSlaimi(c, this._slaimiScreen());
  }

  _drawSlaimi(ctx, s) {
    const frozen = this.frozenT >= 0;
    const life = frozen ? Math.max(0, 1 - this.frozenT / 6) : 1;
    if (life > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const r = 220 * life;
      const gl = ctx.createRadialGradient(s.x, s.y - s.size * 0.45, 0, s.x, s.y - s.size * 0.45, r);
      gl.addColorStop(0, `rgba(${VIOLET},${0.3 * life})`);
      gl.addColorStop(1, `rgba(${VIOLET},0)`);
      ctx.fillStyle = gl;
      ctx.fillRect(s.x - r, s.y - s.size * 0.45 - r, r * 2, r * 2);
      ctx.restore();
    }
    const shake = frozen ? 0 : (1 + 3 * this.k) * (Math.random() - 0.5);
    drawSlaimi(ctx, s.x + shake, s.y, s.size, { t: frozen ? 0 : this.time, sad: true, squash: frozen ? 0 : 0.3 + 0.2 * Math.sin(this.time * 25), sprites: this.g.sprites });
    if (frozen) {
      // Atrapado en hielo
      ctx.save();
      ctx.fillStyle = `rgba(205,228,250,${0.25 + 0.35 * Math.min(1, this.frozenT / 3)})`;
      ctx.strokeStyle = 'rgba(245,252,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x - s.size * 0.75, s.y + 6);
      ctx.lineTo(s.x - s.size * 0.6, s.y - s.size * 1.15);
      ctx.lineTo(s.x + s.size * 0.1, s.y - s.size * 1.3);
      ctx.lineTo(s.x + s.size * 0.7, s.y - s.size * 1.0);
      ctx.lineTo(s.x + s.size * 0.75, s.y + 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawLockerState(c) {
    if (!this.stored) return;
    // Slaimi a salvo dentro: su luz por las rendijas
    c.save();
    c.globalCompositeOperation = 'lighter';
    const cx = DOOR.x + DOOR.w / 2;
    const a = 0.35 + 0.05 * Math.sin(this.time * 2);
    c.fillStyle = `rgba(${VIOLET},${a})`;
    for (let i = 0; i < 5; i++) c.fillRect(DOOR.x + 22, DOOR.y + 26 + i * 11, DOOR.w - 44, 3);
    const g = c.createRadialGradient(cx, DOOR.y + 70, 0, cx, DOOR.y + 70, 180);
    g.addColorStop(0, `rgba(${VIOLET},${0.2})`);
    g.addColorStop(1, `rgba(${VIOLET},0)`);
    c.fillStyle = g;
    c.fillRect(cx - 200, DOOR.y - 120, 400, 400);
    c.restore();
  }

  _outline(ctx, r, scene = false) {
    ctx.save();
    if (scene) {
      const p = this.g.officeView.pan;
      ctx.translate(800 + p.x, 450 + p.y);
      ctx.scale(p.s, p.s);
      ctx.translate(-800, -450);
    }
    ctx.strokeStyle = 'rgba(232,238,245,0.3)';
    ctx.lineWidth = 3;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }

  /** Dentro del conducto: agachado, oscuro, la niebla quedándose atrás. */
  _drawDuct(ctx) {
    const t = this.ductT;
    const g = this.g;
    const crouch = Math.min(1, t / 0.9);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (t < 0.9) {
      // Agacharse: la oficina sube y se acerca a la rejilla
      const r = GRILLES[this.side];
      ctx.save();
      const z = 1 + 2.2 * crouch;
      ctx.translate(W / 2, H / 2 - 260 * crouch);
      ctx.scale(z, z);
      ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
      g._drawOfficeFront(ctx, 'front');
      ctx.restore();
      drawFog(ctx, L.FOG_MAX, this.time);
      ctx.fillStyle = `rgba(0,0,0,${crouch})`;
      ctx.fillRect(0, 0, W, H);
      return;
    }
    const u = (t - 0.9) / L.DUCT_TIME;
    // El interior del conducto (la cámara del lateral de ese lado), avanzando
    ctx.save();
    const z = 1.15 + 0.6 * u;
    const bob = Math.sin(t * 6) * 8;
    ctx.translate(W / 2, H / 2 + bob);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2);
    ctx.filter = 'brightness(0.55) contrast(1.2)';
    if (!g.sprites.draw(ctx, `cam_${this.side === 'left' ? 'v7' : 'v6'}`, 0, 0, W, H)) {
      ctx.fillStyle = '#15191d';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
    // La niebla de la oficina, detrás, cada vez más lejos
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - u * 5);
    drawFog(ctx, 0.35 * (1 - u), this.time);
    ctx.restore();
    // Linterna débil del vigilante
    const lg = ctx.createRadialGradient(W / 2, H / 2 + 60, 30, W / 2, H / 2, H * 0.8);
    lg.addColorStop(0, 'rgba(0,0,0,0)');
    lg.addColorStop(1, 'rgba(0,0,0,0.92)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, W, H);
    g.effects.static(ctx, 0.05);
    if (t > L.DUCT_TIME) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (t - L.DUCT_TIME) / L.FADE)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}
