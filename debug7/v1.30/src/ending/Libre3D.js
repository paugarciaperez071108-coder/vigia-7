// =============================================================
// Libre3D.js — (v1.28 M0, v1.29 M1) El final en 3D en tiempo real: andar libre por las salas de la nave.
// M1: la huida entera (Fase 2a) del pasillo central a la puerta del Laboratorio, con la luz de Blender horneada en
// Cycles (tools/3d/final/tr/hornear_sala.py → assets/final/tr/<zona>.glb + _luz.webp + _fuego.webp + .json).
//   W A S D   moverse (sin raíles ni paradas)         ratón     mirar (clic: captura el ratón)
//   Shift     correr, con aguante (la respiración avisa)  C / Ctrl  agacharse
// Las salidas: en cada sala solo una deja pasar (la del camino largo); las demás están bloqueadas de verdad
// (escombros, fuego: chocas) y empujarlas da una reacción corta, nunca un texto. La buena se intuye: la luz verde de
// su marco, las flechas del suelo, el aire que entra por ella (su sonido) y Slaimi, que brilla más al mirarla. Si
// tardas (NIGHT7.FINAL.LIBRE.PISTA_S), la pista se aclara. Al cruzar la puerta del Laboratorio empieza la persecución.
// Colisiones: la planta en polígonos convexos con su altura (lo bajo se pisa; bajo lo alto se pasa agachado).
// Se dibuja en un WebGL aparte (three.js, src/lib/three, MIT) y se copia al canvas del juego, como Pano360.
// =============================================================

import * as THREE from '../lib/three/three.module.min.js';
import { GLTFLoader } from '../lib/three/addons/GLTFLoader.js';
import { CONFIG } from '../config.js';
import { NIGHT7 } from '../night/night7.js';
import { slaimiDe } from '../core/SaveData.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const K = NIGHT7.FINAL.LIBRE;
const KM = NIGHT7.FINAL.F1.MIRA;
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
// las llamas: planos que giran solo en vertical hacia la cámara, con el atlas de 24 fotogramas (llama_flipbook.py)
const VS_LLAMA = `
attribute vec3 iPos;
attribute vec2 iTam;
attribute float iFase;
uniform float uT;
varying vec2 vUv;
varying float vF;
void main() {
  vec3 der = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
  vec3 p = iPos + der * position.x * iTam.x + vec3(0.0, position.y * iTam.y, 0.0);
  vUv = vec2(position.x + 0.5, position.y);
  if (iFase > 50.0) vUv.x = 1.0 - vUv.x;
  vF = mod(floor(uT * 14.0 + iFase), 24.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const FS_LLAMA = `
