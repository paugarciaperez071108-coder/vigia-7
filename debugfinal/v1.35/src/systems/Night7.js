// =============================================================
// Night7.js — LA NOCHE 7, la noche final (v0.82: el esqueleto, Fase 1).
// Valores en NIGHT7 (src/night/night7.js).
//
// Lo que hace ya:
//   - La cinta del hombre al empezar ('cinta'; guiones/guion_cinta_noche7.md,
//     assets/audio/cintas/noche7.ogg): reloj parado, enemigos
//     quietos, no se puede morir; se pueden mirar las cámaras. Al acabar,
//     un segundo de silencio total ('silencio') y empieza la noche
//     ('noche'). Solo en los reintentos se puede saltar (el SALTAR (M) de
//     siempre; flag n7cinta: ya la ha oído entera una vez); la primera vez,
//     no (tape.sinSaltar). Lo que dice se ve: con «la cosa del laboratorio»
//     el monitor se abre en la CAM 02 (la pared rota); con «el Errante» la
//     cámara que se mira parpadea.
//   - Las horas: emite 'n7hora' ({ hora, nombre }) al llegar a cada una
//     (las Fases 4 y 5 cuelgan de ahí la Aberración en el reactor, el
//     núcleo, el calor, la rotura y el silencio de las 5:59).
//   - El reactor: se calienta solo hasta NIGHT7.REACTOR.TOPE; a las 3:00, con
//     UMBRAL % o más salta al 100 % (evento 'n7nucleo'); si no, se pierde
//     («NÚCLEO ESTABILIZADO»). Nunca explota durante la noche.
//   - Slaimi: el estado único de la partida (SaveData.slaimiDe): 'vivo',
//     'muerto' en la noche 5 (su cuerpo congelado junto al pasillo, como en
//     la noche 6) o 'muerto' en la noche 4 (no aparece). Las Fases 5 y 6 lo usan.
//   - Los datos de la noche 6 (n6cadaveres, n6lenteRota, n6salas): cada sala
//     con un cadáver se ve en su cámara como quedó al final de la noche 6
//     (el último fotograma de su «después»: el cuerpo, la sangre, la lente
//     rota de la CAM 01). El Congelado está muerto: no se despierta.
//   - De vez en cuando suena sola una frase del hombre (un trozo de una cinta
//     anterior), con su subtítulo (v0.86: sin la grabadora del suelo).
//   - Slaimi vivo: en la oficina, asustado, temblando (Fase 6: se esconde y
//     ayuda una vez a las 5). Muerto en la noche 5: su cuerpo en el hielo
//     junto al pasillo central (el mismo dibujo que la noche 6).
// El final de las 6:00 lo llama Game (_n7Final) cuando el reloj acaba.
// =============================================================

import { CONFIG } from '../config.js';
import { NIGHT7 } from '../night/night7.js';
import { SaveData, slaimiDe } from '../core/SaveData.js';
import { fotograma, img } from '../ending/Night6Final.js';
import { drawSlaimi } from './Slaimi.js';
import { Aberracion7 } from './Aberracion7.js';
import { Night7Rotura } from './Night7Rotura.js';
import { Night7Cuerpo } from './Night7Cuerpo.js';
import { Night7Conductos } from './Night7Conductos.js';
import { Night7Muerte } from './Night7Muerte.js';
import { NIGHT5 } from '../night/night5.js';
import { BACK_HATCH } from '../render/BackView.js';

