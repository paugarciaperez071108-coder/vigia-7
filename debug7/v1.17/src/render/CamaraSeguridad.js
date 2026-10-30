// =============================================================
// CamaraSeguridad.js — Lo que hace que la imagen parezca grabada por una
// cámara de seguridad barata de verdad (v0.77; el usuario: «que parezca
// grabado por una cámara de seguridad real, no un render limpio»). Lo usa
// CameraView._postProcess en TODAS las noches y la cinemática de la noche 6.
//
//   aberracion(ctx, px)        aberración cromática (rojo y azul desplazados)
//   bloques(ctx, k)            compresión digital: bloques que se quedan atrás
//   desenfoque(ctx, k, dx, dy) estela de movimiento (k: cuánto)
//   quemado(ctx, k, x, y)      exposición automática que se pasa (un destello)
//   Retencion                  baja velocidad de fotogramas (12–15 fps) con
//                              algún salto o fotograma congelado
// =============================================================

import { CONFIG } from '../config.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
let copia = null;
let canal = null;

function lienzos() {
  if (copia) return;
  copia = document.createElement('canvas');
  copia.width = W;
  copia.height = H;
  canal = document.createElement('canvas');
  canal.width = W;
  canal.height = H;
}

/** Copia lo que hay pintado ahora en ctx. */
function copiar(ctx) {
  lienzos();
  const c = copia.getContext('2d');
  c.globalCompositeOperation = 'copy';
  c.drawImage(ctx.canvas, 0, 0, ctx.canvas.width, ctx.canvas.height, 0, 0, W, H);
  c.globalCompositeOperation = 'source-over';
}

/** Un canal de la copia (r, g o b), para volver a sumarlo desplazado. */
function soloCanal(color) {
  const c = canal.getContext('2d');
  c.globalCompositeOperation = 'copy';
  c.drawImage(copia, 0, 0);
  c.globalCompositeOperation = 'multiply';
  c.fillStyle = color;
  c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'source-over';
  return canal;
}

/** Aberración cromática: el rojo se va a un lado y el azul al otro (más en los bordes). */
export function aberracion(ctx, px = 1.5) {
  if (px <= 0) return;
  copiar(ctx);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const sx = ctx.canvas.width / W;
  ctx.scale(sx, ctx.canvas.height / H);
  // Quita el rojo y el azul de la imagen y los vuelve a poner desplazados
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgb(0,255,0)';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  // (escalado un poco desde el centro: el desplazamiento crece hacia los bordes, como en una lente)
  const z = 1 + px / W * 2;
  ctx.drawImage(soloCanal('rgb(255,0,0)'), -px - (W * (z - 1)) / 2, -(H * (z - 1)) / 2, W * z, H * z);
  ctx.drawImage(soloCanal('rgb(0,0,255)'), px * 0.6, 0, W, H);
  ctx.restore();
}

/** Compresión digital: bloques de 16 px que se quedan con la imagen de un poco antes, o corridos. */
export function bloques(ctx, k) {
  if (k <= 0) return;
  copiar(ctx);
  const n = Math.round(4 + 60 * k);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(ctx.canvas.width / W, ctx.canvas.height / H);
  for (let i = 0; i < n; i++) {
    const b = 16 * (1 + Math.floor(Math.random() * 3));
    const x = Math.floor((Math.random() * W) / 16) * 16;
    const y = Math.floor((Math.random() * H) / 16) * 16;
    const dx = (Math.random() - 0.5) * 24 * k;
    ctx.globalAlpha = 0.6 + 0.4 * Math.random();
    ctx.drawImage(copia, x + dx, y, b, b, x, y, b, b);
    if (Math.random() < 0.3) {
      // Bloque «aplanado»: un solo color medio (como cuando el vídeo pierde datos)
      ctx.drawImage(copia, x + b / 2, y + b / 2, 1, 1, x, y, b, b);
    }
  }
  ctx.restore();
}

/** Estela de movimiento: la imagen corrida, encima, con poca opacidad. */
export function desenfoque(ctx, k, dx = 6, dy = 0) {
  if (k <= 0) return;
  copiar(ctx);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(ctx.canvas.width / W, ctx.canvas.height / H);
  for (let i = 1; i <= 3; i++) {
    ctx.globalAlpha = 0.18 * k / i;
    ctx.drawImage(copia, dx * i * k, dy * i * k);
  }
  ctx.restore();
}

/** La exposición automática se pasa un instante: todo se quema hacia blanco desde (x, y). */
export function quemado(ctx, k, x = W / 2, y = H / 2) {
  if (k <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const g = ctx.createRadialGradient(x, y, 0, x, y, W * 0.8);
  g.addColorStop(0, `rgba(255,250,240,${0.85 * k})`);
  g.addColorStop(0.4, `rgba(255,245,230,${0.45 * k})`);
  g.addColorStop(1, `rgba(255,240,220,${0.15 * k})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/**
 * Baja velocidad de fotogramas: se pinta en un lienzo propio solo cada
 * 1/fps s (y a veces se salta uno o se queda congelado); el resto del
 * tiempo se repite el último.
 *   const r = new Retencion(13);  …  r.pintar(ctx, dt, (c) => dibujarEscena(c));
 */
export class Retencion {
  constructor(fps = 13) {
    this.fps = fps;
    this.t = 1;
    this.congelado = 0;
    this.lienzo = document.createElement('canvas');
    this.lienzo.width = W;
    this.lienzo.height = H;
  }

  /** Devuelve true si este fotograma es nuevo. */
  pintar(ctx, dt, dibujar) {
    this.t += dt;
    let nuevo = false;
    if (this.congelado > 0) this.congelado -= dt;
    else if (this.t >= 1 / this.fps) {
      this.t = Math.random() < 0.06 ? -1 / this.fps : 0;         // (un salto: se pierde un fotograma)
      if (Math.random() < 0.02) this.congelado = 0.25 + Math.random() * 0.35;   // (se congela)
      const c = this.lienzo.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, W, H);
      dibujar(c);
      nuevo = true;
    }
    ctx.drawImage(this.lienzo, 0, 0, W, H);
    return nuevo;
  }
}
