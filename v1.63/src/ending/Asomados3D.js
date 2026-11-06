// =============================================================
// Asomados3D.js — (v1.55, plan «noches 2 y 4 con movimiento libre», fase N1) Los enemigos de las noches 2 y 4
// dentro del 3D de Libre3D, con LA MISMA MECÁNICA DE LA LUZ que la 2.5 (decisión del usuario: «misma mecánica, sin
// perseguir»; valores en N2END, src/night/night2ending.js):
//   - Son la imagen de su pose (CreatureArt, las mismas que en las imágenes fijas) DE PIE en su sitio (un plano que
//     gira para mirarte), invisibles sin luz: solo se ven donde cae la linterna (con la luz de la sala casi a cero).
//   - Al aparecer hay FIND_TIME s para darles con la luz EN LA CARA (el centro del haz = el centro de la pantalla).
//   - Con la luz en la cara intentan apartarse cada EVADE_EVERY s: cambian de POSTURA (POSE_WINDOW s para volver a
//     enfocarla) o de SITIO (MOVE_WINDOW s para encontrarlos). Con RETIRE_TIME s de luz en la cara se retiran.
//   - Si no se reacciona a tiempo, atacan (onAtaca). No persiguen: no andan hacia ti.
//   - Se les oye por su lado (respiración y pasos, con el paneo según hacia dónde miras).
// =============================================================

import * as THREE from '../lib/three/three.module.min.js';
import { N2END } from '../night/night2ending.js';
import { POSES, faceOf, drawEnemy } from '../render/FirstPersonView.js';
import { setEyeShine } from '../render/CreatureArt.js';

const rand = ([a, b]) => a + Math.random() * (b - a);
const pick = (l) => l[Math.floor(Math.random() * l.length)];
// la imagen de cada enemigo: un lienzo de 512 × 1024 con los pies abajo en el centro
const CW = 512, CH = 1024, PIE_Y = CH - 14, ALTO_PX = 700;
// (v1.56, el usuario: la tabla de alturas, con el protagonista de 1,75 m como referencia)
//   El Espécimen 1,95 m (un palmo más que tú); El Largo 3 m de pie, ~2,40 m encorvado (dentro no cabe de pie);
//   El Congelado 1,80 m de pie, ~1,10 m encogido (no sale asomado en estas noches).
// ALTURA: lo que mide el cuerpo de la postura más alta (de los pies a lo más alto que se ve);
// FIG_PX: lo que ocupa esa postura en el lienzo (medido: specimen «front» 864 px; largo «stand» 699 px).
export const ALTURA = { specimen: 1.95, largo: 2.40, frozen: 1.80 };
const FIG_PX = { specimen: 864, largo: 699, frozen: 864 };
// metros que mide la imagen entera
const ALTO_M = Object.fromEntries(Object.keys(ALTURA).map((k) => [k, ALTURA[k] * CH / FIG_PX[k]]));
const SND = {
  largo: { breath: 'largo/respiracion', steps: 'largo/pasos', growl: 'largo/grunido', stepGap: 1.1 },
  specimen: { breath: 'criaturas/respiracion', steps: 'pasos/metal', growl: 'criaturas/grunido', stepGap: 0.45 },
};

