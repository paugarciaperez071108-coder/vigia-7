// =============================================================
// SoundLibrary.js — Biblioteca de efectos de sonido con variantes.
//
// Los sonidos están en assets/audio/sfx/<categoría>/<tipo>_<n>.ogg y
// la lista en assets/audio/sfx/biblioteca.json (los genera
// tools/generar_sonidos.py). Cada "tipo" (p. ej. 'caidas/lata') tiene
// varias variantes; al reproducirlo:
//   - se elige una al azar, nunca la misma que sonó la última vez;
//   - se varía un poco el tono (velocidad) y el volumen;
// así nunca suena dos veces exactamente igual.
//
// Posición: pan (-1 izquierda … 1 derecha), volume y muffle (0 = claro,
// 1 = muy apagado, para lo que suena lejos o tras una pared).
// =============================================================

import { CONFIG } from '../config.js';

export class SoundLibrary {
  constructor(ctx, output) {
    this.ctx = ctx;
    this.output = output;
    this.buffers = {};       // tipo → [AudioBuffer]
    this.last = {};          // tipo → índice de la última variante
    this.log = [];           // últimas reproducciones (depuración: window.game.audio.lib.log)
  }

  async load(base = 'assets/audio/sfx/biblioteca.json') {
    try {
      const index = await (await fetch(base)).json();
      await Promise.all(Object.entries(index).map(async ([key, files]) => {
        const list = await Promise.all(files.map(async (f) => {
          try {
            return await this.ctx.decodeAudioData(await (await fetch(f)).arrayBuffer());
          } catch {
            console.warn(`SoundLibrary: no se pudo cargar ${f}`);
            return null;
          }
        }));
        this.buffers[key] = list.filter(Boolean);
      }));
    } catch {
      console.warn('SoundLibrary: sin biblioteca de sonidos (se usan los sintetizados)');
    }
  }

  /** Cuánto suena cada tipo según la mezcla (CONFIG.MEZCLA): los enemigos, un poco por encima del resto. */
  _mezcla(key) {
    const M = CONFIG.MEZCLA;
    const cat = key.split('/')[0];
    return M.DE_ENEMIGOS.includes(cat) || M.DE_ENEMIGOS.includes(key) ? M.ENEMIGOS : M.EFECTOS;
  }

  has(key) {
    return (this.buffers[key]?.length ?? 0) > 0;
  }

  /**
   * Reproduce una variante de `key`. Devuelve false si no está cargada.
   * opts: volume, pan, muffle (0-1), when (s desde ahora),
   *       pitch (centro de la velocidad, 1 = normal),
   *       pitchVar (±, por defecto 0.07), volVar (±, por defecto 0.15),
   *       radio (true = se oye por el altavoz de una cámara),
   *       bus (nodo de salida; por defecto, el general).
   */
  play(key, opts = {}) {
    const list = this.buffers[key];
    if (!list?.length) return false;
    let i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === this.last[key]) i = (i + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length;
    this.last[key] = i;

    const { volume = 1, pan = 0, muffle = 0, when = 0, pitch = 1, pitchVar = 0.07, volVar = 0.15, radio = false, bus = this.output } = opts;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = list[i];
    src.playbackRate.value = pitch * (1 + (Math.random() * 2 - 1) * pitchVar);

    let node = src;
    if (muffle > 0 || radio) {
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = radio ? 3200 : 9000 * Math.pow(0.12, Math.min(1, muffle)); // 9 kHz → ~1 kHz
      node.connect(lp);
      node = lp;
    }
    if (radio) {
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 280;
      node.connect(hp);
      node = hp;
      // v0.79: el micrófono de una cámara barata se satura en los picos
      if (!this._satura) {
        const n = 1024;
        this._satura = new Float32Array(n);
        for (let k = 0; k < n; k++) {
          const x = (k / (n - 1)) * 2 - 1;
          this._satura[k] = Math.tanh(2.6 * x) / Math.tanh(2.6);
        }
      }
      const ws = this.ctx.createWaveShaper();
      ws.curve = this._satura;
      node.connect(ws);
      node = ws;
    }
    const g = this.ctx.createGain();
    g.gain.value = volume * this._mezcla(key) * (1 + (Math.random() * 2 - 1) * volVar);
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(g).connect(p).connect(bus);
    src.start(t);
    if (opts.corta) {
      // v0.79: se corta de golpe (el grito que se apaga a media voz, la señal que se va)
      g.gain.setValueAtTime(g.gain.value, t + opts.corta);
      g.gain.linearRampToValueAtTime(0, t + opts.corta + 0.02);
      src.stop(t + opts.corta + 0.05);
    }
    this.log.push({ key, variant: i + 1, t: +t.toFixed(2) });
    if (this.log.length > 200) this.log.shift();
    return true;
  }

  /** Varias pisadas seguidas (cada una, variante distinta). */
  steps(key, count, interval, opts = {}) {
    let ok = false;
    for (let k = 0; k < count; k++) {
      const jitter = interval * 0.12 * (Math.random() * 2 - 1);
      ok = this.play(key, { ...opts, when: (opts.when ?? 0) + k * interval + jitter }) || ok;
    }
    return ok;
  }
}
