// =============================================================
// Noche2_3D.js — (v1.56, plan «noches 2 y 4 con movimiento libre», fase N2) LA 2.5 EN 3D: el final de la noche 2
// con movimiento libre (la misma lógica que src/ending/Night2Ending.js, con los valores de N2END; sin energía):
//   'oficina'  a oscuras; la linterna en la mesa (E o clic mirándola): empieza la cinta de la mujer y el minijuego.
//              Puede que alguien se asome a una de las dos puertas: salir con él ahí = fallo.
//   'ida'      libre por la estación hasta el reactor. Al entrar en una sala, a veces uno (al menos uno antes del
//              reactor); salir de la sala con él ahí = fallo.
//   'reactor'  la consola (manteniendo E, como un cofre: v1.63): /refresh (el pósit amarillo junto a ella, con la linterna); la grabadora del
//              hombre en el suelo (PUNTO DE LORE; solo con la linterna).
//   'enfria'   2:00 dentro del reactor (sus tres salidas, cerradas por la contención) mirando a los tres pasillos;
//              C: el panel del enfriamiento. Haz más pequeño, sonido más bajo y más agresivos según sube el %.
//   'alarma'   al 100 %: megafonía, luces rojas, puertas abriéndose por toda la nave.
//   'huida'    N2END.ESCAPE.TIME s para volver a la oficina por donde se quiera.
//   'llegada'  en la oficina: se para la cuenta atrás; puede que alguien se asome a una puerta.
//   'escena'   un golpe detrás, la vista se gira sola a un lado y a la compuerta del pasillo central; se funde con la
//              escena de siempre (la compuerta sube y algo cruza: Night2Ending, fase 4) y acaba la noche 2.
// Si te atacan: el susto de siempre y se repite desde el principio de la 2.5 (Game._finalDeath, como antes).
// =============================================================

import * as THREE from '../lib/three/three.module.min.js';
import { NochesBase } from './Noches3D.js';
import { N2END } from '../night/night2ending.js';
import { Terminal } from '../ui/Terminal.js';
import { FirstPersonView } from '../render/FirstPersonView.js';
import { drawCRT, drawTerminal, drawCarcasa } from '../render/CRT.js';
import { neighbors } from '../world/StationMap.js';
import { Night2Ending } from './Night2Ending.js';
import { CONFIG } from '../config.js';

const W = CONFIG.WIDTH, H = CONFIG.HEIGHT;
const rand = ([a, b]) => a + Math.random() * (b - a);
const pick = (l) => l[Math.floor(Math.random() * l.length)];
const quien = () => (Math.random() < 0.5 ? 'largo' : 'specimen');

// un objeto suelto (no horneado) que solo se ve con la linterna (y un poco de brillo propio)
const VS_P = `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w; }`;
const FS_P = `uniform sampler2D uMap; uniform float uTex; uniform vec3 uColor; uniform float uBrillo; uniform float uBase; uniform float uRelieve;
  uniform vec4 uLint; uniform vec4 uLintDir; varying vec2 vUv; varying vec3 vW;
  void main(){ vec3 col = uTex > 0.5 ? texture2D(uMap, vUv).rgb : uColor; float l = 0.0;
    if (uLint.w > 0.0) { vec3 d = vW - uLint.xyz; float L = length(d);
      float cono = smoothstep(uLintDir.w, mix(uLintDir.w, 1.0, 0.8), dot(d / max(L, 0.001), uLintDir.xyz));
      cono *= cono;
      l = cono / (1.0 + L * L * 0.03) * uLint.w * 0.05;
      if (uRelieve > 0.5) l *= 0.3 + 0.7 * pow(abs(dot(normalize(cross(dFdx(vW), dFdy(vW))), d / max(L, 0.001))), 1.3); }
    gl_FragColor = vec4(col * (uBase + l) + col * uBrillo, 1.0); }`;

export function prop(L, { geo, color = [0.3, 0.3, 0.3], lienzo = null, pos, yaw = 0, pitch = 0, brillo = 0, relieve = false }) {
  const tex = lienzo ? new THREE.CanvasTexture(lienzo) : null;
  if (tex) tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.ShaderMaterial({
    vertexShader: VS_P, fragmentShader: FS_P, side: THREE.DoubleSide,
    uniforms: { uMap: { value: tex }, uTex: { value: tex ? 1 : 0 }, uColor: { value: new THREE.Color(...color) },
      uBrillo: { value: brillo }, uBase: { value: 0.01 }, uRelieve: { value: relieve ? 1 : 0 }, uLint: L.uLint, uLintDir: L.uLintDir },
  });
  const m = new THREE.Mesh(geo, mat);
  // (Blender (x, y, z) → three (x, z, −y))
  m.position.set(pos[0], pos[2], -pos[1]);
  m.rotation.order = 'YXZ';
  m.rotation.set(pitch, yaw, 0);
  L.escena.add(m);
  return m;
}

