// =============================================================
// Night5.js — La NOCHE 5 durante el turno de cámaras (v0.46).
// (Valores en NIGHT5, src/night/night5.js. Los enemigos, en
// src/ai/enemies/Errante.js y Dislocado.js.)
//
// - REJILLAS del frente (izquierda → V7, derecha → V6): intactas, con
//   abolladuras (golpes) o rotas (caídas al suelo, el hueco abierto).
//   Se quedan rotas hasta el final (son la salida de la fuga).
// - EVENTOS: a las 2 AM El Dislocado se presenta golpeando las dos
//   rejillas hasta romper una y se asoma por el hueco; a las 4 AM rompe
//   la otra.
// - (v0.53) Intactas o golpeadas, las rejillas se ven como en las demás
//   noches (el render de la oficina; abolladuras, temblor y sonido con cada
//   golpe) y NO se alumbran. ROTAS: el hueco del conducto está a oscuras,
//   haya luz o apagón; ALUMBRARLA: ratón encima (mirando al frente, sin el
//   monitor), y solo entonces se ve el interior y El Dislocado.
// - EL ERRANTE: su estática por el lado de la puerta, su cara en la
//   cámara que se mira (CAM_GRACE s para quitarla), y se le ve en la
//   cámara de su sala (mirarla STARE_TIME s también las apaga). Apagado
//   de todas las cámaras; «resetcam» las repara en REPAIR_TIME s (barra),
//   sin poder usar el monitor mientras tanto.
// - TRIÁNGULOS de los dos: SOLO con las cámaras desactivadas (v0.47); con
//   las cámaras bien hay que buscarlos mirando. El Dislocado: rojo sangre,
//   en su conducto o su rejilla. El Errante: blanco sucio y falla
//   (parpadea a ritmo irregular, a veces sale en una sala falsa o
//   duplicado, y a veces desaparece justo cuando está en una puerta).
// - Dibujo de El Dislocado: renders 3D si existen (assets/n5/indice.json
//   y las poses de cámara pose_dislocado_<conducto>_<id>); si no, un
//   dibujo provisional.
// =============================================================

import { CONFIG } from '../config.js';
import { NIGHT5 } from '../night/night5.js';
import { ROOMS, ROOM_IDS, VENTS, VENT_IDS } from '../world/StationMap.js';
import { drawWarnTriangle, ANCHORS } from '../render/CameraView.js';
import { MINIMAP, miniBox, officeSide } from '../render/MiniMap.js';
import { N5Sounds } from '../audio/N5Sounds.js';
import { drawErranteFace, drawErrante } from '../ending/Night4Dark.js';
import { GRILLE_VENT } from '../ai/enemies/Dislocado.js';
import { colorDe, rgbDe } from '../core/Colores.js';

const E = NIGHT5.ERRANTE;
const D = NIGHT5.DISLOCADO;
const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const rand = ([a, b]) => a + Math.random() * (b - a);
const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Las dos rejillas del render 3D de la pared del frente (assets/salas/office_front)
export const GRILLES = {
  left: { x: 73, y: 357, w: 303, h: 246 },
  right: { x: 1224, y: 357, w: 309, h: 246 },
};
const PAN = { left: -0.75, right: 0.75 };

// --- Arte 3D (opcional): assets/n5/indice.json → { clave: {archivo, x, y, w, h} } ---
const ART = {};
fetch('assets/n5/indice.json').then((r) => (r.ok ? r.json() : {})).then((idx) => {
  for (const [k, d] of Object.entries(idx)) {
    const img = new Image();
    img.onload = () => { ART[k] = { ...d, img }; };
    img.src = `assets/n5/${d.archivo}`;
  }
}).catch(() => {});

function art(ctx, key, alpha = 1) {
  const a = ART[key];
  if (!a) return false;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(a.img, a.x, a.y, a.w, a.h);
  ctx.restore();
  return true;
}

