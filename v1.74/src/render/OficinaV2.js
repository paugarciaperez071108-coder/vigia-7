// =============================================================
// OficinaV2.js — La oficina entera hecha en Blender, por estados (v1.00).
// tools/3d/salas/oficina_v2.py + fuego_oficina.py → integrar_oficina.py →
// assets/salas/v2/ (indice.json).
//
// El usuario (2026-10-29): «todo lo que forma parte de la oficina (mesa, ventana,
// grietas, escombros, cables y fuego) se hace en Blender, en la misma escena y
// desde la misma cámara… nada de líneas, polígonos ni rectángulos dibujados
// encima». Aquí solo se ponen las imágenes: la oficina de cada vista, y los
// bucles del fuego (la llama y su luz, que parpadea en las paredes, la mesa y el
// monitor). Encima siguen yendo solo las cosas que se usan: la imagen del CRT,
// los botones, las puertas y los enemigos (OfficeView).
//
// Estados (se van sumando): normal (noches 1–6), 4am, 5am, final. Se pasa de uno a
// otro con un evento (una explosión: un segundo sin luz) para que el jugador vea que
// la oficina empeora, sin saltos raros. Solo se usan los que ya están renderizados.
//
// (v1.12, el usuario: «una sola oficina para todo el juego») La oficina v2 es LA oficina, en todas
// las noches y vistas (también detrás). Variantes del mismo modelo: <estado>_apagon (solo la luz
// de emergencia) y <estado>_pasillo (el hueco de cada puerta con la luz del pasillo encendida);
// si un estado no tiene su variante, se usa la de «normal».
// =============================================================

import { CONFIG } from '../config.js';
import { NIGHT7 } from '../night/night7.js';
import { drawEscombro, nEscombro } from './Escombros.js';

// (2026-11-08) LA OFICINA ÚNICA (tools/3d/salas/oficina_v2.py --unica → integrar_unica.py → assets/salas/unica/): la
// misma escena que la oficina 3D (prólogo, 2.5, noche 4, final), con la MISMA luz y el mismo tono (tono_3d.py). Una
// base limpia para todas las noches y, encima, los daños de la noche 7 como capas con transparencia desde la misma
// cámara. CONFIG.OFICINA.UNICA la enciende; ?oficina=unica | ?oficina=v2 fuerzan una u otra (para comparar).
const QS = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
export const UNICA = QS?.get('oficina') === 'unica' ? true : QS?.get('oficina') === 'v2' ? false : !!CONFIG.OFICINA?.UNICA;
const DIR = UNICA ? 'salas/unica' : 'salas/v2';
const ALARMA_GANANCIA = 1.7;   // (oficina única) lo fuerte que se ve la luz de la baliza del render al barrer la pared
let IND = null;
const IMGS = {};
fetch(`assets/${DIR}/indice.json`).then((r) => (r.ok ? r.json() : null)).then((j) => { IND = j; precargar(); }).catch(() => {});

function img(src) {
  let i = IMGS[src];
  if (!i) {
    i = IMGS[src] = new Image();
    i.src = src;
  }
  return i.complete && i.naturalWidth ? i : null;
}
const capa = (estado, f, c, k) => `assets/${f.dir ?? DIR}/${estado}/${f.id}_${f.cara}_${c}_${String(k).padStart(2, '0')}.webp`;

// (v1.12) Se carga por partes: al empezar, solo la oficina normal y sus variantes; los estados de daño de
// la noche 7 (con su fuego y su caída, cientos de fotogramas), el actual y el siguiente, a medida que
// llegan; los ya pasados se sueltan. Si se pedía todo de golpe, la oficina se quedaba en negro hasta que
// cargaban los fotogramas del fuego (y ocupaban memoria toda la noche).
const ORDEN = ['normal', '4am', '430', '5am', 'final'];
const CARGADOS = new Set();
const carasDe = (d) => [d?.caras, d?.capas, d?.capas_apagon].flatMap((o) => Object.values(o ?? {})).map((src) => `assets/${src.src ?? src}`);

function precargar() {
  for (const [k, d] of Object.entries(IND ?? {})) if (k === 'normal' || k.startsWith('normal_')) carasDe(d).forEach(img);
}

