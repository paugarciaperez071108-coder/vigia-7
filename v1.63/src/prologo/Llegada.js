// =============================================================
// Llegada.js — (v1.51, el prólogo «La llegada», Fase B; plan aprobado: «dale+»; el usuario, de noche: «haz la fase
// siguiente y cuando termines pasas a la siguiente») La llegada en nave, en primera persona, sentado en la nave de
// escape del final (la misma cabina, consola y pantallas: Cabina3D), en otro estado: «ATRAQUE / VIGIA-7».
//   0–8 s      por la ventanilla, la VIGIA-7 entera sobre el planeta, intacta y con todas las luces (el mismo modelo
//              y la misma vista que estalla en el final: Final4 con assets/final/tr/vigia_fuera_intacta.*); la nave
//              se acerca y pasa por debajo del Hangar
//   8–14,5 s   sube por el tubo de lanzamiento (el del final, al revés): las paredes pasan hacia abajo
//   14,5 s     los anclajes encajan con un golpe metálico; la trampilla se cierra debajo
//   14,5–18,5  silencio: no hay nadie esperando; solo el zumbido de la nave y las luces del Hangar
//   18,5–20,5  se abre la compuerta (la vista se gira hacia ella: el Hangar, vacío)
//   20,5–22    te levantas: empieza el camino (Fase C)
// Saltar: SOLO manteniendo una tecla (1,2 s), para que no se salte sin querer. Valores en PROLOGO.LLEGADA.
// =============================================================

import * as THREE from '../lib/three/three.module.min.js';
import { NIGHT7 } from '../night/night7.js';
import { PROLOGO } from '../night/prologo.js';
import { CONFIG } from '../config.js';
import { Final4 } from '../ending/Final4.js';

