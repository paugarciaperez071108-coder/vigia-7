// =============================================================
// Aberracion7.js — LA ABERRACIÓN en la noche 7 (v0.91, Fase 4). Valores en
// NIGHT7.ABERRACION (src/night/night7.js). La lleva Night7.
//
// Estados (sala):
//   'lab'      en casa (detrás de la pared que reventó en la noche 6)
//   'mess'…    por su ruta (una de RUTAS, al azar), una sala cada EN_SALA s; se la
//              ve en la cámara de cada sala (renders sala_<sala>)
//   'pasillo'  dentro del pasillo central, en la posición pos (0 = al fondo,
//              POSICIONES-1 = pegada a la compuerta); avanza cada PASO s.
//              Solo se la ve con la linterna (desde la pared de atrás).
//   'puerta'   en la compuerta: dedos, respiraciones, el metal que se comba y,
//              a veces, la voz del hombre. Si en EN_PUERTA s no la echas: ataca.
//   'lado'     (v0.94) en una puerta de los lados (lado: 'left' | 'right'), al final de las
//              rutas por el C. Oeste o el C. Este. Se la oye (dedos, respiraciones, el metal)
//              y, con la luz de esa puerta, se la ve en el hueco. Si al acabar EN_PUERTA_LADO s
//              la puerta está cerrada, la golpea y se va; si no, entra (jumpscare).
//   'reactor'  (2:00 → 3:00) agarrada al núcleo (CAM 04): lo enfría DRAIN %/s.
//              El señuelo en una sala vecina la saca de allí; entonces va a por ti.
//   'huye'     echada con la luz: vuelve a casa (o al reactor, si toca).
// La luz: con el haz encima (pasillo o puerta) no avanza, retrocede una
// posición cada RETROCEDE s y el anillo se llena; con LUZ_TOTAL s seguidos, huye.
// Si se suelta antes, el anillo baja (×LUZ_BAJA) y vuelve a avanzar.
// Dibujo: renders de tools/3d/n7/ (assets/n7/aberracion/, índice.json); si
// faltan, una silueta provisional.
// =============================================================

import { CONFIG } from '../config.js';
import { NIGHT7 } from '../night/night7.js';
import { BACK_HATCH } from '../render/BackView.js';

const A = NIGHT7.ABERRACION;
const lerp = (a, b, k) => a + (b - a) * k;
const entre = (par, k) => { const lo = lerp(par[0][0], par[1][0], k); const hi = lerp(par[0][1], par[1][1], k); return lo + Math.random() * (hi - lo); };

// Los renders (tools/3d/n7/aberracion_pasillo.py y aberracion_reactor.py)
const IMG = {};
let INDICE = null;
fetch('assets/n7/aberracion/indice.json').then((r) => (r.ok ? r.json() : null)).then((j) => { INDICE = j; precargar(); }).catch(() => {});
/** Todos los renders, ya (si no, la primera vez sale la silueta provisional mientras cargan). */
function precargar() {
  for (const [p, n] of Object.entries(INDICE?.pasillo ?? {})) for (let k = 0; k < n; k++) img(`pasillo_${p}_${k}`);
  for (let k = 0; k < (INDICE?.reactor ?? 0); k++) img(`reactor_${k}`);
  for (const [clave, n] of Object.entries(INDICE ?? {})) if (clave.startsWith('sala_') || clave.startsWith('puerta_')) for (let k = 0; k < n; k++) img(`${clave}_${k}`);
}
function img(nombre) {
  let i = IMG[nombre];
  if (!i) {
    i = IMG[nombre] = new Image();
    i.src = `assets/n7/aberracion/${nombre}.webp`;
  }
  return i.complete && i.naturalWidth ? i : null;
}

