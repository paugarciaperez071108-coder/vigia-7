// =============================================================
// Persecucion.js — El final, Fase 2b: la persecución de la Aberración (plan del final, informes/plan_final/).
// Valores: NIGHT7.FINAL.PERSECUCION. Como la huida (Huida.js, de la que hereda andar, la viga, los cruces y
// Slaimi en brazos), planos de Blender desde los ojos del protagonista (tools/3d/final/persecucion.py →
// integrar_persecucion.py → assets/final/persecucion/):
//   lab       (W) entras en el Laboratorio
//   revienta  (por tiempo) la pared este revienta y entra la Aberración ardiendo: te mira, ruge y se lanza
//   huye      (W, a la carrera) el Laboratorio y el pasillo hasta la Criogenia
//   cryo      (W) la viga caída (C/Ctrl) y el suelo ardiendo a la izquierda (D: apartarse; si no, te quemas)
//   derrumbe  (por tiempo) la puerta de evacuación estalla y se derrumba
//   rejilla   (W) a la boca del conducto oculto, y a gatas dentro
//   conducto  (W, a gatas) ella no cabe: golpea la boca detrás de ti
//   sale      (W) la rejilla de la Enfermería: caes al suelo, te levantas, hasta el cruce
//   cruce medbay  el Hangar (la luz verde) o el pasillo del Reactor (humo, sin salida)
//   forzar    (cada W, un poco) la puerta del Hangar, atascada
//   hangar    (W, a la carrera) el pasillo del Hangar. Fundido (el Hangar y la nave, Fase 2c, van después).
// La Aberración, detrás: «distancia» de 0 (lejos) a 1 (encima). Sube parado, con cada golpe, quemadura o salida
// mala, mientras fuerzas la puerta; baja corriendo; en el conducto no cabe. Cerca: el borde rojo, su respiración
// y sus golpes. Si llega a 1, su susto y vuelves al principio de la persecución (el punto de control
// 'n7persecucion'). Slaimi, una vez, la ciega con su luz y te da un respiro.
// =============================================================

import { CONFIG } from '../config.js';
import { NIGHT7 } from '../night/night7.js';
import { Huida, datosFinal } from './Huida.js';
import { drawJumpscare } from '../ui/Jumpscare.js';
import { SaveData } from '../core/SaveData.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const K = NIGHT7.FINAL.PERSECUCION;
const KA = K.ABERRACION;
const DIR = 'assets/final/persecucion/';
const ORDEN = [['tramo', 'lab'], ['plano', 'revienta'], ['tramo', 'huye'], ['tramo', 'cryo'], ['plano', 'derrumbe'],
  ['tramo', 'rejilla'], ['tramo', 'conducto'], ['tramo', 'sale'], ['cruce', 'medbay'], ['forzar', 'forzar'],
  ['tramo', 'hangar'], ['fin', null]];
const CORRIENDO = new Set(['huye', 'cryo', 'hangar']);
datosFinal(DIR);

export class Persecucion extends Huida {
  constructor(game) {
    super(game, { dir: DIR, orden: ORDEN, K });
  }

  static lista() {
    return !!datosFinal(DIR).ind?.tramos?.huye;
  }

  /** desde: como en la huida ('huye' = el punto de control, el principio de la persecución) */
  start(desde = null) {
    this.dist = KA.INICIO;
    this.caza = false;              // (la Aberración ya va detrás: desde que se lanza en «revienta»)
    this.respiro = false;
    this.atrapado = null;
    this.flashSlaimi = 0;
    this.quema = 0;
    this.abRespIn = 1.5;
    this.abPasoIn = 0.8;
    this.golpeIn = 2.0;
    this.textoAyuda = null;
    super.start(desde);
    if (this.paso >= ORDEN.findIndex(([, n]) => n === 'huye')) this._empiezaCaza();
  }

  _empiezaCaza() {
    if (this.caza) return;
    this.caza = true;
    this.dist = Math.max(this.dist, KA.INICIO);
    // el punto de control: si te atrapa (o sales al menú), vuelves aquí
    const g = this.g;
    if (g.saveEnabled !== false && !g.debugNight && !g.debugFinal && g.save) {
      g.save = { ...g.save, night: 7, checkpoint: 'n7persecucion' };
      SaveData.save(g.save);
    }
  }

  get acabada() { return this.fase === 'fin' && this.ft > K.FIN_S + 0.5; }

