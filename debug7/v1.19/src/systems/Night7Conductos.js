// =============================================================
// Night7Conductos.js — El caos de los conductos V1–V7 en la noche 7 (v1.19, Fase A del plan aprobado,
// informes/plan_conductos_n7/PLAN_CONDUCTOS_N7.md). Valores: NIGHT7.CONDUCTOS.
//
// SOLO imagen y sonido. Regla del usuario: El Dislocado NO cambia (hasta su muerte, Fase B). Este sistema
// solo LEE dónde está (para retrasar un fogonazo en su conducto) y nunca le escribe nada; tampoco usa
// world.rng (sus decisiones salen de ahí: así el caos no cambia ni una tirada suya).
//
// Todo son renders de Blender desde la cámara real de cada conducto (tools/3d/n7/conductos_caos.py →
// integrar_conductos.py → assets/n7/conductos/):
//   estado_<hora>   la imagen entera en cada hora (lo que se queda: rejilla, hollín, cable, aislante,
//                   metal al rojo, ventilador roto, techo hundido); cada conducto va por su cuenta
//   ev_<cual>_NN    la animación entera de un evento (ventilador, aislante, hundido); acaba como el estado
//   luz_NN          la luz del fuego de abajo por la rejilla del suelo (se SUMA; bucle)
//   humo_NN         el humo que llega de las salas, pegado al techo (bucle)
//   gotas_NN        el plástico del cable derretido goteando (bucle)
//   comun/fogonazo_NN + <v>/fogonazo_luz_NN   la bocanada de fuego y su luz en ese conducto
//   comun/rafaga_NN  la ráfaga de ceniza y chispas de una explosión grande de la sala del conducto
// El orden en la cámara: estado → luz → humo/gotas/fogonazo → EL DISLOCADO (con la luz del fuego encima de
// él) → un velo fino de humo por delante (sin taparle) → el aire que ondula y las interferencias por el calor.
// =============================================================

import { CONFIG } from '../config.js';
import { NIGHT7 } from '../night/night7.js';
import { ROOM_VENT, VENT_IDS } from '../world/StationMap.js';

