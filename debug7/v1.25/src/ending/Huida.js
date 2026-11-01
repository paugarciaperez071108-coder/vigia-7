// =============================================================
// Huida.js — El final, Fase 2a: el camino tenso de la huida (plan del final, informes/plan_final/).
// Valores: NIGHT7.FINAL.HUIDA. Los planos son renders de Blender desde los ojos del protagonista, por las salas
// reales de la nave en su estado de las 6:00 (tools/3d/final/huida.py → integrar_huida.py → assets/final/huida/):
//   central   (W) la oficina queda atrás: el pasillo central, la viga caída (C/Ctrl: agacharse; si no, te das
//             con ella y te paras) y la compuerta reventada del Comedor
//   panel     (por tiempo) cae un panel del techo justo delante y revienta una tubería (vapor)
//   comedor   (W) rodeas el panel hasta el centro del Comedor
//   cruce mess    vista de 360° (como al levantarte): el Reactor (luz verde) o el Invernadero (en llamas: el calor
//                 te echa atrás)
//   reactor   (W) del Comedor al Reactor: una explosión lejana lo sacude todo y algo enorme se arrastra detrás
//             de las paredes
//   cruce reactor el Laboratorio (luz verde) o la Enfermería (el atajo, enterrado; «HANGAR >» medio tapado)
//   lab       (W) hasta la puerta del Laboratorio. Fundido (la persecución, Fase 2b, va después).
// Andar: W avanza el recorrido (soltarla, te paras); el ratón mueve un poco la vista. Nunca un texto que diga qué
// hacer, salvo la ayuda de controles pequeña del principio.
// =============================================================

import { CONFIG } from '../config.js';
import { NIGHT7 } from '../night/night7.js';
import { slaimiDe } from '../core/SaveData.js';
import { Pano360 } from '../render/Pano360.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const K = NIGHT7.FINAL.HUIDA;
const KC = K.CRUCE;
const KM = NIGHT7.FINAL.F1.MIRA;          // (el giro con el ratón en los cruces, como al levantarte)
const DIR = 'assets/final/huida/';
const ORDEN = [['tramo', 'central'], ['plano', 'panel'], ['tramo', 'comedor'], ['cruce', 'mess'],
  ['tramo', 'reactor'], ['cruce', 'reactor'], ['tramo', 'lab'], ['fin', null]];
const MARGEN = 1.1;                        // (los renders son un 10 % más grandes que la pantalla)

let IND = null;
const CRUCES = {};
fetch(`${DIR}indice.json`).then((r) => (r.ok ? r.json() : null)).then((d) => {
  IND = d;
  for (const c of Object.keys(d?.cruces ?? {})) {
    fetch(`${DIR}pano_${c}.json`).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) CRUCES[c] = j; }).catch(() => {});
  }
}).catch(() => {});

const CACHE = {};
function img(nombre) {
  let i = CACHE[nombre];
  if (!i) {
    i = CACHE[nombre] = new Image();
    i.src = `${DIR}${nombre}.webp`;
  }
  return i.complete && i.naturalWidth ? i : null;
}
const n3 = (n) => String(n).padStart(3, '0');
let BRAZOS = null;                         // (Slaimi en tus brazos: la capa de la Fase 1)
function brazos() {
  if (!BRAZOS) {
    BRAZOS = new Image();
    BRAZOS.src = `${DIR}brazos.webp`;               // (la de la Fase 1 sin el humo de la oficina, integrar_huida.py)
  }
  return BRAZOS.complete && BRAZOS.naturalWidth ? BRAZOS : null;
}

export class Huida {
  constructor(game) {
    this.g = game;
    this.activa = false;
  }

  /** ¿Están sus planos? (si no, el final sigue como antes: la pantalla provisional) */
  static lista() {
    return !!IND?.tramos?.central;
  }

  /** desde: el paso de ORDEN por el que empezar (debug: 'mess', 'reactor'…) */
  start(desde = null) {
    this.slaimi = slaimiDe(this.g.save?.flags)?.estado === 'vivo';
    this.activa = true;
    this.t = 0;
    this.paso = desde ? Math.max(0, ORDEN.findIndex(([t, n]) => n === desde && t !== 'fin')) : 0;
    this.teclas = new Set();
    this.ayuda = K.AYUDA_S;
    this.latidoIn = 0.3;
    this.fuegoIn = 0.5;
    this.alarmaIn = 1.5;
    this.respiraIn = 2.0;
    this.sacude = 0;
    this.fundido = 1;                  // (entra desde negro: el fundido de la Fase 1)
    this._empiezaPaso();
  }

