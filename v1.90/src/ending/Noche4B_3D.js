// =============================================================
// Noche4B_3D.js — (plan «noches 2 y 4 con movimiento libre», fase N4; «haz la noche 4») LA RUTA B DE LA NOCHE 4 EN 3D:
// reparar las cámaras andando por la estación a oscuras. La lógica de la reparación es la de siempre
// (src/ending/Night4Repair.js: tornillos, lente, progreso y su vista de cerca); valores en NIGHT4.REPAIR y NIGHT4.LARGO.
//   · Se empieza en el Comedor. En cada sala hay una cámara colgada en alto que solo se ve con la linterna (E o clic: la
//     vista de cerca, con un cursor propio: el ratón está capturado).
//   · Mientras se repara, alguien se asoma en silencio a una puerta de la sala. Sin luz a tiempo, entra; dentro, la
//     mecánica de la luz (Asomados3D). Salir de la sala con él dentro = muerte.
//   · Con todas reparadas, al volver hacia la oficina (los dos pasillos, o la compuerta del pasillo central del Comedor),
//     El Largo está atacando a Slaimi: el enfrentamiento largo. Slaimi te sigue y empieza el turno: Game._n4Begin('B').
// =============================================================

import * as THREE from '../lib/three/three.module.min.js';
import { NochesBase } from './Noches3D.js';
import { prop } from './Noche2_3D.js';
import { NIGHT4 } from '../night/night4.js';
import { NIGHT7 } from '../night/night7.js';
import { ROOMS } from '../world/StationMap.js';
import { drawSlaimi } from '../systems/Slaimi.js';
import { CONFIG } from '../config.js';

const W = CONFIG.WIDTH, H = CONFIG.HEIGHT;
const R = NIGHT4.REPAIR;
const LG = NIGHT4.LARGO;
const rand = ([a, b]) => a + Math.random() * (b - a);
const pick = (l) => l[Math.floor(Math.random() * l.length)];
const enCaja = (c, x, y) => x >= c[0] && x <= c[2] && y >= c[1] && y <= c[3];

// la cámara de cada sala, en el sitio de sus renders (tools/3d/salas/puertas_n4.py) y mirando al centro de la sala
const CENTROS = { hangar: [0, 0], comms: [30, 0], eastHall: [60, 0], medbay: [0, -30], reactor: [30, -30], mess: [60, -30],
  lab: [30, -60], greenhouse: [60, -60], cryo: [30, -90], westHall: [60, -90] };
const FP_DIR = { hangar: [0, -1], comms: [0, 1], medbay: [1, 0], reactor: [0, -1], mess: [-1, 0], greenhouse: [1, 0],
  lab: [-1, 0], cryo: [0, 1], eastHall: [0, 1], westHall: [0, 1] };
const FP_LADO = { reactor: -2.8, greenhouse: 2.75 };
// (a 3,3 m: el techo más bajo de las salas está a 4,4 m, medido con rayos; en Criogenia, su sitio caía dentro de una máquina)
const CAM_Z = 3.3;
const CAM_FIJA = { cryo: [30.0, -84.5] };
export const SITIO_CAMARA = (sala) => {
  if (CAM_FIJA[sala]) return [...CAM_FIJA[sala], CAM_Z];
  const [cx, cy] = CENTROS[sala], [dx, dy] = FP_DIR[sala];
  const der = [dy, -dx];
  const s = R.CORNER[sala] === 'right' ? 1 : -1;
  const lado = (FP_LADO[sala] ?? 0) + s * 5.4;
  return [cx - dx * 2.4 + der[0] * lado, cy - dy * 2.4 + der[1] * lado, CAM_Z];
};
// las puertas de cada sala (medido sobre las colisiones): por dónde se asoman, ya dentro de la sala
const PUERTAS = {
  hangar: [[-9, 11.8], [9, 11.8], [0, -8.9]], comms: [[21, 7.7], [39, 6.5]], eastHall: [[51, 6.5]],
  medbay: [[9, -23.5], [0, -21]], reactor: [[21, -36], [39, -36], [24.5, -39]], mess: [[51, -36], [52.3, -39]],
  lab: [[24.5, -51]], greenhouse: [[67.7, -69], [67.7, -51]], cryo: [[22.3, -81]], westHall: [[67.7, -81]],
};
const PUERTA_CENTRAL = [69.95, -30.0, 1.6];   // la compuerta del Comedor al pasillo central
// dónde está la escena de El Largo y Slaimi, según por dónde vuelvas: zona que la dispara y el sitio de Slaimi
const ESCENAS = [
  { caja: [86, -63, 94, -50], slaimi: [90.0, -56.0], eje: [0, 1] },
  { caja: [86, -40, 94, -27], slaimi: [90.0, -34.0], eje: [0, -1] },
];
const ESCENA_COMEDOR = { slaimi: [62.5, -30.0], eje: [-1, 0] };