// sitios (Blender x, y): las dos puertas de la oficina (en el marco y al fondo del pasillo) y los tres pasillos del reactor
const PUERTAS_OFICINA = { izq: [[90.0, -52.2], [90.0, -58.0]], der: [[90.0, -37.8], [90.0, -31.0]] };
const PASILLOS_REACTOR = {
  medbay: [[17.3, -36.0], [16.8, -32.5]],
  mess: [[42.8, -36.0], [46.8, -36.0]],
  lab: [[24.5, -42.8], [24.5, -47.0]],
};
// las tres salidas del reactor, cerradas durante el enfriamiento (la contención): [x0, y0, x1, y1]
const SALIDAS_REACTOR = [[19.3, -37.7, 20.7, -34.3], [39.3, -37.7, 40.7, -34.3], [22.8, -40.7, 26.2, -39.3]];
// la pantalla de la consola del reactor; la linterna en la mesa de la oficina; la grabadora en el suelo del reactor
// (v1.59: el centro de la pantalla: antes apuntaba por debajo de ella, y mirando el texto no salía la «E»)
export const CONSOLA = [35.5, -38.7, 1.82];
export const LINTERNA_MESA = [89.0, -45.4, 0.79];
export const GRABADORA = [27.2, -37.6, 0.06];

export class Noche2 extends NochesBase {
  constructor(L, o = {}) {
    super(L, { ...o, prueba: null });
    const g = this.g;
    this.fase = 'oficina';
    L.sinLinterna = true;
    this.term = new Terminal();
    this.term.onType = () => g.audio?.keyClick?.();
    this.term.print('SISTEMA EN REPOSO');
    this.fpv = new FirstPersonView(g.cameraView);
    this.msg = null;
    this.msgT = 0;
    this.met = 0;
    this.tiradas = new Set();
    this.enSala = null;          // { sala, e }: el enemigo de la sala en la que estás
    this.enPuerta = null;        // el de una puerta de la oficina: { estado: 'viene', t, enemigo } o el asomado
    this.cool = 0;
    this.aggro = 0;
    this.huecos = { medbay: null, mess: null, lab: null };
    this.spawnIn = N2END.FIRST_SPAWN;
    this.panel = false;
    this.panelAnim = 0;
    this.refreshIn = null;
    this.alarmaT = 0;
    this.sonidosAlarma = [];
    this.queda = 0;
    this.llegadaT = 0;
    this.escenaT = 0;
    this.pasos = {};
    this.tiempo = 0;
    this.ayuda = 0;
    this.faseT = 0;
    // los objetos sueltos: la linterna (en la mesa), el pósit junto a la consola, la grabadora en el suelo
    this.oLinterna = prop(L, { geo: new THREE.CylinderGeometry(0.035, 0.042, 0.24, 14), color: [0.16, 0.17, 0.18],
      pos: LINTERNA_MESA, pitch: Math.PI / 2, yaw: 0.5, brillo: 0.06 });
    this.oLuzLinterna = prop(L, { geo: new THREE.CircleGeometry(0.03, 14), color: [1.0, 0.85, 0.45],
      pos: [LINTERNA_MESA[0] - Math.cos(0.5) * 0.121, LINTERNA_MESA[1] + Math.sin(0.5) * 0.121, LINTERNA_MESA[2]], yaw: 0.5 - Math.PI / 2, brillo: 1.4 });
    // (v1.59) el pósit: pegado al marco del monitor, al derecho (antes miraba a la pared: se veía en espejo), gastado y con
    // una esquina levantada de verdad (la malla se dobla)
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 230;
    const c = cv.getContext('2d');
    c.fillStyle = '#e8cf3a'; c.fillRect(0, 0, 256, 230);
    c.fillStyle = 'rgba(0,0,0,0.13)'; c.fillRect(0, 0, 256, 26);
    for (let k = 0; k < 90; k++) {
      c.fillStyle = `rgba(70,50,10,${0.03 + Math.random() * 0.07})`;
      c.fillRect(Math.random() * 256, Math.random() * 230, 2 + Math.random() * 16, 1 + Math.random() * 5);
    }
    const sombra = c.createLinearGradient(256, 230, 190, 170);
    sombra.addColorStop(0, 'rgba(60,40,0,0.5)');
    sombra.addColorStop(1, 'rgba(60,40,0,0)');
    c.fillStyle = sombra; c.fillRect(170, 150, 86, 80);
    c.fillStyle = '#1b1b1b'; c.font = 'bold 50px "Courier New", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(N2END.COMMAND, 128, 118);
    const gPosit = new THREE.PlaneGeometry(0.17, 0.153, 8, 8);
    const pp = gPosit.attributes.position;
    for (let i = 0; i < pp.count; i++) {
      // (la esquina de abajo a la derecha, vista de frente, se levanta)
      const d = Math.max(0, (pp.getX(i) + 0.085) / 0.17 + (0.0765 - pp.getY(i)) / 0.153 - 1.35);
      pp.setZ(i, 0.05 * d * d);
    }
    gPosit.computeVertexNormals();
    this.oPosit = prop(L, { geo: gPosit, lienzo: cv, pos: [34.76, -38.67, 2.08], yaw: Math.PI, brillo: 0.09 });
    this._creaPantalla();
    this.oGrabadora = prop(L, { geo: new THREE.BoxGeometry(0.22, 0.07, 0.14), color: [0.12, 0.11, 0.1], pos: GRABADORA, yaw: 0.7 });
    // (desde el debug: g._noche2Salto = 'reactor' | 'enfria' | 'huida' | 'escena')
    const salto = g._noche2Salto;
    g._noche2Salto = null;
    if (salto) this._salta(salto);
  }

