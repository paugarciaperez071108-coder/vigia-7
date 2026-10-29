// =============================================================
// OficinaV2.js — La oficina entera hecha en Blender, por estados (v1.00).
// tools/3d/salas/oficina_v2.py + fuego_oficina.py → integrar_oficina.py →
// assets/salas/v2/ (indice.json).
//
// El usuario (2026-10-29): «todo lo que forma parte de la oficina (mesa, ventana,
// grietas, escombros, cables y fuego) se hace en Blender, en la misma escena y
// desde la misma cámara… nada de líneas, polígonos ni rectángulos dibujados
// encima». Aquí solo se ponen las imágenes: la oficina de cada vista, y los
// bucles del fuego (la llama y su luz, que parpadea en las paredes, la mesa y el
// monitor). Encima siguen yendo solo las cosas que se usan: la imagen del CRT,
// los botones, las puertas y los enemigos (OfficeView).
//
// Estados (se van sumando): normal (noches 1–6), 4am, 5am, final. Se pasa de uno a
// otro con un evento (una explosión: un segundo sin luz) para que el jugador vea que
// la oficina empeora, sin saltos raros. Solo se usan los que ya están renderizados.
// =============================================================

import { NIGHT7 } from '../night/night7.js';

let IND = null;
const IMGS = {};
fetch('assets/salas/v2/indice.json').then((r) => (r.ok ? r.json() : null)).then((j) => { IND = j; precargar(); }).catch(() => {});

function img(src) {
  let i = IMGS[src];
  if (!i) {
    i = IMGS[src] = new Image();
    i.src = src;
  }
  return i.complete && i.naturalWidth ? i : null;
}
const capa = (estado, f, c, k) => `assets/salas/v2/${estado}/${f.id}_${f.cara}_${c}_${String(k).padStart(2, '0')}.webp`;

function precargar() {
  for (const [estado, d] of Object.entries(IND ?? {})) {
    for (const src of Object.values(d.caras ?? {})) img(`assets/${src}`);
    for (const f of d.fuegos ?? []) for (const c of ['fuego', 'luz']) for (let k = 0; k < (f[c]?.n ?? 0); k++) img(capa(estado, f, c, k));
  }
}

export class OficinaV2 {
  constructor(game) {
    this.g = game;
    this.actual = null;        // el estado que se ve
    this.cambio = 0;           // s del apagón de un segundo al cambiar de estado
    this.forzado = null;       // (debug) un estado fijo
    this.t = 0;
  }

  /** El estado que toca ahora (o null: la oficina de siempre). */
  _quiere() {
    if (this.forzado) return IND?.[this.forzado] ? this.forzado : null;
    const g = this.g;
    if (g.state !== 'night') return null;
    if (g.nightNumber === 7 && g.n7?.active) {
      const h = g.clock.elapsed / g.clock.sph;
      for (const [e, desde] of [['final', NIGHT7.HORAS.SILENCIO - 0.4], ['5am', NIGHT7.HORAS.ROTURA], ['4am', NIGHT7.HORAS.CALOR]]) {
        if (h >= desde && IND?.[e]) return e;
      }
    }
    return IND?.normal ? 'normal' : null;
  }

  update(dt) {
    this.t += dt;
    this.cambio = Math.max(0, this.cambio - dt);
    const q = this._quiere();
    if (q !== this.actual) {
      // (no a mitad de una vista: con una explosión y un segundo sin luz)
      if (this.actual && q) {
        this.cambio = 1.0;
        const r = this.g.n7?.rotura;
        if (r) {
          r.sacudida = Math.max(r.sacudida, 0.8);
          r.oficina.flash = Math.max(r.oficina.flash, 0.35);
          r._son?.('estallido', { volume: 1 });
          r._son?.('panel', { volume: 0.8 });
        }
      }
      this.actual = q;
    }
  }

  /** ¿Hay oficina v2 en esta vista? */
  activa(face) {
    // (solo con su imagen ya cargada: si no, la oficina de siempre, nunca una mezcla)
    const src = this.actual && IND?.[this.actual]?.caras?.[face];
    return !!(src && img(`assets/${src}`));
  }

  get pantalla() {
    return (this.actual && IND?.[this.actual]?.pantalla) || null;
  }

  /** La oficina de esa vista (true si la ha pintado). */
  drawBase(ctx, face) {
    if (!this.activa(face)) return false;
    const im = img(`assets/${IND[this.actual].caras[face]}`);
    if (!im) return false;
    ctx.drawImage(im, 0, 0, 1600, 900);
    return true;
  }

  /** El fuego de esa vista: su luz (sumada) y la llama (encima), en bucle; y el segundo sin luz al cambiar. */
  drawFuego(ctx, face) {
    if (!this.activa(face)) return;
    const d = IND[this.actual];
    const fr = Math.floor(this.t * 15);
    for (const f of d.fuegos ?? []) {
      if (f.cara !== face) continue;
      if (f.luz) {
        const im = img(capa(this.actual, f, 'luz', fr % f.luz.n));
        if (im) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = NIGHT7.OFICINA_V2.LUZ;
          ctx.drawImage(im, f.luz.x, f.luz.y, f.luz.w, f.luz.h);
          ctx.restore();
        }
      }
      if (f.fuego) {
        const im = img(capa(this.actual, f, 'fuego', fr % f.fuego.n));
        if (im) ctx.drawImage(im, f.fuego.x, f.fuego.y, f.fuego.w, f.fuego.h);
      }
    }
  }

  /** El segundo sin luz al cambiar de estado (encima de todo lo de la oficina). */
  drawCambio(ctx) {
    if (this.cambio <= 0) return;
    const k = this.cambio > 0.75 ? 1 - (this.cambio - 0.75) / 0.25 * 0.3 : this.cambio / 0.75;
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, k)})`;
    ctx.fillRect(0, 0, 1600, 900);
  }
}
