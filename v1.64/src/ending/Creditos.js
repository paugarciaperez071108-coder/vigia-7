// =============================================================
// Creditos.js — (v1.42, Fase 5 del final) Los créditos, al acabar cualquiera de los 4 finales.
// Negro, estrellas que pasan despacio (sigues en la nave, a la deriva) y el texto que sube. Suena «Clair de lune»
// (el arreglo propio del menú, sin la radio): en los finales del Errante más grave y con cortes de estática.
// Al final, «Gracias por jugar.» y vuelta al menú. Enter / Espacio pulsados: más deprisa; Escape: salta.
// En los finales 1 y 2 (Slaimi vivo) su brillo azul cruza la pantalla al final; en el 2 y el 4, la cara de El Errante
// asoma un instante entre la estática al acabar.
// Valores en NIGHT7.FINAL.CREDITOS.
// =============================================================

import { CONFIG } from '../config.js';
import { NIGHT7 } from '../night/night7.js';
import { COLORES } from '../core/Colores.js';
import { FINALES } from '../core/Finales.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const KC = NIGHT7.FINAL.CREDITOS;

let CARA = null;
function cara() {
  if (!CARA) {
    CARA = new Image();
    CARA.src = 'assets/n4/mira/mira_cara.jpg';
  }
  return CARA.complete && CARA.naturalWidth ? CARA : null;
}

export class Creditos {
  constructor(game) {
    this.g = game;
    this.activo = false;
  }

