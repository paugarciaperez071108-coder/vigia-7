// =============================================================
// LogoRewap.js — (v1.49, Fase A del prólogo) El logo de rewapstudios cada vez que se abre el juego.
// (v1.50, el usuario dejó su logo: assets/logo/rewap_original.png — «la idea es que se vaya formando la R poco a poco
// añadiendo cubitos y cuando esté poner abajo rewap studios») Una rejilla de 5 × 7 cuadrados oscuros; la R se forma
// cubito a cubito en verde lima, en el orden en que se escribiría a mano; al cerrarse, debajo, «rewap» en blanco y
// «studios» en verde, letra a letra, con el cursor de la terminal.
//   0,00–0,25 s  negro
//   0,25–0,65 s  aparece la rejilla (los cuadrados oscuros)
//   0,65–1,95 s  los cubitos de la R, uno a uno (cada uno salta, destella y hace «clic»)
//   1,95–2,70 s  «rewap studios», letra a letra
//   2,70–3,20 s  quieto (el cursor parpadea)
//   3,20–3,50 s  un parpadeo de interferencia, como el de una cámara de seguridad
//   3,50–3,90 s  fundido a negro
// Sonido (sintetizado, sin archivos): un zumbido eléctrico suave, un clic por cubito y el clic de la terminal al final.
// Cualquier tecla o clic lo salta (y, en el navegador, esa misma pulsación enciende el audio).
// =============================================================

