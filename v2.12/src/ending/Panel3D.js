// =============================================================
// Panel3D.js — (v1.76, el usuario: «que el panel sea un objeto 3D de verdad, montado en la pared, y no una lámina
// plana») EL PANEL DE REINICIO del pasillo central en el 3D en tiempo real: el mismo modelo que la vista de cerca y que
// el pasillo de la vista de atrás (tools/3d/salas/panel_reinicio.py → tools/3d/final/tr/panel_glb.py →
// assets/final/tr/panel_n4.*), con su color, su oclusión y su relieve horneados.
//   · La luz: la linterna (la misma cuenta que las salas: linternaGLSL.js), con su sombra (capa 1: el pase de sombras de
//     Libre3D la echa sobre la pared), y la luz propia del CRT y de los pilotos, que alumbra el panel y la pared de
//     alrededor (Libre3D.luzPropia).
//   · El CRT: cristal abombado y hundido, con un brillo verde tenue, líneas, un reflejo suave de la linterna.
//   · Los pilotos (rojo y ámbar): luces de verdad con su halo; parpadean según el estado (modo).
//   · Choca (Libre3D.solidosExtra).
// Modos: 'apagado' (la 2.5: sin energía, solo el rojo muy débil, lento) · 'reposo' (la noche 4 al salir de la taquilla:
// algo de corriente, el CRT en espera y el rojo fijo) · 'carga' (la ruta A, subiendo: el ámbar parpadea, el CRT más
// vivo) · 'lleno' (al 100 %: el ámbar fijo y el CRT encendido).
// =============================================================

import * as THREE from '../lib/three/three.module.min.js';
import { GLTFLoader } from '../lib/three/addons/GLTFLoader.js';
import { LINT_UNIFORMES, LINT_CONO } from './linternaGLSL.js';

const DIR = 'assets/final/tr/';
const NOMBRE = 'panel_n4';

// cómo está cada parte en cada modo: crt (0–1), pilotos [rojo, ámbar] (0–1) y parpadeo [rojo, ámbar] (Hz; 0 = fijo)
export const PANEL3D = {
  MODOS: {
    apagado: { crt: 0.0, rojo: 0.22, ambar: 0.0, hzRojo: 0.45, hzAmbar: 0 },
    reposo: { crt: 0.16, rojo: 0.8, ambar: 0.0, hzRojo: 0, hzAmbar: 0 },
    carga: { crt: 0.34, rojo: 0.8, ambar: 1.0, hzRojo: 0, hzAmbar: 1.6 },
    lleno: { crt: 0.62, rojo: 0.0, ambar: 1.0, hzRojo: 0, hzAmbar: 0 },
  },
  K: 0.1,              // la luz de la linterna sobre el panel (como El Largo: × FUERZA)
  AMB: 0.0035,         // lo poco que se ve sin linterna (las formas, con la luz de las salas casi a cero)
  RELIEVE: 1.0,
  CRT_LUZ: 2.2,        // la luz propia del CRT sobre la pared (Libre3D.luzPropia)
  PILOTO_LUZ: 0.9,
  HALO: 0.075,         // m: el halo de cada piloto encendido
  SOMBRA_M: 12,        // m: más lejos, sin su sombra (no se ve y ahorra el pase de sombras)
};