export class Night5 {
  constructor(game) {
    this.g = game;
    this.snd = new N5Sounds(game.audio);
    this.active = false;
    this.reset(false);
    const ev = game.events;
    ev.on('erranteDoor', ({ side }) => this.active && this.snd.errStatic(PAN[side], E.STATIC_VOLUME));
    ev.on('erranteGone', () => this.snd.errStaticStop());
    ev.on('erranteFace', () => {
      if (!this.active) return;
      this.face = { t: 0 };
      this.snd.errBlip(0.25, 0.45);
    });
    ev.on('erranteFaceEnd', () => { this.face = null; });
    ev.on('erranteCams', () => this.active && this.killCams());
    ev.on('dislocadoNoise', ({ dist, side }) => this.active && this.snd.drag(dist, side ? PAN[side] * 0.6 : -0.2));
    ev.on('dislocadoPeek', ({ side }) => {
      if (!this.active) return;
      this.peekT = 0;
      this.snd.drag(0, PAN[side]);
      this.g.audio.lib?.play('criaturas/respiracion', { volume: 0.7, pan: PAN[side], pitch: 0.72 });
    });
    ev.on('dislocadoRetreat', ({ side }) => {
      if (!this.active) return;
      this.snd.drag(1.5, PAN[side] * 0.6);
      this.g.audio.lib?.play('criaturas/grunido', { volume: 0.45, pan: PAN[side], pitch: 0.8, muffle: 0.3 });
    });
  }

  reset(active) {
    this.active = active;
    this.grilles = { left: { dent: 0, broken: false, fall: 0 }, right: { dent: 0, broken: false, fall: 0 } };
    this.event = null;          // { side, hits, next, both, fall, peekIn }
    this.done2 = false;
    this.done4 = false;
    this.pending4 = false;
    this.peekCue = 0;            // s hasta el siguiente aviso mientras está asomado
    this.face = null;
    this.repair = null;         // { t }
    this.camsDead = false;
    this.openT = 0;
    this.peekT = 0;
    this.time = 0;
    this.tri = { on: true, t: 0.6, fake: null, ghost: null, jx: 0, jy: 0 };
    this.reveal = { left: 0, right: 0 };   // 0 = a oscuras, 1 = alumbrada (ratón encima)
    this.seen = { room: null, spot: 0, cut: 0 }; // El Errante en su cámara
    this.snd?.stop();
  }

  get ai() {
    return this.g.ai;
  }

  /** Para la IA (world.n5). */
  world() {
    return { grilles: this.grilles, lit: (side) => this.lit(side), dark: () => this.g.blackout.active };
  }

  /** ¿Se está alumbrando esta rejilla (ratón encima, mirando al frente)? */
  lit(side) {
    const g = this.g;
    // (v0.53) Solo las rejillas ROTAS: una intacta o golpeada no se alumbra
    if (!this.grilles[side].broken) return false;
    if (g.cameras.open || g.lookBack.moving || g.lookBack.face !== 'front') return false;
    const p = g.officeView.pan;
    const x = (g.mouse.x - 800 - p.x) / p.s + 800;
    const y = (g.mouse.y - 450 - p.y) / p.s + 450;
    const r = GRILLES[side];
    return inside({ x: r.x - 20, y: r.y - 20, w: r.w + 40, h: r.h + 40 }, x, y);
  }

  // --- Horas ---
  onHour(h) {
    if (!this.active) return;
    // Más agresivo según avanza la noche (LEVEL: 2 AM → 6 AM)
    const dis = this.ai.dislocado;
    if (dis?.level > 0 && h >= D.FROM_HOUR) {
      const k = Math.min(1, (h - D.FROM_HOUR) / (6 - D.FROM_HOUR));
      dis.setLevel(Math.round(D.LEVEL[0] + (D.LEVEL[1] - D.LEVEL[0]) * k));
    }
    if (h === D.FROM_HOUR && !this.done2) this.startEvent(Math.random() < 0.5 ? 'left' : 'right', true);
    // 4 AM: si está asomado (o a punto) por la otra, espera a que se retire
    if (h === 4 && !this.done4) this.pending4 = true;
  }

  /** El evento de las 4 AM, en cuanto El Dislocado no esté en una rejilla. */
  _tryEvent4() {
    if (!this.pending4) return;
    const dis = this.ai.dislocado;
    if (['peek', 'grille', 'event'].includes(dis?.state) || this.event) return;
    this.pending4 = false;
    const other = ['left', 'right'].find((s) => !this.grilles[s].broken);
    if (other) this.startEvent(other, false);
  }

  /** El Dislocado golpea las rejillas hasta romper la de `side`. */
  startEvent(side, both) {
    const dis = this.ai.dislocado;
    if (dis.level <= 0 || this.g.n4dbg?.off?.has('dislocado')) {
      // (sin El Dislocado, la rejilla se rompe igual: la salida de la fuga)
      this.grilles[side].broken = true;
      return;
    }
    if (both) this.done2 = true;
    else this.done4 = true;
    dis.state = 'event';
    dis.room = GRILLE_VENT[side];
    dis.side = side;
    this.event = { side, hits: 0, next: 0.6, both: both ? D.EVENT.BOTH_FIRST : 0, fall: -1, peekIn: -1 };
  }