function cargaEstado(estado) {
  if (!IND || CARGADOS.has(estado)) return;
  CARGADOS.add(estado);
  for (const k of [estado, `${estado}_apagon`, `${estado}_pasillo`]) carasDe(IND[k]).forEach(img);
  const d = IND[estado];
  if (d?.caida?.capas) for (const l of Object.values(d.caida.capas)) for (const x of l) { if (x) img(`assets/${x.src}`); }
  else for (const cara of d?.caida?.caras ?? []) for (let k = 0; k < d.caida.n; k++) img(`assets/${DIR}/${estado}/caida_${cara}_${String(k).padStart(2, '0')}.jpg`);
  for (const f of d?.fuegos ?? []) for (const c of ['fuego', 'luz']) for (let k = 0; k < (f[c]?.n ?? 0); k++) img(capa(estado, f, c, k));
  for (const k of [estado, `${estado}_apagon`]) for (const r of Object.values(IND?.[k]?.rejillas ?? {})) img(`assets/${r.src}`);
  for (const r of Object.values(IND?.[estado]?.rejillas_apagon ?? {})) img(`assets/${r.src}`);
}

function sueltaEstado(estado) {
  if (estado === 'normal' || !CARGADOS.delete(estado)) return;
  for (const k of Object.keys(IMGS)) {
    if ([DIR, 'salas/v2'].some((dd) => k.startsWith(`assets/${dd}/${estado}/`) || k.startsWith(`assets/${dd}/${estado}_`))) {
      IMGS[k].src = '';
      delete IMGS[k];
    }
  }
}

export class OficinaV2 {
  constructor(game) {
    this.g = game;
    this.actual = null;        // el estado que se ve
    this.cambio = 0;           // s del apagón de un segundo al cambiar de estado
    this.forzado = null;       // (debug) un estado fijo
    this.t = 0;
  }

  /** El estado que toca ahora (o null: la oficina de siempre). */
  _quiere() {
    if (this.forzado) return IND?.[this.forzado] ? this.forzado : null;
    const g = this.g;
    // (v1.12: en todas las noches y escenas; solo la noche 7 la va rompiendo)
    if (g.nightNumber === 7 && g.n7?.active) {
      const h = g.clock.elapsed / g.clock.sph;
      for (const [e, desde] of [['final', NIGHT7.HORAS.SILENCIO - 0.4], ['5am', NIGHT7.HORAS.ROTURA], ['430', NIGHT7.HORAS.CALOR + 0.5], ['4am', NIGHT7.HORAS.CALOR]]) {
        if (h >= desde && IND?.[e]) return e;
      }
    }
    return IND?.normal ? 'normal' : null;
  }

  update(dt) {
    this.t += dt;
    if (this.caida) {
      const c = this.caida;
      c.t += dt;
      // (los golpes de lo que cae: el metal contra el suelo y la mesa)
      if (!c.golpe && c.t > 0.55) {
        c.golpe = true;
        this.g.n7?.rotura?._son?.('metal', { volume: 0.9 });
        setTimeout(() => this.g.n7?.rotura?._son?.('panel', { volume: 0.5 }), 260);
      }
      if (c.t >= c.n / c.fps) this.caida = null;
    }
    this.cambio = Math.max(0, this.cambio - dt);
    // (la noche 7: el estado de ahora, el siguiente y las explosiones, cargando antes de hacer falta)
    if (this.g.nightNumber === 7 && this.g.n7?.active) {
      const i = Math.max(0, ORDEN.indexOf(this.actual));
      cargaEstado(ORDEN[i]);
      if (ORDEN[i + 1]) cargaEstado(ORDEN[i + 1]);
      cargaEstado('explosion');
    }
    if (this.forzado) cargaEstado(this.forzado);          // (debug: un estado fijo)
    const q = this._quiere();
    if (q && q !== 'normal') cargaEstado(q);             // (al saltar de hora en el debug)
    if (q !== this.actual) {
      // (no a mitad de una vista: con una explosión y un segundo sin luz; v1.12: si el estado nuevo trae
      // su caída —los paneles y escombros que caen con física—, un fogonazo corto y se ve caer)
      if (this.actual && q) {
        const cai = IND?.[q]?.caida;
        this.caida = cai ? { estado: q, t: 0, n: cai.n, fps: cai.fps, caras: cai.caras, golpe: false } : null;
        this.cambio = cai ? 0.3 : 1.0;
        const r = this.g.n7?.rotura;
        if (r) {
          r.sacudida = Math.max(r.sacudida, 0.8);
          r.oficina.flash = Math.max(r.oficina.flash, 0.35);
          r._son?.('estallido', { volume: 1 });
          r._son?.('panel', { volume: 0.8 });
        }
      }
      // (los estados ya pasados no vuelven en esta noche: fuera de la memoria)
      const iq = ORDEN.indexOf(q);
      for (let j = 1; j < iq; j++) sueltaEstado(ORDEN[j]);
      this.actual = q;
    }
  }

