// =============================================================
// night2ending.js — Valores ajustables del FINAL DE LA NOCHE 2.
//
// A las 6 AM de la noche 2 no se gana: se va la luz (y no hay energía:
// las puertas de la oficina no funcionan), hay que coger la linterna y
// recorrer la nave LIBREMENTE hasta el reactor (Fase 1), escribir
// /refresh y aguantar mientras se enfría (Fase 2), y volver a la oficina
// por donde se quiera (Fase 3). Las salidas de cada sala son las
// conexiones del plano (LINKS de StationMap.js).
// La lógica está en src/ending/Night2Ending.js.
//
// MECÁNICA DE LA LUZ (Fase 1 y Fase 2)
//   Los enemigos son INVISIBLES hasta que se les enfoca con la linterna.
//   Al aparecer hay FIND_TIME s para darles con la luz EN LA CARA. Con la
//   luz en la cara intentan apartarse cada EVADE_EVERY s:
//     - cambian de POSTURA → POSE_WINDOW s (2) para volver a enfocar la cara
//     - cambian de SITIO   → MOVE_WINDOW s (3,5) para encontrarlo y enfocarlo
//   Con RETIRE_TIME s de luz en la cara en total, se retira. Si no se
//   reacciona a tiempo, ataca. Mientras se le esté siguiendo bien, NO
//   puede atacar.
// =============================================================

