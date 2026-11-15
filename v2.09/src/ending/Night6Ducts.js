// =============================================================
// Night6Ducts.js — NOCHE 6, FASE 1: LOS CONDUCTOS (v0.72).
// (Valores en NIGHT6.DUCTS, src/night/night6.js.)
//
// La oficina quedó sellada por la fuga de la noche 5: sales por la rejilla
// que rompió El Dislocado y te arrastras por la ventilación hasta V4, donde
// está la sala oculta. Primera persona, a ras de suelo (renders de
// tools/3d/n6/conductos.py → assets/n6/conductos/).
//   W    avanzar a empujones (sonido de arrastre, respiración, balanceo)
//   S    marcha atrás
//   A/W/D en un cruce, elegir izquierda / de frente / derecha
//   ESPACIO (mantenido)  linterna; la batería solo se gasta con ella
//          encendida; a cero, la luz solo chisporrotea
// El recorrido sigue el plano de conductos (StationMap.js: V1–V7) y se
// dibuja en el minimapa a medida que avanzas. Los caminos equivocados no
// matan: acaban en una rejilla SOLDADA y hay que volver marcha atrás (S)
// mientras los enemigos se acercan. En el desvío de V5 hay una pila de
// repuesto.
// Enemigos: El Insecto (patas rápidas y metálicas, chasquido) y El
// Dislocado (arrastre lento y húmedo, respiración), con sonido con
// dirección. De frente: alumbrarlos hasta que se retiran (la linterna
// parpadea al irse). Por detrás: solo vale llegar al siguiente cruce (APAGADO
// desde la v0.76, pedido del usuario: NIGHT6.DUCTS.BEHIND = false).
// Sin luz no se les ve (norma de la v0.45).
// Al llegar a V4: empujar la rejilla, asomarse y bajar a la sala oculta.
// =============================================================

import { CONFIG } from '../config.js';
import { dice } from '../core/Idioma.js';
import { NIGHT6 } from '../night/night6.js';
import { VENTS } from '../world/StationMap.js';
import { drawMapPanel, drawMapTubes, drawCamBox, vmp } from '../render/MiniMap.js';
import { GrabacionesN6 } from '../systems/GrabacionesN6.js';

const D = NIGHT6.DUCTS;
const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const BASE = 'assets/n6/conductos/';
const rand = ([a, b]) => a + Math.random() * (b - a);
const PASO = 0.1;                       // m entre fotogramas (conductos.py)
const FIN = { cruce: 3.9, ciego: 3.6 }; // último fotograma del acercamiento

// --- El recorrido (coordenadas del plano de conductos, StationMap.js) -------
// Cada cruce: su vista (qué bocas tiene). Cada tramo: de qué cruce sale y con
// qué tecla, adónde llega (un cruce, 'soldada' o 'salida'), su largo en m y su
// trazo en el plano.
const NODOS = {
  J1: { vista: 'cruce_LFR' },     // V1 · Bifurcación (llegas yendo al norte)
  J2: { vista: 'cruce_LFR' },     // entre V1 y V2/V3 (yendo al oeste)
  J3: { vista: 'cruce_FR' },      // V3 · Ramal sur (yendo al sur)
  J4: { vista: 'cruce_LF' },      // V2 · Ramal norte (yendo al norte)
};
export const TRAMOS = {
  e0: { de: null, a: 'J1', largo: 16, trazo: [[1510, 672], [1545, 672], [1545, 797], [1465, 797], [1328, 797], [1328, 657]] },
  J1A: { de: 'J1', tecla: 'A', a: 'J2', largo: 7, trazo: [[1328, 657], [1212, 657]] },
  J1W: { de: 'J1', tecla: 'W', a: 'soldada', largo: 6, trazo: [[1328, 657], [1328, 537], [1465, 537], [1545, 537], [1545, 642]] },
  J1D: { de: 'J1', tecla: 'D', a: 'soldada', largo: 3, trazo: [[1328, 657], [1378, 657]] },
  J2D: { de: 'J2', tecla: 'D', a: 'J4', largo: 7, trazo: [[1212, 657], [1212, 547]] },
  J2A: { de: 'J2', tecla: 'A', a: 'J3', largo: 7, trazo: [[1212, 657], [1212, 767]] },
  J2W: { de: 'J2', tecla: 'W', a: 'soldada', largo: 3, trazo: [[1212, 657], [1162, 657]] },
  J4A: { de: 'J4', tecla: 'A', a: 'salida', largo: 11, trazo: [[1212, 547], [1108, 547], [1108, 657]] },
  J4W: { de: 'J4', tecla: 'W', a: 'soldada', largo: 3, trazo: [[1212, 547], [1212, 497]] },
  J3D: { de: 'J3', tecla: 'D', a: 'salida', largo: 11, trazo: [[1212, 767], [1108, 767], [1108, 657]] },
  J3W: { de: 'J3', tecla: 'W', a: 'salida', largo: 15, trazo: [[1212, 767], [1212, 837], [1108, 837], [1108, 657]], pila: 7 },
};
// (v1.56) px del plano por m de conducto (el primer tramo)
const PX_M = TRAMOS.e0.trazo.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - TRAMOS.e0.trazo[i][0], p[1] - TRAMOS.e0.trazo[i][1]), 0) / TRAMOS.e0.largo;
const OPCIONES = {};
for (const [id, t] of Object.entries(TRAMOS)) if (t.de) (OPCIONES[t.de] ??= {})[t.tecla] = id;

/** Punto a una fracción f (0–1) de un trazo. */
function sobreTrazo(trazo, f) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < trazo.length; i++) {
    const l = Math.hypot(trazo[i][0] - trazo[i - 1][0], trazo[i][1] - trazo[i - 1][1]);
    segs.push(l);
    total += l;
  }
  let d = Math.max(0, Math.min(1, f)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) {
      const k = segs[i] ? Math.min(1, d / segs[i]) : 0;
      return [trazo[i][0] + (trazo[i + 1][0] - trazo[i][0]) * k, trazo[i][1] + (trazo[i + 1][1] - trazo[i][1]) * k];
    }
    d -= segs[i];
  }
  return trazo[trazo.length - 1];
}

/** El trazo hasta la fracción f (para dibujar lo recorrido). */
function trozoTrazo(trazo, f) {
  if (f >= 1) return trazo;
  const fin = sobreTrazo(trazo, f);
  const out = [trazo[0]];
  let acum = 0;
  const total = trazo.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - trazo[i][0], p[1] - trazo[i][1]), 0);
  for (let i = 1; i < trazo.length; i++) {
    acum += Math.hypot(trazo[i][0] - trazo[i - 1][0], trazo[i][1] - trazo[i - 1][1]);
    if (acum / total >= f) break;
    out.push(trazo[i]);
  }
  out.push(fin);
  return out;
}

// --- Imágenes -----------------------------------------------------------------
let INDICE = null;
const IMG = {};
function img(clave) {
  let i = IMG[clave];
  if (!i) {
    i = IMG[clave] = new Image();
    i.src = BASE + clave + '.webp';
  }
  return i.complete && i.naturalWidth ? i : null;
}
function precargar() {
  if (INDICE) return;
  fetch(BASE + 'indice.json').then((r) => r.json()).then((d) => {
    INDICE = d;
    for (const [v, n] of Object.entries(d.vistas)) for (let k = 0; k < n; k++) img(`${v}/${String(k).padStart(3, '0')}`);
    for (const [e, poses] of Object.entries(d.enemigos)) for (const p of poses) img(`${e}_${p}`);
  }).catch(() => {});
}

