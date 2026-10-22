// =============================================================
// Night4Start.js — INICIO DE LA NOCHE 4 (v0.36). (Valores en NIGHT4.START
// y NIGHT4.REBOOT, src/night/night4.js.)
//
// 1. Dentro de la TAQUILLA (donde acabó la noche 3): clic en la puerta
//    para salir.
// 2. La OFICINA, sin energía: se gira con el ratón en los bordes (oficina
//    de 4 paredes). Las compuertas de los lados no se mueven; la única
//    salida es la compuerta del PASILLO CENTRAL (pared de atrás).
// 3. El PASILLO CENTRAL por dentro (render 3D n4_pasillo). Así se elige la
//    ruta, sin menús:
//      - A la izquierda, en la penumbra, el PANEL DE REINICIO atornillado a
//        la pared. NO se ve sin luz: solo aparece dentro del haz de la
//        linterna (n4_pasillo_panel). Clic en él (iluminado) → ruta A.
//      - Al fondo, el pasillo sigue (a oscuras) hacia el Comedor. Clic →
//        ruta B (Night4Repair empieza en el Comedor: se sale SIEMPRE por aquí).
//    ESPACIO: linterna. Abajo, volver atrás.
// 4. Ruta A: el PANEL DE REINICIO (render 3D n4_reinicio_*). CLIC abre
//    la tapa; otro CLIC la cierra y vuelves a mirar el pasillo. MANTENER
//    ESPACIO (con la tapa abierta) pulsa el botón y sube el %. Mientras
//    tanto El Largo puede acercarse por el pasillo (se le oye): hay que
//    cerrar el panel y alumbrarle (PEEK_LIGHT s) antes de PEEK_TIME s. Al
//    100 %, vuelve la luz y empieza el turno (Game._n4Begin('A', ...)).
// La ruta se guarda en la partida en cuanto se elige (Game._n4Choose).
// Punto de control 'n4reboot': si El Largo te alcanza, vuelves al panel.
// =============================================================

import { CONFIG } from '../config.js';
import { NIGHT4 } from '../night/night4.js';
import { Flashlight } from '../render/Flashlight.js';
import { LurkSounds } from '../systems/LurkSounds.js';
import { FirstPersonView, OFFICE_EXITS } from '../render/FirstPersonView.js';
import { BackView, BACK_HATCH } from '../render/BackView.js';
import { OfficeTurn } from '../systems/OfficeTurn.js';
import { drawCRT } from '../render/CRT.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const S = NIGHT4.START;
const RB = NIGHT4.REBOOT;
const rand = ([a, b]) => a + Math.random() * (b - a);
const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const grow = (r, m) => ({ x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m });
// Rendijas de la puerta de la taquilla (como en el final de la noche 3)
const SLITS = Array.from({ length: 6 }, (_, i) => ({ x: 520, y: 300 + i * 46, w: 560, h: 15 }));
const SLIT_AREA = { x: 470, y: 260, w: 660, h: 330 };
// Rectángulos de los renders 3D (assets/salas/n4_paneles.json, de
// tools/3d/salas/pasillo_n4.py y tools/3d/paneles.py)
const WALL_PANEL = { x: 418, y: 345, w: 132, h: 278 };    // el panel en la pared (solo con linterna)
const FAR = { x: 700, y: 300, w: 240, h: 260 };           // fondo del pasillo (hacia el Comedor)
const BACK_STRIP = { x: 0, y: H - 90, w: W, h: 90 };      // volver atrás
const SCREEN = { x: 592, y: 243, w: 262, h: 166 };        // pantalla CRT del panel de reinicio
const BUTTON = { x: 664, y: 529, w: 119, h: 118 };        // botón (con la tapa levantada)
// El Largo en el pasillo: animación 3D paso a paso (tools/3d/largo_pasillo.py),
// fotogramas recortados en una hoja con su sitio en pantalla, ojos, cara y pies
const LARGO_ANIM = 'assets/criaturas/largo_pasillo';
const SIDE_MSG = 'La compuerta no se mueve. No hay energia.';
// Oscuridad fuera del haz de la linterna (1 = negro total). El render del
// pasillo ya es oscuro: ahí se oscurece menos.
const DARK_OFFICE = 0.9;
const DARK_CORRIDOR = 0.78;

