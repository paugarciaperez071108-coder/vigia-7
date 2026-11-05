// =============================================================
// OfficeView.js — Dibujo procedural del Módulo de Control.
//
// La oficina es una SALA CUADRADA: el jugador está en el centro y cada
// pared es una vista (se gira con OfficeTurn.js). Coordenadas 1600×900:
//   - frente:    ventanal, consola, cartel y dos conductos (decoración por
//                ahora; en el derecho se ve la sombra de El Insecto al
//                empezar la noche 2)
//   - izquierda: compuerta izquierda → Corredor Oeste, con PUERTA / LUZ
//   - derecha:   compuerta derecha → Corredor Este, con PUERTA / LUZ
//   - atrás:     el pasillo central (lo dibuja BackView.js)
// Fondo 3D (v1.12): la oficina entera de Blender, la misma en todas las noches
// (OficinaV2, tools/3d/salas/oficina_v2.py). Lo interactivo se dibuja encima. hitTest(x, y, pared) dice qué se ha pulsado.
// =============================================================

import { CONFIG } from '../config.js';
import { drawCreature, hasCreatureSprite } from './CreatureArt.js';
import { Dust, lightPool } from './Atmosphere.js';
import { drawCRT, drawTerminal } from './CRT.js';

// Vista que se mueve un poco con el ratón (como en FNaF). Se amplía
// un poco para que no se vean los bordes; hitTest lo compensa, así que
// los botones responden igual que antes.
const PAN_X = 16;
const PAN_Y = 7;
const PAN_SCALE = 1.025;

const KIND_SCALE = { specimen: 0.95, largo: 1.02, insecto: 0.5, frozen: 0.9 };
// Desplazamiento horizontal para que la cabeza quede dentro del marco
const KIND_OFFSET = { specimen: 0, largo: 0, insecto: -0.25, frozen: 0 }; // de frente ya van centrados

// Cada compuerta, en el centro de SU pared (vista izquierda / derecha)
export const DOORWAY = {
  left: { x: 608, y: 242, w: 384, h: 480 },
  right: { x: 608, y: 242, w: 384, h: 480 },
};
// Noche 4: PANEL DE ENERGÍA en la pared izquierda, hacia el fondo (lejos de
// la compuerta y sus botones). Su palanca devuelve la luz (camino A).
// Botones junto a la compuerta (hacia el frente de la oficina en cada pared)
const BUTTONS = {
  left: {
    door: { x: 1040, y: 330, w: 86, h: 86 },
    light: { x: 1040, y: 440, w: 86, h: 86 },
  },
  right: {
    door: { x: 474, y: 330, w: 86, h: 86 },
    light: { x: 474, y: 440, w: 86, h: 86 },
  },
};
// Los dos conductos del frente (donde antes estaban las compuertas). De
// momento son decoración: preparados para una mecánica en noches futuras.
export const VENTS_FRONT = {
  left: { x: 110, y: 380, w: 250, h: 200 },
  right: { x: 1240, y: 380, w: 250, h: 200 },
};