  /** ¿Hay oficina v2 en esta vista? */
  activa(face) {
    // (solo con su imagen ya cargada; mientras carga, negro: nunca otra oficina)
    const src = this.actual && (IND?.[this.actual]?.caras?.[face] ?? (IND?.[this.actual]?.unica ? IND?.normal?.caras?.[face] : null));
    return !!(src && img(`assets/${src}`));
  }

  /** La variante (apagon | pasillo) del estado actual, o la de normal. */
  _variante(v) {
    return IND?.[`${this.actual}_${v}`] ?? IND?.[`normal_${v}`] ?? null;
  }

  /** ¿Hay vista de apagón para esta cara? */
  tieneApagon(face) {
    const src = this._variante('apagon')?.caras?.[face];
    return !!(src && img(`assets/${src}`));
  }

  /** El hueco de la puerta de ese lado con la luz del pasillo encendida (true si lo ha pintado). */
  drawPasillo(ctx, side) {
    const d = this._variante('pasillo')?.caras?.[side];
    const im = d && img(`assets/${d.src}`);
    if (!im) return false;
    ctx.drawImage(im, d.x, d.y, d.w, d.h);
    return true;
  }

  get pantalla() {
    return (this.actual && IND?.[this.actual]?.pantalla) || null;
  }

  /** (v1.12) La explosión de una rejilla (explosion_oficina.py): cuántos fotogramas tiene (0 si aún no hay). */
  nExplosion(lado) {
    const f = IND?.explosion?.fuegos?.find((e) => e.id === `expl_${lado}`);
    return f?.fuego?.n ?? 0;
  }

  _capaExp(ctx, id, k, a = 1) {
    const f = IND?.explosion?.fuegos?.find((e) => e.id === id);
    if (!f) return;
    for (const c of ['luz', 'fuego']) {
      const d = f[c];
      if (!d) continue;
      const im = img(capa('explosion', f, c, Math.min(d.n - 1, k)));
      if (!im) continue;
      ctx.save();
      if (c === 'luz') ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a * (c === 'luz' ? NIGHT7.OFICINA_V2.LUZ : 1);
      ctx.drawImage(im, d.x, d.y, d.w, d.h);
      ctx.restore();
    }
  }

  /** El estallido de esa rejilla, t s después de empezar. */
  drawExplosion(ctx, lado, t) {
    this._capaExp(ctx, `expl_${lado}`, Math.floor(t * 15));
  }

  /** La rejilla ardiendo (en bucle), con intensidad a. */
  drawArde(ctx, lado, t, a) {
    const f = IND?.explosion?.fuegos?.find((e) => e.id === `arde_${lado}`);
    if (!f?.fuego) return;
    this._capaExp(ctx, `arde_${lado}`, Math.floor(t * 15 + (lado === 'left' ? 0 : 11)) % f.fuego.n, a);
  }

  /** (v1.14) El humo que sale del conducto de esa rejilla después de la explosión (en bucle), con alfa a. */
  drawHumo(ctx, lado, t, a = 1) {
    const f = IND?.explosion?.fuegos?.find((e) => e.id === `humo_${lado}`);
    if (!f?.fuego) return;
    this._capaExp(ctx, `humo_${lado}`, Math.floor(t * 15 + (lado === 'left' ? 0 : 17)) % f.fuego.n, a);
  }

