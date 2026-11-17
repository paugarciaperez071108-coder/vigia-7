// =============================================================
// lore/Patrones.js — (v2.21, el lore, fase C) Los cinco patrones ocultos de las noches de cámaras (lore_vigia7.md,
// apartado 6). Cada uno, en su noche, durante el turno y con los enemigos activos; al acertarlo: un clic y un piloto que
// se enciende en una grabadora pequeña (sin texto) y su cinta oculta queda en Extras > Cintas. Con los cinco, la sexta.
//   1 (Noche 1) pósits de la pared de delante: amarillo, blanco, amarillo (la pista: el pósit de la nota 1).
//   2 (Noche 2 en adelante) `cura03` en la terminal (nota 4; esa nota se encuentra al acabar el turno de la noche 2,
//     por eso vale en cualquier turno desde la 2). No cuenta como comando erróneo.
//   3 (Noche 3, antes de que El Largo rompa las cámaras) la cámara del laboratorio tres veces seguidas: tres clics (o
//     teclas) sobre la CAM 02 en 4 s, sin otra cámara entre medias (nota 2: «Tres comprobaciones por turno»).
//   4 (Noche 4) Criogenia a −31 °C durante 10 s (nota 7). En la noche 4, el panel deja bajar o subir hasta −31 por el
//     lado SEGURO aunque pase del margen de siempre (nunca por el lado peligroso): la dificultad no cambia.
//   5 (Noche 5) el señuelo de audio en el Comedor, el Laboratorio y Criogenia, en ese orden (nota 9).
// Solo en la historia (ni retos ni la noche personalizada). Se guarda en ExtrasProgreso (lore: 'patrones'), aparte de
// la partida. Valores en LORE_PATRONES.
// =============================================================

import { ExtrasProgreso } from '../core/ExtrasProgreso.js';

export const LORE_PATRONES = {
  POSITS: {
    AMARILLO: { x: 1080, y: 464, w: 58, h: 58 },            // (el de OFFICE_NOTES.front)
    BLANCOS: [{ x: 404, y: 246, w: 80, h: 100 }, { x: 1146, y: 596, w: 74, h: 90 }],   // (las dos hojas blancas)
    VENTANA_S: 20,                                           // los tres clics, en menos de esto
  },
  CLAVE: 'cura03',
  LAB: { CAM: 'lab', VECES: 3, VENTANA_S: 4 },
  CRIO: { TEMP: -31, SEGUNDOS: 10, GRACIA_S: 1.5 },          // (si se mueve, hay GRACIA_S para devolverla)
  SENUELO: ['mess', 'lab', 'cryo'],
  PILOTO_S: 4.5,                                             // lo que se ve la grabadora con su piloto
};
const P = LORE_PATRONES;
export const IDS = ['p1', 'p2', 'p3', 'p4', 'p5'];
const NOCHE = { p1: 1, p3: 3, p4: 4, p5: 5 };               // p2: desde la 2