  // ------------------------------------------------------------------ los pasos
  _empiezaPaso() {
    const [tipo, nombre] = this.orden[this.paso];
    if (tipo === 'forzar') {
      this.tipo = this.fase = tipo;
      this.nombre = nombre;
      this.ft = 0;
      this.n = this.D.ind?.tramos?.forzar?.n ?? 1;
      this.fpos = 0;
      this.vel = 0;
      const sig = this.orden[this.paso + 1];
      if (sig?.[0] === 'tramo') this._precarga(sig[1], this.D.ind?.tramos?.[sig[1]]?.n ?? 0);
      this._son('metal/golpe_pared', { volume: 0.8, pitch: 0.7 });
      return;
    }
    super._empiezaPaso();
    this.eventos = new Set();
    if (tipo === 'plano') {
      // (los sonidos de la huida para los planos, no: cada uno los suyos, en _updatePlano)
      const sig = this.orden[this.paso + 1];
      if (sig?.[0] === 'tramo') this._precarga(sig[1], this.D.ind?.tramos?.[sig[1]]?.n ?? 0);
    }
    if (tipo === 'tramo') {
      const T = this.D.ind?.tramos?.[nombre] ?? {};
      this.fuegoR = T.fuego ?? [];
      this.gatas = T.gatas ?? [];
      this.cae = T.cae ?? -1;
      this.esquiva = false;
      this.quemado = false;
      this.caido = false;
      if (nombre === 'huye') {
        this._empiezaCaza();
        this.textoAyuda = 'W: correr   C: agacharse   A / D: apartarse';
        this.ayuda = K.AYUDA_S;
      }
      if (nombre === 'conducto') this.golpeIn = 1.2;
      if (nombre === 'sale') this.dist = Math.max(this.dist, KA.SALE);     // (da la vuelta por fuera: viene)
    }
  }

  // ------------------------------------------------------------------ teclas
  tecla(code) {
    if (this.atrapado) return;
    if (this.tipo === 'forzar' && (code === 'KeyW' || code === 'ArrowUp') && !this.teclas.has(code)) this._empuja();
    if (code === 'KeyA' || code === 'ArrowLeft') this._aparta(-1);
    if (code === 'KeyD' || code === 'ArrowRight') this._aparta(1);
    super.tecla(code);
  }

  click() {
    if (this.atrapado) return;
    if (this.tipo === 'forzar') this._empuja();
    else super.click();
  }

  /** D: apartarse del fuego (está a la izquierda); A, hacia él. */
  _aparta(lado) {
    if (this.tipo !== 'tramo' || !this.fuegoR.length || this.esquiva || this.quemado) return;
    const f0 = this.fuegoR[0];
    if (this.pos < f0 - K.ESQUIVA_ANTES || this.pos > f0 + 2) return;
    this._son('pasos/metal', { volume: 0.6, pitch: 1.1 });
    this.sacude = Math.max(this.sacude, 0.3);
    if (lado > 0) this.esquiva = true;
    else this._quemate();
  }

  _quemate() {
    if (this.quemado) return;
    this.quemado = true;
    this.quema = 1;
    this.vel *= 0.3;
    this.sacude = 0.8;
    this.dist += KA.QUEMA;
    this._son('n7/fuego', { volume: 1.0, pitch: 1.2 });
    this._son('final/tos', { volume: 0.8, when: 0.15 });
    this._son('n7/respira', { volume: 0.8, pitch: 1.3, when: 0.4 });
  }

  _empuja() {
    if (this.tipo !== 'forzar' || this.fase === 'abierta') return;
    this.fpos = Math.min(this.n - 1, this.fpos + K.FORZAR.POR_W);
    this.sacude = Math.max(this.sacude, 0.45);
    this._son('metal/golpe_pared', { volume: 0.75, pitch: 0.8 + Math.random() * 0.15 });
    this._son('final/golpe', { volume: 0.5, when: 0.04 });
    if (this.fpos >= this.n - 1) {
      this.fase = 'abierta';
      this.ft = 0;
      this._son('metal/tuberia', { volume: 0.9, pitch: 0.7 });
    }
  }

  _andaCruce() {
    const antes = this.reac;
    super._andaCruce();
    if (this.reac && this.reac !== antes) this.dist += KA.MALA;
  }

  _golpeViga() {
    this.dist += KA.GOLPE;
  }

  // ------------------------------------------------------------------ andar
  _velMax() {
    if (this.nombre === 'lab') return K.VEL;
    if (this._aGatas()) return K.GATAS;
    const v = CORRIENDO.has(this.nombre) ? K.CORRE : K.VEL;
    return v * (this._bajoViga() ? K.AGACHADO : 1) * (this.quema > 0.5 ? 0.6 : 1);
  }

  _aGatas() {
    return this.nombre === 'conducto' || (this.gatas.length && this.pos >= this.gatas[0] && this.pos <= this.gatas[this.gatas.length - 1]);
  }

