// =============================================================
// OfficeTurn.js — GIRAR ENTRE LAS 4 PAREDES DE LA OFICINA.
//
// La oficina es una sala cuadrada con el jugador en el centro:
//
//               [ frente ]   ventanal, consola y dos conductos
//   [ izquierda ]        [ derecha ]   compuertas con sus botones
//               [ atrás ]    pasillo central
//
// Control: con el ratón en el borde izquierdo o derecho de la pantalla
// (CONFIG.OFFICE_TURN.EDGE px) la vista gira 90° hacia ese lado, con una
// animación rápida. Para volver a girar hay que sacar el ratón del borde
// y volver a llevarlo. Cada giro es de 90°, así que NO se puede ir del
// frente a atrás directamente: hay que pasar por un lado (y lo mismo para
// volver). Tecla CONFIG.LOOK_BACK.KEY (V): ir hacia atrás o volver al
// frente, también pasando por un lado.
//
// Sustituye al antiguo LookBack.js (franjas abajo) y mantiene su forma de
// uso (turned, facingBack, turn(back), toggle, hover, update, draw), así
// que la noche 2.5 y la escena final lo usan igual.
//
// Uso:
//   t.hover(x, y)            al mover el ratón (true si está en un borde)
//   t.update(dt)             cada fotograma
//   t.step(-1 | 1)           un giro a la izquierda / derecha
//   t.goTo(pared)            girar (pasando por los lados) hasta esa pared
//   t.draw(ctx, { front, left, right, back })   dibuja la vista (animada)
//   t.drawEdges(ctx)         flechas de los bordes (encima de todo)
// =============================================================

import { CONFIG } from '../config.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
// En el sentido de las agujas del reloj (girar a la derecha = siguiente)
export const FACES = ['front', 'right', 'back', 'left'];
const NAMES = { front: 'FRENTE', right: 'PUERTA DERECHA', back: 'PASILLO CENTRAL', left: 'PUERTA IZQUIERDA' };

export class OfficeTurn {
  constructor() {
    this.enabled = false;
    this.onTurn = null;     // callback(pared) al empezar cada giro
    this.reset();
  }

  reset() {
    this.face = 'front';    // pared a la que se mira (o hacia la que se gira)
    this.from = null;       // pared de la que viene (durante el giro)
    this.dir = 0;           // -1 izquierda, 1 derecha
    this.k = 1;             // progreso del giro (1 = quieto)
    this.queue = [];        // giros pendientes (goTo)
    this.edge = null;       // borde bajo el ratón ('left' / 'right')
    this.hoverT = 0;
    this.armed = true;
    this.time = 0;
  }

  get moving() {
    return this.from !== null;
  }

  /** ¿No está mirando al frente (o está girando)? */
  get turned() {
    return this.face !== 'front' || this.moving;
  }

  get facingBack() {
    return this.face === 'back' && !this.moving;
  }

  /** ¿Está quieto mirando a esa pared? */
  isFacing(face) {
    return this.face === face && !this.moving;
  }

  hover(x, y) {
    const E = CONFIG.OFFICE_TURN.EDGE;
    this.edge = !this.enabled ? null : x < E ? 'left' : x > W - E ? 'right' : null;
    return !!this.edge;
  }

  /** Un giro de 90° (dir -1: a la izquierda, 1: a la derecha). */
  step(dir) {
    if (this.moving) return false;
    const i = FACES.indexOf(this.face);
    this.from = this.face;
    this.face = FACES[(i + dir + 4) % 4];
    this.dir = dir;
    this.k = 0;
    this.onTurn?.(this.face);
    return true;
  }

  /** Girar hasta `face`, de 90° en 90° (al pasillo central, siempre por un lado). */
  goTo(face) {
    this.queue = [];
    const i = FACES.indexOf(this.moving ? this.face : this.face);
    const j = FACES.indexOf(face);
    let d = (j - i + 4) % 4;
    if (d === 0) return false;
    if (d === 3) this.queue = [-1];
    else if (d === 1) this.queue = [1];
    else this.queue = this.face === 'left' || this.from === 'left' ? [-1, -1] : [1, 1];
    if (!this.moving) this.step(this.queue.shift());
    return true;
  }

