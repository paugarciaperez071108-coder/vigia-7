// =============================================================
// N4Debug.js — MODO DEBUG EXCLUSIVO DE LA NOCHE 4 (v0.38).
//
// CÓMO SE ACTIVA: abrir el juego con ?n4debug=1 en la dirección
// (por ejemplo http://localhost:8001/?n4debug=1) y pulsar Ctrl+Shift+F4.
// No aparece en ningún menú. Este archivo (src/debug/) NO se publica:
// build.py y publicar_web.py lo dejan fuera, y sin él el juego no carga
// nada (Game.js lo importa solo si existe).
//
// NO TOCA LA PARTIDA GUARDADA: mientras está cargado, SaveData guarda y
// lee de una copia en memoria (empieza como copia de la partida real, que
// no se modifica). Al recargar la página sin ?n4debug=1, todo vuelve a ser
// como antes.
//
// Menú:
//   - Ruta A (reactivar la luz) o B (ruta Slaimi, reparar las cámaras).
//   - Saltar a una hora: inicio, 3 AM, 4 AM, inicio del sueño, 6 AM.
//   - Saltar a momentos clave: salir de la taquilla, abrir el panel del
//     fusible, reparar una cámara, El Largo con Slaimi, volver al armario,
//     caída al suelo.
//   - Ruta B, final (v0.41): saltar a las 5:00 (apagón) o a las 6:00 (la
//     escena final) y VER AL ENEMIGO NUEVO en cualquier cámara.
//   - Velocidad x1, x2, x5. Invencibilidad. Cada enemigo encendido/apagado.
//   - Dar o quitar a Slaimi; marcar las cámaras como reparadas.
//   - Información en pantalla (hora, ruta, enemigos, % del fusible,
//     cámaras reparadas, FPS). Reiniciar la noche.
// =============================================================

import { CONFIG } from '../config.js';
import { SaveData } from '../core/SaveData.js';
import { NIGHT4 } from '../night/night4.js';

const SPH = CONFIG.SECONDS_PER_HOUR;
const ENEMIES = [['specimen', 'Especimen'], ['frozen', 'Congelado'], ['insecto', 'Insecto'], ['largo', 'Largo']];
const REPAIR_ROOMS = NIGHT4.REPAIR.ROOMS;

