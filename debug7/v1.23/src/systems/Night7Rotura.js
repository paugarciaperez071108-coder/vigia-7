// =============================================================
// Night7Rotura.js — LA NAVE SE ROMPE en la noche 7 (v0.95, Fase 5). Valores
// en NIGHT7.ROTURA (src/night/night7.js). Lo lleva Night7.
//
//   3:00  el núcleo al 100 %: la ALARMA DE SABOTAJE (tools/sonidos_n7.py: dos
//         tonos graves y metálicos que se alternan, con un pulso) y la luz roja
//         girando en todas las salas y en la oficina.
//   4:00  EL CALOR, sala a sala y no todo a la vez: luces que se apagan unos
//         segundos, cámaras que se cortan y vuelven deformadas por el calor
//         (ondas, colores quemados), vapor de tuberías reventadas, paneles y
//         cables que caen con chispas, rociadores que dejan gotas en la lente.
//         La terminal avisa de cada sala («⚠ TEMPERATURA CRÍTICA – CAM 04»).
//         En la oficina: el monitor parpadea, el metal cruje, la ventana se
//         empaña y la temperatura sube en pantalla.
//   5:00  LA NAVE SE ROMPE: explosiones (fogonazo y temblor), fuego y humo que
//         llena la imagen hasta dejarla gris, cámaras que mueren para siempre
//         (tachadas en el plano), puertas que se atascan o se abren solas, los
//         cadáveres de la noche 6 ardiendo. En la oficina: temblores, polvo y la
//         alarma más rápida.
//   5:59  la música se corta (el remix); quedan la alarma y el fuego.
// Y la oficina, cada hora un poco más rota: cables colgando, el cristal
// agrietado, humo en el techo.
//
// v0.96 (el usuario: «el fuego no es creíble, no hay explosiones»): en las salas con
// fuego SIMULADO (tools/3d/n7/fuego_sala.py → assets/n7/fuego/<sala>/), cada foco
// nace de algo (el cadáver, una pared…) y tiene dos capas: la luz del fuego sobre la
// sala (se SUMA a la imagen) y la llama con su humo. Orden: fondo → luz → fuego de
// detrás → enemigos → fuego de delante → explosión → efecto de cámara (drawFondo y
// drawRoom). Las cámaras que mueren por el calor se QUEMAN (sin grieta): se
// sobreexponen, ondulan, se derriten y se van a negro («SEÑAL PERDIDA –
// SOBRECALENTAMIENTO», con una llama naranja en el plano; resetcam no las arregla).
//
// v0.97 (el usuario, tras la prueba de la CAM 05): a las 3:00, algo leve (chispas, vapor,
// luces que fallan y los cadáveres que empiezan a humear); las cámaras se queman desde las
// 4:00; arden los cuatro cadáveres de la noche 6 (Criogenia, Laboratorio, Invernadero y
// Hangar, cada uno simulado desde su cámara); las salas sin explosión propia usan una
// explosión simulada suelta (tools/3d/n7/fuego_sprite.py), y explotan las REJILLAS de la
// oficina (el estallido sale hacia ti y la rejilla se queda ardiendo y echando humo).
// Las explosiones ROMPEN la sala (un trozo de la pared salta y cae) y desde las 4:00 caen
// paneles del techo: los trozos se recortan de la propia imagen de la cámara (así son
// los de su techo y sus paredes) y dejan el hueco negro con cables y chispas.
// =============================================================

import { CONFIG } from '../config.js';
import { NIGHT7 } from '../night/night7.js';
import { ROOMS } from '../world/StationMap.js';
import { miniBox } from '../render/MiniMap.js';
import { drawEscombro, nEscombro } from '../render/Escombros.js';

const R = NIGHT7.ROTURA;
const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const rand = ([a, b]) => a + Math.random() * (b - a);
const pick = (lista) => lista[Math.floor(Math.random() * lista.length)];
const CADAVERES = ['cryo', 'lab', 'greenhouse', 'hangar'];   // (las salas con un cadáver de la noche 6)
const MONITOR = { x: 655, y: 558, w: 291, h: 176 };          // el cristal del CRT (la oficina v2 da el suyo)

// El fuego simulado (fuego_sala.py / integrar_fuego.py)
let FUE = null;
const IMGS = {};
fetch('assets/n7/fuego/indice.json').then((r) => (r.ok ? r.json() : null)).then((j) => { FUE = j; precargar(); }).catch(() => {});
function fimg(sala, nombre) {
  const clave = `${sala}/${nombre}`;
  let i = IMGS[clave];
  if (!i) {
    i = IMGS[clave] = new Image();
    i.src = `assets/n7/fuego/${clave}.webp`;
  }
  return i.complete && i.naturalWidth ? i : null;
}
function precargar() {
  const sp = FUE?._sprite;
  for (let k = 0; k < (sp?.explosion ?? 0); k++) { fimg('_sprite', `explosion_frente_${n2(k)}`); fimg('_sprite', `explosion_arriba_${n2(k)}`); }
  for (let k = 0; k < (sp?.rejilla ?? 0); k++) fimg('_sprite', `fuego_rejilla_${n2(k)}`);
  for (const [sala, d] of Object.entries(FUE ?? {})) {
    for (const f of d.focos ?? []) {
      for (let k = 0; k < (f.bucle ?? 0); k++) { fimg(sala, `fuego_${f.id}_${String(k).padStart(2, '0')}`); fimg(sala, `luz_${f.id}_${String(k).padStart(2, '0')}`); }
      for (let k = 0; k < (f.explosion ?? 0); k++) { fimg(sala, `explosion_${f.id}_${String(k).padStart(2, '0')}`); fimg(sala, `explosion_luz_${f.id}_${String(k).padStart(2, '0')}`); }
      if (f.tipo === 'explosion') fimg(sala, `restos_${f.id}`);
    }
  }
}
const FOCOS = (sala) => FUE?.[sala]?.focos ?? [];
// (v0.99) Lo que rueda y los cristales, en 3D (tools/3d/n7/objetos.py → assets/n7/objetos/)
let OBJ = null;
const OIMGS = {};
fetch('assets/n7/objetos/indice.json').then((r) => (r.ok ? r.json() : null)).then((j) => {
  OBJ = j;
  for (const [nombre, d] of Object.entries(OBJ ?? {})) for (let k = 0; k < d.n; k++) oimg(nombre, k);
}).catch(() => {});
function oimg(nombre, k) {
  const clave = `${nombre}_${String(k).padStart(2, '0')}`;
  let i = OIMGS[clave];
  if (!i) {
    i = OIMGS[clave] = new Image();
    i.src = `assets/n7/objetos/${clave}.webp`;
  }
  return i.complete && i.naturalWidth ? i : null;
}
// La explosión suelta (fuego_sprite.py): { explosion: n, rejilla: n } (o null si no está)
const SPR = () => FUE?._sprite ?? null;
// Dónde estalla en una sala sin explosión propia (puntos de la imagen, al fondo de la sala)
const SITIOS = [[520, 430], [1080, 440], [800, 370], [640, 540], [960, 560]];
const n2 = (k) => String(k).padStart(2, '0');

/** Copia un trozo de lo ya dibujado. (El lienzo va a la resolución de la pantalla, no a
 * 1600×900: la copia se hace en sus píxeles reales. Antes se copiaba mal y, en pantallas
 * que no son de 1600×900, salía un cuadrado desplazado: lo vio el usuario.) */
function copiaReal(ctx, x, y, w, h, lienzo) {
  const m = ctx.getTransform();
  const X = Math.round(m.a * x + m.e);
  const Y = Math.round(m.d * y + m.f);
  const Wd = Math.max(1, Math.round(m.a * w));
  const Hd = Math.max(1, Math.round(m.d * h));
  if (lienzo.width !== Wd) lienzo.width = Wd;
  if (lienzo.height !== Hd) lienzo.height = Hd;
  const c = lienzo.getContext('2d');
  c.clearRect(0, 0, Wd, Hd);
  c.drawImage(ctx.canvas, X, Y, Wd, Hd, 0, 0, Wd, Hd);
  return lienzo;
}

