// =============================================================
// Night6Final.js — NOCHE 6, FASE 5: EL FINAL EN LAS CÁMARAS (v0.76).
// (Valores en NIGHT6.FINAL.)
//
// A las 6:00 el monitor se abre solo (como las cámaras de emergencia de
// la noche 4, ruta B) y la cinemática va de cámara en cámara:
//   1. En la cámara donde está cada uno a las 6:00 (El Largo, El Congelado,
//      El Espécimen y El Insecto, en ese orden; v0.74), El Errante y El
//      Dislocado acaban con él: cortes de imagen, la pelea, y su cuerpo se
//      queda allí (n6cadaveres, para la noche 7).
//   2. Silencio. CAM 02 Laboratorio: la pared del fondo tiembla.
//   3. La Aberración rompe la puerta de la sala secreta (detrás del
//      Laboratorio): por su tamaño, solo se ve una parte.
//   4. Se gira y mira a la cámara.
//   5. 5 s: El Dislocado sale del conducto y El Errante aparece tras una
//      ráfaga de estática; los dos se colocan a su lado, como sirviéndola.
//   6. Se corta la señal. Negro, «NOCHE 7», y al menú con «Continue – Noche 7».
// PROVISIONAL (v0.76): la hoja de la Aberración no está aprobada; sus planos
// usan el render de la hoja 2 (assets/n6/final/). Las muertes se cuentan con
// los sprites que ya existen (poses de cámara, El Errante, El Dislocado),
// a base de cortes, hasta que se rendericen las escenas con esqueleto.
// =============================================================

import { CONFIG } from '../config.js';
import { NIGHT6 } from '../night/night6.js';
import { ROOMS, VENTS } from '../world/StationMap.js';
import { drawErrante } from './Night4Dark.js';

const F = NIGHT6.FINAL;
const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const IMG = {};
function img(n) {
  let i = IMG[n];
  if (!i) {
    i = IMG[n] = new Image();
    i.src = `assets/n6/final/${n}.webp`;
  }
  return i.complete && i.naturalWidth ? i : null;
}
const etiqueta = (room) => (ROOMS[room] ? `CAM ${ROOMS[room].cam} · ${ROOMS[room].name.toUpperCase()}` : `${VENTS[room]?.cam ?? room} · ${(VENTS[room]?.name ?? '').toUpperCase()}`);

export class Night6Final {
  constructor(game) {
    this.g = game;
    for (const n of ['aberracion_parte', 'aberracion_mira']) img(n);
  }

  /** muertes: [{ id, room, rastro }] (Night6.desaparecidos). */
  start(muertes) {
    this.t = 0;
    this.done = false;
    this.cues = new Set();
    // Los que no desaparecieron durante la noche (desde la v0.74, todos) mueren
    // aquí: en la cámara donde estén a las 6:00 si tienen pose allí, y si no,
    // en su sala de siempre
    const ya = new Set(muertes.map((m) => m.id));
    const base = { largo: 'hangar', frozen: 'cryo', specimen: 'lab', insecto: 'v1' };
    const sala = (id) => {
      const r = this.g.ai?.[id]?.room;
      return r && this.g.sprites?.has?.(`pose_${id}_${r}_media`) ? r : base[id];
    };
    this.muertes = [...muertes, ...Object.keys(base).filter((id) => !ya.has(id)).map((id) => ({ id, room: sala(id), rastro: 'sangre' }))];
    // La línea de tiempo: [desde, hasta, plano]
    this.planos = [];
    let t = 0.8;
    for (const m of this.muertes) {
      this.planos.push([t, t + F.MUERTE, { tipo: 'muerte', ...m }]);
      t += F.MUERTE;
    }
    this.planos.push([t, t + F.SILENCIO, { tipo: 'silencio' }]);
    t += F.SILENCIO;
    this.planos.push([t, t + F.TIEMBLA, { tipo: 'tiembla' }]);
    t += F.TIEMBLA;
    this.planos.push([t, t + F.ROMPE, { tipo: 'rompe' }]);
    t += F.ROMPE;
    this.planos.push([t, t + F.MIRA, { tipo: 'mira' }]);
    t += F.MIRA;
    this.planos.push([t, t + F.SIRVEN, { tipo: 'sirven' }]);
    t += F.SIRVEN;
    this.planos.push([t, t + F.CORTE, { tipo: 'corte' }]);
    t += F.CORTE;
    this.planos.push([t, t + F.NOCHE7, { tipo: 'noche7' }]);
    this.fin = t + F.NOCHE7;
    this.g.audio.stopAll();
    this.g.audio.lib?.play('ambiente/interferencia', { volume: 0.6 });
  }

  get plano() {
    return this.planos.find(([a, b]) => this.t >= a && this.t < b) ?? null;
  }

  _cue(id, fn) {
    if (!this.cues.has(id)) {
      this.cues.add(id);
      fn();
    }
  }

