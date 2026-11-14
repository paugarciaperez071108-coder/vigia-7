// =============================================================
// Menu.js — Menú principal (NEW GAME / CONTINUE) y confirmación.
//
// Ambientación: ojo de buey con estrellas que derivan, paneles de la
// nave, luz de emergencia, parpadeo y estática. El sonido ambiente lo
// pone Game (hace falta un clic o tecla antes, por el navegador).
//
// draw() pinta; hitTest() dice qué hay bajo el ratón; Game decide
// qué hacer con cada opción.
// =============================================================

import { CONFIG } from '../config.js';
import { Idioma, dice } from '../core/Idioma.js';
import { Random } from '../core/Random.js';
import { NIGHT4 } from '../night/night4.js';
import { FINALES, Finales } from '../core/Finales.js';
import { ExtrasProgreso } from '../core/ExtrasProgreso.js';
import { TEXTOS } from './extras/comun.js';
import { estrella } from './extras/Retos.js';

const ITEMS = {
  newGame: { x: 120, y: 500, w: 560, h: 60 },
  continue: { x: 120, y: 580, w: 560, h: 60 },
  extras: { x: 120, y: 660, w: 560, h: 60 },   // (v1.56) debajo de Continue; se desbloquea al completar la Noche 5
};
// v0.77: el botón de la música (también con la tecla M)
const MUSICA = { x: 1290, y: 798, w: 270, h: 34 };
// v0.87: los créditos (también con la tecla C)
const CREDITOS_BTN = { x: 1290, y: 752, w: 270, h: 34 };
const CREDITOS_BOX = { x: 220, y: 170, w: 1160, h: 560 };
// v1.10: los finales vistos (también con la tecla F)
const FINALES_BTN = { x: 1290, y: 706, w: 270, h: 34 };
// v1.92: las opciones (también con la tecla O): idioma, música del menú y subtítulos de las cintas
const OPCIONES_BTN = { x: 1290, y: 660, w: 270, h: 34 };
const OPC_FILAS = ['idioma', 'musica', 'volumen', 'subtitulos'];      // (v1.99: el volumen de la música)
const opcFila = (i) => ({ x: 320, y: 300 + i * 80, w: 960, h: 64 });
// (v1.94) Los textos, en idiomas/*.json (creditos.*). «Flamewall» — Camellia y «Clair de lune» — Claude Debussy van
// siempre tal cual, en todos los idiomas.
// (v1.97, el usuario: «añade lo que queda a los créditos») las voces (sintéticas, de Microsoft) y la foto del amigo
export const CREDITOS = () => [
  ['VIGÍA-7', ''],
  [dice('creditos.musica'), ''],
  [dice('creditos.menu'), `«Clair de lune» — Claude Debussy ${dice('creditos.debussy_nota_menu')}`],
  [dice('creditos.noche7'), `«Flamewall» — Camellia. ${dice('creditos.camellia_nota_menu')}`],
  [dice('creditos.duelo'), `«Lunar Abyss» — lchavasse. ${dice('creditos.lchavasse_nota_menu')}`],     // (v2.03)
  [dice('creditos.voces'), ''],
  ['', dice('creditos.voces_nota_menu')],
  [dice('creditos.gracias_a'), ''],
  ['', dice('creditos.foto_nota_menu')],
  ['', dice('creditos.originales')],
];
const CONFIRM = {
  box: { x: 450, y: 330, w: 700, h: 260 },
  yes: { x: 560, y: 500, w: 200, h: 56 },
  no: { x: 840, y: 500, w: 200, h: 56 },
};

