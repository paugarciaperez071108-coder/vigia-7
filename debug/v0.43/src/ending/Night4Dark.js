// =============================================================
// Night4Dark.js — FINAL DE LA NOCHE 4, RUTA B (Slaimi): EL APAGÓN (v0.41).
// (Valores en NIGHT4.DARK, src/night/night4.js. El aviso de las 4:50 está
// en Game.js, _n4Warn.)
//
// Fases:
//   'dark'   5:00, apagón total (lo provoca El Errante). La única luz
//            es la de Slaimi, de su color. Vienen a por él: pasos por varios
//            lados, arañazos, respiraciones; Slaimi tiembla, encoge y su luz
//            parpadea. Clic en Slaimi: lo coges (su luz va contigo); girarse
//            a la pared de atrás y clic en la TAQUILLA: escondido.
//   'defend' 5:00 → 6:00 a oscuras con la linterna (ESPACIO). Por las
//            rendijas de la taquilla sale un hilo de luz de Slaimi (se apaga
//            un momento cuando alguien pasa cerca). Entran por las compuertas
//            y el pasillo central: invisibles hasta que se les alumbra; luz en
//            la cara, cambian de postura (POSE_WINDOW s para volver a
//            enfocarla) o de sitio (MOVE_WINDOW s); con RETIRE_TIME s de luz
//            se van. Si uno llega a la taquilla sin que lo alumbres, se lleva
//            a Slaimi. Slaimi SE ASUSTA de vez en cuando: gime bajito y su luz
//            se escapa por las rendijas y los atrae (entran antes); clic en la
//            taquilla lo calma; si no se calma en CALM_LIMIT s, uno va directo
//            a la taquilla.
//   'taken'  Se llevan a Slaimi: la puerta se abre de golpe, lo arrastran
//            fuera de la imagen y su luz se apaga. Se repite desde las 5:00.
//   'dawn'   6:00 (sin texto de «6:00 AM», v0.43): dejan de atacar. Las
//            cámaras DE VERDAD se abren solas con la batería de emergencia
//            (minimapa y teclas, como una noche normal). En ellas, la escena:
//            los enemigos se retiran por su camino (RETREAT) y El Errante
//            espera en la CAM 10. La imagen se TRABA (pocas imágenes por
//            segundo, saltos, congelaciones que vuelven con todo en otro
//            sitio): la señal no da abasto, algo interfiere. Cuanto más cerca
//            de la CAM 10 está la cámara, más se traba. Si no encuentra su
//            cámara, su zumbido le guía (cada vez más fuerte). En la CAM 10,
//            en cada salto está más cerca; si cambias de cámara y vuelves, ya
//            no está. Al bajar el monitor, alucinaciones en la oficina. Hay que
//            ir a la taquilla con Slaimi:
//   'asleep' Dentro: Slaimi parpadea tranquilo, te duermes, negro, fin.
//   'faint'  FINAL ALTERNATIVO, EL DESMAYO: si le miras STARE_LIMIT s
//            seguidos (o tardas DAWN_LIMIT s en esconderte), te salta encima;
//            negro, cuerpo que cae, pitido de oído, parpadeos lentos desde el
//            suelo, Slaimi se acerca brillando y te arrastra a la taquilla.
//            No era real: no te mata, te rompe la mente. Cuenta como noche
//            superada (flag finalDesmayo).
// =============================================================

import { CONFIG } from '../config.js';
import { NIGHT4 } from '../night/night4.js';
import { N2END } from '../night/night2ending.js';
import { ROOMS, LINKS } from '../world/StationMap.js';
import { OFFICE_SPOTS, POSES, faceOf, drawEnemy } from '../render/FirstPersonView.js';
import { drawCreature, setEyeShine } from '../render/CreatureArt.js';
import { glitchSlices } from '../render/Atmosphere.js';
import { Flashlight } from '../render/Flashlight.js';
import { OfficeTurn } from '../systems/OfficeTurn.js';
import { drawSlaimi } from '../systems/Slaimi.js';

const D = NIGHT4.DARK;
const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const lerp = (a, b, k) => a + (b - a) * k;
const rand = ([a, b]) => a + Math.random() * (b - a);
const pick = (l) => l[Math.floor(Math.random() * l.length)];
const range = (pair, k) => [lerp(pair[0][0], pair[1][0], k), lerp(pair[0][1], pair[1][1], k)];
const VIOLET = '143,107,255';            // el color de Slaimi (NIGHT4.SLAIMI.COLOR)

// Las taquillas de la pared de atrás (render de la oficina) y la puerta de
// la de Slaimi (la del medio)
const LOCKERS = { x: 140, y: 290, w: 374, h: 442 };
const DOOR = { x: 266, y: 300, w: 122, h: 424 };
// Dónde está Slaimi en cada pared (como en Slaimi.drawInOffice)
const SLAIMI_AT = { front: [1230, 836], left: [330, 850], right: [1270, 850], back: [1290, 850] };
// Por dónde entran: [x, y de los pies, altura]. Compuertas: en el marco o al
// fondo (OFFICE_SPOTS, como en la 2.5); pasillo central: en la boca o al fondo.
const SPOTS = {
  left: OFFICE_SPOTS.filter((s) => s[3] === 'left').map(([x, y, h]) => [x, y, h]),
  right: OFFICE_SPOTS.filter((s) => s[3] === 'right').map(([x, y, h]) => [x, y, h]),
  back: [[800, 722, 400], [800, 650, 215]],
};
const LOCKER_SPOT = [[620, 905, 600], [700, 880, 560]];  // el que va directo a la taquilla (ya dentro)
const PAN = { left: -0.8, right: 0.8, back: 0, front: 0 };
const SND = {
  largo: { breath: 'largo/respiracion', steps: 'largo/pasos', gap: 1.1 },
  specimen: { breath: 'criaturas/respiracion', steps: 'pasos/metal', gap: 0.45 },
};
const STUT = D.STUTTER;
// La pestaña para subir el monitor desde la oficina (= MONITOR_TAB de CameraView)
const LOWER_TAB = { x: 560, y: 846, w: 480, h: 42 };
// Saltos en el plano desde la cámara de El Errante (para «cuánto se traba»)
const DIST = (() => {
  const d = { [D.ERRANTE_CAM]: 0 };
  const queue = [D.ERRANTE_CAM];
  while (queue.length) {
    const r = queue.shift();
    for (const [a, b] of LINKS) {
      const n = a === r ? b : b === r ? a : null;
      if (n && ROOMS[n] && d[n] === undefined) {
        d[n] = d[r] + 1;
        queue.push(n);
      }
    }
  }
  return d;
})();
const MAX_DIST = Math.max(1, ...Object.values(DIST));
// La retirada de las 6:00, cámara a cámara (en el tiempo de la imagen trabada):
// [tipo, postura, desde [x, pies, alto], hasta [x, pies, alto], empieza (s), dura (s)]
// Corredores: se alejan hacia el fondo; salas: las cruzan.
const RETREAT = {
  westHall: [['largo', 'stand', [620, 880, 430], [790, 520, 70], 0, 8], ['specimen', 'hall', [980, 900, 340], [820, 525, 60], 0.8, 8.5]],
  eastHall: [['specimen', 'lean', [900, 890, 340], [800, 520, 60], 0.4, 8], ['frozen', 'crawl', [600, 900, 200], [790, 530, 40], 1.4, 9]],
  greenhouse: [['largo', 'stand', [1500, 820, 380], [120, 800, 380], 7.5, 6], ['specimen', 'hall', [1620, 830, 320], [220, 810, 320], 8.8, 6]],
  hangar: [['specimen', 'lean', [1520, 830, 330], [140, 815, 330], 8.5, 6], ['frozen', 'crawl', [1600, 850, 180], [260, 840, 180], 9.6, 6.5]],
  mess: [['largo', 'stand', [1480, 830, 400], [150, 810, 400], 12, 4.5], ['specimen', 'hall', [1600, 840, 330], [260, 820, 330], 12.8, 4]],
  medbay: [['frozen', 'crawl', [1500, 860, 190], [200, 850, 190], 12.5, 4], ['specimen', 'lean', [1620, 840, 330], [300, 820, 330], 13, 3.8]],
};

// --- Imágenes de El Errante (tools/3d/enemigos/el_que_mira.py; en archivos sigue «mira») ---
const IMG = {};
const load = (key, src) => {
  const img = new Image();
  img.onload = () => { IMG[key] = img; };
  img.src = src;
};
for (let i = 0; i < 4; i++) load(`cam${i}`, `assets/n4/mira/mira_cam_${i}.jpg`);
load('vacia', 'assets/n4/mira/mira_cam_vacia.jpg');
load('cara', 'assets/n4/mira/mira_cara.jpg');
load('frente', 'assets/n4/mira/mira_recorte_frente.webp');
load('espaldas', 'assets/n4/mira/mira_recorte_espaldas.webp');