/** El sitio del techo con más luz (un panel que cae en un techo negro no se ve). */
function sitioTecho(ctx, ocupados) {
  const peq = sitioTecho.c ??= document.createElement('canvas');
  peq.width = 80;
  peq.height = 45;
  const pc = peq.getContext('2d', { willReadFrequently: true });
  const m = ctx.getTransform();
  pc.drawImage(ctx.canvas, m.e, m.f, m.a * W, m.d * H, 0, 0, 80, 45);
  const d = pc.getImageData(0, 0, 80, 45).data;
  const luz = (x, y) => {
    let t = 0;
    for (let j = -2; j <= 2; j++) for (let i = -5; i <= 5; i++) {
      const k = (Math.max(0, Math.min(44, Math.round(y / 20) + j)) * 80 + Math.max(0, Math.min(79, Math.round(x / 20) + i))) * 4;
      t += d[k] + d[k + 1] + d[k + 2];
    }
    return t;
  };
  let mejor = null;
  for (let n = 0; n < 24; n++) {
    const x = 260 + Math.random() * 1080;
    const y = 40 + Math.random() * 190;
    if (ocupados.some((r) => Math.abs(r.x - x) < 200 && Math.abs(r.y - y) < 110)) continue;
    const l = luz(x, y) * (1.2 - y / 400);
    if (!mejor || l > mejor.l) mejor = { x, y, l };
  }
  return mejor ?? { x: 800, y: 100 };
}

export class Night7Rotura {
  constructor(n7) {
    this.n7 = n7;
    this.g = n7.g;
    this.reset(false);
  }

  reset(activa) {
    this.parar();
    this.activa = activa;
    this.salas = {};            // sala → estado de sus efectos
    for (const id of Object.keys(ROOMS)) {
      this.salas[id] = { apagon: 0, corte: 0, calor: 0, vapor: 0, rociador: 0, gotas: [], chispas: 0, chispazo: null, fuego: 0, humo: 0, flash: 0, muerta: false,
        focos: {}, expl: null, restos: new Set(), quemando: -1, quemada: false, ennegrece: 0, efectos: [], sprite: null, sueltos: [], rotos: [],
        lamparas: [], oscuro: 0, ruedas: [], pilotos: null };
    }
    // Los conductos de las rejillas del frente (v1.14, el usuario: «la explosión del conducto ocurre una
    // única vez por noche […] que salga la explosión por el conducto, no que salga la rejilla volando […]
    // El Dislocado las había roto antes»): 'abierta' (como la dejó El Dislocado: el hueco y la rejilla en
    // el suelo) → 'explota' (t: s desde el estallido) → 'quemada' (el canto doblado y ennegrecido, humo),
    // de una vez; nada lo devuelve atrás salvo empezar la noche
    this.rejillas = { left: { estado: 'abierta', t: -1, arde: 0 }, right: { estado: 'abierta', t: -1, arde: 0 } };
    this.rejillaIn = null;
    this.techoIn = null;
    this.leveIn = null;
    this.explosionIn = null;
    this.respiro = 0;
    this.calmas = new Set();
    this.eventoIn = 0;
    this.oficina = { flash: 0, vaho: 0, monitor: 0 };
    this.sacudida = 0;
    this.muertas = 0;
    this.t = 0;
  }

  get hora() {
    const c = this.g.clock;
    return c.elapsed / c.sph;
  }

  // --- Los bucles de sonido (la alarma, el fuego) -------------------------------------------
  _bucle(clave, vol, rate = 1) {
    const lib = this.g.audio.lib;
    const buf = lib?.buffers?.[clave]?.[0];
    if (!buf || !lib.ctx) return null;
    const src = lib.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = rate;
    const gain = lib.ctx.createGain();
    gain.gain.value = vol;
    src.connect(gain).connect(lib.output);
    src.start();
    return { src, gain };
  }

  parar() {
    for (const b of [this.alarma, this.fuegoSon, this.crepitarSon]) {
      try { b?.src.stop(); } catch {}
      b?.gain.disconnect();
    }
    this.alarma = this.fuegoSon = this.crepitarSon = null;
  }

  _son(clave, opts = {}) {
    this.g.audio.lib?.play(`n7/${clave}`, { volume: 0.7, ...opts });
  }