  _son(clave, o = {}) {
    this.g.audio?.lib?.play(clave, { pitchVar: 0.04, ...o });
  }

  get acabada() { return this.fase === 'fin' && this.ft > K.FIN_S + 0.5; }

  // ------------------------------------------------------------------ los pasos
  _empiezaPaso() {
    const [tipo, nombre] = ORDEN[this.paso];
    this.tipo = tipo;
    this.nombre = nombre;
    this.fase = tipo;
    this.ft = 0;
    if (tipo === 'tramo') {
      const T = IND?.tramos?.[nombre];
      this.n = T?.n ?? 0;
      this.viga = T?.viga ?? [];
      this.pos = 0;                   // (fotograma, con decimales)
      this.vel = 0;                   // (m/s)
      this.pasoM = 0;
      this.agachado = false;
      this.golpes = 0;
      this.explotado = false;
      this._precarga(nombre, this.n);
      const sig = ORDEN[this.paso + 1];
      if (sig?.[0] === 'plano') this._precarga(sig[1], IND?.tramos?.[sig[1]]?.n ?? 0);
      if (sig?.[0] === 'cruce') this._precargaCruce(sig[1]);
    } else if (tipo === 'plano') {
      this.n = IND?.tramos?.[nombre]?.n ?? 0;
      this.golpe = IND?.tramos?.[nombre]?.golpe ?? 10;
      this.sonado = false;
      this.golpeado = false;
      this._son('n7/crujido', { volume: 0.7 });
      this._son('n7/metal', { volume: 0.6, when: 0.4 });
    } else if (tipo === 'cruce') {
      const C = CRUCES[nombre];
      if (!C || !this._base()) { this._siguiente(); return; }      // (sin su vista: sigue andando)
      this.pano ??= new Pano360(1280, 720);
      [this.giro, this.incl] = C.inicio;
      this.reac = null;
      this.nReac = 0;
      this.mirandoBuena = 0;
      this.aireIn = 0;
      const sig = ORDEN[this.paso + 1];
      if (sig?.[0] === 'tramo') this._precarga(sig[1], IND?.tramos?.[sig[1]]?.n ?? 0);
    } else if (tipo === 'fin') {
      this._son('n7/lejano', { volume: 0.8 });
    }
  }

  _siguiente() {
    this.paso = Math.min(ORDEN.length - 1, this.paso + 1);
    this._empiezaPaso();
  }

  _precarga(nombre, n) {
    for (let i = 0; i < n; i++) img(`${nombre}_${n3(i)}`);
  }

  _precargaCruce(c) {
    img(`pano_${c}`);
    for (let i = 0; i < (IND?.cruces?.[c] ?? 0); i++) img(`pano_${c}_fuego_${n3(i)}`);
  }

  _base() {
    return img(`pano_${this.nombre}`);
  }

  // ------------------------------------------------------------------ teclas
  tecla(code) {
    this.teclas.add(code);
    if (code === 'KeyC' || code === 'ControlLeft' || code === 'ControlRight') this._agacha();
    if (this.tipo === 'cruce' && (code === 'KeyW' || code === 'ArrowUp')) this._andaCruce();
  }

  keyUp(code) {
    this.teclas.delete(code);
  }

  /** (al perder el foco la ventana) */
  suelta() {
    this.teclas.clear();
  }

  click() {
    if (this.tipo === 'cruce') this._andaCruce();
  }

  _anda() {
    return this.teclas.has('KeyW') || this.teclas.has('ArrowUp');
  }

  _agacha() {
    if (this.tipo !== 'tramo' || !this.viga.length || this.agachado) return;
    // (antes de la viga o parado contra ella)
    if (this.pos <= this.viga[this.viga.length - 1]) {
      this.agachado = true;
      this._son('pasos/metal', { volume: 0.35, pitch: 0.8 });
    }
  }

