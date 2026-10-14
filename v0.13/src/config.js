// =============================================================
// config.js — Valores GLOBALES ajustables del juego.
//
// Los valores que cambian de una noche a otra (agresividad de los
// enemigos, velocidad del reactor, temperatura de El Congelado,
// apagones...) están en src/night/nights.js.
// =============================================================

export const CONFIG = {
  VERSION: 'v0.13',        // se muestra en el menú; subirla con cada cambio (ver CHANGELOG)

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
  // explota. Ritmos en % por segundo (se multiplican por el
  // reactorMultiplier de cada noche).
  REACTOR: {
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
  SPECIMEN_ROUTES: {
    A: ['greenhouse', 'westHall', 'mess', 'westHall', 'left_door'],
    B: ['reactor', 'greenhouse', 'comms', 'eastHall', 'right_door'],
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
    RUN_STEP_TIME: 1.8,     // segundos que tarda en cruzar cada sala
    RUN_ROUTES: {
      left: ['medbay', 'reactor', 'mess', 'westHall', 'left_door'],
      right: ['medbay', 'comms', 'eastHall', 'right_door'],
    },
    // Grados de margen con los que queda la cápsula al volver a ella.
    RETURN_SAFE_MARGIN: 4,
  },

  // --- Apagón aleatorio de la oficina ---
  BLACKOUT_COMMAND: '/reset',
  // Comandos de la consola que aparecen en el cartel de la oficina.
  // Para añadir uno nuevo, se pone aquí (desde qué noche se muestra)
  // y se programa su efecto en Game._runCommand.
  TERMINAL_COMMANDS: [
    { cmd: '/reset', desc: 'Arregla un apagon (luz y compuertas)', night: 1 },
    { cmd: 'get-update', desc: 'Activa las camaras de ventilacion', night: 2 },
    { cmd: '/InsecP', desc: 'Sella una fuga de gas del insecticida', night: 2 },
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
  // afterIntro: la cuenta del delay no empieza hasta acabar la introducción
  // de la noche (en la 2, ahuyentar a El Insecto con NIGHT2.INTRO.TIME_LIMIT s de margen).
  TAPES: {
    1: { base: 'assets/audio/cintas/noche1', delay: 4 },  // delay: segundos tras llegar a la oficina
    2: { base: 'assets/audio/cintas/noche2', delay: 4, afterIntro: true },
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

  // --- Susto ---
  JUMPSCARE_TIME: 1.5,

  // --- Depuración (solo con ?debug=1 en la URL) ---
  DEBUG_SPEED: 4,         // la tecla T multiplica la velocidad del tiempo
};
