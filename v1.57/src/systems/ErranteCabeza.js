// =============================================================
// ErranteCabeza.js — EL ERRANTE EN TU CABEZA (v1.10, final del juego, Fase 0).
// (Valores en NIGHT4.CABEZA, src/night/night4.js.)
//
// El dato flags.erranteEnCabeza decide, junto con Slaimi, cuál de los 4
// finales toca (src/core/Finales.js). Una vez activado no se borra nunca.
//
//   - Ruta A de la noche 4: una sola vez, a una hora al azar de 5:00 a 5:28,
//     su cara (su render real, assets/n4/mira/mira_cara.jpg) en uno de los
//     cuatro sitios: reflejada en el ventanal, en el monitor, en la
//     ventanilla de una compuerta o pegada al cristal por fuera. Con el mismo
//     grano y los mismos saltos de imagen que las alucinaciones, pero más
//     nítida. Apartar la vista antes de CABEZA.MIRAR s (girar, subir el
//     monitor, cerrar esa compuerta) → se va y no pasa nada. Mirarla esos
//     segundos → se distorsiona, un susurro dentro de la cabeza y el dato.
//     Si a la hora elegida no miras su sitio, espera a que lo mires; pasadas
//     las 5:28, sale en la pared que mires.
//   - Ruta B: al desmayarte por mirarle (Night4Dark._startFaint) →
//     destello(): un fotograma de su cara con estática y el susurro.
//
// Enganches (Game.js): update(dt) en la noche; draw(ctx, face) al final de
// _drawOfficeFront; drawDestello(ctx) encima de la escena de la ruta B.
// =============================================================

import { CONFIG } from '../config.js';
import { NIGHT4 } from '../night/night4.js';

const C = NIGHT4.CABEZA;
const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const IMAGEN = 'assets/n4/mira/mira_cara.jpg';
const CARA = { x: 520, y: 90, w: 620, h: 810 };   // la cara dentro de la imagen (1600×900)
// Dónde cae en cada sitio (coordenadas de la oficina, como en OfficeView)
const SITIO = {
  ventanal: { face: 'front', x: 696, y: 128, h: 270, espejo: true },    // detrás de ti, en el cristal
  fuera: { face: 'front', x: 674, y: 120, h: 330, espejo: false },      // pegada al cristal por fuera
  monitor: { face: 'front', x: 735, y: 566, h: 168, espejo: false },    // en el cristal del CRT
  compuerta: { face: null, x: 685, y: 268, h: 300, espejo: false },     // la ventanilla de la compuerta
};
const rand = (a, b) => a + Math.random() * (b - a);

export class ErranteCabeza {
  constructor(g) {
    this.g = g;
    this.img = null;
    this.reset();
  }

  reset() {
    this.fase = 'espera';            // espera → visible → distorsion | seva → hecho
    this.hora = rand(C.DESDE, C.HASTA);
    this.sitio = C.SITIOS[Math.floor(Math.random() * C.SITIOS.length)];
    this.lado = Math.random() < 0.5 ? 'left' : 'right';
    this.t = 0;
    this.mirada = 0;
    this.k = 0;                      // visibilidad 0..1
    this.salto = 0;
    this.destelloHasta = 0;
  }

  _carga() {
    if (this.img) return;
    this.img = new Image();
    this.img.src = IMAGEN;
  }

  get activo() {
    const g = this.g;
    return g.state === 'night' && g.nightNumber === 4 && g.n4path === 'A' && !g.save?.flags?.erranteEnCabeza;
  }

  /** La cara de su sitio está a la vista (pared, monitor bajado, compuerta abierta). */
  _laVe() {
    const g = this.g;
    const lb = g.lookBack;
    if (g.cameras.open || lb.moving) return false;
    const s = SITIO[this.sitio];
    if (this.sitio === 'compuerta') return lb.face === this.lado && !g.office.doors[this.lado].closed;
    return lb.face === s.face;
  }

