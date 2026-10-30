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
//   - NOCHE 5 (v0.46): estado de Slaimi al empezar (vivo, muerto o
//     congelado) y si hubo desmayo en la noche 4; saltar a las 2:00, 4:00
//     y 6:00 (la fuga); forzar la cara de El Errante en la cámara, apagar
//     las cámaras y ponerlo en una puerta; El Dislocado en cada rejilla;
//     ver la oficina «después de la fuga» (noche 6).
//   - NOCHE 7 (v0.82, ?noche7=1 entra directamente): la cinta (la primera
//     vez, sin poder saltarla), el reintento (con SALTAR), la cinta sin
//     enemigos; saltos a las 12, 2, 3, 4, 5 y 5:59; Slaimi vivo, muerto en la
//     noche 5 (congelado) o en la noche 4 (no aparece), con su estado a la vista.
// =============================================================

import { CONFIG } from '../config.js';
import { SaveData, slaimiDe, ponSlaimi } from '../core/SaveData.js';
import { FINALES, Finales, finalQueToca } from '../core/Finales.js';
import { NIGHT7 } from '../night/night7.js';
import { NIGHT4 } from '../night/night4.js';

const SPH = CONFIG.SECONDS_PER_HOUR;
const ENEMIES = [['specimen', 'Especimen'], ['frozen', 'Congelado'], ['insecto', 'Insecto'], ['largo', 'Largo'], ['errante', 'Errante'], ['dislocado', 'Dislocado'], ['aberracion', 'Aberración']];
const REPAIR_ROOMS = NIGHT4.REPAIR.ROOMS;

