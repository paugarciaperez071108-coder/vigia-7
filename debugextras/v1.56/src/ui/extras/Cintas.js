// =============================================================
// Cintas.js — (v1.56) Las grabaciones de Extras, por noche: título, quién habla, duración y una etiqueta de grabadora
// con la noche escrita a mano. Solo suenan las que ya se han oído en la partida; las demás: «CINTA DAÑADA – ???» con
// estática al pulsarlas. Los fragmentos de la mujer en los conductos van en una sola entrada, con 7 pistas.
// Subtítulos: solo lo hablado, los mismos del juego (<cinta>.json o conductos_n6/fragmentos.json).
// =============================================================

import { CONFIG } from '../../config.js';
import { ExtrasProgreso } from '../../core/ExtrasProgreso.js';
import { CINTAS } from './catalogo.js';
import { TEXTOS, VERDE, VERDE_OSC, TINTA, GRIS, FUENTE, MANO, inside, lineas, boton } from './comun.js';

const W = CONFIG.WIDTH;
const FRAGS = CINTAS.filter((c) => c.frag);
const X_PANEL = 790;
const FILA = (i) => ({ x: 100, y: 156 + i * 55, w: 660, h: 47 });
const PISTA = (i) => ({ x: X_PANEL + 2, y: 378 + i * 37, w: 330, h: 31 });
const PLAY = { x: X_PANEL + 350, y: 380, w: 180, h: 44 };
const VOZ = { hombre: 'El hombre', mujer: 'La mujer' };