  /** La hoja de la compuerta de ese lado, bajada según doorH (0..d.h px): se ve su parte de abajo.
   * (solo hasta el zócalo, y = 690: el zócalo del render queda delante, quieto) */
  drawHoja(ctx, side, doorH) {
    const d = this._variante('puerta')?.caras?.[side];
    const im = d && img(`assets/${d.src}`);
    if (!im) return false;
    const L = Math.min(d.h, 690 - d.y);
    const hh = Math.min(L, (doorH / d.h) * L);
    if (hh <= 0) return true;
    const k = im.naturalHeight / d.h;
    ctx.drawImage(im, 0, (L - hh) * k, im.naturalWidth, hh * k, d.x, d.y, d.w, hh);
    return true;
  }

  /** La compuerta del pasillo central (atrás), subida shift px; sellada: con sus vigas de bloqueo. */
  drawCompuertaAtras(ctx, r, shift, sellada) {
    const v = sellada && this._variante('sellada')?.caras?.back;
    const d = v || this._variante('puerta')?.caras?.back;
    const im = d && img(`assets/${d.src}`);
    if (!im) return false;
    ctx.save();
    if (!v) {
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();
    }
    ctx.drawImage(im, d.x, d.y - shift, d.w, d.h);
    ctx.restore();
    return true;
  }

  /** Un botón (cual: 'puerta' | 'luz') de ese lado, encendido, con transparencia a. */
  drawBoton(ctx, side, cual, a = 1) {
    const d = this._variante('botones')?.caras?.[`${side}_${cual}`];
    const im = d && img(`assets/${d.src}`);
    if (!im) return false;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.drawImage(im, d.x, d.y, d.w, d.h);
    ctx.restore();
    return true;
  }

  /** (v1.14) ¿Está la capa de la rejilla rota de ese lado (en el estado actual)? */
  tieneRejilla(lado) {
    return !!IND?.[this.actual]?.rejillas?.[`${lado}_abierta`];
  }

  /** (v1.14) Las rejillas del frente de la noche 7 (Night7Rotura.rejillas), del render de la oficina
   * (rejillas_oficina.py: la misma escena y luz que la vista; solo lo que cambia, con el borde fundido):
   * 'abierta', como la dejó El Dislocado (el hueco y la rejilla en el suelo); desde el fogonazo de la
   * explosión, 'quemada' (el canto doblado y ennegrecido, el hollín, las brasas dentro y los trozos). */
  _rejillas(ctx, apagon) {
    const rej = this.g.n7?.active ? this.g.n7.rotura?.rejillas : null;
    if (!rej) return;
    for (const [lado, r] of Object.entries(rej)) {
      const v = `${lado}_${r.estado === 'abierta' || (r.estado === 'explota' && r.t < 0.08) ? 'abierta' : 'quemada'}`;
      const d = (apagon && (IND?.[this.actual]?.rejillas_apagon?.[v] || IND?.[`${this.actual}_apagon`]?.rejillas?.[v])) || IND?.[this.actual]?.rejillas?.[v];
      const im = d && img(`assets/${d.src}`);
      if (im) ctx.drawImage(im, d.x, d.y, d.w, d.h);
    }
  }