/**
 * El Errante recortado (de pie, quieto; la cara siempre a la cámara),
 * con los pies en (x, y) y alto h. Para las alucinaciones y el modo debug
 * («verlo en cualquier cámara»).
 */
export function drawErrante(ctx, x, y, h, { variant = 'espaldas', alpha = 1, dark = 0 } = {}) {
  const img = IMG[variant];
  if (!img) return false;
  const w = h * img.width / img.height;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (dark) ctx.filter = `brightness(${1 - dark})`;
  ctx.drawImage(img, x - w / 2, y - h, w, h);
  ctx.restore();
  return true;
}

export class Night4Dark {
  constructor(game) {
    this.g = game;
    this.look = new OfficeTurn();
    this.flash = new Flashlight();
    this.mask = document.createElement('canvas');
    this.mask.width = W;
    this.mask.height = H;
    this.mctx = this.mask.getContext('2d');
    this.start('cinco');
  }

  /** at: 'cinco' (5:00, apagón) o 'seis' (6:00, la escena final). */
  start(at = 'cinco') {
    this.t = 0;
    this.time = 0;
    this.log = [];
    this.look.reset();
    this.look.enabled = true;
    this.flash.reset();
    this.flash.taken = true;
    this.mouse = { x: W / 2, y: H / 2 };
    this.enemies = [];
    this.done = false;
    this._stopHum();
    this.g.voices?.stop();
    if (at === 'seis') return this._startDawn();
    // --- 5:00: apagón ---
    this.phase = 'dark';
    this.slaimiFace = this.g.slaimi?.side && SLAIMI_AT[this.g.slaimi.side] ? this.g.slaimi.side : 'front';
    this.carried = false;
    this.hideT = 0;
    this.threatIn = 0.8;
    this.g.audio.powerDown?.();
    this._play('mira/zumbido', { volume: 0.18, muffle: 0.4, pitchVar: 0 });
    this._note('apagon', { slaimi: this.slaimiFace });
  }

  _note(type, data = {}) {
    this.log.push({ t: +this.time.toFixed(2), fase: this.phase, type, ...data });
    if (this.log.length > 300) this.log.shift();
  }

  _play(key, opts = {}) {
    return this.g.audio.lib?.play(key, opts) ?? false;
  }

  /** Sonido de El Errante por su propio canal (se corta al cambiar de cámara). */
  _hum(key, opts = {}) {
    const a = this.g.audio;
    if (!a.ctx || !a.lib) return;
    if (!this.humBus) {
      this.humBus = a.ctx.createGain();
      this.humBus.connect(a.master);
    }
    a.lib.play(key, { ...opts, bus: this.humBus });
  }

  _stopHum() {
    const bus = this.humBus;
    this.humBus = null;
    this.humIn = 0;
    if (!bus) return;
    const ctx = this.g.audio.ctx;
    bus.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
    setTimeout(() => bus.disconnect(), 600);
  }

  get k() {
    return this.phase === 'defend' ? Math.min(1, this.t / D.DEFEND_TIME) : 0;
  }

  // ---------------------------------------------------------------
  update(dt) {
    if (this.done) return;
    this.time += dt;
    this.flash.update(dt);
    if (this.phase === 'dark') this._updateDark(dt);
    else if (this.phase === 'defend') this._updateDefend(dt);
    else if (this.phase === 'taken') this._updateTaken(dt);
    else if (this.phase === 'dawn') this._updateDawn(dt);
    else if (this.phase === 'asleep') this._updateAsleep(dt);
    else if (this.phase === 'faint') this._updateFaint(dt);
  }

  // --- 5:00: la luz de Slaimi y esconderlo ---
  _updateDark(dt) {
    this.look.update(dt);
    this.hideT += dt;
    const k = Math.min(1, this.hideT / D.HIDE_LIMIT);
    this.threatIn -= dt;
    if (this.threatIn <= 0) {
      // Vienen a por él: pasos, arañazos, respiraciones (cada vez más cerca)
      this.threatIn = rand(D.THREAT_EVERY) * (1 - 0.45 * k);
      const side = pick(['left', 'right', 'back', 'left', 'right']);
      const key = pick(['pasos/metal', 'largo/pasos', 'criaturas/aranazos', 'criaturas/respiracion', 'largo/respiracion', 'pasos/metal']);
      this._play(key, { volume: 0.18 + 0.45 * k, pan: PAN[side] + rand([-0.15, 0.15]), muffle: 0.7 - 0.5 * k });
      if (!this.carried && Math.random() < 0.35) this._play('slaimi/gemido', { volume: 0.22 + 0.2 * k, pan: PAN[this.slaimiFace] * 0.6 });
    }
    if (this.hideT >= D.HIDE_LIMIT) this._take(null, 'no lo escondió');
  }

  /** Dónde está ahora Slaimi en la pantalla (o null si no se ve). */
  _slaimiScreen() {
    if (this.carried) return { x: Math.max(260, Math.min(W - 260, this.mouse.x)), y: H - 40, size: 200 };
    const [x, y] = SLAIMI_AT[this.slaimiFace];
    const k = Math.min(1, this.hideT / D.HIDE_LIMIT);
    return { x, y, size: 150 * (1 - 0.28 * k) };
  }

  _hide() {
    this.phase = 'defend';
    this.t = 0;
    this.carried = false;
    this.flash.on = true;
    this.entryIn = rand(D.FIRST_ENTRY);
    this.gapLeft = 0;
    this.blocked = 0;
    this.scareIn = rand(D.SCARE_FIRST);
    this.scared = false;
    this.scaredT = 0;
    this.calmT = 0;
    this.whimperIn = 0;
    this.slitDark = 0;
    this.threatIn = rand(D.THREAT_EVERY) * 2;
    this.g.audio.door?.('center', true);
    this._play('slaimi/calma', { volume: 0.35, when: 0.4 });
    this._note('escondido', { tras: +this.hideT.toFixed(1) });
  }

  // --- 5:00 → 6:00: defensa ---
  _updateDefend(dt) {
    this.look.update(dt);
    this.t += dt;
    const k = this.k;
    // Slaimi: sustos, gemidos y calma
    this.calmT = Math.max(0, this.calmT - dt);
    this.slitDark = Math.max(0, this.slitDark - dt);
    if (this.scared) {
      this.scaredT += dt;
      this.whimperIn -= dt;
      if (this.whimperIn <= 0) {
        this.whimperIn = rand(D.WHIMPER_EVERY);
        this._play('slaimi/gemido', { volume: 0.3, pan: this.look.isFacing('back') ? -0.3 : 0, muffle: 0.35 });
      }
      // (si ya hay uno dentro, el de la taquilla espera su turno)
      if (this.scaredT >= D.CALM_LIMIT && this._canEnter()) this._lockerEnemy();
    } else if (this.calmT <= 0) {
      this.scareIn -= dt;
      if (this.scareIn <= 0) {
        this.scared = true;
        this.scaredT = 0;
        this.whimperIn = 0.2;
        this._note('slaimi se asusta', {});
      }
    }
    // Entradas (la luz de Slaimi asustado los atrae: llegan antes). Solo UNO
    // atacando a la vez: el siguiente espera a que se vaya el anterior + ENTRY_GAP s.
    this.gapLeft = Math.max(0, this.gapLeft - dt);
    this.entryIn -= dt / (this.scared ? D.ATTRACT : 1);
    if (this.entryIn <= 0) {
      if (this._canEnter()) {
        this._spawn(pick(['left', 'right', 'back']));
        this.entryIn = rand(range(D.ENTRY_EVERY, k));
      } else this.entryIn = 0.25;
    }
    // Ruido de fondo: alguien que ronda
    this.threatIn -= dt;
    if (this.threatIn <= 0) {
      this.threatIn = rand(D.THREAT_EVERY) * 3;
      this._play(pick(['pasos/metal', 'largo/pasos', 'criaturas/respiracion']), { volume: 0.1, pan: rand([-1, 1]), muffle: 0.8 });
    }
    for (const e of this.enemies) {
      if (e.state === 'gone') continue;
      this._updateLight(e, dt);
      if (this.phase !== 'defend') return;
    }
    this.enemies = this.enemies.filter((e) => e.state !== 'gone');
    if (this.t >= D.DEFEND_TIME) this._startDawn();
  }

