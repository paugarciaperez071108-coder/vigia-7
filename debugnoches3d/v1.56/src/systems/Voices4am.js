// =============================================================
// Voices4am.js — VOCES DE LA TRIPULACIÓN desde las 4 AM (noche 4, ruta A).
// (Valores en NIGHT4.VOICES, src/night/night4.js.)
//
// Frases sueltas de hace una semana, agudas, con eco de conducto, desde
// muy lejos de la nave. Cada vez más frecuentes hasta el final de la
// noche; varias pueden solaparse y cada una se mueve entre izquierda y
// derecha mientras suena.
//
// Los audios los prepara tools/voces_4am.py (assets/audio/voces_4am/
// procesadas/indice.json): provisionales con texto a voz o grabaciones
// de personas (originales/<id>_mia.*). Cambiarlas no requiere tocar código.
//
// Norma de voces: no son ni el hombre de la cinta ni la mujer; son ecos de
// la tripulación (pueden sonar en el turno de cámaras).
// =============================================================

import { NIGHT4 } from '../night/night4.js';

const V = NIGHT4.VOICES;
const INDEX = 'assets/audio/voces_4am/procesadas/indice.json';
const rand = ([a, b]) => a + Math.random() * (b - a);

export class Voices4am {
  constructor(audio) {
    this.audio = audio;
    this.buffers = {};        // id → [AudioBuffer] (sus variantes)
    this.loading = null;
    this.reset();
  }

  reset() {
    this.active = false;
    this.k = 0;               // 0 = empieza (4 AM) … 1 = final de la noche
    this.nextIn = 0;
    this.playing = [];        // { src, gain, pan, end }
    this.recent = [];         // ids que han sonado hace poco (no repetir)
    this.log = [];
  }

  /** Carga la lista y los audios (una vez). */
  load() {
    if (this.loading || !this.audio.ctx) return this.loading;
    const ctx = this.audio.ctx;
    this.loading = fetch(INDEX).then((r) => r.json()).then((idx) => Promise.all(Object.entries(idx).map(async ([id, d]) => {
      const list = await Promise.all(d.archivos.map(async (f) => {
        try {
          return await ctx.decodeAudioData(await (await fetch(f)).arrayBuffer());
        } catch {
          return null;
        }
      }));
      this.buffers[id] = list.filter(Boolean);
    }))).catch(() => console.warn('Voices4am: no hay voces procesadas (python tools/voces_4am.py procesar)'));
    return this.loading;
  }

  start() {
    this.load();
    this.active = true;
    this.nextIn = rand(V.FIRST);
  }

  stop() {
    this.active = false;
    for (const p of this.playing) {
      try {
        p.gain.gain.setTargetAtTime(0, this.audio.ctx.currentTime, 0.2);
        p.src.stop(this.audio.ctx.currentTime + 0.8);
      } catch { /* ya parado */ }
    }
    this.playing = [];
  }

  /** dt; k = avance de 0 (4 AM) a 1 (6 AM): más frecuentes cuanto más tarde. */
  update(dt, k) {
    if (!this.active || !this.audio.ctx) return;
    this.k = k;
    const now = this.audio.ctx.currentTime;
    this.playing = this.playing.filter((p) => p.end > now);
    // Cada voz se mueve de un lado a otro mientras suena
    for (const p of this.playing) {
      const t = now - p.start;
      p.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, p.from + (p.to - p.from) * Math.min(1, t / p.dur) + Math.sin(t * p.wob) * 0.15)), now, 0.05);
    }
    this.nextIn -= dt;
    if (this.nextIn > 0) return;
    const every = V.EVERY_START.map((a, i) => a + (V.EVERY_END[i] - a) * k);
    this.nextIn = rand(every);
    // Solapamiento: más voces a la vez cuanto más tarde
    const max = Math.round(1 + (V.MAX_OVERLAP - 1) * k);
    if (this.playing.length >= max) return;
    this._playOne(k);
    if (Math.random() < V.BURST * k && this.playing.length < max) this._playOne(k, 0.3 + Math.random() * 0.8);
  }

  _playOne(k, delay = 0) {
    const ids = Object.keys(this.buffers).filter((id) => this.buffers[id].length && !this.recent.includes(id));
    if (!ids.length) {
      this.recent = [];
      return;
    }
    const id = ids[Math.floor(Math.random() * ids.length)];
    this.recent.push(id);
    if (this.recent.length > V.NO_REPEAT) this.recent.shift();
    const list = this.buffers[id];
    const buf = list[Math.floor(Math.random() * list.length)];
    const ctx = this.audio.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 1 + (Math.random() - 0.5) * 0.08;
    const gain = ctx.createGain();
    const vol = V.VOLUME * (0.55 + 0.45 * k) * (0.7 + Math.random() * 0.3);
    const t0 = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.08);
    const pan = ctx.createStereoPanner();
    const from = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.5);
    pan.pan.value = from;
    src.connect(gain).connect(pan).connect(this.audio.master);
    src.start(t0);
    const dur = buf.duration / src.playbackRate.value;
    this.playing.push({ src, gain, pan, start: t0, dur, end: t0 + dur, from, to: -from * Math.random(), wob: 1 + Math.random() * 2 });
    this.log.push({ id, t: +t0.toFixed(2) });
  }
}