  /** Compatibilidad con LookBack: girarse hacia atrás (true) o al frente (false). */
  turn(back) {
    return this.goTo(back ? 'back' : 'front');
  }

  toggle() {
    if (!this.enabled) return false;
    return this.goTo(this.face === 'back' ? 'front' : 'back');
  }

  update(dt) {
    this.time += dt;
    if (this.moving) {
      this.k = Math.min(1, this.k + dt / CONFIG.OFFICE_TURN.TURN_TIME);
      if (this.k >= 1) {
        this.from = null;
        if (this.queue.length) this.step(this.queue.shift());
      }
    }
    if (this.edge && this.armed && this.enabled && !this.moving) {
      this.hoverT += dt;
      if (this.hoverT >= CONFIG.OFFICE_TURN.DWELL) {
        this.queue = [];
        this.step(this.edge === 'left' ? -1 : 1);
        this.armed = false;
        this.hoverT = 0;
      }
    } else if (!this.edge) {
      this.armed = true;
      this.hoverT = 0;
    }
  }

  /** views: { front, left, right, back }, cada una dibuja su pared a pantalla completa. */
  draw(ctx, views) {
    if (!this.moving) return views[this.face](ctx);
    // Giro: la pared de antes se va hacia un lado y entra la nueva por el otro
    const e = this.k * this.k * (3 - 2 * this.k);
    const s = this.dir;   // girar a la derecha: lo nuevo entra por la derecha
    ctx.save();
    ctx.translate(-s * e * W, 0);
    views[this.from](ctx);
    ctx.restore();
    ctx.save();
    ctx.translate(s * (1 - e) * W, 0);
    views[this.face](ctx);
    ctx.restore();
    // Sombra en la esquina que pasa por delante y un poco de desenfoque de movimiento
    const cx = s > 0 ? (1 - e) * W : e * W;
    const g = ctx.createLinearGradient(cx - 160, 0, cx + 160, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, `rgba(0,0,0,${0.55 * Math.sin(Math.PI * this.k)})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 160, 0, 320, H);
    ctx.fillStyle = `rgba(0,0,0,${0.18 * Math.sin(Math.PI * this.k)})`;
    ctx.fillRect(0, 0, W, H);
  }

  /** Flechas en los bordes: tenues siempre, marcadas con el ratón encima. */
  drawEdges(ctx) {
    if (!this.enabled || this.moving) return;
    const E = CONFIG.OFFICE_TURN.EDGE;
    ctx.save();
    for (const side of ['left', 'right']) {
      const hot = this.edge === side;
      const i = FACES.indexOf(this.face);
      const next = FACES[(i + (side === 'left' ? -1 : 1) + 4) % 4];
      const x0 = side === 'left' ? 0 : W - E;
      const g = ctx.createLinearGradient(side === 'left' ? 0 : W, 0, side === 'left' ? E : W - E, 0);
      g.addColorStop(0, `rgba(125,255,176,${hot ? 0.16 : 0.05})`);
      g.addColorStop(1, 'rgba(125,255,176,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x0, 0, E, H);
      const cx = side === 'left' ? 24 : W - 24;
      const cy = H / 2;
      const d = side === 'left' ? -1 : 1;
      ctx.strokeStyle = `rgba(125,255,176,${hot ? 0.85 : 0.25})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - d * 8, cy - 16);
      ctx.lineTo(cx + d * 8, cy);
      ctx.lineTo(cx - d * 8, cy + 16);
      ctx.stroke();
      if (hot) {
        ctx.save();
        ctx.translate(cx - d * 4, cy);
        ctx.rotate(-d * Math.PI / 2);
        ctx.fillStyle = 'rgba(125,255,176,0.85)';
        ctx.font = '13px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(NAMES[next], 0, d * -22);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  /** Compatibilidad con LookBack. */
  drawStrips(ctx) {
    this.drawEdges(ctx);
  }
}