export class Noche4B extends NochesBase {
  constructor(L, o = {}) {
    super(L, { ...o, prueba: null });
    const g = this.g;
    this.rep = g.n4repair;
    this.panel = false;
    this.cursor = { x: W / 2, y: H / 2 };
    this.peek = null;
    this.dentro = null;
    this.peekIn = rand(R.PEEK_FIRST);
    this.calmaT = 0;
    this.fase = 'anda';
    this.enc = null;
    this.negro = 0;
    this.msg = null;
    this.msgT = 0;
    L.sinLinterna = false;
    L.linternaOn = true;
    this.piezas = [];
    this.cams = {};
    for (const sala of R.ROOMS) this.cams[sala] = this._creaCamara(sala);
    // (v1.75) la compuerta del Comedor al pasillo central: la hoja de verdad (pieza 'hoja_comedor' de noches3d.js), no un
    // plano dibujado. Si llegas andando del pasillo (Noche4_3D), está abierta y se cierra detrás de ti
    this.cierraTras = !!g._noche4bPasillo;
    g._noche4bPasillo = false;
    if (this.cierraTras) L.pieza?.('hoja_comedor', { k: 1, dur: 0 });
    this.rep.where = 'room';
  }

  _pieza(o) {
    const m = prop(this.L, o);
    this.piezas.push(m);
    return m;
  }

  /** La cámara de seguridad: el tubo hasta el techo, la carcasa, el objetivo y el piloto. */
  _creaCamara(sala) {
    const p = SITIO_CAMARA(sala);
    const [cx, cy] = CENTROS[sala];
    const a = Math.atan2(cy - p[1], cx - p[0]);
    const fx = Math.cos(a), fy = Math.sin(a);
    const en = (d, z = 0) => [p[0] + fx * d, p[1] + fy * d, p[2] + z];
    const obj = (geo, color, pos, extra = {}) => this._pieza({ geo, color, pos, yaw: a, relieve: true, ...extra });
    obj(new THREE.CylinderGeometry(0.035, 0.035, 8, 10), [0.24, 0.25, 0.26], en(-0.08, 4.1));
    obj(new THREE.BoxGeometry(0.16, 0.12, 0.12), [0.2, 0.21, 0.22], en(-0.08, 0.12));
    obj(new THREE.BoxGeometry(0.62, 0.24, 0.26), [0.42, 0.44, 0.45], en(0));
    obj(new THREE.BoxGeometry(0.66, 0.03, 0.3), [0.3, 0.31, 0.33], en(0.02, 0.15));
    const aro = new THREE.CylinderGeometry(0.095, 0.11, 0.12, 20).rotateZ(Math.PI / 2);
    obj(aro, [0.13, 0.13, 0.14], en(0.36));
    const cristal = new THREE.CircleGeometry(0.078, 20);
    const lente = this._pieza({ geo: cristal, color: [0.32, 0.34, 0.36], pos: en(0.425), yaw: a + Math.PI / 2 });
    const piloto = this._pieza({ geo: new THREE.SphereGeometry(0.02, 8, 6), color: [1, 0.12, 0.06], pos: [...en(0.1).slice(0, 2), CAM_Z + 0.13], brillo: 0 });
    return { p, lente, piloto };
  }

