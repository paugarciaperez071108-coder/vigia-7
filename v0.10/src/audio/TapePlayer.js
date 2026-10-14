// =============================================================
// TapePlayer.js — Cintas del "hombre de la cinta" (una por noche).
//
// - Empieza sola unos segundos después de llegar a la oficina
//   (CONFIG.TAPES[n].delay). No pausa el juego.
// - Suena por encima del resto: va directa a la salida (sin pasar
//   por el volumen general) y baja el ambiente mientras suena.
// - No tapa los avisos: cuando pasa algo importante (alarma de El
//   Congelado, El Espécimen sale o llega a una compuerta, apagón,
//   reactor crítico...) la cinta baja de volumen un momento.
// - Subtítulos opcionales desde un .json con tiempos por frase.
// - Si ya se escuchó entera (guardado), no suena sola: queda
//   disponible para ponerla con un botón. Al acabar entera emite
//   'tapeFinished' para que Game lo guarde.
//
// Qué archivo suena (en la carpeta de CONFIG.TAPES[n].base):
//   1) noche1_mia.ogg / .mp3 / .wav / .m4a  → grabación propia
//   2) noche1.ogg / .mp3                     → voz generada
// Los subtítulos se leen de noche1_mia.json o noche1.json (el que
// corresponda al audio elegido); si no existe, no hay subtítulos.
// =============================================================

import { CONFIG } from '../config.js';

const OWN_EXT = ['ogg', 'mp3', 'wav', 'm4a'];
const GEN_EXT = ['ogg', 'mp3'];

// Eventos que hacen bajar la cinta para que se oiga el aviso.
const DUCK_EVENTS = ['frozenEscape', 'specimenEmerged', 'wallCrack', 'enemyAtDoor', 'doorBlocked', 'blackout'];

export class TapePlayer {
  constructor(audio, events) {
    this.audio = audio;          // AudioEngine (contexto y ambiente)
    this.events = events;
    this.el = null;
    this.subtitles = [];
    this.pending = null;         // segundos hasta que empiece
    this.duckTimer = 0;
    this.subsOn = localStorage.getItem('vigia7.subtitulos') !== 'no';
    for (const name of DUCK_EVENTS) events.on(name, () => this.duck());
  }

  /**
   * Prepara la cinta de la noche `n` (si la hay). Con autoplay empieza
   * sola tras el retraso; sin él, solo queda disponible (playNow).
   */
  async schedule(n, { autoplay = true } = {}) {
    this.stop();
    this.night = n;
    this.available = false;
    const cfg = CONFIG.TAPES[n];
    if (!cfg) return;
    const token = (this.token = {});
    const found = await this._find(cfg.base);
    if (!found || token !== this.token) return; // no hay cinta o ya ha cambiado la noche
    this.src = found.audio;
    this.subtitles = await fetch(found.subs).then((r) => (r.ok ? r.json() : null)).then((d) => d?.subtitles ?? []).catch(() => []);
    this.available = true;
    if (autoplay) this.pending = cfg.delay;
  }

  /** Ponerla ahora (botón "escuchar cinta" cuando ya se había escuchado). */
  playNow() {
    if (!this.available || this.playing) return;
    this.pending = null;
    this._play();
  }

  /** Busca primero la grabación propia y si no, la generada. */
  async _find(base) {
    const exists = (url) => fetch(url, { method: 'HEAD' }).then((r) => r.ok).catch(() => false);
    for (const ext of OWN_EXT) {
      if (await exists(`${base}_mia.${ext}`)) return { audio: `${base}_mia.${ext}`, subs: `${base}_mia.json` };
    }
    for (const ext of GEN_EXT) {
      if (await exists(`${base}.${ext}`)) return { audio: `${base}.${ext}`, subs: `${base}.json` };
    }
    return null;
  }

  update(dt) {
    if (this.pending !== null) {
      this.pending -= dt;
      if (this.pending <= 0) {
        this.pending = null;
        this._play();
      }
    }
    if (!this.playing) return;
    // Volumen: baja mientras haya un aviso reciente o una alarma sonando
    this.duckTimer = Math.max(0, this.duckTimer - dt);
    const alarms = Object.keys(this.audio.loops).length > 0;
    const target = this.duckTimer > 0 || alarms ? CONFIG.TAPE_DUCK_VOLUME : CONFIG.TAPE_VOLUME;
    if (this.gain && target !== this.volume) this.gain.gain.setTargetAtTime(target, this.audio.ctx.currentTime, 0.08);
    this.volume = target;
  }

  _play() {
    const ctx = this.audio.ctx;
    if (!ctx) return;
    this.el = new Audio(this.src);
    // Por Web Audio para poder bajarla y subirla suavemente; va directa
    // a la salida, no al volumen general de los efectos.
    this.gain = ctx.createGain();
    this.gain.gain.value = CONFIG.TAPE_VOLUME;
    ctx.createMediaElementSource(this.el).connect(this.gain).connect(ctx.destination);
    this.el.addEventListener('ended', () => {
      this.events.emit('tapeFinished', { night: this.night });
      this.stop();
    });
    this.el.play().catch(() => this.stop());
    this.audio.setAmbienceLevel(CONFIG.TAPE_AMBIENCE_LEVEL);
  }

  duck() {
    this.duckTimer = CONFIG.TAPE_DUCK_TIME;
  }

  /** Para la cinta (botón SALTAR, muerte, fin de la noche...). */
  stop() {
    this.token = null; // cancela una búsqueda de cinta en curso
    this.pending = null;
    if (this.el) {
      this.el.pause();
      this.el = null;
      this.gain?.disconnect();
      this.gain = null;
      this.audio.setAmbienceLevel(1);
    }
  }

  toggleSubtitles() {
    this.subsOn = !this.subsOn;
    localStorage.setItem('vigia7.subtitulos', this.subsOn ? 'si' : 'no');
  }

  get playing() {
    return !!this.el;
  }

  get time() {
    return this.el?.currentTime ?? 0;
  }

  get duration() {
    return this.el && isFinite(this.el.duration) ? this.el.duration : 0;
  }

  /** Frase que toca mostrar ahora (o null). */
  get subtitle() {
    if (!this.playing || !this.subsOn) return null;
    const t = this.time;
    let current = null;
    for (const s of this.subtitles) {
      if (s.start <= t && t < s.end + 0.6) current = s.text; // se mantiene un poco tras acabar
    }
    return current;
  }
}
