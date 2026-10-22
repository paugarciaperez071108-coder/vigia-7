// =============================================================
// N5Sounds.js — Sonidos de la NOCHE 5, sintetizados (v0.46).
//
//   errStatic(pan)   la estática distorsionada de El Errante (bucle, por
//                    su lado); errStaticStop(). errBlip(): un instante.
//   drag(dist, pan)  El Dislocado arrastrándose: golpes de las manos en el
//                    metal, roce húmedo de los intestinos y respiración
//                    entrecortada (más fuerte cuanto más cerca).
//   grilleHit(pan, big)  golpe metálico fuerte contra una rejilla.
//   grilleFall(pan)  la rejilla cae al suelo.
//   pipeBurst()      revienta la tubería de Criogenia.
//   hiss(on)         siseo del refrigerante (bucle).
//   alarm(on)        alarma de la fuga (bucle).
//   shiver()         respiración temblorosa del vigilante.
//   crackle(v)       crujido de la escarcha.
// Se apoya en la biblioteca de sonidos del juego (audio.lib) y en ruido y
// osciladores de Web Audio.
// =============================================================

export class N5Sounds {
  constructor(audio) {
    this.a = audio;
    this.noise = null;
  }

  get ctx() {
    return this.a.ctx;
  }

  _noiseBuf() {
    if (this.noise) return this.noise;
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2;
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = b;
    return b;
  }

  _play(key, opts) {
    return this.a.lib?.play(key, opts) ?? false;
  }