  // ------------------------------------------------------------------ andar (los recorridos)
  _updateTramo(dt) {
    const porM = IND?.por_m ?? 7;
    const quiere = this._anda() ? K.VEL * (this._bajoViga() ? K.AGACHADO : 1) : 0;
    this.vel += Math.sign(quiere - this.vel) * Math.min(Math.abs(quiere - this.vel), K.ACELERA * dt);
    let nueva = this.pos + this.vel * porM * dt;
    // la viga: sin agacharse, te das con ella y te paras justo antes
    if (this.viga.length && !this.agachado && nueva >= this.viga[0] - 1) {
      const tope = this.viga[0] - 1;
      // (contra la viga, insistiendo con W: otro golpe cada poco)
      this.empuje = this.pos >= tope && this._anda() ? (this.empuje ?? 0) + dt : 0;
      if ((this.vel > 0.3 && this.pos < tope) || this.empuje > 1.1) {
        this.empuje = 0;
        this.golpes++;
        this.sacude = 0.9;
        this._son('metal/golpe_pared', { volume: 0.9, pitch: 0.9 });
        this._son('n7/respira', { volume: 0.5, when: 0.25 });
        if (this.golpes >= 2) this.ayuda = Math.max(this.ayuda, 4);     // (vuelve la ayuda de controles)
      }
      nueva = tope;
      this.vel = 0;
    }
    const d = (nueva - this.pos) / porM;
    this.pos = Math.min(this.n - 1, Math.max(0, nueva));
    // los pasos
    this.pasoM += d;
    if (this.pasoM >= K.PASO_M) {
      this.pasoM -= K.PASO_M;
      this._son('pasos/metal', { volume: this._bajoViga() ? 0.35 : 0.55 });
    }
    // el Reactor: la explosión lejana y algo enorme detrás de las paredes
    if (this.nombre === 'reactor' && !this.explotado && this.pos >= this.n * K.EXPLOSION_EN) {
      this.explotado = true;
      this.sacudidaT = K.SACUDIDA_S;
      this._son('n7/explosion', { volume: 0.9, pitch: 0.6, muffle: 0.5 });
      this._son('n7/crujido', { volume: 0.8, when: 0.3 });
      this._son('aberracion/arrastre', { volume: 0.7, when: 1.6, pan: -0.7, muffle: 0.6 });
      this._son('aberracion/metal', { volume: 0.5, when: 2.6, pan: -0.4, muffle: 0.6 });
    }
    if (this.pos >= this.n - 1) this._siguiente();
  }

  _bajoViga() {
    return this.agachado && this.viga.length && this.pos >= this.viga[0] - 3 && this.pos <= this.viga[this.viga.length - 1];
  }

  // ------------------------------------------------------------------ los cruces
  _apunta() {
    let mejor = null;
    let dmin = KM.APUNTA;
    for (const [k, [g, i]] of Object.entries(CRUCES[this.nombre].salidas)) {
      const d = Pano360.distancia(this.giro, this.incl, g, i);
      if (d < dmin) { dmin = d; mejor = k; }
    }
    return mejor;
  }

  _andaCruce() {
    if (this.reac || this.fase === 'sale') return;
    const s = this._apunta();
    if (!s) {
      this._son('pasos/metal', { volume: 0.4 });
      this.sacude = Math.max(this.sacude, 0.2);
      return;
    }
    if (s === KC.BUENA[this.nombre]) {
      this.fase = 'sale';
      this.ft = 0;
      [this.giroSale, this.inclSale] = CRUCES[this.nombre].salidas[s];
      this.giro0 = this.giro;
      this.incl0 = this.incl;
      for (let k = 0; k < 2; k++) this._son('pasos/metal', { volume: 0.6, when: 0.1 + k * 0.4 });
      return;
    }
    const lista = KC.REACCIONES[s] ?? ['empuja', 'tose', 'slaimi'];
    let tipo = lista[this.nReac++ % lista.length];
    if (tipo === 'slaimi' && !this._conSlaimi()) tipo = 'retrocede';
    this.reac = { tipo, t: 0, dur: { empuja: 1.5, tose: 2.0, slaimi: 1.4, retrocede: 1.2, calor: 1.4 }[tipo] };
    if (tipo === 'empuja') {
      this._son('metal/golpe_pared', { volume: 0.9 });
      this._son('final/escombros', { volume: 0.9, when: 0.18 });
    } else if (tipo === 'tose') {
      this._son('final/tos', { volume: 0.9 });
    } else if (tipo === 'slaimi') {
      this._son('slaimi/gemido', { volume: 0.8, pitch: 1.15 });
      this._son('slaimi/gemido', { volume: 0.5, pitch: 1.25, when: 0.5 });
    } else if (tipo === 'calor') {
      this._son('n7/fuego', { volume: 1.0 });
      this._son('n7/respira', { volume: 0.7, when: 0.1, pitch: 1.2 });
      this._son('pasos/metal', { volume: 0.6, when: 0.25 });
    } else {
      this._son('pasos/metal', { volume: 0.6 });
      this._son('pasos/metal', { volume: 0.5, when: 0.35 });
    }
  }

