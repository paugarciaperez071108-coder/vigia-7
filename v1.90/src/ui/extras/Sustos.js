// =============================================================
// Sustos.js — (v1.56) Los jumpscares de Extras. Al entrar, el aviso («Contiene sustos con sonido fuerte») con el
// volumen y la opción sin sonido. Cada uno: miniatura del primer fotograma, nombre, noches y, a pantalla completa, el
// mismo susto del juego con su sonido, para repetirlo o verlo a cámara lenta. Los no vistos: silueta y «???».
// El Congelado es una entrada con sus 3 variantes (cada vez, la siguiente).
// (v1.81) Los sustos nuevos (src/ui/sustos/registro.js) se ven con su escenario y sus variantes (cada vez, la
// siguiente); el antiguo de cada uno, en Beta (con COMPARAR).
// =============================================================

import { CONFIG } from '../../config.js';
import { ExtrasProgreso } from '../../core/ExtrasProgreso.js';
import { drawJumpscare, drawSaltoCongelado, duracionSalto, nuevoSalto, dibujaFotograma } from '../Jumpscare.js';
import { SustoDevora, SUSTO_DEVORA, precargaDevora } from '../SustoDevora.js';
import { NUEVOS, creaNuevo } from '../sustos/registro.js';
import { TEXTOS, VERDE, VERDE_OSC, TINTA, GRIS, FUENTE, inside, boton, imagen, lista, silueta, listaNoches, nochesDe } from './comun.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const LENTO = 4;
const TARJETA = (i) => ({ x: 104 + (i % 4) * 352, y: 158 + Math.floor(i / 4) * 278, w: 336, h: 264 });
const BARRA = { x: 1060, y: 740, w: 240, h: 20 };
const MUDO = { x: 1320, y: 730, w: 180, h: 40 };
const ENTRAR = { x: W / 2 - 150, y: 660, w: 300, h: 56 };
const BARRA_AV = { x: W / 2 - 160, y: 560, w: 320, h: 22 };
const MUDO_AV = { x: W / 2 - 130, y: 600, w: 260, h: 40 };
const REPITE = { x: W / 2 - 330, y: H - 90, w: 200, h: 46 };
const LENTA = { x: W / 2 - 110, y: H - 90, w: 220, h: 46 };
const CIERRA = { x: W / 2 + 130, y: H - 90, w: 200, h: 46 };

export class PantallaSustos {
  constructor(game) {
    this.g = game;
    this.sel = 0;
    this.aviso = true;
    this.t = 0;
    this.play = null;           // { s, t, lento, dur, var, devora }
    this.varFrozen = 0;
    this.varNuevo = {};
    this.ayuda = '←→↑↓ elegir · ENTER ver · ESC volver';
  }

  get lista() { return TEXTOS.sustos.lista; }

  visto(s) {
    if (s.bloqueo === 'aberracion' && !ExtrasProgreso.aberracion()) return false;
    return ExtrasProgreso.sustoVisto(s.id);
  }

  cuenta() { return `${this.lista.filter((s) => this.visto(s)).length}/${this.lista.length} vistos`; }

  abre() {
    this.aviso = true;
    this.t = 0;
    if (this.visto({ id: 'aberracion', bloqueo: 'aberracion' })) precargaDevora();
    for (const [id, r] of Object.entries(NUEVOS)) if (this.visto({ id })) r.precarga?.();
  }

  cierra() { this._fin(); }

  /** Con el reproductor o el aviso abiertos, Esc lo cierra a él. */
  quiereEsc() { return !!this.play; }

  _nivel() {
    const v = ExtrasProgreso.volSustos();
    return v.mudo ? 0 : v.vol;
  }

  _ponNivel() {
    if (this.play) this.g.audio?.setMasterLevel?.(this._nivel(), 0.02);
  }

  _ver(s, lento = false) {
    this.g._ensureAudio?.();
    this._paraSonido();
    const k = lento ? LENTO : 1;
    const p = { s, t: 0, lento, k };
    if (NUEVOS[s.id]) {
      const i = this.varNuevo[s.id] = (this.varNuevo[s.id] ?? -1) + 1;
      p.nuevo = creaNuevo(s.id, i);
      p.dur = p.nuevo.dura;
    } else if (s.id === 'frozen') {
      p.var = ['frozen_v1', 'frozen_v2', 'frozen_v3'][this.varFrozen++ % 3];
      p.dur = duracionSalto(p.var);
      nuevoSalto();
    } else if (s.id === 'aberracion') {
      const negro = document.createElement('canvas');
      negro.width = W;
      negro.height = H;
      negro.getContext('2d').fillRect(0, 0, W, H);
      p.devora = new SustoDevora(negro, {});
      p.dur = SUSTO_DEVORA.DURA;
    } else {
      p.dur = CONFIG.JUMPSCARE.CUT;
    }
    this.play = p;
    this.g.menuMusic?.baja?.(true);
    this._ponNivel();
    this._sonido(p);
  }