const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export class Menu {
  constructor() {
    const rng = new Random(99);
    this.stars = Array.from({ length: 160 }, () => ({ x: rng.next(), y: rng.next(), r: rng.range(0.5, 2), tw: rng.range(0, 6) }));
    this.time = 0;
    this.selected = 'newGame';
    this.confirming = false;
    this.confirmChoice = 'no';
  }

  update(dt) {
    this.time += dt;
    if (this.tiembla > 0) this.tiembla -= dt;
    if (this.avisoExtras > 0) this.avisoExtras -= dt;
  }

  /** @param save partida guardada o null */
  hitTest(x, y, save) {
    if (this.confirming) {
      if (inside(CONFIRM.yes, x, y)) return 'yes';
      if (inside(CONFIRM.no, x, y)) return 'no';
      return null;
    }
    if (this.opciones) return 'opciones';          // (v1.92: abiertas: el clic es suyo)
    if (this.creditos) return 'creditos';          // (abiertos: cualquier clic los cierra)
    if (this.finales) return 'finales';
    if (inside(FINALES_BTN, x, y)) return 'finales';
    if (inside(OPCIONES_BTN, x, y)) return 'opciones';
    if (inside(MUSICA, x, y)) return 'musica';
    if (inside(CREDITOS_BTN, x, y)) return 'creditos';
    if (inside(ITEMS.newGame, x, y)) return 'newGame';
    if (save && inside(ITEMS.continue, x, y)) return 'continue';
    if (inside(ITEMS.extras, x, y)) return 'extras';
    return null;
  }

  /** v1.10: los finales vistos («2/4» y la lista; los que no, «???»), encima del menú. */
  _drawFinales(ctx) {
    const b = CREDITOS_BOX;
    const vistos = Finales.vistos();
    ctx.save();
    ctx.fillStyle = 'rgba(2,5,8,0.94)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(125,255,176,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8eef5';
    ctx.font = 'bold 40px "Courier New", monospace';
    ctx.fillText(dice('menu.finales_titulo'), b.x + b.w / 2, b.y + 70);
    ctx.fillStyle = '#7dffb0';
    ctx.font = 'bold 26px "Courier New", monospace';
    ctx.fillText(`${vistos.length}/${FINALES.length}`, b.x + b.w / 2, b.y + 122);
    ctx.textAlign = 'left';
    let y = b.y + 200;
    for (const f of FINALES) {
      const visto = vistos.includes(f.n);
      ctx.font = 'bold 22px "Courier New", monospace';
      ctx.fillStyle = visto ? 'rgba(159,216,180,0.9)' : 'rgba(130,140,150,0.6)';
      ctx.fillText(dice('menu.final_n', { n: f.n, total: FINALES.length }), b.x + 200, y);
      ctx.fillStyle = visto ? '#e8eef5' : 'rgba(130,140,150,0.6)';
      ctx.font = '22px "Courier New", monospace';
      ctx.fillText(visto ? `– ${f.titulo}` : '– ???', b.x + 420, y);
      y += 56;
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(232,238,245,0.45)';
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText(dice('menu.volver'), b.x + b.w / 2, b.y + b.h - 34);
    ctx.restore();
  }

  // --- (v1.92) OPCIONES: idioma, música del menú y subtítulos de las cintas ---------------------------
  // `ajustes` lo pone Game: { cambiaMusica(), subtitulos() → bool, cambiaSubtitulos() }. El idioma cambia al momento.
  abreOpciones() {
    this.opciones = true;
    this.opSel = 0;
  }

  _cambiaOpcion(i, dir = 0) {
    const que = OPC_FILAS[i];
    if (que === 'idioma') Idioma.siguiente();
    else if (que === 'musica') this.ajustes?.cambiaMusica();
    else if (que === 'volumen') this.ajustes?.cambiaVolumen(dir);
    else if (que === 'subtitulos') this.ajustes?.cambiaSubtitulos();
  }

  opcionesKey(code) {
    const n = OPC_FILAS.length;
    if (code === 'Escape' || code === 'KeyO') this.opciones = false;
    else if (code === 'ArrowUp') this.opSel = (this.opSel + n - 1) % n;
    else if (code === 'ArrowDown' || code === 'Tab') this.opSel = (this.opSel + 1) % n;
    else if (['ArrowLeft', 'ArrowRight', 'Enter', 'NumpadEnter', 'Space'].includes(code)) {
      this._cambiaOpcion(this.opSel, code === 'ArrowLeft' ? -1 : code === 'ArrowRight' ? 1 : 0);
    }
  }

  /** Un clic con las opciones abiertas (en una fila: la cambia; fuera del cuadro: se cierran) o en su botón (se abren). */
  opcionesClick(x, y) {
    if (!this.opciones) { this.abreOpciones(); return; }
    const i = OPC_FILAS.findIndex((_, k) => inside(opcFila(k), x, y));
    if (i >= 0) { this.opSel = i; this._cambiaOpcion(i, OPC_FILAS[i] === 'volumen' ? (x < opcFila(i).x + opcFila(i).w / 2 ? -1 : 1) : 0); }
    else if (!inside(CREDITOS_BOX, x, y)) this.opciones = false;
  }

  opcionesHover(x, y) {
    if (!this.opciones) return false;
    const i = OPC_FILAS.findIndex((_, k) => inside(opcFila(k), x, y));
    if (i >= 0) this.opSel = i;
    return i >= 0;
  }

  _drawOpciones(ctx, musicaMuda) {
    const b = CREDITOS_BOX;
    ctx.save();
    ctx.fillStyle = 'rgba(2,5,8,0.94)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(125,255,176,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8eef5';
    ctx.font = 'bold 40px "Courier New", monospace';
    ctx.fillText(dice('opciones.titulo'), b.x + b.w / 2, b.y + 70);
    const siNo = (v) => dice(v ? 'opciones.si' : 'opciones.no');
    const valor = { idioma: Idioma.nombre(), musica: siNo(!musicaMuda), volumen: this.ajustes?.volumen() ?? '100 %', subtitulos: siNo(this.ajustes?.subtitulos() ?? true) };
    OPC_FILAS.forEach((que, i) => {
      const r = opcFila(i);
      const sel = i === this.opSel;
      ctx.fillStyle = sel ? 'rgba(125,255,176,0.14)' : 'rgba(10,16,14,0.6)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = sel ? '#7dffb0' : 'rgba(125,255,176,0.35)';
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.font = 'bold 26px "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = sel ? '#d8ffe8' : '#9fd8b4';
      ctx.fillText(`${sel ? '> ' : '  '}${dice(`opciones.${que}`)}`, r.x + 20, r.y + r.h / 2 + 1);
      ctx.textAlign = 'right';
      ctx.fillStyle = sel ? '#ffffff' : '#e8eef5';
      ctx.fillText(`◄ ${valor[que]} ►`, r.x + r.w - 24, r.y + r.h / 2 + 1);
    });
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(232,238,245,0.45)';
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText(dice('opciones.nota_voces'), b.x + b.w / 2, b.y + b.h - 78);      // (v1.93)
    ctx.fillText(dice('opciones.ayuda'), b.x + b.w / 2, b.y + b.h - 34);
    ctx.restore();
  }

  /** Los créditos (v0.87), encima del menú. */
  _drawCreditos(ctx) {
    const b = CREDITOS_BOX;
    ctx.save();
    ctx.fillStyle = 'rgba(2,5,8,0.94)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(125,255,176,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.textBaseline = 'middle';
    let y = b.y + 70;
    for (const [titulo, texto] of CREDITOS()) {
      if (titulo === 'VIGÍA-7') {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#e8eef5';
        ctx.font = 'bold 40px "Courier New", monospace';
        ctx.fillText(titulo, b.x + b.w / 2, y);
      } else if (titulo && !texto) {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#7dffb0';
        ctx.font = 'bold 20px "Courier New", monospace';
        ctx.fillText(titulo, b.x + 60, y);
      } else if (titulo || texto) {
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(159,216,180,0.85)';
        ctx.font = '18px "Courier New", monospace';
        if (titulo) ctx.fillText(titulo, b.x + 60, y);
        ctx.fillStyle = '#e8eef5';
        ctx.fillText(texto, b.x + (titulo ? 180 : 60), y);
      }
      y += titulo === 'VIGÍA-7' ? 56 : 42;
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(232,238,245,0.45)';
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText(dice('menu.volver'), b.x + b.w / 2, b.y + b.h - 34);
    ctx.restore();
  }

  /** Flechas: mover la selección (se salta Continue si está desactivado). */
  move(dir, save) {
    if (this.confirming) {
      this.confirmChoice = this.confirmChoice === 'yes' ? 'no' : 'yes';
      return;
    }
    // (v1.56) NEW GAME · CONTINUE (si hay partida) · EXTRAS
    const orden = save ? ['newGame', 'continue', 'extras'] : ['newGame', 'extras'];
    const i = Math.max(0, orden.indexOf(this.selected));
    this.selected = orden[(i + (dir < 0 ? orden.length - 1 : 1)) % orden.length];
  }


  // --- (v2.01) El fondo del menú: un render de la oficina única (tools/3d/menu/fondo_menu.py, encuadre «b»: la
  // compuerta izquierda, la consola y el ventanal con el planeta), con la luz y el tono del juego. Con vida: la luz
  // parpadea a ratos (un instante con la de emergencia: el pase «apagon»), polvo en el aire y la pantalla de la consola
  // encendida. Una zona oscura detrás del título y los botones, y en la esquina de abajo a la derecha. Por ahora el
  // mismo en todas las noches (el usuario: «solo uno», el de la Noche 1, que no destripa nada). Mientras carga, el de
  // antes (v0.2, dibujado con código: historico/menu_fondo_v02/).
  _cargaFondo() {
    if (this.fondo) return;
    const im = (src) => { const i = new Image(); i.src = src; return i; };
    this.fondo = { normal: im('assets/menu/fondo_n1.webp'), apagon: im('assets/menu/fondo_n1_apagon.webp') };
    this.fondoPantalla = {"x": 725, "y": 490, "w": 119, "h": 92};
    this.parpadeo = { siguiente: 4 + Math.random() * 6, hasta: 0 };
    const rnd = new Random(77);
    this.polvo = Array.from({ length: 80 }, () => ({ x: rnd.next() * 1600, y: rnd.next() * 900, z: 0.3 + rnd.next() * 0.7, f: rnd.next() * 6.28 }));
  }

  _drawFondo(ctx, t) {
    this._cargaFondo();
    const fo = this.fondo;
    const W = CONFIG.WIDTH;
    const H = CONFIG.HEIGHT;
    if (!fo.normal.complete || !fo.normal.naturalWidth) { this._drawFondoAntiguo(ctx, t); return; }
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(fo.normal, 0, 0, W, H);
    // la luz que parpadea: a ratos, unos instantes, la de emergencia
    const p = this.parpadeo;
    if (t >= p.siguiente) { p.hasta = t + 0.15 + Math.random() * 0.55; p.siguiente = t + 6 + Math.random() * 10; }
    if (t < p.hasta && fo.apagon.complete && fo.apagon.naturalWidth) {
      const a = Math.random() < 0.55 ? 1 : Math.random() * 0.6;
      ctx.globalAlpha = a;
      ctx.drawImage(fo.apagon, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    // la pantalla de la consola, encendida: un brillo verde que respira y un cursor que parpadea
    const s = this.fondoPantalla;
    if (s) {
      const cx = s.x + s.w / 2;
      const cy = s.y + s.h / 2;
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, Math.max(s.w, s.h) * 0.9);
      g.addColorStop(0, `rgba(90,255,150,${0.16 + 0.05 * Math.sin(t * 2.1)})`);
      g.addColorStop(1, 'rgba(90,255,150,0)');
      ctx.fillStyle = g;
      ctx.fillRect(s.x - s.w, s.y - s.h, s.w * 3, s.h * 3);
      ctx.fillStyle = 'rgba(150,255,190,0.55)';
      for (let k = 0; k < 4; k++) ctx.fillRect(s.x + s.w * 0.18, s.y + s.h * (0.22 + k * 0.15), s.w * (0.25 + ((k * 37) % 40) / 100), Math.max(1, s.h * 0.05));
      if (Math.floor(t * 2) % 2 === 0) ctx.fillRect(s.x + s.w * 0.18, s.y + s.h * 0.82, s.w * 0.08, Math.max(1, s.h * 0.06));
    }
    // polvo en el aire (más claro cerca del ventanal)
    for (const q of this.polvo) {
      q.x += (Math.sin(t * 0.3 + q.f) * 3 + 1.5) * q.z * (1 / 60);
      q.y += (Math.cos(t * 0.23 + q.f) * 2 + 0.8) * q.z * (1 / 60);
      if (q.x > W) q.x -= W;
      if (q.y > H) q.y -= H;
      const luz = Math.max(0, 1 - Math.hypot(q.x - 1180, q.y - 260) / 700);
      ctx.globalAlpha = (0.05 + 0.22 * luz) * q.z * (0.6 + 0.4 * Math.sin(t * 1.7 + q.f));
      ctx.fillStyle = '#e6eef8';
      ctx.fillRect(q.x, q.y, 1.6 * q.z + 0.6, 1.6 * q.z + 0.6);
    }
    ctx.globalAlpha = 1;
    // la zona oscura detrás del título y los botones, y en la esquina de las opciones
    const izq = ctx.createLinearGradient(0, 0, 980, 0);
    izq.addColorStop(0, 'rgba(2,4,8,0.86)');
    izq.addColorStop(0.5, 'rgba(2,4,8,0.62)');
    izq.addColorStop(1, 'rgba(2,4,8,0)');
    ctx.fillStyle = izq;
    ctx.fillRect(0, 0, 980, H);
    const esq = ctx.createRadialGradient(1440, 770, 40, 1440, 770, 460);
    esq.addColorStop(0, 'rgba(2,4,8,0.78)');
    esq.addColorStop(1, 'rgba(2,4,8,0)');
    ctx.fillStyle = esq;
    ctx.fillRect(900, 380, 700, 520);
    ctx.restore();
  }

  /** (v0.2–v2.00) El fondo de antes, dibujado con código: el ojo de buey, el planeta y la luz roja (de reserva). */
  _drawFondoAntiguo(ctx, t) {
    const W = CONFIG.WIDTH;
    const H = CONFIG.HEIGHT;
    ctx.fillStyle = '#04060a';
    ctx.fillRect(0, 0, W, H);

    // Ojo de buey con estrellas a la derecha
    const px = 1220;
    const py = 330;
    const pr = 230;
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#01020a';
    ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    const drift = (t * 0.006) % 1;
    for (const s of this.stars) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 1.3 + s.tw);
      ctx.fillStyle = '#dfe8ff';
      ctx.fillRect(px - pr + ((s.x + drift) % 1) * pr * 2, py - pr + s.y * pr * 2, s.r, s.r);
    }
    ctx.globalAlpha = 1;
    const pg = ctx.createRadialGradient(px - 60, py + 420, 40, px, py + 520, 420);
    pg.addColorStop(0, '#3b6fb6');
    pg.addColorStop(0.7, '#10264a');
    pg.addColorStop(1, 'rgba(5,11,26,0)');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(px, py + 520, 420, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#2b333d';
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#4a5560';
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(px + Math.cos(a) * pr, py + Math.sin(a) * pr, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Paneles de la pared y luz de emergencia giratoria
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 2;
    for (let x = 0; x < W; x += 200) ctx.strokeRect(x + 4, 4, 192, H - 8);
    const flash = Math.max(0, Math.cos(t * 2.4));
    const glow = ctx.createRadialGradient(140, 70, 4, 140, 70, 420);
    glow.addColorStop(0, `rgba(255,50,30,${0.35 * flash})`);
    glow.addColorStop(1, 'rgba(255,50,30,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 700, 600);
    ctx.fillStyle = `rgb(${90 + 160 * flash},30,25)`;
    ctx.beginPath();
    ctx.arc(140, 76, 18, Math.PI, 0);
    ctx.fill();
  }

  draw(ctx, { save, effects, audioReady, splash = false, musicaMuda = false }) {
    const W = CONFIG.WIDTH;
    const H = CONFIG.HEIGHT;
    const t = this.time;
    this._drawFondo(ctx, t);

    // Título con temblor ocasional
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const jx = Math.random() < 0.04 ? (Math.random() - 0.5) * 14 : 0;
    ctx.fillStyle = '#e8eef5';
    ctx.font = 'bold 120px "Courier New", monospace';
    ctx.fillText('VIGIA-7', 120 + jx, 280);
    ctx.font = '26px "Courier New", monospace';
    ctx.fillStyle = 'rgba(232,238,245,0.65)';
    ctx.fillText(dice('menu.subtitulo'), 126, 360);

    // v0.77: antes del primer clic o tecla (el navegador no deja sonar nada
    // hasta entonces), «PULSA CUALQUIER TECLA», con el estilo de la terminal
    if (splash) {
      ctx.textAlign = 'left';
      ctx.font = 'bold 30px "Courier New", monospace';
      ctx.fillStyle = `rgba(125,255,176,${0.55 + 0.45 * Math.abs(Math.sin(t * 2.2))})`;
      ctx.fillText(`${dice('menu.pulsa')}${Math.floor(t * 2) % 2 ? '_' : ' '}`, 126, 540);
      ctx.font = '16px "Courier New", monospace';
      ctx.fillStyle = 'rgba(232,238,245,0.4)';
      ctx.fillText(dice('menu.radio'), 128, 590);
      ctx.textAlign = 'right';
      ctx.fillText(CONFIG.VERSION, W - 40, 860);
      if (Math.random() < 0.015) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, W, H);
      }
      effects.static(ctx, 0.07);
      effects.vignette(ctx, 0.85);
      return;
    }

    // Opciones
    this._item(ctx, ITEMS.newGame, dice('menu.nueva'), this.selected === 'newGame' && !this.confirming, true);
    const label = save
      ? (['n2final', 'n2enfria', 'n3final', 'n5seis', 'n6sala', 'n6turno'].includes(save.checkpoint) ? dice(`menu.continuar_${save.checkpoint}`)
        : save.night >= 7 ? dice('menu.continuar_n7')
        : dice(save.completed ? 'menu.continuar_superada' : 'menu.continuar_noche', { n: save.night }))
      : dice('menu.continuar');
    this._item(ctx, ITEMS.continue, label, this.selected === 'continue' && !this.confirming, !!save);
    if (!save) {
      ctx.fillStyle = 'rgba(150,160,170,0.5)';
      ctx.font = '16px "Courier New", monospace';
      ctx.fillText(dice('menu.sin_partida'), ITEMS.continue.x + ITEMS.continue.w + 24, ITEMS.continue.y + ITEMS.continue.h / 2);
    }
    this._drawExtras(ctx);

    // Finales especiales vistos (flags de la partida; NIGHT4.ENDINGS)
    const seen = NIGHT4.ENDINGS.filter((e) => save?.flags?.[e.flag]);
    if (seen.length) {
      ctx.fillStyle = 'rgba(176,152,255,0.95)';
      ctx.font = '16px "Courier New", monospace';
      ctx.fillText(dice('menu.finales_especiales', { a: seen.length, b: NIGHT4.ENDINGS.length, lista: seen.map((e) => dice(`menu.final_especial.${e.flag}`)).join(' · ') }), 120, 790);
    }

    ctx.fillStyle = 'rgba(232,238,245,0.4)';
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText(dice('menu.ayuda'), 120, 820);
    ctx.textAlign = 'right';
    ctx.fillText(CONFIG.VERSION, W - 40, 860);
    // La música (v0.77)
    ctx.strokeStyle = this.hoverMusica ? 'rgba(125,255,176,0.8)' : 'rgba(125,255,176,0.3)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(MUSICA.x, MUSICA.y, MUSICA.w, MUSICA.h);
    ctx.fillStyle = musicaMuda ? 'rgba(150,160,170,0.6)' : 'rgba(159,216,180,0.9)';
    ctx.textAlign = 'center';
    ctx.fillText(dice(musicaMuda ? 'menu.musica_no' : 'menu.musica_si'), MUSICA.x + MUSICA.w / 2, MUSICA.y + MUSICA.h / 2 + 1);
    ctx.strokeStyle = this.hoverCreditos ? 'rgba(125,255,176,0.8)' : 'rgba(125,255,176,0.3)';
    ctx.strokeRect(CREDITOS_BTN.x, CREDITOS_BTN.y, CREDITOS_BTN.w, CREDITOS_BTN.h);
    ctx.fillStyle = 'rgba(159,216,180,0.9)';
    ctx.fillText(dice('menu.creditos_btn'), CREDITOS_BTN.x + CREDITOS_BTN.w / 2, CREDITOS_BTN.y + CREDITOS_BTN.h / 2 + 1);
    ctx.strokeStyle = this.hoverFinales ? 'rgba(125,255,176,0.8)' : 'rgba(125,255,176,0.3)';
    ctx.strokeRect(FINALES_BTN.x, FINALES_BTN.y, FINALES_BTN.w, FINALES_BTN.h);
    ctx.fillStyle = 'rgba(159,216,180,0.9)';
    ctx.fillText(dice('menu.finales_btn', { a: Finales.vistos().length, b: FINALES.length }), FINALES_BTN.x + FINALES_BTN.w / 2, FINALES_BTN.y + FINALES_BTN.h / 2 + 1);
    ctx.strokeStyle = this.hoverOpciones ? 'rgba(125,255,176,0.8)' : 'rgba(125,255,176,0.3)';
    ctx.strokeRect(OPCIONES_BTN.x, OPCIONES_BTN.y, OPCIONES_BTN.w, OPCIONES_BTN.h);
    ctx.fillStyle = 'rgba(159,216,180,0.9)';
    ctx.fillText(dice('menu.opciones_btn'), OPCIONES_BTN.x + OPCIONES_BTN.w / 2, OPCIONES_BTN.y + OPCIONES_BTN.h / 2 + 1);
    ctx.textAlign = 'right';
    if (!audioReady && Math.floor(t * 1.5) % 2 === 0) {
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(232,238,245,0.55)';
      ctx.fillText(dice('menu.activar_sonido'), 120, 850);
    }

    if (this.notice) {
      ctx.fillStyle = 'rgba(255,200,120,0.85)';
      ctx.font = '16px "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(this.notice, ITEMS.continue.x + 24, ITEMS.continue.y + 80);
    }
    if (this.confirming) this._drawConfirm(ctx);
    if (this.creditos) this._drawCreditos(ctx);
    if (this.finales) this._drawFinales(ctx);
    if (this.opciones) this._drawOpciones(ctx, musicaMuda);

    // Parpadeo de la iluminación y estática
    if (Math.random() < 0.015) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, W, H);
    }
    effects.static(ctx, 0.07);
    effects.vignette(ctx, 0.85);
  }

  /** (v1.56) El botón EXTRAS: bloqueado (gris, candado, «Completa la Noche 5»; al pulsarlo tiembla) o abierto. */
  _drawExtras(ctx) {
    const abierto = ExtrasProgreso.extras();
    const r = ITEMS.extras;
    const sel = this.selected === 'extras' && !this.confirming;
    const k = Math.max(0, this.tiembla ?? 0);
    const dx = k > 0 ? Math.sin(k * 90) * 9 * (k / 0.35) : 0;
    ctx.save();
    ctx.translate(dx, 0);
    this._item(ctx, r, dice('menu.extras'), sel, abierto);
    if (abierto && ExtrasProgreso.estrellasNuevas((TEXTOS.retos ?? []).map((x) => x.id)).length) {
      // (v2.00) hay una estrella nueva por ver en Extras: un punto dorado que late junto al botón
      const k = 0.55 + 0.45 * Math.sin(performance.now() / 240);
      ctx.save();
      ctx.fillStyle = `rgba(255,204,51,${k})`;
      ctx.shadowColor = '#ffcc33';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(r.x + r.w - 26, r.y + r.h / 2, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (!abierto) {
      // el candado, a la derecha del botón, y el texto
      const cx = r.x + r.w - 44;
      const cy = r.y + r.h / 2 + 4;
      ctx.strokeStyle = sel ? 'rgba(190,200,210,0.75)' : 'rgba(150,160,170,0.55)';
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy - 9, 8, Math.PI, 0);
      ctx.stroke();
      ctx.fillRect(cx - 12, cy - 9, 24, 19);
      ctx.fillStyle = '#0a100e';
      ctx.fillRect(cx - 2, cy - 3, 4, 7);
      ctx.font = '16px "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = k > 0 ? 'rgba(255,150,120,0.9)' : 'rgba(150,160,170,0.6)';
      ctx.fillText(dice('menu.completa_n5'), r.x + r.w + 24, r.y + r.h / 2);
    }
    ctx.restore();
    // «EXTRAS DESBLOQUEADO» (una vez, al volver al menú tras completar la Noche 5)
    const a = this.avisoExtras ?? 0;
    if (a > 0) {
      const al = Math.min(1, a / 0.6, (4 - a) * 3);
      ctx.save();
      ctx.globalAlpha = Math.max(0, al);
      ctx.fillStyle = 'rgba(4,12,8,0.92)';
      ctx.fillRect(r.x + r.w + 20, r.y + 4, 420, r.h - 8);
      ctx.strokeStyle = '#7dffb0';
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x + r.w + 20, r.y + 4, 420, r.h - 8);
      ctx.fillStyle = Math.floor(a * 4) % 2 ? '#d8ffe8' : '#7dffb0';
      ctx.font = 'bold 26px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(dice('menu.extras_desbloqueado'), r.x + r.w + 230, r.y + r.h / 2 + 1);
      ctx.restore();
    }
  }

  _item(ctx, r, label, selected, enabled) {
    ctx.save();
    ctx.fillStyle = selected ? 'rgba(125,255,176,0.14)' : 'rgba(10,16,14,0.6)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = !enabled ? 'rgba(120,130,140,0.3)' : selected ? '#7dffb0' : 'rgba(125,255,176,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = !enabled ? 'rgba(130,140,150,0.45)' : selected ? '#d8ffe8' : '#9fd8b4';
    ctx.font = 'bold 28px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${selected ? '> ' : '  '}${label}`, r.x + 20, r.y + r.h / 2 + 1);
    ctx.restore();
  }

  _drawConfirm(ctx) {
    const b = CONFIRM.box;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    ctx.fillStyle = '#0a0f0d';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#ff6a5a';
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffb0a6';
    ctx.font = 'bold 30px "Courier New", monospace';
    ctx.fillText(dice('menu.confirmar_1'), b.x + b.w / 2, b.y + 70);
    ctx.fillStyle = '#e8eef5';
    ctx.fillText(dice('menu.confirmar_2'), b.x + b.w / 2, b.y + 115);
    for (const [key, label] of [['yes', dice('menu.si')], ['no', dice('menu.no')]]) {
      const r = CONFIRM[key];
      const sel = this.confirmChoice === key;
      ctx.fillStyle = sel ? 'rgba(255,106,90,0.25)' : 'rgba(255,255,255,0.05)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = sel ? '#ff6a5a' : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = sel ? '#ffffff' : '#c8d0d8';
      ctx.font = 'bold 26px "Courier New", monospace';
      ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
    }
  }
}
