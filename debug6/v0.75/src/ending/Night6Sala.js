// =============================================================
// Night6Sala.js — NOCHE 6, FASE 2: LA SALA OCULTA (v0.73).
// (Valores en NIGHT6.SALA, src/night/night6.js.)
//
// Bajas del conducto V4 a una sala pequeña, oscura y con niebla: tuberías
// con escarcha (la fuga de Criogenia de la noche 5 sale de aquí), 3
// válvulas grandes y 9 de paso, y el medidor de la fuga.
//   - Las 3 válvulas grandes se cierran GIRANDO EL RATÓN EN CÍRCULOS
//     sobre ellas (VALVE_TIME s cada una). Si dejas de girar, la válvula
//     vuelve atrás despacio.
//   - El medidor sube con el tiempo (más cuantas más válvulas abiertas)
//     y baja con cada válvula cerrada. Si llega al máximo: muerte
//     («La fuga de Criogenia ha llenado la sala.»).
//   - Detrás, la boca del conducto por el que entraste: El Insecto y El
//     Dislocado vuelven por él. Antes se les oye arrastrarse cada vez más
//     cerca. Hay que girarse (A/D o el ratón en el borde), alumbrar la boca
//     (ESPACIO; sin luz no se les ve) y cerrar la compuerta (clic en la
//     boca). Con la compuerta cerrada NO se pueden girar las válvulas:
//     cerrarla sin motivo te hace perder tiempo.
//   - Con las 3 cerradas, la fuga se para: clic en la boca del conducto
//     (abierta) para volver a subir y regresar a la oficina.
// Renders: tools/3d/n6/sala.py → assets/n6/sala/.
// =============================================================

import { CONFIG } from '../config.js';
import { NIGHT6 } from '../night/night6.js';
import { drawFog, drawEdgeFrost } from '../render/Frost.js';

const S = NIGHT6.SALA;
const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const BASE = 'assets/n6/sala/';
const rand = ([a, b]) => a + Math.random() * (b - a);
const inside = (r, x, y) => r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

let DATOS = null;
const IMG = {};
function img(n) {
  let i = IMG[n];
  if (!i) {
    i = IMG[n] = new Image();
    i.src = BASE + n + '.webp';
  }
  return i.complete && i.naturalWidth ? i : null;
}
function precargar() {
  if (DATOS) return;
  fetch(BASE + 'datos.json').then((r) => r.json()).then((d) => { DATOS = d; }).catch(() => {});
  for (const n of ['frente', 'volante_0', 'volante_1', 'volante_2', 'atras_0', 'atras_1', 'atras_2', 'atras_3', 'atras_4', 'atras_5',
    'insecto_lejos', 'insecto_asomado', 'dislocado_lejos', 'dislocado_asomado']) img(n);
}

export class Night6Sala {
  constructor(game) {
    this.g = game;
    precargar();
  }

  start() {
    this.fase = 'bajada';        // bajada | sala | subir | fuera | muerto
    this.t = 0;
    this.time = 0;
    this.cara = 'frente';        // frente | atras
    this.giro = null;            // { de, a, t }
    this.borde = 0;
    this.mouse = { x: W / 2, y: H / 2 };
    this.ang = null;             // ángulo del ratón alrededor del volante que se gira
    this.spin = 0;               // rad/s (suavizado)
    this.valvulas = Array.from({ length: S.VALVES }, () => ({ p: 0, giro: 0, cerrada: false }));
    this.fuga = S.LEAK_START;
    this.fugaObjetivo = S.LEAK_START;
    this.compuerta = 0;          // 0 abierta … 1 cerrada
    this.compuertaVa = 0;        // hacia dónde va (0 o 1)
    this.luz = false;
    this.enemigo = null;
    this.proxIn = S.FIRST;
    this.turnoInsecto = Math.random() < 0.5;
    this.crujeIn = 0;
    this.siseoIn = 0;
    this.ayuda = 6;
    this.parada = false;          // fuga detenida (las 3 cerradas)
    this.done = false;
  }