  _sonido(p) {
    const a = this.g.audio;
    if (!a?.ctx) return;
    const lib = a.lib;
    if (p.nuevo) {
      p.nuevo.sonido(a, p.k);
    } else if (p.s.id === 'aberracion') {
      lib?.play('aberracion/devora', { volume: 1, pitch: 1 / p.k, pitchVar: 0, volVar: 0 });
    } else if (p.s.id === 'frozen' && lib?.has?.('congelado/grito')) {
      lib.play('congelado/grito', { volume: 1, pitch: 1 / p.k, pitchVar: 0, volVar: 0 });
    } else {
      // (el grito sintético se alarga con la cámara lenta: mismo tono, más tiempo)
      const J = CONFIG.JUMPSCARE;
      const [lu, cu] = [J.LUNGE, J.CUT];
      J.LUNGE = lu * p.k;
      J.CUT = cu * p.k;
      a.scream();
      J.LUNGE = lu;
      J.CUT = cu;
    }
  }

  _paraSonido() { this.g.audio?.stopAll?.(); }

  _fin() {
    if (!this.play) return;
    this.play = null;
    this._paraSonido();
    this.g.audio?.setMasterLevel?.(1, 0.05);
    this.g.menuMusic?.baja?.(false);
  }

  key(code) {
    if (this.play) {
      if (code === 'Escape') this._fin();
      else if (code === 'KeyR' || code === 'Enter') this._ver(this.play.s, this.play.lento);
      else if (code === 'KeyL') this._ver(this.play.s, !this.play.lento);
      return;
    }
    if (this.aviso) {
      if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') this.aviso = false;
      else if (code === 'ArrowLeft') this._vol(-0.1);
      else if (code === 'ArrowRight') this._vol(0.1);
      else if (code === 'KeyM') this._mudo();
      return;
    }
    const n = this.lista.length;
    if (code === 'ArrowLeft' || code === 'KeyA') this.sel = (this.sel + n - 1) % n;
    else if (code === 'ArrowRight' || code === 'KeyD') this.sel = (this.sel + 1) % n;
    else if (code === 'ArrowUp' || code === 'KeyW') this.sel = (this.sel + n - 4) % n;
    else if (code === 'ArrowDown' || code === 'KeyS') this.sel = (this.sel + 4) % n;
    else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') return this._elegido(this.sel);
    else if (code === 'KeyM') return this._mudo();
    else return;
    this.g.audio?.keyClick?.();
  }

  _elegido(i) {
    const s = this.lista[i];
    if (!s) return;
    this.sel = i;
    if (this.visto(s)) this._ver(s);
    else this.g.menuMusic?.estatica?.(0.4, 0.3);
  }

  _vol(d) {
    const v = ExtrasProgreso.volSustos();
    ExtrasProgreso.ponVolSustos({ vol: Math.max(0, Math.min(1, Math.round((v.vol + d) * 10) / 10)), mudo: false });
    this.g.audio?.beep?.(880, 0.08 * this._nivel(), 0.05);
    this._ponNivel();
  }

  _mudo() {
    const v = ExtrasProgreso.volSustos();
    ExtrasProgreso.ponVolSustos({ ...v, mudo: !v.mudo });
    this._ponNivel();
  }

  _clicBarra(r, x) {
    ExtrasProgreso.ponVolSustos({ vol: Math.max(0, Math.min(1, Math.round(((x - r.x) / r.w) * 10) / 10)), mudo: false });
    this._ponNivel();
  }

  click(x, y) {
    if (this.play) {
      if (inside(REPITE, x, y)) this._ver(this.play.s, false);
      else if (inside(LENTA, x, y)) this._ver(this.play.s, true);
      else if (inside(CIERRA, x, y)) this._fin();
      return;
    }
    if (this.aviso) {
      if (inside(ENTRAR, x, y)) this.aviso = false;
      else if (inside({ ...BARRA_AV, y: BARRA_AV.y - 8, h: BARRA_AV.h + 16 }, x, y)) this._clicBarra(BARRA_AV, x);
      else if (inside(MUDO_AV, x, y)) this._mudo();
      return;
    }
    if (inside({ ...BARRA, y: BARRA.y - 8, h: BARRA.h + 16 }, x, y)) return this._clicBarra(BARRA, x);
    if (inside(MUDO, x, y)) return this._mudo();
    for (let i = 0; i < this.lista.length; i++) if (inside(TARJETA(i), x, y)) return this._elegido(i);
  }

  move(x, y) {
    this.hover = -1;
    if (this.play || this.aviso) return;
    this.lista.forEach((_, i) => { if (inside(TARJETA(i), x, y)) this.hover = i; });
  }

  sobre(x, y) {
    if (this.play) return inside(REPITE, x, y) || inside(LENTA, x, y) || inside(CIERRA, x, y);
    if (this.aviso) return inside(ENTRAR, x, y) || inside(MUDO_AV, x, y) || inside(BARRA_AV, x, y);
    return inside(MUDO, x, y) || inside(BARRA, x, y) || this.lista.some((_, i) => inside(TARJETA(i), x, y));
  }

  update(dt) {
    this.t += dt;
    if (this.play) this.play.t += dt / this.play.k;
  }

