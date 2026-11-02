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
// (v1.32, M3a) La persecución (recorrido «persecucion»): la Aberración te sigue por el camino (su «carril»): si
// corres, le sacas distancia; si te paras, chocas, te quemas o vas por donde no es, se acerca; si te alcanza, su susto
// y vuelves al principio de la persecución. Los momentos grandes (la pared que revienta, el derrumbe) son sus planos de
// Blender; al final del conducto, la oscuridad y sales por la rejilla de la Enfermería; la puerta atascada se abre
// empujándola con W.
// (v1.35, Fase 3) Dentro de la nave de escape: la cabina, el botón y el despegue (src/ending/Cabina3D.js).
// Colisiones: la planta en polígonos convexos con su altura (lo bajo se pisa; bajo lo alto se pasa agachado).
// Se dibuja en un WebGL aparte (three.js, src/lib/three, MIT) y se copia al canvas del juego, como Pano360.
// =============================================================

import * as THREE from '../lib/three/three.module.min.js';
import { GLTFLoader } from '../lib/three/addons/GLTFLoader.js';
import { CONFIG } from '../config.js';
import { NIGHT7 } from '../night/night7.js';
import { slaimiDe, SaveData } from '../core/SaveData.js';
import { datosFinal, n3 } from './Huida.js';
import { drawJumpscare } from '../ui/Jumpscare.js';
import { Cabina3D } from './Cabina3D.js';
import { Final4 } from './Final4.js';

const PLANOS = datosFinal('assets/final/persecucion/');     // (los planos de la persecución: la pared, el derrumbe)

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

// el humo: planos que miran a la cámara (enteros), con una bocanada borrosa y su transparencia
const VS_HUMO = `
attribute vec3 iPos;
attribute float iTam;
attribute float iAlfa;
attribute float iVar;
varying vec2 vUv;
varying float vA;
varying float vV;
void main() {
  vec3 der = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 arr = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 p = iPos + (der * position.x + arr * position.y) * iTam;
  vUv = position.xy + 0.5;
  vA = iAlfa;
  vV = iVar;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const FS_HUMO = `
