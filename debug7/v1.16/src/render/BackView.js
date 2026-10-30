// =============================================================
// BackView.js — Lo que hay DETRÁS de la oficina: la pared trasera con la
// compuerta del PASILLO CENTRAL (estaba sellada por el protocolo de
// contención; se abre al final de la noche 2 y se usa desde la noche 3).
// Es la pared de atrás de la oficina (se llega girando: src/systems/OfficeTurn.js).
//
// draw(ctx, opts):
//   open      0..1  cuánto ha subido la compuerta (0 = cerrada)
//   sealed    true  barras de bloqueo puestas (antes de abrirse)
//   red       0..1  destello de la luz roja de alarma
//   glimpse   0..1 o null: una silueta cruza el fondo del pasillo
// Luz (v0.50): el pasillo está a oscuras de verdad; la baliza roja solo
// ilumina la pared, el marco y el suelo de delante (nunca el hueco), y la
// compuerta cerrada es una plancha de acero con sus barras de bloqueo
// (metal con luz y sombra, no franjas rojas).
//   inCorridor(ctx, rect, vp)  para dibujar cosas DENTRO del pasillo
//             (enemigos de la noche 3); rect = hueco, vp = punto de fuga
// emitDust(n): suelta polvo/vapor por la compuerta (al abrirse).
// =============================================================

import { CONFIG } from '../config.js';
import { CARTEL_DE_NOCHE } from '../world/Notes.js';

// v0.58: el título de la placa de la pared, cada noche (la 5 es la del render)
const PLACA_TITULO = { 1: 'PROTOCOLO 7-A', 2: 'PROTOCOLO 7-A', 3: 'AVISO 7-C', 4: 'CUARENTENA 9', 6: 'EMERGENCIA 0' };

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
// Hueco de la compuerta (el mismo que en el modelo 3D: tools/3d/salas/nave.py)
export const BACK_HATCH = { x: 620, y: 242, w: 360, h: 480 };
// (v1.12) La placa de cada noche: recorte del render de la pared de atrás (integrar_oficina.py)
const PLACA = { x: 1120, y: 272, w: 250, h: 72 };
const PLACAS = {};
function placa(titulo) {
  const k = titulo.replace(/ /g, '_');
  let i = PLACAS[k];
  if (!i) {
    i = PLACAS[k] = new Image();
    i.src = `assets/salas/v2/placa_${k}.webp`;
  }
  return i.complete && i.naturalWidth ? i : null;
}
const VP = { x: 800, y: 470 };   // punto de fuga del pasillo

export class BackView {
  constructor() {
    this.time = 0;
    this.dust = [];
    this.sprites = null;
    this.v2 = null;        // (v1.12) la oficina de Blender (OficinaV2): su vista de detrás
  }

