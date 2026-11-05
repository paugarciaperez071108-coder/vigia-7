// =============================================================
// Beta.js — (v1.56) El archivo de lo descartado: categorías con su galería; cada imagen lleva un pie
// «Nombre – vX.XX – qué cambió» y, si tiene versión nueva, el botón COMPARAR (antes y ahora).
// Lo de la Aberración y las Noches 6 y 7: «???» hasta completar la Noche 7. Imágenes: tools/extras_beta.py.
// =============================================================

import { CONFIG } from '../../config.js';
import { ExtrasProgreso } from '../../core/ExtrasProgreso.js';
import { TEXTOS, VERDE, VERDE_OSC, TINTA, GRIS, FUENTE, inside, lineas, boton, imagen, lista, encaja } from './comun.js';

const W = CONFIG.WIDTH;
const CARP = 'assets/extras/beta/';
const COLS = 5;
const FILAS = 3;
const POR_PAGINA = COLS * FILAS;
const TAB = (i) => ({ x: 104 + i * 200, y: 186, w: 190, h: 36 });
const THUMB = (i) => ({ x: 104 + (i % COLS) * 280, y: 236 + Math.floor(i / COLS) * 156, w: 268, h: 146 });
const ANT = { x: 1110, y: 186, w: 60, h: 36 };
const SIG = { x: 1300, y: 186, w: 60, h: 36 };
const COMPARAR = { x: W / 2 - 110, y: 730, w: 220, h: 44 };
const GRANDE = { x: 110, y: 150, w: 1380, h: 510 };

export class PantallaBeta {
  constructor(game) {
    this.g = game;
    this.cat = 0;
    this.sel = 0;
    this.detalle = false;
    this.comparar = false;
    this.ayuda = '←→↑↓ elegir · TAB categoría · ENTER ver · ESC volver';
  }

  get cats() { return TEXTOS.beta.categorias; }
  get items() { return this.cats[this.cat]?.items ?? []; }

  visible(it) { return !it.bloqueo || (it.bloqueo === 'aberracion' && ExtrasProgreso.aberracion()); }

  cuenta() {
    const todos = this.cats.flatMap((c) => c.items);
    return `${todos.filter((i) => this.visible(i)).length}/${todos.length} diseños`;
  }

  abre() {
    this.detalle = false;
    this.comparar = false;
  }

  quiereEsc() { return this.detalle; }

  /** Abajo, en la lista: solo el nombre (lo que va antes del primer « – »). */
  _nombre(it) { return it.pie.split(' – ')[0]; }

  _elige(i) {
    const n = this.items.length;
    if (!n) return;
    this.sel = (i + n) % n;
    this.comparar = false;
    this.g.audio?.keyClick?.();
  }

  _cat(i) {
    const n = this.cats.length;
    this.cat = (i + n) % n;
    this.sel = 0;
    this.comparar = false;
    this.g.audio?.keyClick?.();
  }

  _abreSel() {
    const it = this.items[this.sel];
    if (!it) return;
    if (!this.visible(it)) {
      this.g.menuMusic?.estatica?.(0.4, 0.3);
      return;
    }
    this.detalle = true;
    this.comparar = false;
  }

  key(code) {
    if (this.detalle) {
      if (code === 'Escape') {
        if (this.comparar) this.comparar = false;
        else this.detalle = false;
      } else if (code === 'ArrowLeft' || code === 'KeyA') this._pasa(-1);
      else if (code === 'ArrowRight' || code === 'KeyD') this._pasa(1);
      else if (code === 'KeyC' || code === 'Enter') {
        if (this.items[this.sel]?.despues) this.comparar = !this.comparar;
      }
      return;
    }
    if (code === 'ArrowLeft' || code === 'KeyA') this._elige(this.sel - 1);
    else if (code === 'ArrowRight' || code === 'KeyD') this._elige(this.sel + 1);
    else if (code === 'ArrowUp' || code === 'KeyW') this._elige(this.sel - COLS);
    else if (code === 'ArrowDown' || code === 'KeyS') this._elige(this.sel + COLS);
    else if (code === 'Tab' || code === 'KeyE' || code === 'PageDown') this._cat(this.cat + 1);
    else if (code === 'KeyQ' || code === 'PageUp') this._cat(this.cat - 1);
    else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') this._abreSel();
  }

  /** En la vista grande: al siguiente que se pueda ver. */
  _pasa(d) {
    const n = this.items.length;
    let i = this.sel;
    for (let k = 0; k < n; k++) {
      i = (i + d + n) % n;
      if (this.visible(this.items[i])) break;
    }
    this._elige(i);
  }

  get _pagina() { return Math.floor(this.sel / POR_PAGINA); }

  click(x, y) {
    if (this.detalle) {
      if (this.items[this.sel]?.despues && inside(COMPARAR, x, y)) this.comparar = !this.comparar;
      else if (y < 700 && x < W / 4) this._pasa(-1);
      else if (y < 700 && x > (W * 3) / 4) this._pasa(1);
      else if (inside({ x: 100, y: 788, w: 220, h: 36 }, x, y)) this.detalle = false;
      return;
    }
    for (let i = 0; i < this.cats.length; i++) if (inside(TAB(i), x, y)) return this._cat(i);
    const pags = Math.ceil(this.items.length / POR_PAGINA);
    if (inside(ANT, x, y) && this._pagina > 0) return this._elige((this._pagina - 1) * POR_PAGINA);
    if (inside(SIG, x, y) && this._pagina < pags - 1) return this._elige((this._pagina + 1) * POR_PAGINA);
    const ini = this._pagina * POR_PAGINA;
    for (let i = 0; i < POR_PAGINA && ini + i < this.items.length; i++) {
      if (inside(THUMB(i), x, y)) {
        this.sel = ini + i;
        return this._abreSel();
      }
    }
  }