// Cómo acaba siempre la cinemática de las 6:00 de la noche 6 (Night6Final / Game._n6FinalDone)
const N6_FINAL = { cadaveres: { frozen: 'cryo', specimen: 'lab', insecto: 'greenhouse', largo: 'hangar' }, lenteRota: 'hangar' };
// El último fotograma del «después» de cada muerte de la noche 6 (assets/n6/cine/<id>_despues/)
const FOTO_DESPUES = 29;
// (v1.12, el usuario: «las salas de la noche 7, las mismas que en el resto de noches, con el daño encima»)
// El mismo «después» con la LUZ NORMAL de la sala (tools/3d/n6/cine/integrar_n7.py → assets/n7/fondos/);
// si aún no está, el de la cinemática
const FONDOS = {};
fetch('assets/n7/fondos/indice.json').then((r) => (r.ok ? r.json() : [])).then((lista) => {
  for (const id of lista ?? []) {
    const i = new Image();
    i.src = `assets/n7/fondos/${id}.webp`;
    FONDOS[id] = i;
  }
}).catch(() => {});
const fondoN7 = (id) => (FONDOS[id]?.complete && FONDOS[id].naturalWidth ? FONDOS[id] : null);
// Slaimi vivo: en el suelo de la oficina, delante, asustado
const SLAIMI = { x: 1230, y: 836, size: 150 };
// Las frases del hombre (trozos de cintas anteriores) que suenan solas
const G = NIGHT7.GRABADORA;
const GRAB = { frags: [] };
fetch('assets/audio/cintas/grabadora/fragmentos.json').then((r) => (r.ok ? r.json() : [])).then((j) => { GRAB.frags = j ?? []; }).catch(() => {});

const C = NIGHT7.CINTA;
const SL = NIGHT7.SLAIMI;
// Los sonidos de la Aberración: los suyos (tools/sonidos_aberracion.py → assets/audio/sfx/aberracion/)
// o, si faltan, otros de la biblioteca parecidos
const SON_AB = {
  dedos: ['aberracion/dedos', 'criaturas/aranazos', 1.0],
  respiraciones: ['aberracion/respiraciones', 'n6/dislocado_respira', 0.8],
  metal: ['aberracion/metal', 'metal/tuberia', 0.6],
  voz_vale: ['aberracion/voz_vale', null, 1],
  voz_abre: ['aberracion/voz_abre', null, 1],
  arrastre: ['aberracion/arrastre', 'n6/arrastre', 0.6],
  retrocede: ['aberracion/retrocede', 'criaturas/grunido', 0.55],
  huye: ['aberracion/huye', 'largo/grunido', 0.5],
  golpe_reactor: ['aberracion/golpe_reactor', 'metal/golpe_pared', 0.7],
};
const M = NIGHT7.MUSICA;
const R = NIGHT7.REACTOR;
const NOMBRE_HORA = { 1: '1:00', 2: 'aberracion_reactor', 3: 'nucleo', 4: 'calor', 5: 'rotura', 6: 'final' };

