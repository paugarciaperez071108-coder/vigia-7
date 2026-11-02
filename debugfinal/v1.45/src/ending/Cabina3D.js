// =============================================================
// Cabina3D.js — (v1.35, Fase 3 del final) Dentro de la nave de escape, en 3D en tiempo real (con Libre3D).
// La compuerta se ha cerrado delante de la Aberración: la oyes golpearla (la compuerta se abolla con cada golpe y
// todo tiembla). Andas por la bodega hasta la cabina y te sientas: las pantallas se encienden (estado de la nave, sin
// decirte qué hacer) y la tapa del botón de despegue se levanta; el botón late en rojo. Con Slaimi: lo dejas en el
// asiento del copiloto (v1.39; antes, el hueco de la consola) y se queda mirándote. Sin él: la vista pasa un momento por el asiento vacío de al lado.
// Clic en el botón: los anclajes sueltan la nave, se abre la trampilla del suelo del Hangar y la nave cae; gira y,
// por el parabrisas, el agujero del Hangar en llamas se aleja con la Aberración asomada, mirándote irte. Los motores
// se encienden, la nave se aleja y fundido (sigue la Fase 4, los finales).
// Valores en NIGHT7.FINAL.LIBRE.CABINA. Las marcas (dónde van el botón, las pantallas, el hueco, el asiento) salen
// de Blender (nave_escape.py → hornear_sala.py --sala=cabina: «marcas» en cabina.json).
// =============================================================

import * as THREE from '../lib/three/three.module.min.js';
import { NIGHT7 } from '../night/night7.js';
import { CONFIG } from '../config.js';

const K = NIGHT7.FINAL.LIBRE;
const KC = K.CABINA;
const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;