  move(x, y) {
    this.hover = -1;
    if (this.detalle) return;
    const ini = this._pagina * POR_PAGINA;
    for (let i = 0; i < POR_PAGINA && ini + i < this.items.length; i++) if (inside(THUMB(i), x, y)) this.hover = i;
  }

  sobre(x, y) {
    if (this.detalle) return !!this.items[this.sel]?.despues && inside(COMPARAR, x, y);
    return this.hover >= 0 || this.cats.some((_, i) => inside(TAB(i), x, y)) || inside(ANT, x, y) || inside(SIG, x, y);
  }

  draw(ctx) {
    ctx.textBaseline = 'middle';
    if (this.detalle) return this._grande(ctx);
    ctx.textAlign = 'left';
    ctx.font = `17px ${FUENTE}`;
    ctx.fillStyle = 'rgba(159,216,180,0.9)';
    ctx.fillText(TEXTOS.beta.intro ?? '', 104, 160);
    this.cats.forEach((c, i) => boton(ctx, TAB(i), c.nombre, { activo: this.cat === i, tam: 16 }));
    const pags = Math.ceil(this.items.length / POR_PAGINA);
    if (pags > 1) {
      boton(ctx, ANT, '<', { tam: 20 });
      boton(ctx, SIG, '>', { tam: 20 });
      ctx.font = `16px ${FUENTE}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = VERDE_OSC;
      ctx.fillText(`${this._pagina + 1}/${pags}`, (ANT.x + ANT.w + SIG.x) / 2, ANT.y + ANT.h / 2 + 1);
    }
    const ini = this._pagina * POR_PAGINA;
    for (let i = 0; i < POR_PAGINA && ini + i < this.items.length; i++) this._thumb(ctx, this.items[ini + i], i, ini + i);
    // el pie completo de la elegida
    const it = this.items[this.sel];
    if (it) {
      ctx.textAlign = 'left';
      ctx.font = `17px ${FUENTE}`;
      ctx.fillStyle = this.visible(it) ? TINTA : GRIS;
      ctx.fillText(`> ${this.visible(it) ? it.pie : '???'}`, 104, 742);
    }
  }

  _thumb(ctx, it, i, idx) {
    const r = THUMB(i);
    const sel = this.sel === idx;
    const ve = this.visible(it);
    ctx.fillStyle = '#000';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    const f = { x: r.x + 3, y: r.y + 3, w: r.w - 6, h: r.h - 28 };
    if (ve) {
      const im = imagen(`${CARP}${it.img}.webp`);
      if (lista(im)) encaja(ctx, im, f);
    } else {
      ctx.font = `bold 40px ${FUENTE}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = GRIS;
      ctx.fillText('???', f.x + f.w / 2, f.y + f.h / 2);
    }
    ctx.strokeStyle = sel ? VERDE : this.hover === i ? VERDE_OSC : 'rgba(125,255,176,0.22)';
    ctx.lineWidth = sel ? 2 : 1;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.font = `14px ${FUENTE}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = ve ? 'rgba(216,255,232,0.85)' : GRIS;
    const nom = ve ? this._nombre(it) : '???';
    ctx.fillText(nom.length > 32 ? `${nom.slice(0, 31)}…` : nom, r.x + 6, r.y + r.h - 12);
    if (ve && it.despues) {
      ctx.textAlign = 'right';
      ctx.fillStyle = VERDE;
      ctx.fillText('⇄', r.x + r.w - 6, r.y + r.h - 12);
    }
  }

  _grande(ctx) {
    const it = this.items[this.sel];
    if (!it) return;
    ctx.fillStyle = '#000';
    ctx.fillRect(GRANDE.x, GRANDE.y, GRANDE.w, GRANDE.h);
    const a = imagen(`${CARP}${it.img}.webp`);
    if (this.comparar && it.despues) {
      const b = imagen(`${CARP}${it.despues}.webp`);
      const rw = (GRANDE.w - 20) / 2;
      const ra = { x: GRANDE.x, y: GRANDE.y + 30, w: rw, h: GRANDE.h - 30 };
      const rb = { x: GRANDE.x + rw + 20, y: GRANDE.y + 30, w: rw, h: GRANDE.h - 30 };
      if (lista(a)) encaja(ctx, a, ra);
      if (lista(b)) encaja(ctx, b, rb);
      ctx.font = `bold 20px ${FUENTE}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,190,170,0.95)';
      ctx.fillText('ANTES', ra.x + rw / 2, GRANDE.y + 16);
      ctx.fillStyle = VERDE;
      ctx.fillText('AHORA', rb.x + rw / 2, GRANDE.y + 16);
    } else if (lista(a)) encaja(ctx, a, GRANDE);
    ctx.strokeStyle = 'rgba(125,255,176,0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(GRANDE.x, GRANDE.y, GRANDE.w, GRANDE.h);
    ctx.font = `bold 21px ${FUENTE}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = TINTA;
    let y = 690;
    for (const l of lineas(ctx, it.pie, 1300)) {
      ctx.fillText(l, W / 2, y);
      y += 26;
    }
    if (it.despues) boton(ctx, COMPARAR, this.comparar ? 'VER SOLO LA ANTIGUA' : 'COMPARAR (C)', { activo: this.comparar, tam: 16 });
  }
}