// (v0.99) El fuego que se le pega: puntos de su cuerpo en cada render (donde la imagen no es
// transparente), para poner las llamas encima, y su silueta teñida de brasa
const PUNTOS = {};
const MUESTRA = document.createElement('canvas');
MUESTRA.width = 160;
MUESTRA.height = 90;
function puntosDe(im) {
  let p = PUNTOS[im.src];
  if (p) return p;
  const c = MUESTRA.getContext('2d', { willReadFrequently: true });
  c.clearRect(0, 0, 160, 90);
  c.drawImage(im, 0, 0, 160, 90);
  let d;
  try { d = c.getImageData(0, 0, 160, 90).data; } catch { return (PUNTOS[im.src] = []); }
  const todos = [];
  for (let y = 2; y < 88; y += 2) {
    for (let x = 2; x < 158; x += 2) {
      // (solo donde hay cuerpo y encima está vacío o es borde: las llamas salen de arriba y de los lados)
      if (d[(y * 160 + x) * 4 + 3] > 150 && d[((y - 2) * 160 + x) * 4 + 3] < 200) todos.push([x * 10, y * 10]);
    }
  }
  p = [];
  for (let k = 0; k < 12 && todos.length; k++) p.push(todos.splice(Math.floor(Math.random() * todos.length), 1)[0]);
  return (PUNTOS[im.src] = p);
}
const BRASA = document.createElement('canvas');
BRASA.width = 400;
BRASA.height = 225;

export class Aberracion7 {
  constructor(n7) {
    this.n7 = n7;
    this.g = n7.g;
    this.reset(false);
    this.g.events.on('lure', ({ room }) => this._senuelo(room));
  }

  reset(activa) {
    this.activa = activa;
    this.sala = A.CASA;
    this.pos = 0;
    this.t = 0;                   // s hasta el siguiente paso
    this.luz = 0;                 // 0..1, el anillo
    this.luzRetro = 0;            // s de luz acumulados para retroceder una posición
    this.lit = false;
    this.ruta = null;             // la ruta de este viaje (NIGHT7.ABERRACION.RUTAS)
    this.paso = 0;                // por dónde va en ella
    this.objetivo = 'oficina';    // 'oficina' | 'reactor'
    this.enReactor = 0;
    this.avisoIn = 0;
    this.puertaSon = 0;           // s hasta el siguiente sonido en la compuerta
    this.vozDicha = false;
    this.anim = 0;
    this.ardor = 0;               // 0..1, el fuego que lleva encima (v0.99: al cruzar una sala que arde)
    if (activa) this.t = entre(A.EN_CASA, 0) * 0.6;
  }

  /** 0 a las 12 → 1 a las 6. */
  get k() {
    const c = this.g.clock;
    return Math.min(1, c.elapsed / (CONFIG.NIGHT_HOURS * c.sph));
  }

  get enPasillo() {
    return this.sala === 'pasillo' || this.sala === 'puerta';
  }

  /** Lo que se ve en el plano (sala) o null en el pasillo. */
  get room() {
    return this.enPasillo || this.sala === 'huye' || this.sala === 'lado' ? null : this.sala;
  }