/** (Blender (x, y, z) → three (x, z, -y)) */
const b2t = (x, y, z) => new THREE.Vector3(x, z, -y);
const suave = (a, b, t) => {
  const k = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
const angulo = (a) => Math.atan2(Math.sin(a), Math.cos(a));

let SLAIMI = null;                  // (su hoja quieta, asustado: assets/slaimi/slaimi_triste.webp)
let GIRO = null;                   // (v1.43) Slaimi dándose la vuelta (9 fotogramas)

// la compuerta abollada: la luz es horneada (no cambia al hundirse), así que lo hundido se oscurece (aHund)
const VS_HUND = `
attribute float aHund;
varying vec2 vUv;
varying float vH;
void main() {
  vUv = uv;
  vH = aHund;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const FS_HUND = `
uniform sampler2D uLuz;
uniform sampler2D uFuego;
uniform float uK;
uniform float uFlick;
varying vec2 vUv;
varying float vH;
void main() {
  vec3 base = pow(texture2D(uLuz, vUv).rgb, vec3(2.2)) * uK;
  vec3 fue = pow(texture2D(uFuego, vUv).rgb, vec3(2.2)) * uK;
  vec3 c = (base + fue * uFlick) * (1.0 - clamp(vH * 7.0, 0.0, 0.75));
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Cabina3D {
  constructor(libre) {
    this.L = libre;
    this.activa = false;
  }

  _son(clave, o = {}) {
    return this.L._son(clave, o);
  }

  get _m() {
    return this.L.zonas[KC.ZONA]?.info?.marcas ?? {};
  }

  /** Lo que pone el juego en la cabina (una vez): las pantallas, el botón con su tapa, Slaimi y lo de fuera. */
  _crea() {
    if (this.hecho) return;
    this.hecho = true;
    const L = this.L, m = this._m;
    // las pantallas: un canvas cada una (letras de terminal); van inclinadas como la tapa de la consola
    this.pantallas = [];
    for (let k = 0; k < 3; k++) {
      const p = m[`pantalla_${k}`];
      if (!p) continue;
      const cv = document.createElement('canvas');
      cv.width = 384;
      cv.height = 240;
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      const me = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.3),
        new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true, opacity: 0 }));
      me.position.copy(b2t(p[0], p[1], p[2]));
      me.rotation.x = p[3] - Math.PI / 2;
      L.escena.add(me);
      this.pantallas.push({ me, cv, ctx: cv.getContext('2d'), tex, k });
    }
    // el botón de despegue (rojo, late) y su tapa de seguridad, que se levanta al sentarte
    const pb = m.boton;
    this.boton = new THREE.Group();
    if (pb) {
      this.boton.position.copy(b2t(pb[0], pb[1], pb[2]));
      this.boton.rotation.x = pb[3] - Math.PI / 2;
    }
    const cil = (r, h, color) => {
      const g = new THREE.CylinderGeometry(r, r, h, 28);
      g.rotateX(Math.PI / 2);
      g.translate(0, 0, h / 2);
      return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color }));
    };
    this.bAro = cil(0.072, 0.02, 0x121212);
    this.bRojo = cil(0.055, 0.045, 0x5a0805);
    this.boton.add(this.bAro, this.bRojo);
    // la tapa: una caja amarilla y negra, con la bisagra en el lado de delante (el de arriba de la tapa inclinada)
    const cvT = document.createElement('canvas');
    cvT.width = cvT.height = 64;
    const cT = cvT.getContext('2d');
    for (let k = -4; k < 8; k++) {
      cT.fillStyle = k % 2 ? '#2a2206' : '#8a6c12';
      cT.beginPath();
      cT.moveTo(k * 12, 0);
      cT.lineTo(k * 12 + 12, 0);
      cT.lineTo(k * 12 + 12 + 64, 64);
      cT.lineTo(k * 12 + 64, 64);
      cT.fill();
    }
    const texT = new THREE.CanvasTexture(cvT);
    texT.colorSpace = THREE.SRGBColorSpace;
    this.bisagra = new THREE.Group();
    this.bisagra.position.set(0, 0.085, 0.0);
    const tapa = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.17, 0.075),
      new THREE.MeshBasicMaterial({ map: texT, color: 0x9a9a9a, transparent: true, opacity: 0.92 }));
    tapa.position.set(0, -0.085, 0.04);
    this.bisagra.add(tapa);
    this.boton.add(this.bisagra);
    // su resplandor rojo (suma luz)
    const cvG = document.createElement('canvas');
    cvG.width = cvG.height = 64;
    const cG = cvG.getContext('2d');
    const gr = cG.createRadialGradient(32, 32, 1, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,60,40,1)');
    gr.addColorStop(0.4, 'rgba(255,20,10,0.35)');
    gr.addColorStop(1, 'rgba(255,0,0,0)');
    cG.fillStyle = gr;
    cG.fillRect(0, 0, 64, 64);
    this.texResplandor = new THREE.CanvasTexture(cvG);
    this.bLuz = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texResplandor, blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, toneMapped: false, opacity: 0 }));
    this.bLuz.scale.setScalar(0.32);
    this.bLuz.position.set(0, 0, 0.06);
    this.boton.add(this.bLuz);
    L.escena.add(this.boton);
    // Slaimi en el hueco (un plano que siempre te mira: se queda mirándote) y su brillo azul
    if (!SLAIMI) SLAIMI = new THREE.TextureLoader().load('assets/slaimi/slaimi_triste.webp', (t) => { t.colorSpace = THREE.SRGBColorSpace; });
    this.slaimi = new THREE.Sprite(new THREE.SpriteMaterial({ map: SLAIMI, transparent: true, toneMapped: false, depthWrite: false }));
    this.slaimi.center.set(0.5, 1 - 0.8224);       // (los pies, abajo: slaimi.json)
    this.slaimi.scale.set(KC.SLAIMI_ALTO * 0.75, KC.SLAIMI_ALTO, 1);
    this.slaimi.visible = false;
    L.escena.add(this.slaimi);
    const cvA = document.createElement('canvas');
    cvA.width = cvA.height = 64;
    const cA = cvA.getContext('2d');
    const ga = cA.createRadialGradient(32, 32, 1, 32, 32, 32);
    ga.addColorStop(0, 'rgba(150,200,255,0.9)');
    ga.addColorStop(1, 'rgba(120,180,255,0)');
    cA.fillStyle = ga;
    cA.fillRect(0, 0, 64, 64);
    this.slaimiLuz = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cvA), blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, toneMapped: false, opacity: 0.5 }));
    this.slaimiLuz.scale.setScalar(0.55);
    this.slaimiLuz.visible = false;
    L.escena.add(this.slaimiLuz);
    this._creaFuera();
    // la compuerta: sus vértices de antes (para abollarla y para dejarla como estaba al reintentar)
    const Zc = L.zonas[L.R.fin?.nave?.zona];
    Zc?.malla?.traverse((o) => {
      if (o.isMesh && !this.chapa) {
        this.chapa = o;
        this.chapa0 = o.geometry.attributes.position.array.slice();
        o.geometry.setAttribute('aHund', new THREE.BufferAttribute(new Float32Array(o.geometry.attributes.position.count), 1));
        o.material = new THREE.ShaderMaterial({ vertexShader: VS_HUND, fragmentShader: FS_HUND, uniforms: o.material.uniforms });
      }
    });
  }

  /** Lo de fuera, para la caída: la panza de la estación (con el agujero de la trampilla), las estrellas y el planeta. */
  _creaFuera() {
    const L = this.L, F = KC.FUERA;
    const g = this.fuera = new THREE.Group();
    g.visible = false;
    // la panza: chapas oscuras con juntas (una textura repetida), con el hueco de la trampilla
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const c = cv.getContext('2d');
    c.fillStyle = '#3a3c40';
    c.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 900; k++) {
      c.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${(Math.random() * 0.05).toFixed(3)})`;
      c.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 30, 2 + Math.random() * 30);
    }
    c.strokeStyle = '#17181a';
    c.lineWidth = 3;
    for (const [x, y, w, h] of [[0, 0, 128, 128], [128, 0, 128, 64], [128, 64, 128, 64], [0, 128, 256, 128], [64, 128, 64, 128]]) c.strokeRect(x, y, w, h);
    c.fillStyle = '#1d1e20';
    for (let k = 0; k < 6; k++) c.fillRect(20 + k * 38, 200, 14, 40);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(F.PANZA / 10, F.PANZA / 10);
    tex.colorSpace = THREE.SRGBColorSpace;
    const [hx0, hx1, hy0, hy1] = F.HUECO;
    const s = new THREE.Shape();
    const P = F.PANZA / 2;
    s.moveTo(-P, -P);
    s.lineTo(P, -P);
    s.lineTo(P, P);
    s.lineTo(-P, P);
    s.lineTo(-P, -P);
    const h = new THREE.Path();
    // (en el plano de la forma: x, y de Blender; se tumba después)
    h.moveTo(hx0, hy0);
    h.lineTo(hx0, hy1);
    h.lineTo(hx1, hy1);
    h.lineTo(hx1, hy0);
    h.lineTo(hx0, hy0);
    s.holes.push(h);
    const gs = new THREE.ShapeGeometry(s);
    const uv = gs.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 10, uv.getY(i) / 10);
    // (x, y de Blender → three: x, −y en z; mirando hacia abajo)
    gs.rotateX(-Math.PI / 2);
    gs.scale(1, 1, 1);
    const panza = new THREE.Mesh(gs, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
    panza.position.y = F.PANZA_Z;
    g.add(panza);
    // luces de posición por la panza (parpadean) y el resplandor del fuego que sale por el agujero
    this.balizas = [];
    for (let k = 0; k < 14; k++) {
      const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texResplandor, blending: THREE.AdditiveBlending,
        depthWrite: false, transparent: true, toneMapped: false, color: k % 3 ? 0xff3020 : 0xffffff }));
      const a = Math.random() * Math.PI * 2, r = 14 + Math.random() * 60;
      b.position.set(-6 + Math.cos(a) * r, F.PANZA_Z - 0.3, -3.6 + Math.sin(a) * r);
      b.scale.setScalar(1.6);
      b.userData.fase = Math.random() * 6;
      g.add(b);
      this.balizas.push(b);
    }
    this.luzHueco = new THREE.PointLight(0xff7a2a, F.LUZ_HUECO, 70, 1.3);
    this.luzHueco.position.set((hx0 + hx1) / 2, F.PANZA_Z - 1.0, -(hy0 + hy1) / 2);
    g.add(this.luzHueco);
    const abajo = new THREE.DirectionalLight(0x8fa4c8, F.LUZ_PLANETA);
    abajo.position.set(0.3, -1, 0.2);
    g.add(abajo);
    g.add(abajo.target);
    // las estrellas (por debajo de la estación)
    const n = 1800, pos = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) {
      const v = new THREE.Vector3(Math.random() * 2 - 1, -Math.random(), Math.random() * 2 - 1).normalize().multiplyScalar(900);
      pos.set([v.x, v.y, v.z], k * 3);
    }
    const ge = new THREE.BufferGeometry();
    ge.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.add(new THREE.Points(ge, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.6, sizeAttenuation: false, toneMapped: false })));
    // el planeta, muy abajo, con su sol de lado
    const pl = new THREE.Mesh(new THREE.SphereGeometry(F.PLANETA_R, 64, 48),
      new THREE.MeshLambertMaterial({ color: 0x24456e, emissive: 0x040a16 }));
    pl.position.set(0, -F.PLANETA_R - F.PLANETA_LEJOS, 0);
    g.add(pl);
    const sol = new THREE.DirectionalLight(0xfff0dc, 2.2);
    sol.position.set(1, -0.25, -0.6);
    sol.target = pl;
    g.add(sol);
    L.escena.add(g);
  }

  /** Dentro de la nave, con la compuerta ya cerrada (directo: el debug, que empieza aquí). */
  empieza(directo = false) {
    const L = this.L;
    this._crea();
    this.activa = true;
    this.fase = 'andar';
    this.t = 0;
    this.tFase = 0;
    this.golpeIn = directo ? 1.2 : KC.GOLPES_CADA[0];
    this.golpes = 0;
    this.encendidas = -1;
    this.pulsado = false;
    this.dejaSlaimi = 0;
    this.d = null;
    L.dejaSlaimi = 0;
    L.fin = null;
    // dentro solo chocan las paredes y lo de la cabina
    L.solidos = [...(L.zonas[KC.ZONA]?.solidos ?? [])];
    const Zc = L.zonas[L.R.fin?.nave?.zona];
    if (Zc?.malla) {
      Zc.malla.visible = true;
      Zc.malla.position.x = 0;
    }
    if (directo) {
      const e = L.zonas[KC.ZONA].info.entrada;
      L.x = e.p[0];
      L.y = e.p[1];
      L.yaw = Math.atan2(e.mira[1] - e.p[1], e.mira[0] - e.p[0]);
      L.pitch = 0;
    }
    L.base = 1.0;
    L.alto = K.OJOS;
    L.ojosZ = L.base + L.alto;
    this.zumbido?.stop?.(0.1);
    this.zumbido = L.g.audio?.lib?.play('final/cabina', { loop: true, volume: KC.ZUMBIDO, pitchVar: 0, volVar: 0 }) || null;
    L.textoAyuda = null;
  }

  /** Al reintentar o salir: todo como estaba (la nave en su sitio, la compuerta sin abollar). */
  reset() {
    const L = this.L;
    this.activa = false;
    this.zumbido?.stop?.(0.2);
    this.zumbido = null;
    if (this.naveG) {
      this.naveG.position.copy(this.pivote);
      this.naveG.rotation.set(0, 0, 0);
      this.naveG.updateMatrixWorld(true);
      for (const o of [...this.naveG.children]) L.escena.attach(o);
      L.escena.remove(this.naveG);
      this.naveG = null;
    }
    if (this.chapa && this.chapa0) {
      this.chapa.geometry.attributes.position.array.set(this.chapa0);
      this.chapa.geometry.attributes.position.needsUpdate = true;
      this.chapa.geometry.attributes.aHund.array.fill(0);
      this.chapa.geometry.attributes.aHund.needsUpdate = true;
    }
    for (const z of KC.BAHIA) if (L.zonas[z]?.malla) L.zonas[z].malla.position.set(0, 0, 0);
    if (this.fuera) this.fuera.visible = false;
    if (this.slaimi) this.slaimi.visible = this.slaimiLuz.visible = false;
    for (const p of this.pantallas ?? []) p.me.material.opacity = 0;
    if (this.bisagra) this.bisagra.rotation.x = 0;
    if (L.cam) {
      L.cam.far = 250;
      L.cam.updateProjectionMatrix();
    }
    L.dejaSlaimi = 0;
    L.final4?.reset();
  }

  /** Cada fotograma. Devuelve true si la cabina se ocupa de todo (sentado, el despegue): sin andar. */
  update(dt) {
    if (!this.activa) return false;
    const L = this.L;
    this.t += dt;
    this.tFase += dt;
    this._pantallas(dt);
    this._boton(dt);
    this._slaimi(dt);
    if (this.fase !== 'andar' && this.fase !== 'despegue') {
      // (sentado, Libre3D no anda: lo que se apaga solo)
      L.sacude = Math.max(0, L.sacude - dt);
      L.golpeRojo = Math.max(0, (L.golpeRojo ?? 0) - dt * 2);
    }
    if (this.fase === 'espacio') {
      L.final4?.update(dt);
      return true;
    }
    if (this.fase === 'despegue') {
      this._despegue(dt);
      return true;
    }
    this._golpes(dt);
    if (this.fase === 'andar') {
      const a = this._m.asiento;
      if (a && Math.hypot(L.x - a[0], L.y - a[1]) < KC.SENTARSE_R) this._fase('sienta');
      return false;
    }
    // sentarte: los ojos van al asiento, mirando a la consola
    const a = this._m.asiento;
    const k = Math.min(1, dt * 4);
    L.x += (a[0] - L.x) * k;
    L.y += (a[1] - L.y) * k;
    L.ojosZ += (a[2] - L.ojosZ) * k;
    L.vx = L.vy = L.vel = 0;
    let objYaw = Math.PI / 2, objPitch = KC.MIRA_CONSOLA;
    if (this.fase === 'sienta') {
      L.yaw += angulo(objYaw - L.yaw) * k;
      L.pitch += (objPitch - L.pitch) * k;
      if (this.tFase > 0.25 && !this.crujido) {
        this.crujido = true;
        this._son('pasos/metal', { volume: 0.5, pitch: 0.7 });
        this._son('caidas/silla', { volume: 0.35, pitch: 0.8, when: 0.1 });
      }
      if (this.tFase >= 1.0) this._fase('deja');
    } else if (this.fase === 'deja') {
      // con Slaimi: lo dejas en el hueco; sin él, la vista pasa por el asiento vacío de al lado
      if (L.slaimi) {
        this.dejaSlaimi = Math.min(1, this.tFase / KC.DEJA_S);
        L.dejaSlaimi = this.dejaSlaimi;
        const h = this.sitioSlaimi();
        const mira = h && this.tFase < KC.DEJA_S + 0.9;
        const hy = mira ? Math.atan2(h[1] - L.y, h[0] - L.x) : objYaw;
        const hp = mira ? Math.atan2(h[2] + KC.SLAIMI_ALTO * 0.4 - L.ojosZ, Math.hypot(h[0] - L.x, h[1] - L.y)) : objPitch;
        L.yaw += angulo(hy - L.yaw) * Math.min(1, dt * 3);
        L.pitch += (hp - L.pitch) * Math.min(1, dt * 3);
        if (this.tFase > KC.DEJA_S * 0.7 && !this.slaimiPuesto) {
          this.slaimiPuesto = true;
          this._son('pasos/rejilla', { volume: 0.3, pitch: 1.6 });
          this._son('slaimi/calma', { volume: 0.6, when: 0.3 });
        }
      } else {
        const c = this._m.copiloto;
        if (c && this.tFase < KC.VACIO_S) {
          objYaw = Math.atan2(c[1] - L.y, c[0] - L.x);
          objPitch = Math.atan2(c[2] - L.ojosZ, Math.hypot(c[0] - L.x, c[1] - L.y));
        }
        L.yaw += angulo(objYaw - L.yaw) * Math.min(1, dt * 2.5);
        L.pitch += (objPitch - L.pitch) * Math.min(1, dt * 2.5);
      }
      if (this.tFase >= (L.slaimi ? KC.DEJA_S + 1.5 : KC.VACIO_S + 0.9)) this._fase('boton');
    } else if (this.fase === 'boton') {
      // sentado: miras alrededor (con límite); el botón espera
      L.yaw = Math.PI / 2 + Math.max(-KC.GIRO, Math.min(KC.GIRO, angulo(L.yaw - Math.PI / 2)));
      L.pitch = Math.max(-1.0, Math.min(0.7, L.pitch));
      if (this.tFase > KC.PISTA_S) {
        // (si tardas: un pitido de la consola de vez en cuando, y el botón late más)
        this.pitidoIn = (this.pitidoIn ?? 0) - dt;
        if (this.pitidoIn <= 0) {
          this.pitidoIn = 4;
          this._son('final/pitido', { volume: 0.35 });
        }
      }
    }
    return true;
  }

  _fase(f) {
    this.fase = f;
    this.tFase = 0;
    const L = this.L;
    if (f === 'sienta') {
      L.teclas.clear();
      this.crujido = false;
    } else if (f === 'deja') {
      this.slaimiPuesto = false;
      this._son('final/encendido', { volume: 0.55 });
      this.encendidas = 0;
      this.tEnc = this.t;
    } else if (f === 'boton') {
      this.pitidoIn = 2;
      this._son('metal/panel', { volume: 0.35, pitch: 1.6, when: 0.35 });
      this._son('final/pitido', { volume: 0.4, when: 0.6 });
    }
  }

  /** Los golpes de la Aberración en la compuerta: cada vez más seguidos; se abolla, todo tiembla. */
  _golpes(dt) {
    const L = this.L;
    this.golpeIn -= dt;
    if (this.golpeIn > 0) return;
    const [a, b] = KC.GOLPES_CADA;
    this.golpeIn = Math.max(KC.GOLPES_MIN, a + Math.random() * (b - a) - this.golpes * 0.25);
    this.golpes++;
    const lejos = Math.max(0, Math.min(1, (L.y - (L.R.fin?.nave?.dentro?.[1] ?? 0)) / 6));
    L.sacude = Math.max(L.sacude, 0.9 - 0.5 * lejos);
    L.golpeRojo = 0.6 - 0.35 * lejos;
    this._son('aberracion/metal', { volume: 1.0 - 0.3 * lejos, pitch: 0.7, muffle: 0.4 * lejos });
    this._son('metal/golpe_pared', { volume: 1.0 - 0.3 * lejos, pitch: 0.45, when: 0.03, muffle: 0.4 * lejos });
    if (this.golpes % 3 === 0) this._son('aberracion/furia', { volume: 0.8, when: 0.3, muffle: 0.3 + 0.3 * lejos });
    else if (this.golpes % 3 === 1) this._son('aberracion/dedos', { volume: 0.6, when: 0.5, muffle: 0.4 });
    this._abolla();
  }

  /** Abolla la compuerta (hacia dentro) alrededor de un punto al azar. */
  _abolla() {
    const me = this.chapa;
    if (!me) return;
    me.updateMatrixWorld(true);
    const pos = me.geometry.attributes.position;
    const M = me.matrixWorld, Mi = M.clone().invert();
    const centro = new THREE.Vector3();
    me.geometry.computeBoundingBox();
    me.geometry.boundingBox.getCenter(centro).applyMatrix4(M);
    // (un punto al azar de la hoja; en three, la hoja está en x–y y «hacia dentro» es −z)
    const px = centro.x + (Math.random() - 0.5) * 1.1, py = centro.y + (Math.random() - 0.4) * 1.5;
    const r = KC.ABOLLA_R * (0.8 + Math.random() * 0.5), hondo = KC.ABOLLA * (0.7 + Math.random() * 0.6);
    const v = new THREE.Vector3();
    const hund = me.geometry.attributes.aHund;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(M);
      const d2 = ((v.x - px) ** 2 + (v.y - py) ** 2) / (r * r);
      if (d2 > 4) continue;
      const k = hondo * Math.exp(-d2);
      v.z -= k;
      v.applyMatrix4(Mi);
      pos.setXYZ(i, v.x, v.y, v.z);
      if (hund) hund.setX(i, hund.getX(i) + k);
    }
    pos.needsUpdate = true;
    if (hund) hund.needsUpdate = true;
  }

  /** Las pantallas: se encienden una a una al sentarte; el estado de la nave (sin decir qué hacer). */
  _pantallas(dt) {
    if (!this.pantallas?.length || this.encendidas < 0) return;
    this.tPant = (this.tPant ?? 0) + dt;
    if (this.tPant < 0.12) return;
    this.tPant = 0;
    const t = this.t;
    const desp = this.d;
    for (const p of this.pantallas) {
      // (una a una: cada pantalla, 0,45 s después de la anterior; parpadea al encenderse)
      const tp = this.t - this.tEnc - p.k * 0.45;
      if (tp < 0) continue;
      p.me.material.opacity = tp < 0.6 ? (Math.random() < 0.5 ? 0.25 : 0.9) * tp / 0.6 : 1;
      const c = p.ctx, cw = p.cv.width, ch = p.cv.height;
      const rojo = desp ? 1 : 0;
      c.fillStyle = rojo ? '#160303' : '#020a06';
      c.fillRect(0, 0, cw, ch);
      const verde = rojo ? '#ff5a3a' : '#59ff9a';
      c.fillStyle = verde;
      c.font = 'bold 19px monospace';
      const lineas = this._texto(p.k, desp);
      const n = Math.floor(tp * 9);
      lineas.slice(0, Math.max(0, n)).forEach((l, i) => {
        if (l.startsWith('!') && Math.sin(t * 7) < 0) return;
        c.fillText(l.replace(/^!/, ''), 14, 30 + i * 26);
      });
      if (p.k === 1 && !desp) {
        // la nave, de lado, con la compuerta (parpadea en rojo con cada golpe)
        c.strokeStyle = verde;
        c.lineWidth = 2;
        c.strokeRect(70, 150, 230, 50);
        c.beginPath();
        c.moveTo(300, 150);
        c.lineTo(350, 175);
        c.lineTo(300, 200);
        c.stroke();
        c.fillStyle = Math.sin(t * 9) > 0 ? '#ff3020' : '#601010';
        c.fillRect(62, 158, 10, 34);
      }
      // las líneas de barrido del CRT
      c.fillStyle = 'rgba(0,0,0,0.22)';
      for (let y = 0; y < ch; y += 3) c.fillRect(0, y, cw, 1);
      p.tex.needsUpdate = true;
    }
  }

  _texto(k, desp) {
    const imp = String(this.golpes).padStart(2, '0');
    if (desp) {
      const D = KC.DESPEGUE, t = desp.t;
      return [
        ['EVAC-01 // LANZAMIENTO', '', `ANCLAJES ...... ${t > D.ANCLAS ? 'LIBERADOS' : 'SOLTANDO'}`,
          `BAHIA 2 ....... ${t > D.BAHIA + 1 ? 'ABIERTA' : 'ABRIENDO'}`, `MOTORES ....... ${t > D.IGNICION ? 'IGNICION' : 'CARGANDO'}`],
        ['!SEPARACION', '', `ALTITUD REL. ${(Math.max(0, -this.naveY) * 1).toFixed(1).padStart(6)} m`, `VEL. ${(Math.max(0, desp.vel ?? 0)).toFixed(1).padStart(5)} m/s`],
        ['ESTACION VIGIA-7', '', '!SEÑAL PERDIDA', 'NUCLEO ......... CRITICO', 'TRIPULACION .... --'],
      ][k];
    }
    return [
      ['EVAC-01 // ESCAPE', '', 'ENERGIA EMERG. ...... 31%', 'SOPORTE VITAL ......  OK', 'ANCLAJES ...... BLOQUEADOS', 'BAHIA 2 ......... CERRADA', 'MOTORES ....... EN ESPERA'],
      ['COMPUERTA DE POPA', '', `!IMPACTOS: ${imp}`, `DEFORMACION ... ${Math.min(99, this.golpes * 7)}%`],
      ['HANGAR', '', `TEMPERATURA ... ${410 + Math.round(this.t * 3)} C`, 'PRESION ......... 0,82', '!FUEGO EN LA BAHIA', 'OXIGENO ........ 14%'],
    ][k];
  }

  /** El botón: la tapa se levanta al sentarte; el rojo late (más si tardas). */
  _boton(dt) {
    if (!this.boton) return;
    const sentado = this.fase === 'boton' || this.fase === 'despegue';
    const abre = this.fase === 'boton' ? suave(0.2, 0.7, this.tFase) : this.fase === 'despegue' ? 1 : 0;
    this.bisagra.rotation.x = -abre * 1.9;
    const prisa = this.fase === 'boton' && this.tFase > KC.PISTA_S ? 1 : 0;
    const late = sentado && !this.pulsado ? 0.5 + 0.5 * Math.sin(this.t * (5 + 4 * prisa)) : this.pulsado ? 1 : 0;
    const r = 0.35 + 0.65 * late;
    this.bRojo.material.color.setRGB(r, 0.04 * r, 0.03 * r);
    this.bLuz.material.opacity = sentado ? (0.25 + 0.55 * late) * (1 + 0.6 * prisa) : 0.08;
    this.bRojo.position.z = this.pulsado ? -0.025 : 0;
  }

  /** (v1.39) Dónde se queda Slaimi (sus pies, coordenadas de Blender): en el asiento del copiloto (o en el hueco). */
  sitioSlaimi() {
    const c = this._m.copiloto, h = this._m.hueco;
    // (v1.43) en los finales, junto a la ventanilla (Final4.js)
    if (this.enVentana && NIGHT7.FINAL.LIBRE.FINAL4?.SLAIMI_VENTANA) return [...NIGHT7.FINAL.LIBRE.FINAL4.SLAIMI_VENTANA];
    if (KC.SLAIMI_EN === 'copiloto' && c) return [c[0], c[1] + KC.SLAIMI_ASIENTO[0], c[2] + KC.SLAIMI_ASIENTO[1]];
    return h ? [h[0], h[1], h[2] + KC.SLAIMI_SUBE] : null;
  }

  /** Slaimi en su sitio: aparece al dejarlo, respira, tiembla con los golpes y con el despegue. */
  _slaimi(dt) {
    if (!this.slaimi) return;
    if (!this.final4Activo) this.enVentana = false;
    const L = this.L;
    const ver = !!(L.slaimi && this.slaimiPuesto);
    this.slaimi.visible = this.slaimiLuz.visible = ver;
    if (!ver) return;
    const h = this.sitioSlaimi();
    if (!h) return;
    const p = b2t(h[0], h[1], h[2]);
    // (v1.39) en el grupo de la nave (al despegar) va en sus coordenadas: si no, se quedaba fuera de la cabina
    if (this.naveG && this.slaimi.parent === this.naveG) p.sub(this.pivote);
    const tiembla = Math.max(L.sacude > 0.4 ? 0.6 : 0, this.d ? 0.8 : 0);
    const salta = Math.max(0, 1 - this.tFase * 3) * (this.fase === 'boton' ? 0 : 1);
    this.slaimi.position.set(p.x + (Math.random() - 0.5) * 0.008 * tiembla, p.y + 0.05 * Math.sin(Math.PI * salta), p.z);
    const resp = 1 + 0.04 * Math.sin(this.t * 2.4);
    this.slaimi.scale.set(KC.SLAIMI_ALTO * 0.75 * (2 - resp), KC.SLAIMI_ALTO * resp, 1);
    // (v1.43) de espaldas / girándose (la tira «giro», assets/slaimi/slaimi_giro.webp) y la luz de la explosión
    if (this.slaimiGiro !== undefined && this.slaimiGiro !== null) {
      if (!GIRO) {
        GIRO = new THREE.TextureLoader().load('assets/slaimi/slaimi_giro.webp', (t) => { t.colorSpace = THREE.SRGBColorSpace; });
        GIRO.repeat.set(1 / 9, 1);
      }
      if (this.slaimi.material.map !== GIRO) {
        this.slaimi.material.map = GIRO;
        this.slaimi.material.needsUpdate = true;
      }
      GIRO.offset.x = Math.round(Math.max(0, Math.min(8, this.slaimiGiro))) / 9;
    } else if (this.slaimi.material.map !== SLAIMI) {
      this.slaimi.material.map = SLAIMI;
      this.slaimi.material.needsUpdate = true;
    }
    const lz = this.slaimiLuzExt ?? null;
    if (lz) this.slaimi.material.color.setRGB(lz[0], lz[1], lz[2]);
    else this.slaimi.material.color.setRGB(1, 1, 1);
    this.slaimiLuz.position.set(p.x, p.y + KC.SLAIMI_ALTO * 0.35, p.z);
    this.slaimiLuz.material.opacity = 0.35 + 0.15 * Math.sin(this.t * 5) + (this.d ? 0.3 : 0);
  }

  /** Clic (o Espacio): si miras al botón, despegas. */
  pulsa(ndc = null) {
    if (this.fase !== 'boton' || this.tFase < 0.7 || this.pulsado) return false;
    const L = this.L;
    const ray = new THREE.Raycaster();
    L.cam.updateMatrixWorld(true);
    ray.setFromCamera(ndc ?? new THREE.Vector2(0, 0), L.cam);
    const pb = new THREE.Vector3();
    this.bRojo.getWorldPosition(pb);
    const dir = pb.sub(ray.ray.origin).normalize();
    if (dir.angleTo(ray.ray.direction) > KC.APUNTA) return false;
    this.pulsado = true;
    this.fase = 'despegue';
    this.tFase = 0;
    this.d = { t: 0, vel: 0, v: new THREE.Vector3(), hechos: new Set() };
    this.naveY = 0;
    this._son('final/boton', { volume: 0.9 });
    this._son('n7/alarma', { volume: 0.45, when: 0.35 });
    return true;
  }

  /** El despegue: los anclajes, la trampilla, la caída (gira: el agujero del Hangar y ella), los motores, fuera. */
  _despegue(dt) {
    const L = this.L, D = KC.DESPEGUE, d = this.d;
    d.t += dt;
    const t = d.t;
    const una = (n, f) => {
      if (t >= n && !d.hechos.has(n)) {
        d.hechos.add(n);
        f();
      }
    };
    // la nave y todo lo de dentro, en un grupo que se mueve (la cámara, dentro)
    if (!this.naveG) {
      const pv = this._m.pivote ?? [-6, 3.6, 0];
      this.pivote = b2t(pv[0], pv[1], pv[2]);
      const g = this.naveG = new THREE.Group();
      g.position.copy(this.pivote);
      g.rotation.order = 'YXZ';
      L.escena.add(g);
      g.updateMatrixWorld(true);
      const piezas = [...KC.NAVE.map((z) => L.zonas[z]?.malla), L.zonas[L.R.fin?.nave?.zona]?.malla, this.boton, this.slaimi,
        this.slaimiLuz, ...(this.pantallas ?? []).map((p) => p.me), L.cam];
      for (const o of piezas) if (o) g.attach(o);
      this.fuera.visible = true;
      L.cam.far = 3000;
      L.cam.updateProjectionMatrix();
    }
    una(D.ANCLAS, () => {
      L.sacude = Math.max(L.sacude, 0.8);
      this._son('final/anclaje', { volume: 1.0 });
    });
    una(D.BAHIA, () => this._son('final/bahia', { volume: 0.9, muffle: 0.35 }));
    una(D.CAE, () => {
      L.sacude = Math.max(L.sacude, 0.6);
      this.zumbido?.stop?.(1.5);
      this.zumbido = null;
      this._son('metal/tuberia', { volume: 0.6, pitch: 0.5 });
      if (L.slaimi) this._son('slaimi/gemido', { volume: 0.7, pitch: 1.2, when: 0.4 });
      this._son('n7/respira', { volume: 0.7, pitch: 1.2, when: 0.9 });
    });
    una(D.FURIA, () => {
      this._son('aberracion/furia', { volume: 0.9, muffle: 0.4 });
      this._son('aberracion/grito', { volume: 0.6, muffle: 0.6, when: 1.6 });
    });
    una(D.MOTOR, () => this._son('final/motor', { volume: 1.0 }));
    una(D.IGNICION, () => {
      L.sacude = Math.max(L.sacude, 1.4);
      this.flash = 1;
    });
    // las hojas de la trampilla: bajan un poco y se abren hacia los lados
    for (const [z, lado] of [[KC.BAHIA[0], -1], [KC.BAHIA[1], 1]]) {
      const m = L.zonas[z]?.malla;
      if (!m) continue;
      m.position.y = -0.25 * suave(D.BAHIA, D.BAHIA + 0.25, t);
      m.position.x = lado * 2.6 * suave(D.BAHIA + 0.2, D.BAHIA + 1.1, t);
    }
    // la caída, el giro (para ver el agujero del Hangar) y, con los motores, lejos
    const g = this.naveG;
    if (t > D.ANCLAS && t < D.CAE) g.position.y = this.pivote.y - 0.04;
    if (t >= D.CAE) {
      if (t < D.IGNICION) d.v.y -= D.G * dt;
      else {
        const adelante = new THREE.Vector3(0, 0, -1).applyEuler(g.rotation);
        d.v.addScaledVector(adelante, D.EMPUJE * dt);
        d.v.y *= Math.exp(-dt * 0.5);
      }
      g.position.addScaledVector(d.v, dt);
    }
    d.vel = d.v.length();
    this.naveY = g.position.y - this.pivote.y;
    const gira = suave(D.GIRA[0], D.GIRA[1], t);
    const pica = suave(D.PICA[0], D.PICA[1], t);
    g.rotation.y = D.YAW * gira;
    g.rotation.x = D.PITCH * gira * (1 - pica) + D.PITCH_FIN * pica;
    g.rotation.z = 0.12 * Math.sin(t * 0.7) * gira;
    // tu cabeza: mira hacia arriba al caer (el agujero) y vuelve al frente con los motores
    const objPitch = KC.MIRA_CONSOLA + (D.MIRA_ARRIBA - KC.MIRA_CONSOLA) * gira * (1 - pica);
    L.pitch += (objPitch - L.pitch) * Math.min(1, dt * 1.6);
    L.yaw += angulo(Math.PI / 2 - L.yaw) * Math.min(1, dt * 1.6);
    // (v1.43, el usuario: «en el despegue guía la vista hacia la ventanilla para que no mire paredes vacías»)
    const desv = angulo(L.yaw - Math.PI / 2), lim = KC.DESPEGUE.MIRA_MAX ?? 0.45;
    if (Math.abs(desv) > lim) L.yaw = Math.PI / 2 + Math.sign(desv) * lim;
    L.pitch = Math.max(objPitch - lim, Math.min(objPitch + lim, L.pitch));
    if (t > D.IGNICION && t < D.IGNICION + 1.2) L.sacude = Math.max(L.sacude, 0.7);
    L.sacude = Math.max(0, L.sacude - dt);
    this.flash = Math.max(0, (this.flash ?? 0) - dt * 1.5);
    // el fuego de dentro (la luz del Hangar por el parabrisas) se apaga al alejarte
    const Zc = L.zonas[KC.ZONA];
    if (Zc?.mat) Zc.mat.uniforms.uK.value = Zc.uK0 * (1 - 0.55 * suave(D.CAE, D.GIRA[1], t));
    for (const b of this.balizas) b.material.opacity = Math.sin(this.t * 3 + b.userData.fase) > 0.6 ? 1 : 0.1;
    if (t >= D.FIN_S) {
      // (v1.36, Fase 4) los finales: la nave se da la vuelta y, por el parabrisas, la VIGIA-7
      if (L.final4) {
        this.fase = 'espacio';
        const err = !!L.g.save?.flags?.erranteEnCabeza;
        L.final4.empieza(L.finalForzado ?? (L.slaimi ? (err ? 2 : 1) : (err ? 4 : 3)));
        return;
      }
      L.acabada = true;
      L.stop();
      this.zumbido?.stop?.(0.2);
      L.g._finLibre?.(L.nombre);
    }
  }

  /** (debug) Directo a los finales: como si ya hubieras despegado. */
  alEspacio() {
    const L = this.L, D = KC.DESPEGUE;
    this._crea();
    this.fase = 'despegue';
    this.pulsado = true;
    this.slaimiPuesto = !!L.slaimi;
    this.dejaSlaimi = L.dejaSlaimi = 1;
    this.encendidas = 0;
    this.tEnc = -10;
    const a = this._m.asiento;
    if (a) {
      L.x = a[0];
      L.y = a[1];
      L.ojosZ = a[2];
    }
    this.d = { t: D.FIN_S - 0.02, vel: 0, v: new THREE.Vector3(), hechos: new Set([D.ANCLAS, D.BAHIA, D.CAE, D.FURIA, D.MOTOR, D.IGNICION]) };
    this.naveY = 0;
  }

  /** La Aberración durante la caída: asomada al borde del agujero, inclinada hacia ti. Devuelve si se ve. */
  aberracion(A) {
    if (!this.d || this.d.t < KC.DESPEGUE.CAE || this.fase === 'espacio') return false;
    const [x, y] = KC.AB_BORDE;
    A.grupo.visible = true;
    A.grupo.position.set(x, Math.sin(this.t * 2.6) * 0.05, -y);
    A.grupo.rotation.set(-KC.AB_INCLINA * (0.8 + 0.2 * Math.sin(this.t * 1.3)), Math.PI, Math.sin(this.t * 1.7) * 0.05);
    return true;
  }

  /** Antes de dibujar: con la nave en el grupo que se mueve, la cámara va en sus coordenadas. */
  camara(cam) {
    if (this.naveG && cam.parent === this.naveG) cam.position.sub(this.pivote);
  }

  /** Lo que va encima en 2D: el fogonazo de los motores y el fundido final. */
  draw(ctx) {
    if (!this.activa) return;
    if (this.fase === 'espacio') {
      this.L.final4?.draw(ctx);
      return;
    }
    if (this.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,190,120,${(0.4 * this.flash).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    const D = KC.DESPEGUE;
    const negro = this.d ? suave(D.FUNDE, D.FIN_S - 0.2, this.d.t) : 0;
    if (negro > 0) {
      ctx.fillStyle = `rgba(0,0,0,${negro.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}
