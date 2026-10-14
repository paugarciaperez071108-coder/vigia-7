// =============================================================
// OfficeView.js — Dibujo procedural del Módulo de Control.
//
// Distribución (coordenadas lógicas 1600×900):
//   - Compuerta izquierda y derecha a los lados.
//   - Paneles de botones (PUERTA / LUZ) junto a cada compuerta.
//   - Ventanal al espacio en el centro, consola y monitor abajo.
//
// También expone hitTest(x, y) para saber qué botón se ha pulsado:
// así la geometría de los botones solo está definida aquí.
// =============================================================

import { Random } from '../core/Random.js';
import { CONFIG } from '../config.js';
import { drawCreature } from './CreatureArt.js';

const KIND_SCALE = { specimen: 0.95, alto: 1.02, rastrero: 0.5, frozen: 0.9 };
// Desplazamiento horizontal para que la cabeza quede dentro del marco
const KIND_OFFSET = { specimen: -0.12, alto: 0, rastrero: -0.25, frozen: -0.15 };

const DOORWAY = {
  left: { x: 70, y: 150, w: 300, h: 610 },
  right: { x: 1230, y: 150, w: 300, h: 610 },
};

const BUTTONS = {
  left: {
    door: { x: 392, y: 330, w: 86, h: 86 },
    light: { x: 392, y: 440, w: 86, h: 86 },
  },
  right: {
    door: { x: 1122, y: 330, w: 86, h: 86 },
    light: { x: 1122, y: 440, w: 86, h: 86 },
  },
};

const WINDOW = { x: 540, y: 110, w: 520, h: 300 };
const MONITOR = { x: 650, y: 560, w: 300, h: 180 };
// Cartel con los comandos de la consola (encima de la computadora)
const COMMAND_SIGN = { x: 560, y: 426, w: 480, h: 120 };