  // --- Cada fotograma ---------------------------------------------------------------
  update(dt, lit) {
    if (!this.activa) return;
    this.anim += dt;
    this.lit = lit && this.enPasillo;
    // El fuego se le pega al cruzar una sala que arde; se le va apagando despacio
    const ro = this.n7.rotura;
    if (this.room && ro?.salaArde(this.room)) this.ardor = Math.min(1, this.ardor + dt / A.ARDE_PRENDE);
    else this.ardor = Math.max(0, this.ardor - dt / A.ARDE_DURA);
    const k = this.k;
    const n7 = this.n7;
    // (v0.93: desde las 12 —antes, desde las 2— y hasta el núcleo, en cada viaje puede ir a por el reactor;
    // se decide al salir de casa, en _paso)
    if (n7.nucleo && this.objetivo === 'reactor') this.objetivo = 'oficina';
    // La luz
    if (this.enPasillo) {
      if (this.lit) {
        this.luz = Math.min(1, this.luz + dt / A.LUZ_TOTAL);
        this.luzRetro += dt;
        if (this.luzRetro >= A.RETROCEDE) {
          this.luzRetro = 0;
          this.fotograma = Math.floor(Math.random() * 3);
          this._parpadeo();
          if (this.sala === 'puerta') { this.sala = 'pasillo'; this.pos = A.POSICIONES - 1; }
          else this.pos = Math.max(0, this.pos - 1);
          this.g.events.emit('aberracionRetrocede', { pos: this.pos });
          n7.sonido('retrocede', { volume: 0.7 });
        }
        if (this.luz >= 1) {
          this._huye();
          return;
        }
        return;                    // (con la luz encima no avanza)
      }
      this.luz = Math.max(0, this.luz - dt / A.LUZ_TOTAL * A.LUZ_BAJA);
      this.luzRetro = 0;
    }
    this.t -= dt;
    if (this.sala === 'puerta') {
      this._sonidosPuerta(dt);
      if (this.t <= 0) this._ataca();
      return;
    }
    if (this.sala === 'lado') {
      this._sonidosPuerta(dt, this.lado === 'left' ? -0.8 : 0.8);
      if (this.t <= 0) {
        if (this.g.office.doors[this.lado].closed) this._golpeaPuerta();
        else this._ataca();
      }
      return;
    }
    if (this.sala === 'reactor' && this.objetivo === 'reactor') {
      this.enReactor += dt;
      this.avisoIn -= dt;
      if (this.avisoIn <= 0) {
        this.avisoIn = A.AVISO_REACTOR;
        this.g.alerta?.('⚠ REACTOR – temperatura descendiendo', 'danger');
      }
      if (this.enReactor >= A.EN_REACTOR_MAX) this._dejaReactor('mess');
      return;
    }
    if (this.t > 0) return;
    this._paso(k);
  }

  /** El siguiente paso (por las salas, por el pasillo o a la compuerta). */
  _paso(k) {
    if (this.sala === 'huye') {
      this.sala = A.CASA;
      this.ruta = null;
      this.t = entre(A.EN_CASA, k);
      return;
    }
    if (this.sala === 'pasillo') {
      if (this.pos < A.POSICIONES - 1) {
        this.pos++;
        this.t = entre(A.PASO, k);
        this.fotograma = Math.floor(Math.random() * 3);
        this._parpadeo();
        this.n7.sonido('arrastre', { volume: 0.45 + 0.12 * this.pos, pan: 0 });
        this.g.events.emit('aberracionPaso', { pos: this.pos });
      } else {
        this.sala = 'puerta';
        this.t = entre(A.EN_PUERTA, k);
        this.fotograma = Math.floor(Math.random() * 3);
        this._parpadeo();
        this.puertaSon = 0;
        this.vozDicha = false;
        this.g.events.emit('enemyAtDoor', { side: 'back', enemy: 'aberracion' });
      }
      return;
    }
    // Por las salas. Al salir de casa: ¿a por ti o a por el reactor? (hasta el núcleo)
    if (this.sala === A.CASA && !this.ruta && this.objetivo !== 'reactor' && !this.n7.nucleo && !this.vinoReactor
        && Math.random() < A.A_POR_EL_REACTOR) this.objetivo = 'reactor';
    if (this.objetivo === 'reactor') {
      this.sala = 'reactor';
      this.enReactor = 0;
      this.avisoIn = 0;
      this.vinoReactor = true;
      this.g.events.emit('aberracionReactor', {});
      this.n7.sonido('golpe_reactor', { volume: 0.5 });
      return;
    }
    if (!this.ruta) {
      // Un viaje nuevo: una ruta al azar (desde donde esté: si no es su principio, la más corta)
      const posibles = A.RUTAS.filter((r) => r[0] === this.sala);
      this.ruta = posibles.length ? posibles[Math.floor(Math.random() * posibles.length)] : [this.sala, 'mess'];
      this.paso = 0;
    }
    if (this.paso < this.ruta.length - 1) {
      this.paso++;
      const sig = this.ruta[this.paso];
      if (sig === 'left_door' || sig === 'right_door') {
        // En una puerta de los lados
        this.sala = 'lado';
        this.lado = sig === 'left_door' ? 'left' : 'right';
        this.t = entre(A.EN_PUERTA_LADO, k);
        this.puertaSon = 0;
        this.vozDicha = false;
        this.fotograma = Math.floor(Math.random() * 2);
        this.g.events.emit('enemyAtDoor', { side: this.lado, enemy: 'aberracion' });
        this.n7.sonido('arrastre', { volume: 0.7, pan: this.lado === 'left' ? -0.8 : 0.8 });
        return;
      }
      this.sala = sig;
      this.t = entre(A.EN_SALA, k);
      this.fotogramaSala = Math.floor(Math.random() * 2);   // (una pose por visita: quieta)
      this.g.events.emit('aberracionSala', { room: this.sala });
      return;
    }
    this.ruta = null;
    // Del Comedor, al pasillo central (se la oye entrar)
    this.sala = 'pasillo';
    this.pos = 0;
    this.t = entre(A.PASO, k);
    this.n7.sonido('arrastre', { volume: 0.35 });
    this.g.events.emit('aberracionPasillo', {});
  }

