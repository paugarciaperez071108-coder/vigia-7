// =============================================================
// Final1.js — El final, Fase 1: las 6:00 de la noche 7 (v1.20; plan del final, informes/plan_final/).
// Valores: NIGHT7.FINAL.F1. Los planos son renders de Blender desde la cámara de la oficina
// (tools/3d/final/f1_seis.py → integrar_f1.py → assets/final/f1/):
//   caida       el estallido de la compuerta de atrás: sales despedido y caes al suelo, mirando el techo
//   techo       tumbado, el techo en llamas (bucle) — encima, el aturdimiento: la imagen doble, borrosa y
//               sin color, que deriva sola; el pitido en los oídos; el corazón lento; el fuego y la alarma
//               que vuelven «debajo del agua». Las teclas solo hacen temblar un poco la imagen
//   1B (Slaimi muerto): nadie viene; se aclara sola, despacio; giras la cabeza hacia donde estaba congelado:
//               el charco de hielo y un brillo azul que se apaga (mira_hielo); te levantas solo (levanta)
//   1A (Slaimi vivo): su sonido, de lejos a cerca; giras la cabeza y llega dando saltos (slaimi_llega); al
//               saltarte encima la imagen se aclara de golpe y se corta el pitido; tus manos lo cogen contra el
//               pecho (abrazo) y te levantas con él en brazos (levanta_slaimi). (v1.21; sin esos planos, como la v1.20)
// Al acabar, de pie frente a la compuerta reventada (la Fase 2, la huida, va después).
// v1.23 (el usuario): de pie, MIRAS ALREDEDOR con el ratón (mira: la vista de 360° de Blender, Pano360.js; en el
//   borde de la pantalla gira, arriba/abajo inclina). Hay 5 salidas y solo vale una, la del camino más largo al
//   Hangar (la compuerta del pasillo central): C. Este aplastada, C. Oeste en llamas, las rejillas hundidas. W o clic
//   va hacia la salida que miras: en una bloqueada, una reacción corta y distinta cada vez (empujas y caen más
//   escombros, toses por el humo, Slaimi tiembla / retrocedes), nunca un texto. La buena se nota sin decirlo: la
//   luz verde, el aire que entra (polvo y su sonido) y, con Slaimi, que brilla más al mirarla.
// =============================================================

import { CONFIG } from '../config.js';
import { NIGHT7 } from '../night/night7.js';
import { slaimiDe } from '../core/SaveData.js';
import { Pano360 } from '../render/Pano360.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const FPS = 15;
const K = NIGHT7.FINAL.F1;
const TOCA = 41;            // el fotograma de slaimi_llega en que te salta encima

let IND = null;
const CACHE = {};
function im(plano, n) {
  const ruta = `assets/final/f1/${plano}_${String(n).padStart(3, '0')}.webp`;
  let i = CACHE[ruta];
  if (!i) {
    i = CACHE[ruta] = new Image();
    i.src = ruta;
  }
  return i.complete && i.naturalWidth ? i : null;
}
function precarga() {
  if (!IND) return;
  for (const [plano, n] of Object.entries(IND)) for (let k = 0; k < n; k++) im(plano, k);
}
fetch('assets/final/f1/indice.json').then((r) => (r.ok ? r.json() : null)).then((d) => { IND = d; }).catch(() => {});

// La vista de 360° (v1.23): assets/final/f1/pano/ (oficina.webp, fuego_NNN.webp, brazos.webp, pano.json, indice.json)
const KM = K.MIRA;
let PANO = null;          // { info, n } (n: fotogramas de la capa de fuego)
const PIMG = {};
function pim(nombre) {
  let i = PIMG[nombre];
  if (!i) {
    i = PIMG[nombre] = new Image();
    i.src = `assets/final/f1/pano/${nombre}.webp`;
  }
  return i.complete && i.naturalWidth ? i : null;
}
Promise.all(['pano.json', 'indice.json'].map((f) => fetch(`assets/final/f1/pano/${f}`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))))
  .then(([info, ind]) => { if (info?.inicio) PANO = { info, n: ind?.fuego ?? 0, ind: ind ?? {} }; });