export class Night4Start {
  constructor(game) {
    this.g = game;
    this.flash = new Flashlight();
    this.lurk = new LurkSounds((k, o) => this._play(k, o));   // se le oye a oscuras (v0.45)
    this.view = new FirstPersonView(game.cameraView);
    this.look = new OfficeTurn();
    this.backView = new BackView();
    this.backView.sprites = game.sprites;
    this._loadLargo();
    this.start();
  }

  _loadLargo() {
    this.largoAnim = null;
    fetch(LARGO_ANIM + '.json').then((r) => r.json()).then((data) => {
      const img = new Image();
      img.onload = () => { this.largoAnim = { ...data, img }; };
      img.src = LARGO_ANIM + '.webp';
    }).catch(() => {});
  }

  /** at: null (taquilla) | 'reboot' (punto de control: delante del armario, ruta A). */
  start({ at = null } = {}) {
    this.phase = at === 'reboot' ? 'corridor' : 'locker';
    this.t = 0;
    this.time = 0;
    this.mouse = { x: W / 2, y: H / 2 };
    this.path = at === 'reboot' ? 'A' : null;
    this.lidOpen = false;
    this.spaceDown = false;      // ESPACIO mantenido (el botón del panel)
    this.tapeStarted = false;    // la cinta del hombre (sale al abrir el panel)
    this.reboot = 0;             // 0..100 %
    this.rebootTime = 0;         // s pulsando (los demás enemigos avanzan mientras)
    this.largo = null;           // { state: 'coming'|'peek'|'leaving', t, lit, k }
    this.largoIn = rand(RB.PEEK_FIRST);
    this.msg = null;
    this.msgTime = 0;
    this.done = false;
    this.log = [];
    this.flash.reset();
    this.flash.taken = true;
    this.flash.on = true;        // la linterna, ya encendida (ESPACIO la apaga)
    this.look.reset();
    this.look.enabled = this.phase === 'office';
    this.g.audio.powerDown?.();
    if (at === 'reboot') this._say('El panel de la pared: alumbralo y haz clic', 3);
  }

  _say(text, time = 2.5) {
    this.msg = text;
    this.msgTime = time;
  }

  _note(type, data = {}) {
    this.log.push({ t: +this.time.toFixed(2), type, ...data });
  }

  _play(key, opts = {}) {
    return this.g.audio.lib?.play(key, opts) ?? false;
  }

  // ---------------------------------------------------------------
  // Bucle
  // ---------------------------------------------------------------

  update(dt) {
    if (this.done) return;
    this.t += dt;
    this.time += dt;
    this.flash.update(dt);
    this.look.update(dt);
    this.backView.update(dt);
    this.msgTime = Math.max(0, this.msgTime - dt);
    switch (this.phase) {
      case 'opening':
        if (this.t >= S.OPEN_TIME) this._setPhase('office');
        return;
      case 'toCorridor':
        if (this.t >= S.CORRIDOR_TIME) this._setPhase('corridor');
        return;
      case 'toRepair':
        if (this.t >= S.CORRIDOR_TIME) {
          this.done = true;
          this.g._startN4Repair();
        }
        return;
      case 'lights':
        if (this.t >= S.LIGHTS_ON) {
          this.done = true;
          this.g._n4Begin('A', { headStart: this.rebootTime });
        }
        return;
      case 'panel':
      case 'corridor':
        if (this.path === 'A') this._updateReboot(dt);
    }
  }

  _setPhase(p) {
    this.phase = p;
    this.t = 0;
    this.look.enabled = p === 'office';
    if (p === 'office') this.look.reset();
    this._note('fase', { fase: p });
  }

