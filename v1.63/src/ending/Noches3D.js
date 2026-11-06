// =============================================================
// Noches3D.js — (v1.55, plan «noches 2 y 4 con movimiento libre», fase N1) Lo propio de las noches 2 y 4 dentro de
// Libre3D (R.mod de los recorridos de src/night/noches3d.js). Libre3D lo llama: update(dt) tras moverse (si devuelve
// 'para', no sigue), coloca() antes de dibujar el 3D, draw(ctx) encima, tecla(code)/click() (true = se las queda) y
// stop().
//   NochesBase: la base (y el recorrido de prueba «noches»): sabe en qué sala estás y, al entrar en una, a veces sale
//   un enemigo asomado (Asomados3D); si ataca, el susto y vuelta a empezar.
// =============================================================

import { Asomados3D } from './Asomados3D.js';
import { CONFIG } from '../config.js';

const W = CONFIG.WIDTH, H = CONFIG.HEIGHT;
const enCaja = (c, x, y) => x >= c[0] && x <= c[2] && y >= c[1] && y <= c[3];

export class NochesBase {
  constructor(L, o = {}) {
    this.L = L;
    this.g = L.g;
    this.o = o;
    this.t = 0;
    this.sala = null;
    this.sinNadie = 0;
    this.susto = null;
    this.asomados = new Asomados3D(L, {
      verSinLuz: o.verSinLuz ?? 0, tune: o.tune,
      onAtaca: (enemigo, por) => this.ataca(enemigo, por),
    });
    this.ayuda = 6;
  }

  stop() {
    this.asomados.quitaTodos();
  }

  /** La sala (de las de las cámaras) en la que estás, o null (un pasillo). */
  salaEn(x = this.L.x, y = this.L.y) {
    return (this.o.salas ?? []).find((s) => enCaja(s.caja, x, y))?.n ?? null;
  }

  update(dt) {
    this.t += dt;
    this.ayuda = Math.max(0, this.ayuda - dt);
    if (this.susto) {
      this.susto.t += dt;
      if (this.susto.t >= 2.4) this.alSusto();
      return 'para';
    }
    const s = this.salaEn();
    if (s !== this.sala) {
      const antes = this.sala;
      this.sala = s;
      if (s) this.alEntrar(s, antes);
    }
    this.asomados.update(dt);
    return this.susto ? 'para' : null;
  }

  /** Al entrar en una sala (el recorrido de prueba: a veces, uno asomado). */
  alEntrar(sala) {
    const P = this.o.prueba;
    if (!P || sala === 'office' || this.asomados.lista.length || this.t < (P.PRIMERO_S ?? 0)) return;
    if (Math.random() < P.PROB || this.sinNadie >= 1) {
      this.sinNadie = 0;
      this.saleUno(sala);
    } else this.sinNadie++;
  }

  saleUno(sala, enemigo = Math.random() < 0.5 ? 'largo' : 'specimen', o = {}) {
    const caja = (this.o.salas ?? []).find((x) => x.n === sala)?.caja;
    if (!caja) return null;
    const sitios = this.asomados.sitiosEn(caja, 3);
    if (!sitios.length) return null;
    return this.asomados.nuevo(enemigo, sitios, o);
  }

  ataca(enemigo, por) {
    if (this.susto) return;
    this.susto = { t: 0, enemigo, por };
    this.L.teclas.clear();
    this.g.audio?.scream?.();
    console.info('Vigía-7 noches 3D: te ataca', enemigo, '(' + por + ')');
  }

  /** Tras el susto (el de prueba): vuelta a empezar el recorrido. */
  alSusto() {
    this.L.start(this.L.nombre, null);
  }

  coloca() {
    this.asomados.coloca();
  }

  draw(ctx) {
    if (this.susto) {
      const k = this.susto.t;
      ctx.save();
      ctx.fillStyle = k < 0.25 ? `rgba(255,255,255,${(1 - k / 0.25).toFixed(3)})` : '#000';
      if (k >= 0.25) ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = `rgba(150,0,0,${Math.max(0, 0.8 - k * 0.3).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      return;
    }
    if (this.ayuda > 0 && !this.L.sinLinterna) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.ayuda) * 0.6;
      ctx.fillStyle = '#cfd8d0';
      ctx.font = '14px monospace';
      ctx.fillText('ESPACIO / F: linterna', 24, H - 46);
      ctx.restore();
    }
  }
}