  _updateCruce(dt) {
    const C = CRUCES[this.nombre];
    if (this.fase === 'sale') {
      // giras hacia la salida y das unos pasos; el recorrido siguiente empieza mirándola
      const k = Math.min(1, this.ft / KC.SALE_S);
      const e = k * k * (3 - 2 * k);
      this.giro = this.giro0 + (((this.giroSale - this.giro0 + 540) % 360) - 180) * e;
      this.incl = this.incl0 + (C.inicio[1] - this.incl0) * e;
      if (this.ft >= KC.SALE_S) this._siguiente();
      return;
    }
    const m = this.g.mouse ?? { x: W / 2, y: H / 2 };
    const dx = (m.x - W / 2) / (W / 2);
    if (Math.abs(dx) > KM.BORDE && !this.reac) {
      this.giro += Math.sign(dx) * KM.GIRO_MAX * ((Math.abs(dx) - KM.BORDE) / (1 - KM.BORDE)) ** 1.4 * dt;
    }
    this.giro = ((this.giro + 540) % 360) - 180;
    const inclObj = -Math.max(-1, Math.min(1, (m.y - H / 2) / (H / 2))) * KM.INCL_MAX;
    if (!this.reac) this.incl += (inclObj - this.incl) * Math.min(1, dt * 5);
    const [gb, ib] = C.salidas[KC.BUENA[this.nombre]];
    const d = Pano360.distancia(this.giro, this.incl, gb, ib);
    this.mirandoBuena += (Math.max(0, 1 - d / 50) - this.mirandoBuena) * Math.min(1, dt * 3);
    this.aireIn -= dt;
    if (this.aireIn <= 0) {
      this.aireIn = 4.2;
      const rel = ((gb - this.giro + 540) % 360) - 180;
      this._son('final/aire', { volume: KM.AIRE_VOL * (0.2 + 0.6 * this.mirandoBuena), pan: Math.max(-1, Math.min(1, rel / 90)) });
    }
    if (this.reac) {
      const r = this.reac;
      r.t += dt;
      if (r.tipo === 'empuja' && r.t < 0.5) this.sacude = Math.max(this.sacude, 0.8 * (1 - r.t / 0.5));
      if (r.tipo === 'tose') this.incl += ((inclObj - 9 * Math.sin(Math.min(1, r.t / r.dur) * Math.PI)) - this.incl) * Math.min(1, dt * 6);
      if (r.tipo === 'tose' && r.t < 1.2) this.sacude = Math.max(this.sacude, 0.3 + 0.25 * Math.abs(Math.sin(r.t * 14)));
      if (r.tipo === 'calor' && r.t < 0.4) this.sacude = Math.max(this.sacude, 0.5);
      if (r.t >= r.dur) this.reac = null;
    }
  }

  _conSlaimi() {
    return this.slaimi && !!brazos();
  }

