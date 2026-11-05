// =============================================================
// Noche4_3D.js — (v1.58, plan «noches 2 y 4 con movimiento libre», fase N3; «haz lo de las noches») EL INICIO DE LA
// NOCHE 4 EN 3D, con la misma lógica de src/ending/Night4Start.js (valores en NIGHT4.REBOOT) y sin energía:
//   Se sale de la taquilla (sigue siendo la vista de siempre) y se aparece en la oficina a oscuras, con la linterna
//   encendida. Las compuertas de los lados no se mueven; la de atrás da al PASILLO CENTRAL.
//   · A la izquierda del pasillo, EL PANEL DE REINICIO, que solo se ve con la linterna (E o clic: la vista de cerca de
//     siempre). Es la ruta A: mantener ESPACIO con la tapa abierta sube el %. Mientras tanto se acerca El Largo: hay que
//     cerrar el panel, girarse y darle con la luz en la cara. Al 100 %, vuelve la energía y empieza el turno.
//   · Al fondo, la compuerta hacia el Comedor. Es la ruta B (la reparación sigue siendo la de siempre hasta la fase N4).
// Si El Largo llega: el susto de siempre (Game._n4Death) y, con la ruta A elegida, se vuelve al panel (punto n4reboot).
// =============================================================

import * as THREE from '../lib/three/three.module.min.js';
import { NochesBase } from './Noches3D.js';
import { prop } from './Noche2_3D.js';
import { NIGHT4 } from '../night/night4.js';
import { CONFIG } from '../config.js';

const W = CONFIG.WIDTH, H = CONFIG.HEIGHT;
const RB = NIGHT4.REBOOT;
const S = NIGHT4.START;
const rand = ([a, b]) => a + Math.random() * (b - a);

// el panel, en la pared de la izquierda según se entra (Blender x, y, z)
export const PANEL = [101.0, -43.66, 1.45];   // (la cara de la pared, y = -43,6)
// la compuerta del fondo (hacia el Comedor)
export const FONDO = [140.9, -45.0, 1.6];
// delante del panel, mirándolo (punto de control)
const ANTE_PANEL = { x: 101.0, y: -44.9 };
// dónde se asoma El Largo (al fondo del pasillo, en su mismo eje)
const SITIOS_LARGO = [[109.5, -45.0], [108.0, -45.0]];

// el panel de la pared: el mismo de la vista de cerca (su render, recortado), para que sea el mismo panel
function lienzoPanel() {
  const cv = document.createElement('canvas');
  cv.width = 410;
  cv.height = 500;
  const c = cv.getContext('2d');
  c.fillStyle = '#5a5f62';
  c.fillRect(0, 0, 410, 500);
  cv.listo = new Promise((ok) => {
    const im = new Image();
    im.onload = () => {
      c.drawImage(im, 516, 170, 514, 630, 0, 0, 410, 500);
      ok();
    };
    im.onerror = ok;
    im.src = 'assets/salas/n4_reinicio_cerrado.jpg';
  });
  return cv;
}

function lienzoCompuerta(cartel) {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 512;
  const c = cv.getContext('2d');
  c.fillStyle = '#9aa0a6';
  c.fillRect(0, 0, 512, 512);
  c.fillStyle = '#5a6066';
  c.fillRect(251, 0, 10, 512);
  for (let k = 0; k < 13; k++) {
    c.fillStyle = k % 2 ? '#c8a020' : '#141414';
    c.fillRect(k * 40, 440, 40, 72);
  }
  if (cartel) {
    c.fillStyle = '#d8d6cc';
    c.fillRect(126, 120, 260, 70);
    c.fillStyle = '#161616';
    c.font = 'bold 38px "Courier New", monospace';
    c.textAlign = 'center';
    c.fillText(cartel, 256, 170);
  }
  return cv;
}