  /** Desactiva todas las cámaras (El Errante). */
  killCams() {
    const c = this.g.cameras;
    for (const id of [...ROOM_IDS, ...VENT_IDS]) c.broken.add(id);
    c.warnings = true;
    c.warnT = 0;
    c.switchStatic = 1.2;
    this.camsDead = true;
    this.face = null;
    this.g.audio.lib?.play('ambiente/interferencia', { volume: 0.9 });
    this.snd.errBlip(0.6, 0.7);
  }

  /** «resetcam» en la consola. Devuelve el texto de respuesta. */
  startRepair() {
    if (this.repair) return 'Error: reparacion en curso';
    if (!this.camsDead) return 'Error: las camaras funcionan';
    this.repair = { t: 0 };
    this.g.cameras.setEnabled(false);
    return 'Reinicio de camaras iniciado';
  }

  update(dt) {
    if (!this.active) return;
    this.time += dt;
    const g = this.g;
    const c = g.cameras;
    this.openT = c.open && c.fullyOpen ? this.openT + dt : 0;
    c.openTime = this.openT;
    if (this.face) this.face.t += dt;
    this.peekT += dt;
    // Reparación de las cámaras
    if (this.repair) {
      this.repair.t += dt;
      if (Math.random() < dt * 3) g.audio.lib?.play('ambiente/chispazo', { volume: 0.08, muffle: 0.5 });
      if (this.repair.t >= E.REPAIR_TIME) {
        this.repair = null;
        this.camsDead = false;
        c.broken.clear();
        c.warnings = false;
        c.setEnabled(true);
        g.terminal.print?.('Camaras en linea... OK');
        g.audio.powerUp?.();
      }
    }
    this._tryEvent4();
    // Asomado: su respiración y su arrastre se repiten, cada vez más fuertes,
    // para que siempre haya aviso (también con el monitor subido)
    const dis = this.ai.dislocado;
    if (dis?.state === 'peek') {
      this.peekCue -= dt;
      if (this.peekCue <= 0) {
        this.peekCue = rand(D.PEEK_CUE);
        const k = Math.min(1, dis.attackT / D.ATTACK_TIME);
        this.g.audio.lib?.play('criaturas/respiracion', { volume: 0.45 + 0.45 * k, pan: PAN[dis.side], pitch: 0.72 });
        this.snd.drag(0.4 * (1 - k), PAN[dis.side]);
      }
    } else this.peekCue = rand(D.PEEK_CUE);
    // Evento de las rejillas
    const ev = this.event;
    if (ev) {
      if (ev.fall >= 0) {
        ev.fall += dt;
        this.grilles[ev.side].fall = Math.min(1, ev.fall / D.EVENT.FALL_TIME);
        if (ev.fall >= D.EVENT.FALL_TIME && ev.peekIn < 0) {
          ev.peekIn = D.EVENT.PEEK_AFTER;
          this.grilles[ev.side].broken = true;
          this.snd.grilleFall(PAN[ev.side]);
        }
        if (ev.peekIn >= 0) {
          ev.peekIn -= dt;
          if (ev.peekIn <= 0) {
            this.event = null;
            this.ai.dislocado.peek(g.world, ev.side);
          }
        }
      } else {
        ev.next -= dt;
        if (ev.next <= 0) {
          ev.next = rand(D.EVENT.HIT_EVERY);
          // Los primeros golpes (2 AM) van a las dos rejillas
          const side = ev.both > 0 ? (ev.both % 2 ? 'left' : 'right') : ev.side;
          if (ev.both > 0) ev.both--;
          else ev.hits++;
          const gr = this.grilles[side];
          gr.dent = Math.min(D.EVENT.HITS, gr.dent + 1);
          gr.shake = 0.35;
          this.snd.grilleHit(PAN[side], ev.hits >= D.EVENT.HITS - 1);
          c.glitchIfWatching(['v6', 'v7'], 0.5);
          if (ev.hits >= D.EVENT.HITS) ev.fall = 0;
        }
      }
    }
    for (const s of ['left', 'right']) {
      this.grilles[s].shake = Math.max(0, (this.grilles[s].shake ?? 0) - dt);
      // Se aclara poco a poco con el ratón encima y vuelve a oscurecerse
      this.reveal[s] += ((this.lit(s) ? 1 : 0) - this.reveal[s]) * Math.min(1, dt * D.LIT_SPEED);
    }
    this._updateSeen(dt);
    // Triángulo de El Errante: fallos
    this._updateTri(dt);
  }