  /** Ruta A: el porcentaje y El Largo por el pasillo. */
  _updateReboot(dt) {
    const pressing = this.phase === 'panel' && this.lidOpen && this.spaceDown;
    if (pressing) {
      this.reboot = Math.min(100, this.reboot + RB.SPEED * dt);
      this.rebootTime += dt;
      if (Math.random() < dt * 2) this._play('ambiente/chispazo', { volume: 0.1 });
      if (this.reboot >= 100) return this._lightsOn();
      if (!this.largo) {
        this.largoIn -= dt;
        if (this.largoIn <= 0) this._largoComes();
      }
    } else if (RB.DECAY > 0) this.reboot = Math.max(0, this.reboot - RB.DECAY * dt);
    const L = this.largo;
    // Asomado al fondo del pasillo y sin luz: se le oye respirar (en el centro)
    this.lurk.update(dt, L?.state === 'peek' ? [{ ref: L, kind: 'largo', side: 'center', lit: this._largoLit() }] : []);
    if (!L) return;
    L.t += dt;
    if (L.state === 'coming') {
      // Se le oye acercarse por el pasillo antes de verle
      if (L.t >= 1.6) {
        L.state = 'peek';
        L.t = 0;
        this._play('largo/respiracion', { volume: 0.9, muffle: 0.2 });
        this._note('se asoma', {});
      }
      return;
    }
    if (L.state === 'leaving') {
      if (L.t >= 1.2) this.largo = null;
      return;
    }
    // Asomado: se acerca (paso a paso) mientras nadie le alumbra
    if (this._largoLit()) {
      L.lit += dt;
      if (L.lit >= RB.PEEK_LIGHT) {
        L.state = 'leaving';
        L.frozen = this._largoFrame();   // se queda quieto en la luz… y desaparece
        L.t = 0;
        this.flash.blink(2, 0.4);
        [0.6, 0.35, 0.2].forEach((v, i) => this._play('largo/pasos', { volume: v, when: 0.1 + i * 1.0, muffle: 0.3 + i * 0.25 }));
        this.largoIn = rand(RB.PEEK_EVERY);
        this._note('se va', {});
      }
      return;
    }
    if (L.t >= RB.PEEK_TIME) this._die();
  }

  _largoComes() {
    if (this.g.n4dbg?.off.has('largo')) return void (this.largoIn = rand(RB.PEEK_EVERY));
    this.largo = { state: 'coming', t: 0, lit: 0, k: 0 };
    [0.25, 0.35, 0.5].forEach((v, i) => this._play('largo/pasos', { volume: v, when: i * 0.55, muffle: 0.5 - i * 0.15 }));
    this._note('se acerca', {});
  }

  /** Fotograma de la animación (avanza con el tiempo asomado; al final, quieto). */
  _largoFrame() {
    const A = this.largoAnim;
    const L = this.largo;
    if (!A || !L) return null;
    if (L.frozen) return L.frozen;
    const i = Math.min(A.frames.length - 1, Math.floor(L.t * A.fps));
    return A.frames[i];
  }

  /** Cara de El Largo en pantalla: { x, y, r }. */
  _largoFace() {
    const f = this._largoFrame();
    if (f) return { x: f.face[0], y: f.face[1], r: f.face[2] };
    return { x: 815, y: 420, r: 22 };
  }

  _largoLit() {
    if (this.phase !== 'corridor' || !this.flash.on || this.flash.blinkOff) return false;
    const f = this._largoFace();
    return Math.hypot(this.mouse.x - f.x, this.mouse.y - f.y) < Math.max(70, f.r * 2.2);
  }

  _lightsOn() {
    this.phase = 'lights';
    this.t = 0;
    this.spaceDown = false;
    this.largo = null;
    this.g.audio.powerUp?.();
    this._play('ambiente/chispazo', { volume: 0.6 });
    this._note('luz', { tiempo: +this.rebootTime.toFixed(1) });
  }

  _die() {
    if (this.done) return;
    if (this.g.n4dbg?.invincible) {     // (modo debug: no mata, se va)
      this.largo = null;
      this.largoIn = rand(RB.PEEK_EVERY);
      return;
    }
    this.done = true;
    this._note('muerte', {});
    this.g._n4Death('largo');
  }

  // ---------------------------------------------------------------
  // Entrada
  // ---------------------------------------------------------------

