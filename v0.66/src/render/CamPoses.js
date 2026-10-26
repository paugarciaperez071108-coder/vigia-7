// =============================================================
// CamPoses.js — Poses de los enemigos HECHAS PARA CADA CÁMARA.
//
// Cada pose es una imagen a pantalla completa (solo el enemigo, con fondo
// transparente) renderizada desde la cámara real de esa sala, con su luz
// (tools/3d/poses/poses.py). Se pinta encima de cam_<sala>. Claves del
// manifiesto: pose_<enemigo>_<sala>_<id>; datos en assets/poses/poses.json.
//
// Tipos de pose (id; puede haber variantes: lejos2, media3...):
//   lejos  al fondo, medio oculto        media  en la sala, mirando a la salida
//   cerca  pegado a la lente, mirándola  rara   sorpresa de baja probabilidad
//   rejilla_*  (El Largo) escondido tras la rejilla del conducto: solo los
//              ojos, los dedos o parte de la silueta. Solo se usan cuando
//              se piden (forced = 'rejilla').
//
// Cómo se elige: al verlo en una cámara (o al cambiar de sala) se tira al
// azar con pesos que dependen del AVANCE del enemigo hacia la oficina
// (0 = acaba de empezar, 1 = a punto de llegar) y del tiempo que lleva en
// la sala: cuanto más avanzado, más probable la pose cerca de la lente.
// Mientras se le mira, de vez en cuando cambia de pose (con un fallo de
// imagen, como en FNaF). Ajustes en CONFIG.CAM_POSES.
// =============================================================

import { CONFIG } from '../config.js';

let META = {};
fetch('assets/poses/poses.json').then((r) => (r.ok ? r.json() : {})).then((d) => { META = d; }).catch(() => {});

// Lo "cerca" que está cada tipo de pose (para la estática y el temblor)
const NEAR_BASE = { lejos: 0, media: 0.15, cerca: 1, rara: 0.7, rejilla: 0.1 };
/** Tipo de una pose: 'lejos2' → 'lejos', 'rejilla_ojos' → 'rejilla'. */
export const poseKind = (id) => String(id).replace(/_.*$/, '').replace(/\d+$/, '');
export const NEARNESS = new Proxy({}, { get: (_, id) => NEAR_BASE[poseKind(id)] ?? 0 });
// Opacidad por la niebla de la sala según lo lejos que esté
const FOG_BASE = { lejos: 0.78, media: 0.93, cerca: 1, rara: 1, rejilla: 1 };
const fogOf = (id) => FOG_BASE[poseKind(id)] ?? 1;
const rand = (a, b) => a + Math.random() * (b - a);

export class CamPoses {
  constructor(sprites) {
    this.sprites = sprites;
    this.state = {};     // por enemigo: { room, id, t, total, next }
    this.glitch = 0;     // s de fallo de imagen que quedan (al cambiar de pose)
  }

  /** ¿Hay poses 3D de este enemigo en esta cámara? */
  has(enemy, room) {
    const m = META[enemy]?.[room];
    return !!m && Object.keys(m).some((id) => this.sprites?.has(`pose_${enemy}_${room}_${id}`));
  }

  update(dt) {
    this.glitch = Math.max(0, this.glitch - dt);
    for (const s of Object.values(this.state)) {
      s.t += dt;
      s.total += dt;
    }
  }

  /** Olvida las poses (al empezar una noche). */
  reset() {
    this.state = {};
    this.glitch = 0;
  }

