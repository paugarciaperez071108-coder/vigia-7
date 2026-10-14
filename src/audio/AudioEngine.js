// =============================================================
// AudioEngine.js — Sonido generado con Web Audio API (sin archivos).
//
// Piezas básicas:
//   - Ruido blanco (un buffer de muestras aleatorias) filtrado →
//     zumbido de ventilación, golpes metálicos, estática.
//   - Osciladores (seno, sierra...) → zumbido eléctrico, tonos.
//   - StereoPannerNode → colocar un sonido a la izquierda o la
//     derecha (pasos que se acercan a una compuerta concreta).
//
// Los navegadores no dejan sonar audio hasta que el usuario
// interactúa, por eso init() se llama en el primer clic.
// =============================================================

const PAN = { left: -0.85, right: 0.85, center: 0 };

// Lado desde el que se oye a un enemigo según la sala en la que está.
const ROOM_SIDE = { westHall: 'left', left_door: 'left', eastHall: 'right', right_door: 'right' };

export class AudioEngine {
  constructor(events) {
    this.ctx = null;
    this.lightBuzz = {};
    this.loops = {};
    events.on('door', ({ side }) => this.door(side));
    events.on('light', ({ side, on }) => this.setLightBuzz(side, on));
    events.on('denied', (side) => this.denied(side));
    events.on('monitor', ({ open }) => this.monitor(open));
    events.on('camSwitch', () => this.camSwitch());

    // Enemigos
    events.on('enemyMove', ({ enemy, to }) => {
      const side = ROOM_SIDE[to];
      // Pasos fuertes y con dirección cerca de la oficina; lejanos y
      // apagados en el resto de la estación. El Congelado corre: se
      // le oye siempre bastante.
      const far = enemy?.id === 'frozen' ? 0.3 : 0.12;
      this.footsteps(side ?? 'center', side ? 0.5 : far);
    });
    events.on('doorBlocked', ({ side }) => this.bang(side));
    events.on('wallCrack', ({ stage }) => this.crack(0.25 + stage * 0.1));
    events.on('specimenEmerged', () => this.crack(0.9, true));
    events.on('cryoAlarm', ({ on }) => this.setLoop('cryo', on, () => this._beepLoop(1320, 2.2, 0.06)));
    events.on('frozenEscape', () => this.crack(0.8, true));
    events.on('reactorWarning', ({ on }) => this.setLoop('reactor', on, () => this._sirenLoop()));
    events.on('coolingStart', () => this.clunk());
    events.on('coolingEnd', () => this.clunk());
    events.on('blackout', ({ on }) => (on ? this.powerDown() : this.powerUp()));
  }