  _pasoLargo() {
    return this._aGatas() ? 0.35 : CORRIENDO.has(this.nombre) ? K.PASO_CORRE : K.PASO_M;
  }

  _pisada() {
    if (this._aGatas()) this._son('pasos/rejilla', { volume: 0.32, pitch: 0.85 });
    else this._son('pasos/metal', { volume: this._bajoViga() ? 0.35 : CORRIENDO.has(this.nombre) ? 0.7 : 0.55 });
  }

  _updateTramo(dt) {
    super._updateTramo(dt);
    if (this.tipo !== 'tramo') return;
    // el fuego del suelo: si no te has apartado, te quemas al pasar
    if (this.fuegoR.length && !this.esquiva && !this.quemado && this.pos >= this.fuegoR[0]) this._quemate();
    // la caída de la rejilla de la Enfermería
    if (this.cae >= 0 && !this.caido && this.pos >= this.cae + 4) {
      this.caido = true;
      this.sacude = 0.9;
      this._son('caidas/caja', { volume: 0.8, pitch: 0.7 });
      this._son('pasos/metal', { volume: 0.8, pitch: 0.7, when: 0.05 });
      this._son('n7/respira', { volume: 0.6, when: 0.3 });
    }
  }

  // ------------------------------------------------------------------ los planos por tiempo
  _evento(nombre, en, fn) {
    if (!this.eventos.has(nombre) && this.ft * (this.D.ind?.fps ?? 12) >= en) {
      this.eventos.add(nombre);
      fn();
    }
  }

  _updatePlano() {
    const T = this.D.ind?.tramos?.[this.nombre] ?? {};
    if (this.nombre === 'revienta') {
      (T.golpes ?? []).forEach((g, k) => this._evento('golpe' + k, g, () => {
        this.sacude = Math.max(this.sacude, 0.35 + 0.15 * k);
        this._son('metal/golpe_pared', { volume: 0.7 + 0.1 * k, pitch: 0.55 });
        this._son('aberracion/metal', { volume: 0.6 + 0.1 * k, when: 0.05 });
      }));
      this._evento('revienta', T.revienta ?? 42, () => {
        this.sacude = 1;
        this._son('n7/explosion', { volume: 1.0, pitch: 0.8 });
        this._son('metal/panel', { volume: 1.0 });
        this._son('final/escombros', { volume: 1.0, when: 0.1 });
        this._son('final/escombros', { volume: 0.8, when: 0.45 });
      });
      this._evento('ruge', T.ruge ?? 56, () => {
        this._son('aberracion/furia', { volume: 1.0 });
        this._son('aberracion/grito', { volume: 0.7, when: 0.35 });
      });
      this._evento('lanza', T.lanza ?? 66, () => {
        this.caza = true;
        this._son('aberracion/arrastre', { volume: 1.0 });
        this._son('aberracion/dedos', { volume: 0.8, when: 0.3 });
      });
      this._evento('gira', T.gira ?? 78, () => this._son('n7/respira', { volume: 0.8, pitch: 1.3 }));
    } else if (this.nombre === 'derrumbe') {
      this._evento('explota', T.explota ?? 6, () => {
        this.sacude = 1;
        this.dist += KA.DERRUMBE;
        this._son('n7/explosion', { volume: 1.0 });
        this._son('final/escombros', { volume: 1.0, when: 0.15 });
        this._son('final/escombros', { volume: 0.9, when: 0.6 });
        this._son('final/acufeno', { volume: 0.5, when: 0.3 });
      });
    }
    if (this.ft * (this.D.ind?.fps ?? 12) >= this.n - 1) this._siguiente();
  }