  /** ¿Puede empezar a entrar otro? (nadie dentro y ya pasó el margen) */
  _canEnter() {
    return !this.enemies.some((e) => e.state !== 'gone') && this.gapLeft <= 0;
  }

  /** Uno se ha ido: empieza el margen hasta el siguiente. */
  _gone(e) {
    e.state = 'gone';
    this.gapLeft = D.ENTRY_GAP;
  }

  _pool() {
    const pool = D.ENEMIES.filter((e) => !this.g.n4dbg?.off.has(e));
    return pool.length ? pool : null;
  }

  _tune(find) {
    const k = this.k;
    return {
      find: find ?? lerp(D.FIND[0], D.FIND[1], k),
      pose: lerp(D.POSE_WINDOW[0], D.POSE_WINDOW[1], k),
      move: lerp(D.MOVE_WINDOW[0], D.MOVE_WINDOW[1], k),
      retire: lerp(D.RETIRE_TIME[0], D.RETIRE_TIME[1], k),
    };
  }

  _newEnemy(enemy, side, spots, tune) {
    return {
      enemy, side, spots, spot: Math.floor(Math.random() * spots.length), pose: pick(POSES[enemy]),
      state: 'waiting', findLeft: tune.find, lit: 0, evadeIn: rand(N2END.EVADE_EVERY), window: 0, changes: 0, tune,
    };
  }

  _spawn(side) {
    const pool = this._pool();
    if (!pool) return false;
    if (!this._canEnter()) {
      // (nunca dos a la vez; el modo debug lo comprueba con «Forzar dos enemigos»)
      this.blocked = (this.blocked ?? 0) + 1;
      this._note('bloqueado: ya hay uno dentro', { lado: side });
      return false;
    }
    const e = this._newEnemy(pick(pool), side, SPOTS[side], this._tune());
    this.enemies.push(e);
    const s = SND[e.enemy];
    this._play(s.steps, { volume: 0.32, pan: PAN[side], muffle: 0.45 });
    this._play(s.breath, { volume: 0.35, pan: PAN[side], when: 0.9, muffle: 0.3 });
    if (side === 'back') this.slitDark = D.SLIT_DARK;     // pasa cerca de la taquilla
    this._note('entra', { enemigo: e.enemy, lado: side });
    return true;
  }

  /** Slaimi no se ha calmado a tiempo: uno va directo a la taquilla. */
  _lockerEnemy() {
    const pool = this._pool();
    if (!pool || !this._canEnter()) return;
    const e = this._newEnemy(pick(pool), 'back', LOCKER_SPOT, this._tune(D.LOCKER_FIND));
    e.locker = true;
    this.enemies.push(e);
    this.slitDark = D.SLIT_DARK * 2;
    this._play(SND[e.enemy].steps, { volume: 0.7, pan: -0.2 });
    this._play(SND[e.enemy].breath, { volume: 0.8, pan: -0.3, when: 0.5 });
    this._note('va a la taquilla', { enemigo: e.enemy });
  }

  _pos(e) {
    return e.spots[e.spot];
  }

  _face(e) {
    const [x, y, h] = this._pos(e);
    return faceOf(e.enemy, e.pose, x, y, h, N2END.FACE_RADIUS, N2END.FACE_RADIUS_MIN);
  }

  _faceLit(e) {
    if (!this.look.isFacing(e.side) || !this.flash.on || this.flash.blinkOff) return false;
    const f = this._face(e);
    return Math.hypot(this.mouse.x - f.x, this.mouse.y - f.y) < f.r;
  }

  /** La mecánica de la luz de la 2.5; si se acaba un plazo, se lleva a Slaimi. */
  _updateLight(e, dt) {
    const lit = this._faceLit(e);
    const T = e.tune;
    switch (e.state) {
      case 'waiting':
        if (lit) {
          e.state = 'lit';
          this._note('enfocado', { enemigo: e.enemy });
          return;
        }
        e.findLeft -= dt;
        if (e.findLeft <= 0) this._take(e, 'no lo encontró');
        return;
      case 'lit':
        if (!lit) {
          e.state = 'lost';
          e.window = T.pose;
          e.why = 'perdió la cara';
          return;
        }
        e.lit += dt;
        if (e.lit >= T.retire) return this._retire(e);
        e.evadeIn -= dt;
        if (e.evadeIn <= 0) this._evade(e);
        return;
      case 'dodge':
      case 'lost':
        if (lit) {
          e.state = 'lit';
          return;
        }
        e.window -= dt;
        if (e.window <= 0) this._take(e, e.why ?? 'perdió la cara');
    }
  }

  _evade(e) {
    e.movedAt = this.time;
    e.evadeIn = rand(N2END.EVADE_EVERY);
    e.state = 'dodge';
    e.changes++;
    if (Math.random() < N2END.MOVE_CHANCE && e.spots.length > 1) {
      let s = e.spot;
      while (s === e.spot) s = Math.floor(Math.random() * e.spots.length);
      e.spot = s;
      e.pose = pick(POSES[e.enemy]);
      e.window = e.tune.move;
      e.why = 'cambió de sitio';
      this._play(SND[e.enemy].steps, { volume: 0.45, pan: PAN[e.side], pitchVar: 0.05 });
      if (e.side === 'back') this.slitDark = D.SLIT_DARK;
    } else {
      e.pose = pick(POSES[e.enemy].filter((p) => p !== e.pose));
      e.window = e.tune.pose;
      e.why = 'cambió de postura';
    }
    this._note(e.why, { enemigo: e.enemy, lado: e.side });
  }

  _retire(e) {
    this._gone(e);
    const s = SND[e.enemy];
    [0.6, 0.4, 0.2].forEach((v, i) => this._play(s.steps, { volume: v, pan: PAN[e.side], when: 0.2 + i * s.gap, muffle: 0.2 + i * 0.25 }));
    this.flash.blink(N2END.RETIRE_FLICKERS, N2END.RETIRE_FLICKER_TIME);
    if (e.side === 'back') this.slitDark = D.SLIT_DARK;
    this._note('se retira', { enemigo: e.enemy, lado: e.side });
  }

  // --- Se llevan a Slaimi ---
  _take(e, why) {
    if (this.g.n4dbg?.invincible) {
      // (modo debug) no pasa nada: el enemigo se va
      if (e) this._gone(e);
      else this.hideT = 0;
      this._note('(invencible) se lo iba a llevar', { por: why });
      return;
    }
    this._note('se llevan a Slaimi', { enemigo: e?.enemy ?? '-', por: why });
    this.phase = 'taken';
    this.takenT = 0;
    this.takenBy = e?.enemy ?? 'largo';
    this.look.reset();
    this.look.face = 'back';
    this.flash.on = false;
    this.carried = false;
    this._play('puertas/golpe', { volume: 0.9 });
    this._play('slaimi/gemido', { volume: 0.55, when: 0.25 });
    this._play('criaturas/aranazos', { volume: 0.7, when: 0.7 });
    this._play('slaimi/gemido', { volume: 0.35, when: 1.1, muffle: 0.4 });
    this._play(SND[this.takenBy]?.steps ?? 'largo/pasos', { volume: 0.5, when: 1.6, muffle: 0.3 });
    this._play('slaimi/gemido', { volume: 0.15, when: 2.2, muffle: 0.8 });
  }

  _updateTaken(dt) {
    this.takenT += dt;
    if (this.takenT >= D.TAKEN_TIME) {
      // Se repite desde las 5:00 (rápido, sin pantalla de derrota)
      this.g._n4DarkRetry('cinco');
    }
  }

  // --- 6:00 ---
  _startDawn() {
    this.phase = 'dawn';
    this.t = 0;
    this.enemies = [];
    this.look.reset();
    this.flash.on = true;
    // Las cámaras de verdad se abren solas (batería de emergencia)
    const cams = this.g.cameras;
    cams.reset();
    cams.enabled = true;
    cams.active = D.FIRST_CAM;
    cams.toggle();
    this.errante = { stage: -1, t: 0, gone: false, glitch: 0 };
    this.erranteSeen = false;
    this.stareT = 0;
    this.guideIn = 0;
    this.stutter = { shown: 0, frameIn: 0, freezeLeft: 0, freezeIn: rand(STUT.FREEZE_EVERY), kick: 0, dirty: true, room: null };
    this.shadows = [];
    this.shadowIn = 3;
    this.voiceIn = 4;
    this.flick = 0;
    this.lastCamImg = null;
    this.g._n4Save?.('n4seis');
    this._play('ambiente/interferencia', { volume: 0.35 });
    if (this.g.audio.ctx) {
      this.g.voices.load();
      this.g.voices.start();
    }
    this._note('6:00', {});
  }

