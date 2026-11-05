// =============================================================
// Retos.js — (v1.57) El apartado Retos de Extras: la lista (extras.json), con los niveles de cada enemigo, su extra de
// dificultad y su estrella, y la noche personalizada (6 niveles de 0 a 20, sin extra ni estrella).
// Se juega con Game.empiezaReto; al ganar o perder, vuelve aquí.
// =============================================================

import { ExtrasProgreso } from '../../core/ExtrasProgreso.js';
import { colorDe } from '../../core/Colores.js';
import { ENEMIGOS_RETO } from '../../night/retos.js';
import { TEXTOS, VERDE, VERDE_OSC, TINTA, GRIS, FUENTE, inside, lineas, boton } from './comun.js';

const FILA = (i) => ({ x: 100, y: 152 + i * 44, w: 640, h: 38 });
const X = 780;
const BARRA = (i) => ({ x: X + 170, y: 240 + i * 42, w: 400, h: 20 });
const EMPEZAR = { x: X + 200, y: 690, w: 320, h: 52 };

/** Una estrella de cinco puntas. */
export function estrella(ctx, x, y, r, color, borde = null) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const q = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (borde) {
    // (la negra brilla por el borde: si no, parece un hueco)
    const negra = color === '#000000';
    ctx.save();
    ctx.strokeStyle = borde;
    ctx.lineWidth = negra ? 2.2 : 1.5;
    if (negra) {
      ctx.shadowColor = '#ff3b30';
      ctx.shadowBlur = 8;
    }
    ctx.stroke();
    ctx.restore();
  }
}

export class PantallaRetos2 {
  constructor(game) {
    this.g = game;
    this.sel = 0;
    this.enemigo = 0;
    this.ayuda = '↑↓ elegir · ENTER jugar · ESC volver';
    this.mensaje = null;       // { texto, t } al volver de un reto
  }

  get retos() { return TEXTOS.retos ?? []; }

  /** Lo que sale en la lista: los retos y, al final, la noche personalizada. */
  _filas() { return [...this.retos, { id: 'personal', personal: true, nombre: 'Noche personalizada' }]; }

  cuenta() {
    return `${this.retos.filter((r) => ExtrasProgreso.retoHecho(r.id)).length}/${this.retos.length} retos`;
  }

  abre() {}

  resultado(gano, nombre) {
    this.mensaje = { texto: gano ? `${nombre}: SUPERADO` : `${nombre}: FALLIDO`, gano, t: 5 };
  }

  update(dt) {
    if (this.mensaje && (this.mensaje.t -= dt) <= 0) this.mensaje = null;
  }

  _jugar() {
    const f = this._filas()[this.sel];
    if (!f) return;
    const def = f.personal
      ? { id: 'personal', nombre: f.nombre, niveles: { ...ExtrasProgreso.nivelesPersonal() } }
      : f;
    this.g.empiezaReto(def);
  }

  _cambia(d) {
    const k = ENEMIGOS_RETO[this.enemigo][0];
    const n = ExtrasProgreso.nivelesPersonal();
    ExtrasProgreso.ponNivelPersonal(k, Math.max(0, Math.min(20, n[k] + d)));
    this.g.audio?.keyClick?.();
  }

  key(code) {
    const fs = this._filas();
    const personal = fs[this.sel]?.personal;
    if (personal && (code === 'ArrowLeft' || code === 'KeyA')) return this._cambia(-1);
    if (personal && (code === 'ArrowRight' || code === 'KeyD')) return this._cambia(1);
    if (personal && code === 'Tab') {
      this.enemigo = (this.enemigo + 1) % ENEMIGOS_RETO.length;
      return;
    }
    if (code === 'ArrowUp' || code === 'KeyW') this.sel = (this.sel + fs.length - 1) % fs.length;
    else if (code === 'ArrowDown' || code === 'KeyS') this.sel = (this.sel + 1) % fs.length;
    else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') return this._jugar();
    else return;
    this.g.audio?.keyClick?.();
  }

  click(x, y) {
    const fs = this._filas();
    for (let i = 0; i < fs.length; i++) {
      if (inside(FILA(i), x, y)) {
        this.sel = i;
        this.g.audio?.keyClick?.();
        return;
      }
    }
    if (inside(EMPEZAR, x, y)) return this._jugar();
    if (fs[this.sel]?.personal) {
      for (let i = 0; i < ENEMIGOS_RETO.length; i++) {
        const r = BARRA(i);
        if (inside({ ...r, y: r.y - 8, h: r.h + 16 }, x, y)) {
          this.enemigo = i;
          ExtrasProgreso.ponNivelPersonal(ENEMIGOS_RETO[i][0], Math.round(((x - r.x) / r.w) * 20));
          this.g.audio?.keyClick?.();
        }
      }
    }
  }

  move(x, y) {
    this.hover = -1;
    this._filas().forEach((_, i) => { if (inside(FILA(i), x, y)) this.hover = i; });
    this.hoverEmp = inside(EMPEZAR, x, y);
  }

