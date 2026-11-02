// =============================================================
// MenuMusic.js — La música del menú (v0.77): «Clair de lune» (arreglo propio,
// assets/audio/menu_clair_de_lune.ogg; ver assets/audio/LICENCIAS.md y
// tools/musica/clair_de_lune.py) sonando por la radio vieja de la nave.
//
//   - En bucle perfecto (AudioBufferSourceNode con loop: el archivo ya empalma
//     el final con el principio).
//   - Fundido de entrada de 2,5 s al abrir el menú y de salida al empezar
//     a jugar (New game / Continue).
//   - Silenciable (tecla M o el botón del menú); se recuerda en localStorage.
//   - Interferencias con Web Audio, sin archivos nuevos (sutiles):
//       · al pasar el ratón por «Continue – Noche 6» o «Noche 7», la radio se
//         ralentiza y desafina un instante, con un poco de estática;
//       · cuanto más avanzada está la partida, más fallos de la radio.
// =============================================================

const CLAVE = 'vigia7.musicaMenu';      // 'off' = silenciada
const VOLUMEN = 0.3;                    // (el archivo ya está a −22 dBFS de media; v1.22: 0,55 → 0,3)
const FUNDIDO_ENTRADA = 2.5;
const FUNDIDO_SALIDA = 1.4;

export class MenuMusic {
  constructor(engine) {
    this.engine = engine;
    this.buffer = null;
    this.cargando = null;
    this.src = null;
    this.sonando = false;
    this.noche = 1;
    this.fallosIn = 0;
    this.interfT = 0;
    try {
      this.muted = localStorage.getItem(CLAVE) === 'off';
    } catch {
      this.muted = false;
    }
    // (se descarga ya, antes del primer clic: así suena en cuanto se pulsa)
    this.datos = (async () => {
      for (const ext of ['ogg', 'mp3']) {
        try {
          const res = await fetch(`assets/audio/menu_clair_de_lune.${ext}`);
          if (!res.ok) continue;
          const data = await res.arrayBuffer();
          // Se decodifica ya (decodificar 2:26 de ogg tarda ~4 s): un contexto
          // «offline» no necesita el clic del jugador y el AudioBuffer sirve después
          try {
            const off = new OfflineAudioContext(2, 44100, 44100);
            return { ext, buffer: await off.decodeAudioData(data.slice(0)), data };
          } catch {
            if (ext === 'ogg') continue;     // (Safari: el mp3)
            return { ext, data };
          }
        } catch {
          // (sin red: se intenta el siguiente)
        }
      }
      return null;
    })();
  }

  get ctx() {
    return this.engine.ctx;
  }

  _cargar() {
    if (this.cargando) return this.cargando;
    this.cargando = (async () => {
      const d = await this.datos;
      if (d?.buffer) return (this.buffer = d.buffer);
      try {
        if (d) return (this.buffer = await this.ctx.decodeAudioData(d.data));
      } catch {
        // (Safari no decodifica ogg: el mp3)
      }
      try {
        const res = await fetch('assets/audio/menu_clair_de_lune.mp3');
        if (res.ok) return (this.buffer = await this.ctx.decodeAudioData(await res.arrayBuffer()));
      } catch {
        // (nada)
      }
      console.warn('MenuMusic: no se pudo cargar la música del menú');
      return null;
    })();
    return this.cargando;
  }

  /** Empieza (con fundido). noche = la de la partida guardada (más fallos cuanto más alta). */
  async start(noche = 1) {
    this.noche = noche;
    if (!this.ctx || this.sonando) return;
    this.sonando = true;
    const buf = await this._cargar();
    if (!buf || !this.sonando) return;
    const c = this.ctx;
    // Cadena: fuente → ralentí/desafine (playbackRate) → fallos → fundido → silencio → master
    this.src = c.createBufferSource();
    this.src.buffer = buf;
    this.src.loop = true;
    this.fallo = c.createGain();
    this.fundido = c.createGain();
    this.mute = c.createGain();
    this.mute.gain.value = this.muted ? 0 : 1;
    this.src.connect(this.fallo).connect(this.fundido).connect(this.mute).connect(this.engine.master);
    const t = c.currentTime;
    this.fundido.gain.setValueAtTime(0, t);
    this.fundido.gain.linearRampToValueAtTime(VOLUMEN, t + FUNDIDO_ENTRADA);
    this.src.start(t);
    this.fallosIn = this._proxFallo();
  }