  update(dt) {
    if (this.fase === 'hecho' || !this.activo) return;
    const g = this.g;
    const hora = g.clock.elapsed / CONFIG.SECONDS_PER_HOUR;
    if (hora >= C.DESDE - 0.1) this._carga();
    this.salto = Math.max(0, this.salto - dt);
    if (Math.random() < dt * 0.9) this.salto = rand(0.05, 0.16);
    if (this.fase === 'espera') {
      if (hora < this.hora) return;
      if (hora >= C.HASTA && !this._laVe() && !g.cameras.open && !g.lookBack.moving) {
        // ya tarde: sale en la pared que miras
        const f = g.lookBack.face;
        if (f === 'left' || f === 'right') {
          if (!g.office.doors[f].closed) { this.sitio = 'compuerta'; this.lado = f; }
        } else if (f === 'front') this.sitio = Math.random() < 0.5 ? 'ventanal' : 'fuera';
      }
      if (!this._laVe() || !this.img?.complete) return;
      this.fase = 'visible';
      this.t = 0;
      this._note('aparece', { sitio: this.sitio, lado: this.sitio === 'compuerta' ? this.lado : undefined });
      return;
    }
    this.t += dt;
    if (this.fase === 'visible') {
      this.k = Math.min(1, this.t / C.APARECE);
      if (!this._laVe()) {
        this.fase = 'seva';
        this.t = 0;
        this._note('apartó la vista', { mirada: +this.mirada.toFixed(2) });
        return;
      }
      this.mirada += dt;
      if (this.mirada >= C.MIRAR) {
        this.fase = 'distorsion';
        this.t = 0;
        this._susurro();
        this._play('mira/pitido', { volume: 0.32 });
        g._setFlag('erranteEnCabeza');
        this._note('se te queda dentro', {});
      }
    } else if (this.fase === 'seva') {
      this.k = Math.max(0, this.k - dt / C.SE_VA);
      if (this.k <= 0) this.fase = 'hecho';
    } else if (this.fase === 'distorsion') {
      if (this.t >= C.DISTORSION) {
        this.fase = 'hecho';
        this.k = 0;
      }
    }
  }

  /** Ruta B: el fotograma de su cara al desmayarte por mirarle (y el dato). */
  destello() {
    this._carga();
    this.destelloHasta = performance.now() + C.DESTELLO_B * 1000;
    this._susurro(0.15);
  }

  _susurro(when = 0) {
    this._play('final/susurro', { volume: 0.85, when });
  }

  _play(key, opts) {
    return this.g.audio.lib?.play(key, opts) ?? false;
  }

  _note(what, data) {
    this.ultimo = what;            // (lo enseña la información del modo debug)
    if (this.g.n4dbg) console.log('[ErranteCabeza]', what, data);
  }

  /** Su cara en la pared `face` de la oficina (al final de _drawOfficeFront). */
  draw(ctx, face) {
    if (this.fase !== 'visible' && this.fase !== 'seva' && this.fase !== 'distorsion') return;
    if (!this.img?.complete) return;
    const s = SITIO[this.sitio];
    if ((this.sitio === 'compuerta' ? this.lado : s.face) !== face) return;
    if (this.salto > 0 && Math.random() < 0.35) return;     // un fotograma perdido
    const d = this.fase === 'distorsion' ? this.t / C.DISTORSION : 0;
    const alfa = C.ALFA[this.sitio] * this.k * (0.85 + 0.15 * Math.random()) * (1 - d * d);
    const h = s.h * (1 + 0.35 * d);
    const w = h * CARA.w / CARA.h;
    const x = s.x - (w - s.h * CARA.w / CARA.h) / 2 + (this.salto > 0 ? rand(-10, 10) : 0);
    const y = s.y - (h - s.h) / 2;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = Math.max(0, alfa);
    ctx.filter = this.sitio === 'monitor' ? 'grayscale(0.6) sepia(0.4) hue-rotate(70deg) contrast(1.2)' : 'grayscale(0.35) contrast(1.15)';
    if (s.espejo) {
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.translate(-x, -y);
    }
    if (d > 0) {
      // la distorsión: franjas que se desplazan cada vez más
      const n = 14;
      for (let i = 0; i < n; i++) {
        const sy = CARA.y + (CARA.h * i) / n;
        const dx = (Math.random() - 0.5) * 160 * d;
        ctx.drawImage(this.img, CARA.x, sy, CARA.w, CARA.h / n, x + dx, y + (h * i) / n, w * (1 + 0.4 * d * Math.random()), h / n + 1);
      }
    } else {
      ctx.drawImage(this.img, CARA.x, CARA.y, CARA.w, CARA.h, x, y, w, h);
      if (this.salto > 0) {
        // imagen descuadrada: una franja desplazada
        const k = Math.random();
        ctx.drawImage(this.img, CARA.x, CARA.y + CARA.h * k, CARA.w, CARA.h * 0.12, x + rand(-30, 30), y + h * k, w, h * 0.12);
      }
    }
    ctx.restore();
    // grano encima, solo sobre la cara
    ctx.save();
    ctx.globalAlpha = 0.12 * this.k;
    ctx.fillStyle = '#000';
    for (let yy = y; yy < y + h; yy += 3) ctx.fillRect(x, yy, w, 1);
    ctx.restore();
  }

  /** Ruta B: el destello de su cara, a pantalla completa, con estática. */
  drawDestello(ctx, effects) {
    if (performance.now() > this.destelloHasta || !this.img?.complete) return;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.filter = 'grayscale(0.4) contrast(1.3)';
    ctx.drawImage(this.img, 0, 0, W, H);
    ctx.restore();
    effects?.static(ctx, 0.55);
  }
}