const dentro = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export class Patrones {
  constructor(game) {
    this.g = game;
    this.reinicia();
  }

  /** Al empezar cada noche. */
  reinicia() {
    this.posits = [];
    this.lab = [];
    this.crioT = 0;
    this.crioFuera = 0;
    this.senuelo = [];
    this.piloto = 0;
    this.pilotoDe = null;
  }

  /** ¿Se pueden hacer ahora? (historia, turno de cámaras en marcha) */
  get activos() {
    const g = this.g;
    return g.state === 'night' && !g.reto && !g.esReto?.() && g.nightNumber >= 1 && g.nightNumber <= 7;
  }

  hecho(id) { return ExtrasProgreso.loreTiene('patrones', id); }

  _vale(id) {
    if (!this.activos || this.hecho(id)) return false;
    return id === 'p2' ? this.g.nightNumber >= 2 : this.g.nightNumber === NOCHE[id];
  }

  /** El patrón acertado: clic, piloto y su cinta (y la sexta con los cinco). `forzado`: desde el debug. */
  acierta(id, forzado = false) {
    if (!forzado && !this._vale(id)) return false;
    ExtrasProgreso.loreDa('patrones', id);
    const n = IDS.indexOf(id) + 1;
    ExtrasProgreso.oyeCinta(`oculta${n}`);
    if (IDS.every((p) => this.hecho(p))) ExtrasProgreso.oyeCinta('oculta6');
    this.piloto = P.PILOTO_S;
    this.pilotoDe = n;
    this.g.audio?.clicGrabadora?.() ?? this.g.audio?.keyClick?.();
    return true;
  }

  /** 1: un clic en la pared de delante (con el monitor bajado). */
  clickOficina(x, y) {
    if (!this._vale('p1')) return;
    const t = this.g.clock?.elapsed ?? 0;
    let c = null;
    if (dentro(P.POSITS.AMARILLO, x, y)) c = 'a';
    else if (P.POSITS.BLANCOS.some((r) => dentro(r, x, y))) c = 'b';
    if (!c) return;
    this.posits = [...this.posits, { c, t }].slice(-3).filter((e) => t - e.t <= P.POSITS.VENTANA_S);
    if (this.posits.map((e) => e.c).join('') === 'aba') this.acierta('p1');
  }

  /** 2: un comando de la terminal. true = era la clave (no se imprime nada ni cuenta como erróneo). */
  comando(cmd) {
    if (String(cmd).toLowerCase() !== P.CLAVE) return false;
    if (!this.activos || this.g.nightNumber < 2) return false;
    this.acierta('p2');
    return true;
  }

  /** 3: se ha pulsado una cámara (aunque ya fuera la activa). */
  pulsaCamara(id) {
    if (!this._vale('p3') || this.g.cameras?.mapMode !== 'main') return;
    if (this.g.cameras?.broken?.size) return;              // (El Largo ya las ha roto)
    const t = this.g.clock?.elapsed ?? 0;
    if (id !== P.LAB.CAM) { this.lab = []; return; }
    this.lab = [...this.lab, t].filter((s) => t - s <= P.LAB.VENTANA_S);
    if (this.lab.length >= P.LAB.VECES) this.acierta('p3');
  }

  /** 5: el señuelo de audio en una sala. */
  senueloEn(room) {
    if (!this._vale('p5')) return;
    this.senuelo = [...this.senuelo, room].slice(-P.SENUELO.length);
    if (this.senuelo.join() === P.SENUELO.join()) this.acierta('p5');
  }

  /** Noche 4: hasta dónde deja llegar el panel de Criogenia por el lado seguro (null: lo de siempre). */
  get crioPermite() { return this._vale('p4') ? P.CRIO.TEMP : null; }

  update(dt) {
    if (this.piloto > 0) this.piloto = Math.max(0, this.piloto - dt);
    // 4: −31 °C durante 10 s (con un respiro si la deriva la mueve)
    const cr = this.g.cryo;
    if (!this._vale('p4') || !cr?.enabled) { this.crioT = 0; return; }
    if (cr.temp === P.CRIO.TEMP && cr.ok) {
      this.crioT += dt;
      this.crioFuera = 0;
      if (this.crioT >= P.CRIO.SEGUNDOS) this.acierta('p4');
    } else if (this.crioT > 0) {
      this.crioFuera += dt;
      if (this.crioFuera > P.CRIO.GRACIA_S) this.crioT = 0;
    }
  }

  /** La grabadora pequeña con su piloto (abajo a la izquierda), unos segundos. Sin texto. */
  draw(ctx) {
    if (this.piloto <= 0) return;
    const a = Math.min(1, this.piloto / 0.6, (P.PILOTO_S - this.piloto) / 0.25);
    const x = 26, y = 668, w = 92, h = 54;           // (encima del reactor)
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(18,18,16,0.92)';
    ctx.strokeStyle = 'rgba(160,150,130,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();
    ctx.stroke();
    // la ventanita del casete y sus bobinas
    ctx.strokeStyle = 'rgba(200,190,160,0.6)';
    ctx.strokeRect(x + 10, y + 10, 50, 22);
    for (const cx of [x + 23, x + 47]) {
      ctx.beginPath();
      ctx.arc(cx, y + 21, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    // la rejilla del altavoz
    ctx.fillStyle = 'rgba(200,190,160,0.35)';
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 10 + i * 13, y + 39, 8, 3);
    // el piloto (un parpadeo al encenderse y luego fijo)
    const t = P.PILOTO_S - this.piloto;
    const on = t > 0.35 || Math.floor(t * 16) % 2 === 0;
    ctx.fillStyle = on ? '#ff3b2f' : '#3a1210';
    ctx.shadowColor = '#ff3b2f';
    ctx.shadowBlur = on ? 14 : 0;
    ctx.beginPath();
    ctx.arc(x + 76, y + 21, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