  /** (v1.15) El conducto de esa rejilla alumbrado por el jugador (la mecánica de la noche 5: el ratón
   * encima), fundido con transparencia k: la misma escena con la luz entrando en el conducto (sus paredes,
   * las juntas y el fondo a oscuras), no un brillo dibujado. true si lo ha pintado. */
  drawRejillaLuz(ctx, lado, k, hueco = null) {
    const r = this.g.n7?.active ? this.g.n7.rotura?.rejillas?.[lado] : null;
    if (!r || k <= 0.01) return false;
    const v = `${lado}_${r.estado === 'abierta' ? 'abierta' : 'quemada'}_luz`;
    const apagon = this.g.blackout?.active && this.tieneApagon('front');
    const d = (apagon && (IND?.[this.actual]?.rejillas_apagon?.[v] || IND?.[`${this.actual}_apagon`]?.rejillas?.[v])) || IND?.[this.actual]?.rejillas?.[v];
    const im = d && img(`assets/${d.src}`);
    if (!im) return false;
    ctx.save();
    ctx.globalAlpha = Math.min(1, k);
    if (hueco) {
      // (v1.60) la capa trae también la luz sobre la pared (una mancha ovalada y una columna al pasar el
      // ratón): solo se pinta dentro del hueco, con el borde fundido
      const c = (this._luzCanvas ??= document.createElement('canvas'));
      c.width = hueco.w;
      c.height = hueco.h;
      const x = c.getContext('2d');
      x.drawImage(im, d.x - hueco.x, d.y - hueco.y, d.w, d.h);
      x.globalCompositeOperation = 'destination-in';
      x.drawImage(this._mascaraHueco(hueco), 0, 0);
      ctx.drawImage(c, hueco.x, hueco.y);
    } else ctx.drawImage(im, d.x, d.y, d.w, d.h);
    ctx.restore();
    return true;
  }

  /** (v1.60) La forma del hueco con el borde difuminado (se calcula una vez: difuminar en cada fotograma cuesta). */
  _mascaraHueco(r) {
    const clave = `${r.w}x${r.h}`;
    this._mascaras ??= {};
    if (this._mascaras[clave]) return this._mascaras[clave];
    const m = document.createElement('canvas');
    m.width = r.w;
    m.height = r.h;
    const x = m.getContext('2d');
    x.filter = 'blur(12px)';
    x.fillStyle = '#000';
    x.fillRect(24, 22, r.w - 48, r.h - 44);
    return (this._mascaras[clave] = m);
  }

  /** La oficina de esa vista (true si la ha pintado); con apagon, la de la luz de emergencia. */
  drawBase(ctx, face, apagon = false) {
    if (!this.activa(face)) return false;
    if (IND?.[this.actual]?.unica) return this._drawBaseUnica(ctx, face, apagon);
    const src = (apagon && this.tieneApagon(face) && this._variante('apagon').caras[face]) || IND[this.actual].caras[face];
    // (v1.12) cayendo: el fotograma de la caída (la misma escena; el último es la imagen del estado)
    const c = this.caida;
    if (c && c.estado === this.actual && c.caras.includes(face) && !apagon) {
      const fr = img(`assets/${DIR}/${c.estado}/caida_${face}_${String(Math.min(c.n - 1, Math.floor(c.t * c.fps))).padStart(2, '0')}.jpg`);
      if (fr) {
        ctx.drawImage(fr, 0, 0, 1600, 900);
        if (face === 'front') this._rejillas(ctx, false);
        return true;
      }
    }
    const im = img(`assets/${src}`);
    if (!im) return false;
    ctx.drawImage(im, 0, 0, 1600, 900);
    if (face === 'front') this._rejillas(ctx, apagon && this.tieneApagon(face));
    return true;
  }

  /** (oficina única) La base limpia (o la del apagón) y, encima, los daños del estado de la noche 7 y su caída: capas
   * con transparencia de la misma escena y cámara. Lo que se apaga (el fluorescente que falla) lo oscurece el juego. */
  _drawBaseUnica(ctx, face, apagon) {
    const ap = (apagon || !!this.forzarApagon) && this.tieneApagon(face);
    const src = ap ? this._variante('apagon').caras[face] : IND.normal.caras[face];
    const im = img(`assets/${src}`);
    if (!im) return false;
    ctx.drawImage(im, 0, 0, 1600, 900);
    const e = IND[this.actual];
    if (this.actual !== 'normal' && e && this.capasVisibles !== false) {
      const l = (ap && e.capas_apagon?.[face]) || e.capas?.[face];
      const il = l && img(`assets/${l.src}`);
      if (il) ctx.drawImage(il, l.x, l.y, l.w, l.h);
      const c = this.caida;
      if (c && c.estado === this.actual && !ap) {
        const fr = e.caida?.capas?.[face]?.[Math.min(c.n - 1, Math.floor(c.t * c.fps))];
        const ifr = fr && img(`assets/${fr.src}`);
        if (ifr) ctx.drawImage(ifr, fr.x, fr.y, fr.w, fr.h);
      }
      const osc = (NIGHT7.OFICINA_V2.OSCURO?.[this.actual] ?? 0) * (ap ? 0.35 : 1);
      if (osc > 0) {
        ctx.fillStyle = `rgba(3,2,2,${osc})`;
        ctx.fillRect(0, 0, 1600, 900);
      }
    }
    if (face === 'front') this._rejillas(ctx, ap);
    return true;
  }

