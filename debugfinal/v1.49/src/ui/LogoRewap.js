// =============================================================
// LogoRewap.js — (v1.49, Fase A del prólogo; el usuario: «la animación del logo de rewapstudios… cada vez que se
// abre el juego») No hay logo real en el proyecto: la R se dibuja aquí.
//   0,0–0,3 s  negro
//   0,3–1,6 s  una línea de luz verde de terminal (el verde de la interfaz) traza la R a mano, con brillo y estela
//   1,6–2,5 s  al lado, «rewapstudios», letra a letra, con la letra de la terminal
//   2,5–3,1 s  quieto un momento (con su brillo latiendo)
//   3,1–3,4 s  un parpadeo de interferencia, como el de una cámara de seguridad
//   3,4–3,8 s  fundido a negro
// Sonido (sintetizado aquí, sin archivos): un zumbido eléctrico suave mientras se dibuja y un «clic» de terminal al
// terminar. Cualquier tecla o clic lo salta (y, en el navegador, esa misma pulsación enciende el audio).
// =============================================================

import { CONFIG } from '../config.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
export const LOGO = {
  TRAZA: [0.3, 1.6], LETRAS: [1.6, 2.5], INTERF: [3.1, 3.4], FIN: 3.8,
  VERDE: [125, 255, 176],            // (el verde de la terminal: Menu.js, «PULSA CUALQUIER TECLA»)
  TEXTO: 'rewapstudios',
};
const V = LOGO.VERDE;
const verde = (a) => `rgba(${V[0]},${V[1]},${V[2]},${a.toFixed(3)})`;
const suave = (a, b, t) => {
  const k = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** El trazo de la R (en una caja de 1 × 1.4: x a la derecha, y hacia abajo), como se dibujaría a mano: el palo de
 *  abajo arriba, la panza hacia la derecha y abajo hasta el palo, y la pierna en diagonal. */
function trazoR() {
  const pts = [];
  const lin = (a, b, n) => { for (let i = 0; i <= n; i++) pts.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]); };
  lin([0.06, 1.4], [0.0, 0.0], 30);                 // el palo (un poco inclinado: a mano)
  lin([0.0, 0.0], [0.46, 0.0], 12);                 // arriba
  for (let i = 0; i <= 40; i++) {                   // la panza
    const a = -Math.PI / 2 + Math.PI * i / 40;
    pts.push([0.46 + 0.36 * Math.cos(a), 0.36 + 0.36 * Math.sin(a)]);
  }
  lin([0.46, 0.72], [0.04, 0.72], 12);              // vuelve al palo
  lin([0.3, 0.72], [0.9, 1.42], 26);                // la pierna
  // (un temblor de mano, siempre el mismo)
  return pts.map(([x, y], i) => [x + 0.008 * Math.sin(i * 1.7), y + 0.008 * Math.cos(i * 2.3)]);
}
const R = trazoR();
const LARGOS = (() => {
  const l = [0];
  for (let i = 1; i < R.length; i++) l.push(l[i - 1] + Math.hypot(R[i][0] - R[i - 1][0], R[i][1] - R[i - 1][1]));
  return l;
})();

export class LogoRewap {
  constructor(audio = null) {
    this.t = 0;
    this.audio = audio;
    this.acabado = false;
    this.sonando = false;
  }