  get abiertas() {
    return this.valvulas.filter((v) => !v.cerrada).length;
  }

  // --- Entrada --------------------------------------------------------------
  key(code) {
    if (code === 'Space') this.luz = true;
    if (this.fase !== 'sala' || this.giro) return;
    if (code === 'KeyA' || code === 'KeyD' || code === 'ArrowLeft' || code === 'ArrowRight' || code === 'KeyS') this._girar();
  }

  keyUp(code) {
    if (code === 'Space') this.luz = false;
  }

  move(x, y) {
    this.mouse = { x, y };
    return false;
  }

  click(x, y) {
    if (this.fase !== 'sala' || this.giro || this.cara !== 'atras' || !DATOS) return;
    const b = DATOS.boca;
    const r = { x: b.x - 30, y: b.y - 30, w: b.w + 60, h: b.h + 60 };
    if (!inside(r, x, y)) return;
    if (this.parada && this.compuerta < 0.05 && !this.enemigo) {
      // Con la fuga parada: volver a subir al conducto
      this.fase = 'subir';
      this.t = 0;
      this.g.audio.lib?.play('n6/arrastre', { volume: 0.7 });
      return;
    }
    this.compuertaVa = this.compuertaVa ? 0 : 1;
    this.g.audio.lib?.play(this.compuertaVa ? 'puertas/cierre' : 'puertas/apertura', { volume: 0.7 });
  }

  _girar() {
    this.giro = { de: this.cara, a: this.cara === 'frente' ? 'atras' : 'frente', t: 0 };
    this.ang = null;
  }

  // --- Actualizar ------------------------------------------------------------
  update(dt) {
    if (this.done) return;
    this.time += dt;
    this.t += dt;
    this.ayuda = Math.max(0, this.ayuda - dt);
    const lib = this.g.audio.lib;
    if (this.fase === 'bajada') {
      if (this.t >= 1.6) {
        this.fase = 'sala';
        this.t = 0;
      }
      return;
    }
    if (this.fase === 'subir') {
      if (this.t >= 36 / S.EXIT_FPS + 1.6 && !this.done) {
        this.done = true;
        this.g._n6SalaDone();
      }
      return;
    }
    if (this.fase !== 'sala') return;
    // Girarse
    if (this.giro) {
      this.giro.t += dt;
      if (this.giro.t >= S.TURN_TIME) {
        this.cara = this.giro.a;
        this.giro = null;
      }
    } else {
      const enBorde = this.mouse.x < S.EDGE || this.mouse.x > W - S.EDGE;
      this.borde = enBorde ? this.borde + dt : 0;
      if (this.borde >= S.EDGE_TIME) {
        this.borde = -10;          // (hasta que salga del borde)
        this._girar();
      }
      if (!enBorde && this.borde < 0) this.borde = 0;
    }
    // La compuerta
    const vc = 1 / S.GATE_TIME;
    if (this.compuerta < this.compuertaVa) this.compuerta = Math.min(1, this.compuerta + vc * dt);
    else if (this.compuerta > this.compuertaVa) this.compuerta = Math.max(0, this.compuerta - vc * dt);
    // Las válvulas (girando el ratón en círculos sobre una)
    this._valvulas(dt);
    // La fuga
    if (!this.parada) {
      this.fugaObjetivo += S.LEAK_RISE * (this.abiertas / S.VALVES) * dt;
      if (this.abiertas === 0) {
        this.parada = true;
        this.fugaObjetivo = 0;
        lib?.play('metal/tuberia', { volume: 0.8 });
        this.g.alerta?.('FUGA DE CRIOGENIA DETENIDA');
      }
    }
    this.fuga += (this.fugaObjetivo - this.fuga) * Math.min(1, dt * (this.parada ? 0.6 : 2));
    if (this.fuga >= 1 && !this.parada) return this._muere(null, 'n6_fuga');
    this.siseoIn -= dt;
    if (this.siseoIn <= 0 && !this.parada) {
      this.siseoIn = 1.6 + Math.random() * 1.5;
      lib?.play('congelado/viento', { volume: 0.15 + 0.35 * this.fuga });
    }
    this._enemigos(dt);
  }