  // --- Cada fotograma ------------------------------------------------------------------------
  update(dt) {
    if (!this.activa) return;
    this.t += dt;
    const h = this.hora;
    const n7 = this.n7;
    // 3:00: la alarma (solo con el núcleo al 100 %); a las 5, más rápida
    if (n7.nucleo && !this.alarma) this.alarma = this._bucle('n7/alarma', R.ALARMA_VOL);
    if (this.alarma) this.alarma.src.playbackRate.value = h >= NIGHT7.HORAS.ROTURA ? R.ALARMA_RAPIDA : 1;
    if (h >= NIGHT7.HORAS.CALOR && !this.fuegoSon) this.fuegoSon = this._bucle('n7/fuego', 0.05);
    if (this.fuegoSon) {
      // (el crepitar sube con el fuego que hay)
      const total = Object.values(this.salas).reduce((a, s_) => a + Math.max(s_.fuego, ...Object.values(s_.focos).map((f) => f.nivel)), 0);
      this.fuegoSon.gain.gain.value = Math.min(R.FUEGO_VOL * 2.2, 0.05 + R.FUEGO_VOL * total * 0.35);
    }
    // (v0.99) El crepitar de cerca: el fuego de la cámara que miras (y el de las rejillas que arden)
    if (h >= NIGHT7.HORAS.CALOR && !this.crepitarSon) this.crepitarSon = this._bucle('n7/crepitar', 0);
    if (this.crepitarSon) {
      const v = this.g.cameras.open ? this.salas[this.g.cameras.active] : null;
      const aqui = v ? Math.max(v.fuego, v.sueltos.length ? 0.6 : 0, ...Object.values(v.focos).map((f) => (f.on ? f.nivel : 0))) : 0;
      const rej = Math.max(this.rejillas.left.arde, this.rejillas.right.arde) > 0 ? 0.5 : 0;
      const obj = R.CREPITAR_VOL * Math.max(aqui, this.g.cameras.open ? 0 : rej);
      const gg = this.crepitarSon.gain.gain;
      gg.value += (obj - gg.value) * Math.min(1, dt * 3);
    }
    // El casco que se dobla por el calor, de vez en cuando
    if (h >= NIGHT7.HORAS.CALOR && h < 6) {
      this.metalIn = (this.metalIn ?? rand(R.METAL_CADA)) - dt;
      if (this.metalIn <= 0) {
        this.metalIn = rand(R.METAL_CADA) * (h >= NIGHT7.HORAS.ROTURA ? 0.6 : 1);
        this._son('metal', { volume: rand([0.35, 0.7]), pan: (Math.random() - 0.5) * 1.4 });
      }
    }
    // Lo que rueda y las lámparas reventadas
    this._lamparas(dt);
    this._fuegoSimulado(dt, h);
    this._quemaCamaras(dt, h);
    // Los efectos de cada sala, que se van pasando (el fuego y el humo, no)
    for (const [id, s] of Object.entries(this.salas)) {
      s.apagon = Math.max(0, s.apagon - dt);
      s.corte = Math.max(0, s.corte - dt);
      s.calor = Math.max(0, s.calor - dt);
      s.vapor = Math.max(0, s.vapor - dt);
      s.rociador = Math.max(0, s.rociador - dt);
      s.chispas = Math.max(0, s.chispas - dt);
      for (const e of s.efectos) e.t += dt;
      s.efectos = s.efectos.filter((e) => e.t * 15 < nEscombro(e.id));
      s.flash = Math.max(0, s.flash - dt);
      s.gotas = s.gotas.filter((g) => (g.vida -= dt * 0.12) > 0);
      if (s.fuego > 0) {
        s.fuego = Math.min(1, s.fuego + dt * R.FUEGO_CRECE);
        s.humo = Math.min(1, s.humo + dt * R.HUMO_CRECE * s.fuego);
        if (!s.muerta && s.quemando < 0 && s.humo >= R.MUERE_HUMO) this._quema(id);
      }
    }
    const of = this.oficina;
    of.flash = Math.max(0, of.flash - dt);
    of.monitor = Math.max(0, of.monitor - dt);
    if (h >= NIGHT7.HORAS.CALOR) of.vaho = Math.min(1, of.vaho + dt / R.VAHO_TIEMPO);
    this.sacudida = Math.max(0, this.sacudida - dt);
    // (v1.14: el polvo y la ceniza que caen son los de la oficina renderizada: particulas_oficina.py)
    // 3:00 → 4:00: algo leve (chispas, vapor, una luz que falla), sin cortes ni explosiones
    if (h >= NIGHT7.HORAS.NUCLEO && h < NIGHT7.HORAS.CALOR) {
      this.leveIn = (this.leveIn ?? rand(R.LEVE_CADA) * 0.4) - dt;
      if (this.leveIn <= 0) {
        this.leveIn = rand(R.LEVE_CADA);
        this._sucesoLeve();
      }
    }
    // Los paneles del techo que caen (desde las 4:00; a las 5, más)
    if (h >= NIGHT7.HORAS.CALOR && h < 6) {
      this.techoIn = (this.techoIn ?? rand(R.TECHO_4) * 0.5) - dt;
      if (this.techoIn <= 0) {
        this.techoIn = rand(h >= NIGHT7.HORAS.ROTURA ? R.TECHO_5 : R.TECHO_4);
        const vista = this.g.cameras.open ? this.g.cameras.active : null;
        const id = vista && this.salas[vista] && !this.salas[vista].muerta && Math.random() < 0.45 ? vista : this._salaViva();
        if (id) this._rompe(id, 'techo');
      }
    }
    for (const sala of Object.values(this.salas)) for (const r of sala.rotos) r.t += dt;
    // Las rejillas de la oficina (desde las 4:00)
    for (const [lado, r] of Object.entries(this.rejillas)) {
      r.arde = Math.max(0, r.arde - dt);
      if (r.estado === 'explota' && (r.t += dt) > (this.g.ofv2?.nExplosion?.(lado) || SPR()?.explosion || 24) / 15) {
        r.estado = 'quemada';
        r.t = -1;
      }
    }
    if (h >= NIGHT7.HORAS.CALOR && h < 6 && this.respiro <= 0 && this._sinExplotar().length) {
      this.rejillaIn = (this.rejillaIn ?? rand(R.REJILLA_4) * 0.5) - dt;
      if (this.rejillaIn <= 0) {
        this.rejillaIn = rand(h >= NIGHT7.HORAS.ROTURA ? R.REJILLA_5 : R.REJILLA_4);
        this.explotaRejilla();
      }
    }
    // Los sucesos: desde las 4:00, uno cada CADA s (más seguidos a las 5); y las explosiones
    // (4:00: una pequeña cada 20–30 s; 5:00: cada 5–10, a veces dos seguidas y alguna grande)
    this.respiro = Math.max(0, this.respiro - dt);
    // (F6) Los respiros entre subidas: unos segundos de calma a horas fijas (la nave aguanta… y vuelve)
    for (const [hc, dur] of R.CALMAS) {
      if (h >= hc && !(this.calmas ??= new Set()).has(hc)) {
        this.calmas.add(hc);
        if (h < hc + 0.05) this.respiro = Math.max(this.respiro, dur);
      }
    }
    if (h >= NIGHT7.HORAS.CALOR && h < 6 && this.respiro <= 0) {
      const rotura = h >= NIGHT7.HORAS.ROTURA;
      this.eventoIn -= dt;
      if (this.eventoIn <= 0) {
        this.eventoIn = rand(rotura ? R.CADA_ROTURA : R.CADA_CALOR);
        if (rotura && Math.random() < 0.25) this._puerta();
        else this._sucesoCalor();
      }
      // (la primera, a los pocos segundos de las 4:00 y en la cámara que estés mirando)
      if (this.explosionIn === null) this._primeraPendiente = true;
      this.explosionIn = (this.explosionIn ?? R.PRIMERA_EXPLOSION) - dt;
      if (this.explosionIn <= 0) {
        this.explosionIn = rand(rotura ? R.EXPLOSION_5 : R.EXPLOSION_4);
        const grande = rotura && Math.random() < 0.3;
        this._explota(grande, this._primeraPendiente);
        this._primeraPendiente = false;
        if (rotura && Math.random() < 0.3) setTimeout(() => this.activa && this._explota(false), 700 + Math.random() * 900);
        if (grande) this.respiro = rand(R.RESPIRO);
      }
    }
    // 5:00: los cadáveres de la noche 6 empiezan a arder
    if (h >= NIGHT7.HORAS.ROTURA && !this.ardenCadaveres) {
      this.ardenCadaveres = true;
      // (las que tienen fuego simulado arden con él, desde las 3:00: _fuegoSimulado)
      for (const id of CADAVERES) {
        if (FOCOS(id).length) continue;
        const s = this.salas[id];
        s.fuego = Math.max(s.fuego, 0.05 + Math.random() * 0.2);
        if (!s.sueltos.length) s.sueltos.push({ x: 800, y: 650, e: 0.8 });
      }
    }
  }

  /** (v0.99) Una lámpara de la sala revienta: fogonazo, cristales y chispas; la sala queda más oscura. */
  revientaLampara(id) {
    const s = this.salas[id];
    if (!s || s.lamparas.length >= 3) return;
    s.lamparas.push({ x: null, y: null, t: 0 });     // (el sitio, al dibujar: la luz más fuerte de arriba)
    const mirando = this.g.cameras.open && this.g.cameras.active === id;
    this._son('lampara', { volume: mirando ? 0.9 : 0.2, muffle: mirando ? 0 : 0.7 });
    if (mirando) this.g.cameras.glitchIfWatching([id], 0.15);
  }

  /** (v0.99) Algo metálico (una bombona, una lata grande, un extintor) rueda por el suelo de la sala. */
  rueda(id) {
    const s = this.salas[id];
    if (!s) return;
    const izq = Math.random() < 0.5;
    s.ruedas.push({ x: izq ? 40 : W - 40, y: rand([560, 700]), v: (izq ? 1 : -1) * rand([380, 560]), r: rand([22, 34]),
      largo: rand([60, 110]), giro: 0, t: 0, tipo: pick(['bombona', 'lata', 'extintor']) });
    const mirando = this.g.cameras.open && this.g.cameras.active === id;
    if (mirando) this._son('rueda', { volume: 0.8, pan: izq ? -0.6 : 0.6 });
  }

  _lamparas(dt) {
    for (const s of Object.values(this.salas)) {
      for (const l of s.lamparas) {
        l.t += dt;
        // (v1.14) de vez en cuando, un chispazo del casquillo (el chispazo renderizado)
        if (l.x !== null && l.t > 1.5 && Math.random() < dt * 0.25) s.efectos.push({ id: 'chispas', x: l.x, y: l.y, e: 0.5, t: 0 });
      }
      for (const r of s.ruedas) {
        r.t += dt;
        r.v *= 1 - dt * 0.18;                       // (va frenando)
        r.x += r.v * dt;
        r.giro += (r.v * dt) / r.r;
        r.y += Math.sin(r.t * 2) * dt * 6;          // (el suelo no es plano)
      }
      s.ruedas = s.ruedas.filter((r) => r.t < 9 && r.x > -200 && r.x < W + 200);
    }
  }