  move(x, y) {
    this.mouse = { x, y };
    switch (this.phase) {
      case 'locker':
        return inside(SLIT_AREA, x, y);
      case 'office': {
        if (this.look.hover(x, y)) return true;
        const f = this.look.face;
        return !this.look.moving && (f === 'back' ? inside(BACK_HATCH, x, y) : (f === 'left' || f === 'right') && inside(OFFICE_EXITS[f], x, y));
      }
      case 'corridor':
        return this.hover !== null;
      case 'panel':
        return true;
    }
    return false;
  }

  /** ¿El haz de la linterna está encima del panel de la pared? */
  get panelLit() {
    return this.flash.on && !this.flash.blinkOff && inside(grow(WALL_PANEL, 10), this.mouse.x, this.mouse.y);
  }

  get hover() {
    if (this.phase !== 'corridor') return null;
    const { x, y } = this.mouse;
    if (this.panelLit) return 'panel';
    if (!this.path && inside(FAR, x, y)) return 'far';
    if (!this.path && inside(BACK_STRIP, x, y)) return 'back';
    return null;
  }

  click(x, y) {
    this.move(x, y);
    if (this.done) return;
    switch (this.phase) {
      case 'locker':
        if (!inside(SLIT_AREA, x, y)) return;
        this.g.audio.door?.('center', false);
        this._play('metal/panel', { volume: 0.4 });
        this._setPhase('opening');
        return;
      case 'office': {
        if (this.look.moving) return;
        const f = this.look.face;
        if (f === 'back' && inside(BACK_HATCH, x, y)) {
          this._play('pasos/metal', { volume: 0.3 });
          return this._setPhase('toCorridor');
        }
        if ((f === 'left' || f === 'right') && inside(OFFICE_EXITS[f], x, y)) {
          this.g.audio.denied?.(f);
          this._say(SIDE_MSG);
        }
        return;
      }
      case 'corridor': {
        const h = this.hover;
        if (h === 'panel') {
          if (!this.path) this._chooseA();
          else this.phase = 'panel';
          this._openLid();
        } else if (h === 'far') {
          this.path = 'B';
          this.g._n4Choose('B');
          this._note('ruta', { ruta: 'B' });
          this._play('pasos/metal', { volume: 0.35 });
          this._setPhase('toRepair');
        } else if (h === 'back') {
          this._setPhase('office');
          this.look.goTo?.('back');
        }
        return;
      }
      case 'panel':
        // Clic: abrir la tapa; con la tapa abierta, clic la cierra y la
        // vista vuelve al pasillo (girarse a mirar)
        if (!this.lidOpen) this._openLid();
        else this._closePanel();
    }
  }

  _chooseA() {
    this.path = 'A';
    this.g._n4Choose('A');
    this.g._n4Save?.('n4reboot');
    this._note('ruta', { ruta: 'A' });
    this.phase = 'panel';
    this._say('MANTEN ESPACIO para pulsar el boton   ·   Clic: cerrar el panel', 4);
  }

  _openLid() {
    if (this.lidOpen) return;
    this.lidOpen = true;
    if (!this.tapeStarted) {
      // La cinta del hombre (ruta A): suena sola la primera vez que se abre el panel
      this.tapeStarted = true;
      this.g.tape.schedule('4A', { autoplay: true, contexto: 'panel_n4' });
    }
    this._play('metal/panel', { volume: 0.5 });
    this._note('tapa', {});
  }

  /** Cerrar la tapa y volver a mirar el pasillo. */
  _closePanel() {
    this.lidOpen = false;
    this.spaceDown = false;
    this.phase = 'corridor';
    this._play('metal/panel', { volume: 0.35 });
    this._note('cierra', { reinicio: Math.round(this.reboot) });
  }

  release() {
    this.spaceDown = false;
  }