// --- (v2.08, el usuario: «los enemigos tienen que venir a por mí de forma más realista… modelos con volumen,
// iluminados por la linterna y con sombras, dentro de la misma escena; nada de imágenes planas pegadas») El Insecto y
// El Dislocado renderizados DENTRO del conducto (tools/3d/n6/enemigos_n6.py → integrar_enemigos_n6.py), con la
// linterna y su sombra en la chapa: un fotograma por cada 5 cm de su llegada (de 6,6 m a 0,85 m; sus patas o sus brazos
// van con lo que avanza) y, cada 5 fotogramas desde los 5 m, los 8 de cubrirse. Si faltan, las poses de antes.
const BASE_EN = 'assets/n6/enemigos/';
const ENEM = {};
const pad3 = (n) => String(n).padStart(3, '0');
function enemigo3d(id) {
  let E = ENEM[id];
  if (E) return E;
  E = ENEM[id] = { id, ind: null, img: {} };
  const pide = (clave) => {
    const im = new Image();
    im.decoding = 'async';
    im.src = `${BASE_EN}conducto_${id}/${clave}.webp`;
    E.img[clave] = im;
  };
  fetch(`${BASE_EN}conducto_${id}/indice.json`).then((r) => (r.ok ? r.json() : null)).then((ind) => {
    if (!ind?.acerca?.length) return;
    const n = ind.acerca.length;
    ind.inicio = Math.max(0, ind.acerca.findIndex((a) => a.d <= D.START_DIST));
    // m por fotograma, de media, en lo que cuenta (de los 5 m al ataque): así tarda lo mismo que antes en alcanzarte
    // (El Dislocado avanza a tirones y su último fotograma se pasa un poco de la distancia del ataque)
    ind.paso = (D.START_DIST - D.ATTACK_DIST) / Math.max(1, n - 1 - ind.inicio);
    ind.cubres = Object.keys(ind.cubre).map(Number).sort((a, b) => a - b);
    for (let i = 0; i < n; i++) if (ind.acerca[i].w) pide(`a_${pad3(i)}`);
    for (const c of ind.cubres) ind.cubre[c].forEach((e, k) => e.w && pide(`c_${pad3(c)}_${k}`));
    E.ind = ind;
  }).catch(() => {});
  return E;
}
/** La distancia (de su cabeza) en el fotograma de llegada f (con decimales). */
function drEn(ind, f) {
  const n = ind.acerca.length;
  const i = Math.max(0, Math.min(n - 1, Math.floor(f)));
  const j = Math.min(n - 1, i + 1);
  const k = Math.max(0, Math.min(1, f - i));
  return ind.acerca[i].d + (ind.acerca[j].d - ind.acerca[i].d) * k;
}

export class Night6Ducts {
  constructor(game) {
    this.g = game;
    precargar();
    enemigo3d('insecto');                  // (v2.08)
    enemigo3d('dislocado');
  }

  /** (v2.08) Los fotogramas de verdad de ese enemigo, si ya están (y no viene por detrás); prepara su avance. */
  _en3d(e) {
    if (!e || e.dir === 'detras') return null;
    const E = ENEM[e.id];
    if (!E?.ind) return null;
    if (e.f == null) e.f = e.fase === 'aviso' ? 0 : E.ind.inicio;
    e.adv ??= 0;
    return E;
  }

  /**
   * (v2.08, el usuario: «el Insecto, a trompicones por paredes y techo, con paradas en seco») corre y se para en seco
   * (sus patas se quedan clavadas: van con lo que avanza); de media, a su velocidad de siempre (los tiempos no cambian).
   */
  _marcha(e, dt) {
    if (!e.marcha) {
      // (empieza en un punto al azar de su ciclo: si siempre empezara corriendo, llegaría antes que de costumbre)
      const r = 0.5 + Math.random() * 0.45;
      const s = 0.16 + Math.random() * 0.2;
      const u = Math.random() * (r + s);
      e.marcha = u < r ? { corre: true, t: r - u, k: (r + s) / r, sig: s } : { corre: false, t: r + s - u };
    }
    const m = e.marcha;
    m.t -= dt;
    if (m.t <= 0) {
      if (m.corre) {
        m.corre = false;
        m.t += m.sig;
        if (Math.random() < 0.5) this.g.audio.lib?.play('n6/insecto_chasquido', { volume: 0.35 + 0.4 * (1 - e.d / D.START_DIST), muffle: 0.15 });
      } else {
        const r = 0.5 + Math.random() * 0.45;
        m.sig = 0.16 + Math.random() * 0.2;
        m.corre = true;
        m.t += r;
        m.k = (r + m.sig) / r;
      }
    }
    return m.corre ? m.k : 0;
  }

  start() {
    this.fase = 'inicio';          // inicio | arrastre | giro | salir | fuera | muerto
    this.t = 0;
    this.time = 0;
    this.tramo = 'e0';
    this.s = 0;                    // m recorridos en el tramo
    this.visto = { e0: 0 };        // lo más lejos que has llegado en cada tramo (minimapa)
    this.ciegos = new Set();       // tramos que sabes que acaban en una rejilla soldada
    this.held = new Set();
    this.empuje = 0;               // fase del empujón (0–1)
    this.mov = 0;                  // velocidad actual (m/s, con signo)
    this.bateria = D.BATTERY;
    this.luz = false;              // ESPACIO mantenido
    this.chispa = 0;               // s de chispazo con la pila a cero
    this.chispaIn = rand(D.EMPTY_FLICKER);
    this.parpadeo = 0;             // s de parpadeo (enemigo retirado)
    this.pila = false;             // ¿ya has cogido la pila?
    this.respIn = rand(D.BREATH_EVERY);
    this.enemigo = null;           // el encuentro en curso
    this.proxIn = 0;               // (v2.03) s de respiro (al salir de un camino ciego)
    this.cruces = new Set();       // (v2.03) los cruces por los que ya has salido hacia delante
    this.encuentroEn = null;       // (v2.03) m del tramo en los que empieza su encuentro (o null: ninguno)
    this.turnoInsecto = Math.random() < 0.5;
    this.ayuda = 6;                // s de la ayuda de controles
    this.golpeSoldada = 0;
    this.salirT = 0;
    this.sacudida = 0;
    this.done = false;
    this.g.audio.lib?.play('n6/arrastre', { volume: 0.5 });
    // (v1.56) las grabaciones de la mujer: vuelven a sonar en cada intento
    this.grab = this.g.grabN6 ??= new GrabacionesN6(this.g);
    this.grab.reinicia();
  }

  /** (v1.56) Dónde estás en el plano, en m (para lo lejos que queda cada grabación). */
  _aqui() {
    return sobreTrazo(this.tr.trazo, this.s / this.tr.largo).map((v) => v / PX_M);
  }

  get tr() {
    return TRAMOS[this.tramo];
  }

  /** ¿A qué termina el tramo actual? 'cruce' | 'soldada' | 'salida'. */
  get final() {
    const a = this.tr.a;
    return NODOS[a] ? 'cruce' : a;
  }

  get luzEncendida() {
    if (!this.luz || this.parpadeo > 0 && Math.floor(this.parpadeo * 14) % 2 === 0) return false;
    if (this.bateria <= 0) return this.chispa > 0;
    if (this.falla > 0) return false;             // (v2.07) con la batería baja, la luz falla a ratos
    return true;
  }