export class Noche4 extends NochesBase {
  constructor(L, o = {}) {
    super(L, { ...o, prueba: null });
    const g = this.g;
    this.ns = g.n4start;
    this.fase = 'anda';
    this.ruta = null;
    this.panel = false;
    this.lid = false;
    this.reboot = 0;
    this.rebootT = 0;
    this.largo = null;
    this.largoIn = rand(RB.PEEK_FIRST);
    this.cinta = false;
    this.negro = 0;
    this.faseT = 0;
    this.msg = null;
    this.msgT = 0;
    L.sinLinterna = false;
    L.linternaOn = true;
    const lp = lienzoPanel();
    this.pPanel = prop(L, { geo: new THREE.PlaneGeometry(0.82, 1.0), lienzo: lp, pos: PANEL });
    lp.listo.then(() => { this.pPanel.material.uniforms.uMap.value.needsUpdate = true; });
    // el piloto rojo, con la ruta A elegida (el panel ya tiene algo de corriente)
    this.pPiloto = prop(L, { geo: new THREE.CircleGeometry(0.022, 12), color: [1.0, 0.1, 0.05], pos: [PANEL[0] + 0.3, PANEL[1] - 0.012, PANEL[2] + 0.5], brillo: 0 });
    this.pFondo = prop(L, { geo: new THREE.PlaneGeometry(3.1, 3.2), lienzo: lienzoCompuerta('COMEDOR'), pos: FONDO, yaw: -Math.PI / 2 });
    // las compuertas de los lados de la oficina, bajadas (sin energía no se mueven)
    this.pIzq = prop(L, { geo: new THREE.PlaneGeometry(3.2, 3.6), lienzo: lienzoCompuerta(null), pos: [90.0, -50.35, 1.8] });
    this.pDer = prop(L, { geo: new THREE.PlaneGeometry(3.2, 3.6), lienzo: lienzoCompuerta(null), pos: [90.0, -39.65, 1.8], yaw: Math.PI });
    // (g._noche4Salto: 'panel' = el punto de control de la ruta A, delante del panel; 'pasillo' = el debug)
    if (g._noche4Salto === 'panel') {
      this.ruta = 'A';
      this.colocaAlPanel = true;
    }
    if (g._noche4Salto === 'pasillo') this.colocaAlPasillo = true;
    g._noche4Salto = null;
  }

  stop() {
    super.stop();
    for (const p of [this.pPanel, this.pPiloto, this.pFondo, this.pIzq, this.pDer]) {
      this.L.escena.remove(p);
      p.geometry.dispose();
      p.material.dispose();
    }
    this.ns.spaceDown = false;
  }

  _di(t, s = 2.5) { this.msg = t; this.msgT = s; }
  _son(clave, o = {}) { this.g.audio?.lib?.play(clave, { pitchVar: 0.05, ...o }); }

  _miras(p, d, ang) {
    const L = this.L;
    const dx = p[0] - L.x, dy = p[1] - L.y, dz = p[2] - (L.ojosZ ?? 1.65);
    const dist = Math.hypot(dx, dy, dz);
    if (dist > d) return false;
    const fx = Math.cos(L.yaw) * Math.cos(L.pitch), fy = Math.sin(L.yaw) * Math.cos(L.pitch), fz = Math.sin(L.pitch);
    return Math.acos(Math.max(-1, Math.min(1, (dx * fx + dy * fy + dz * fz) / dist))) < ang;
  }

  /** Lo que se puede usar ahora (E o clic). El panel, solo si la linterna le da: sin luz no existe. */
  _usable() {
    if (this.fase !== 'anda' || this.panel) return null;
    if (this.L.linternaOn && this._miras(PANEL, 2.4, 0.5)) return 'panel';
    if (this._miras(FONDO, 3.0, 0.7)) return 'fondo';
    return null;
  }