  stop() {
    super.stop();
    for (const m of this.piezas) {
      this.L.escena.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
    this.piezas = [];
    this._quitaSlaimi();
    if (this.rep) this.rep.spaceDown = false;
  }

  _di(t, s = 2.5) { this.msg = t; this.msgT = s; }

  /** (v1.75) Recién llegado del pasillo central: la compuerta se cierra a tu espalda (sin energía no vuelve a abrirse),
   *  cuando ya estás dentro del Comedor (nunca encima de ti). */
  _cierraTras() {
    const L = this.L;
    if (L.x > 69.3) return;
    this.cierraTras = false;
    L.pieza?.('hoja_comedor', { k: 0, dur: 1.1 });
    this._son('metal/tuberia', { volume: 0.7, pitch: 1.15 });
    this._son('metal/golpe_pared', { volume: 0.65, pitch: 0.7, when: 1.0 });
    this._son('final/anclaje', { volume: 0.5, when: 1.15 });
  }
  _son(clave, o = {}) { this.g.audio?.lib?.play(clave, { pitchVar: 0.05, ...o }); }

  _miras(p, d, ang) {
    const L = this.L;
    const dx = p[0] - L.x, dy = p[1] - L.y, dz = p[2] - (L.ojosZ ?? 1.65);
    const dist = Math.hypot(dx, dy, dz);
    if (dist > d) return false;
    const [fx, fy, fz] = L.dirLinterna();
    return Math.acos(Math.max(-1, Math.min(1, (dx * fx + dy * fy + dz * fz) / dist))) < ang;
  }

  /** Lo que se puede usar ahora (E o clic). La cámara, solo si la linterna le da: sin luz no existe. */
  _usable() {
    if (this.fase !== 'anda' || this.panel) return null;
    const s = this.sala;
    if (s && this.cams[s] && !this.rep.repaired.has(s) && this.L.linternaOn && this._miras(this.cams[s].p, R.CAM_ALCANCE, R.CAM_ANG)) return 'camara';
    if (s === 'mess' && this._miras(PUERTA_CENTRAL, 3.4, 0.6)) return 'central';
    return null;
  }

  _usa() {
    const u = this._usable();
    if (!u) return false;
    if (u === 'camara') this._abre();
    else if (this.rep.allRepaired) this._empiezaEscena(ESCENA_COMEDOR);
    else {
      this.g.audio?.denied?.('center');
      this._di(`Faltan ${R.ROOMS.length - this.rep.repaired.size} camaras por reparar`, 2.5);
    }
    return true;
  }

  _abre() {
    const rep = this.rep;
    this.panel = true;
    rep.room = this.sala;
    rep.where = 'panel';
    rep._screwState();
    this.yaw0 = this.L.yaw;
    this.pitch0 = this.L.pitch;
    this.cursor = { x: W / 2, y: H / 2 };
    rep.mouse = this.cursor;
    this.L.teclas.clear();
    this.asomados.ciego = true;      // (con la vista de cerca no se alumbra la sala: hay que girarse)
    this._son('metal/panel', { volume: 0.4 });
  }

  _cierra() {
    this.panel = false;
    this.asomados.ciego = false;
    this.rep._closeCam();
    this.L.yaw = this.yaw0;
    this.L.pitch = this.pitch0;
  }

  click() {
    if (this.fase !== 'anda') return true;
    if (this.panel) {
      if (document.pointerLockElement !== this.g.canvas) {
        this.g.canvas.requestPointerLock?.();
        return true;
      }
      if (!this.rep._lensClick(this.cursor.x, this.cursor.y)) this._cierra();
      return true;
    }
    return document.pointerLockElement === this.g.canvas && this._usa();
  }

  tecla(code) {
    if (this.fase === 'muerto' || this.fase === 'sigue') return true;
    const tape = this.g.tape;
    if (tape?.playing && code === 'KeyM') { tape.stop(); return true; }
    if (this.panel) {
      if (code === 'KeyE' || code === 'Escape') this._cierra();
      return code !== 'KeyL';     // (ESPACIO atornilla, no es la linterna)
    }
    if (code === 'KeyE' && this.fase === 'anda') return this._usa() || true;
    return false;
  }

  ataca(enemigo) {
    if (this.g.n4dbg?.invincible) {
      this.asomados.quitaTodos();
      this.asomados.atacado = false;
      this.peek = null;
      this.dentro = null;
      this.calmaT = 1.2;
      if (this.enc?.e) this.enc.e = this._largoEscena();
      return;
    }
    if (this.fase === 'muerto') return;
    this.fase = 'muerto';
    this.rep.done = true;
    this.L.stop();
    this.g._n4Death(enemigo);
  }

  // --- se asoman mientras se repara ---
  _seAsoma() {
    const pool = R.ENEMIES.filter((e) => !this.g.n4dbg?.off.has(e));
    const puertas = PUERTAS[this.sala] ?? [];
    if (!pool.length || !puertas.length) return;
    const [x, y] = pick(puertas);
    if (Math.random() >= R.PEEK_CHANCE) {
      this._son('ambiente/crujido', { volume: 0.5, pan: this.asomados._pan(x, y) });
      return;
    }
    const enemigo = pick(pool);
    this.peek = this.asomados.nuevo(enemigo, [[x, y]], {
      mudo: true, busca: R.PEEK_TIME_3D, facil: { find: R.PEEK_TIME_3D, retire: R.PEEK_LIGHT },
      alTiempo: (e) => this._entra(e),
    });
  }

  /** Nadie le ha alumbrado a tiempo: entra en la sala (la mecánica de la luz normal). */
  _entra(e) {
    this.peek = null;
    const caja = this.o.salas.find((s) => s.n === this.sala)?.caja;
    const sitios = caja ? this.asomados.sitiosEn(caja, 3) : [];
    if (!sitios.length) sitios.push(e.sitios[0]);
    this.dentro = this.asomados.nuevo(e.enemigo, sitios, {
      busca: R.INSIDE_KILL_3D, mudoAlEntrar: true,
      tune: { find: R.INSIDE_KILL_3D, pose: R.POSE_WINDOW, move: R.MOVE_WINDOW, retire: R.RETIRE_TIME },
    });
    this._son(pick(['pasos/metal', 'ambiente/crujido']), { volume: R.ENTER_VOLUME, muffle: 0.55, pan: this.asomados._pan(...sitios[0]) });
  }

  // --- El Largo y Slaimi ---
  _largoEscena() {
    const { slaimi, eje } = this.enc.esc;
    const [sx, sy] = slaimi;
    const per = [-eje[1], eje[0]];
    const sitios = [[sx + eje[0] * 1.3, sy + eje[1] * 1.3], [sx - per[0] * 1.2, sy - per[1] * 1.2], [sx + per[0] * 1.2, sy + per[1] * 1.2], [sx + eje[0] * 2.6, sy + eje[1] * 2.6]];
    return this.asomados.nuevo('largo', sitios, {
      pose: 'crouch', busca: LG.FIND_TIME_3D,
      tune: { find: LG.FIND_TIME_3D, pose: LG.POSE_WINDOW, move: LG.MOVE_WINDOW, retire: LG.RETIRE_TIME, changes: LG.CHANGES },
    });
  }

  _empiezaEscena(esc) {
    if (this.enc) return;
    this.fase = 'escena';
    this.asomados.quitaTodos();
    this.peek = null;
    this.dentro = null;
    this.rep.met = true;
    this.g._n4Save?.('n4b');
    this.enc = { esc, t: 0, intro: true, e: null };
    this.enc.e = this._largoEscena();
    this.enc.e.pausa = true;
    this.enc.e.mat.uniforms.uBase.value = 0.5;   // (se le ve a contraluz de Slaimi)
    this._creaSlaimi(esc.slaimi);
    this._son('largo/grunido', { volume: 1 });
    this._son('criaturas/chillido', { volume: 0.5, when: 0.3, pitch: 1.8 });
    this._di('¡El Largo esta atacando a algo!', 2.2);
  }

  _creaSlaimi([x, y]) {
    const lienzo = document.createElement('canvas');
    lienzo.width = lienzo.height = 512;
    const tex = new THREE.CanvasTexture(lienzo);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const malla = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), mat);
    malla.renderOrder = 4;
    this.L.escena.add(malla);
    this.sl = { x, y, lienzo, tex, mat, malla, dibujaIn: 0 };
  }

  _quitaSlaimi() {
    if (!this.sl) return;
    this.L.escena.remove(this.sl.malla);
    this.sl.malla.geometry.dispose();
    this.sl.mat.dispose();
    this.sl.tex.dispose();
    this.sl = null;
  }

  _dibujaSlaimi(dt) {
    const s = this.sl;
    s.dibujaIn -= dt;
    if (s.dibujaIn > 0) return;
    s.dibujaIn = 1 / 15;
    const c = s.lienzo.getContext('2d');
    c.clearRect(0, 0, 512, 512);
    const brillo = c.createRadialGradient(256, 300, 10, 256, 300, 205);
    brillo.addColorStop(0, 'rgba(100,150,255,0.3)');
    brillo.addColorStop(1, 'rgba(100,150,255,0)');
    c.fillStyle = brillo;
    c.fillRect(0, 0, 512, 512);
    const t = this.t;
    if (this.fase === 'sigue') drawSlaimi(c, 256, 490, 300, { t, pose: 'seguir', phase: this.enc.sigue * 5 / Math.PI, sprites: this.g.sprites });
    else drawSlaimi(c, 256, 490, 300, { t, sad: true, squash: this.enc?.intro ? 0.5 + 0.5 * Math.sin(t * 18) : 0.2, sprites: this.g.sprites });
    s.tex.needsUpdate = true;
  }

  _updateEscena(dt) {
    const E = this.enc, L = this.L;
    E.t += dt;
    L.teclas.clear();                // (el enfrentamiento se aguanta en el sitio: solo se apunta)
    if (E.intro) {
      // se gira hacia lo que pasa
      const [sx, sy] = E.esc.slaimi;
      const obj = Math.atan2(sy - L.y, sx - L.x);
      let d = obj - L.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      L.yaw += d * Math.min(1, dt * 3.5);
      L.pitch += (-0.05 - L.pitch) * Math.min(1, dt * 3.5);
      if (E.t >= LG.INTRO) {
        E.intro = false;
        E.e.pausa = false;
        E.e.pose = 'stand';
        E.e.mat.uniforms.uBase.value = this.o.verSinLuz ?? 0;
        E.e.estado = 'espera';
        this.asomados._dibuja(E.e);
        this._son('largo/respiracion', { volume: 1 });
      }
    }
    this.asomados.update(dt);
    if (this.fase === 'muerto') return 'para';
    if (!E.intro && !this.asomados.lista.includes(E.e) && this.fase === 'escena') {
      this.fase = 'sigue';
      E.sigue = 0;
      this.g._setFlag?.('slaimiAliado');
      this._di('Se ha ido... El slime te sigue', 3);
    }
    return null;
  }

  _updateSigue(dt) {
    const E = this.enc, s = this.sl, L = this.L;
    E.sigue += dt;
    L.teclas.clear();
    const dx = L.x - s.x, dy = L.y - s.y, d = Math.hypot(dx, dy) || 1;
    const v = Math.min(dt * 1.6, Math.max(0, d - 1.6));
    s.x += dx / d * v;
    s.y += dy / d * v;
    this.negro = Math.max(0, E.sigue - (LG.FOLLOW_TIME - 1));
    if (E.sigue >= LG.FOLLOW_TIME) {
      this.fase = 'fin';
      this.rep.done = true;
      L.stop();
      this.g._n4Begin('B');
    }
    return 'para';
  }

  update(dt) {
    const L = this.L, rep = this.rep;
    this.t += dt;
    this.msgT = Math.max(0, this.msgT - dt);
    rep.time += dt;
    rep.msgTime = Math.max(0, rep.msgTime - dt);
    this.calmaT = Math.max(0, this.calmaT - dt);
    if (this.fase === 'muerto' || this.fase === 'fin') return 'para';
    if (this.cierraTras) this._cierraTras();
    if (this.sl) this._dibujaSlaimi(dt);
    if (this.fase === 'sigue') return this._updateSigue(dt);
    if (this.fase === 'escena') return this._updateEscena(dt);
    if (this.panel) {
      // el ratón mueve el cursor de la vista de cerca, no la cabeza
      const k = 1.3 / NIGHT7.FINAL.LIBRE.RATON;
      this.cursor.x = Math.max(0, Math.min(W, this.cursor.x - (L.yaw - this.yaw0) * k));
      this.cursor.y = Math.max(0, Math.min(H, this.cursor.y - (L.pitch - this.pitch0) * k));
      L.yaw = this.yaw0;
      L.pitch = this.pitch0;
      L.teclas.clear();
      rep.mouse = this.cursor;
      rep.spaceDown = !!L.pulsadas?.has('Space');
      if (rep._updateScrews(dt) && !this.peek && !this.dentro && this.calmaT <= 0 && this.asomados.calma <= 0) {
        this.peekIn -= dt;
        if (this.peekIn <= 0) {
          this.peekIn = rand(R.PEEK_EVERY);
          this._seAsoma();
        }
      }
      if (rep.where !== 'panel') {        // (reparada)
        this.panel = false;
        this.asomados.ciego = false;
        this._ponLente(this.sala);
      }
    } else {
      const s = this.salaEn();
      if (s !== this.sala) {
        const antes = this.sala;
        this.sala = s;
        if (antes && this.dentro) {
          // salir con él dentro: te coge
          this.ataca(this.dentro.enemigo);
          if (this.fase === 'muerto') return 'para';
        }
        if (antes && this.peek) {
          this.asomados.quitaTodos();
          this.peek = null;
        }
        this.peekIn = rand(R.PEEK_FIRST);
        if (s && this.cams[s]) {
          rep.room = s;
          if (!rep.repaired.has(s)) this._di(`${ROOMS[s].name}: la camara esta arriba, en una esquina`, 2.5);
        }
      }
      if (rep.allRepaired) {
        const esc = ESCENAS.find((c) => enCaja(c.caja, L.x, L.y));
        if (esc) this._empiezaEscena(esc);
      }
    }
    if (this.fase !== 'anda') return null;
    this.asomados.update(dt);
    if (this.fase === 'muerto') return 'para';
    if (this.peek && !this.asomados.lista.includes(this.peek)) this.peek = null;
    if (this.dentro && !this.asomados.lista.includes(this.dentro)) this.dentro = null;
    return null;
  }

  _ponLente(sala) {
    this.cams[sala]?.lente.material.uniforms.uColor.value.setRGB(0.05, 0.09, 0.12);
  }

  coloca() {
    this.asomados.coloca();
    // las reparadas (al volver de un punto de control) y el piloto: rojo parpadeando, verde reparada, solo dentro del haz
    for (const [sala, c] of Object.entries(this.cams)) {
      const hecha = this.rep.repaired.has(sala);
      const u = c.piloto.material.uniforms;
      u.uColor.value.setRGB(...(hecha ? [0.2, 1, 0.45] : [1, 0.12, 0.06]));
      if (hecha && !c.lenteLista) { c.lenteLista = true; this._ponLente(sala); }
      const enHaz = sala === this.sala && this.L.linternaOn && this._miras(c.p, 30, 0.42);
      u.uBrillo.value = enHaz && (hecha || Math.floor(this.t * 2.5) % 2) ? 1 : 0;
    }
    const s = this.sl;
    if (s) {
      s.malla.position.set(s.x, 0.53, -s.y);
      s.malla.rotation.set(0, Math.atan2(this.L.x - s.x, s.y - this.L.y), 0);
    }
  }

  draw(ctx) {
    const rep = this.rep;
    if (this.panel) {
      rep._drawCamClose(ctx);
      const { x, y } = this.cursor;
      ctx.save();
      ctx.strokeStyle = 'rgba(240,244,235,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.moveTo(x - 15, y); ctx.lineTo(x - 5, y);
      ctx.moveTo(x + 5, y); ctx.lineTo(x + 15, y);
      ctx.moveTo(x, y - 15); ctx.lineTo(x, y - 5);
      ctx.moveTo(x, y + 5); ctx.lineTo(x, y + 15);
      ctx.stroke();
      ctx.restore();
    }
    if (this.fase === 'anda') rep._drawMinimap(ctx);
    ctx.save();
    ctx.textAlign = 'center';
    if (this._usable()) {
      ctx.fillStyle = 'rgba(230,235,225,0.75)';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('E', W / 2, H / 2 + 44);
    }
    const texto = this.msgT > 0 ? this.msg : rep.msgTime > 0 ? rep.msg : this.panel ? 'Raton sobre un tornillo + MANTEN ESPACIO   ·   E: cerrar y mirar la sala' : null;
    if (texto) {
      ctx.globalAlpha = this.msgT > 0 ? Math.min(1, this.msgT) : 1;
      ctx.fillStyle = '#d8dcd0';
      ctx.font = '18px monospace';
      // (por encima de los subtítulos de la cinta, si los hay)
      ctx.fillText(texto, W / 2, this.g.tape?.playing && this.g.tape.subtitle ? H - 170 : H - 70);
      ctx.globalAlpha = 1;
    }
    if (this.fase === 'escena' && !this.enc.intro) {
      ctx.fillStyle = 'rgba(232,238,245,0.6)';
      ctx.font = '16px "Courier New", monospace';
      ctx.fillText('Mantenle la luz en la cara', W / 2, 860);
    }
    ctx.restore();
    if (this.negro > 0) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, this.negro)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}