  /** (v2.07) La luz está encendida pero falla en este instante por la batería baja (ni suma luz ni la pierde). */
  get luzFalla() {
    return this.luz && this.bateria > 0 && this.falla > 0;
  }

  // --- Entrada ------------------------------------------------------------------
  key(code) {
    const k = { ArrowUp: 'KeyW', ArrowDown: 'KeyS', ArrowLeft: 'KeyA', ArrowRight: 'KeyD' }[code] ?? code;
    this.held.add(k);
    if (k === 'Space') this.luz = true;
    if (this.fase !== 'arrastre') return;
    const r = this.tr.largo - this.s;
    if (r < 0.02 && this.final === 'cruce') {
      const op = OPCIONES[this.tr.a]?.[{ KeyA: 'A', KeyW: 'W', KeyD: 'D' }[k]];
      if (op) this._girar(op, { KeyA: -1, KeyW: 0, KeyD: 1 }[k]);
    }
  }

  keyUp(code) {
    const k = { ArrowUp: 'KeyW', ArrowDown: 'KeyS', ArrowLeft: 'KeyA', ArrowRight: 'KeyD' }[code] ?? code;
    this.held.delete(k);
    if (k === 'Space') this.luz = false;
  }

  _girar(tramo, lado) {
    this.fase = 'giro';
    this.t = 0;
    this.giroLado = lado;
    this.giroDe = { tramo: this.tramo, s: this.s };
    this.giroA = tramo;
    this.giroVuelta = false;
    // Por detrás: si llegas a un cruce y giras, te pierde
    if (this.enemigo?.dir === 'detras' && this.enemigo.fase === 'viene') this._pierde();
    this.g.audio.lib?.play('n6/arrastre', { volume: 0.6, pan: lado * 0.4 });
  }

  // --- Actualizar ---------------------------------------------------------------
  update(dt) {
    if (this.done) return;
    this.time += dt;
    this.t += dt;
    this.ayuda = Math.max(0, this.ayuda - dt);
    this.sacudida = Math.max(0, this.sacudida - dt);
    this.parpadeo = Math.max(0, this.parpadeo - dt);
    this.golpeSoldada = Math.max(0, this.golpeSoldada - dt);
    const lib = this.g.audio.lib;
    // Linterna: la batería solo se gasta encendida
    if (this.luz && this.bateria > 0) this.bateria = Math.max(0, this.bateria - dt);
    // (v2.07, el usuario: «si la batería está baja o parpadea, que sea más difícil, pero que se entienda por qué») por
    // debajo de BATERIA_BAJA la luz se apaga a ratos (FALLO_BAJA del tiempo, con su chasquido): mientras falla no
    // alumbra a nadie, así que espantarlos tarda más; la barra parpadea en rojo con su aviso (_drawBateria)
    this.falla = Math.max(0, (this.falla ?? 0) - dt);
    if (this.luz && this.bateria > 0 && this.bateria < D.BATERIA_BAJA) {
      this.fallaIn = (this.fallaIn ?? 0.4) - dt;
      if (this.fallaIn <= 0) {
        const off = 0.06 + Math.random() * 0.14;
        this.falla = off;
        this.fallaIn = off + off * (1 - D.FALLO_BAJA) / D.FALLO_BAJA * (0.6 + Math.random() * 0.8);
        if (Math.random() < 0.6) lib?.play('n6/linterna', { volume: 0.22 });
      }
    } else this.falla = 0;
    if (this.bateria <= 0) {
      this.chispa = Math.max(0, this.chispa - dt);
      this.chispaIn -= dt;
      if (this.luz && this.chispaIn <= 0) {
        this.chispaIn = rand(D.EMPTY_FLICKER);
        this.chispa = 0.05 + Math.random() * 0.1;
        lib?.play('n6/linterna', { volume: 0.35 });
      }
    }
    this.grab.update(this._aqui());
    if (this.fase === 'inicio') {
      if (this.t >= D.START_TIME) {
        this.fase = 'arrastre';
        this.grab.suena('inicio', this._aqui());
      }
      return;
    }
    if (this.fase === 'giro') {
      if (this.t >= D.TURN_TIME) {
        this.tramo = this.giroA;
        this.s = this.giroVuelta ? TRAMOS[this.giroA].largo : 0;
        if (!this.giroVuelta) this._saleDeCruce();          // (v2.03: los encuentros van por cruces)
        this.giroVuelta = false;
        this.visto[this.tramo] ??= 0;
        this.fase = 'arrastre';
      }
      this.avance = 0;                 // (v2.07) girando no te mueves (antes se quedaba el último avance)
      this._enemigos(dt);
      return;
    }
    if (this.fase === 'salir') {
      this.salirT += dt;
      const n = INDICE?.vistas.salir ?? 36;
      if (this.salirT * D.EXIT_FPS >= n + D.EXIT_FPS * 1.2 && !this.done) {
        this.done = true;
        this.g._n6DuctsDone();
      }
      return;
    }
    if (this.fase !== 'arrastre') return;
    // Arrastrarse a empujones: la velocidad sube y baja con cada empujón
    const adelante = this.held.has('KeyW');
    const atras = this.held.has('KeyS') && !adelante;
    let objetivo = 0;
    if (adelante || atras) {
      this.empuje += dt / D.PUSH;
      if (this.empuje >= 1) {
        this.empuje -= 1;
        lib?.play('n6/arrastre', { volume: 0.55 });
      }
      const pulso = 0.35 + 1.3 * Math.sin(Math.PI * this.empuje) ** 2;
      objetivo = (adelante ? D.SPEED : -D.BACK_SPEED) * pulso;
    }
    this.mov += (objetivo - this.mov) * Math.min(1, dt * 8);
    const antes = this.s;
    this.s = Math.max(0, Math.min(this.tr.largo, this.s + this.mov * dt));
    this.avance = this.s - antes;
    this.visto[this.tramo] = Math.max(this.visto[this.tramo] ?? 0, this.s);
    const r = this.tr.largo - this.s;
    // (v1.56) las grabaciones: el primer cruce y la llegada a V4
    if (this.tramo === 'e0' && r < 1.2) this.grab.suena('cruce', this._aqui());
    if (this.final === 'salida' && r < 4) this.grab.suena('v4', null);
    // La pila del desvío de V5
    if (this.tr.pila && !this.pila && this.s >= this.tr.pila) {
      this.pila = true;
      this.bateria = Math.min(D.BATTERY_MAX, this.bateria + D.SPARE);
      lib?.play('n6/pila', { volume: 0.8 });
      this.parpadeo = 0;
      this.grab.suena('pila', this._aqui());
    }
    // Al fondo de un tramo
    if (r < 0.02 && adelante) {
      if (this.final === 'soldada' && this.golpeSoldada <= 0) {
        this.ciegos.add(this.tramo);
        this.golpeSoldada = 1.4;
        this.sacudida = 0.25;
        lib?.play('n6/soldada', { volume: 0.7 });
        this.grab.suena('ciego', this._aqui());
      } else if (this.final === 'salida') {
        this.fase = 'salir';
        this.salirT = 0;
        this.enemigo = null;
        lib?.play('metal/panel', { volume: 0.7 });
        setTimeout(() => lib?.play('caidas/herramienta', { volume: 0.6, muffle: 0.3 }), 650);
        return;
      }
    }
    // Marcha atrás hasta el principio de un tramo que sale de un cruce: vuelves al cruce
    if (this.s <= 0 && atras && this.tr.de && this.mov < 0) {
      const de = this.tr.de;
      const vuelta = Object.entries(TRAMOS).find(([, t]) => t.a === de);
      if (vuelta) {
        this.fase = 'giro';
        this.t = 0;
        this.giroLado = -({ A: -1, W: 0, D: 1 }[this.tr.tecla]) || 0;
        this.giroA = vuelta[0];
        this.giroDe = { tramo: this.tramo, s: 0 };
        this.giroVuelta = true;
      }
    }
    // Respiración del vigilante (más rápida si hay un enemigo cerca)
    this.respIn -= dt * (this.enemigo ? 1.6 : 1);
    if (this.respIn <= 0) {
      this.respIn = rand(D.BREATH_EVERY);
      // (v2.03, el usuario: «quita las respiraciones del personaje») sin la respiración del vigilante
    }
    this._enemigos(dt);
  }

