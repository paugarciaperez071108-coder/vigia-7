// =============================================================
// Libre3D.js — (v1.28, M0) El final en 3D en tiempo real: andar libre por las salas de la nave.
// Prototipo: el Comedor de la huida (estado de las 6:00), con la luz de Blender horneada en Cycles
// (tools/3d/final/tr/hornear_sala.py → assets/final/tr/<sala>.glb + _luz.webp + _fuego.webp + .json).
//   W A S D   moverse (sin raíles ni paradas)         ratón     mirar (clic: captura el ratón)
//   Shift     correr, con aguante (la respiración avisa)  C / Ctrl  agacharse
// Colisiones: la planta de la sala en polígonos convexos con su altura (lo bajo se pisa; bajo lo alto se pasa
// agachado). Valores en NIGHT7.FINAL.LIBRE. Se dibuja en un WebGL aparte (three.js, src/lib/three, MIT) y se copia
// al canvas del juego, como Pano360.
// =============================================================

import * as THREE from '../lib/three/three.module.min.js';
import { GLTFLoader } from '../lib/three/addons/GLTFLoader.js';
import { CONFIG } from '../config.js';
import { NIGHT7 } from '../night/night7.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const K = NIGHT7.FINAL.LIBRE;
const DIR = 'assets/final/tr/';