const K = NIGHT7.CONDUCTOS;
const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const HORAS = ['normal', '4am', '430', '5am'];
const FPS = 15;
// (su propio azar: no gasta el del juego ni world.rng, de los que salen las tiradas de El Dislocado y los demás)
let semilla = (Date.now() ^ 0x5bd1e995) >>> 0;
function azar() {
  semilla = (semilla + 0x6d2b79f5) >>> 0;
  let t = semilla;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rand = ([a, b]) => a + azar() * (b - a);
const pick = (a) => a[Math.floor(azar() * a.length)];
const idx = (h) => HORAS.indexOf(h);

// --- Las imágenes (se piden al empezar la noche 7; las de cada conducto, en orden de hora) ---
let INDICE = null;
const CACHE = {};
function im(ruta) {
  let i = CACHE[ruta];
  if (!i) {
    i = CACHE[ruta] = new Image();
    i.src = `assets/n7/conductos/${ruta}.webp`;
  }
  return i.complete && i.naturalWidth ? i : null;
}
const nn = (n) => String(n).padStart(2, '0');

export class Night7Conductos {
  constructor(n7) {
    this.n7 = n7;
    this.g = n7.g;
    this.activo = true;              // (el interruptor del modo debug: «caos de conductos»)
    this.reset(false);
    this.g.events.on('n7Explosion', ({ sala, grande }) => {
      const v = ROOM_VENT[sala];
      if (this.on && this.activo && grande && v && this.c[v]) this.c[v].rafaga = 0;
    });
  }

  reset(on) {
    this.on = on;
    this.t = 0;
    this.c = {};
    for (const v of VENT_IDS) {
      this.c[v] = { estado: 'normal', antes: null, funde: 0, ev: null, hechos: new Set(), fog: null, fogPend: false, rafaga: null, interf: 0 };
    }
    this.fogIn = rand(K.FOGONAZO_CADA[0]);
    this.interfIn = rand(K.INTERF.CADA);
    this.ticIn = rand(K.TIC_CADA);
    this.crepIn = 0;
    if (on && !INDICE) {
      fetch('assets/n7/conductos/indice.json').then((r) => (r.ok ? r.json() : null)).then((d) => { INDICE = d; }).catch(() => {});
    }
  }

  get listo() { return this.on && this.activo && !!INDICE; }

  _hora() {
    const g = this.g;
    return g.clock.elapsed / g.clock.sph;
  }

  _clave(h) {
    return h >= 5 ? '5am' : h >= 4.5 ? '430' : h >= 4 ? '4am' : 'normal';
  }

  /** ¿Está El Dislocado en este conducto? (solo se mira; nunca se le toca) */
  _dislocadoEn(v) {
    const d = this.g.ai?.dislocado;
    return !!d && d.room === v && ['vent', 'grille', 'event'].includes(d.state);
  }

  _son(clave, v, vol, extra = {}) {
    const lib = this.g.audio?.lib;
    if (!lib) return;
    const cams = this.g.cameras;
    const mirando = cams.open && cams.mapMode === 'vent' && cams.active === v;
    // (por debajo del arrastre de El Dislocado: tope de volumen y, si no se mira, ahogado)
    lib.play(`conductos/${clave}`, { volume: Math.min(K.VOL_MAX, vol * K.VOL * (mirando ? 1 : 0.45)), muffle: mirando ? 0.15 : 0.6,
      pan: extra.pan ?? (azar() * 1.2 - 0.6), ...extra });
  }

  // ---------------------------------------------------------------
  update(dt) {
    if (!this.listo) return;
    this.t += dt;
    const h = this._hora();
    if (h < 4 - 0.02) return;
    for (const v of VENT_IDS) this._actualiza(v, h, dt);
    // Fogonazos: desde la hora de cada conducto (el primero, en cuanto llega su hora), y a las 5 más a menudo
    const conFog = VENT_IDS.filter((v) => INDICE[v]?.caos?.fogonazo && idx(this.c[v].estado) >= idx(INDICE[v].caos.fogonazo));
    for (const v of conFog) if (!this.c[v].hechos.has('fog1')) { this.c[v].fogPend = true; this.c[v].hechos.add('fog1'); }
    this.fogIn -= dt;
    if (this.fogIn <= 0 && conFog.length) {
      this.fogIn = rand(h >= 5 ? K.FOGONAZO_CADA[1] : K.FOGONAZO_CADA[0]);
      this.c[pick(conFog)].fogPend = true;
    }
    for (const v of conFog) {
      const c = this.c[v];
      // (regla: si El Dislocado está en este conducto, el fogonazo espera a que salga)
      if (c.fogPend && !c.fog && !c.ev && !this._dislocadoEn(v)) {
        c.fogPend = false;
        c.fog = 0;
        this._son('fogonazo', v, 0.9);
      }
    }
    // Interferencias por el calor (desde las 5): 1–2 s en un conducto; nunca se pierde la cámara
    if (h >= K.INTERF.DESDE) {
      this.interfIn -= dt;
      if (this.interfIn <= 0) {
        this.interfIn = rand(K.INTERF.CADA);
        const cams = this.g.cameras;
        const v = cams.open && cams.mapMode === 'vent' && azar() < 0.6 ? cams.active : pick(VENT_IDS);
        if (this.c[v]) this.c[v].interf = rand(K.INTERF.DURA);
      }
    }
    // El metal dilatándose («tic, tic») y el crepitar lejano por los tubos
    this.ticIn -= dt;
    if (this.ticIn <= 0) {
      this.ticIn = rand(K.TIC_CADA) * (h >= 5 ? 0.6 : 1);
      this._son('tic', pick(VENT_IDS), 0.5);
    }
    this.crepIn -= dt;
    if (this.crepIn <= 0) {
      this.crepIn = 7.0;
      const cams = this.g.cameras;
      const viendo = cams.open && cams.mapMode === 'vent';
      this._son('crepitar', viendo ? cams.active : null, (viendo ? K.CREPITAR_VOL : K.CREPITAR_VOL * 0.5) * (h >= 5 ? 1 : 0.7),
        { pan: 0, pitchVar: 0.02, muffle: viendo ? 0.25 : 0.7 });
    }
  }

  _actualiza(v, h, dt) {
    const c = this.c[v];
    const d = INDICE[v];
    if (!d) return;
    c.funde = Math.max(0, c.funde - dt);
    c.interf = Math.max(0, c.interf - dt);
    if (c.fog !== null) {
      c.fog += dt;
      if (c.fog * FPS >= (INDICE.comun?.fogonazo || 36)) c.fog = null;
    }
    if (c.rafaga !== null) {
      c.rafaga += dt;
      if (c.rafaga * FPS >= (INDICE.comun?.rafaga || 22)) c.rafaga = null;
    }
    if (c.ev) {
      c.ev.t += dt;
      if (c.ev.t * FPS >= c.ev.n) {
        c.antes = null;
        c.estado = c.ev.hora;          // (el último fotograma del evento ES este estado)
        c.ev = null;
      }
      return;
    }
    // Cada conducto cambia un poco después que los demás (no todo a la vez)
    const objetivo = this._clave(h - (K.RETRASO[v] ?? 0));
    if (idx(objetivo) <= idx(c.estado)) return;
    const sig = HORAS[idx(c.estado) + 1];
    const ev = Object.entries(d.eventos || {}).find(([cual, [hv]]) => hv === sig && !c.hechos.has(cual));
    if (ev) {
      const [cual, [hv, n]] = ev;
      c.hechos.add(cual);
      c.ev = { cual, hora: hv, n, t: 0 };
      this._son(cual === 'ventilador' && v === 'v5' ? 'aspa' : cual, v, 0.9);       // (el de V5 pierde una aspa)
    } else {
      c.antes = c.estado;
      c.funde = K.FUNDE;
      c.estado = sig;
    }
  }

  // ---------------------------------------------------------------
  // Dibujo en la cámara de un conducto
  // ---------------------------------------------------------------
  /** Encima de la imagen de siempre del conducto (antes de El Dislocado). */
  drawFondo(ctx, v) {
    if (!this.listo || this._hora() < 3.5) return;
    const c = this.c[v];
    const d = INDICE[v];
    if (!c || !d) return;
    const t = this.t;
    // La imagen: el evento que está pasando, o el estado (fundido desde el anterior)
    if (c.ev) {
      const f = im(`${v}/ev_${c.ev.cual}_${nn(Math.min(c.ev.n - 1, Math.floor(c.ev.t * FPS)))}`);
      if (f) ctx.drawImage(f, 0, 0, W, H);
      else this._estado(ctx, v, c.estado, 1);
    } else {
      if (c.antes && c.funde > 0) this._estado(ctx, v, c.antes, 1);
      this._estado(ctx, v, c.estado, c.antes && c.funde > 0 ? 1 - c.funde / K.FUNDE : 1);
    }
    // (lo siguiente, desde su hora)
    const desde = (clave) => d.caos?.[clave] && idx(c.ev ? c.ev.hora : c.estado) >= idx(d.caos[clave]);
    ctx.save();
    // La luz del fuego de abajo, por la rejilla del suelo (se suma; parpadea)
    if (d.luz && desde('rejilla')) {
      const f = im(`${v}/luz_${nn(Math.floor(t * FPS) % d.luz)}`);
      if (f) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (K.LUZ[c.estado] ?? 1) * (0.82 + 0.18 * Math.sin(t * 11) * Math.sin(t * 4.3));
        ctx.drawImage(f, 0, 0, W, H);
      }
    }
    // La luz del fogonazo (se suma)
    if (c.fog !== null && d.fogonazo_luz) {
      const f = im(`${v}/fogonazo_luz_${nn(Math.min(d.fogonazo_luz - 1, Math.floor(c.fog * FPS)))}`);
      if (f) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1;
        ctx.drawImage(f, 0, 0, W, H);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    // El humo pegado al techo (más denso con la hora)
    if (d.humo) {
      const f = im(`${v}/humo_${nn(Math.floor(t * FPS * 0.8) % d.humo)}`);
      if (f) {
        ctx.globalAlpha = K.HUMO[c.estado] ?? 0;
        ctx.drawImage(f, 0, 0, W, H);
        ctx.globalAlpha = 1;
      }
    }
    // El cable derretido gotea
    if (d.gotas && desde('cable')) {
      const f = im(`${v}/gotas_${nn(Math.floor(t * FPS) % d.gotas)}`);
      if (f) ctx.drawImage(f, 0, 0, W, H);
    }
    // La bocanada de fuego
    if (c.fog !== null && INDICE.comun?.fogonazo) {
      const f = im(`comun/fogonazo_${nn(Math.min(INDICE.comun.fogonazo - 1, Math.floor(c.fog * FPS)))}`);
      if (f) ctx.drawImage(f, 0, 0, W, H);
    }
    // La ráfaga de una explosión grande
    if (c.rafaga !== null && INDICE.comun?.rafaga) {
      const f = im(`comun/rafaga_${nn(Math.min(INDICE.comun.rafaga - 1, Math.floor(c.rafaga * FPS)))}`);
      if (f) ctx.drawImage(f, 0, 0, W, H);
    }
    ctx.restore();
  }

  _estado(ctx, v, e, alfa) {
    const f = im(`${v}/estado_${e}`);
    if (!f) return;
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.drawImage(f, 0, 0, W, H);
    // El aire que ondula delante de la chapa al rojo (franjas de la propia imagen, desplazadas)
    const rojo = INDICE[v]?.caos?.al_rojo;
    if (rojo && idx(e) >= idx(rojo) && alfa > 0.5) {
      const der = (K.AL_ROJO_LADO[v] ?? 1) > 0;
      const x0 = der ? W * 0.72 : 0;
      const ancho = W * 0.28;
      const sx = f.naturalWidth / W;
      const sy = f.naturalHeight / H;
      for (let y = 0; y < H; y += 6) {
        const dx = Math.sin(this.t * 7 + y * 0.045) * 2.2 + Math.sin(this.t * 13 + y * 0.11) * 1.1;
        ctx.drawImage(f, x0 * sx, y * sy, ancho * sx, 6 * sy, x0 + dx, y, ancho, 6);
      }
    }
    ctx.restore();
  }

  /**
   * El Dislocado en el conducto, con la luz del fuego encima de él (la luz renderizada del conducto, que le
   * llega desde la rejilla del suelo, y el resplandor naranja general de la hora). dibuja(ctx2) lo pinta
   * como siempre (Night5.drawVent): aquí solo se le suma luz; su imagen, su sitio y su pose no cambian.
   * Devuelve false si no hace nada (entonces se dibuja como siempre).
   */
  drawDislocado(ctx, v, dibuja) {
    if (!this.listo || this._hora() < 4 || !this._dislocadoEn(v)) return false;
    const c = this.c[v];
    const d = INDICE[v];
    const a = (this._capaA ??= document.createElement('canvas'));
    const b = (this._capaB ??= document.createElement('canvas'));
    for (const cv of [a, b]) {
      if (cv.width !== W) { cv.width = W; cv.height = H; }
    }
    const xa = a.getContext('2d');
    xa.setTransform(1, 0, 0, 1, 0, 0);
    xa.clearRect(0, 0, W, H);
    dibuja(xa);
    ctx.drawImage(a, 0, 0, W, H);
    // La luz: el resplandor de la hora (y la del fuego de abajo y la del fogonazo, renderizadas), solo sobre él
    const xb = b.getContext('2d');
    xb.setTransform(1, 0, 0, 1, 0, 0);
    xb.globalCompositeOperation = 'source-over';
    xb.globalAlpha = 1;
    xb.clearRect(0, 0, W, H);
    // (solo luz, sin formas: el resplandor de abajo, que parpadea con el fuego; más con la rejilla del suelo
    // encendida y mucho más mientras pasa un fogonazo)
    let k = (K.LUZ_DISLOCADO[c.estado] ?? 0) * (0.8 + 0.2 * Math.sin(this.t * 9) * Math.sin(this.t * 3.7));
    if (d.caos?.rejilla && idx(c.estado) >= idx(d.caos.rejilla)) k *= 1.35;
    if (c.fog !== null) {
      const fr = c.fog * FPS;
      k += 0.45 * (fr <= 19 ? Math.min(1, fr / 4) : Math.max(0, 1 - (fr - 19) / 8));
    }
    const gr = xb.createLinearGradient(0, H, 0, H * 0.3);          // (le llega de abajo: de la rejilla del suelo)
    gr.addColorStop(0, `rgba(255,120,35,${Math.min(0.75, k)})`);
    gr.addColorStop(1, `rgba(255,95,25,${Math.min(0.75, k) * 0.35})`);
    xb.fillStyle = gr;
    xb.fillRect(0, 0, W, H);
    xb.globalAlpha = 1;
    xb.globalCompositeOperation = 'destination-in';
    xb.drawImage(a, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(b, 0, 0, W, H);
    ctx.restore();
    return true;
  }

  /** Por delante de El Dislocado: un velo fino del mismo humo (no le tapa) y las interferencias por el calor. */
  drawDelante(ctx, v, effects) {
    if (!this.listo || this._hora() < 4) return;
    const c = this.c[v];
    const d = INDICE[v];
    if (!c || !d) return;
    if (d.humo && (K.HUMO[c.estado] ?? 0) > 0) {
      const f = im(`${v}/humo_${nn((Math.floor(this.t * FPS * 0.8) + 17) % d.humo)}`);
      if (f) {
        ctx.save();
        ctx.globalAlpha = K.HUMO_DELANTE * (K.HUMO[c.estado] ?? 0);
        ctx.drawImage(f, 0, 0, W, H);
        ctx.restore();
      }
    }
    if (c.interf > 0) {
      effects?.static?.(ctx, Math.min(0.75, 0.35 + c.interf * 0.35));
    }
  }

  /** (debug) Salta el caos de todos los conductos al estado de la hora h (sin eventos). */
  saltaA(h) {
    if (!INDICE) return;
    const e = this._clave(h);
    for (const v of VENT_IDS) {
      const c = this.c[v];
      c.estado = e;
      c.antes = null;
      c.ev = null;
      for (const [cual, [hv]] of Object.entries(INDICE[v]?.eventos || {})) if (idx(hv) <= idx(e)) c.hechos.add(cual);
    }
  }
}
