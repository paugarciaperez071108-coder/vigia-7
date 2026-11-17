// =============================================================
// extras/Archivo.js — (v2.19, el lore) Extras > Archivo: las notas encontradas a pie (fase A) y las fotos del
// laboratorio de la Noche 6 (fase B), en su orden; las que faltan, «???». Clic (o Enter) para leer una (Lectura.js).
// Lo encontrado se guarda en ExtrasProgreso (lore), aparte de la partida.
// =============================================================

import { CONFIG } from '../../config.js';
import { dice } from '../../core/Idioma.js';
import { ExtrasProgreso } from '../../core/ExtrasProgreso.js';
import { NOTAS, FOTOS } from '../../lore/catalogo.js';
import { VERDE, VERDE_OSC, TINTA, GRIS, FUENTE, inside } from './comun.js';

const W = CONFIG.WIDTH;
const COL = [{ x: 120, y: 200, w: 640 }, { x: 840, y: 200, w: 640 }];
const FILA = 52;

export class PantallaArchivo {
  constructor(game) {
    this.g = game;
    this.sel = 0;
    this.hover = -1;
    this.t = 0;
  }

  /** Todo lo que hay, en orden: las notas y, después, las fotos. */
  get lista() {
    return [...NOTAS.map((n, i) => ({ tipo: 'notas', id: n.id, i, n })), ...(FOTOS ?? []).map((f, i) => ({ tipo: 'fotos', id: f.id, i, n: f }))];
  }

  tiene(e) { return ExtrasProgreso.loreTiene(e.tipo, e.id); }

  cuenta() {
    const l = this.lista;
    return dice('extras.archivo_cuenta', { a: l.filter((e) => this.tiene(e)).length, b: l.length });
  }

  abre() { this.t = 0; this.sel = 0; }

  _caja(k) {
    const l = this.lista, e = l[k];
    const notas = l.filter((x) => x.tipo === 'notas').length;
    const c = e.tipo === 'notas' ? COL[0] : COL[1];
    const i = e.tipo === 'notas' ? k : k - notas;
    return { x: c.x, y: c.y + 46 + i * FILA, w: c.w, h: FILA - 8 };
  }

  _lee(k) {
    const e = this.lista[k];
    if (!e || !this.tiene(e)) {
      this.g.audio?.beep?.(220, 0.05, 0.04);
      return;
    }
    this.g.lectura?.abre(e.id, e.tipo === 'fotos' ? { foto: e.n } : undefined);
  }

  key(code) {
    const n = this.lista.length;
    if (code === 'ArrowUp' || code === 'KeyW') this.sel = (this.sel + n - 1) % n;
    else if (code === 'ArrowDown' || code === 'KeyS') this.sel = (this.sel + 1) % n;
    else if (code === 'ArrowLeft' || code === 'ArrowRight') {
      const notas = this.lista.filter((x) => x.tipo === 'notas').length;
      this.sel = this.sel < notas ? Math.min(n - 1, notas + this.sel) : Math.max(0, this.sel - notas);
    } else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') this._lee(this.sel);
    else return;
    this.g.audio?.keyClick?.();
  }

  click(x, y) {
    for (let k = 0; k < this.lista.length; k++) if (inside(this._caja(k), x, y)) { this.sel = k; this._lee(k); return; }
  }

  move(x, y) {
    this.hover = -1;
    for (let k = 0; k < this.lista.length; k++) if (inside(this._caja(k), x, y)) { this.hover = k; this.sel = k; }
  }

  sobre(x, y) { return this.lista.some((_, k) => inside(this._caja(k), x, y)); }

  update(dt) { this.t += dt; }

  draw(ctx) {
    const l = this.lista;
    ctx.save();
    ctx.textBaseline = 'middle';
    // (el título lo pone el marco de Extras; aquí, solo cuántos hay, a la altura de las columnas)
    ctx.font = `18px ${FUENTE}`;
    ctx.fillStyle = GRIS;
    ctx.textAlign = 'right';
    ctx.fillText(this.cuenta(), W - 120, COL[0].y + 10);
    ctx.textAlign = 'left';
    ctx.font = `bold 20px ${FUENTE}`;
    ctx.fillStyle = VERDE_OSC;
    ctx.fillText(dice('extras.archivo_notas'), COL[0].x, COL[0].y + 10);
    if (l.some((e) => e.tipo === 'fotos')) ctx.fillText(dice('extras.archivo_fotos'), COL[1].x, COL[1].y + 10);
    for (let k = 0; k < l.length; k++) {
      const e = l[k], r = this._caja(k), tiene = this.tiene(e), sel = k === this.sel;
      ctx.fillStyle = sel ? 'rgba(125,255,176,0.14)' : 'rgba(125,255,176,0.04)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      if (sel) {
        ctx.strokeStyle = VERDE;
        ctx.lineWidth = 2;
        ctx.strokeRect(r.x, r.y, r.w, r.h);
      }
      ctx.font = `bold 20px ${FUENTE}`;
      ctx.fillStyle = tiene ? TINTA : GRIS;
      const num = e.tipo === 'notas' ? dice('extras.archivo_nota', { n: e.i + 1 }) : dice('extras.archivo_foto', { n: e.i + 1 });
      ctx.fillText(num, r.x + 16, r.y + r.h / 2);
      ctx.font = `20px ${FUENTE}`;
      const tit = tiene ? dice(`lore.${e.id}_titulo`) : dice('extras.archivo_falta');
      ctx.fillText(tit, r.x + 150, r.y + r.h / 2);
    }
    ctx.restore();
  }
}