  /** (oficina única) Los textos de los carteles de esa vista (la placa, «SECTOR 3-O/3-E», «MÓDULO DE CONTROL»):
   * pintados encima de su chapa del render, con la luz que le llega a la chapa (no brillan ni flotan).
   * titulo: el de la placa de esa noche (si no, el del render). */
  drawTextos(ctx, face, { titulo = null, apagon = false } = {}) {
    const T = IND?.normal?.textos;
    if (!T || !IND?.normal?.unica || this.textosVisibles === false) return;
    const ap = (apagon || !!this.forzarApagon) && this.tieneApagon(face);
    const src = ap ? this._variante('apagon').caras[face] : IND.normal.caras[face];
    const base = img(`assets/${src}`);
    if (!base) return;
    for (const [id, c] of Object.entries(T)) {
      if (c.cara !== face) continue;
      const [cx, cy, cw, ch] = c.chapa;
      const luz = this._luzChapa(base, src, id, c.chapa);
      for (const t of c.textos) {
        const txt = id === 'placa' && titulo && /^PROTOCOLO/.test(t.texto) ? titulo : t.texto;
        const alto = t.h / 0.72;              // (la caja es la de las mayúsculas)
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx + 3, cy + 3, cw - 6, ch - 6);
        ctx.clip();
        ctx.font = `bold ${alto.toFixed(1)}px "DejaVu Sans", Verdana, Arial, sans-serif`;
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
        const ancho = ctx.measureText(txt).width;
        // (la misma anchura que el texto del render; si el de la noche es más largo, se estrecha)
        const k = Math.min(1.25, t.w / Math.max(1, ancho));
        const ox = t.x + (t.w - ancho * k) / 2;
        ctx.translate(ox, t.y + t.h);
        ctx.scale(k, 1);
        if (c.tono === 'rojo') {
          // pintura sobre la chapa clara: oscurece lo que hay debajo (con su luz y su desgaste)
          ctx.globalCompositeOperation = 'multiply';
          ctx.fillStyle = /^SOLO/.test(t.texto) ? 'rgb(70,66,60)' : 'rgb(170,34,22)';
          ctx.fillText(txt, 0, 0);
        } else {
          // pintura clara sobre chapa oscura: refleja la misma luz que la chapa
          // (la pintura es crema: el color de la luz, algo apagado, y nunca blanco puro)
          const m = (luz[0] + luz[1] + luz[2]) / 3;
          const [r, g, b] = luz.map((v, i) => Math.min(205, Math.round((v * 0.55 + m * 0.45) * 4.2 * [1.05, 1, 0.86][i] + 10)));
          ctx.fillStyle = `rgba(${r},${g},${b},0.82)`;
          ctx.fillText(txt, 0, 0);
        }
        ctx.restore();
      }
    }
  }

  /** El color medio de una chapa en la imagen de la vista (se calcula una vez). */
  _luzChapa(base, src, id, [x, y, w, h]) {
    const k = `${src}|${id}`;
    this._luces ??= {};
    if (this._luces[k]) return this._luces[k];
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.drawImage(base, x + w * 0.1, y + h * 0.15, w * 0.8, h * 0.7, 0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    return (this._luces[k] = [d[0], d[1], d[2]]);
  }

  /** (oficina única) La luz roja de la baliza (lo que suma su luz, del render), barriendo al girar; fuerza 0..1. */
  drawAlarma(ctx, face, fuerza, t) {
    const d = IND?.normal_alarma?.caras?.[face];
    const im = d && fuerza > 0 && img(`assets/${d.src}`);
    if (!im) return false;
    const c = (this._alCanvas ??= document.createElement('canvas'));
    if (c.width !== d.w || c.height !== d.h) {
      c.width = d.w;
      c.height = d.h;
    }
    const x = c.getContext('2d');
    x.globalCompositeOperation = 'source-over';
    x.clearRect(0, 0, d.w, d.h);
    x.drawImage(im, 0, 0);
    // (gira como un faro: la mancha de luz recorre la pared y, de espaldas, casi se apaga)
    const a = t * 4;
    const hacia = 0.25 + 0.75 * Math.max(0, Math.sin(a) * 0.5 + 0.5);
    const lx = 800 + Math.cos(a) * 640 - d.x;
    const g = x.createLinearGradient(lx - 760, 0, lx + 760, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.12)');
    g.addColorStop(0.5, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0.12)');
    x.globalCompositeOperation = 'destination-in';
    x.fillStyle = g;
    x.fillRect(0, 0, d.w, d.h);
    // (con 'lighter' la luz se suma; ALARMA_GANANCIA > 1: se pinta otra vez la parte que sobra)
    let k = fuerza * hacia * ALARMA_GANANCIA;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    while (k > 0.01) {
      ctx.globalAlpha = Math.min(1, k);
      ctx.drawImage(c, d.x, d.y);
      k -= 1;
    }
    ctx.restore();
    return true;
  }

  /** ¿Es la oficina única (con textos y alarma propios)? */
  get unica() {
    return !!IND?.normal?.unica;
  }

  /** El fuego de esa vista: su luz (sumada) y la llama (encima), en bucle; y el segundo sin luz al cambiar. */
  drawFuego(ctx, face) {
    if (!this.activa(face)) return;
    const d = IND[this.actual];
    const fr = Math.floor(this.t * 15);
    for (const f of d.fuegos ?? []) {
      if (f.cara !== face) continue;
      if (f.luz) {
        const im = img(capa(this.actual, f, 'luz', fr % f.luz.n));
        if (im) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = NIGHT7.OFICINA_V2.LUZ;
          ctx.drawImage(im, f.luz.x, f.luz.y, f.luz.w, f.luz.h);
          ctx.restore();
        }
      }
      if (f.fuego) {
        const im = img(capa(this.actual, f, 'fuego', fr % f.fuego.n));
        if (im) ctx.drawImage(im, f.fuego.x, f.fuego.y, f.fuego.w, f.fuego.h);
      }
    }
  }

  /** (v1.12) Las chispas de las puntas de los cables cortados del render (consola_v2.json → indice
   * «cables»): de vez en cuando un chispazo y su luz alrededor. (v1.14) El chispazo es la animación de
   * Blender (escombros.py: chispas que caen, rebotan y se apagan), no trazos dibujados. */
  drawChispas(ctx, face, dt) {
    if (!this.activa(face)) return;
    const pts = IND[this.actual]?.cables?.[face] ?? [];
    const ch = (this._chispas ??= []);
    for (const [x, y, z] of pts) {
      if (z <= 0 || Math.random() > 0.018) continue;
      ch.push({ x, y, t: 0, face, e: 0.55 + Math.random() * 0.3 });
      this.g.n7?.rotura?._son?.('chispas', { volume: 0.25 });
    }
    for (const c of ch) {
      c.t += dt;
      if (c.face !== face) continue;
      // (su luz: un destello azulado que se apaga enseguida)
      const k = Math.max(0, 1 - c.t / 0.12);
      if (k > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 90);
        g.addColorStop(0, `rgba(200,225,255,${0.55 * k})`);
        g.addColorStop(1, 'rgba(160,200,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(c.x - 90, c.y - 90, 180, 180);
        ctx.restore();
      }
      drawEscombro(ctx, 'chispas', Math.floor(c.t * 15), c.x, c.y, c.e, { luz: true });
    }
    this._chispas = ch.filter((c) => c.t * 15 < (nEscombro('chispas') || 1));
  }

  /** El segundo sin luz al cambiar de estado (encima de todo lo de la oficina). */
  drawCambio(ctx) {
    if (this.cambio <= 0) return;
    const k = this.cambio > 0.75 ? 1 - (this.cambio - 0.75) / 0.25 * 0.3 : this.cambio / 0.75;
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, k)})`;
    ctx.fillRect(0, 0, 1600, 900);
  }
}