  // ------------------------------------------------------------------ update
  update(dt) {
    if (!this.activa) return;
    this.t += dt;
    this.ft += dt;
    this.ayuda = Math.max(0, this.ayuda - dt);
    this.sacude = Math.max(0, this.sacude - dt * 1.8);
    this.fundido = Math.max(0, this.fundido - dt / 0.8);
    if (this.sacudidaT > 0) {
      this.sacudidaT -= dt;
      this.sacude = Math.max(this.sacude, 0.9 * Math.max(0, this.sacudidaT / K.SACUDIDA_S));
    }
    if (this.tipo === 'tramo') this._updateTramo(dt);
    else if (this.tipo === 'plano') {
      const fps = IND?.fps ?? 12;
      if (!this.sonado && this.ft * fps >= this.golpe * 0.45) {
        this.sonado = true;
        this._son('n7/vapor', { volume: 0.9, pan: 0.4 });
      }
      if (!this.golpeado && this.ft * fps >= this.golpe) {
        this.golpeado = true;
        this.sacude = 1;
        this._son('n7/panel', { volume: 1 });
        this._son('metal/panel', { volume: 0.8, when: 0.05 });
      }
      if (this.ft * fps >= this.n - 1) this._siguiente();
    } else if (this.tipo === 'cruce') this._updateCruce(dt);
    if (this.fase === 'fin') return;
    // el cuerpo y la nave: el corazón, la respiración, el fuego y la alarma
    this.latidoIn -= dt;
    if (this.latidoIn <= 0) {
      this.latidoIn = 60 / K.PULSO;
      this._son('n7/latido', { volume: 0.4, pitch: 0.9 });
    }
    this.respiraIn -= dt;
    if (this.respiraIn <= 0) {
      this.respiraIn = 2.6 + Math.random() * 1.2;
      this._son('n7/respira', { volume: 0.35 + 0.15 * Math.min(1, Math.abs(this.vel ?? 0)) });
    }
    this.fuegoIn -= dt;
    if (this.fuegoIn <= 0) {
      this.fuegoIn = 2.4;
      this._son('n7/fuego', { volume: 0.45 });
    }
    this.alarmaIn -= dt;
    if (this.alarmaIn <= 0) {
      this.alarmaIn = 3.2;
      this._son('n7/alarma', { volume: 0.3, muffle: 0.3 });
    }
  }