export const N2END = {
  // Ayuda de controles (pequeña, abajo a la izquierda): solo estos s al
  // empezar cada fase (v0.51; sin textos que digan qué hacer)
  HINT_TIME: 6,

  // --- Linterna ---
  FLASH_RADIUS: 250,            // radio del haz (px lógicos; v0.51: antes 210)
  FLASH_SOFT: 0.72,             // 0-1: cuánto del radio es borde difuminado (v0.51: antes 0,55)
  FLASH_DARKNESS: 0.95,         // opacidad de la oscuridad fuera del haz (v0.51: antes 0,975; se intuye la sala)
  FLICKER_EVERY: [7, 15],       // segundos entre parpadeos (solo visual)
  FLICKER_TIME: [0.05, 0.22],   // duración de cada parpadeo

  // --- Mecánica de la luz ---
  POSE_WINDOW: 2.0,             // s para volver a enfocar la cara si cambia de POSTURA
  MOVE_WINDOW: 3.5,             // s para encontrarlo y enfocarlo si cambia de SITIO
  RETIRE_TIME: 3.0,             // s de luz en la cara (en total) para que se retire
  EVADE_EVERY: [0.7, 1.3],      // s con la luz en la cara entre un intento de apartarse y otro
  MOVE_CHANCE: 0.45,            // al apartarse: probabilidad de cambiar de sitio (si no, de postura)
  FACE_RADIUS: 12,              // tamaño del "blanco" de la cara (en % de la altura del enemigo)
  FACE_RADIUS_MIN: 34,          // ... pero nunca menos de estos px
  FIND_TIME: 5,                 // Fase 1: s desde que aparece hasta que ataca si no se le enfoca
  ENEMY_HEIGHT: [560, 700],     // Fase 1: altura en pantalla (px): cuanto más, más cerca

  // --- Inicio de la Fase 1 (v0.51) ---
  // Al coger la linterna: estos s sin enemigos (suena la cinta de la mujer
  // y se aprende a usar la linterna). Después, el primer enemigo es fácil.
  START_SAFE: 18,
  FIRST_ENEMY: { FIND: 9, RETIRE: 2.0 },   // s para encontrarlo · s de luz para que se vaya (no se aparta)

  // --- Enemigos dentro de una sala (Fase 1) ---
  // Al entrar en una sala (que no sea el reactor ni una ya despejada), con
  // esta probabilidad hay uno. Para que se encuentre al menos uno antes del
  // reactor: si llega a una sala junto al reactor sin haberse cruzado con
  // ninguno, aparece seguro.
  P1_ROOM_CHANCE: 0.35,

  // --- Enemigo en una puerta de la oficina (sin energía: no se cierran) ---
  // En todo el final no hay energía: los botones de las puertas no
  // funcionan ("Sin energía"). Antes de salir (tras coger la linterna) y al
  // volver (Fase 3) puede haber alguien en una puerta: invisible sin luz;
  // con la linterna se le ve en el marco o al fondo del pasillo, y se le
  // aparta con la MISMA mecánica de la luz (puede pasar de una puerta a
  // la otra). Salir por una puerta con alguien ahí = fallo.
  OFFICE_ENEMY_CHANCE: 0.5,     // al coger la linterna (Fase 1)
  OFFICE_ENEMY_DELAY: [2, 5],   // s hasta que aparece (con aviso por su lado)
  OFFICE_ENEMY_FIND: 6,         // s para encontrarlo con la luz

  // --- Parpadeo de la linterna cuando un enemigo se retira ---
  // Señal de que el peligro ha pasado; mientras dura no aparece ninguno.
  RETIRE_FLICKERS: 3,           // número de parpadeos
  RETIRE_FLICKER_TIME: 0.8,     // s que dura todo el parpadeo

  // --- Reactor ---
  LINTERNA_CERCA: 2.6,  // (v1.66) m hasta la linterna de la mesa para poder cogerla, sin apuntarle
  CONSOLA_CERCA: 3.5,  // (v1.65) m hasta la consola del reactor para poder usarla, sin apuntarle
  CONSOLA_E: 0.6,    // (v1.63, el usuario: «como un cofre») s manteniendo E para abrir la consola del reactor
  // (v1.59) lo que hay escrito en la consola del reactor al llegar (se corta a media palabra a propósito)
  CONSOLA_MSG: ['REGISTRO DE TURNO  05:47', 'LA PARED DEL LABORATORIO SUENA OTRA VEZ.', 'SI ALGUIEN LEE ESTO,', 'NO ABRAIS LA SALA DE ATR'],
  COMMAND: '/refresh',          // está escrito en el pósit junto a la consola

  // --- Fase 2 ---
  P2_DIRECTO: true,             // (v1.67, el usuario) en el enfriamiento, alumbrar a un enemigo lo hace desaparecer al momento
  COOL_TIME: 120,               // s que tarda el reactor en enfriarse (2:00; el % sube a este ritmo)
  P2_FLASH_SCALE: 0.8,          // tamaño del haz en la Fase 2 (0,8 = 20 % más pequeño)
  P2_FLASH_INTENSITY: 0.8,      // fuerza de la luz en la Fase 2 (1 = como en las Fases 1 y 3; v0.51: antes 0,65)
  P2_VOLUME: 0.6,               // volumen de los sonidos en la Fase 2 (0,6 = 40 % más bajo)
  P2_CUE_BOOST: 1.35,           // los avisos de enemigos se bajan algo menos (×1,35 → ~0,8)
  // Más agresivos según avanza el %: desde AT, apariciones más seguidas
  // (SPAWN multiplica el intervalo) y menos tiempo para reaccionar (WINDOW).
  P2_AGGRO: [
    { AT: 0.5, SPAWN: 0.8, WINDOW: 0.9 },
    { AT: 0.8, SPAWN: 0.65, WINDOW: 0.8 },
  ],
  // La sala del fondo de cada pasillo sale sola del plano: las tres
  // conexiones del reactor (P2_ROOMS en FirstPersonView.js).
  FIND_TIME_P2: 6,              // s para encontrarlo y enfocarlo (hay que girarse)
  FIRST_SPAWN: 5,               // s hasta el primer enemigo
  SPAWN_EVERY: [8, 13],         // s entre enemigos nuevos
  MAX_ENEMIES: 2,               // como mucho, tantos a la vez (uno por pasillo)
  TURN_EDGE: 260,               // px desde el borde de la pantalla que giran la vista
  TURN_SPEED: 3.2,              // velocidad del giro de la vista

  // --- Al 100 %: reinicio y protocolo de contención levantado ---
  ALARM_TIME: 7,                // s de megafonía, luces rojas y puertas abriéndose antes de la huida
  PA_FILE: 'assets/audio/voces/megafonia_reinicio.ogg',   // tools/generar_megafonia.py

  // --- Huida a la oficina (misma ruta, al revés) ---
  ESCAPE: {
    // v0.51: más tensa (antes 40 s, 0,25, máx. 2: se llegaba en 16 s con un enemigo)
    TIME: 32,                   // s de cuenta atrás
    ROOM_CHANCE: 0.65,          // probabilidad de enemigo al entrar en cada sala
    MIN_ENEMIES: 2,             // como mínimo, tantos encuentros en la vuelta
    MAX_ENEMIES: 3,             // como mucho, tantos en toda la vuelta
    OFFICE_ENEMY_CHANCE: 0.5,   // al llegar a la oficina, alguien en una puerta
    ARRIVE_CALM: 1.5,           // s en la oficina sin nadie en las puertas → escena del pasillo
    FIND_TIME: 3.5,             // más agresivos que en la Fase 1: menos tiempo para todo
    POSE_WINDOW: 1.4,
    MOVE_WINDOW: 2.4,
    RETIRE_TIME: 2.0,
    RED_PERIOD: 1.1,            // s entre destellos de la luz roja de alarma
    RED_REVEAL: 0.2,            // cuánto se ve en cada destello (0 = nada, 1 = todo)
  },

  // --- Escena del pasillo (oficina, puertas cerradas) ---
  // Escena final (automática): un golpe detrás, la vista se gira sola hacia
  // el pasillo central, la compuerta sube despacio y una silueta cruza.
  CORRIDOR_SCENE: {
    TURN_AT: 1.0,               // s: la vista se gira a un lado (v0.51)…
    TURN2_AT: 2.3,              // …y luego hacia atrás
    OPEN_AT: 3.4,               // s: empieza a subir la compuerta
    OPEN_TIME: 4.0,             // s que tarda en abrirse del todo
    GLIMPSE_AT: 8.2,            // s: una silueta cruza el fondo, a contraluz
    GLIMPSE_TIME: 1.6,
    END_AT: 12.0,               // s: fin de la noche 2 (fundido a negro)
  },
  // (v1.73, el usuario: «rehacer la cinemática del final de la 2.5») EL FINAL NUEVO, todo en el 3D de la 2.5 (Noche2_3D.js,
  // src/ending/Largo3D.js): El Largo no camina, cambia de sitio a oscuras; el susto lo hacen la luz, la subida de la
  // vista y el sonido; la linterna se apaga y, al volver la luz, ya no está (final A, sin muerte). Sin él cargado, la de antes.
  ESCENA_LARGO: {
    USAR: true,
    // (v1.74, el usuario: «el jugador debería estar en el centro de la mesa, donde se juega el gameplay de las noches») en el
    // centro de la oficina, como la cámara de las noches, mirando a la compuerta de atrás (El Largo, en el pasillo, tras ella)
    JUGADOR: [90.0, -45.0],     // (Blender x, y) dónde acabas
    ENTRADA: 2.4,               // s: el crujido, la vista se gira sola hacia el pasillo y te acercas al umbral
    // la secuencia (s desde el final de la entrada)
    GOTEOS: [0.5, 1.6],
    T_GOLPE: 2.0,               // un golpe metálico lejano; la luz de emergencia del pasillo parpadea
    T_CORTE: 2.5,               // la linterna se corta un instante: en ese negro aparece El Largo
    T_VUELVE: 2.78,             // vuelve, apuntando al suelo del pasillo
    T_PIES: 4.8,                // el haz ya está en sus pies
    T_SUBE: 5.05,               // la vista empieza a subir con el haz…
    T_CARA: 7.0,                // …hasta la cabeza contra el techo: el golpe
    T_APAGA: 7.6,               // la linterna parpadea (desde T_CARA) y se apaga: negro
    NEGRO: 2.1,                 // s de negro y silencio
    LUZ: 2.0,                   // s con la luz de emergencia (el pasillo vacío)
    FUNDIDO: 1.4,               // fundido a negro y la noche 3
    PITCH_PASILLO: -0.035,      // rad: mirando al fondo del pasillo
    SUELO_ANTES: 1.8,           // m: el haz vuelve al suelo este tanto antes de sus pies y avanza por el suelo hasta ellos
    HAZ: 0.72,                  // el haz, más cerrado en esta escena (de lejos, que no le alumbre entero de golpe)
    CARA_BAJO: 0.085,           // rad: al final, el haz un poco por debajo de la cara (la sonrisa, al borde del haz)
    CIERRA_VISTA: 0,            // (0 = no; p. ej. 0,15: la vista se cierra un 15 % al verle la cara)
    MANO: [0.24, -0.32],        // m: la linterna, a la derecha y por debajo de los ojos (así se ven las sombras)
    SUAVE: 0.85,                // el borde del haz, difuminado (0 = el de siempre)
    SOMBRA_LADO: 1024,          // px del mapa de sombras
    LUZ_LARGO: 0.11,            // cuánto le ilumina la linterna (como a las paredes a la misma distancia)
    EMERGENCIA: 0.02,           // la luz de emergencia del pasillo, tenue (se suma a su luz horneada: × la entera)
    EMERGENCIA_TINTE: [0.15, -0.7, -0.75],   // (roja: el verde y el azul, casi fuera)
    EMERGENCIA_FINAL: 0.045,    // al volver la luz, algo más: que se vea el pasillo vacío
    TEMBLOR: [0.0015, 0.007],   // rad: el temblor del haz (tranquilo, con miedo)
    LATIDO: [3.0, 1.0, 0.42],   // empieza (s), cada cuánto al principio y al final (s)
    VOL: { GRAVE: 0.5, PASOS: [0.12, 0.34], GOTEO: 0.3, GOLPE_LEJANO: 0.75, LAMPARA: 0.4, LINTERNA: 0.4, LATIDO: [0.3, 0.8], GOLPE: 1.0, CRUJIDO: 0.6 },
  },
};
