// =============================================================
// Night6.js — NOCHE 6, FASES 3 y 4: la vuelta a la oficina y el turno de
// 12 a 6 (v0.74–v0.75). Valores en NIGHT6.VUELTA y NIGHT6.TURNO.
//
// FASE 3 · Slaimi según la noche 5 (se nota nada más volver):
//   - salvado (flag slaimiTaquilla): está en la oficina, con su brillo, y
//     AVISA con un «pip» (por su lado) cuando un enemigo llega a una puerta;
//   - congelado (slaimiCongelado): junto al pasillo central, metido en
//     hielo y con la luz apagándose; no ayuda. De vez en cuando cruje el
//     hielo, y suena parecido a un enemigo;
//   - si no se salvó en la noche 4: no está (decisión del usuario).
//   La oficina conserva la escarcha de la fuga, ya medio fundida.
//
// FASE 4 · el turno (la noche más difícil): enemigos más rápidos y con
// menos margen (NIGHT6.TURNO.AGGRO); los mismos que la noche 5, El Largo
// incluido. DESDE LA v0.74 NO DESAPARECE NADIE (NIGHT6.TURNO.DESAPARECEN
// vacío; mueren todos en el final). Lo de abajo queda por si se usa:
// desde las 2 AM, El Insecto, El
// Congelado y El Espécimen DESAPARECEN uno a uno, a horas distintas y en
// orden al azar: su triángulo se va del plano, en su última cámara se oye
// una pelea y queda un rastro (sangre, la cámara caída o un trozo de él).
// Con cada desaparición, El Errante y El Dislocado van a más. Todo aviso
// queda en la terminal. Las cámaras con rastro y dónde murió cada uno se
// guardan para la noche 7 (n6cadaveres; el final de la Fase 5 los deja allí).
// =============================================================

import { CONFIG } from '../config.js';
import { NIGHT6 } from '../night/night6.js';
import { ROOMS, VENTS } from '../world/StationMap.js';
import { drawSlaimi } from './Slaimi.js';

const V = NIGHT6.VUELTA;
const T = NIGHT6.TURNO;
const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const rand = ([a, b]) => a + Math.random() * (b - a);
const camDe = (room) => (ROOMS[room] ? `CAM ${ROOMS[room].cam}` : VENTS[room]?.cam ?? room);
const NOMBRE = { insecto: 'El Insecto', frozen: 'El Congelado', specimen: 'El Espécimen', largo: 'El Largo' };
// Dónde se dibuja Slaimi congelado: junto al pasillo central (pared de atrás)
const HIELO = { x: 1210, y: 830, size: 170 };

export class Night6 {
  constructor(game) {
    this.g = game;
    this.active = false;
    game.events.on('enemyAtDoor', ({ side }) => this._aviso(side));
    game.events.on('frozenPuerta', (e) => this._aviso(e?.side));
  }

  /** slaimi: 'salvado' | 'congelado' | null. */
  reset(active, slaimi = null) {
    this.active = active;
    this.slaimi = slaimi;
    this.hieloIn = rand(V.HIELO_EVERY);
    this.desaparecidos = [];       // [{ id, room, rastro, t }]
    this.pendientes = [];
    this.lucha = null;             // { room, t, sonidos }
    this.time = 0;
    if (!active) return;
    const orden = [...T.DESAPARECEN].sort(() => Math.random() - 0.5);
    const rastros = ['sangre', 'camara', 'trozo'].sort(() => Math.random() - 0.5);
    this.pendientes = orden.map((id, i) => ({
      id, hora: T.HORAS[i] + (Math.random() * 2 - 1) * T.HORA_VAR, rastro: rastros[i], espera: 0,
    }));
  }

  get ai() {
    return this.g.ai;
  }

  // --- Slaimi ----------------------------------------------------------------
  _aviso(side) {
    if (!this.active || this.slaimi !== 'salvado' || !side || this.g.state !== 'night') return;
    const pan = side === 'left' ? -0.7 : side === 'right' ? 0.7 : 0;
    this.g.audio.lib?.play('n6/slaimi_aviso', { volume: V.SLAIMI_PIP, pan });
    this.g.alerta?.(`SLAIMI: ALGO EN LA PUERTA ${side === 'left' ? 'IZQUIERDA' : 'DERECHA'}`);
  }

