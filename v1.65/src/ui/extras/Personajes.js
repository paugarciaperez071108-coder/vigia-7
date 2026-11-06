// =============================================================
// Personajes.js — (v1.56) Las fichas de Extras: lista a la izquierda, el modelo para girar en el centro y la entrada
// de archivo a la derecha. El modelo: una hoja de 6×6 vistas (tools/3d/extras/giro.py → assets/extras/giro/<id>.webp).
// Sin destripes: las noches salen hasta la 5 y se añaden solas al completar la 6 y la 7; nunca dice quién muere.
// Bloqueados (La Aberración hasta completar la Noche 7; Slaimi si no aparece en esta partida): silueta y «???».
// =============================================================

import { CONFIG } from '../../config.js';
import { ExtrasProgreso } from '../../core/ExtrasProgreso.js';
import { colorDe } from '../../core/Colores.js';
import { TEXTOS, VERDE, VERDE_OSC, TINTA, GRIS, FUENTE, inside, lineas, listaNoches, nochesDe, estadoSlaimi, imagen, lista, silueta, triangulo } from './comun.js';

const CELDAS = 6;
const VISOR = { x: 410, y: 160, w: 470, h: 470 };
const FILA = (i) => ({ x: 100, y: 160 + i * 74, w: 290, h: 64 });
const X_FICHA = 910;
const W_FICHA = 590;

export class PantallaPersonajes {
  constructor(game) {
    this.g = game;
    this.sel = 0;
    this.ang = 0;
    this.quieto = 0;
    this.t = 0;
    this.arrastra = null;
    this.ayuda = '↑↓ elegir · ←→ o ratón girar · ESC volver';
  }

  get lista() { return TEXTOS.personajes; }

  /** ¿Se puede ver esta ficha? */
  visible(p) {
    if (p.bloqueo === 'aberracion') return ExtrasProgreso.aberracion();
    if (p.id === 'slaimi') return estadoSlaimi(this.g) !== 'sinver';
    return true;
  }

  cuenta() {
    return `${this.lista.filter((p) => this.visible(p)).length}/${this.lista.length} fichas`;
  }

  abre() { this._elige(this.sel, true); }

  _elige(i, sinRuido = false) {
    if (!this.lista.length) return;
    this.sel = (i + this.lista.length) % this.lista.length;
    this.t = 0;
    const p = this.lista[this.sel];
    if (this.visible(p)) imagen(`assets/extras/giro/${p.id}.webp`);
    if (!sinRuido) this.g.audio?.keyClick?.();
  }

  key(code) {
    if (code === 'ArrowUp' || code === 'KeyW') this._elige(this.sel - 1);
    else if (code === 'ArrowDown' || code === 'KeyS') this._elige(this.sel + 1);
    else if (code === 'ArrowLeft' || code === 'KeyA') { this.ang -= 1; this.quieto = 3; }
    else if (code === 'ArrowRight' || code === 'KeyD') { this.ang += 1; this.quieto = 3; }
  }

  click(x, y) {
    for (let i = 0; i < this.lista.length; i++) if (inside(FILA(i), x, y)) return this._elige(i);
    if (inside(VISOR, x, y)) this.arrastra = { x, ang: this.ang };
  }

  move(x, y, abajo) {
    this.hover = -1;
    for (let i = 0; i < this.lista.length; i++) if (inside(FILA(i), x, y)) this.hover = i;
    if (this.arrastra) {
      if (abajo === false) { this.arrastra = null; return; }
      this.ang = this.arrastra.ang + (x - this.arrastra.x) / 14;
      this.quieto = 2;
    }
  }

  soltar() { this.arrastra = null; }

  sobre(x, y) {
    return inside(VISOR, x, y) || this.lista.some((_, i) => inside(FILA(i), x, y));
  }

  update(dt) {
    this.t += dt;
    if (this.quieto > 0) this.quieto -= dt;
    else if (!this.arrastra) this.ang += dt * 2.2;     // (da la vuelta sola, unos 16 s)
  }

  draw(ctx) {
    ctx.textBaseline = 'middle';
    this.lista.forEach((p, i) => this._fila(ctx, p, i));
    const p = this.lista[this.sel];
    if (!p) return;
    this._visor(ctx, p);
    this._ficha(ctx, p);
  }

  _triangulo(ctx, p, x, y, t) {
    if (p.id === 'aberracion') {
      const k = 0.55 + 0.45 * Math.abs(Math.sin(this.t * 2.4));
      triangulo(ctx, x, y, t, '#000', `rgba(138,13,13,${k})`, 3);
    } else triangulo(ctx, x, y, t, colorDe(p.id));
  }

