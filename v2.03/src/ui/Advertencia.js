// =============================================================
// Advertencia.js — (v1.97, el usuario: «añade los requisitos mínimos antes de empezar, después de la animación de
// rewap studios, como los avisos de advertencia de Five Nights at Freddy's») La pantalla de aviso de cada arranque:
// justo después del logo, cada vez que se abre el juego. Negro, el aviso del contenido (sustos con sonido fuerte, luces
// que parpadean, violencia con sangre) y los requisitos mínimos (medidos en la v1.97: ver CHANGELOG).
//   0,0–0,5 s   entra (con un parpadeo de interferencia, como el del logo)
//   hasta 10 s  quieta; desde 1,2 s, cualquier tecla o clic la quita
//   0,5 s       fundido a negro
// Sin sonido (como el silencio de antes de una noche). Los textos, en idiomas/*.json (grupo «aviso_inicio»).
// Tiene la forma del logo (update, draw, salta, acabado): Game la pone en this.logo al acabar el logo, en el mismo
// estado «logo» (así el audio y el prólogo que se va cargando siguen igual).
// =============================================================

import { CONFIG } from '../config.js';
import { dice } from '../core/Idioma.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
export const AVISO = {
  ENTRA: 0.5,        // s del fundido de entrada
  SALTA_DESDE: 1.2,  // s: antes no se puede quitar (la tecla que saltó el logo no se la lleva por delante)
  DURA: 10,          // s que se queda si no se pulsa nada
  SALE: 0.5,         // s del fundido a negro
  ROJO: '#ff5050', TEXTO: '#e8eef5', GRIS: '#8fa3b5', VERDE: '#7dffb0', LINEA: '#2a3540',
  FUENTE: 'Consolas, "Courier New", monospace',
};
// las filas de los requisitos: [clave del nombre, clave del valor] (el sistema, según sea el .exe o la web)
const FILAS = (exe) => [
  ['aviso_inicio.req_sistema', exe ? 'aviso_inicio.req_sistema_exe' : 'aviso_inicio.req_sistema_web'],
  ['aviso_inicio.req_cpu', 'aviso_inicio.req_cpu_v'],
  ['aviso_inicio.req_ram', 'aviso_inicio.req_ram_v'],
  ['aviso_inicio.req_gpu', 'aviso_inicio.req_gpu_v'],
  ['aviso_inicio.req_disco', exe ? 'aviso_inicio.req_disco_exe' : 'aviso_inicio.req_disco_web'],
];

/** Parte un texto en líneas que caben en `ancho` (con la fuente que tenga ctx). */
function parte(ctx, texto, ancho) {
  const out = [];
  let linea = '';
  for (const p of texto.split(' ')) {
    const prueba = linea ? `${linea} ${p}` : p;
    if (linea && ctx.measureText(prueba).width > ancho) {
      out.push(linea);
      linea = p;
    } else linea = prueba;
  }
  if (linea) out.push(linea);
  return out;
}

export class Advertencia {
  constructor() {
    this.esAviso = true;
    this.t = 0;
    this.acabado = false;
    this.tSale = null;               // cuándo empezó el fundido de salida
    // (el .exe lleva la API de pywebview; la web, no)
    this.exe = typeof window !== 'undefined' && !!window.pywebview;
  }

  /** ¿Se puede quitar ya? (las primeras décimas, no: la pulsación que saltó el logo no cuenta) */
  puedeSaltar() {
    return this.t >= AVISO.SALTA_DESDE;
  }

  salta() {
    if (this.tSale === null) this.tSale = this.t;
  }

  update(dt) {
    if (this.acabado) return;
    this.t += Math.min(dt, 1 / 30);
    if (this.tSale === null && this.t >= AVISO.DURA) this.tSale = this.t;
    if (this.tSale !== null && this.t - this.tSale >= AVISO.SALE) this.acabado = true;
  }

