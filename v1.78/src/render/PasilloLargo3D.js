// =============================================================
// PasilloLargo3D.js — (v1.78, el usuario: «la criatura del pasillo como modelo 3D con volumen, iluminado por la linterna
// con sus sombras (sin fantasma ni borrosidad)»; «el haz con el centro más brillante y el borde suave, que ilumina las
// superficies con su relieve y no las pinta de blanco»; «el jumpscare: que el enemigo se acerque desde el pasillo y
// llene el encuadre sin cortarse») EL PASILLO CENTRAL DE LA VISTA DE ATRÁS, EN 3D:
//   · El pasillo es el MISMO render (la misma escena y cámara que la oficina), pero con su color, su normal y su
//     profundidad sacados de Blender (tools/3d/salas/pasillo_puerta.py --que=pases → assets/salas/unica/pasillo/
//     pasillo_albedo/normal/prof.png): la linterna lo alumbra de verdad desde la mano hacia donde apuntas (con su
//     relieve, el centro más brillante y el borde suave: la campana de linternaGLSL.js) encima del pasillo a oscuras.
//   · El Largo es su modelo (pasillo_puerta.py --que=glb → assets/final/tr/largo_pas_<pos>.glb + el atlas de color y
//     relieve): en cada una de sus posiciones, tapado por el marco de verdad (la profundidad del render), iluminado solo
//     por la linterna y echando su sombra en el pasillo. Sin luz no se le ve (la norma de las fases con linterna).
//   · El susto (susto(t)): sale del hueco y se te echa encima hasta llenar la pantalla con la cabeza entera, con un
//     golpe de cámara. A la resolución de la pantalla, con la misma luz.
// La mecánica no cambia: dónde está, cuándo se asoma y si le da la luz siguen en Night3Events / AsomaPuerta / Flashlight.
// =============================================================

import * as THREE from '../lib/three/three.module.min.js';
import { GLTFLoader } from '../lib/three/addons/GLTFLoader.js';
import { CONFIG } from '../config.js';

const W = CONFIG.WIDTH, H = CONFIG.HEIGHT;
const DIR_P = 'assets/salas/unica/pasillo/';
const DIR_L = 'assets/final/tr/';
export const POSES_LARGO = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'asoma'];

// la cámara de la vista de atrás (oficina_v2.py / pasillo_puerta.py): en el centro de la oficina, ojos a 1,7 m, 90°,
// mirando hacia el pasillo (+x de Blender). En three: (x, z, −y)
const OJO = new THREE.Vector3(90.0, 1.7, 45.0);
const FWD = new THREE.Vector3(1, 0, 0), DER = new THREE.Vector3(0, 0, 1), ARR = new THREE.Vector3(0, 1, 0);
const F = 800;                            // px de distancia focal (90° en 1600 px)
// la linterna, en la mano (abajo a la derecha de los ojos: pasillo_puerta.py LINTERNA)
const MANO = new THREE.Vector3(90.35, 1.42, 45.3);

export const PASILLO3D = {
  FUERZA: 34,          // (la de las noches en 3D)
  K: 0.1,              // la luz de la linterna sobre lo que alumbra (× FUERZA)
  BORDE: 1.15,         // el borde del haz respecto al círculo de la linterna 2D (la campana se apaga más allá)
  LARGO_VE: 4.0,       // lo que hace falta de luz para verle entero (sin luz, nada)
  APAGON: 0.22,        // el pasillo a oscuras en el apagón (× el de siempre)
  SUSTO: { POSE: 'p4', LLEGA: 0.5, CARA_D: 0.62, CARA_Z: 1.66, TEMBLOR: 0.035, EMPUJE: 0.1 },
};

const tres = (b) => new THREE.Vector3(b[0], b[2], -b[1]);

const LINT = `
uniform vec4 uLint;      // la mano (xyz) y la fuerza (w)
uniform vec4 uLintDir;   // hacia dónde (xyz) y el coseno del borde (w)
float conoLint(vec3 rayo) {
  float x = acos(clamp(dot(rayo, uLintDir.xyz), -1.0, 1.0)) / acos(uLintDir.w);
  if (x >= 1.0) return 0.0;
  float q = 1.0 - x * x;
  return q * q * (0.45 + 0.55 * exp(-6.0 * x * x));
}
vec3 tonoLint(vec3 luz) { return luz / (vec3(1.0) + luz * 0.85); }
`;

const SOMBRA = `
uniform sampler2D uSombra;
uniform mat4 uSombraVP;
uniform float uSombraOn;
uniform float uSombraPaso;
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
    s += q.z - 0.0015 > d ? 0.0 : 1.0;
  }
  return s / 9.0;
}
`;