  // --- Encuentros ---------------------------------------------------------------
  _enemigos(dt) {
    // (v2.03, el usuario: «si entras a una parte nula que no venga ningún enemigo… por atrás») en un camino ciego no
    // viene ninguno: no empieza ningún encuentro, el que se oía venir (o ya venía) te pierde, y al salir hay un respiro
    if (this.final === 'soldada') {
      if (this.enemigo && (this.enemigo.fase === 'aviso' || this.enemigo.fase === 'viene')) this._pierde();
      if (!this.enemigo || this.enemigo.fase !== 'retira') {
        this.proxIn = Math.max(this.proxIn, D.TRAS_CIEGO);
        if (!this.enemigo) return;
      }
    }
    const e = this.enemigo;
    if (!e) {
      // (v2.03) por cruces, no por tiempo: al salir de un cruce por un tramo (que no sea ciego), el encuentro que toque
      // empieza cuando llevas un poco de ese tramo (_saleDeCruce)
      this.proxIn = Math.max(0, this.proxIn - dt);
      if (this.encuentroEn != null && this.fase === 'arrastre' && this.s >= this.encuentroEn && this.proxIn <= 0) {
        this.encuentroEn = null;
        this._nuevo();
      }
      return;
    }
    const V = D.ENEMIES[e.id];
    const lib = this.g.audio.lib;
    e.t += dt;
    e.cueIn -= dt;
    if (e.fase === 'aviso') {
      // (v2.08) en el último trozo del aviso ya viene por el fondo, de 6,6 a 5 m (donde la linterna aún no llega y no se le
      // espanta): con la linterna se le intuye. Recorre ese trozo a su paso de siempre, así que los tiempos no cambian
      const E3 = this._en3d(e);
      if (E3) {
        const ind = E3.ind;
        const tRev = ind.inicio * ind.paso / (D.START_DIST / V.APPROACH);
        const desde = e.aviso - tRev;
        if (e.t > desde) e.f = Math.min(ind.inicio, (e.t - desde) / Math.max(0.1, tRev) * ind.inicio);
        e.d = drEn(ind, e.f);
      }
      // Se le oye venir (por su lado; por detrás, apagado); (v2.08) golpes en la chapa, polvo que cae y la chapa vibra
      if (e.cueIn <= 0) {
        e.cueIn = rand(V.CUE);
        const k = Math.min(1, e.t / e.aviso);
        this._sonido(e, 0.15 + 0.4 * k);
        this.vibra = Math.max(this.vibra ?? 0, (e.id === 'dislocado' ? 0.35 : 0.18) * (0.4 + 0.6 * k));
        if (Math.random() < (e.id === 'dislocado' ? 0.45 : 0.25)) {
          lib?.play('metal/golpe_pared', { volume: 0.18 + 0.3 * k, muffle: 0.55 - 0.35 * k, pan: e.dir === 'lado' ? e.lado * 0.7 : 0 });
          this.polvo = Math.max(this.polvo ?? 0, 0.9 + 0.8 * k);
        }
      }
      if (e.t >= e.aviso) {
        e.fase = 'viene';
        e.t = 0;
        if (e.dir === 'lado') e.dir = 'frente';
        e.d = e.dir === 'frente' ? D.START_DIST : V.BACK;
        if (E3 && e.dir === 'frente') {
          e.f = E3.ind.inicio;
          e.adv = 0;
          e.d = drEn(E3.ind, e.f);
        }
      }
      return;
    }
    if (e.fase === 'viene') {
      if (e.dir === 'frente') {
        // (v2.07) la luz cuenta si le da (encendida y sin fallar) y está a su alcance
        const alumbrado = this.luzEncendida && e.d <= D.LUZ_ALCANCE;
        const ritmo = D.START_DIST / V.APPROACH * (alumbrado ? V.LIT_SLOW : 1);
        // (v2.07) antes, retroceder con S lo ACERCABA (el signo del avance hacia atrás estaba al revés): ahora ganas el
        // 60 % de lo que retrocedes
        const av = this.avance ?? 0;
        const E3 = this._en3d(e);
        if (E3) {
          // (v2.08) su avance va en fotogramas de su llegada (el mismo ritmo de siempre; El Insecto, a trompicones); lo
          // que avanzas tú se resta aparte (y se agranda en pantalla)
          const k = e.id === 'insecto' ? this._marcha(e, dt) : 1;
          e.f = Math.min(E3.ind.acerca.length - 1, e.f + ritmo * k * dt / E3.ind.paso);
          e.adv += Math.max(0, av) + Math.min(0, av) * 0.6;
          // la cuenta (ataque, alcance de la luz, sonido), en línea recta como siempre: de 5 m al ataque en su tiempo de
          // siempre; lo que se ve es su fotograma (El Dislocado, a tirones)
          e.d = D.START_DIST - (e.f - E3.ind.inicio) * E3.ind.paso - e.adv;
        } else e.d -= ritmo * dt + Math.max(0, av) + Math.min(0, av) * 0.6;
        if (alumbrado) {
          // (v2.07, el usuario: «se tiene que notar que funciona») el haz se cierra sobre él, tiembla (más cuanto más
          // luz lleva) y chilla al darle la luz
          if (e.luz < 0.05 && (e.dueleIn ?? 0) <= 0) {
            e.dueleIn = 1.4;
            e.sacude = 0.35;
            lib?.play(e.id === 'insecto' ? 'criaturas/chillido' : 'criaturas/grunido', { volume: 0.75, pitch: e.id === 'insecto' ? 1.25 : 0.9 });
          }
          e.luz += dt;
          this.focoHasta = this.t0Foco = performance.now() + 120;
        } else if (!this.luzFalla) e.luz = Math.max(0, e.luz - D.LIGHT_DECAY * dt);
        e.dueleIn = Math.max(0, (e.dueleIn ?? 0) - dt);
        e.sacude = Math.max(0, (e.sacude ?? 0) - dt);
        if (e.luz >= V.LIGHT) return this._retira();
        if (e.d <= D.ATTACK_DIST) return this._muere(e.id, `n6_${e.id}`);
      } else {
        // Por detrás: e.d son los segundos que le quedan para alcanzarte
        e.d -= dt;
        if (e.d <= 0) return this._muere(e.id, `n6_${e.id}_detras`);
      }
      if (e.cueIn <= 0) {
        e.cueIn = rand(V.CUE);
        const cerca = e.dir === 'frente' ? 1 - e.d / D.START_DIST : 1 - e.d / V.BACK;
        if (!(e.id === 'insecto' && e.marcha && !e.marcha.corre)) this._sonido(e, 0.45 + 0.5 * cerca);   // (parado: silencio)
        this.vibra = Math.max(this.vibra ?? 0, (e.id === 'dislocado' ? 0.5 : 0.25) * Math.max(0.2, cerca));
        if (cerca > 0.4 && Math.random() < 0.3) this.polvo = Math.max(this.polvo ?? 0, 0.8);
      }
      return;
    }
    if (e.fase === 'retira') {
      // (v2.07, el usuario: «se detiene, se cubre y retrocede por donde ha venido») se para en seco (y recula un palmo),
      // se cubre y se va por el conducto, cada vez más rápido, hasta perderse en la oscuridad. Tú puedes seguir moviéndote
      const R = D.RETIRA;
      const av = this.avance ?? 0;
      const E3 = this._en3d(e);
      if (E3) {
        // (v2.08) se para (va al fotograma de cubrirse más cercano, reculando), se cubre (sus 8 fotogramas) y vuelve por
        // donde vino: su llegada al revés, cada vez más rápido, hasta perderse al fondo
        e.adv += Math.max(0, av) + Math.min(0, av) * 0.6;
        if (e.t < R.PARA) e.f = e.f0 + (e.fc - e.f0) * Math.min(1, e.t / R.PARA);
        else if (e.t < R.PARA + R.CUBRE) e.f = e.fc;
        else e.f = Math.max(0, e.f - R.VEL[e.id] * dt * Math.min(1, (e.t - R.PARA - R.CUBRE) / 0.35) / E3.ind.paso);
        e.d = drEn(E3.ind, e.f) - e.adv;
        if (e.f <= 0) e.d = R.HASTA;
      } else {
        e.d -= Math.max(0, av) + Math.min(0, av) * 0.6;
        if (e.t < R.PARA) e.d += 0.5 * dt;
        else if (e.t > R.PARA + R.CUBRE) e.d += R.VEL[e.id] * dt * Math.min(1, (e.t - R.PARA - R.CUBRE) / 0.35);
      }
      if (e.cueIn <= 0 && e.t > R.PARA + R.CUBRE) {
        e.cueIn = rand(V.CUE);
        this._sonido(e, Math.max(0.08, 0.5 * (1 - e.d / R.HASTA)));
      }
      if (e.d >= R.HASTA || e.t > 4) {
        this.enemigo = null;
        this.proxIn = D.TRAS_CIEGO;              // (v2.03: ya no hay más hasta el siguiente cruce)
        this.parpadeo = 0.22;                    // la linterna parpadea cuando ya se ha ido (antes lo escondía al irse)
      }
    }
  }