const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export class OfficeView {
  constructor() {
    // Estrellas fijas (semilla constante → siempre las mismas).
    const rng = new Random(7);
    this.stars = Array.from({ length: 140 }, () => ({
      x: rng.next(), y: rng.next(), r: rng.range(0.4, 1.8), tw: rng.range(0, Math.PI * 2),
    }));
    // Decoración de abandono de la oficina (fija)
    this.stains = Array.from({ length: 9 }, () => ({
      x: rng.range(0, 1600), y: rng.range(60, 880), r: rng.range(50, 170), a: rng.range(0.25, 0.45),
    }));
    this.cables = [
      { x: 470, len: 220, bend: 40, phase: 0 },
      { x: 1120, len: 300, bend: -50, phase: 2, spark: true },
      { x: 1010, len: 90, bend: 20, phase: 4 },
    ];
    this.time = 0;
  }

  /** Devuelve la acción del botón bajo (x, y) o null. */
  hitTest(x, y) {
    for (const side of ['left', 'right']) {
      if (inside(BUTTONS[side].door, x, y)) return { type: 'door', side };
      if (inside(BUTTONS[side].light, x, y)) return { type: 'light', side };
    }
    if (inside(MONITOR, x, y)) return { type: 'terminal' };
    return null;
  }

  update(dt) {
    this.time += dt;
  }

  /**
   * @param state.blackout     apagón de la oficina activo
   * @param state.terminal     Terminal (consola pequeña)
   * @param state.doorEnemies  { left: [...], right: [...] } enemigos en cada compuerta
   * @param state.reactor      Reactor (para la pantalla de la consola)
   * @param state.locked       compuertas y luces bloqueadas (apagón/enfriamiento)
   * @param state.night        número de noche (qué comandos salen en el cartel)
   */
  draw(ctx, office, state) {
    this._drawWalls(ctx);
    this._drawShipDetails(ctx, state);
    this._drawDirt(ctx);
    this._drawWindow(ctx);
    this._drawCommandSign(ctx, state.night ?? 1);
    for (const side of ['left', 'right']) {
      this._drawDoorway(ctx, side, office.doors[side].anim, office.lights[side], state.doorEnemies[side]);
      this._drawButtons(ctx, side, office, !state.locked);
    }
    this._drawConsole(ctx, state);
    this._drawCables(ctx);

    if (state.blackout) {
      this._drawBlackout(ctx);
      this._drawMonitorScreen(ctx, state); // la pantalla verde sigue encendida
    } else if (Math.random() < 0.012) {
      // Fluorescente del techo que falla de vez en cuando
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, 1600, 900);
    }
  }

  // ---------------------------------------------------------------
  // Abandono: manchas, arañazos, cables
  // ---------------------------------------------------------------

  _drawDirt(ctx) {
    for (const s of this.stains) {
      const g = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, s.r);
      g.addColorStop(0, `rgba(20,14,8,${s.a})`);
      g.addColorStop(1, 'rgba(20,14,8,0)');
      ctx.fillStyle = g;
      ctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
    }
    // Arañazos junto a las compuertas (algo intentó entrar)
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 3;
    for (const [x, y] of [[30, 420], [1550, 360]]) {
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(x + k * 7, y);
        ctx.lineTo(x + k * 7 - 6, y + 110);
        ctx.stroke();
      }
    }
  }

  _drawCables(ctx) {
    ctx.strokeStyle = '#08090a';
    ctx.lineWidth = 6;
    for (const c of this.cables) {
      const swing = Math.sin(this.time * 0.7 + c.phase) * 10;
      ctx.beginPath();
      ctx.moveTo(c.x, 76);
      ctx.quadraticCurveTo(c.x + c.bend, 76 + c.len * 0.6, c.x + swing, 76 + c.len);
      ctx.stroke();
      if (c.spark && Math.random() < 0.02) {
        ctx.fillStyle = 'rgba(200,230,255,0.95)';
        ctx.beginPath();
        ctx.arc(c.x + swing, 76 + c.len, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ---------------------------------------------------------------
  // Detalles de nave: tuberías verticales, rejillas, balizas, rótulo
  // ---------------------------------------------------------------

  _drawShipDetails(ctx, state) {
    // Tuberías verticales en las esquinas, con juntas
    for (const x of [16, 1562]) {
      ctx.fillStyle = '#232a32';
      ctx.fillRect(x, 76, 22, 824);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(x + 4, 76, 4, 824);
      ctx.fillStyle = '#181d23';
      for (let y = 150; y < 900; y += 180) ctx.fillRect(x - 4, y, 30, 12);
    }
    // Rejillas de ventilación bajo las compuertas
    for (const x of [90, 1290]) {
      ctx.fillStyle = '#07090b';
      ctx.fillRect(x, 795, 220, 64);
      ctx.strokeStyle = '#2e3640';
      ctx.lineWidth = 4;
      ctx.strokeRect(x, 795, 220, 64);
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let y = 806; y < 856; y += 9) {
        ctx.moveTo(x + 8, y);
        ctx.lineTo(x + 212, y);
      }
      ctx.stroke();
    }
    // Balizas de emergencia sobre las compuertas: giran en rojo cuando
    // las compuertas están bloqueadas o el reactor está en zona crítica.
    const alarm = state.locked || state.reactor?.warning;
    for (const x of [220, 1380]) {
      const flash = alarm ? Math.max(0, Math.cos(this.time * 4 + x)) : 0;
      ctx.fillStyle = '#14181d';
      ctx.fillRect(x - 22, 128, 44, 10);
      if (flash > 0) {
        const g = ctx.createRadialGradient(x, 124, 4, x, 124, 260);
        g.addColorStop(0, `rgba(255,50,30,${0.5 * flash})`);
        g.addColorStop(1, 'rgba(255,50,30,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 260, 0, 520, 400);
      }
      ctx.fillStyle = alarm ? `rgb(${110 + 145 * flash},30,25)` : '#3a1612';
      ctx.beginPath();
      ctx.arc(x, 128, 16, Math.PI, 0);
      ctx.fill();
    }
    // Rótulo pintado sobre el ventanal y avisos junto a las compuertas
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillStyle = 'rgba(205,195,170,0.3)';
    ctx.fillText('MODULO DE CONTROL // VIGIA-7', 800, 92);
    ctx.font = 'bold 14px "Courier New", monospace';
    for (const x of [435, 1165]) {
      ctx.fillStyle = 'rgba(200,160,30,0.7)';
      ctx.fillRect(x - 52, 246, 104, 22);
      ctx.fillStyle = '#111';
      ctx.fillText('! ESCLUSA', x, 258);
    }
  }

  /** Cartel atornillado con los comandos de la consola. */
  _drawCommandSign(ctx, night) {
    const r = COMMAND_SIGN;
    ctx.save();
    ctx.fillStyle = '#b9b29a';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = 'rgba(60,45,25,0.25)'; // manchas de óxido
    ctx.fillRect(r.x + r.w - 70, r.y, 70, 26);
    ctx.fillRect(r.x, r.y + r.h - 18, 120, 18);
    ctx.strokeStyle = '#4d4a40';
    ctx.lineWidth = 3;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = '#4d4a40';
    for (const [x, y] of [[r.x + 8, r.y + 8], [r.x + r.w - 8, r.y + 8], [r.x + 8, r.y + r.h - 8], [r.x + r.w - 8, r.y + r.h - 8]]) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#1a1814';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillText('COMANDOS DE CONSOLA', r.x + 20, r.y + 12);
    let y = r.y + 38;
    const descX = r.x + 110;
    for (const c of CONFIG.TERMINAL_COMMANDS.filter((c) => c.night <= night)) {
      ctx.font = 'bold 15px "Courier New", monospace';
      ctx.fillText(c.cmd, r.x + 20, y);
      ctx.font = '14px "Courier New", monospace';
      for (const line of wrap(ctx, c.desc, r.x + r.w - 16 - descX)) {
        ctx.fillText(line, descX, y + 1);
        y += 17;
      }
      y += 4;
    }
    ctx.font = 'italic 13px "Courier New", monospace';
    ctx.fillStyle = '#3d3a32';
    ctx.fillText('Enter o clic en la pantalla para escribir', r.x + 20, r.y + r.h - 24);
    ctx.restore();
  }

  /** Apagón: todo negro salvo el ventanal y la pantalla de la consola. */
  _drawBlackout(ctx) {
    const w = WINDOW;
    const m = MONITOR;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.96)';
    ctx.beginPath();
    ctx.rect(0, 0, 1600, 900);
    ctx.roundRect(w.x + 8, w.y + 8, w.w - 16, w.h - 16, 34);
    ctx.rect(m.x, m.y, m.w, m.h);
    ctx.fill('evenodd');
    // Resplandor verde de la pantalla sobre la mesa
    const g = ctx.createRadialGradient(m.x + m.w / 2, m.y + m.h / 2, 40, m.x + m.w / 2, m.y + m.h, 320);
    g.addColorStop(0, 'rgba(60,255,140,0.10)');
    g.addColorStop(1, 'rgba(60,255,140,0)');
    ctx.fillStyle = g;
    ctx.fillRect(m.x - 300, m.y - 100, m.w + 600, 500);
    ctx.restore();
  }

  // ---------------------------------------------------------------

  _drawWalls(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, 900);
    g.addColorStop(0, '#15191f');
    g.addColorStop(1, '#0a0c10');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1600, 900);

    // Paneles metálicos con remaches
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 2;
    for (let x = 0; x < 1600; x += 160) {
      ctx.strokeRect(x + 4, 20, 152, 860);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let x = 0; x < 1600; x += 160) {
      for (const y of [32, 868]) {
        ctx.beginPath();
        ctx.arc(x + 16, y, 3, 0, Math.PI * 2);
        ctx.arc(x + 144, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Tuberías del techo
    ctx.fillStyle = '#1d232b';
    ctx.fillRect(0, 40, 1600, 18);
    ctx.fillRect(0, 66, 1600, 10);
  }

  _drawWindow(ctx) {
    const w = WINDOW;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(w.x, w.y, w.w, w.h, 40);
    ctx.clip();
    ctx.fillStyle = '#01020a';
    ctx.fillRect(w.x, w.y, w.w, w.h);

    // Estrellas con un leve parpadeo y deriva (la estación gira).
    const drift = (this.time * 0.004) % 1;
    for (const s of this.stars) {
      const sx = w.x + (((s.x + drift) % 1) * w.w);
      const sy = w.y + s.y * w.h;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.time * 1.5 + s.tw);
      ctx.fillStyle = '#dfe8ff';
      ctx.fillRect(sx, sy, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    // Curvatura de un planeta en la parte inferior.
    const cx = w.x + w.w * 0.65;
    const cy = w.y + w.h + 520;
    const pg = ctx.createRadialGradient(cx - 120, cy - 520, 40, cx, cy, 600);
    pg.addColorStop(0, '#3b6fb6');
    pg.addColorStop(0.6, '#163059');
    pg.addColorStop(1, '#050b1a');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(cx, cy, 600, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,180,255,0.35)';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();

    // Marco del ventanal
    ctx.strokeStyle = '#2b333d';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.roundRect(w.x, w.y, w.w, w.h, 40);
    ctx.stroke();
    ctx.strokeStyle = '#3a4550';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(w.x + w.w / 2, w.y);
    ctx.lineTo(w.x + w.w / 2, w.y + w.h);
    ctx.stroke();
  }

  _drawDoorway(ctx, side, anim, lightOn, enemies = []) {
    const d = DOORWAY[side];
    ctx.save();
    ctx.beginPath();
    ctx.rect(d.x, d.y, d.w, d.h);
    ctx.clip();

    // Pasillo: oscuro, o iluminado si la luz está encendida.
    ctx.fillStyle = '#030405';
    ctx.fillRect(d.x, d.y, d.w, d.h);
    if (lightOn) {
      // Parpadeo leve del foco
      const flicker = 0.85 + Math.random() * 0.15;
      const lg = ctx.createRadialGradient(d.x + d.w / 2, d.y + 40, 10, d.x + d.w / 2, d.y + d.h * 0.6, d.h);
      lg.addColorStop(0, `rgba(230,240,255,${0.9 * flicker})`);
      lg.addColorStop(0.5, `rgba(120,140,160,${0.45 * flicker})`);
      lg.addColorStop(1, 'rgba(10,12,16,0.9)');
      ctx.fillStyle = lg;
      ctx.fillRect(d.x, d.y, d.w, d.h);
      // Perspectiva del pasillo: líneas hacia el punto de fuga.
      const vx = d.x + d.w / 2;
      const vy = d.y + d.h * 0.42;
      ctx.strokeStyle = `rgba(0,0,0,${0.5 * flicker})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (const [x, y] of [[d.x, d.y], [d.x + d.w, d.y], [d.x, d.y + d.h], [d.x + d.w, d.y + d.h]]) {
        ctx.moveTo(x, y);
        ctx.lineTo(vx, vy);
      }
      ctx.stroke();
      ctx.strokeStyle = `rgba(0,0,0,${0.6 * flicker})`;
      ctx.strokeRect(vx - 45, vy - 70, 90, 140); // fondo del pasillo

      // ¿Hay alguien en la compuerta? Con la luz se le ve entero.
      if (enemies.length) {
        const e = enemies[0];
        drawCreature(ctx, e.id, d.x + d.w * (0.5 + KIND_OFFSET[e.id]), d.y + d.h - 6, d.h * 0.9 * KIND_SCALE[e.id], this.time);
      }
    } else if (enemies.length && Math.sin(this.time * 2.3) > 0.85) {
      // Sin luz: de vez en cuando, un destello de ojos en la oscuridad
      ctx.fillStyle = 'rgba(220,230,220,0.5)';
      const ey = d.y + d.h * 0.28;
      ctx.fillRect(d.x + d.w / 2 - 14, ey, 6, 4);
      ctx.fillRect(d.x + d.w / 2 + 8, ey + 2, 5, 4);
    }

    // Compuerta: placa que baja desde arriba según anim (0..1).
    const doorH = d.h * anim;
    if (doorH > 0) {
      const dg = ctx.createLinearGradient(d.x, 0, d.x + d.w, 0);
      dg.addColorStop(0, '#3c444d');
      dg.addColorStop(0.5, '#59636e');
      dg.addColorStop(1, '#353c44');
      ctx.fillStyle = dg;
      ctx.fillRect(d.x, d.y, d.w, doorH);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 3;
      for (let y = d.y + 60; y < d.y + doorH - 30; y += 90) {
        ctx.beginPath();
        ctx.moveTo(d.x + 20, y);
        ctx.lineTo(d.x + d.w - 20, y);
        ctx.stroke();
      }
      // Franja de peligro en el borde inferior
      const stripeY = d.y + doorH - 34;
      ctx.save();
      ctx.beginPath();
      ctx.rect(d.x, stripeY, d.w, 34);
      ctx.clip();
      ctx.fillStyle = '#e0b422';
      ctx.fillRect(d.x, stripeY, d.w, 34);
      ctx.fillStyle = '#111';
      for (let x = d.x - 40; x < d.x + d.w + 40; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, stripeY + 34);
        ctx.lineTo(x + 20, stripeY + 34);
        ctx.lineTo(x + 40, stripeY);
        ctx.lineTo(x + 20, stripeY);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();

    // Marco de la compuerta
    ctx.strokeStyle = '#262d35';
    ctx.lineWidth = 18;
    ctx.strokeRect(d.x, d.y, d.w, d.h);
  }

  _drawButtons(ctx, side, office, powered) {
    const b = BUTTONS[side];
    // Placa del panel
    const px = b.door.x - 14;
    ctx.fillStyle = '#1b2027';
    ctx.beginPath();
    ctx.roundRect(px, b.door.y - 50, b.door.w + 28, 260, 10);
    ctx.fill();
    ctx.strokeStyle = '#2d353f';
    ctx.lineWidth = 3;
    ctx.stroke();

    this._button(ctx, b.door, 'PUERTA', office.doors[side].closed, '#ff4d4d', powered);
    this._button(ctx, b.light, 'LUZ', office.lights[side], '#f6f2c8', powered);
    if (!powered) {
      // Apagón o enfriamiento: el panel no responde
      ctx.fillStyle = Math.floor(this.time * 3) % 2 ? '#ff5050' : '#a03030';
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('BLOQUEADO', b.door.x + b.door.w / 2, b.door.y - 28);
    }
  }

  _button(ctx, r, label, active, color, powered) {
    ctx.save();
    if (active && powered) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 25;
    }
    ctx.fillStyle = active && powered ? color : '#3a2a2a';
    if (label === 'LUZ' && !(active && powered)) ctx.fillStyle = '#34352c';
    if (active && !powered) ctx.fillStyle = '#7a2a2a'; // cerrada pero bloqueada
    ctx.beginPath();
    ctx.arc(r.x + r.w / 2, r.y + r.h / 2, r.w / 2 - 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#0c0e11';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(r.x + r.w / 2, r.y + r.h / 2, r.w / 2 - 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = active && powered ? '#111' : '#9aa4ad';
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2);
  }

  _drawConsole(ctx, state) {
    const powered = !state.blackout;
    // Mesa de la consola (trapecio en perspectiva)
    ctx.fillStyle = '#1a1f26';
    ctx.beginPath();
    ctx.moveTo(470, 700);
    ctx.lineTo(1130, 700);
    ctx.lineTo(1260, 900);
    ctx.lineTo(340, 900);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#2c343e';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Carcasa de la computadora pequeña
    const m = MONITOR;
    ctx.fillStyle = '#0e1116';
    ctx.beginPath();
    ctx.roundRect(m.x - 14, m.y - 14, m.w + 28, m.h + 28, 12);
    ctx.fill();
    this._drawMonitorScreen(ctx, state);

    // Luces piloto de la consola
    const leds = [[520, 760], [560, 760], [1040, 760], [1080, 760]];
    leds.forEach(([x, y], i) => {
      const on = powered && Math.sin(this.time * (1 + i * 0.7)) > -0.3;
      ctx.fillStyle = on ? ['#3f6', '#fc3', '#3cf', '#f55'][i] : '#222';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /** Contenido de la pantalla verde: estado normal o terminal del apagón. */
  _drawMonitorScreen(ctx, { blackout, terminal, reactor }) {
    const m = MONITOR;
    ctx.save();
    ctx.fillStyle = '#06150d';
    ctx.fillRect(m.x, m.y, m.w, m.h);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const green = 'rgba(80,255,150,0.85)';
    const cursor = Math.floor(this.time * 2) % 2 === 0 ? '_' : ' ';

    if (blackout) {
      ctx.fillStyle = Math.floor(this.time * 2) % 2 ? '#ff6060' : '#ff9090';
      ctx.font = 'bold 16px "Courier New", monospace';
      ctx.fillText('!! FALLO DE ENERGIA', m.x + 14, m.y + 12);
      ctx.fillStyle = green;
      ctx.font = '14px "Courier New", monospace';
      terminal.lines.forEach((l, i) => ctx.fillText(l, m.x + 14, m.y + 40 + i * 18));
      ctx.font = 'bold 16px "Courier New", monospace';
      if (terminal.focused) {
        ctx.fillText(`> ${terminal.input}${cursor}`, m.x + 14, m.y + 118);
        ctx.font = '12px "Courier New", monospace';
        ctx.fillText('[Enter] ejecutar  [Esc] salir', m.x + 14, m.y + 152);
      } else {
        ctx.fillText(`Escriba ${CONFIG.BLACKOUT_COMMAND}`, m.x + 14, m.y + 118);
        ctx.font = '12px "Courier New", monospace';
        ctx.fillText('[Enter] o clic aqui para escribir', m.x + 14, m.y + 152);
      }
    } else {
      ctx.fillStyle = green;
      ctx.font = 'bold 18px "Courier New", monospace';
      ctx.fillText('VIGIA-7  // CONTROL', m.x + 16, m.y + 16);
      ctx.font = '15px "Courier New", monospace';
      ctx.fillText('CAMARAS: 10/10 EN LINEA', m.x + 16, m.y + 56);
      ctx.fillText(`REACTOR: ${Math.floor(reactor.level)}%`, m.x + 16, m.y + 80);
      ctx.fillText(`> ${cursor}`, m.x + 16, m.y + 112);
    }
    // Líneas de barrido del monitor
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = m.y; y < m.y + m.h; y += 4) ctx.fillRect(m.x, y, m.w, 2);
    ctx.restore();
  }
}

/** Parte un texto en líneas que quepan en `width` píxeles. */
function wrap(ctx, text, width) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > width) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}