  /** Cambia de cámara (minimapa o teclas), como en una noche normal. */
  _setCam(room) {
    const cams = this.g.cameras;
    if (!cams.open || room === cams.active || !ROOMS[room]) return;
    this._leaveErranteCam();
    cams.select(room);
    this.stutter.shown = this.t;
    this.stutter.dirty = true;
    this._note('camara', { sala: room });
  }

  /** Al dejar de mirar la CAM 10 con él dentro, ya no estará al volver. */
  _leaveErranteCam() {
    const m = this.errante;
    this.stareT = 0;
    if (this.g.cameras.active === D.ERRANTE_CAM && m.stage >= 0 && !m.gone) {
      m.gone = true;
      this._stopHum();
      this._note('ya no está', {});
    }
  }

  _toggleMonitor() {
    const cams = this.g.cameras;
    if (this.t < D.LOWER_AFTER) return;   // se han encendido solas: primero se ve la retirada
    if (cams.open) this._leaveErranteCam();
    cams.toggle();
    if (cams.open) {
      this.look.reset();
      this.stutter.dirty = true;
    }
  }

  /** Cercanía de una cámara a la de El Errante (1 = la suya … 0 = la más lejana del plano). */
  _near(room) {
    const k = 1 - (DIST[room] ?? MAX_DIST) / MAX_DIST;
    const m = this.errante;
    const bonus = room === D.ERRANTE_CAM && m.stage >= 0 && !m.gone ? STUT.STAGE * m.stage : 0;
    return Math.min(1, k + bonus);
  }

  /** La imagen se traba: pocas imágenes por segundo, saltos y congelaciones. */
  _updateStutter(dt, room) {
    const s = this.stutter;
    const k = this._near(room);
    s.kick = Math.max(0, s.kick - dt);
    if (s.freezeLeft > 0) {
      s.freezeLeft -= dt;
      if (s.freezeLeft <= 0) {
        // Vuelve de golpe, con todo en otro sitio
        s.shown = this.t;
        s.dirty = true;
        s.kick = 0.12 + 0.2 * k;
        s.frameIn = 1 / lerp(STUT.FPS[0], STUT.FPS[1], k);
      }
      return;
    }
    s.freezeIn -= dt;
    if (s.freezeIn <= 0) {
      s.freezeLeft = lerp(STUT.FREEZE_TIME[0], STUT.FREEZE_TIME[1], k) * rand([0.7, 1.3]);
      s.freezeIn = lerp(STUT.FREEZE_EVERY[0], STUT.FREEZE_EVERY[1], k) * rand([0.6, 1.4]);
      return;
    }
    s.frameIn -= dt;
    if (s.frameIn <= 0) {
      s.frameIn = 1 / lerp(STUT.FPS[0], STUT.FPS[1], k);
      // Imagen perdida: la siguiente llega más tarde (y el salto es mayor)
      if (Math.random() < lerp(STUT.DROP[0], STUT.DROP[1], k)) s.frameIn *= 2;
      s.shown = this.t;
      s.dirty = true;
    }
  }

  _updateDawn(dt) {
    this.t += dt;
    const cams = this.g.cameras;
    cams.update(dt);
    if (!cams.open) this.look.update(dt);
    if (cams.open) this._updateStutter(dt, cams.active);
    // El Errante en la CAM 10
    const m = this.errante;
    m.glitch = Math.max(0, m.glitch - dt);
    if (cams.open && cams.active === D.ERRANTE_CAM && !m.gone) {
      if (m.stage < 0) {
        m.stage = 0;
        m.t = 0;
        this.erranteSeen = true;
        this.humIn = 0;
        this._note('aparece El Errante', {});
      }
      m.t += dt;
      this.humIn -= dt;
      if (this.humIn <= 0) {
        this.humIn = 4.2;
        this._hum('mira/zumbido', { volume: 0.55, pitchVar: 0.02 });
      }
      if (m.t >= D.ERRANTE_JUMP && m.stage < 3) {
        // En cada salto de la imagen, más cerca (sin verse cómo se mueve)
        m.t = 0;
        m.glitch = D.ERRANTE_GLITCH;
        m.stage++;
        this._hum('mira/pitido', { volume: 0.3 + 0.12 * m.stage });
        this._note('más cerca', { imagen: m.stage });
      }
      // Mirarle demasiado tiempo seguido: salta encima
      if (cams.isWatching(D.ERRANTE_CAM)) this.stareT += dt;
      if (this.stareT >= D.STARE_LIMIT) return this._startFaint('lo miró demasiado');
    }
    // Si no encuentra su cámara: su zumbido, cada vez más fuerte, lo guía
    if (!this.erranteSeen && this.t >= D.GUIDE_AFTER) {
      this.guideIn -= dt;
      if (this.guideIn <= 0) {
        this.guideIn = rand(D.GUIDE_EVERY);
        const u = Math.min(1, (this.t - D.GUIDE_AFTER) / D.GUIDE_RAMP);
        this._play('mira/zumbido', { volume: lerp(D.GUIDE_VOLUME[0], D.GUIDE_VOLUME[1], u), pitchVar: 0.02, muffle: 0.5 * (1 - u) });
      }
    }
    // Alucinaciones en la oficina (con el monitor bajado)
    const worse = this.t >= D.DAWN_WORSEN ? Math.min(1, (this.t - D.DAWN_WORSEN) / (D.DAWN_LIMIT - D.DAWN_WORSEN)) : 0;
    this.worse = worse;
    if (this.g.audio.ctx) this.g.voices.update(dt, 0.35 + 0.65 * worse);
    this.flick = Math.max(0, this.flick - dt);
    if (Math.random() < dt * (0.25 + 1.5 * worse)) this.flick = rand([0.05, 0.18]);
    if (!cams.open) {
      this.shadowIn -= dt;
      if (this.shadowIn <= 0) {
        this.shadowIn = rand([2.5, 5]) * (1 - 0.6 * worse);
        const dir = Math.random() < 0.5 ? 1 : -1;
        this.shadows.push({ face: this.look.face, dir, x: dir > 0 ? -150 : W + 150, t: 0, errante: worse > 0.2 && Math.random() < 0.5 });
        this._play('ambiente/crujido', { volume: 0.15, pan: -dir * 0.6 });
      }
      this.voiceIn -= dt;
      if (this.voiceIn <= 0) {
        this.voiceIn = rand([6, 10]) * (1 - 0.5 * worse);
        this._distortedVoice();
      }
      if (worse > 0 && Math.random() < dt * 0.6 * worse) this._hum('mira/pitido', { volume: 0.12 + 0.3 * worse });
    }
    for (const s of this.shadows) {
      s.t += dt;
      s.x += s.dir * (s.errante ? 0 : 260) * dt;
    }
    this.shadows = this.shadows.filter((s) => s.t < (s.errante ? 0.7 : 9));
    // Si no se esconde con Slaimi, también acaba desmayándose (ya no se repite desde las 6:00)
    if (this.t >= D.DAWN_LIMIT) this._startFaint('no fue a la taquilla');
  }