  /** El Errante en su sala: a veces salta a otro hueco entre fotogramas. */
  _updateSeen(dt) {
    const err = this.ai.errante;
    const s = this.seen;
    s.cut = Math.max(0, s.cut - dt);
    const room = err?.level > 0 && err.state === 'idle' && ROOMS[err.room] ? err.room : null;
    if (room !== s.room) {
      s.room = room;
      s.spot = Math.floor(Math.random() * 3);
    } else if (room && Math.random() < dt * E.SEEN_JUMP) {
      const n = (ANCHORS[room] ?? ANCHORS.lab).length;
      s.spot = (s.spot + 1 + Math.floor(Math.random() * (n - 1))) % n;
      s.cut = 0.12;
      if (this.g.cameras.open && this.g.cameras.active === room) this.snd.errBlip(0, 0.18);
    }
  }

  _updateTri(dt) {
    const t = this.tri;
    t.t -= dt;
    t.jx = (Math.random() - 0.5) * 4;
    t.jy = (Math.random() - 0.5) * 3;
    if (t.t <= 0) {
      t.on = !t.on;
      t.t = rand(t.on ? E.TRI_ON : E.TRI_OFF);
      if (t.on) {
        t.fake = Math.random() < E.TRI_FAKE ? ROOM_IDS[Math.floor(Math.random() * ROOM_IDS.length)] : null;
        t.ghost = Math.random() < E.TRI_SPLIT ? ROOM_IDS[Math.floor(Math.random() * ROOM_IDS.length)] : null;
        // Cuando está en una puerta, a veces desaparece justo entonces
        const err = this.ai.errante;
        if (err?.state === 'door' && Math.random() < E.TRI_HIDE_NEAR) t.on = false;
      }
    }
  }