  update(dt) {
    this.time += dt;
    for (const p of this.dust) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.985;
      p.vy *= 0.985;
    }
    this.dust = this.dust.filter((p) => p.t < p.life);
  }

  /** Polvo y vapor que salen por la compuerta al subir. */
  emitDust(n, open = 0) {
    const r = BACK_HATCH;
    for (let i = 0; i < n; i++) {
      const fromBottom = Math.random() < 0.7;
      const x = r.x + Math.random() * r.w;
      const y = fromBottom ? r.y + r.h - 10 - Math.random() * 30 : r.y + r.h * (1 - open) + Math.random() * 20;
      this.dust.push({
        x, y, t: 0, life: 1.6 + Math.random() * 1.8,
        vx: (x - (r.x + r.w / 2)) * (0.4 + Math.random() * 0.6) + (Math.random() - 0.5) * 40,
        vy: fromBottom ? -10 - Math.random() * 40 : 20 + Math.random() * 30,
        r0: 8 + Math.random() * 14, r1: 50 + Math.random() * 60,
        steam: Math.random() < 0.4,
      });
    }
  }

  /**
   * v0.58: la placa de la pared (en el render pone «PROTOCOLO 7-B», la de la noche 5); las otras
   * noches, la suya. (v1.12) Cada placa es un recorte del mismo render (oficina_v2.py --placa=…),
   * nada pintado encima.
   */
  _placa(ctx) {
    const titulo = PLACA_TITULO[this.noche];
    if (!titulo) return;
    const im = placa(titulo);
    if (im) ctx.drawImage(im, PLACA.x, PLACA.y, PLACA.w, PLACA.h);
  }

  draw(ctx, { open = 0, sealed = false, red = 0, glimpse = null, inCorridor = null } = {}) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (!this.v2?.drawBase(ctx, 'back', this.apagon)) return;
    this._placa(ctx);
    this._corridor(ctx, open, red, glimpse, inCorridor);
    this._hatch(ctx, open, sealed);
    this._frame(ctx, sealed, red);
    this._floorGlow(ctx, sealed, red);
    this._drawDust(ctx);
    if (red > 0) {
      // Tinte rojo de la alarma en la sala (no dentro del pasillo abierto)
      ctx.save();
      this._outsideHole(ctx, open);
      ctx.fillStyle = `rgba(255,30,20,${0.1 * red})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  /** Recorta todo MENOS el hueco abierto de la compuerta (la luz de la sala no entra). */
  _outsideHole(ctx, open) {
    if (open <= 0) return;
    const r = BACK_HATCH;
    const shown = r.h * Math.min(1, open);
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.rect(r.x, r.y + r.h - shown, r.w, shown);
    ctx.clip('evenodd');
  }

  /** La baliza tiñe el suelo de delante de la compuerta (fuera del hueco). */
  _floorGlow(ctx, sealed, red) {
    const on = Math.max(red, sealed ? 0 : 0.35);
    if (on <= 0) return;
    const r = BACK_HATCH;
    const k = 0.5 + 0.5 * Math.max(0, Math.cos(this.time * 4));
    const g = ctx.createLinearGradient(0, r.y + r.h, 0, H);
    g.addColorStop(0, `rgba(255,40,25,${0.1 * on * k})`);
    g.addColorStop(1, 'rgba(255,40,25,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(r.x - 40, r.y + r.h);
    ctx.lineTo(r.x + r.w + 40, r.y + r.h);
    ctx.lineTo(r.x + r.w + 220, H);
    ctx.lineTo(r.x - 220, H);
    ctx.closePath();
    ctx.fill();
  }

  _corridor(ctx, open, red, glimpse, inCorridor) {
    if (open <= 0) return;
    const r = BACK_HATCH;
    const pulse = 0.55 + 0.45 * Math.sin(this.time * 3.2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    // El pasillo central del render: a oscuras de verdad (solo se adivina el primer tramo junto
    // a la compuerta), se pierde al fondo
    const dk = ctx.createRadialGradient(VP.x, VP.y, 20, VP.x, VP.y, r.w * 0.75);
    dk.addColorStop(0, 'rgba(2,2,3,0.97)');
    dk.addColorStop(1, 'rgba(2,2,3,0.86)');
    ctx.fillStyle = dk;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    // Una luz de emergencia muy lejos, al fondo (un punto, no un resplandor)
    const g = ctx.createRadialGradient(VP.x, VP.y - 20, 1, VP.x, VP.y - 20, 34);
    g.addColorStop(0, `rgba(255,50,35,${0.16 * pulse + 0.08 * red})`);
    g.addColorStop(1, 'rgba(255,50,35,0)');
    ctx.fillStyle = g;
    ctx.fillRect(VP.x - 40, VP.y - 60, 80, 80);
    inCorridor?.(ctx, r, VP);
    // Una silueta cruza el fondo: casi negra contra el rojo (solo se insinúa)
    if (glimpse !== null && glimpse >= 0 && glimpse <= 1) {
      const sw = r.w * Math.pow(0.7, 3);
      const x = VP.x - sw * 0.9 + sw * 1.8 * glimpse;
      const base = VP.y + 34;
      const hgt = 120;
      const bob = Math.sin(glimpse * Math.PI * 6) * 2;
      // v0.51: a contraluz. La baliza del fondo se enciende justo detrás de
      // él (antes era negro sobre negro y en la partida no se veía)
      const halo = Math.sin(glimpse * Math.PI);
      const bl = ctx.createRadialGradient(VP.x, base - 60, 4, VP.x, base - 60, 150);
      bl.addColorStop(0, `rgba(255,70,45,${0.75 * halo})`);
      bl.addColorStop(0.5, `rgba(200,30,20,${0.35 * halo})`);
      bl.addColorStop(1, 'rgba(120,10,5,0)');
      ctx.fillStyle = bl;
      ctx.fillRect(VP.x - 150, base - 210, 300, 260);
      // v0.51: la silueta de El Largo NUEVO (su imagen, en negro), no la
      // figura de antes con la cabeza ovalada
      const img = this.sprites?.images?.get('crt_largo_stand');
      if (img) {
        const h = hgt * 1.25;
        ctx.save();
        ctx.filter = 'brightness(0)';
        ctx.globalAlpha = 0.97;
        ctx.drawImage(img, x - 0.65 * h, base - 0.95 * 1.3 * h + bob, 1.3 * h, 1.3 * h);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // --- La compuerta: plancha que sube ---
  _hatch(ctx, open, sealed) {
    // (v1.12) La compuerta y sus vigas de bloqueo son del render (oficina_v2.py --puerta=cerrada
    // [--sellada]): sube según open (0..1)
    if (open >= 1) return;
    const r = BACK_HATCH;
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x - 60, r.y - 40, r.w + 120, r.h + 40);
    ctx.clip();
    this.v2?.drawCompuertaAtras(ctx, r, r.h * open, sealed && open <= 0);
    ctx.restore();
  }

  // --- Marco, cartel y luz de alarma ---
  _frame(ctx, sealed, red) {
    const r = BACK_HATCH;
    ctx.save();
    // (v1.12) El cartel rojo y la cúpula de la baliza están en el render: aquí, el aviso de cada
    // noche (src/world/Notes.js; this.noche lo pone Game) y la luz de la baliza
    ctx.fillStyle = 'rgba(240,217,200,0.9)';
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cartel = CARTEL_DE_NOCHE[this.noche] ?? CARTEL_DE_NOCHE[5];
    ctx.fillText(sealed ? cartel[0] : cartel[1], r.x + r.w / 2, r.y - 58);
    // Baliza roja encima: gira y barre la pared
    const on = Math.max(red, sealed ? 0 : 0.35);
    const a = this.time * 4;
    const bx = r.x + r.w / 2;
    const by = r.y - 124;
    if (on > 0) {
      ctx.globalCompositeOperation = 'lighter';
      const gl = ctx.createRadialGradient(bx, by, 0, bx, by, 40);
      gl.addColorStop(0, `rgba(255,60,40,${0.8 * on})`);
      gl.addColorStop(1, 'rgba(255,40,30,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(bx - 40, by - 40, 80, 80);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (on > 0) {
      // El barrido ilumina la pared y el marco, no el interior del hueco
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip('evenodd');
      ctx.globalCompositeOperation = 'lighter';
      for (const off of [0, Math.PI]) {
        const ang = a + off;
        const g = ctx.createRadialGradient(bx, by, 10, bx, by, 700);
        g.addColorStop(0, `rgba(255,40,25,${0.22 * on})`);
        g.addColorStop(1, 'rgba(255,40,25,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.arc(bx, by, 700, ang - 0.25, ang + 0.25);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  _drawDust(ctx) {
    if (!this.dust.length) return;
    ctx.save();
    for (const p of this.dust) {
      const f = p.t / p.life;
      const rad = p.r0 + (p.r1 - p.r0) * f;
      const alpha = (p.steam ? 0.22 : 0.16) * (1 - f) * Math.min(1, p.t * 4);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
      const c = p.steam ? '200,205,210' : '150,140,128';
      g.addColorStop(0, `rgba(${c},${alpha})`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(p.x - rad, p.y - rad, rad * 2, rad * 2);
    }
    ctx.restore();
  }
}
