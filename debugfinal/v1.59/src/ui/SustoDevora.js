// =============================================================
// SustoDevora.js — (v1.48, el usuario: «sus brazos te cogen y te come… el susto del jefe final, el más fuerte del
// juego»; plan plano a plano aprobado: «dale») El jumpscare de la Aberración, el MISMO en la oficina de la noche 7 y
// en la persecución del final: solo cambia el fondo (la vista que tenías al pillarte, con su fuego y su luz).
//   P1 0,0–0,4 s  los brazos entran por los bordes; detrás, su masa                (golpe seco: la imagen tiembla)
//   P2 0,4–0,9 s  te cogen (hombro, brazo, cara) y te arrastran; Slaimi se cae
//   P3 0,9–1,2 s  te giran de golpe hacia ella
//   P4 1,2–1,8 s  el desgarro se abre; las caras te miran
//   P5 1,8–2,3 s  te empuja dentro; las costillas se cierran; un destello rojo
//   P6 2,3–3,3 s  negro (el sonido de dentro)
// Ella, sus brazos y sus manos: tools/3d/n7/susto_devora.py --animar (69 fotogramas con fondo transparente) →
// assets/sustos/devora/NN.webp. El sonido, una sola pista a tiempo: 'aberracion/devora' (tools/sonidos_aberracion.py).
// =============================================================

