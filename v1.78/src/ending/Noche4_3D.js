// =============================================================
// Noche4_3D.js — (v1.58, plan «noches 2 y 4 con movimiento libre», fase N3; «haz lo de las noches») EL INICIO DE LA
// NOCHE 4 EN 3D, con la misma lógica de src/ending/Night4Start.js (valores en NIGHT4.REBOOT) y sin energía:
//   Se sale de la taquilla (sigue siendo la vista de siempre) y se aparece en la oficina a oscuras, con la linterna
//   encendida. Las compuertas de los lados no se mueven; la de atrás da al PASILLO CENTRAL.
//   · A la izquierda del pasillo, EL PANEL DE REINICIO, que solo se ve con la linterna (E o clic: la vista de cerca de
//     siempre). Es la ruta A: mantener ESPACIO con la tapa abierta sube el %. Mientras tanto se acerca El Largo: hay que
//     cerrar el panel, girarse y darle con la luz en la cara. Al 100 %, vuelve la energía y empieza el turno.
//   · Al fondo, la compuerta hacia el Comedor, abierta (v1.75, el usuario: «solo abierta la del final del pasillo» y que
//     la ruta B siga andando): se cruza andando y se está en el Comedor, sin fundido ni E. Es la ruta B.
//   (v1.75) Las compuertas de los lados son sus hojas reales (las mismas de las noches), bajadas: R.piezas en noches3d.js.
// Si El Largo llega: el susto de siempre (Game._n4Death) y, con la ruta A elegida, se vuelve al panel (punto n4reboot).
// =============================================================

import { NochesBase } from './Noches3D.js';
import { NIGHT4 } from '../night/night4.js';
import { CONFIG } from '../config.js';

const W = CONFIG.WIDTH, H = CONFIG.HEIGHT;
const RB = NIGHT4.REBOOT;
const S = NIGHT4.START;
const rand = ([a, b]) => a + Math.random() * (b - a);

// el panel, en la pared de la izquierda según se entra (Blender x, y, z)
// (v1.76) el centro del panel de reinicio (panel_reinicio.py: el CRT a 1,70 m), 20 cm por delante de la pared (y = -43,6)
export const PANEL = [101.0, -43.8, 1.5];
// (v1.75) el fondo del pasillo central (x 141, su pared quitada en la Noche 4) da al Comedor: allí se pone una copia del
// Comedor girada (R.piezas), con su compuerta este (x 70,15, y -30) en el fondo del pasillo (x 141, y -45):
// copia = giro π · real + en. Al pasar de `cruza` ya estás en el Comedor de verdad (sigue la ruta B sin cortes); con la
// ruta A empezada, no se pasa de `tope`.
export const COMEDOR = { giro: Math.PI, en: [211.15, -75.0], cruza: 141.6, tope: 140.3, corte: 140.995 };
// delante del panel, mirándolo (punto de control)
const ANTE_PANEL = { x: 101.0, y: -44.9 };
// dónde se asoma El Largo (al fondo del pasillo, en su mismo eje)
const SITIOS_LARGO = [[109.5, -45.0], [108.0, -45.0]];

export class Noche4 extends NochesBase {
  constructor(L, o = {}) {
    super(L, { ...o, prueba: null });
    const g = this.g;
    this.ns = g.n4start;
    this.fase = 'anda';
    this.ruta = null;
    this.panel = false;
    this.lid = false;
    this.reboot = 0;
    this.rebootT = 0;
    this.largo = null;
    this.largoIn = rand(RB.PEEK_FIRST);
    this.cinta = false;
    this.negro = 0;
    this.faseT = 0;
    this.msg = null;
    this.msgT = 0;
    L.sinLinterna = false;
    L.linternaOn = true;
    // (v1.76, el usuario: «un objeto 3D de verdad, montado en la pared, y no una lámina plana») el panel de reinicio es
    // Panel3D (lo crea NochesBase con R.panel): el mismo modelo que la vista de cerca; aquí solo se le cambia el modo
    // (v1.75) las compuertas de los lados (sus hojas reales, bajadas: sin energía no se mueven) y la del fondo del pasillo
    // (abierta: al Comedor) son piezas del recorrido (noches3d.js); ya no hay planos dibujados
    this.cruzado = false;
    // (g._noche4Salto: 'panel' = el punto de control de la ruta A, delante del panel; 'pasillo' = el debug)
    if (g._noche4Salto === 'panel') {
      this.ruta = 'A';
      this.colocaAlPanel = true;
    }
    if (g._noche4Salto === 'pasillo') this.colocaAlPasillo = true;
    if (g._noche4Salto === 'fondo') this.colocaAlFondo = true;       // (v1.75, debug: cerca del fondo del pasillo)
    g._noche4Salto = null;
  }

  stop() {
    super.stop();
    this.ns.spaceDown = false;
  }

  _di(t, s = 2.5) { this.msg = t; this.msgT = s; }
  _son(clave, o = {}) { this.g.audio?.lib?.play(clave, { pitchVar: 0.05, ...o }); }