export function install(g) {
  const dbg = { off: new Set(), invincible: false, route: 'A', hud: true, open: false, fps: 0 };
  g.n4dbg = dbg;
  window.game = g;

  // --- La partida guardada, en memoria (la real no se toca) ---
  let mem = SaveData.load();
  const clone = (d) => (d ? JSON.parse(JSON.stringify(d)) : null);
  SaveData.load = () => clone(mem);
  SaveData.save = (d) => { mem = clone({ ...d, version: 1 }); };
  SaveData.clear = () => { mem = null; };
  dbg.memSave = () => clone(mem);

  // --- Invencibilidad: los ataques no llegan a la pantalla de muerte ---
  const setState = g._setState.bind(g);
  g._setState = (s, ...rest) => {
    if (dbg.invincible && s === 'jumpscare') {
      g.attacker = null;
      dbg.blocked = (dbg.blocked ?? 0) + 1;
      return;
    }
    return setState(s, ...rest);
  };

  // --- Interfaz ---
  const css = document.createElement('style');
  css.textContent = `
  #n4dbg{position:fixed;left:8px;top:8px;z-index:99;background:rgba(8,12,10,.93);color:#cfe;font:12px/1.35 "Courier New",monospace;
    border:1px solid #3a6;border-radius:6px;padding:8px 10px;max-width:440px;display:none;user-select:none}
  #n4dbg h3{margin:4px 0 2px;font-size:12px;color:#7dffb0}
  #n4dbg button{font:11px "Courier New",monospace;background:#132;color:#cfe;border:1px solid #3a6;border-radius:3px;margin:2px;padding:2px 6px;cursor:pointer}
  #n4dbg button.on{background:#3a6;color:#021}
  #n4hud{position:fixed;right:8px;bottom:8px;z-index:98;background:rgba(0,0,0,.72);color:#bfffd6;font:11px/1.35 "Courier New",monospace;
    padding:6px 8px;border-radius:4px;white-space:pre;pointer-events:none;display:none}`;
  document.head.appendChild(css);
  const panel = document.createElement('div');
  panel.id = 'n4dbg';
  const hud = document.createElement('div');
  hud.id = 'n4hud';
  document.body.append(panel, hud);

  const act = {
    ruta: (r) => { dbg.route = r; },
    inicio: () => night(0),
    h3: () => night(NIGHT4.HALLU.HOUR),
    h4: () => night(NIGHT4.VOICES.HOUR),
    sueno: () => (dbg.route === 'A' ? sleep(0) : night(NIGHT4.SLEEP.START)),
    h6: () => (dbg.route === 'A' ? sleep(30) : night(CONFIG.NIGHT_HOURS - 1 / SPH)),
    taquilla: () => g._startN4({ save: false }),
    panel: () => {
      g._startN4({ save: false, at: 'reboot' });
      g.n4start.phase = 'panel';
      g.n4start._openLid();
    },
    camara: () => {
      g._startN4Repair({ save: false });
      const n = g.n4repair;
      n._enter('reactor');
      n.flash.on = true;
      n.where = 'panel';
      n._screwState();
    },
    slaimi: () => {
      g._startN4Repair({ save: false });
      const n = g.n4repair;
      for (const r of REPAIR_ROOMS) n.repaired.add(r);
      n._enter('mess');
      n._startEncounter();
    },
    armario: () => {
      sleep(0);
      g.n4sleep.look.goTo('back');
    },
    caida: () => {
      sleep(0);
      g.n4sleep._startFall();
    },
    b5: () => {
      dbg.route = 'B';
      g.startNight(4, { save: false, n4path: 'B' });
      g._startN4Dark({ at: 'cinco', save: false });
    },
    b5esc: () => {
      act.b5();
      g.n4dark._hide();
    },
    b6: () => {
      dbg.route = 'B';
      g.startNight(4, { save: false, n4path: 'B' });
      g._startN4Dark({ at: 'seis', save: false });
    },
    b450: () => {
      dbg.route = 'B';
      night(NIGHT4.DARK.WARN_AT);
    },
    errante: () => { dbg.errante = !dbg.errante; },
    desmayo: () => {
      act.b6();
      g.n4dark._startFaint('debug');
    },
    // Intenta meter dos enemigos a la vez a oscuras: el segundo debe quedar bloqueado
    dos: () => {
      if (g.state !== 'n4dark' || g.n4dark.phase !== 'defend') act.b5esc();
      const d = g.n4dark;
      d.gapLeft = 0;
      const a = d._spawn('left');
      const b = d._spawn('right');
      const vivos = d.enemies.filter((e) => e.state !== 'gone').length;
      dbg.dosMsg = `forzar dos: 1º ${a ? 'entra' : 'bloqueado'} · 2º ${b ? 'ENTRA (FALLO)' : 'bloqueado'} · dentro ${vivos}`;
      console.info('Vigía-7 debug:', dbg.dosMsg);
    },
    vel: (v) => { g.speed = v; },
    inv: () => { dbg.invincible = !dbg.invincible; },
    enemigo: (id) => { if (dbg.off.has(id)) dbg.off.delete(id); else dbg.off.add(id); },
    darSlaimi: () => {
      g.save = { ...g.save, flags: { ...(g.save?.flags ?? {}), slaimiAliado: true } };
      delete g.save.flags.slaimiMuerto;
      if (g.state === 'night' && g.nightNumber === 4) g.slaimi.active = true;
    },
    quitarSlaimi: () => {
      g.save = { ...g.save, flags: { ...(g.save?.flags ?? {}), slaimiMuerto: true } };
      delete g.save.flags.slaimiAliado;
      g.slaimi.active = false;
    },
    reparadas: () => {
      const flags = { ...(g.save?.flags ?? {}) };
      for (const r of REPAIR_ROOMS) flags[`n4rep_${r}`] = true;
      g.save = { ...g.save, flags };
      if (g.state === 'n4repair') for (const r of REPAIR_ROOMS) g.n4repair.repaired.add(r);
      if (g.state === 'night') {
        g.cameras.broken.clear();
        g.cameras.warnings = false;
      }
    },
    reiniciar: () => g._startN4({ save: false }),
    hud: () => { dbg.hud = !dbg.hud; },
  };
  dbg.act = act;

  /** La noche 4 (turno de cámaras) por la ruta elegida, a la hora h. */
  function night(h) {
    g.speed = g.speed || 1;
    g.startNight(4, { save: false, n4path: dbg.route });
    if (h > 0) {
      for (let k = 1; k < Math.floor(h); k++) g.ai.onHour(k);
      g.clock.elapsed = h * SPH - 0.5;
      g.clock.lastHour = Math.floor(h) - 1;
    }
  }

  /** Ruta A: el final (te duermes), con t s ya pasados. */
  function sleep(t) {
    g.startNight(4, { save: false, n4path: 'A' });
    g._startN4Sleep();
    g.n4sleep.t = t;
  }

  const btn = (label, fn, on = false) => `<button data-a="${fn}" class="${on ? 'on' : ''}">${label}</button>`;
  function render() {
    const ruta = dbg.route;
    panel.innerHTML = `
      <b style="color:#ffd84a">MODO DEBUG · NOCHE 4</b> <span style="opacity:.6">(Ctrl+Shift+F4 · la partida real no se toca)</span>
      <h3>Ruta</h3>${btn('A · luz', 'ruta:A', ruta === 'A')}${btn('B · Slaimi', 'ruta:B', ruta === 'B')}
      <h3>Saltar a la hora</h3>${btn('Inicio', 'inicio')}${btn('3 AM', 'h3')}${btn('4 AM', 'h4')}${btn('Inicio del sueño', 'sueno')}${btn('6 AM', 'h6')}
      <h3>Momentos</h3>${btn('Salir de la taquilla', 'taquilla')}${btn('Panel del fusible', 'panel')}${btn('Reparar una cámara', 'camara')}
        ${btn('El Largo y Slaimi', 'slaimi')}${btn('Volver al armario', 'armario')}${btn('Caída al suelo', 'caida')}
      <h3>Ruta B · final (v0.43)</h3>${btn('4:50 aviso', 'b450')}${btn('5:00 apagón', 'b5')}${btn('5:00 ya escondido', 'b5esc')}${btn('6:00 escena', 'b6')}
        ${btn('Ver a El Errante en la cámara', 'errante', dbg.errante)}${btn('Final del desmayo', 'desmayo')}${btn('Forzar dos enemigos (5:00)', 'dos')}
      <h3>Velocidad</h3>${[1, 2, 5].map((v) => btn('x' + v, 'vel:' + v, g.speed === v)).join('')}
      <h3>Enemigos</h3>${btn('Invencible', 'inv', dbg.invincible)}${ENEMIES.map(([id, n]) => btn(n + (dbg.off.has(id) ? ' OFF' : ' ON'), 'enemigo:' + id, !dbg.off.has(id))).join('')}
      <h3>Slaimi y cámaras</h3>${btn('Dar Slaimi', 'darSlaimi')}${btn('Quitar Slaimi', 'quitarSlaimi')}${btn('Cámaras reparadas', 'reparadas')}
      <h3>Otros</h3>${btn('Información', 'hud', dbg.hud)}${btn('REINICIAR LA NOCHE', 'reiniciar')}`;
  }
  panel.addEventListener('mousedown', (e) => e.stopPropagation());
  panel.addEventListener('click', (e) => {
    e.stopPropagation();
    const a = e.target?.dataset?.a;
    if (!a) return;
    const [name, arg] = a.split(':');
    try {
      g._ensureAudio?.();
      act[name](arg === undefined ? undefined : (isNaN(+arg) ? arg : +arg));
    } catch (err) {
      console.warn('N4Debug:', err);
    }
    render();
  });
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'F4') {
      e.preventDefault();
      dbg.open = !dbg.open;
      dbg.active = true;
      panel.style.display = dbg.open ? 'block' : 'none';
      render();
    }
  }, true);

  // --- Cada momento: enemigos apagados, información en pantalla, FPS ---
  let frames = 0;
  let last = performance.now();
  const tick = (now) => {
    frames++;
    if (now - last >= 500) {
      dbg.fps = Math.round(frames * 1000 / (now - last));
      frames = 0;
      last = now;
      sync();
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  function sync() {
    for (const e of g.ai?.enemies ?? []) {
      const off = dbg.off.has(e.id);
      if (off && !e._dbgOff) {
        e._dbgUpdate = e.update;
        e.update = () => {};
        e._dbgOff = true;
      } else if (!off && e._dbgOff) {
        e.update = e._dbgUpdate;
        e._dbgOff = false;
      }
    }
    hud.style.display = dbg.active && dbg.hud ? 'block' : 'none';
    if (hud.style.display === 'block') hud.textContent = info();
  }

  function info() {
    const c = g.clock;
    const min = Math.floor((c.elapsed % SPH) / SPH * 60);
    const hora = `${c.hour === 0 ? 12 : c.hour}:${String(min).padStart(2, '0')} AM`;
    const reparadas = g.state === 'n4repair' ? g.n4repair.repaired.size
      : g.n4path === 'A' ? 10 - [...g.cameras.broken].filter((r) => REPAIR_ROOMS.includes(r)).length
        : REPAIR_ROOMS.filter((r) => g.save?.flags?.[`n4rep_${r}`]).length;
    const lines = [
      `NOCHE 4 DEBUG   ${dbg.fps} FPS   x${g.speed}${dbg.invincible ? '   INVENCIBLE' : ''}`,
      `estado: ${g.state}   ruta: ${g.n4path ?? dbg.route}   hora: ${hora}`,
      `fusible: ${g.n4start ? Math.floor(g.n4start.reboot ?? 0) : 0}%   camaras reparadas: ${reparadas}/10`,
      `slaimi: ${g.slaimi?.active ? 'activo' : 'no'} (${g.save?.flags?.slaimiAliado ? 'aliado' : g.save?.flags?.slaimiMuerto ? 'muerto' : '-'})`,
    ];
    for (const [id, n] of ENEMIES) {
      const e = g.ai?.enemies?.find((x) => x.id === id);
      lines.push(`${n.padEnd(10)} ${dbg.off.has(id) ? 'OFF ' : ''}${e ? `${e.room ?? '-'} · ${e.state ?? '-'}${e.atDoor ? ' · puerta ' + e.atDoor : ''}` : '-'}`);
    }
    if (g.state === 'n4sleep') lines.push(`sueño: ${g.n4sleep.t.toFixed(1)} / ${NIGHT4.SLEEP.DURATION} s   etapa ${g.n4sleep.stage}   fase ${g.n4sleep.phase}`);
    if (g.state === 'n4dark') {
      const d = g.n4dark;
      lines.push(`final B: fase ${d.phase}  t ${(d.t ?? 0).toFixed(1)} s  enemigos ${d.enemies.map((e) => `${e.enemy}@${e.side}:${e.state}`).join(' ') || '-'}`);
      if (d.phase === 'defend') lines.push(`slaimi: ${d.scared ? `ASUSTADO ${d.scaredT.toFixed(1)} s` : d.calmT > 0 ? `calmado ${d.calmT.toFixed(1)}` : `susto en ${d.scareIn.toFixed(1)}`}  entrada en ${d.entryIn.toFixed(1)}  margen ${d.gapLeft.toFixed(1)}  bloqueados ${d.blocked}`);
      if (dbg.dosMsg) lines.push(dbg.dosMsg);
      if (d.phase === 'dawn') lines.push(`cam ${g.cameras.active}${g.cameras.open ? '' : ' (bajada)'}  El Errante: imagen ${d.errante.stage}${d.errante.gone ? ' (ya no está)' : ''}  visto ${d.erranteSeen}  mirando ${d.stareT.toFixed(1)}/${NIGHT4.DARK.STARE_LIMIT} s`);
      if (d.phase === 'faint') lines.push(`desmayo: ${d.faintT.toFixed(1)} / ${NIGHT4.DARK.FAINT.END_AT} s`);
    }
    if (g.state === 'n4start' && g.n4start.largo) lines.push(`El Largo (panel): ${g.n4start.largo.state} ${g.n4start.largo.t.toFixed(1)} s`);
    return lines.join('\n');
  }
  console.info('Vigía-7: modo debug de la noche 4 cargado (Ctrl+Shift+F4). La partida guardada no se toca.');
}