export class Night7 {
  constructor(game) {
    this.g = game;
    this.active = false;
    this.musica = null;          // { el, gain }
    this.ab = new Aberracion7(this);
    this.rotura = new Night7Rotura(this);
    this.cuerpo = new Night7Cuerpo(this);
    this.conductos = new Night7Conductos(this);   // (v1.19)
    this.muerteDis = new Night7Muerte(this);      // (v1.24: la muerte de El Dislocado y la furia de la Aberración)
    this.bajada = 0;
    for (const ev of M.AVISOS) game.events.on(ev, () => { this.bajada = M.BAJADA_S; });
    // (con la pestaña oculta el juego se para: la música también; al volver se resincroniza)
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.musica?.el.pause(); });
    game.events.on('hour', (h) => this._hora(h));
    game.events.on('tapeFinished', ({ night }) => {
      if (this.active && night === 7 && this.fase === 'cinta') this._finCinta();
    });
  }

  /** opts: { saltarCinta, sinEnemigos } (el modo debug usa los dos). */
  reset(active, opts = {}) {
    this.active = active;
    this.t = 0;
    this.fase = 'noche';
    this.nucleo = false;         // el reactor ya está al 100 % (desde las 3:00)
    this.perdido = false;
    this.sinEnemigos = !!opts.sinEnemigos;
    this.ab.reset(active);
    this.rotura.reset(active);
    this.conductos.reset(active);
    this.muerteDis.reset(active);
    this.cuerpo.reset();
    // Slaimi (F6): escondido bajo la mesa (s que le quedan), la ayuda de las 5 (una vez) y su huida
    this.sustoSlaimi = 0;
    this.slaimiEsconde = 0;
    this.slaimiAyuda = null;     // { lado, t } mientras corre a la puerta y vuelve
    this.slaimiAyudo = false;
    if (!active) return;
    const flags = this.g.save?.flags ?? {};
    this.slaimi = slaimiDe(flags);
    this.n6 = {
      // (v0.87, el usuario: «la noche 7 siempre así»: la cinemática de la noche 6 acaba siempre
      // igual, así que si a la partida le faltan estos datos —las guardadas antes de la v0.82
      // los perdían al cargarse— se usan los de esa cinemática)
      cadaveres: flags.n6cadaveres ?? N6_FINAL.cadaveres,   // { frozen, specimen, insecto, largo } → su sala
      lenteRota: flags.n6lenteRota ?? N6_FINAL.lenteRota,   // 'hangar' (CAM 01)
      salas: flags.n6salas ?? null,
    };
    this.puedeSaltar = !!flags.n7cinta;          // ya la oyó entera: en el reintento, «SALTAR CINTA»
    // (los fondos de las salas con cadáver, cargándose ya)
    for (const id of Object.keys(this.n6.cadaveres ?? {})) fotograma(`${id}_despues`, FOTO_DESPUES);
    img('lab_roto_vacio');
    this.vistoLab = this.vistoErrante = false;
    this.pararGrabadora();
    this.fragN = 0;
    this.fragIn = G.PRIMERA;
    const r = this.g.reactor;
    r.level = R.START;
    r.n7 = { rate: R.RATE, tope: R.TOPE };
    if (opts.saltarCinta) {
      this.fase = 'noche';
      this._empiezaNoche();
    } else {
      this.fase = 'cinta';
      this.cintaEspera = 0;
      this.cintaVista = false;
      this.g.tape.sinSaltar = !this.puedeSaltar;
    }
  }

  /** El fondo de la cámara de una sala con un cadáver de la noche 6 (o null). */
  fondoSala(room) {
    const cad = this.n6?.cadaveres;
    if (!cad) return null;
    // (el Laboratorio, con la pared que reventó la Aberración: tools/3d/n6/cine/aberracion_cine.py --vacio)
    if (room === 'lab') return fondoN7('lab') ?? img('lab_roto_vacio') ?? null;
    const id = Object.keys(cad).find((k) => cad[k] === room);
    return id ? fondoN7(id) ?? fotograma(`${id}_despues`, FOTO_DESPUES) : null;
  }

  /** Slaimi en la oficina: vivo (delante, temblando) o su cuerpo congelado (atrás); la Aberración en una puerta. */
  drawOffice(ctx, face) {
    if (!this.active) return;
    if (face === 'left' || face === 'right') this.ab.drawPuerta(ctx, face);
    this.rotura.drawOffice(ctx, face);
    if (face === 'front' && this.slaimiVivo) this._drawSlaimi(ctx);
    if (face === 'back' && this.slaimiCuerpo) {
      // (el mismo bloque de hielo que en la noche 6: Night6._slaimiHielo)
      const n6 = this.g.n6;
      n6.time = this.t;
      n6._slaimiHielo(ctx);
      // (F6) desde las 4:00, el fuego se refleja en el hielo: el naranja que baila
      const h = this.g.clock.elapsed / this.g.clock.sph;
      if (this.fase === 'noche' && h >= NIGHT7.HORAS.CALOR) {
        const k = Math.min(1, (h - NIGHT7.HORAS.CALOR) / 1.2) * (0.6 + 0.4 * Math.sin(this.t * 9) * Math.sin(this.t * 5.3 + 1));
        const { x, y, size } = SL.HIELO;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x - size * 0.35, y - size * 0.4, 6, x, y - size * 0.5, size * 0.95);
        g.addColorStop(0, `rgba(255,140,40,${0.85 * k})`);
        g.addColorStop(0.6, `rgba(255,90,20,${0.3 * k})`);
        g.addColorStop(1, 'rgba(255,80,20,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - size * 1.2, y - size * 1.5, size * 2.4, size * 1.6);
        ctx.restore();
      }
    }
  }

  /** (F6) Slaimi vivo: tiembla; con la Aberración en una puerta o con una explosión grande, se esconde
   * bajo la mesa; a las 5, una vez, corre a la puerta y la distrae. */
  _drawSlaimi(ctx) {
    const a = this.slaimiAyuda;
    let x = SLAIMI.x;
    let y = SLAIMI.y;
    if (a) {
      // (corre hacia la puerta, desaparece y vuelve)
      const ida = Math.min(1, a.t / 0.6);
      const vuelta = Math.max(0, (a.t - SL.AYUDA_FUERA) / 0.8);
      const k = a.t < SL.AYUDA_FUERA ? ida : 1 - Math.min(1, vuelta);
      x = SLAIMI.x + ((a.lado === 'left' ? -200 : 1800) - SLAIMI.x) * k;
      y = SLAIMI.y - Math.abs(Math.sin(a.t * 14)) * 30 * (k > 0 && k < 1 ? 1 : 0);
    }
    const hk = Math.min(1, this.slaimiEsconde / 0.4);
    y += SL.ESCONDE_BAJA * hk;
    const miedo = Math.min(1, 0.5 + 0.5 * Math.max(0, Math.sin(this.t * 0.7)) + this.cuerpo.miedo * 0.5 + (this.sustoSlaimi > 0 ? 0.6 : 0));
    const temblor = Math.abs(Math.sin(this.t * 31)) * 0.18 * miedo;
    const dx = Math.sin(this.t * 47) * 2.5 * miedo;
    drawSlaimi(ctx, x + dx, y, SLAIMI.size * (1 - 0.12 * hk), { t: this.t, sad: true, squash: temblor, sprites: this.g.sprites });
  }

  /** (F6) Slaimi, cada fotograma: se esconde, sale, y la ayuda de las 5. */
  _slaimi(dt) {
    if (!this.slaimiVivo) return;
    const ab = this.ab;
    this.sustoSlaimi = Math.max(0, this.sustoSlaimi - dt);
    const peligro = ab.sala === 'puerta' || ab.sala === 'lado' || this.sustoSlaimi > 0;
    this.slaimiEsconde = peligro ? Math.min(SL.ESCONDE, this.slaimiEsconde + dt * 4) : Math.max(0, this.slaimiEsconde - dt * 0.5);
    const h = this.g.clock.elapsed / this.g.clock.sph;
    if (this.slaimiAyuda) {
      this.slaimiAyuda.t += dt;
      if (this.slaimiAyuda.t >= SL.AYUDA_FUERA + 0.8) this.slaimiAyuda = null;
    } else if (!this.slaimiAyudo && h >= NIGHT7.HORAS.ROTURA && h < NIGHT7.HORAS.SILENCIO &&
               (ab.sala === 'lado' || ab.sala === 'puerta') && ab.t < SL.AYUDA_ANTES) {
      // Justo antes de que entre: Slaimi corre hacia ella y la distrae (se la lleva lejos)
      this.slaimiAyudo = true;
      const lado = ab.sala === 'lado' ? ab.lado : 'right';
      this.slaimiAyuda = { lado, t: 0 };
      this.slaimiEsconde = 0;
      const lib = this.g.audio.lib;
      lib?.play('slaimi/gemido', { volume: 0.9, pan: lado === 'left' ? -0.7 : 0.7 });
      setTimeout(() => this.active && lib?.play('n6/slaimi_aviso', { volume: 0.8, pan: lado === 'left' ? -0.9 : 0.9 }), 500);
      ab._huye();
      this.g.alerta?.('Slaimi ha salido de la oficina', 'warn');
    }
  }

  // --- La grabadora --------------------------------------------------------------
  pararGrabadora() {
    this.fragSonando?.pause();
    this.fragSonando = null;
    this.fragTexto = null;
  }

  // --- La música (el remix de «Flamewall»: NIGHT7.MUSICA) -------------------------------
  _musica() {
    this.pararMusica();
    const ctx = this.g.audio.ctx;
    if (!ctx) return;
    this.musicaToken = {};
    // (sin preguntar antes si existe: esa petición se quedaba esperando mientras sonaba la cinta)
    const el = new Audio(`${M.ARCHIVO}.ogg`);
    el.addEventListener('error', () => {
      if (!el.src.endsWith('.mp3')) el.src = `${M.ARCHIVO}.mp3`;
    }, { once: true });
    el.preload = 'auto';
    const gain = ctx.createGain();
    gain.gain.value = M.VOLUMEN;
    ctx.createMediaElementSource(el).connect(gain).connect(ctx.destination);
    this.musica = { el, gain };
    el.currentTime = this.g.clock.elapsed;
    el.play().catch(() => {});
  }

  pararMusica() {
    this.rotura?.parar();          // (la alarma y el fuego, también)
    this.musicaToken = null;
    if (!this.musica) return;
    this.musica.el.pause();
    this.musica.gain.disconnect();
    this.musica = null;
  }

  /** Cada fotograma: la música con el reloj de la noche y por debajo de los avisos. */
  _sigueMusica(dt) {
    const m = this.musica;
    if (!m) return;
    const g = this.g;
    const t = g.clock.elapsed;
    const parada = g.speed === 0 || g.state !== 'night' || document.hidden;
    if (parada) {
      if (!m.el.paused) m.el.pause();
      return;
    }
    if (m.el.paused && t < CONFIG.NIGHT_HOURS * g.clock.sph) m.el.play().catch(() => {});
    m.el.playbackRate = Math.min(4, Math.max(0.25, g.speed || 1));
    if (Math.abs(m.el.currentTime - t) > M.DESFASE && !m.el.seeking) m.el.currentTime = t;
    this.bajada = Math.max(0, this.bajada - dt);
    const objetivo = (this.bajada > 0 ? M.BAJADA : 1) * M.VOLUMEN;
    m.gain.gain.setTargetAtTime(objetivo, g.audio.ctx.currentTime, this.bajada > 0 ? 0.06 : 0.5);
  }

  // --- Los enemigos de la noche 7 (Fase 4) ----------------------------------------------
  /** ¿La linterna del pasillo central alumbra dentro de la compuerta? */
  get linterna() {
    const g = this.g;
    const m = g.mouse;
    const r = BACK_HATCH;
    return !!(g.lookBack.facingBack && g.backFlash.on && !g.backFlash.blinkOff && m
      && m.x >= r.x - 60 && m.x <= r.x + r.w + 60 && m.y >= r.y - 40 && m.y <= r.y + r.h + 80);
  }

  _enemigos(dt) {
    const g = this.g;
    if (!g.n4dbg?.off?.has('aberracion')) this.ab.update(dt, this.linterna);
    // La Aberración en el reactor: lo enfría
    if (this.ab.enElNucleo && !this.nucleo) g.reactor.level = Math.max(0, g.reactor.level - NIGHT7.ABERRACION.DRAIN * dt);
    // El Errante: la imagen de su cámara se distorsiona antes de apagarlas (aviso)
    const e = g.ai.errante;
    if (e && g.cameras.open) {
      const p = e.state === 'cam' ? 1 - Math.max(0, e.t) / NIGHT5.ERRANTE.CAM_GRACE
        : e.state === 'idle' ? (e.stare ?? 0) / (e.stareTime ?? NIGHT5.ERRANTE.STARE_TIME) : 0;
      const sala = e.state === 'cam' ? e.camRoom : e.room;
      if (p > NIGHT7.ERRANTE_AVISO.DESDE && Math.random() < dt * (2 + 9 * p)) {
        g.cameras.glitchIfWatching([sala], 0.06 + 0.3 * p);
        if (g.cameraView?.poses) g.cameraView.poses.glitch = Math.max(g.cameraView.poses.glitch, 0.1 + 0.3 * p);
      }
    }
  }

  /** Un sonido de la Aberración (desde atrás: el pasillo central). */
  sonido(nombre, opts = {}) {
    const lib = this.g.audio.lib;
    const d = SON_AB[nombre];
    if (!lib || !d) return;
    const o = { volume: 0.8, pan: 0, ...opts };
    o.volume *= NIGHT7.ENEMIGOS_VOL;   // (v1.17)
    if (lib.play(d[0], o)) return;
    if (d[1]) lib.play(d[1], { ...o, pitch: d[2] });
  }

  drawCorridor(ctx) {
    if (this.active) this.ab.drawCorridor(ctx);
  }

  drawRoom(ctx, room) {
    if (!this.active) return;
    this.ab.drawRoom(ctx, room);
    this.rotura.drawRoom(ctx, room);
  }

  drawMapa(ctx) {
    if (this.active) this.rotura.drawMapa(ctx);
  }

  /** El fuego de detrás de los enemigos (CameraView lo pinta antes que ellos). */
  drawFondo(ctx, room) {
    if (this.active) this.rotura.drawFondo(ctx, room);
  }

  camQuemada(room) {
    return this.active && this.rotura.camQuemada(room);
  }

  drawQuemada(ctx) {
    this.rotura.drawQuemada(ctx);
  }

  /** Con una explosión grande, Slaimi (si está vivo) tiembla y se encoge. */
  slaimiSusto() {
    this.sustoSlaimi = 1.6;
  }

  /** Una alerta de la terminal (Game.alerta): la música baja un momento. */
  aviso() {
    if (this.musica) this.bajada = M.BAJADA_S;
  }

  /** Una frase del hombre, sola (nunca encima de la cinta ni de otra frase). */
  _frase() {
    if (!GRAB.frags.length || this.fragSonando || this.g.tape.playing) return;
    const f = GRAB.frags[this.fragN % GRAB.frags.length];
    this.fragN++;
    const a = new Audio(f.audio);
    a.volume = G.VOLUMEN;
    a.addEventListener('ended', () => {
      if (this.fragSonando === a) {
        this.fragSonando = null;
        this.fragTexto = null;
      }
    });
    a.play().catch(() => { this.fragSonando = null; });
    this.fragSonando = a;
    this.fragTexto = f;
  }

  /** El anillo de la linterna sobre la Aberración y el subtítulo de las frases del hombre. */
  drawHud(ctx) {
    if (this.active && this.g.lookBack.facingBack && !this.g.cameras.open && this.g.mouse) this.ab.drawAnillo(ctx, this.g.mouse.x, this.g.mouse.y);
    if (this.active && this.fase === 'noche') this.cuerpo.draw(ctx);
    this._drawFrase(ctx);
    if (this.active) this.rotura.drawHud(ctx);
  }

  _drawFrase(ctx) {
    if (!this.active || !this.fragSonando || !this.fragTexto || !this.g.tape.subsOn) return;
    if (this.fragSonando.currentTime < this.fragTexto.voz_en - 0.05) return;
    ctx.save();
    ctx.font = '24px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const txt = this.fragTexto.texto;
    const w = ctx.measureText(txt).width + 40;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(CONFIG.WIDTH / 2 - w / 2, 770, w, 44);
    ctx.fillStyle = '#f2dcae';
    ctx.fillText(txt, CONFIG.WIDTH / 2, 792);
    ctx.restore();
  }

  /** Mientras dura la cinta (y el segundo de silencio) la noche no corre. */
  get parada() {
    return this.active && (this.fase === 'cinta' || this.fase === 'silencio');
  }

  /** Los enemigos no se mueven: durante la cinta y en el modo «cinta sin enemigos». */
  get enemigosQuietos() {
    return this.parada || this.sinEnemigos;
  }

  get slaimiVivo() {
    return this.slaimi?.estado === 'vivo';
  }

  /** El cuerpo congelado junto al pasillo (solo si murió en la noche 5). */
  get slaimiCuerpo() {
    return this.slaimi?.estado === 'muerto' && this.slaimi.donde === 'n5';
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    this._sigueMusica(dt);
    const tape = this.g.tape;
    if (this.fase === 'cinta') {
      // (sin archivo de cinta todavía: la noche empieza en cuanto se sabe que no hay)
      this.cintaEspera += dt;
      if (tape.playing) {
        this.cintaVista = true;
        this._cintaEnLaNave(tape.subtitle ?? '');
      }
      else if (this.cintaVista) this._finCinta();                 // (la ha saltado)
      else if (!tape.available && tape.pending === null && this.cintaEspera > C.ESPERA_MAX) this._finCinta();
    } else if (this.fase === 'silencio') {
      this.silencioT -= dt;
      if (this.silencioT <= 0) this._empiezaNoche();
    } else if (this.fase === 'noche' && this.arranque) {
      // (el primer momento de la noche: que vengan ya, sin esperar como al empezar una noche normal)
      const er = this.g.ai.errante;
      const di = this.g.ai.dislocado;
      if (er?.room) {
        this.arranque = false;
        if (er.stepIn != null) er.stepIn = Math.min(er.stepIn, NIGHT7.INICIO.ERRANTE);
        if (di?.state === 'away') di.returnIn = Math.min(di.returnIn ?? 1e9, NIGHT7.INICIO.DISLOCADO);
      }
    }
    if (this.fase === 'noche' && !this.enemigosQuietos) this._enemigos(dt);
    if (this.fase === 'noche') {
      this.cuerpo.update(dt);
      this._slaimi(dt);
    }
    if (this.fase === 'noche') {
      this.rotura.update(dt);
      this.conductos.update(dt);
      this.muerteDis.update(dt);
      // (las puertas atascadas, Night7Rotura._puerta)
      const at = this.g.office.atascada;
      if (at) for (const k of Object.keys(at)) at[k] = Math.max(0, at[k] - dt);
    }
    if (this.fase === 'noche' && !tape.playing && !this.fragSonando && !this.arranque) {
      this.fragIn -= dt;
      if (this.fragIn <= 0) {
        this._frase();
        this.fragIn = G.CADA[0] + Math.random() * (G.CADA[1] - G.CADA[0]);
      }
    }
  }

  /** Mientras habla, lo que dice se ve en la nave. */
  _cintaEnLaNave(frase) {
    const cams = this.g.cameras;
    if (!this.vistoLab && frase.includes(C.LAB)) {
      // «La cosa del laboratorio»: el monitor se abre solo en la CAM 02 (la pared rota)
      this.vistoLab = true;
      if (!cams.open) cams.toggle();
      cams.select('lab');
      cams.glitchIfWatching(['lab'], 0.35);
    }
    if (!this.vistoErrante && frase.includes(C.ERRANTE)) {
      // «Y el Errante…»: la cámara que se mira parpadea
      this.vistoErrante = true;
      cams.glitchIfWatching([cams.active], C.PARPADEO);
      this.g.audio.lib?.play('ambiente/interferencia', { volume: 0.4 });
    }
  }

  _finCinta() {
    // Ya la ha oído: en los reintentos se puede saltar (también en el modo debug, que guarda
    // en su memoria aparte; en el panel de novedades, no: escribiría la partida real)
    this.g.save = { ...this.g.save, flags: { ...(this.g.save?.flags ?? {}), n7cinta: true } };
    if ((this.g.saveEnabled !== false && !this.g.debugNight) || this.g.n4dbg) SaveData.save(this.g.save);
    this.g.tape.sinSaltar = false;
    this.g.tape.stop();
    this.fase = 'silencio';
    this.silencioT = C.SILENCIO;
    this.g.audio.setMasterLevel?.(0, 0.05);       // silencio total
  }

  _empiezaNoche() {
    this.fase = 'noche';
    this._musica();
    this.arranque = !this.sinEnemigos;
    this.g.audio.setMasterLevel?.(1, 0.2);
    this.g.events.emit('n7empieza', {});
  }

  // --- Las horas ---------------------------------------------------------------
  _hora(h) {
    if (!this.active || this.g.nightNumber !== 7) return;
    const nombre = NOMBRE_HORA[h] ?? String(h);
    if (h === R.HORA_100) this._decideNucleo();
    this.g.events.emit('n7hora', { hora: h, nombre });
  }

  _decideNucleo() {
    const r = this.g.reactor;
    if (r.level >= R.UMBRAL) {
      this.nucleo = true;
      r.level = 100;
      r.n7 = { rate: 0, tope: 100 };
      this.g.alerta?.('⚠⚠ NÚCLEO AL 100 % – EVACUACIÓN INMEDIATA', 'danger');
      this.g.events.emit('n7nucleo', {});
    } else {
      this.perdido = true;
      this.g._n7Perder?.('nucleo');
    }
  }

  /** Lo que se le pasa al final de las 6:00 (y lo que verá el final del usuario). */
  estado() {
    return { slaimi: this.slaimi, n6: this.n6, nucleo: this.nucleo, reactor: this.g.reactor.level };
  }
}