  _usa() {
    const u = this._usable();
    if (!u) return false;
    if (u === 'panel') this._abrePanel();
    else if (this.ruta) {
      // (con el panel empezado ya no hay vuelta atrás: como en las imágenes fijas)
      this.g.audio?.denied?.('center');
      this._di('No hay tiempo. El panel.', 2.5);
    } else {
      this.fase = 'aComedor';
      this.faseT = 0;
      this.ruta = 'B';
      this.g._n4Choose('B');
      this._son('pasos/metal', { volume: 0.35 });
      this.g.audio?.door?.('center', false);
    }
    return true;
  }

  _abrePanel() {
    if (!this.ruta) {
      this.ruta = 'A';
      this.g._n4Choose('A');
      this.g._n4Save?.('n4reboot');
      this._di('MANTEN ESPACIO para pulsar el boton   ·   E: cerrar el panel', 4);
    }
    this.panel = true;
    this.lid = true;
    this.yaw0 = this.L.yaw;
    this.pitch0 = this.L.pitch;
    this.L.teclas.clear();
    this._son('metal/panel', { volume: 0.5 });
    if (!this.cinta) {
      // la cinta del hombre (ruta A): suena sola la primera vez que se abre el panel
      this.cinta = true;
      this.g.tape?.schedule('4A', { autoplay: true, contexto: 'panel_n4' });
    }
  }

  _cierraPanel() {
    this.panel = false;
    this.lid = false;
    this.ns.spaceDown = false;
    this._son('metal/panel', { volume: 0.35 });
  }

  click() {
    if (this.susto || this.fase !== 'anda') return true;
    if (this.panel) {
      this._cierraPanel();
      return true;
    }
    return document.pointerLockElement === this.g.canvas && this._usa();
  }

  tecla(code) {
    if (this.susto || this.fase !== 'anda') return true;
    const tape = this.g.tape;
    if (tape?.playing && code === 'KeyM') { tape.stop(); return true; }
    if (this.panel) {
      if (code === 'KeyE' || code === 'Escape') this._cierraPanel();
      return code !== 'KeyL';      // (ESPACIO es el botón, no la linterna; L vuelve a escuchar la cinta)
    }
    if (code === 'KeyE') return this._usa() || true;
    return false;
  }

  _largoViene() {
    if (this.g.n4dbg?.off.has('largo')) return void (this.largoIn = rand(RB.PEEK_EVERY));
    this.largo = { t: 0, e: null };
    [0.25, 0.35, 0.5].forEach((v, i) => this._son('largo/pasos', { volume: v, when: i * 0.55, muffle: 0.5 - i * 0.15 }));
  }

  ataca(enemigo, por) {
    if (this.g.n4dbg?.invincible) {
      this.asomados.quitaTodos();
      this.largo = null;
      this.largoIn = rand(RB.PEEK_EVERY);
      return;
    }
    if (this.fase === 'muerto') return;
    this.fase = 'muerto';
    this.L.stop();
    this.g._n4Death(enemigo);
    this.g.deathCause = 'n4_reboot';
  }