  /** Al cambiar de posición en el pasillo: si se la está alumbrando, la linterna falla un instante
   * (como El Largo en la noche 3): no se la ve «saltar» de un sitio a otro. */
  _parpadeo() {
    if (this.lit || this.g.lookBack.facingBack) this.g.backFlash.cutOut?.(0.12 + Math.random() * 0.1);
  }

  _sonidosPuerta(dt, pan = 0) {
    this.puertaSon -= dt;
    if (this.puertaSon > 0) return;
    this.puertaSon = 0.7 + Math.random() * 0.6;
    const n7 = this.n7;
    const r = Math.random();
    if (r < 0.45) n7.sonido('dedos', { volume: 0.9, pan });
    else if (r < 0.75) n7.sonido('respiraciones', { volume: 0.85, pan });
    else n7.sonido('metal', { volume: 0.8, pan });
    if (!this.vozDicha && Math.random() < A.VOZ_HOMBRE * dt * 4) {
      this.vozDicha = true;
      n7.sonido(Math.random() < 0.5 ? 'voz_vale' : 'voz_abre', { volume: 0.9, pan });
    }
  }

  /** La puerta de los lados estaba cerrada: la golpea y se va a casa. */
  _golpeaPuerta() {
    this.g.events.emit('doorBlocked', { side: this.lado });
    this.n7.sonido('golpe_reactor', { volume: 0.9, pan: this.lado === 'left' ? -0.8 : 0.8 });
    this.g.events.emit('aberracionGolpea', { side: this.lado });
    this.sala = 'huye';
    this.ruta = null;
    this.t = 1.6;
    this.vinoReactor = false;
  }

  _huye() {
    this.luz = 0;
    this.luzRetro = 0;
    this.sala = 'huye';
    this.t = 1.6;
    this.g.events.emit('aberracionHuye', {});
    this.n7.sonido('huye', { volume: 0.9 });
    // (desde las 2:00 y antes del núcleo, vuelve al reactor)
    this.vinoReactor = false;
  }

  _ataca() {
    this.sala = A.CASA;
    this.ruta = null;
    this.t = entre(A.EN_CASA, this.k);
    this.g._attack?.({ id: 'aberracion' });
  }

  /** El señuelo en una cámara: si está en el reactor y es una sala vecina, va hacia allí… y luego a por ti. */
  /** ¿Está agarrada al núcleo (y no solo pasando por el Reactor)? */
  get enElNucleo() {
    return this.activa && this.sala === 'reactor' && this.objetivo === 'reactor';
  }