export function install(g) {
  const dbg = { off: new Set(), invincible: false, route: 'A', hud: true, open: false, fps: 0, n5slaimi: 'vivo', n5desmayo: false };
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
  #n4dbg{position:fixed;left:96px;top:8px;z-index:99;background:rgba(8,12,10,.93);color:#cfe;font:12px/1.35 "Courier New",monospace;
    border:1px solid #3a6;border-radius:6px;padding:8px 10px;max-width:440px;display:none;user-select:none;
    max-height:calc(100vh - 16px);overflow-y:auto;box-sizing:border-box}
  #n4dbg.min{top:auto;bottom:8px;padding:4px 8px}
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
    // v1.01: «bajar» el panel para que no tape la pantalla
    min: () => { dbg.min = !dbg.min; },
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
      g.save = { ...g.save, flags: ponSlaimi({ ...(g.save?.flags ?? {}) }, 'aliado') };
      if (g.state === 'night' && g.nightNumber === 4) g.slaimi.active = true;
    },
    quitarSlaimi: () => {
      g.save = { ...g.save, flags: ponSlaimi({ ...(g.save?.flags ?? {}) }, 'n4') };
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
    // v0.71 (pedido del usuario: «pon una interfaz de cámara reparada»): la
    // noche 4 por la ruta B con todas las cámaras ya reparadas y el monitor abierto
    camReparada: () => {
      dbg.route = 'B';
      night(1);
      act.reparadas();
      if (g.state === 'night' && !g.cameras.open) g.cameras.toggle();
    },
    reiniciar: () => g._startN4({ save: false }),
    // --- Noche 5 ---
    n5slaimi: (v) => { dbg.n5slaimi = v; },
    n5desmayo: () => { dbg.n5desmayo = !dbg.n5desmayo; },
    n5inicio: () => {
      n5flags();
      g.startNight(5, { save: false });
    },
    n5h: (h) => night5(h),
    n5fuga: () => {
      night5(0);
      g._startN5Leak({ save: false });
    },
    errCara: () => {
      if (g.state !== 'night' || g.nightNumber !== 5) night5(1);
      if (!g.cameras.open) g.cameras.toggle();
      setTimeout(() => g.ai.errante.forceCam(g.world), 600);
    },
    errApaga: () => {
      if (g.state !== 'night' || g.nightNumber !== 5) night5(1);
      g.n5.killCams();
    },
    errPuerta: (side) => {
      if (g.state !== 'night' || g.nightNumber !== 5) night5(1);
      g.ai.errante.forceDoor(g.world, side);
    },
    disRejilla: (side) => {
      if (g.state !== 'night' || g.nightNumber !== 5) night5(2.1);
      g.n5.grilles[side].broken = true;
      g.n5.event = null;
      g.ai.dislocado.peek(g.world, side);
    },
    n6: () => { g.n6preview = !g.n6preview; },
    // --- Noche 6 (v0.73–v0.76): sala oculta, vuelta (Slaimi), turno y final ---
    n6s: (punto) => {
      g._startN6Sala({ save: false });
      if (punto !== 'inicio') g.n6sala.debugIr(punto);
    },
    n6v: (slaimi) => {
      const flags = { ...(g.save?.flags ?? {}) };
      ponSlaimi(flags, { salvado: 'salvado', congelado: 'n5', nada: 'n4' }[slaimi]);   // (v1.11: el dato único)
      g.save = { ...(g.save ?? SaveData.fresh()), flags };
      g.saveEnabled = false;
      g._n6SalaDone();
    },
    n6h: (h) => {
      g.saveEnabled = false;
      g.startNight(6, { save: false, skipStart: true });
      h = Number(h);
      if (h > 0) {
        for (let k = 1; k < Math.floor(h); k++) g.ai.onHour(k);
        g.clock.elapsed = h * CONFIG.SECONDS_PER_HOUR - 0.5;
        g.clock.lastHour = Math.floor(h) - 1;
      }
    },
    n6d: () => {
      if (g.state !== 'night' || !g.n6.active) {
        g.startNight(6, { save: false, skipStart: true });
        g.clock.elapsed = 2.4 * CONFIG.SECONDS_PER_HOUR;
      }
      const id = g.n6.forzar();
      const d = g.n6.desaparecidos[g.n6.desaparecidos.length - 1];
      if (d && !g.cameras.open) g.cameras.toggle();
      if (d) setTimeout(() => g.cameras.select?.(d.room), 400);
      return id ? `Desaparece ${id} (en ${d?.room}). Mira esa cámara.` : 'Ya no queda ninguno.';
    },
    n6f: () => {
      g.saveEnabled = false;
      if (g.state !== 'night' || !g.n6.active) g.startNight(6, { save: false, skipStart: true });
      g._startN6Final({ save: false });
    },
    // --- Noche 6 (v0.72): Fase 1, los conductos ---
    n6c: (punto) => {
      g._startN6({ save: false });
      if (punto !== 'inicio') g.n6ducts.debugIr(punto);
    },
    // --- Noche 7 (v0.82) ---
    // modo: 'cinta' (la primera vez: no se salta), 'reintento' (ya oída: SALTAR), 'sinEnemigos'
    n7: (modo) => {
      const flags = { ...(g.save?.flags ?? {}) };
      if (modo === 'reintento') flags.n7cinta = true;
      else delete flags.n7cinta;
      g.save = { ...(g.save ?? SaveData.fresh()), flags };
      g.saveEnabled = false;
      g.startNight(7, { save: false, n7: { sinEnemigos: modo === 'sinEnemigos' } });
      // (v0.87: también en la partida de la memoria del debug: al morir y reintentar se
      // cargaba la de antes, sin los datos de la noche 6 ni la noche 7)
      SaveData.save(g.save);
    },
    n7h: (h) => {
      g.saveEnabled = false;
      g.startNight(7, { save: false, n7: { saltarCinta: true } });
      SaveData.save(g.save);
      h = Number(h);
      const sph = g.clock.sph;
      const R = NIGHT7.REACTOR;
      if (h >= NIGHT7.HORAS.ABERRACION_REACTOR) g.reactor.level = 85;
      if (h > R.HORA_100) {
        // (pasada la hora del núcleo: ya al 100 %)
        g.n7.nucleo = true;
        g.reactor.level = 100;
        g.reactor.n7 = { rate: 0, tope: 100 };
      }
      if (h > 0) {
        for (let k = 1; k < Math.floor(h); k++) g.ai.onHour(k);
        g.clock.elapsed = h * sph - (h % 1 ? 0 : 0.5);
        g.clock.lastHour = h % 1 ? Math.floor(h) : Math.floor(h) - 1;
      }
    },
    // La Aberración (v0.91): ponerla en el pasillo (posición 0 o 3), en la compuerta o en el reactor
    n7ab: (donde) => {
      if (g.state !== 'night' || !g.n7?.active) act.n7h(2.2);
      const ab = g.n7.ab;
      ab.luz = 0;
      if (donde === 'reactor') { ab.objetivo = 'reactor'; ab.sala = 'lab'; ab.t = 0; }
      else if (donde === 'puerta') { ab.sala = 'pasillo'; ab.pos = 4; ab.t = 0; }
      else { ab.sala = 'pasillo'; ab.pos = Number(donde) || 0; ab.t = 2; }
      if (donde !== 'reactor' && !g.lookBack.facingBack) g.lookBack.goTo('back');
      if (donde === 'reactor') {
        if (!g.cameras.open) g.cameras.toggle();
        setTimeout(() => g.cameras.select?.('reactor'), 400);
      }
    },
    // v0.96: la sala de prueba del fuego nuevo (CAM 05, Criogenia): el cadáver arde, pasa la
    // Aberración, explota la pared y la cámara se quema (sin grieta)
    n7demo05: () => {
      act.n7h(4.6);
      for (const id of ['dislocado', 'errante']) dbg.off.add(id);
      dbg.invincible = true;
      const R = g.n7.rotura;
      const s = R.salas.cryo;
      R.eventoIn = R.explosionIn = 999;          // (solo lo de la demo)
      // (solo se quema la CAM 05, la de la demo; el tiempo de quemarse sí corre)
      R._quemaCamaras = (dt) => {
        const q = R.salas.cryo;
        if (q.quemando >= 0 && !q.quemada && (q.quemando += dt) >= NIGHT7.ROTURA.QUEMA_DURA) { q.quemada = true; q.muerta = true; }
      };
      if (g.ai.errante) g.ai.errante.level = 0;   // (para que no salga de pie en la Criogenia)
      s.focos.cadaver = { nivel: 0.35, on: true };
      if (!g.cameras.open) g.cameras.toggle();
      setTimeout(() => g.cameras.select('cryo'), 300);
      const ab = g.n7.ab;
      setTimeout(() => { ab.sala = 'cryo'; ab.objetivo = 'oficina'; ab.ruta = ['cryo', 'lab']; ab.paso = 0; ab.t = 4; ab.fotogramaSala = 0; }, 4000);
      setTimeout(() => { s.expl = { id: 'pared', t: 0 }; R._son('explosion', { volume: 1 }); R._aviso('cryo', '⚠ EXPLOSIÓN'); }, 9000);
      setTimeout(() => { s.focos.cadaver.nivel = 1; }, 12000);
      setTimeout(() => R._rompe('cryo', 'techo'), 14000);
      setTimeout(() => R._quema('cryo'), 17000);
    },
    // v1.19: el caos de los conductos (sí/no, para comparar a El Dislocado con y sin él) y verlo
    n7caos: (que) => {
      const C = g.n7.conductos;
      if (que === 'si' || que === 'no') { C.activo = que === 'si'; return; }
      if (g.state !== 'night' || !g.n7?.active || que.startsWith('h')) act.n7h(que.startsWith('h') ? que.slice(1) : 4.05);
      if (que.startsWith('h')) setTimeout(() => C.saltaA(Number(que.slice(1))), 300);
      if (!g.cameras.open) g.cameras.toggle();
      if (g.cameras.mapMode !== 'vent') g._toggleMap?.();
      const v = g.cameras.active?.startsWith?.('v') ? g.cameras.active : 'v1';
      if (que === 'fogonazo') setTimeout(() => { C.c[v].fogPend = true; }, 400);
      if (que === 'rafaga') setTimeout(() => { C.c[v].rafaga = 0; }, 400);
      if (que === 'interf') setTimeout(() => { C.c[v].interf = 1.6; }, 400);
    },
    // v0.97: una rejilla de la oficina que explota; una explosión en la cámara que miras
    n7rejilla: (lado) => {
      if (g.state !== 'night' || !g.n7?.active) act.n7h(4.1);
      if (g.cameras.open) g.cameras.toggle();
      if (g.lookBack?.facingBack) g.lookBack.goTo('front');
      setTimeout(() => g.n7.rotura.explotaRejilla(lado), 500);
    },
    n7techo: () => {
      if (g.state !== 'night' || !g.n7?.active) act.n7h(4.1);
      if (!g.cameras.open) g.cameras.toggle();
      setTimeout(() => g.n7.rotura._rompe(g.cameras.active, 'techo'), 500);
    },
    n7expl: () => {
      if (g.state !== 'night' || !g.n7?.active) act.n7h(4.1);
      if (!g.cameras.open) g.cameras.toggle();
      setTimeout(() => g.n7.rotura._explota(false, true), 500);
    },
    // v0.99: más caos (una lámpara que revienta, algo que rueda) y la Aberración ardiendo
    n7lampara: () => {
      if (g.state !== 'night' || !g.n7?.active) act.n7h(4.1);
      if (!g.cameras.open) g.cameras.toggle();
      setTimeout(() => g.n7.rotura.revientaLampara(g.cameras.active), 500);
    },
    n7rueda: () => {
      if (g.state !== 'night' || !g.n7?.active) act.n7h(4.1);
      if (!g.cameras.open) g.cameras.toggle();
      setTimeout(() => g.n7.rotura.rueda(g.cameras.active), 500);
    },
    n7abarde: () => {
      if (g.state !== 'night' || !g.n7?.active) act.n7h(5.1);
      if (!g.cameras.open) g.cameras.toggle();
      setTimeout(() => {
        const A = g.n7.ab;
        const sala = g.cameras.active === 'lab' ? 'mess' : g.cameras.active;
        if (g.cameras.active !== sala) g.cameras.select(sala);
        A.sala = sala; A.objetivo = 'oficina'; A.t = 12; A.ardor = 1;
      }, 500);
    },
    // v1.00: la oficina entera de Blender por estados (OficinaV2): verla sin esperar a la hora
    n7oficina: (estado) => {
      if (g.state !== 'night' || !g.n7?.active) act.n7h(5.1);
      if (g.cameras.open) g.cameras.toggle();
      g.ofv2.forzado = estado === 'auto' ? null : estado;
    },
    n7slaimi: (v) => {
      const flags = { ...(g.save?.flags ?? {}) };
      for (const k of ['n4luz', 'n4camaras']) delete flags[k];
      if (v === 'n4') flags.n4luz = true;
      else flags.n4camaras = true;
      ponSlaimi(flags, v === 'vivo' ? 'salvado' : v);   // (v1.11: el dato único, con su causa)
      g.save = { ...(g.save ?? SaveData.fresh()), flags };
      SaveData.save(g.save);
      if (g.n7?.active) g.n7.slaimi = flags.slaimi;
    },
    // v1.10 (final del juego, Fase 0): los datos que deciden el final
    finErrante: (v) => {
      const flags = { ...(g.save?.flags ?? {}) };
      if (v === 'si') flags.erranteEnCabeza = true;
      else delete flags.erranteEnCabeza;
      g.save = { ...(g.save ?? SaveData.fresh()), flags };
      SaveData.save(g.save);
    },
    // La cara de El Errante en la ruta A (noche 4), a las 5:00, en el sitio elegido
    finCara: (sitio) => {
      const flags = { ...(g.save?.flags ?? {}) };
      delete flags.erranteEnCabeza;
      g.save = { ...(g.save ?? SaveData.fresh()), flags };
      dbg.route = 'A';
      night(NIGHT4.CABEZA.DESDE);
      g.cabeza.hora = NIGHT4.CABEZA.DESDE;
      g.cabeza.sitio = sitio;
      if (g.cameras.open) g.cameras.toggle();
      const cara = sitio === 'compuerta' ? g.cabeza.lado : 'front';
      if (g.lookBack.face !== cara) g.lookBack.goTo(cara);
    },
    // Ruta B: el desmayo por mirarle (activa el dato, con el destello de su cara)
    finDesmayo: () => {
      act.b6();
      g.n4dark._startFaint('lo miró demasiado');
    },
    finMarcar: (n) => { Finales.marcar(n); },
    finBorrar: () => { Finales.borrar(); },
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

  /** Las flags de la partida (en memoria) según el estado elegido para la noche 5. */
  function n5flags() {
    const flags = { ...(g.save?.flags ?? {}) };
    delete flags.finalDesmayo;
    // (v1.11: el dato único. Al EMPEZAR la noche 5 solo puede estar vivo —aliado— o muerto en la
    // noche 4; «congelado» es como acaba la 5, y para probarlo se empieza con él vivo)
    ponSlaimi(flags, dbg.n5slaimi === 'muerto' ? 'n4' : dbg.n5slaimi === 'congelado' ? 'n5' : 'aliado');
    if (dbg.n5desmayo) flags.finalDesmayo = true;
    g.save = { ...(g.save ?? SaveData.fresh()), flags };
  }

  /** La noche 5 (sin salir de la taquilla) a la hora h. Antes de las 2 o las 4, las rejillas como irían. */
  function night5(h) {
    n5flags();
    g.speed = g.speed || 1;
    g.startNight(5, { save: false, skipStart: true });
    if (h >= 4) {
      // La primera rejilla ya está rota (2 AM) y El Dislocado, por los conductos
      g.n5.grilles.left.broken = true;
      g.n5.done2 = true;
      g.ai.dislocado.state = 'away';
      g.ai.dislocado.returnIn = 4;
    }
    if (h > 0) {
      for (let k = 1; k < Math.floor(h); k++) g.ai.onHour(k);
      g.clock.elapsed = h * SPH - 0.5;
      g.clock.lastHour = Math.floor(h) - 1;
      if (h % 1 !== 0) {
        // (a mitad de hora: el evento de esa hora ya ha pasado)
        g.clock.lastHour = Math.floor(h);
        if (h >= 2) {
          g.n5.grilles.right.broken = true;
          g.n5.done2 = true;
          g.ai.dislocado.state = 'away';
          g.ai.dislocado.returnIn = 3;
        }
      }
    }
  }

  /** Ruta A: el final (te duermes), con t s ya pasados. */
  function sleep(t) {
    g.startNight(4, { save: false, n4path: 'A' });
    g._startN4Sleep();
    g.n4sleep.t = t;
  }

  const btn = (label, fn, on = false) => `<button data-a="${fn}" class="${on ? 'on' : ''}">${label}</button>`;
  /** Slaimi como lo ve la partida: «vivo», «muerto (noche 5, congelado)», «muerto (noche 4)» o «-». */
  const slaimiTexto = () => {
    // (v1.11: el texto sale del mismo dato guardado, con su causa)
    return slaimiDe(g.save?.flags)?.texto ?? '- (aún no le conoces)';
  };
  const N7_HORAS = [[0, '12:00'], [2, '2:00'], [3, '3:00'], [4, '4:00'], [5, '5:00'], [5 + 59 / 60, '5:59']];
  const n7Botones = () => {
    const s = slaimiDe(g.save?.flags);
    const cual = !s ? '' : s.estado === 'vivo' ? 'vivo' : s.donde;
    return `<h3>Noche 7 · la cinta</h3>${btn('Cinta (primera vez)', 'n7:cinta')}${btn('Reintento (SALTAR)', 'n7:reintento')}${btn('Cinta sin enemigos', 'n7:sinEnemigos')}
      <h3>Noche 7 · saltar a la hora</h3>${N7_HORAS.map(([h, t]) => btn(t, 'n7h:' + h)).join('')}
      <h3>Noche 7 · la Aberración: ${g.n7?.active ? (g.n7.ab.enPasillo ? `pasillo ${g.n7.ab.sala === 'puerta' ? 'COMPUERTA' : 'pos ' + g.n7.ab.pos} · luz ${Math.round(g.n7.ab.luz * 100)} %` : g.n7.ab.sala) : '-'}</h3>${btn('Al fondo del pasillo', 'n7ab:0')}${btn('Cerca (pos 3)', 'n7ab:3')}${btn('En la compuerta', 'n7ab:puerta')}${btn('Al reactor', 'n7ab:reactor')}
      <h3>Noche 7 · el fuego (v0.96–v0.99)</h3>${btn('Demo CAM 05: fuego, explosión, se quema', 'n7demo05')}${btn('Explota la rejilla izquierda', 'n7rejilla:left')}${btn('Explota la rejilla derecha', 'n7rejilla:right')}${btn('Explosión en la cámara que miras', 'n7expl')}${btn('Cae un panel del techo (cámara que miras)', 'n7techo')}${btn('Revienta una lámpara (cámara que miras)', 'n7lampara')}${btn('Algo rueda por el suelo (cámara que miras)', 'n7rueda')}${btn('La Aberración ardiendo (cámara que miras)', 'n7abarde')}<br>Oficina v2 (Blender): ${btn('5 AM', 'n7oficina:5am')}${btn('según la hora', 'n7oficina:auto')}
      <h3>Noche 7 · el caos de los conductos (v1.19): ${g.n7?.conductos?.activo === false ? 'APAGADO' : 'encendido'}</h3>${btn('Caos: sí', 'n7caos:si', g.n7?.conductos?.activo !== false)}${btn('Caos: no (comparar a El Dislocado)', 'n7caos:no', g.n7?.conductos?.activo === false)}<br>Conductos a las ${btn('4:00', 'n7caos:h4.02')}${btn('4:30', 'n7caos:h4.52')}${btn('5:00', 'n7caos:h5.02')} · en el conducto que miras: ${btn('fogonazo', 'n7caos:fogonazo')}${btn('ráfaga', 'n7caos:rafaga')}${btn('interferencia', 'n7caos:interf')}
      <h3>Slaimi (estado guardado): ${slaimiTexto()}</h3>${btn('Vivo', 'n7slaimi:vivo', cual === 'vivo')}${btn('Muerto en la noche 5 (congelado)', 'n7slaimi:n5', cual === 'n5')}${btn('Muerto en la noche 4', 'n7slaimi:n4', cual === 'n4')}
      ${finBotones()}`;
  };
  // v1.10: el final del juego (Fase 0, los datos). Los saltos a cada fase llegan con cada fase.
  const finBotones = () => {
    const errante = !!g.save?.flags?.erranteEnCabeza;
    const vistos = Finales.vistos();
    return `<h3>Final · toca el ${finalQueToca(g.save?.flags)} · El Errante en la cabeza: ${errante ? 'SÍ' : 'no'}</h3>${btn('Errante: sí', 'finErrante:si', errante)}${btn('Errante: no', 'finErrante:no', !errante)}<br>
      Su cara (noche 4, ruta A, 5:00): ${['ventanal', 'monitor', 'compuerta', 'fuera'].map((s) => btn(s, 'finCara:' + s)).join('')}<br>
      ${btn('Ruta B: desmayo por mirarle', 'finDesmayo')}<br>
      Finales vistos ${vistos.length}/${FINALES.length}: ${FINALES.map((f) => btn('marcar ' + f.n, 'finMarcar:' + f.n, vistos.includes(f.n))).join('')}${btn('borrar', 'finBorrar')}`;
  };
  function render() {
    renderPanel();
    const b = `<button data-a="min" style="float:right">${dbg.min ? '▴ subir' : '▾ bajar'}</button>`;
    panel.classList.toggle('min', !!dbg.min);
    if (dbg.min) panel.innerHTML = b + '<b style="color:#ffd84a">DEBUG</b>';
    else panel.insertAdjacentHTML('afterbegin', b);
  }
  function renderPanel() {
    const ruta = dbg.route;
    if (dbg.soloN7) {
      // Versión debug de la noche 7 (v0.82): solo lo de la noche 7
      panel.innerHTML = `
      <b style="color:#ffd84a">MODO DEBUG · NOCHE 7</b> <span style="opacity:.6">(Ctrl+Shift+F4 · la partida real no se toca)</span>
      ${n7Botones()}
      <h3>Velocidad</h3>${[1, 2, 5].map((v) => btn('x' + v, 'vel:' + v, g.speed === v)).join('')}
      <h3>Enemigos</h3>${btn('Invencible', 'inv', dbg.invincible)}${ENEMIES.filter(([id]) => id === 'errante' || id === 'dislocado' || id === 'aberracion').map(([id, n]) => btn(n + (dbg.off.has(id) ? ' OFF' : ' ON'), 'enemigo:' + id, !dbg.off.has(id))).join('')}
      <h3>Otros</h3>${btn('Información', 'hud', dbg.hud)}${btn('VOLVER A EMPEZAR LA NOCHE 7', 'n7:cinta')}`;
      return;
    }
    if (dbg.soloN6) {
      // Versión debug de la noche 6 (v0.75): solo lo de la noche 6, primero
      panel.innerHTML = `
      <b style="color:#ffd84a">MODO DEBUG · NOCHE 6</b> <span style="opacity:.6">(Ctrl+Shift+F4 · la partida real no se toca)</span>
      <h3>Fase 1 · conductos</h3>${btn('Inicio', 'n6c:inicio')}${btn('Primer cruce (V1)', 'n6c:cruce')}${btn('Camino ciego', 'n6c:ciego')}${btn('La pila', 'n6c:pila')}${btn('Llegada a V4', 'n6c:v4')}<br>
        ${btn('El Insecto de frente', 'n6c:insecto')}${btn('El Dislocado de frente', 'n6c:dislocado')}
      <h3>Fase 2 · sala oculta</h3>${btn('Inicio', 'n6s:inicio')}${btn('Dos válvulas cerradas', 'n6s:valvula')}${btn('Viene uno por el conducto', 'n6s:enemigo')}${btn('Fuga parada: salir', 'n6s:salida')}
      <h3>Fase 3 · vuelta a la oficina</h3>${btn('Slaimi salvado', 'n6v:salvado')}${btn('Slaimi congelado', 'n6v:congelado')}${btn('Sin Slaimi', 'n6v:nada')}
      <h3>Fase 4 · turno de 12 a 6</h3>${[0, 2, 3, 4, 5].map((h) => btn(h ? h + ':00' : '12:00', 'n6h:' + h)).join('')}
      <h3>Fase 5 · final</h3>${btn('La cinemática de las 6:00', 'n6f')}
      <h3>Velocidad</h3>${[1, 2, 5].map((v) => btn('x' + v, 'vel:' + v, g.speed === v)).join('')}
      <h3>Enemigos</h3>${btn('Invencible', 'inv', dbg.invincible)}${ENEMIES.map(([id, n]) => btn(n + (dbg.off.has(id) ? ' OFF' : ' ON'), 'enemigo:' + id, !dbg.off.has(id))).join('')}
      <h3>Otros</h3>${btn('Información', 'hud', dbg.hud)}${btn('VOLVER A EMPEZAR LA NOCHE 6', 'n6c:inicio')}`;
      return;
    }
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
      <h3>Slaimi y cámaras</h3>${btn('Dar Slaimi', 'darSlaimi')}${btn('Quitar Slaimi', 'quitarSlaimi')}${btn('Cámaras reparadas', 'reparadas')}${btn('Cámaras ya reparadas (ruta B, monitor)', 'camReparada')}
      <h3>Noche 5 (v0.46)</h3>Slaimi: ${['vivo', 'muerto', 'congelado'].map((v) => btn(v, 'n5slaimi:' + v, dbg.n5slaimi === v)).join('')}${btn('Desmayo en la noche 4', 'n5desmayo', dbg.n5desmayo)}<br>
        ${btn('Salir de la taquilla', 'n5inicio')}${btn('2:00', 'n5h:2')}${btn('4:00', 'n5h:4')}${btn('6:00 fuga', 'n5fuga')}<br>
        ${btn('Cara de El Errante', 'errCara')}${btn('Apagar cámaras', 'errApaga')}${btn('Errante puerta izq.', 'errPuerta:left')}${btn('Errante puerta der.', 'errPuerta:right')}<br>
        ${btn('Dislocado rejilla izq.', 'disRejilla:left')}${btn('Dislocado rejilla der.', 'disRejilla:right')}${btn('Oficina tras la fuga', 'n6', g.n6preview)}
      <h3>Noche 6 (v0.72) · Fase 1: conductos</h3>${btn('Conductos (inicio)', 'n6c:inicio')}${btn('Primer cruce (V1)', 'n6c:cruce')}${btn('Camino ciego', 'n6c:ciego')}${btn('La pila', 'n6c:pila')}${btn('Llegada a V4', 'n6c:v4')}<br>
        ${btn('El Insecto de frente', 'n6c:insecto')}${btn('El Dislocado de frente', 'n6c:dislocado')}
<br><b>Fase 2 · sala oculta:</b> ${btn('Inicio', 'n6s:inicio')}${btn('Dos válvulas cerradas', 'n6s:valvula')}${btn('Viene uno por el conducto', 'n6s:enemigo')}${btn('Fuga parada: salir', 'n6s:salida')}<br>
        <b>Fase 3 · vuelta:</b> ${btn('Slaimi salvado', 'n6v:salvado')}${btn('Slaimi congelado', 'n6v:congelado')}${btn('Sin Slaimi', 'n6v:nada')}<br>
        <b>Fase 4 · turno:</b> ${[0, 2, 3, 4, 5].map((h) => btn(h ? h + ':00' : '12:00', 'n6h:' + h)).join('')}<br>
        <b>Fase 5 · final:</b> ${btn('La cinemática de las 6:00', 'n6f')}
      ${n7Botones()}
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
    // v0.77: en las pantallas de fin («FIN DEL TURNO», «6:00 AM») el panel se
    // aparta solo, para no tapar el texto; vuelve al seguir jugando
    const fin = g.state === 'lose' || g.state === 'win';
    const ver = dbg.open && !fin ? 'block' : 'none';
    if (panel.style.display !== ver) panel.style.display = ver;
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

  function hora7() {
    const c = g.clock;
    const sph = c.sph ?? SPH;
    const min = Math.floor((c.elapsed % sph) / sph * 60);
    return `${c.hour === 0 ? 12 : c.hour}:${String(min).padStart(2, '0')} AM`;
  }

  function info() {
    const c = g.clock;
    const min = Math.floor((c.elapsed % SPH) / SPH * 60);
    const hora = `${c.hour === 0 ? 12 : c.hour}:${String(min).padStart(2, '0')} AM`;
    const reparadas = g.state === 'n4repair' ? g.n4repair.repaired.size
      : g.n4path === 'A' ? 10 - [...g.cameras.broken].filter((r) => REPAIR_ROOMS.includes(r)).length
        : REPAIR_ROOMS.filter((r) => g.save?.flags?.[`n4rep_${r}`]).length;
    const n7 = g.n7?.active ? [
      `noche 7: ${g.n7.fase}${g.n7.sinEnemigos ? ' (sin enemigos)' : ''}   reactor ${g.reactor.level.toFixed(1)} %${g.n7.nucleo ? '  NÚCLEO AL 100 %' : ''}`,
      `aberración: ${g.n7.ab.sala}${g.n7.ab.enPasillo ? ' pos ' + g.n7.ab.pos : ''}  t ${g.n7.ab.t.toFixed(1)}  luz ${Math.round(g.n7.ab.luz * 100)} %  objetivo ${g.n7.ab.objetivo}${g.n7.linterna ? '  ALUMBRADA' : ''}`,
      `slaimi: ${slaimiTexto()}   cadáveres: ${Object.entries(g.n7.n6?.cadaveres ?? {}).map(([k, v]) => k + '→' + v).join(' ') || '-'}   lente rota: ${g.n7.n6?.lenteRota ?? '-'}`,
    ] : [];
    const lines = dbg.soloN7 ? [
      `NOCHE 7 DEBUG   ${dbg.fps} FPS   x${g.speed}${dbg.invincible ? '   INVENCIBLE' : ''}`,
      `estado: ${g.state}   hora: ${hora7()}`,
      ...n7,
    ] : dbg.soloN6 ? [
      `NOCHE 6 DEBUG   ${dbg.fps} FPS   x${g.speed}${dbg.invincible ? '   INVENCIBLE' : ''}`,
      `estado: ${g.state}   hora: ${hora}`,
      `slaimi: ${g.n6?.slaimi ?? '-'}${g.state === 'n6sala' ? `   fuga ${Math.round((g.n6sala.fuga ?? 0) * 100)}%` : ''}`,
    ] : [
      `NOCHE 4 DEBUG   ${dbg.fps} FPS   x${g.speed}${dbg.invincible ? '   INVENCIBLE' : ''}`,
      `estado: ${g.state}   ruta: ${g.n4path ?? dbg.route}   hora: ${hora}`,
      `fusible: ${g.n4start ? Math.floor(g.n4start.reboot ?? 0) : 0}%   camaras reparadas: ${reparadas}/10`,
      `slaimi: ${g.slaimi?.active ? 'activo' : 'no'} (${g.save?.flags?.slaimiAliado ? 'aliado' : g.save?.flags?.slaimiMuerto ? 'muerto' : '-'})`,
    ];
    for (const [id, n] of ENEMIES) {
      const e = g.ai?.enemies?.find((x) => x.id === id);
      lines.push(`${n.padEnd(10)} ${dbg.off.has(id) ? 'OFF ' : ''}${e ? `${e.room ?? '-'} · ${e.state ?? '-'}${e.atDoor ? ' · puerta ' + e.atDoor : ''}` : '-'}`);
    }
    if (!dbg.soloN7) lines.push(...n7);
    // v1.10: los datos del final
    const cz = g.cabeza;
    lines.push(`final: toca el ${finalQueToca(g.save?.flags)}   errante en la cabeza: ${g.save?.flags?.erranteEnCabeza ? 'SÍ' : 'no'}   vistos ${Finales.vistos().join(',') || '-'}`);
    if (g.nightNumber === 4 && g.n4path === 'A' && cz) lines.push(`su cara: ${cz.fase} · ${cz.sitio}${cz.sitio === 'compuerta' ? ' ' + cz.lado : ''} · a las ${Math.floor(cz.hora)}:${String(Math.floor((cz.hora % 1) * 60)).padStart(2, '0')} · mirada ${cz.mirada.toFixed(1)}/${NIGHT4.CABEZA.MIRAR} s`);
    if (g.state === 'n4sleep') lines.push(`sueño: ${g.n4sleep.t.toFixed(1)} / ${NIGHT4.SLEEP.DURATION} s   etapa ${g.n4sleep.stage}   fase ${g.n4sleep.phase}`);
    if (g.state === 'n4dark') {
      const d = g.n4dark;
      lines.push(`final B: fase ${d.phase}  t ${(d.t ?? 0).toFixed(1)} s  enemigos ${d.enemies.map((e) => `${e.enemy}@${e.side}:${e.state}`).join(' ') || '-'}`);
      if (d.phase === 'defend') lines.push(`slaimi: ${d.scared ? `ASUSTADO ${d.scaredT.toFixed(1)} s` : d.calmT > 0 ? `calmado ${d.calmT.toFixed(1)}` : `susto en ${d.scareIn.toFixed(1)}`}  entrada en ${d.entryIn.toFixed(1)}  margen ${d.gapLeft.toFixed(1)}  bloqueados ${d.blocked}`);
      if (dbg.dosMsg) lines.push(dbg.dosMsg);
      if (d.phase === 'dawn') lines.push(`cam ${g.cameras.active}${g.cameras.open ? '' : ' (bajada)'}  El Errante: imagen ${d.errante.stage}${d.errante.gone ? ' (ya no está)' : ''}  visto ${d.erranteSeen}  mirando ${d.stareT.toFixed(1)}/${NIGHT4.DARK.STARE_LIMIT} s`);
      if (d.phase === 'faint') lines.push(`desmayo: ${d.faintT.toFixed(1)} / ${NIGHT4.DARK.FAINT.END_AT} s`);
    }
    if (g.n5?.active || g.state === 'n5leak') {
      const er = g.ai.errante;
      const di = g.ai.dislocado;
      const gr = g.n5.grilles;
      lines.push(`noche 5: errante ${er.state}${er.doorSide ? ' ' + er.doorSide : ''} ${er.state === 'door' || er.state === 'cam' ? er.t.toFixed(1) + ' s' : ''}  camaras ${g.n5.camsDead ? 'APAGADAS' : 'ok'}${g.n5.repair ? ' reparando ' + g.n5.repair.t.toFixed(1) : ''}`);
      lines.push(`dislocado ${di.state} ${di.room ?? '-'} ${di.side ?? ''} luz ${di.lit.toFixed(1)} ataque ${di.attackT.toFixed(1)}  rejillas izq ${gr.left.broken ? 'ROTA' : gr.left.dent} der ${gr.right.broken ? 'ROTA' : gr.right.dent}`);
      if (g.state === 'n5leak') lines.push(`fuga ${g.n5leak.phase} ${g.n5leak.t.toFixed(1)} s  slaimi ${g.n5leak.slaimi}${g.n5leak.stored ? ' EN LA TAQUILLA' : ''}${g.n5leak.frozenT >= 0 ? ' congelado' : ''}`);
    }
    if (g.state === 'n4start' && g.n4start.largo) lines.push(`El Largo (panel): ${g.n4start.largo.state} ${g.n4start.largo.t.toFixed(1)} s`);
    return lines.join('\n');
  }
  // v0.71 (pedido del usuario: en la versión debug entraba en su partida, la
  // noche 5): con ?noche4=1 empieza directamente la noche 4 y abre el menú
  // v0.75 (pedido del usuario: «una versión debug de la noche 6»): con
  // ?noche6=1 empieza en la noche 6 (los conductos) con el menú abierto
  const qs = new URLSearchParams(location.search);
  const entrada = qs.has('noche7') ? 7 : qs.has('noche6') ? 6 : qs.has('noche4') ? 4 : 0;
  if (entrada) {
    const espera = setInterval(() => {
      if (g.state !== 'menu') return;
      clearInterval(espera);
      if (mem) mem = { ...mem, night: entrada };
      if (entrada === 7) {
        // v0.82: la noche 7 (con los datos de la noche 6 de ejemplo si la partida no los tiene)
        dbg.soloN7 = true;
        const flags = { ...(mem?.flags ?? {}) };
        flags.n6cadaveres ??= { frozen: 'cryo', specimen: 'lab', insecto: 'greenhouse', largo: 'hangar' };
        flags.n6lenteRota ??= 'hangar';
        flags.n6aberracion = true;
        if (!slaimiDe(flags)) { ponSlaimi(flags, 'salvado'); flags.n4camaras = true; }
        g.save = { ...(g.save ?? SaveData.fresh()), night: 7, flags };
        act.n7('cinta');
      } else if (entrada === 6) {
        dbg.soloN6 = true;
        act.n6c('inicio');
      }
      else act.inicio();
      dbg.open = true;
      dbg.active = true;
      panel.style.display = 'block';
      render();
    }, 200);
  }
  console.info('Vigía-7: modo debug de la noche 4 cargado (Ctrl+Shift+F4). La partida guardada no se toca.');
}