  // --- Cada fotograma ---------------------------------------------------------
  update(dt) {
    if (!this.active) return;
    this.time += dt;
    // Slaimi congelado: el hielo cruje de vez en cuando (desde atrás)
    if (this.slaimi === 'congelado') {
      this.hieloIn -= dt;
      if (this.hieloIn <= 0) {
        this.hieloIn = rand(V.HIELO_EVERY);
        this.g.audio.lib?.play('congelado/hielo', { volume: 0.5, muffle: this.g.lookBack.face === 'back' ? 0 : 0.45 });
      }
    }
    // Las desapariciones
    const hora = this.g.clock.elapsed / CONFIG.SECONDS_PER_HOUR;
    for (const p of [...this.pendientes]) {
      if (hora < p.hora) continue;
      p.espera += dt;
      if (this._libre(p.id) || (p.espera > T.ESPERA_MAX && !this._enPuerta(p.id)) || hora >= T.ULTIMA_HORA) {
        this.pendientes.splice(this.pendientes.indexOf(p), 1);
        this._desaparece(p);
      }
    }
    // La pelea en su última cámara
    if (this.lucha) {
      const l = this.lucha;
      l.t += dt;
      while (l.sonidos.length && l.sonidos[0][0] <= l.t) {
        const [, clave, vol] = l.sonidos.shift();
        const mirando = this.g.cameras.open && this.g.cameras.current === l.room;
        this.g.audio.lib?.play(clave, { volume: vol * (mirando ? 1 : 0.45), muffle: mirando ? 0 : 0.6, radio: mirando });
      }
      if (l.t >= T.PELEA + 1.5) this.lucha = null;
    }
  }

  /** ¿Se le puede quitar ya, sin que esté atacando? */
  _libre(id) {
    const e = this.ai[id];
    if (!e) return true;
    if (id === 'frozen') return e.state === 'asleep' || e.state === 'warning';
    if (id === 'insecto') return e.state === 'away' || (e.state === 'vent' && !['v6', 'v7'].includes(e.room));
    return !e.atDoor;
  }

  _enPuerta(id) {
    const e = this.ai[id];
    return !!(e?.atDoor || e?.puerta);
  }

  _desaparece(p) {
    const g = this.g;
    const e = this.ai[p.id];
    let room = e?.room ?? null;
    if (p.id === 'frozen') {
      room = 'cryo';
      g.cryo.enabled = false;
      g.events.emit('cryoAlarm', { on: false });
      e.state = 'escaped';           // (la cápsula, vacía y rota)
      e.n6Fuera = true;              // (sin el aviso de «algo corre hacia aquí»: ya no está)
      e.room = null;
      e.puerta = null;
    } else if (p.id === 'specimen') {
      room = room && ROOMS[room] ? room : 'lab';
      e.room = null;
      e.wallStage = Math.max(e.wallStage ?? 0, CONFIG.WALL_STAGES);
    } else {
      room = room && VENTS[room] ? room : 'v1';
      e.room = null;
      e.state = 'away';
    }
    if (e) {
      e.setLevel?.(0);
      e.update = () => {};
      this.ai.enemies = this.ai.enemies.filter((x) => x !== e);
    }
    this.desaparecidos.push({ id: p.id, room, rastro: p.rastro, t: this.time });
    // Ruido de pelea: El Errante y El Dislocado lo cazan (gritos, golpes, arrastre)
    const s = [[0, 'mira/zumbido', 0.5], [0.3, 'criaturas/chillido', 0.9], [0.7, 'largo/golpe', 0.8], [1.1, 'n6/dislocado_arrastre', 0.7],
      [1.5, 'metal/golpe_pared', 0.8], [1.9, 'criaturas/chillido', 0.7], [2.3, 'caidas/caja', 0.7], [2.8, 'largo/golpe', 0.6],
      [3.4, 'criaturas/grunido', 0.5], [4.1, 'ambiente/goteo', 0.4]];
    if (p.id === 'frozen') s.splice(4, 0, [1.7, 'congelado/grito', 0.8], [2.6, 'congelado/hielo', 0.7]);
    this.lucha = { room, t: 0, sonidos: s };
    g.alerta?.(`${camDe(room)}: RUIDOS DE LUCHA`);
    setTimeout(() => g.alerta?.(`${camDe(room)}: SIN MOVIMIENTO`), T.PELEA * 1000);
    // Los que quedan, a más
    const err = this.ai.errante;
    const dis = this.ai.dislocado;
    if (err?.level > 0) err.setLevel(err.level + T.SUBE.errante);
    if (dis?.level > 0) dis.setLevel(dis.level + T.SUBE.dislocado);
    if (err) err.n6Paso = (err.n6Paso ?? 1) * T.ERRANTE_STEP;
  }