  sobre(x, y) {
    return inside(EMPEZAR, x, y) || this._filas().some((_, i) => inside(FILA(i), x, y));
  }

  draw(ctx) {
    ctx.textBaseline = 'middle';
    const fs = this._filas();
    fs.forEach((f, i) => this._fila(ctx, f, i));
    const f = fs[this.sel];
    if (f) this._panel(ctx, f);
    if (this.mensaje) {
      ctx.font = `bold 22px ${FUENTE}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = this.mensaje.gano ? VERDE : 'rgba(255,170,150,0.95)';
      ctx.fillText(this.mensaje.texto, 800, 800);
    }
  }

  _total(n) { return ENEMIGOS_RETO.reduce((a, [k]) => a + n[k], 0); }

  _fila(ctx, f, i) {
    const r = FILA(i);
    const sel = this.sel === i;
    ctx.fillStyle = sel ? 'rgba(125,255,176,0.12)' : 'rgba(10,16,14,0.5)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = sel ? VERDE : this.hover === i ? VERDE_OSC : 'rgba(125,255,176,0.22)';
    ctx.lineWidth = sel ? 2 : 1;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.textAlign = 'left';
    ctx.font = `bold 18px ${FUENTE}`;
    ctx.fillStyle = sel ? TINTA : '#9fd8b4';
    ctx.fillText(f.personal ? f.nombre : `${String(i + 1).padStart(2, ' ')}. ${f.nombre}`, r.x + 12, r.y + r.h / 2 + 1);
    if (f.personal) return;
    ctx.textAlign = 'right';
    ctx.font = `15px ${FUENTE}`;
    ctx.fillStyle = VERDE_OSC;
    ctx.fillText(`${this._total(f.niveles)}/120`, r.x + r.w - 44, r.y + r.h / 2 + 1);
    const hecho = ExtrasProgreso.retoHecho(f.id);
    if (hecho) estrella(ctx, r.x + r.w - 22, r.y + r.h / 2, 12, f.color, f.color === '#000000' ? '#cfd8d3' : null);
    else estrella(ctx, r.x + r.w - 22, r.y + r.h / 2, 12, 'rgba(0,0,0,0)', 'rgba(150,160,170,0.5)');
  }

  _panel(ctx, f) {
    const niveles = f.personal ? ExtrasProgreso.nivelesPersonal() : f.niveles;
    ctx.textAlign = 'left';
    ctx.font = `bold 30px ${FUENTE}`;
    ctx.fillStyle = TINTA;
    ctx.fillText(f.nombre, X, 176);
    ctx.font = `16px ${FUENTE}`;
    ctx.fillStyle = VERDE_OSC;
    ctx.fillText(`DIFICULTAD ${this._total(niveles)}/120`, X, 210);
    ENEMIGOS_RETO.forEach(([k, nombre], i) => {
      const r = BARRA(i);
      const elegido = f.personal && this.enemigo === i;
      ctx.font = `${elegido ? 'bold ' : ''}16px ${FUENTE}`;
      ctx.textAlign = 'left';
      ctx.fillStyle = niveles[k] > 0 ? colorDe(k) : GRIS;
      ctx.fillText(nombre, X, r.y + r.h / 2 + 1);
      ctx.strokeStyle = elegido ? VERDE : VERDE_OSC;
      ctx.lineWidth = elegido ? 2 : 1;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = colorDe(k);
      ctx.globalAlpha = 0.65;
      ctx.fillRect(r.x + 2, r.y + 2, (r.w - 4) * (niveles[k] / 20), r.h - 4);
      ctx.globalAlpha = 1;
      ctx.font = `bold 16px ${FUENTE}`;
      ctx.textAlign = 'right';
      ctx.fillStyle = niveles[k] > 0 ? TINTA : GRIS;
      ctx.fillText(String(niveles[k]), r.x + r.w + 40, r.y + r.h / 2 + 1);
    });
    let y = 520;
    ctx.textAlign = 'left';
    ctx.font = `bold 16px ${FUENTE}`;
    ctx.fillStyle = VERDE_OSC;
    ctx.fillText('> EXTRA DE DIFICULTAD', X, y);
    y += 30;
    ctx.font = `18px ${FUENTE}`;
    ctx.fillStyle = 'rgba(216,255,232,0.92)';
    const texto = f.personal ? 'Sin extra: la noche libre. ←→ cambia el nivel, TAB pasa al siguiente enemigo.' : f.extra;
    for (const l of lineas(ctx, texto, 700)) {
      ctx.fillText(l, X, y);
      y += 25;
    }
    if (!f.personal) {
      ctx.font = `16px ${FUENTE}`;
      ctx.fillStyle = VERDE_OSC;
      ctx.fillText(`Estrella: ${f.colorNombre}`, X, 650);
      estrella(ctx, X + 260, 650, 12, f.color, f.color === '#000000' ? '#cfd8d3' : null);
    }
    boton(ctx, EMPEZAR, 'EMPEZAR (Enter)', { activo: true, encima: this.hoverEmp, tam: 20 });
  }
}