  _senuelo(room) {
    if (!this.enElNucleo) return;
    if (!A.REACTOR_VECINAS.includes(room)) return;
    this._dejaReactor(room);
  }

  _dejaReactor(room) {
    this.objetivo = 'oficina';
    this.sala = room;
    // (desde la sala del señuelo, al Comedor y al pasillo)
    this.ruta = room === 'mess' ? ['mess'] : [room, 'reactor', 'mess'];
    this.paso = 0;
    this.t = entre(A.EN_SALA, this.k);
    this.g.events.emit('aberracionDejaReactor', { room });
    this.g.alerta?.('REACTOR: la temperatura vuelve a subir', 'warn');
  }

  // --- Dibujo ---------------------------------------------------------------------------
  /** En una puerta de los lados, con su luz encendida y abierta: en el hueco (renders puerta_<lado>). */
  drawPuerta(ctx, face) {
    if (!this.activa || this.sala !== 'lado' || this.lado !== face) return;
    const of = this.g.office;
    if (of.doors[face].closed || (of.doors[face].anim ?? 0) > 0.4) return;
    const r = { x: 608, y: 242, w: 384, h: 480 };     // el hueco de la puerta (nave.py OF_HUECOS)
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    if (of.lights[face]) {
      const n = INDICE?.[`puerta_${face}`] ?? 0;
      const im = n ? img(`puerta_${face}_${(this.fotograma ?? 0) % n}`) : null;
      // (v1.14: sin su render, nada: nunca un rectángulo en su lugar)
      if (im) { ctx.drawImage(im, 0, 0, CONFIG.WIDTH, CONFIG.HEIGHT); this._arde(ctx, im); }
    }
    ctx.restore();
  }