  _miras(p, d, ang) {
    const L = this.L;
    const dx = p[0] - L.x, dy = p[1] - L.y, dz = p[2] - (L.ojosZ ?? 1.65);
    const dist = Math.hypot(dx, dy, dz);
    if (dist > d) return false;
    const fx = Math.cos(L.yaw) * Math.cos(L.pitch), fy = Math.sin(L.yaw) * Math.cos(L.pitch), fz = Math.sin(L.pitch);
    return Math.acos(Math.max(-1, Math.min(1, (dx * fx + dy * fy + dz * fz) / dist))) < ang;
  }

  /** Lo que se puede usar ahora (E o clic). El panel, solo si la linterna le da: sin luz no existe. */
  _usable() {
    if (this.fase !== 'anda' || this.panel) return null;
    if (this.L.linternaOn && this._miras(PANEL, 2.4, 0.5)) return 'panel';
    return null;
  }

  _usa() {
    const u = this._usable();
    if (!u) return false;
    if (u === 'panel') this._abrePanel();
    return true;
  }

  /** (v1.75) El fondo del pasillo: con la ruta A empezada no hay vuelta atrás (como antes con la compuerta); si no, al
   *  cruzarlo ya estás en el Comedor de verdad y empieza la ruta B donde estás, andando (Game._startN4Repair sigue). */
  _fondo(dt) {
    const L = this.L, C = COMEDOR;
    if (this.cruzado || L.x <= C.tope) return;
    if (this.ruta === 'A') {
      L.x = C.tope;
      L.vx = Math.min(0, L.vx);
      if (this.msgT <= 0) {
        this.g.audio?.denied?.('center');
        this._di('No hay tiempo. El panel.', 2.5);
      }
      return;
    }
    if (L.x <= C.cruza) return;
    // (la ruta B, ya cargada mientras andabas; si aún no, esperas en el umbral un momento)
    this.esperaT = (this.esperaT ?? 0) + dt;
    if (!L.precargado?.('noche4b') && this.esperaT < 6) {
      L.x = C.cruza - 0.02;
      L.vx = Math.min(0, L.vx);
      return;
    }
    this.cruzado = true;
    const [tx, ty] = C.en;
    L.x = tx - L.x;
    L.y = ty - L.y;
    L.yaw += Math.PI;
    L.vx = -L.vx;
    L.vy = -L.vy;
    this.ruta = 'B';
    this.g._n4Choose('B');
    this.g._noche4bPasillo = true;
    this.g._startN4Repair({ sigue: true });
  }

  _abrePanel() {
    if (!this.ruta) {
      this.ruta = 'A';
      this.g._n4Choose('A');
      this.g._n4Save?.('n4reboot');
      this._di('MANTEN ESPACIO para pulsar el boton   ·   E: cerrar el panel', 4);
    }
    this.panel = true;
    this.lid = true;
    this.yaw0 = this.L.yaw;
    this.pitch0 = this.L.pitch;
    this.L.teclas.clear();
    this._son('metal/panel', { volume: 0.5 });
    if (!this.cinta) {
      // la cinta del hombre (ruta A): suena sola la primera vez que se abre el panel
      this.cinta = true;
      this.g.tape?.schedule('4A', { autoplay: true, contexto: 'panel_n4' });
    }
  }

  _cierraPanel() {
    this.panel = false;
    this.lid = false;
    this.ns.spaceDown = false;
    this._son('metal/panel', { volume: 0.35 });
  }

  click() {
    if (this.susto || this.fase !== 'anda') return true;
    if (this.panel) {
      this._cierraPanel();
      return true;
    }
    return document.pointerLockElement === this.g.canvas && this._usa();
  }

  tecla(code) {
    if (this.susto || this.fase !== 'anda') return true;
    const tape = this.g.tape;
    if (tape?.playing && code === 'KeyM') { tape.stop(); return true; }
    if (this.panel) {
      if (code === 'KeyE' || code === 'Escape') this._cierraPanel();
      return code !== 'KeyL';      // (ESPACIO es el botón, no la linterna; L vuelve a escuchar la cinta)
    }
    if (code === 'KeyE') return this._usa() || true;
    return false;
  }

  _largoViene() {
    if (this.g.n4dbg?.off.has('largo')) return void (this.largoIn = rand(RB.PEEK_EVERY));
    this.largo = { t: 0, e: null };
    [0.25, 0.35, 0.5].forEach((v, i) => this._son('largo/pasos', { volume: v, when: i * 0.55, muffle: 0.5 - i * 0.15 }));
  }

  ataca(enemigo, por) {
    if (this.g.n4dbg?.invincible) {
      this.asomados.quitaTodos();
      this.largo = null;
      this.largoIn = rand(RB.PEEK_EVERY);
      return;
    }
    if (this.fase === 'muerto') return;
    this.fase = 'muerto';
    this.L.stop();
    this.g._n4Death(enemigo);
    this.g.deathCause = 'n4_reboot';
  }