  /**
   * Pose actual de un enemigo en `room` (la elige o, a veces, la cambia).
   * progress: 0..1 avance hacia la oficina. forced: id obligatorio (p. ej.
   * 'cerca' cuando El Insecto está a punto de entrar).
   */
  pick(enemy, room, progress, forced = null) {
    const C = CONFIG.CAM_POSES;
    let s = this.state[enemy];
    if (!s || s.room !== room) {
      s = this.state[enemy] = { room, id: null, t: 0, total: 0, next: rand(...C.CHANGE_EVERY) };
      s.id = forced ? this._chooseKind(enemy, room, forced) : this._choose(enemy, room, progress);
      this.glitch = C.GLITCH_TIME;
      return s.id;
    }
    if (forced && poseKind(s.id) !== forced) {
      s.id = this._chooseKind(enemy, room, forced);
      this.glitch = C.GLITCH_TIME;
    } else if (!forced && (s.t >= s.next || (s.same ?? 0) + s.t >= C.MAX_SAME)) {
      // v0.51: siempre a una pose DISTINTA (antes podía salir la misma, y
      // cerca de la oficina «cerca» pesaba tanto que se quedaba ~30 s igual);
      // y nunca más de MAX_SAME s en la misma.
      s.same = (s.same ?? 0) + s.t;
      s.t = 0;
      s.next = rand(...C.CHANGE_EVERY);
      if (Math.random() < C.CHANGE_CHANCE || s.same >= C.MAX_SAME) {
        const id = this._choose(enemy, room, Math.min(1, progress + s.total / C.TIME_TO_NEAR), s.id);
        if (id && id !== s.id) {
          s.id = id;
          s.same = 0;
          this.glitch = C.GLITCH_TIME;
        }
      }
    }
    return s.id;
  }

  /** Una pose del tipo `kind` (entre sus variantes, por su peso p). */
  _chooseKind(enemy, room, kind) {
    const m = META[enemy]?.[room] ?? {};
    const opts = Object.entries(m).filter(([id]) => poseKind(id) === kind && this.sprites?.has(`pose_${enemy}_${room}_${id}`));
    if (!opts.length) return kind;
    let r = Math.random() * opts.reduce((a, [, d]) => a + (d.p ?? 1), 0);
    for (const [id, d] of opts) {
      r -= d.p ?? 1;
      if (r <= 0) return id;
    }
    return opts[opts.length - 1][0];
  }

  _choose(enemy, room, prog, except = null) {
    const m = META[enemy]?.[room] ?? {};
    const C = CONFIG.CAM_POSES;
    let opts = Object.entries(m).filter(([id]) => poseKind(id) !== 'rejilla' && this.sprites?.has(`pose_${enemy}_${room}_${id}`));
    if (except && opts.length > 1) opts = opts.filter(([id]) => id !== except);
    if (!opts.length) return null;
    const mult = {
      lejos: Math.max(0.15, 1.6 - 1.5 * prog),
      media: 1,
      cerca: 0.15 + C.NEAR_BOOST * prog * prog,
      rara: C.RARE_WEIGHT,
    };
    const ws = opts.map(([id, d]) => (d.p ?? 1) * (mult[poseKind(id)] ?? 1));
    let r = Math.random() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < opts.length; i++) {
      r -= ws[i];
      if (r <= 0) return opts[i][0];
    }
    return opts[opts.length - 1][0];
  }

  /** Pinta la pose (con su sombra de contacto en el suelo). */
  draw(ctx, enemy, room, id, t = 0) {
    const img = this.sprites?.images?.get(`pose_${enemy}_${room}_${id}`);
    if (!img) return false;
    const sh = META[enemy]?.[room]?.[id]?.sombra;
    if (sh) {
      const [x, y, rx] = sh;
      const g = ctx.createRadialGradient(x, y, 1, x, y, rx * 1.6);
      g.addColorStop(0, 'rgba(0,0,0,0.55)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.32);
      ctx.translate(-x, -y);
      ctx.fillStyle = g;
      ctx.fillRect(x - rx * 1.6, y - rx * 1.6, rx * 3.2, rx * 3.2);
      ctx.restore();
    }
    // Respira un poco (la imagen es fija): un vaivén de 1-2 px
    const bob = Math.sin(t * 1.7 + enemy.length) * (poseKind(id) === 'cerca' ? 3 : poseKind(id) === 'rejilla' ? 0.4 : 1);
    // La niebla de la sala (que está en el fondo, no en la capa del enemigo)
    // apaga a los que están lejos
    ctx.save();
    ctx.globalAlpha *= fogOf(id);
    ctx.drawImage(img, 0, bob, CONFIG.WIDTH, CONFIG.HEIGHT);
    ctx.restore();
    return true;
  }
}

/** Avance (0..1) de un enemigo hacia la oficina, para elegir la pose. */
export function progressOf(e) {
  if (e.route?.length) return Math.min(1, (e.routeIndex + 1) / e.route.length);
  if (e.id === 'specimen') return 0.05 + 0.2 * (e.wallStage ?? 0) / (CONFIG.WALL_STAGES || 4);
  if (e.id === 'largo') return Math.min(1, (e.breakStage ?? 0) / 5);
  return 0.5;
}
