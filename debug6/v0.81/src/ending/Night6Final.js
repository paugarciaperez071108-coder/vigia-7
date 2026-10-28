// =============================================================
// Night6Final.js — NOCHE 6, FASE 5: LA CINEMÁTICA DE LAS 6:00, INTERACTIVA
// (v0.78; guion aprobado por el usuario el 2026-10-27). Valores en
// NIGHT6.CINE (src/night/night6.js).
//
// A las 6:00 el turno no termina: cambia. Alarma grave, luces de
// emergencia y el reloj fijo en «6:00 · ALIMENTACIÓN DE EMERGENCIA». El
// jugador maneja la tableta como en un turno normal (Espacio o la
// pestaña; el plano o las teclas 1–0 para cambiar de cámara) y va
// buscando lo que pasa. Nadie ataca la oficina y NO se puede morir.
//
//   - El plano y la terminal guían: el triángulo de la cámara parpadea y
//     la terminal escribe «[06:00] ⚠ CAM 05 – actividad violenta»; se oye
//     a lo lejos, por su lado, un golpe o un grito.
//   - Cuatro muertes, en este orden y cada una en su sala (cada 9 s):
//       El Congelado   CAM 05 Criogenia   El Errante tras la estática, detrás
//                      de la cápsula: rompe el cristal y lo saca a rastras.
//       El Espécimen   CAM 02 Laboratorio El Dislocado le cae encima desde la
//                      rejilla del techo y lo arrastra al conducto.
//       El Insecto     Invernadero        lo acorralan los dos; chilla.
//       El Largo       CAM 01 Hangar      la pelea de verdad (7,5 s): se le
//                      engancha El Dislocado a la espalda, aparece El Errante
//                      delante, se defiende y le da un puñetazo a la lente
//                      (se agrieta); por la grieta se ve cómo lo arrastran.
//     Si estás en esa cámara, lo ves EN DIRECTO (a 12 fps, con saltos y
//     temblores); si llegas tarde, solo el después (el cadáver y la escena
//     destrozada). Cada víctima apaga su triángulo para siempre.
//   - Muerto El Largo: todas las cámaras a estática menos la CAM 02
//     («CAM 02 – señal única»); a los 6 s, la tableta salta sola a ella.
//     La pared tiembla, la Aberración la rompe (primero los brazos, luego
//     el desgarro y las caras: nunca entera), se gira despacio y mira a la
//     lente; no se puede cambiar de cámara. El Dislocado sale del conducto
//     y El Errante aparece tras la estática; los tres miran. Silencio.
//   - La tableta se apaga sola; la oficina, a oscuras con la luz de
//     emergencia; por la ventana pasa una sombra enorme. Fundido, «NOCHE 7»
//     y al menú con «Continue – Noche 7». Se guarda dónde quedó cada
//     cadáver (n6cadaveres) y la lente rota del Hangar (n6lenteRota).
//
// IMÁGENES (assets/n6/cine/, indice.json; tools/3d/n6/cine/). Mientras no
// estén, se usan las de siempre (cam_<sala> con luz roja y las poses), así
// que la cinemática se puede jugar entera igualmente.
//   emerg_<sala>.webp             cada sala con la luz de emergencia
//   <victima>_vivo/NNN.webp       el ataque, a 12 fps (NNN desde 000)
//   <victima>_despues.webp        el después
//   lab_tiembla_N.webp            la pared del Laboratorio, agrietándose (0–5)
//   aberracion_rompe/NNN.webp     la Aberración entrando (12 fps)
//   aberracion_mira/NNN.webp      se gira y mira a la lente (12 fps)
//   aberracion_sirven/NNN.webp    El Dislocado y El Errante a su lado (12 fps)
// =============================================================

import { CONFIG } from '../config.js';
import { NIGHT6 } from '../night/night6.js';
import { ROOMS } from '../world/StationMap.js';
import { miniBox } from '../render/MiniMap.js';
import { colorDe } from '../core/Colores.js';
import { glitchSlices } from '../render/Atmosphere.js';
import { quemado, bloques } from '../render/CamaraSeguridad.js';
import { drawErrante } from './Night4Dark.js';

const C = NIGHT6.CINE;
const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const LOWER_TAB = { x: 560, y: 846, w: 480, h: 42 };
const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const rand = (a, b) => a + Math.random() * (b - a);

// --- Imágenes (se cargan solas; si faltan, se usan las de siempre) ---------------
const CACHE = {};
let INDICE = null;
fetch('assets/n6/cine/indice.json').then((r) => (r.ok ? r.json() : null)).then((j) => { INDICE = j; }).catch(() => {});
function img(ruta) {
  let i = CACHE[ruta];
  if (!i) {
    i = CACHE[ruta] = new Image();
    i.src = `assets/n6/${ruta.startsWith('final/') ? ruta : 'cine/' + ruta}.webp`;
  }
  return i.complete && i.naturalWidth ? i : null;
}
/** Fotograma n de una animación (o null si no hay). */
function fotograma(anim, n) {
  const total = INDICE?.anim?.[anim];
  if (!total) return null;
  const k = Math.max(0, Math.min(total - 1, n));
  for (let j = 1; j <= 6 && k + j < total; j++) img(`${anim}/${String(k + j).padStart(3, '0')}`);   // (los siguientes, ya)
  return img(`${anim}/${String(k).padStart(3, '0')}`);
}

