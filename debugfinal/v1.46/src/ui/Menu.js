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
import { Random } from '../core/Random.js';
import { NIGHT4 } from '../night/night4.js';
import { FINALES, Finales } from '../core/Finales.js';

const ITEMS = {
  newGame: { x: 120, y: 500, w: 560, h: 60 },
  continue: { x: 120, y: 580, w: 560, h: 60 },
};
// v0.77: el botón de la música (también con la tecla M)
const MUSICA = { x: 1290, y: 798, w: 270, h: 34 };
// v0.87: los créditos (también con la tecla C)
const CREDITOS_BTN = { x: 1290, y: 752, w: 270, h: 34 };
const CREDITOS_BOX = { x: 220, y: 170, w: 1160, h: 560 };
// v1.10: los finales vistos (también con la tecla F)
const FINALES_BTN = { x: 1290, y: 706, w: 270, h: 34 };
export const CREDITOS = [
  ['VIGÍA-7', ''],
  ['', ''],
  ['MÚSICA', ''],
  ['Menú', '«Clair de lune» — Claude Debussy (dominio público). Arreglo propio de Vigía-7.'],
  ['Noche 7', '«Flamewall» — Camellia. Remix para VIGIA-7.'],
  ['', ''],
  ['', 'Voces, sonidos, modelos y código: originales de Vigía-7.'],
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
  }

  /** @param save partida guardada o null */
  hitTest(x, y, save) {
    if (this.confirming) {
      if (inside(CONFIRM.yes, x, y)) return 'yes';
      if (inside(CONFIRM.no, x, y)) return 'no';
      return null;
    }
    if (this.creditos) return 'creditos';          // (abiertos: cualquier clic los cierra)
    if (this.finales) return 'finales';
    if (inside(FINALES_BTN, x, y)) return 'finales';
    if (inside(MUSICA, x, y)) return 'musica';
    if (inside(CREDITOS_BTN, x, y)) return 'creditos';
    if (inside(ITEMS.newGame, x, y)) return 'newGame';
    if (save && inside(ITEMS.continue, x, y)) return 'continue';
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
    ctx.fillText('FINALES', b.x + b.w / 2, b.y + 70);
    ctx.fillStyle = '#7dffb0';
    ctx.font = 'bold 26px "Courier New", monospace';
    ctx.fillText(`${vistos.length}/${FINALES.length}`, b.x + b.w / 2, b.y + 122);
    ctx.textAlign = 'left';
    let y = b.y + 200;
    for (const f of FINALES) {
      const visto = vistos.includes(f.n);
      ctx.font = 'bold 22px "Courier New", monospace';
      ctx.fillStyle = visto ? 'rgba(159,216,180,0.9)' : 'rgba(130,140,150,0.6)';
      ctx.fillText(`Final ${f.n}/${FINALES.length}`, b.x + 200, y);
      ctx.fillStyle = visto ? '#e8eef5' : 'rgba(130,140,150,0.6)';
      ctx.font = '22px "Courier New", monospace';
      ctx.fillText(visto ? `– ${f.titulo}` : '– ???', b.x + 420, y);
      y += 56;
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(232,238,245,0.45)';
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText('Clic o cualquier tecla para volver', b.x + b.w / 2, b.y + b.h - 34);
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
    for (const [titulo, texto] of CREDITOS) {
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
    ctx.fillText('Clic o cualquier tecla para volver', b.x + b.w / 2, b.y + b.h - 34);
    ctx.restore();
  }

  /** Flechas: mover la selección (se salta Continue si está desactivado). */
  move(dir, save) {
    if (this.confirming) {
      this.confirmChoice = this.confirmChoice === 'yes' ? 'no' : 'yes';
      return;
    }
    if (!save) {
      this.selected = 'newGame';
      return;
    }
    this.selected = this.selected === 'newGame' ? 'continue' : 'newGame';
  }

  draw(ctx, { save, effects, audioReady, splash = false, musicaMuda = false }) {
    const W = CONFIG.WIDTH;
    const H = CONFIG.HEIGHT;
    const t = this.time;
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

    // Título con temblor ocasional
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const jx = Math.random() < 0.04 ? (Math.random() - 0.5) * 14 : 0;
    ctx.fillStyle = '#e8eef5';
    ctx.font = 'bold 120px "Courier New", monospace';
    ctx.fillText('VIGIA-7', 120 + jx, 280);
    ctx.font = '26px "Courier New", monospace';
    ctx.fillStyle = 'rgba(232,238,245,0.65)';
    ctx.fillText('Turno de noche — Modulo de Control', 126, 360);

    // v0.77: antes del primer clic o tecla (el navegador no deja sonar nada
    // hasta entonces), «PULSA CUALQUIER TECLA», con el estilo de la terminal
    if (splash) {
      ctx.textAlign = 'left';
      ctx.font = 'bold 30px "Courier New", monospace';
      ctx.fillStyle = `rgba(125,255,176,${0.55 + 0.45 * Math.abs(Math.sin(t * 2.2))})`;
      ctx.fillText(`> PULSA CUALQUIER TECLA${Math.floor(t * 2) % 2 ? '_' : ' '}`, 126, 540);
      ctx.font = '16px "Courier New", monospace';
      ctx.fillStyle = 'rgba(232,238,245,0.4)';
      ctx.fillText('ENLACE CON LA RADIO DE A BORDO EN ESPERA', 128, 590);
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
    this._item(ctx, ITEMS.newGame, 'NEW GAME', this.selected === 'newGame' && !this.confirming, true);
    const label = save
      ? (save.checkpoint === 'n2final' ? 'CONTINUE – Noche 2 (6 AM)'
        : save.checkpoint === 'n3final' ? 'CONTINUE – Noche 3 (6 AM)'
        : save.checkpoint === 'n5seis' ? 'CONTINUE – Noche 5 (6 AM)'
        : save.checkpoint === 'n6sala' ? 'CONTINUE – Noche 6 (sala oculta)'
        : save.checkpoint === 'n6turno' ? 'CONTINUE – Noche 6 (turno)'
        : save.night >= 7 ? 'CONTINUE – Noche 7'
        : save.completed ? `CONTINUE – Noche ${save.night} (superada)` : `CONTINUE – Noche ${save.night}`)
      : 'CONTINUE';
    this._item(ctx, ITEMS.continue, label, this.selected === 'continue' && !this.confirming, !!save);
    if (!save) {
      ctx.fillStyle = 'rgba(150,160,170,0.5)';
      ctx.font = '16px "Courier New", monospace';
      ctx.fillText('No hay partida guardada', ITEMS.continue.x + 24, ITEMS.continue.y + 80);
    }

    // Finales especiales vistos (flags de la partida; NIGHT4.ENDINGS)
    const seen = NIGHT4.ENDINGS.filter((e) => save?.flags?.[e.flag]);
    if (seen.length) {
      ctx.fillStyle = 'rgba(176,152,255,0.95)';
      ctx.font = '16px "Courier New", monospace';
      ctx.fillText(`FINALES ESPECIALES ${seen.length}/${NIGHT4.ENDINGS.length}: ${seen.map((e) => e.name).join(' · ')}`, 120, 790);
    }

    ctx.fillStyle = 'rgba(232,238,245,0.4)';
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText('Flechas + Enter, o clic', 120, 820);
    ctx.textAlign = 'right';
    ctx.fillText(CONFIG.VERSION, W - 40, 860);
    // La música (v0.77)
    ctx.strokeStyle = this.hoverMusica ? 'rgba(125,255,176,0.8)' : 'rgba(125,255,176,0.3)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(MUSICA.x, MUSICA.y, MUSICA.w, MUSICA.h);
    ctx.fillStyle = musicaMuda ? 'rgba(150,160,170,0.6)' : 'rgba(159,216,180,0.9)';
    ctx.textAlign = 'center';
    ctx.fillText(`MÚSICA: ${musicaMuda ? 'NO' : 'SÍ'}  (M)`, MUSICA.x + MUSICA.w / 2, MUSICA.y + MUSICA.h / 2 + 1);
    ctx.strokeStyle = this.hoverCreditos ? 'rgba(125,255,176,0.8)' : 'rgba(125,255,176,0.3)';
    ctx.strokeRect(CREDITOS_BTN.x, CREDITOS_BTN.y, CREDITOS_BTN.w, CREDITOS_BTN.h);
    ctx.fillStyle = 'rgba(159,216,180,0.9)';
    ctx.fillText('CRÉDITOS  (C)', CREDITOS_BTN.x + CREDITOS_BTN.w / 2, CREDITOS_BTN.y + CREDITOS_BTN.h / 2 + 1);
    ctx.strokeStyle = this.hoverFinales ? 'rgba(125,255,176,0.8)' : 'rgba(125,255,176,0.3)';
    ctx.strokeRect(FINALES_BTN.x, FINALES_BTN.y, FINALES_BTN.w, FINALES_BTN.h);
    ctx.fillStyle = 'rgba(159,216,180,0.9)';
    ctx.fillText(`FINALES ${Finales.vistos().length}/${FINALES.length}  (F)`, FINALES_BTN.x + FINALES_BTN.w / 2, FINALES_BTN.y + FINALES_BTN.h / 2 + 1);
    ctx.textAlign = 'right';
    if (!audioReady && Math.floor(t * 1.5) % 2 === 0) {
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(232,238,245,0.55)';
      ctx.fillText('(haz clic o pulsa una tecla para activar el sonido)', 120, 850);
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

    // Parpadeo de la iluminación y estática
    if (Math.random() < 0.015) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, W, H);
    }
    effects.static(ctx, 0.07);
    effects.vignette(ctx, 0.85);
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
    ctx.fillText('Se perderá tu progreso.', b.x + b.w / 2, b.y + 70);
    ctx.fillStyle = '#e8eef5';
    ctx.fillText('¿Continuar?', b.x + b.w / 2, b.y + 115);
    for (const [key, label] of [['yes', 'SÍ'], ['no', 'NO']]) {
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
