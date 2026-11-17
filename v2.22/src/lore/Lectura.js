// =============================================================
// lore/Lectura.js — (v2.19, el lore, fase A) Una nota (o una foto, fase B) a pantalla para leerla: su papel (con
// manchas, dobleces, la hoja arrancada…), la letra impresa o a mano y la pista resaltada como en el documento
// (rodeada o subrayada a mano, en rojo). El juego se pausa mientras se lee (Game: update parado y el audio
// suspendido). Se cierra con R, Esc, Enter, E, Espacio o un clic. Lo dibuja Game encima de todo.
// =============================================================

import { CONFIG } from '../config.js';
import { dice } from '../core/Idioma.js';
import { ESTILOS, NOTAS, FOTOS } from './catalogo.js';
import { dibujaFoto } from './FotosLore.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const LETRA = {
  impresa: (t) => `${t}px "Courier New", monospace`,
  mano: (t) => `italic ${t}px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive`,
  pared: (t) => `bold ${t}px Impact, "Arial Black", sans-serif`,
};

// un generador de números con semilla (las manchas de cada nota, siempre las mismas)
function azar(semilla) {
  let s = 0;
  for (const ch of String(semilla)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Parte una línea en trozos { t, marca } con las marcas [o]…[/o] y [u]…[/u]. */
function trozos(linea) {
  const out = [];
  let resto = linea, marca = null;
  while (resto.length) {
    const m = marca ? resto.indexOf(`[/${marca}]`) : Math.min(...['[o]', '[u]'].map((k) => (resto.indexOf(k) < 0 ? 1e9 : resto.indexOf(k))));
    if (m === 1e9 || m < 0) { out.push({ t: resto, marca }); break; }
    if (m > 0) out.push({ t: resto.slice(0, m), marca });
    if (marca) { resto = resto.slice(m + 4); marca = null; } else { marca = resto[m + 1]; resto = resto.slice(m + 3); }
  }
  return out;
}

export class Lectura {
  constructor(g) {
    this.g = g;
    this.id = null;
    this.t = 0;
  }

  get activa() { return this.id !== null; }

  /** Abre la nota id (o, en la fase B, una foto: { foto }). */
  abre(id, op) {
    this.id = id;
    this.esFoto = !!op?.foto || FOTOS.some((f) => f.id === id);   // (v2.20) una foto del laboratorio
    this.t = 0;
    this.g.audio?.keyClick?.();
    try { this.g.audio?.ctx?.suspend(); } catch { /* sin audio */ }
    return true;
  }

  cierra() {
    if (!this.activa) return;
    this.id = null;
    this.esFoto = false;
    try { this.g.audio?.ctx?.resume(); } catch { /* sin audio */ }
    this.g.audio?.keyClick?.();
  }

  tecla(code) {
    if (['KeyR', 'Escape', 'Enter', 'NumpadEnter', 'KeyE', 'Space'].includes(code) && this.t > 0.2) this.cierra();
    return true;
  }

  click() {
    if (this.t > 0.2) this.cierra();
    return true;
  }

  /** (en tiempo real: el juego está parado) */
  avanza(dt) { if (this.activa) this.t += dt; }

  draw(ctx) {
    if (!this.activa) return;
    if (this.esFoto) return dibujaFoto(ctx, this.id, this.t);
    const nota = NOTAS.find((n) => n.id === this.id);
    const E = ESTILOS[nota?.estilo] ?? ESTILOS.parte;
    const k = Math.min(1, this.t / 0.18);
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.78 * k})`;
    ctx.fillRect(0, 0, W, H);
    const r = azar(this.id);
    const ang = (r() - 0.5) * (E.letra === 'pared' ? 0 : 0.05);
    ctx.translate(W / 2, H / 2 + (1 - k) * 30);
    ctx.rotate(ang);
    ctx.globalAlpha = k;
    this._papel(ctx, E, r);
    this._texto(ctx, E, r);
    ctx.restore();
  }

  _papel(ctx, E, r) {
    const w = E.w, h = E.h;
    if (E.letra === 'pared') {
      // la pared: chapa oscura con sus juntas y la mugre; las letras, pintadas encima
      ctx.fillStyle = E.papel;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 3;
      for (let x = -w / 2 + 180; x < w / 2; x += 260) { ctx.beginPath(); ctx.moveTo(x, -h / 2); ctx.lineTo(x, h / 2); ctx.stroke(); }
      for (let k = 0; k < 40; k++) {
        ctx.fillStyle = `rgba(0,0,0,${0.08 + r() * 0.12})`;
        ctx.beginPath();
        ctx.ellipse((r() - 0.5) * w, (r() - 0.5) * h, 20 + r() * 90, 10 + r() * 40, r() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    // la sombra y el papel
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-w / 2 + 10, -h / 2 + 12, w, h);
    ctx.fillStyle = E.papel;
    ctx.beginPath();
    if (E.arrancada) {
      // el borde de arriba, arrancado
      ctx.moveTo(-w / 2, -h / 2 + 14);
      for (let x = -w / 2; x <= w / 2; x += 18) ctx.lineTo(x, -h / 2 + 6 + r() * 16);
      ctx.lineTo(w / 2, h / 2);
      ctx.lineTo(-w / 2, h / 2);
    } else ctx.rect(-w / 2, -h / 2, w, h);
    ctx.fill();
    // las rayas del cuaderno y el margen
    if (E.rayas) {
      ctx.strokeStyle = 'rgba(90,120,170,0.35)';
      ctx.lineWidth = 1.2;
      for (let y = -h / 2 + 70; y < h / 2 - 10; y += 38) { ctx.beginPath(); ctx.moveTo(-w / 2, y); ctx.lineTo(w / 2, y); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(190,60,60,0.4)';
      ctx.beginPath(); ctx.moveTo(-w / 2 + 60, -h / 2); ctx.lineTo(-w / 2 + 60, h / 2); ctx.stroke();
    }
    // manchas (de café, de óxido, de algo peor), el doblez y el amarilleo de los bordes
    for (let k = 0; k < 6; k++) {
      const x = (r() - 0.5) * w * 0.9, y = (r() - 0.5) * h * 0.9, rad = 14 + r() * 50;
      const gr = ctx.createRadialGradient(x, y, rad * 0.2, x, y, rad);
      const c = r() < 0.3 ? '90,40,20' : '120,95,50';
      gr.addColorStop(0, `rgba(${c},${0.04 + r() * 0.08})`);
      gr.addColorStop(0.85, `rgba(${c},${0.1 + r() * 0.12})`);
      gr.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = gr;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    const gb = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    gb.addColorStop(0, 'rgba(100,80,40,0.18)');
    gb.addColorStop(0.08, 'rgba(100,80,40,0)');
    gb.addColorStop(0.92, 'rgba(100,80,40,0)');
    gb.addColorStop(1, 'rgba(100,80,40,0.18)');
    ctx.fillStyle = gb;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-w / 2, -h * 0.05); ctx.lineTo(w / 2, -h * 0.02); ctx.stroke();
    if (E.sello) {
      // el sello de la dirección (rojo, torcido)
      ctx.save();
      ctx.translate(w / 2 - 120, h / 2 - 90);
      ctx.rotate(-0.25);
      ctx.strokeStyle = 'rgba(150,30,25,0.55)';
      ctx.lineWidth = 4;
      ctx.strokeRect(-80, -26, 160, 52);
      ctx.fillStyle = 'rgba(150,30,25,0.55)';
      ctx.font = 'bold 20px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('VIGIA-7', 0, 0);
      ctx.restore();
    }
  }

  _texto(ctx, E, r) {
    const crudo = dice(`lore.${this.id}_texto`);
    const [hoja, posit] = crudo.split('¶');
    const lineas = hoja.split('|');
    const w = E.w, h = E.h;
    const tam = E.letra === 'pared' ? 92 : E.letra === 'mano' ? 27 : 23;
    const alto = E.letra === 'pared' ? 130 : E.letra === 'mano' ? 40 : 34;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = LETRA[E.letra](tam);
    // las líneas, partidas a lo ancho del papel
    const margen = E.letra === 'pared' ? 70 : E.rayas ? 80 : 54;
    const ancho = w - margen - 50;
    const filas = [];
    for (const l of lineas) {
      const ps = trozos(l);
      let fila = [], x = 0;
      for (const p of ps) {
        for (const pal of p.t.split(/(\s+)/)) {
          if (!pal) continue;
          const pw = ctx.measureText(pal).width;
          if (x + pw > ancho && x > 0 && pal.trim()) { filas.push(fila); fila = []; x = 0; }
          if (!fila.length && !pal.trim()) continue;
          fila.push({ t: pal, marca: p.marca, x, w: pw });
          x += pw;
        }
      }
      filas.push(fila);
      if (E.letra === 'impresa') filas.push([]);       // (las impresas, con aire entre párrafos)
    }
    let y = -h / 2 + (E.letra === 'pared' ? 150 : E.rayas ? 64 : 70);
    if (E.letra === 'pared') y = -((filas.length - 1) * alto) / 2 + 30;
    for (const fila of filas) {
      const x0 = E.letra === 'pared' ? -fila.reduce((a, s) => a + s.w, 0) / 2 : -w / 2 + margen;
      for (const s of fila) {
        const tb = E.letra === 'mano' ? (r() - 0.5) * 2 : 0;
        if (E.letra === 'pared') {
          // pintura: la letra con su borde corrido y algún chorreón
          ctx.fillStyle = E.tinta;
          ctx.fillText(s.t, x0 + s.x, y);
          if (r() < 0.5 && s.t.trim()) {
            ctx.fillRect(x0 + s.x + r() * s.w, y - 4, 4, 20 + r() * 60);
          }
        } else {
          ctx.fillStyle = E.tinta;
          ctx.fillText(s.t, x0 + s.x, y + tb);
        }
      }
      this._marcas(ctx, fila, x0, y, tam, r);
      y += alto;
    }
    if (posit && E.posit) this._posit(ctx, posit, w, h, r);
  }

  /** La pista: rodeada o subrayada a mano, en rojo (con su temblor). */
  _marcas(ctx, fila, x0, y, tam, r) {
    for (const marca of ['o', 'u']) {
      const ss = fila.filter((s) => s.marca === marca && s.t.trim());
      if (!ss.length) continue;
      const xa = x0 + ss[0].x - 6, xb = x0 + ss[ss.length - 1].x + ss[ss.length - 1].w + 6;
      ctx.save();
      ctx.strokeStyle = 'rgba(175,25,20,0.85)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      if (marca === 'u') {
        for (let k = 0; k < 2; k++) {
          ctx.beginPath();
          ctx.moveTo(xa, y + 7 + k * 5);
          for (let x = xa; x <= xb; x += 14) ctx.lineTo(x, y + 7 + k * 5 + (r() - 0.5) * 3);
          ctx.stroke();
        }
      } else {
        const cx = (xa + xb) / 2, cy = y - tam * 0.35, rx = (xb - xa) / 2 + 10, ry = tam * 0.85;
        ctx.beginPath();
        for (let a = -0.3; a <= Math.PI * 2 + 0.25; a += 0.12) {
          const f = 1 + (r() - 0.5) * 0.05;
          ctx.lineTo(cx + Math.cos(a) * rx * f, cy + Math.sin(a) * ry * f + a * 1.2);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /** El pósit de la nota 1: pegado encima de la hoja, torcido, a mano. */
  _posit(ctx, texto, w, h, r) {
    ctx.save();
    ctx.translate(w / 2 - 170, h / 2 - 150);
    ctx.rotate(0.07);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-120, -100, 250, 230);
    ctx.fillStyle = '#d8c64a';
    ctx.fillRect(-126, -106, 250, 230);
    ctx.font = LETRA.mano(22);
    ctx.fillStyle = '#2b2410';
    const filas = [];
    let fila = [], x = 0;
    for (const p of trozos(texto)) {
      for (const pal of p.t.split(/(\s+)/)) {
        if (!pal) continue;
        const pw = ctx.measureText(pal).width;
        if (x + pw > 210 && x > 0 && pal.trim()) { filas.push(fila); fila = []; x = 0; }
        if (!fila.length && !pal.trim()) continue;
        fila.push({ t: pal, marca: p.marca, x, w: pw });
        x += pw;
      }
    }
    filas.push(fila);
    let y = -60;
    for (const f of filas) {
      for (const s of f) ctx.fillText(s.t, -106 + s.x, y);
      this._marcas(ctx, f, -106, y, 22, r);
      y += 36;
    }
    ctx.restore();
  }
}
