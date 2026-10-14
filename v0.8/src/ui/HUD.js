// =============================================================
// HUD.js — Hora, noche, carga del reactor, barras de uso y avisos.
// =============================================================

import { CONFIG } from '../config.js';

// Panel de la cinta (arriba a la izquierda) y sus botones
const TAPE_PANEL = { x: 20, y: 44, w: 470, h: 42 };
export const TAPE_SKIP = { x: 236, y: 49, w: 120, h: 32 };
export const TAPE_SUBS = { x: 362, y: 49, w: 122, h: 32 };
// Cinta ya escuchada: botón para volver a ponerla
export const TAPE_PLAY = { x: 20, y: 44, w: 300, h: 42 };
// Caja de subtítulos (centrada, sin tapar el minimapa ni el reactor)
const SUBS_BOX = { cx: 690, bottom: 838, maxW: 660 };

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function drawHUD(ctx, { clockLabel, night, reactor, warnings = [], hint, debug, tape, tapeAvailable }) {
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#e8eef5';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 6;

  // Hora y noche (arriba a la derecha)
  ctx.textAlign = 'right';
  ctx.font = 'bold 54px "Courier New", monospace';
  ctx.fillText(clockLabel, 1560, 24);
  ctx.font = '22px "Courier New", monospace';
  ctx.fillText(`Noche ${night}`, 1560, 84);

  // Reactor (abajo a la izquierda): temperatura, barra, qué lo
  // está calentando y enfriamientos que quedan esta noche.
  if (reactor) {
    const lvl = reactor.level;
    const danger = lvl >= CONFIG.REACTOR.WARNING_LEVEL;
    ctx.textAlign = 'left';
    ctx.font = '24px "Courier New", monospace';
    ctx.fillStyle = danger && Math.floor(performance.now() / 300) % 2 ? '#ff5050' : '#e8eef5';
    ctx.fillText(`Reactor: ${Math.floor(lvl)}%`, 40, 742);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(40, 776, 240, 14);
    ctx.fillStyle = lvl < 50 ? '#3ee07a' : lvl < CONFIG.REACTOR.WARNING_LEVEL ? '#e6c43a' : '#f04a3a';
    ctx.fillRect(40, 776, 240 * Math.min(1, lvl / 100), 14);
    ctx.strokeStyle = 'rgba(232,238,245,0.6)';
    ctx.strokeRect(40, 776, 240, 14);
    ctx.fillStyle = '#e8eef5';
    ctx.font = '20px "Courier New", monospace';
    ctx.fillText('Calentando:', 40, 804);
    for (let i = 0; i < reactor.bars; i++) {
      ctx.fillStyle = ['#e6c43a', '#f0902e', '#f04a3a', '#f04a3a'][Math.min(i, 3)];
      ctx.fillRect(180 + i * 22, 806, 16, 20);
    }
    // Enfriamientos: un rombo por uso (lleno = disponible)
    ctx.fillStyle = '#e8eef5';
    ctx.fillText(reactor.isCooling ? 'Enfriando...' : 'Enfriamientos:', 40, 840);
    const total = reactor.charges + reactor.used;
    for (let i = 0; i < total; i++) {
      const x = 236 + i * 26;
      const y = 851;
      ctx.beginPath();
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x + 9, y);
      ctx.lineTo(x, y + 10);
      ctx.lineTo(x - 9, y);
      ctx.closePath();
      if (i < reactor.charges) {
        ctx.fillStyle = '#7fd8ff';
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(127,216,255,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  // Avisos parpadeantes (arriba, centrados)
  ctx.shadowBlur = 6;
  if (warnings.length && Math.floor(performance.now() / 400) % 2 === 0) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 26px "Courier New", monospace';
    ctx.fillStyle = '#ff5050';
    warnings.forEach((w, i) => ctx.fillText(`⚠ ${w}`, 800, 24 + i * 34));
  }

  // Ayuda de teclas (arriba a la izquierda)
  ctx.fillStyle = 'rgba(232,238,245,0.45)';
  ctx.font = '16px "Courier New", monospace';
  ctx.textAlign = 'left';
  if (hint) ctx.fillText(hint, 20, 20);

  if (tapeAvailable) {
    ctx.save();
    ctx.shadowBlur = 0;
    const r = TAPE_PLAY;
    ctx.fillStyle = 'rgba(10,8,4,0.7)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = 'rgba(230,200,140,0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = '#e6c88c';
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▶ ESCUCHAR LA CINTA (L)', r.x + r.w / 2, r.y + r.h / 2 + 1);
    ctx.restore();
  }

  if (tape?.playing) {
    drawTapePanel(ctx, tape);
    const sub = tape.subtitle;
    if (sub) drawSubtitle(ctx, sub);
  }

  if (debug) {
    ctx.fillStyle = '#ff0';
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '16px "Courier New", monospace';
    debug.forEach((line, i) => ctx.fillText(line, 20, 96 + i * 20));
  }
  ctx.restore();
}

/** Casete sonando: tiempo y botones SALTAR / SUBTÍTULOS. */
function drawTapePanel(ctx, tape) {
  const p = TAPE_PANEL;
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(10,8,4,0.82)';
  ctx.strokeStyle = 'rgba(230,200,140,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(p.x, p.y, p.w, p.h, 6);
  ctx.fill();
  ctx.stroke();
  // Bobinas girando
  const a = tape.time * 4;
  for (const cx of [p.x + 22, p.x + 50]) {
    ctx.strokeStyle = '#e6c88c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, p.y + 21, 10, 0, Math.PI * 2);
    ctx.moveTo(cx + Math.cos(a) * 9, p.y + 21 + Math.sin(a) * 9);
    ctx.lineTo(cx - Math.cos(a) * 9, p.y + 21 - Math.sin(a) * 9);
    ctx.stroke();
  }
  ctx.fillStyle = '#e6c88c';
  ctx.font = 'bold 16px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`CINTA ${mmss(tape.time)}`, p.x + 70, p.y + 21);
  button(ctx, TAPE_SKIP, 'SALTAR (M)');
  button(ctx, TAPE_SUBS, `SUBT: ${tape.subsOn ? 'SI' : 'NO'} (C)`);
  ctx.restore();
}

function button(ctx, r, label) {
  ctx.fillStyle = 'rgba(230,200,140,0.15)';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = 'rgba(230,200,140,0.7)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = '#f2dcae';
  ctx.font = 'bold 13px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
}

function drawSubtitle(ctx, text) {
  const b = SUBS_BOX;
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.font = '24px "Courier New", monospace';
  // Partir en líneas que quepan
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > b.maxW) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  lines.push(line);
  const lh = 30;
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 32;
  const h = lines.length * lh + 16;
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(b.cx - w / 2, b.bottom - h, w, h);
  ctx.fillStyle = '#f2e6c8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, b.cx, b.bottom - h + 8 + i * lh));
  ctx.restore();
}