  // ---------------------------------------------------------------
  // Dibujo en la oficina (pared del frente, dentro del movimiento de la vista)
  // ---------------------------------------------------------------
  drawFront(ctx) {
    if (!this.active) return;
    const dis = this.ai.dislocado;
    const dark = this.g.blackout.active;
    for (const side of ['left', 'right']) {
      const gr = this.grilles[side];
      const r = GRILLES[side];
      const k = this.reveal[side];
      // (v0.53) Intacta: la del render de la oficina, como en las demás noches
      // (ni se oscurece ni se alumbra; el apagón ya la deja a oscuras)
      if (!gr.broken && gr.fall <= 0 && gr.dent <= 0) continue;
      ctx.save();
      if (gr.shake > 0) ctx.translate((Math.random() - 0.5) * 12 * gr.shake, (Math.random() - 0.5) * 8 * gr.shake);
      // Las abolladuras, siempre dentro del marco; en el apagón, solo la
      // rejilla (el suelo de debajo queda negro como el resto)
      // (v1.15: en la noche 7 nada se recorta al marco: las capas del render ya encajan, sin borde)
      const enMarco = !this.g.n7?.active && (dark || (!gr.broken && gr.fall <= 0));
      if (enMarco) {
        ctx.beginPath();
        ctx.rect(r.x - 6, r.y - 6, r.w + 12, r.h + 12);
        ctx.clip();
      }
      if (gr.broken) {
        // (v1.14) Noche 7: el hueco, la rejilla del suelo y los trozos son parte del render de la oficina
        // (OficinaV2: las capas de la rejilla rota, con la luz del estado): aquí no se pega nada encima
        const n7 = !!this.g.n7?.active;
        if (!n7 && !art(ctx, `rejilla_${side}_rota`)) this._holePlaceholder(ctx, r);
        // (v1.15) Noche 7: al alumbrarlo, el conducto alumbrado de verdad (render), no un brillo encima
        if (n7) this.g.ofv2?.drawRejillaLuz?.(ctx, side, k);
        // El Dislocado asomado por el hueco (recortado al hueco: nada cuelga fuera; en la noche 7, con el
        // borde fundido en la oscuridad del conducto: nunca un recuadro)
        if (dis?.state === 'peek' && dis.side === side) {
          if (n7) this._drawPeekSuave(ctx, side, r);
          else {
            ctx.save();
            ctx.beginPath();
            ctx.rect(r.x, r.y, r.w, r.h);
            ctx.clip();
            this._drawPeek(ctx, side, r);
            ctx.restore();
          }
        }
      } else if (gr.fall > 0) {
        // Cae: con los renders, la última abolladura y luego ya en el suelo
        if (!art(ctx, gr.fall < 0.5 ? `rejilla_${side}_5` : `rejilla_${side}_rota`)) {
          this._holePlaceholder(ctx, r);
          this._fallingGrille(ctx, r, gr.fall);
        }
      } else {
        const fase = Math.min(5, Math.ceil(gr.dent / D.EVENT.HITS * 5));
        if (!art(ctx, `rejilla_${side}_${fase}`)) this._dentPlaceholder(ctx, r, gr.dent / D.EVENT.HITS);
      }
      ctx.restore();
      // Golpeada o cayendo: con la luz de la pared (en el apagón, a oscuras como ella)
      if (!gr.broken) {
        if (dark) {
          ctx.fillStyle = `rgba(0,0,0,${D.BLACKOUT_DARK})`;
          ctx.fillRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12);
        }
        continue;
      }
      // (v1.14) Noche 7: el hueco del render ya es oscuro (con su profundidad, las brasas y el humo): sin la
      // capa de oscuridad encima (se veía como un rectángulo negro); a El Dislocado solo se le ve alumbrado
      if (!this.g.n7?.active) this._grilleDark(ctx, r, k, dark);
      // La luz sobre la rejilla (al alumbrarla; en la noche 7 ya la pone el render)
      if (k > 0.02 && !(this.g.n7?.active && this.g.ofv2?.tieneRejilla?.(side))) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;
        const lg = ctx.createRadialGradient(cx, cy, 10, cx, cy, r.w * 0.75);
        lg.addColorStop(0, `rgba(255,236,190,${0.3 * k})`);
        lg.addColorStop(1, 'rgba(255,236,190,0)');
        ctx.fillStyle = lg;
        ctx.fillRect(r.x - 80, r.y - 80, r.w + 160, r.h + 160);
        ctx.restore();
      }
    }
  }

  /** Rejilla ROTA: el hueco del conducto, a oscuras salvo con el ratón encima
   *  (igual con luz y en el apagón). En el apagón el marco, como la pared. */
  _grilleDark(ctx, r, k, dark) {
    const d = (a) => a + (D.LIT_DARK - a) * k;
    ctx.save();
    if (dark) {
      ctx.filter = 'blur(8px)';
      ctx.fillStyle = `rgba(0,0,0,${d(D.BLACKOUT_DARK)})`;
      ctx.fillRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12);
      ctx.filter = 'none';
    }
    const base = dark ? d(D.BLACKOUT_DARK) : 0;
    const hole = 1 - (1 - d(D.HOLE_DARK)) / (1 - base);
    if (hole > 0) {
      // (v1.12, el usuario: «nada de rectángulos oscuros planos») La oscuridad del conducto con el
      // borde difuminado: se ven el marco y el canto del hueco del render; el fondo, negro
      ctx.filter = 'blur(14px)';
      ctx.fillStyle = `rgba(0,0,0,${hole})`;
      ctx.fillRect(r.x + 30, r.y + 28, r.w - 60, r.h - 56);
      ctx.filter = 'none';
    }
    ctx.restore();
  }

  _holePlaceholder(ctx, r) {
    ctx.save();
    const g = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h * 0.55, 10, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.7);
    g.addColorStop(0, 'rgba(0,0,0,0.98)');
    g.addColorStop(1, 'rgba(8,10,12,0.92)');
    ctx.fillStyle = g;
    ctx.fillRect(r.x + 8, r.y + 8, r.w - 16, r.h - 16);
    ctx.strokeStyle = '#3a4048';
    ctx.lineWidth = 9;
    ctx.strokeRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8);
    // Restos de lamas arrancadas en el marco
    ctx.strokeStyle = '#5a636c';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(r.x + 10, r.y + 26);
    ctx.lineTo(r.x + 60, r.y + 38);
    ctx.moveTo(r.x + r.w - 12, r.y + r.h - 30);
    ctx.lineTo(r.x + r.w - 70, r.y + r.h - 16);
    ctx.stroke();
    ctx.restore();
    // La rejilla en el suelo, debajo
    if (!art(ctx, `suelo_${r === GRILLES.left ? 'left' : 'right'}`)) {
      ctx.save();
      ctx.translate(r.x + r.w / 2, 720);
      ctx.transform(1, 0, -0.5, 0.35, 0, 0);
      ctx.fillStyle = '#20262c';
      ctx.fillRect(-r.w / 2, -r.h / 2, r.w, r.h);
      ctx.strokeStyle = '#46505a';
      ctx.lineWidth = 6;
      for (let y = -r.h / 2 + 14; y < r.h / 2; y += 20) {
        ctx.beginPath();
        ctx.moveTo(-r.w / 2 + 8, y);
        ctx.lineTo(r.w / 2 - 8, y + (y % 40 ? 6 : -4));
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  _fallingGrille(ctx, r, k) {
    ctx.save();
    const e = k * k;
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2 + e * 260);
    ctx.rotate(e * 0.9 * (r === GRILLES.left ? 1 : -1));
    ctx.fillStyle = '#262c33';
    ctx.fillRect(-r.w / 2, -r.h / 2, r.w, r.h);
    ctx.strokeStyle = '#4e5862';
    ctx.lineWidth = 6;
    for (let y = -r.h / 2 + 14; y < r.h / 2; y += 20) {
      ctx.beginPath();
      ctx.moveTo(-r.w / 2 + 8, y);
      ctx.lineTo(r.w / 2 - 8, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  _dentPlaceholder(ctx, r, k) {
    // Abolladura hacia dentro: las lamas se doblan desde el centro
    ctx.save();
    const cx = r.x + r.w * 0.5;
    const cy = r.y + r.h * 0.55;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r.w * 0.45);
    g.addColorStop(0, `rgba(0,0,0,${0.55 * k})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = `rgba(150,160,170,${0.5 + 0.4 * k})`;
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const y = r.y + 30 + i * 34;
      ctx.beginPath();
      ctx.moveTo(r.x + 14, y);
      ctx.quadraticCurveTo(cx, y + 34 * k * (1 - Math.abs(i - 2.5) / 3), r.x + r.w - 14, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** (v1.14) El asomado dentro del hueco con el borde difuminado (se pinta aparte y se funde hacia los
   * bordes del hueco: así no se ve el recuadro de su imagen sobre la oficina de la noche 7). */
  _drawPeekSuave(ctx, side, r) {
    // (la mecánica de la noche 5: en la oscuridad del hueco solo se le ve con el ratón encima)
    const luz = Math.max(0.06, this.reveal[side] ?? 0);
    const c = (this._peekCanvas ??= document.createElement('canvas'));
    c.width = r.w;
    c.height = r.h;
    const x = c.getContext('2d');
    x.clearRect(0, 0, r.w, r.h);
    x.save();
    x.translate(-r.x, -r.y);
    this._drawPeek(x, side, r);
    x.restore();
    x.globalCompositeOperation = 'destination-in';
    x.filter = 'blur(16px)';
    x.fillStyle = '#000';
    x.fillRect(34, 30, r.w - 68, r.h - 60);
    x.filter = 'none';
    x.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.globalAlpha = luz;
    ctx.drawImage(c, r.x, r.y);
    ctx.restore();
  }

  /** El Dislocado asomado: primero los dedos, luego la cabeza ladeada. */
  _drawPeek(ctx, side, r) {
    const t = this.peekT;
    const dis = this.ai.dislocado;
    const luz = dis.lit / D.LIGHT_TIME;
    // Se encoge y retrocede mientras se le alumbra
    const pose = t < 0.9 ? 'dedos' : luz > 0.55 ? 'atras' : 'cabeza';
    if (art(ctx, `peek_${side}_${pose}`)) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y - 40, r.w, r.h + 60);
    ctx.clip();
    const back = luz * 40;
    // Intestinos colgando en la oscuridad del fondo
    ctx.strokeStyle = 'rgba(70,20,24,0.8)';
    ctx.lineWidth = 9;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(r.x + r.w * (0.35 + i * 0.12), r.y + r.h * 0.45);
      ctx.bezierCurveTo(r.x + r.w * (0.3 + i * 0.15), r.y + r.h * 0.8, r.x + r.w * (0.45 + i * 0.1), r.y + r.h * 0.95, r.x + r.w * (0.4 + i * 0.12), r.y + r.h);
      ctx.stroke();
    }
    // Dedos agarrando el borde de abajo
    ctx.fillStyle = '#c9b8a6';
    for (let i = 0; i < 4; i++) {
      const fx = r.x + r.w * 0.28 + i * 26 + (side === 'left' ? 0 : 40);
      ctx.fillRect(fx, r.y + r.h - 34 + Math.sin(t * 9 + i) * 2, 12, 40);
    }
    if (pose !== 'dedos') {
      // La cabeza ladeada, con la mandíbula desencajada
      const hx = r.x + r.w * 0.5;
      const hy = r.y + r.h * 0.48 + back;
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(side === 'left' ? 0.9 : -0.9);
      ctx.fillStyle = '#d8c7b4';
      ctx.beginPath();
      ctx.ellipse(0, 0, 46, 58, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0a0606';
      ctx.beginPath();
      ctx.ellipse(-17, -10, 11, 14, 0, 0, Math.PI * 2);
      ctx.ellipse(17, -10, 11, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2efe6';
      ctx.beginPath();
      ctx.arc(-17, -10, 3, 0, Math.PI * 2);
      ctx.arc(17, -10, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a0607';
      ctx.beginPath();
      ctx.ellipse(8, 38, 16, 30, 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------
  // Cámaras
  // ---------------------------------------------------------------
  /** El Dislocado en la cámara de un conducto (CameraView). */
  drawVent(ctx, id) {
    const dis = this.ai.dislocado;
    if (!this.active || !dis || !dis.room || dis.room !== id || !['vent', 'grille', 'event'].includes(dis.state)) return;
    const poses = this.g.cameraView.poses;
    if (poses.has('dislocado', id)) {
      const prog = { v4: 0.15, v5: 0.15, v2: 0.35, v3: 0.35, v1: 0.6, v6: 0.9, v7: 0.9 }[id] ?? 0.5;
      const pose = poses.pick('dislocado', id, prog, dis.state !== 'vent' ? 'cerca' : null);
      poses.draw(ctx, 'dislocado', id, pose, this.time);
      return;
    }
    // Provisional: una silueta arrastrándose por el suelo del conducto
    const near = dis.state === 'vent' ? 0.4 : 0.9;
    ctx.save();
    ctx.translate(800, 560 + 160 * near);
    ctx.scale(0.6 + 0.8 * near, 0.6 + 0.8 * near);
    ctx.fillStyle = 'rgba(20,14,12,0.92)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 120, 55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -70, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,14,12,0.92)';
    ctx.lineWidth = 16;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 80, -20);
      ctx.lineTo(s * 170, -90);
      ctx.lineTo(s * 220, 40);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(60,18,20,0.8)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(0, 40);
    ctx.bezierCurveTo(-30, 120, 40, 160, -10, 240);
    ctx.stroke();
    ctx.restore();
  }

  /** El Errante en la cámara de su sala (CameraView, con las criaturas). */
  drawRoom(ctx, room) {
    const s = this.seen;
    if (!this.active || s.room !== room) return;
    const spots = ANCHORS[room] ?? ANCHORS.lab;
    const [x, y, h] = spots[s.spot % spots.length];
    // Al saltar de hueco, un corte de imagen
    if (s.cut > 0) {
      this.g.effects.static(ctx, 0.35);
      this._marcaInterferencia(ctx, 1);
      return;
    }
    drawErrante(ctx, x, y, h * 1.25, { variant: 'frente', dark: E.SEEN_DARK });
    // Cuanto más tiempo se le mira, peor la señal
    const st = (this.ai.errante.stare ?? 0) / E.STARE_TIME;
    if (st > 0.3) {
      this.g.effects.static(ctx, 0.1 + 0.35 * (st - 0.3));
      this._marcaInterferencia(ctx, st);
    }
  }

  /**
   * v0.58: la estática que causa El Errante lleva su marca (tinte violeta y
   * «INTERFERENCIA»): así no parece un fallo del juego.
   */
  _marcaInterferencia(ctx, k) {
    ctx.save();
    ctx.fillStyle = `rgba(${rgbDe('errante')},${0.12 + 0.18 * Math.min(1, k)})`;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    ctx.font = 'bold 30px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = colorDe('errante');
    if (Math.floor(this.time * 4) % 2 === 0) ctx.fillText('INTERFERENCIA', 40, 130);
    ctx.restore();
  }

  /**
   * v0.58: entre la interferencia de las cámaras (CameraView._drawInterferencia),
   * de vez en cuando se le ven los ojos o la silueta, apenas un momento.
   */
  drawGlimpse(ctx, room, time) {
    const ciclo = 6.5;
    const fase = (time + (room.length * 1.7)) % ciclo;
    if (fase > 0.7) return;
    const k = Math.sin((fase / 0.7) * Math.PI);
    ctx.save();
    if (Math.floor(time / ciclo) % 2 === 0) drawErranteFace(ctx, 0.28 * k, 1.05);
    else {
      const spots = ANCHORS[room] ?? ANCHORS.lab;
      const [x, y, h] = spots[0];
      drawErrante(ctx, x, y, h * 1.25, { variant: 'frente', alpha: 0.45 * k, dark: 0.6 });
    }
    ctx.restore();
  }

  /** La cara de El Errante ocupando la imagen (CameraView, encima de todo). */
  drawCamOverlay(ctx) {
    if (!this.active || !this.face) return;
    const k = Math.min(1, this.face.t / 0.25);
    drawErranteFace(ctx, 0.35 + 0.6 * k, 1 + 0.08 * k);
    this.g.effects.static(ctx, 0.12 + 0.25 * Math.random());
  }

  /** Triángulos de El Errante y El Dislocado en el plano ('main' o 'vent'). */
  drawMap(ctx, mode) {
    // Solo con las cámaras desactivadas (con ellas bien, hay que buscarlos)
    if (!this.active || !this.camsDead) return;
    const dis = this.ai.dislocado;
    const pulse = 0.75 + 0.25 * Math.sin(this.time * 7);
    if (dis?.room && dis.level > 0 && dis.state !== 'away' && dis.state !== 'off') {
      if (mode === 'vent' && VENTS[dis.room]) {
        const r = miniBox(VENTS[dis.room].mapRect, MINIMAP.BOX, MINIMAP.VENT);
        drawWarnTriangle(ctx, r.x + 3, r.y - 4, D.COLOR, pulse, 0.7);
      } else if (mode === 'main' && (dis.state === 'peek' || dis.state === 'grille' || dis.state === 'event')) {
        // En una rejilla de la oficina: junto al recuadro TÚ
        const p = officeSide('front', -9);
        drawWarnTriangle(ctx, p.x + (dis.side === 'left' ? -12 : 12), p.y, D.COLOR, pulse, 0.7);
      }
    }
    const err = this.ai.errante;
    if (mode === 'main' && err?.level > 0 && err.room) {
      const t = this.tri;
      if (!t.on) return;
      const where = (id) => {
        if (ROOMS[id]) { const b = miniBox(ROOMS[id].mapRect); return { x: b.x + 3, y: b.y + b.h + 4 }; }
        if (id === 'left_door') return officeSide('left', 8);
        if (id === 'right_door') return officeSide('right', 8);
        return null;
      };
      const p = where(t.fake ?? err.room);
      if (p) this._glitchTri(ctx, p.x + t.jx, p.y + t.jy);
      if (t.ghost) {
        const q = where(t.ghost);
        if (q) this._glitchTri(ctx, q.x - t.jx, q.y + t.jy, 0.45);
      }
    }
  }

  _glitchTri(ctx, x, y, alpha = 1) {
    // Separación de color (rojo / cian) y el triángulo blanco sucio encima
    drawWarnTriangle(ctx, x - 2, y, '#ff3048', 0.35 * alpha, 0.7);
    drawWarnTriangle(ctx, x + 2, y, '#30fff0', 0.35 * alpha, 0.7);
    drawWarnTriangle(ctx, x, y, E.COLOR, (0.6 + 0.4 * Math.random()) * alpha, 0.7);
  }

  // ---------------------------------------------------------------
  // HUD: la barra de «resetcam» y el aviso de cámaras desactivadas
  // ---------------------------------------------------------------
  drawHud(ctx) {
    if (!this.active) return;
    if (this.repair) {
      const k = Math.min(1, this.repair.t / E.REPAIR_TIME);
      const x = 520;
      const y = 820;
      ctx.save();
      ctx.fillStyle = 'rgba(5,10,8,0.85)';
      ctx.fillRect(x - 10, y - 34, 580, 66);
      ctx.strokeStyle = 'rgba(125,255,176,0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, 560, 20);
      ctx.fillStyle = 'rgba(125,255,176,0.85)';
      ctx.fillRect(x + 3, y + 3, (560 - 6) * k, 14);
      ctx.font = 'bold 18px "Courier New", monospace';
      ctx.fillStyle = '#bfffd6';
      ctx.textAlign = 'left';
      ctx.fillText(`RESETCAM  ${Math.floor(k * 100)}%   (camaras sin servicio)`, x, y - 10);
      ctx.restore();
    }
  }

  warnings() {
    const out = [];
    if (!this.active) return out;
    // (v0.53: sin decir qué escribir; el comando se aprende con las notas)
    if (this.camsDead && !this.repair) out.push('INTERFERENCIA: camaras sin imagen');   // v0.58
    return out;
  }
}
