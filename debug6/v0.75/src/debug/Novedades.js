// =============================================================
// Novedades.js — MODO PRUEBA DE LAS NOVEDADES (v0.62).
//
// CÓMO SE ACTIVA: abrir el juego con ?novedades=1 en la dirección
// (http://localhost:8001/?novedades=1, o probar_novedades.bat). El panel
// sale solo; al elegir una novedad se pliega (queda una barra con lo que
// hay que mirar) y el botón «NOVEDADES» de arriba a la izquierda lo abre.
// Como N4Debug.js, este archivo (src/debug/) NO se publica en la versión
// normal (build.py y publicar_web.py dejan fuera src/debug/).
//
// Un botón por cada cosa nueva de la v0.57 a la v0.61: lleva directo a ese
// momento (con los enemigos quietos donde hace falta para que se vean).
// NO TOCA LA PARTIDA GUARDADA (la lee y la guarda en una copia en memoria).
// =============================================================

import { CONFIG } from '../config.js';
import { SaveData } from '../core/SaveData.js';

const SALAS = ['eastHall', 'comms', 'hangar', 'medbay', 'reactor', 'mess', 'greenhouse', 'lab', 'westHall', 'cryo'];
const VENTS = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7'];
const NOMBRE_SALA = { eastHall: 'C. Este', comms: 'Comunic.', hangar: 'Hangar', medbay: 'Enfermería', reactor: 'Reactor', mess: 'Comedor',
  greenhouse: 'Invernadero', lab: 'Laboratorio', westHall: 'C. Oeste', cryo: 'Criogenia' };