  key(code) {
    if (this.done) return;
    if (code === 'Space') {
      if (this.phase === 'panel') {
        if (this.lidOpen) this.spaceDown = true;
        return;
      }
      if (this.phase === 'corridor' || this.phase === 'office') {
        this.flash.toggle();
        this.g.audio.keyClick();
      }
      return;
    }
    if (this.phase === 'locker' && (code === 'Enter' || code === 'KeyE')) return this.click(W / 2, 420);
    if (this.phase === 'office') {
      if (code === CONFIG.LOOK_BACK.KEY) this.look.toggle();
      else if (code === 'ArrowLeft' || code === 'ArrowRight') this.look.step(code === 'ArrowLeft' ? -1 : 1);
    }
    if (this.phase === 'panel' && (code === 'Escape' || code === 'KeyS')) this._closePanel();
  }

  keyUp(code) {
    if (code === 'Space') this.spaceDown = false;
  }

  // ---------------------------------------------------------------
  // Dibujo
  // ---------------------------------------------------------------

  _office(ctx, face) {
    const g = this.g;
    g.officeView.draw(ctx, g.office, {
      face, blackout: false, noPower: true, locked: true, night: 4, terminal: g.terminal, reactor: g.reactor,
      doorEnemies: { left: [], right: [] }, cameras: g.cameras,
    });
  }

  draw(ctx) {
    const { x: mx, y: my } = this.mouse;
    let hint = '';
    switch (this.phase) {
      case 'locker':
      case 'opening':
        this._drawLocker(ctx);
        return;
      case 'office':
        this.look.draw(ctx, {
          front: (c) => this._office(c, 'front'),
          left: (c) => this._office(c, 'left'),
          right: (c) => this._office(c, 'right'),
          back: (c) => this.backView.draw(c, { open: 1 }),
        });
        this.flash.draw(ctx, mx, my, null, DARK_OFFICE);
        this.look.drawStrips(ctx);
        hint = 'Raton a un borde: girar   ·   ESPACIO: linterna';
        break;
      case 'toCorridor':
      case 'toRepair': {
        this._drawCorridor(ctx);
        ctx.fillStyle = `rgba(0,0,0,${Math.min(1, this.t / S.CORRIDOR_TIME)})`;
        ctx.fillRect(0, 0, W, H);
        return;
      }
      case 'corridor':
        this._drawCorridor(ctx);
        this.flash.draw(ctx, mx, my, null, DARK_CORRIDOR);
        // El panel de la pared solo existe dentro del haz
        this.flash.reveal(ctx, mx, my, (c) => this._drawWallPanel(c));
        if (this.largo?.state === 'peek' || this.largo?.state === 'leaving') this.flash.reveal(ctx, mx, my, (c) => this._drawLargo(c));
        this._drawCorridorHover(ctx);
        hint = this.path === 'A' ? 'Alumbra el panel y haz clic para abrirlo   ·   ESPACIO: linterna' : 'ESPACIO: linterna';
        break;
      case 'panel':
        this._drawPanel(ctx);
        hint = this.lidOpen ? 'MANTEN ESPACIO: pulsar el boton   ·   Clic: cerrar el panel y mirar el pasillo' : 'Clic: abrir el panel';
        break;
      case 'lights':
        this._drawLights(ctx);
        return;
    }
    this.g.effects.vignette(ctx, 0.8);
    this.g.effects.static(ctx, 0.04);
    this.view.drawHint(ctx, hint, this.msgTime > 0 ? this.msg : null);
  }

  _drawLocker(ctx) {
    const g = this.g;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    // Por las rendijas: la oficina a oscuras
    ctx.save();
    ctx.beginPath();
    for (const s of SLITS) ctx.rect(s.x, s.y, s.w, s.h);
    ctx.clip();
    this._office(ctx, 'front');
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    ctx.strokeStyle = 'rgba(60,70,80,0.5)';
    ctx.lineWidth = 2;
    for (const s of SLITS) ctx.strokeRect(s.x, s.y, s.w, s.h);
    g.effects.vignette(ctx);
    g.effects.static(ctx, 0.04);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    if (this.phase === 'opening') {
      const k = Math.min(1, this.t / S.OPEN_TIME);
      ctx.fillStyle = `rgba(0,0,0,${Math.sin(k * Math.PI)})`;
      ctx.fillRect(0, 0, W, H);
    } else {
      const over = inside(SLIT_AREA, this.mouse.x, this.mouse.y);
      ctx.font = '18px "Courier New", monospace';
      ctx.fillStyle = over ? 'rgba(232,238,245,0.85)' : 'rgba(220,225,232,0.5)';
      ctx.fillText(over ? 'Abrir la taquilla (clic)' : 'Sigues dentro de la taquilla. La oficina esta a oscuras.', W / 2, 660);
    }
    ctx.restore();
  }

