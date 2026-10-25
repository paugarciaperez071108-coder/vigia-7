// =============================================================
// CRT.js — Pantallas de terminal de la nave (v0.50): un monitor CRT viejo.
//
// drawCRT(ctx, rect, content, opts)
//   rect     dónde está el cristal en pantalla { x, y, w, h }
//   content  (c, w, h, fx) => dibuja el texto en un lienzo propio del
//            tamaño del cristal; fx = { glow(color), color, dim, alert }
//   opts     { time, phosphor: 'green' | 'amber', curve, power (0..1),
//              alert (parpadeo rojo), reflect (reflejo de la sala) }
// Efectos: cristal curvado (las filas se estrechan hacia arriba y abajo y
// las esquinas se oscurecen), líneas de escaneo, banda que baja, brillo
// del fósforo, parpadeo leve, ruido, aberración de color en los bordes y
// el reflejo de la sala sobre el cristal.
//
// drawTerminal(c, w, h, fx, terminal, opts): el contenido estándar de una
// terminal (Terminal.js): arranque, cabecera, últimas líneas, la línea de
// estado (barra de progreso) y lo que se escribe con el cursor.
// =============================================================

export const PHOSPHOR = {
  green: { text: '#8dffb4', dim: 'rgba(110,255,160,0.55)', glow: 'rgba(80,255,140,0.9)', bg0: '#0b2416', bg1: '#020805', err: '#ffb36b' },
  ice: { text: '#b4ecff', dim: 'rgba(160,220,255,0.55)', glow: 'rgba(120,210,255,0.9)', bg0: '#0a1d29', bg1: '#02070b', err: '#ff6a5a' },
  amber: { text: '#ffcc66', dim: 'rgba(255,190,90,0.55)', glow: 'rgba(255,170,50,0.9)', bg0: '#26180a', bg1: '#070401', err: '#ff7a5a' },
};

let off = null;
let offCtx = null;

function canvasFor(w, h) {
  if (!off) {
    off = document.createElement('canvas');
    offCtx = off.getContext('2d');
  }
  if (off.width !== w || off.height !== h) {
    off.width = w;
    off.height = h;
  }
  return offCtx;
}

