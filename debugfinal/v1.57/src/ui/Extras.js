// =============================================================
// Extras.js — (v1.56) El menú Extras: «ARCHIVO VIGIA-7 // ACCESO CONCEDIDO».
//
// Se abre desde el menú principal (botón EXTRAS, desbloqueado al completar la Noche 5) y va
// ENCIMA del menú: la música del menú sigue de fondo. Cinco apartados: Personajes · Beta ·
// Cintas · Jumpscares · Retos. Cada apartado es una «pantalla» con draw/key/click/move;
// los que aún no están hechos salen como «EN PREPARACIÓN».
//
// Ratón y teclado: ↑↓ (o el ratón) eligen, Enter (o clic) abre, Esc vuelve atrás.
// Lo que se ha desbloqueado: src/core/ExtrasProgreso.js. Lo que hay: src/ui/extras/catalogo.js.
// =============================================================

import { CONFIG } from '../config.js';
import { ExtrasProgreso } from '../core/ExtrasProgreso.js';
import { PERSONAJES, CINTAS, SUSTOS, RETOS } from './extras/catalogo.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const VERDE = '#7dffb0';
const VERDE_OSC = 'rgba(125,255,176,0.45)';
const TINTA = '#d8ffe8';
const GRIS = 'rgba(150,160,170,0.55)';
const FUENTE = '"Courier New", monospace';

// Marco de la terminal y filas de la lista
const MARCO = { x: 60, y: 50, w: W - 120, h: H - 100 };
const LISTA = { x: 110, y: 220, w: 640, fila: 92 };
const VISTA = { x: 820, y: 200, w: 660, h: 500 };

const APARTADOS = [
  { id: 'personajes', nombre: 'PERSONAJES' },
  { id: 'beta', nombre: 'BETA' },
  { id: 'cintas', nombre: 'CINTAS' },
  { id: 'sustos', nombre: 'JUMPSCARES' },
  { id: 'retos', nombre: 'RETOS' },
];

// ¿Existe el audio de las cintas que se añaden más tarde (siExiste)?
const EXISTE = {};
for (const c of CINTAS.filter((x) => x.siExiste)) {
  EXISTE[c.id] = false;
  for (const f of [`${c.base}.ogg`, `${c.base}_mia.ogg`, `${c.base}_mia.mp3`, `${c.base}_mia.wav`, `${c.base}_mia.m4a`]) {
    fetch(f, { method: 'HEAD' }).then((r) => { if (r.ok) { EXISTE[c.id] = true; c.audio = f; } }).catch(() => {});
  }
}
/** Las cintas que hay (sin las que aún no se han grabado). */
export const cintasQueHay = () => CINTAS.filter((c) => !c.siExiste || EXISTE[c.id]);

const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const siNoLista = (p, f) => (p?.cuenta ? p.cuenta() : f);

export class Extras {
  constructor(game) {
    this.g = game;
    this.abierto = false;
    this.sel = 0;
    this.pantalla = null;      // null = la principal; o el id de un apartado
    this.t = 0;
    this.tPant = 0;
    this.hover = -1;
    this.pantallas = {};       // (los apartados hechos se registran aquí: registra(id, objeto))
  }

  /** Un apartado ya hecho: { draw(ctx, t), key(code) → 'atras'?, click(x, y), move(x, y), abre(), cierra() }. */
  registra(id, p) {
    this.pantallas[id] = p;
  }

  abre() {
    this.abierto = true;
    this.pantalla = null;
    this.t = 0;
    this.tPant = 0;
    this.g.audio?.beep?.(1320, 0.05, 0.05);
  }

  cierra() {
    this._salDe();
    this.abierto = false;
    this.pantalla = null;
  }

  _entra(i) {
    const a = APARTADOS[i];
    this.sel = i;
    this.pantalla = a.id;
    this.tPant = 0;
    this.g.audio?.beep?.(990, 0.05, 0.06);
    this.pantallas[a.id]?.abre?.();
  }