import { CONFIG } from '../config.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
export const LOGO = {
  REJILLA: [0.25, 0.65], CUBOS: [0.65, 1.95], LETRAS: [1.95, 2.7], INTERF: [3.2, 3.5], FIN: 3.9,
  // (los colores del logo del usuario)
  FONDO: '#0e0f0c', VACIO: [26, 28, 23], LIMA: [182, 255, 59], BLANCO: [240, 240, 232],
  // el orden de los cubitos de la R (fila, columna de una rejilla de 5 × 7), como se escribiría a mano: el palo de
  // arriba abajo, el arco y la pierna
  ORDEN: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [0, 1], [0, 2], [0, 3], [1, 4], [2, 4], [3, 3], [3, 2],
    [3, 1], [4, 2], [5, 3], [6, 4]],
  PALABRAS: [['rewap', 'BLANCO'], [' ', 'BLANCO'], ['studios', 'LIMA']],
};
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
const suave = (a, b, t) => {
  const k = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
const N_CUBOS = LOGO.ORDEN.length;
const T_CUBO = (i) => LOGO.CUBOS[0] + (LOGO.CUBOS[1] - LOGO.CUBOS[0]) * i / N_CUBOS;
const TEXTO = LOGO.PALABRAS.map((p) => p[0]).join('');

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
    const t0 = ahora - this.t;                           // (el 0 del logo, en el reloj del audio)
    const sale = this.audio.master ?? ctx.destination;
    const out = ctx.createGain();
    out.gain.value = 0.0001;
    out.connect(sale);
    // el zumbido: 60 Hz con armónicos, que sube con la rejilla y se va al acabar el nombre
    this._osc = [60, 120, 180, 300].map((f, k) => {
      const o = ctx.createOscillator();
      o.type = k ? 'sine' : 'sawtooth';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = [0.05, 0.035, 0.02, 0.01][k];
      o.connect(g).connect(out);
      o.start(ahora);
      o.stop(t0 + LOGO.FIN);
      return o;
    });
    const at = (s) => Math.max(ahora + 0.005, t0 + s);
    out.gain.setValueAtTime(0.0001, ahora);
    out.gain.exponentialRampToValueAtTime(1.5, at(LOGO.REJILLA[1]));
    out.gain.setValueAtTime(1.5, at(LOGO.LETRAS[1] - 0.1));
    out.gain.exponentialRampToValueAtTime(0.0001, at(LOGO.LETRAS[1] + 0.35));
    this._out = out;
    // un clic por cubito (cada uno, algo más agudo: la R «se carga») y el de la terminal al final
    const clic = (cuando, f, vol, largo = 0.035) => {
      const n = Math.floor(ctx.sampleRate * largo);
      const buf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const s = i / ctx.sampleRate;
        d[i] = (Math.random() * 2 - 1) * Math.exp(-s / 0.003) * 0.6 + Math.sin(2 * Math.PI * f * s) * Math.exp(-s / 0.009);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = vol;
      src.connect(g).connect(sale);
      src.start(cuando);
    };
    for (let i = 0; i < N_CUBOS; i++) {
      const c = T_CUBO(i);
      if (t0 + c >= ahora) clic(t0 + c, 900 + i * 45, 0.32);
    }
    if (t0 + LOGO.LETRAS[1] >= ahora) clic(t0 + LOGO.LETRAS[1] + 0.02, 2600, 0.7, 0.05);
    // la interferencia: un chasquido de estática corto
    if (t0 + LOGO.INTERF[0] >= ahora) {
      const ni = Math.floor(ctx.sampleRate * 0.3);
      const bi = ctx.createBuffer(1, ni, ctx.sampleRate);
      const di = bi.getChannelData(0);
      for (let i = 0; i < ni; i++) di[i] = (Math.random() * 2 - 1) * (Math.random() < 0.3 ? 1 : 0.2) * (1 - i / ni);
      const si = ctx.createBufferSource();
      si.buffer = bi;
      const gi = ctx.createGain();
      gi.gain.value = 0.12;
      si.connect(gi).connect(sale);
      si.start(t0 + LOGO.INTERF[0]);
    }
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
    this._sonido();
    if (this.t >= LOGO.FIN) this.acabado = true;
  }

  /** El logo en un lienzo propio (en las coordenadas del juego): la interferencia copia trozos de él. */
  _pinta(ctx, t) {
    ctx.fillStyle = LOGO.FONDO;
    ctx.fillRect(0, 0, W, H);
    // las medidas del logo del usuario (1200 px): cuadrado de 88, paso de 100, rejilla de 488 × 688
    const k = 0.75, paso = 100 * k, lado = 88 * k;
    const gx = W / 2 - (488 * k) / 2, gy = 118;
    // la rejilla (los cuadrados oscuros), que aparece en diagonal
    for (let f = 0; f < 7; f++) {
      for (let c = 0; c < 5; c++) {
        const a = suave(LOGO.REJILLA[0] + (f + c) * 0.025, LOGO.REJILLA[0] + (f + c) * 0.025 + 0.18, t);
        if (a <= 0) continue;
        ctx.fillStyle = rgba(LOGO.VACIO, a);
        ctx.fillRect(gx + c * paso, gy + f * paso, lado, lado);
      }
    }
    // los cubitos de la R, uno a uno: saltan (más grandes y blancos un instante), brillan y se quedan
    const late = t > LOGO.CUBOS[1] ? 0.9 + 0.1 * Math.sin(t * 6) : 1;
    LOGO.ORDEN.forEach(([f, c], i) => {
      const e = t - T_CUBO(i);
      if (e < 0) return;
      const pop = e < 0.14 ? 1 + 0.22 * Math.sin(Math.PI * e / 0.14) : 1;
      const blanco = Math.max(0, 1 - e / 0.16);
      const l = lado * pop, x = gx + c * paso + (lado - l) / 2, y = gy + f * paso + (lado - l) / 2;
      ctx.save();
      ctx.shadowColor = rgba(LOGO.LIMA, 0.9);
      ctx.shadowBlur = 18 * late + 22 * blanco;
      const col = LOGO.LIMA.map((v) => Math.round(v + (255 - v) * blanco * 0.85));
      ctx.fillStyle = rgba(col, 1);
      ctx.fillRect(x, y, l, l);
      ctx.restore();
    });
    // el nombre, letra a letra, debajo (con el cursor de la terminal)
    if (t >= LOGO.LETRAS[0]) {
      const kl = Math.max(0, Math.min(1, (t - LOGO.LETRAS[0]) / (LOGO.LETRAS[1] - LOGO.LETRAS[0])));
      const n = Math.floor(kl * TEXTO.length + 1e-6);
      ctx.font = 'bold 46px Consolas, "Courier New", monospace';
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      const anchoTotal = ctx.measureText(TEXTO).width + 22;
      let x = W / 2 - anchoTotal / 2;
      const y = gy + 688 * k + 99;
      let quedan = n;
      for (const [txt, col] of LOGO.PALABRAS) {
        const parte = txt.slice(0, Math.max(0, quedan));
        quedan -= txt.length;
        ctx.fillStyle = rgba(LOGO[col], 1);
        ctx.fillText(parte, x, y);
        x += ctx.measureText(parte).width;
        if (quedan < 0) break;
      }
      if (n < TEXTO.length || Math.floor(t * 3) % 2 === 0) {
        ctx.fillStyle = rgba(LOGO.LIMA, 1);
        ctx.fillRect(x + 10, y - 40, 21, 42);
      }
    }
  }

  draw(ctxJuego) {
    if (!this.lienzo) {
      this.lienzo = document.createElement('canvas');
      this.lienzo.width = W;
      this.lienzo.height = H;
    }
    const t = this.t;
    this._pinta(this.lienzo.getContext('2d'), t);
    const ctx = ctxJuego;
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    // la interferencia (como en las cámaras): franjas desplazadas, ruido y una línea que barre
    const kI = t >= LOGO.INTERF[0] && t < LOGO.INTERF[1];
    ctx.drawImage(this.lienzo, kI ? (Math.random() - 0.5) * 18 : 0, 0);
    if (kI) {
      for (let k_ = 0; k_ < 9; k_++) {
        const y = Math.random() * H, h = 6 + Math.random() * 40, dx = (Math.random() - 0.5) * 120;
        ctx.drawImage(this.lienzo, 0, y, W, h, dx, y, W, h);
      }
      for (let k_ = 0; k_ < 260; k_++) {
        ctx.fillStyle = `rgba(255,255,255,${(Math.random() * 0.25).toFixed(3)})`;
        ctx.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 6, 1 + Math.random() * 2);
      }
      ctx.fillStyle = rgba(LOGO.LIMA, 0.18);
      ctx.fillRect(0, ((t - LOGO.INTERF[0]) / 0.3) * H, W, 8);
    }
    // el fundido a negro
    const negro = suave(LOGO.INTERF[1], LOGO.FIN, t);
    if (negro > 0) {
      ctx.fillStyle = `rgba(0,0,0,${negro.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }
}