  /** Se apaga con un fundido (al empezar a jugar). */
  stop(fundido = FUNDIDO_SALIDA) {
    if (!this.sonando) return;
    this.sonando = false;
    const src = this.src;
    this.src = null;
    if (!src || !this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this.fundido.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + fundido);
    try {
      src.stop(t + fundido + 0.05);
    } catch {
      // (ya parada)
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem(CLAVE, this.muted ? 'off' : 'on');
    } catch {
      // (sin almacenamiento: dura hasta cerrar)
    }
    if (this.mute && this.ctx) {
      const t = this.ctx.currentTime;
      this.mute.gain.cancelScheduledValues(t);
      this.mute.gain.setValueAtTime(this.mute.gain.value, t);
      this.mute.gain.linearRampToValueAtTime(this.muted ? 0 : 1, t + 0.4);
    }
    return this.muted;
  }

  /** Segundos hasta el siguiente fallo: noche 1 casi nunca … noche 7, cada poco. */
  _proxFallo() {
    const n = Math.max(1, Math.min(7, this.noche));
    const media = [0, 75, 60, 48, 38, 30, 22, 16][n];
    return media * (0.6 + Math.random() * 0.8);
  }

  update(dt) {
    if (!this.sonando || !this.src) return;
    this.interfT = Math.max(0, this.interfT - dt);
    this.fallosIn -= dt;
    if (this.fallosIn <= 0) {
      this.fallosIn = this._proxFallo();
      this._fallo(0.35 + Math.min(0.4, this.noche * 0.05));
    }
  }

  /** Un fallo de la radio: la señal baja, la afinación tiembla y un chasquido de estática. */
  _fallo(k) {
    const c = this.ctx;
    if (!c || !this.src || this.muted) return;
    const t = c.currentTime;
    const g = this.fallo.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(1, t);
    g.linearRampToValueAtTime(1 - 0.6 * k, t + 0.08);
    g.setValueAtTime(1 - 0.6 * k, t + 0.25 + 0.4 * k);
    g.linearRampToValueAtTime(1, t + 0.5 + 0.5 * k);
    const r = this.src.playbackRate;
    r.cancelScheduledValues(t);
    r.setValueAtTime(1, t);
    r.linearRampToValueAtTime(1 - 0.025 * k, t + 0.12);
    r.linearRampToValueAtTime(1, t + 0.45);
    this._estatica(0.05 + 0.08 * k, 0.15 + 0.5 * k);
  }

  /** Al pasar el ratón por «Continue – Noche 6/7»: se ralentiza y desafina un instante. */
  interferir() {
    const c = this.ctx;
    if (!c || !this.src || this.interfT > 0 || this.muted) return;
    this.interfT = 2.5;                   // (no más de una cada 2,5 s)
    const t = c.currentTime;
    const r = this.src.playbackRate;
    r.cancelScheduledValues(t);
    r.setValueAtTime(r.value, t);
    r.linearRampToValueAtTime(0.9, t + 0.35);        // (más lenta y más grave: ~−1,8 semitonos)
    r.linearRampToValueAtTime(0.96, t + 0.7);
    r.linearRampToValueAtTime(1, t + 1.3);
    const g = this.fallo.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0.7, t + 0.3);
    g.linearRampToValueAtTime(1, t + 1.3);
    this._estatica(0.09, 0.9);
  }

  /** Un poco de estática (ruido filtrado como el de una radio). */
  _estatica(vol, dur) {
    const c = this.ctx;
    const n = Math.floor(c.sampleRate * dur);
    const b = c.createBuffer(1, n, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const env = Math.sin((Math.PI * i) / n) ** 0.5;
      d[i] = (Math.random() * 2 - 1) * env * (0.6 + 0.4 * Math.abs(Math.sin(i / 900)));
    }
    const s = c.createBufferSource();
    s.buffer = b;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2200;
    f.Q.value = 0.7;
    const g = c.createGain();
    g.gain.value = vol * VOLUMEN;
    s.connect(f).connect(g).connect(this.mute ?? this.engine.master);
    s.start();
  }
}