  _salDe() {
    if (this.pantalla) this.pantallas[this.pantalla]?.cierra?.();
  }

  _atras() {
    if (this.pantalla) {
      this._salDe();
      this.pantalla = null;
      this.tPant = 0;
      this.g.audio?.beep?.(660, 0.04, 0.05);
    } else this.cierra();
  }

  update(dt) {
    this.t += dt;
    this.tPant += dt;
    if (this.pantalla) this.pantallas[this.pantalla]?.update?.(dt);
  }

  key(code) {
    if (this.pantalla) {
      const p = this.pantallas[this.pantalla];
      if (code === 'Escape' && !p?.quiereEsc?.()) return this._atras();
      if (p?.key?.(code) === 'atras') this._atras();
      return;
    }
    if (code === 'Escape') return this._atras();
    if (code === 'ArrowUp' || code === 'KeyW') this.sel = (this.sel + APARTADOS.length - 1) % APARTADOS.length;
    else if (code === 'ArrowDown' || code === 'KeyS') this.sel = (this.sel + 1) % APARTADOS.length;
    else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') this._entra(this.sel);
    else return;
    if (code.startsWith('Arrow') || code === 'KeyW' || code === 'KeyS') this.g.audio?.keyClick?.();
  }

  _fila(i) {
    return { x: LISTA.x, y: LISTA.y + i * LISTA.fila, w: LISTA.w, h: LISTA.fila - 14 };
  }

  click(x, y) {
    if (this.pantalla) {
      const p = this.pantallas[this.pantalla];
      if (!p?.quiereEsc?.() && inside(VOLVER, x, y)) return this._atras();
      if (p?.click?.(x, y) === 'atras') this._atras();
      return;
    }
    if (inside(VOLVER, x, y)) return this._atras();
    for (let i = 0; i < APARTADOS.length; i++) if (inside(this._fila(i), x, y)) return this._entra(i);
  }

  move(x, y) {
    this.hoverVolver = inside(VOLVER, x, y);
    if (this.pantalla) return this.pantallas[this.pantalla]?.move?.(x, y);
    this.hover = -1;
    for (let i = 0; i < APARTADOS.length; i++) {
      if (inside(this._fila(i), x, y)) {
        if (this.sel !== i) this.g.audio?.keyClick?.();
        this.hover = i;
        this.sel = i;
      }
    }
  }

  /** ¿Hay algo bajo el ratón? (para el cursor de mano) */
  sobre(x, y) {
    if (this.pantalla) {
      const p = this.pantallas[this.pantalla];
      return (!p?.quiereEsc?.() && inside(VOLVER, x, y)) || !!p?.sobre?.(x, y);
    }
    if (inside(VOLVER, x, y)) return true;
    return APARTADOS.some((_, i) => inside(this._fila(i), x, y));
  }

  // --- Los contadores de cada apartado ---------------------------------------
  _cuenta(id) {
    const P = ExtrasProgreso;
    if (id === 'personajes') {
      const n = PERSONAJES.filter((p) => !p.bloqueo || P.aberracion()).length;
      return siNoLista(this.pantallas.personajes, `${n}/${PERSONAJES.length} fichas`);
    }
    if (id === 'cintas') {
      const hay = cintasQueHay();
      return `${hay.filter((c) => P.cintaOida(c.id)).length}/${hay.length} oídas`;
    }
    if (id === 'sustos') return siNoLista(this.pantallas.sustos, `0/${SUSTOS.length} vistos`);
    if (id === 'beta') return this.pantallas.beta?.cuenta?.() ?? 'EN PREPARACIÓN';
    if (id === 'retos') return siNoLista(this.pantallas.retos, 'EN DESARROLLO');
    return '';
  }