  // --- El Errante ---
  errStatic(pan = 0, volume = 0.5) {
    const ctx = this.ctx;
    if (!ctx) return;
    this.errStaticStop(0.02);
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf();
    src.loop = true;
    // Banda que barre arriba y abajo (radio mal sintonizada)
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 2.5;
    const sweep = ctx.createOscillator();
    sweep.frequency.value = 0.7;
    const sweepAmt = ctx.createGain();
    sweepAmt.gain.value = 1300;
    sweep.connect(sweepAmt).connect(bp.frequency);
    // Distorsión digital
    const sh = ctx.createWaveShaper();
    const c = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = i / 512 - 1;
      c[i] = Math.round(Math.tanh(x * 6) * 6) / 6;
    }
    sh.curve = c;
    // Cortes rápidos e irregulares (trémolo cuadrado)
    const gate = ctx.createGain();
    gate.gain.value = 0.6;
    const trem = ctx.createOscillator();
    trem.type = 'square';
    trem.frequency.value = 11;
    const tremAmt = ctx.createGain();
    tremAmt.gain.value = 0.4;
    trem.connect(tremAmt).connect(gate.gain);
    // Un zumbido grave debajo (su firma)
    const hum = ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = 52;
    const humG = ctx.createGain();
    humG.gain.value = 0.18;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, ctx.currentTime);
    out.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.35);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(bp).connect(sh).connect(gate).connect(out);
    hum.connect(humG).connect(out);
    out.connect(p).connect(this.a.master);
    [src, sweep, trem, hum].forEach((n) => n.start());
    this.errNodes = { nodes: [src, sweep, trem, hum], out, p };
  }

  errStaticStop(fade = 0.25) {
    const s = this.errNodes;
    if (!s || !this.ctx) return;
    this.errNodes = null;
    const t = this.ctx.currentTime;
    s.out.gain.cancelScheduledValues(t);
    s.out.gain.setValueAtTime(s.out.gain.value, t);
    s.out.gain.linearRampToValueAtTime(0, t + fade);
    s.nodes.forEach((n) => n.stop(t + fade + 0.05));
  }

  /** Un instante de su estática (por ejemplo, justo antes de la fuga). */
  errBlip(dur = 0.45, volume = 0.6) {
    if (!this.ctx) return;
    this.errStatic(0, volume);
    setTimeout(() => this.errStaticStop(0.05), dur * 1000);
  }

  // --- El Dislocado ---
  drag(dist = 2, pan = 0) {
    if (!this.ctx) return;
    const near = Math.max(0, 1 - dist / 4);
    const v = 0.12 + 0.55 * near;
    const muffle = 0.85 - 0.6 * near;
    // Dos o tres golpes de las palmas en el metal, a tirones
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      this._play('metal/golpe_pared', { volume: v * 0.7, pan, muffle, pitch: 1.5, pitchVar: 0.12, when: i * (0.18 + Math.random() * 0.2) });
    }
    // Roce húmedo de los intestinos (ruido grave que se arrastra)
    this._wet(v * 0.8, pan, muffle, 0.15);
    // Respiración entrecortada
    if (Math.random() < 0.7) this._play('criaturas/respiracion', { volume: v * 0.9, pan, muffle, pitch: 0.78, pitchVar: 0.05, when: 0.3 });
  }

  _wet(volume, pan, muffle, when = 0) {
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf();
    src.playbackRate.value = 0.5;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900 * (1 - 0.6 * muffle);
    lp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    // El chapoteo: el filtro sube y baja
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.linearRampToValueAtTime(1100 * (1 - 0.6 * muffle), t + 0.25);
    lp.frequency.linearRampToValueAtTime(250, t + 0.9);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(lp).connect(g).connect(p).connect(this.a.master);
    src.start(t, Math.random());
    src.stop(t + 1);
  }

  grilleHit(pan = 0, big = false) {
    if (!this.ctx) return;
    this._play('metal/golpe_pared', { volume: big ? 1 : 0.8, pan, pitch: 0.85, pitchVar: 0.1 });
    this._play('puertas/golpe', { volume: big ? 0.8 : 0.5, pan, pitch: 1.15, when: 0.02 });
    this._play('metal/panel', { volume: 0.35, pan, when: 0.08 });
    if (Math.random() < 0.5) this._play('criaturas/respiracion', { volume: 0.35, pan, pitch: 0.75, when: 0.35, muffle: 0.4 });
  }

  grilleFall(pan = 0) {
    if (!this.ctx) return;
    this._play('metal/panel', { volume: 0.9, pan, pitch: 0.8 });
    this._play('caidas/herramienta', { volume: 0.9, pan, when: 0.32 });
    this._play('caidas/bandeja', { volume: 0.8, pan, when: 0.5 });
  }

  // --- La fuga de Criogenia ---
  pipeBurst() {
    if (!this.ctx) return;
    this._play('metal/tuberia', { volume: 1, pitch: 0.7 });
    this._play('metal/golpe_pared', { volume: 0.9, pitch: 0.6, when: 0.05 });
    this._play('metal/cristal', { volume: 0.5, when: 0.15 });
    this.hiss(true, 0.0);
  }

  hiss(on, delay = 0) {
    this.a.setLoop?.('n5hiss', on, () => {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this._noiseBuf();
      src.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2500;
      const out = ctx.createGain();
      out.gain.setValueAtTime(0, ctx.currentTime + delay);
      out.gain.linearRampToValueAtTime(0.16, ctx.currentTime + delay + 0.25);
      src.connect(hp).connect(out).connect(this.a.master);
      src.start();
      return { nodes: [src], out };
    });
  }

  alarm(on) {
    this.a.setLoop?.('n5alarm', on, () => {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 620;
      const lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 1.6;
      const depth = ctx.createGain();
      depth.gain.value = 140;
      lfo.connect(depth).connect(osc.frequency);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1500;
      const out = ctx.createGain();
      out.gain.value = 0.045;
      osc.connect(lp).connect(out).connect(this.a.master);
      [osc, lfo].forEach((n) => n.start());
      return { nodes: [osc, lfo], out };
    });
  }

  shiver(volume = 0.25) {
    if (!this.ctx) return;
    this._play('criaturas/respiracion', { volume, pitch: 1.35, pitchVar: 0.08, muffle: 0.2 });
  }

  crackle(volume = 0.2) {
    if (!this.ctx) return;
    this._play('metal/cristal', { volume, pitch: 1.6, pitchVar: 0.2, muffle: 0.3, pan: Math.random() * 1.6 - 0.8 });
  }

  /** Un archivo de audio (megafonía, voces). Devuelve una promesa. */
  async playFile(url, volume = 1) {
    const ctx = this.ctx;
    if (!ctx) return false;
    try {
      const r = await fetch(url);
      if (!r.ok) return false;
      const buf = await ctx.decodeAudioData(await r.arrayBuffer());
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = volume;
      src.connect(g).connect(this.a.master);
      src.start();
      this.lastFile = src;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * La voz de la mujer desde el fondo del conducto. Primero la grabación
   * propia (<base>_mia.wav/.mp3/.ogg); si no, la provisional (<base>.ogg).
   */
  async playVoice(base, desmayo = false) {
    for (const ext of ['_mia.wav', '_mia.mp3', '_mia.ogg', '.ogg']) {
      // (la grabación propia es la misma para los dos casos: base sin _desmayo)
      const b = ext.startsWith('_mia') ? base.replace(/_desmayo$/, '') : base;
      if (await this.playFile(b + ext, desmayo ? 0.95 : 1)) {
        if (ext.startsWith('_mia') && desmayo) this.errBlip(0.3, 0.25);   // un roce de estática encima
        return true;
      }
    }
    return false;
  }

  stop() {
    this.errStaticStop(0.05);
    this.hiss(false);
    this.alarm(false);
  }
}