  _drawCorridor(ctx) {
    const key = this.phase === 'lights' ? 'n4_pasillo_luz' : 'n4_pasillo';
    if (!this.g.sprites?.draw(ctx, key, 0, 0, W, H)) {
      ctx.fillStyle = '#0a0606';
      ctx.fillRect(0, 0, W, H);
    }
  }

  /** El panel de la pared, tal como lo ilumina la linterna (para reveal). */
  _drawWallPanel(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(WALL_PANEL.x, WALL_PANEL.y, WALL_PANEL.w, WALL_PANEL.h + 140);   // + cables
    ctx.clip();
    this.g.sprites?.draw(ctx, 'n4_pasillo_panel', 0, 0, W, H);
    ctx.restore();
    // Su piloto rojo, con la ruta A elegida (el panel ya tiene algo de corriente)
    if (this.path === 'A' && Math.floor(this.time * 2) % 2) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,60,40,0.95)';
      ctx.shadowColor = '#ff3a2a';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(WALL_PANEL.x + WALL_PANEL.w * 0.83, WALL_PANEL.y + WALL_PANEL.h * 0.14, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _drawCorridorHover(ctx) {
    const h = this.hover;
    if (!h || h === 'back') {
      if (!this.path) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '15px "Courier New", monospace';
        ctx.fillStyle = h === 'back' ? 'rgba(232,238,245,0.8)' : 'rgba(232,238,245,0.3)';
        ctx.fillText('▼ Volver a la oficina', W / 2, H - 40);
        ctx.restore();
      }
      return;
    }
    const text = h === 'panel' ? (this.path ? 'El panel de reinicio (clic: abrir)' : 'Un panel atornillado a la pared... REINICIO MANUAL')
      : 'Seguir por el pasillo hacia el Comedor (reparar las camaras)';
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '20px "Courier New", monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(W / 2 - 400, 790, 800, 40);
    ctx.fillStyle = h === 'panel' ? '#ffd8c8' : '#c8dcff';
    ctx.fillText(text, W / 2, 810);
    ctx.restore();
  }