  // ------------------------------------------------------------------ draw
  draw(ctx) {
    if (!this.activa) return;
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const sx = (Math.random() - 0.5) * 18 * this.sacude;
    const sy = (Math.random() - 0.5) * 12 * this.sacude;
    let andando = 0;
    if (this.tipo === 'tramo' || this.tipo === 'plano' || (this.tipo === 'fin')) {
      const nombre = this.tipo === 'fin' ? ORDEN[ORDEN.length - 2][1] : this.nombre;
      const n = IND?.tramos?.[nombre]?.n ?? 1;
      let i;
      if (this.tipo === 'plano') i = Math.min(n - 1, Math.floor(this.ft * (IND?.fps ?? 12)));
      else if (this.tipo === 'fin') i = n - 1;
      else i = Math.floor(this.pos);
      const im = img(`${nombre}_${n3(i)}`) ?? this._ultima;
      if (im) {
        this._ultima = im;
        // el ratón mueve un poco la vista (el render es un 10 % más grande)
        const m = this.g.mouse ?? { x: W / 2, y: H / 2 };
        const mx = Math.max(-1, Math.min(1, (m.x - W / 2) / (W / 2))) * K.RATON;
        const my = Math.max(-1, Math.min(1, (m.y - H / 2) / (H / 2))) * K.RATON;
        this.mx = (this.mx ?? 0) + (mx - (this.mx ?? 0)) * 0.08;
        this.my = (this.my ?? 0) + (my - (this.my ?? 0)) * 0.08;
        const ew = W * MARGEN;
        const eh = H * MARGEN;
        // parado: respiras (la vista sube y baja un poco)
        const resp = this.tipo === 'tramo' ? Math.sin(this.t * 1.7) * 3 * (1 - Math.min(1, Math.abs(this.vel) / 0.5)) : 0;
        ctx.drawImage(im, -(ew - W) / 2 * (1 + this.mx) + sx, -(eh - H) / 2 * (1 + this.my) + sy + resp, ew, eh);
      }
      andando = this.tipo === 'tramo' ? Math.min(1, Math.abs(this.vel) / K.VEL) : 0;
    } else if (this.tipo === 'cruce') {
      this._drawCruce(ctx, sx, sy);
    }
    // la luz del fuego (parpadea encima, muy poco: el render se queda quieto si te paras)
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,120,40,${(0.025 + 0.02 * Math.sin(this.t * 11) * Math.sin(this.t * 6.3)).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    this._drawSlaimi(ctx, andando);
    // el viñeteado
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // toser / el calor: la vista se nubla o se enrojece un momento
    const r = this.reac;
    if (r?.tipo === 'tose') {
      ctx.fillStyle = `rgba(40,34,28,${(0.35 * Math.sin(Math.min(1, r.t / r.dur) * Math.PI)).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    } else if (r?.tipo === 'calor') {
      ctx.fillStyle = `rgba(255,110,30,${(0.28 * Math.sin(Math.min(1, r.t / 0.5) * Math.PI) * (r.t < 0.5 ? 1 : 0)).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    // la ayuda de controles pequeña (solo al principio, y si te das dos veces con la viga)
    if (this.ayuda > 0) {
      ctx.globalAlpha = Math.min(1, this.ayuda / 1.2) * 0.75;
      ctx.fillStyle = '#d8dde6';
      ctx.font = '18px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('W: andar   C: agacharse   ratón: mirar', 24, H - 24);
      ctx.globalAlpha = 1;
    }
    // el fundido de entrada y el de salida
    const negro = this.fase === 'fin' ? Math.min(1, this.ft / K.FIN_S) : this.fundido;
    if (negro > 0) {
      ctx.fillStyle = `rgba(0,0,0,${negro.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  _drawCruce(ctx, sx, sy) {
    const n = IND?.cruces?.[this.nombre] ?? 0;
    let capa = null;
    let capa2 = null;
    let mezcla = 0;
    if (n) {
      const f = (this.t * (IND?.fps ?? 12)) % n;
      const i = Math.floor(f);
      capa = img(`pano_${this.nombre}_fuego_${n3(i)}`);
      // (las llamas son un bucle cerrado de Blender: entre un fotograma y el siguiente, un fundido)
      capa2 = img(`pano_${this.nombre}_fuego_${n3((i + 1) % n)}`);
      mezcla = f - i;
    }
    this.pano.pon(this._base(), capa, capa2, mezcla);
    let campo = KC.CAMPO;
    const r = this.reac;
    if (r?.tipo === 'empuja') campo -= 6 * Math.sin(Math.min(1, r.t / 0.35) * Math.PI);
    if (r?.tipo === 'retrocede' || r?.tipo === 'calor') campo += 9 * Math.sin(Math.min(1, r.t / r.dur) * Math.PI);
    if (this.fase === 'sale') campo -= 8 * Math.min(1, this.ft / KC.SALE_S);
    const paso = this.fase === 'sale' ? Math.sin(this.ft * 9) * 1.0 : 0;
    const luz = 1 + 0.05 * Math.sin(this.t * 13) * Math.sin(this.t * 7.1);
    this.pano.draw(ctx, this.giro + sx * 0.2, this.incl + sy * 0.2 + paso, campo, luz, 0, 0, W, H);
  }

  /** Slaimi en tus brazos, abajo (si vive): se mece con el paso, tiembla al asustarse y brilla más mirando la buena salida. */
  _drawSlaimi(ctx, andando) {
    const br = this.slaimi ? brazos() : null;
    if (!br) return;
    const r = this.reac;
    const tiembla = r?.tipo === 'slaimi' ? (1 - r.t / r.dur) : (this.sacude > 0.5 ? 0.4 : 0);
    const fase = (this.pos ?? 0) / (IND?.por_m ?? 7) / K.PASO_M * Math.PI;
    const bx = (Math.random() - 0.5) * 10 * tiembla + Math.sin(this.t * 1.7) * 4 + Math.sin(fase) * 6 * andando;
    const by = H * KM.BRAZOS_BAJA + Math.abs(Math.cos(fase)) * 10 * andando + Math.sin(this.t * 2.3) * 3
      + (this.tipo === 'cruce' ? Math.max(0, -this.incl) * 1.5 : 0);
    ctx.drawImage(br, bx, by, W, H);
    const brillo = 0.15 + KM.BRILLO_SLAIMI * (this.tipo === 'cruce' ? this.mirandoBuena : 0.15) * (0.85 + 0.15 * Math.sin(this.t * 5));
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