/** v0.79: precarga TODOS los clips de la cinemática (se llama antes de las 6:00). */
export function precargarCine() {
  const ir = () => {
    for (const [anim, n] of Object.entries(INDICE?.anim ?? {})) for (let k = 0; k < n; k++) img(`${anim}/${String(k).padStart(3, '0')}`);
    for (const f of INDICE?.fijas ?? []) img(f);
  };
  if (INDICE) ir();
  else fetch('assets/n6/cine/indice.json').then((r) => (r.ok ? r.json() : null)).then((j) => { INDICE = j; ir(); }).catch(() => {});
}

export class Night6Final {
  constructor(game) {
    this.g = game;
    this.mouse = { x: 0, y: 0 };
    this.feedCanvas = document.createElement('canvas');
    this.feedCanvas.width = W;
    this.feedCanvas.height = H;
  }

  start() {
    const g = this.g;
    this.t = 0;
    this.fase = 'muertes';        // muertes | unica | cam02 | apagon | fundido | noche7
    this.done = false;
    this.cues = new Set();
    this.faseT = 0;
    this.victimas = C.VICTIMAS.map((v) => ({ ...v, muerta: false, vista: null }));
    this.feed = { frameIn: 0, room: null, kick: 0, temblor: 0, quemado: 0 };
    this.avisos = [];
    this.ruido = 0;
    const cams = g.cameras;
    cams.reset();
    cams.enabled = true;
    cams.active = 'cryo';
    if (cams.open) cams.forceClose();
    g.audio.stopAll();
    precargarCine();
    this._alarma();
    this._linea('06:00', 'ALIMENTACIÓN DE EMERGENCIA · TURNO NO FINALIZADO');
  }

  // --- Sonido ----------------------------------------------------------------------
  _play(key, opts = {}) {
    return this.g.audio.lib?.play(key, opts);
  }

  /** Lo de una sala: si la miras, por el micrófono de la cámara; si no, lejos y por su lado. */
  _enSala(room, key, vol = 1, opts = {}) {
    const cams = this.g.cameras;
    if (cams.open && cams.active === room) return this._play(key, { volume: vol, radio: true, ...opts });
    return this.g.audio.playAt?.(key, room, vol * 0.85, opts);
  }