  _valvulas(dt) {
    if (!DATOS) return;
    const lib = this.g.audio.lib;
    let activa = -1;
    if (this.cara === 'frente' && !this.giro) {
      DATOS.volantes.forEach((v, i) => {
        if (Math.hypot(this.mouse.x - v.x, this.mouse.y - v.y) < v.r * S.VALVE_RADIUS) activa = i;
      });
    }
    let girando = false;
    if (activa >= 0 && !this.valvulas[activa].cerrada) {
      const v = DATOS.volantes[activa];
      const a = Math.atan2(this.mouse.y - v.y, this.mouse.x - v.x);
      if (this.ang !== null && this.angDe === activa) {
        let da = a - this.ang;
        if (da > Math.PI) da -= 2 * Math.PI;
        if (da < -Math.PI) da += 2 * Math.PI;
        this.spin += (Math.abs(da) / Math.max(dt, 1e-3) - this.spin) * Math.min(1, dt * 6);
        const val = this.valvulas[activa];
        // Con la compuerta cerrada (o cerrándose) no se puede girar
        if (this.spin > S.VALVE_SPIN && this.compuerta < 0.02 && this.compuertaVa === 0) {
          girando = true;
          val.p = Math.min(S.VALVE_TIME, val.p + dt);
          val.giro += Math.abs(da) * 0.35;
          this.crujeIn -= dt;
          if (this.crujeIn <= 0) {
            this.crujeIn = 0.55 + Math.random() * 0.3;
            lib?.play('metal/tuberia', { volume: 0.25, pan: (v.x - W / 2) / W });
          }
          if (val.p >= S.VALVE_TIME) {
            val.cerrada = true;
            this.fugaObjetivo = Math.max(0, this.fugaObjetivo - S.LEAK_DROP);
            lib?.play('puertas/cierre', { volume: 0.9, pan: (v.x - W / 2) / W });
            this.g.alerta?.(`VALVULA ${'ABC'[activa]} CERRADA`);
          }
        }
      }
      this.ang = a;
      this.angDe = activa;
    } else {
      this.ang = null;
      this.spin = 0;
    }
    // Las que no se giran vuelven atrás despacio
    this.valvulas.forEach((val, i) => {
      if (val.cerrada || (girando && i === activa)) return;
      if (val.p > 0) {
        const antes = val.p;
        val.p = Math.max(0, val.p - S.VALVE_BACK * dt);
        val.giro -= (antes - val.p) * 2.2;
      }
    });
  }

  _enemigos(dt) {
    const lib = this.g.audio.lib;
    const e = this.enemigo;
    if (!e) {
      if (this.parada) return;
      this.proxIn -= dt;
      if (this.proxIn <= 0) {
        const id = this.turnoInsecto ? 'insecto' : 'dislocado';
        this.turnoInsecto = !this.turnoInsecto;
        this.enemigo = { id, fase: 'viene', t: 0, aviso: rand(S.WARN), cueIn: 0, golpes: 0 };
        this.g.alerta?.('ALGO SE ACERCA POR EL CONDUCTO');
      }
      return;
    }
    e.t += dt;
    e.cueIn -= dt;
    const mirando = this.cara === 'atras';
    const sonido = (vol) => {
      const muffle = mirando ? 0.15 : 0.6;
      if (e.id === 'insecto') lib?.play('n6/insecto_patas', { volume: vol, muffle });
      else lib?.play('n6/dislocado_arrastre', { volume: vol, muffle });
    };
    if (e.fase === 'viene') {
      if (e.cueIn <= 0) {
        e.cueIn = e.id === 'insecto' ? 0.55 : 1.3;
        sonido(0.2 + 0.6 * Math.min(1, e.t / e.aviso));
      }
      if (e.t >= e.aviso) {
        e.fase = 'fondo';
        e.t = 0;
      }
    } else if (e.fase === 'fondo' || e.fase === 'asomado') {
      if (this.compuerta >= 0.98) {
        // Choca contra la compuerta cerrada y se va
        e.fase = 'golpes';
        e.t = 0;
        e.cueIn = 0;
        return;
      }
      if (e.fase === 'fondo' && e.t >= S.DEEP) {
        e.fase = 'asomado';
        e.t = 0;
        lib?.play(e.id === 'insecto' ? 'n6/insecto_chasquido' : 'n6/dislocado_respira', { volume: 0.8, muffle: mirando ? 0 : 0.5 });
      }
      if (e.fase === 'asomado' && e.t >= S.ATTACK) return this._muere(e.id, `n6_sala_${e.id}`);
      if (e.cueIn <= 0) {
        e.cueIn = e.id === 'insecto' ? 0.45 : 1.0;
        sonido(0.85);
      }
    } else if (e.fase === 'golpes') {
      if (e.cueIn <= 0) {
        if (e.golpes >= S.BANGS) {
          this.enemigo = null;
          this.proxIn = rand(S.EVERY);
          sonido(0.2);
          return;
        }
        e.golpes += 1;
        e.cueIn = 0.55 + Math.random() * 0.3;
        lib?.play('puertas/golpe', { volume: 0.8, muffle: mirando ? 0 : 0.4 });
        this.sacudida = 0.2;
      }
    }
  }