export class Final1 {
  constructor(game) {
    this.g = game;
    this.activa = false;
  }

  /** Empieza a las 6:00 (Game._n7Final). */
  start() {
    precarga();
    if (PANO) {
      pim(this.slaimi ? 'oficina_1a' : 'oficina');
      pim('brazos');
      for (let k = 0; k < PANO.n; k++) pim(`fuego_${String(k).padStart(3, '0')}`);
      for (const s of Object.keys(PANO.info.salidas)) {
        for (let k = 0; k < (PANO.ind[`caida_${s}`] ?? 0); k++) pim(`caida_${s}_${String(k).padStart(3, '0')}`);
      }
    }
    const s = slaimiDe(this.g.save?.flags);
    this.slaimi = s?.estado === 'vivo';
    this.activa = true;
    this.t = 0;
    this.fase = 'caida';
    this.ft = 0;              // tiempo dentro de la fase
    this.temblor = 0;
    this.claro = 0;           // 0 = aturdido del todo, 1 = la vista ya limpia
    this.latidoIn = 0.4;
    this.fuegoIn = 1.2;
    this.alarmaIn = 2.0;
    this.slaimiIn = K.SLAIMI_LLEGA;
    this.fin = false;
    this.tocado = false;
    this._son('n7/estallido', { volume: 1 });
    this._son('n7/explosion', { volume: 1, when: 0.05, pitch: 0.7 });
  }

  _son(clave, o = {}) {
    this.g.audio?.lib?.play(clave, { pitchVar: 0.03, ...o });
  }

  tecla(code) {
    // (aturdido, las teclas solo hacen temblar un poco la imagen)
    if (this.fase === 'techo' || this.fase === 'aclara') this.temblor = Math.min(1, this.temblor + 0.35);
    if (this.fase === 'mira' && (code === 'KeyW' || code === 'ArrowUp')) this._anda();
  }

  /** (v1.23) Clic: como W, hacia la salida que miras. */
  click() {
    if (this.fase === 'mira') this._anda();
  }

  /** De pie: ¿hay vista de 360°? */
  _conMira() {
    return !!(PANO && this._base() && (this.pano ??= new Pano360(1280, 720)).ok);
  }

  /** La oficina de 360° (1A, sin el charco de hielo: Slaimi nunca se congeló). */
  _base() {
    return (this._con1A() && pim('oficina_1a')) || pim('oficina');
  }

  _empiezaMira() {
    this._fase('mira');
    [this.giro, this.incl] = PANO.info.inicio;
    this.inclObj = this.incl;
    this.reac = null;
    this.nReac = 0;
    this.sacude = 0;
    this.aireIn = 0;
    this.mirandoBuena = 0;
    this.caida = null;            // los escombros que caen ahora (Blender: caida_<salida>_NNN)
    this.cayeron = [];            // las salidas donde ya cayeron (su último fotograma se queda)
  }

  /** La salida que hay en el centro de la vista (o null). */
  _apunta() {
    let mejor = null;
    let dmin = KM.APUNTA;
    for (const [k, [g, i]] of Object.entries(PANO.info.salidas)) {
      const d = Pano360.distancia(this.giro, this.incl, g, i);
      if (d < dmin) { dmin = d; mejor = k; }
    }
    return mejor;
  }

