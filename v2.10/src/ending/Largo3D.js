// =============================================================
// Largo3D.js — (v1.73, el final de la 2.5) El Largo como modelo de verdad en el 3D en tiempo real: de pie con sus 3 m en
// el pasillo central, la cabeza doblada bajo el techo (tools/3d/final/tr/largo_glb.py → assets/final/tr/largo25.*).
// Solo le ilumina la linterna (la misma cuenta que las salas: el centro más brillante, el borde suave y su sombra:
// Libre3D._sombraPase); fuera del haz, negro. Quieto: solo un balanceo leve de respiración. Hace sombra (capa 1).
// =============================================================

import * as THREE from '../lib/three/three.module.min.js';
import { GLTFLoader } from '../lib/three/addons/GLTFLoader.js';

const DIR = 'assets/final/tr/';

const VS = `
uniform float uT;
uniform float uResp;
varying vec2 vUv;
varying vec3 vW;
varying vec3 vN;
void main() {
  vUv = uv;
  // (los vértices ya van en el mundo: y = altura, x = hacia la oficina es −x)
  vec3 p = position;
  float h = clamp((p.y - 1.1) / 1.85, 0.0, 1.0);
  float r = sin(uT * 1.25);
  p.x += uResp * r * 0.011 * h * h;
  p.y += uResp * (r * 0.5 + 0.5) * 0.006 * h;
  vec4 w = modelMatrix * vec4(p, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FS = `
uniform sampler2D uMap;
uniform sampler2D uNor;
uniform float uNorK;
uniform float uK;
uniform vec4 uLint;
uniform vec4 uLintDir;
uniform float uLintSuave;
uniform sampler2D uSombra;
uniform mat4 uSombraVP;
uniform float uSombraOn;
uniform float uSombraPaso;
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
// el relieve horneado (mapa de normales), con la base sacada de las derivadas (sin tangentes en el glb)
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
  vec3 c = vec3(0.0);
  if (uLint.w > 0.0) {
    vec3 d = vW - uLint.xyz;
    float l = length(d);
    vec3 rayo = d / max(l, 0.001);
    float ca = dot(rayo, uLintDir.xyz);
    float wOut = uLintSuave > 0.0 ? cos(acos(uLintDir.w) * (1.0 + 0.7 * uLintSuave)) : uLintDir.w;
    float cono = smoothstep(wOut, mix(uLintDir.w, 1.0, 0.8 - 0.25 * uLintSuave), ca);
    cono = cono * cono * (0.62 + 0.38 * smoothstep(mix(uLintDir.w, 1.0, 0.55), 1.0, ca));
    vec3 n0 = normalize(gl_FrontFacing ? vN : -vN);
    vec3 n = perturba(n0, vW, vUv);
    float lam = max(dot(n, -rayo), 0.0);
    float at = cono * (0.12 + 0.88 * lam) / (1.0 + l * l * 0.03) * sombraLint(vW + n0 * 0.035);
    vec3 luz = alb * uK * uLint.w * at;
    // un brillo húmedo pequeño (la piel, los dientes)
    vec3 h = normalize(-rayo + normalize(cameraPosition - vW));
    luz += vec3(0.9, 0.88, 0.82) * pow(max(dot(n, h), 0.0), 36.0) * 0.05 * uLint.w * at * uK;
    c = (vec3(1.0) - exp(-luz * 1.15)) * 0.82;
  }
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Largo3D {
  /** L: el Libre3D; o: { K (su luz con la linterna), RELIEVE, COLOR_MAX } */
  constructor(L, o = {}) {
    this.L = L;
    this.o = o;
    this.listo = false;
    this.t = 0;
    this.uT = { value: 0 };
    this.uResp = { value: 1 };
    this.promesa = Promise.all([
      new Promise((ok, mal) => new GLTFLoader().load(`${DIR}largo25.glb`, ok, undefined, mal)),
      L._tex('largo25_color.webp', o.COLOR_MAX ?? 4096, true),
      L._tex('largo25_normal.webp', 2048, false),
      fetch(`${DIR}largo25.json`).then((r) => r.json()),
    ]).then(([gltf, color, nor, info]) => {
      if (this.parado) return null;
      this.info = info;
      this.mat = new THREE.ShaderMaterial({
        vertexShader: VS, fragmentShader: FS, side: THREE.DoubleSide,
        uniforms: {
          uMap: { value: color }, uNor: { value: nor }, uNorK: { value: o.RELIEVE ?? 0.8 }, uK: { value: o.K ?? 0.1 },
          uT: this.uT, uResp: this.uResp,
          uLint: L.uLint, uLintDir: L.uLintDir, uLintSuave: L.uLintSuave,
          uSombra: L.uSombra, uSombraVP: L.uSombraVP, uSombraOn: L.uSombraOn, uSombraPaso: L.uSombraPaso,
        },
      });
      this.grupo = new THREE.Group();
      gltf.scene.traverse((m) => {
        if (!m.isMesh) return;
        m.material = this.mat;
        m.frustumCulled = false;
        m.layers.enable(1);          // (hace sombra: el pase de sombras de Libre3D dibuja la capa 1)
      });
      this.grupo.add(gltf.scene);
      this.grupo.visible = false;
      L.escena.add(this.grupo);
      // (preparar ya su shader y sus texturas: si no, el primer fotograma en que se le ve se atasca)
      try {
        L.r.initTexture?.(color);
        L.r.initTexture?.(nor);
        this.grupo.visible = true;
        L.r.compile(L.escena, L.cam);
      } catch (e) { /* se preparará al verle */ }
      this.grupo.visible = false;
      this.listo = true;
      return this;
    }).catch((e) => {
      this.fallo = true;          // (Noche2_3D deja de esperarle y pone la escena de antes)
      console.warn('Vigía-7: El Largo en 3D no ha cargado', e);
      return null;
    });
  }

  get visible() { return !!this.grupo?.visible; }
  set visible(v) { if (this.grupo) this.grupo.visible = !!v; }

  /** (Blender x) dónde quedan sus pies y su cara (para apuntar la vista). */
  get pies() { return this.info ? [this.info.pies_x + (this.grupo?.position.x ?? 0), this.info.cara[1]] : null; }
  get cara() { return this.info ? [this.info.cara[0] + (this.grupo?.position.x ?? 0), this.info.cara[1], this.info.cara[2]] : null; }

  update(dt) {
    this.t += dt;
    this.uT.value = this.t;
  }

  stop() {
    this.parado = true;
    if (this.grupo) {
      this.L.escena.remove(this.grupo);
      this.grupo.traverse((m) => { if (m.isMesh) m.geometry.dispose(); });
    }
    this.mat?.uniforms.uMap.value?.dispose?.();
    this.mat?.uniforms.uNor.value?.dispose?.();
    this.mat?.dispose();
    this.grupo = null;
    this.listo = false;
  }
}