  /** Una voz de la tripulación, distorsionada (lenta, metálica, a un lado). */
  _distortedVoice() {
    const v = this.g.voices;
    const a = this.g.audio;
    const ids = Object.keys(v?.buffers ?? {}).filter((id) => v.buffers[id].length);
    if (!a.ctx || !ids.length) return;
    const buf = pick(v.buffers[pick(ids)]);
    const ctx = a.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rand([0.68, 0.8]);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 1.4;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = i / 128 - 1;
      curve[i] = Math.tanh(x * 4);
    }
    shaper.curve = curve;
    const g = ctx.createGain();
    g.gain.value = 0.28;
    const p = ctx.createStereoPanner();
    p.pan.value = rand([-0.9, 0.9]);
    src.connect(bp).connect(shaper).connect(g).connect(p).connect(a.master);
    src.start();
    this._note('voz distorsionada', {});
  }

  // --- Final alternativo: EL DESMAYO ---
  // El ataque de El Errante está en su cabeza: no le mata, le rompe la mente.
  _startFaint(why) {
    this.phase = 'faint';
    this.faintT = 0;
    this.faintCues = new Set();
    this.g.voices.stop();
    this._stopHum();
    this.g.cameras.forceClose();
    this.g.cameras.anim = 0;
    this._hum('mira/susto', { volume: 1, pitchVar: 0 });
    this._note('desmayo', { por: why });
  }

  /** Lanza una vez el sonido `id` cuando faintT pasa de `at`. */
  _cue(id, at, fn) {
    if (this.faintT >= at && !this.faintCues.has(id)) {
      this.faintCues.add(id);
      fn();
    }
  }

  _updateFaint(dt) {
    this.faintT += dt;
    const F = D.FAINT;
    this._cue('cae', D.JUMP_TIME, () => {
      this._stopHum();
      this._bodyFall();
      this._earRing();
    });
    this._cue('gemido', F.BLINKS[1][0] + 0.3, () => this._play('slaimi/calma', { volume: 0.25, pan: 0.5, muffle: 0.5 }));
    this._cue('cerca', F.BLINKS[2][0] + 0.4, () => this._play('slaimi/calma', { volume: 0.45, pan: 0.2 }));
    this._cue('arrastra', F.DRAG_AT, () => {
      this._play('slaimi/calma', { volume: 0.5 });
      this._play('criaturas/aranazos', { volume: 0.18, muffle: 0.6, when: 0.4 });
      this._play('puertas/golpe', { volume: 0.25, muffle: 0.5, when: F.FADE_AT - F.DRAG_AT + 0.2 });
    });
    if (this.faintT >= F.END_AT && !this.done) {
      this.done = true;
      this.g._n4DarkEnd({ seen: true, faint: true });
    }
  }

  /** Golpe sordo de un cuerpo contra el suelo (sintetizado). */
  _bodyFall() {
    const ctx = this.g.audio.ctx;
    if (!ctx) return;
    const out = this.g.audio.master;
    for (const [when, vol] of [[0, 0.9], [0.17, 0.45]]) {
      const t0 = ctx.currentTime + when;
      const len = Math.floor(0.45 * ctx.sampleRate);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 320;
      const g = ctx.createGain();
      g.gain.value = vol;
      src.connect(lp).connect(g).connect(out);
      src.start(t0);
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(70, t0);
      osc.frequency.exponentialRampToValueAtTime(38, t0 + 0.3);
      const og = ctx.createGain();
      og.gain.setValueAtTime(vol * 0.9, t0);
      og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
      osc.connect(og).connect(out);
      osc.start(t0);
      osc.stop(t0 + 0.4);
    }
  }

  /** Pitido de oído: agudo, sube de golpe y se apaga muy despacio. */
  _earRing() {
    const ctx = this.g.audio.ctx;
    if (!ctx) return;
    const F = D.FAINT;
    const t0 = ctx.currentTime + 0.25;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + F.RING_TIME);
    g.connect(this.g.audio.master);
    for (const hz of [F.RING_HZ, F.RING_HZ + 3]) {
      const o = ctx.createOscillator();
      o.frequency.value = hz;
      o.connect(g);
      o.start(t0);
      o.stop(t0 + F.RING_TIME + 0.1);
    }
  }

  _startAsleep() {
    this.phase = 'asleep';
    this.sleepT = 0;
    this.g.voices.stop();
    this._stopHum();
    this.g.audio.door?.('center', true);
    this._play('slaimi/calma', { volume: 0.5, when: 0.6 });
    this._play('slaimi/calma', { volume: 0.3, when: 2.8 });
    this.g.audio.setMasterLevel?.(0, D.SLEEP_TIME * 0.9);
    this._note('taquilla con Slaimi', { vio: this.erranteSeen });
  }

  _updateAsleep(dt) {
    this.sleepT += dt;
    if (this.sleepT >= D.SLEEP_TIME + 0.6 && !this.done) {
      this.done = true;
      this.g._n4DarkEnd({ seen: this.erranteSeen });
    }
  }

  // ---------------------------------------------------------------
  move(x, y) {
    this.mouse = { x, y };
    const cams = this.g.cameras;
    if (this.phase === 'dawn' && (cams.open || cams.anim > 0)) {
      return !!this.g.cameraView.hitTest(x, y, cams);
    }
    if (!['dark', 'defend', 'dawn'].includes(this.phase)) return false;
    if (this.look.hover(x, y)) return true;
    if (this.phase === 'dark' && !this.carried && this.look.isFacing(this.slaimiFace)) {
      const s = this._slaimiScreen();
      return Math.hypot(x - s.x, y - (s.y - s.size * 0.45)) < s.size * 0.75;
    }
    if (this.phase === 'dawn' && this.look.isFacing('front') && inside(LOWER_TAB, x, y)) return true;
    return this.look.isFacing('back') && inside(LOCKERS, x, y);
  }

  click(x, y) {
    const over = this.move(x, y);
    if (this.phase === 'dark') {
      if (!this.carried && over && this.look.isFacing(this.slaimiFace)) {
        this.carried = true;
        this._play('slaimi/gemido', { volume: 0.35 });
        this._note('coge a Slaimi', {});
      } else if (this.carried && this.look.isFacing('back') && inside(LOCKERS, x, y)) this._hide();
      return;
    }
    if (this.phase === 'defend') {
      if (this.look.isFacing('back') && inside(LOCKERS, x, y)) {
        // Calmar a Slaimi (si está asustado)
        if (this.scared) {
          this.scared = false;
          this.calmT = D.CALM_COOLDOWN;
          this.scareIn = rand(range(D.SCARE_EVERY, this.k));
          this._play('slaimi/calma', { volume: 0.45, pan: -0.3 });
          this._note('calmado', { tardó: +this.scaredT.toFixed(1) });
        } else this._play('slaimi/calma', { volume: 0.18, pan: -0.3 });
        this.g.audio.keyClick?.();
      }
      return;
    }
    if (this.phase === 'dawn') {
      const cams = this.g.cameras;
      if (cams.open) {
        // Como en una noche normal: el minimapa y la pestaña del monitor
        const hit = this.g.cameraView.hitTest(x, y, cams);
        if (hit?.type === 'cam') this._setCam(hit.id);
        else if (hit?.type === 'monitor') this._toggleMonitor();
        return;
      }
      if (inside(LOWER_TAB, x, y) && this.look.isFacing('front')) return this._toggleMonitor();
      if (this.look.isFacing('back') && inside(LOCKERS, x, y)) this._startAsleep();
    }
  }

  release() {}

  key(code) {
    if (this.phase === 'dawn') {
      const cams = this.g.cameras;
      if (code === 'Space' || code === 'KeyS') {
        if (cams.open || this.look.isFacing('front')) this._toggleMonitor();
        return;
      }
      if (cams.open) {
        const n = /^(Digit|Numpad)(\d)$/.exec(code);
        if (n) {
          const id = Object.keys(ROOMS).find((r) => parseInt(ROOMS[r].cam, 10) % 10 === +n[2]);
          if (id) this._setCam(id);
        }
        return;
      }
    }
    if (!['dark', 'defend', 'dawn'].includes(this.phase)) return;
    if (code === 'Space' && this.phase === 'defend') {
      this.flash.toggle();
      this.g.audio.keyClick?.();
    } else if (code === CONFIG.LOOK_BACK.KEY) this.look.toggle();
    else if (code === 'ArrowLeft' || code === 'ArrowRight') {
      this.look.queue = [];
      this.look.step(code === 'ArrowLeft' ? -1 : 1);
    }
  }

  keyUp() {}

  // ---------------------------------------------------------------
  draw(ctx) {
    switch (this.phase) {
      case 'dark': return this._drawDark(ctx);
      case 'defend': return this._drawDefend(ctx);
      case 'taken': return this._drawTaken(ctx);
      case 'dawn': return this._drawDawn(ctx);
      case 'asleep': return this._drawAsleep(ctx);
      case 'faint': return this._drawFaint(ctx);
    }
  }

  /** Una pared de la oficina sin energía (o el pasillo central). */
  _drawWall(ctx, face) {
    const g = this.g;
    if (face === 'back') {
      g.backView.draw(ctx, { open: 1, sealed: false, red: 0 });
      return;
    }
    g.officeView.draw(ctx, g.office, {
      face, blackout: true, noPower: true, locked: true, night: 4, terminal: g.terminal, reactor: g.reactor,
      doorEnemies: { left: [], right: [] }, cameras: g.cameras,
    });
  }

  /** Desplazamiento (px) de una pared mientras se gira (como OfficeTurn.draw). */
  _faceOffset(face) {
    const L = this.look;
    if (!L.moving) return 0;
    const e = L.k * L.k * (3 - 2 * L.k);
    return face === L.from ? -L.dir * e * W : L.dir * (1 - e) * W;
  }

  _views(extra) {
    const v = {};
    for (const f of ['front', 'left', 'right', 'back']) v[f] = (c) => extra(c, f);
    return v;
  }

  // --- 5:00: solo la luz de Slaimi ---
  _drawDark(ctx) {
    const s = this._slaimiScreen();
    const k = Math.min(1, this.hideT / D.HIDE_LIMIT);
    // La luz tiembla y parpadea (cada vez más)
    const flicker = Math.random() < 0.04 + 0.12 * k ? 0.35 : 1;
    const glow = D.GLOW * (0.9 + 0.1 * Math.sin(this.time * 7)) * flicker * (1 - 0.25 * k);
    this.look.draw(ctx, this._views((c, face) => {
      this._drawWall(c, face);
      // La oscuridad, con la luz de Slaimi si está en esta pared
      const tx = this._faceOffset(face);
      const here = this.carried || face === this.slaimiFace;
      const hx = this.carried ? s.x - tx : s.x;
      // (en brazos, la luz sube con él y alumbra más: se ven las taquillas)
      const hy = this.carried ? s.y - 230 : s.y - s.size * 0.4;
      this._darkness(c, here ? [{ x: hx, y: hy, r: glow * (this.carried ? 1.45 : 1) }] : [], 0.985);
      if (here && !this.carried) this._drawSlaimiScared(c, s, k, glow);
    }));
    if (this.carried) this._drawSlaimiScared(ctx, s, k * 0.5, glow);
    this.g.effects.vignette(ctx, 1.1);
    this.look.drawStrips(ctx);
    this._drawHour(ctx, '5 AM');
    if (this.look.isFacing('back') && this.carried && inside(LOCKERS, this.mouse.x, this.mouse.y)) this._outline(ctx, DOOR);
  }

  /** Negro con agujeros de luz (en coordenadas de la pared que se dibuja). */
  _darkness(c, holes, alpha) {
    const m = this.mctx;
    m.globalCompositeOperation = 'source-over';
    m.clearRect(0, 0, W, H);
    m.fillStyle = `rgba(0,0,0,${alpha})`;
    m.fillRect(0, 0, W, H);
    m.globalCompositeOperation = 'destination-out';
    for (const h of holes) {
      const g = m.createRadialGradient(h.x, h.y, h.r * 0.1, h.x, h.y, h.r);
      g.addColorStop(0, 'rgba(0,0,0,0.92)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.45)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      m.fillStyle = g;
      m.fillRect(h.x - h.r, h.y - h.r, h.r * 2, h.r * 2);
    }
    c.drawImage(this.mask, 0, 0);
    // Y la luz tiñe de su color lo que alumbra
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const h of holes) {
      const g = c.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r);
      g.addColorStop(0, `rgba(${VIOLET},0.22)`);
      g.addColorStop(1, `rgba(${VIOLET},0)`);
      c.fillStyle = g;
      c.fillRect(h.x - h.r, h.y - h.r, h.r * 2, h.r * 2);
    }
    c.restore();
  }

  /** Slaimi con miedo: tiembla, encoge y su luz parpadea. */
  _drawSlaimiScared(ctx, s, k, glow) {
    const shake = (2 + 5 * k) * (Math.random() - 0.5);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(s.x, s.y - s.size * 0.45, 0, s.x, s.y - s.size * 0.45, glow * 0.6);
    g.addColorStop(0, `rgba(${VIOLET},0.3)`);
    g.addColorStop(1, `rgba(${VIOLET},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(s.x - glow, s.y - glow, glow * 2, glow * 2);
    ctx.restore();
    drawSlaimi(ctx, s.x + shake, s.y, s.size, { t: this.time, sad: true, squash: 0.3 + 0.3 * Math.sin(this.time * 31) });
  }

  // --- 5:00 → 6:00 ---
  _drawDefend(ctx) {
    const { x: mx, y: my } = this.mouse;
    this.look.draw(ctx, this._views((c, face) => {
      this._drawWall(c, face);
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(0, 0, W, H);
    }));
    this.flash.draw(ctx, mx, my, null, 0.975);
    // Los enemigos: solo dentro del haz (invisibles hasta que se les alumbra)
    const face = this.look.moving ? null : this.look.face;
    const here = this.enemies.filter((e) => e.state !== 'gone' && e.side === face);
    if (here.length) this.flash.reveal(ctx, mx, my, (c) => { for (const e of here) this._drawEnemy(c, e); });
    // La luz de Slaimi por las rendijas de la taquilla (se ve sin linterna)
    if (face === 'back') this._drawSlits(ctx);
    this.g.effects.vignette(ctx, 1.05);
    this.look.drawStrips(ctx);
    this._drawHour(ctx, '5 AM');
    if (this.look.isFacing('back') && inside(LOCKERS, mx, my)) this._outline(ctx, DOOR);
  }

  _drawEnemy(ctx, e) {
    let [x, y, h] = this._pos(e);
    if (e.state === 'lit') x += Math.sin(this.time * 38) * 2.5 * Math.min(1, e.lit);
    const back = e.movedAt !== undefined ? Math.max(0, 1 - (this.time - e.movedAt) / 0.4) : 0;
    setEyeShine(true);
    drawEnemy(ctx, e.enemy, e.pose, x, y, h * (1 - 0.07 * back), this.time);
    setEyeShine(false);
  }

  /** Hilo de luz violeta por las rendijas y el borde de la puerta. */
  _drawSlits(ctx) {
    const G = D.SLIT_GLOW;
    let a = this.scared ? G.scared * (0.75 + 0.25 * Math.sin(this.time * 9)) : this.calmT > 0 ? G.calm : G.normal;
    if (this.slitDark > 0) a = 0;
    a *= 0.92 + 0.08 * Math.sin(this.time * 2.3);
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Halo sobre la puerta
    const cx = DOOR.x + DOOR.w / 2;
    const halo = ctx.createRadialGradient(cx, DOOR.y + 70, 0, cx, DOOR.y + 70, 150 + 120 * a);
    halo.addColorStop(0, `rgba(${VIOLET},${0.22 * a})`);
    halo.addColorStop(1, `rgba(${VIOLET},0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(cx - 300, DOOR.y - 230, 600, 600);
    // Rendijas (arriba de la puerta) y la raya del borde
    ctx.fillStyle = `rgba(${Math.round(170 + 60 * a)},150,255,${Math.min(1, 1.1 * a)})`;
    ctx.shadowColor = `rgba(${VIOLET},1)`;
    ctx.shadowBlur = 12;
    for (let i = 0; i < 5; i++) ctx.fillRect(DOOR.x + 22, DOOR.y + 26 + i * 11, DOOR.w - 44, 3);
    ctx.fillRect(DOOR.x + DOOR.w - 3, DOOR.y + 8, 2, DOOR.h - 16);
    for (let i = 0; i < 3; i++) ctx.fillRect(DOOR.x + 30, DOOR.y + DOOR.h - 48 + i * 10, DOOR.w - 60, 2);
    // El suelo, delante de la puerta
    const f = ctx.createRadialGradient(cx, DOOR.y + DOOR.h + 10, 0, cx, DOOR.y + DOOR.h + 10, 160);
    f.addColorStop(0, `rgba(${VIOLET},${0.25 * a})`);
    f.addColorStop(1, `rgba(${VIOLET},0)`);
    ctx.shadowBlur = 0;
    ctx.fillStyle = f;
    ctx.fillRect(cx - 170, DOOR.y + DOOR.h - 60, 340, 140);
    ctx.restore();
  }

  _outline(ctx, r) {
    ctx.save();
    ctx.strokeStyle = 'rgba(232,238,245,0.28)';
    ctx.lineWidth = 3;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }

  _drawHour(ctx, label) {
    ctx.save();
    ctx.font = 'bold 34px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(232,238,245,0.75)';
    ctx.fillText(label, W - 30, 54);
    ctx.restore();
  }

  // --- Se llevan a Slaimi ---
  _drawTaken(ctx) {
    const t = this.takenT;
    this._drawWall(ctx, 'back');
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, W, H);
    // La puerta abierta de golpe: dentro, la luz de Slaimi
    const shake = Math.max(0, 1 - t / 0.5) * 16;
    ctx.save();
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    ctx.fillStyle = '#020104';
    ctx.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
    // Lo arrastran hacia la izquierda, fuera de la imagen
    const u = Math.max(0, Math.min(1, (t - 0.6) / 2.2));
    const e = u * u;
    const x = lerp(DOOR.x + DOOR.w / 2, -220, e);
    const y = lerp(DOOR.y + DOOR.h - 30, H - 40, e);
    const life = Math.max(0, 1 - Math.max(0, t - 1.0) / 2.2);     // su luz se apaga
    const r = 340 * life * (0.75 + 0.25 * Math.random());
    if (r > 4) {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y - 50, 0, x, y - 50, r);
      g.addColorStop(0, `rgba(${VIOLET},${0.8 * life})`);
      g.addColorStop(0.4, `rgba(${VIOLET},${0.3 * life})`);
      g.addColorStop(1, `rgba(${VIOLET},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - 50 - r, r * 2, r * 2);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 0.25 + 0.75 * life;
    drawSlaimi(ctx, x, y, 130, { t: this.time, sad: true, squash: 0.5 + 0.5 * Math.sin(t * 40) });
    ctx.globalAlpha = 1;
    // Lo que lo arrastra: un brazo largo y negro desde el borde
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(-40, y - 140);
    ctx.quadraticCurveTo((x - 40) / 2, y - 190, x - 30, y - 70);
    ctx.lineTo(x + 10, y - 40);
    ctx.quadraticCurveTo((x - 40) / 2, y - 110, -40, y - 60);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    this.g.effects.vignette(ctx, 1.3);
    if (t > D.TAKEN_TIME - 1.4) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (t - (D.TAKEN_TIME - 1.4)) / 1.2)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // --- 6:00 ---
  _drawDawn(ctx) {
    const cams = this.g.cameras;
    if (!cams.fullyOpen) this._drawDawnOffice(ctx);
    // El monitor de verdad: imagen (la de esta escena), rótulos, minimapa y pestaña
    if (cams.anim > 0) {
      this.g.cameraView.draw(ctx, cams, this.g.effects, {
        night: 4,
        corridorOpen: true,
        clockElapsed: 6 * CONFIG.SECONDS_PER_HOUR + this.t,
        feed: (c, room) => this._drawFeed(c, room),
      });
    }
    // Las luces de emergencia también fallan
    if (this.flick > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, W, H);
    }
    if (!cams.open && cams.anim === 0) this.look.drawStrips(ctx);
    // La pestaña para subir el monitor (en la oficina)
    if (!cams.open && cams.anim === 0 && this.look.isFacing('front')) {
      ctx.save();
      const hot = inside(LOWER_TAB, this.mouse.x, this.mouse.y);
      ctx.fillStyle = hot ? 'rgba(125,255,176,0.22)' : 'rgba(125,255,176,0.08)';
      ctx.strokeStyle = 'rgba(125,255,176,0.45)';
      ctx.lineWidth = 2;
      ctx.fillRect(LOWER_TAB.x, LOWER_TAB.y, LOWER_TAB.w, LOWER_TAB.h);
      ctx.strokeRect(LOWER_TAB.x, LOWER_TAB.y, LOWER_TAB.w, LOWER_TAB.h);
      ctx.restore();
    }
  }

  /**
   * La imagen de la cámara, TRABADA: se pinta en un lienzo aparte solo
   * cuando llega una imagen nueva; entre una y otra (y en las
   * congelaciones) se ve la misma, estática incluida.
   */
  _drawFeed(ctx, room) {
    const s = this.stutter;
    if (!this.feedCanvas) {
      this.feedCanvas = document.createElement('canvas');
      this.feedCanvas.width = W;
      this.feedCanvas.height = H;
    }
    if (s.dirty || s.room !== room) {
      s.dirty = false;
      s.room = room;
      this._renderFeed(this.feedCanvas.getContext('2d'), room, s.shown);
    }
    ctx.drawImage(this.feedCanvas, 0, 0);
    // Al volver de una congelación, la imagen se rompe un instante
    if (s.kick > 0) {
      glitchSlices(ctx, Math.min(1, s.kick * 4));
      this.g.effects.static(ctx, 0.3 * Math.min(1, s.kick * 5));
    }
  }

  /** Una imagen de la cámara (batería de emergencia) en el instante `ts`. */
  _renderFeed(ctx, room, ts) {
    const m = this.errante;
    let img = null;
    if (room === D.ERRANTE_CAM) img = m.stage >= 0 && !m.gone ? IMG[`cam${m.stage}`] : IMG.vacia;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    // Tenue y desvaída, con algún tirón de la imagen
    const dim = 0.5 + 0.1 * Math.sin(this.time * 13) + (Math.random() < 0.06 ? -0.2 : 0);
    // (los renders de la CAM 10 ya salen con la luz de emergencia: se compensan)
    ctx.filter = `grayscale(0.55) brightness(${(dim * (img ? 1.8 : 1)).toFixed(2)}) contrast(1.25)`;
    if (img) ctx.drawImage(img, 0, 0, W, H);
    else this.g.sprites.draw(ctx, `cam_${room}`, 0, 0, W, H);
    ctx.restore();
    if (img && room === D.ERRANTE_CAM) this.lastCamImg = img;
    // La retirada (en las cámaras de su camino)
    this._drawRetreat(ctx, room, ts);
    // (modo debug) El Errante en cualquier cámara
    if (this.g.n4dbg?.errante && room !== D.ERRANTE_CAM) drawErrante(ctx, 820, 760, 420, { alpha: 0.85, dark: 0.35 });
    // Distorsión: estática, estiramiento y color corrupto
    if (m.glitch > 0 && room === D.ERRANTE_CAM) {
      const k = m.glitch / D.ERRANTE_GLITCH;
      if (img) {
        ctx.save();
        ctx.globalAlpha = 0.5 * k;
        ctx.drawImage(img, -40 * k, -H * 0.12 * k, W + 80 * k, H * (1 + 0.3 * k));
        ctx.globalCompositeOperation = 'hue';
        ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '255,0,160' : '0,255,120'},${0.6 * k})`;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
      glitchSlices(ctx, k);
      this.g.effects.static(ctx, 0.35 * k);
    }
    // Cuanto más cerca de él, más interferencia
    const near = this._near(room);
    if (near > 0.3) glitchSlices(ctx, 0.25 * (near - 0.3));
    // Cámara de seguridad: tinte, líneas, estática, viñeta
    ctx.save();
    ctx.fillStyle = 'rgba(30,70,50,0.16)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
    ctx.restore();
    this.g.effects.static(ctx, 0.08 + 0.12 * near);
    this.g.effects.vignette(ctx, 1.0);
    ctx.save();
    ctx.font = '16px "Courier New", monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,190,120,0.85)';
    ctx.fillText('BATERIA DE EMERGENCIA', 40, 262);
    ctx.restore();
  }

  /** Los enemigos se retiran por su camino (en el instante `ts` de la imagen trabada). */
  _drawRetreat(ctx, room, ts) {
    const clips = RETREAT[room];
    if (!clips) return;
    ctx.save();
    ctx.filter = 'brightness(0.45) grayscale(0.6)';
    for (const [kind, pose, from, to, start, dur] of clips) {
      const u = (ts - start) / dur;
      if (u < 0 || u > 1) continue;
      const e = u * (2 - u);
      const x = lerp(from[0], to[0], e);
      const y = lerp(from[1], to[1], e);
      const h = lerp(from[2], to[2], e);
      const a = Math.min(1, u / 0.08) * (1 - Math.max(0, (u - 0.85) / 0.15));
      if (a <= 0) continue;
      drawCreature(ctx, kind, x, y, h, ts, { pose, alpha: a });
    }
    ctx.restore();
  }

  _drawDawnOffice(ctx) {
    const { x: mx, y: my } = this.mouse;
    const w = this.worse ?? 0;
    this.look.draw(ctx, this._views((c, face) => {
      this._drawWall(c, face);
      // Luz roja de emergencia, débil
      c.fillStyle = 'rgba(70,0,0,0.3)';
      c.fillRect(0, 0, W, H);
      // Sombras que cruzan (y, al empeorar, él, quieto en medio)
      for (const s of this.shadows) {
        if (s.face !== face) continue;
        if (s.errante) drawErrante(c, W / 2 + (s.x % 300) - 150, 905, 640, { variant: 'frente', alpha: 0.75 * Math.sin(Math.min(1, s.t / 0.7) * Math.PI), dark: 0.55 });
        else drawErrante(c, s.x, 920, 680, { variant: 'espaldas', alpha: 0.5 * Math.min(1, s.t / 0.6), dark: 0.97 });
      }
    }));
    this.flash.draw(ctx, mx, my, null, 0.8);
    // La imagen de la cámara encima de la oficina
    const over = this.lastCamImg ?? IMG.vacia;
    if (over) {
      ctx.save();
      ctx.globalAlpha = lerp(D.OVERLAY[0], D.OVERLAY[1], w) * (0.7 + 0.3 * Math.sin(this.time * 5));
      ctx.globalCompositeOperation = 'screen';
      ctx.filter = 'grayscale(0.7) brightness(0.8)';
      ctx.drawImage(over, (Math.random() - 0.5) * 12 * (1 + 3 * w), 0, W, H);
      ctx.restore();
    }
    if (w > 0) glitchSlices(ctx, 0.25 * w);
    this.g.effects.static(ctx, 0.06 + 0.2 * w);
    this.g.effects.vignette(ctx, 1.1 + 0.4 * w);
    if (this.look.isFacing('back') && inside(LOCKERS, mx, my)) this._outline(ctx, DOOR);
    if (this.look.isFacing('back')) this._drawSlitsDawn(ctx);
  }

  _drawSlitsDawn(ctx) {
    // Slaimi sigue en la taquilla, tranquilo
    const keep = { scared: this.scared, calmT: this.calmT, slitDark: this.slitDark };
    this.scared = false;
    this.calmT = 0;
    this.slitDark = 0;
    this._drawSlits(ctx);
    Object.assign(this, keep);
  }

  // --- Dentro de la taquilla con Slaimi ---
  _drawAsleep(ctx) {
    const t = this.sleepT;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    // Las rendijas de la puerta, con la luz roja de fuera
    ctx.save();
    for (let i = 0; i < 6; i++) {
      const y = 170 + i * 26;
      const g = ctx.createLinearGradient(0, y, W, y);
      g.addColorStop(0, 'rgba(90,10,10,0)');
      g.addColorStop(0.5, `rgba(130,20,20,${0.35 - i * 0.03})`);
      g.addColorStop(1, 'rgba(90,10,10,0)');
      ctx.fillStyle = g;
      ctx.fillRect(320, y, W - 640, 7);
    }
    // Slaimi, abajo, con su luz: tranquilo, parpadea despacio
    ctx.globalCompositeOperation = 'lighter';
    const gl = ctx.createRadialGradient(W / 2, 760, 0, W / 2, 760, 520);
    gl.addColorStop(0, `rgba(${VIOLET},0.35)`);
    gl.addColorStop(1, `rgba(${VIOLET},0)`);
    ctx.fillStyle = gl;
    ctx.fillRect(0, 200, W, H);
    ctx.restore();
    drawSlaimi(ctx, W / 2, 930, 300, { t: this.time, phase: (t * 0.35) % 1, pose: 'lento' });
    // Parpadeo lento de Slaimi (ojos que se cierran) y los tuyos que pesan
    this.g.effects.vignette(ctx, 1.2);
    const lid = Math.min(1, Math.max(0, (t - 1.2) / (D.SLEEP_TIME - 1.6))) * (1 - 0.25 * Math.max(0, Math.sin(t * 2.2)) * (t < D.SLEEP_TIME - 1 ? 1 : 0));
    this._drawLids(ctx, lid);
    if (t > D.SLEEP_TIME - 0.6) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (t - (D.SLEEP_TIME - 0.6)) / 0.6)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  /** Párpados (como en Night4Sleep). */
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
      ctx.restore();
    }
  }

  // --- El susto: la cara de El Errante ---
  _drawScare(ctx, t) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const img = IMG.cara;
    if (img && t < D.JUMP_TIME - 0.15) {
      const z = 1 + 0.35 * Math.min(1, t / 0.25) + 0.05 * Math.sin(t * 60);
      const sh = 22 * (1 - Math.min(1, t / D.JUMP_TIME));
      ctx.save();
      ctx.translate(W / 2 + (Math.random() - 0.5) * sh, H / 2 + (Math.random() - 0.5) * sh);
      ctx.scale(z, z);
      if (Math.random() < 0.15) ctx.filter = 'invert(1) contrast(1.6)';
      ctx.drawImage(img, -W / 2, -H / 2, W, H);
      ctx.restore();
      glitchSlices(ctx, 0.6);
      this.g.effects.static(ctx, 0.25);
    }
  }

  /** ¿Cuánto tiene los ojos abiertos (0-1) y en qué parpadeo está? */
  _eyes(t) {
    const F = D.FAINT;
    for (let i = 0; i < F.BLINKS.length; i++) {
      const [a, b, amt] = F.BLINKS[i];
      if (t >= a && t <= b) {
        const u = (t - a) / (b - a);
        return { open: amt * Math.pow(Math.sin(Math.PI * u), 0.6), i, u };
      }
    }
    return { open: 0, i: -1, u: 0 };
  }

  // --- El desmayo: desde el suelo ---
  _drawFaint(ctx) {
    const t = this.faintT;
    const F = D.FAINT;
    if (t < D.JUMP_TIME) return this._drawScare(ctx, t);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const eyes = this._eyes(t);
    if (eyes.open > 0.01) {
      // Slaimi se acerca (de la derecha hacia ti) y luego te arrastra
      const c = Math.max(0, Math.min(1, (t - F.BLINKS[1][0]) / (F.DRAG_AT - F.BLINKS[1][0])));
      const drag = Math.max(0, t - F.DRAG_AT);
      const sx = lerp(W + 120, W * 0.56, c * (2 - c));
      const size = lerp(90, 300, c);
      // La oficina, de lado, desde el suelo, borrosa; se desliza al arrastrarle
      ctx.save();
      ctx.translate(W / 2 - drag * 150, H / 2 + Math.sin(drag * 9) * 6 * Math.min(1, drag));
      ctx.rotate(-0.3);
      ctx.scale(1.25, 1.25);
      ctx.translate(-W / 2, -H / 2 + 140);
      ctx.filter = `blur(${(4 - 2.5 * eyes.open).toFixed(1)}px) brightness(0.55)`;
      this._drawWall(ctx, 'back');
      ctx.restore();
      ctx.fillStyle = 'rgba(70,0,0,0.35)';
      ctx.fillRect(0, 0, W, H);
      // Al primer parpadeo, su cara sigue ahí… y se deshace: no era real
      if (eyes.i === 0 && IMG.cara) {
        ctx.save();
        ctx.globalAlpha = 0.45 * (1 - eyes.u);
        ctx.filter = 'blur(2px) grayscale(0.6)';
        ctx.drawImage(IMG.cara, W * 0.2, H * 0.1, W * 0.6, H * 0.6);
        ctx.restore();
        glitchSlices(ctx, 0.5 * (1 - eyes.u));
        this.g.effects.static(ctx, 0.3 * (1 - eyes.u));
      }
      if (t >= F.BLINKS[1][0]) {
        // Su luz, cada vez más grande; lo que se acerca parece ÉL… y es Slaimi
        const glow = lerp(180, 900, c) + drag * 500;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(sx, H - 120, 0, sx, H - 120, glow);
        g.addColorStop(0, `rgba(${VIOLET},${0.55 + 0.3 * Math.min(1, drag)})`);
        g.addColorStop(0.5, `rgba(${VIOLET},0.2)`);
        g.addColorStop(1, `rgba(${VIOLET},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
        const ghost = eyes.i === 1 ? Math.max(0, 1 - eyes.u * 1.6) : 0;
        if (ghost > 0) drawErrante(ctx, sx, H - 40, 520, { variant: 'frente', alpha: 0.6 * ghost, dark: 0.85 });
        ctx.save();
        ctx.globalAlpha = 1 - ghost * 0.8;
        drawSlaimi(ctx, sx, H - 30 + Math.sin(t * 3) * 4, size, { t: this.time, pose: 'lento' });
        ctx.restore();
        // Te envuelve: todo violeta
        if (drag > 0) {
          ctx.fillStyle = `rgba(${VIOLET},${Math.min(0.55, drag * 0.3)})`;
          ctx.fillRect(0, 0, W, H);
        }
      }
      this.g.effects.vignette(ctx, 1.4);
    }
    this._drawLids(ctx, 1 - eyes.open);
    // Fundido a negro y el nombre del final
    if (t >= F.FADE_AT) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (t - F.FADE_AT) / 0.9)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (t >= F.TEXT_AT) {
      const u = (t - F.TEXT_AT) / (F.END_AT - F.TEXT_AT);
      const a = Math.min(1, u * 4) * Math.min(1, (1 - u) * 4);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(232,238,245,${0.9 * a})`;
      ctx.font = 'bold 54px "Courier New", monospace';
      ctx.fillText('FINAL: DESMAYO', W / 2, H / 2 - 10);
      ctx.fillStyle = `rgba(${VIOLET},${0.7 * a})`;
      ctx.font = '20px "Courier New", monospace';
      ctx.fillText('NOCHE 4 SUPERADA', W / 2, H / 2 + 48);
      ctx.restore();
    }
  }
}