const WINDOW = { x: 540, y: 110, w: 520, h: 300 };
const MONITOR = { x: 650, y: 560, w: 300, h: 180 };
// Consola 3D (v0.50, tools/3d/salas/consola.py): dónde cae el cristal del CRT
// en el render y sus luces piloto. Si no está, la consola dibujada.
const CONSOLE_LEDS = [];
// Inicio de la noche 2 en la oficina 3D (v0.50, tools/3d/enemigos/insecto_intro.py):
// El Insecto acercándose por el conducto de la rejilla derecha, a contraluz
const INTRO_GRILLE = { x: 1224, y: 357, w: 309, h: 246 };
const INTRO_ART = {};
fetch('assets/n2intro/indice.json').then((r) => (r.ok ? r.json() : {})).then((idx) => {
  for (const [k, d] of Object.entries(idx)) {
    const img = new Image();
    img.onload = () => { INTRO_ART[k] = { ...d, img }; };
    img.src = `assets/n2intro/${d.archivo}`;
  }
}).catch(() => {});
// (v1.12) las luces piloto de la carcasa (la misma consola de consola.py, dentro de la oficina v2;
// el sitio del cristal del CRT lo da la oficina v2: OficinaV2.pantalla)
fetch('assets/salas/consola.json').then((r) => (r.ok ? r.json() : null)).then((d) => {
  if (!d) return;
  CONSOLE_LEDS.push(...(d.leds ?? []));
}).catch(() => {});
// Cartel con los comandos de la consola (encima de la computadora)
const COMMAND_SIGN = { x: 560, y: 416, w: 480, h: 136 };   // (por detrás del monitor: lo de abajo queda tapado)
const MONITOR_TOP = 520;     // (v1.12) donde empieza la carcasa del monitor en el render: tapa el cartel
const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export class OfficeView {
  constructor(sprites = null) {
    this.sprites = sprites;
    this.v2src = null;        // (v1.12) la oficina de Blender (OficinaV2), la de todas las escenas
    this.dust = new Dust(91, 110);
    this.pan = { x: 0, y: 0, s: 1 };
    this.time = 0;
  }

  /** Devuelve la acción bajo (x, y) en la pared `face`, o null. */
  hitTest(x, y, face = 'front') {
    // Deshace el movimiento de la vista (los botones se dibujan desplazados)
    const p = this.pan;
    x = (x - 800 - p.x) / p.s + 800;
    y = (y - 450 - p.y) / p.s + 450;
    if (face === 'left' || face === 'right') {
      if (inside(BUTTONS[face].door, x, y)) return { type: 'door', side: face };
      if (inside(BUTTONS[face].light, x, y)) return { type: 'light', side: face };
      if (inside(DOORWAY[face], x, y)) return { type: 'doorway', side: face };
      return null;
    }
    if (face === 'front' && inside(MONITOR, x, y)) return { type: 'terminal' };
    return null;
  }

  update(dt) {
    this.time += dt;
    this.dust.update(dt);
  }

  /**
   * @param state.blackout     apagón de la oficina activo
   * @param state.terminal     Terminal (consola pequeña)
   * @param state.doorEnemies  { left: [...], right: [...] } enemigos en cada compuerta
   * @param state.reactor      Reactor (para la pantalla de la consola)
   * @param state.locked       compuertas y luces bloqueadas (apagón/enfriamiento)
   * @param state.noPower      sin energía (final de la noche 2): botones apagados, sin balizas
   * @param state.night        número de noche (qué comandos salen en el cartel)
   * @param state.cameras      CameraSystem (estado de la ventilación en la pantalla)
   * @param state.gasLeak      fuga de gas activa
   * @param state.easterEgg    secreto del ventanal (solo se ve en el apagón)
   * @param state.introProgress 0..1: inicio de la noche 2 (15 s para echar a
   *                           El Insecto). Su sombra avanza tras la rejilla derecha.
   * @param state.mouse        posición del ratón: la vista se desplaza un poco
   *                           (sin él, la vista queda quieta)
   */
  draw(ctx, office, state) {
    const m = state.mouse;
    const tx = m ? -((m.x - 800) / 800) * PAN_X : 0;
    const ty = m ? -((m.y - 450) / 450) * PAN_Y : 0;
    const p = this.pan;
    p.s = m ? PAN_SCALE : 1;
    p.x += (tx - p.x) * 0.12;
    p.y += (ty - p.y) * 0.12;
    if (!m) p.x = p.y = 0;
    ctx.save();
    ctx.translate(800 + p.x, 450 + p.y);
    ctx.scale(p.s, p.s);
    ctx.translate(-800, -450);
    // (v1.00) La oficina hecha entera en Blender (OficinaV2): si la hay para esta vista, todo lo
    // que se dibujaba encima (ventanal, cables, grietas, manchas, la consola suelta) sobra
    // (v1.12) la v2 es LA oficina: también en las escenas que no la pasan (fin de la noche 3,
    // ruta B de la noche 4, final de la noche 2…); la monitor del render manda
    const v2 = state.v2 ?? this.v2src;
    this.v2 = v2?.activa(state.face ?? 'front') ? v2 : null;
    if (this.v2?.pantalla) Object.assign(MONITOR, this.v2.pantalla);
    this._drawScene(ctx, office, state);
    // Lo que se dibuja encima de una pared con su mismo movimiento (noche 5: las rejillas)
    if (state.overlay) state.overlay(ctx, state.face ?? 'front');
    ctx.restore();
  }

  _drawScene(ctx, office, state) {
    const face = state.face ?? 'front';
    // (v1.12) en el apagón, la vista renderizada solo con la luz de emergencia
    const apagon = !!state.blackout && !!this.v2?.tieneApagon(face);
    this._drawWalls(ctx, face, apagon);
    if (!this.v2) return;           // (mientras carga la oficina: negro)
    if (face === 'left' || face === 'right') {
      // Pared de una compuerta: la puerta, su pasillo y sus botones
      this._drawDoorway(ctx, face, office.doors[face].anim, office.lights[face] && !state.blackout, state.doorEnemies[face]);
      this._drawButtons(ctx, face, office, !state.locked && !state.noPower);
      if (!state.blackout) {
        const lights = office.lights[face] ? [{ x: 800, y: 420, r: 380 }] : [{ x: 800, y: 120, r: 300 }];
        this.dust.draw(ctx, { alpha: 0.45, lights, px: this.pan.x * 0.8, py: this.pan.y * 0.8 });
      } else if (!apagon) {
        ctx.fillStyle = 'rgba(0,0,0,0.9)';
        ctx.fillRect(0, 0, 1600, 900);
      }
      this._flicker(ctx, state);
      return;
    }
    // (v1.12) El ventanal, los cables, las manchas, el panel del techo y la mesa ya están en el
    // render (oficina_v2.py): aquí solo va lo que se usa
    if (state.introProgress > 0) this._drawIntroDuct(ctx, state.introProgress);
    this._drawCommandSign(ctx, state.night ?? 1);
    this._drawConsole(ctx, state);
    if (!state.blackout) {
      // Polvo en el aire: se ve donde hay luz (ventanal, pantalla, foco)
      const lights = [{ x: 800, y: 260, r: 430 }, { x: 800, y: 640, r: 330 }];
      this.dust.draw(ctx, { alpha: 0.5, lights, px: this.pan.x * 0.8, py: this.pan.y * 0.8 });
    }

    if (state.blackout) {
      this._drawBlackout(ctx, apagon);
      if (state.easterEgg?.active) {
        // La cara está fuera, pegada al cristal (v1.12: el ventanal del render no tiene barra)
        state.easterEgg.draw(ctx, WINDOW);
      }
      this._drawMonitorScreen(ctx, state); // la pantalla verde sigue encendida
    } else this._flicker(ctx, state);
  }

  /** Fluorescente del techo que falla de vez en cuando. */
  _flicker(ctx, state) {
    if (!state.blackout && Math.random() < 0.012) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, 1600, 900);
    }
  }

  /** Noche 2 (oficina 3D): la rejilla derecha con El Insecto acercándose (fase por k). */
  _drawIntroDuct(ctx, k) {
    const n = Math.min(4, Math.floor(k * 5));
    const a = INTRO_ART[k < 0.08 ? 'vacio' : `intro_${n}`];
    if (!a) return;
    const r = INTRO_GRILLE;
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x - 6, r.y - 6, r.w + 12, r.h + 12);
    ctx.clip();
    // (la luz del fondo del conducto se enciende y se apaga poco a poco)
    ctx.globalAlpha = Math.min(1, k / 0.15);
    ctx.drawImage(a.img, a.x, a.y, a.w, a.h);
    ctx.restore();
  }



  /** Cartel atornillado con los comandos de la consola: la placa está en el render (v1.12,
   * oficina_v2.py); aquí solo sus letras, que por abajo tapa el monitor. */
  _drawCommandSign(ctx, night) {
    const r = COMMAND_SIGN;
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, MONITOR_TOP - r.y);
    ctx.clip();
    ctx.fillStyle = 'rgba(26,24,20,0.92)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.fillText('COMANDOS DE CONSOLA', r.x + 20, r.y + 10);
    let y = r.y + 32;
    const descX = r.x + 130;
    for (const c of CONFIG.TERMINAL_COMMANDS.filter((c) => c.night <= night && night <= (c.until ?? Infinity))) {
      ctx.font = 'bold 14px "Courier New", monospace';
      ctx.fillText(c.cmd, r.x + 20, y);
      ctx.font = '13px "Courier New", monospace';
      for (const line of wrap(ctx, c.desc, r.x + r.w - 16 - descX)) {
        ctx.fillText(line, descX, y + 1);
        y += 15;
      }
      y += 3;
    }
    ctx.restore();
  }

  /** Apagón: con la vista renderizada solo con la luz de emergencia (v1.12), únicamente el
   * resplandor verde de la pantalla; sin ella (aún cargando), casi negro salvo ventanal y pantalla. */
  _drawBlackout(ctx, apagon = false) {
    const w = WINDOW;
    const m = MONITOR;
    ctx.save();
    if (!apagon) {
      ctx.fillStyle = 'rgba(0,0,0,0.96)';
      ctx.beginPath();
      ctx.rect(0, 0, 1600, 900);
      ctx.roundRect(w.x + 8, w.y + 8, w.w - 16, w.h - 16, 34);
      ctx.rect(m.x, m.y, m.w, m.h);
      ctx.fill('evenodd');
    }
    // Resplandor verde de la pantalla sobre la mesa y el teclado
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(m.x + m.w / 2, m.y + m.h / 2, 40, m.x + m.w / 2, m.y + m.h, 340);
    g.addColorStop(0, 'rgba(40,190,100,0.14)');
    g.addColorStop(1, 'rgba(40,190,100,0)');
    ctx.fillStyle = g;
    ctx.fillRect(m.x - 320, m.y - 120, m.w + 640, 540);
    ctx.globalCompositeOperation = 'source-over';
    // Motas de polvo junto a la pantalla y al ventanal
    this.dust.draw(ctx, { alpha: 0.45, color: '120,255,170', lights: [{ x: 800, y: 650, r: 230 }] });
    this.dust.draw(ctx, { alpha: 0.35, color: '150,180,255', lights: [{ x: 800, y: 300, r: 300 }] });
    ctx.restore();
  }

  // ---------------------------------------------------------------

  _drawWalls(ctx, face = 'front', apagon = false) {
    // (v1.12) La oficina de Blender (OficinaV2, tools/3d/salas/oficina_v2.py), la misma en todas
    // las noches; mientras carga, negro. Lo interactivo va encima.
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 1600, 900);
    this.v2?.drawBase(ctx, face, apagon);
  }

  _drawDoorway(ctx, side, anim, lightOn, enemies = []) {
    const d = DOORWAY[side];
    ctx.save();
    ctx.beginPath();
    ctx.rect(d.x, d.y, d.w, d.h);
    ctx.clip();

    // Pasillo (v1.12): a oscuras, o el render del mismo pasillo con su luz encendida (oficina_v2.py
    // --luz=pasillo), con el foco que parpadea un poco
    if (lightOn && this.v2?.drawPasillo(ctx, side)) {
      if (Math.random() < 0.12) {
        ctx.fillStyle = `rgba(0,0,0,${0.15 + Math.random() * 0.2})`;
        ctx.fillRect(d.x, d.y, d.w, d.h);
      }
    } else {
      ctx.fillStyle = 'rgba(2,3,4,0.82)';
      ctx.fillRect(d.x, d.y, d.w, d.h);
    }
    if (lightOn) {
      // ¿Hay alguien en la compuerta? Con la luz se le ve entero.
      if (enemies.length) {
        const e = enemies[0];
        // En la compuerta se le ve de frente, mirándote (postura 'front')
        drawCreature(ctx, e.id, d.x + d.w * (0.5 + KIND_OFFSET[e.id]), d.y + d.h - 6, d.h * 0.9 * KIND_SCALE[e.id], this.time, { pose: 'front' });
      }
    } else if (enemies.length && Math.sin(this.time * 2.3) > 0.85) {
      // Sin luz: de vez en cuando, un destello de ojos en la oscuridad
      ctx.fillStyle = 'rgba(220,230,220,0.5)';
      const ey = d.y + d.h * 0.28;
      ctx.fillRect(d.x + d.w / 2 - 14, ey, 6, 4);
      ctx.fillRect(d.x + d.w / 2 + 8, ey + 2, 5, 4);
    }

    // Compuerta (v1.12): la hoja de acero del render (oficina_v2.py --puerta=cerrada), que baja
    // desde arriba según anim (0..1): se ve su parte de abajo, con la franja de peligro
    const doorH = d.h * anim;
    if (doorH > 0) this.v2?.drawHoja(ctx, side, doorH);
    ctx.restore();
  }

  _drawButtons(ctx, side, office, powered) {
    // (v1.12) Los botones son del render (apagados en la oficina, encendidos con
    // oficina_v2.py --botones=on): aquí solo se pone el encendido encima, con su resplandor
    const b = BUTTONS[side];
    for (const [r, cual, on] of [[b.door, 'puerta', office.doors[side].closed], [b.light, 'luz', office.lights[side]]]) {
      if (!on) continue;
      // (cerrada pero sin corriente: el piloto, apagado a medias)
      this.v2?.drawBoton(ctx, side, cual, powered ? 1 : 0.3);
      if (powered) lightPool(ctx, r.x + r.w / 2, r.y + r.h / 2, 120, cual === 'puerta' ? '255,60,50' : '255,240,200', 0.12);
    }
    if (!powered) {
      // Apagón o enfriamiento: el panel no responde
      ctx.fillStyle = Math.floor(this.time * 3) % 2 ? '#ff5050' : '#a03030';
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('BLOQUEADO', b.door.x + b.door.w / 2, b.door.y - 28);
    }
  }

  _drawConsole(ctx, state) {
    const powered = !state.blackout;
    // (v1.12) La mesa, el monitor CRT y el teclado están en el render de la oficina: aquí solo la
    // imagen del CRT dentro de su cristal, su luz sobre la mesa y las luces piloto de la carcasa
    this._drawMonitorScreen(ctx, state);
    lightPool(ctx, MONITOR.x + MONITOR.w / 2, MONITOR.y + MONITOR.h + 40, 300, '60,255,140', powered ? 0.05 : 0.09);
    // (la ámbar parpadea, la verde fija; sin corriente, solo la ámbar)
    for (const led of CONSOLE_LEDS) {
      const on = led.color === 'ambar' ? Math.sin(this.time * 2.3) > -0.2 : powered;
      if (!on) continue;
      const col = led.color === 'ambar' ? '255,170,60' : '90,255,140';
      const g = ctx.createRadialGradient(led.x, led.y, 0, led.x, led.y, 9);
      g.addColorStop(0, `rgba(${col},0.9)`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(led.x - 9, led.y - 9, 18, 18);
    }
  }

  /**
   * Contenido de la pantalla verde: terminal del apagón, terminal
   * normal (cuando se está escribiendo) o estado del sistema.
   */
  _drawMonitorScreen(ctx, { blackout, terminal, reactor, cameras, gasLeak, orden }) {
    // Monitor CRT de la nave (src/render/CRT.js): el texto, en su cristal
    const rotas = cameras?.broken ? [...cameras.broken].filter((id) => !id.startsWith('v')).length : 0;
    const idle = [];
    if (blackout) {
      // v0.51: solo el fallo y el cursor (el comando se aprende con la cinta 1)
      idle.push({ text: '!! FALLO DE ENERGIA', kind: 'err' });
      // v0.58: el comando, grande y en amarillo (se veía poco)
      idle.push({ text: `ESCRIBA ${CONFIG.BLACKOUT_COMMAND}`, kind: 'warn', big: true });
    } else {
      idle.push({ text: rotas ? `CAMARAS: ${10 - rotas}/10 DAÑADAS` : 'CAMARAS: 10/10 EN LINEA', kind: rotas ? 'err' : 'info' });
      if (cameras?.hasVents) idle.push(cameras.ventsUnlocked ? { text: 'VENTILACION: EN LINEA', kind: 'info' } : { text: 'VENTILACION: SIN SEÑAL', kind: 'err' });
      idle.push({ text: `REACTOR: ${Math.floor(reactor.level)}%`, kind: 'info' });
      if (gasLeak) idle.push({ text: '!! FUGA DE GAS', kind: 'err' });
    }
    // v0.58: el registro de avisos de la noche (los últimos, debajo). Con
    // avisos, el estado se resume en una línea para dejarles sitio.
    if (terminal.log.length && !blackout) {
      const cam = rotas ? `CAM ${10 - rotas}/10` : 'CAM OK';
      const ven = cameras?.hasVents ? (cameras.ventsUnlocked ? ' · VENT OK' : ' · VENT --') : '';
      idle.length = 0;
      idle.push({ text: `${cam}${ven} · R ${Math.floor(reactor.level)}%`, kind: rotas || gasLeak ? 'err' : 'info' });
    }
    // v0.63: una orden que tapa todo lo demás (6:00 de la noche 3: ¡ESCÓNDETE!)
    if (orden) idle.splice(0, idle.length, ...orden);
    const fijas = idle.length;
    if (!orden) idle.push(...terminal.log);
    drawCRT(ctx, MONITOR, (c, w, h, fx) => drawTerminal(c, w, h, fx, terminal, {
      title: blackout ? 'VIGIA-7 // ENERGIA AUX' : gasLeak ? '!! FUGA DE GAS' : 'VIGIA-7 // CONTROL',
      idle,
      fijas,
      status: terminal.statusFn?.() ?? null,
    }), { time: this.time, alert: blackout || gasLeak });
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