export function drawCRT(ctx, rect, content, opts = {}) {
  const { time = 0, phosphor = 'green', curve = 0.07, power = 1, alert = false, reflect = true } = opts;
  const P = PHOSPHOR[phosphor] ?? PHOSPHOR.green;
  const w = Math.max(8, Math.round(rect.w));
  const h = Math.max(8, Math.round(rect.h));
  const c = canvasFor(w, h);
  // Fondo del fósforo (más claro en el centro: el tubo encendido)
  const bg = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w * 0.7);
  bg.addColorStop(0, P.bg0);
  bg.addColorStop(1, P.bg1);
  c.globalAlpha = 1;
  c.fillStyle = bg;
  c.fillRect(0, 0, w, h);
  if (power > 0) {
    c.save();
    c.globalAlpha = power;
    const fx = {
      color: alert && Math.floor(time * 3) % 2 ? P.err : P.text,
      dim: P.dim,
      err: P.err,
      warn: '#ffd84a',      // v0.58: avisos del registro (amarillo)
      danger: '#ff4a3a',    // y peligros (rojo)
      glow: (col = P.glow, blur = 8) => {
        c.shadowColor = col;
        c.shadowBlur = blur;
      },
      noGlow: () => {
        c.shadowBlur = 0;
      },
    };
    content(c, w, h, fx);
    c.restore();
  }
  // Líneas de escaneo y la banda que baja
  c.fillStyle = 'rgba(0,0,0,0.26)';
  for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);
  const by = ((time * 55) % (h + 50)) - 25;
  const band = c.createLinearGradient(0, by - 18, 0, by + 18);
  band.addColorStop(0, 'rgba(255,255,255,0)');
  band.addColorStop(0.5, 'rgba(200,255,220,0.05)');
  band.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = band;
  c.fillRect(0, by - 18, w, 36);
  // Ruido (motas que aparecen y desaparecen)
  c.fillStyle = 'rgba(200,255,220,0.12)';
  for (let i = 0; i < 26; i++) c.fillRect(Math.random() * w, Math.random() * h, 1, 1);

  // --- Al cristal: curvatura por filas, parpadeo y aberración en los bordes ---
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, Math.min(rect.w, rect.h) * 0.09);
  ctx.clip();
  ctx.fillStyle = '#010302';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  const flick = 0.93 + Math.random() * 0.07 - (Math.random() < 0.015 ? 0.25 : 0);
  ctx.globalAlpha = flick;
  const step = 3;
  for (let y = 0; y < h; y += step) {
    const ny = (y + step / 2) / h * 2 - 1;
    const k = 1 - curve * ny * ny;              // las filas de arriba y abajo, algo más estrechas
    const dw = rect.w * k;
    ctx.drawImage(off, 0, y, w, step, rect.x + (rect.w - dw) / 2, rect.y + y * rect.h / h, dw, step * rect.h / h + 0.5);
  }
  // Aberración de color: copias desplazadas en rojo y azul, solo en los bordes
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.16;
  ctx.filter = 'sepia(1) saturate(6) hue-rotate(-40deg)';
  ctx.drawImage(off, rect.x - 2, rect.y, rect.w, rect.h);
  ctx.filter = 'sepia(1) saturate(6) hue-rotate(170deg)';
  ctx.drawImage(off, rect.x + 2, rect.y, rect.w, rect.h);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  // ...que en el centro se tapa: la imagen limpia vuelve por encima
  const mid = ctx.createRadialGradient(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.h * 0.2, rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w * 0.6);
  mid.addColorStop(0, 'rgba(0,0,0,0)');
  mid.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = mid;                         // esquinas del tubo, más oscuras
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  if (reflect) {
    // Reflejo de la sala en el cristal: la luz del techo arriba a la izquierda
    const r = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w * 0.6, rect.y + rect.h * 0.7);
    r.addColorStop(0, 'rgba(200,215,235,0.11)');
    r.addColorStop(0.45, 'rgba(200,215,235,0.03)');
    r.addColorStop(1, 'rgba(200,215,235,0)');
    ctx.fillStyle = r;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = 'rgba(220,230,255,0.05)';
    ctx.beginPath();
    ctx.ellipse(rect.x + rect.w * 0.24, rect.y + rect.h * 0.16, rect.w * 0.16, rect.h * 0.05, -0.25, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Arranque de la terminal (lo que sale al abrirla, antes de poder escribir)
export const BOOT_LINES = [
  'VIGIA-7 TERMINAL v2.3',
  'MEMORIA 640K ........ OK',
  'ENLACE ESTACION ..... OK',
  'SISTEMAS ............ OK',
];

/**
 * El contenido de una terminal. opts: { title, idle (líneas de estado
 * cuando no se escribe), hint, status (línea viva, p. ej. la barra de
 * resetcam), font (px) }
 */
export function drawTerminal(c, w, h, fx, term, opts = {}) {
  const fs = opts.font ?? Math.max(11, Math.round(h / 12));
  const lh = Math.round(fs * 1.28);
  const x = Math.round(fs * 0.8);
  let y = Math.round(fs * 0.7);
  c.textAlign = 'left';
  c.textBaseline = 'top';
  c.font = `${fs}px "Courier New", monospace`;
  const now = performance.now();
  const blink = Math.floor(now / 450) % 2 === 0;
  fx.glow();
  if (term.booting) {
    // Las líneas del arranque van saliendo
    const k = term.bootProgress;
    const n = Math.min(BOOT_LINES.length, Math.floor(k * (BOOT_LINES.length + 1)));
    c.fillStyle = fx.color;
    for (let i = 0; i < n; i++) c.fillText(BOOT_LINES[i], x, y + i * lh);
    if (blink) c.fillText('█', x, y + n * lh);
    return;
  }
  c.font = `bold ${fs}px "Courier New", monospace`;
  c.fillStyle = fx.color;
  c.fillText(opts.title ?? 'VIGIA-7 // TERMINAL', x, y);
  y += Math.round(lh * 1.35);
  c.font = `${fs}px "Courier New", monospace`;
  const lines = term.focused || !opts.idle ? term.lines : opts.idle;
  const extra = opts.status ? String(opts.status).split('\n').length : 0;
  const room = Math.max(1, Math.floor((h - y - lh * 2.6) / lh) - extra);
  // v0.58: las líneas largas (avisos con hora) se parten para que quepan
  const filas = [];
  for (const l of lines) {
    const text = typeof l === 'string' ? l : l.text;
    const kind = typeof l === 'string' ? 'info' : l.kind;
    const big = typeof l === 'object' && l.big;
    for (const t of partir(c, text, w - x * 2)) filas.push({ text: t, kind, big });
  }
  // (opts.fijas: las primeras líneas de estado no se van aunque haya muchas)
  const fijas = term.focused || !opts.idle ? 0 : Math.min(opts.fijas ?? 0, room - 1);
  let nf = 0;
  for (const l of lines.slice(0, fijas)) nf += partir(c, typeof l === 'string' ? l : l.text, w - x * 2).length;
  const vistas = fijas ? [...filas.slice(0, nf), ...filas.slice(nf).slice(-(room - nf))] : filas.slice(-room);
  for (const l of vistas) {
    const kind = l.kind;
    c.fillStyle = kind === 'err' ? fx.err : kind === 'cmd' ? fx.dim : kind === 'warn' ? fx.warn
      : kind === 'danger' ? fx.danger : fx.color;
    if (l.big) {
      // (una línea destacada: más grande y en negrita)
      c.font = `bold ${Math.round(fs * 1.45)}px "Courier New", monospace`;
      c.fillText(l.text, x, y + lh * 0.15);
      c.font = `${fs}px "Courier New", monospace`;
      y += lh * 1.6;
    } else {
      c.fillText(l.text, x, y);
      y += lh;
    }
  }
  if (opts.status) {
    // Línea viva (puede ser de varias, separadas por saltos de línea)
    c.fillStyle = fx.color;
    for (const l of String(opts.status).split('\n')) {
      c.fillText(l, x, y);
      y += lh;
    }
  }
  // Línea de escritura con el cursor de bloque
  const by = h - lh * 2.2;
  c.fillStyle = fx.color;
  if (term.focused) {
    const txt = `> ${term.input}`;
    c.fillText(txt, x, by);
    if (blink) c.fillText('█', x + c.measureText(txt).width, by);
  } else if (opts.prompt !== false) {
    c.fillText('>', x, by);
    if (blink) c.fillText('█', x + c.measureText('> ').width, by);
  }
  fx.noGlow();
  c.font = `${Math.max(9, Math.round(fs * 0.72))}px "Courier New", monospace`;
  c.fillStyle = fx.dim;
  c.fillText(opts.hint ?? (term.focused ? '[ENTER] EJECUTAR   [ESC] SALIR' : '[ENTER] O CLIC PARA ESCRIBIR'), x, h - lh * 1.05);
}

/** Barra de progreso de texto: [████░░░░] 40 % */
export function textBar(k, n = 10) {
  const full = Math.max(0, Math.min(n, Math.round(k * n)));
  return `[${'█'.repeat(full)}${'░'.repeat(n - full)}] ${Math.floor(k * 100)} %`;
}

/** Parte un texto en trozos que quepan en `ancho` píxeles (los siguientes, sangrados). */
function partir(c, text, ancho) {
  if (c.measureText(text).width <= ancho) return [text];
  const out = [];
  let linea = '';
  for (const p of text.split(' ')) {
    const prueba = linea ? `${linea} ${p}` : p;
    if (linea && c.measureText(prueba).width > ancho) {
      out.push(linea);
      linea = `  ${p}`;
    } else linea = prueba;
  }
  if (linea) out.push(linea);
  return out;
}
