// =============================================================
// RestosInterior.js — (v1.58, el usuario: «la explosión debería tener un poco más de realismo, que salgan algunos
// elementos característicos del interior de la nave») Lo de dentro de la VIGIA-7, saliendo al vacío:
//   · en la cadena, cada módulo que revienta se vacía: el aire sale en chorro y se congela (vapor y cristales), y por la
//     brecha salen los muebles de ESA sala (las cápsulas de la Criogenia, las camillas de la Enfermería…);
//   · con el reactor, una nube de muebles, vigas y trozos de pared a la deriva;
//   · (finales 1 y 3) unos pocos llegan hasta la nave y pasan junto al parabrisas, donde se reconocen.
// Modelos: tools/3d/final/tr/restos_interior.py → assets/final/tr/restos_interior.*. Valores: NIGHT7.FINAL.LIBRE.FINAL4.RESTOS.
// =============================================================

import * as THREE from '../lib/three/three.module.min.js';
import { GLTFLoader } from '../lib/three/addons/GLTFLoader.js';
import { NIGHT7 } from '../night/night7.js';

const KF = NIGHT7.FINAL.LIBRE.FINAL4;
const KR = KF.RESTOS;
const DIR = 'assets/final/tr/';
const azar = (a, b) => a + Math.random() * (b - a);
const elige = (l) => l[Math.floor(Math.random() * l.length)];
const dirAzar = (planoY = 1) => new THREE.Vector3(Math.random() - 0.5, (Math.random() - 0.5) * planoY, Math.random() - 0.5).normalize();

const VS = `
attribute float _emit;
attribute vec3 color;
varying vec3 vC;
varying vec3 vN;
varying vec3 vW;
varying vec3 vV;
varying float vE;
void main() {
  vC = color;
  vE = _emit;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vV = normalize(cameraPosition - w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FS = `