  /** Lo que rueda, las lámparas reventadas y los pilotos de aviso (en drawRoom). */
  _caos(ctx, room, s) {
    const t = this.t;
    const h = this.hora;
    // (v1.14) La luz de la sala sobre lo renderizado aparte (más oscuro que el render; más aún si han
    // reventado lámparas)
    const luzSala = `brightness(${Math.max(0.25, 0.62 - s.oscuro * 0.6)}) saturate(0.8)`;
    // Lo que rueda (renderizado en 3D, con su sombra; sin el render, no se pinta nada)
    for (const r of s.ruedas) {
      const d = OBJ?.[`rueda_${r.tipo}`];
      const n = d?.n ?? 0;
      const fr = n ? (((Math.floor((Math.abs(r.giro) / (Math.PI * 2)) * n) % n) + n) % n) : 0;
      const im = n ? oimg(`rueda_${r.tipo}`, fr) : null;
      if (!im) continue;
      const w = r.largo * 1.9;
      const h = (w * d.h) / d.w;
      ctx.save();
      ctx.filter = luzSala;
      ctx.translate(r.x, r.y + r.r - h * 0.62);
      if (r.v < 0) ctx.scale(-1, 1);
      ctx.drawImage(im, -w / 2, 0, w, h);
      ctx.restore();
    }
    // Las lámparas reventadas: el fogonazo, los cristales (que caen y se quedan en el suelo: la animación
    // de Blender, escombros.py) y, después, la sala más oscura
    for (const l of s.lamparas) {
      if (l.x === null) {
        Object.assign(l, sitioTecho(ctx, []));
        s.oscuro = Math.min(0.5, s.oscuro + 0.17);
      }
      drawEscombro(ctx, 'lampara', Math.floor(l.t * 15), l.x, l.y, 1, { filtro: luzSala });
      if (l.t < 0.4) {
        const k = (1 - l.t / 0.4) ** 1.5;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, 520);
        g.addColorStop(0, `rgba(255,250,235,${0.95 * k})`);
        g.addColorStop(0.3, `rgba(255,230,190,${0.35 * k})`);
        g.addColorStop(1, 'rgba(255,220,180,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      } else {
        // (el sitio de la lámpara, ya sin luz: más oscuro alrededor)
        const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, 90);
        g.addColorStop(0, 'rgba(0,0,0,0.85)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(l.x - 90, l.y - 90, 180, 180);
      }
    }
    if (s.oscuro > 0) {
      ctx.fillStyle = `rgba(0,0,0,${s.oscuro})`;
      ctx.fillRect(0, 0, W, H);
    }
    // Los pilotos de aviso (rojos y ámbar), desde las 4:00; a las 5, más rápidos
    if (h >= NIGHT7.HORAS.CALOR) {
      s.pilotos ??= Array.from({ length: 3 + Math.floor(Math.random() * 3) }, () => ({
        x: 120 + Math.random() * 1360, y: 60 + Math.random() * 420, ambar: Math.random() < 0.35,
        f: rand([1.2, 3.2]), fase: Math.random() * 6,
      }));
      const rapido = h >= NIGHT7.HORAS.ROTURA ? 1.8 : 1;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of s.pilotos) {
        if (Math.sin(t * p.f * rapido * Math.PI * 2 + p.fase) < 0.2) continue;
        const c = p.ambar ? '255,170,40' : '255,40,30';
        // (un piloto pequeño: el punto y su halo)
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 22);
        g.addColorStop(0, `rgba(${c},0.9)`);
        g.addColorStop(0.12, `rgba(${c},0.5)`);
        g.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(p.x - 22, p.y - 22, 44, 44);
      }
      ctx.restore();
    }
  }

  /** ¿Arde algo en la sala? (para la Aberración: al cruzar el fuego, se le pega; v0.99) */
  salaArde(id) {
    const s = this.salas[id];
    if (!this.activa || !s) return false;
    return s.fuego > 0.1 || s.sueltos.length > 0 || !!s.sprite || !!s.expl ||
      Object.values(s.focos ?? {}).some((st) => st.on && st.nivel > 0.25);
  }

  /** Una llama suelta (el bucle simulado de fuego_sprite.py), de lado px, con la base en (x, y). */
  llama(ctx, x, y, lado, i = 0, alfa = 1) {
    const sp = SPR();
    const im = sp ? fimg('_sprite', `fuego_rejilla_${n2((Math.floor(this.t * 15) + i * 7) % sp.rejilla)}`) : null;
    if (!im) return false;
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.drawImage(im, x - lado / 2, y - lado * 0.85, lado, lado);
    ctx.restore();
    return true;
  }

  _salaViva(excepto = []) {
    const vivas = Object.keys(this.salas).filter((id) => !this.salas[id].muerta && !excepto.includes(id));
    return vivas.length ? pick(vivas) : null;
  }

  _aviso(id, texto) {
    const cam = ROOMS[id] ? `CAM ${ROOMS[id].cam}` : id;
    this.g.alerta?.(`${texto} – ${cam}`, 'danger');
  }

  /** 3:00 → 4:00: algo leve en una sala (chispas, vapor, una luz que falla) o un crujido. */
  _sucesoLeve() {
    const id = this._salaViva();
    if (!id) return;
    const s = this.salas[id];
    const tipo = pick(['luz', 'chispas', 'vapor', 'crujido']);
    const watching = this.g.cameras.open && this.g.cameras.active === id;
    if (tipo === 'crujido') {
      this._son('crujido', { volume: 0.45 });
      this.oficina.monitor = 0.25;
      return;
    }
    if (tipo === 'luz') s.apagon = rand([0.5, 1.2]);
    if (tipo === 'chispas') { s.chispas = rand([2, 3.5]); if (watching) this._son('chispas', { volume: 0.5 }); }
    if (tipo === 'vapor') { s.vapor = rand([2.5, 4]); if (watching) this._son('vapor', { volume: 0.5 }); }
    const cam = ROOMS[id] ? `CAM ${ROOMS[id].cam}` : id;
    this.g.alerta?.(`⚠ TEMPERATURA EN AUMENTO – ${cam}`, 'warn');
  }

  /** 4:00 → 5:00: el calor (una sala, un efecto). */
  _sucesoCalor() {
    const id = this._salaViva();
    if (!id) return;
    const s = this.salas[id];
    const tipo = pick(['luz', 'corte', 'vapor', 'panel', 'rociador', 'oficina', 'lampara', 'rueda', 'lampara']);
    const watching = this.g.cameras.open && this.g.cameras.active === id;
    if (tipo === 'oficina') {
      // En la oficina: el monitor parpadea y el metal cruje
      this.oficina.monitor = rand([0.6, 1.4]);
      this._son('crujido', { volume: 0.8 });
      if (this.g.cameras.open) this.g.cameras.glitchIfWatching([this.g.cameras.active], 0.4);
      return;
    }
    // (v0.99, más caos: una lámpara que revienta; algo que rueda por el suelo)
    if (tipo === 'lampara') { this.revientaLampara(id); return; }
    if (tipo === 'rueda') { this.rueda(id); return; }
    s.calor = rand([6, 10]);
    if (tipo === 'luz') s.apagon = rand([2.5, 4.5]);
    if (tipo === 'corte') {
      s.corte = rand([2, 3]);
      s.calor = s.corte + rand([5, 8]);        // (vuelve deformada por el calor)
      this.g.cameras.glitchIfWatching([id], s.corte);
    }
    if (tipo === 'vapor') { s.vapor = rand([5, 8]); if (watching) this._son('vapor'); }
    if (tipo === 'panel') this._rompe(id, 'techo');
    if (tipo === 'rociador') {
      s.rociador = rand([5, 8]);
      for (let i = 0; i < 14; i++) s.gotas.push({ x: Math.random() * W, y: Math.random() * H * 0.9, r: 6 + Math.random() * 22, vida: 1 });
      if (watching) this._son('rociador');
    }
    this._aviso(id, '⚠ TEMPERATURA CRÍTICA');
  }

  /** Una explosión en una sala (con fuego simulado, si lo tiene: su foco de tipo explosión). */
  _explota(grande, enLaMirada = false) {
    // (a menudo, la sala que estás mirando: si no, casi nunca se ven)
    const vista = this.g.cameras.open ? this.g.cameras.active : null;
    const id = vista && this.salas[vista] && !this.salas[vista].muerta && (enLaMirada || Math.random() < R.EXPLOSION_MIRADA) ? vista : this._salaViva();
    if (!id) return;
    const s = this.salas[id];
    const mirando = this.g.cameras.open && this.g.cameras.active === id;
    // (v1.14) Cada sitio estalla UNA vez: el foco de explosión de la sala (si no ha estallado ni está
    // estallando) o un sitio del fondo aún sin usar; si la sala ya no tiene dónde, no estalla nada
    const foco = FOCOS(id).find((f) => f.tipo === 'explosion' && !s.restos.has(f.id) && s.expl?.id !== f.id);
    const libres = SITIOS.filter((p) => !(s.sitiosUsados ??= []).includes(p));
    if (!foco && (s.sprite || s.expl || !libres.length)) return;
    if (foco) {
      s.expl = { id: foco.id, t: 0 };
      this._rompe(id, 'pared', foco.x, foco.y, 1.1);
    } else if (SPR()) {
      // (la explosión simulada suelta, en un sitio del fondo de la sala; se queda ardiendo)
      const sitio = pick(libres);
      s.sitiosUsados.push(sitio);
      const [x, y] = sitio;
      s.sprite = { x, y, e: (0.8 + Math.random() * 0.3) * (grande ? 1.3 : 1), t: 0 };
      this._rompe(id, 'pared', x, y, grande ? 1.3 : 1);
    } else {
      s.flash = 0.6;
      s.fuego = Math.max(s.fuego, 0.15);
    }
    s.calor = 8;
    this.g.events.emit('n7Explosion', { sala: id, grande });   // (v1.19: la ráfaga en su conducto)
    // Lo que se nota en la oficina: la grande, temblor y polvo; la de lejos, un golpe sordo
    if (mirando) {
      // (v0.99: cerca, el estallido saturado; lejos, el golpe sordo a través del casco)
      this._son('estallido', { volume: 1 });
      this.sacudida = Math.max(this.sacudida, 0.3);
    } else {
      this._son('lejano', { volume: grande ? 1 : 0.6 });
      this.sacudida = Math.max(this.sacudida, 0.12);
    }
    if (Math.random() < 0.5) setTimeout(() => this.activa && this._rompe(id, 'techo'), 250 + Math.random() * 500);
    if (grande) {
      this.sacudida = rand([0.5, 0.8]);
      this.oficina.flash = 0.3;
      this.oficina.grieta = Math.min(6, (this.oficina.grieta ?? 0) + 1);
      this._son('crujido', { volume: 0.7 });
      this.g.n7?.slaimiSusto?.();
    }
    this._aviso(id, '⚠ EXPLOSIÓN');
    if (foco || s.sprite) setTimeout(() => this.activa && this._aviso(id, '⚠ INCENDIO'), 2000);
  }

  /** Algo de la sala se rompe: 'techo' (una plancha del techo que cae) o 'pared' (la explosión arranca
   * un trozo de pared, que sale despedido y cae). (v1.14) Las dos, animaciones de Blender (escombros.py):
   * el hueco se queda y el trozo, en el suelo, el resto de la noche. */
  _rompe(id, tipo, x, y, e = 1) {
    const s = this.salas[id];
    if (!s || s.rotos.length >= R.ROTOS_MAX) return;
    const techo = tipo === 'techo';
    if (techo) { x = 800; y = 100; }       // (el sitio, al dibujarlo: sitioTecho)
    s.rotos.push({ tipo, x, y, e: e * (techo ? rand([0.9, 1.25]) : rand([0.85, 1.15])), t: 0, auto: techo, colocado: !techo, suena: true });
    if (techo) {
      const mirando = this.g.cameras.open && this.g.cameras.active === id;
      this._son('panel', { volume: mirando ? 0.8 : 0.25, muffle: mirando ? 0 : 0.6 });
    }
  }

  /** Los huecos y los trozos que caen (en drawFondo, detrás de los enemigos): el hueco (con sus cables,
   * su chapa doblada y el hollín) y la animación del trozo; su último fotograma (el trozo en el suelo) se
   * queda. Con la luz de la sala. */
  _rotos(ctx, s) {
    // (la sala está casi a oscuras: el render, con su luz —más oscuro y sin el azul del render—)
    const luzSala = `brightness(${Math.max(0.2, 0.42 - s.oscuro * 0.4)}) saturate(0.55) sepia(0.25)`;
    for (const r of s.rotos) {
      if (!r.colocado) {
        Object.assign(r, sitioTecho(ctx, s.rotos.filter((o) => o !== r && o.colocado)));
        r.colocado = true;
      }
      drawEscombro(ctx, `${r.tipo}_hueco`, 0, r.x, r.y, r.e, { filtro: luzSala });
      drawEscombro(ctx, `${r.tipo}_cae`, Math.floor(r.t * 15), r.x, r.y, r.e, { filtro: luzSala });
      // (los cables del hueco del techo chispean de vez en cuando)
      if (r.tipo === 'techo' && r.t > 2 && r.t < 40 && Math.random() < 0.004) s.efectos.push({ id: 'chispas', x: r.x, y: r.y + 40 * r.e, e: 0.6 * r.e, t: 0 });
      if (r.suena && r.t > 0.95) {
        r.suena = false;
        const mirando = this.g.cameras.open && this.g.cameras.active === this._idDe(s);
        if (mirando) this._son('metal', { volume: 0.6 });
      }
    }
  }

  /** El id de una sala (por su estado). */
  _idDe(s) {
    return Object.keys(this.salas).find((k) => this.salas[k] === s);
  }

  /** Los conductos que aún no han explotado. */
  _sinExplotar() {
    return Object.keys(this.rejillas).filter((l) => this.rejillas[l].estado === 'abierta');
  }

  /** Explota el conducto de una rejilla (UNA vez por noche cada uno): el estallido sale por el hueco hacia
   * ti con trozos del conducto, y el canto se queda doblado y ennegrecido, ardiendo un rato y echando humo. */
  explotaRejilla(lado = pick(this._sinExplotar())) {
    const r = this.rejillas[lado];
    if (!r || r.estado !== 'abierta') return;
    r.estado = 'explota';
    r.t = 0;
    r.arde = rand(R.REJILLA_ARDE);
    const pan = lado === 'left' ? -0.8 : 0.8;
    this._son('estallido', { volume: this.g.cameras.open ? 0.8 : 1, pan });
    setTimeout(() => this.activa && this._son('panel', { volume: 0.6, pan }), 350);
    this.sacudida = Math.max(this.sacudida, 0.6);
    this.oficina.flash = Math.max(this.oficina.flash, 0.3);
    if (this.g.cameras.open) this.g.cameras.glitchIfWatching([this.g.cameras.active], 0.3);
    this.g.n7?.slaimiSusto?.();
    this.g.alerta?.(`⚠ EXPLOSIÓN – REJILLA ${lado === 'left' ? 'IZQUIERDA' : 'DERECHA'}`, 'danger');
  }

  /** Los focos simulados: crecen; a las 4:00 los cadáveres de la noche 6 empiezan a arder. */
  _fuegoSimulado(dt, h) {
    for (const s of Object.values(this.salas)) {
      if (!s.sprite) continue;
      s.sprite.t += dt;
      if (s.sprite.t >= (SPR()?.explosion ?? 24) / 15) {
        s.sueltos.push({ x: s.sprite.x, y: s.sprite.y + 40, e: s.sprite.e * 0.6 });
        s.fuego = Math.max(s.fuego, 0.15);
        s.sprite = null;
      }
    }
    for (const [id, s] of Object.entries(this.salas)) {
      const focos = FOCOS(id);
      if (!focos.length) continue;
      for (const f of focos) {
        const st = s.focos[f.id] ??= { nivel: 0, on: false };
        // (3:00: los cadáveres empiezan a arder, poco; 4:00, crecen; 5:00, grandes)
        if (f.id === 'cadaver' && h >= NIGHT7.HORAS.NUCLEO && !st.on) st.on = true;
        if (!st.on) continue;
        if (h < NIGHT7.HORAS.CALOR) st.nivel = Math.min(Math.max(st.nivel, R.FUEGO_LEVE), st.nivel + dt * 0.01);
        else st.nivel = Math.min(1, st.nivel + dt * (h >= NIGHT7.HORAS.ROTURA ? R.FUEGO_CRECE_5 : R.FUEGO_CRECE_4));
      }
      if (s.focos.cadaver?.on) s.ennegrece = Math.min(1, s.ennegrece + (dt / R.ENNEGRECE) * (h < NIGHT7.HORAS.CALOR ? 0.3 : 1));
      if (s.expl) {
        s.expl.t += dt;
        const f = focos.find((x) => x.id === s.expl.id);
        if (s.expl.t >= (f?.explosion ?? 24) / 15) {
          s.restos.add(s.expl.id);
          const st = s.focos[s.expl.id] ??= { nivel: 0, on: false };
          st.on = true;
          st.nivel = Math.max(st.nivel, 0.5);
          // (v0.99: en las salas sin cadáver, la explosión prende lo que hay en la sala: su foco 'fuego')
          for (const g of focos) {
            if (g.tipo !== 'fuego' || g.id === 'cadaver') continue;
            const sg = s.focos[g.id] ??= { nivel: 0, on: false };
            if (!sg.on) { sg.on = true; sg.nivel = Math.max(sg.nivel, 0.3); }
          }
          s.expl = null;
        }
      }
      // El humo del fuego simulado también llena la sala y acaba quemando la cámara (desde las 4:00)
      const fuerza = Math.max(0, ...Object.values(s.focos).map((x) => x.nivel));
      if (fuerza > 0 && h >= NIGHT7.HORAS.CALOR) s.humo = Math.min(1, s.humo + dt * R.HUMO_CRECE * fuerza * 0.6);
    }
  }

  /** Cuántas cámaras se han quemado ya según la hora (al final de las 5, solo quedan 2 o 3). */
  _quemaCamaras(dt, h) {
    for (const [id, s] of Object.entries(this.salas)) {
      if (s.quemando >= 0 && !s.quemada) {
        s.quemando += dt;
        if (s.quemando >= R.QUEMA_DURA) {
          s.quemada = true;
          s.muerta = true;
          this.muertas++;
        }
      }
    }
    // (v0.97, el usuario: «las cámaras se empiezan a quemar a partir de las 4»: la primera, a las
    // 4:00 y poco; 3 a las 5:00; QUEMADAS_FINAL al final)
    if (h < NIGHT7.HORAS.CALOR + 0.05) return;
    const objetivo = h < 5 ? 1 + Math.floor(((h - 4.05) / 0.95) * 2.5) : Math.round(3 + ((h - 5) / 0.85) * (R.QUEMADAS_FINAL - 3));
    const ya = Object.values(this.salas).filter((s) => s.quemando >= 0).length;
    if (ya < Math.min(R.QUEMADAS_FINAL, objetivo)) {
      // (mejor una que ya arde)
      const ardiendo = Object.keys(this.salas).filter((id) => this.salas[id].quemando < 0 && (this.salas[id].humo > 0.3 || this.salas[id].fuego > 0));
      const id = ardiendo.length ? pick(ardiendo) : this._salaViva();
      if (id) this._quema(id);
    }
  }

  /** La cámara se quema por el calor (sin grieta): unos segundos de agonía y negro. */
  _quema(id) {
    const s = this.salas[id];
    if (s.quemando >= 0) return;
    s.quemando = 0;
    const cam = ROOMS[id] ? `CAM ${ROOMS[id].cam}` : id;
    this.g.alerta?.(`⚠ ${cam} – SOBRECALENTAMIENTO, SEÑAL PERDIDA`, 'danger');
  }

  /** ¿Esta cámara ya está quemada (pantalla negra para siempre)? */
  camQuemada(room) {
    return !!this.salas[room]?.quemada;
  }

  /** Las cámaras quemadas (para resetcam: no se pueden arreglar). */
  quemadas() {
    return Object.keys(this.salas).filter((id) => this.salas[id].quemada).map((id) => `CAM ${ROOMS[id].cam}`);
  }

  /** Una puerta de los lados que se abre sola (si estaba cerrada) o se atasca (no se puede cerrar). */
  _puerta() {
    const of = this.g.office;
    const lado = pick(['left', 'right']);
    const nombre = lado === 'left' ? 'IZQUIERDA' : 'DERECHA';
    if (of.doors[lado].closed) {
      of.doors[lado].closed = false;
      this.g.events.emit('door', { side: lado, closed: false });
      this._son('forzada', { pan: lado === 'left' ? -0.8 : 0.8 });
      this.g.alerta?.(`⚠ COMPUERTA ${nombre}: APERTURA FORZADA`, 'danger');
    } else {
      of.atascada = { ...(of.atascada ?? {}), [lado]: rand(R.ATASCO) };
      this._son('chispas', { pan: lado === 'left' ? -0.8 : 0.8 });
      this.g.alerta?.(`⚠ COMPUERTA ${nombre} ATASCADA`, 'danger');
    }
  }

  // --- Dibujo: las cámaras ---------------------------------------------------------------------
  /** El fuego de DETRÁS (antes de los enemigos): la carne ennegrecida, la luz del fuego sobre la
   * sala, los focos que están más lejos que los enemigos y los escombros de las explosiones. */
  drawFondo(ctx, room) {
    if (!this.activa) return;
    const s = this.salas[room];
    const focos = FOCOS(room);
    if (!s) return;
    const fr = Math.floor(this.t * 15);
    this._rotos(ctx, s);
    this._sueltos(ctx, s, fr);
    if (!focos.length) return;
    // La carne del cadáver, ennegreciéndose
    const cad = focos.find((f) => f.id === 'cadaver');
    if (cad && s.ennegrece > 0) {
      // (v1.14: un degradado aplastado, que se pierde del todo antes de su borde: sin contorno)
      ctx.save();
      ctx.translate(cad.x, cad.y);
      ctx.rotate(0.15);
      ctx.scale(1, 60 / 140);
      const g = ctx.createRadialGradient(0, 0, 5, 0, 0, 140);
      g.addColorStop(0, `rgba(12,8,6,${0.85 * s.ennegrece})`);
      g.addColorStop(1, 'rgba(12,8,6,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-140, -140, 280, 280);
      ctx.restore();
    }
    for (const f of focos) {
      if (s.restos.has(f.id)) {
        const im = fimg(room, `restos_${f.id}`);
        if (im) ctx.drawImage(im, 0, 0, W, H);
      }
    }
    // La luz de los fuegos sobre la sala (todos: también los de delante iluminan la sala)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of focos) {
      const st = s.focos[f.id];
      if (!st?.on || !f.bucle) continue;
      const im = fimg(room, `luz_${f.id}_${n2((fr + f.x) % f.bucle)}`);
      if (im) {
        const luz = (R.FUEGO_SALA[room]?.luz ?? 1) * (0.1 + st.nivel * 1.1);
        ctx.globalAlpha = Math.min(1, luz);
        ctx.drawImage(im, 0, 0, W, H);
        if (luz > 1) {                     // (más luz de la que da la imagen: otra pasada)
          ctx.globalAlpha = Math.min(1, luz - 1);
          ctx.drawImage(im, 0, 0, W, H);
        }
      }
    }
    ctx.restore();
    for (const f of focos) if (!f.delante) this._capaFuego(ctx, room, f, s, fr);
  }

  _capaFuego(ctx, room, f, s, fr) {
    const st = s.focos[f.id];
    if (!st?.on || !f.bucle) return;
    const im = fimg(room, `fuego_${f.id}_${String((fr + f.x) % f.bucle).padStart(2, '0')}`);
    if (!im) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, 0.3 + st.nivel * 0.8);
    // (pequeño a las 3 y a las 4: se escala hacia su base; a las 5, entero)
    const k = (0.35 + 0.65 * Math.sqrt(st.nivel)) * (f.tipo === 'fuego' ? (R.FUEGO_SALA[room]?.tam ?? 1) : 1);
    ctx.translate(f.x, f.y);
    ctx.scale(k, k);
    ctx.translate(-f.x, -f.y);
    ctx.drawImage(im, 0, 0, W, H);
    // (v0.99: otra pasada sumando luz: las llamas brillan; el humo, al sumar, no se nota)
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, R.FUEGO_BRILLO * (0.4 + 0.6 * st.nivel) * (R.FUEGO_SALA[room]?.brillo ?? 1));
    ctx.drawImage(im, 0, 0, W, H);
    ctx.restore();
  }

  /** Los fuegos que dejan las explosiones sueltas (el bucle de fuego_sprite.py), con su luz. */
  _sueltos(ctx, s, fr) {
    const sp = SPR();
    if (!sp || !s.sueltos.length) return;
    const k = Math.min(1, 0.45 + s.fuego);
    for (const [i, f] of s.sueltos.entries()) {
      const vi = 0.75 + 0.25 * Math.sin(this.t * 13 + i) * Math.sin(this.t * 7.7 + i * 2);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(f.x, f.y, 10, f.x, f.y, 520 * f.e);
      g.addColorStop(0, `rgba(255,120,35,${0.32 * k * vi})`);
      g.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      const im = fimg('_sprite', `fuego_rejilla_${n2((fr + i * 7) % sp.rejilla)}`);
      if (!im) continue;
      const lado = 330 * f.e;          // (la imagen va recortada al fuego: la llama, abajo)
      ctx.save();
      ctx.globalAlpha = k;
      ctx.drawImage(im, f.x - lado / 2, f.y - lado * 0.85, lado, lado);
      ctx.restore();
    }
  }

  /** La explosión suelta de una sala (fuego_sprite.py, vista desde arriba) con su luz. */
  _explosionSuelta(ctx, room, s) {
    const e = s.sprite;
    const n = SPR()?.explosion ?? 0;
    const k = Math.floor(e.t * 15);
    const luz = Math.exp(-e.t * 3.2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(e.x, e.y, 20, e.x, e.y, 1100 * e.e);
    g.addColorStop(0, `rgba(255,170,80,${0.85 * luz})`);
    g.addColorStop(0.5, `rgba(255,100,30,${0.35 * luz})`);
    g.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    const im = n ? fimg('_sprite', `explosion_arriba_${n2(Math.min(k, n - 1))}`) : null;
    if (im) {
      const lado = 560 * e.e;
      ctx.drawImage(im, e.x - lado / 2, e.y - lado * 0.5, lado, lado);
    }
    if (e.t < 0.3) {
      ctx.fillStyle = `rgba(255,${235 - e.t * 300},${200 - e.t * 500},${0.95 * (1 - e.t / 0.3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (e.t > 0.12 && e.t < 0.62) this.g.cameras.glitchIfWatching([room], 0.08);
  }

  /** Encima de la imagen de una sala, DELANTE de los enemigos (antes del aspecto de cámara). */
  drawRoom(ctx, room) {
    if (!this.activa) return;
    const s = this.salas[room];
    if (!s) return;
    const t = this.t;
    const h = this.hora;
    const focos = FOCOS(room);
    const fr = Math.floor(t * 15);
    for (const f of focos) if (f.delante) this._capaFuego(ctx, room, f, s, fr);
    // El aire que ondula sobre las llamas
    for (const f of focos) {
      const st = s.focos[f.id];
      if (st?.on && st.nivel > 0.2) this._ondasZona(ctx, f.x - 220, f.y - 420, 440, 420, st.nivel);
    }
    // La explosión (su secuencia y su luz), el fogonazo y la onda (la imagen pierde señal medio segundo)
    if (s.expl) {
      const f = focos.find((x) => x.id === s.expl.id);
      const k = Math.floor(s.expl.t * 15);
      const im = fimg(room, `explosion_${f.id}_${String(Math.min(k, f.explosion - 1)).padStart(2, '0')}`);
      const luz = fimg(room, `explosion_luz_${f.id}_${String(Math.min(k, f.explosion - 1)).padStart(2, '0')}`);
      if (luz) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(luz, 0, 0, W, H); ctx.restore(); }
      if (im) ctx.drawImage(im, 0, 0, W, H);
      const et = s.expl.t;
      if (et < 0.3) {
        ctx.fillStyle = `rgba(255,${235 - et * 300},${200 - et * 500},${0.95 * (1 - et / 0.3)})`;
        ctx.fillRect(0, 0, W, H);
      }
      if (et > 0.12 && et < 0.62) this.g.cameras.glitchIfWatching([room], 0.08);
    }
    if (s.sprite) this._explosionSuelta(ctx, room, s);
    // (v1.14) Las brasas que suben de los fuegos y los chispazos: animaciones de Blender (escombros.py),
    // sumadas (brillan); nada dibujado
    for (const f of focos) {
      const st = s.focos[f.id];
      if (st?.on && st.nivel > 0.15) drawEscombro(ctx, 'brasas', fr + f.x, f.x, f.y - 10, 0.9, { luz: true, bucle: true, alfa: Math.min(1, st.nivel * 1.3) });
    }
    for (const e of s.efectos) drawEscombro(ctx, e.id, Math.floor(e.t * 15), e.x, e.y, e.e, { luz: true });
    void h;
    // El calor: la imagen ondula y se quema
    if (s.calor > 0) this._ondas(ctx, Math.min(1, s.calor / 4));
    // El vapor de una tubería reventada (tapa parte de la imagen)
    if (s.vapor > 0) {
      const k = Math.min(1, s.vapor / 1.5);
      for (let i = 0; i < 6; i++) {
        const x = 260 + i * 90 + Math.sin(t * 0.7 + i) * 40;
        const y = 220 + Math.sin(t * 0.5 + i * 2) * 60;
        const g = ctx.createRadialGradient(x, y, 10, x, y, 260);
        g.addColorStop(0, `rgba(225,230,235,${0.45 * k})`);
        g.addColorStop(1, 'rgba(225,230,235,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
    }
    // Un cable que chispea (3:00–4:00): el chispazo renderizado, unas veces seguidas en el mismo sitio
    if (s.chispas > 0) {
      s.chispazo ??= { ...sitioTecho(ctx, s.rotos), prox: 0 };
      if ((s.chispazo.prox -= 1 / 60) <= 0) {
        s.chispazo.prox = rand([0.35, 0.9]);
        s.efectos.push({ id: 'chispas', x: s.chispazo.x, y: s.chispazo.y, e: rand([0.6, 0.9]), t: 0 });
      }
    } else s.chispazo = null;
    // El fuego (las salas que explotaron y, desde las 5, los cadáveres de la noche 6)
    // (sin la explosión simulada suelta: el fuego dibujado de antes)
    this._caos(ctx, room, s);
    // El humo, que llena la imagen hasta dejarla gris
    if (s.humo > 0) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `rgba(95,95,98,${Math.min(0.97, s.humo * 1.1)})`);
      g.addColorStop(1, `rgba(80,80,84,${s.humo * 0.75})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    // La luz roja girando (desde el núcleo al 100 %)
    if (this.n7.nucleo) this._baliza(ctx, t + room.length);
    // Las luces de la sala se apagan unos segundos
    if (s.apagon > 0) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() < 0.12 ? 0.6 : 0.9})`;
      ctx.fillRect(0, 0, W, H);
    }
    // El rociador: las gotas en la lente (manchas desenfocadas, sin borde)
    for (const gq of s.gotas) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, gq.vida * 1.5);
      const g = ctx.createRadialGradient(gq.x - gq.r * 0.3, gq.y - gq.r * 0.3, 1, gq.x, gq.y, gq.r);
      g.addColorStop(0, 'rgba(255,255,255,0.35)');
      g.addColorStop(0.7, 'rgba(180,200,215,0.12)');
      g.addColorStop(1, 'rgba(20,25,30,0.35)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(gq.x, gq.y, gq.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // El fogonazo de una explosión
    if (s.flash > 0) {
      ctx.fillStyle = `rgba(255,250,235,${Math.min(1, s.flash / 0.25) * 0.9})`;
      ctx.fillRect(0, 0, W, H);
    }
    // El corte (2–3 s): sin señal
    if (s.corte > 0) {
      ctx.fillStyle = '#050607';
      ctx.fillRect(0, 0, W, H);
    }
    // La cámara quemándose (sin grieta)
    if (s.quemando >= 0 && !s.quemada) this._quemandose(ctx, s.quemando / R.QUEMA_DURA);
  }

  _ondasZona(ctx, x, y, w, h, k) {
    x = Math.max(0, Math.round(x));
    y = Math.max(0, Math.round(y));
    w = Math.min(W - x, Math.round(w));
    h = Math.min(H - y, Math.round(h));
    if (w <= 0 || h <= 0) return;
    const c = copiaReal(ctx, x, y, w, h, this._copiaZ ??= document.createElement('canvas'));
    const kx = c.width / w;
    const ky = c.height / h;
    for (let yy = 0; yy < h; yy += 6) {
      // (se apaga hacia los bordes: sin costuras)
      const borde = Math.sin((yy / h) * Math.PI);
      const dx = Math.sin((y + yy) * 0.08 + this.t * 9) * 3 * k * borde;
      ctx.drawImage(c, 0, yy * ky, c.width, 6 * ky, x + dx, y + yy, w, 6);
    }
  }

  /** p 0..1: se sobreexpone y se quema hacia naranja y blanco, ondula, píxeles muertos, rayas de
   * colores, se derrite hacia abajo y, al final, se corta a negro con un último parpadeo. */
  _quemandose(ctx, p) {
    const t = this.t;
    // Sobreexposición y colores quemados
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,${Math.round(150 + 80 * p)},${Math.round(60 + 60 * p)},${Math.min(0.75, p * 0.9)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    // Ondas fuertes
    this._ondas(ctx, Math.min(1, 0.4 + p * 1.4));
    // Se derrite hacia abajo (desde la mitad)
    if (p > 0.45) {
      const c = copiaReal(ctx, 0, 0, W, H, this._copia ??= document.createElement('canvas'));
      const kx = c.width / W;
      const ky = c.height / H;
      const m = (p - 0.45) / 0.55;
      for (let x = 0; x < W; x += 16) {
        const caida = (Math.sin(x * 0.013 + 1.7) * 0.5 + 0.5) * 160 * m * m + 20 * m;
        ctx.drawImage(c, x * kx, 0, 16 * kx, (H - caida) * ky, x, caida, 16, H - caida);
      }
    }
    // Al final: negro, con un último parpadeo
    if (p > 0.88) {
      ctx.fillStyle = Math.sin(t * 60) > 0.6 && p < 0.95 ? 'rgba(255,200,150,0.6)' : '#000';
      ctx.fillRect(0, 0, W, H);
    }
  }

  /** La pantalla de una cámara quemada: negro, brillo naranja en los bordes y el texto. Sin grieta. */
  drawQuemada(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const k = 0.75 + 0.25 * Math.sin(this.t * 2.2);
    for (const [x0, y0, x1, y1] of [[0, 0, 0, 160], [0, H, 0, H - 160], [0, 0, 220, 0], [W, 0, W - 220, 0]]) {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, `rgba(255,110,30,${0.42 * k})`);
      g.addColorStop(1, 'rgba(255,110,30,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 40px "Courier New", monospace';
    ctx.fillStyle = `rgba(255,140,60,${0.85 * k})`;
    ctx.fillText('SEÑAL PERDIDA – SOBRECALENTAMIENTO', W / 2 - 60, H / 2 - 20);
  }

  _ondas(ctx, k) {
    // Ondas de calor: franjas horizontales desplazadas, y los colores quemados
    const c = copiaReal(ctx, 0, 0, W, H, this._copia ??= document.createElement('canvas'));
    const ky = c.height / H;
    const banda = 12;
    for (let y = 0; y < H; y += banda) {
      const dx = Math.sin(y * 0.03 + this.t * 6) * 9 * k + Math.sin(y * 0.011 - this.t * 2.3) * 5 * k;
      ctx.drawImage(c, 0, y * ky, c.width, banda * ky, dx, y, W, banda);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = `rgba(255,120,40,${0.35 * k})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }


  _baliza(ctx, t) {
    // Un haz rojo que barre la imagen de lado a lado (giro cada 2,4 s)
    const x = W / 2 + Math.sin((t * Math.PI * 2) / 2.4) * W * 0.6;
    const g = ctx.createRadialGradient(x, 120, 20, x, 300, 760);
    g.addColorStop(0, 'rgba(255,40,25,0.32)');
    g.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    ctx.fillStyle = 'rgba(40,0,0,0.12)';
    ctx.fillRect(0, 0, W, H);
  }

  /** Las cámaras quemadas, en el plano: en naranja, con una llama (no la cruz de las rotas). */
  drawMapa(ctx) {
    if (!this.activa) return;
    ctx.save();
    for (const [id, s] of Object.entries(this.salas)) {
      if (!(s.quemada || s.quemando >= 0) || !ROOMS[id]) continue;
      const b = miniBox(ROOMS[id].mapRect);
      ctx.fillStyle = s.quemada ? 'rgba(120,40,0,0.55)' : 'rgba(255,110,30,0.3)';
      ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      ctx.strokeStyle = 'rgba(255,140,40,0.95)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      // la llama
      // la llama, en la esquina de arriba (que no tape el nombre)
      const cx = b.x + b.w - 3;
      const cy = b.y + 2;
      const vi = 0.85 + 0.15 * Math.sin(this.t * 9 + cx);
      ctx.fillStyle = '#ff8a1e';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 11 * vi);
      ctx.quadraticCurveTo(cx + 6, cy - 2, cx + 4, cy + 3);
      ctx.quadraticCurveTo(cx, cy + 6, cx - 4, cy + 3);
      ctx.quadraticCurveTo(cx - 6, cy - 2, cx, cy - 11 * vi);
      ctx.fill();
      ctx.fillStyle = '#ffd25a';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 1, 2, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // --- Dibujo: la oficina -------------------------------------------------------------------------
  drawOffice(ctx, face) {
    if (!this.activa) return;
    const t = this.t;
    // (v1.12) La oficina es siempre la de Blender (OficinaV2): el humo, los cables, las grietas, el vaho,
    // los escombros y el fuego están en su imagen, por estados. Aquí solo lo que se mueve.
    if (face === 'front') {
      // El monitor parpadea
      // (v1.12: solo el cristal del CRT, no un rectángulo encima de la consola)
      if (this.oficina.monitor > 0 && Math.random() < 0.6) {
        const m = this.g.ofv2?.pantalla ?? MONITOR;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(m.x, m.y, m.w, m.h);
      }
    }
    // La luz roja girando
    if (this.n7.nucleo) this._baliza(ctx, t);
    // El fogonazo de una explosión lejana
    if (this.oficina.flash > 0) {
      ctx.fillStyle = `rgba(255,240,220,${this.oficina.flash * 0.6})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  /** Las rejillas del frente (con el movimiento de la vista: Game las pinta en el overlay): el
   * estallido que sale hacia ti, la luz en la oficina, la rejilla ardiendo y su humo. */
  drawRejillas(ctx) {
    if (!this.activa) return;
    // (v1.12) Con la explosión simulada dentro de la oficina (explosion_oficina.py): el estallido, su luz,
    // los trozos y después la rejilla ardiendo con su humo, todo del render
    if (!this.g.ofv2?.nExplosion?.('left')) return;        // (v1.14: sin el render, nada dibujado)
    {
      for (const [lado, r] of Object.entries(this.rejillas)) {
        // (v1.19) Antes de explotar, desde las 4: un hilo del humo de los conductos sale por el hueco y, a
        // ratos, el resplandor del fuego de dentro (el mismo humo y la misma llama del render, muy flojos)
        if (r.estado === 'abierta' && this.hora >= 4 && this.n7.conductos?.activo !== false) {
          const C = NIGHT7.CONDUCTOS.REJILLAS_OFICINA;
          this.g.ofv2.drawHumo(ctx, lado, this.t, C.HUMO[0] + (C.HUMO[1] - C.HUMO[0]) * Math.min(1, this.hora - 4));
          const p = Math.sin(this.t * C.RESPLANDOR_VEL + (lado === 'left' ? 0 : 2.4));
          if (p > 0.82) this.g.ofv2.drawArde(ctx, lado, this.t, C.RESPLANDOR * (p - 0.82) / 0.18);
        }
        if (r.estado === 'explota') this.g.ofv2.drawExplosion(ctx, lado, r.t);
        else if (r.estado === 'quemada') {
          // (quemada: arde un rato y, desde el estallido, sale humo del conducto toda la noche: el humo
          // simulado de explosion_oficina.py, en bucle)
          this.g.ofv2.drawHumo(ctx, lado, this.t, Math.min(1, R.REJILLA_HUMO + (1 - Math.min(1, r.arde / 2.5))));
          if (r.arde > 0) this.g.ofv2.drawArde(ctx, lado, this.t, Math.min(1, r.arde / 2.5));
        }
        if (r.estado === 'explota' && r.t < 0.12) {
          ctx.fillStyle = `rgba(255,235,200,${0.6 * (1 - r.t / 0.12)})`;
          ctx.fillRect(0, 0, W, H);
        }
      }
    }
  }


  /** La temperatura del módulo, en pantalla (desde las 4). */
  drawHud(ctx) {
    if (!this.activa) return;
    const h = this.hora;
    if (h < NIGHT7.HORAS.CALOR) return;
    const temp = Math.round(R.TEMP[0] + (R.TEMP[1] - R.TEMP[0]) * Math.min(1, (h - NIGHT7.HORAS.CALOR) / 2));
    ctx.save();
    ctx.textAlign = 'right';
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillStyle = temp >= 50 ? (Math.floor(this.t * 2) % 2 ? '#ff5050' : '#ffb070') : '#ffb070';
    ctx.fillText(`TEMP. MÓDULO ${temp} °C`, W - 40, 128);
    ctx.restore();
  }
}