// el pasillo: un rectángulo que cubre lo que se dibuja; cada píxel saca de las pasadas su color, su normal y dónde está
const VS_PLACA = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FS_PLACA = `
uniform sampler2D uAlb;
uniform sampler2D uNor;
uniform sampler2D uProf;
uniform sampler2D uOsc;
uniform vec4 uVista;     // lo que se dibuja (px de la pantalla): x, y, w, h
uniform vec4 uRect;      // el recuadro de las pasadas
uniform vec4 uHueco;     // el hueco de la compuerta
uniform vec3 uCam;
uniform vec3 uFwd;
uniform vec3 uDer;
uniform vec3 uArr;
uniform float uNear;
uniform float uFar;
uniform float uK;
uniform float uSoloProf;  // (el susto: solo tapa, no pinta)
uniform float uOscK;      // (el apagón: el pasillo a oscuras, aún más oscuro: ya no le llega la luz de la oficina)
${LINT}
${SOMBRA}
varying vec2 vUv;
void main() {
  vec2 px = uVista.xy + vec2(vUv.x, 1.0 - vUv.y) * uVista.zw;
  vec2 r = (px - uRect.xy) / uRect.zw;
  if (r.x < 0.0 || r.x > 1.0 || r.y < 0.0 || r.y > 1.0) { gl_FragDepth = 1.0; gl_FragColor = vec4(0.0); return; }
  vec2 uvR = vec2(r.x, 1.0 - r.y);
  vec3 b = floor(texture2D(uProf, uvR).rgb * 255.0 + 0.5);
  float z = (b.r * 65536.0 + b.g * 256.0 + b.b) / 1000.0;
  if (z <= 0.01) z = uFar * 0.99;
  float nd = (uFar + uNear - 2.0 * uNear * uFar / z) / (uFar - uNear);
  gl_FragDepth = clamp(nd * 0.5 + 0.5, 0.0, 1.0);
  bool dentro = px.x >= uHueco.x && px.x <= uHueco.x + uHueco.z && px.y >= uHueco.y && px.y <= uHueco.y + uHueco.w;
  if (!dentro || uSoloProf > 0.5) { gl_FragColor = vec4(0.0); return; }
  vec2 s = vec2((px.x - 800.0) / 800.0, -(px.y - 450.0) / 800.0);
  vec3 P = uCam + uFwd * z + uDer * (s.x * z) + uArr * (s.y * z);
  vec3 nb = texture2D(uNor, uvR).rgb * 2.0 - 1.0;
  vec3 n = normalize(vec3(nb.x, nb.z, -nb.y));
  vec3 alb = pow(texture2D(uAlb, uvR).rgb, vec3(2.2));
  vec2 uvH = vec2((px.x - uHueco.x) / uHueco.z, 1.0 - (px.y - uHueco.y) / uHueco.w);
  vec3 osc = pow(texture2D(uOsc, uvH).rgb, vec3(2.2)) * uOscK;
  vec3 luz = vec3(0.0);
  if (uLint.w > 0.0) {
    vec3 d = P - uLint.xyz;
    float l = length(d);
    vec3 rayo = d / max(l, 0.001);
    float lam = max(dot(n, -rayo), 0.0);
    float at = conoLint(rayo) * (0.15 + 0.85 * lam) / (1.0 + l * l * 0.03) * sombraLint(P + n * 0.03);
    luz = alb * uK * uLint.w * at;
  }
  vec3 c = osc + tonoLint(luz);
  gl_FragColor = vec4(pow(c, vec3(1.0 / 2.2)), 1.0);
}`;