export function install(g) {
  window.game = g;
  const st = { open: true, inv: true, msg: 'Elige una novedad.', idx: {}, dis: null };
  g.novedades = st;

  // --- La partida guardada, en memoria (la real no se toca) ---
  let mem = SaveData.load();
  const clone = (d) => (d ? JSON.parse(JSON.stringify(d)) : null);
  SaveData.load = () => clone(mem);
  SaveData.save = (d) => { mem = clone({ ...d, version: 1 }); };
  SaveData.clear = () => { mem = null; };

  // --- Invencible (por defecto): los ataques de los enemigos no matan; los
  // sustos pedidos con su botón sí se ven ---
  let susto = false;
  const setState = g._setState.bind(g);
  g._setState = (s, ...rest) => {
    if (st.inv && (s === 'jumpscare' || s === 'frozenDoor') && !susto && !(s === 'frozenDoor' && st.ruta)) {
      g.attacker = null;
      return;
    }
    return setState(s, ...rest);
  };

  // Pose de cámara de cada enemigo (assets/poses/poses.json)
  let POSES = {};
  fetch('assets/poses/poses.json').then((r) => r.json()).then((d) => { POSES = d; }).catch(() => {});

  const enemigo = (id) => g.ai.enemies.find((e) => e.id === id);
  const quietos = () => g.ai.enemies.forEach((e) => { e.update = () => {}; });
  const noche = (n, extra = {}) => {
    st.dis = null;
    g.startNight(n, { save: false, ...extra });
    g.tape.stop();
    g.blackout.schedule = [];
  };
  const camaras = (room) => {
    if (!g.cameras.open) g.cameras.toggle();
    if (room) {
      g.cameras.mapMode = /^v\d$/.test(room) ? 'vent' : 'main';
      g.cameras.select(room);
    }
  };
  /** El siguiente de una lista, cada vez que se pulsa el mismo botón. */
  const siguiente = (clave, lista) => {
    const i = st.idx[clave] = ((st.idx[clave] ?? -1) + 1) % lista.length;
    return lista[i];
  };
  const asustar = (id) => {
    susto = true;
    g._attack(enemigo(id) ?? { id });
    setTimeout(() => { susto = false; }, 300);
  };

  /** Un enemigo quieto en una cámara con una pose concreta (lejos / media / cerca / rara). */
  function pose(id, n, tipo) {
    // (El Congelado, fuera de la Criogenia: allí la cápsula tapa sus poses)
    const salas = Object.keys(POSES[id] ?? {}).filter((s) => SALAS.includes(s) && POSES[id][s][tipo] && !(id === 'frozen' && s === 'cryo'));
    const sala = siguiente(id + tipo, salas.length ? salas : SALAS);
    noche(n);
    quietos();
    for (const e of g.ai.enemies) if (e.id !== id && e.room === sala) e.room = 'cryo';
    const e = enemigo(id);
    e.state = id === 'frozen' ? 'escaped' : e.state;
    e.room = sala;
    e.camPose = tipo;
    camaras(sala);
    return `${id === 'frozen' ? 'El Congelado' : 'El Espécimen'} · ${tipo} · CAM ${NOMBRE_SALA[sala]} (pulsa otra vez: otra sala)`;
  }

  const act = {
    // --- Noche 6 (v0.73–v0.76): sala oculta, vuelta (Slaimi), turno y final ---
    n6s: (punto) => {
      g._startN6Sala({ save: false });
      if (punto !== 'inicio') g.n6sala.debugIr(punto);
    },
    n6v: (slaimi) => {
      const flags = { ...(g.save?.flags ?? {}) };
      for (const k of ['slaimiTaquilla', 'slaimiCongelado', 'slaimiMuerto', 'slaimiAliado']) delete flags[k];
      if (slaimi === 'salvado') { flags.slaimiTaquilla = true; flags.slaimiAliado = true; }
      if (slaimi === 'congelado') flags.slaimiCongelado = true;
      if (slaimi === 'nada') flags.slaimiMuerto = true;
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
    // --- v0.72: Noche 6, Fase 1 (los conductos) ---
    n6c: (punto) => {
      st.dis = null;
      g._startN6({ save: false });
      if (punto !== 'inicio') g.n6ducts.debugIr(punto);
      return {
        inicio: 'W avanza, S atrás, ESPACIO linterna. Llega a V4 (sigue el minimapa).',
        cruce: 'En el cruce: A, W o D. Prueba el camino equivocado (acaba en una rejilla soldada).',
        ciego: 'Sigue con W hasta la rejilla soldada y vuelve con S al cruce.',
        pila: 'Sigue con W: la pila está en el suelo (la batería sube).',
        v4: 'Sigue con W: empujas la rejilla, te asomas y bajas a la sala oculta.',
        insecto: 'Alúmbralo con ESPACIO hasta que se vaya (la linterna parpadea).',
        dislocado: 'Alúmbralo con ESPACIO hasta que se vaya (tarda más).',
        detras: 'Se le oye por detrás: avanza hasta el cruce y gira para que te pierda.',
      }[punto];
    },
    // --- v0.57 · Noche 3 ---
    puerta: () => {
      noche(3);
      g.clock.elapsed = 185;
      const S = enemigo('specimen');
      S.update = () => {};
      S.room = 'right_door';
      g.lookBack.goTo('right');
      g.office.toggleLight('right');
      return 'Noche 3 · El Espécimen alienígena en la puerta derecha (luz encendida)';
    },
    cryoReq: () => {
      noche(3);
      camaras('cryo');
      g.cryo._pickRequirement();
      return `Noche 3 · CAM 05: requisito «${g.cryo.mode === 'min' ? 'NO BAJAR DE' : 'NO SUBIR DE'} ${g.cryo.target} °C» (pulsa otra vez: otro)`;
    },
    placa: () => {
      noche(3);
      g.lookBack.goTo('back');
      return 'Noche 3 · la placa de la pared de atrás (AVISO 7-C) y el cartel de la noche';
    },
    punos: () => {
      noche(3);
      g.clock.elapsed = 179.3;
      camaras();
      return 'Noche 3 · 3 AM: El Largo rompe las cámaras a puñetazos (espera unos segundos)';
    },
    rotas: () => {
      noche(3);
      g.clock.elapsed = 179.5;
      camaras();
      setTimeout(() => {
        g.n3.skipCine();
        camaras(siguiente('rotas', ['medbay', 'reactor', 'hangar']));
        g.cameras.warnT = 0;
        g.cameraView._senal = { room: g.cameras.active, next: 0, until: 0 };
      }, 400);
      return 'Noche 3 · cámaras rotas (SIN SEÑAL, grieta), estática y parpadeo de la señal';
    },
    terminal: () => {
      act.rotas();
      setTimeout(() => { if (g.cameras.open) g.cameras.toggle(); }, 900);
      return 'Noche 3 · los avisos quedan en la terminal (baja el monitor para leerla)';
    },
    mapa: () => {
      noche(3);
      const L = ['left_door', 'right_door', 'central1', 'hangar', 'cryo', 'mess'];
      g.ai.enemies.forEach((e, i) => { e.update = () => {}; e.room = L[i % L.length]; });
      g.cameras.warnings = true;
      g.cameras.warnT = 0;
      camaras('reactor');
      return 'Minimapa: leyenda dentro del plano; en el de salas, los de las salas y en el de conductos (Tab), los de los conductos (v0.63)';
    },
    apagon: () => {
      noche(3);
      g.blackout.trigger();
      return 'Apagón: «ESCRIBA /reset» grande en la terminal';
    },
    taquilla: () => {
      st.dis = null;
      g._startLockers({ save: false, arrival: true });
      return 'Noche 3 · 6:00: ¡ESCÓNDETE! grande en la terminal, sin cuenta atrás (v0.63)';
    },
    // --- Noche 2 ---
    n2: () => {
      noche(2);
      return 'Noche 2 · inicio: get-update a tiempo y luego ahuyenta a El Insecto en V6 con el insecticida (v0.63)';
    },
    // --- Noche 5 ---
    interf: () => {
      noche(5, { skipStart: true });
      camaras('hangar');
      g.n5.killCams();
      camaras('mess');
      return 'Noche 5 · interferencia violeta de El Errante (cámaras sin imagen)';
    },
    // --- v0.58 · El Espécimen alienígena ---
    espLejos: () => pose('specimen', 1, 'lejos'),
    espMedia: () => pose('specimen', 1, 'media'),
    espCerca: () => pose('specimen', 1, 'cerca'),
    espSusto: () => { noche(1); asustar('specimen'); return 'Susto de El Espécimen'; },
    // --- v0.60 / v0.61 · El Dislocado ---
    dis: (tipo) => {
      noche(5, { skipStart: true });
      quietos();
      const v = siguiente('dis' + tipo, tipo === 'lejos' ? ['v1', 'v3', 'v5', 'v7'] : tipo === 'media' ? ['v2', 'v4', 'v6'] : VENTS);
      const d = enemigo('dislocado');
      d.state = 'vent';
      d.room = v;
      st.dis = { room: v, tipo };
      g.cameras.ventsUnlocked = true;
      camaras(v);
      const que = { lejos: 'se va de espaldas', media: 'cruza de lado', cerca: 'viene de frente' }[tipo];
      return `El Dislocado · ${tipo} (${que}) · conducto ${v.toUpperCase()} (pulsa otra vez: otro)`;
    },
    disAbolla: () => {
      if (!(g.state === 'night' && g.nightNumber === 5) || st.dis) noche(5, { skipStart: true });
      quietos();
      const n = siguiente('abolla', [1, 2, 3, 4, 5]);
      for (const s of ['left', 'right']) g.n5.grilles[s].dent = n;
      if (g.cameras.open) g.cameras.toggle();
      return `El Dislocado · rejillas golpeadas (abolladura ${n} de 5)`;
    },
    disAsoma: (side) => {
      noche(5, { skipStart: true });
      g.clock.elapsed = 2.1 * CONFIG.SECONDS_PER_HOUR;
      g.clock.lastHour = 2;
      g.n5.grilles[side].broken = true;
      g.n5.event = null;
      enemigo('dislocado').peek(g.world, side);
      if (g.cameras.open) g.cameras.toggle();
      return `El Dislocado asomado por la rejilla ${side === 'left' ? 'izquierda' : 'derecha'} (pasa el ratón por encima para alumbrarle)`;
    },
    disSusto: () => { noche(5, { skipStart: true }); asustar('dislocado'); return 'Susto de El Dislocado'; },
    // --- v0.61 · El Congelado ---
    cryo: () => {
      const paso = siguiente('cryo', ['dormido', 'inquieto', 'saliendo', 'vacia']);
      if (!(g.state === 'night' && g.nightNumber === 1) || !st.cryoOk) { noche(1); st.cryoOk = true; }
      const F = enemigo('frozen');
      F.update = () => {};
      if (paso === 'dormido') { F.state = 'asleep'; F.alarm = 0; }
      if (paso === 'inquieto') { F.state = 'warning'; F.alarm = F.cfg.grace * 0.4; }
      if (paso === 'saliendo') { F.state = 'warning'; F.alarm = F.cfg.grace * 0.9; }
      if (paso === 'vacia') F.state = 'escaped';
      camaras('cryo');
      return `CAM 05 · ${{ dormido: 'tranquilo (encogido, ojos apagados)', inquieto: 'inquieto (de pie, ojos encendidos)', saliendo: 'la mano en el cristal', vacia: 'rota y vacía' }[paso]} (pulsa otra vez: siguiente estado)`;
    },
    cgCorre: () => {
      st.cryoOk = false;
      const lado = siguiente('corre', ['left', 'right']);
      const hall = lado === 'left' ? 'westHall' : 'eastHall';
      noche(1);
      const F = enemigo('frozen');
      F.state = 'escaped';
      F.route = CONFIG.CRYO.RUN_ROUTES[lado];
      F.routeIndex = F.route.indexOf(hall) + 1;
      F.room = hall;
      F.stepTimer = CONFIG.CRYO.HALL_RUN_TIME;
      camaras(hall);
      return `El Congelado corre por el ${hall === 'westHall' ? 'C. Oeste (hacia la cámara)' : 'C. Este (hacia la compuerta del fondo)'} · pulsa otra vez: el otro pasillo (v0.64)`;
    },
    // --- v0.66 · todo lo nuevo, en orden ---
    pared: () => {
      noche(3);
      if (g.cameras.open) g.cameras.toggle();
      g.lookBack.goTo('front');
      return 'La pared de los conductos (frente): ya no sale blanca, se ven rejillas, ventanal y cartel; baja y sube el monitor (Espacio) para ver que no hay destello (v0.65)';
    },
    cgSala: () => {
      // la carrera de UNA sala, en su cámara (Enfermería, Reactor, Comedor, Invernadero, C. Oeste, Hangar, Comunic., C. Este)
      const [lado, sala] = siguiente('cgSala', [['left', 'medbay'], ['left', 'reactor'], ['left', 'mess'], ['left', 'greenhouse'], ['left', 'westHall'],
        ['right', 'medbay'], ['right', 'hangar'], ['right', 'comms'], ['right', 'eastHall']]);
      st.cryoOk = false;
      noche(1);
      const F = enemigo('frozen');
      F.state = 'escaped';
      F.rastro = {};
      F.route = CONFIG.CRYO.RUN_ROUTES[lado];
      F.routeIndex = F.route.indexOf(sala) + 1;
      F.room = sala;
      F.stepTimer = ['westHall', 'eastHall'].includes(sala) ? CONFIG.CRYO.HALL_RUN_TIME : CONFIG.CRYO.RUN_STEP_TIME;
      F.update = () => { F.stepTimer -= 1 / 60; };      // (se queda en esa sala: mira la carrera y el rastro de escarcha)
      camaras(sala);
      return `Carrera por ${NOMBRE_SALA[sala]} (ruta ${lado === 'left' ? 'izquierda' : 'derecha'}): cruza corriendo y deja el rastro de escarcha, que se queda (pulsa otra vez: la siguiente sala)`;
    },
    cgFrio: () => {
      st.cryoOk = false;
      const lado = siguiente('cgFrio', ['left', 'right']);
      noche(1);
      const F = enemigo('frozen');
      F._escape(g.world);
      F.route = CONFIG.CRYO.RUN_ROUTES[lado];
      F.routeIndex = F.route.length - 2;
      F.room = F.route[F.routeIndex - 1];
      F.stepTimer = 30;
      F.update = () => {};
      if (g.cameras.open) g.cameras.toggle();
      g.lookBack.goTo(lado);
      return `El frío antes que él (corre hacia la compuerta ${lado === 'left' ? 'izquierda' : 'derecha'}): escarcha en la pantalla y en el marco, vaho, la luz de la puerta parpadeando; mira la terminal (frente): «TEMPERATURA DE LA OFICINA BAJANDO» (pulsa otra vez: el otro lado)`;
    },
    cgMuerte: () => {
      st.cryoOk = false;
      noche(1);
      g.attacker = 'frozen';
      g.deathCause = 'frozen';
      g._setState('lose');
      g.audio.frozenViento?.();
      return 'Pantalla de muerte de El Congelado: escarcha que se derrite, el texto, la pista y el viento helado';
    },
    alu: () => {
      const sala = siguiente('alu', ['reactor', 'cryo']);
      g.startNight(4, { save: false, n4path: 'A', skipStart: true });
      g.tape.stop();
      g.blackout.schedule = [];       // (al saltar a las 3 AM se disparaban los apagones de antes)
      g.blackout.extraIn = null;
      g.clock.elapsed = 3 * CONFIG.SECONDS_PER_HOUR;
      g.clock.lastHour = 3;
      g._halluStart();
      camaras(sala);
      return `Noche 4 (ruta A), 3 AM: la grabación de ${sala === 'reactor' ? 'la sala del Reactor (CAM 04)' : 'la Criogenia (CAM 05)'} con El Congelado nuevo (pulsa otra vez: la otra)`;
    },
    n2cinta: () => {
      st.dis = null;
      g.startNight(2, { save: false });
      return 'Noche 2: la cinta empieza nada más empezar la noche (antes, a los 4 s)';
    },
    // --- v0.66 · El Congelado 10/10 ---
    cgRuta: () => {
      st.cryoOk = false;
      const lado = siguiente('cgRuta', ['left', 'right']);
      noche(1);
      const F = enemigo('frozen');
      st.ruta = true;               // (en la compuerta, aunque seas invencible, se ve el susto: ciérrala a tiempo)
      F._escape(g.world);
      F.route = CONFIG.CRYO.RUN_ROUTES[lado];
      camaras(F.route[0]);
      return `El Congelado escapa por la ruta ${lado === 'left' ? 'izquierda (09 → 04 → 06 → 03 → 07)' : 'derecha (09 → 01 → 10 → 08)'}: síguele por las cámaras; en la compuerta tienes 2,6 s + 0,5 s para cerrar (pulsa otra vez: la otra ruta) (v0.66)`;
    },
    cgSalto: () => {
      st.cryoOk = false;
      noche(1);
      asustar('frozen');
      return 'El salto de El Congelado: una de sus 3 variantes al azar (pulsa otra vez: otra) (v0.66)';
    },
    cgLejos: () => { st.cryoOk = false; return pose('frozen', 1, 'lejos'); },
    cgMedia: () => { st.cryoOk = false; return pose('frozen', 1, 'media'); },
    cgCerca: () => { st.cryoOk = false; return pose('frozen', 1, 'cerca'); },
    cgSusto: () => {
      // v0.66b: llega a la compuerta abierta; la noche sigue (la vista NO se
      // gira): mírala y cierra en 2,6 s + 0,5 s, o se gira y salta
      st.cryoOk = false;
      const lado = siguiente('cgSusto', ['left', 'right']);
      noche(1);
      const F = enemigo('frozen');
      st.ruta = true;
      F.state = 'escaped';
      F.route = CONFIG.CRYO.RUN_ROUTES[lado];
      F.routeIndex = F.route.length;
      F.room = lado === 'left' ? 'left_door' : 'right_door';
      F.rastro = {};
      F.puerta = { side: lado, t: 0, silencio: false };
      g.events.emit('frozenPuerta', { enemy: F, side: lado });
      if (g.cameras.open) g.cameras.toggle();
      return `El Congelado llega a la compuerta ${lado === 'left' ? 'izquierda' : 'derecha'}: se le oye venir por ese lado; gírate y pulsa PUERTA en 2,6 s + 0,5 s; si no, la vista se gira y se te echa encima, con la oficina detrás (pulsa otra vez: la otra)`;
    },
    // --- Retiradas de las 6:00 (noche 4, ruta B) ---
    retirada: () => {
      st.dis = null;
      g.startNight(4, { save: false, n4path: 'B' });
      g._startN4Dark({ at: 'seis', save: false });
      return '6:00 de la noche 4 (ruta B): mira las cámaras. Congelado: C. Oeste e Invernadero · Espécimen: C. Este, Comunic. y Hangar · también El Insecto y El Largo';
    },
    // --- Otros ---
    inv: () => { st.inv = !st.inv; return st.inv ? 'Invencible: los enemigos no matan' : 'Invencible apagado'; },
    vel: () => { g.speed = g.speed === 1 ? 3 : 1; return `Velocidad x${g.speed}`; },
  };

  // --- Interfaz ---
  const css = document.createElement('style');
  css.textContent = `
  #novbtn{position:fixed;left:8px;top:8px;z-index:100;font:bold 12px "Courier New",monospace;background:#ffd84a;color:#110;border:0;border-radius:4px;padding:4px 8px;cursor:pointer}
  #novdbg{position:fixed;left:8px;top:36px;z-index:99;background:rgba(8,12,10,.94);color:#cfe;font:12px/1.35 "Courier New",monospace;
    border:1px solid #3a6;border-radius:6px;padding:8px 10px;width:360px;max-height:calc(100vh - 50px);overflow:auto;user-select:none}
  #novdbg h3{margin:7px 0 2px;font-size:12px;color:#7dffb0}
  #novdbg button{font:11px "Courier New",monospace;background:#132;color:#cfe;border:1px solid #3a6;border-radius:3px;margin:2px;padding:2px 6px;cursor:pointer}
  #novdbg button.on{background:#3a6;color:#021}
  #novmsg{margin-top:8px;padding:5px 6px;background:#021;border-left:3px solid #ffd84a;color:#ffe9a0;white-space:normal}
  #novbar{position:fixed;left:118px;top:8px;z-index:100;max-width:calc(100vw - 140px);font:12px "Courier New",monospace;background:rgba(0,0,0,.8);
    color:#ffe9a0;border-left:3px solid #ffd84a;padding:4px 8px;pointer-events:none}`;
  document.head.appendChild(css);
  const boton = document.createElement('button');
  boton.id = 'novbtn';
  boton.textContent = 'NOVEDADES';
  const panel = document.createElement('div');
  panel.id = 'novdbg';
  const barra = document.createElement('div');
  barra.id = 'novbar';
  document.body.append(boton, panel, barra);

  const b = (label, fn, on = false) => `<button data-a="${fn}" class="${on ? 'on' : ''}">${label}</button>`;
  function render() {
    panel.style.display = st.open ? 'block' : 'none';
    barra.style.display = st.open ? 'none' : 'block';
    barra.textContent = st.msg;
    boton.textContent = st.open ? 'NOVEDADES ▲' : 'NOVEDADES ▼';
    panel.innerHTML = `
      <b style="color:#ffd84a">PRUEBA DE NOVEDADES · v0.57 → v0.66</b><br><span style="opacity:.6">La partida guardada no se toca.</span>
      <h3>v0.72 · Noche 6, Fase 1: los conductos</h3>
        ${b('Conductos (inicio)', 'n6c:inicio')}${b('Primer cruce (V1)', 'n6c:cruce')}${b('Camino ciego', 'n6c:ciego')}${b('La pila', 'n6c:pila')}${b('Llegada a V4', 'n6c:v4')}<br>
        ${b('El Insecto de frente', 'n6c:insecto')}${b('El Dislocado de frente', 'n6c:dislocado')}${b('Viene por detrás', 'n6c:detras')}
      <h3>v0.73–v0.76 · Noche 6, fases 2 a 5</h3>
        Sala: ${b('Inicio', 'n6s:inicio')}${b('Dos cerradas', 'n6s:valvula')}${b('Viene uno', 'n6s:enemigo')}${b('Fuga parada', 'n6s:salida')}<br>
        Vuelta: ${b('Slaimi salvado', 'n6v:salvado')}${b('Slaimi congelado', 'n6v:congelado')}${b('Sin Slaimi', 'n6v:nada')}<br>
        Turno: ${[0, 2, 3, 4, 5].map((h) => b(h ? h + ':00' : '12:00', 'n6h:' + h)).join('')}<br>
        Final: ${b('La cinemática de las 6:00', 'n6f')}
      <h3>v0.66 · El Congelado 10/10 (todo lo nuevo)</h3>
        ${b('Pared de los conductos', 'pared')}${b('CAM 05: 4 estados', 'cryo')}${b('Carrera sala a sala', 'cgSala')}<br>
        ${b('Escapa (ruta entera)', 'cgRuta')}${b('El frío antes que él', 'cgFrio')}${b('Compuerta: cierra o no', 'cgSusto')}<br>
        ${b('Salto (3 variantes)', 'cgSalto')}${b('Pantalla de muerte', 'cgMuerte')}${b('Lejos', 'cgLejos')}${b('Media', 'cgMedia')}${b('Cerca', 'cgCerca')}<br>
        ${b('Alucinaciones (noche 4 A)', 'alu')}${b('Retirada de las 6:00', 'retirada')}${b('Noche 2: cinta al empezar', 'n2cinta')}
      <h3>Noche 3 (v0.57 · v0.59)</h3>
        ${b('Espécimen en la puerta', 'puerta')}${b('CAM 05: requisito', 'cryoReq')}${b('Placa de atrás', 'placa')}<br>
        ${b('3 AM: puñetazos', 'punos')}${b('Cámaras rotas y parpadeo', 'rotas')}${b('Avisos en la terminal', 'terminal')}<br>
        ${b('Minimapa y colores', 'mapa')}${b('Apagón /reset', 'apagon')}${b('6:00 ¡Escóndete!', 'taquilla')}
      <h3>Noche 2 y noche 5</h3>
        ${b('Noche 2: get-update', 'n2')}${b('Noche 5: interferencia', 'interf')}
      <h3>El Espécimen alienígena (v0.58)</h3>
        ${b('Lejos', 'espLejos')}${b('Media', 'espMedia')}${b('Cerca', 'espCerca')}${b('Susto', 'espSusto')}
      <h3>El Dislocado (v0.60 · v0.61)</h3>
        ${b('Conducto: se va', 'dis:lejos')}${b('Conducto: de lado', 'dis:media')}${b('Conducto: de frente', 'dis:cerca')}<br>
        ${b('Rejillas golpeadas', 'disAbolla')}${b('Asomado izq.', 'disAsoma:left')}${b('Asomado der.', 'disAsoma:right')}${b('Susto', 'disSusto')}
      <h3>El Congelado (v0.61)</h3>
        ${b('Corre por el pasillo (v0.64)', 'cgCorre')}
      <h3>Retiradas de las 6:00</h3>
        ${b('Escena de las 6:00 (noche 4 B)', 'retirada')}
      <h3>Opciones</h3>${b('Invencible', 'inv', st.inv)}${b('Velocidad x3', 'vel', g.speed !== 1)}
      <div id="novmsg">${st.msg}</div>`;
  }
  boton.addEventListener('click', (e) => { e.stopPropagation(); st.open = !st.open; render(); });
  boton.addEventListener('mousedown', (e) => e.stopPropagation());
  panel.addEventListener('mousedown', (e) => e.stopPropagation());
  panel.addEventListener('click', (e) => {
    e.stopPropagation();
    const a = e.target?.dataset?.a;
    if (!a) return;
    const [name, arg] = a.split(':');
    try {
      g._ensureAudio?.();
      st.msg = act[name](arg) ?? st.msg;
      if (!['inv', 'vel'].includes(name)) st.open = false;   // el panel no tapa lo que se prueba
    } catch (err) {
      st.msg = 'No se ha podido: ' + err.message;
      console.warn('Novedades:', err);
    }
    render();
  });

  // El Dislocado se queda con la pose pedida mientras se le mira
  const tick = () => {
    const d = st.dis;
    const ps = g.cameraView?.poses;
    if (d && ps && g.state === 'night') {
      const id = Object.keys(POSES.dislocado?.[d.room] ?? {}).find((k) => k.replace(/\d+$/, '') === d.tipo) ?? d.tipo;
      ps.state.dislocado = { room: d.room, id, t: 0, total: 0, next: 1e9, same: 0 };
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  render();
  console.info('Vigía-7: prueba de novedades cargada (?novedades=1). La partida guardada no se toca.');
}