  update(dt) {
    const L = this.L, g = this.g;
    this.t += dt;
    this.msgT = Math.max(0, this.msgT - dt);
    if (this.colocaAlPanel) {
      this.colocaAlPanel = false;
      L.x = ANTE_PANEL.x;
      L.y = ANTE_PANEL.y;
      L.yaw = Math.PI / 2;
      L.pitch = 0;
    }
    if (this.colocaAlPasillo) {
      this.colocaAlPasillo = false;
      L.x = 97.0;
      L.y = -45.0;
      L.yaw = 0;
      L.pitch = 0;
    }
    if (this.fase === 'aComedor') {
      this.faseT += dt;
      if (this.faseT >= S.CORRIDOR_TIME) {
        L.stop();
        g._startN4Repair();
      }
      return 'para';
    }
    if (this.fase === 'luces') {
      this.faseT += dt;
      if (this.faseT >= S.LIGHTS_ON) {
        L.stop();
        g._n4Begin('A', { headStart: this.rebootT });
      }
      return 'para';
    }
    if (this.fase === 'muerto') return 'para';
    if (this.panel) {
      // (con el panel abierto no se anda ni se gira)
      L.teclas.clear();
      L.yaw = this.yaw0;
      L.pitch = this.pitch0;
      const pulsa = this.lid && L.pulsadas?.has('Space');
      this.ns.spaceDown = !!pulsa;
      if (pulsa) {
        this.reboot = Math.min(100, this.reboot + RB.SPEED * dt);
        this.rebootT += dt;
        if (Math.random() < dt * 2) this._son('ambiente/chispazo', { volume: 0.1 });
        if (this.reboot >= 100) return this._vuelveLaLuz();
        if (!this.largo) {
          this.largoIn -= dt;
          if (this.largoIn <= 0) this._largoViene();
        }
      }
    }
    // El Largo: se le oye venir por el pasillo y se asoma; no se va hasta que le das con la luz en la cara
    const K = this.largo;
    if (K) {
      K.t += dt;
      if (!K.e && K.t >= RB.PEEK_LLEGA) {
        K.e = this.asomados.nuevo('largo', SITIOS_LARGO, { facil: { find: RB.PEEK_TIME_3D, retire: RB.PEEK_LIGHT }, pose: 'lean' });
        this._son('largo/respiracion', { volume: 0.9, muffle: 0.2 });
      }
    }
    this.asomados.update(dt);
    if (K?.e && !this.asomados.lista.includes(K.e) && this.fase === 'anda') {
      // se ha retirado
      this.largo = null;
      this.largoIn = rand(RB.PEEK_EVERY);
      [0.6, 0.35, 0.2].forEach((v, i) => this._son('largo/pasos', { volume: v, when: 0.1 + i * 1.0, muffle: 0.3 + i * 0.25 }));
    }
    // lo que dibuja la vista de cerca (la de siempre, de Night4Start)
    const ns = this.ns;
    ns.time = (ns.time ?? 0) + dt;
    ns.lidOpen = this.lid;
    ns.reboot = this.reboot;
    ns.largo = this.largo ? { state: 'peek' } : null;
    return this.fase === 'anda' ? null : 'para';
  }

  _vuelveLaLuz() {
    this.fase = 'luces';
    this.faseT = 0;
    this.ns.spaceDown = false;
    this.largo = null;
    this.asomados.quitaTodos();
    this.g.audio?.powerUp?.();
    this._son('ambiente/chispazo', { volume: 0.6 });
    return 'para';
  }

  coloca() {
    this.asomados.coloca();
    this.pPiloto.visible = this.ruta === 'A';
  }

  draw(ctx) {
    if (this.panel || this.fase === 'luces') {
      this.ns._drawPanel(ctx);
      if (this.fase === 'luces') {
        const k = this.faseT / S.LIGHTS_ON;
        if (Math.random() < 0.55 - 0.5 * k) {
          ctx.fillStyle = `rgba(0,0,0,${0.85 - 0.6 * k})`;
          ctx.fillRect(0, 0, W, H);
        }
        if (k > 0.75) {
          ctx.fillStyle = `rgba(0,0,0,${(k - 0.75) * 4})`;
          ctx.fillRect(0, 0, W, H);
        }
      }
    }
    if (this.fase === 'aComedor') {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, this.faseT / S.CORRIDOR_TIME)})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.save();
    ctx.textAlign = 'center';
    if (this._usable()) {
      ctx.fillStyle = 'rgba(230,235,225,0.75)';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('E', W / 2, H / 2 + 44);
    }
    if (this.msgT > 0 && this.msg) {
      ctx.globalAlpha = Math.min(1, this.msgT);
      ctx.fillStyle = '#d8dcd0';
      ctx.font = '18px monospace';
      ctx.fillText(this.msg, W / 2, H - 70);
    }
    ctx.restore();
  }
}