// El Largo: su atlas (color con la oclusión y relieve), solo con la linterna; sin luz, transparente (no se le ve)
const VS_LARGO = `
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
const FS_LARGO = `
uniform sampler2D uMap;
uniform sampler2D uNor;
uniform float uK;
uniform float uVe;
uniform float uSiempre;   // (el susto: se le ve aunque el haz no le dé de lleno)
${LINT}
varying vec2 vUv;
varying vec3 vW;
varying vec3 vN;
vec3 perturba(vec3 n, vec3 pos, vec2 uv) {
  vec3 q0 = dFdx(pos), q1 = dFdy(pos);
  vec2 st0 = dFdx(uv), st1 = dFdy(uv);
  vec3 q1p = cross(q1, n), q0p = cross(n, q0);
  vec3 T = q1p * st0.x + q0p * st1.x;
  vec3 B = q1p * st0.y + q0p * st1.y;
  float det = max(dot(T, T), dot(B, B));
  float sc = det == 0.0 ? 0.0 : inversesqrt(det);
  vec3 m = texture2D(uNor, uv).xyz * 2.0 - 1.0;
  m.xy *= 0.8;
  return normalize(T * (m.x * sc) + B * (m.y * sc) + n * m.z);
}
void main() {
  vec3 alb = pow(texture2D(uMap, vUv).rgb, vec3(2.2));
  vec3 n0 = normalize(gl_FrontFacing ? vN : -vN);
  vec3 n = perturba(n0, vW, vUv);
  vec3 d = vW - uLint.xyz;
  float l = length(d);
  vec3 rayo = d / max(l, 0.001);
  float cono = uLint.w > 0.0 ? conoLint(rayo) : 0.0;
  cono = max(cono, uSiempre * 0.55);
  float lam = max(dot(n, -rayo), 0.0);
  float at = cono * (0.12 + 0.88 * lam) / (1.0 + l * l * 0.03) * max(uLint.w, uSiempre * 34.0);
  vec3 luz = alb * uK * at;
  vec3 h = normalize(-rayo + normalize(cameraPosition - vW));
  luz += vec3(0.9, 0.88, 0.82) * pow(max(dot(n, h), 0.0), 36.0) * 0.05 * at * uK;
  // (opaco donde le llega algo de luz: sin el «fantasma» de antes; donde no le llega nada, no se le ve)
  float a = (uLint.w > 0.0 || uSiempre > 0.5) ? smoothstep(0.0, 0.025 / uVe * 4.0, cono) : 0.0;
  gl_FragColor = vec4(pow(tonoLint(luz), vec3(1.0 / 2.2)), a);
}`;

export class PasilloLargo3D {
  constructor() {
    this.listo = false;
    this.mallas = {};
    this.vista = null;
    this.promesa = this._carga().catch((e) => {
      this.fallo = true;
      console.warn('Vigía-7: el pasillo en 3D no ha cargado (se usa el de siempre)', e);
    });
  }

  async _carga() {
    const datos = await fetch(`${DIR_P}pasillo.json`).then((r) => r.json());
    const tl = new THREE.TextureLoader();
    const tex = (src, color) => new Promise((ok, mal) => tl.load(src, (t) => {
      t.colorSpace = THREE.NoColorSpace;
      t.generateMipmaps = false;
      t.minFilter = t.magFilter = color ? THREE.LinearFilter : THREE.NearestFilter;
      ok(t);
    }, undefined, mal));
    const [alb, nor, prof, osc, lcol, lnor] = await Promise.all([
      tex(`${DIR_P}pasillo_albedo.png`, true), tex(`${DIR_P}pasillo_normal.png`, false), tex(`${DIR_P}pasillo_prof.png`, false),
      tex(`${DIR_P}oscuro.webp`, true), tex(`${DIR_L}largo_pas_color.webp`, true), tex(`${DIR_L}largo_pas_normal.webp`, true),
    ]);
    // (las texturas de un glb van sin voltear: el atlas de El Largo)
    for (const t of [lcol, lnor]) {
      t.flipY = false;
      t.needsUpdate = true;
    }
    lcol.generateMipmaps = true;
    lcol.minFilter = THREE.LinearMipmapLinearFilter;
    const gl = new GLTFLoader();
    const glbs = await Promise.all(POSES_LARGO.map((p) => new Promise((ok) => gl.load(`${DIR_L}largo_pas_${p}.glb`, ok, undefined, () => ok(null)))));
    this.datos = datos;
    const [rx, ry, rw, rh] = datos.rect;
    const [hx, hy, hw, hh] = datos.hueco;
    this.rect = { x: rx, y: ry, w: rw, h: rh };
    // el lienzo: el recuadro del pasillo (y la pantalla entera para el susto)
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    const r = this.r = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, premultipliedAlpha: false,
      preserveDrawingBuffer: true });
    r.setPixelRatio(1);
    r.setSize(W, H, false);
    r.setClearColor(0x000000, 0);
    r.autoClear = true;
    this.escena = new THREE.Scene();
    const vfov = THREE.MathUtils.radToDeg(2 * Math.atan(H / 2 / F));
    this.cam = new THREE.PerspectiveCamera(vfov, W / H, 0.1, 80);
    this.cam.position.copy(OJO);
    this.cam.lookAt(OJO.clone().add(FWD));
    this.cam.updateMatrixWorld();
    // la sombra de la linterna (lo que la tapa: El Largo)
    this.sombra = {
      rt: new THREE.WebGLRenderTarget(1024, 1024),
      cam: new THREE.PerspectiveCamera(40, 1, 0.2, 40),
      mat: new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }),
    };
    this.sombra.cam.layers.set(1);
    this.uLint = { value: new THREE.Vector4(0, 0, 0, 0) };
    this.uLintDir = { value: new THREE.Vector4(1, 0, 0, 0.95) };
    this.uSombra = { value: this.sombra.rt.texture };
    this.uSombraVP = { value: new THREE.Matrix4() };
    this.uSombraOn = { value: 0 };
    this.uSombraPaso = { value: 1.6 / 1024 };
    const comun = { uLint: this.uLint, uLintDir: this.uLintDir, uSombra: this.uSombra, uSombraVP: this.uSombraVP,
      uSombraOn: this.uSombraOn, uSombraPaso: this.uSombraPaso };
    this.uVista = { value: new THREE.Vector4(0, 0, W, H) };
    this.uSoloProf = { value: 0 };
    this.uOscK = { value: 1 };
    this.matPlaca = new THREE.ShaderMaterial({
      vertexShader: VS_PLACA, fragmentShader: FS_PLACA, depthTest: false, depthWrite: true,
      uniforms: {
        ...comun, uAlb: { value: alb }, uNor: { value: nor }, uProf: { value: prof }, uOsc: { value: osc },
        uVista: this.uVista, uRect: { value: new THREE.Vector4(rx, ry, rw, rh) }, uHueco: { value: new THREE.Vector4(hx, hy, hw, hh) },
        uCam: { value: OJO.clone() }, uFwd: { value: FWD.clone() }, uDer: { value: DER.clone() }, uArr: { value: ARR.clone() },
        uNear: { value: this.cam.near }, uFar: { value: this.cam.far }, uK: { value: PASILLO3D.K }, uSoloProf: this.uSoloProf,
        uOscK: this.uOscK,
      },
    });
    this.placa = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.matPlaca);
    this.placa.frustumCulled = false;
    this.placa.renderOrder = -1;
    this.escena.add(this.placa);
    this.uSiempre = { value: 0 };
    this.matLargo = new THREE.ShaderMaterial({
      vertexShader: VS_LARGO, fragmentShader: FS_LARGO, transparent: true, side: THREE.DoubleSide,
      uniforms: { ...comun, uMap: { value: lcol }, uNor: { value: lnor }, uK: { value: PASILLO3D.K }, uVe: { value: PASILLO3D.LARGO_VE },
        uSiempre: this.uSiempre },
    });
    POSES_LARGO.forEach((p, i) => {
      const g = glbs[i];
      if (!g) return;
      const grupo = new THREE.Group();
      g.scene.traverse((m) => {
        if (!m.isMesh) return;
        m.material = this.matLargo;
        m.frustumCulled = false;
        m.layers.enable(1);
      });
      grupo.add(g.scene);
      grupo.visible = false;
      this.escena.add(grupo);
      this.mallas[p] = grupo;
    });
    this.caras = Object.fromEntries(POSES_LARGO.map((p) => [p, datos.glb?.[p]?.cara ?? null]));
    this.listo = Object.keys(this.mallas).length > 0;
  }

  /** La linterna: desde la mano hacia el píxel (mx, my); radio: el del círculo de la linterna 2D (px). */
  _linterna(on, mx, my, radio, fuerza = 1) {
    if (!on) {
      this.uLint.value.w = 0;
      this.uSombraOn.value = 0;
      return;
    }
    const s = new THREE.Vector3().copy(FWD).addScaledVector(DER, (mx - 800) / F).addScaledVector(ARR, -(my - 450) / F).normalize();
    const mira = OJO.clone().addScaledVector(s, 9);
    const dir = mira.sub(MANO).normalize();
    const ang = Math.atan((radio * PASILLO3D.BORDE) / F);
    this.uLint.value.set(MANO.x, MANO.y, MANO.z, PASILLO3D.FUERZA * fuerza);
    this.uLintDir.value.set(dir.x, dir.y, dir.z, Math.cos(ang));
    // la sombra: lo que se ve desde la linterna (solo El Largo, capa 1)
    const S = this.sombra;
    S.cam.position.copy(MANO);
    S.cam.lookAt(MANO.clone().add(dir));
    S.cam.fov = THREE.MathUtils.radToDeg(ang) * 2 + 8;
    S.cam.updateProjectionMatrix();
    S.cam.updateMatrixWorld();
    const ov = this.escena.overrideMaterial;
    this.escena.overrideMaterial = S.mat;
    this.placa.visible = false;
    this.r.setRenderTarget(S.rt);
    this.r.setClearColor(0xffffff, 1);
    this.r.clear();
    this.r.render(this.escena, S.cam);
    this.r.setRenderTarget(null);
    this.r.setClearColor(0x000000, 0);
    this.escena.overrideMaterial = ov;
    this.placa.visible = true;
    this.uSombraVP.value.multiplyMatrices(S.cam.projectionMatrix, S.cam.matrixWorldInverse);
    this.uSombraOn.value = 1;
  }

  _muestra(pos) {
    for (const [p, g] of Object.entries(this.mallas)) g.visible = p === pos;
  }

  /**
   * El pasillo de la vista de atrás: pinta en ctx el recuadro del pasillo (el hueco con su luz y El Largo, con lo que
   * sale por delante del marco). o: { on, mx, my, radio, fuerza, largo (su posición o null) }.
   */
  draw(ctx, o) {
    if (!this.listo) return false;
    const R = this.rect;
    this.cam.clearViewOffset();
    this.cam.setViewOffset(W, H, R.x, R.y, R.w, R.h);
    this.cam.updateProjectionMatrix();
    this.r.setViewport(0, H - R.h, R.w, R.h);
    this.uVista.value.set(R.x, R.y, R.w, R.h);
    this.uSoloProf.value = 0;
    this.uSiempre.value = 0;
    this.uOscK.value = o.apagon ? PASILLO3D.APAGON : 1;
    for (const g of Object.values(this.mallas)) g.position.set(0, 0, 0);
    this._muestra(o.largo);
    this._linterna(o.on, o.mx, o.my, o.radio, o.fuerza ?? 1);
    this.r.setViewport(0, H - R.h, R.w, R.h);
    this.r.render(this.escena, this.cam);
    ctx.drawImage(this.canvas, 0, 0, R.w, R.h, R.x, R.y, R.w, R.h);
    return true;
  }

  /**
   * (v1.78) El susto de El Largo desde el pasillo: t (s desde que empieza). Él sale del hueco (asomado) y se te echa
   * encima hasta que la cabeza entera llena la pantalla (CARA_D m delante de la cámara), con la linterna en la cara y un
   * golpe de cámara. Encima de lo que haya en ctx (la vista de atrás).
   */
  drawSusto(ctx, t) {
    if (!this.listo) return false;
    const S = PASILLO3D.SUSTO;
    // (la de cerca, encorvado y con la cara hacia ti: la que se te echa encima)
    const pos = this.mallas[S.POSE] ? S.POSE : Object.keys(this.mallas).pop();
    const g = this.mallas[pos];
    const cara0 = this.caras[pos] ? tres(this.caras[pos]) : new THREE.Vector3(95.0, 2.4, 45.0);
    const meta = new THREE.Vector3(OJO.x + S.CARA_D, S.CARA_Z, OJO.z);
    const k = Math.min(1, t / S.LLEGA);
    const e = k < 1 ? k * k * (3 - 2 * k) * (0.6 + 0.4 * k) : 1;
    // (se le echa encima: de donde tiene la cara en el hueco a delante de ti)
    const cara = cara0.clone().lerp(meta, e);
    this._muestra(pos);
    g.position.copy(cara).sub(cara0);
    // un golpe de cámara: se acerca un poco y tiembla al llegar
    const golpe = k >= 1 ? Math.max(0, 1 - (t - S.LLEGA) / 0.35) : 0;
    const tiembla = S.TEMBLOR * (0.3 * e + golpe);
    this.cam.position.set(OJO.x + S.EMPUJE * e + (Math.random() - 0.5) * tiembla * 0.3, OJO.y + (Math.random() - 0.5) * tiembla,
      OJO.z + (Math.random() - 0.5) * tiembla);
    this.cam.lookAt(this.cam.position.clone().add(FWD).add(new THREE.Vector3(0, (S.CARA_Z - OJO.y) * 0.3 * e, 0)));
    this.cam.clearViewOffset();
    this.cam.updateProjectionMatrix();
    this.cam.updateMatrixWorld();
    this.uVista.value.set(0, 0, W, H);
    this.uSoloProf.value = 1;
    this.uSiempre.value = 1;
    // la linterna en su cara
    const ox = 800 + (F * (cara.z - OJO.z)) / Math.max(0.3, cara.x - OJO.x);
    const oy = 450 - (F * (cara.y - OJO.y)) / Math.max(0.3, cara.x - OJO.x);
    this._linterna(true, ox, oy, 260, 1.2);
    this.r.setViewport(0, 0, W, H);
    this.r.render(this.escena, this.cam);
    ctx.drawImage(this.canvas, 0, 0, W, H);
    this.cam.position.copy(OJO);
    this.cam.lookAt(OJO.clone().add(FWD));
    this.cam.updateMatrixWorld();
    g.position.set(0, 0, 0);
    return true;
  }
}