  /** En el pasillo central (Game la dibuja dentro del haz de la linterna). */
  drawCorridor(ctx) {
    if (!this.activa || !this.enPasillo) return;
    const p = this.sala === 'puerta' ? A.POSICIONES : this.pos;
    const n = INDICE?.pasillo?.[`p${p}`] ?? 0;
    if (n) {
      // (v0.93, el usuario: «en el pasillo se ve bastante raro»: antes cambiaba de fotograma 6 veces
      // por segundo; ahora uno por posición, que cambia al dar cada paso, tras un fallo de la linterna)
      const im = img(`pasillo_p${p}_${(this.fotograma ?? 0) % n}`);
      if (im) {
        ctx.drawImage(im, 0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
        this._arde(ctx, im);
        return;
      }
    }
    this._silueta(ctx, p);
  }

  /** Provisional (sin renders): la masa que llena el pasillo, con brazos en paredes y techo. */
  _silueta(ctx, p) {
    const r = BACK_HATCH;
    const k = (p + 1) / (A.POSICIONES + 1);
    const cx = r.x + r.w / 2 + Math.sin(this.anim * 3.1) * 6;
    const cy = r.y + r.h * (0.42 + 0.18 * k);
    const w = r.w * (0.25 + 0.85 * k);
    const h = r.h * (0.25 + 0.8 * k);
    ctx.save();
    ctx.fillStyle = 'rgba(40,26,24,0.97)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, w / 2, h / 2, Math.sin(this.anim * 2) * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,50,44,0.95)';
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + Math.sin(this.anim * 4 + i) * 0.08;
      ctx.lineWidth = 6 + 14 * k;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * w * 0.3, cy + Math.sin(a) * h * 0.3);
      ctx.lineTo(cx + Math.cos(a) * w * 0.75, cy + Math.sin(a) * h * 0.72);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** En una cámara (el reactor, las salas de su ruta). */
  drawRoom(ctx, room) {
    if (!this.activa || room !== this.sala) return;
    // (en el reactor: agarrada al núcleo solo si ha ido a por él; si pasa por allí, como en las demás)
    const clave = room === 'reactor' && this.objetivo === 'reactor' ? 'reactor' : `sala_${room}`;
    const n = INDICE?.[clave] ?? 0;
    if (n) {
      // (v0.93, el usuario: «en las cámaras se mueve raro»: en cada sala, quieta en una pose; en el
      // núcleo, el bucle, más despacio)
      const im = img(`${clave}_${clave === 'reactor' ? Math.floor(this.anim * 4) % n : (this.fotogramaSala ?? 0) % n}`);
      if (im) {
        ctx.drawImage(im, 0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
        this._arde(ctx, im);
        return;
      }
    }
    // (provisional) una masa oscura en el centro de la imagen
    ctx.save();
    ctx.fillStyle = 'rgba(30,20,18,0.92)';
    ctx.beginPath();
    ctx.ellipse(800 + Math.sin(this.anim * 5) * 8, 520, 260, 200, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** El fuego que lleva pegado (v0.99): la carne en brasa y llamas que le salen del cuerpo. */
  _arde(ctx, im) {
    const k = this.ardor;
    if (k < 0.02) return;
    // La silueta, teñida de brasa (solo su cuerpo: source-atop sobre su propia imagen)
    const b = BRASA.getContext('2d');
    b.globalCompositeOperation = 'source-over';
    b.clearRect(0, 0, 400, 225);
    b.drawImage(im, 0, 0, 400, 225);
    b.globalCompositeOperation = 'source-atop';
    const vi = 0.75 + 0.25 * Math.sin(this.anim * 11) * Math.sin(this.anim * 6.3);
    const g = b.createLinearGradient(0, 0, 0, 225);
    g.addColorStop(0, 'rgba(255,150,50,0.9)');
    g.addColorStop(1, 'rgba(200,50,10,0.6)');
    b.fillStyle = g;
    b.fillRect(0, 0, 400, 225);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, 0.45 * k * vi);
    ctx.drawImage(BRASA, 0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    ctx.restore();
    // Las llamas, de los bordes de arriba de su cuerpo (más cuanto más arde)
    const pts = puntosDe(im);
    const n = Math.round(pts.length * Math.min(1, 0.3 + k));
    const t = this.anim;
    // (el humo negro que sueltan, encima)
    ctx.save();
    for (let i = 0; i < n; i += 3) {
      const [x, y] = pts[i];
      const sube = ((t * 0.6 + i * 0.37) % 1);
      const r = 40 + 70 * sube;
      const g2 = ctx.createRadialGradient(x, y - 60 - 160 * sube, 0, x, y - 60 - 160 * sube, r);
      g2.addColorStop(0, `rgba(12,10,9,${0.35 * k * (1 - sube)})`);
      g2.addColorStop(1, 'rgba(12,10,9,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(x - r, y - 60 - 160 * sube - r, r * 2, r * 2);
    }
    ctx.restore();
    // (v1.14) Las llamas: el fuego simulado en Blender (fuego_sprite.py, el bucle de la rejilla ardiendo),
    // en los bordes de arriba de su cuerpo; nada de llamas dibujadas
    const rot = this.g.n7?.rotura;
    if (!rot) return;
    for (let i = 0; i < n; i += 4) {
      const [x, y] = pts[i];
      const lado = (60 + ((i * 13) % 5) * 14) * (0.6 + 0.5 * k);
      rot.llama(ctx, x, y + 12, lado, i, Math.min(1, 0.35 + k * 0.6));
    }
  }

  /** El anillo de la luz (alrededor del haz) mientras se la alumbra o mientras baja. */
  drawAnillo(ctx, mx, my) {
    if (!this.activa || !this.enPasillo || this.luz <= 0.01) return;
    ctx.save();
    ctx.lineWidth = 7;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(mx, my, 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = this.lit ? 'rgba(255,235,200,0.92)' : 'rgba(255,170,120,0.6)';
    ctx.beginPath();
    ctx.arc(mx, my, 46, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.luz);
    ctx.stroke();
    ctx.restore();
  }
}