  _muere(id, causa) {
    if (this.g.novedades?.inv) {
      if (causa === 'n6_fuga') this.fugaObjetivo = this.fuga = 0.5;
      this.enemigo = null;
      this.proxIn = rand(S.EVERY);
      return;
    }
    this.done = true;
    this.fase = 'muerto';
    this.g._n6Death(id, causa);
  }

  /** Depuración: 'inicio' | 'valvula' (2 cerradas) | 'enemigo' | 'salida'. */
  debugIr(punto) {
    this.fase = 'sala';
    this.t = 0;
    if (punto === 'valvula') {
      this.valvulas[0].cerrada = this.valvulas[1].cerrada = true;
      this.valvulas[0].p = this.valvulas[1].p = S.VALVE_TIME;
      this.fuga = this.fugaObjetivo = 0.25;
    } else if (punto === 'enemigo') {
      this.cara = 'atras';
      this.enemigo = { id: 'dislocado', fase: 'viene', t: 0, aviso: 3, cueIn: 0, golpes: 0 };
    } else if (punto === 'salida') {
      for (const v of this.valvulas) {
        v.cerrada = true;
        v.p = S.VALVE_TIME;
      }
      this.parada = true;
      this.fuga = this.fugaObjetivo = 0;
      this.cara = 'atras';
    }
  }

