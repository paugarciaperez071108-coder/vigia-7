// =============================================================
// Final4.js — (v1.36, Fase 4 del final) Los 4 finales, desde la cabina de la nave de escape (con Libre3D y Cabina3D).
// Tras el despegue, la nave se aleja y se da la vuelta: por el parabrisas, la VIGIA-7 entera sobre el planeta, ardiendo
// (tools/3d/final/vigia_fuera.py → tr/hornear_fuera.py → assets/final/tr/vigia_fuera.*; cada pieza se mueve por su
// cuenta en el shader). Cuál toca: Slaimi (vivo/muerto) y El Errante en tu cabeza (src/core/Finales.js).
//   1 (vivo, no): explosiones en cadena por el casco, el reactor estalla en blanco, la onda y los trozos ardiendo.
//     Slaimi mira contigo (su brillo, con la explosión). En silencio: la cabina y tu respiración, que se calma. Slaimi
//     te mira y brilla; su último sonido, tranquilo. Fundido, «VIGIA-7».
//   2 (vivo, sí): como el 1 hasta antes de la explosión; la imagen se tuerce, un susurro y, en el reflejo del
//     parabrisas, en vez de tu cara, la suya; su cara llena la pantalla; la nave da media vuelta sola (A/D no
//     responden: luchas y pierdes); Slaimi se asusta, brilla y te empuja; aceleras hacia la VIGIA-7 justo cuando
//     explota: el fogonazo, el cristal y negro en seco. En negro, las respiraciones de varias voces y la tuya.
//   3 (muerto, no): el 1 con el asiento vacío; entre los restos, un brillo azul diminuto que se apaga.
//   4 (muerto, sí): el 2 sin Slaimi.
// Valores en NIGHT7.FINAL.LIBRE.FINAL4.
// =============================================================

import * as THREE from '../lib/three/three.module.min.js';
import { GLTFLoader } from '../lib/three/addons/GLTFLoader.js';
import { NIGHT7 } from '../night/night7.js';
import { CONFIG } from '../config.js';
import { Finales } from '../core/Finales.js';