  /** Para el final y la noche 7: dónde quedó cada uno ({ id: sala }). */
  get cadaveres() {
    return Object.fromEntries(this.desaparecidos.map((d) => [d.id, d.room]));
  }

  /** Depuración: que desaparezca ya el siguiente (o `id`). */
  forzar(id = null) {
    const p = id ? this.pendientes.find((x) => x.id === id) : this.pendientes[0];
    if (!p) return null;
    this.pendientes.splice(this.pendientes.indexOf(p), 1);
    this._desaparece(p);
    return p.id;
  }

  // --- Dibujo: la oficina ---------------------------------------------------------
  drawOffice(ctx, face) {
    if (!this.active) return;
    if (face === 'back' && this.slaimi === 'congelado') this._slaimiHielo(ctx);
  }

  /** Slaimi dentro de un bloque de hielo, con la luz apagándose. */
  _slaimiHielo(ctx) {
    const { x, y, size } = HIELO;
    ctx.save();
    // La luz: un latido muy débil, cada vez más lento
    const k = 0.15 + 0.1 * Math.max(0, Math.sin(this.time * 0.9));
    const halo = ctx.createRadialGradient(x, y - size * 0.5, 4, x, y - size * 0.5, size * 1.1);
    halo.addColorStop(0, `rgba(143,107,255,${k})`);
    halo.addColorStop(1, 'rgba(143,107,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(x - size * 1.2, y - size * 1.6, size * 2.4, size * 1.8);
    ctx.globalAlpha = 0.8;
    ctx.filter = 'saturate(0.35) brightness(0.75)';
    drawSlaimi(ctx, x, y - 8, size * 0.8, { t: 0, sad: true, sprites: this.g.sprites, phase: 0 });
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    // El bloque de hielo: translúcido, con grietas y brillos
    const bw = size * 1.15;
    const bh = size * 1.1;
    const bx = x - bw / 2;
    const by = y - bh;
    const gr = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
    gr.addColorStop(0, 'rgba(215,235,255,0.42)');
    gr.addColorStop(0.5, 'rgba(160,200,235,0.25)');
    gr.addColorStop(1, 'rgba(225,240,255,0.45)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(bx + 6, by + 10);
    ctx.lineTo(bx + bw * 0.55, by - 4);
    ctx.lineTo(bx + bw - 4, by + 14);
    ctx.lineTo(bx + bw + 4, by + bh);
    ctx.lineTo(bx - 6, by + bh);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(240,250,255,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.2;
    const grietas = [[0.2, 0.15, 0.45, 0.5, 0.35, 0.8], [0.7, 0.1, 0.6, 0.4, 0.82, 0.62], [0.5, 0.55, 0.62, 0.9]];
    for (const gq of grietas) {
      ctx.beginPath();
      ctx.moveTo(bx + gq[0] * bw, by + gq[1] * bh);
      for (let i = 2; i < gq.length; i += 2) ctx.lineTo(bx + gq[i] * bw, by + gq[i + 1] * bh);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(bx + bw * 0.12, by + bh * 0.12, 4, bh * 0.45);
    // Escarcha en el suelo alrededor
    ctx.fillStyle = 'rgba(220,235,250,0.22)';
    ctx.beginPath();
    ctx.ellipse(x, y + 4, bw * 0.85, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // --- Dibujo: las cámaras (los rastros) -------------------------------------------
  drawRoom(ctx, room) {
    if (!this.active) return;
    const l = this.lucha;
    if (l && l.room === room && l.t < T.PELEA) this._pelea(ctx, l.t);
    for (const d of this.desaparecidos) {
      if (d.room !== room) continue;
      if (l && l.room === room && l.t < T.PELEA * 0.6) continue;
      this._rastro(ctx, d);
    }
  }

  drawVent(ctx, id) {
    this.drawRoom(ctx, id);
  }

  _pelea(ctx, t) {
    // La imagen se sacude, se corta y se tiñe; destellos (nada claro: solo la pelea)
    const k = Math.sin(t * 22) * 0.5 + 0.5;
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.25 + 0.5 * k * Math.random()})`;
    ctx.fillRect(0, 0, W, H);
    if (Math.random() < 0.25) {
      ctx.fillStyle = 'rgba(120,10,10,0.25)';
      ctx.fillRect(0, 0, W, H);
    }
    for (let i = 0; i < 6; i++) {
      const y = Math.random() * H;
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`;
      ctx.fillRect(0, y, W, 2 + Math.random() * 12);
    }
    ctx.restore();
  }

  _rastro(ctx, d) {
    const g = this.g;
    ctx.save();
    if (d.rastro === 'camara') {
      // La cámara, caída: la imagen torcida, la lente rota y casi sin señal
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(230,235,240,0.5)';
      ctx.lineWidth = 2;
      const cx = W * 0.62;
      const cy = H * 0.38;
      for (let i = 0; i < 9; i++) {
        const a = i * 0.7 + 0.3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        let px = cx;
        let py = cy;
        for (let j = 0; j < 4; j++) {
          px += Math.cos(a + j * 0.25) * (60 + j * 40);
          py += Math.sin(a + j * 0.25) * (60 + j * 40);
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, H * 0.78, W, H * 0.22);
      ctx.translate(W / 2, H / 2);
      ctx.rotate(-0.32);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(-W, H * 0.25, W * 2, H);
    } else {
      // Sangre: un charco con salpicaduras y un rastro arrastrado hacia fuera
      const x = W * (0.42 + 0.16 * ((d.room.length * 7) % 5) / 5);
      const y = H * 0.74;
      ctx.fillStyle = 'rgba(70,4,4,0.85)';
      ctx.beginPath();
      ctx.ellipse(x, y, 150, 34, -0.05, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 14; i++) {
        const a = i * 2.39;
        const r = 120 + (i * 37) % 140;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.25, 8 + (i % 4) * 5, 4 + (i % 3) * 2, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(60,3,3,0.75)';
      ctx.lineWidth = 26;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + 60, y);
      ctx.quadraticCurveTo(x + 260, y - 30, x + 420, y - 110);
      ctx.stroke();
      if (d.rastro === 'trozo') {
        // Un trozo de él: su pose de cámara, caída y a oscuras, entre la sangre
        const key = g.sprites?.has?.(`pose_${d.id}_${d.room}_lejos`) ? `pose_${d.id}_${d.room}_lejos`
          : g.sprites?.has?.(`pose_${d.id}_${d.room}_media`) ? `pose_${d.id}_${d.room}_media` : null;
        if (key) {
          ctx.filter = 'brightness(0.35) saturate(0.6)';
          ctx.translate(x, y);
          ctx.rotate(1.35);
          ctx.scale(0.6, 0.6);
          ctx.beginPath();
          ctx.rect(-W / 2, -H * 0.1, W, H * 0.45);
          ctx.clip();
          g.sprites.draw(ctx, key, -W / 2, -H / 2, W, H);
          ctx.filter = 'none';
        }
      }
    }
    ctx.restore();
  }
}