import { ExtrasProgreso } from '../core/ExtrasProgreso.js';
import { CONFIG } from '../config.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
export const SUSTO_DEVORA = {
  FPS: 30,
  N: 69,             // fotogramas de Blender (2,3 s)
  VISTO: 2.3,        // s con imagen
  DURA: 3.3,         // s en total (con el negro)
  GOLPES: [0.0, 0.4, 0.9, 1.2, 1.8],   // (la sacudida y la aberración cromática)
};
const S = SUSTO_DEVORA;
const suave = (a, b, t) => {
  const k = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

const FOTOS = [];
let SLAIMI = null;

/** Las imágenes, pedidas ya (al empezar la noche 7 o la persecución): que el susto no espere a cargar. */
export function precargaDevora() {
  if (FOTOS.length) return;
  for (let i = 0; i < S.N; i++) {
    const im = new Image();
    im.decoding = 'async';
    im.src = `assets/sustos/devora/${String(i).padStart(2, '0')}.webp`;
    // (descodificadas ya, fuera del juego: si no, se descodificaban al dibujarlas y el susto se atascaba)
    im.decode?.().catch(() => {});
    FOTOS.push(im);
  }
  SLAIMI = new Image();
  SLAIMI.src = 'assets/slaimi/slaimi_triste.webp';
}

const lista = (im) => im && im.complete && im.naturalWidth > 0;

export class SustoDevora {
  /** fondo: un lienzo (o imagen) con la vista que tenías al pillarte; slaimi: si lo llevas en brazos. */
  constructor(fondo, { slaimi = false, audio = null } = {}) {
    ExtrasProgreso.veSusto('aberracion');   // (v1.56) para la galería de Extras
    precargaDevora();
    // (una copia: el lienzo del juego se sigue dibujando)
    this.fondo = document.createElement('canvas');
    this.fondo.width = W;
    this.fondo.height = H;
    try { this.fondo.getContext('2d').drawImage(fondo, 0, 0, W, H); } catch (e) { /* (sin fondo: negro) */ }
    this.slaimi = slaimi;
    this.ultima = null;
    // la música se corta en seco; la pista del susto
    if (audio) {
      audio.stopAll?.();
      audio.setMasterLevel?.(1, 0.02);     // (al máximo del juego: en la noche el volumen general va bajado)
      audio.lib?.play('aberracion/devora', { volume: 1, pitchVar: 0, volVar: 0 });
    }
  }

  /** Cuánto tiembla en este momento (golpes). */
  _golpe(t) {
    return S.GOLPES.reduce((a, g) => Math.max(a, t >= g ? Math.exp(-(t - g) / 0.12) : 0), 0);
  }

  draw(ctx, t) {
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (t >= S.VISTO) {
      ctx.restore();
      return;
    }
    const g = this._golpe(t);
    const sx = (Math.random() - 0.5) * 46 * g, sy = (Math.random() - 0.5) * 30 * g;
    ctx.translate(W / 2 + sx, H / 2 + sy);
    // ---- el fondo (donde estabas): tiembla (P1), te arrastran hacia ella mirando abajo (P2), te giran (P3) y queda
    // casi tapado y en penumbra roja detrás de ella (P4–P5)
    const arr = suave(0.4, 0.9, t), gira = suave(0.9, 1.2, t);
    const zoom = 1.02 + 0.03 * suave(0, 0.4, t) + 0.33 * arr + 0.25 * gira;
    const rol = (-7 * arr + 7 * gira) * Math.PI / 180;
    const dy = -H * 0.16 * arr * (1 - gira);
    const dx = -W * 1.35 * gira;
    const vel = (t > 0.4 && t < 0.9 ? 0.5 : 0) + (t > 0.9 && t < 1.2 ? 1.2 * Math.sin(Math.PI * (t - 0.9) / 0.3) : 0);
    const copias = vel > 0.05 ? 4 : 1;
    for (let k = 0; k < copias; k++) {
      ctx.save();
      ctx.globalAlpha = copias > 1 ? (k === 0 ? 1 : 0.28) : 1;
      ctx.rotate(rol);
      ctx.scale(zoom * (1 + 0.02 * k * vel), zoom * (1 + 0.02 * k * vel));
      ctx.translate(dx * (1 + 0.04 * k * vel) + (dx < 0 ? W * 0.02 * k * vel : 0), dy + 6 * k * vel);
      ctx.drawImage(this.fondo, -W / 2, -H / 2, W, H);
      if (dx < -10) ctx.drawImage(this.fondo, W / 2, -H / 2, W, H);   // (al girar, lo que había al lado)
      ctx.restore();
    }
    // (detrás de ella, en penumbra: su sombra y la luz roja)
    const oscuro = 0.25 * arr + 0.55 * gira;
    if (oscuro > 0) {
      ctx.fillStyle = `rgba(14,2,1,${oscuro.toFixed(3)})`;
      ctx.fillRect(-W, -H, W * 2, H * 2);
    }
    // ---- ella (Blender), con la aberración cromática en los golpes
    const f = Math.min(S.N - 1, Math.floor(t * S.FPS));
    const im = lista(FOTOS[f]) ? FOTOS[f] : this.ultima;
    if (im) {
      this.ultima = im;
      if (g > 0.25) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.35 * g;
        ctx.drawImage(im, -W / 2 - 9 * g, -H / 2, W, H);
        ctx.drawImage(im, -W / 2 + 9 * g, -H / 2 + 3 * g, W, H);
        ctx.restore();
      }
      ctx.drawImage(im, -W / 2, -H / 2, W, H);
    }
    // ---- Slaimi se cae de tus manos (abajo, un instante)
    if (this.slaimi && lista(SLAIMI) && t > 0.42 && t < 0.95) {
      const k = (t - 0.42) / 0.53;
      const hS = H * 0.32 * (1 - 0.35 * k);
      const wS = hS * SLAIMI.naturalWidth / SLAIMI.naturalHeight;
      ctx.save();
      ctx.translate(W * (0.14 + 0.05 * k), H * (0.2 + 0.55 * k * k));
      ctx.rotate(-0.4 - 2.2 * k);
      ctx.globalAlpha = 1 - suave(0.8, 1, k);
      ctx.drawImage(SLAIMI, -wS / 2, -hS / 2, wS, hS);
      ctx.restore();
    }
    ctx.restore();
    // ---- el destello rojo entre las costillas y la viñeta que se cierra (P5)
    const cierra = suave(1.8, 2.3, t);
    if (cierra > 0) {
      const gr = ctx.createRadialGradient(W / 2, H / 2, H * (0.7 - 0.55 * cierra), W / 2, H / 2, H * (1.2 - 0.5 * cierra));
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, `rgba(0,0,0,${(0.9 * cierra).toFixed(3)})`);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
    }
    const dest = Math.max(0, 1 - Math.abs(t - 2.18) / 0.07);
    if (dest > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,30,10,${(0.35 * dest).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }
}

/** La pantalla de muerte de la Aberración: sus respiraciones en el fundido, la causa y la pista. */
export function textoDevora(ctx, t, { pista }) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const a = suave(1.8, 2.8, t);
  if (a <= 0) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = a;
  ctx.fillStyle = '#ff5050';
  ctx.font = 'bold 110px "Courier New", monospace';
  ctx.fillText('FIN DEL TURNO', W / 2, 380);
  ctx.font = '28px "Courier New", monospace';
  ctx.fillText('La Aberración te ha devorado.', W / 2, 490);
  ctx.globalAlpha = suave(3.0, 3.8, t);
  ctx.fillStyle = 'rgba(255,190,170,0.85)';
  ctx.font = '22px "Courier New", monospace';
  ctx.fillText(pista, W / 2, 560);
  ctx.restore();
}
export const PISTA_DEVORA = {
  oficina: 'Cuando oigas golpes en la puerta, ciérrala. Si está en el pasillo, alúmbrala hasta que la barra se llene.',
  persecucion: 'No te pares: corre (Shift) y no mires atrás. La salida buena tiene luz.',
};