const K = NIGHT7.FINAL.LIBRE;
const KF = K.FINAL4;
const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const DIR = 'assets/final/tr/';
const b2t = (x, y, z) => new THREE.Vector3(x, z, -y);
const suave = (a, b, t) => {
  const k = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
const angulo = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// la estación en piezas: cada vértice lee su pieza (centro, velocidad, giro, calor) de una textura
const VS_PIEZAS = `
attribute float _pieza;
uniform sampler2D uPiezas;
uniform float uT;
varying vec2 vUv;
varying float vCalor;
vec3 gira(vec3 v, vec3 e, float a) {
  float c = cos(a), s = sin(a);
  return v * c + cross(e, v) * s + e * dot(e, v) * (1.0 - c);
}
void main() {
  vUv = uv;
  int i = int(_pieza + 0.5);
  vec4 a = texelFetch(uPiezas, ivec2(i, 0), 0);   // centro, t0
  vec4 b = texelFetch(uPiezas, ivec2(i, 1), 0);   // velocidad, giro
  vec4 c = texelFetch(uPiezas, ivec2(i, 2), 0);   // eje, calor
  float dt = max(0.0, uT - a.w);
  vec3 p = position;
  if (dt > 0.0) {
    p = a.xyz + gira(position - a.xyz, normalize(c.xyz), b.w * dt) + b.xyz * dt + vec3(0.0, -0.6, 0.0) * dt * dt;
  }
  vCalor = dt > 0.0 ? c.w * (0.06 + 0.94 * exp(-dt / 2.2)) * min(1.0, dt * 6.0) : 0.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const FS_PIEZAS = `
uniform sampler2D uLuz;
uniform float uK;
uniform vec3 uFlash;
varying vec2 vUv;
varying float vCalor;
void main() {
  vec3 base = pow(texture2D(uLuz, vUv).rgb, vec3(2.2)) * uK;
  vec3 c = base + vCalor * vec3(2.4, 0.55, 0.08) + uFlash * (0.25 + base);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
// el fuego de las explosiones: planos hacia la cámara con el atlas de la llama (llama_flipbook.py), que crecen
const VS_BOLA = `
attribute vec3 iPos;
attribute vec3 iDat;    // tamaño final, t0, vida
uniform float uT;
varying vec2 vUv;
varying float vEdad;
varying float vF;
void main() {
  float e = (uT - iDat.y) / iDat.z;
  vEdad = e;
  float tam = iDat.x * (0.25 + 0.75 * sqrt(clamp(e, 0.0, 1.0)));
  vec3 der = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 arr = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 p = iPos + (der * position.x + arr * position.y) * tam;
  vUv = position.xy + 0.5;
  vF = floor(clamp(e, 0.0, 0.999) * 24.0);
  if (e < 0.0 || e > 1.0) p = vec3(0.0, -1e6, 0.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const FS_BOLA = `
uniform sampler2D uAtlas;
varying vec2 vUv;
varying float vEdad;
varying float vF;
void main() {
  float col = mod(vF, 6.0), fila = floor(vF / 6.0);
  vec2 uv = vec2((col + vUv.x) / 6.0, (fila + 1.0 - vUv.y) / 4.0);
  vec3 c = texture2D(uAtlas, uv).rgb;
  float r = length(vUv - 0.5) * 2.0;
  c += vec3(1.0, 0.75, 0.4) * max(0.0, 1.0 - r) * (1.0 - vEdad) * 1.4;
  gl_FragColor = vec4(c * (1.0 - vEdad * vEdad) * 1.6, 1.0);
}`;
// el planeta: un fondo (sin profundidad) con nubes, océanos, la luz del sol y el borde de la atmósfera
const VS_PLANETA = `
varying vec3 vN;
varying vec3 vP;
varying vec3 vVista;
void main() {
  vN = normalize(normal);
  vP = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vVista = normalize(cameraPosition - (modelMatrix * vec4(position, 1.0)).xyz);
  gl_Position = projectionMatrix * mv;
}`;
const FS_PLANETA = `
uniform vec3 uSol;
uniform float uNubes;
varying vec3 vN;
varying vec3 vP;
varying vec3 vVista;
float h(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float ruido(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h(i), h(i + vec3(1, 0, 0)), f.x), mix(h(i + vec3(0, 1, 0)), h(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h(i + vec3(0, 0, 1)), h(i + vec3(1, 0, 1)), f.x), mix(h(i + vec3(0, 1, 1)), h(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float s = 0.0, a = 0.5; for (int k = 0; k < 6; k++) { s += a * ruido(p); p *= 2.03; a *= 0.5; } return s; }
void main() {
  vec3 n = normalize(vN);
  vec3 q = normalize(vP) * uNubes;
  float tierra = smoothstep(0.52, 0.58, fbm(q * 0.9));
  float nube = smoothstep(0.5, 0.75, fbm(q * 1.7 + vec3(3.1)));
  vec3 col = mix(vec3(0.01, 0.04, 0.12), vec3(0.06, 0.09, 0.07), tierra);
  col = mix(col, vec3(0.75, 0.8, 0.86), nube * 0.85);
  float luz = max(0.0, dot(n, normalize(uSol)));
  col *= 0.05 + 1.3 * luz;
  float borde = pow(1.0 - max(0.0, dot(n, normalize(vVista))), 3.0);
  col += vec3(0.25, 0.5, 1.0) * borde * (0.25 + 1.4 * luz);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

let MANO = null;                    // (v1.37) tu mano en el cristal (final 3): tools/3d/final/mano_cristal.py
function mano() {
  if (!MANO) {
    MANO = new Image();
    MANO.src = 'assets/final/tr/mano_cristal.webp';
  }
  return MANO.complete && MANO.naturalWidth ? MANO : null;
}

let CARA = null;                    // la cara de El Errante (su render: assets/n4/mira/mira_cara.jpg)
function cara() {
  if (!CARA) {
    CARA = new Image();
    CARA.src = 'assets/n4/mira/mira_cara.jpg';
  }
  return CARA.complete && CARA.naturalWidth ? CARA : null;
}

export class Final4 {
  constructor(libre) {
    this.L = libre;
    this.activo = false;
  }

  _son(clave, o = {}) {
    return this.L._son(clave, o);
  }

  /** Cargar la estación por fuera (en cuanto empieza la persecución, para no esperar después). */
  carga() {
    if (this.prom) return this.prom;
    this.prom = Promise.all([
      new Promise((ok, mal) => new GLTFLoader().load(`${DIR}vigia_fuera.glb`, ok, undefined, mal)),
      fetch(`${DIR}vigia_fuera.json`).then((r) => r.json()),
      new Promise((ok) => new THREE.TextureLoader().load(`${DIR}vigia_fuera_luz.webp`, (t) => {
        t.flipY = false;
        t.colorSpace = THREE.NoColorSpace;
        t.anisotropy = 4;
        ok(t);
      }, undefined, () => ok(null))),
    ]).then(([gltf, info, luz]) => {
      this.info = info;
      const n = info.piezas.length;
      this.datos = new Float32Array(n * 4 * 3);
      this.texPiezas = new THREE.DataTexture(this.datos, n, 3, THREE.RGBAFormat, THREE.FloatType);
      this.texPiezas.needsUpdate = true;
      this.uT = { value: 0 };
      this.uFlash = { value: new THREE.Vector3() };
      const mat = new THREE.ShaderMaterial({
        vertexShader: VS_PIEZAS, fragmentShader: FS_PIEZAS,
        uniforms: { uLuz: { value: luz }, uK: { value: info.K * KF.BRILLO }, uPiezas: { value: this.texPiezas }, uT: this.uT, uFlash: this.uFlash },
      });
      this.grupo = new THREE.Group();
      gltf.scene.traverse((o) => {
        if (o.isMesh) {
          o.material = mat;
          o.frustumCulled = false;
        }
      });
      this.grupo.add(gltf.scene);
      this.grupo.visible = false;
      this.L.escena.add(this.grupo);
      this._fondo();
      return this;
    }).catch((e) => {
      console.warn('Final4: sin la estación por fuera', e);
      return null;
    });
    return this.prom;
  }

  /** El planeta, las estrellas, el sol; las bolas de fuego, la onda y los trozos que caen ardiendo. */
  _fondo() {
    const L = this.L;
    this.cielo = new THREE.Group();
    this.cielo.visible = false;
    const sol = new THREE.Vector3(...KF.SOL).normalize();
    this.planeta = new THREE.Mesh(new THREE.SphereGeometry(KF.PLANETA_R, 96, 64),
      new THREE.ShaderMaterial({ vertexShader: VS_PLANETA, fragmentShader: FS_PLANETA, uniforms: { uSol: { value: sol }, uNubes: { value: KF.NUBES } },
        depthWrite: false, depthTest: false }));
    this.planeta.renderOrder = -10;
    this.cielo.add(this.planeta);
    const n = 2500, pos = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) {
      const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().multiplyScalar(KF.CIELO);
      pos.set([v.x, v.y, v.z], k * 3);
    }
    const ge = new THREE.BufferGeometry();
    ge.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.estrellas = new THREE.Points(ge, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.5, sizeAttenuation: false,
      toneMapped: false, depthWrite: false }));
    this.estrellas.renderOrder = -11;
    this.cielo.add(this.estrellas);
    L.escena.add(this.cielo);
    // las bolas de fuego
    const N = KF.BOLAS;
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.attributes.position = base.attributes.position;
    this.aBolaP = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    this.aBolaD = new THREE.InstancedBufferAttribute(new Float32Array(N * 3).fill(-99), 3);
    g.setAttribute('iPos', this.aBolaP);
    g.setAttribute('iDat', this.aBolaD);
    g.instanceCount = N;
    this.bolas = new THREE.Mesh(g, new THREE.ShaderMaterial({
      vertexShader: VS_BOLA, fragmentShader: FS_BOLA, uniforms: { uAtlas: { value: L.texLlama }, uT: { value: 0 } },
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
    this.bolas.frustumCulled = false;
    this.bolas.visible = false;
    this.nBolas = 0;
    L.escena.add(this.bolas);
    // la onda del reactor (un anillo que crece) y el fogonazo
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const c = cv.getContext('2d');
    const gr = c.createRadialGradient(128, 128, 60, 128, 128, 128);
    gr.addColorStop(0, 'rgba(120,180,255,0)');
    gr.addColorStop(0.8, 'rgba(190,225,255,0.9)');
    gr.addColorStop(0.9, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(120,180,255,0)');
    c.fillStyle = gr;
    c.fillRect(0, 0, 256, 256);
    this.onda = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, side: THREE.DoubleSide, opacity: 0 }));
    this.onda.rotation.x = -Math.PI / 2;
    this.onda.visible = false;
    L.escena.add(this.onda);
    const cv2 = document.createElement('canvas');
    cv2.width = cv2.height = 128;
    const c2 = cv2.getContext('2d');
    const g2 = c2.createRadialGradient(64, 64, 2, 64, 64, 64);
    g2.addColorStop(0, 'rgba(255,255,255,1)');
    g2.addColorStop(0.25, 'rgba(200,230,255,0.6)');
    g2.addColorStop(1, 'rgba(120,180,255,0)');
    c2.fillStyle = g2;
    c2.fillRect(0, 0, 128, 128);
    this.texBrillo = new THREE.CanvasTexture(cv2);
    this.brillo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texBrillo, blending: THREE.AdditiveBlending, depthWrite: false,
      transparent: true, toneMapped: false, opacity: 0 }));
    this.brillo.visible = false;
    L.escena.add(this.brillo);
    // el brillo azul diminuto entre los restos (final 3) y las balizas que parpadean
    this.azul = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texBrillo, color: 0x8fc8ff, blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, toneMapped: false, opacity: 0 }));
    this.azul.visible = false;
    L.escena.add(this.azul);
    this.balizas = Object.entries(this.info.marcas).filter(([k]) => k.startsWith('baliza')).map(([, p], k) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texBrillo, color: k % 3 ? 0xff3020 : 0xffffff,
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
      s.position.copy(b2t(...p));
      s.scale.setScalar(4);
      s.userData.fase = Math.random() * 6;
      s.visible = false;
      L.escena.add(s);
      return s;
    });
  }

  _bola(p, tam, t0, vida) {
    const i = this.nBolas++ % KF.BOLAS;
    this.aBolaP.setXYZ(i, p.x, p.y, p.z);
    this.aBolaD.setXYZ(i, tam, t0, vida);
    this.aBolaP.needsUpdate = this.aBolaD.needsUpdate = true;
  }

  /** Las explosiones: en cadena por los módulos (desde el Hangar) y después el reactor, que se lo lleva todo. */
  _plan(tCadena, tReactor) {
    const P = this.info.piezas, D = this.datos, n = P.length;
    const nuc = this.info.marcas.nucleo ?? [30, -30, 25];
    const cN = b2t(...nuc);
    this.nucleo = cN;
    const h0 = b2t(0, 0, 4);
    const mods = {};
    for (const p of P) (mods[p.m] ??= []).push(p);
    // cada módulo, su hora en la cadena (más lejos del Hangar, más tarde); el reactor va el último
    this.cadena = [];
    for (const [m, ps] of Object.entries(mods)) {
      const c = ps.reduce((a, p) => a.add(b2t(...p.c)), new THREE.Vector3()).multiplyScalar(1 / ps.length);
      const t = m === 'reactor' ? tReactor - 0.4 : tCadena + c.distanceTo(h0) / 30 * KF.CADENA_S;
      this.cadena.push({ m, c, t, hecha: false, ps });
    }
    this.cadena.sort((a, b) => a.t - b.t);
    for (let i = 0; i < n; i++) {
      const p = P[i];
      const c = b2t(...p.c);
      const mod = this.cadena.find((q) => q.m === p.m);
      // en la cadena salta una parte de las placas de cada módulo; el resto, con el reactor
      const enCadena = mod.t < tReactor - 0.5 && Math.random() < KF.CADENA_PARTE;
      let t0, v;
      if (enCadena) {
        t0 = mod.t + Math.random() * 0.7;
        v = c.clone().sub(mod.c).normalize().multiplyScalar(4 + Math.random() * 12).add(new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3));
      } else {
        const d = c.distanceTo(cN);
        t0 = tReactor + d / KF.ONDA_VEL;
        v = c.clone().sub(cN).normalize().multiplyScalar(KF.VEL_REACTOR * (0.5 + Math.random()) * (60 / (40 + d)) + 8)
          .add(new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6));
      }
      const e = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      D.set([c.x, c.y, c.z, t0], i * 4);
      D.set([v.x, v.y, v.z, (Math.random() - 0.5) * 2.4], (n + i) * 4);
      D.set([e.x, e.y, e.z, 0.6 + Math.random() * 0.8], (2 * n + i) * 4);
    }
    this.texPiezas.needsUpdate = true;
  }

  /** Empieza el final n (1–4): la nave, lejos, mirando a la estación. */
  empieza(n) {
    const L = this.L, C = L.cabina;
    this.n = n;
    this.errante = n === 2 || n === 4;
    this.activo = true;
    this.t = 0;
    this.hechos = new Set();
    if (!this.grupo) {
      // (aún cargando: espera en negro)
      this.espera = true;
      this.carga().then(() => {
        this.espera = false;
        this._monta();
      });
      return;
    }
    this._monta();
  }

  _monta() {
    const L = this.L, C = L.cabina;
    // fuera todo lo de dentro de la estación: solo la nave
    for (const [z, Z] of Object.entries(L.zonas)) if (Z.malla) Z.malla.visible = [...K.CABINA.NAVE, L.R.fin?.nave?.zona].includes(z);
    if (L.mLlamas) L.mLlamas.visible = false;
    if (L.mHumo) L.mHumo.visible = false;
    if (C.fuera) C.fuera.visible = false;
    if (L.ab) L.ab.grupo.visible = false;
    this.grupo.visible = this.cielo.visible = this.bolas.visible = true;
    for (const b of this.balizas) b.visible = true;
    this.bolas.material.uniforms.uAtlas.value = L.texLlama;
    this.uT.value = -1;
    this.uFlash.value.set(0, 0, 0);
    // la nave: lejos, al este y algo por debajo, con el morro hacia la estación (y la estación arriba en el parabrisas)
    const T = b2t(...KF.MIRA);
    const P = b2t(...KF.DESDE);
    const d = T.clone().sub(P).normalize();
    const g = C.naveG;
    g.position.copy(P);
    g.rotation.set(Math.asin(d.y) - KF.MORRO_BAJO, Math.atan2(-d.x, -d.z), 0, 'YXZ');
    this.yaw0 = g.rotation.y;
    this.pitch0 = g.rotation.x;
    this.deriva = d.clone().multiplyScalar(-KF.DERIVA);
    L.pitch = KF.MIRA_ARRIBA;
    L.yaw = Math.PI / 2;
    L.cam.far = KF.LEJOS;
    L.cam.updateProjectionMatrix();
    const tR = this.errante ? KF.ERRANTE.REACTOR : KF.REACTOR;
    this._plan(this.errante ? KF.ERRANTE.CADENA : KF.CADENA, tR);
    this.tReactor = tR;
    // el zumbido de la cabina vuelve (bajo): en el espacio no se oye nada más
    C.zumbido?.stop?.(0.1);
    C.zumbido = L.g.audio?.lib?.play('final/cabina', { loop: true, volume: K.CABINA.ZUMBIDO * 0.7, pitchVar: 0, volVar: 0 }) || null;
    this.respIn = 1.0;
  }

  /** Cada fotograma (la cabina le cede todo). */
  update(dt) {
    if (!this.activo || this.espera) return;
    const L = this.L, C = L.cabina;
    this.t += dt;
    const t = this.t;
    const una = (k, f) => {
      if (t >= k && !this.hechos.has(k)) {
        this.hechos.add(k);
        f();
      }
    };
    this.uT.value = t;
    this.bolas.material.uniforms.uT.value = t;
    const g = C.naveG;
    // el cielo sigue a la cámara (el planeta y las estrellas están «en el infinito»)
    const cp = L.cam.getWorldPosition(new THREE.Vector3());
    this.cielo.position.copy(cp);
    this.planeta.position.set(0, -KF.PLANETA_R / Math.cos(KF.HORIZONTE), 0);
    for (const b of this.balizas) b.material.opacity = t < this.tReactor && Math.sin(t * 3 + b.userData.fase) > 0.55 ? 1 : 0.05;
    // las explosiones de la cadena: una bola de fuego por módulo (y alguna más)
    for (const q of this.cadena) {
      if (!q.hecha && t >= q.t && q.m !== 'reactor') {
        q.hecha = true;
        for (let k = 0; k < 4; k++) {
          const p = b2t(...q.ps[Math.floor(Math.random() * q.ps.length)].c);
          this._bola(p, 14 + Math.random() * 16, t + Math.random() * 0.5, 1.6 + Math.random());
        }
        if (this.errante) {
          this._son('n7/explosion', { volume: 0.25, muffle: 0.8, pitch: 0.6 });
        }
      }
    }
    // el reactor: el fogonazo blanco, la onda y todo se va
    una(this.tReactor, () => {
      this.flash = 1;
      this.brillo.visible = this.onda.visible = true;
      for (let k = 0; k < 14; k++) {
        const p = this.nucleo.clone().add(new THREE.Vector3((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 40));
        this._bola(p, 30 + Math.random() * 40, t + Math.random() * 0.8, 2.5 + Math.random() * 1.5);
      }
      if (L.slaimi && !this.errante) C.slaimiLuz && (C.slaimiLuz.material.opacity = 1);
    });
    if (t >= this.tReactor) {
      const e = t - this.tReactor;
      this.brillo.position.copy(this.nucleo);
      this.brillo.scale.setScalar(60 + 900 * (1 - Math.exp(-e * 1.5)));
      this.brillo.material.opacity = Math.max(0, 1.2 * Math.exp(-e / 1.6));
      this.onda.position.copy(this.nucleo);
      const r = KF.ONDA_VEL * e;
      this.onda.scale.setScalar(Math.max(1, r));
      this.onda.material.opacity = Math.max(0, 1 - e / 6) * 0.9;
      this.uFlash.value.setScalar(Math.max(0, 2.5 * Math.exp(-e / 0.8)));
      // los trozos que caen ardiendo hacia el planeta (estelas)
      if (e > 2 && e < 14 && Math.random() < dt * 6) {
        const p = this.nucleo.clone().add(new THREE.Vector3((Math.random() - 0.5) * 300, -40 - Math.random() * 150, (Math.random() - 0.5) * 300));
        this._bola(p, 6 + Math.random() * 8, t, 2.5);
      }
    }
    this.flash = Math.max(0, (this.flash ?? 0) - dt / 2.2);
    if (this.errante) this._errante(dt);
    else this._calma(dt);
    // la nave: se aleja despacio (en los finales del Errante, ella lo decide)
    if (!this.errante || t < KF.ERRANTE.GIRA) g.position.addScaledVector(this.deriva, dt);
    C._slaimi(dt);
    C._pantallas(dt);
  }

  /** Finales 1 y 3: en silencio; la respiración se calma; Slaimi brilla (1) o el brillo azul se apaga (3). */
  _calma(dt) {
    const L = this.L, C = L.cabina, t = this.t;
    // la respiración: cada vez más lenta y suave
    this.respIn -= dt;
    if (this.respIn <= 0 && t < KF.FIN - 3) {
      const k = Math.min(1, t / (KF.FIN - 6));
      this.respIn = 2.4 + 3.5 * k;
      this._son('n7/respira', { volume: 0.55 - 0.35 * k, pitch: 1.15 - 0.3 * k });
    }
    // Slaimi brilla con la explosión
    if (C.slaimiLuz && L.slaimi) {
      const ex = t > this.tReactor ? Math.exp(-(t - this.tReactor) / 3) : 0;
      C.slaimiLuz.material.opacity = 0.35 + 0.9 * ex + (t > KF.SLAIMI_TE_MIRA ? 0.5 * suave(KF.SLAIMI_TE_MIRA, KF.SLAIMI_TE_MIRA + 1, t) : 0);
    }
    if (L.slaimi) {
      // al final te giras hacia él: te mira, brilla y su último sonido, tranquilo
      const h = C._m.hueco;
      if (t > KF.SLAIMI_TE_MIRA && h) {
        const objY = Math.atan2(h[1] - L.y, h[0] - L.x);
        const objP = Math.atan2(h[2] + 0.12 - L.ojosZ, Math.hypot(h[0] - L.x, h[1] - L.y));
        L.yaw += angulo(objY - L.yaw) * Math.min(1, dt * 1.5);
        L.pitch += (objP - L.pitch) * Math.min(1, dt * 1.5);
      }
      if (t > KF.SLAIMI_TE_MIRA + 1.2 && !this.hechos.has('calma')) {
        this.hechos.add('calma');
        this._son('slaimi/calma', { volume: 0.8, pitch: 0.9 });
      }
    } else if (t > this.tReactor + 3) {
      // (3) entre los restos, un brillo azul diminuto que se apaga
      const e = t - (this.tReactor + 3);
      this.azul.visible = true;
      this.azul.position.copy(this.nucleo).add(new THREE.Vector3(25 + e * 6, -10 - e * 3, 20));
      this.azul.scale.setScalar(5 + Math.sin(e * 4) * 0.8);
      this.azul.material.opacity = e < 3 ? 0.9 * (0.6 + 0.4 * Math.sin(e * 5)) : Math.max(0, 0.9 * (1 - (e - 3) / 3));
    }
    if (t >= KF.FIN) this._acaba();
  }

  /** Finales 2 y 4: El Errante en tu cabeza. */
  _errante(dt) {
    const L = this.L, C = L.cabina, t = this.t, E = KF.ERRANTE;
    const una = (k, f) => {
      if (t >= k && !this.hechos.has(k)) {
        this.hechos.add(k);
        f();
      }
    };
    una(E.TUERCE, () => this._son('final/susurro', { volume: 0.9 }));
    una(E.REFLEJO + 1.0, () => this._son('final/susurro', { volume: 1.0, pitch: 0.85 }));
    una(E.CARA, () => {
      this._son('final/susurro', { volume: 1.0, pitch: 0.7 });
      this._son('ambiente/interferencia', { volume: 0.8 });
    });
    una(E.GIRA, () => {
      L.sacude = Math.max(L.sacude, 0.8);
      this._son('final/motor', { volume: 1.0, pitch: 0.85 });
      this._son('n7/alarma', { volume: 0.5 });
    });
    if (L.slaimi) {
      una(E.SLAIMI, () => {
        this._son('slaimi/gemido', { volume: 1.0, pitch: 1.35 });
        C.slaimiLuz && (C.slaimiLuz.material.opacity = 1.4);
        this.empuja = 0;
      });
    }
    una(E.NEGRO, () => {
      this._son('metal/cristal', { volume: 1.0 });
      this._son('n7/explosion', { volume: 1.0, pitch: 0.7 });
      C.zumbido?.stop?.(0.02);
      C.zumbido = null;
      for (let k = 0; k < 3; k++) this._son('aberracion/respiraciones', { volume: 0.7, when: 1.5 + k * 1.6, muffle: 0.3 });
      this._son('n7/respira', { volume: 0.8, when: 7.0, pitch: 0.95 });
    });
    // la nave se da la vuelta sola y acelera hacia la estación; A/D casi no hacen nada (y al revés)
    const g = C.naveG;
    if (t > E.GIRA && t < E.NEGRO) {
      const T = b2t(...KF.MIRA);
      const d = T.clone().sub(g.position).normalize();
      const objY = Math.atan2(-d.x, -d.z), objP = Math.asin(d.y);
      const lucha = ((L.teclas.has('KeyA') ? 1 : 0) - (L.teclas.has('KeyD') ? 1 : 0)) * -E.LUCHA;
      g.rotation.y += angulo(objY - g.rotation.y) * Math.min(1, dt * 0.9) + lucha * dt;
      g.rotation.x += (objP - g.rotation.x) * Math.min(1, dt * 0.9);
      g.rotation.z = Math.sin(t * 7) * 0.02 + lucha * 0.15;
      this.vel = (this.vel ?? 0) + E.EMPUJE * dt;
      g.position.addScaledVector(new THREE.Vector3(0, 0, -1).applyEuler(g.rotation), this.vel * dt);
      L.pitch += (0.12 - L.pitch) * Math.min(1, dt * 2);
      L.yaw += angulo(Math.PI / 2 - L.yaw) * Math.min(1, dt * 2);
      L.sacude = Math.max(L.sacude, 0.35);
    }
    L.sacude = Math.max(0, L.sacude - dt * 0.5);
    if (this.empuja !== undefined) this.empuja = Math.min(1, this.empuja + dt / 1.2);
    if (t >= E.FIN) this._acaba();
  }

  _acaba() {
    if (this.acabado) return;
    this.acabado = true;
    const L = this.L;
    Finales.marcar(this.n);
    L.finalVisto = this.n;
    L.acabada = true;
    L.stop();
    L.cabina?.zumbido?.stop?.(0.3);
    L.g._finLibre?.(L.nombre);
  }

  /** Encima, en 2D: el fogonazo, la imagen torcida, el reflejo y la cara de El Errante, el cristal y los fundidos. */
  draw(ctx) {
    if (!this.activo) return;
    const t = this.t;
    if (this.espera) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      return;
    }
    // el fogonazo del reactor
    if (this.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(235,245,255,${Math.min(1, this.flash * 1.1).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (this.errante) this._drawErrante(ctx);
    else if (!this.L.slaimi) this._drawMano(ctx);
    // fundidos: de entrada y de salida (con «VIGIA-7» en los finales 1 y 3)
    let negro = 1 - suave(0, KF.ENTRA_S, t);
    if (!this.errante) {
      negro = Math.max(negro, suave(KF.FIN - 6, KF.FIN - 3.5, t));
      if (t > KF.FIN - 3.5) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        const a = suave(KF.FIN - 3.4, KF.FIN - 2.4, t) * (1 - suave(KF.FIN - 0.9, KF.FIN, t));
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = '#e8eef5';
        ctx.font = 'bold 96px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('VIGIA-7', W / 2, H / 2 + 30);
        ctx.restore();
        return;
      }
    }
    if (negro > 0) {
      ctx.fillStyle = `rgba(0,0,0,${negro.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  _drawErrante(ctx) {
    const t = this.t, E = KF.ERRANTE;
    if (t >= E.NEGRO) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      // el cristal, un instante, antes del negro
      if (t < E.NEGRO + 0.12) this._grietas(ctx);
      return;
    }
    // la imagen se tuerce: copias desplazadas en rojo y azul, y la vista se inclina
    const tu = suave(E.TUERCE, E.TUERCE + 1.5, t) * (t < E.CARA + 1.5 ? 1 : 0.6);
    if (tu > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.18 * tu;
      const dx = Math.sin(t * 13) * 10 * tu;
      ctx.drawImage(ctx.canvas, dx, 0, W, H, 0, 0, W, H);
      ctx.drawImage(ctx.canvas, -dx, 0, W, H, 0, 0, W, H);
      ctx.restore();
    }
    // su cara en el reflejo del parabrisas (arriba, donde está el cristal), cada vez más clara
    const cr = cara();
    if (cr && t > E.REFLEJO && t < E.CARA + 1.6) {
      const ref = suave(E.REFLEJO, E.REFLEJO + 2.5, t);
      const lleno = suave(E.CARA, E.CARA + 0.6, t);
      const sale = 1 - suave(E.CARA + 1.1, E.CARA + 1.6, t);
      const ww = W * (0.32 + 0.9 * lleno), hh = ww * 9 / 16;
      const cx = W / 2 + (Math.random() - 0.5) * 18 * lleno, cy = H * (0.28 + 0.24 * lleno) + (Math.random() - 0.5) * 12 * lleno;
      ctx.save();
      ctx.globalCompositeOperation = lleno > 0.5 ? 'source-over' : 'screen';
      ctx.globalAlpha = Math.min(1, (0.08 + 0.3 * ref) * (1 - lleno) + lleno) * sale;
      ctx.drawImage(cr, cx - ww / 2, cy - hh / 2, ww, hh);
      if (lleno > 0) {
        // estática encima
        for (let k = 0; k < 40; k++) {
          ctx.fillStyle = `rgba(255,255,255,${(Math.random() * 0.12).toFixed(3)})`;
          ctx.fillRect(0, Math.random() * H, W, 1 + Math.random() * 3);
        }
      }
      ctx.restore();
    }
    // Slaimi te empuja: su luz llena la pantalla
    if (this.empuja !== undefined && this.L.slaimi) {
      const e = this.empuja;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(W * 0.6, H * 0.85, 10, W * 0.6, H * 0.85, H * (0.3 + 0.9 * e));
      gr.addColorStop(0, `rgba(190,225,255,${(0.75 * (1 - e * 0.6)).toFixed(3)})`);
      gr.addColorStop(1, 'rgba(190,225,255,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  /** (final 3) Tu mano en el cristal: sube despacio y se queda, con el vaho en el cristal alrededor de los dedos. */
  _drawMano(ctx) {
    const m = mano();
    const t0 = this.tReactor + KF.MANO_TRAS;
    if (!m || this.t < t0) {
      mano();
      return;
    }
    const k = suave(t0, t0 + 2.2, this.t);
    const y = (1 - k) * H * 0.35 + Math.sin(this.t * 0.8) * 3;
    ctx.save();
    // el vaho: una mancha clara en el cristal donde apoya la mano (crece y respira)
    const vx = W * 0.615, vy = H * 0.3 + y;
    const r = H * (0.12 + 0.03 * Math.sin(this.t * 1.1)) * k;
    if (r > 1) {
      const gr = ctx.createRadialGradient(vx, vy, 1, vx, vy, r * 1.6);
      gr.addColorStop(0, `rgba(200,220,240,${(0.16 * k).toFixed(3)})`);
      gr.addColorStop(1, 'rgba(200,220,240,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalAlpha = Math.min(1, k * 1.2);
    ctx.drawImage(m, 0, y, W, H);
    ctx.restore();
  }

  /** El parabrisas que se raja (un instante). */
  _grietas(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(20,20,20,0.9)';
    ctx.lineWidth = 2;
    const r = (s) => {
      const x = Math.sin(s * 91.7) * 43758.5;
      return x - Math.floor(x);
    };
    const cx = W * 0.55, cy = H * 0.4;
    for (let k = 0; k < 18; k++) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      let x = cx, y = cy;
      const a = k / 18 * Math.PI * 2 + r(k) * 0.3;
      for (let j = 0; j < 6; j++) {
        x += Math.cos(a + (r(k * 7 + j) - 0.5) * 0.6) * (60 + r(k + j) * 120);
        y += Math.sin(a + (r(k * 7 + j) - 0.5) * 0.6) * (60 + r(k + j) * 120);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  reset() {
    this.activo = false;
    this.acabado = false;
    this.espera = false;
    this.empuja = undefined;
    this.vel = 0;
    if (this.grupo) this.grupo.visible = false;
    if (this.cielo) this.cielo.visible = false;
    if (this.bolas) {
      this.bolas.visible = false;
      this.aBolaD.array.fill(-99);
      this.aBolaD.needsUpdate = true;
    }
    if (this.onda) this.onda.visible = false;
    if (this.brillo) this.brillo.visible = false;
    if (this.azul) this.azul.visible = false;
    for (const b of this.balizas ?? []) b.visible = false;
  }
}