uniform sampler2D uTex;
uniform vec3 uColor;
varying vec2 vUv;
varying float vA;
varying float vV;
void main() {
  vec2 uv = vec2((floor(vV * 4.0) + vUv.x) / 4.0, vUv.y);
  float a = texture2D(uTex, uv).a * vA;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor * (0.8 + 0.4 * vV), a);
}`;

/** Cuatro bocanadas de humo borrosas (en un atlas de 4 en fila), hechas con ruido en un canvas. */
function texHumo() {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 128;
  const c = cv.getContext('2d');
  for (let k = 0; k < 4; k++) {
    for (let i = 0; i < 26; i++) {
      const x = k * 128 + 64 + (Math.random() - 0.5) * 50, y = 64 + (Math.random() - 0.5) * 50;
      const r = 14 + Math.random() * 30;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.22)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(k * 128, 0, 128, 128);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

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

/** El punto a s metros de la polilínea pts, y hacia dónde va ([x, y, ángulo]). */
function puntoCarril(pts, s) {
  let acum = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const l = Math.hypot(bx - ax, by - ay);
    if (s <= acum + l || i === pts.length - 2) {
      const t = Math.max(0, Math.min(1, (s - acum) / (l || 1)));
      return [ax + (bx - ax) * t, ay + (by - ay) * t, Math.atan2(by - ay, bx - ax)];
    }
    acum += l;
  }
  return [...pts[0], 0];
}

/** El punto de la polilínea pts más cercano a (x, y): la distancia recorrida hasta él. */
function sobreCarril(pts, x, y) {
  let mejor = Infinity, s = 0, acum = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const ex = bx - ax, ey = by - ay, l = Math.hypot(ex, ey) || 1e-6;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / (l * l)));
    const d = Math.hypot(ax + ex * t - x, ay + ey * t - y);
    if (d < mejor) { mejor = d; s = acum + t * l; }
    acum += l;
  }
  return s;
}

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
    // (v1.41) si la tarjeta se queda sin memoria y se pierde la imagen 3D, pedir que la devuelva (three lo vuelve a subir)
    r.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); console.warn('Libre3D: imagen 3D perdida; recuperando'); });
    r.domElement.addEventListener('webglcontextrestored', () => console.warn('Libre3D: imagen 3D recuperada'));
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
    this.alarma = { value: 1 };     // (v1.35: las alarmas rojas de la cabina de la nave)
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

  /** (v1.33, M3b) La Aberración en 3D (tools/3d/final/tr/aberracion_glb.py): sus piezas, su color y su luz. */
  _cargaAb() {
    if (this.abP) return this.abP;
    this.abP = Promise.all([
      new Promise((ok, mal) => new GLTFLoader().load(`${DIR}aberracion.glb`, ok, undefined, mal)),
      new Promise((ok) => new THREE.TextureLoader().load(`${DIR}aberracion_color.webp`, (t) => {
        t.flipY = false;
        t.colorSpace = THREE.SRGBColorSpace;
        ok(t);
      }, undefined, () => ok(null))),
      fetch(`${DIR}aberracion.json`).then((r) => r.json()),
    ]).then(([gltf, tex, info]) => {
      const mat = new THREE.MeshLambertMaterial({ map: tex, color: 0xffffff });
      const A = this.ab = { grupo: new THREE.Group(), brazos: [], mand: [], info };
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.material = mat;
        o.frustumCulled = false;
        const pz = info.piezas[o.name];
        if (pz) {
          o.userData.rot0 = o.rotation.clone();
          o.userData.fase = Math.random() * 6.28;
          o.userData.vel = 1.6 + Math.random() * 1.6;
          (pz.tipo === 'mandibula' ? A.mand : A.brazos).push(o);
        }
      });
      A.grupo.add(gltf.scene);
      A.grupo.visible = false;
      // su luz: el fuego que lleva encima (naranja, parpadea) y el rojo de emergencia; y una luz tenue de ambiente
      A.luzFuego = new THREE.PointLight(0xff7a2a, 30, 14, 1.6);
      A.luzFuego.position.set(0, 4.5, 1.0);
      A.grupo.add(A.luzFuego);
      A.luzRoja = new THREE.PointLight(0xff2010, 10, 10, 1.8);
      A.luzRoja.position.set(0, 2.0, 4.0);
      A.grupo.add(A.luzRoja);
      this.escena.add(new THREE.HemisphereLight(0x3a3028, 0x080404, 0.5));
      this.escena.add(A.grupo);
      // sus brazos en los bordes de la pantalla (copias de dos brazos, pegadas a la cámara)
      // (v1.36: si ya va dentro de la nave, se queda ahí)
      if (!this.cam.parent) this.escena.add(this.cam);
      A.bordes = [];
      const largos = A.brazos.filter((b) => info.piezas[b.name].largo > 1.2).slice(0, 4);
      for (const [k, b] of largos.entries()) {
        const c = b.clone();
        c.material = mat;
        const lado = k % 2 ? 1 : -1;
        const g = new THREE.Group();
        g.add(c);
        c.position.set(0, 0, 0);
        c.rotation.set(0, 0, 0);
        g.userData = { lado, alto: k < 2 ? -0.25 : 0.32, fase: Math.random() * 6 };
        g.visible = false;
        this.cam.add(g);
        A.bordes.push(g);
      }
      return A;
    }).catch((e) => { console.warn('Libre3D: sin la Aberración en 3D', e); return null; });
    return this.abP;
  }

  /** Dónde está la Aberración (su carril) y cómo se mueve: el cuerpo se mece, cada brazo a su ritmo, la boca. */
  _updateAb(dt) {
    const A = this.ab;
    if (!A) return;
    const C = this.caza, RC = this.R.caza;
    let ver = !!(C?.empezada && !this.cine && !this.atrapado && !this.salto && this.activa);
    const tramo = RC?.carril[C?.tramo ?? 0];
    const s0 = RC?.desfase?.[C?.tramo ?? 0] ?? 0;
    // (aún «dando la vuelta por fuera» tras el conducto, o dentro del conducto: no se la ve)
    if (ver && (C.ab - s0 < 2 || (RC.sin ?? []).some((c) => enCaja(c, this.x, this.y)))) ver = false;
    A.grupo.visible = ver;
    for (const b of A.bordes) b.visible = false;
    if (!ver) return;
    const t = this.t;
    const fr = Math.abs(A.info.frente ?? 3.2);
    const [x, y] = puntoCarril(tramo, C.ab - s0 - fr * 0.6);
    // mira hacia ti
    const th = Math.atan2(this.y - y, this.x - x);
    A.grupo.position.set(x, Math.sin(t * 2.6) * 0.07, -y);
    A.grupo.rotation.set(Math.sin(t * 1.3) * 0.03, Math.atan2(Math.cos(th), -Math.sin(th)), Math.sin(t * 1.7) * 0.04);
    this._animaAb(A, this.cerca ?? 0);
  }

  /** Cómo se mueve (d: lo cerca que está, 0..1): cada brazo a su ritmo, la boca, su fuego y sus brazos en los bordes. */
  _animaAb(A, d) {
    const t = this.t;
    for (const b of A.brazos) {
      const u = b.userData;
      const k = Math.sin(t * u.vel * (1 + d) + u.fase);
      b.rotation.set(u.rot0.x + 0.18 * k, u.rot0.y + 0.1 * Math.cos(t * u.vel + u.fase), u.rot0.z + 0.14 * k);
    }
    for (const m of A.mand) {
      const u = m.userData;
      const abre = 0.25 + 0.75 * d * (0.6 + 0.4 * Math.sin(t * 5 + u.fase));
      m.rotation.set(u.rot0.x, u.rot0.y + Math.sign(u.rot0.y || 1) * 0.5 * abre, u.rot0.z);
    }
    A.luzFuego.intensity = 26 + 10 * Math.sin(t * 9.1) + 6 * Math.sin(t * 23.7);
    // muy cerca: sus brazos entran por los bordes de la pantalla, estirándose hacia ti
    if (d > K.AB_BORDES) {
      const k = (d - K.AB_BORDES) / (1 - K.AB_BORDES);
      for (const g of A.bordes) {
        const u = g.userData;
        g.visible = true;
        const entra = 0.35 * k + 0.05 * Math.sin(t * 3 + u.fase);
        g.position.set(u.lado * (1.05 - entra), u.alto + 0.04 * Math.sin(t * 2.2 + u.fase), -0.9);
        g.rotation.set(0.2, u.lado * (1.25 - 0.3 * k), u.lado * 0.4);
        g.scale.setScalar(0.32);
      }
    }
  }

  _tex(n) {
    // (v1.41) como mucho K.TEX_MAX de lado: si no, entre todas las salas no caben en la tarjeta (y la imagen se va a negro)
    const tope = K.TEX_MAX ?? 0;
    const lista = (t) => {
      t.flipY = false;
      t.colorSpace = THREE.NoColorSpace;
      t.anisotropy = 4;
      t.needsUpdate = true;
      return t;
    };
    return new Promise((ok) => {
      const im = new Image();
      im.onload = () => {
        if (!tope || (im.naturalWidth <= tope && im.naturalHeight <= tope)) { ok(lista(new THREE.Texture(im))); return; }
        const k = tope / Math.max(im.naturalWidth, im.naturalHeight);
        const cv = document.createElement('canvas');
        cv.width = Math.round(im.naturalWidth * k);
        cv.height = Math.round(im.naturalHeight * k);
        const c = cv.getContext('2d');
        c.imageSmoothingQuality = 'high';
        c.drawImage(im, 0, 0, cv.width, cv.height);
        ok(lista(new THREE.CanvasTexture(cv)));
      };
      im.onerror = () => ok(null);
      im.src = `${DIR}${n}`;
    });
  }

  /** (v1.41) Suelta una zona de la memoria (de la tarjeta, sobre todo: sus texturas). */
  _liberaZona(z) {
    const Z = this.zonas[z];
    if (!Z?.malla) return;
    this.escena.remove(Z.malla);
    Z.malla.traverse((o) => { if (o.isMesh) o.geometry?.dispose(); });
    Z.mat?.uniforms?.uLuz?.value?.dispose?.();
    Z.mat?.uniforms?.uFuego?.value?.dispose?.();
    Z.mat?.dispose?.();
    delete this.zonas[z];
  }

  _cargaZona(z) {
    if (this.zonas[z]) return this.zonas[z].promesa;
    const Z = this.zonas[z] = {};
    if ((K.CABINA?.CRISTAL ?? []).includes(z)) {
      // (v1.35) el parabrisas: cristal de verdad (se ve a través), sin luz horneada
      Z.promesa = Promise.all([
        fetch(`${DIR}${z}.json`).then((r) => r.json()),
        new Promise((ok, mal) => new GLTFLoader().load(`${DIR}${z}.glb`, ok, undefined, mal)),
      ]).then(([info, gltf]) => {
        Z.info = info;
        const mat = new THREE.MeshBasicMaterial({ color: 0x1a3a30, transparent: true, opacity: K.CABINA.CRISTAL_OPACO,
          depthWrite: false, side: THREE.DoubleSide });
        gltf.scene.traverse((o) => { if (o.isMesh) o.material = mat; });
        Z.malla = gltf.scene;
        this.escena.add(Z.malla);
        Z.solidos = [];
        Z.dx = 0;
        return Z;
      });
      return Z.promesa;
    }
    Z.promesa = Promise.all([
      fetch(`${DIR}${z}.json`).then((r) => r.json()),
      new Promise((ok, mal) => new GLTFLoader().load(`${DIR}${z}.glb`, ok, undefined, mal)),
      this._tex(`${z}_luz.webp`), this._tex(`${z}_fuego.webp`),
    ]).then(([info, gltf, luz, fuego]) => {
      Z.info = info;
      const mat = new THREE.ShaderMaterial({
        vertexShader: VS, fragmentShader: FS,
        uniforms: { uLuz: { value: luz }, uFuego: { value: fuego }, uK: { value: info.K * (info.brillo ?? 1) },
          uFlick: (K.CABINA?.ALARMA ?? []).includes(z) ? this.alarma : this.flick },
      });
      Z.mat = mat;
      Z.uK0 = info.K * (info.brillo ?? 1);
      gltf.scene.traverse((o) => { if (o.isMesh) o.material = mat; });
      Z.malla = gltf.scene;
      Z.malla.visible = !!this.activas?.includes(z) && this.listo;
      this.escena.add(Z.malla);
      Z.solidos = info.solidos.map((s) => {
        const xs = s.p.map((p) => p[0]), ys = s.p.map((p) => p[1]);
        return { ...s, p0: s.p, zona: z, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
      });
      Z.dx = 0;
      return Z;
    });
    return Z.promesa;
  }

  /** Las llamas de todas las zonas en un solo InstancedMesh (una por cada llama de volumen de Blender, sin repetir sitio). */
  _llamas(tex) {
    if (this.mLlamas) this.escena.remove(this.mLlamas);
    const pts = [];
    const ocupado = new Set();
    for (const z of this.activas ?? []) {
      const Z = this.zonas[z];
      for (const l of Z?.info?.llamas ?? []) {
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

  /** El humo: sale de cada fuego, sube, se queda bajo el techo y, cerca de la salida buena, el aire lo lleva hacia
   *  ella (otra pista, sin texto). Partículas en la CPU, dibujadas en un InstancedMesh. */
  _humo() {
    if (this.mHumo) this.escena.remove(this.mHumo);
    const N = K.HUMO_N;
    this.humo = { n: N, p: new Float32Array(N * 3), v: new Float32Array(N * 3), edad: new Float32Array(N).fill(99),
      vida: new Float32Array(N).fill(1), techo: new Float32Array(N), sig: 0, acum: 0 };
    // las fuentes: los fuegos de las zonas del recorrido (su luz), más humo cuanto más fuerte
    this._fuentes();
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.attributes.position = base.attributes.position;
    this._humoMalla(N, g);
  }

  /** (v1.41) Las fuentes del humo: los fuegos de las zonas que se ven. */
  _fuentes() {
    this.fuentes = [];
    for (const z of this.activas ?? this.R.zonas) {
      const info = this.zonas[z]?.info;
      if (!info) continue;
      if ((K.CABINA?.ALARMA ?? []).includes(z)) continue;      // (sus «fuegos» son las alarmas rojas)
      for (const f of info.fuegos ?? []) {
        this.fuentes.push({ x: f.p[0], y: f.p[1], z: f.p[2], peso: Math.sqrt(Math.max(1, f.e)), techo: info.techo ?? K.HUMO_TECHO });
      }
    }
    if (this.mHumo && this.fuentes.length && !this.mHumo.parent) this.escena.add(this.mHumo);
  }

  /** (v1.41) Una bocanada de humo de golpe en un sitio (una explosión): sale hacia fuera y sube. */
  _bocanada(x, y, z, n) {
    const H_ = this.humo;
    if (!H_) return;
    for (let k = 0; k < n; k++) {
      const i = H_.sig;
      H_.sig = (H_.sig + 1) % H_.n;
      const a = Math.random() * Math.PI * 2, v = 0.6 + Math.random() * 2.2;
      H_.p[i * 3] = x + (Math.random() - 0.5) * 1.2;
      H_.p[i * 3 + 1] = y + (Math.random() - 0.5) * 1.2;
      H_.p[i * 3 + 2] = z + (Math.random() - 0.5) * 1.0;
      H_.v[i * 3] = Math.cos(a) * v;
      H_.v[i * 3 + 1] = Math.sin(a) * v;
      H_.v[i * 3 + 2] = 0.3 + Math.random() * 1.2;
      H_.edad[i] = 0;
      H_.vida[i] = K.HUMO_VIDA * (0.8 + 0.8 * Math.random());
      H_.techo[i] = (K.HUMO_TECHO ?? 3.5) - 0.2 - Math.random() * 0.5;
    }
    if (this.mHumo && !this.mHumo.parent) this.escena.add(this.mHumo);
  }

  _humoMalla(N, g) {
    this.aHumo = {
      pos: new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3),
      tam: new THREE.InstancedBufferAttribute(new Float32Array(N), 1),
      alfa: new THREE.InstancedBufferAttribute(new Float32Array(N), 1),
      vari: new THREE.InstancedBufferAttribute(new Float32Array(N).map(() => Math.random() * 0.999), 1),
    };
    for (const a of Object.values(this.aHumo)) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.aHumo.pos);
    g.setAttribute('iTam', this.aHumo.tam);
    g.setAttribute('iAlfa', this.aHumo.alfa);
    g.setAttribute('iVar', this.aHumo.vari);
    g.instanceCount = N;
    this.texH ??= texHumo();
    const m = new THREE.ShaderMaterial({
      vertexShader: VS_HUMO, fragmentShader: FS_HUMO,
      uniforms: { uTex: { value: this.texH }, uColor: { value: new THREE.Color(...K.HUMO_COLOR) } },
      transparent: true, depthWrite: false, toneMapped: false,
    });
    this.mHumo = new THREE.Mesh(g, m);
    this.mHumo.frustumCulled = false;
    this.mHumo.renderOrder = 2;
    this.escena.add(this.mHumo);
  }

  _updateHumo(dt) {
    const H_ = this.humo;
    if (!H_) return;
    const P = H_.p, V = H_.v;
    // nacen en los fuegos cercanos (lo lejano no se ve; así hay más humo donde estás), según su fuerza
    const cerca = this.fuentes.filter((f) => Math.hypot(f.x - this.x, f.y - this.y) < K.HUMO_LEJOS);
    const total = cerca.reduce((a, f) => a + f.peso, 0);
    H_.acum += dt * K.HUMO_RITMO;
    while (H_.acum >= 1 && total > 0) {
      H_.acum -= 1;
      let u = Math.random() * total;
      let f = cerca[cerca.length - 1];
      for (const q of cerca) { u -= q.peso; if (u <= 0) { f = q; break; } }
      const i = H_.sig;
      H_.sig = (H_.sig + 1) % H_.n;
      P[i * 3] = f.x + (Math.random() - 0.5) * 0.6;
      P[i * 3 + 1] = f.y + (Math.random() - 0.5) * 0.6;
      P[i * 3 + 2] = Math.max(0.6, f.z + 0.3);
      V[i * 3] = (Math.random() - 0.5) * 0.15;
      V[i * 3 + 1] = (Math.random() - 0.5) * 0.15;
      V[i * 3 + 2] = 0.5 + Math.random() * 0.5;
      H_.edad[i] = 0;
      H_.vida[i] = K.HUMO_VIDA * (0.7 + 0.6 * Math.random());
      H_.techo[i] = Math.max(f.z + 0.5, f.techo - 0.3 - Math.random() * 0.6);
    }
    if (H_.acum > 1) H_.acum = 0;
    // el aire que entra por la salida buena de la sala: arrastra el humo cercano hacia ella
    const b = this.sala ? (this.buenaDe[this.sala.n] ?? this.sala.buena) : null;
    for (let i = 0; i < H_.n; i++) {
      if (H_.edad[i] >= H_.vida[i]) {
        this.aHumo.alfa.array[i] = 0;
        continue;
      }
      H_.edad[i] += dt;
      const j = i * 3;
      if (P[j + 2] >= H_.techo[i]) {          // (bajo el techo: se extiende y deja de subir)
        V[j + 2] *= 0.9;
        P[j + 2] = H_.techo[i];
      }
      if (b) {
        const dx = b[0] - P[j], dy = b[1] - P[j + 1];
        const d = Math.hypot(dx, dy);
        if (d < K.HUMO_AIRE_R) {
          const k = K.HUMO_AIRE * (1 - d / K.HUMO_AIRE_R) * (1 + (this.pista ?? 0)) * dt / (d || 1);
          V[j] += dx * k;
          V[j + 1] += dy * k;
        }
      }
      V[j] *= 1 - 0.3 * dt;
      V[j + 1] *= 1 - 0.3 * dt;
      P[j] += V[j] * dt;
      P[j + 1] += V[j + 1] * dt;
      P[j + 2] += V[j + 2] * dt;
      const e = H_.edad[i] / H_.vida[i];
      // (Blender (x, y, z) → three (x, z, -y))
      this.aHumo.pos.array[j] = P[j];
      this.aHumo.pos.array[j + 1] = P[j + 2];
      this.aHumo.pos.array[j + 2] = -P[j + 1];
      this.aHumo.tam.array[i] = 0.5 + 2.6 * e;
      this.aHumo.alfa.array[i] = K.HUMO_ALFA * Math.min(1, e * 6) * (1 - e);
    }
    for (const a of Object.values(this.aHumo)) a.needsUpdate = true;
  }

  /** nombre: el recorrido (NIGHT7.FINAL.LIBRE.RECORRIDOS); desde: la zona por la que empezar (debug). */
  start(nombre = 'huida', desde = null) {
    this._init();
    // (v1.41) 'sigue': desde donde estabas (la huida acaba en la puerta del Laboratorio y sigue la persecución)
    const sigue = desde === 'sigue' && this.x !== undefined ? { x: this.x, y: this.y, yaw: this.yaw, pitch: this.pitch,
      aguante: this.aguante, agotado: this.agotado, vx: this.vx, vy: this.vy } : null;
    if (desde === 'sigue') desde = null;
    this.sigue = null;
    if (!this.cabina) this.cabina = new Cabina3D(this);
    if (!this.final4 && K.FINAL4?.USAR) this.final4 = new Final4(this);
    this.cabina.reset();
    this.finalVisto = null;
    // (debug: 'cabina' = dentro de la nave; 'final1'…'final4' = directo a ese final)
    const aFinal = /^final[1-4]$/.test(desde ?? '') ? Number(desde.slice(5)) : null;
    this.finalForzado = aFinal;
    const enCabina = desde === 'cabina' || !!aFinal;
    if (enCabina) desde = null;
    const R = this.R = K.RECORRIDOS[nombre];
    this.nombre = nombre;
    this.activa = true;
    this.listo = false;
    this.acabada = false;
    if (!sigue) this.teclas.clear();     // (v1.41: si sigues desde la huida, con la W pulsada sigues andando)
    this.t = 0;
    this.ayuda = K.AYUDA_S;
    this.vx = this.vy = 0;
    this.aguante = 1;
    this.agotado = false;
    this.agachado = false;
    this.alto = K.OJOS;
    this.ojosZ = K.OJOS;
    this.cayendo = null;
    this.salto = null;
    this.textoAyuda = null;
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
    this.base = 0;                 // (la altura del suelo bajo tus pies: el conducto de la rejilla está a 1,47 m)
    this.hechos = new Set();       // (los eventos que ya han pasado: el derrumbe, el final del conducto…)
    this.activas = [...R.zonas];   // (las zonas que se ven y chocan; un evento puede cambiar unas por otras)
    this.buenaDe = {};             // (la salida buena de una sala, si un evento la cambia)
    this.cine = null;
    this.puerta = R.puerta ? { abre: 0, libre: false } : null;
    this.atrapado = null;
    this.respiro = false;
    this.flashSlaimi = 0;
    // la persecución: dónde va la Aberración en su carril (m) y en qué tramo del carril estás
    this.caza = R.caza ? { tramo: 0, ab: -R.caza.ventaja, golpeIn: 1, abRespIn: 1.5, abPasoIn: 0.8 } : null;
    const reinicio = desde === 'reinicio';
    if (reinicio) desde = null;
    if (R.plano_inicio && !desde && !reinicio) this.cine = { plano: R.plano_inicio, t: 0, eventos: new Set() };
    this.mira = null;
    this.destello = 0;
    this.lente = 1;
    this.continua = sigue;
    // (v1.40) los planos del recorrido, pedidos ya: cuando toca uno, sale al instante (sin pararse a cargar)
    for (const pl of new Set([R.plano_inicio, ...(R.eventos ?? []).map((e) => e.plano)])) if (pl) this._precarga(pl);
    const todas = [...new Set([...R.zonas, ...(R.eventos ?? []).flatMap((e) => (e.pon ? [e.pon] : []))])];
    // (v1.41) lo del recorrido anterior que ya no hace falta, fuera de la memoria
    for (const z of Object.keys(this.zonas)) if (!todas.includes(z)) this._liberaZona(z);
    if (!sigue) for (const Z of Object.values(this.zonas)) if (Z.malla) Z.malla.visible = false;
    if (R.caza) this._cargaAb();
    if (R.caza && this.final4) this.final4.carga();
    Promise.all([...todas.map((z) => this._cargaZona(z)), this.texLlama ?? this._tex('llama.webp')]).then((res) => {
      this.texLlama = res[res.length - 1];
      for (const [z, Z] of Object.entries(this.zonas)) if (Z.malla) Z.malla.visible = this.activas.includes(z);
      if (R.fin?.nave) this.zonas[R.fin.nave.zona].malla.visible = false;
      this._solidos();
      // las salidas bloqueadas: sólidas aunque lo que las tapa (el fuego) no lo sea
      this._llamas(this.texLlama);
      this._humo();
      // (desde una zona que solo sale tras un evento, ese evento ya ha pasado: el derrumbe)
      for (const ev of R.eventos ?? []) {
        if (desde && ev.pon === desde) this._aplicaEvento(ev, true);
      }
      // (desde una zona de después del conducto: el derrumbe y el conducto ya han pasado; el segundo tramo del carril)
      if (desde && (R.caza?.tras_conducto ?? []).includes(desde)) {
        for (const ev of R.eventos ?? []) if (ev.n === 'derrumbe' || ev.n === 'conducto') this._aplicaEvento(ev, true);
      }
      // (v1.35, debug: desde la cabina) todo lo de antes ya ha pasado
      if (enCabina) {
        for (const ev of R.eventos ?? []) this._aplicaEvento(ev, true);
        this.cine = null;
      }
      // (v1.41) al reintentar, desde su sitio (la pared ya reventada)
      if ((reinicio || desde) && R.caza_tras) for (const ev of R.eventos ?? []) if (ev.n === R.caza_tras) this._aplicaEvento(ev, true);
      const e = desde ? this.zonas[desde].info.entrada : reinicio && R.reinicio ? R.reinicio : R.inicio;
      this.x = e.p[0];
      this.y = e.p[1];
      this.yaw = Math.atan2(e.mira[1] - e.p[1], e.mira[0] - e.p[0]);
      this.pitch = 0;
      if (sigue) {
        Object.assign(this, sigue);
        this.fundido = 0;
      }
      if (this.caza) {
        if (desde) this.caza.ab = this._sCarril() - R.caza.ventaja;
        // (la caza empieza cuando sale la Aberración; si se empieza más allá o se reintenta, ya)
        const espera = R.caza_tras && !this.hechos.has(R.caza_tras);
        if (!this.cine && !espera) this._empiezaCaza();
      }
      if (enCabina) this.cabina.empieza(true);
      if (aFinal) this.cabina.alEspacio();
      this.listo = true;
      this.continua = null;
      // (v1.41) mientras dura la huida, se van cargando (sin verse) las zonas de la persecución, para seguir sin cortes
      if (R.fin?.sigue) setTimeout(() => this._precargaRecorrido('persecucion'), 4000);
    }).catch((err) => { console.warn('Libre3D:', err); this.activa = false; });
  }

  /** (v1.41) Carga sin enseñar las zonas de otro recorrido (de una en una, para no atascar). */
  async _precargaRecorrido(nombre) {
    const R2 = K.RECORRIDOS[nombre];
    if (!R2) return;
    const zs = [...new Set([...R2.zonas, ...(R2.eventos ?? []).flatMap((e) => (e.pon ? [e.pon] : []))])];
    for (const z of zs) {
      if (!this.activa || this.R.fin?.sigue !== true) return;
      try { await this._cargaZona(z); } catch (e) { /* (luego, al empezar) */ }
      const Z = this.zonas[z];
      if (Z?.malla && !this.activas.includes(z)) Z.malla.visible = false;
    }
  }

  /** Los sólidos de las zonas activas (más los bloqueos que no se ven sólidos, como el fuego). */
  _solidos() {
    const nave = this.R.fin?.nave?.zona;
    // (la compuerta, abierta hasta que entras; la cabina solo choca dentro: Cabina3D)
    this.solidos = this.activas.filter((z) => z !== nave && z !== K.CABINA?.ZONA).flatMap((z) => this.zonas[z].solidos);
    for (const b of this.R.bloqueos ?? []) {
      if (!b.solido || (b.tras && !this.hechos.has(b.tras))) continue;
      const p = rect(b.solido);
      this.solidos.push({ n: `bloqueo_${b.tipo}`, z: [0, 4], p, x0: b.solido[0], x1: b.solido[2], y0: b.solido[1], y1: b.solido[3] });
    }
  }

  /** La persecución empieza de verdad (tras la pared que revienta): el punto de control. */
  _empiezaCaza() {
    if (!this.caza || this.caza.empezada) return;
    this.caza.empezada = true;
    this.caza.ab = this._sCarril() - this.R.caza.ventaja;
    const g = this.g;
    if (g.saveEnabled !== false && !g.debugNight && !g.debugFinal && g.save) {
      g.save = { ...g.save, night: 7, checkpoint: 'n7persecucion' };
      SaveData.save(g.save);
    }
    this.textoAyuda = 'W A S D: correr   Shift: más rápido   C: agacharse / a gatas';
    this.ayuda = K.AYUDA_S;
  }

  /** Lo que llevas recorrido en el carril de la persecución (m). */
  _sCarril() {
    const C = this.R.caza;
    return sobreCarril(C.carril[this.caza.tramo], this.x, this.y) + (C.desfase?.[this.caza.tramo] ?? 0);
  }

  /** Un evento del recorrido: cambia zonas (el derrumbe), la salida buena de una sala y lo que ya ha pasado. */
  _aplicaEvento(ev, yaPasado = false) {
    this.hechos.add(ev.n);
    if (ev.quita || ev.pon) {
      this.activas = this.activas.filter((z) => z !== ev.quita);
      if (ev.pon && !this.activas.includes(ev.pon)) this.activas.push(ev.pon);
      for (const z of Object.keys(this.zonas)) if (this.zonas[z].malla) this.zonas[z].malla.visible = this.activas.includes(z);
      this._solidos();
      if (this.texLlama) this._llamas(this.texLlama);
      if (this.humo) this._fuentes();
    }
    if (ev.buena) this.buenaDe[ev.buena.sala] = ev.buena.p;
    if (ev.carril !== undefined && this.caza) this.caza.tramo = ev.carril;
    if (!yaPasado && ev.fin) {
      this.x = ev.fin.p[0];
      this.y = ev.fin.p[1];
      this.yaw = Math.atan2(ev.fin.mira[1] - ev.fin.p[1], ev.fin.mira[0] - ev.fin.p[0]);
      this.pitch = ev.fin.inclina ?? 0;
      this.vx = this.vy = 0;
      if (ev.fin.gatas) this.agachado = true;
    }
  }

  stop() {
    this.activa = false;
    this.teclas.clear();
    this.cabina?.zumbido?.stop?.(0.3);
    if (document.pointerLockElement === this.g.canvas) document.exitPointerLock?.();
  }

  // ------------------------------------------------------------------ teclas
  tecla(code) {
    if (this.atrapado || this.cine) return;
    if (code === 'Space' && this.cabina?.activa && this.cabina.pulsa()) return;
    if ((code === 'KeyW' || code === 'ArrowUp') && !this.teclas.has(code)) this.empujaW = true;
    this.teclas.add(code);
    if (code === 'KeyC') this.agachado = !this.agachado;
  }

  keyUp(code) {
    this.teclas.delete(code);
  }

  click() {
    // (v1.35) sentado en la cabina: el botón de despegue (con el ratón capturado, donde miras; si no, el puntero)
    if (this.cabina?.activa) {
      const lib = document.pointerLockElement === this.g.canvas;
      const m = this.g.mouse;
      const ndc = !lib && m ? new THREE.Vector2(m.x / W * 2 - 1, -(m.y / H * 2 - 1)) : null;
      if (this.cabina.pulsa(ndc) || this.cabina.fase !== 'andar') {
        if (!lib) this.g.canvas.requestPointerLock?.();
        return;
      }
    }
    if (document.pointerLockElement !== this.g.canvas) this.g.canvas.requestPointerLock?.();
  }

  // ------------------------------------------------------------------ andar
  _bloquea(s, alto) {
    // (lo bajo se pisa; lo que queda por encima de la cabeza, no estorba; todo desde el suelo que pisas)
    return s.z[1] > this.base + K.PISA && s.z[0] < this.base + alto + 0.1;
  }

  /** La altura del suelo en (x, y): 0, o la de un tramo más alto (el conducto de la rejilla de la Enfermería). */
  _suelo(x, y) {
    for (const z of this.activas) {
      for (const t of this.zonas[z].info.suelo ?? []) if (x >= t[0] && x <= t[2] && y >= t[1] && y <= t[3]) return t[4];
    }
    return 0;
  }

  /** ¿A gatas? (agachado en un sitio más bajo que agachado: el conducto) */
  _aGatas(margen = 0) {
    return (this.R.gatas ?? []).some((c) => enCaja([c[0] - margen, c[1] - margen, c[2] + margen, c[3] + margen], this.x, this.y));
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

  /** (v1.43) ¿El paso de (ax, ay) a (bx, by) atraviesa algo sólido? (acabar dentro o cruzar una de sus caras). Con dos
   *  sólidos solapados, el empuje de uno te metía en el otro y te sacaba por el otro lado: se atravesaban paredes y
   *  conductos (y la cámara se quedaba dentro de un marco). */
  _atraviesa(ax, ay, bx, by, alto) {
    const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by);
    const cruza = (p, q, r, s_) => {
      const d = (q[0] - p[0]) * (s_[1] - r[1]) - (q[1] - p[1]) * (s_[0] - r[0]);
      if (Math.abs(d) < 1e-12) return false;
      const t = ((r[0] - p[0]) * (s_[1] - r[1]) - (r[1] - p[1]) * (s_[0] - r[0])) / d;
      const u = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d;
      return t > 1e-6 && t < 1 - 1e-6 && u >= 0 && u <= 1;
    };
    for (const s of this.solidos) {
      if (s.x1 < x0 || s.x0 > x1 || s.y1 < y0 || s.y0 > y1) continue;
      if (!this._bloquea(s, alto)) continue;
      if (cercano(s.p, ax, ay).dentro) continue;       // (si ya estabas dentro, que pueda salir)
      if (cercano(s.p, bx, by).dentro) return true;
      const P = s.p;
      for (let i = 0; i < P.length; i++) if (cruza([ax, ay], [bx, by], P[i], P[(i + 1) % P.length])) return true;
    }
    return false;
  }

  /** (v1.43) Choca y, si para ello habría que atravesar algo, solo se desliza (o se queda donde estaba). */
  _mueve(px, py, alto) {
    this._choca(alto);
    if (!this._atraviesa(px, py, this.x, this.y, alto)) return;
    const nx = this.x, ny = this.y;
    for (const [x, y] of [[nx, py], [px, ny]]) {
      this.x = x;
      this.y = y;
      this._choca(alto);
      if (!this._atraviesa(px, py, this.x, this.y, alto)) return;
    }
    this.x = px;
    this.y = py;
    this.vx = this.vy = 0;
  }

  /** ¿Cabe de pie aquí? (para levantarse bajo una viga) */
  _cabeDePie() {
    const R = K.RADIO;
    return !this.solidos.some((s) => s.z[0] < this.base + K.OJOS + 0.15 && s.z[0] > this.base + K.GATAS_OJOS + 0.2 && s.z[1] > this.base + K.PISA
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
    for (const b of R.bloqueos ?? []) if (enCaja(b.zona, this.x, this.y) && (!b.tras || this.hechos.has(b.tras))) dentro = b;
    // empujar: estar en la zona del bloqueo queriendo andar sin avanzar (o, en el fuego, solo con acercarte)
    if (dentro && !this.reac && (dentro.tipo === 'fuego' || (quiereIr && this.vel < 0.6))) this.empuje += dt;
    else this.empuje = Math.max(0, this.empuje - dt * 2);
    if (dentro && !this.reac && this.empuje > (dentro.tipo === 'fuego' ? 0.15 : 0.45)) {
      this.empuje = 0;
      this._reacciona(dentro);
      if (this.caza?.empezada) this.caza.ab += this.R.caza.mala;
    }
    if (this.reac) {
      this.reac.t += dt;
      if (this.reac.tipo === 'tos') this.sacude = Math.max(this.sacude, 0.3 * (1 - this.reac.t / this.reac.dur));
      if (this.reac.t >= this.reac.dur) this.reac = null;
    }
  }

  /** El fuego del suelo (la Criogenia): si lo pisas, te quemas (y la Aberración se acerca). */
  _fuegoSuelo() {
    if (this.reac) return;
    for (const f of this.R.fuego_suelo ?? []) {
      if (!enCaja(f, this.x, this.y)) continue;
      this._reacciona({ tipo: 'fuego', zona: f });
      if (this.caza?.empezada) this.caza.ab += this.R.caza.quema;
      return;
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
    const [bx, by, bz] = this.buenaDe[sala.n] ?? sala.buena;
    this.pista = Math.max(0, Math.min(1, (this.tSala - (sala.pista_s ?? K.PISTA_S)) / K.PISTA_SUBE_S));
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

  /** (v1.34, Fase 2c) Dentro de la nave: te das la vuelta, la compuerta se cierra (ella llega corriendo detrás) y la
   *  golpea desde fuera; después, a negro (la Fase 3, la cabina, después). */
  _finNave(dt) {
    const F = this.fin, N = F.nave;
    F.t += dt;
    // entras un paso y te giras hacia la compuerta
    const k = Math.min(1, F.t / 0.9);
    this.x += (N.dentro[0] - this.x) * Math.min(1, dt * 3);
    this.y += (N.dentro[1] - this.y) * Math.min(1, dt * 3);
    const objetivo = Math.atan2(N.mira[1] - this.y, N.mira[0] - this.x);
    this.yaw += angulo(objetivo - this.yaw) * Math.min(1, dt * 4);
    this.pitch *= 0.9;
    this.ojosZ = (N.piso ?? 0.7) + K.OJOS;   // (sobre el suelo de la nave)
    this.vel = 0;
    // ella, corriendo hacia la rampa
    if (this.caza) this.caza.ab = Math.max(this.caza.ab, this._sCarril() - (8 - 6 * k));
    const Z = this.zonas[N.zona];
    if (Z?.malla) {
      const c = Math.max(0, Math.min(1, (F.t - 0.8) / N.cierra_s));
      Z.malla.visible = F.t > 0.8;
      Z.malla.position.x = N.abre * (1 - c * c * (3 - 2 * c));
      if (c >= 1 && !F.cerrada) {
        F.cerrada = true;
        this.sacude = 0.6;
        this._son('metal/golpe_pared', { volume: 1.0, pitch: 0.6 });
        this._son('metal/tuberia', { volume: 0.7, pitch: 0.5, when: 0.1 });
      }
    }
    // los golpes de fuera: la compuerta tiembla (se abolla) y todo con ella
    while (F.golpes < N.golpes.length && F.t >= N.golpes[F.golpes]) {
      F.golpes++;
      this.sacude = 1.0;
      this.golpeRojo = 1;
      this._son('aberracion/metal', { volume: 1.0, pitch: 0.7 });
      this._son('metal/golpe_pared', { volume: 1.0, pitch: 0.45, when: 0.03 });
      if (F.golpes === 2) this._son('aberracion/furia', { volume: 1.0, when: 0.2 });
    }
    this.golpeRojo = Math.max(0, (this.golpeRojo ?? 0) - dt * 2);
    if (Z?.malla && F.cerrada) Z.malla.position.z = (Math.random() - 0.5) * 0.05 * this.sacude;
    this.sacude = Math.max(0, this.sacude - dt);
    // (v1.35) la cabina: tras los primeros golpes, ya andas por dentro de la nave
    if (N.cabina && F.t >= N.cabina) {
      this.cabina.empieza();
      return;
    }
    if (F.t >= N.fin_s) {
      this.acabada = true;
      this.stop();
      this.g._finLibre?.(this.nombre);
    }
  }

  /** Un plano de Blender a pantalla completa (la pared que revienta, el derrumbe), con sus sonidos. */
  /** (v1.40) Los fotogramas de un plano que se ven, en orden (PLANOS_SEC: sin la pausa de antes). */
  _sec(plano) {
    const T = PLANOS.ind?.tramos?.[plano];
    if (!T) return null;
    this._secs ??= {};
    if (!this._secs[plano]) {
      const tramos = K.PLANOS_SEC?.[plano] ?? [[0, T.n - 1]];
      this._secs[plano] = tramos.flatMap(([a, b]) => {
        const s = [];
        for (let i = Math.max(0, a); i <= Math.min(T.n - 1, b); i++) s.push(i);
        return s;
      });
    }
    return this._secs[plano];
  }

  /** (v1.40) Pide de antemano los fotogramas de un plano (para que no se pare a cargarlos cuando toca). */
  _precarga(plano) {
    const s = this._sec(plano);
    if (!s) {                            // (el índice aún no ha llegado: luego)
      setTimeout(() => this._precarga(plano), 300);
      return;
    }
    for (const i of s) PLANOS.img(`${plano}_${n3(i)}`);
  }

  /** (v1.40) El fotograma de Blender que toca ahora en el plano en curso. */
  _fotoCine() {
    const s = this._sec(this.cine.plano);
    if (!s) return 0;
    return s[Math.min(s.length - 1, Math.floor(this.cine.t * (PLANOS.ind?.fps ?? 12)))];
  }

  _updateCine(dt) {
    const c = this.cine;
    const T = PLANOS.ind?.tramos?.[c.plano];
    const s = this._sec(c.plano);
    if (!T || !s) {                      // (aún sin cargar el índice: espera)
      c.espera = (c.espera ?? 0) + dt;
      if (c.espera > 8) this._finCine();
      return;
    }
    const fps = PLANOS.ind.fps ?? 12;
    if (c.t === 0) this._precarga(c.plano);
    // (no corre hasta que están cargados sus fotogramas: así no se traba a medias; como mucho 1,5 s)
    if (c.t === 0) {
      c.espera = (c.espera ?? 0) + dt;
      const listos = s.every((i) => PLANOS.img(`${c.plano}_${n3(i)}`));
      if (!listos && !(c.espera > 1.5 && PLANOS.img(`${c.plano}_${n3(s[0])}`))) return;
    }
    c.t += dt;
    const p = c.t * fps;                 // (el puesto en la secuencia que se ve)
    // un sonido del plano suena en su fotograma de Blender; si ese fotograma está cortado, no suena
    const ev = (n, en, fn) => {
      if (c.eventos.has(n)) return;
      const k = s.indexOf(en);
      if (k < 0) { c.eventos.add(n); return; }
      if (p >= k) { c.eventos.add(n); fn(); }
    };
    if (c.plano === 'revienta') {
      (T.golpes ?? []).forEach((g_, k) => ev('g' + k, g_, () => {
        this.sacude = 0.35 + 0.15 * k;
        this._son('metal/golpe_pared', { volume: 0.7 + 0.1 * k, pitch: 0.55 });
        this._son('aberracion/metal', { volume: 0.6 + 0.1 * k, when: 0.05 });
      }));
      ev('rev', T.revienta ?? 42, () => {
        this._son('n7/explosion', { volume: 1.0, pitch: 0.8 });
        this._son('metal/panel', { volume: 1.0 });
        this._son('final/escombros', { volume: 1.0, when: 0.1 });
      });
      ev('ruge', T.ruge ?? 56, () => { this._son('aberracion/furia', { volume: 1.0 }); this._son('aberracion/grito', { volume: 0.7, when: 0.35 }); });
      ev('lanza', T.lanza ?? 66, () => { this._son('aberracion/arrastre', { volume: 1.0 }); this._son('aberracion/dedos', { volume: 0.8, when: 0.3 }); });
    } else if (c.plano === 'derrumbe') {
      ev('exp', T.explota ?? 6, () => {
        this._son('n7/explosion', { volume: 1.0 });
        this._son('final/escombros', { volume: 1.0, when: 0.15 });
        this._son('final/escombros', { volume: 0.9, when: 0.6 });
        this._son('final/acufeno', { volume: 0.5, when: 0.3 });
      });
    }
    if (p >= s.length - 1) this._finCine();
  }

  _finCine() {
    const c = this.cine;
    this.cine = null;
    if (c.evento) this._aplicaEvento(c.evento);
    this.fundido = 0.6;
    if (this.caza) {
      if (!this.caza.empezada) this._empiezaCaza();
      else this.caza.ab = Math.max(this.caza.ab, this._sCarril() - (c.evento?.ab_tras ?? this.R.caza.ventaja));
    }
  }

  /** Los eventos del recorrido al entrar en su caja: un plano (el derrumbe) o el final del conducto (fundido). */
  _eventos(dt) {
    if (this.salto) {
      this.salto.t += dt;
      if (!this.salto.hecho && this.salto.t >= K.SALTO_S) {
        this.salto.hecho = true;
        this._aplicaEvento(this.salto.ev);
        if (this.caza) this.caza.ab = this._sCarril() - this.salto.ev.ab_tras;
      }
      if (this.salto.t >= K.SALTO_S * 2) this.salto = null;
      return;
    }
    for (const ev of this.R.eventos ?? []) {
      if (this.hechos.has(ev.n) || !enCaja(ev.caja, this.x, this.y)) continue;
      if (ev.plano) {
        this.cine = { plano: ev.plano, t: 0, eventos: new Set(), evento: ev };
        this.teclas.clear();
      } else if (ev.sale) {
        this._sale(ev);
      } else if (ev.explota) {
        this._explota(ev);
      } else if (ev.revienta) {
        // (la Aberración revienta la entrada detrás de ti: no hay plano; se oye y tiembla todo, y está ahí)
        this.hechos.add(ev.n);
        this.sacude = 1.2;
        this._son('n7/explosion', { volume: 1.0, pitch: 0.75 });
        this._son('metal/panel', { volume: 1.0, when: 0.05 });
        this._son('final/escombros', { volume: 1.0, when: 0.2 });
        this._son('aberracion/furia', { volume: 1.0, when: 0.35 });
        if (this.caza) this.caza.ab = Math.max(this.caza.ab, this._sCarril() - ev.ab_tras);
      } else {
        this.hechos.add(ev.n);
        this.salto = { t: 0, ev };
        this._son('aberracion/metal', { volume: 0.5, muffle: 0.7, when: 0.3 });
      }
      return;
    }
  }

  /** (v1.41) La Aberración sale (como Seek: sin plano). Revienta la pared detrás de ti, la vista se gira sola hacia ella
   *  un momento (puedes seguir moviéndote) y empieza a perseguirte. */
  _sale(ev) {
    const S = K.SALE;
    this._aplicaEvento(ev);
    this.sacude = 1.3;
    this.destello = S.DESTELLO;
    this._son('n7/explosion', { volume: 1.0, pitch: 0.8 });
    this._son('metal/panel', { volume: 1.0, when: 0.03 });
    this._son('final/escombros', { volume: 1.0, when: 0.1 });
    this._son('final/escombros', { volume: 0.8, when: 0.55 });
    this._son('aberracion/furia', { volume: 1.0, when: S.RUGE_TRAS });
    this._son('aberracion/grito', { volume: 0.8, when: S.RUGE_TRAS + 0.4 });
    this._son('aberracion/arrastre', { volume: 1.0, when: S.RUGE_TRAS + 0.9 });
    const [px, py, pz] = ev.sale.p;
    this._bocanada(px - 0.8, py, pz, 40);
    this.mira = { t: 0, x: px, y: py, z: pz, yaw0: this.yaw };
    // la caza, con ella en el agujero
    this._empiezaCaza();
    const fr = Math.abs(this.ab?.info?.frente ?? 3.2);
    this.caza.ab = (this.R.caza.desfase?.[0] ?? 0) + fr * 0.6 + 0.4;
  }

  /** (v1.41) La puerta de evacuación de la Criogenia revienta de lejos (sin plano): fogonazo, sacudida, humo y escombros. */
  _explota(ev) {
    const D = K.DERRUMBE;
    this._aplicaEvento(ev);
    this.sacude = D.SACUDE;
    this.destello = D.DESTELLO;
    this._son('n7/explosion', { volume: 1.0 });
    this._son('final/escombros', { volume: 1.0, when: 0.15 });
    this._son('final/escombros', { volume: 0.9, when: 0.6 });
    this._son('final/acufeno', { volume: 0.4, when: 0.3 });
    const [px, py, pz] = ev.explota.p;
    this._bocanada(px, py + 1.0, pz, D.HUMO);
    if (this.caza?.empezada) this.caza.ab = Math.max(this.caza.ab, this._sCarril() - (ev.ab_tras ?? this.R.caza.ventaja));
  }

  /** (v1.41) La vista se gira sola hacia donde sale la Aberración (y se cierra un poco la lente), y la suelta. */
  _updateMira(dt) {
    const M = this.mira;
    if (!M) { this.lente += (1 - this.lente) * Math.min(1, dt * 3); return; }
    const S = K.SALE;
    M.t += dt;
    const k = Math.min(1, dt * S.MIRA_FUERZA);
    const objY = Math.atan2(M.y - this.y, M.x - this.x);
    const objP = Math.atan2(M.z - this.ojosZ, Math.hypot(M.x - this.x, M.y - this.y));
    this.yaw += Math.atan2(Math.sin(objY - this.yaw), Math.cos(objY - this.yaw)) * k;
    this.pitch += (objP - this.pitch) * k;
    this.lente += (S.LENTE - this.lente) * Math.min(1, dt * 6);
    if (M.t >= S.MIRA_S) this.mira = null;
  }

  /** La puerta atascada: cada W contra ella la abre un poco; si paras, vuelve; abierta del todo, se queda. */
  _updatePuerta(dt, w) {
    const P = this.R.puerta, E = this.puerta;
    if (!P || !E) return;
    const Z = this.zonas[P.zona];
    if (!Z) return;
    const empujando = enCaja(P.empuje, this.x, this.y);
    if (!E.libre) {
      if (w && empujando) {
        E.abre = Math.min(1, E.abre + K.PUERTA.POR_W);
        this.sacude = Math.max(this.sacude, 0.45);
        this._son('metal/golpe_pared', { volume: 0.75, pitch: 0.8 + Math.random() * 0.15 });
        this._son('final/golpe', { volume: 0.5, when: 0.04 });
        if (E.abre >= 1) {
          E.libre = true;
          this._son('metal/tuberia', { volume: 0.9, pitch: 0.7 });
        }
      }
      E.abre = Math.max(0, E.abre - K.PUERTA.VUELVE * dt);
    }
    const dx = P.recorre * (E.libre ? 1 : E.abre);
    Z.dx += (dx - Z.dx) * Math.min(1, dt * 10);
    Z.malla.position.x = Z.dx;
    for (const s of Z.solidos) {
      s.p = s.p0.map(([x, y]) => [x + Z.dx, y]);
      const xs = s.p.map((q) => q[0]);
      s.x0 = Math.min(...xs);
      s.x1 = Math.max(...xs);
    }
  }

  /** La Aberración en su carril: su ritmo, lo cerca que está, sus sonidos, el respiro de Slaimi y si te alcanza. */
  _updateCaza(dt) {
    const C = this.caza, RC = this.R.caza;
    if (!C?.empezada || this.atrapado) return;
    const s = this._sCarril();
    const enConducto = (RC.sin ?? []).some((c) => enCaja(c, this.x, this.y)) || this.salto;
    // a su ritmo; si te alejas mucho, acelera (no se queda atrás); en el conducto no cabe: se queda en la boca
    let v = RC.vel * (s - C.ab > RC.goma ? 1.6 : 1);
    if (enConducto) v = 0;
    C.ab = Math.min(C.ab + v * dt, s);
    const hueco = s - C.ab;
    this.cerca = Math.max(0, Math.min(1, (RC.lejos - hueco) / (RC.lejos - RC.atrapa)));
    // Slaimi, una vez: su luz la ciega y te da un respiro
    if (!this.respiro && this.slaimi && hueco < RC.respiro_en) {
      this.respiro = true;
      this.flashSlaimi = 1;
      C.ab -= RC.respiro;
      this._son('slaimi/gemido', { volume: 1.0, pitch: 1.3 });
      this._son('aberracion/retrocede', { volume: 0.9, when: 0.15 });
    }
    if (hueco <= RC.atrapa && !enConducto) {
      this.atrapado = { t: 0 };
      this.teclas.clear();
      this.g.audio?.scream?.();
      this._son('aberracion/furia', { volume: 1.0 });
      return;
    }
    // sus sonidos: respiraciones y arrastre, más fuertes cuanto más cerca; en el conducto, golpes en la boca
    const d = this.cerca;
    if (enConducto) {
      C.golpeIn -= dt;
      if (C.golpeIn <= 0) {
        C.golpeIn = 1.8 + Math.random() * 1.6;
        this._son('metal/golpe_pared', { volume: 0.6, pitch: 0.5, muffle: 0.5 });
        this._son('aberracion/dedos', { volume: 0.45, when: 0.4, muffle: 0.5 });
      }
      return;
    }
    C.abRespIn -= dt;
    if (C.abRespIn <= 0 && d > 0.25) {
      C.abRespIn = 3.2 - 1.6 * d + Math.random() * 0.8;
      this._son('aberracion/respiraciones', { volume: 0.25 + 0.75 * d * d });
    }
    C.abPasoIn -= dt;
    if (C.abPasoIn <= 0) {
      C.abPasoIn = 1.6 - 0.8 * d + Math.random() * 0.5;
      this._son(Math.random() < 0.5 ? 'aberracion/arrastre' : 'aberracion/metal', { volume: 0.2 + 0.7 * d, muffle: 0.5 * (1 - d) });
    }
  }

  update(dt) {
    if (!this.activa || !this.listo || this.x === undefined) return;
    this.t += dt;
    this.tLlama.value = this.t;
    this.alarma.value = 0.15 + 0.85 * Math.max(0, Math.sin(this.t * Math.PI * 2 * 0.8)) ** 2;
    this._updateHumo(dt);
    if (this.cabina?.activa) {
      // (v1.35) dentro de la nave no se la ve; al caer, asomada al agujero del Hangar
      if (this.ab) {
        for (const b of this.ab.bordes) b.visible = false;
        if (this.cabina.aberracion(this.ab)) this._animaAb(this.ab, Math.min(0.6, K.AB_BORDES - 0.01));
        else this.ab.grupo.visible = false;
      }
    } else if (this.R.caza) this._updateAb(dt);
    else if (this.ab) this.ab.grupo.visible = false;
    this.flashSlaimi = Math.max(0, (this.flashSlaimi ?? 0) - dt / 0.9);
    if (this.atrapado) {
      this.atrapado.t += dt;
      if (this.atrapado.t >= CONFIG.JUMPSCARE_TIME + 0.6) {
        const muertes = (this.muertes ?? 0) + 1;
        this.start(this.nombre, 'reinicio');
        this.muertes = muertes;
      }
      return;
    }
    if (this.cine) {
      this._updateCine(dt);
      return;
    }
    this.ayuda = Math.max(0, this.ayuda - dt);
    this.fundido = Math.max(0, this.fundido - dt / 0.8);
    this.quema = Math.max(0, this.quema - dt / 0.9);
    if (this.fin?.nave) {
      this._finNave(dt);
      return;
    }
    // (v1.35) en la cabina: sentado o despegando, la cabina se ocupa de todo
    if (this.cabina?.update(dt)) return;
    if (this.fin && this.R.fin?.sigue) {
      // (v1.41) la huida no se acaba en negro: sigue la persecución desde aquí
      this.acabada = true;
      this.sigue = true;
      this.fin = null;
      this.g._finLibre?.(this.nombre);
      return;
    }
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
    this._updateMira(dt);
    this.destello = Math.max(0, (this.destello ?? 0) - dt * 1.4);
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
    const vmax = agacha && this._aGatas() ? K.VEL_GATAS : agacha ? K.VEL_AGACHADO : corre ? K.VEL_CORRE : K.VEL;
    // (v1.41) mientras la vista se gira sola hacia la Aberración, sigues yendo hacia donde ibas
    const yawMov = this.mira ? this.mira.yaw0 : this.yaw;
    const cy = Math.cos(yawMov), sy = Math.sin(yawMov);
    // (adelante = (cos yaw, sin yaw); la derecha = (sin yaw, -cos yaw))
    const ox = anda ? (fx * cy + lx * sy) * vmax : 0, oy = anda ? (fx * sy - lx * cy) * vmax : 0;
    const a = Math.min(1, dt * (anda ? K.ACELERA : K.FRENA) * (this.reac ? 0.25 : 1));
    this.vx += (ox - this.vx) * a;
    this.vy += (oy - this.vy) * a;
    const px = this.x, py = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const debajo = !agacha && !this._cabeDePie();
    // (v1.43) se choca a la altura de los ojos que llevas: agachado, a la de agachado (antes, como a gatas: con los ojos
    // a 0,95 m se pasaba bajo la punta de la viga, a 0,73, y la cámara se metía dentro: «un marco beige llena la
    // pantalla»); a gatas solo en el conducto y en su boca (para poder entrar)
    const gatasAhora = agacha && this._aGatas(K.GATAS_BOCA ?? 0.8);
    const ojosObj = gatasAhora ? K.GATAS_OJOS : agacha || debajo ? K.AGACHADO_OJOS : K.OJOS;
    const altoAhora = Math.max(ojosObj, Math.min(this.alto ?? ojosObj, K.OJOS)) + 0.15;
    this._mueve(px, py, altoAhora);
    const recorrido = Math.hypot(this.x - px, this.y - py);
    this.vel = recorrido / Math.max(dt, 1e-4);
    // el suelo bajo tus pies: si se acaba (la rejilla de la Enfermería), caes
    const suelo = this._suelo(this.x, this.y);
    if (suelo < this.base - 0.2) {
      this.cayendo = { t: 0, desde: this.base };
      this._son('caidas/caja', { volume: 0.8, pitch: 0.7, when: 0.25 });
      this._son('pasos/metal', { volume: 0.8, pitch: 0.7, when: 0.3 });
      this._son('n7/respira', { volume: 0.6, when: 0.6 });
      this.agachado = false;
    }
    this.base = suelo;
    let caida = 0;
    if (this.cayendo) {
      this.cayendo.t += dt;
      const k = Math.min(1, this.cayendo.t / 0.35);
      caida = (this.cayendo.desde - this.base) * (1 - k * k);
      if (this.cayendo.t >= 0.35) {
        this.sacude = Math.max(this.sacude, 0.9);
        this.alto = K.GATAS_OJOS;
        this.cayendo = null;
      }
    }
    // la altura de los ojos (agacharse, suave) y el balanceo al andar
    const gatas = agacha && this._aGatas();
    const ojos = gatasAhora ? K.GATAS_OJOS : agacha || debajo ? K.AGACHADO_OJOS : K.OJOS;
    this.alto += (ojos - this.alto) * Math.min(1, dt * (this.cayendo ? 0 : 6));
    this.ojosZ = this.base + this.alto + caida;
    this.gatas = gatas;
    this.balanceo += recorrido * Math.PI / (corre ? K.PASO_CORRE : K.PASO);
    // los pasos (cada zancada)
    this.pasoAcum += recorrido;
    const zancada = agacha ? K.PASO * 0.8 : corre ? K.PASO_CORRE : K.PASO;
    if (this.pasoAcum >= zancada) {
      this.pasoAcum = 0;
      if (this.gatas) this._son('pasos/rejilla', { volume: 0.32, pitch: 0.85 });
      else this._son('pasos/metal', { volume: agacha ? 0.3 : corre ? 0.75 : 0.5, pitch: corre ? 1.08 : 1.0 });
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
    this.golpeRojo = Math.max(0, (this.golpeRojo ?? 0) - dt * 2);
    if (this.cabina?.activa) return;          // (dentro de la nave: sin salidas, pistas ni persecución)
    this._bloqueos(dt, l > 0);
    this._pistas(dt);
    this._fuegoSuelo();
    this._updatePuerta(dt, this.empujaW);
    this.empujaW = false;
    this._eventos(dt);
    this._updateCaza(dt);
    // el final del recorrido (la puerta del Laboratorio)
    if (this.R.fin && enCaja(this.R.fin.caja, this.x, this.y)) {
      this.fin = { t: 0, nave: this.R.fin.nave ?? null, golpes: 0 };
      this._son('pasos/metal', { volume: 0.6 });
      if (this.fin.nave) {
        this.teclas.clear();
        this._son('metal/tuberia', { volume: 0.8, pitch: 1.3, when: 0.3 });
      }
    }
  }

  // ------------------------------------------------------------------ dibujar
  draw(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (!this.listo || this.x === undefined) return;
    if (this.atrapado) {
      drawJumpscare(ctx, 'aberracion', this.atrapado.t, this.g.effects);
      return;
    }
    if (this.cine) {
      const f = this._fotoCine();
      const im = PLANOS.img(`${this.cine.plano}_${n3(f)}`) ?? this._ultimoPlano;
      if (im) {
        this._ultimoPlano = im;
        const sx = this.sacude > 0 ? (Math.random() - 0.5) * 16 * this.sacude : 0;
        const sy = this.sacude > 0 ? (Math.random() - 0.5) * 12 * this.sacude : 0;
        ctx.drawImage(im, -W * 0.05 + sx, -H * 0.05 + sy, W * 1.1, H * 1.1);
      }
      this.sacude = Math.max(0, this.sacude - 1 / 60);
      return;
    }
    const amp = Math.min(1, (this.vel ?? 0) / K.VEL) * (this.corriendo ? 1.6 : 1);
    const bob = Math.sin(this.balanceo) * K.BALANCEO * amp;
    const lado = Math.sin(this.balanceo * 0.5) * K.BALANCEO * 0.6 * amp;
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const sx = this.sacude > 0 ? (Math.random() - 0.5) * 0.06 * this.sacude : 0;
    const sz = this.sacude > 0 ? (Math.random() - 0.5) * 0.04 * this.sacude : 0;
    // (Blender (x, y, z) → three (x, z, -y))
    this.cam.position.set(this.x + sy * lado, (this.ojosZ ?? this.alto) + Math.abs(bob) + sz, -(this.y - cy * lado));
    this.cam.rotation.y = this.yaw - Math.PI / 2 + sx;
    this.cam.rotation.x = this.pitch + bob * 0.15 + sz;
    this.cam.rotation.z = lado * 0.25;
    this.cabina?.camara(this.cam);
    // el fuego parpadea (la luz horneada del fuego, multiplicada)
    const t = this.t;
    this.flick.value = 0.78 + 0.12 * Math.sin(t * 9.1) + 0.07 * Math.sin(t * 23.7 + 1.3) + 0.05 * Math.sin(t * 4.3 + 2.1);
    // (v1.41) la lente se cierra un poco mientras miras salir a la Aberración
    if (this.fov0 === undefined) this.fov0 = this.cam.fov;
    const fov = this.fov0 * (this.lente ?? 1);
    if (Math.abs(this.cam.fov - fov) > 1e-3) {
      this.cam.fov = fov;
      this.cam.updateProjectionMatrix();
    }
    this.r.render(this.escena, this.cam);
    ctx.drawImage(this.r.domElement, 0, 0, W, H);
    // (v1.41) el fogonazo de una explosión cercana (la pared, la puerta de evacuación)
    if (this.destello > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,150,70,${Math.min(0.85, this.destello * this.destello).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    this._drawSlaimi(ctx, amp);
    if (this.quema > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,110,30,${(0.35 * this.quema).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    // la Aberración cerca: el borde se tiñe de rojo y late (más rápido cuanto más cerca)
    const cerca = this.caza?.empezada ? this.cerca ?? 0 : 0;
    if (cerca > 0.02) {
      ctx.save();
      const late = 0.75 + 0.25 * Math.sin(this.t * (5 + 9 * cerca));
      const gr = ctx.createRadialGradient(W / 2, H / 2, H * (0.55 - 0.25 * cerca), W / 2, H / 2, H * 0.95);
      gr.addColorStop(0, 'rgba(120,0,0,0)');
      gr.addColorStop(1, `rgba(150,0,0,${(0.7 * cerca * late).toFixed(3)})`);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgba(255,${Math.round(255 - 90 * cerca)},${Math.round(255 - 110 * cerca)},1)`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (this.flashSlaimi > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(190,225,255,${(0.6 * this.flashSlaimi).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    const fundeSalto = this.salto ? 1 - Math.abs(this.salto.t / K.SALTO_S - 1) : 0;
    const finNegro = this.fin?.nave ? Math.max(0, (this.fin.t - (this.fin.nave.fin_s - 1.2)) / 1.2) : this.fin ? Math.min(1, this.fin.t / K.FIN_S) : 0;
    const negro = Math.max(this.fin ? finNegro : this.fundido, fundeSalto);
    if (this.golpeRojo > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(120,0,0,${(0.35 * this.golpeRojo).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    this.cabina?.draw(ctx);
    if (negro > 0) {
      ctx.fillStyle = `rgba(0,0,0,${negro.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.ayuda > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.ayuda) * 0.7;
      ctx.fillStyle = '#cfd8d0';
      ctx.font = '14px monospace';
      ctx.fillText(this.textoAyuda ?? 'W A S D: moverse   ratón: mirar (clic)   Shift: correr   C: agacharse', 24, H - 24);
      ctx.restore();
    }
  }

  /** Slaimi en tus brazos, abajo (si vive): se mece con el paso, tiembla al asustarse y brilla más mirando la
   *  salida buena; si tardas, se inclina hacia ella. */
  _drawSlaimi(ctx, andando) {
    const br = this.slaimi ? brazos() : null;
    if (!br || (this.dejaSlaimi ?? 0) >= 1) return;
    const deja = this.dejaSlaimi ?? 0;
    const r = this.reac;
    const tiembla = r?.tipo === 'slaimi' ? (1 - r.t / r.dur) : (this.sacude > 0.5 ? 0.4 : 0);
    let hacia = 0;
    if (this.sala && this.pista > 0.3) {
      const b = this.buenaDe[this.sala.n] ?? this.sala.buena;
      const rel = angulo(Math.atan2(b[1] - this.y, b[0] - this.x) - this.yaw);
      hacia = -Math.max(-1, Math.min(1, rel / 1.2)) * 40 * this.pista;
    }
    const bx = (Math.random() - 0.5) * 10 * tiembla + Math.sin(this.t * 1.7) * 4 + Math.sin(this.balanceo) * 6 * andando + hacia;
    const by = H * KM.BRAZOS_BAJA + Math.abs(Math.cos(this.balanceo)) * 10 * andando + Math.sin(this.t * 2.3) * 3
      + Math.max(0, -this.pitch) * 120 + deja * deja * H * 0.75;
    ctx.save();
    ctx.globalAlpha = 1 - deja * deja;
    ctx.drawImage(br, bx, by, W, H);
    ctx.restore();
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
