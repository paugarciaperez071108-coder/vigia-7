// (v1.56, el usuario) Las grabaciones de la mujer en los conductos de la noche 6.
// Las dejó cuando hizo ese mismo recorrido para intentar escapar; ella ya no está.
//
// Cada fragmento suena UNA vez al pasar por su punto (inicio, cruce, enemigo, ciego, pila, v4,
// valvulas), desde una grabadora pequeña que se queda donde sonó: si te alejas, se oye cada vez más
// lejos. No para el juego. Lo de los enemigos se oye por encima (la voz va baja: NIGHT6.GRABACIONES).
// Audio y subtítulos: tools/cintas_conductos_n6.py → assets/audio/cintas/conductos_n6/.
// Es la mujer en un minijuego (norma de voces).
import { CONFIG } from '../config.js';
import { NIGHT6 } from '../night/night6.js';
import { ExtrasProgreso } from '../core/ExtrasProgreso.js';

const G = NIGHT6.GRABACIONES;
const FRAGS = {};
fetch('assets/audio/cintas/conductos_n6/fragmentos.json').then((r) => (r.ok ? r.json() : []))
  .then((j) => { for (const f of j ?? []) FRAGS[f.punto] = f; }).catch(() => {});

export class GrabacionesN6 {
  constructor(game) {
    this.g = game;
    this.oidas = new Set();
    this.audio = null;      // el que suena
    this.frag = null;
    this.donde = null;      // [x, y] (m) de la grabadora que suena, o null (pegada a ti)
    this.cola = [];         // las que esperan a que acabe la que suena
  }

  /** Empieza la noche (o un reintento): vuelven a poder sonar todas. */
  reinicia() {
    this.para();
    this.oidas.clear();
  }

  /** El fragmento de ese punto, si no ha sonado ya. donde: [x, y] en m (null = pegada a ti). */
  suena(punto, donde = null) {
    const f = FRAGS[punto];
    if (!f || this.oidas.has(punto)) return false;
    this.oidas.add(punto);
    // si ya suena otra, esta espera a que acabe (no se cortan entre ellas)
    if (this.audio) { this.cola.push([f, donde]); return true; }
    this._pon(f, donde);
    return true;
  }

  _pon(f, donde) {
    ExtrasProgreso.oyeCinta(`n6_${f.n}`);   // (v1.56) para el menú Extras
    const a = new Audio(f.audio);
    a.volume = G.VOLUMEN;
    const sigue = () => {
      if (this.audio !== a) return;
      this.audio = null;
      this.frag = null;
      const [f2, d2] = this.cola.shift() ?? [];
      if (f2) this._pon(f2, d2);
    };
    a.addEventListener('ended', sigue);
    a.play().catch(sigue);
    this.audio = a;
    this.frag = f;
    this.donde = donde;
  }

  /** Corta la que suena y las que esperan (al morir, al reintentar). */
  para() {
    if (this.audio) this.audio.pause();
    this.audio = null;
    this.frag = null;
    this.cola = [];
  }

  get sonando() {
    return !!this.audio;
  }

  /** aqui: [x, y] en m de donde estás ahora: más lejos de la grabadora, más bajo. */
  update(aqui) {
    if (!this.audio) return;
    let k = 1;
    if (this.donde && aqui) {
      const d = Math.hypot(aqui[0] - this.donde[0], aqui[1] - this.donde[1]);
      k = Math.max(0, Math.min(1, 1 - (d - G.CERCA) / (G.LEJOS - G.CERCA))) ** 1.5;
    }
    this.audio.volume = G.VOLUMEN * k;
    this.lejos = 1 - k;
  }

  /** El subtítulo de lo que está diciendo (con los subtítulos de las cintas encendidos). */
  draw(ctx) {
    if (!this.audio || !this.frag || this.g.tape?.subsOn === false) return;
    const t = this.audio.currentTime;
    const s = this.frag.subtitulos.find((x) => t >= x.start - 0.05 && t <= x.end + 0.35);
    if (!s || (this.lejos ?? 0) > 0.85) return;
    ctx.save();
    ctx.globalAlpha = 1 - Math.max(0, (this.lejos ?? 0) - 0.4) / 0.45;
    ctx.font = 'italic 24px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(s.text).width + 40;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(CONFIG.WIDTH / 2 - w / 2, 770, w, 44);
    ctx.fillStyle = '#e6d6f2';
    ctx.fillText(s.text, CONFIG.WIDTH / 2, 792);
    ctx.restore();
  }
}