const fmt = (s) => (s == null ? '--:--' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`);

export class PantallaCintas {
  constructor(game, cintasQueHay) {
    this.g = game;
    this.cintasQueHay = cintasQueHay;
    this.sel = 0;
    this.pista = 0;
    this.t = 0;
    this.datos = {};           // id → { dur, subs, audio }
    this.a = null;
    this.suena = null;         // id de la cinta que suena
    this.ayuda = '↑↓ elegir · ENTER escuchar · ESC volver';
    this._cargaFrags();
  }

  /** Lo que sale en la lista: las cintas por orden de noche, con los conductos como una entrada. */
  filas() {
    const hay = this.cintasQueHay();
    const sal = [];
    for (const t of TEXTOS.cintas.lista) {
      const c = hay.find((x) => x.id === t.id);
      if (!c) continue;
      if (c.noche === 7 || (sal.length && c.noche > 6 && !sal.some((f) => f.grupo))) sal.push(this._grupo());
      sal.push({ ...c, ...t });
    }
    if (!sal.some((f) => f.grupo)) sal.push(this._grupo());
    return sal;
  }

  _grupo() {
    const g = TEXTOS.cintas.grupoConductos ?? {};
    return { id: 'n6', grupo: true, noche: 6, voz: 'mujer', titulo: g.titulo, etiqueta: g.etiqueta };
  }

  _oida(f) {
    if (f.grupo) return FRAGS.some((c) => ExtrasProgreso.cintaOida(c.id));
    return ExtrasProgreso.cintaOida(f.id);
  }

  async _cargaFrags() {
    try {
      const d = await (await fetch('assets/audio/cintas/conductos_n6/fragmentos.json')).json();
      for (const f of d) this.datos[`n6_${f.n}`] = { dur: f.dur, subs: f.subtitulos, audio: f.audio };
    } catch { /* (sin datos: sin duración) */ }
  }

  abre() {
    for (const c of CINTAS) {
      if (c.frag || this.datos[c.id]) continue;
      this.datos[c.id] = { audio: c.audio ?? `${c.base}.ogg`, subs: [] };
      fetch((c.audio ?? c.base).includes('_mia') ? `${c.base}_mia.json` : `${c.base}.json`).then((r) => (r.ok ? r.json() : null)).then((j) => {
        if (j) Object.assign(this.datos[c.id], { dur: j.duration, subs: j.subtitles ?? [] });
      }).catch(() => {});
    }
  }

  cierra() { this._para(); }

  _para() {
    if (this.a) {
      this.a.pause();
      this.a = null;
    }
    if (this.suena) this.g.menuMusic?.baja?.(false);
    this.suena = null;
  }

  _pon(id) {
    this._para();
    const d = this.datos[id];
    if (!d?.audio) return;
    this.a = new Audio(d.audio);
    this.a.volume = 1;
    this.a.onended = () => this._acabo(id);
    this.a.play().catch(() => {});
    this.suena = id;
    this.g.menuMusic?.baja?.(true);
  }

  _acabo(id) {
    this._para();
    // (en los conductos, sigue con la siguiente pista encontrada)
    const i = FRAGS.findIndex((c) => c.id === id);
    if (i >= 0) {
      const sig = FRAGS.slice(i + 1).find((c) => ExtrasProgreso.cintaOida(c.id));
      if (sig) {
        this.pista = FRAGS.indexOf(sig);
        this._pon(sig.id);
      }
    }
  }

  _estatica() {
    this.g.menuMusic?.estatica?.(0.5, 0.6);
    this.t = 0;
    this.golpe = 0.6;
  }

  /** Enter o clic en «escuchar»: la cinta elegida. */
  _accion() {
    const f = this.filas()[this.sel];
    if (!f) return;
    const id = f.grupo ? FRAGS[this.pista].id : f.id;
    if (!this._oida(f) || !ExtrasProgreso.cintaOida(id)) return this._estatica();
    if (this.suena === id) return this._para();
    this._pon(id);
  }

  _elige(i) {
    const n = this.filas().length;
    this.sel = (i + n) % n;
    this._para();
    this.g.audio?.keyClick?.();
  }

  key(code) {
    const f = this.filas()[this.sel];
    if (code === 'ArrowUp' || code === 'KeyW') this._elige(this.sel - 1);
    else if (code === 'ArrowDown' || code === 'KeyS') this._elige(this.sel + 1);
    else if (f?.grupo && (code === 'ArrowLeft' || code === 'KeyA')) this.pista = (this.pista + 6) % 7;
    else if (f?.grupo && (code === 'ArrowRight' || code === 'KeyD')) this.pista = (this.pista + 1) % 7;
    else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') this._accion();
  }

  click(x, y) {
    const fs = this.filas();
    for (let i = 0; i < fs.length; i++) {
      if (inside(FILA(i), x, y)) {
        if (this.sel !== i) this._elige(i);
        if (!fs[i].grupo) this._accion();
        else if (!this._oida(fs[i])) this._estatica();
        return;
      }
    }
    const f = fs[this.sel];
    if (f?.grupo) {
      for (let i = 0; i < 7; i++) {
        if (inside(PISTA(i), x, y)) {
          this.pista = i;
          return this._accion();
        }
      }
    }
    if (inside(PLAY, x, y)) this._accion();
  }

  move(x, y) {
    this.hover = -1;
    this.filas().forEach((_, i) => { if (inside(FILA(i), x, y)) this.hover = i; });
    this.hoverPlay = inside(PLAY, x, y);
  }

  sobre(x, y) {
    return inside(PLAY, x, y) || this.filas().some((_, i) => inside(FILA(i), x, y))
      || (this.filas()[this.sel]?.grupo && [0, 1, 2, 3, 4, 5, 6].some((i) => inside(PISTA(i), x, y)));
  }

  update(dt) {
    this.t += dt;
    if (this.golpe > 0) this.golpe -= dt;
  }

  draw(ctx) {
    ctx.textBaseline = 'middle';
    const fs = this.filas();
    fs.forEach((f, i) => this._fila(ctx, f, i));
    const f = fs[this.sel];
    if (f) this._panel(ctx, f);
  }

  _durDe(f) {
    if (f.grupo) {
      const ds = FRAGS.map((c) => this.datos[c.id]?.dur ?? 0);
      return ds.reduce((a, b) => a + b, 0);
    }
    return this.datos[f.id]?.dur;
  }

  _fila(ctx, f, i) {
    const r = FILA(i);
    const sel = this.sel === i;
    const oida = this._oida(f);
    ctx.fillStyle = sel ? 'rgba(125,255,176,0.12)' : 'rgba(10,16,14,0.5)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = sel ? VERDE : this.hover === i ? VERDE_OSC : 'rgba(125,255,176,0.22)';
    ctx.lineWidth = sel ? 2 : 1;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.textAlign = 'left';
    ctx.font = `bold 19px ${FUENTE}`;
    ctx.fillStyle = !oida ? GRIS : sel ? TINTA : '#9fd8b4';
    ctx.fillText(oida ? f.titulo : TEXTOS.cintas.bloqueada, r.x + 14, r.y + r.h / 2 + 1);
    ctx.textAlign = 'right';
    ctx.font = `16px ${FUENTE}`;
    ctx.fillStyle = oida ? VERDE_OSC : GRIS;
    if (!oida) return;
    let extra = VOZ[f.voz];
    if (f.grupo) {
      const n = FRAGS.filter((c) => ExtrasProgreso.cintaOida(c.id)).length;
      extra = n === 7 ? (TEXTOS.cintas.grupoConductos?.completa ?? 'Completa') : `${n}/7`;
    }
    ctx.fillText(`${extra} · ${fmt(this._durDe(f))}`, r.x + r.w - 12, r.y + r.h / 2 + 1);
  }

  /** El casete con su etiqueta escrita a mano. */
  _casete(ctx, f, oida) {
    const x = X_PANEL + 40;
    const y = 158;
    const cw = 450;
    const ch = 200;
    const gira = this.suena ? this.t * 2.6 : 0;
    ctx.fillStyle = 'rgba(125,255,176,0.05)';
    ctx.strokeStyle = oida ? VERDE : GRIS;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(x, y, cw, ch, 12);
    ctx.fill();
    ctx.stroke();
    // etiqueta de papel
    ctx.fillStyle = oida ? '#d9cfae' : '#4a4a46';
    ctx.fillRect(x + 28, y + 16, cw - 56, 70);
    ctx.fillStyle = 'rgba(160,40,30,0.55)';
    ctx.fillRect(x + 28, y + 26, cw - 56, 2);
    ctx.save();
    ctx.translate(x + cw / 2, y + 56);
    ctx.rotate(-0.02);
    ctx.font = `bold 32px ${MANO}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = oida ? '#1c2a55' : '#222';
    ctx.fillText(oida ? (f.etiqueta ?? '') : '???', 0, 0);
    ctx.restore();
    // bobinas
    ctx.strokeStyle = oida ? VERDE : GRIS;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 90, y + 104, cw - 180, 70);
    for (const dx of [150, cw - 150]) {
      ctx.save();
      ctx.translate(x + dx, y + 139);
      ctx.rotate(gira);
      ctx.beginPath();
      ctx.arc(0, 0, 25, 0, Math.PI * 2);
      ctx.stroke();
      for (let k = 0; k < 6; k++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(19, 0);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  _panel(ctx, f) {
    const oida = this._oida(f);
    this._casete(ctx, f, oida);
    const x = X_PANEL + 2;
    ctx.textAlign = 'left';
    if (!oida) {
      ctx.font = `bold 26px ${FUENTE}`;
      ctx.fillStyle = 'rgba(255,170,150,0.85)';
      ctx.fillText(TEXTOS.cintas.bloqueada, x, 396);
    } else if (f.grupo) {
      this._pistas(ctx);
    } else {
      ctx.font = `bold 26px ${FUENTE}`;
      ctx.fillStyle = TINTA;
      ctx.fillText(f.titulo, x, 396);
      ctx.font = `19px ${FUENTE}`;
      ctx.fillStyle = 'rgba(159,216,180,0.9)';
      ctx.fillText(`Habla: ${VOZ[f.voz]}`, x, 432);
      ctx.fillText(`Duración: ${fmt(this.datos[f.id]?.dur)}`, x, 462);
      boton(ctx, { ...PLAY, y: 448 }, this.suena === f.id ? '■ PARAR' : '▶ ESCUCHAR', { encima: this.hoverPlay, activo: this.suena === f.id });
      PLAY.y = 448;
    }
    this._suena(ctx);
    if (this.golpe > 0) this._ruido(ctx);
  }

  _pistas(ctx) {
    const x = X_PANEL + 2;
    FRAGS.forEach((c, i) => {
      const r = PISTA(i);
      const oida = ExtrasProgreso.cintaOida(c.id);
      const sel = this.pista === i;
      ctx.fillStyle = sel ? 'rgba(125,255,176,0.12)' : 'rgba(10,16,14,0.5)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = sel ? VERDE : 'rgba(125,255,176,0.22)';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.textAlign = 'left';
      ctx.font = `17px ${FUENTE}`;
      ctx.fillStyle = oida ? (this.suena === c.id ? VERDE : TINTA) : GRIS;
      ctx.fillText(oida ? `Pista ${i + 1}` : '???', r.x + 10, r.y + r.h / 2 + 1);
      ctx.textAlign = 'right';
      if (oida) ctx.fillText(fmt(this.datos[c.id]?.dur), r.x + r.w - 10, r.y + r.h / 2 + 1);
    });
    const n = FRAGS.filter((c) => ExtrasProgreso.cintaOida(c.id)).length;
    PLAY.y = 380;
    boton(ctx, PLAY, this.suena === FRAGS[this.pista].id ? '■ PARAR' : '▶ ESCUCHAR', { encima: this.hoverPlay });
    ctx.textAlign = 'left';
    ctx.font = `17px ${FUENTE}`;
    ctx.fillStyle = 'rgba(159,216,180,0.9)';
    ctx.fillText('Habla: La mujer', x + 350, 446);
    ctx.font = `bold 20px ${FUENTE}`;
    ctx.fillStyle = n === 7 ? VERDE : VERDE_OSC;
    ctx.fillText(n === 7 ? (TEXTOS.cintas.grupoConductos?.completa ?? 'Completa') : `${n}/7 fragmentos`, x + 350, 480);
  }

  /** La barra y los subtítulos de lo que suena (solo el texto hablado, como en el juego). */
  _suena(ctx) {
    if (!this.suena || !this.a) return;
    const d = this.datos[this.suena];
    const now = this.a.currentTime;
    const w = 640;
    const x = X_PANEL + 2;
    const yb = 650;
    ctx.strokeStyle = VERDE_OSC;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, yb, w, 14);
    ctx.fillStyle = 'rgba(125,255,176,0.5)';
    ctx.fillRect(x + 2, yb + 2, (w - 4) * Math.min(1, now / (d.dur || this.a.duration || 1)), 10);
    const sub = (d.subs ?? []).find((s) => now >= s.start && now <= s.end);
    if (!sub) return;
    ctx.font = `bold 22px ${FUENTE}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    let y = 696;
    for (const l of lineas(ctx, sub.text, w)) {
      ctx.fillText(l, x + w / 2, y);
      y += 28;
    }
  }

  /** La estática de una cinta dañada. */
  _ruido(ctx) {
    const k = Math.min(1, this.golpe / 0.6);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '216,255,232' : '40,60,50'},${0.5 * k * Math.random()})`;
      ctx.fillRect(X_PANEL + 40 + Math.random() * 450, 158 + Math.random() * 200, 30 + Math.random() * 120, 2 + Math.random() * 3);
    }
  }
}

export const _w = W;