  /**
   * (v2.03, el usuario: «haz que no venga tanto, y en mínimo 2 cruces deben de venir por algún tramo») Sales de un cruce
   * por un tramo: en los 2 primeros cruces distintos (que no sean a un camino ciego) viene uno seguro; en los demás, a
   * veces (ENCUENTRO_PROB). Empieza al llevar ENCUENTRO_EN m de ese tramo (como mucho, el 40 % del tramo).
   */
  _saleDeCruce() {
    this.encuentroEn = null;
    if (this.final === 'soldada' || !this.tr.de) return;
    const nuevo = !this.cruces.has(this.tr.de);
    this.cruces.add(this.tr.de);
    const seguro = nuevo && this.cruces.size <= D.CRUCES_SEGUROS;
    if (seguro || Math.random() < D.ENCUENTRO_PROB) {
      this.encuentroEn = Math.min(this.tr.largo * 0.4, rand(D.ENCUENTRO_EN));
    }
  }

  _nuevo() {
    const id = this.turnoInsecto ? 'insecto' : 'dislocado';
    this.turnoInsecto = !this.turnoInsecto;
    const r = this.tr.largo - this.s;
    const V = D.ENEMIES[id];
    // Por detrás, solo si te da tiempo a llegar al siguiente cruce (y no es un camino ciego)
    const puedeDetras = D.BEHIND && this.final === 'cruce' && r / D.SPEED < V.BACK - 2;   // (apagado desde la v0.76)
    let dir = 'frente';
    if (Math.random() > D.FRONT) dir = puedeDetras && Math.random() > D.SIDE ? 'detras' : 'lado';
    const lado = Math.random() < 0.5 ? -1 : 1;
    this.enemigo = { id, dir, lado, fase: 'aviso', t: 0, aviso: rand(D.WARN), cueIn: 0, d: 0, luz: 0, espejo: id === 'insecto' && Math.random() < 0.5 };
    this.grab.suena('enemigo', this._aqui());   // (v1.56) la primera vez que se le oye
    this.g.alerta?.(dice(dir === 'detras' ? 'n6.detras' : 'n6.conductos'));
    // (v2.08, el usuario: «pistas antes de verlo: el aviso "ALGO VIENE POR EL CONDUCTO", polvo que cae, la chapa que vibra
    // y el sonido que sube de volumen según la distancia») el aviso en pantalla (como en la sala), un golpe en la chapa,
    // polvo y la vibración (que siguen con cada golpe y paso: _enemigos)
    this.avisoTxt = 3.5;
    this.polvo = 1.6;
    this.vibra = 0.35;
    this.g.audio.lib?.play('metal/golpe_pared', { volume: 0.5, muffle: 0.45, pan: dir === 'lado' ? lado * 0.7 : 0 });
  }

  _sonido(e, vol) {
    const lib = this.g.audio.lib;
    const pan = e.dir === 'lado' ? e.lado * 0.85 : 0;
    const muffle = e.dir === 'detras' ? 0.75 : (e.fase === 'aviso' ? 0.45 : 0.1);
    const v = e.dir === 'detras' ? vol * 0.85 : vol;
    if (e.id === 'insecto') {
      lib?.play('n6/insecto_patas', { volume: v, pan, muffle });
      if (Math.random() < 0.35) lib?.play('n6/insecto_chasquido', { volume: v * 0.8, pan, muffle, when: 0.3 });
    } else {
      lib?.play('n6/dislocado_arrastre', { volume: v, pan, muffle });
      if (Math.random() < 0.5) lib?.play('n6/dislocado_respira', { volume: v * 0.7, pan, muffle, when: 0.5 });
    }
  }

  _retira() {
    const e = this.enemigo;
    e.fase = 'retira';
    e.t = 0;
    e.cueIn = D.RETIRA.PARA + D.RETIRA.CUBRE;
    // (v2.07) antes la linterna parpadeaba 0,6 s justo al irse y lo escondía (y saltaba a una pose fija a 3 m): ahora se
    // le ve pararse, cubrirse e irse; el chillido de dolor y, luego, cómo se aleja por el conducto
    const E3 = this._en3d(e);
    if (E3) {
      // (v2.08) el fotograma de cubrirse: el más cercano por detrás (recula un poco al pararse)
      const cs = E3.ind.cubres;
      e.f0 = e.f;
      e.fc = cs.length ? (cs.filter((c) => c <= e.f + 0.5).pop() ?? cs[0]) : Math.round(e.f);
    }
    const lib = this.g.audio.lib;
    lib?.play(e.id === 'insecto' ? 'criaturas/chillido' : 'criaturas/grunido', { volume: 0.95, pitch: e.id === 'insecto' ? 1.1 : 0.8 });
    if (e.id === 'insecto') lib?.play('n6/insecto_chasquido', { volume: 0.7, when: 0.15 });
    else lib?.play('n6/dislocado_respira', { volume: 0.7, when: 0.2 });
  }

  _pierde() {
    const e = this.enemigo;
    this._sonido({ ...e, fase: 'aviso' }, 0.2);
    this.enemigo = null;
    this.proxIn = rand(D.GAP);
  }