  // --- Dibujo -----------------------------------------------------------------
  draw(ctx, effects) {
    ctx.save();
    // El menú detrás, casi a oscuras
    ctx.fillStyle = '#020504';
    ctx.fillRect(0, 0, W, H);
    // Líneas de barrido de la pantalla
    ctx.fillStyle = 'rgba(125,255,176,0.025)';
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
    const banda = ((this.t * 90) % (H + 200)) - 100;
    const gb = ctx.createLinearGradient(0, banda - 80, 0, banda + 80);
    gb.addColorStop(0, 'rgba(125,255,176,0)');
    gb.addColorStop(0.5, 'rgba(125,255,176,0.035)');
    gb.addColorStop(1, 'rgba(125,255,176,0)');
    ctx.fillStyle = gb;
    ctx.fillRect(0, banda - 80, W, 160);
    // Marco
    ctx.strokeStyle = 'rgba(125,255,176,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(MARCO.x, MARCO.y, MARCO.w, MARCO.h);
    ctx.textBaseline = 'middle';
    // Cabecera (se escribe sola al abrir)
    const titulo = this.pantalla ? `ARCHIVO VIGIA-7 // ${APARTADOS.find((a) => a.id === this.pantalla).nombre}` : 'ARCHIVO VIGIA-7 // ACCESO CONCEDIDO';
    const n = Math.min(titulo.length, Math.floor((this.pantalla ? this.tPant : this.t) * 70));
    ctx.font = `bold 34px ${FUENTE}`;
    ctx.fillStyle = TINTA;
    ctx.textAlign = 'left';
    ctx.fillText(titulo.slice(0, n) + (n < titulo.length || Math.floor(this.t * 2) % 2 ? '' : '_'), MARCO.x + 40, MARCO.y + 50);
    ctx.font = `16px ${FUENTE}`;
    ctx.fillStyle = VERDE_OSC;
    ctx.textAlign = 'right';
    ctx.fillText(`TERMINAL 07 · NIVEL 3 · ${CONFIG.VERSION}`, MARCO.x + MARCO.w - 40, MARCO.y + 50);
    ctx.fillStyle = 'rgba(125,255,176,0.35)';
    ctx.fillRect(MARCO.x + 40, MARCO.y + 84, MARCO.w - 80, 2);

    if (this.pantalla) {
      const p = this.pantallas[this.pantalla];
      if (p) p.draw(ctx, this.tPant);
      else this._drawPreparacion(ctx);
    } else this._drawPrincipal(ctx);

    // Pie: volver y las teclas
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = this.hoverVolver ? VERDE : 'rgba(125,255,176,0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(VOLVER.x, VOLVER.y, VOLVER.w, VOLVER.h);
    ctx.fillStyle = 'rgba(159,216,180,0.9)';
    ctx.font = `16px ${FUENTE}`;
    ctx.textAlign = 'center';
    ctx.fillText('< VOLVER  (Esc)', VOLVER.x + VOLVER.w / 2, VOLVER.y + VOLVER.h / 2 + 1);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(232,238,245,0.4)';
    const ayuda = this.pantalla ? (this.pantallas[this.pantalla]?.ayuda ?? 'ESC volver') : '↑↓ elegir · ENTER abrir · ESC volver';
    ctx.fillText(ayuda, MARCO.x + MARCO.w - 40, VOLVER.y + VOLVER.h / 2 + 1);
    ctx.restore();
    if (this.pantalla) {
      const p = this.pantallas[this.pantalla];
      if (p?.drawEncima && p.play) {
        p.drawEncima(ctx, effects);   // (un susto a pantalla completa: sin el marco ni la estática de encima)
        return;
      }
    }
    if (Math.random() < 0.012) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, W, H);
    }
    effects?.static(ctx, 0.05);
    effects?.vignette(ctx, 0.75);
  }

  _drawPrincipal(ctx) {
    ctx.textAlign = 'left';
    APARTADOS.forEach((a, i) => {
      const r = this._fila(i);
      const sel = this.sel === i;
      // (cada fila aparece un instante después de la anterior)
      const k = Math.max(0, Math.min(1, (this.t - 0.25 - i * 0.07) * 6));
      if (k <= 0) return;
      ctx.globalAlpha = k;
      ctx.fillStyle = sel ? 'rgba(125,255,176,0.12)' : 'rgba(10,16,14,0.5)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = sel ? VERDE : 'rgba(125,255,176,0.25)';
      ctx.lineWidth = sel ? 2 : 1;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.font = `bold 30px ${FUENTE}`;
      ctx.fillStyle = sel ? TINTA : '#9fd8b4';
      ctx.fillText(`${sel ? '> ' : '  '}${a.nombre}`, r.x + 18, r.y + r.h / 2 + 1);
      ctx.font = `18px ${FUENTE}`;
      ctx.fillStyle = VERDE_OSC;
      ctx.textAlign = 'right';
      ctx.fillText(this._cuenta(a.id), r.x + r.w - 20, r.y + r.h / 2 + 1);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    });
    this._drawVista(ctx, APARTADOS[this.sel].id);
  }

  /** La vista previa del apartado elegido, a la derecha. */
  _drawVista(ctx, id) {
    const v = VISTA;
    ctx.save();
    ctx.fillStyle = 'rgba(4,9,7,0.85)';
    ctx.fillRect(v.x, v.y, v.w, v.h);
    ctx.strokeStyle = 'rgba(125,255,176,0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(v.x, v.y, v.w, v.h);
    // esquinas de visor
    ctx.strokeStyle = VERDE;
    ctx.lineWidth = 3;
    for (const [cx, cy, sx, sy] of [[v.x, v.y, 1, 1], [v.x + v.w, v.y, -1, 1], [v.x, v.y + v.h, 1, -1], [v.x + v.w, v.y + v.h, -1, -1]]) {
      ctx.beginPath();
      ctx.moveTo(cx + sx * 26, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + sy * 26);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.rect(v.x + 2, v.y + 2, v.w - 4, v.h - 4);
    ctx.clip();
    const cx = v.x + v.w / 2;
    const cy = v.y + v.h / 2 - 20;
    const t = this.t;
    const p = this.pantallas[id];
    if (p?.vista) p.vista(ctx, v, t);
    else if (id === 'personajes') this._vistaSilueta(ctx, cx, cy - 10, t);
    else if (id === 'cintas') this._vistaCinta(ctx, cx, cy, t);
    else if (id === 'sustos') this._vistaAviso(ctx, cx, cy, t);
    else if (id === 'beta') this._vistaBeta(ctx, cx, cy, t);
    else this._vistaRetos(ctx, cx, cy, t);
    ctx.restore();
    // pie de la vista
    ctx.font = `16px ${FUENTE}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = VERDE_OSC;
    const PIE = {
      personajes: 'FICHAS DE LO QUE HAY A BORDO',
      beta: 'DISEÑOS ANTERIORES · ARCHIVO DESCLASIFICADO',
      cintas: 'GRABACIONES RECUPERADAS',
      sustos: 'REGISTROS DE INCIDENTES',
      retos: 'NOCHES CON UN EXTRA DE DIFICULTAD',
    };
    ctx.fillText(`> ${PIE[id]}`, v.x, v.y + v.h + 28);
  }

  _vistaSilueta(ctx, cx, cy, t) {
    // una silueta que «respira», con un contorno verde que barre de arriba abajo
    const img = this.g.sprites?.images?.get('crt_specimen_front');
    const h = 420;
    if (img) {
      const w = h * img.width / img.height;
      const c = this._lienzo ??= document.createElement('canvas');
      c.width = Math.ceil(w);
      c.height = h;
      const x2 = c.getContext('2d');
      x2.clearRect(0, 0, c.width, c.height);
      x2.drawImage(img, 0, 0, w, h);
      x2.globalCompositeOperation = 'source-in';
      x2.fillStyle = '#0c2117';
      x2.fillRect(0, 0, c.width, c.height);
      const y = (t * 0.35 % 1) * h;
      const g = x2.createLinearGradient(0, y - 30, 0, y + 30);
      g.addColorStop(0, 'rgba(125,255,176,0)');
      g.addColorStop(0.5, 'rgba(125,255,176,0.55)');
      g.addColorStop(1, 'rgba(125,255,176,0)');
      x2.globalCompositeOperation = 'source-atop';
      x2.fillStyle = g;
      x2.fillRect(0, y - 30, c.width, 60);
      x2.globalCompositeOperation = 'source-over';
      // el contorno: la misma silueta en verde, un poco desplazada a cada lado, debajo
      const c2 = this._borde ??= document.createElement('canvas');
      c2.width = c.width;
      c2.height = h;
      const x3 = c2.getContext('2d');
      x3.clearRect(0, 0, c2.width, h);
      x3.drawImage(img, 0, 0, w, h);
      x3.globalCompositeOperation = 'source-in';
      x3.fillStyle = 'rgba(125,255,176,0.85)';
      x3.fillRect(0, 0, c2.width, h);
      x3.globalCompositeOperation = 'source-over';
      const ox = cx - w / 2, oy = cy - h / 2 + Math.sin(t * 1.2) * 3;
      ctx.shadowColor = 'rgba(125,255,176,0.8)';
      ctx.shadowBlur = 18;
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) ctx.drawImage(c2, ox + dx, oy + dy);
      ctx.shadowBlur = 0;
      ctx.drawImage(c, ox, oy);
    }
    ctx.font = `bold 40px ${FUENTE}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(216,255,232,0.85)';
    ctx.fillText('???', cx, cy + 236);
  }

  _vistaCinta(ctx, cx, cy, t) {
    // un casete con las bobinas girando
    ctx.strokeStyle = VERDE;
    ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(125,255,176,0.06)';
    ctx.beginPath();
    ctx.roundRect(cx - 210, cy - 120, 420, 250, 16);
    ctx.fill();
    ctx.stroke();
    ctx.strokeRect(cx - 150, cy - 70, 300, 110);
    for (const sx of [-75, 75]) {
      ctx.save();
      ctx.translate(cx + sx, cy - 15);
      ctx.rotate(t * 2.2);
      ctx.beginPath();
      ctx.arc(0, 0, 36, 0, Math.PI * 2);
      ctx.stroke();
      for (let k = 0; k < 6; k++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(28, 0);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.font = `bold 22px ${FUENTE}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = TINTA;
    ctx.fillText('VIGIA-7 · REGISTRO DE VOZ', cx, cy + 85);
  }

  _vistaAviso(ctx, cx, cy, t) {
    const k = 0.55 + 0.45 * Math.abs(Math.sin(t * 2.4));
    ctx.strokeStyle = `rgba(255,90,70,${k})`;
    ctx.fillStyle = `rgba(255,90,70,${0.08 * k})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 150);
    ctx.lineTo(cx + 170, cy + 130);
    ctx.lineTo(cx - 170, cy + 130);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.font = `bold 150px ${FUENTE}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(255,120,100,${k})`;
    ctx.fillText('!', cx, cy + 45);
    ctx.font = `bold 20px ${FUENTE}`;
    ctx.fillStyle = 'rgba(255,170,150,0.9)';
    ctx.fillText('CONTIENE SUSTOS CON SONIDO FUERTE', cx, cy + 190);
  }

  _vistaBeta(ctx, cx, cy, t) {
    // fichas de archivo apiladas
    for (let k = 3; k >= 0; k--) {
      const a = -0.08 + k * 0.05 + Math.sin(t * 0.7 + k) * 0.01;
      ctx.save();
      ctx.translate(cx - 30 + k * 22, cy + k * 10);
      ctx.rotate(a);
      ctx.fillStyle = 'rgba(8,16,12,0.95)';
      ctx.fillRect(-170, -120, 340, 240);
      ctx.strokeStyle = k === 0 ? VERDE : 'rgba(125,255,176,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(-170, -120, 340, 240);
      ctx.strokeRect(-150, -100, 300, 160);
      if (k === 0) {
        ctx.font = `bold 18px ${FUENTE}`;
        ctx.textAlign = 'left';
        ctx.fillStyle = TINTA;
        ctx.fillText('v0.52 · DESCATALOGADO', -150, 90);
      }
      ctx.restore();
    }
  }

  _vistaRetos(ctx, cx, cy, t) {
    ctx.font = `bold 30px ${FUENTE}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(216,255,232,0.8)';
    ctx.fillText(this.pantallas.retos?.cuenta?.() ?? '', cx, cy - 20);
    ctx.font = `18px ${FUENTE}`;
    ctx.fillStyle = VERDE_OSC;
    ctx.fillText('Y LA NOCHE PERSONALIZADA', cx, cy + 25);
  }

  /** Un apartado que todavía no está hecho. */
  _drawPreparacion(ctx) {
    ctx.textAlign = 'center';
    ctx.font = `bold 34px ${FUENTE}`;
    ctx.fillStyle = 'rgba(216,255,232,0.8)';
    ctx.fillText('EN PREPARACIÓN', W / 2, H / 2 - 20);
    ctx.font = `18px ${FUENTE}`;
    ctx.fillStyle = VERDE_OSC;
    ctx.fillText('Este archivo todavía se está recuperando.', W / 2, H / 2 + 30);
  }
}

const VOLVER = { x: MARCO.x + 40, y: MARCO.y + MARCO.h - 62, w: 220, h: 36 };

/** Retos: «PRÓXIMAMENTE · MÓDULO EN DESARROLLO». Cuando haya retos (catalogo.RETOS), aquí sale su lista. */
export class PantallaRetos {
  constructor(game) {
    this.g = game;
    this.ayuda = 'ESC volver';
  }

  draw(ctx, t) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const x = 140;
    let y = 220;
    const lineas = [
      ['> cargar modulo retos.sys', 0.2],
      ['  comprobando integridad........ ERROR 0x7F', 0.7],
      ['  sectores dañados: 3 de 3', 1.2],
      ['  reconstruyendo desde la copia de seguridad...', 1.7],
    ];
    ctx.font = `20px ${FUENTE}`;
    for (const [txt, t0] of lineas) {
      if (t < t0) break;
      const n = Math.min(txt.length, Math.floor((t - t0) * 60));
      ctx.fillStyle = txt.includes('ERROR') && n === txt.length ? 'rgba(255,170,120,0.9)' : 'rgba(159,216,180,0.9)';
      ctx.fillText(txt.slice(0, n), x, y);
      y += 40;
    }
    if (t > 2.4) {
      ctx.textAlign = 'center';
      ctx.font = `bold 70px ${FUENTE}`;
      ctx.fillStyle = `rgba(216,255,232,${Math.min(1, (t - 2.4) * 2)})`;
      ctx.fillText('PRÓXIMAMENTE', W / 2, 560);
      ctx.font = `bold 26px ${FUENTE}`;
      ctx.fillStyle = VERDE;
      ctx.fillText('MÓDULO EN DESARROLLO', W / 2, 630);
      const w = 600;
      ctx.strokeStyle = VERDE_OSC;
      ctx.lineWidth = 2;
      ctx.strokeRect(W / 2 - w / 2, 670, w, 26);
      const k = Math.min(0.97, ((t - 2.4) * 0.09) % 1);
      ctx.fillStyle = 'rgba(125,255,176,0.45)';
      ctx.fillRect(W / 2 - w / 2 + 4, 674, (w - 8) * k, 18);
      ctx.font = `16px ${FUENTE}`;
      ctx.fillStyle = GRIS;
      ctx.fillText(`${Math.floor(k * 100)} %`, W / 2, 720);
    }
  }

  key() {}
}