uniform vec3 uSol;
uniform vec3 uNucleo;
uniform float uLuz;      // el fogonazo del reactor, que les da de lleno
uniform float uCalor;    // al rojo por los bordes, y se enfría
uniform float uQuema;    // el metal, ennegrecido
uniform float uEnc;      // lo que aún brilla (pantallas, la expendedora), que falla y se apaga
varying vec3 vC;
varying vec3 vN;
varying vec3 vW;
varying vec3 vV;
varying float vE;
void main() {
  vec3 n = normalize(vN);
  // el sol, duro, de un lado: en el vacío la cara a la sombra casi no se ve (solo el reflejo del planeta, azulado)
  float sol = max(0.0, dot(n, uSol));
  vec3 c = vC * (sol * vec3(2.0, 1.92, 1.8) + vec3(0.035, 0.05, 0.08) * (0.6 + 0.4 * max(0.0, -n.y)));
  c *= 1.0 - 0.72 * uQuema;
  // el brillo del metal
  vec3 h = normalize(uSol + normalize(vV));
  c += vec3(0.5) * pow(max(0.0, dot(n, h)), 40.0) * sol * (1.0 - uQuema);
  float nuc = max(0.0, dot(n, normalize(uNucleo - vW)));
  c += vC * vec3(3.0, 2.3, 1.7) * nuc * uLuz;
  float borde = pow(1.0 - abs(dot(n, normalize(vV))), 2.5);
  c += vec3(2.4, 0.62, 0.1) * uCalor * (0.08 + 1.6 * borde);
  c += vC * vE * uEnc;
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class RestosInterior {
  constructor(final4) {
    this.f = final4;
    this.L = final4.L;
    this.geo = {};
    this.porMod = {};
    this.vivos = [];
    this.plan = [];
    this.chorros = [];
    this.listo = false;
  }

  carga() {
    if (this.prom) return this.prom;
    this.prom = Promise.all([
      new Promise((ok, mal) => new GLTFLoader().load(`${DIR}restos_interior.glb`, ok, undefined, mal)),
      fetch(`${DIR}restos_interior.json`).then((r) => r.json()),
    ]).then(([gltf, info]) => {
      gltf.scene.traverse((o) => {
        if (o.isMesh) this.geo[o.name.replace(/^r_/, '')] = o.geometry;
      });
      for (const r of info.restos) for (const m of r.mods) (this.porMod[m] ??= []).push(r.tipo);
      this.matBase = new THREE.ShaderMaterial({
        vertexShader: VS, fragmentShader: FS,
        uniforms: { uSol: { value: new THREE.Vector3(...KF.SOL).normalize() }, uNucleo: { value: new THREE.Vector3() },
          uLuz: { value: 0 }, uCalor: { value: 0 }, uQuema: { value: 0 }, uEnc: { value: 1 } },
      });
      this._vapor();
      this.listo = true;
      return this;
    }).catch((e) => {
      console.warn('Final4: sin los restos del interior', e);
      return null;
    });
    return this.prom;
  }

  /** El aire de dentro al salir: vapor que se congela, en puntos blancos azulados. */
  _vapor() {
    const N = KR.VAPOR;
    this.vaP = new Float32Array(N * 3);
    this.vaV = new Float32Array(N * 3);
    this.vaT = new Float32Array(N * 2).fill(-99);
    this.nVa = 0;
    const g = new THREE.BufferGeometry();
    this.aVaPos = new THREE.BufferAttribute(new Float32Array(N * 3), 3);
    this.aVaCol = new THREE.BufferAttribute(new Float32Array(N * 3), 3);
    g.setAttribute('position', this.aVaPos);
    g.setAttribute('color', this.aVaCol);
    this.vapor = new THREE.Points(g, new THREE.PointsMaterial({ size: KR.VAPOR_TAM, sizeAttenuation: true, vertexColors: true,
      map: this.f.texBrillo, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
    this.vapor.frustumCulled = false;
    this.vapor.visible = false;
    this.L.escena.add(this.vapor);
  }

  /** Lo prepara todo para este final (se llama al montar la escena; si aún no ha cargado, se apunta cuando cargue). */
  planea(cadena, tReactor, errante, nucleo) {
    this.limpia();
    if (!KR?.USAR) return;
    if (!this.listo) {
      this.carga()?.then(() => this.listo && this.planea(cadena, tReactor, errante, nucleo));
      return;
    }
    this.tR = tReactor;
    this.nucleo = nucleo;
    this.matBase.uniforms.uNucleo.value.copy(nucleo);
    this.vapor.visible = true;
    this.vaT.fill(-99);
    // la cadena: cada sala, sus muebles y su chorro de aire
    for (const q of cadena) {
      if (q.m === 'reactor' || q.t >= tReactor) continue;
      const tipos = this.porMod[q.m];
      if (!tipos) continue;
      const pieza = () => {
        const c = elige(q.ps).c;
        return new THREE.Vector3(c[0], c[2], -c[1]);
      };
      for (let k = 0; k < KR.CHORROS; k++) {
        const p = pieza();
        const sale = p.clone().sub(q.c).setY((p.y - q.c.y) * 0.4 + azar(-1.5, 1.5)).normalize();
        this.chorros.push({ p, d: sale, t0: q.t + azar(0.05, 0.5), hasta: q.t + azar(KR.CHORRO_S[0], KR.CHORRO_S[1]), resto: 0 });
      }
      const n = KR.POR_MODULO[0] + Math.floor(Math.random() * (KR.POR_MODULO[1] - KR.POR_MODULO[0] + 1));
      for (let k = 0; k < n; k++) {
        const p = pieza();
        const sale = p.clone().sub(q.c).setY(azar(-3, 3)).normalize();
        this.plan.push({ t0: q.t + azar(0.25, 1.6), tipo: tipos[k % tipos.length], p, v: sale.multiplyScalar(azar(KR.VEL[0], KR.VEL[1])), calor: azar(0.05, 0.3) });
      }
      this.plan.push({ t0: q.t + azar(0.1, 0.6), tipo: 'panel', p: pieza(), v: dirAzar(0.5).multiplyScalar(azar(KR.VEL[0], KR.VEL[1])), calor: azar(0.25, 0.6) });
    }
    if (errante) {
      this.plan.sort((a, b) => a.t0 - b.t0);
      return;
    }
    // el reactor: la nube de restos
    const todos = Object.keys(this.geo);
    for (let k = 0; k < KR.FLOTA; k++) {
      const d = dirAzar(0.7);
      const pesado = ['viga', 'panel', 'tubos', 'compuerta'];
      const tipo = k % 2 ? elige(pesado) : elige(todos);
      this.plan.push({ t0: tReactor + azar(0.02, 0.4), tipo, p: nucleo.clone().addScaledVector(d, azar(10, 46)),
        v: d.clone().multiplyScalar(azar(KR.VEL_REACTOR[0], KR.VEL_REACTOR[1])), calor: azar(0.25, 0.9), quema: azar(0.4, 0.85) });
    }
    // los que pasan junto al parabrisas (uno a uno, para que se reconozcan)
    for (const u of KR.PASAN) {
      this.plan.push({ t0: tReactor + 0.05, tipo: u.tipo, pasa: { tPasa: tReactor + u.t, vel: u.vel, x: u.x, y: u.y, giro: u.giro, choca: u.choca },
        calor: 0.3, quema: u.quema ?? 0.25, luces: u.luces ?? 0 });
    }
    this.plan.sort((a, b) => a.t0 - b.t0);
  }

  _crea(d, t) {
    const geo = this.geo[d.tipo];
    if (!geo) return;
    const mat = this.matBase.clone();
    mat.uniforms.uNucleo.value.copy(this.nucleo);
    mat.uniforms.uSol = this.matBase.uniforms.uSol;
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    m.position.copy(d.p ?? this.nucleo);
    m.quaternion.setFromEuler(new THREE.Euler(azar(0, 6.3), azar(0, 6.3), azar(0, 6.3)));
    this.L.escena.add(m);
    this.vivos.push({ m, t0: t, v: d.v ?? new THREE.Vector3(), pasa: d.pasa ?? null, calor: d.calor, enfria: azar(0.9, 2.4), quema: d.quema ?? 0.1,
      eje: dirAzar(), giro: d.pasa?.giro ?? azar(-1, 1) * KR.GIRO, luces: d.luces ?? azar(0.4, 3.0), fase: azar(0, 9) });
  }

  _soltarVapor(p, d, n, vel, vida, t) {
    const N = this.vaT.length / 2;
    for (let k = 0; k < n; k++) {
      const i = this.nVa++ % N;
      const v = d.clone().addScaledVector(dirAzar(), 0.28).normalize().multiplyScalar(vel * azar(0.55, 1.25));
      this.vaP.set([p.x, p.y, p.z], i * 3);
      this.vaV.set([v.x, v.y, v.z], i * 3);
      this.vaT[i * 2] = t;
      this.vaT[i * 2 + 1] = vida * azar(0.5, 1.2);
    }
  }

  update(t, dt) {
    if (!this.listo || !KR?.USAR) return;
    const L = this.L;
    while (this.plan.length && this.plan[0].t0 <= t) this._crea(this.plan.shift(), t);
    for (const c of this.chorros) {
      if (t < c.t0 || t > c.hasta) continue;
      c.resto += dt * KR.VAPOR_S;
      const n = Math.floor(c.resto);
      if (n) {
        c.resto -= n;
        const k = 1 - (t - c.t0) / (c.hasta - c.t0);   // (se va quedando sin aire)
        this._soltarVapor(c.p, c.d, n, KR.VAPOR_VEL * (0.35 + 0.65 * k), KR.VAPOR_VIDA, t);
      }
    }
    // los puntos del vapor
    const N = this.vaT.length / 2, P = this.aVaPos.array, C = this.aVaCol.array;
    for (let i = 0; i < N; i++) {
      const s = t - this.vaT[i * 2], vida = this.vaT[i * 2 + 1];
      if (s < 0 || s > vida) {
        C[i * 3] = C[i * 3 + 1] = C[i * 3 + 2] = 0;
        P[i * 3 + 1] = -1e5;
        continue;
      }
      const e = s / vida, b = (1 - e) * (1 - e) * KR.VAPOR_K;
      for (let k = 0; k < 3; k++) P[i * 3 + k] = this.vaP[i * 3 + k] + this.vaV[i * 3 + k] * s;
      C[i * 3] = 0.72 * b; C[i * 3 + 1] = 0.84 * b; C[i * 3 + 2] = 1.0 * b;
    }
    this.aVaPos.needsUpdate = this.aVaCol.needsUpdate = true;
    // los restos
    const luz = t >= this.tR ? 3.0 * Math.exp(-(t - this.tR) / 0.8) : 0;
    const cp = L.cam.getWorldPosition(new THREE.Vector3());
    const dq = new THREE.Quaternion();
    for (let i = this.vivos.length - 1; i >= 0; i--) {
      const r = this.vivos[i], e = t - r.t0, U = r.m.material.uniforms;
      r.m.quaternion.multiply(dq.setFromAxisAngle(r.eje, r.giro * dt));
      if (r.pasa) {
        // relativo a la cámara: viene de la estación, crece y sale por un lado (pase lo que pase con la nave)
        const a = this.nucleo.clone().sub(cp).normalize();
        const der = a.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
        const arr = der.clone().cross(a);
        const z = r.pasa.vel * (r.pasa.tPasa - t);
        if (r.pasa.choca && z < 8 && !r.golpe) {
          r.golpe = true;
          L.sacude = Math.max(L.sacude ?? 0, KR.GOLPE);
          this.f._son('final/temblor', { volume: 0.4, pitch: 1.5 });
        }
        if (z < KR.PASA_FIN) {
          L.escena.remove(r.m);
          r.m.material.dispose();
          this.vivos.splice(i, 1);
          continue;
        }
        r.m.position.copy(cp).addScaledVector(a, z).addScaledVector(der, r.pasa.x).addScaledVector(arr, r.pasa.y);
      } else {
        r.m.position.addScaledVector(r.v, dt);
      }
      U.uLuz.value = luz;
      U.uCalor.value = r.calor * Math.exp(-e / r.enfria) * Math.min(1, e * 8);
      U.uQuema.value = r.quema;
      // lo que aún tiene corriente: parpadea y se apaga
      U.uEnc.value = e < r.luces ? (Math.sin(t * 37 + r.fase) > -0.7 ? 1 : 0.15) : 0;
    }
  }

  limpia() {
    for (const r of this.vivos) {
      this.L.escena.remove(r.m);
      r.m.material.dispose();
    }
    this.vivos.length = 0;
    this.plan.length = 0;
    this.chorros.length = 0;
    if (this.vapor) this.vapor.visible = false;
  }
}