  /** W / clic: ir hacia la salida que miras. */
  _anda() {
    if (this.reac) return;
    const s = this._apunta();
    if (!s) {
      this._son('pasos/metal', { volume: 0.4 });          // (un paso sin rumbo)
      this.sacude = Math.max(this.sacude, 0.2);
      return;
    }
    if (s === KM.BUENA) {
      this._fase('sale');
      [this.giroSale, this.inclSale] = PANO.info.salidas[s];
      for (let k = 0; k < 4; k++) this._son('pasos/metal', { volume: 0.7, when: 0.15 + k * 0.38 });
      return;
    }
    // bloqueada: una reacción distinta cada vez (por orden; sin Slaimi, en vez de temblar él, retrocedes)
    let tipo = KM.REACCIONES[this.nReac++ % KM.REACCIONES.length];
    if (tipo === 'slaimi' && !this._con1A()) tipo = 'retrocede';
    this.reac = { tipo, t: 0, salida: s, dur: { empuja: 1.5, tose: 2.0, slaimi: 1.4, retrocede: 1.2 }[tipo] };
    if (tipo === 'empuja') {
      this._son('metal/golpe_pared', { volume: 0.9 });
      this._son('final/escombros', { volume: 1, when: 0.18 });
      const n = PANO.ind[`caida_${s}`] ?? 0;
      if (n && !this.cayeron.includes(s)) this.caida = { s, t: 0, n };
    } else if (tipo === 'tose') {
      this._son('final/tos', { volume: 0.9 });
    } else if (tipo === 'slaimi') {
      this._son('slaimi/gemido', { volume: 0.8, pitch: 1.15 });
      this._son('slaimi/gemido', { volume: 0.5, pitch: 1.25, when: 0.5 });
    } else {
      this._son('pasos/metal', { volume: 0.6 });
      this._son('pasos/metal', { volume: 0.5, when: 0.35 });
      this._son('n7/crujido', { volume: 0.6, when: 0.2 });
    }
  }

  _updateMira(dt) {
    const m = this.g.mouse ?? { x: W / 2, y: H / 2 };
    const dx = (m.x - W / 2) / (W / 2);
    if (Math.abs(dx) > KM.BORDE && !this.reac) {
      this.giro += Math.sign(dx) * KM.GIRO_MAX * ((Math.abs(dx) - KM.BORDE) / (1 - KM.BORDE)) ** 1.4 * dt;
    }
    this.giro = ((this.giro + 540) % 360) - 180;
    this.inclObj = -Math.max(-1, Math.min(1, (m.y - H / 2) / (H / 2))) * KM.INCL_MAX;
    if (!this.reac) this.incl += (this.inclObj - this.incl) * Math.min(1, dt * 5);
    this.sacude = Math.max(0, this.sacude - dt * 1.8);
    // mirando la buena: el aire que entra se oye más (y por su lado); con Slaimi, brilla más
    const [gb, ib] = PANO.info.salidas[KM.BUENA];
    const d = Pano360.distancia(this.giro, this.incl, gb, ib);
    this.mirandoBuena += (Math.max(0, 1 - d / 50) - this.mirandoBuena) * Math.min(1, dt * 3);
    this.aireIn -= dt;
    if (this.aireIn <= 0) {
      this.aireIn = 4.2;
      const rel = ((gb - this.giro + 540) % 360) - 180;
      this._son('final/aire', { volume: KM.AIRE_VOL * (0.25 + 0.75 * this.mirandoBuena), pan: Math.max(-1, Math.min(1, rel / 90)) });
    }
    if (this.caida) {
      this.caida.t += dt;
      if (this.caida.t * FPS >= this.caida.n - 1) {
        this.cayeron.push(this.caida.s);
        this.caida = null;
      }
      this._escCambia = true;
    }
    if (this.reac) {
      const r = this.reac;
      r.t += dt;
      if (r.tipo === 'empuja' && r.t < 0.5) this.sacude = Math.max(this.sacude, 0.8 * (1 - r.t / 0.5));
      if (r.tipo === 'tose') this.incl += ((this.inclObj - 9 * Math.sin(Math.min(1, r.t / r.dur) * Math.PI)) - this.incl) * Math.min(1, dt * 6);
      if (r.tipo === 'tose' && r.t < 1.2) this.sacude = Math.max(this.sacude, 0.3 + 0.25 * Math.abs(Math.sin(r.t * 14)));
      if (r.t >= r.dur) this.reac = null;
    }
  }