  // ------------------------------------------------------------------ update
  update(dt) {
    if (!this.activa) return;
    if (this.atrapado) {
      this.atrapado.t += dt;
      if (this.atrapado.t >= CONFIG.JUMPSCARE_TIME + 0.6) this._reintenta();
      return;
    }
    super.update(dt);
    this.quema = Math.max(0, this.quema - dt / 0.9);
    this.flashSlaimi = Math.max(0, this.flashSlaimi - dt / 0.9);
    if (this.tipo === 'forzar') this._updateForzar(dt);
    if (!this.caza || this.fase === 'fin') return;
    // la distancia: sube parado o forzando la puerta; baja corriendo; en el conducto no cabe
    let d = 0;
    if (this.tipo === 'tramo') {
      if (this.nombre === 'conducto' || this._aGatas()) d = -KA.CONDUCTO;
      else {
        const k = Math.min(1, Math.abs(this.vel) / this._velMax());
        d = this.vel < 0.4 ? KA.PARADO : -KA.CORRIENDO * k;
      }
    } else if (this.tipo === 'cruce') d = KA.CRUCE;
    else if (this.tipo === 'forzar') d = KA.FORZAR;
    this.dist = Math.max(this.nombre === 'conducto' ? 0.08 : KA.MIN, Math.min(1.2, this.dist + d * dt));
    // Slaimi, una vez: su luz la ciega y te da un respiro
    if (!this.respiro && this.dist > KA.RESPIRO_EN && this._conSlaimi()) {
      this.respiro = true;
      this.flashSlaimi = 1;
      this.dist -= KA.RESPIRO;
      this._son('slaimi/gemido', { volume: 1.0, pitch: 1.3 });
      this._son('aberracion/retrocede', { volume: 0.9, when: 0.15 });
    }
    if (this.dist >= 1) return this._atrapa();
    this._sonidosAberracion(dt);
  }

  _updateForzar(dt) {
    if (this.fase === 'abierta') {
      if (this.ft >= 0.35) this._siguiente();
      return;
    }
    // (la hoja vuelve un poco si dejas de empujar)
    this.fpos = Math.max(0, this.fpos - K.FORZAR.VUELVE * dt);
  }

  _sonidosAberracion(dt) {
    const d = Math.max(0, Math.min(1, this.dist));
    if (this.nombre === 'conducto') {
      // no cabe: golpea la boca y mete los brazos, cada vez más lejos
      this.golpeIn -= dt;
      if (this.golpeIn <= 0) {
        this.golpeIn = 1.8 + Math.random() * 1.6;
        const lejos = Math.min(1, this.pos / Math.max(1, this.n));
        this._son('metal/golpe_pared', { volume: 0.8 * (1 - 0.7 * lejos), pitch: 0.5, muffle: 0.3 + 0.5 * lejos });
        this._son('aberracion/dedos', { volume: 0.6 * (1 - 0.7 * lejos), when: 0.4, muffle: 0.5 * lejos });
      }
      return;
    }
    this.abRespIn -= dt;
    if (this.abRespIn <= 0 && d > 0.35) {
      this.abRespIn = 3.2 - 1.6 * d + Math.random() * 0.8;
      this._son('aberracion/respiraciones', { volume: 0.25 + 0.75 * d * d });
    }
    this.abPasoIn -= dt;
    if (this.abPasoIn <= 0) {
      this.abPasoIn = 1.6 - 0.8 * d + Math.random() * 0.5;
      this._son(Math.random() < 0.5 ? 'aberracion/arrastre' : 'aberracion/metal', { volume: 0.2 + 0.7 * d, muffle: 0.5 * (1 - d) });
    }
  }

  _atrapa() {
    this.atrapado = { t: 0 };
    this.g.audio?.scream?.();
    this._son('aberracion/furia', { volume: 1.0 });
  }

  /** Te ha atrapado: el principio de la persecución (el punto de control). */
  _reintenta() {
    const vidas = (this.muertes ?? 0) + 1;
    this.start('huye');
    this.muertes = vidas;
  }

  // ------------------------------------------------------------------ draw
  _fotograma() {
    if (this.tipo === 'forzar') return ['forzar', Math.min(this.n - 1, Math.floor(this.fpos))];
    if (this.tipo === 'espera') return null;
    return super._fotograma();
  }

  draw(ctx) {
    if (!this.activa) return;
    if (this.atrapado) {
      drawJumpscare(ctx, 'aberracion', this.atrapado.t, this.g.effects);
      return;
    }
    super.draw(ctx);
    ctx.save();
    // la quemadura: un fogonazo naranja
    if (this.quema > 0) {
      ctx.fillStyle = `rgba(255,120,30,${(0.45 * this.quema).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    // Slaimi la ciega: su luz azul lo llena todo un instante
    if (this.flashSlaimi > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(150,200,255,${(0.75 * this.flashSlaimi ** 1.5).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    // cerca: el borde rojo, que late
    const d = this.caza && this.fase !== 'fin' ? Math.max(0, Math.min(1, (this.dist - 0.3) / 0.7)) : 0;
    if (d > 0) {
      const late = 0.85 + 0.15 * Math.sin(this.t * (K.PULSO / 60) * 2 * Math.PI);
      const g = ctx.createRadialGradient(W / 2, H / 2, H * (0.62 - 0.25 * d), W / 2, H / 2, H * 0.98);
      g.addColorStop(0, 'rgba(120,0,0,0)');
      g.addColorStop(1, `rgba(120,0,0,${(0.8 * d * late).toFixed(3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }
}