const VS = `
varying vec2 vUv;
varying vec3 vW;
varying vec3 vN;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const COMUN = `
uniform vec4 uLint;
uniform vec4 uLintDir;
uniform float uLintSuave;
${LINT_UNIFORMES}
uniform sampler2D uSombra;
uniform mat4 uSombraVP;
uniform float uSombraOn;
uniform float uSombraPaso;
uniform float uK;
uniform float uAmb;
uniform vec3 uCrtP;      // el centro del CRT (three) y su luz
uniform float uCrt;
uniform vec3 uRojoP;
uniform float uRojo;
uniform vec3 uAmbarP;
uniform float uAmbar;
varying vec2 vUv;
varying vec3 vW;
varying vec3 vN;
#include <packing>
float sombraLint(vec3 w) {
  if (uSombraOn < 0.5) return 1.0;
  vec4 p = uSombraVP * vec4(w, 1.0);
  if (p.w <= 0.0) return 1.0;
  vec3 q = p.xyz / p.w * 0.5 + 0.5;
  if (q.x <= 0.0 || q.x >= 1.0 || q.y <= 0.0 || q.y >= 1.0 || q.z >= 1.0) return 1.0;
  float s = 0.0;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
    float d = unpackRGBAToDepth(textureLod(uSombra, q.xy + vec2(float(i), float(j)) * uSombraPaso, 0.0));
    s += q.z - 0.0012 > d ? 0.0 : 1.0;
  }
  return s / 9.0;
}
${LINT_CONO}
// la linterna sobre un punto con normal n: la luz (sin el color) y el brillo
vec2 linterna(vec3 n, vec3 n0, float brillo) {
  if (uLint.w <= 0.0) return vec2(0.0);
  vec3 d = vW - uLint.xyz;
  float l = length(d);
  vec3 rayo = d / max(l, 0.001);
  float at = conoLint(rayo) / (1.0 + l * l * 0.03) * sombraLint(vW + n0 * 0.02) * uLint.w;
  float lam = max(dot(n, -rayo), 0.0);
  vec3 h = normalize(-rayo + normalize(cameraPosition - vW));
  return vec2(at * (0.1 + 0.9 * lam), at * pow(max(dot(n, h), 0.0), brillo));
}
// una luz pequeña (el CRT, un piloto) sobre un punto
float cerca(vec3 p, vec3 n, float r) {
  vec3 d = p - vW;
  float l = length(d);
  return max(dot(n, d / max(l, 0.001)), 0.0) / (1.0 + (l * l) / (r * r));
}
`;

const FS_CUERPO = `
uniform sampler2D uMap;
uniform sampler2D uNor;
uniform float uNorK;
${COMUN}
vec3 perturba(vec3 n, vec3 pos, vec2 uv) {
  vec3 q0 = dFdx(pos), q1 = dFdy(pos);
  vec2 st0 = dFdx(uv), st1 = dFdy(uv);
  vec3 q1p = cross(q1, n), q0p = cross(n, q0);
  vec3 T = q1p * st0.x + q0p * st1.x;
  vec3 B = q1p * st0.y + q0p * st1.y;
  float det = max(dot(T, T), dot(B, B));
  float sc = det == 0.0 ? 0.0 : inversesqrt(det);
  vec3 m = texture2D(uNor, uv).xyz * 2.0 - 1.0;
  m.xy *= uNorK;
  return normalize(T * (m.x * sc) + B * (m.y * sc) + n * m.z);
}
void main() {
  vec3 alb = pow(texture2D(uMap, vUv).rgb, vec3(2.2));
  vec3 n0 = normalize(gl_FrontFacing ? vN : -vN);
  vec3 n = perturba(n0, vW, vUv);
  vec2 li = linterna(n, n0, 40.0);
  vec3 luz = alb * uK * li.x + vec3(0.9, 0.88, 0.82) * li.y * uK * 0.12;
  // la luz propia: el CRT (verde) y los pilotos, sobre lo que tienen al lado (el bisel, las chapas, la tapa)
  vec3 propia = vec3(0.25, 1.0, 0.5) * uCrt * 0.55 * cerca(uCrtP, n, 0.16)
              + vec3(1.0, 0.12, 0.05) * uRojo * 0.35 * cerca(uRojoP, n, 0.05)
              + vec3(1.0, 0.5, 0.06) * uAmbar * 0.35 * cerca(uAmbarP, n, 0.05);
  luz += alb * propia + alb * uAmb;
  gl_FragColor = vec4(tonoLint(luz), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// el cristal del CRT: abombado, verde muy oscuro; con corriente, el fósforo con sus líneas y un parpadeo; refleja la linterna
const FS_CRT = `
uniform float uT;
${COMUN}
void main() {
  vec3 n = normalize(gl_FrontFacing ? vN : -vN);
  vec2 q = vUv * 2.0 - 1.0;
  float vi = clamp(1.0 - 0.55 * dot(q * q, q * q) - 0.25 * dot(q, q), 0.0, 1.0);
  float lineas = 0.78 + 0.22 * sin(vUv.y * 380.0);
  float barra = 0.88 + 0.12 * smoothstep(0.0, 0.08, abs(fract(vUv.y * 0.6 - uT * 0.11) - 0.5));
  float ruido = fract(sin(dot(floor(vUv * vec2(160.0, 110.0)) + floor(uT * 24.0), vec2(12.9898, 78.233))) * 43758.5453);
  float temb = 0.94 + 0.06 * sin(uT * 47.0) * sin(uT * 13.0);
  // unas líneas de texto que no se leen (el terminal del panel), un poco más vivas que el fondo del fósforo
  vec2 cel = vec2(floor(vUv.x * 38.0), floor((1.0 - vUv.y) * 16.0));
  float fila = fract(sin(cel.y * 91.7) * 4375.85);
  float largo = 6.0 + floor(fila * 26.0);
  float letra = step(0.35, fract(sin(dot(cel, vec2(17.13, 3.71))) * 9137.3)) * step(cel.x, largo) * step(2.0, cel.x)
              * step(fract((1.0 - vUv.y) * 16.0), 0.62) * step(0.25, fract(vUv.x * 38.0)) * step(cel.y, 13.0) * step(1.0, cel.y);
  float bloque = 0.32 + 0.68 * letra;
  vec3 fosforo = vec3(0.035, 0.4, 0.15) * uCrt * vi * vi * lineas * barra * temb * bloque * (0.9 + 0.1 * ruido);
  // lo que hay detrás del cristal (sin corriente, casi negro y algo verdoso) y la linterna en él
  vec3 vidrio = vec3(0.004, 0.012, 0.008);
  vec2 li = linterna(n, n, 120.0);
  vec3 vw = normalize(cameraPosition - vW);
  float fres = pow(1.0 - max(dot(n, vw), 0.0), 4.0);
  vec3 luz = vidrio * (0.3 + li.x * uK * 2.0) + fosforo * 0.9
           + vec3(0.95, 0.93, 0.86) * (li.y * uK * 0.9 + fres * 0.02 * (uLint.w > 0.0 ? 1.0 : 0.0));
  gl_FragColor = vec4(tonoLint(luz), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// la lente de un piloto: su color apagado con la linterna y, encendida, su luz
const FS_LED = `
uniform vec3 uColor;
uniform float uOn;
${COMUN}
void main() {
  vec3 n = normalize(gl_FrontFacing ? vN : -vN);
  vec2 li = linterna(n, n, 80.0);
  vec3 apagado = uColor * 0.12;
  vec3 luz = apagado * (uK * li.x + uAmb) + uColor * uOn * 2.2 + vec3(1.0) * li.y * uK * 0.6;
  gl_FragColor = vec4(tonoLint(luz), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const COLOR_LED = { rojo: [1.0, 0.1, 0.05], ambar: [1.0, 0.5, 0.06], off: [0.5, 0.42, 0.36] };
const tres = (p) => new THREE.Vector3(p[0], p[2], -p[1]);       // (Blender → three)

function texturaHalo() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Panel3D {
  /** L: el Libre3D; o: { modo } */
  constructor(L, o = {}) {
    this.L = L;
    this.modo = o.modo ?? 'reposo';
    this.t = 0;
    this.crt = 0;
    this.rojo = 0;
    this.ambar = 0;
    this.listo = false;
    this.uT = { value: 0 };
    this.promesa = Promise.all([
      new Promise((ok, mal) => new GLTFLoader().load(`${DIR}${NOMBRE}.glb`, ok, undefined, mal)),
      L._tex(`${NOMBRE}_color.webp`, 2048, true),
      L._tex(`${NOMBRE}_normal.webp`, 2048, false),
      fetch(`${DIR}${NOMBRE}.json`).then((r) => r.json()),
    ]).then(([gltf, color, nor, info]) => {
      if (this.parado) return null;
      this._monta(gltf, color, nor, info);
      return this;
    }).catch((e) => {
      this.fallo = true;
      console.warn('Vigía-7: el panel de reinicio en 3D no ha cargado', e);
      return null;
    });
  }

  _monta(gltf, color, nor, info) {
    const L = this.L;
    const P = PANEL3D;
    this.info = info;
    const rojo = info.pilotos.find((p) => p.color === 'rojo');
    const ambar = info.pilotos.find((p) => p.color === 'ambar');
    this.posCrt = info.crt.c;
    this.posRojo = rojo?.p;
    this.posAmbar = ambar?.p;
    const crtN = info.crt.n;
    // (la luz propia sale un poco por delante de la pantalla y de cada lente)
    this.luzCrt = [info.crt.c[0] + crtN[0] * 0.12, info.crt.c[1] + crtN[1] * 0.12, info.crt.c[2] + crtN[2] * 0.12];
    const u = {
      uLint: L.uLint, uLintDir: L.uLintDir, uLintSuave: L.uLintSuave, uLintPerfil: L.uLintPerfil,
      uSombra: L.uSombra, uSombraVP: L.uSombraVP, uSombraOn: L.uSombraOn, uSombraPaso: L.uSombraPaso,
      uK: { value: P.K }, uAmb: { value: P.AMB }, uT: this.uT,
      uCrtP: { value: tres(this.luzCrt) }, uCrt: { value: 0 },
      uRojoP: { value: tres(rojo ? [rojo.p[0], rojo.p[1] - 0.03, rojo.p[2]] : [0, 0, -99]) }, uRojo: { value: 0 },
      uAmbarP: { value: tres(ambar ? [ambar.p[0], ambar.p[1] - 0.03, ambar.p[2]] : [0, 0, -99]) }, uAmbar: { value: 0 },
    };
    this.u = u;
    const mat = (fs, extra = {}) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, side: THREE.DoubleSide,
      uniforms: { ...u, ...extra } });
    this.matCuerpo = mat(FS_CUERPO, { uMap: { value: color }, uNor: { value: nor }, uNorK: { value: P.RELIEVE } });
    this.matCrt = mat(FS_CRT);
    this.leds = [];
    this.grupo = new THREE.Group();
    gltf.scene.traverse((m) => {
      if (!m.isMesh) return;
      const n = m.name.replace(/\.\d+$/, '');
      if (n.startsWith('piloto_')) {
        const k = Number(n.split('_')[1]);
        const col = info.pilotos[k]?.color ?? 'off';
        const lm = mat(FS_LED, { uColor: { value: new THREE.Vector3(...COLOR_LED[col]) }, uOn: { value: 0 } });
        m.material = lm;
        this.leds.push({ col, m: lm, p: info.pilotos[k]?.p });
      } else if (n.startsWith('crt')) {
        m.material = this.matCrt;
        m.layers.enable(1);
      } else {
        m.material = this.matCuerpo;
        m.layers.enable(1);           // (hace sombra: el pase de sombras de la linterna dibuja la capa 1)
      }
      m.frustumCulled = false;
    });
    this.grupo.add(gltf.scene);
    // los halos de los pilotos (sprites aditivos)
    const tx = texturaHalo();
    this.halos = this.leds.filter((l) => l.col !== 'off' && l.p).map((l) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, color: new THREE.Color(...COLOR_LED[l.col]),
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
      s.position.copy(tres([l.p[0], l.p[1] - 0.02, l.p[2]]));
      s.scale.setScalar(P.HALO);
      this.grupo.add(s);
      return { col: l.col, s };
    });
    L.escena.add(this.grupo);
    // la colisión
    const so = info.solido;
    const xs = so.p.map((p) => p[0]), ys = so.p.map((p) => p[1]);
    this.solido = { n: so.n, z: so.z, p: so.p, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    L.solidosExtra = [...(L.solidosExtra ?? []).filter((s) => s.n !== so.n), this.solido];
    L._solidos?.();
    try {
      L.r.initTexture?.(color);
      L.r.initTexture?.(nor);
      L.r.compile(L.escena, L.cam);
    } catch (e) { /* se preparará al verlo */ }
    this.listo = true;
    this.update(0);
  }

  update(dt) {
    if (!this.listo) return;
    this.t += dt;
    this.uT.value = this.t;
    const M = PANEL3D.MODOS[this.modo] ?? PANEL3D.MODOS.reposo;
    const parp = (hz, fase = 0) => (hz > 0 ? (Math.sin((this.t + fase) * hz * Math.PI * 2) > -0.2 ? 1 : 0.08) : 1);
    const k = Math.min(1, dt * 6);
    this.crt += (M.crt - this.crt) * k;
    this.rojo += (M.rojo * parp(M.hzRojo) - this.rojo) * Math.min(1, dt * 18);
    this.ambar += (M.ambar * parp(M.hzAmbar, 0.13) - this.ambar) * Math.min(1, dt * 18);
    const u = this.u;
    u.uCrt.value = this.crt;
    u.uRojo.value = this.rojo;
    u.uAmbar.value = this.ambar;
    for (const l of this.leds) l.m.uniforms.uOn.value = l.col === 'rojo' ? this.rojo : l.col === 'ambar' ? this.ambar : 0;
    for (const h of this.halos) h.s.material.opacity = 0.55 * (h.col === 'rojo' ? this.rojo : this.ambar);
    // su luz sobre la pared y el suelo de alrededor (las salas)
    const L = this.L;
    // (la sombra del panel solo hace falta cerca de él: el pase de sombras cuesta un render más por fotograma)
    if (L.sombra?.delPanel && this.posCrt && L.x !== undefined) {
      L.sombra.activa = Math.hypot(L.x - this.posCrt[0], L.y - this.posCrt[1]) < PANEL3D.SOMBRA_M;
    }
    const P = PANEL3D;
    L.luzPropia(0, this.luzCrt, P.CRT_LUZ * this.crt, [0.25, 1.0, 0.5]);
    L.luzPropia(1, this.posRojo && [this.posRojo[0], this.posRojo[1] - 0.06, this.posRojo[2]], P.PILOTO_LUZ * this.rojo, [1.0, 0.12, 0.05]);
    L.luzPropia(2, this.posAmbar && [this.posAmbar[0], this.posAmbar[1] - 0.06, this.posAmbar[2]], P.PILOTO_LUZ * this.ambar, [1.0, 0.5, 0.06]);
  }

  stop() {
    this.parado = true;
    const L = this.L;
    for (let i = 0; i < 3; i++) L.luzPropia(i, null);
    if (this.solido) {
      L.solidosExtra = (L.solidosExtra ?? []).filter((s) => s !== this.solido);
      L._solidos?.();
    }
    if (this.grupo) {
      L.escena.remove(this.grupo);
      this.grupo.traverse((m) => {
        if (m.isMesh) m.geometry.dispose();
        if (m.isSprite) m.material.dispose();
      });
    }
    this.matCuerpo?.uniforms.uMap.value?.dispose?.();
    this.matCuerpo?.uniforms.uNor.value?.dispose?.();
    this.matCuerpo?.dispose();
    this.matCrt?.dispose();
    for (const l of this.leds ?? []) l.m.dispose();
    this.grupo = null;
    this.listo = false;
  }
}