  _fase(f) {
    this.fase = f;
    this.ft = 0;
  }

  _dur(plano) {
    return (IND?.[plano] ?? 0) / FPS;
  }

  update(dt) {
    if (!this.activa) return;
    this.t += dt;
    this.ft += dt;
    this.temblor = Math.max(0, this.temblor - dt * 1.5);
    const aturdido = this._aturdido();
    switch (this.fase) {
      case 'caida':
        if (this.ft > 1.45 && !this._golpe) {
          this._golpe = true;
          this._son('final/golpe', { volume: 1 });
          // 1A: el pitido se corta de golpe cuando Slaimi te toca
          const corta = this._con1A() ? Math.max(1.9, this._dur('caida')) - this.ft + K.ATURDIDO_SLAIMI + TOCA / FPS : undefined;
          this._son('final/acufeno', { volume: K.ACUFENO_VOL, corta });
        }
        if (this.ft >= Math.max(1.9, this._dur('caida'))) this._fase('techo');
        break;
      case 'techo':
        if (this.ft >= (this.slaimi ? K.ATURDIDO_SLAIMI : K.ATURDIDO_SOLO)) this._fase(this._con1A() ? 'slaimi_llega' : 'aclara');
        break;
      case 'slaimi_llega':
        // aturdido hasta que te salta encima; entonces, la vista limpia de golpe
        if (!this.tocado && this.ft * FPS >= TOCA) {
          this.tocado = true;
          this.claro = 1;
          this._son('slaimi/calma', { volume: 1 });
        }
        if (this.ft >= this._dur('slaimi_llega')) this._fase('abrazo');
        break;
      case 'abrazo':
        if (this.ft >= this._dur('abrazo')) this._fase('levanta_slaimi');
        break;
      case 'levanta_slaimi':
        if (this._conMira() && this.ft >= this._dur('levanta_slaimi') + 0.3) this._empiezaMira();
        else if (this.ft >= this._dur('levanta_slaimi') + K.DE_PIE + (PANO ? 6 : 0)) { this.fin = true; this._fase('fin'); }   // (si hay vista de 360°, espera a que cargue)
        break;
      case 'mira':
        this._updateMira(dt);
        break;
      case 'sale':
        // andas hacia la compuerta: la vista se centra en ella y se acerca; luego, el fundido (la Fase 2, después)
        this.giro += (((this.giroSale - this.giro + 540) % 360) - 180) * Math.min(1, dt * 4);
        this.incl += (this.inclSale - this.incl) * Math.min(1, dt * 4);
        if (this.ft >= KM.SALE_S) { this.fin = true; this._fase('fin'); }
        break;
      case 'aclara':
        // 1A: Slaimi llega y la vista se aclara de golpe; 1B: se aclara sola, despacio
        if (this.slaimi) {
          this.claro = Math.min(1, this.claro + dt * 2.5);
          if (this.ft >= 1.2) this._fase('levanta');
        } else {
          this.claro = Math.min(1, this.claro + dt / K.ACLARA_SOLO);
          if (this.claro >= 1) this._fase('mira_hielo');
        }
        break;
      case 'mira_hielo':
        if (this.ft >= this._dur('mira_hielo') + K.MIRA_PAUSA) this._fase('levanta');
        break;
      case 'levanta':
        if (this._conMira() && this.ft >= this._dur('levanta') + 0.3) this._empiezaMira();
        else if (this.ft >= this._dur('levanta') + K.DE_PIE + (PANO ? 6 : 0)) { this.fin = true; this._fase('fin'); }   // (si hay vista de 360°, espera a que cargue)
        break;
      default:
        break;
    }
    if (!['techo', 'aclara', 'caida', 'slaimi_llega'].includes(this.fase)) this.claro = 1;
    if (this.fase === 'fin' && this.giro !== undefined) return;     // (después de salir, solo el fundido)
    // El cuerpo: el corazón lento y fuerte mientras está aturdido
    this.latidoIn -= dt;
    if (this.latidoIn <= 0 && this.fase !== 'fin') {
      this.latidoIn = aturdido ? 60 / K.PULSO_ATURDIDO : 60 / K.PULSO_DESPIERTO;
      this._son('n7/latido', { volume: aturdido ? 0.9 : 0.5, pitch: 0.85 });
    }
    // El fuego y la alarma vuelven poco a poco, «debajo del agua» mientras está aturdido
    const k = Math.min(1, this.t / K.VUELVE_SONIDO);
    const ahogado = aturdido ? 0.9 - 0.6 * this.claro : 0.1;
    this.fuegoIn -= dt;
    if (this.fuegoIn <= 0) {
      this.fuegoIn = 2.4;
      this._son('n7/fuego', { volume: 0.2 + 0.5 * k, muffle: ahogado });
    }
    this.alarmaIn -= dt;
    if (this.alarmaIn <= 0) {
      this.alarmaIn = 3.2;
      this._son('n7/alarma', { volume: (0.1 + 0.35 * k) * (this.fase === 'fin' ? 0.6 : 1), muffle: ahogado });
    }
    // 1A: Slaimi te encuentra (de lejos a cerca, por su lado)
    if (this.slaimi && (this.fase === 'techo' || this.fase === 'aclara' || (this.fase === 'slaimi_llega' && !this.tocado))) {
      this.slaimiIn -= dt;
      if (this.slaimiIn <= 0) {
        this.slaimiIn = 1.3;
        const cerca = Math.min(1, this.ft / K.ATURDIDO_SLAIMI + (this.fase === 'techo' ? 0 : 1));
        this._son(cerca > 0.8 ? 'slaimi/calma' : 'slaimi/gemido', { volume: 0.2 + 0.7 * cerca, muffle: ahogado * (1 - cerca), pan: -0.6 * (1 - cerca) });
      }
    }
  }