  update(dt) {
    if (this.done) return;
    this.t += dt;
    const p = this.plano;
    const lib = this.g.audio.lib;
    if (p) {
      const [a, , d] = p;
      const u = this.t - a;
      const k = `${d.tipo}_${d.id ?? ''}`;
      if (d.tipo === 'muerte') {
        this._cue(k + 'a', () => lib?.play('ambiente/interferencia', { volume: 0.5, radio: true }));
        if (u > 0.6) this._cue(k + 'b', () => lib?.play('mira/zumbido', { volume: 0.6, radio: true }));
        if (u > 1.2) this._cue(k + 'c', () => lib?.play(d.id === 'frozen' ? 'congelado/grito' : d.id === 'largo' ? 'largo/grunido' : 'criaturas/chillido', { volume: 0.9, radio: true }));
        if (u > 1.7) this._cue(k + 'd', () => lib?.play('n6/dislocado_arrastre', { volume: 0.8, radio: true }));
        if (u > 2.1) this._cue(k + 'e', () => lib?.play('largo/golpe', { volume: 0.9, radio: true }));
        if (u > 2.6) this._cue(k + 'f', () => lib?.play('caidas/caja', { volume: 0.7, radio: true }));
      } else if (d.tipo === 'tiembla') {
        if (u > 0.2) this._cue('t1', () => lib?.play('metal/golpe_pared', { volume: 0.7, muffle: 0.4, radio: true }));
        if (u > 1.4) this._cue('t2', () => lib?.play('metal/golpe_pared', { volume: 0.9, muffle: 0.3, radio: true }));
        if (u > 2.3) this._cue('t3', () => lib?.play('largo/golpe', { volume: 1.0, radio: true }));
      } else if (d.tipo === 'rompe') {
        this._cue('r1', () => {
          lib?.play('puertas/golpe', { volume: 1.0, radio: true });
          lib?.play('caidas/caja', { volume: 0.9, radio: true, when: 0.15 });
          lib?.play('metal/panel', { volume: 0.9, radio: true, when: 0.3 });
        });
        if (u > 1.2) this._cue('r2', () => lib?.play('largo/respiracion', { volume: 0.8, pitch: 0.7, radio: true }));
      } else if (d.tipo === 'mira') {
        this._cue('m1', () => lib?.play('criaturas/grunido', { volume: 0.9, pitch: 0.6, radio: true }));
      } else if (d.tipo === 'sirven') {
        if (u > 0.4) this._cue('s1', () => lib?.play('n6/dislocado_arrastre', { volume: 0.8, radio: true }));
        if (u > 2.0) this._cue('s2', () => lib?.play('ambiente/interferencia', { volume: 0.8, radio: true }));
        if (u > 2.4) this._cue('s3', () => lib?.play('mira/pitido', { volume: 0.5, radio: true }));
      } else if (d.tipo === 'corte') {
        this._cue('c1', () => {
          lib?.play('ambiente/chispazo', { volume: 0.9 });
          this.g.audio.stopAll();
        });
      }
    }
    if (this.t >= this.fin && !this.done) {
      this.done = true;
      this.g._n6FinalDone(this.muertes);
    }
  }