  /** n: el final que se acaba de ver (1–4). */
  start(n) {
    this.n = n;
    this.errante = n === 2 || n === 4;
    this.slaimi = n === 1 || n === 2;
    this.activo = true;
    this.acabado = false;
    this.t = 0;
    this.y = 0;               // px que ha subido el texto
    this.rapido = false;
    this.tFin = undefined;
    this.vioCara = false;
    this._paraMusica(0.3);
    this.estatica = 0;
    this.estaticaIn = 3 + Math.random() * 4;
    this.lineas = this._lineas();
    this.alto = this.lineas.reduce((a, l) => a + l.h, 0);
    this.estrellas = Array.from({ length: 220 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: 0.2 + Math.random() * 0.8 }));
    this._musica();
  }

  /** El texto, línea a línea: { t: texto, tam, color, h (alto que ocupa) }. */
  _lineas() {
    const L = [];
    const f = FINALES.find((q) => q.n === this.n);
    const add = (t, tam = 30, color = '#c9d3dd', h = null, extra = {}) => L.push({ t, tam, color, h: h ?? Math.round(tam * 1.7), ...extra });
    const hueco = (h = 60) => L.push({ t: '', tam: 1, color: '#000', h });
    // (v1.43, el usuario: «después del título, los créditos y "Final 1/4 – Escapaste con Slaimi", y vuelta al menú»:
    // el título «VIGIA-7» ya lo pone el final; el número de final va al acabar)
    this.cierre = `Final ${f.n}/${FINALES.length} – ${f.titulo.replace(/\.$/, '')}`;
    hueco(60);
    if (KC.AUTOR) {
      add('UN JUEGO DE', 22, '#6f8294');
      add(KC.AUTOR, 44, '#e8eef5', 90, { negrita: true });
      hueco(130);
    }
    add('A BORDO DE LA VIGIA-7', 22, '#6f8294');
    hueco(14);
    for (const [clave, nombre] of KC.TRIPULACION) {
      const muerto = clave === 'slaimi' && !this.slaimi;
      // (la Aberración, como su triángulo: negra con el borde rojo oscuro)
      if (clave === 'aberracion') add(nombre, 38, '#000', 66, { negrita: true, borde: COLORES.aberracion });
      else add(nombre, 38, muerto ? '#4a5560' : COLORES[clave] ?? '#c9d3dd', 66, { negrita: true });
    }
    hueco(130);
    add('MÚSICA', 22, '#6f8294');
    hueco(10);
    add('«Clair de lune» — Claude Debussy', 32, '#e8eef5');
    add('dominio público · arreglo propio de Vigía-7', 22, '#8fa3b5', 60);
    hueco(20);
    add('«Flamewall» — Camellia', 32, '#e8eef5');
    add('remix para VIGIA-7, con el permiso de la artista', 22, '#8fa3b5', 60);
    hueco(130);
    add('HERRAMIENTAS', 22, '#6f8294');
    hueco(10);
    for (const h of KC.HERRAMIENTAS) add(h, 28, '#c9d3dd', 50);
    hueco(130);
    add('Voces, sonidos, modelos y código: originales de Vigía-7.', 24, '#8fa3b5');
    hueco(260);
    return L;
  }

  /** «Clair de lune» (el mismo archivo del menú), con su fundido; en los finales del Errante, más grave. */
  async _musica() {
    const A = this.g.audio;
    if (!A?.ctx || !A.master) return;
    try {
      this.buf ??= await fetch('assets/audio/menu_clair_de_lune.ogg').then((r) => r.arrayBuffer()).then((d) => A.ctx.decodeAudioData(d));
    } catch {
      try {
        this.buf = await fetch('assets/audio/menu_clair_de_lune.mp3').then((r) => r.arrayBuffer()).then((d) => A.ctx.decodeAudioData(d));
      } catch {
        return;
      }
    }
    if (!this.activo) return;
    const ctx = A.ctx;
    this.gan = ctx.createGain();
    this.gan.gain.setValueAtTime(0, ctx.currentTime);
    this.gan.gain.linearRampToValueAtTime(KC.VOLUMEN, ctx.currentTime + KC.MUSICA_ENTRA);
    this.filtro = ctx.createBiquadFilter();
    this.filtro.type = 'lowpass';
    this.filtro.frequency.value = this.errante ? 2600 : 18000;
    this.src = ctx.createBufferSource();
    this.src.buffer = this.buf;
    this.src.loop = true;
    this.src.playbackRate.value = this.errante ? KC.ERRANTE_TONO : 1;
    this.src.connect(this.filtro).connect(this.gan).connect(A.master);
    this.src.start();
  }

  _paraMusica(s = 1.5) {
    const A = this.g.audio;
    if (!this.src || !A?.ctx) return;
    const t = A.ctx.currentTime;
    try {
      this.gan.gain.cancelScheduledValues(t);
      this.gan.gain.setValueAtTime(this.gan.gain.value, t);
      this.gan.gain.linearRampToValueAtTime(0, t + s);
      this.src.stop(t + s + 0.05);
    } catch {
      /* (ya parada) */
    }
    this.src = null;
  }

  tecla(code, abajo = true) {
    if (!this.activo) return;
    if (code === 'Enter' || code === 'Space' || code === 'NumpadEnter') this.rapido = abajo;
    if (abajo && code === 'Escape') this._acaba();
  }

  update(dt) {
    if (!this.activo) return;
    this.t += dt;
    const vel = KC.VELOCIDAD * (this.rapido ? KC.RAPIDO : 1);
    if (this.t > KC.ESPERA) this.y += vel * dt;
    for (const e of this.estrellas) {
      e.x -= (6 + 22 * e.z) * dt;
      if (e.x < -4) { e.x = W + 4; e.y = Math.random() * H; }
    }
    // en los finales del Errante: cortes de estática de vez en cuando (y la música se traba)
    if (this.errante) {
      this.estaticaIn -= dt;
      this.estatica = Math.max(0, this.estatica - dt * 4);
      if (this.estaticaIn <= 0) {
        this.estaticaIn = 4 + Math.random() * 6;
        this.estatica = 0.6 + Math.random() * 0.4;
        this.g.audio?.lib?.play?.('ambiente/interferencia', { volume: 0.35 });
        if (this.src) this.src.playbackRate.setTargetAtTime(KC.ERRANTE_TONO * 0.92, this.g.audio.ctx.currentTime, 0.02);
        if (this.src) this.src.playbackRate.setTargetAtTime(KC.ERRANTE_TONO, this.g.audio.ctx.currentTime + 0.25, 0.05);
      }
    }
    // el texto ha pasado entero: «Gracias por jugar.» y fuera
    const fin = this.alto + H * 0.5;
    if (this.y >= fin && this.tFin === undefined) this.tFin = this.t;
    if (this.tFin !== undefined) {
      const e = this.t - this.tFin;
      if (this.errante && e > KC.GRACIAS_S - 1.2 && !this.vioCara) {
        this.vioCara = true;
        this.estatica = 1;
        this.g.audio?.lib?.play?.('final/susurro', { volume: 0.8, pitch: 0.75 });
      }
      if (e > KC.GRACIAS_S - 2) this._paraMusica(2);
      if (e > KC.GRACIAS_S) this._acaba();
    }
  }

  _acaba() {
    if (this.acabado) return;
    this.acabado = true;
    this.activo = false;
    this._paraMusica(0.6);
    try {
      localStorage.setItem('vigia7.creditosVistos', '1');
    } catch {
      /* (sin almacenamiento) */
    }
    this.g._finCreditos?.();
  }

  draw(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    // las estrellas: pasan despacio (la nave va a la deriva)
    const entra = Math.min(1, this.t / 2.5);
    for (const e of this.estrellas) {
      ctx.fillStyle = `rgba(220,230,255,${(0.25 + 0.6 * e.z) * entra})`;
      ctx.fillRect(e.x, e.y, e.z > 0.75 ? 2 : 1, e.z > 0.75 ? 2 : 1);
    }
    // el texto que sube (centrado), con un fundido arriba y abajo
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let y = H + 40 - this.y;
    for (const l of this.lineas) {
      const cy = y + l.h / 2;
      y += l.h;
      if (!l.t || cy < -60 || cy > H + 60) continue;
      const borde = Math.min(1, Math.min(cy, H - cy) / 150);
      ctx.globalAlpha = Math.max(0, borde) * entra;
      ctx.fillStyle = l.color;
      ctx.font = `${l.negrita ? 'bold ' : ''}${l.tam}px monospace`;
      if (l.borde) {
        ctx.strokeStyle = l.borde;
        ctx.lineWidth = 3;
        ctx.strokeText(l.t, W / 2, cy);
      }
      ctx.fillText(l.t, W / 2, cy);
    }
    ctx.restore();
    // «Gracias por jugar.»
    if (this.tFin !== undefined) {
      const e = this.t - this.tFin;
      const a = Math.min(1, e / 1.5) * Math.min(1, Math.max(0, (KC.GRACIAS_S - 0.3 - e) / 1.2));
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#e8eef5';
      ctx.font = 'bold 46px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.cierre ?? '', W / 2, H / 2 - 10);
      ctx.fillStyle = '#8fa3b5';
      ctx.font = '24px monospace';
      ctx.fillText('Gracias por jugar.', W / 2, H / 2 + 50);
      ctx.restore();
      // (1 y 2) el brillo azul de Slaimi cruza la pantalla, lejos
      if (this.slaimi) {
        const k = Math.min(1, e / (KC.GRACIAS_S * 0.9));
        const x = W * (1.05 - 1.1 * k), yy = H * 0.72 - 40 * Math.sin(k * Math.PI);
        const g = ctx.createRadialGradient(x, yy, 0, x, yy, 18);
        g.addColorStop(0, `rgba(170,215,255,${0.9 * a})`);
        g.addColorStop(1, 'rgba(120,180,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 20, yy - 20, 40, 40);
      }
    }
    // (2 y 4) la estática; al acabar, su cara un instante
    if (this.estatica > 0) {
      ctx.save();
      ctx.globalAlpha = this.estatica * 0.5;
      for (let k = 0; k < 40; k++) {
        const yy = Math.random() * H, hh = 2 + Math.random() * 10;
        ctx.fillStyle = Math.random() < 0.5 ? '#9aa3ad' : '#20262c';
        ctx.fillRect(0, yy, W, hh);
      }
      if (this.vioCara && this.estatica > 0.6 && cara()) {
        ctx.globalAlpha = (this.estatica - 0.6) * 1.6;
        const im = cara(), s = H / im.naturalHeight;
        ctx.drawImage(im, W / 2 - (im.naturalWidth * s) / 2, 0, im.naturalWidth * s, H);
      }
      ctx.restore();
    }
  }
}