  /** 1A con sus planos (si aún no están, como la v1.20). */
  _con1A() {
    return this.slaimi && (IND?.slaimi_llega ?? 0) > 0;
  }

  _aturdido() {
    return this.fase === 'techo' || this.fase === 'aclara' || (this.fase === 'slaimi_llega' && !this.tocado);
  }

  /** El fotograma del plano que toca (los bucles, en bucle; los demás se quedan en el último). */
  _imagen() {
    const f = this.fase;
    const n = (p) => IND?.[p] ?? 0;
    if (f === 'caida') return im('caida', Math.min(n('caida') - 1, Math.floor(this.ft * FPS)));
    if (f === 'techo' || f === 'aclara') {
      if (this.slaimi && f === 'aclara') return im('techo', Math.floor(this.t * FPS) % Math.max(1, n('techo')));
      return im('techo', Math.floor(this.t * FPS) % Math.max(1, n('techo')));
    }
    if (f === 'slaimi_llega' || f === 'abrazo') return im(f, Math.min(n(f) - 1, Math.floor(this.ft * FPS)));
    if (f === 'levanta_slaimi' || (f === 'fin' && this._con1A())) {
      return im('levanta_slaimi', Math.min(n('levanta_slaimi') - 1, Math.floor((f === 'fin' ? 99 : this.ft) * FPS)));
    }
    if (f === 'mira_hielo') return im('mira_hielo', Math.min(n('mira_hielo') - 1, Math.floor(this.ft * FPS)));
    return im('levanta', Math.min(n('levanta') - 1, Math.floor((f === 'fin' ? 99 : this.ft) * FPS)));
  }