  _drawLargo(ctx) {
    const A = this.largoAnim;
    const f = this._largoFrame();
    if (!A || !f) return;
    const L = this.largo;
    // Al alumbrarle se queda quieto y se desvanece en la oscuridad
    const alpha = L.state === 'leaving' ? Math.max(0, 1 - L.t / 1.1) : Math.min(1, L.t / 0.5);
    const [sx, sy, sw, sh] = f.sheet;
    const [x, y, w, h] = f.screen;
    ctx.save();
    ctx.globalAlpha = alpha;
    // Sombra de contacto bajo los pies apoyados (que pise el suelo)
    for (const [fx, fy, down] of f.feet) {
      const rw = h * (down ? 0.07 : 0.05);
      const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, rw);
      g.addColorStop(0, `rgba(0,0,0,${down ? 0.55 : 0.25})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(fx, fy, rw, rw * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.drawImage(A.img, sx, sy, sw, sh, x, y, w, h);
    // Los ojos diminutos devuelven la luz de la linterna
    for (const [ex, ey] of f.eyes) {
      const r = Math.max(2, h * 0.012);
      const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, r * 3);
      g.addColorStop(0, 'rgba(255,240,215,0.95)');
      g.addColorStop(0.35, 'rgba(255,200,150,0.35)');
      g.addColorStop(1, 'rgba(255,200,150,0)');
      ctx.fillStyle = g;
      ctx.fillRect(ex - r * 3, ey - r * 3, r * 6, r * 6);
    }
    ctx.restore();
  }

  _drawPanel(ctx) {
    const key = this.lidOpen ? 'n4_reinicio_abierto' : 'n4_reinicio_cerrado';
    if (!this.g.sprites?.draw(ctx, key, 0, 0, W, H)) {
      ctx.fillStyle = '#101414';
      ctx.fillRect(0, 0, W, H);
    }
    const pressed = this.lidOpen && this.spaceDown;
    if (pressed) {
      // El botón se hunde y brilla
      ctx.save();
      const cx = BUTTON.x + BUTTON.w / 2;
      const cy = BUTTON.y + BUTTON.h / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(cx, cy, BUTTON.w * 0.36, 0, Math.PI * 2);
      ctx.fill();
      const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, BUTTON.w * 0.8);
      glow.addColorStop(0, 'rgba(255,60,40,0.35)');
      glow.addColorStop(1, 'rgba(255,60,40,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(cx - BUTTON.w, cy - BUTTON.h, BUTTON.w * 2, BUTTON.h * 2);
      ctx.restore();
    }
    this._drawCRT(ctx);
    // Pista de peligro: se oye algo en el pasillo (el borde de la pantalla late)
    if (this.largo && this.largo.state !== 'leaving') {
      const a = 0.12 + 0.12 * Math.sin(this.time * 10);
      const gr = ctx.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, `rgba(120,0,0,${a})`);
      gr.addColorStop(0.5, 'rgba(120,0,0,0)');
      gr.addColorStop(1, `rgba(120,0,0,${a})`);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
    }
  }

  /** Pantalla CRT del panel (src/render/CRT.js): porcentaje y barra de bloques. */
  _drawCRT(ctx) {
    const s = SCREEN;
    const rect = { x: s.x + s.w * 0.1, y: s.y + s.h * 0.14, w: s.w * 0.8, h: s.h * 0.72 };
    // Al abrir la tapa, un pequeño arranque antes de mostrar el porcentaje
    if (this.lidOpen && this.bootT === undefined) this.bootT = this.time;
    const boot = this.bootT === undefined ? 1 : Math.min(1, (this.time - this.bootT) / 0.8);
    drawCRT(ctx, rect, (c, w, h, fx) => {
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      fx.glow(undefined, 12);
      c.fillStyle = fx.color;
      const fs = (k) => `bold ${Math.round(w * k)}px "Courier New", monospace`;
      if (boot < 1) {
        c.font = fs(0.05);
        const lines = ['VIGIA-7 AUX v1.4', 'BATERIA ....... OK', 'CIRCUITO ...... OK'];
        lines.slice(0, Math.ceil(boot * lines.length)).forEach((l, i) => c.fillText(l, w / 2, h * (0.3 + i * 0.15)));
        return;
      }
      c.font = fs(0.06);
      c.fillText('REINICIO ELECTRICO AUX', w / 2, h * 0.2);
      c.font = fs(0.2);
      c.fillText(`${Math.floor(this.reboot)} %`, w / 2, h * 0.5);
      const n = 20;
      const full = Math.floor(this.reboot / 100 * n);
      c.font = fs(0.05);
      c.fillText('[' + '█'.repeat(full) + '░'.repeat(n - full) + ']', w / 2, h * 0.78);
      if (!this.lidOpen && Math.floor(this.time * 2) % 2) {
        c.font = fs(0.045);
        c.fillText('LEVANTE LA TAPA', w / 2, h * 0.92);
      }
      fx.noGlow();
    }, { time: this.time, curve: 0.09 });
  }

  _drawLights(ctx) {
    this._drawCorridor(ctx);
    const k = this.t / S.LIGHTS_ON;
    if (Math.random() < 0.55 - 0.5 * k) {
      ctx.fillStyle = `rgba(0,0,0,${0.85 - 0.6 * k})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (k > 0.75) {
      ctx.fillStyle = `rgba(0,0,0,${(k - 0.75) * 4})`;
      ctx.fillRect(0, 0, W, H);
    }
    this.g.effects.vignette(ctx, 0.7);
  }
}