uniform sampler2D uAtlas;
uniform float uBrillo;
varying vec2 vUv;
varying float vF;
void main() {
  float col = mod(vF, 6.0);
  float fila = floor(vF / 6.0);
  vec2 uv = vec2((col + vUv.x) / 6.0, (fila + 1.0 - vUv.y) / 4.0);
  vec3 c = texture2D(uAtlas, uv).rgb * uBrillo;
  gl_FragColor = vec4(c, 1.0);
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

/** Un rectángulo [x0, y0, x1, y1] como polígono antihorario. */
const rect = ([x0, y0, x1, y1]) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const enCaja = (c, x, y) => x >= c[0] && x <= c[2] && y >= c[1] && y <= c[3];
const angulo = (a) => ((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

let BRAZOS = null;                 // (Slaimi en tus brazos: la capa de la Fase 1, como en la huida)
function brazos() {
  if (!BRAZOS) {
    BRAZOS = new Image();
    BRAZOS.src = 'assets/final/huida/brazos.webp';
  }
  return BRAZOS.complete && BRAZOS.naturalWidth ? BRAZOS : null;
}

export class Libre3D {
  constructor(game) {
    this.g = game;
    this.activa = false;
    this.listo = false;
    this.teclas = new Set();
    this.zonas = {};
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
    this.cam = new THREE.PerspectiveCamera(THREE.MathUtils.radToDeg(vfov), W / H, 0.05, 250);
    this.cam.rotation.order = 'YXZ';
    this.flick = { value: 1 };
    this.tLlama = { value: 0 };
    // el ratón: con el puntero capturado, movementX/Y; sin capturar, el borde de la pantalla (como en los cruces)
    this._mueve = (e) => {
      if (!this.activa || document.pointerLockElement !== this.g.canvas) return;
      this.yaw -= e.movementX * K.RATON;
      this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch - e.movementY * K.RATON));
    };
    document.addEventListener('mousemove', this._mueve);
    // la pista de la salida buena: un resplandor verde en su marco (sumando luz)
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const c2 = cv.getContext('2d');
    const gr = c2.createRadialGradient(64, 64, 2, 64, 64, 64);
    gr.addColorStop(0, 'rgba(120,255,160,1)');
    gr.addColorStop(0.35, 'rgba(60,255,120,0.45)');
    gr.addColorStop(1, 'rgba(0,255,80,0)');
    c2.fillStyle = gr;
    c2.fillRect(0, 0, 128, 128);
    this.texFaro = new THREE.CanvasTexture(cv);
    this.faro = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.texFaro, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false,
    }));
    this.faro.visible = false;
    this.escena.add(this.faro);
  }

  _tex(n) {
    return new Promise((ok) => new THREE.TextureLoader().load(`${DIR}${n}`, (t) => {
      t.flipY = false;
      t.colorSpace = THREE.NoColorSpace;
      t.anisotropy = 4;
      ok(t);
    }, undefined, () => ok(null)));
  }

  _cargaZona(z) {
    if (this.zonas[z]) return this.zonas[z].promesa;
    const Z = this.zonas[z] = {};
    Z.promesa = Promise.all([
      fetch(`${DIR}${z}.json`).then((r) => r.json()),
      new Promise((ok, mal) => new GLTFLoader().load(`${DIR}${z}.glb`, ok, undefined, mal)),
      this._tex(`${z}_luz.webp`), this._tex(`${z}_fuego.webp`),
    ]).then(([info, gltf, luz, fuego]) => {
      Z.info = info;
      const mat = new THREE.ShaderMaterial({
        vertexShader: VS, fragmentShader: FS,
        uniforms: { uLuz: { value: luz }, uFuego: { value: fuego }, uK: { value: info.K * (info.brillo ?? 1) }, uFlick: this.flick },
      });
      gltf.scene.traverse((o) => { if (o.isMesh) o.material = mat; });
      Z.malla = gltf.scene;
      this.escena.add(Z.malla);
      Z.solidos = info.solidos.map((s) => {
        const xs = s.p.map((p) => p[0]), ys = s.p.map((p) => p[1]);
        return { ...s, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
      });
      return Z;
    });
    return Z.promesa;
  }

  /** Las llamas de todas las zonas en un solo InstancedMesh (una por cada llama de volumen de Blender, sin repetir sitio). */
  _llamas(tex) {
    if (this.mLlamas) this.escena.remove(this.mLlamas);
    const pts = [];
    const ocupado = new Set();
    for (const Z of Object.values(this.zonas)) {
      for (const l of Z.info?.llamas ?? []) {
        const clave = `${Math.round(l.p[0] / 0.22)},${Math.round(l.p[1] / 0.22)},${Math.round(l.p[2] / 0.4)}`;
        if (ocupado.has(clave)) continue;
        ocupado.add(clave);
        pts.push(l);
      }
    }
    if (!pts.length || !tex) return;
    const base = new THREE.PlaneGeometry(1, 1);
    base.translate(0, 0.5, 0);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.attributes.position = base.attributes.position;
    const pos = new Float32Array(pts.length * 3), tam = new Float32Array(pts.length * 2), fase = new Float32Array(pts.length);
    pts.forEach((l, i) => {
      const s = Math.max(l.t[0], l.t[1]);
      const h = l.t[2] * K.LLAMA_ALTO;
      // (Blender (x, y, z) → three (x, z, -y); la base del plano, un poco por debajo de la llama)
      pos.set([l.p[0], l.p[2] - l.t[2] * 0.9, -l.p[1]], i * 3);
      tam.set([s * K.LLAMA_ANCHO, h], i * 2);
      fase[i] = Math.floor(Math.random() * 24) + (Math.random() < 0.5 ? 60 : 0);
    });
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 3));
    g.setAttribute('iTam', new THREE.InstancedBufferAttribute(tam, 2));
    g.setAttribute('iFase', new THREE.InstancedBufferAttribute(fase, 1));
    g.instanceCount = pts.length;
    const m = new THREE.ShaderMaterial({
      vertexShader: VS_LLAMA, fragmentShader: FS_LLAMA,
      uniforms: { uAtlas: { value: tex }, uT: this.tLlama, uBrillo: { value: K.LLAMA_BRILLO } },
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false,
    });
    this.mLlamas = new THREE.Mesh(g, m);
    this.mLlamas.frustumCulled = false;
    this.escena.add(this.mLlamas);
  }

  /** nombre: el recorrido (NIGHT7.FINAL.LIBRE.RECORRIDOS); desde: la zona por la que empezar (debug). */
  start(nombre = 'huida', desde = null) {
    this._init();
    const R = this.R = K.RECORRIDOS[nombre];
    this.nombre = nombre;
    this.activa = true;
    this.listo = false;
    this.acabada = false;
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
    this.quema = 0;
    this.reac = null;
    this.nReac = 0;
    this.empuje = 0;
    this.sala = null;
    this.tSala = 0;
    this.aireIn = 1;
    this.fundido = 1;
    this.fin = null;
    this.mirandoBuena = 0;
    this.slaimi = slaimiDe(this.g.save?.flags)?.estado === 'vivo';
    this.x = undefined;
    for (const Z of Object.values(this.zonas)) if (Z.malla) Z.malla.visible = R.zonas.includes(Z.info?.sala);
    Promise.all([...R.zonas.map((z) => this._cargaZona(z)), this.texLlama ?? this._tex('llama.webp')]).then((res) => {
      this.texLlama = res[res.length - 1];
      this.solidos = R.zonas.flatMap((z) => this.zonas[z].solidos);
      // las salidas bloqueadas: sólidas aunque lo que las tapa (el fuego) no lo sea
      for (const b of R.bloqueos ?? []) {
        if (!b.solido) continue;
        const p = rect(b.solido);
        this.solidos.push({ n: `bloqueo_${b.tipo}`, z: [0, 4], p, x0: b.solido[0], x1: b.solido[2], y0: b.solido[1], y1: b.solido[3] });
      }
      this._llamas(this.texLlama);
      const e = desde ? this.zonas[desde].info.entrada : R.inicio;
      this.x = e.p[0];
      this.y = e.p[1];
      this.yaw = Math.atan2(e.mira[1] - e.p[1], e.mira[0] - e.p[0]);
      this.pitch = 0;
      this.listo = true;
    }).catch((err) => { console.warn('Libre3D:', err); this.activa = false; });
  }

  stop() {
    this.activa = false;
    this.teclas.clear();
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
    let toca = false;
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
          toca = true;
        } else if (c.d < R) {
          const nx = (this.x - c.x) / (c.d || 1e-6), ny = (this.y - c.y) / (c.d || 1e-6);
          this.x = c.x + nx * R;
          this.y = c.y + ny * R;
          // (pierdes la velocidad contra la pared)
          const vn = this.vx * nx + this.vy * ny;
          if (vn < 0) { this.vx -= vn * nx; this.vy -= vn * ny; }
          toca = true;
        }
      }
    }
    return toca;
  }

  /** ¿Cabe de pie aquí? (para levantarse bajo una viga) */
  _cabeDePie() {
    const R = K.RADIO;
    return !this.solidos.some((s) => s.z[0] < K.OJOS + 0.15 && s.z[0] > K.AGACHADO_OJOS + 0.1 && s.z[1] > K.PISA
      && this.x > s.x0 - R && this.x < s.x1 + R && this.y > s.y0 - R && this.y < s.y1 + R
      && cercano(s.p, this.x, this.y).d < R);
  }

  // ------------------------------------------------------------------ salidas bloqueadas y pistas
  /** Empujar una salida bloqueada: una reacción corta, distinta cada vez (nunca un texto). */
  _reacciona(b) {
    let tipo;
    if (b.tipo === 'fuego') tipo = 'calor';
    else {
      const lista = ['empuja', 'tos', this.slaimi ? 'slaimi' : 'retrocede'];
      tipo = lista[this.nReac++ % lista.length];
    }
    this.reac = { tipo, t: 0, dur: { empuja: 1.5, tos: 2.0, slaimi: 1.4, retrocede: 1.2, calor: 1.4 }[tipo] };
    // (te echa un poco atrás, desde el centro del bloqueo)
    const [x0, y0, x1, y1] = b.zona;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const l = Math.hypot(this.x - cx, this.y - cy) || 1;
    const f = tipo === 'calor' ? 3.2 : tipo === 'retrocede' ? 2.2 : 1.0;
    this.vx = (this.x - cx) / l * f;
    this.vy = (this.y - cy) / l * f;
    if (tipo === 'empuja') {
      this.sacude = 0.8;
      this._son('metal/golpe_pared', { volume: 0.9 });
      this._son('final/escombros', { volume: 0.9, when: 0.18 });
    } else if (tipo === 'tos') {
      this.sacude = 0.5;
      this._son('final/tos', { volume: 0.9 });
    } else if (tipo === 'slaimi') {
      this._son('slaimi/gemido', { volume: 0.8, pitch: 1.15 });
      this._son('slaimi/gemido', { volume: 0.5, pitch: 1.25, when: 0.5 });
    } else if (tipo === 'calor') {
      this.sacude = 0.6;
      this.quema = 1;
      this._son('n7/fuego', { volume: 1.0 });
      this._son('n7/respira', { volume: 0.7, when: 0.1, pitch: 1.2 });
      this._son('final/tos', { volume: 0.7, when: 0.6 });
    } else {
      this._son('pasos/metal', { volume: 0.6 });
      this._son('pasos/metal', { volume: 0.5, when: 0.35 });
    }
  }

  _bloqueos(dt, quiereIr) {
    const R = this.R;
    let dentro = null;
    for (const b of R.bloqueos ?? []) if (enCaja(b.zona, this.x, this.y)) dentro = b;
    // empujar: estar en la zona del bloqueo queriendo andar sin avanzar (o, en el fuego, solo con acercarte)
    if (dentro && !this.reac && (dentro.tipo === 'fuego' || (quiereIr && this.vel < 0.6))) this.empuje += dt;
    else this.empuje = Math.max(0, this.empuje - dt * 2);
    if (dentro && !this.reac && this.empuje > (dentro.tipo === 'fuego' ? 0.15 : 0.45)) {
      this.empuje = 0;
      this._reacciona(dentro);
    }
    if (this.reac) {
      this.reac.t += dt;
      if (this.reac.tipo === 'tos') this.sacude = Math.max(this.sacude, 0.3 * (1 - this.reac.t / this.reac.dur));
      if (this.reac.t >= this.reac.dur) this.reac = null;
    }
  }

  /** La sala en la que estás, el tiempo que llevas en ella y lo clara que es la pista de su salida buena. */
  _pistas(dt) {
    const sala = (this.R.salas ?? []).find((s) => enCaja(s.caja, this.x, this.y)) ?? null;
    if (sala !== this.sala) {
      this.sala = sala;
      this.tSala = 0;
    }
    this.tSala += dt;
    if (!sala) {
      this.faro.visible = false;
      this.mirandoBuena += (0 - this.mirandoBuena) * Math.min(1, dt * 3);
      return;
    }
    const [bx, by, bz] = sala.buena;
    this.pista = Math.max(0, Math.min(1, (this.tSala - K.PISTA_S) / K.PISTA_SUBE_S));
    const rel = angulo(Math.atan2(by - this.y, bx - this.x) - this.yaw);
    const mira = Math.max(0, 1 - Math.abs(rel) / 0.45);
    this.mirandoBuena += (mira - this.mirandoBuena) * Math.min(1, dt * 3);
    // el resplandor verde del marco: late, más fuerte y más rápido cuanto más tardas
    const late = 0.5 + 0.5 * Math.sin(this.t * (2 + 5 * this.pista));
    const k = K.FARO * (0.35 + 0.65 * this.pista) * (0.6 + 0.4 * late);
    this.faro.visible = true;
    this.faro.position.set(bx, bz, -by);
    this.faro.scale.setScalar(1.6 + 1.4 * this.pista);
    this.faro.material.opacity = Math.min(1, k);
    // el aire que entra por la buena: por su lado, más fuerte mirándola o si tardas
    this.aireIn -= dt;
    if (this.aireIn <= 0) {
      this.aireIn = 4.2 - 1.8 * this.pista;
      this._son('final/aire', { volume: KM.AIRE_VOL * (0.25 + 0.5 * Math.max(this.mirandoBuena, this.pista)),
        pan: Math.max(-1, Math.min(1, -rel / 1.4)) });
    }
  }

  update(dt) {
    if (!this.activa || !this.listo || this.x === undefined) return;
    this.t += dt;
    this.tLlama.value = this.t;
    this.ayuda = Math.max(0, this.ayuda - dt);
    this.fundido = Math.max(0, this.fundido - dt / 0.8);
    this.quema = Math.max(0, this.quema - dt / 0.9);
    if (this.fin) {
      this.fin.t += dt;
      if (this.fin.t >= K.FIN_S) {
        this.acabada = true;
        this.stop();
        this.g._finLibre?.(this.nombre);
      }
      return;
    }
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
    const anda = l > 0 && !(this.reac && this.reac.t < 0.45);
    const corre = anda && quiereCorrer && !this.agotado && fx > 0;
    // el aguante: se gasta corriendo (de verdad: contra una pared no) y vuelve andando o parado
    if (corre && (this.vel ?? 0) > 1.2) this.aguante = Math.max(0, this.aguante - dt / K.AGUANTE_S);
    else this.aguante = Math.min(1, this.aguante + dt / (anda ? K.RECUPERA_S * 1.6 : K.RECUPERA_S));
    if (this.aguante <= 0) this.agotado = true;
    if (this.agotado && this.aguante >= K.VUELVE_A_CORRER) this.agotado = false;
    const vmax = agacha ? K.VEL_AGACHADO : corre ? K.VEL_CORRE : K.VEL;
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    // (adelante = (cos yaw, sin yaw); la derecha = (sin yaw, -cos yaw))
    const ox = anda ? (fx * cy + lx * sy) * vmax : 0, oy = anda ? (fx * sy - lx * cy) * vmax : 0;
    const a = Math.min(1, dt * (anda ? K.ACELERA : K.FRENA) * (this.reac ? 0.25 : 1));
    this.vx += (ox - this.vx) * a;
    this.vy += (oy - this.vy) * a;
    const px = this.x, py = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const debajo = !agacha && !this._cabeDePie();
    const altoAhora = agacha || debajo ? K.AGACHADO_OJOS + 0.2 : K.OJOS + 0.15;
    this._choca(altoAhora);
    const recorrido = Math.hypot(this.x - px, this.y - py);
    this.vel = recorrido / Math.max(dt, 1e-4);
    // la altura de los ojos (agacharse, suave) y el balanceo al andar
    const ojos = agacha || debajo ? K.AGACHADO_OJOS : K.OJOS;
    this.alto += (ojos - this.alto) * Math.min(1, dt * 8);
    this.balanceo += recorrido * Math.PI / (corre ? K.PASO_CORRE : K.PASO);
    // los pasos (cada zancada)
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
    this.corriendo = corre;
    this.sacude = Math.max(0, this.sacude - dt);
    this._bloqueos(dt, l > 0);
    this._pistas(dt);
    // el final del recorrido (la puerta del Laboratorio)
    if (this.R.fin && enCaja(this.R.fin.caja, this.x, this.y)) {
      this.fin = { t: 0 };
      this._son('pasos/metal', { volume: 0.6 });
    }
  }

  // ------------------------------------------------------------------ dibujar
  draw(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (!this.listo || this.x === undefined) return;
    const amp = Math.min(1, (this.vel ?? 0) / K.VEL) * (this.corriendo ? 1.6 : 1);
    const bob = Math.sin(this.balanceo) * K.BALANCEO * amp;
    const lado = Math.sin(this.balanceo * 0.5) * K.BALANCEO * 0.6 * amp;
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const sx = this.sacude > 0 ? (Math.random() - 0.5) * 0.06 * this.sacude : 0;
    const sz = this.sacude > 0 ? (Math.random() - 0.5) * 0.04 * this.sacude : 0;
    // (Blender (x, y, z) → three (x, z, -y))
    this.cam.position.set(this.x + sy * lado, this.alto + Math.abs(bob) + sz, -(this.y - cy * lado));
    this.cam.rotation.y = this.yaw - Math.PI / 2 + sx;
    this.cam.rotation.x = this.pitch + bob * 0.15 + sz;
    this.cam.rotation.z = lado * 0.25;
    // el fuego parpadea (la luz horneada del fuego, multiplicada)
    const t = this.t;
    this.flick.value = 0.78 + 0.12 * Math.sin(t * 9.1) + 0.07 * Math.sin(t * 23.7 + 1.3) + 0.05 * Math.sin(t * 4.3 + 2.1);
    this.r.render(this.escena, this.cam);
    ctx.drawImage(this.r.domElement, 0, 0, W, H);
    this._drawSlaimi(ctx, amp);
    if (this.quema > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,110,30,${(0.35 * this.quema).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    const negro = this.fin ? Math.min(1, this.fin.t / K.FIN_S) : this.fundido;
    if (negro > 0) {
      ctx.fillStyle = `rgba(0,0,0,${negro.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.ayuda > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.ayuda) * 0.7;
      ctx.fillStyle = '#cfd8d0';
      ctx.font = '14px monospace';
      ctx.fillText('W A S D: moverse   ratón: mirar (clic)   Shift: correr   C: agacharse', 24, H - 24);
      ctx.restore();
    }
  }

  /** Slaimi en tus brazos, abajo (si vive): se mece con el paso, tiembla al asustarse y brilla más mirando la
   *  salida buena; si tardas, se inclina hacia ella. */
  _drawSlaimi(ctx, andando) {
    const br = this.slaimi ? brazos() : null;
    if (!br) return;
    const r = this.reac;
    const tiembla = r?.tipo === 'slaimi' ? (1 - r.t / r.dur) : (this.sacude > 0.5 ? 0.4 : 0);
    let hacia = 0;
    if (this.sala && this.pista > 0.3) {
      const rel = angulo(Math.atan2(this.sala.buena[1] - this.y, this.sala.buena[0] - this.x) - this.yaw);
      hacia = -Math.max(-1, Math.min(1, rel / 1.2)) * 40 * this.pista;
    }
    const bx = (Math.random() - 0.5) * 10 * tiembla + Math.sin(this.t * 1.7) * 4 + Math.sin(this.balanceo) * 6 * andando + hacia;
    const by = H * KM.BRAZOS_BAJA + Math.abs(Math.cos(this.balanceo)) * 10 * andando + Math.sin(this.t * 2.3) * 3
      + Math.max(0, -this.pitch) * 120;
    ctx.drawImage(br, bx, by, W, H);
    const brillo = 0.15 + KM.BRILLO_SLAIMI * Math.max(this.mirandoBuena, 0.15) * (0.85 + 0.15 * Math.sin(this.t * 5));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createRadialGradient(W / 2 + bx, H * 0.7 + by, 10, W / 2 + bx, H * 0.7 + by, H * 0.42);
    gr.addColorStop(0, `rgba(190,225,255,${(0.32 * brillo).toFixed(3)})`);
    gr.addColorStop(1, 'rgba(190,225,255,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}