  stop() {
    super.stop();
    for (const m of [this.oPantalla, this.oLinterna, this.oLuzLinterna, this.oPosit, this.oGrabadora]) if (m) this.L.escena.remove(m);
    this._tinte(0);
    this.g.audio?.setLoop?.('n2alarma', false);
    this.g.audio?.setMasterLevel?.(1);
  }

  /** (v1.59) El cristal de la consola del reactor: un CRT de verdad en una malla curvada, con el texto SIEMPRE dentro. */
  _creaPantalla() {
    const cv = this.cvPantalla = document.createElement('canvas');
    cv.width = 1024;
    cv.height = 536;
    this.ctxPantalla = cv.getContext('2d');
    this.texPantalla = new THREE.CanvasTexture(cv);
    this.texPantalla.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.PlaneGeometry(1.3, 0.68, 24, 12);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = p.getX(i) / 0.65, b = p.getY(i) / 0.34;
      p.setZ(i, 0.035 * (1 - 0.55 * a * a - 0.45 * b * b));
    }
    geo.computeVertexNormals();
    const m = this.oPantalla = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: this.texPantalla, toneMapped: false }));
    m.position.set(CONSOLA[0], CONSOLA[2], -CONSOLA[1]);
    m.rotation.y = Math.PI;
    this.L.escena.add(m);
    this.pantallaIn = 0;
    this.pantallaT = null;      // (cuándo empezó a salir el mensaje, línea a línea)
    this._pintaPantalla();
  }

  _pintaPantalla() {
    const MSG = N2END.CONSOLA_MSG ?? [];
    const quieta = this.refreshIn === null && this.fase !== 'enfria' && this.fase !== 'alarma' && this.fase !== 'huida';
    // las líneas del mensaje salen una a una, letra a letra, como en una terminal
    let queda = this.pantallaT === null ? 0 : (this.tiempo - this.pantallaT) * 34;
    const idle = [];
    for (const l of MSG) {
      if (queda <= 0) break;
      idle.push(l.slice(0, Math.floor(queda)));
      queda -= l.length + 8;
    }
    drawCRT(this.ctxPantalla, { x: 0, y: 0, w: 1024, h: 536 }, (cx, w, h, fx) => drawTerminal(cx, w, h, fx, this.term, {
      title: 'REACTOR // CONTROL', hint: this.term.focused ? '[ENTER] EJECUTAR  [ESC] SALIR' : '[E] USAR',
      prompt: true, idle: quieta ? idle : null, colorEntrada: '#ffd98a', colorError: '#ff5a48', font: 38,
    }), { time: this.tiempo, reflect: false, curve: 0 });
    this.texPantalla.needsUpdate = true;
  }

  _salta(a) {
    this._cogeLinterna(true);
    if (a === 'reactor') { this.fase = 'ida'; return; }
    this.fase = 'reactor';
    if (a === 'enfria') return this._enfria();
    if (a === 'huida') { this._enfria(); this.cool = 1; return this._alarma(); }
    if (a === 'escena') { this.fase = 'llegada'; this.llegadaT = 0; this.enPuerta = null; }
  }

  _di(t, s = 2.5) { this.msg = t; this.msgT = s; }
  _son(clave, o = {}) { this.g.audio?.lib?.play(clave, { pitchVar: 0.05, ...o }); }

  /** Miras algo cerca (Blender x, y, z): a menos de d m y casi de frente. */
  _miras(p, d = 2.4, ang = 0.22) {
    const L = this.L;
    const dx = p[0] - L.x, dy = p[1] - L.y, dz = p[2] - (L.ojosZ ?? 1.65);
    const dist = Math.hypot(dx, dy, dz);
    if (dist > d) return false;
    const fx = Math.cos(L.yaw) * Math.cos(L.pitch), fy = Math.sin(L.yaw) * Math.cos(L.pitch), fz = Math.sin(L.pitch);
    return Math.acos(Math.max(-1, Math.min(1, (dx * fx + dy * fy + dz * fz) / dist))) < Math.max(ang, Math.atan(0.25 / dist));
  }

  /** Lo que se puede usar ahora mismo y lo que indica la pantalla: E o clic; la consola, manteniendo E (v1.63). */
  _usable() {
    if (this.fase === 'oficina' && this.L.sinLinterna && this._miras(LINTERNA_MESA, 3.2, 0.25)) return 'linterna';
    if ((this.fase === 'reactor' || this.fase === 'ida') && this.salaEn() === 'reactor' && !this.term.focused && this.refreshIn === null) {
      if (this.L.linternaOn && this._miras(GRABADORA, 2.6, 0.25) && !this.grabadoraVista) return 'grabadora';
      if (this._miras(CONSOLA, 3.0, 0.5)) return 'consola';
    }
    return null;
  }

  _usa() {
    const u = this._usable();
    if (!u || u === 'consola') return false;   // (v1.63) la consola se abre en update(), manteniendo E
    if (u === 'linterna') this._cogeLinterna();
    else if (u === 'grabadora') {
      this.grabadoraVista = true;
      this._di('Una grabadora. La cinta está atascada.', 3.5);
      this._son('caidas/herramienta', { volume: 0.25 });
      this.g._setFlag?.('grabadoraHombre');
    }
    return true;
  }

  click() {
    if (this.susto || this.fase === 'escena' || this.term.focused) return true;
    return document.pointerLockElement === this.g.canvas && this._usa();
  }

  tecla(code, e) {
    if (this.susto || this.fase === 'escena') return true;
    const tape = this.g.tape;
    if (tape?.playing && code === 'KeyM') { tape.stop(); return true; }
    if (this.term.focused) {
      this.L.teclas.clear();
      // (v1.63) la E que abrió la consola, si sigue pulsada, no se escribe
      if (this.eDeAbrir && code === 'KeyE' && e?.repeat) return true;
      this.eDeAbrir = false;
      const cmd = e ? this.term.key(e) : (code === 'Escape' ? (this.term.blur(), null) : null);
      if (cmd !== null && cmd !== undefined) this._comando(cmd);
      return true;
    }
    if (code === 'KeyE') return this._usable() === 'consola' || this._usa();
    if (this.fase === 'enfria' && code === 'KeyC') {
      this.panel = !this.panel;
      if (this.panel) this.L.linternaOn = false;
      return true;
    }
    if (this.fase === 'enfria' && this.panel && (code === 'Space' || code === 'KeyF')) return true;
    return false;
  }

  _comando(t) {
    this._son('final/boton', { volume: 0.45 });   // (v1.59: el Enter suena distinto de las teclas)
    if (t.trim().toLowerCase() === N2END.COMMAND) {
      this.term.print('Enfriamiento iniciado... OK');
      this.term.blur();
      this.refreshIn = 1.5;
      this._son('ambiente/ventilacion', { volume: 0.9 });
    } else this.term.print('Comando no reconocido');
  }

  _cogeLinterna(callado = false) {
    const L = this.L;
    L.sinLinterna = false;
    this.oLinterna.visible = this.oLuzLinterna.visible = false;
    this.linternaEn = this.tiempo;
    if (callado) return;
    this.g.audio?.keyClick?.();
    L.linternaOn = true;
    this.ayuda = N2END.HINT_TIME;
    // «audio 2.5»: la cinta de la mujer empieza AHORA (si no se ha escuchado ya)
    if (!this.g.save?.tapesHeard?.mujer) this.g.tape?.schedule?.('mujer', { contexto: 'minijuego' });
    this._planPuerta(N2END.OFFICE_ENEMY_CHANCE);
  }

  /** Puede que alguien se asome a una puerta de la oficina (tras un rato). */
  _planPuerta(prob, tope = null) {
    if (Math.random() >= prob) return;
    const seguro = this.fase === 'oficina' ? Math.max(0, N2END.START_SAFE - (this.tiempo - (this.linternaEn ?? this.tiempo))) : 0;
    const t = seguro + rand(N2END.OFFICE_ENEMY_DELAY);
    this.enPuerta = { estado: 'viene', t: tope !== null ? Math.min(t, tope) : t, enemigo: quien() };
  }

  _tune() {
    if (this.fase === 'huida' || this.fase === 'llegada') {
      const E = N2END.ESCAPE;
      return { find: E.FIND_TIME, pose: E.POSE_WINDOW, move: E.MOVE_WINDOW, retire: E.RETIRE_TIME };
    }
    if (this.fase === 'enfria') {
      const a = N2END.P2_AGGRO[this.aggro - 1];
      const w = a ? a.WINDOW : 1;
      return { find: N2END.FIND_TIME_P2 * w, pose: N2END.POSE_WINDOW * w, move: N2END.MOVE_WINDOW * w, retire: N2END.RETIRE_TIME };
    }
    return { find: N2END.FIND_TIME, pose: N2END.POSE_WINDOW, move: N2END.MOVE_WINDOW, retire: N2END.RETIRE_TIME };
  }

  /** ¿Hay enemigo al entrar en esta sala? (como Night2Ending._rollEnemy) */
  _tirada(sala) {
    if (sala === 'reactor' || sala === 'office') return null;
    if (this.fase === 'ida') {
      if (this.tiempo - (this.linternaEn ?? 0) < N2END.START_SAFE) return null;
      const forzado = this.met === 0 && neighbors('reactor').includes(sala);
      if (!forzado && this.tiradas.has(sala)) return null;
      this.tiradas.add(sala);
      return forzado || Math.random() < N2END.P1_ROOM_CHANCE ? quien() : null;
    }
    if (this.fase !== 'huida') return null;
    const E = N2END.ESCAPE;
    if (this.tiradas.has(sala) || this.met >= E.MAX_ENEMIES) return null;
    this.tiradas.add(sala);
    // (al menos MIN_ENEMIES en la vuelta: si van pocos, casi seguro)
    const forzado = this.met < E.MIN_ENEMIES && this.tiradas.size >= 2;
    return forzado || Math.random() < E.ROOM_CHANCE ? quien() : null;
  }

  alEntrar(sala, antes) {
    if (sala === null) return;           // (un pasillo)
    if (this.enSala && !this.asomados.lista.includes(this.enSala.e)) this.enSala = null;
    if (this.enSala) return;             // (sigue ahí el de la otra sala: update cuenta el tiempo fuera)
    if (sala === 'office') {
      if (this.fase === 'huida') this._llega();
      return;
    }
    if (sala === 'reactor' && this.fase === 'ida') {
      this.fase = 'reactor';
      this._di('El reactor. La consola...', 2.5);
      return;
    }
    this._son('pasos/metal', { volume: 0.25 });
    const en = this._tirada(sala);
    if (!en) return;
    this.asomados.o.tune = this._tune();
    const e = this.saleUno(sala, en, { facil: this.met === 0 && this.fase === 'ida' ? { retire: N2END.FIRST_ENEMY.RETIRE, find: N2END.FIRST_ENEMY.FIND } : null });
    if (!e) return;
    this.met++;
    this.enSala = { sala, e };
    if (en === 'largo') this.g.audio?.lib?.play('largo/grunido', { volume: 0.6, when: 0.4 });
  }

  /** (v1.63, el usuario: «como un cofre») Manteniendo E delante de la consola se llena el círculo y se abre. */
  _cargaConsola(dt) {
    if (this._usable() !== 'consola' || !this.L.teclas.has('KeyE')) { this.cargaE = 0; return; }
    if (!this.cargaE) this.g.audio?.keyClick?.();
    this.cargaE = (this.cargaE ?? 0) + dt / N2END.CONSOLA_E;
    if (this.cargaE < 1) return;
    this.cargaE = 0;
    this.eDeAbrir = true;
    this.term.focus();
    this.L.teclas.clear();
    this._son('final/boton', { volume: 0.4 });
  }

  update(dt) {
    this._cargaConsola(dt);
    this.tiempo += dt;
    this.faseT += dt;
    // (v1.59) el cristal de la consola: se repinta 12 veces por segundo y solo si estás cerca
    if (this.pantallaT === null && this.salaEn() === 'reactor') this.pantallaT = this.tiempo;
    this.pantallaIn -= dt;
    if (this.pantallaIn <= 0 && Math.hypot(this.L.x - CONSOLA[0], this.L.y - CONSOLA[1]) < 26) {
      this.pantallaIn = 1 / 12;
      this._pintaPantalla();
    }
    this.msgT = Math.max(0, this.msgT - dt);
    this.ayuda = Math.max(0, this.ayuda - dt);
    if (this.susto) return 'para';
    if (this.fase === 'escena') return this._escena(dt);
    if (this.term.focused) this.L.teclas.clear();
    // la sala en la que estás (y salir de la oficina con alguien en la puerta = fallo)
    const s = this.salaEn();
    if (s !== this.sala) {
      const antes = this.sala;
      this.sala = s;
      if (antes === 'office' && this.enPuerta?.estado === 'viene') this.enPuerta = null;   // (ha salido antes de que llegara)
      this.alEntrar(s, antes);
    }
    // salir de la sala (o de la oficina) con su enemigo ahí = fallo (con un margen: pisar la puerta no cuenta)
    const conEl = this.enSala && this.asomados.lista.includes(this.enSala.e) ? this.enSala
      : this.enPuerta?.malla && this.asomados.lista.includes(this.enPuerta) ? { sala: 'office', e: this.enPuerta } : null;
    if (conEl && this.sala !== conEl.sala) {
      this.fueraT = (this.fueraT ?? 0) + dt;
      if (this.fueraT > 0.8) { this.ataca(conEl.e.enemigo, conEl.sala === 'office' ? 'salió con él en la puerta' : 'salir'); return 'para'; }
    } else this.fueraT = 0;
    if (this.enSala && !this.asomados.lista.includes(this.enSala.e)) this.enSala = null;
    // el de la puerta de la oficina
    const P = this.enPuerta;
    if (P?.estado === 'viene' && this.sala === 'office') {
      P.t -= dt;
      if (P.t <= 0 && this.asomados.calma <= 0) {
        this.asomados.o.tune = this._tune();
        const lado = Math.random() < 0.5 ? 'izq' : 'der';
        this.enPuerta = this.asomados.nuevo(P.enemigo, PUERTAS_OFICINA[lado], { busca: N2END.OFFICE_ENEMY_FIND });
      }
    }
    if (this.refreshIn !== null) {
      this.refreshIn -= dt;
      if (this.refreshIn <= 0) { this.refreshIn = null; this._enfria(); }
    }
    if (this.fase === 'enfria') this._updateEnfria(dt);
    if (this.fase === 'alarma') this._updateAlarma(dt);
    if (this.fase === 'huida') {
      this.queda -= dt;
      if (this.queda <= 0) { this.ataca('largo', 'tiempo'); return 'para'; }
    }
    if (this.fase === 'huida' || this.fase === 'llegada' || this.fase === 'alarma') this._tinte(0.15 + 0.85 * this._rojo());
    if (this.fase === 'llegada') {
      const vivo = this.enPuerta && (this.enPuerta.estado === 'viene' || this.asomados.lista.includes(this.enPuerta));
      if (!vivo) {
        this.llegadaT += dt;
        if (this.llegadaT >= N2END.ESCAPE.ARRIVE_CALM) this._empiezaEscena();
      } else this.llegadaT = 0;
    }
    this.asomados.update(dt);
    return this.susto ? 'para' : null;
  }

  _rojo() {
    const k = (this.tiempo % N2END.ESCAPE.RED_PERIOD) / N2END.ESCAPE.RED_PERIOD;
    return Math.pow(Math.max(0, Math.sin(k * Math.PI)), 3);
  }

  /** La luz roja de alarma en todas las salas (la horneada, teñida, y un poco de rojo propio). */
  _tinte(k) {
    for (const Z of Object.values(this.L.zonas)) Z.mat?.uniforms?.uTinte?.value.set(3.5 * k, 0, 0);
  }

  _muros(on) {
    const L = this.L;
    L._solidos();
    if (!on) return;
    for (const [x0, y0, x1, y1] of SALIDAS_REACTOR) {
      L.solidos.push({ n: 'contencion', z: [0, 4], p: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], x0, x1, y0, y1 });
    }
  }

  _enfria() {
    this.fase = 'enfria';
    this.faseT = 0;
    this.cool = 0;
    this.aggro = 0;
    this.spawnIn = N2END.FIRST_SPAWN;
    this.huecos = { medbay: null, mess: null, lab: null };
    this.asomados.quitaTodos();
    this.enSala = null;
    this.g.audio?.setMasterLevel?.(N2END.P2_VOLUME);
    this._son('puertas/golpe', { volume: 0.7 });
    this._muros(true);
  }

  _updateEnfria(dt) {
    this.panelAnim = Math.max(0, Math.min(1, this.panelAnim + (this.panel ? 1 : -1) * dt / 0.25));
    this.cool = Math.min(1, this.cool + dt / N2END.COOL_TIME);
    if (this.cool >= 1) return this._alarma();
    let nivel = 0;
    N2END.P2_AGGRO.forEach((a, i) => { if (this.cool >= a.AT) nivel = i + 1; });
    this.aggro = nivel;
    this.spawnIn -= dt;
    if (this.spawnIn <= 0 && this.asomados.calma <= 0) {
      const a = N2END.P2_AGGRO[this.aggro - 1];
      this.spawnIn = rand(N2END.SPAWN_EVERY) * (a ? a.SPAWN : 1);
      const libres = Object.keys(this.huecos).filter((k) => !this.huecos[k] || !this.asomados.lista.includes(this.huecos[k]));
      if (libres.length && 3 - libres.length < N2END.MAX_ENEMIES) {
        const id = pick(libres);
        this.asomados.o.tune = this._tune();
        const en = quien();
        this.huecos[id] = this.asomados.nuevo(en, PASILLOS_REACTOR[id], { busca: this._tune().find });
        this.g.audio?.lib?.play(en === 'largo' ? 'largo/grunido' : 'criaturas/grunido', { volume: 0.5, muffle: 0.45 });
      }
    }
  }

  _alarma() {
    this.fase = 'alarma';
    this.faseT = 0;
    this.alarmaT = 0;
    this.panel = false;
    this.panelAnim = 0;
    this.asomados.quitaTodos();
    this.huecos = { medbay: null, mess: null, lab: null };
    const au = this.g.audio;
    au?.setMasterLevel?.(1);
    au?.playFile?.(N2END.PA_FILE, { volume: 1 });
    au?.setLoop?.('n2alarma', true, () => au._sirenLoop());
    this.sonidosAlarma = [
      [2.2, 'puertas/apertura', 0.9, -0.6, 0.2], [2.9, 'puertas/golpe', 0.6, 0.7, 0.5],
      [3.5, 'puertas/apertura', 0.5, 0.3, 0.6], [4.1, 'criaturas/grunido', 0.5, -0.4, 0.5],
      [4.6, 'puertas/apertura', 0.7, 0.8, 0.35], [5.2, 'largo/grunido', 0.6, -0.8, 0.6],
      [5.8, 'metal/golpe_pared', 0.6, 0.2, 0.5], [6.3, 'puertas/apertura', 0.4, -0.2, 0.75],
    ];
  }

  _updateAlarma(dt) {
    this.alarmaT += dt;
    while (this.sonidosAlarma.length && this.sonidosAlarma[0][0] <= this.alarmaT) {
      const [, clave, volume, pan, muffle] = this.sonidosAlarma.shift();
      this.g.audio?.lib?.play(clave, { volume, pan, muffle });
    }
    if (this.alarmaT >= N2END.ALARM_TIME) {
      this.fase = 'huida';
      this.faseT = 0;
      this.queda = this.o.huidaS ?? N2END.ESCAPE.TIME;
      this.tiradas = new Set();
      this.met = 0;
      this.enPuerta = null;
      this._muros(false);
    }
  }

  _llega() {
    this.fase = 'llegada';
    this.llegadaT = 0;
    this.enPuerta = null;
    this._planPuerta(N2END.ESCAPE.OFFICE_ENEMY_CHANCE, 2);
  }

  _empiezaEscena() {
    this.fase = 'escena';
    this.escenaT = 0;
    this.pasos = {};
    this.asomados.quitaTodos();
    this.L.teclas.clear();
    this.g.audio?.setLoop?.('n2alarma', false);
    this._son('puertas/golpe', { volume: 0.95, muffle: 0.2 });
    this._son('metal/golpe_pared', { volume: 0.6, when: 0.35, muffle: 0.35 });
    this.giro = { yaw0: this.L.yaw, pitch0: this.L.pitch, lado: Math.random() < 0.5 ? -Math.PI / 2 : Math.PI / 2 };
  }

  /** La escena: un golpe detrás, la vista se gira sola a un lado (pausa) y a la compuerta de atrás; se funde con la
   *  escena de siempre (Night2Ending, fase 4: la compuerta sube y algo cruza) y acaba la noche 2. */
  _escena(dt) {
    const S = N2END.CORRIDOR_SCENE, L = this.L, t = (this.escenaT += dt);
    L.teclas.clear();
    this._tinte(0.15 + 0.85 * this._rojo());
    const suave = (k) => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
    const dif = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
    const G = this.giro;
    if (t < S.TURN2_AT) L.yaw = G.yaw0 + dif(G.yaw0, G.lado) * suave((t - S.TURN_AT) / 0.9);
    else L.yaw = G.lado + dif(G.lado, 0) * suave((t - S.TURN2_AT) / 1.0);   // (la compuerta de atrás, al este)
    L.pitch = G.pitch0 * (1 - suave(t / 1.5));
    if (t >= S.TURN2_AT + 1.05 && !this.pasos.funde) {
      this.pasos.funde = true;
      this._aLaEscena2D();
    }
    return 'para';
  }

  _aLaEscena2D() {
    const g = this.g, S = N2END.CORRIDOR_SCENE;
    const img = document.createElement('canvas');
    img.width = g.canvas.width;
    img.height = g.canvas.height;
    img.getContext('2d').drawImage(g.canvas, 0, 0);
    this.L.stop();
    if (!g.final) g.final = new Night2Ending(g);
    else g.final.start();
    const F = g.final;
    F.backView.v2 ??= g.ofv2;
    g.ofv2?.update?.(0);   // (su estado: «normal»; desde el debug aún no se había puesto)
    F.flash.taken = true;
    F.phase = 4;
    F.where = 'scene';
    F.sceneT = S.TURN2_AT + 1.05;
    F.sceneSteps = { giro: true, giro2: true };
    F.sceneSide = 'left';
    F.look.reset();
    F.look.face = 'back';
    F.look.enabled = false;
    g._fundePrologo = { img, t: 0 };
    g._setState('final');
  }

  ataca(enemigo, por) {
    if (this.susto) return;
    this.susto = { t: 0, enemigo, por };
    console.info('Vigía-7 noche 2 en 3D: te ataca', enemigo, '(' + por + ')');
    this.g.audio?.setLoop?.('n2alarma', false);
    this.L.stop();
    this.g._finalDeath(enemigo, por === 'tiempo' ? 'final_tiempo' : null);
  }

  coloca() {
    super.coloca();
    // (enfriamiento: el haz más pequeño y más débil)
    if (this.fase === 'enfria' && this.L.uLint.value.w > 0) {
      this.L.uLint.value.w *= N2END.P2_FLASH_INTENSITY;
      this.L.uLintDir.value.w = Math.cos((this.L.R.linterna.ANGULO ?? 0.36) * N2END.P2_FLASH_SCALE);
    }
  }

  draw(ctx) {
    if (this.susto) return;
    const W2 = W / 2;
    // la «E» delante de lo que se puede usar
    const usable = this._usable();
    if (usable === 'consola' && !this.term.focused) {
      // (v1.63) como un cofre: la E con un círculo que se llena al mantenerla
      const cy = H / 2 + 66;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(157,255,176,0.25)';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.arc(W2, cy, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#9dffb0';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(W2, cy, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, this.cargaE ?? 0));
      ctx.stroke();
      ctx.fillStyle = '#9dffb0';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('E', W2, cy + 1);
      ctx.font = 'bold 15px monospace';
      ctx.fillText('MANTÉN', W2, cy + 40);
      ctx.restore();
    } else if (usable && !this.term.focused) {
      const texto = 'E', ancho = 34;
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.textAlign = 'center';
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = '#9dffb0';
      ctx.strokeStyle = 'rgba(157,255,176,0.7)';
      ctx.strokeRect(W2 - ancho / 2, H / 2 + 38, ancho, 30);
      ctx.fillText(texto, W2, H / 2 + 60);
      ctx.restore();
    }
    // la consola del reactor, de cerca (el mismo CRT)
    if (this.term.focused) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      // (v1.59) el mismo aparato: con su carcasa, y el borde iluminado cuando ya se puede escribir
      const rc = { x: W2 - 400, y: H / 2 - 270, w: 800, h: 520 };
      drawCarcasa(ctx, rc, !this.term.booting, this.tiempo);
      drawCRT(ctx, rc, (cx, w, h, fx) => drawTerminal(cx, w, h, fx, this.term, {
        title: 'REACTOR // CONTROL', hint: '[ENTER] EJECUTAR  [ESC] SALIR', prompt: true, colorEntrada: '#ffd98a', colorError: '#ff5a48',
      }), { time: this.tiempo, reflect: false });
    }
    if (this.fase === 'enfria') {
      this.fpv.drawCoolingPanel(ctx, this.cool, this.panelAnim, N2END.COOL_TIME);
      this.fpv.drawConsoleTab(ctx, this.panel);
    }
    if (this.fase === 'huida') {
      const s = Math.max(0, Math.ceil(this.queda));
      ctx.save();
      ctx.fillStyle = s <= 10 && Math.floor(this.tiempo * 4) % 2 ? '#ffffff' : '#ff3b30';
      ctx.font = 'bold 54px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.shadowColor = 'rgba(255,40,30,0.8)';
      ctx.shadowBlur = 16;
      ctx.fillText(`0:${String(s).padStart(2, '0')}`, W2, 124);
      ctx.restore();
    }
    // (la ayuda de controles, solo unos segundos; v0.51: sin textos que digan qué hacer)
    const hint = this.fase === 'enfria' && this.faseT < N2END.HINT_TIME ? 'ESPACIO / F: linterna   ·   C: consola'
      : this.ayuda > 0 ? 'ESPACIO / F: linterna' : '';
    if (hint || this.msgT > 0) this.fpv.drawHint(ctx, hint, this.msgT > 0 ? this.msg : null, 1);
  }
}