  draw(ctx) {
    const A = AVISO;
    const t = this.t;
    let alfa = Math.min(1, t / A.ENTRA);
    if (this.tSale !== null) alfa *= Math.max(0, 1 - (t - this.tSale) / A.SALE);
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    // la entrada, con un temblor de interferencia (el mismo aire de las cámaras)
    const temblor = t < A.ENTRA ? (Math.random() - 0.5) * 10 * (1 - t / A.ENTRA) : 0;
    ctx.globalAlpha = alfa;
    ctx.translate(temblor, 0);
    ctx.textBaseline = 'alphabetic';

    // el triángulo de aviso y «AVISO»
    const cx = W / 2;
    let y = 132;
    ctx.strokeStyle = A.ROJO;
    ctx.fillStyle = A.ROJO;
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, y - 52);
    ctx.lineTo(cx + 34, y + 8);
    ctx.lineTo(cx - 34, y + 8);
    ctx.closePath();
    ctx.stroke();
    ctx.fillRect(cx - 3, y - 30, 6, 22);
    ctx.fillRect(cx - 3, y - 3, 6, 6);
    y += 82;
    ctx.textAlign = 'center';
    ctx.font = `bold 60px ${A.FUENTE}`;
    ctx.fillText(dice('aviso_inicio.titulo'), cx, y);

    // el contenido
    y += 62;
    ctx.fillStyle = A.TEXTO;
    ctx.font = `28px ${A.FUENTE}`;
    for (const l of parte(ctx, dice('aviso_inicio.contenido'), 1180)) {
      ctx.fillText(l, cx, y);
      y += 40;
    }
    y += 6;
    ctx.fillStyle = A.GRIS;
    ctx.font = `22px ${A.FUENTE}`;
    for (const l of parte(ctx, dice('aviso_inicio.luces'), 1180)) {
      ctx.fillText(l, cx, y);
      y += 32;
    }
    ctx.fillText(dice('aviso_inicio.auriculares'), cx, y);

    // la raya y los requisitos mínimos
    y += 44;
    ctx.fillStyle = A.LINEA;
    ctx.fillRect(cx - 420, y, 840, 2);
    y += 52;
    ctx.fillStyle = A.VERDE;
    ctx.font = `bold 26px ${A.FUENTE}`;
    ctx.fillText(dice('aviso_inicio.req_titulo'), cx, y);
    y += 46;
    const filas = FILAS(this.exe);
    ctx.font = `22px ${A.FUENTE}`;
    // el nombre a la izquierda de colX y el valor a la derecha, con el bloque entero centrado
    const anchoN = Math.max(...filas.map(([k]) => ctx.measureText(dice(k)).width));
    const anchoV = Math.max(...filas.map(([, v]) => ctx.measureText(dice(v)).width));
    const colX = cx - (anchoN + 36 + anchoV) / 2 + anchoN + 18;
    for (const [k, v] of filas) {
      ctx.textAlign = 'right';
      ctx.fillStyle = A.GRIS;
      ctx.fillText(dice(k), colX - 18, y);
      ctx.textAlign = 'left';
      ctx.fillStyle = A.TEXTO;
      ctx.fillText(dice(v), colX + 18, y);
      y += 34;
    }

    // «pulsa cualquier tecla», cuando ya se puede
    if (this.puedeSaltar() && this.tSale === null) {
      ctx.textAlign = 'center';
      ctx.fillStyle = A.GRIS;
      ctx.globalAlpha = alfa * (0.45 + 0.35 * Math.sin(t * 3));
      ctx.font = `20px ${A.FUENTE}`;
      ctx.fillText(dice('aviso_inicio.seguir'), cx, H - 40);
    }
    ctx.restore();

    // las líneas de barrido de una pantalla vieja, muy suaves
    ctx.save();
    ctx.globalAlpha = 0.06 * alfa;
    ctx.fillStyle = '#000';
    for (let yy = 0; yy < H; yy += 4) ctx.fillRect(0, yy, W, 2);
    ctx.restore();
  }
}