const VS = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const FS = `
uniform sampler2D uLuz;
uniform sampler2D uFuego;
uniform float uK;
uniform float uFlick;
varying vec2 vUv;
void main() {
  vec3 base = pow(texture2D(uLuz, vUv).rgb, vec3(2.2)) * uK;
  vec3 fue = pow(texture2D(uFuego, vUv).rgb, vec3(2.2)) * uK;
  gl_FragColor = vec4(base + fue * uFlick, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** El punto más cercano del polígono convexo pol (en sentido antihorario) a (x, y), y si está dentro. */
function cercano(pol, x, y) {
  let dentro = true;
  let bx = 0, by = 0, bd = Infinity;
  for (let i = 0; i < pol.length; i++) {
    const [ax, ay] = pol[i];
    const [cx, cy] = pol[(i + 1) % pol.length];
    const ex = cx - ax, ey = cy - ay;
    if (ex * (y - ay) - ey * (x - ax) < 0) dentro = false;
    const l2 = ex * ex + ey * ey || 1e-9;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / l2));
    const px = ax + ex * t, py = ay + ey * t;
    const d = (px - x) ** 2 + (py - y) ** 2;
    if (d < bd) { bd = d; bx = px; by = py; }
  }
  return { dentro, x: bx, y: by, d: Math.sqrt(bd) };
}

export class Libre3D {
  constructor(game) {
    this.g = game;
    this.activa = false;
    this.listo = false;
    this.teclas = new Set();
  }

  static soportado() {
    try {
      return !!document.createElement('canvas').getContext('webgl2');
    } catch (e) {
      return false;
    }
  }

  _son(clave, o = {}) {
    this.g.audio?.lib?.play(clave, { pitchVar: 0.05, ...o });
  }

  // ------------------------------------------------------------------ cargar
  _init() {
    if (this.r) return;
    const r = this.r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    r.setSize(W, H, false);
    r.setPixelRatio(1);
    r.toneMapping = THREE.AgXToneMapping;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.escena = new THREE.Scene();
    this.escena.background = new THREE.Color(0x000000);
    // (74° en horizontal, como los renders de la huida)
    const vfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(K.LENTE / 2)) / (W / H));
    this.cam = new THREE.PerspectiveCamera(THREE.MathUtils.radToDeg(vfov), W / H, 0.05, 200);
    this.cam.rotation.order = 'YXZ';
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS,
      uniforms: { uLuz: { value: null }, uFuego: { value: null }, uK: { value: 4 }, uFlick: { value: 1 } },
    });
    // el ratón: con el puntero capturado, movementX/Y; sin capturar, el borde de la pantalla (como en los cruces)
    this._mueve = (e) => {
      if (!this.activa || document.pointerLockElement !== this.g.canvas) return;
      this.yaw -= e.movementX * K.RATON;
      this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch - e.movementY * K.RATON));
    };
    document.addEventListener('mousemove', this._mueve);
  }

  _carga(sala) {
    const tex = (n) => new Promise((ok) => new THREE.TextureLoader().load(`${DIR}${n}`, (t) => {
      t.flipY = false;
      t.colorSpace = THREE.NoColorSpace;
      t.anisotropy = 4;
      ok(t);
    }, undefined, () => ok(null)));
    return Promise.all([
      fetch(`${DIR}${sala}.json`).then((r) => r.json()),
      new Promise((ok, mal) => new GLTFLoader().load(`${DIR}${sala}.glb`, ok, undefined, mal)),
      tex(`${sala}_luz.webp`), tex(`${sala}_fuego.webp`),
    ]).then(([info, gltf, luz, fuego]) => {
      this.info = info;
      this.mat.uniforms.uLuz.value = luz;
      this.mat.uniforms.uFuego.value = fuego;
      this.mat.uniforms.uK.value = info.K;
      this.r.toneMappingExposure = 2 ** (info.exposicion ?? 0) * K.EXPOSICION;
      gltf.scene.traverse((o) => { if (o.isMesh) o.material = this.mat; });
      if (this.sala) this.escena.remove(this.sala);
      this.sala = gltf.scene;
      this.escena.add(this.sala);
      this.solidos = info.solidos.map((s) => {
        const xs = s.p.map((p) => p[0]), ys = s.p.map((p) => p[1]);
        return { ...s, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
      });
      this.fuegos = info.fuegos ?? [];
      this.listo = true;
    });
  }

  start(sala = 'mess') {
    this._init();
    this.activa = true;
    this.listo = false;
    this.teclas.clear();
    this.t = 0;
    this.ayuda = K.AYUDA_S;
    this.vx = this.vy = 0;
    this.aguante = 1;
    this.agotado = false;
    this.agachado = false;
    this.alto = K.OJOS;
    this.balanceo = 0;
    this.pasoAcum = 0;
    this.respIn = 2;
    this.sacude = 0;
    this._carga(sala).then(() => {
      const e = this.info.entrada;
      this.x = e.p[0];
      this.y = e.p[1];
      this.yaw = Math.atan2(e.mira[1] - e.p[1], e.mira[0] - e.p[0]);
      this.pitch = 0;
    }).catch((err) => { console.warn('Libre3D:', err); this.activa = false; });
  }

  stop() {
    this.activa = false;
    if (document.pointerLockElement === this.g.canvas) document.exitPointerLock?.();
  }

  // ------------------------------------------------------------------ teclas
  tecla(code) {
    this.teclas.add(code);
    if (code === 'KeyC') this.agachado = !this.agachado;
  }

  keyUp(code) {
    this.teclas.delete(code);
  }

  click() {
    if (document.pointerLockElement !== this.g.canvas) this.g.canvas.requestPointerLock?.();
  }

  // ------------------------------------------------------------------ andar
  _bloquea(s, alto) {
    // (lo bajo se pisa; lo que queda por encima de la cabeza, no estorba)
    return s.z[1] > K.PISA && s.z[0] < alto + 0.1;
  }

  _choca(alto) {
    const R = K.RADIO;
    for (let it = 0; it < 3; it++) {
      for (const s of this.solidos) {
        if (this.x < s.x0 - R || this.x > s.x1 + R || this.y < s.y0 - R || this.y > s.y1 + R) continue;
        if (!this._bloquea(s, alto)) continue;
        const c = cercano(s.p, this.x, this.y);
        if (c.dentro) {
          // (dentro: sale por el lado más cercano)
          const nx = this.x - c.x, ny = this.y - c.y;
          const l = Math.hypot(nx, ny) || 1e-6;
          this.x = c.x - nx / l * R;
          this.y = c.y - ny / l * R;
        } else if (c.d < R) {
          const nx = (this.x - c.x) / (c.d || 1e-6), ny = (this.y - c.y) / (c.d || 1e-6);
          this.x = c.x + nx * R;
          this.y = c.y + ny * R;
          // (pierdes la velocidad contra la pared)
          const vn = this.vx * nx + this.vy * ny;
          if (vn < 0) { this.vx -= vn * nx; this.vy -= vn * ny; }
        }
      }
    }
    const [x0, x1, y0, y1] = this.info.caja;
    this.x = Math.max(x0 + R, Math.min(x1 - R, this.x));
    this.y = Math.max(y0 + R, Math.min(y1 - R, this.y));
  }

  /** ¿Cabe de pie aquí? (para levantarse bajo una viga) */
  _cabeDePie() {
    const R = K.RADIO;
    return !this.solidos.some((s) => s.z[0] < K.OJOS + 0.15 && s.z[0] > K.AGACHADO_OJOS + 0.1 && s.z[1] > K.PISA
      && cercano(s.p, this.x, this.y).d < R);
  }

  update(dt) {
    if (!this.activa || !this.listo || this.x === undefined) return;
    this.t += dt;
    this.ayuda = Math.max(0, this.ayuda - dt);
    // el ratón sin capturar: girar en los bordes
    if (document.pointerLockElement !== this.g.canvas && this.g.mouse) {
      const dx = (this.g.mouse.x - W / 2) / (W / 2);
      if (Math.abs(dx) > 0.6) this.yaw -= Math.sign(dx) * 1.8 * ((Math.abs(dx) - 0.6) / 0.4) ** 1.4 * dt;
    }
    const tc = this.teclas;
    const agacha = this.agachado || tc.has('ControlLeft') || tc.has('ControlRight');
    const quiereCorrer = (tc.has('ShiftLeft') || tc.has('ShiftRight')) && !agacha;
    let fx = (tc.has('KeyW') || tc.has('ArrowUp') ? 1 : 0) - (tc.has('KeyS') || tc.has('ArrowDown') ? 1 : 0);
    let lx = (tc.has('KeyD') || tc.has('ArrowRight') ? 1 : 0) - (tc.has('KeyA') || tc.has('ArrowLeft') ? 1 : 0);
    const l = Math.hypot(fx, lx);
    if (l > 1) { fx /= l; lx /= l; }
    const anda = l > 0;
    const corre = anda && quiereCorrer && !this.agotado && fx > 0;
    // el aguante: se gasta corriendo (de verdad: contra una pared no) y vuelve andando o parado
    if (corre && (this.vel ?? 0) > 1.2) this.aguante = Math.max(0, this.aguante - dt / K.AGUANTE_S);
    else this.aguante = Math.min(1, this.aguante + dt / (anda ? K.RECUPERA_S * 1.6 : K.RECUPERA_S));
    if (this.aguante <= 0) this.agotado = true;
    if (this.agotado && this.aguante >= K.VUELVE_A_CORRER) this.agotado = false;
    const vmax = agacha ? K.VEL_AGACHADO : corre ? K.VEL_CORRE : K.VEL;
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    // (adelante = (cos yaw, sin yaw); la derecha = (sin yaw, -cos yaw))
    const ox = (fx * cy + lx * sy) * vmax, oy = (fx * sy - lx * cy) * vmax;
    const a = Math.min(1, dt * (anda ? K.ACELERA : K.FRENA));
    this.vx += (ox - this.vx) * a;
    this.vy += (oy - this.vy) * a;
    const px = this.x, py = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const debajo = !agacha && !this._cabeDePie();
    const altoAhora = agacha || debajo ? K.AGACHADO_OJOS + 0.2 : K.OJOS + 0.15;
    this._choca(altoAhora);
    const recorrido = Math.hypot(this.x - px, this.y - py);
    const v = recorrido / Math.max(dt, 1e-4);
    // la altura de los ojos (agacharse, suave) y el balanceo al andar
    const ojos = agacha || debajo ? K.AGACHADO_OJOS : K.OJOS;
    this.alto += (ojos - this.alto) * Math.min(1, dt * 8);
    this.balanceo += recorrido * Math.PI / (corre ? K.PASO_CORRE : K.PASO);
    // los pasos (cada media vuelta del balanceo)
    this.pasoAcum += recorrido;
    const zancada = agacha ? K.PASO * 0.8 : corre ? K.PASO_CORRE : K.PASO;
    if (this.pasoAcum >= zancada) {
      this.pasoAcum = 0;
      this._son('pasos/metal', { volume: agacha ? 0.3 : corre ? 0.75 : 0.5, pitch: corre ? 1.08 : 1.0 });
    }
    // la respiración: más rápida y fuerte corriendo y con poco aguante
    this.respIn -= dt;
    const esfuerzo = 1 - this.aguante;
    if (this.respIn <= 0 && (esfuerzo > 0.15 || corre)) {
      this.respIn = 2.6 - 1.7 * esfuerzo;
      this._son('n7/respira', { volume: 0.25 + 0.6 * esfuerzo, pitch: 1.0 + 0.35 * esfuerzo });
    }
    this.vel = v;
    this.corriendo = corre;
    this.sacude = Math.max(0, this.sacude - dt);
  }

  // ------------------------------------------------------------------ dibujar
  draw(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (!this.listo || this.x === undefined) return;
    const amp = Math.min(1, this.vel / K.VEL) * (this.corriendo ? 1.6 : 1);
    const bob = Math.sin(this.balanceo) * K.BALANCEO * amp;
    const lado = Math.sin(this.balanceo * 0.5) * K.BALANCEO * 0.6 * amp;
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    // (Blender (x, y, z) → three (x, z, -y))
    this.cam.position.set(this.x + sy * lado, this.alto + Math.abs(bob), -(this.y - cy * lado));
    this.cam.rotation.y = this.yaw - Math.PI / 2;
    this.cam.rotation.x = this.pitch + bob * 0.15;
    this.cam.rotation.z = lado * 0.25;
    // el fuego parpadea (la luz horneada del fuego, multiplicada)
    const t = this.t;
    this.mat.uniforms.uFlick.value = 0.78 + 0.12 * Math.sin(t * 9.1) + 0.07 * Math.sin(t * 23.7 + 1.3) + 0.05 * Math.sin(t * 4.3 + 2.1);
    this.r.render(this.escena, this.cam);
    ctx.drawImage(this.r.domElement, 0, 0, W, H);
    if (this.ayuda > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.ayuda) * 0.7;
      ctx.fillStyle = '#cfd8d0';
      ctx.font = '14px monospace';
      ctx.fillText('W A S D: moverse   ratón: mirar   Shift: correr   C: agacharse', 24, H - 24);
      ctx.restore();
    }
  }
}