  _muere(id, causa) {
    if (this.g.novedades?.inv) {
      // (panel NOVEDADES en modo invencible: se va en vez de matarte)
      this.enemigo = null;
      this.proxIn = rand(D.GAP);
      return;
    }
    this.done = true;
    this.fase = 'muerto';
    this.grab.para();
    this.g._n6Death(id, causa);
  }

  /**
   * Depuración (N4Debug y NOVEDADES): saltar a un momento de la fase.
   * 'inicio' | 'cruce' (V1) | 'ciego' (rejilla soldada) | 'pila' | 'v4'
   * (antes de la salida) | 'insecto' / 'dislocado' (de frente) | 'detras'.
   */
  debugIr(punto) {
    const ir = (tramo, s) => {
      this.fase = 'arrastre';
      this.tramo = tramo;
      this.s = s;
      this.visto[tramo] = Math.max(this.visto[tramo] ?? 0, s);
      this.enemigo = null;
      this.proxIn = 14;
    };
    if (punto === 'cruce') ir('e0', TRAMOS.e0.largo - 0.6);
    else if (punto === 'ciego') ir('J1D', 1.2);
    else if (punto === 'pila') ir('J3W', 3.2);
    else if (punto === 'v4') ir('J4A', TRAMOS.J4A.largo - 1.2);
    else if (punto === 'insecto' || punto === 'dislocado') {
      ir('e0', 5);
      this.enemigo = { id: punto, dir: 'frente', lado: 1, fase: 'viene', t: 0, aviso: 0, cueIn: 0, d: D.START_DIST, luz: 0 };
    } else if (/^(insecto|dislocado)_(frente|izq|der)$/.test(punto)) {
      // (v2.08) ese enemigo desde el principio de su aviso (se le oye, polvo, la chapa vibra, se le intuye al fondo y llega)
      const [id, por] = punto.split('_');
      ir('e0', 3);
      this.proxIn = 1e9;
      this.enemigo = { id, dir: por === 'frente' ? 'frente' : 'lado', lado: por === 'izq' ? -1 : 1, fase: 'aviso', t: 0, aviso: 3.2, cueIn: 0, d: 0, luz: 0, espejo: id === 'insecto' && por === 'izq' };
      this.avisoTxt = 3.5;
      this.polvo = 1.6;
      this.vibra = 0.35;
    } else if (/^(insecto|dislocado)_(baja|vacia)$/.test(punto)) {
      // (v2.07) con la batería baja (la luz falla) o a cero (solo chispea)
      const [id, bat] = punto.split('_');
      ir('e0', 5);
      this.bateria = bat === 'baja' ? 4 : 0;
      this.enemigo = { id, dir: 'frente', lado: 1, fase: 'viene', t: 0, aviso: 0, cueIn: 0, d: D.START_DIST, luz: 0 };
    } else if (punto === 'detras') {
      ir('e0', TRAMOS.e0.largo - 4);
      this.enemigo = { id: 'insecto', dir: 'detras', lado: 1, fase: 'aviso', t: 0, aviso: 2.5, cueIn: 0, d: 0, luz: 0 };
    }
    for (const id of ['e0']) this.visto[id] = Math.max(this.visto[id] ?? 0, this.tramo === 'e0' ? this.s : TRAMOS.e0.largo);
  }

  // --- Dibujo ---------------------------------------------------------------------
  /** La vista (y su fotograma con decimales) para el sitio actual. */
  _vista(tramoId = this.tramo, s = this.s) {
    const t = TRAMOS[tramoId];
    const final = NODOS[t.a] ? 'cruce' : t.a;
    const fin = final === 'cruce' ? FIN.cruce : FIN.ciego;
    const r = t.largo - s;
    if (r <= fin) return [final === 'cruce' ? NODOS[t.a].vista : final, (fin - r) / PASO, false];
    if (t.pila && !this.pila) {
      const b = t.pila - s;
      if (b >= 0 && b <= FIN.ciego) return ['pila', (FIN.ciego - b) / PASO, false];
    }
    const fase = (((fin - r) % 1) + 1) % 1;
    return ['recto', fase / PASO, true];
  }