  /** (v1.23) La vista de 360°: la oficina, el fuego animado encima y Slaimi en tus brazos abajo. */
  _drawMira(ctx) {
    const n = PANO.n;
    let capa = null;
    let capa2 = null;
    let mezcla = 0;
    if (n) {
      const f = (this.t * FPS) % n;
      const i = Math.floor(f);
      capa = pim(`fuego_${String(i).padStart(3, '0')}`);
      const FUNDE = Math.min(8, Math.floor(n / 3));       // (los últimos fotogramas se funden con los primeros: el bucle)
      if (i >= n - FUNDE) {
        capa2 = pim(`fuego_${String(i - (n - FUNDE)).padStart(3, '0')}`);
        mezcla = (i - (n - FUNDE) + (f - i)) / FUNDE;
      }
    }
    this.pano.pon(this._base(), capa, capa2, mezcla);
    // los escombros: los que ya cayeron (su último fotograma) y los que están cayendo
    if (this._escCambia) {
      const ult = (s) => pim(`caida_${s}_${String((PANO.ind[`caida_${s}`] ?? 1) - 1).padStart(3, '0')}`);
      const ahora = this.caida ? pim(`caida_${this.caida.s}_${String(Math.min(this.caida.n - 1, Math.floor(this.caida.t * FPS))).padStart(3, '0')}`) : null;
      const ref = ahora ?? ult(this.cayeron[0]);
      if (ref) {
        if (!this.escCanvas) {
          this.escCanvas = document.createElement('canvas');
          this.escCanvas.width = ref.naturalWidth;
          this.escCanvas.height = ref.naturalHeight;
        }
        const c = this.escCanvas.getContext('2d');
        c.clearRect(0, 0, this.escCanvas.width, this.escCanvas.height);
        for (const s of this.cayeron) {
          const i = ult(s);
          if (i) c.drawImage(i, 0, 0, this.escCanvas.width, this.escCanvas.height);
        }
        if (ahora) c.drawImage(ahora, 0, 0, this.escCanvas.width, this.escCanvas.height);
        this.pano.ponEscombros(this.escCanvas, true);
      }
      this._escCambia = !!this.caida;
    }
    const sale = this.fase === 'sale' || (this.fase === 'fin' && this.giroSale !== undefined);
    const k = sale ? Math.min(1, (this.fase === 'fin' ? KM.SALE_S : this.ft) / KM.SALE_S) : 0;
    let campo = KM.CAMPO - 30 * k * k;
    const r = this.reac;
    if (r?.tipo === 'empuja') campo -= 7 * Math.sin(Math.min(1, r.t / 0.35) * Math.PI);
    if (r?.tipo === 'retrocede') campo += 9 * Math.sin(Math.min(1, r.t / r.dur) * Math.PI);
    const paso = sale ? Math.sin(this.ft * 9) * 1.2 : 0;
    const sx = (Math.random() - 0.5) * 4 * this.sacude;
    const sy = (Math.random() - 0.5) * 3 * this.sacude + paso;
    const luz = 1 + 0.06 * Math.sin(this.t * 13) * Math.sin(this.t * 7.1);   // (la luz del fuego)
    this.pano.draw(ctx, this.giro + sx, this.incl + sy, campo, luz, 0, 0, W, H);
    // Slaimi en tus brazos, abajo (si está vivo y está su capa): tiembla al asustarse y brilla más mirando la buena
    const br = this._con1A() ? pim('brazos') : null;
    if (br) {
      const tiembla = r?.tipo === 'slaimi' ? (1 - r.t / r.dur) : 0;
      const bx = (Math.random() - 0.5) * 10 * tiembla + Math.sin(this.t * 1.7) * 4;
      // (al empezar a mirar, lo bajas un poco para que deje ver: del último plano a KM.BRAZOS_BAJA)
      const baja = H * KM.BRAZOS_BAJA * Math.min(1, (this.fase === 'mira' ? this.ft : 9) / 1.2) ** 0.7;
      const by = baja + Math.max(0, -this.incl) * 1.5 + Math.sin(this.t * 2.3) * 3 + (sale ? Math.abs(paso) * 6 : 0);
      ctx.drawImage(br, bx, by, W, H);
      const brillo = 0.15 + KM.BRILLO_SLAIMI * this.mirandoBuena * (0.85 + 0.15 * Math.sin(this.t * 5));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(W / 2 + bx, H * 0.7 + by, 10, W / 2 + bx, H * 0.7 + by, H * 0.42);
      gr.addColorStop(0, `rgba(190,225,255,${(0.32 * brillo).toFixed(3)})`);
      gr.addColorStop(1, 'rgba(190,225,255,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    // toser: la vista se nubla un momento
    if (r?.tipo === 'tose') {
      ctx.fillStyle = `rgba(40,34,28,${(0.35 * Math.sin(Math.min(1, r.t / r.dur) * Math.PI)).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    // el viñeteado de siempre
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  draw(ctx) {
    if (!this.activa) return;
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if ((this.fase === 'mira' || this.fase === 'sale' || (this.fase === 'fin' && this.giro !== undefined)) && this.pano?.ok) {
      this._drawMira(ctx);
      // el paso del último plano a la vista libre: un fundido corto
      if (this.fase === 'mira' && this.ft < 0.4) {
        const ult = this._con1A() ? im('levanta_slaimi', (IND?.levanta_slaimi ?? 1) - 1) : im('levanta', (IND?.levanta ?? 1) - 1);
        if (ult) {
          ctx.globalAlpha = 1 - this.ft / 0.4;
          ctx.drawImage(ult, 0, 0, W, H);
          ctx.globalAlpha = 1;
        }
      }
      if (this.fase === 'fin') {
        ctx.fillStyle = `rgba(0,0,0,${Math.min(1, this.ft / 1.2)})`;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
      return;
    }
    const img = this._imagen();
    const aturdido = this._aturdido();
    const a = aturdido ? 1 - this.claro : 0;          // cuánto aturdimiento queda
    if (img) {
      // La deriva sola y el temblor de las teclas
      const dx = a * 18 * Math.sin(this.t * 0.7) + this.temblor * (Math.random() - 0.5) * 14;
      const dy = a * 10 * Math.sin(this.t * 0.53 + 1) + this.temblor * (Math.random() - 0.5) * 10;
      ctx.filter = a > 0.01 ? `blur(${(a * 6).toFixed(1)}px) saturate(${(1 - 0.75 * a).toFixed(2)})` : 'none';
      ctx.drawImage(img, dx, dy, W, H);
      // La imagen doble (los ojos que no enfocan)
      if (a > 0.02) {
        ctx.globalAlpha = 0.45 * a;
        const sep = 22 * a + 6 * a * Math.sin(this.t * 1.3);
        ctx.drawImage(img, dx + sep, dy - sep * 0.4, W, H);
        ctx.globalAlpha = 1;
      }
      ctx.filter = 'none';
    }
    // El fogonazo del estallido (luz)
    if (this.fase === 'caida' && this.ft < 0.35) {
      ctx.fillStyle = `rgba(255,240,215,${0.9 * (1 - this.ft / 0.35)})`;
      ctx.fillRect(0, 0, W, H);
    }
    // El borde oscuro con cada latido mientras está aturdido (la vista que late)
    if (a > 0.02) {
      const lat = Math.max(0, Math.sin(this.t * Math.PI * 2 * K.PULSO_ATURDIDO / 60)) ** 6;
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${Math.min(0.92, 0.55 * a + 0.3 * lat * a)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    // Al final, un fundido a negro (la Fase 2, la huida, aún no está)
    if (this.fase === 'fin') {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, this.ft / 2)})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  get acabada() { return this.fase === 'fin' && this.ft > 2.5; }
}
