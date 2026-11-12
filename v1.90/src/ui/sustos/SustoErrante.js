// =============================================================
// SustoErrante.js — (v1.86) EL SUSTO NUEVO DE EL ERRANTE («El Que Mira»; el usuario, 2026-11-11: «a través de las
// cámaras. La imagen de la cámara se llena de estática y, en cada parpadeo, está más cerca, sin moverse entre medias. En
// el último fotograma la cámara muestra tu propia oficina con él de pie justo detrás de ti. Corte en negro»; y «la tableta
// sube sola»). Entra por la compuerta que no cerraste: la cámara es la del pasillo de esa compuerta (CAM 07 Corredor Oeste
// → izquierda, CAM 08 Corredor Este → derecha). Fotogramas: tools/3d/sustos_v2/errante_sala.py (la sala vacía y él en 4
// sitios) y errante_oficina.py (la cámara de la esquina de la oficina: tú con la tableta y él detrás).
//   PRE   quieto · SUBE la tableta se levanta sola, con estática
//   la sala vacía → parpadeo → 0 → parpadeo → 1 → 2 → 3 (cada vez más cerca; nunca se le ve moverse)
//   → «OFICINA»: tú, de espaldas a él, y él detrás (la cara a la cámara, como siempre) → encima de ti
//   EL GOLPE: corte en negro (el único golpe de sonido)
// =============================================================

import * as L from './EfectosLente.js';
import { aberracion, bloques } from '../../render/CamaraSeguridad.js';
import { W, H, carga, listaCarpeta, lista, imagen } from './SustoFotos.js';

const CARP = 'assets/sustos/v2/';
export const ERRANTE = {
  PRE: 0.2,
  PRE_GIRO: 0.1,
  SUBE: 0.35,                 // s que tarda la tableta en subir
  // (imagen, s en pantalla, s de parpadeo después)
  TOMAS: [['vacia', 0.2, 0.07], ['0', 0.28, 0.08], ['1', 0.28, 0.08], ['2', 0.26, 0.08], ['3', 0.26, 0.12],
    ['detras', 0.5, 0.06], ['encima', 0.22, 0]],
  NEGRO: 0.55,
  SONIDO: 'sustos/errante',
  CAM: { left: ['07', 'CORREDOR OESTE'], right: ['08', 'CORREDOR ESTE'] },
};
const C = ERRANTE;

export function precargaErrante() {
  for (const l of ['left', 'right']) carga(`errante_${l}`);
  carga('errante_oficina');
}
export const erranteListo = (lado = 'left') => listaCarpeta(`errante_${lado}`) && listaCarpeta('errante_oficina');

export class SustoErrante {
  constructor({ lado = 'left', giro = 0, fondo = false } = {}) {
    this.lado = lado === 'right' ? 'right' : 'left';
    this.giro = giro;
    this.fondoPropio = !!fondo;
    this.conOficina = !fondo;
    this.sala = carga(`errante_${this.lado}`);
    this.oficina = carga('errante_oficina');
    this.t0 = giro + (giro > 0 ? C.PRE_GIRO : C.PRE);
    // el calendario: [desde, hasta, imagen | 'blink']
    let t = this.t0 + C.SUBE;
    this.cal = [];
    for (const [im, d, b] of C.TOMAS) {
      this.cal.push([t, t + d, im]);
      t += d;
      if (b) {
        this.cal.push([t, t + b, 'blink']);
        t += b;
      }
    }
    this.tGolpe = t;
    this.dura = t + C.NEGRO;
    this.visto = t;
  }

  sonido(audio, k = 1) {
    audio?.lib?.play(C.SONIDO, { volume: 1, pitch: 1 / k, pitchVar: 0, volVar: 0, when: this.t0 * k });
  }

  _img(nombre) {
    const ofi = nombre === 'detras' || nombre === 'encima';
    const d = ofi ? this.oficina : this.sala;
    const n = ofi ? { detras: '0', encima: '1' }[nombre] : nombre;
    const fo = d.ind?.fotogramas?.[n];
    return fo?.archivo ? d.fotos[n] : null;
  }

  _etiqueta(ctx, ofi, t) {
    const [cam, nombre] = ofi ? ['--', 'OFICINA'] : C.CAM[this.lado];
    ctx.save();
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#e8eef5';
    ctx.font = 'bold 30px "Courier New", monospace';
    ctx.fillText(`CAM ${cam}`, 40, 130);
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText(nombre, 42, 166);
    if (Math.floor(t * 1.5) % 2 === 0) {
      ctx.fillStyle = '#ff2a2a';
      ctx.beginPath();
      ctx.arc(50, 200, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8eef5';
      ctx.fillText('REC', 64, 192);
    }
    ctx.restore();
  }

  /** La imagen de la cámara (con el aspecto de las cámaras del juego) en el rectángulo de la tableta. */
  _pantalla(ctx, nombre, t, effects) {
    const im = nombre === 'blink' ? null : this._img(nombre);
    if (lista(im)) {
      ctx.drawImage(im, 0, 0, W, H);
      aberracion(ctx, 1.6);
      bloques(ctx, 0.15);
    } else L.negro(ctx);
    if (nombre === 'blink') {
      L.senal(ctx, effects, 1);
      effects?.static?.(ctx, 0.85);
    } else {
      effects?.static?.(ctx, 0.12 + 0.08 * Math.random());
      if (Math.random() < 0.3) L.senal(ctx, effects, 0.2);
      this._etiqueta(ctx, nombre === 'detras' || nombre === 'encima', t);
    }
    effects?.vignette?.(ctx, 0.8);
  }

  draw(ctx, t, effects = null) {
    if (t >= this.tGolpe) {
      L.negro(ctx);
      return;
    }
    if (this.fondoPropio) {
      const of = imagen('assets/salas/unica/normal_front.webp');
      if (lista(of)) ctx.drawImage(of, 0, 0, W, H);
      else L.negro(ctx);
    }
    if (t < this.t0) return;
    const k = Math.min(1, (t - this.t0) / C.SUBE);
    const toma = this.cal.find(([a, b]) => t >= a && t < b);
    const nombre = k < 1 ? 'vacia' : (toma?.[2] ?? 'blink');
    // la tableta sube sola desde abajo (con su marco), ya encendida
    const y = Math.round(H * (1 - L.suave(0, 1, k)) * 1.02);
    ctx.save();
    ctx.translate(0, y);
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    this._pantalla(ctx, k < 1 ? 'blink' : nombre, t, effects);
    if (k < 1) {
      // el borde de la tableta
      ctx.fillStyle = '#0b0d10';
      ctx.fillRect(0, 0, W, 18);
    }
    ctx.restore();
  }

  static miniatura(ctx, r) {
    const im = imagen(`${CARP}errante_miniatura.webp`);
    if (lista(im)) ctx.drawImage(im, r.x, r.y, r.w, r.h);
  }
}