  _pintarVista(ctx, [vista, f, bucle], dx = 0) {
    const n = INDICE?.vistas[vista] ?? 1;
    const i0 = Math.floor(f);
    const k = f - i0;
    const a = bucle ? ((i0 % n) + n) % n : Math.max(0, Math.min(n - 1, i0));
    const b = bucle ? (a + 1) % n : Math.min(n - 1, a + 1);
    const ia = img(`${vista}/${String(a).padStart(3, '0')}`);
    const ib = img(`${vista}/${String(b).padStart(3, '0')}`);
    if (!ia) {
      ctx.fillStyle = '#0b0c0d';
      ctx.fillRect(0, 0, W, H);
      return;
    }
    ctx.drawImage(ia, dx, 0, W, H);
    if (ib && k > 0.01) {
      ctx.globalAlpha = k;
      ctx.drawImage(ib, dx, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  draw(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (this.fase === 'salir') return this._drawSalir(ctx);
    const luz = this.luzEncendida;
    ctx.save();
    // Balanceo al arrastrarse (y la sacudida contra la rejilla soldada)
    const mueve = Math.min(1, Math.abs(this.mov) / D.SPEED);
    const bob = Math.sin(this.empuje * Math.PI * 2) * D.BOB * mueve;
    const roll = Math.sin(this.empuje * Math.PI * 2 + 1) * 0.012 * mueve;
    const sx = this.sacudida > 0 ? (Math.random() - 0.5) * 22 * this.sacudida / 0.25 : 0;
    // (v2.08) la chapa vibra con sus golpes y sus pasos
    const vb = this.vibra > 0 ? this.vibra : 0;
    ctx.translate(W / 2 + sx + (Math.random() - 0.5) * 7 * vb, H / 2 + bob + (Math.random() - 0.5) * 5 * vb);
    ctx.rotate(roll);
    ctx.scale(1.06, 1.06);
    ctx.translate(-W / 2, -H / 2);
    if (this.fase === 'giro') {
      // Girar en el cruce: la vista se va de lado, negro, y la nueva entra
      const k = Math.min(1, this.t / D.TURN_TIME);
      if (k < 0.5) {
        this._pintarVista(ctx, this._vista(this.giroDe.tramo, this.giroDe.s), -this.giroLado * W * 0.5 * (k / 0.5) ** 2);
        ctx.fillStyle = `rgba(0,0,0,${k * 2})`;
      } else {
        const s = this.giroVuelta ? TRAMOS[this.giroA].largo : 0;
        this._pintarVista(ctx, this._vista(this.giroA, s), this.giroLado * W * 0.5 * ((1 - k) / 0.5) ** 2);
        ctx.fillStyle = `rgba(0,0,0,${(1 - k) * 2})`;
      }
      ctx.fillRect(-50, -50, W + 100, H + 100);
    } else {
      this._pintarVista(ctx, this._vista());
    }
    // El enemigo de frente (solo con luz: sin ella no se ve nada)
    const e = this.enemigo;
    if (e && luz && this.fase !== 'giro' && this._en3d(e) && (e.fase === 'aviso' || e.fase === 'viene' && e.dir === 'frente' || e.fase === 'retira')) {
      this._pintar3d(ctx, e);                 // (v2.08) el de verdad (en el aviso, al fondo)
    } else if (e && luz && (e.fase === 'viene' && e.dir === 'frente' || e.fase === 'retira')) this._pintarEnemigo(ctx, e);
    ctx.restore();
    // Oscuridad: con la linterna, un haz; sin ella, casi negro
    if (luz) {
      // (v1.59) se cierra en 0,3 s sobre el que tienes delante y se abre al apartarla
      const ahoraF = performance.now();
      this.focoK = Math.max(0, Math.min(1, (this.focoK ?? 0) + (ahoraF < (this.focoHasta ?? 0) ? 1 : -1) * Math.min(0.1, (ahoraF - (this.focoUlt ?? ahoraF)) / 1000) / 0.3));
      this.focoUlt = ahoraF;
      const kF = 1 - 0.4 * this.focoK;
      const g = ctx.createRadialGradient(W * 0.53, H * 0.56, H * 0.18 * kF, W * 0.53, H * 0.56, H * 0.95 * kF);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.55, `rgba(0,0,0,${0.42 + 0.2 * this.focoK})`);
      g.addColorStop(1, 'rgba(0,0,0,0.88)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      if (this.bateria < 4 && this.bateria > 0) {
        ctx.fillStyle = `rgba(0,0,0,${0.35 + 0.3 * Math.random() * (1 - this.bateria / 4)})`;
        ctx.fillRect(0, 0, W, H);
      }
    } else {
      ctx.fillStyle = `rgba(0,0,0,${D.DARK})`;
      ctx.fillRect(0, 0, W, H);
    }
    // Inicio: entrar por la rejilla (de negro)
    if (this.fase === 'inicio') {
      ctx.fillStyle = `rgba(0,0,0,${1 - Math.min(1, this.t / D.START_TIME)})`;
      ctx.fillRect(0, 0, W, H);
    }
    // Grano y estática (más con un enemigo cerca)
    const cerca = e && e.fase === 'viene' ? (e.dir === 'frente' ? 1 - e.d / D.START_DIST : 1 - e.d / D.ENEMIES[e.id].BACK) : 0;
    this.g.effects?.static(ctx, 0.035 + 0.12 * Math.max(0, cerca));
    if (cerca > 0.55) {
      const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
      v.addColorStop(0, 'rgba(60,0,0,0)');
      v.addColorStop(1, `rgba(60,0,0,${(cerca - 0.55) * 1.2})`);
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
    }
    this._drawPistas(ctx);
    this._drawFlechas(ctx);
    this._drawMapa(ctx);
    this._drawBateria(ctx);
    if (this.ayuda > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.ayuda / 1.2) * 0.75;
      ctx.fillStyle = '#cfe3da';
      ctx.font = '18px "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(dice('n6.pista_conductos'), 40, H - 40);
      ctx.restore();
    }
  }

  _pintarEnemigo(ctx, e) {
    let pose;
    let escala = 1;
    let alpha = 1;
    const R = D.RETIRA;
    const yendose = e.fase === 'retira' && e.t > R.PARA + R.CUBRE;
    // (v2.07) se va por donde vino, reculando y sin dejar de mirarte, a su distancia de verdad (antes saltaba a una pose
    // fija pintada a 3 m, y parecía que se acercaba); se pierde en la oscuridad
    if (yendose) alpha = Math.max(0, Math.min(1, (R.HASTA - e.d) / 2));
    {
      const d = e.d;
      // De lejos a cerca, cruzando las poses y agrandándolas entre medias
      const P = [['lejos', 4.6], ['media', 3.2], ['cerca', 2.0], ['ataque', 1.05]];
      let i = P.findIndex(([, pd]) => d >= pd);
      if (i < 0) i = P.length;
      if (i === 0) {
        pose = 'lejos';
        escala = 4.6 / Math.max(d, 0.1);
      } else if (i === P.length) {
        pose = 'ataque';
        escala = 1.05 / Math.max(d, 0.5);
      } else {
        const [pa, da] = P[i - 1];
        const [pb, db] = P[i];
        const k = (da - d) / (da - db);
        pose = k < 0.5 ? pa : pb;
        escala = k < 0.5 ? da / d : db / d;
      }
    }
    const im = img(`${e.id}_${pose}`);
    if (!im) return;
    // (crece hacia el centro del conducto, a la altura de los ojos)
    const cx = W / 2;
    const cy = H * 0.55;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.scale(escala, escala);
    ctx.translate(-cx, -cy);
    // Tiembla un poco (respira, se arrastra a tirones)
    let tir = e.id === 'insecto' ? Math.sin(this.time * 31) * 3 : Math.max(0, Math.sin(this.time * 3)) * 6;
    // (v2.07) con la luz encima tiembla más cuanto más luz lleva; al cubrirse, el espasmo
    let tx = 0;
    const V = D.ENEMIES[e.id];
    const dolor = e.fase === 'retira' ? (yendose ? 0.2 : 1) : Math.min(1, e.luz / V.LIGHT) * 0.8 + (e.sacude ?? 0) * 1.5;
    if (dolor > 0) {
      tir += (Math.random() - 0.5) * 16 * dolor;
      tx = (Math.random() - 0.5) * 18 * dolor;
    }
    ctx.drawImage(im, tx, tir, W, H);
    ctx.restore();
  }

  /** (v2.08) El enemigo de verdad: su fotograma (llegada o cubrirse), a su distancia y con la linterna encima. */
  _pintar3d(ctx, e) {
    const E3 = ENEM[e.id];
    const ind = E3.ind;
    const R = D.RETIRA;
    const n = ind.acerca.length;
    let clave;
    let ent;
    let dRef;
    if (e.fase === 'retira' && e.t >= R.PARA && e.t < R.PARA + R.CUBRE && ind.cubre[e.fc]) {
      const lista = ind.cubre[e.fc];
      const k = Math.min(lista.length - 1, Math.floor((e.t - R.PARA) / R.CUBRE * lista.length));
      clave = `c_${pad3(e.fc)}_${k}`;
      ent = lista[k];
      dRef = ind.acerca[e.fc].d;
    } else {
      const i = Math.max(0, Math.min(n - 1, Math.round(e.f)));
      clave = `a_${pad3(i)}`;
      ent = ind.acerca[i];
      dRef = ent.d;
    }
    const im = E3.img[clave];
    if (!ent?.w || !im?.complete || !im.naturalWidth) return;
    // lo que te has acercado tú lo agranda (desde el punto de fuga: el centro de la imagen)
    const esc = dRef / Math.max(0.3, dRef - (e.adv ?? 0));
    const kx = W / ind.ancho;
    const ky = H / ind.alto;
    // (v2.07) con la luz encima tiembla más cuanto más luz lleva; al cubrirse, el espasmo
    const V = D.ENEMIES[e.id];
    const dolor = e.fase === 'retira' ? (e.t < R.PARA + R.CUBRE ? 0.6 : 0) : e.fase === 'viene' ? Math.min(1, e.luz / V.LIGHT) * 0.6 + (e.sacude ?? 0) * 1.2 : 0;
    const tx = dolor > 0 ? (Math.random() - 0.5) * 10 * dolor : 0;
    const ty = dolor > 0 ? (Math.random() - 0.5) * 8 * dolor : 0;
    ctx.save();
    // al irse, ya al fondo, se pierde en la oscuridad
    if (e.fase === 'retira') ctx.globalAlpha = Math.max(0, Math.min(1, e.f / 8));
    ctx.translate(W / 2 + tx, H / 2 + ty);
    ctx.scale(esc * (e.espejo ? -1 : 1), esc);
    ctx.translate(-W / 2, -H / 2);
    ctx.drawImage(im, ent.x * kx, ent.y * ky, ent.w * kx, ent.h * ky);
    ctx.restore();
  }

  /** (v2.08) Las pistas antes de verlo: el aviso en pantalla y el polvo que cae de las juntas con los golpes. */
  _drawPistas(ctx) {
    const paso = 1 / 60;
    this.vibra = Math.max(0, (this.vibra ?? 0) - paso * 1.4);
    if (this.polvo > 0) {
      this.polvo -= paso;
      ctx.save();
      ctx.fillStyle = `rgba(190,180,160,${0.3 * Math.min(1, this.polvo)})`;
      for (let i = 0; i < 46; i++) {
        const x = W * 0.18 + ((i * 131.7 + this.time * 9) % (W * 0.64));
        const y = H * 0.08 + ((i * 57.3 + this.time * (110 + (i % 5) * 35)) % (H * 0.62));
        ctx.fillRect(x, y, 2, 4 + (i % 4) * 3);
      }
      ctx.restore();
    }
    if (this.avisoTxt > 0) {
      this.avisoTxt -= paso;
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.avisoTxt) * (Math.floor(this.time * 4) % 2 ? 1 : 0.75);
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffd84a';
      ctx.font = 'bold 22px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(dice('n6.conducto_aviso'), W / 2, 60);
      ctx.restore();
    }
  }