const VS = `
varying vec2 vUv;
varying vec3 vW;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FS = `
uniform sampler2D uMap;
uniform vec4 uLint;
uniform vec4 uLintDir;
uniform float uBase;
uniform float uAlfa;
varying vec2 vUv;
varying vec3 vW;
void main() {
  vec4 t = texture2D(uMap, vUv);
  if (t.a < 0.04) discard;
  float l = 0.0;
  if (uLint.w > 0.0) {
    vec3 d = vW - uLint.xyz;
    float L = length(d);
    float cono = smoothstep(uLintDir.w, mix(uLintDir.w, 1.0, 0.8), dot(d / max(L, 0.001), uLintDir.xyz));
    cono *= cono;
    l = cono / (1.0 + L * L * 0.03) * uLint.w * 0.16;
  }
  float k = clamp(uBase + l, 0.0, 1.25);
  // (los ojos —lo más claro y amarillo— brillan con poca luz, como los de un gato)
  float ojo = step(0.82, t.r) * step(0.6, t.g) * step(t.b, 0.55);
  vec3 c = t.rgb * k + t.rgb * ojo * min(1.0, l * 4.0);
  gl_FragColor = vec4(c, t.a * clamp(k * 4.0, 0.0, 1.0) * uAlfa);
}`;

export class Asomados3D {
  /** libre: el Libre3D; o: { verSinLuz (0–1), tune (opcional), onAtaca(enemigo, por), alRetirarse(e) } */
  constructor(libre, o = {}) {
    this.L = libre;
    this.o = o;
    this.lista = [];
    this.t = 0;
    this.calma = 0;        // (tras retirarse uno, la linterna parpadea y no aparece ninguno)
  }

  get tune() {
    return this.o.tune ?? { find: N2END.FIND_TIME, pose: N2END.POSE_WINDOW, move: N2END.MOVE_WINDOW, retire: N2END.RETIRE_TIME };
  }

  /** Uno nuevo. sitios: [[x, y], …] (de pie, en el suelo; el primero es donde sale). */
  nuevo(enemigo, sitios, o = {}) {
    const lienzo = document.createElement('canvas');
    lienzo.width = CW;
    lienzo.height = CH;
    const tex = new THREE.CanvasTexture(lienzo);
    tex.colorSpace = THREE.SRGBColorSpace;
    const alto = ALTO_M[enemigo] ?? 2.5;
    const mat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uMap: { value: tex }, uLint: this.L.uLint, uLintDir: this.L.uLintDir,
        uBase: { value: this.o.verSinLuz ?? 0 }, uAlfa: { value: 1 } },
    });
    const malla = new THREE.Mesh(new THREE.PlaneGeometry(alto * CW / CH, alto), mat);
    malla.renderOrder = 5;
    this.L.escena.add(malla);
    const e = {
      enemigo, sitios, sitio: 0, pose: o.pose ?? pick(POSES[enemigo]), estado: 'espera',
      busca: o.busca ?? this.tune.find, luz: 0, apartaIn: rand(N2END.EVADE_EVERY), ventana: 0,
      facil: o.facil ?? null, lienzo, tex, mat, malla, alto, dibujaIn: 0, t0: this.t, respIn: rand([1.2, 2.5]),
      tag: o.tag ?? null, mudo: !!o.mudo, alTiempo: o.alTiempo ?? null, tuneE: o.tune ?? null, cambios: 0, pausa: false,
    };
    if (e.facil) e.busca = e.facil.find ?? e.busca;
    this._dibuja(e);
    this.lista.push(e);
    if (!e.mudo && !o.mudoAlEntrar) this._son(e, SND[enemigo].steps, { volume: 0.45 });
    return e;
  }

  quitaTodos() {
    for (const e of this.lista) this._quita(e);
    this.lista = [];
  }

  _quita(e) {
    this.L.escena.remove(e.malla);
    e.malla.geometry.dispose();
    e.mat.dispose();
    e.tex.dispose();
  }

  _dibuja(e) {
    const c = e.lienzo.getContext('2d');
    c.clearRect(0, 0, CW, CH);
    setEyeShine(true);
    drawEnemy(c, e.enemigo, e.pose, CW / 2, PIE_Y, ALTO_PX, this.t);
    setEyeShine(false);
    e.tex.needsUpdate = true;
  }

  /** Dónde está su cara (en el mundo, coordenadas de Blender x, y, z) y su radio en metros. */
  _cara(e) {
    const f = faceOf(e.enemigo, e.pose, CW / 2, PIE_Y, ALTO_PX, N2END.FACE_RADIUS, N2END.FACE_RADIUS_MIN);
    const m = e.alto / CH;    // metros por píxel del lienzo
    const [x, y] = e.sitios[e.sitio];
    // el plano mira a la cámara: lo de la izquierda del lienzo queda a la izquierda vista desde ti
    const dx = x - this.L.x, dy = y - this.L.y, d = Math.hypot(dx, dy) || 1;
    const lx = -dy / d, ly = dx / d;       // (la derecha de la imagen, vista desde ti, en el suelo)
    const off = (f.x - CW / 2) * m;
    return { x: x - lx * off, y: y - ly * off, z: (PIE_Y - f.y) * m, r: f.r * m };
  }

  /** ¿La linterna le da en la cara? (el centro del haz, que se apunta con el ratón; y que llegue). */
  _caraLuz(e) {
    if (!this.L.linternaOn || this.ciego) return false;
    const c = this._cara(e);
    const dx = c.x - this.L.x, dy = c.y - this.L.y, dz = c.z - (this.L.ojosZ ?? 1.65);
    const d = Math.hypot(dx, dy, dz);
    if (d > (this.L.R?.linterna?.ALCANCE ?? 14)) return false;
    const [fx, fy, fz] = this.L.dirLinterna();   // (v1.56: hacia donde apuntas con el ratón)
    const cos = (dx * fx + dy * fy + dz * fz) / d;
    const ang = Math.acos(Math.max(-1, Math.min(1, cos)));
    return ang < Math.max(0.075, Math.atan(c.r * 1.25 / d));
  }

  _pan(x, y) {
    const a = Math.atan2(y - this.L.y, x - this.L.x) - this.L.yaw;
    return Math.max(-1, Math.min(1, -Math.sin(a)));
  }

  _son(e, clave, o = {}) {
    const [x, y] = e.sitios[e.sitio];
    const d = Math.hypot(x - this.L.x, y - this.L.y);
    this.L.g.audio?.lib?.play(clave, { pitchVar: 0.05, ...o, pan: this._pan(x, y), volume: (o.volume ?? 0.5) / (1 + d * 0.08) });
  }

  /** Cada fotograma (después de moverse el jugador). */
  update(dt) {
    this.t += dt;
    this.calma = Math.max(0, this.calma - dt);
    for (const e of [...this.lista]) {
      const r = this._luz(e, dt);
      if (r === 'retirado') {
        this.lista.splice(this.lista.indexOf(e), 1);
        e.vaSe = 0;
        (this.yendose ??= []).push(e);
      }
      if (r === 'ataca') return;
      if (r === 'pasa') {        // (fase N4: se ha acabado su tiempo asomado y entra en la sala)
        this.lista.splice(this.lista.indexOf(e), 1);
        this._quita(e);
        e.alTiempo(e);
        continue;
      }
      e.dibujaIn -= dt;
      if (e.dibujaIn <= 0) {
        e.dibujaIn = 0.1;
        this._dibuja(e);
      }
      e.respIn -= dt;
      if (e.respIn <= 0) {
        e.respIn = rand([2.2, 3.6]);
        if (!e.mudo) this._son(e, SND[e.enemigo].breath, { volume: 0.4 });
      }
    }
    // los que se retiran: se desvanecen hacia atrás
    for (const e of [...(this.yendose ?? [])]) {
      e.vaSe += dt;
      e.mat.uniforms.uAlfa.value = Math.max(0, 1 - e.vaSe / 0.6);
      if (e.vaSe >= 0.6) {
        this._quita(e);
        this.yendose.splice(this.yendose.indexOf(e), 1);
      }
    }
  }

  _luz(e, dt) {
    if (e.pausa) return null;    // (fase N4: la escena de El Largo con Slaimi, antes de girarse hacia ti)
    const lit = this._caraLuz(e);
    if (lit) this.L.enCara = performance.now();   // (v1.59: la linterna se cierra sobre su cara)
    const T = e.tuneE ?? (e.facil ? { ...this.tune, ...e.facil } : this.tune);
    switch (e.estado) {
      case 'espera':
        if (lit) { e.estado = 'luz'; return null; }
        e.busca -= dt;
        if (e.busca <= 0) return e.alTiempo ? 'pasa' : this._ataca(e, 'no lo encontró');
        return null;
      case 'luz':
        if (!lit) { e.estado = 'pierde'; e.ventana = T.pose; return null; }
        e.luz += dt;
        if (e.luz >= T.retire && e.cambios >= (T.changes ?? 0)) return this._retira(e);
        if (e.facil) return null;     // (el primero no se aparta: se aprende la mecánica)
        e.apartaIn -= dt;
        if (e.apartaIn <= 0) this._aparta(e);
        return null;
      case 'aparta':
      case 'pierde':
        if (lit) { e.estado = 'luz'; return null; }
        e.ventana -= dt;
        if (e.ventana <= 0) return this._ataca(e, e.por ?? 'perdió la cara');
        return null;
    }
    return null;
  }

  _aparta(e) {
    e.apartaIn = rand(N2END.EVADE_EVERY);
    e.estado = 'aparta';
    e.movido = this.t;
    e.cambios++;
    const T = e.tuneE ?? this.tune;
    if (Math.random() < N2END.MOVE_CHANCE && e.sitios.length > 1) {
      let s = e.sitio;
      while (s === e.sitio) s = Math.floor(Math.random() * e.sitios.length);
      e.sitio = s;
      e.pose = pick(POSES[e.enemigo]);
      e.ventana = T.move;
      e.por = 'cambió de sitio';
      this._son(e, SND[e.enemigo].steps, { volume: 0.6 });
    } else {
      const otras = POSES[e.enemigo].filter((p) => p !== e.pose);
      e.pose = pick(otras);
      e.ventana = T.pose;
      e.por = 'cambió de postura';
    }
    this._dibuja(e);
  }

  _retira(e) {
    e.estado = 'ido';
    const s = SND[e.enemigo];
    [0.8, 0.5, 0.25].forEach((v, i) => this._son(e, s.steps, { volume: v, when: 0.2 + i * s.stepGap, muffle: 0.2 + i * 0.25 }));
    this.L.g.audio?.lib?.play('ambiente/chispazo', { volume: 0.18 });
    this.calma = N2END.RETIRE_FLICKER_TIME ?? 1.2;
    this.L.parpadeo = this.calma;      // (la linterna parpadea: peligro pasado)
    this.o.alRetirarse?.(e);
    return 'retirado';
  }

  _ataca(e, por) {
    if (this.atacado) return 'ataca';
    this.atacado = true;
    this.o.onAtaca?.(e.enemigo, por);
    return 'ataca';
  }

  /** Antes de cada render: cada uno de pie en su sitio, mirándote (gira solo en vertical); tiembla con la luz. */
  coloca() {
    for (const e of [...this.lista, ...(this.yendose ?? [])]) {
      const [x, y] = e.sitios[e.sitio];
      const tiembla = e.estado === 'luz' ? Math.sin(this.t * 38) * 0.02 * Math.min(1, e.luz) : 0;
      const atras = e.movido !== undefined ? Math.max(0, 1 - (this.t - e.movido) / 0.4) : 0;
      const ida = e.vaSe ?? 0;
      const dx = x - this.L.x, dy = y - this.L.y, d = Math.hypot(dx, dy) || 1;
      const px = x + (dx / d) * (0.25 * atras + 0.8 * ida) + (-dy / d) * tiembla;
      const py = y + (dy / d) * (0.25 * atras + 0.8 * ida) + (dx / d) * tiembla;
      // (Blender (x, y, z) → three (x, z, -y))
      e.malla.position.set(px, e.alto / 2 - 14 * e.alto / CH, -py);
      e.malla.rotation.set(0, Math.atan2(this.L.x - px, -(this.L.y) + py) , 0);
    }
  }

  /** Sitios donde puede salir uno en una sala: a 4–9 m de ti, libres (sin chocar) y dentro de la caja de la sala. */
  sitiosEn(caja, n = 3) {
    const [x0, y0, x1, y1] = caja;
    const libre = (x, y) => {
      const L = this.L, ox = L.x, oy = L.y;
      L.x = x; L.y = y;
      const toca = L._choca(1.7);
      const ok = !toca && Math.hypot(L.x - x, L.y - y) < 0.01;
      L.x = ox; L.y = oy;
      return ok;
    };
    const out = [];
    for (let k = 0; k < 160 && out.length < n; k++) {
      const a = Math.random() * Math.PI * 2, r = rand([4, 9]);
      const x = this.L.x + Math.cos(a) * r, y = this.L.y + Math.sin(a) * r;
      if (x < x0 + 0.8 || x > x1 - 0.8 || y < y0 + 0.8 || y > y1 - 0.8) continue;
      if (!libre(x, y)) continue;
      if (out.some(([a2, b2]) => Math.hypot(a2 - x, b2 - y) < 2.5)) continue;
      out.push([x, y]);
    }
    return out;
  }
}