  /** La alarma grave de las 6:00 (sintetizada: un tono que baja, una y otra vez). */
  _alarma() {
    const c = this.g.audio.ctx;
    if (!c) return;
    const t0 = c.currentTime;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.16, t0 + 0.3);
    g.gain.setValueAtTime(0.16, t0 + C.ALARMA - 1.2);
    g.gain.linearRampToValueAtTime(0, t0 + C.ALARMA);
    g.connect(this.g.audio.master);
    const o = c.createOscillator();
    o.type = 'sawtooth';
    for (let k = 0; k < C.ALARMA; k += 1.6) {
      o.frequency.setValueAtTime(118, t0 + k);
      o.frequency.linearRampToValueAtTime(82, t0 + k + 1.5);
    }
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 600;
    o.connect(f).connect(g);
    o.start(t0);
    o.stop(t0 + C.ALARMA + 0.1);
  }

  /** El grave de la Aberración: se siente más que se oye. */
  _grave(dur, vol = 0.5) {
    const c = this.g.audio.ctx;
    if (!c) return;
    const t0 = c.currentTime;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 1.2);
    g.gain.setValueAtTime(vol, t0 + dur - 1.5);
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    g.connect(this.g.audio.master);
    for (const [fr, a] of [[29, 1], [41, 0.6], [58.5, 0.25]]) {
      const o = c.createOscillator();
      o.frequency.value = fr;
      const og = c.createGain();
      og.gain.value = a;
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.3 + Math.random() * 0.3;
      const lg = c.createGain();
      lg.gain.value = a * 0.35;
      lfo.connect(lg).connect(og.gain);
      o.connect(og).connect(g);
      o.start(t0);
      lfo.start(t0);
      o.stop(t0 + dur + 0.1);
      lfo.stop(t0 + dur + 0.1);
    }
  }

  /** Su respiración: varias voces a la vez, a alturas distintas. */
  _respiracion() {
    for (const [p, v, w] of [[0.55, 0.9, 0], [0.75, 0.7, 0.12], [1.05, 0.45, 0.25], [0.65, 0.6, 0.4]]) {
      this._play('largo/respiracion', { volume: v, pitch: p, radio: true, when: w });
    }
  }

  // --- La terminal -----------------------------------------------------------------
  _linea(hora, texto, peligro = false) {
    this.avisos.push({ txt: `[${hora}] ${peligro ? '⚠ ' : ''}${texto}`, t: 0, peligro });
    if (this.avisos.length > 4) this.avisos.shift();
    this.g.alerta?.(texto);
  }

  _cue(id, fn) {
    if (!this.cues.has(id)) {
      this.cues.add(id);
      fn();
    }
  }

  // --- Cada fotograma ----------------------------------------------------------------
  update(dt) {
    if (this.done) return;
    const g = this.g;
    // v0.79: no empieza hasta que los clips estén decodificados (como mucho C.CARGA s): si
    // no, el navegador se atasca decodificando y los primeros segundos se hacen eternos
    if (this.fase === 'muertes' && this.t === 0 && !this._cargado) {
      this._espera = (this._espera ?? 0) + dt;
      const pend = Object.values(CACHE).filter((i) => !i.complete).length;
      if ((INDICE && pend === 0) || this._espera > C.CARGA) this._cargado = true;
      else return;
    }
    this.t += dt;
    this.faseT += dt;
    g.cameras.update(dt);
    for (const a of this.avisos) a.t += dt;
    this.feed.kick = Math.max(0, this.feed.kick - dt);
    this.feed.temblor = Math.max(0, this.feed.temblor - dt);
    this.feed.quemado = Math.max(0, this.feed.quemado - dt * 1.6);
    // v0.79: cada cámara suena según su sala (por su micrófono): eco metálico, zumbido, goteo
    this.ambIn = (this.ambIn ?? 1.5) - dt;
    if (this.ambIn <= 0 && g.cameras.open && ['muertes', 'unica', 'cam02'].includes(this.fase)) {
      this.ambIn = rand(1.6, 3.2);
      const AMB = { cryo: ['ambiente/goteo', 'congelado/hielo'], lab: ['ambiente/ventilacion', 'ambiente/goteo'],
        greenhouse: ['ambiente/goteo', 'ambiente/crujido'], hangar: ['ambiente/crujido', 'ambiente/chispazo'] };
      const lista = AMB[g.cameras.active] ?? ['ambiente/ventilacion', 'ambiente/crujido'];
      this._play(lista[Math.floor(Math.random() * lista.length)], { volume: 0.25, radio: true, pitch: 0.9 + Math.random() * 0.2 });
    }
    if (this.fase === 'muertes') this._updateMuertes();
    else if (this.fase === 'unica') this._updateUnica(dt);
    else if (this.fase === 'cam02') this._updateCam02();
    else if (this.fase === 'apagon') {
      // La sombra pasa: el casco de la nave cruje, la oficina tiembla; luego, silencio
      if (this.faseT > 0.2) this._cue('of1', () => this._play('ambiente/interferencia', { volume: 0.12, pitch: 0.5 }));   // (alarma lejana, ya apagándose)
      if (this.faseT > 0.8) this._cue('of2', () => { this._play('ambiente/crujido', { volume: 0.9, pitch: 0.55 }); this._play('metal/golpe_pared', { volume: 0.5, pitch: 0.4, when: 0.4 }); });
      if (this.faseT > 1.6) this._cue('of3', () => this._play('metal/cristal', { volume: 0.35, pitch: 0.6, corta: 0.6 }));
      if (this.faseT >= C.APAGON) this._fase('fundido');
    } else if (this.fase === 'fundido') {
      if (this.faseT >= C.FUNDIDO) this._fase('noche7');
    } else if (this.fase === 'noche7' && this.faseT >= C.NOCHE7) {
      this.done = true;
      g._n6FinalDone(this.victimas.map((v) => ({ id: v.id, room: v.room, visto: !!v.vista })));
    }
  }

  _fase(f) {
    this.fase = f;
    this.faseT = 0;
  }

  _updateMuertes() {
    const t = this.t;
    const cams = this.g.cameras;
    // v0.79 (el usuario: «12 s de oficina con niebla antes de que pase nada»): la tableta se enciende sola
    if (t >= C.TABLETA_SOLA) this._cue('tableta', () => {
      if (!cams.open) cams.toggle();
      this._setCam(this.victimas[0].room);
    });
    this.ruido = Math.min(0.55, (t / C.SENAL_UNICA) * 0.55);
    for (const v of this.victimas) {
      const k = v.id;
      if (t >= v.aviso) this._cue(`${k}_aviso`, () => {
        this._linea('06:00', `CAM ${ROOMS[v.room].cam} – actividad violenta`, true);
        this._enSala(v.room, v.id === 'frozen' ? 'metal/cristal' : 'largo/golpe', 0.9);
      });
      const u = t - v.ataque;
      if (u >= 0 && !v.muerta) {
        if (cams.open && cams.active === v.room) v.vista = true;
        // Capas de sonido del ataque (si se mira, por el micrófono de la cámara)
        for (const [at, key, vol, corta] of v.sonidos) {
          if (u >= at) this._cue(`${k}_s${at}`, () => {
            this._enSala(v.room, key, vol, corta ? { corta } : {});
            if (vol >= 0.9 && cams.active === v.room) {
              this.feed.temblor = 0.35;
              this.feed.kick = 0.25;
            }
          });
        }
        for (const sj of v.saltos ?? []) {
          if (u >= sj) this._cue(`${k}_salto${sj}`, () => {
            if (cams.active === v.room) this.feed.kick = Math.max(this.feed.kick, 0.3);
            this._enSala(v.room, 'ambiente/interferencia', 0.5, { corta: 0.3 });
          });
        }
        if (v.id === 'largo' && u >= C.LENTE_ROTA) this._cue('lente', () => {
          this.feed.quemado = 1;
          this.feed.temblor = 0.6;
        });
        if (u >= v.dur) {
          v.muerta = true;
          v.muertaT = this.t;
          this._linea('06:00', `CAM ${ROOMS[v.room].cam} – sin movimiento`);
        }
      }
    }
    if (t >= C.SENAL_UNICA) {
      this._fase('unica');
      this._linea('06:00', 'CAM 02 – señal única', true);
      this._play('ambiente/interferencia', { volume: 0.8 });
      this.ruido = 1;
    }
  }

  _updateUnica(dt) {
    const cams = this.g.cameras;
    // Golpes graves mientras tanto (ningún momento muerto)
    this.golpeIn = (this.golpeIn ?? 0.5) - dt;
    if (this.golpeIn <= 0) {
      this.golpeIn = rand(1.4, 2.4);
      this.g.audio.playAt?.('metal/golpe_pared', 'lab', 0.9, { pitch: 0.6 });
    }
    if (this.faseT >= C.SALTA_SOLA) {
      if (!cams.open) cams.toggle();
      if (cams.active !== 'lab') cams.select('lab');
    }
    if (cams.open && cams.active === 'lab' && cams.fullyOpen) this._fase('cam02');
  }

  _updateCam02() {
    const cams = this.g.cameras;
    const u = this.faseT;
    if (!cams.open) cams.toggle();                   // (ya no se puede cambiar ni bajarla)
    if (cams.active !== 'lab') cams.select('lab');
    const T = C.CAM02;
    const p0 = T.ESPERA;
    const r0 = p0 + T.PARED;
    const m0 = r0 + T.ROMPE;
    const s0 = m0 + T.MIRA;
    const fin = s0 + T.SIRVEN;
    if (u < p0) {
      // La espera: el laboratorio vacío; un golpe muy grave, cae polvo, el fluorescente se suelta
      this._cue('e1', () => this._grave(fin + 1, 0.55));
      if (u > 1.2) this._cue('e2', () => { this._play('metal/golpe_pared', { volume: 1, pitch: 0.45, radio: true }); this.feed.temblor = 0.7; this.feed.kick = 0.25; this.fluor = this.t; });
    } else if (u < r0) {
      // La pared se abomba con cada golpe
      for (const k of [0, 1, 2]) if (u > p0 + k) this._cue(`p${k}`, () => { this._play(k === 2 ? 'largo/golpe' : 'metal/golpe_pared', { volume: 1, pitch: 0.5, radio: true }); this._play('ambiente/crujido', { volume: 0.8, pitch: 0.6, radio: true }); this.feed.temblor = 0.6; });
    } else if (u < m0) {
      this._cue('r1', () => {
        this._play('puertas/golpe', { volume: 1, radio: true });
        this._play('caidas/caja', { volume: 0.9, radio: true, when: 0.15 });
        this._play('metal/panel', { volume: 0.9, radio: true, when: 0.3 });
        this._play('metal/cristal', { volume: 0.8, radio: true, when: 0.45 });
        this.feed.temblor = 1.2;
        this.feed.quemado = 0.8;
        this.feed.kick = 0.5;
      });
      if (u > r0 + 1.6) this._cue('r2', () => this._respiracion());
    } else if (u < s0) {
      this._cue('m1', () => this._play('criaturas/grunido', { volume: 0.7, pitch: 0.45, radio: true }));
    } else if (u < fin) {
      const s = u - s0;
      if (s > 0.3) this._cue('s1', () => this._play('n6/dislocado_arrastre', { volume: 0.8, radio: true }));
      if (s > 2.0) this._cue('s2', () => { this._play('ambiente/interferencia', { volume: 0.7, radio: true, corta: 0.4 }); this.feed.kick = 0.5; });
      if (s > 2.6) this._cue('s3', () => this._respiracion());
    } else if (u < fin + T.CORTE) {
      // La imagen se congela con un fallo digital
      this._cue('c1', () => { this.congelada = true; this._play('ambiente/interferencia', { volume: 0.9, corta: 0.5 }); });
    } else {
      // Se corta; la tableta se apaga sola
      this.congelada = false;
      this._play('ambiente/chispazo', { volume: 0.9 });
      this.g.audio.stopAll();
      cams.forceClose();
      this._fase('apagon');
    }
  }

  // --- Entrada (como en un turno normal) ------------------------------------------
  _puedeTableta() {
    return this.fase === 'muertes' || this.fase === 'unica';
  }

  move(x, y) {
    this.mouse = { x, y };
    const cams = this.g.cameras;
    if (cams.open || cams.anim > 0) return !!this.g.cameraView.hitTest(x, y, cams);
    return this._puedeTableta() && inside(LOWER_TAB, x, y);
  }

  click(x, y) {
    const cams = this.g.cameras;
    if (!this._puedeTableta()) return;
    if (cams.open) {
      const hit = this.g.cameraView.hitTest(x, y, cams);
      if (hit?.type === 'cam') this._setCam(hit.id);
      else if (hit?.type === 'monitor') cams.toggle();
      return;
    }
    if (inside(LOWER_TAB, x, y)) cams.toggle();
  }

  key(code) {
    const cams = this.g.cameras;
    if (!this._puedeTableta()) return;
    if (code === 'Space' || code === 'KeyS') {
      cams.toggle();
      return;
    }
    if (cams.open) {
      const n = /^(Digit|Numpad)(\d)$/.exec(code);
      if (n) {
        const id = Object.keys(ROOMS).find((r) => parseInt(ROOMS[r].cam, 10) % 10 === +n[2]);
        if (id) this._setCam(id);
      }
    }
  }

  _setCam(room) {
    const cams = this.g.cameras;
    if (!cams.open || room === cams.active || !ROOMS[room]) return;
    if (this.fase === 'unica' && room !== 'lab') {
      this._play('mira/pitido', { volume: 0.35 });   // (solo queda la CAM 02)
      this.feed.kick = 0.4;
      return;
    }
    cams.select(room);
    this.feed.kick = 0.25;
  }

  // --- Dibujo -----------------------------------------------------------------------
  draw(ctx) {
    const g = this.g;
    const cams = g.cameras;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (this.fase === 'noche7') return this._drawNoche7(ctx);
    if (!cams.fullyOpen) this._drawOficina(ctx);
    if (cams.anim > 0) {
      g.cameraView.draw(ctx, cams, g.effects, {
        night: 6,
        corridorOpen: true,
        clockElapsed: 6 * CONFIG.SECONDS_PER_HOUR,
        feed: (c, room) => this._drawFeed(c, room),
      });
      if (cams.fullyOpen) this._drawPlano(ctx);
    }
    this._drawTerminal(ctx);
    if (this.fase === 'fundido') {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, this.faseT / C.FUNDIDO)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  /** La oficina con la luz de emergencia (y, al final, a oscuras). */
  _drawOficina(ctx) {
    const g = this.g;
    const tiembla = this.fase === 'apagon' && this.faseT > 0.8 && this.faseT < 2.4;
    ctx.save();
    if (tiembla) ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 6);
    g._drawOfficeFront(ctx, 'front');
    ctx.restore();
    // v0.80 (el usuario: «quita la luz roja» de la oficina): la luz de emergencia, fría y tenue
    // como en las cámaras (tools/3d/n6/cine/luz_v3.py), sin el baño rojo; un fluorescente que tiembla
    const giro = 0.5 + 0.5 * Math.sin(this.t * 2.6);
    const oscuro = this.fase === 'apagon' || this.fase === 'fundido';
    const parpadeo = Math.random() < 0.06 ? 0.12 : 0;
    ctx.fillStyle = oscuro ? 'rgba(2,4,8,0.84)' : `rgba(6,12,22,${0.42 + parpadeo})`;
    ctx.fillRect(0, 0, W, H);
    if (!oscuro) {
      const gr = ctx.createRadialGradient(W * 0.5, 40, 10, W * 0.5, 40, 760);
      gr.addColorStop(0, `rgba(170,200,235,${0.1 - parpadeo * 0.5})`);
      gr.addColorStop(1, 'rgba(170,200,235,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
    }
    // (v0.81, el usuario: «quita la silueta de la ventana»: ya no pasa la sombra por el ventanal)
    g.effects.vignette(ctx, 1.1);
    if (!g.cameras.open && g.cameras.anim === 0 && this._puedeTableta()) {
      const hot = inside(LOWER_TAB, this.mouse.x, this.mouse.y);
      ctx.save();
      ctx.fillStyle = hot ? 'rgba(125,255,176,0.22)' : 'rgba(125,255,176,0.08)';
      ctx.strokeStyle = 'rgba(125,255,176,0.45)';
      ctx.lineWidth = 2;
      ctx.fillRect(LOWER_TAB.x, LOWER_TAB.y, LOWER_TAB.w, LOWER_TAB.h);
      ctx.strokeRect(LOWER_TAB.x, LOWER_TAB.y, LOWER_TAB.w, LOWER_TAB.h);
      ctx.fillStyle = '#9fd8b4';
      ctx.font = '18px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('▲  MONITOR  (Espacio)', LOWER_TAB.x + LOWER_TAB.w / 2, LOWER_TAB.y + LOWER_TAB.h / 2);
      ctx.restore();
    }
    // El reloj, fijo
    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = `rgba(${Math.round(185 + 30 * giro)},215,235,0.92)`;
    ctx.font = 'bold 30px "Courier New", monospace';
    ctx.fillText('6:00', W - 40, 58);
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText('ALIMENTACIÓN DE EMERGENCIA', W - 40, 84);
    ctx.restore();
  }

  /** La imagen de la cámara: a 12 fps (se pinta solo cuando toca un fotograma nuevo). */
  _drawFeed(ctx, room) {
    const f = this.feed;
    f.frameIn -= 1 / 60;
    if (f.frameIn <= 0 || f.room !== room) {
      // (a veces se pierde un fotograma o se queda congelado)
      f.frameIn = 1 / C.FPS + (Math.random() < 0.06 ? 1 / C.FPS : 0) + (Math.random() < 0.015 ? rand(0.2, 0.5) : 0);
      f.room = room;
      const c = this.feedCanvas.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0);
      this._pintarSala(c, room);
    }
    ctx.save();
    if (f.temblor > 0) ctx.translate((Math.random() - 0.5) * 40 * f.temblor, (Math.random() - 0.5) * 24 * f.temblor);
    ctx.drawImage(this.feedCanvas, 0, 0);
    ctx.restore();
    if (f.kick > 0) {
      glitchSlices(ctx, Math.min(1, f.kick * 3));
      this.g.effects.static(ctx, 0.35 * Math.min(1, f.kick * 4));
      bloques(ctx, Math.min(1, f.kick * 3));
    }
    if (f.quemado > 0) quemado(ctx, Math.min(1, f.quemado), W * 0.5, H * 0.45);
  }

  /** Lo que ve la cámara de `room` en este instante. */
  _pintarSala(c, room) {
    const g = this.g;
    c.fillStyle = '#000';
    c.fillRect(0, 0, W, H);
    if (this.fase !== 'muertes' && room !== 'lab') {
      g.effects.static(c, 0.85);
      c.fillStyle = 'rgba(232,238,245,0.8)';
      c.font = 'bold 40px "Courier New", monospace';
      c.textAlign = 'center';
      c.fillText('SIN SEÑAL', W / 2, H / 2);
      c.textAlign = 'left';
      return;
    }
    if (this.fase !== 'muertes') return this._pintarCam02(c);
    const v = this.victimas.find((x) => x.room === room);
    const u = v ? this.t - v.ataque : -1;
    if (v && u >= 0 && u < v.dur) this._pintarAtaque(c, v, u);
    else if (v && u >= v.dur) this._pintarDespues(c, v);
    else if (v && fotograma(`${v.id}_vivo`, 0)) c.drawImage(fotograma(`${v.id}_vivo`, 0), 0, 0, W, H);   // (antes: aún vivo, en su sitio)
    else this._fondo(c, room);
    // Las demás cámaras fallan cada vez más
    if (Math.random() < this.ruido * 0.25) g.effects.static(c, 0.3 + 0.5 * Math.random());
    if (Math.random() < this.ruido * 0.12) glitchSlices(c, 0.8);
  }

  _fondo(c, room) {
    const e = img(`emerg_${room}`);
    if (e) {
      c.drawImage(e, 0, 0, W, H);
      return;
    }
    // (sin el render: la cámara de siempre, apagada y con la luz roja de emergencia;
    // en la Criogenia, la cápsula vacía, que El Congelado ya no está dentro)
    c.save();
    c.filter = 'brightness(0.55) saturate(0.5)';
    const s = this.g.sprites;
    if (!(room === 'cryo' && s.draw(c, 'cam_cryo_vacia', 0, 0, W, H))) s.draw(c, `cam_${room}`, 0, 0, W, H);
    c.restore();
    c.fillStyle = 'rgba(120,10,5,0.35)';
    c.fillRect(0, 0, W, H);
  }

  _pose(c, id, room, tipo, o = {}) {
    for (const t of [tipo, 'media', 'lejos', 'cerca']) {
      const key = `pose_${id}_${room}_${t}`;
      if (this.g.sprites.has?.(key)) {
        c.save();
        if (o.rot) {
          c.translate(W / 2, H * 0.62 + (o.dy ?? 0));
          c.rotate(o.rot);
          c.translate(-W / 2, -H * 0.62);
        }
        this.g.sprites.draw(c, key, 0, 0, W, H);
        c.restore();
        return true;
      }
    }
    return false;
  }

  _pintarAtaque(c, v, u) {
    const im = fotograma(`${v.id}_vivo`, Math.floor(u * C.FPS));
    if (im) {
      c.drawImage(im, 0, 0, W, H);
      return;
    }
    // (provisional, hasta los renders: la sala, la víctima y los que la matan, a cortes)
    this._fondo(c, v.room);
    const k = u / v.dur;
    if (k < 0.75) this._pose(c, v.id, v.room, 'media', { rot: Math.random() < 0.4 ? (Math.random() - 0.5) * 0.3 : 0 });
    else this._pose(c, v.id, v.room, 'lejos', { rot: (k - 0.75) * 4, dy: (k - 0.75) * 300 });
    if (Math.random() < 0.6) drawErrante(c, W * rand(0.4, 0.7), H * 0.82, H * 0.6, { variant: 'frente', dark: 0.15 });
    if (Math.random() < 0.35) {
      c.fillStyle = 'rgba(40,0,0,0.4)';
      c.fillRect(0, 0, W, H);
    }
    if (v.id === 'largo' && u >= C.LENTE_ROTA) this._grieta(c, Math.min(1, (u - C.LENTE_ROTA) * 3));
  }

  _pintarDespues(c, v) {
    const n = INDICE?.anim?.[`${v.id}_despues`];
    const im = n ? fotograma(`${v.id}_despues`, Math.floor((this.t - v.ataque - v.dur) * C.FPS) % n) : img(`${v.id}_despues`);
    if (im) c.drawImage(im, 0, 0, W, H);
    else {
      this._fondo(c, v.room);
      // (provisional: un charco oscuro y brillante)
      const x = W * 0.5;
      const y = H * 0.76;
      const gr = c.createRadialGradient(x, y, 10, x, y, 220);
      gr.addColorStop(0, 'rgba(12,1,1,0.95)');
      gr.addColorStop(0.7, 'rgba(25,2,2,0.85)');
      gr.addColorStop(1, 'rgba(25,2,2,0)');
      c.fillStyle = gr;
      c.beginPath();
      c.ellipse(x, y, 240, 56, -0.05, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.07)';
      c.beginPath();
      c.ellipse(x - 50, y - 12, 70, 9, -0.05, 0, Math.PI * 2);
      c.fill();
    }
    // (v0.80: con los renders, la grieta ya viene en la imagen: tools/3d/n6/cine/grieta.py)
    if (v.id === 'largo' && !n) this._grieta(c, 1);
  }

  /**
   * La lente del Hangar, agrietada por el puñetazo de El Largo (se queda así:
   * n6lenteRota). v0.79: una grieta de verdad: la imagen partida en trozos que
   * se desplazan un poco cada uno (refracción), grietas quebradas con brillo en
   * los bordes, el punto del golpe astillado y algún píxel muerto.
   */
  _grieta(c, k) {
    if (k <= 0) return;
    if (!this.grietaCanvas) {
      this.grietaCanvas = document.createElement('canvas');
      this.grietaCanvas.width = W;
      this.grietaCanvas.height = H;
      let sem = 77;
      const r = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
      const cx = W * 0.63;
      const cy = H * 0.36;
      // Rayos a ángulos irregulares y de largo muy distinto (unos cruzan la lente, otros se quedan cortos)
      const angs = [];
      let a0 = r() * Math.PI * 2;
      while (angs.length < 11) { a0 += 0.25 + r() * 0.75; angs.push(a0); }
      const N = angs.length;
      const rayos = [];
      const ramas = [];
      for (let i = 0; i < N; i++) {
        const pts = [[cx, cy]];
        let px = cx;
        let py = cy;
        let aa = angs[i];
        const tramos = 2 + Math.floor(r() * 6);
        for (let q = 0; q < tramos; q++) {
          const l = 20 + r() * 90 + q * 25;
          aa += (r() - 0.5) * 0.45;
          px += Math.cos(aa) * l;
          py += Math.sin(aa) * l;
          pts.push([px, py]);
          if (q > 0 && r() < 0.35) {
            // Una rama fina que sale del rayo
            const ab = aa + (r() < 0.5 ? 1 : -1) * (0.5 + r() * 0.6);
            const lb = 15 + r() * 60;
            ramas.push([[px, py], [px + Math.cos(ab) * lb, py + Math.sin(ab) * lb]]);
          }
        }
        rayos.push(pts);
      }
      // Anillos solo a trozos (entre rayos vecinos, no siempre), cerca del golpe
      const anillos = [];
      for (const rad of [22, 48, 95]) {
        for (let i = 0; i < N; i++) {
          if (r() < (rad < 50 ? 0.25 : 0.55)) continue;
          const p1 = rayos[i][Math.min(rayos[i].length - 1, 1)];
          const p2 = rayos[(i + 1) % N][Math.min(rayos[(i + 1) % N].length - 1, 1)];
          const pt = (p, f) => [cx + (p[0] - cx) * f, cy + (p[1] - cy) * f];
          const d1 = Math.hypot(p1[0] - cx, p1[1] - cy) || 1;
          const d2 = Math.hypot(p2[0] - cx, p2[1] - cy) || 1;
          anillos.push([pt(p1, Math.min(1, rad * (0.8 + r() * 0.4) / d1)), pt(p2, Math.min(1, rad * (0.8 + r() * 0.4) / d2))]);
        }
      }
      const trozos = rayos.map((pts, i) => ({
        poly: [...pts, ...rayos[(i + 1) % N].slice().reverse()],
        dx: (r() - 0.5) * 6, dy: (r() - 0.5) * 5, s: 1 + (r() - 0.5) * 0.012, claro: r() > 0.5,
      }));
      const muertos = Array.from({ length: 9 }, () => [r() * W, r() * H, r() < 0.5]);
      this.grietaDatos = { cx, cy, rayos, ramas, anillos, trozos, muertos };
    }
    const G = this.grietaDatos;
    const tmp = this.grietaCanvas.getContext('2d');
    tmp.clearRect(0, 0, W, H);
    tmp.drawImage(c.canvas, 0, 0, c.canvas.width, c.canvas.height, 0, 0, W, H);
    for (const t of G.trozos) {
      c.save();
      c.beginPath();
      t.poly.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      c.clip();
      c.translate(G.cx + t.dx * k, G.cy + t.dy * k);
      c.scale(t.s, t.s);
      c.translate(-G.cx, -G.cy);
      c.drawImage(this.grietaCanvas, 0, 0);
      c.fillStyle = t.claro ? `rgba(255,255,255,${0.02 * k})` : `rgba(0,0,0,${0.035 * k})`;
      c.fillRect(0, 0, W, H);
      c.restore();
    }
    c.save();
    c.lineJoin = 'round';
    // Brillo ancho y suave, línea clara fina y sombra oscura desplazada (el borde del cristal)
    for (const [ancho, color, dx] of [[3, `rgba(255,255,255,${0.06 * k})`, 0], [1, `rgba(225,235,245,${0.55 * k})`, 0], [0.7, `rgba(0,0,0,${0.5 * k})`, 1]]) {
      c.lineWidth = ancho;
      c.strokeStyle = color;
      c.beginPath();
      for (const pts of [...G.rayos, ...G.ramas, ...G.anillos]) pts.forEach(([x, y], i) => (i ? c.lineTo(x + dx, y + dx) : c.moveTo(x + dx, y + dx)));
      c.stroke();
    }
    const gr = c.createRadialGradient(G.cx, G.cy, 0, G.cx, G.cy, 26);
    gr.addColorStop(0, `rgba(240,245,250,${0.5 * k})`);
    gr.addColorStop(1, 'rgba(240,245,250,0)');
    c.fillStyle = gr;
    c.fillRect(G.cx - 30, G.cy - 30, 60, 60);
    for (const [x, y, blanco] of G.muertos) {
      c.fillStyle = blanco ? `rgba(255,255,255,${k})` : `rgba(0,0,0,${k})`;
      c.fillRect(Math.round(x), Math.round(y), 3, 3);
    }
    c.restore();
  }

  /** CAM 02: la espera, la pared, la rotura, la mirada y los tres (renders; si no, lo provisional). */
  _pintarCam02(c) {
    const T = C.CAM02;
    const u = this.fase === 'cam02' ? this.faseT : 0;
    const p0 = T.ESPERA;
    const r0 = p0 + T.PARED;
    const m0 = r0 + T.ROMPE;
    const s0 = m0 + T.MIRA;
    const anim = (nombre, desde) => fotograma(nombre, Math.floor((u - desde) * C.FPS));
    if (this.congelada && this.ultimoCam02) {
      // La imagen congelada, rota en franjas
      c.drawImage(this.ultimoCam02, 0, 0);
      glitchSlices(c, 1);
      bloques(c, 1);
      return;
    }
    let im = null;
    if (u < p0) {
      this._fondo(c, 'lab');
      // El polvo que cae del techo y el fluorescente que se suelta y se balancea
      c.fillStyle = 'rgba(210,200,180,0.35)';
      const kk = this.fluor ? Math.min(1, (this.t - this.fluor) / 1.5) : 0;
      for (let i = 0; i < 70 * kk; i++) c.fillRect(W * (0.2 + 0.6 * Math.random()), H * 0.62 * Math.random(), 2, 6 + Math.random() * 12);
      if (this.fluor) {
        const a = Math.sin((this.t - this.fluor) * 3.2) * 0.6 * Math.exp(-(this.t - this.fluor) * 0.15);
        c.save();
        c.translate(W * 0.48, H * 0.06);
        c.rotate(a);
        c.fillStyle = 'rgba(30,30,30,0.95)';
        c.fillRect(-4, 0, 8, 60);
        c.fillStyle = Math.random() < 0.3 ? 'rgba(60,60,60,1)' : 'rgba(255,240,220,0.9)';
        c.fillRect(-150, 60, 300, 14);
        c.restore();
      }
      return;
    }
    if (u < r0) im = img(`lab_tiembla_${Math.min(5, Math.floor(((u - p0) / T.PARED) * 6))}`);
    else if (u < m0) im = anim('aberracion_rompe', r0) ?? img('final/aberracion_parte');
    else if (u < s0) im = anim('aberracion_mira', m0) ?? img('final/aberracion_mira');
    else im = anim('aberracion_sirven', s0) ?? img('final/aberracion_mira');
    if (im) c.drawImage(im, 0, 0, W, H);
    else this._fondo(c, 'lab');
    if (!this.ultimoCam02) {
      this.ultimoCam02 = document.createElement('canvas');
      this.ultimoCam02.width = W;
      this.ultimoCam02.height = H;
    }
    this.ultimoCam02.getContext('2d').drawImage(c.canvas, 0, 0, c.canvas.width, c.canvas.height, 0, 0, W, H);
  }

  /** El plano: el triángulo de la cámara con el aviso parpadea; los muertos ya no están. */
  _drawPlano(ctx) {
    ctx.save();
    if (this.fase === 'muertes') {
      for (const v of this.victimas) {
        if (v.muerta && this.t - v.muertaT > 0.8) continue;
        if (v.muerta && Math.floor((this.t - v.muertaT) * 12) % 2) continue;     // (se apaga parpadeando)
        const b = miniBox(ROOMS[v.room].mapRect);
        const activo = this.t >= v.aviso;
        ctx.globalAlpha = activo ? (Math.floor(this.t * 5) % 2 ? 1 : 0.25) : 0.85;
        ctx.fillStyle = colorDe(v.id);
        ctx.strokeStyle = activo ? '#ff3a2a' : '#000';
        ctx.lineWidth = activo ? 2.5 : 1.5;
        const x = b.x + b.w - 9;
        const y = b.y + 9;
        ctx.beginPath();
        ctx.moveTo(x, y - 8);
        ctx.lineTo(x + 8, y + 6);
        ctx.lineTo(x - 8, y + 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        if (activo) {
          ctx.strokeStyle = `rgba(255,58,42,${0.4 + 0.4 * Math.sin(this.t * 10)})`;
          ctx.strokeRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
        }
      }
    } else if (this.fase === 'unica') {
      const b = miniBox(ROOMS.lab.mapRect);
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.t * 8);
      ctx.strokeStyle = '#ffd84a';
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
    }
    ctx.restore();
  }

  /** La terminal, legible: más grande, sobre fondo oscuro y la última línea resaltada. */
  _drawTerminal(ctx) {
    if (this.fase === 'apagon' || this.fase === 'fundido' || !this.avisos.length) return;
    ctx.save();
    const n = this.avisos.length;
    const x = 430;
    const w = 740;
    const h = 18 + n * 30;
    ctx.fillStyle = 'rgba(4,8,6,0.82)';
    ctx.fillRect(x, 10, w, h);
    ctx.strokeStyle = 'rgba(125,255,176,0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, 10, w, h);
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    this.avisos.forEach((a, k) => {
      const ultima = k === n - 1;
      const y = 28 + k * 30;
      if (ultima) {
        ctx.fillStyle = a.peligro ? 'rgba(255,90,70,0.22)' : 'rgba(255,216,74,0.16)';
        ctx.fillRect(x + 4, y - 14, w - 8, 28);
      }
      ctx.fillStyle = ultima ? (a.peligro ? '#ff6a58' : '#ffe27a') : 'rgba(235,240,236,0.78)';
      ctx.fillText(a.txt, x + 16, y);
    });
    ctx.restore();
  }

  _drawNoche7(ctx) {
    const u = this.faseT;
    ctx.globalAlpha = Math.max(0, Math.min(1, u / 1.2) * Math.min(1, (C.NOCHE7 - u) / 0.8));
    ctx.fillStyle = '#e8eef5';
    ctx.font = 'bold 96px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NOCHE 7', W / 2, H / 2);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
}