  update(dt) {
    const L = this.L, g = this.g;
    this.t += dt;
    this.msgT = Math.max(0, this.msgT - dt);
    if (this.colocaAlPanel) {
      this.colocaAlPanel = false;
      L.x = ANTE_PANEL.x;
      L.y = ANTE_PANEL.y;
      L.yaw = Math.PI / 2;
      L.pitch = 0;
    }
    if (this.colocaAlFondo) {
      this.colocaAlFondo = false;
      L.x = 134.0;
      L.y = -45.0;
      L.yaw = 0;
      L.pitch = 0;
    }
    if (this.colocaAlPasillo) {
      this.colocaAlPasillo = false;
      L.x = 97.0;
      L.y = -45.0;
      L.yaw = 0;
      L.pitch = 0;
    }
    if (this.cruzado) return null;      // (v1.75: ya en el Comedor; enseguida sigue la ruta B)
    if (this.fase === 'anda' && !this.panel) this._fondo(dt);
    if (this.cruzado) return null;
    if (this.fase === 'luces') {
      this.faseT += dt;
      if (this.faseT >= S.LIGHTS_ON) {
        L.stop();
        g._n4Begin('A', { headStart: this.rebootT });
      }
      return 'para';
    }
    if (this.fase === 'muerto') return 'para';
    if (this.panel) {
      // (con el panel abierto no se anda ni se gira)
      L.teclas.clear();
      L.yaw = this.yaw0;
      L.pitch = this.pitch0;
      const pulsa = this.lid && L.pulsadas?.has('Space');
      this.ns.spaceDown = !!pulsa;
      if (pulsa) {
        this.reboot = Math.min(100, this.reboot + RB.SPEED * dt);
        this.rebootT += dt;
        if (Math.random() < dt * 2) this._son('ambiente/chispazo', { volume: 0.1 });
        if (this.reboot >= 100) return this._vuelveLaLuz();
        if (!this.largo) {
          this.largoIn -= dt;
          if (this.largoIn <= 0) this._largoViene();
        }
      }
    }
    // El Largo: se le oye venir por el pasillo y se asoma; no se va hasta que le das con la luz en la cara
    const K = this.largo;
    if (K) {
      K.t += dt;
      if (!K.e && K.t >= RB.PEEK_LLEGA) {
        K.e = this.asomados.nuevo('largo', SITIOS_LARGO, { facil: { find: RB.PEEK_TIME_3D, retire: RB.PEEK_LIGHT }, pose: 'lean' });
        this._son('largo/respiracion', { volume: 0.9, muffle: 0.2 });
      }
    }
    this.asomados.update(dt);
    if (K?.e && !this.asomados.lista.includes(K.e) && this.fase === 'anda') {
      // se ha retirado
      this.largo = null;
      this.largoIn = rand(RB.PEEK_EVERY);
      [0.6, 0.35, 0.2].forEach((v, i) => this._son('largo/pasos', { volume: v, when: 0.1 + i * 1.0, muffle: 0.3 + i * 0.25 }));
    }
    // lo que dibuja la vista de cerca (la de siempre, de Night4Start)
    const ns = this.ns;
    ns.time = (ns.time ?? 0) + dt;
    ns.lidOpen = this.lid;
    ns.reboot = this.reboot;
    ns.largo = this.largo ? { state: 'peek' } : null;
    return this.fase === 'anda' ? null : 'para';
  }

  _vuelveLaLuz() {
    this.fase = 'luces';
    this.faseT = 0;
    this.ns.spaceDown = false;
    this.largo = null;
    this.asomados.quitaTodos();
    this.g.audio?.powerUp?.();
    this._son('ambiente/chispazo', { volume: 0.6 });
    return 'para';
  }

  coloca() {
    this.asomados.coloca();
    // (v1.76) el panel: con algo de corriente al salir de la taquilla; con la ruta A, cargando; al 100 %, encendido
    if (this.panel3d) this.panel3d.modo = this.fase === 'luces' || this.reboot >= 100 ? 'lleno' : this.ruta === 'A' ? 'carga' : 'reposo';
  }

  draw(ctx) {
    if (this.panel || this.fase === 'luces') {
      this.ns._drawPanel(ctx);
      if (this.fase === 'luces') {
        const k = this.faseT / S.LIGHTS_ON;
        if (Math.random() < 0.55 - 0.5 * k) {
          ctx.fillStyle = `rgba(0,0,0,${0.85 - 0.6 * k})`;
          ctx.fillRect(0, 0, W, H);
        }
        if (k > 0.75) {
          ctx.fillStyle = `rgba(0,0,0,${(k - 0.75) * 4})`;
          ctx.fillRect(0, 0, W, H);
        }
      }
    }
    ctx.save();
    ctx.textAlign = 'center';
    if (this._usable()) {
      ctx.fillStyle = 'rgba(230,235,225,0.75)';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('E', W / 2, H / 2 + 44);
    }
    if (this.msgT > 0 && this.msg) {
      ctx.globalAlpha = Math.min(1, this.msgT);
      ctx.fillStyle = '#d8dcd0';
      ctx.font = '18px monospace';
      ctx.fillText(this.msg, W / 2, H - 70);
    }
    ctx.restore();
  }
}