  /** El sonido, si ya hay audio (en el .exe, sin pulsar nada; en el navegador, desde la primera pulsación). */
  _sonido() {
    const ctx = this.audio?.ctx;
    if (!ctx || this.sonando || ctx.state !== 'running') return;
    this.sonando = true;
    const ahora = ctx.currentTime;
    const t0 = ahora - Math.max(0, this.t - LOGO.TRAZA[0]);
    const out = ctx.createGain();
    out.gain.value = 0.0001;
    out.connect(this.audio.master ?? ctx.destination);
    // el zumbido: 60 Hz con armónicos, un poco de ruido filtrado, que sube y baja con el trazo
    const osc = [60, 120, 180, 300].map((f, k) => {
      const o = ctx.createOscillator();
      o.type = k ? 'sine' : 'sawtooth';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = [0.05, 0.035, 0.02, 0.01][k];
      o.connect(g).connect(out);
      o.start(ahora);
      o.stop(t0 + LOGO.INTERF[1] + 0.3);
      return o;
    });
    const fin = t0 + (LOGO.LETRAS[1] - LOGO.TRAZA[0]);
    out.gain.setValueAtTime(0.0001, ahora);
    out.gain.exponentialRampToValueAtTime(1.7, Math.max(ahora + 0.05, t0 + 0.25));
    out.gain.setValueAtTime(1.7, Math.max(ahora + 0.06, fin - 0.2));
    out.gain.exponentialRampToValueAtTime(0.0001, Math.max(ahora + 0.1, fin + 0.25));
    // el clic de terminal, al terminar de escribirse
    const clic = Math.max(ahora + 0.01, fin + 0.02);
    const n = Math.floor(ctx.sampleRate * 0.05);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.004)) + 0.5 * Math.sin(i / ctx.sampleRate * 2 * Math.PI * 2600) * Math.exp(-i / (ctx.sampleRate * 0.008));
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gc = ctx.createGain();
    gc.gain.value = 0.7;
    src.connect(gc).connect(this.audio.master ?? ctx.destination);
    src.start(clic);
    // la interferencia: un chasquido de estática corto
    const ni = Math.floor(ctx.sampleRate * 0.3);
    const bi = ctx.createBuffer(1, ni, ctx.sampleRate);
    const di = bi.getChannelData(0);
    for (let i = 0; i < ni; i++) di[i] = (Math.random() * 2 - 1) * (Math.random() < 0.3 ? 1 : 0.2) * (1 - i / ni);
    const si = ctx.createBufferSource();
    si.buffer = bi;
    const gi = ctx.createGain();
    gi.gain.value = 0.12;
    si.connect(gi).connect(this.audio.master ?? ctx.destination);
    si.start(Math.max(ahora + 0.01, t0 + (LOGO.INTERF[0] - LOGO.TRAZA[0])));
    this._osc = osc;
    this._out = out;
  }

  /** Corta el sonido (al saltarlo). */
  _calla() {
    if (!this._out) return;
    const ctx = this.audio.ctx;
    try {
      this._out.gain.cancelScheduledValues(ctx.currentTime);
      this._out.gain.setValueAtTime(this._out.gain.value, ctx.currentTime);
      this._out.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05);
      for (const o of this._osc) o.stop(ctx.currentTime + 0.08);
    } catch (e) { /* ya parado */ }
  }

  salta() {
    this._calla();
    this.acabado = true;
  }

  update(dt) {
    if (this.acabado) return;
    // (mientras el juego aún carga, los fotogramas van a tirones: el logo no empieza hasta que van fluidos; y nunca
    // avanza más de un fotograma de golpe, para que no se lo coma un tirón)
    if (dt > 0.1) {
      this.fluidos = 0;
      return;
    }
    this.fluidos = (this.fluidos ?? 0) + 1;
    if (this.fluidos < 4) return;
    this.t += Math.min(dt, 1 / 30);
    if (this.t >= LOGO.TRAZA[0]) this._sonido();
    if (this.t >= LOGO.FIN) this.acabado = true;
  }

  draw(ctxJuego) {
    // (se pinta en un lienzo propio, en las coordenadas del juego: la interferencia copia trozos de él)
    if (!this.lienzo) {
      this.lienzo = document.createElement('canvas');
      this.lienzo.width = W;
      this.lienzo.height = H;
    }
    const ctx = this.lienzo.getContext('2d');
    const t = this.t;
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    // la caja: la R a la izquierda del nombre, centrados los dos
    const alto = 230, ancho = alto / 1.4;
    ctx.font = 'bold 92px "Courier New", monospace';
    const anchoTexto = ctx.measureText(LOGO.TEXTO).width;
    const total = ancho + 46 + anchoTexto;
    const x0 = (W - total) / 2, y0 = H / 2 - alto / 2 - 10;
    const P = ([x, y]) => [x0 + x * ancho, y0 + y * (alto / 1.4)];
    // ---- la R: lo trazado, con brillo, y la punta más brillante con su estela
    const k = suave(LOGO.TRAZA[0], LOGO.TRAZA[1], t);
    const hasta = k * LARGOS[LARGOS.length - 1];
    let ultimo = 0;
    while (ultimo < R.length - 1 && LARGOS[ultimo + 1] <= hasta) ultimo++;
    const late = t > LOGO.TRAZA[1] ? 0.85 + 0.15 * Math.sin(t * 7) : 1;
    if (ultimo > 0) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const [ancho_, alfa, sombra] of [[16, 0.08, 30], [7, 0.35, 18], [3.2, 1, 8]]) {
        ctx.beginPath();
        ctx.moveTo(...P(R[0]));
        for (let i = 1; i <= ultimo; i++) ctx.lineTo(...P(R[i]));
        ctx.strokeStyle = verde(alfa * late);
        ctx.lineWidth = ancho_;
        ctx.shadowColor = verde(0.9);
        ctx.shadowBlur = sombra;
        ctx.stroke();
      }
      // la estela de la punta (mientras se dibuja)
      if (k < 1) {
        const desde = Math.max(0, ultimo - 10);
        ctx.beginPath();
        ctx.moveTo(...P(R[desde]));
        for (let i = desde + 1; i <= ultimo; i++) ctx.lineTo(...P(R[i]));
        ctx.strokeStyle = 'rgba(235,255,240,0.95)';
        ctx.lineWidth = 4.5;
        ctx.shadowBlur = 26;
        ctx.stroke();
        const [px, py] = P(R[ultimo]);
        const gr = ctx.createRadialGradient(px, py, 1, px, py, 34);
        gr.addColorStop(0, 'rgba(235,255,240,0.95)');
        gr.addColorStop(1, verde(0));
        ctx.shadowBlur = 0;
        ctx.fillStyle = gr;
        ctx.fillRect(px - 40, py - 40, 80, 80);
      }
    }
    ctx.shadowBlur = 0;
    // ---- el nombre, letra a letra (con el cursor de la terminal)
    const nl = LOGO.TEXTO.length;
    const kl = Math.max(0, Math.min(1, (t - LOGO.LETRAS[0]) / (LOGO.LETRAS[1] - LOGO.LETRAS[0])));
    const letras = Math.floor(kl * nl + 1e-6);
    if (t >= LOGO.LETRAS[0]) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.font = 'bold 92px "Courier New", monospace';
      const tx = x0 + ancho + 46, ty = y0 + alto - 24;
      ctx.fillStyle = verde(0.95 * late);
      ctx.shadowColor = verde(0.8);
      ctx.shadowBlur = 14;
      ctx.fillText(LOGO.TEXTO.slice(0, letras), tx, ty);
      ctx.shadowBlur = 0;
      if (letras < nl || Math.floor(t * 3) % 2 === 0) {
        const cx = tx + ctx.measureText(LOGO.TEXTO.slice(0, letras)).width + 6;
        ctx.fillStyle = verde(0.85);
        ctx.fillRect(cx, ty - 66, 40, 74);
      }
    }
    ctx.restore();
    // ---- al juego: tal cual o, en la interferencia (como en las cámaras), en franjas desplazadas, con ruido y una
    // línea que barre
    ctxJuego.save();
    ctxJuego.fillStyle = '#000';
    ctxJuego.fillRect(0, 0, W, H);
    const kI = t >= LOGO.INTERF[0] && t < LOGO.INTERF[1];
    ctxJuego.drawImage(this.lienzo, kI ? (Math.random() - 0.5) * 18 : 0, 0);
    if (kI) {
      for (let k_ = 0; k_ < 9; k_++) {
        const y = Math.random() * H, h = 6 + Math.random() * 40, dx = (Math.random() - 0.5) * 120;
        ctxJuego.drawImage(this.lienzo, 0, y, W, h, dx, y, W, h);
      }
      for (let k_ = 0; k_ < 260; k_++) {
        ctxJuego.fillStyle = `rgba(255,255,255,${(Math.random() * 0.25).toFixed(3)})`;
        ctxJuego.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 6, 1 + Math.random() * 2);
      }
      ctxJuego.fillStyle = verde(0.18);
      ctxJuego.fillRect(0, ((t - LOGO.INTERF[0]) / 0.3) * H, W, 8);
    }
    ctx.save();
    ctx.restore();
    const ctxF = ctxJuego;
    // ---- el fundido a negro
    const negro = suave(LOGO.INTERF[1], LOGO.FIN, t);
    if (negro > 0) {
      ctxF.fillStyle = `rgba(0,0,0,${negro.toFixed(3)})`;
      ctxF.fillRect(0, 0, W, H);
    }
    ctxF.restore();
  }
}