  /** Crea el contexto de audio. Debe llamarse tras un clic del usuario. */
  init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
    // Bus del ambiente: permite bajarlo mientras suena una cinta
    this.ambienceBus = this.ctx.createGain();
    this.ambienceBus.connect(this.master);
    this.noise = this._createNoiseBuffer(2);
  }

  _createNoiseBuffer(seconds) {
    const len = this.ctx.sampleRate * seconds;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Crea una cadena  fuente → ganancia → panorama → master. */
  _out(gainValue, side = 'center') {
    const g = this.ctx.createGain();
    g.gain.value = gainValue;
    const p = this.ctx.createStereoPanner();
    p.pan.value = PAN[side];
    g.connect(p).connect(this.master);
    return g;
  }

  _noiseSource(loop = false) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = loop;
    return src;
  }

  // ---------------------------------------------------------------
  // Ambiente: zumbido grave de la estación + ventilación
  // ---------------------------------------------------------------

  startAmbience() {
    if (!this.ctx || this.ambience) return;
    const t = this.ctx.currentTime;
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(1, t + 2);
    out.connect(this.ambienceBus);

    // Zumbido eléctrico: dos ondas graves ligeramente desafinadas,
    // así "baten" entre ellas y el sonido ondula.
    const hum1 = this.ctx.createOscillator();
    hum1.frequency.value = 50;
    const hum2 = this.ctx.createOscillator();
    hum2.type = 'triangle';
    hum2.frequency.value = 100.7;
    const humGain = this.ctx.createGain();
    humGain.gain.value = 0.06;
    hum1.connect(humGain);
    hum2.connect(humGain);
    humGain.connect(out);

    // Ventilación: ruido con filtro paso bajo (suena "sordo").
    const vent = this._noiseSource(true);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 350;
    const ventGain = this.ctx.createGain();
    ventGain.gain.value = 0.12;
    vent.connect(lp).connect(ventGain).connect(out);

    hum1.start();
    hum2.start();
    vent.start();
    this.ambience = { out, nodes: [hum1, hum2, vent] };
  }

  /** Volumen del ambiente (1 = normal). Lo usa TapePlayer. */
  setAmbienceLevel(level) {
    if (!this.ctx) return;
    this.ambienceBus.gain.setTargetAtTime(level, this.ctx.currentTime, 0.3);
  }

  stopAmbience(fadeTime = 0.5) {
    if (!this.ambience) return;
    const t = this.ctx.currentTime;
    const { out, nodes } = this.ambience;
    out.gain.cancelScheduledValues(t);
    out.gain.setValueAtTime(out.gain.value, t);
    out.gain.linearRampToValueAtTime(0, t + fadeTime);
    nodes.forEach((n) => n.stop(t + fadeTime + 0.05));
    this.ambience = null;
  }

  // ---------------------------------------------------------------
  // Efectos puntuales
  // ---------------------------------------------------------------

  /** Compuerta: siseo hidráulico + golpe metálico grave. */
  door(side) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    const hiss = this._noiseSource();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2500, t);
    bp.frequency.exponentialRampToValueAtTime(400, t + 0.25);
    const hg = this._out(0, side);
    hg.gain.setValueAtTime(0.5, t);
    hg.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    hiss.connect(bp).connect(hg);
    hiss.start(t);
    hiss.stop(t + 0.35);

    const thump = this.ctx.createOscillator();
    thump.frequency.setValueAtTime(110, t + 0.18);
    thump.frequency.exponentialRampToValueAtTime(40, t + 0.45);
    const tg = this._out(0, side);
    tg.gain.setValueAtTime(0.0001, t);
    tg.gain.setValueAtTime(0.7, t + 0.18);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    thump.connect(tg);
    thump.start(t);
    thump.stop(t + 0.55);
  }

  /** Zumbido del foco mientras está encendido. */
  setLightBuzz(side, on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (on && !this.lightBuzz[side]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 120;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800;
      bp.Q.value = 3;
      const g = this._out(0, side);
      g.gain.linearRampToValueAtTime(0.06, t + 0.03);
      osc.connect(bp).connect(g);
      osc.start();
      this.lightBuzz[side] = { osc, g };
    } else if (!on && this.lightBuzz[side]) {
      const { osc, g } = this.lightBuzz[side];
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + 0.05);
      osc.stop(t + 0.08);
      delete this.lightBuzz[side];
    }
  }

  /** Botón sin energía: chasquido seco. */
  denied(side) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 90;
    const g = this._out(0.15, side);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  // ---------------------------------------------------------------
  // Monitor de cámaras
  // ---------------------------------------------------------------

  /** Subir/bajar el monitor: zumbido de arranque + siseo de estática de fondo. */
  monitor(open) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Barrido de tono: sube al encender, baja al apagar
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(open ? 300 : 900, t);
    osc.frequency.exponentialRampToValueAtTime(open ? 900 : 200, t + 0.18);
    const g = this._out(0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 0.25);

    // Siseo continuo mientras el monitor está subido
    if (open && !this.monitorHiss) {
      const src = this._noiseSource(true);
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 3000;
      const hg = this._out(0);
      hg.gain.linearRampToValueAtTime(0.035, t + 0.2);
      src.connect(hp).connect(hg);
      src.start();
      this.monitorHiss = { src, hg };
    } else if (!open && this.monitorHiss) {
      const { src, hg } = this.monitorHiss;
      hg.gain.setValueAtTime(hg.gain.value, t);
      hg.gain.linearRampToValueAtTime(0, t + 0.1);
      src.stop(t + 0.12);
      this.monitorHiss = null;
    }
  }

  /** Cambio de cámara: ráfaga corta de estática + clic. */
  camSwitch() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this._noiseSource();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    const g = this._out(0.25);
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    src.connect(bp).connect(g);
    src.start(t);
    src.stop(t + 0.3);
  }

  // ---------------------------------------------------------------
  // Enemigos y eventos
  // ---------------------------------------------------------------

  /** Tres pasos pesados (ruido grave filtrado). */
  footsteps(side, volume) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const start = t + i * 0.38 + Math.random() * 0.05;
      const src = this._noiseSource();
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 180;
      const g = this._out(0, side);
      g.gain.setValueAtTime(volume, start);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      src.connect(lp).connect(g);
      src.start(start);
      src.stop(start + 0.2);
    }
  }

  /** Golpes contra una compuerta cerrada. */
  bang(side) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const start = t + i * 0.28;
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(95, start);
      osc.frequency.exponentialRampToValueAtTime(40, start + 0.25);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 500;
      const g = this._out(0, side);
      g.gain.setValueAtTime(0.6, start);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
      osc.connect(lp).connect(g);
      osc.start(start);
      osc.stop(start + 0.32);
    }
  }

  /** Crujido (muro que se agrieta, hielo que se rompe). */
  crack(volume, big = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = big ? 7 : 3;
    for (let i = 0; i < n; i++) {
      const start = t + i * (big ? 0.06 : 0.09) + Math.random() * 0.03;
      const src = this._noiseSource();
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.value = 900 + Math.random() * 2500;
      const g = this._out(0);
      g.gain.setValueAtTime(volume * 0.5, start);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.07);
      src.connect(hp).connect(g);
      src.start(start);
      src.stop(start + 0.08);
    }
    if (big) this.door('center');
  }

  /** Golpe mecánico (barras de control insertadas). */
  clunk() {
    if (!this.ctx) return;
    this.door('center');
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(400, t + 0.3);
    osc.frequency.exponentialRampToValueAtTime(150, t + 1.2);
    const g = this._out(0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.setValueAtTime(0.1, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 1.35);
  }

  /** Tecla de la consola. */
  keyClick() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this._noiseSource();
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4000;
    const g = this._out(0.12);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    src.connect(hp).connect(g);
    src.start(t);
    src.stop(t + 0.04);
  }

  /** Grito del susto: ruido saturado + chirrido que cae. */
  scream() {
    if (!this.ctx) return;
    this.stopAll();
    const t = this.ctx.currentTime;
    const dur = 1.4;
    const src = this._noiseSource(true);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2500, t);
    bp.frequency.exponentialRampToValueAtTime(600, t + dur);
    const g = this._out(0);
    g.gain.linearRampToValueAtTime(0.9, t + 0.03);
    g.gain.setValueAtTime(0.9, t + dur - 0.3);
    g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(bp).connect(g);
    src.start(t);
    src.stop(t + dur);
    for (const f of [620, 655, 910]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.35, t + dur);
      const og = this._out(0);
      og.gain.linearRampToValueAtTime(0.18, t + 0.03);
      og.gain.linearRampToValueAtTime(0, t + dur);
      osc.connect(og);
      osc.start(t);
      osc.stop(t + dur);
    }
  }

  /** Explosión del reactor. */
  explosion() {
    if (!this.ctx) return;
    this.stopAll();
    const t = this.ctx.currentTime;
    const src = this._noiseSource(true);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3000, t);
    lp.frequency.exponentialRampToValueAtTime(80, t + 3);
    const g = this._out(0);
    g.gain.linearRampToValueAtTime(1, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 3.2);
    src.connect(lp).connect(g);
    src.start(t);
    src.stop(t + 3.3);
  }

  // ---------------------------------------------------------------
  // Alarmas en bucle (se activan/desactivan con setLoop)
  // ---------------------------------------------------------------

  setLoop(name, on, factory) {
    if (!this.ctx) return;
    if (on && !this.loops[name]) {
      this.loops[name] = factory();
    } else if (!on && this.loops[name]) {
      const { nodes, out } = this.loops[name];
      const t = this.ctx.currentTime;
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.linearRampToValueAtTime(0, t + 0.1);
      nodes.forEach((n) => n.stop(t + 0.12));
      delete this.loops[name];
    }
  }

  /** Pitido intermitente: un tono "abierto y cerrado" por una onda cuadrada lenta. */
  _beepLoop(freq, rate, volume) {
    const osc = this.ctx.createOscillator();
    osc.frequency.value = freq;
    const gate = this.ctx.createGain();
    gate.gain.value = 0;
    const lfo = this.ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = rate;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.5;
    const bias = this.ctx.createConstantSource();
    bias.offset.value = 0.5;
    lfo.connect(lfoGain).connect(gate.gain);
    bias.connect(gate.gain);
    const out = this._out(volume);
    osc.connect(gate).connect(out);
    [osc, lfo, bias].forEach((n) => n.start());
    return { nodes: [osc, lfo, bias], out };
  }

  /** Sirena del reactor: tono de sierra que sube y baja. */
  _sirenLoop() {
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 450;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.8;
    const depth = this.ctx.createGain();
    depth.gain.value = 150;
    lfo.connect(depth).connect(osc.frequency);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1200;
    const out = this._out(0.05);
    osc.connect(lp).connect(out);
    [osc, lfo].forEach((n) => n.start());
    return { nodes: [osc, lfo], out };
  }

  /** Vuelve la luz: tono que sube y el zumbido de la estación regresa. */
  powerUp() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(40, t);
    osc.frequency.exponentialRampToValueAtTime(240, t + 1);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    const g = this._out(0.2);
    g.gain.linearRampToValueAtTime(0, t + 1.1);
    osc.connect(lp).connect(g);
    osc.start(t);
    osc.stop(t + 1.2);
    this.startAmbience();
  }

  /** Apagón: todo se "desinfla" con un tono que cae. */
  /**
   * Algo metálico se acerca por el conducto: golpes huecos sobre chapa
   * cada vez más seguidos y fuertes, más un roce que crece. Dura
   * `duration` segundos (lo programa todo de una vez).
   */
  ductApproach(duration) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    let t = 0;
    while (t < duration) {
      const k = t / duration; // 0 = lejos, 1 = encima
      this._ductHit(t0 + t, 0.04 + 0.5 * k * k, k);
      t += 0.45 - 0.33 * k + Math.random() * 0.08;
    }
    const src = this._noiseSource(true);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(450, t0);
    bp.frequency.linearRampToValueAtTime(1500, t0 + duration);
    const g = this._out(0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.16, t0 + duration);
    g.gain.setValueAtTime(0, t0 + duration);
    src.connect(bp).connect(g);
    src.start(t0);
    src.stop(t0 + duration + 0.05);
  }

  /** Un golpe hueco en el conducto. k (0..1): cuanto más cerca, más brillante. */
  _ductHit(when, volume, k) {
    for (const [f, a, d] of [[175, 1, 0.16], [420, 0.6, 0.11], [770, 0.35, 0.07], [1310, 0.25 * k, 0.05]]) {
      const osc = this.ctx.createOscillator();
      osc.frequency.value = f * (0.96 + Math.random() * 0.08);
      const g = this._out(0);
      g.gain.setValueAtTime(volume * a, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + d + 0.05);
      osc.connect(g);
      osc.start(when);
      osc.stop(when + d + 0.08);
    }
    const n = this._noiseSource();
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600 + 2600 * k;
    const g = this._out(0);
    g.gain.setValueAtTime(volume * 0.9, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    n.connect(lp).connect(g);
    n.start(when);
    n.stop(when + 0.06);
  }

  /** Golpe final encima de la oficina y se va la luz. */
  ductSlam() {
    if (!this.ctx) return;
    this._ductHit(this.ctx.currentTime, 0.9, 1);
    this.powerDown();
  }

  powerDown() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.stopAmbience(1.5);
    Object.keys(this.lightBuzz).forEach((s) => this.setLightBuzz(s, false));
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + 2.2);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    const g = this._out(0.25);
    g.gain.setValueAtTime(0.25, t);
    g.gain.linearRampToValueAtTime(0, t + 2.4);
    osc.connect(lp).connect(g);
    osc.start(t);
    osc.stop(t + 2.5);
  }

  /** Fin de turno a las 6 AM: pequeño arpegio de campanas. */
  chime() {
    if (!this.ctx) return;
    this.stopAmbience(1);
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      osc.frequency.value = f;
      const g = this._out(0);
      const start = t + i * 0.35;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.25, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, start + 1.6);
      osc.connect(g);
      osc.start(start);
      osc.stop(start + 1.7);
    });
  }

  stopAll() {
    if (!this.ctx) return;
    this.stopAmbience(0.2);
    if (this.monitorHiss) {
      this.monitorHiss.src.stop();
      this.monitorHiss = null;
    }
    Object.keys(this.loops).forEach((name) => this.setLoop(name, false));
    Object.keys(this.lightBuzz).forEach((s) => this.setLightBuzz(s, false));
  }
}