  _fila(ctx, p, i) {
    const r = FILA(i);
    const sel = this.sel === i;
    const ve = this.visible(p);
    ctx.fillStyle = sel ? 'rgba(125,255,176,0.12)' : 'rgba(10,16,14,0.5)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = sel ? VERDE : this.hover === i ? VERDE_OSC : 'rgba(125,255,176,0.22)';
    ctx.lineWidth = sel ? 2 : 1;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    if (ve) this._triangulo(ctx, p, r.x + 30, r.y + r.h / 2, 13);
    ctx.font = `bold 21px ${FUENTE}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = !ve ? GRIS : sel ? TINTA : '#9fd8b4';
    ctx.fillText(ve ? p.nombre : '???', r.x + 56, r.y + r.h / 2 + 1);
  }

  _visor(ctx, p) {
    const r = VISOR;
    ctx.fillStyle = 'rgba(4,9,7,0.85)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = 'rgba(125,255,176,0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    if (!this.visible(p)) {
      silueta(ctx, p.id, r, 54);
      return;
    }
    const im = imagen(`assets/extras/giro/${p.id}.webp`);
    if (lista(im)) {
      const n = CELDAS * CELDAS;
      const f = ((Math.round(this.ang) % n) + n) % n;
      const c = im.naturalWidth / CELDAS;
      ctx.drawImage(im, (f % CELDAS) * c, Math.floor(f / CELDAS) * c, c, c, r.x + 5, r.y + 5, r.w - 10, r.h - 10);
    } else {
      ctx.font = `18px ${FUENTE}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = VERDE_OSC;
      ctx.fillText('RECONSTRUYENDO MODELO…', r.x + r.w / 2, r.y + r.h / 2);
    }
    ctx.font = `15px ${FUENTE}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = VERDE_OSC;
    ctx.fillText('<  arrastra para girar  >', r.x + r.w / 2, r.y + r.h + 22);
  }

  _ficha(ctx, p) {
    const ve = this.visible(p);
    const x = X_FICHA;
    let y = 178;
    ctx.textAlign = 'left';
    ctx.font = `bold 38px ${FUENTE}`;
    ctx.fillStyle = TINTA;
    ctx.fillText(ve ? p.nombre : '???', x, y);
    y += 34;
    if (ve && p.alias) {
      ctx.font = `italic 19px ${FUENTE}`;
      ctx.fillStyle = 'rgba(159,216,180,0.9)';
      ctx.fillText(p.alias, x, y);
    }
    y += 40;
    const dato = (et, val) => {
      ctx.font = `17px ${FUENTE}`;
      ctx.fillStyle = VERDE_OSC;
      ctx.fillText(et, x, y);
      ctx.font = `bold 19px ${FUENTE}`;
      ctx.fillStyle = TINTA;
      ctx.fillText(val, x + 130, y);
      y += 34;
    };
    const slaimi = p.id === 'slaimi' ? estadoSlaimi(this.g) : null;
    dato('ALTURA', ve ? p.altura : '???');
    dato('TRIÁNGULO', ve ? p.triangulo : '???');
    if (ve) this._triangulo(ctx, p, x + 118, y - 34, 0);
    dato('NOCHES', ve ? listaNoches(nochesDe(p, slaimi !== 'muerto')) : '???');
    y += 14;
    ctx.fillStyle = 'rgba(125,255,176,0.3)';
    ctx.fillRect(x, y, W_FICHA, 2);
    y += 28;
    ctx.font = `bold 16px ${FUENTE}`;
    ctx.fillStyle = VERDE_OSC;
    ctx.fillText('> ENTRADA DE ARCHIVO', x, y);
    y += 34;
    let texto = '???';
    if (ve) texto = slaimi === 'muerto' ? p.archivoMuerto : p.archivo;
    else if (p.id === 'slaimi') texto = p.archivoSinVer ?? '???';
    // (se escribe sola, como en la terminal)
    const n = Math.floor(this.t * 90);
    let quedan = n;
    ctx.font = `20px ${FUENTE}`;
    ctx.fillStyle = 'rgba(216,255,232,0.92)';
    for (const l of lineas(ctx, texto, W_FICHA)) {
      if (quedan <= 0) break;
      ctx.fillText(l.slice(0, quedan), x, y);
      quedan -= l.length + 1;
      y += 28;
    }
  }
}

export const anchoLienzo = CONFIG.WIDTH;
