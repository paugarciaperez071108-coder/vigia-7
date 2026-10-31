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
// Al acabar, de pie frente a la compuerta reventada: la única salida (la Fase 2, la huida, va después).
// =============================================================

import { CONFIG } from '../config.js';
import { NIGHT7 } from '../night/night7.js';
import { slaimiDe } from '../core/SaveData.js';

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

export class Final1 {
  constructor(game) {
    this.g = game;
    this.activa = false;
  }

  /** Empieza a las 6:00 (Game._n7Final). */
  start() {
    precarga();
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

  tecla() {
    // (las teclas solo hacen temblar un poco la imagen: no se controla nada todavía)
    if (this.fase === 'techo' || this.fase === 'aclara') this.temblor = Math.min(1, this.temblor + 0.35);
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
        if (this.ft >= this._dur('levanta_slaimi') + K.DE_PIE) { this.fin = true; this._fase('fin'); }
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
        if (this.ft >= this._dur('levanta') + K.DE_PIE) { this.fin = true; this._fase('fin'); }
        break;
      default:
        break;
    }
    if (!['techo', 'aclara', 'caida', 'slaimi_llega'].includes(this.fase)) this.claro = 1;
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

  draw(ctx) {
    if (!this.activa) return;
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
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