  _drawFlechas(ctx) {
    if (this.fase !== 'arrastre' || this.tr.largo - this.s > 0.02 || this.final !== 'cruce') return;
    const ops = OPCIONES[this.tr.a] ?? {};
    const pulso = 0.6 + 0.4 * Math.sin(this.time * 4);
    ctx.save();
    ctx.lineJoin = 'round';
    for (const [tecla, id] of Object.entries(ops)) {
      const x = { A: W * 0.2, W: W / 2, D: W * 0.76 }[tecla];
      const y = tecla === 'W' ? H * 0.24 : H * 0.42;
      const ang = { A: Math.PI, W: -Math.PI / 2, D: 0 }[tecla];
      const ciego = this.ciegos.has(id);
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = ciego ? 0.35 : pulso;
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(46, 0);
      ctx.lineTo(4, -34);
      ctx.lineTo(4, -14);
      ctx.lineTo(-40, -14);
      ctx.lineTo(-40, 14);
      ctx.lineTo(4, 14);
      ctx.lineTo(4, 34);
      ctx.closePath();
      ctx.fillStyle = 'rgba(10,20,14,0.55)';
      ctx.fill();
      ctx.strokeStyle = ciego ? '#ff8a6a' : '#cfffe0';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = ciego ? 0.45 : 0.95;
      ctx.fillStyle = ciego ? '#ff8a6a' : '#eafff2';
      ctx.font = 'bold 30px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tecla, x + (tecla === 'W' ? 0 : 0), y + (tecla === 'W' ? 70 : 62));
      if (ciego) ctx.fillText('✕', x, y);
      ctx.restore();
    }
    ctx.restore();
  }

  _drawMapa(ctx) {
    drawMapPanel(ctx);
    const trozos = [];
    for (const [id, s] of Object.entries(this.visto)) {
      const t = TRAMOS[id];
      if (s <= 0 && id !== this.tramo) continue;
      trozos.push(trozoTrazo(t.trazo, s / t.largo).map(([x, y]) => { const p = vmp(x, y); return [p.x, p.y]; }));
    }
    drawMapTubes(ctx, trozos, { outer: 8, inner: 3 });
    // Las cámaras de los conductos por las que ya has pasado
    for (const [id, v] of Object.entries(VENTS)) {
      const cx = v.mapRect.x + v.mapRect.w / 2;
      const cy = v.mapRect.y + v.mapRect.h / 2;
      const pasado = Object.entries(this.visto).some(([tid, s]) => {
        const t = TRAMOS[tid];
        return trozoTrazo(t.trazo, s / t.largo).some(([x, y]) => Math.hypot(x - cx, y - cy) < 12);
      });
      if (!pasado) continue;
      const p = vmp(cx, cy);
      drawCamBox(ctx, { x: p.x - 22, y: p.y - 11, w: 44, h: 22, cx: p.x, cy: p.y }, v.cam, false);
    }
    // Caminos ciegos ya probados
    ctx.save();
    ctx.strokeStyle = '#ff7a5a';
    ctx.lineWidth = 3;
    for (const id of this.ciegos) {
      const t = TRAMOS[id];
      const [x, y] = t.trazo[t.trazo.length - 1];
      const p = vmp(x, y);
      ctx.beginPath();
      ctx.moveTo(p.x - 6, p.y - 6); ctx.lineTo(p.x + 6, p.y + 6);
      ctx.moveTo(p.x + 6, p.y - 6); ctx.lineTo(p.x - 6, p.y + 6);
      ctx.stroke();
    }
    ctx.restore();
    // Dónde estás
    const tr = this.fase === 'giro' ? TRAMOS[this.giroDe.tramo] : this.tr;
    const s = this.fase === 'giro' ? this.giroDe.s : this.s;
    const [x, y] = sobreTrazo(tr.trazo, s / tr.largo);
    const p = vmp(x, y);
    ctx.save();
    ctx.fillStyle = Math.floor(this.time * 3) % 2 ? '#7dffb0' : '#eafff2';
    ctx.shadowColor = '#7dffb0';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawBateria(ctx) {
    const x = 40;
    const y = 40;
    const w = 150;
    const h = 30;
    const k = this.bateria / D.BATTERY_MAX;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = '#cfe3da';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#cfe3da';
    ctx.fillRect(x + w, y + 9, 6, 12);
    const baja = this.bateria > 0 && this.bateria < D.BATERIA_BAJA;
    const col = this.bateria <= 0 ? '#ff5050' : baja ? '#ff7a3a' : k < 0.2 ? '#ff7a3a' : '#7dffb0';
    ctx.fillStyle = col;
    // (v2.07) batería baja: la barra parpadea mientras la luz falla
    if (!(baja && this.luz && this.falla > 0)) ctx.fillRect(x + 4, y + 4, (w - 8) * Math.max(0, k), h - 8);
    if (baja || this.bateria <= 0) {
      // lo que pasa (como los avisos de la terminal): la batería baja hace que la luz falle; sin batería, solo chispea
      ctx.globalAlpha = 0.65 + 0.35 * (Math.floor(this.time * 3) % 2);
      ctx.fillStyle = this.bateria <= 0 ? '#ff5050' : '#ffb347';
      ctx.font = 'bold 16px "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(dice(this.bateria <= 0 ? 'n6.sin_bateria' : 'n6.bateria_baja'), x, y + h + 22);
      ctx.globalAlpha = 0.9;
    }
    if (this.luz && this.luzEncendida) {
      ctx.fillStyle = 'rgba(255,240,200,0.9)';
      ctx.beginPath();
      ctx.arc(x + w + 24, y + h / 2, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawSalir(ctx) {
    const n = INDICE?.vistas.salir ?? 36;
    const f = Math.min(n - 1, this.salirT * D.EXIT_FPS);
    this._pintarVista(ctx, ['salir', f, false]);
    // Sin linterna al bajar: lo alumbra la sala (el medidor rojo)
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    this.g.effects?.static(ctx, 0.03);
    const extra = this.salirT * D.EXIT_FPS - n;
    if (extra > 0) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, extra / (D.EXIT_FPS * 1.2))})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}