  // --- Dibujo -----------------------------------------------------------------
  _pintarCara(ctx, cara, dx = 0) {
    ctx.save();
    ctx.translate(dx, 0);
    if (cara === 'frente') {
      const f = img('frente');
      if (f) ctx.drawImage(f, 0, 0, W, H);
      else {
        ctx.fillStyle = '#0c0d0e';
        ctx.fillRect(0, 0, W, H);
      }
      if (DATOS) {
        DATOS.volantes.forEach((v, i) => {
          const im = img(`volante_${i}`);
          const val = this.valvulas[i];
          if (im) {
            ctx.save();
            ctx.translate(v.x, v.y);
            ctx.rotate(val.giro);
            ctx.translate(-v.x, -v.y);
            ctx.drawImage(im, 0, 0, W, H);
            ctx.restore();
          }
          // Lo cerrada que está (un arco fino alrededor, como el brillo de la rosca)
          if (val.p > 0 && !val.cerrada) {
            ctx.strokeStyle = 'rgba(255,190,120,0.45)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(v.x, v.y, v.r * 1.25, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * val.p / S.VALVE_TIME);
            ctx.stroke();
          }
        });
        // El medidor: la aguja (de −135° a +135°) y el brillo rojo
        const m = DATOS.medidor;
        const a = (-135 + 270 * Math.min(1, this.fuga)) * Math.PI / 180 - Math.PI / 2;
        const tiembla = this.parada ? 0 : Math.sin(this.time * 37) * 0.02 * (0.3 + this.fuga);
        ctx.strokeStyle = '#1a0605';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x + Math.cos(a + tiembla) * m.r * 0.8, m.y + Math.sin(a + tiembla) * m.r * 0.8);
        ctx.stroke();
        ctx.fillStyle = '#2a0b08';
        ctx.beginPath();
        ctx.arc(m.x, m.y, 4, 0, Math.PI * 2);
        ctx.fill();
        if (this.fuga > 0.75 && !this.parada && Math.floor(this.time * 4) % 2) {
          ctx.fillStyle = 'rgba(255,40,20,0.12)';
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.r * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      const n = Math.round(this.compuerta * 5);
      const a = img(`atras_${n}`) ?? img('atras_0');
      if (a) ctx.drawImage(a, 0, 0, W, H);
      // El enemigo en la boca (solo con la linterna)
      const e = this.enemigo;
      if (e && this.luz && this.compuerta < 0.6 && (e.fase === 'fondo' || e.fase === 'asomado')) {
        const im = img(`${e.id}_${e.fase === 'fondo' ? 'lejos' : 'asomado'}`);
        if (im) ctx.drawImage(im, 0, (e.id === 'insecto' ? Math.sin(this.time * 30) : Math.max(0, Math.sin(this.time * 3))) * 3, W, H);
      }
    }
    ctx.restore();
  }

  draw(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (this.fase === 'bajada') {
      // (el último fotograma de la bajada, del conducto, se funde con la sala)
      this._pintarCara(ctx, 'frente');
      ctx.fillStyle = `rgba(0,0,0,${1 - Math.min(1, this.t / 1.6)})`;
      ctx.fillRect(0, 0, W, H);
      return;
    }
    if (this.fase === 'subir') return this._drawSubir(ctx);
    ctx.save();
    if (this.sacudida > 0) {
      this.sacudida -= 1 / 60;
      ctx.translate((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 8);
    }
    if (this.giro) {
      const k = Math.min(1, this.giro.t / S.TURN_TIME);
      const s = k * k * (3 - 2 * k);
      this._pintarCara(ctx, this.giro.de, -s * W);
      this._pintarCara(ctx, this.giro.a, (1 - s) * W);
    } else {
      this._pintarCara(ctx, this.cara);
    }
    ctx.restore();
    // Linterna: haz en la mitad; sin ella, la sala en penumbra (la luz roja del medidor)
    const g = ctx.createRadialGradient(W * 0.52, H * 0.55, H * (this.luz ? 0.2 : 0.05), W * 0.52, H * 0.55, H * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${this.luz ? 0.7 : 0.55})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (!this.luz && this.cara === 'atras' && DATOS) {
      // La boca del conducto, negra sin luz
      const b = DATOS.boca;
      ctx.fillStyle = `rgba(0,0,0,${0.85 * (1 - this.compuerta)})`;
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    }
    // La fuga: niebla del suelo y escarcha en los bordes
    drawFog(ctx, 0.05 + 0.17 * this.fuga, this.time);
    drawEdgeFrost(ctx, Math.max(0, this.fuga - 0.45) * 1.6);
    this.g.effects?.static(ctx, 0.025);
    if (this.ayuda > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.ayuda / 1.2) * 0.75;
      ctx.fillStyle = '#cfe3da';
      ctx.font = '18px "Courier New", monospace';
      ctx.fillText('Ratón en círculos: válvula · A/D: girarse · ESPACIO linterna · Clic: compuerta', 40, H - 40);
      ctx.restore();
    }
  }

  _drawSubir(ctx) {
    // Subir al conducto: la bajada (salir) al revés y, al final, a oscuras
    const sal = this.g.n6ducts;
    const f = Math.max(0, 35 - this.t * S.EXIT_FPS);
    if (sal) sal._pintarVista(ctx, ['salir', f, false]);
    const extra = this.t - 36 / S.EXIT_FPS;
    if (extra > 0) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, extra / 1.4)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}