  // --- dibujo ---
  draw(ctx) {
    ctx.textBaseline = 'middle';
    if (this.aviso) return this._drawAviso(ctx);
    this.lista.forEach((s, i) => this._tarjeta(ctx, s, i));
    this._volumen(ctx, BARRA, MUDO);
  }

  _drawAviso(ctx) {
    const cx = W / 2;
    const cy = 300;
    const k = 0.55 + 0.45 * Math.abs(Math.sin(this.t * 2.4));
    ctx.strokeStyle = `rgba(255,90,70,${k})`;
    ctx.fillStyle = `rgba(255,90,70,${0.08 * k})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 120);
    ctx.lineTo(cx + 140, cy + 110);
    ctx.lineTo(cx - 140, cy + 110);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.font = `bold 120px ${FUENTE}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(255,120,100,${k})`;
    ctx.fillText('!', cx, cy + 34);
    ctx.font = `bold 34px ${FUENTE}`;
    ctx.fillStyle = 'rgba(255,190,170,0.95)';
    ctx.fillText(TEXTOS.sustos.aviso ?? '', cx, cy + 170);
    ctx.font = `17px ${FUENTE}`;
    ctx.fillStyle = VERDE_OSC;
    ctx.fillText('VOLUMEN', cx, BARRA_AV.y - 22);
    this._volumen(ctx, BARRA_AV, MUDO_AV);
    boton(ctx, ENTRAR, 'ENTRAR (Enter)', { activo: true, tam: 22 });
  }

  _volumen(ctx, b, m) {
    const v = ExtrasProgreso.volSustos();
    ctx.strokeStyle = VERDE_OSC;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = v.mudo ? GRIS : 'rgba(125,255,176,0.55)';
    ctx.fillRect(b.x + 2, b.y + 2, (b.w - 4) * v.vol, b.h - 4);
    ctx.font = `15px ${FUENTE}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(159,216,180,0.9)';
    if (b === BARRA) ctx.fillText(`VOLUMEN ${Math.round(v.vol * 100)} %`, b.x - 12, b.y + b.h / 2 + 1);
    boton(ctx, m, v.mudo ? '[X] SIN SONIDO' : '[ ] SIN SONIDO', { activo: v.mudo, tam: 16 });
  }

  _tarjeta(ctx, s, i) {
    const r = TARJETA(i);
    const sel = this.sel === i;
    const ve = this.visto(s);
    const f = { x: r.x + 8, y: r.y + 8, w: r.w - 16, h: 180 };
    ctx.fillStyle = sel ? 'rgba(125,255,176,0.12)' : 'rgba(10,16,14,0.5)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = sel ? VERDE : this.hover === i ? VERDE_OSC : 'rgba(125,255,176,0.22)';
    ctx.lineWidth = sel ? 2 : 1;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = '#000';
    ctx.fillRect(f.x, f.y, f.w, f.h);
    if (ve) this._miniatura(ctx, s, f);
    else silueta(ctx, s.id, f, 44);
    ctx.textAlign = 'left';
    ctx.font = `bold 20px ${FUENTE}`;
    ctx.fillStyle = ve ? TINTA : GRIS;
    ctx.fillText(ve ? s.nombre : '???', r.x + 12, r.y + 210);
    ctx.font = `15px ${FUENTE}`;
    ctx.fillStyle = ve ? VERDE_OSC : GRIS;
    ctx.fillText(ve ? `Noches ${listaNoches(nochesDe(s))} · ${s.donde}`.slice(0, 40) : '???', r.x + 12, r.y + 240);
  }

  _miniatura(ctx, s, f) {
    if (NUEVOS[s.id]) NUEVOS[s.id].Clase.miniatura(ctx, f);
    else if (s.id === 'aberracion') {
      const im = imagen('assets/sustos/devora/12.webp');
      if (lista(im)) ctx.drawImage(im, f.x, f.y, f.w, f.h);
    } else dibujaFotograma(ctx, s.id === 'frozen' ? 'frozen_v1' : s.id, 0, f);
  }

  /** A pantalla completa, por encima de todo. */
  drawEncima(ctx, effects) {
    const p = this.play;
    if (!p) return;
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (p.nuevo) p.nuevo.draw(ctx, Math.min(p.t, p.dur), effects);
    else if (p.var) drawSaltoCongelado(ctx, p.var, p.t, effects);
    else if (p.devora) p.devora.draw(ctx, p.t);
    else if (p.t < p.dur) drawJumpscare(ctx, p.s.id, p.t, effects);
    ctx.restore();
    ctx.textBaseline = 'middle';
    if (p.lento) {
      ctx.font = `bold 20px ${FUENTE}`;
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(216,255,232,0.85)';
      ctx.fillText('CÁMARA LENTA ×¼', 40, 40);
    }
    if (p.t >= p.dur) {
      ctx.font = `bold 26px ${FUENTE}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = TINTA;
      ctx.fillText(p.s.nombre, W / 2, H - 130);
      boton(ctx, REPITE, 'REPETIR (R)', { tam: 18 });
      boton(ctx, LENTA, 'CÁMARA LENTA (L)', { activo: p.lento, tam: 18 });
      boton(ctx, CIERRA, 'VOLVER (Esc)', { tam: 18 });
    }
  }
}