const K = NIGHT7.FINAL.LIBRE;
const KC = K.CABINA;
const P = PROLOGO.LLEGADA;
const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const b2t = (x, y, z) => new THREE.Vector3(x, z, -y);
const suave = (a, b, t) => {
  const k = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
const angulo = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const mezcla = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const bezier = (a, c, b, k) => a.map((v, i) => (1 - k) * (1 - k) * v + 2 * (1 - k) * k * c[i] + k * k * b[i]);

export class Llegada {
  constructor(libre) {
    this.L = libre;
    this.activa = false;
  }

  _son(clave, o = {}) {
    return this.L._son(clave, o);
  }

  /** Empieza (sentado en la cabina, fuera, lejos de la estación). */
  empieza() {
    const L = this.L, C = L.cabina;
    C._crea();
    this.activa = true;
    this.t = 0;
    this.hechos = new Set();
    this.mantiene = 0;
    this.mira = { yaw: 0, pitch: 0 };
    // las pantallas, ya encendidas, con lo del atraque
    C.encendidas = 0;
    C.t = 0;
    C.tEnc = -10;
    C.textoLlegada = (k) => this._texto(k);
    // sentado
    const a = C._m.asiento ?? [-6.55, 5.4, 2.2];
    this.asiento = a;
    L.x = a[0];
    L.y = a[1];
    L.ojosZ = a[2];
    L.base = 1.0;
    L.yaw = Math.PI / 2;
    L.pitch = 0;
    L.vx = L.vy = L.vel = 0;
    // la nave y todo lo de dentro, en un grupo que se mueve (la cámara, dentro)
    const pv = C._m.pivote ?? [-6, 3.6, 0];
    this.pivote = b2t(pv[0], pv[1], pv[2]);
    const g = this.g = C.naveG = new THREE.Group();
    C.pivote = this.pivote;
    g.position.copy(this.pivote);
    g.rotation.order = 'YXZ';
    L.escena.add(g);
    g.updateMatrixWorld(true);
    for (const o of [...KC.NAVE.map((z) => L.zonas[z]?.malla), L.zonas.compuerta?.malla, C.boton, ...(C.pantallas ?? []).map((p) => p.me), L.cam]) {
      if (o) g.attach(o);
    }
    if (C.fuera) C.fuera.visible = false;
    // la nave por dentro, en calma: sin el fuego del Hangar ni la alarma roja de la cabina (su luz horneada de siempre)
    for (const z of [...KC.NAVE, 'compuerta']) {
      const Z = L.zonas[z];
      if (Z?.mat) Z.mat.uniforms.uFlick = { value: z === KC.ZONA ? 0.12 : 0.0 };
    }
    // la compuerta, cerrada; la trampilla, abierta (por ella entra la nave)
    const Zc = L.zonas.compuerta;
    if (Zc?.malla) {
      Zc.malla.visible = true;
      this.compuertaX = Zc.malla.position.x;      // (dentro del grupo de la nave: su sitio, cerrada)
    }
    this._bahia(1);
    // la VIGIA-7 por fuera, intacta
    this.fuera = new Final4(L);
    this.fuera.carga(P.EXTERIOR).catch(() => null);
    L.cam.far = 9000;
    L.cam.updateProjectionMatrix();
    // el zumbido de la nave
    C.zumbido?.stop?.(0.1);
    C.zumbido = L.g.audio?.lib?.play('final/cabina', { loop: true, volume: KC.ZUMBIDO, pitchVar: 0, volVar: 0 }) || null;
    this._pose(0);
  }

  /** Las zonas de la estación (no las de la nave): no se ven mientras estás fuera. */
  _dentro() {
    const L = this.L;
    return Object.keys(L.zonas).filter((z) => L.zonas[z]?.malla && (z.startsWith('c_') || KC.BAHIA.includes(z)));
  }

  /** Las hojas de la trampilla del suelo del Hangar: k = 1 abiertas, 0 cerradas. */
  _bahia(k) {
    for (const [z, lado] of [[KC.BAHIA[0], -1], [KC.BAHIA[1], 1]]) {
      const m = this.L.zonas[z]?.malla;
      if (!m) continue;
      m.position.y = -0.25 * k;
      m.position.x = lado * 2.6 * k;
    }
  }

  /** Dónde va la nave (el pivote, coordenadas de Blender) y adónde mira. */
  _pose(t) {
    const T = P.T, L = this.L, g = this.g;
    let p;
    if (t < T.SUBE[0]) p = bezier(P.DESDE, P.CONTROL, P.BAJO, 1 - (1 - suave(0, T.SUBE[0], t)) ** 1.6);
    else if (t < T.TUBO[0]) p = mezcla(P.BAJO, P.BOCA, suave(T.SUBE[0], T.TUBO[0], t));
    else p = mezcla(P.BOCA, P.PIVOTE, 1 - (1 - Math.min(1, (t - T.TUBO[0]) / (T.ANCLA - T.TUBO[0]))) ** 2);
    g.position.copy(b2t(p[0], p[1], p[2]));
    // al principio, el morro hacia la estación (algo por debajo: que salga en el parabrisas); luego, recto
    const est = b2t(...P.MIRA);
    const d = est.clone().sub(g.position).normalize();
    const yawE = Math.atan2(-d.x, -d.z), pitE = Math.asin(d.y) - (P.MORRO ?? 0.2);
    const k = suave(T.GIRA[0], T.GIRA[1], t);
    g.rotation.y = yawE + angulo(0 - yawE) * k;
    g.rotation.x = pitE * (1 - k);
    g.rotation.z = 0;
    return p;
  }

  _texto(k) {
    const T = P.T, t = this.t;
    const dist = Math.round(this.g ? this.g.position.distanceTo(b2t(...P.MIRA)) : 0);
    return [
      ['EVAC-01 // ATRAQUE', '', 'DESTINO ....... VIGIA-7', `DISTANCIA ..... ${String(dist).padStart(4)} m`,
        `ANCLAJES ...... ${t >= T.ANCLA ? 'ENCAJADOS' : 'EN ESPERA'}`],
      ['ATRAQUE', '', `BAHIA 2 ....... ${t >= T.ANCLA + 1 ? 'CERRADA' : 'ABIERTA'}`, `COMPUERTA ..... ${t >= T.ABRE[0] ? 'ABIERTA' : 'CERRADA'}`],
      ['ESTACION VIGIA-7', '', 'SEÑAL ......... OK', 'COMITE DE RECEP. --', t >= T.CALMA[0] ? '!SIN RESPUESTA' : 'ESPERANDO...'],
    ][k];
  }

  /** Salta al final de la llegada (manteniendo una tecla): atracado, la compuerta abierta, de pie. */
  _salta() {
    this.t = P.T.FIN - 0.02;
    for (const n of [P.T.ANCLA, 'motor', 'bahia_abre', 'tubo', 'bahia_cierra', 'abre', 'respira']) this.hechos.add(n);
    this.L.sacude = 0;
  }

  /** Cada fotograma. Devuelve true mientras dura (Libre3D no anda). */
  update(dt) {
    if (!this.activa) return false;
    const L = this.L, C = L.cabina, T = P.T;
    // saltar: SOLO manteniendo una tecla
    // (espera a que esté la estación por fuera: si no, los primeros segundos serían negro)
    if (!this.fuera.grupo && (this.espera = (this.espera ?? 0) + dt) < 8) {
      this._pose(0);
      this.fuera.llegada(dt, false);
      for (const z of this._dentro()) L.zonas[z].malla.visible = false;
      return true;
    }
    this.mantiene = (L.pulsadas?.size ?? 0) > 0 ? this.mantiene + dt : 0;
    if (this.mantiene >= (P.SALTA_S ?? 1.2) && this.t < T.FIN - 0.1) this._salta();
    this.t += dt;
    const t = this.t;
    const una = (n, f) => {
      if (t >= (typeof n === 'number' ? n : P.SON[n]) && !this.hechos.has(n)) {
        this.hechos.add(n);
        f();
      }
    };
    C.t += dt;
    C._pantallas(dt);
    this._pose(t);
    // fuera (antes de meterse en el tubo) se ve la estación; dentro, el Hangar en calma y su tubo
    const fuera = t < T.TUBO[0] - 0.05;
    this.fuera.llegada(dt, fuera);
    for (const z of this._dentro()) L.zonas[z].malla.visible = !fuera;
    // los sonidos: el motor al acercarse, la trampilla, el tubo, los anclajes, la compuerta
    una('motor', () => this._son('final/motor', { volume: 0.35, pitch: 0.6, muffle: 0.4 }));
    una('bahia_abre', () => this._son('final/bahia', { volume: 0.45, muffle: 0.6 }));
    una('tubo', () => this._son('metal/tuberia', { volume: 0.5, pitch: 0.5 }));
    una(T.ANCLA, () => {
      L.sacude = Math.max(L.sacude ?? 0, 0.9);
      this._son('final/anclaje', { volume: 1.0 });
    });
    una('bahia_cierra', () => this._son('final/bahia', { volume: 0.7, muffle: 0.3 }));
    una('abre', () => {
      this._son('metal/tuberia', { volume: 0.6, pitch: 1.5 });
      this._son('final/anclaje', { volume: 0.4, pitch: 1.7, when: 0.1 });
    });
    una('respira', () => this._son('n7/respira', { volume: 0.4, pitch: 1.0 }));
    // la trampilla se cierra tras los anclajes; la compuerta se abre
    this._bahia(1 - suave(T.ANCLA + 0.3, T.ANCLA + 1.6, t));
    const Zc = L.zonas.compuerta;
    if (Zc?.malla) Zc.malla.position.x = (this.compuertaX ?? 0) + (P.ABRE ?? 1.6) * suave(T.ABRE[0], T.ABRE[1], t);
    // la vista: al frente (la estación); mirando arriba al subir (la panza y la boca del tubo); a la compuerta al
    // abrirse; de pie al final. El ratón, solo un poco (±MIRA_MAX)
    const arriba = suave(T.GIRA[0] + 1.0, T.SUBE[0] + 0.5, t) * (1 - suave(T.TUBO[0] + 0.5, T.ANCLA, t));
    const atras = suave(T.ABRE[0] - 0.3, T.ABRE[1], t);
    const a = this.asiento;
    const pie = suave(T.PIE[0], T.PIE[1], t);
    L.x = a[0] + 0.5 * atras - 0.05 * pie;
    L.y = a[1] - 0.9 * pie;
    L.ojosZ = a[2] + 0.18 * atras + (1.0 + K.OJOS - a[2] - 0.18) * pie;
    const vp = C._ventanucoEn?.() ?? { x: -6, y: -0.7, z: 2.1 };
    const ayaw = Math.atan2(vp.y - L.y, vp.x - L.x);
    let objYaw = Math.PI / 2 + angulo(ayaw - Math.PI / 2) * atras;
    let objPitch = (P.MIRA_ARRIBA ?? 0.08) + (P.ARRIBA ?? 0.95) * arriba - 0.12 * atras;
    const lim = P.MIRA_MAX ?? 0.2;
    if (!this.objAnt) this.objAnt = { yaw: objYaw, pitch: objPitch };
    this.mira.yaw = Math.max(-lim, Math.min(lim, angulo(L.yaw - this.objAnt.yaw))) * Math.exp(-dt * 0.8);
    this.mira.pitch = Math.max(-lim, Math.min(lim, L.pitch - this.objAnt.pitch)) * Math.exp(-dt * 0.8);
    L.yaw = objYaw + this.mira.yaw;
    L.pitch = objPitch + this.mira.pitch;
    this.objAnt = { yaw: objYaw, pitch: objPitch };
    if (t > T.TUBO[0] && t < T.ANCLA) L.sacude = Math.max(L.sacude ?? 0, 0.15);
    L.sacude = Math.max(0, (L.sacude ?? 0) - dt);
    // se acaba: la nave en su sitio, fuera del grupo; andas (Fase C)
    if (t >= T.FIN) this._acaba();
    return this.activa;
  }

  _acaba() {
    const L = this.L, C = L.cabina, g = this.g;
    this.activa = false;
    this._bahia(0);
    g.position.copy(this.pivote);
    g.rotation.set(0, 0, 0);
    g.updateMatrixWorld(true);
    for (const o of [...g.children]) L.escena.attach(o);
    L.escena.remove(g);
    C.naveG = null;
    this.fuera.llegada(0, false);
    for (const z of this._dentro()) L.zonas[z].malla.visible = L.activas.includes(z);
    // (v1.53) la compuerta ya abierta también para chocar: sus sólidos se corren lo mismo que su malla (si no, la hoja
    // cerrada, invisible, no te dejaba salir de la nave)
    const Zc = L.zonas.compuerta;
    if (Zc?.solidos && !this.solidosAbiertos) {
      this.solidosAbiertos = true;
      const dx = P.ABRE ?? 1.6;
      for (const s of Zc.solidos) {
        s.p = s.p.map(([x, y]) => [x + dx, y]);
        s.x0 += dx;
        s.x1 += dx;
      }
    }
    L.cam.far = 250;
    L.cam.updateProjectionMatrix();
    L.vx = L.vy = 0;
    L.alto = K.OJOS;
    L.ojosZ = L.base + K.OJOS;
    L.textoAyuda = 'W A S D: andar   ratón: mirar   Shift: correr   C: agacharse';
    L.ayuda = K.AYUDA_S;
    L.alLlegar?.();
  }

  /** Encima: el fundido de entrada y el círculo de «mantén para saltar» (solo mientras mantienes una tecla). */
  draw(ctx) {
    if (!this.activa) return;
    const negro = this.fuera?.grupo ? 1 - suave(0, 1.6, this.t) : 1;
    if (negro > 0) {
      ctx.fillStyle = `rgba(0,0,0,${negro.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.mantiene > 0.05) {
      const k = Math.min(1, this.mantiene / (P.SALTA_S ?? 1.2));
      ctx.save();
      ctx.strokeStyle = 'rgba(125,255,176,0.9)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(W - 70, H - 70, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
      ctx.stroke();
      ctx.fillStyle = 'rgba(232,238,245,0.55)';
      ctx.font = '16px "Courier New", monospace';
      ctx.textAlign = 'right';
      ctx.fillText('saltar', W - 104, H - 64);
      ctx.restore();
    }
  }
}