  // --- Dibujo ------------------------------------------------------------------
  _camara(ctx, room, { sacude = 0, oscuro = 0 } = {}) {
    const g = this.g;
    ctx.save();
    if (sacude) ctx.translate((Math.random() - 0.5) * sacude, (Math.random() - 0.5) * sacude * 0.6);
    if (!g.sprites?.draw?.(ctx, `cam_${room}`, 0, 0, W, H)) {
      ctx.fillStyle = '#101513';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
    if (oscuro) {
      ctx.fillStyle = `rgba(0,0,0,${oscuro})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  _ui(ctx, texto) {
    ctx.save();
    ctx.fillStyle = 'rgba(230,240,235,0.85)';
    ctx.font = 'bold 26px "Courier New", monospace';
    ctx.fillText(texto, 40, 56);
    if (Math.floor(this.t * 2) % 2) {
      ctx.fillStyle = '#ff3a3a';
      ctx.beginPath();
      ctx.arc(W - 70, 46, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(230,240,235,0.7)';
    ctx.font = '20px "Courier New", monospace';
    ctx.fillText('6:00 AM · ALIMENTACIÓN DE EMERGENCIA', 40, H - 40);
    ctx.restore();
  }

  _pose(ctx, id, room, tipo, { dark = 0, rot = 0, dx = 0, dy = 0 } = {}) {
    const g = this.g;
    for (const t of [tipo, 'media', 'lejos', 'cerca']) {
      const key = `pose_${id}_${room}_${t}`;
      if (g.sprites?.has?.(key)) {
        ctx.save();
        if (dark) ctx.filter = `brightness(${1 - dark})`;
        ctx.translate(W / 2 + dx, H * 0.62 + dy);
        ctx.rotate(rot);
        ctx.translate(-W / 2, -H * 0.62);
        g.sprites.draw(ctx, key, 0, 0, W, H);
        ctx.restore();
        return true;
      }
    }
    return false;
  }

  draw(ctx) {
    const g = this.g;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const p = this.plano;
    if (!p) return;
    const [a, b, d] = p;
    const u = this.t - a;
    const k = u / (b - a);
    const ef = g.effects;
    if (d.tipo === 'muerte') {
      this._camara(ctx, d.room, { sacude: u > 1.2 && u < 2.8 ? 18 : 0, oscuro: 0.15 });
      if (u < 1.2) {
        // La víctima, quieta; detrás, El Errante (a saltos de imagen)
        this._pose(ctx, d.id, d.room, 'media');
        if (u > 0.6 && Math.floor(u * 8) % 3) drawErrante(ctx, W * 0.66, H * 0.8, H * 0.55, { variant: 'frente', dark: 0.25 });
      } else if (u < 2.8) {
        // La pelea: cortes, rojo, la víctima cayendo
        if (Math.random() < 0.55) this._pose(ctx, d.id, d.room, 'media', { rot: (u - 1.2) * 0.6, dy: (u - 1.2) * 60 });
        if (Math.random() < 0.5) drawErrante(ctx, W * (0.45 + Math.random() * 0.2), H * 0.8, H * 0.6, { variant: 'frente', dark: 0.1 });
        if (Math.random() < 0.3) {
          ctx.fillStyle = 'rgba(140,8,8,0.35)';
          ctx.fillRect(0, 0, W, H);
        }
        ef?.static(ctx, 0.25 + Math.random() * 0.3);
      } else {
        // El cuerpo, en el suelo; el rastro se queda
        this._pose(ctx, d.id, d.room, 'lejos', { dark: 0.55, rot: 1.3, dy: 120 });
        g.n6?._rastro?.(ctx, { ...d, rastro: 'sangre' });
      }
      this._ui(ctx, etiqueta(d.room));
      ef?.static(ctx, 0.06);
    } else if (d.tipo === 'silencio') {
      ef?.static(ctx, 0.12);
    } else if (d.tipo === 'tiembla') {
      this._camara(ctx, 'lab', { sacude: 4 + 22 * k * (0.5 + 0.5 * Math.sin(u * 30)) });
      // Polvo que cae del techo del fondo
      ctx.fillStyle = 'rgba(200,200,190,0.25)';
      for (let i = 0; i < 40 * k; i++) ctx.fillRect(Math.random() * W * 0.6 + W * 0.2, Math.random() * H * 0.5, 2, 6 + Math.random() * 14);
      this._ui(ctx, etiqueta('lab'));
      ef?.static(ctx, 0.05 + 0.1 * k);
    } else if (d.tipo === 'rompe' || d.tipo === 'mira' || d.tipo === 'sirven') {
      const im = img(d.tipo === 'rompe' ? 'aberracion_parte' : 'aberracion_mira') ?? img('aberracion_parte');
      if (d.tipo === 'rompe' && u < 0.35) {
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 1 - u / 0.35;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
      ctx.save();
      if (d.tipo === 'rompe') ctx.translate((Math.random() - 0.5) * 30 * (1 - k), (Math.random() - 0.5) * 18 * (1 - k));
      // «Se gira y mira a la cámara» (provisional): la imagen se acerca a la cara
      const z = d.tipo === 'mira' ? 1 + 0.18 * k : d.tipo === 'sirven' ? 1.18 : 1;
      if (z !== 1) {
        ctx.translate(W * 0.43, H * 0.33);
        ctx.scale(z, z);
        ctx.translate(-W * 0.43, -H * 0.33);
      }
      if (im) ctx.drawImage(im, 0, 0, W, H);
      else this._camara(ctx, 'lab');
      ctx.restore();
      if (d.tipo === 'sirven') {
        // El Dislocado sale del conducto (abajo a la izquierda) y El Errante aparece tras la estática
        const s = Math.min(1, u / (F.SIRVEN * 0.5));
        // (su pose de conducto, de frente, saliendo por abajo a la izquierda)
        if (g.sprites?.has?.('pose_dislocado_v4_media')) {
          g.sprites.draw(ctx, 'pose_dislocado_v4_media', -W * 0.22, H * (0.55 - 0.18 * s), W * 0.95, H * 0.95);
        }
        if (u > 2.1) drawErrante(ctx, W * 0.7, H * 0.86, H * 0.62, { variant: 'frente', dark: 0.2 });
        if (u > 1.9 && u < 2.4) ef?.static(ctx, 0.6);
      }
      this._ui(ctx, etiqueta('lab'));
      ef?.static(ctx, d.tipo === 'mira' ? 0.05 + 0.25 * k * Math.random() : 0.05);
    } else if (d.tipo === 'corte') {
      ef?.static(ctx, 0.9 * (1 - k));
    } else if (d.tipo === 'noche7') {
      ctx.globalAlpha = Math.min(1, u / 1.2) * Math.min(1, (b - this.t) / 0.8);
      ctx.fillStyle = '#e8eef5';
      ctx.font = 'bold 96px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('NOCHE 7', W / 2, H / 2 + 30);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
    // Aviso de provisional (solo en depuración)
    if (g.debug && ['rompe', 'mira', 'sirven'].includes(d.tipo)) {
      ctx.fillStyle = 'rgba(255,216,74,0.85)';
      ctx.font = '18px "Courier New", monospace';
      ctx.fillText('[debug] Aberración provisional: hoja 2 sin aprobar', 40, H - 70);
    }
  }
}
