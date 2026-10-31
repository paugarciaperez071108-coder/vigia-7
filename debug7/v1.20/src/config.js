// =============================================================
// config.js — Valores GLOBALES ajustables del juego.
//
// Los valores que cambian de una noche a otra (agresividad de los
// enemigos, velocidad del reactor, temperatura de El Congelado,
// apagones...) están en src/night/nights.js.
// =============================================================

export const CONFIG = {
  VERSION: 'v1.20',        // se muestra en el menú; subirla con cada cambio (ver CHANGELOG)

  // Resolución lógica: todo se dibuja en 1600×900 y luego se escala
  // a la ventana manteniendo la proporción (con bandas negras).
  WIDTH: 1600,
  HEIGHT: 900,

  // --- Reloj ---
  SECONDS_PER_HOUR: 60,   // segundos reales que dura cada hora de juego
  NIGHT_HOURS: 6,         // de 12 AM a 6 AM

  // --- Oficina ---
  DOOR_ANIM_TIME: 0.22,   // segundos que tarda la compuerta en bajar/subir

  // --- Cámaras ---
  MONITOR_ANIM_TIME: 0.25,    // segundos que tarda el monitor en subir/bajar
  // Segundos de estática fuerte al cambiar de cámara. Durante ese
  // tiempo NO cuenta como "mirar": subirlo hace más caro ir saltando
  // entre cámaras.
  CAMERA_SWITCH_STATIC: 0.3,
  // Estática cuando un enemigo entra o sale de la sala que estás viendo.
  CAMERA_MOVE_GLITCH: 0.8,

  // --- Reactor (sustituye a la energía) ---
  // La temperatura del reactor SUBE sola poco a poco durante la noche
  // y, además, al usar compuertas y luces. Si llega a 100, la nave
  // explota. Ritmos en % por segundo. Es IGUAL en todas las noches
  // (el ritmo de la noche 1): para cambiarlo, solo SPEED.
  REACTOR: {
    SPEED: 1.0,             // multiplicador global de todos los ritmos (todas las noches)
    START: 10,              // temperatura al empezar la noche
    PASSIVE_RATE: 0.22,     // calentamiento solo (noche de 360 s → +79 %)
    DOOR_RATE: 0.12,        // extra por cada compuerta cerrada
    LIGHT_RATE: 0.15,       // extra por cada luz encendida
    MONITOR_RATE: 0,        // el monitor no calienta el reactor
    WARNING_LEVEL: 85,      // a partir de aquí suena la alarma
    // Enfriamiento (botón en la CAM 04). Usos por noche: coolCharges
    // en nights.js.
    COOL_AMOUNT: 15,        // % que baja cada enfriamiento
    COOL_DURATION: 6,       // segundos que dura (compuertas y luces bloqueadas)
    // true  = al enfriar, las compuertas se abren solas
    // false = se quedan como estaban, pero no se pueden mover
    COOL_OPENS_DOORS: false,
    // Riesgo de apagón: cada enfriamiento suma este riesgo. Al acabar
    // el enfriamiento se tira el dado; si sale, hay un apagón entre
    // COOL_BLACKOUT_DELAY[0] y [1] segundos después.
    COOL_BLACKOUT_RISK: 0.3,
    COOL_BLACKOUT_DELAY: [4, 15],
  },

  // --- Enemigos que atacan por las compuertas ---
  // Intervalo (s) entre "oportunidades de movimiento" de cada uno.
  // En cada oportunidad se tira un número del 1 al 20: si sale <= que
  // su nivel de IA, actúa.
  // (El Insecto y El Largo tienen los suyos en night/night2.js.)
  INTERVALS: {
    specimen: 5.0,
  },
  // Al llegar a una compuerta, el enemigo espera un tiempo aleatorio
  // entre estos valores antes de intentar entrar. Es el margen que
  // tienes para verlo con la luz y cerrar.
  DOOR_WAIT_MIN: 5,
  DOOR_WAIT_MAX: 9,

  // --- El Espécimen (CAM 02) ---
  WALL_STAGES: 4,          // grietas que necesita el muro para romperse
  // Solo por conexiones del plano (StationMap.js), desde el Laboratorio
  SPECIMEN_ROUTES: {
    A: ['reactor', 'mess', 'greenhouse', 'westHall', 'left_door'],
    B: ['reactor', 'medbay', 'hangar', 'comms', 'eastHall', 'right_door'],
  },

  // --- El Insecto, El Largo y la fuga de gas (noche 2 en adelante) ---
  // Todos sus valores están en src/night/night2.js.

  // --- El Congelado (CAM 05) ---
  CRYO: {
    START_TEMP: -18,        // temperatura inicial de la cápsula (°C)
    MIN_TEMP: -40,          // límites del panel
    MAX_TEMP: 5,
    // Cuántos grados como máximo puedes "adelantar" por el lado seguro
    // del requisito. Evita que subas/bajes 40 grados y te olvides.
    MAX_SAFE_MARGIN: 8,
    // Al salir de la cápsula, El Congelado CORRE hacia la oficina por
    // una de estas rutas (se ve en las cámaras). Si llega y la
    // compuerta está abierta, te mata al instante; si está cerrada,
    // vuelve a su cápsula.
    RUN_STEP_TIME: 3.0,     // segundos que tarda en cruzar cada sala (v0.66: 1,8 → 3: se le ve correr por cada cámara)
    HALL_RUN_TIME: 4.5,     // v0.64: s que tarda en cruzar el último pasillo, a la carrera (se le ve correr hacia la compuerta)
    // v0.66: en la compuerta abierta, la vista se gira sola hacia ella. Desde
    // ahí: MARGEN s corriendo por el pasillo + SILENCIO s quieto en la puerta
    // (sin sonido) antes de saltar; cerrar en ese tiempo lo detiene siempre.
    PUERTA: { MARGEN: 2.6, SILENCIO: 0.5, VUELTA: 0.9 },
    RUN_ROUTES: {
      // Sale de Criogenia por el conducto oculto a la Enfermería
      left: ['medbay', 'reactor', 'mess', 'greenhouse', 'westHall', 'left_door'],
      right: ['medbay', 'hangar', 'comms', 'eastHall', 'right_door'],
    },
    // Grados de margen con los que queda la cápsula al volver a ella.
    RETURN_SAFE_MARGIN: 4,
  },

  // --- Apagón aleatorio de la oficina ---
  BLACKOUT_COMMAND: '/reset',
  // Comandos de la consola que aparecen en el cartel de la oficina.
  // Para añadir uno nuevo, se pone aquí (desde qué noche se muestra;
  // until: última noche en la que existe)
  // y se programa su efecto en Game._runCommand.
  TERMINAL_COMMANDS: [
    { cmd: '/reset', desc: 'Arregla un apagon (luz y compuertas)', night: 1 },
    { cmd: 'get-update', desc: 'Activa las camaras de ventilacion', night: 2, until: 2 },  // solo la noche 2
    { cmd: '/InsecP', desc: 'Sella una fuga de gas del insecticida', night: 2 },
    { cmd: 'resetcam', desc: 'Reinicia las camaras (10 s)', night: 5 },
  ],
  BLACKOUT_EARLIEST_HOUR: 1,  // los apagones caen entre estas horas
  BLACKOUT_LATEST_HOUR: 5,

  // --- Ruidos de la nave (src/audio/AmbientSounds.js) ---
  // Cada cuánto suenan se ajusta por noche (ambient en nights.js).
  AMBIENT: {
    DEFAULT_INTERVAL: [25, 50],   // segundos entre ruidos si la noche no dice nada
    VOLUME: 0.55,
    // [tipo de la biblioteca (assets/audio/sfx/biblioteca.json), peso]
    SOUNDS: [
      ['caidas/lata', 3], ['caidas/herramienta', 2], ['caidas/bandeja', 2], ['caidas/silla', 1], ['caidas/caja', 1],
      ['tropiezos/tropiezo', 1], ['tropiezos/caja_herramientas', 1],
      ['metal/golpe_pared', 2], ['metal/tuberia', 2], ['metal/panel', 1], ['metal/cristal', 1],
      ['ambiente/crujido', 3], ['ambiente/goteo', 2], ['ambiente/chispazo', 2], ['ambiente/ventilacion', 2],
      ['pasos/metal', 1],
    ],
    // El Largo, mientras está en una sala: respira o gruñe cada tantos segundos
    LARGO_IDLE: [9, 16],
    LARGO_VOLUME: 0.9,
  },

  // --- Cintas del "hombre de la cinta" ---
  // base: ruta sin extensión. Se busca primero <base>_mia.(ogg|mp3|wav|m4a)
  // (grabación propia) y si no existe, <base>.(ogg|mp3) (voz generada
  // con tools/generar_cinta.py). Subtítulos en el .json del mismo nombre.
  // voz: quién habla (NORMA DE VOCES, CLAUDE.md): 'hombre' solo en turnos
  // de cámaras; 'mujer' solo en minijuegos.
  TAPES: {
    1: { base: 'assets/audio/cintas/noche1', delay: 4, voz: 'hombre' },  // delay: segundos tras llegar a la oficina
    2: { base: 'assets/audio/cintas/noche2', delay: 0.4, voz: 'hombre' },   // v0.66 (pedido del usuario): nada más empezar, para saber qué hacer con El Insecto
    // Noche 3: suena a la vez que El Largo se acerca por el pasillo central
    3: { base: 'assets/audio/cintas/noche3', delay: 2, voz: 'hombre' },
    // "Cinta 3.5": nada más empezar el evento de las 3 AM de la noche 3
    '3_5': { base: 'assets/audio/cintas/noche3_5', delay: 0.6, voz: 'hombre' },
    // Noche 4: al empezar el turno de cámaras (los dos caminos). PREPARADA:
    // aún no hay guion ni audio (noche4.ogg/.mp3 o noche4_mia.*); sin
    // archivo no suena nada.
    4: { base: 'assets/audio/cintas/noche4', delay: 4, voz: 'hombre' },
    // Noche 4, ruta A: el hombre en el PANEL DEL FUSIBLE (excepción a la norma de
    // voces decidida por el usuario: contexto 'panel_n4'). Suena al abrir el panel.
    '4A': { base: 'assets/audio/cintas/noche4_rutaA', delay: 0.8, voz: 'hombre' },
    // Noche 4, ruta B (Slaimi): la mujer, al empezar a reparar las cámaras (minijuego).
    '4B': { base: 'assets/audio/cintas/mujer_noche4', delay: 1.5, voz: 'mujer' },
    // Noche 5: el hombre, al empezar el turno de cámaras (tras salir de la
    // taquilla). PREPARADA: aún no hay guion ni audio (noche5.ogg/.mp3 o
    // noche5_mia.*); sin archivo no suena nada.
    5: { base: 'assets/audio/cintas/noche5', delay: 5, voz: 'hombre' },
    // Noche 7 (v0.82): la última grabación del hombre, nada más empezar; mientras
    // suena, la noche no corre (src/systems/Night7.js). Guion:
    // guiones/guion_cinta_noche7.md (Fase 2).
    7: { base: 'assets/audio/cintas/noche7', delay: 1.2, voz: 'hombre' },
    // "Audio 2.5": suena al coger la linterna a las 6 AM de la noche 2.
    // Voz propia: assets/audio/cintas/mujer_noche2_mia.(wav|mp3|ogg|m4a)
    mujer: { base: 'assets/audio/cintas/mujer_noche2', delay: 0, voz: 'mujer' },
  },
  TAPE_VOLUME: 1.0,          // volumen de la cinta (va aparte del volumen general)
  TAPE_DUCK_VOLUME: 0.35,    // volumen mientras suena un aviso importante
  TAPE_DUCK_TIME: 3,         // segundos que dura esa bajada tras cada aviso
  TAPE_AMBIENCE_LEVEL: 0.45, // el ambiente baja a este nivel mientras suena la cinta

  // --- Final de noche con el conducto (si la noche tiene endingDuct) ---
  // A las 6 AM algo metálico se acerca por el conducto; al llegar se va
  // la luz y, tras unos segundos a oscuras, sale "Turno completado".
  ENDING: {
    APPROACH_TIME: 5,       // segundos que tarda en acercarse
    DARK_TIME: 2.5,         // segundos a oscuras antes de la pantalla final
  },

  // Franjas en las esquinas de abajo: dejar el ratón DWELL s para girarse.
  // --- Girar entre las 4 paredes de la oficina (src/systems/OfficeTurn.js) ---
  OFFICE_TURN: {
    EDGE: 70,               // px desde el borde izquierdo/derecho que giran la vista
    DWELL: 0.12,            // s con el ratón en el borde para girar
    TURN_TIME: 0.35,        // s que dura cada giro de 90°
  },
  // --- Pasillo central (la pared de atrás de la oficina) ---
  LOOK_BACK: {
    FROM_NIGHT: 3,          // desde esta noche hay linterna mirando al pasillo central
    KEY: 'KeyV',            // tecla: ir al pasillo central / volver al frente (pasando por un lado)
  },

  // --- Enemigos a oscuras que se oyen (src/systems/LurkSounds.js, v0.45) ---
  // Mientras un enemigo está y no se le alumbra: respiración o pasos suaves
  // por su lado (fases con linterna de la noche 4; la 2.5 no).
  LURK: {
    EVERY: [2.5, 4.5],      // s entre sonidos
    FIRST: [0.8, 2.0],      // s hasta el primero (tras aparecer)
    VOLUME: 0.2,            // volumen (bajito)
    SIDE_PAN: 0.85,         // cuánto a la izquierda / derecha
    MUFFLE: 0.35,           // apagado de los de los lados
    BACK_VOLUME: 0.8,       // los de atrás (o al fondo): × este volumen…
    BACK_MUFFLE: 0.6,       // …y más apagados (en el centro)
  },

  // --- Susto ---
  JUMPSCARE_TIME: 1.5,      // s hasta la pantalla de derrota (el final, en negro)
  // v0.51 (src/ui/Jumpscare.js): se abalanza en LUNGE s, impacto hasta CUT
  // y corte a negro. Menos de 1 s de impacto.
  JUMPSCARE: {
    LUNGE: 0.45,
    CUT: 0.9,
    SHAKE: 60,              // px de temblor en el impacto
    BLUR: 0.35,             // opacidad de la estela de movimiento
  },

  // --- Ruido de las cámaras (v0.51; antes 0,14 y 0,18) ---
  CAM_NOISE: { STATIC: 0.07, GRAIN: 0.12 },   // (v0.54: estática base 0,1 → 0,07; el grano va en CAM_LOOK)
  // --- Aspecto común de TODAS las cámaras (v0.54): el mismo sistema de
  // vigilancia viejo. La curvatura de la lente va en los renders
  // (tools/3d/lente.py); aquí, lo que se pinta encima en el juego.
  CAM_LOOK: {
    DARK: 0.33,       // oscurecimiento general (antes 0,25)
    VIGNETTE: 1.0,    // viñeta (antes 0,8)
    CORNERS: 0.75,    // esquinas de la lente angular, aún más oscuras
    GRAIN: 0.15,      // grano (sustituye a CAM_NOISE.GRAIN)
    // v0.77 · cámara de seguridad de verdad (src/render/CamaraSeguridad.js; el usuario: todas las noches)
    CA: 1.6,          // px de aberración cromática (rojo y azul desplazados)
    BLOQUES: 0.8,     // compresión digital al cambiar de cámara o con movimiento fuerte (0 = nada)
    BLOQUES_AZAR: 0.02, // probabilidad, cada fotograma, de unos pocos bloques sueltos
    ESTELA: 0.7,      // desenfoque de movimiento al cambiar de cámara
  },

  // --- CAM 05: la cápsula de El Congelado (v0.51) ---
  // El grano y la estática de la cámara borraban su silueta (pálida sobre
  // el cristal escarchado). Después de los efectos se vuelve a pintar el
  // cristal de la cápsula central con esta opacidad (0 = como antes).
  CRYO_POD: {
    CLARITY: 0,       // v0.54: con la cámara de la esquina y su luz ya se le ve (antes 0,6; dibujaba una caja)
    RECT: { x: 786, y: 440, w: 176, h: 312, r: 30 }, // el cristal en la imagen 1600×900 (v0.54: lo sustituye assets/salas/criogenia.json → capsula)
  },

  // --- Poses de los enemigos en las cámaras (src/render/CamPoses.js) ---
  CAM_POSES: {
    CHANGE_EVERY: [6, 10],  // s entre intentos de cambiar de pose mientras se le mira
    CHANGE_CHANCE: 0.55,    // probabilidad de cambiar en cada intento (siempre a otra pose)
    MAX_SAME: 16,           // s como mucho en la misma pose (v0.51; antes podía estar ~30 s)
    TIME_TO_NEAR: 45,       // s en la misma sala que suman +1 al avance (se acerca a la lente)
    NEAR_BOOST: 3.2,        // cuánto más probable es la pose cerca cuanto más avanzado está
    RARE_WEIGHT: 0.55,      // peso de la pose rara (baja probabilidad)
    GLITCH_TIME: 0.3,       // s de fallo de imagen al cambiar de pose
    NEAR_STATIC: 0.22,      // estática extra con un enemigo pegado a la lente
    NEAR_SHAKE: 7,          // px de temblor con un enemigo pegado a la lente
  },

  // --- Depuración (solo con ?debug=1 en la URL) ---
  DEBUG_SPEED: 4,         // la tecla T multiplica la velocidad del tiempo
};
