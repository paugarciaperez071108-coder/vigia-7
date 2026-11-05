// =============================================================
// NoteOverlay.js — Una nota en primer plano para leerla (texto de
// src/world/Notes.js). Se abre con open(id) y se cierra con un clic o
// con Esc. El juego sigue mientras se lee (no es una pausa).
// =============================================================

import { CONFIG } from '../config.js';
import { NOTES } from '../world/Notes.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;

const STYLE = {
  posit: { w: 420, h: 420, paper: '#d8c64a', ink: '#2b2410', font: 'italic 30px "Segoe Print", "Comic Sans MS", cursive', title: false },
  hoja: { w: 620, h: 560, paper: '#cfc8b0', ink: '#231d16', font: 'italic 28px "Segoe Print", "Comic Sans MS", cursive', title: true },
  placa: { w: 720, h: 420, paper: '#2a2f33', ink: '#e6d9c4', font: 'bold 30px "Courier New", monospace', title: true, red: true },
};

export class NoteOverlay {
  constructor() {
    this.id = null;
    this.t = 0;
  }

  get active() {
    return this.id !== null;
  }

  open(id) {
    if (!NOTES[id]) return false;
    this.id = id;
    this.t = 0;
    return true;
  }

  close() {
    this.id = null;
  }

  update(dt) {
    if (this.active) this.t += dt;
  }

  /** Primera nota (de una lista [{ id, rect }]) bajo (x, y). */
  static hit(list, x, y) {
    return (list ?? []).find(({ rect: r }) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)?.id ?? null;
  }

  draw(ctx) {
    if (!this.active) return;
    const n = NOTES[this.id];
    const s = STYLE[n.estilo] ?? STYLE.hoja;
    const k = Math.min(1, this.t / 0.18);
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.65 * k})`;
    ctx.fillRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2 + (1 - k) * 40);
    ctx.rotate(-0.025);
    ctx.globalAlpha = k;
    // Papel (o placa) con sombra, manchas y bordes gastados
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 30;
    ctx.fillStyle = s.paper;
    ctx.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
    ctx.shadowBlur = 0;
    const g = ctx.createRadialGradient(-s.w * 0.2, s.h * 0.2, 10, 0, 0, s.w * 0.8);
    g.addColorStop(0, 'rgba(90,60,20,0.18)');
    g.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = g;
    ctx.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
    if (s.red) {
      ctx.fillStyle = '#7a1c18';
      ctx.fillRect(-s.w / 2, -s.h / 2, s.w, 70);
    }
    // Texto
    ctx.fillStyle = s.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let y = -s.h / 2 + 70;
    if (s.title) {
      ctx.font = s.red ? 'bold 26px "Courier New", monospace' : 'bold 26px "Courier New", monospace';
      if (s.red) ctx.fillStyle = '#f0d9c8';
      ctx.fillText(n.titulo, 0, -s.h / 2 + 36);
      ctx.fillStyle = s.ink;
      y += 50;
    }
    ctx.font = s.font;
    for (const line of wrap(ctx, n.texto, s.w - 80)) {
      ctx.fillText(line, 0, y);
      y += 40;
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = k * 0.7;
    ctx.fillStyle = '#c8d0d6';
    ctx.font = '16px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Clic o Esc para cerrar', W / 2, H - 40);
    ctx.restore();
  }
}

/** Parte el texto en líneas que quepan en `width` (respeta los saltos). */
function wrap(ctx, text, width) {
  const out = [];
  for (const para of text.split('\n')) {
    if (!para) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > width && line) {
        out.push(line);
        line = word;
      } else line = test;
    }
    out.push(line);
  }
  return out;
}
