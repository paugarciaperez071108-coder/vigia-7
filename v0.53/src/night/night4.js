// =============================================================
// night4.js — Valores ajustables de la NOCHE 4.
//
// La noche 4 empieza DENTRO DE LA TAQUILLA, justo donde acabó la noche 3
// (src/ending/Night4Start.js). Se sale a la oficina, a oscuras, y de ahí
// al PASILLO CENTRAL (la única salida). En su primer tramo se elige:
//   A) el PANEL DE REINICIO en la pared izquierda, que solo se ve con la
//      linterna (mantener ESPACIO con El Largo acechando en el pasillo). Vuelve la luz y
//      empieza el turno con las cámaras rotas (solo los triángulos) y
//      todos más agresivos. 3 AM: alucinaciones en las cámaras; 4 AM:
//      voces de la tripulación; 5:30: te duermes y hay que volver a la
//      taquilla (src/ending/Night4Sleep.js); si no, caes y se repite desde las 3 AM.
//   B) (ruta Slaimi) seguir por el pasillo hasta el Comedor a REPARAR LAS CÁMARAS
//      (src/ending/Night4Repair.js): la cámara de cada sala (con linterna y tornillos),
//      exploración libre como en la noche 2.5. Mientras se repara, los
//      enemigos se asoman a las puertas (como Rat y Cat). Al volver, El
//      Largo ataca a un slime: Slaimi, el aliado, que se queda en la
//      oficina (src/systems/Slaimi.js).
//
// Lo que se elige se guarda en la partida (save.flags): n4luz o n4camaras,
// y después slaimiAliado o slaimiMuerto. Lo usarán las noches siguientes.
// =============================================================

export const NIGHT4 = {
  // --- Inicio: la taquilla (v0.36) ---
  // Se abre la taquilla y se sale a la oficina, a oscuras. Las compuertas
  // de los lados no se mueven (sin energía): la única salida es el
  // PASILLO CENTRAL (pared de atrás). En su primer tramo, a la izquierda y
  // en la penumbra, está el PANEL DE REINICIO en la pared (ruta A); al
  // fondo, el pasillo sigue a oscuras hacia el Comedor (ruta B: reparar las cámaras).
  START: {
    OPEN_TIME: 0.8,          // s que tarda en abrirse la puerta de la taquilla
    CORRIDOR_TIME: 0.7,      // s de fundido al entrar en el pasillo central
    LIGHTS_ON: 2.2,          // s de parpadeo de las luces al volver la energía (ruta A)
  },

  // --- Ruta A: el panel de reinicio, en la pared del pasillo (v0.37) ---
  // Solo se ve con la linterna. Clic en él: se abre la tapa; otro clic la
  // cierra y vuelves a mirar el pasillo. MANTENER ESPACIO pulsa el botón y
  // sube el porcentaje (al soltar baja DECAY %/s). Al 100 % vuelve la luz.
  // Con el panel abierto no se ve el pasillo: El Largo puede acercarse (se
  // oye) paso a paso; hay que cerrar el panel y alumbrarle la cara.
  REBOOT: {
    SPEED: 4,                // % por segundo con el botón pulsado (100 % ≈ 25 s)
    DECAY: 0,                // % por segundo que baja al soltar (0 = no baja)
    PEEK_FIRST: [6, 9],      // s de botón pulsado hasta que El Largo se acerca la primera vez
    PEEK_EVERY: [7, 12],     // s de botón pulsado entre una visita y la siguiente
    PEEK_TIME: 4.5,          // s asomado (= la animación de tools/3d/largo_pasillo.py) antes de llegar hasta ti
    PEEK_LIGHT: 0.7,         // s de luz encima para que se vaya
    // Los demás enemigos siguen moviéndose mientras reinicias: al empezar el
    // turno se adelanta su IA el tiempo pasado en el panel (× HEAD_START),
    // sin que nadie llegue a la puerta de la oficina.
    HEAD_START: 1.0,
  },

  // --- Camino A: reactivar la luz ---
  // Turno de cámaras como la noche 3 después de las 3 AM (cámaras rotas,
  // triángulos intermitentes), con los valores de IA de la noche 4
  // (nights.js) y además estos multiplicadores de agresividad.
  A: {
    INTERVAL_MULT: 0.7,      // las oportunidades de moverse llegan antes (×)
    REACTION_MULT: 0.75,     // menos tiempo de reacción (fases de El Largo, compuertas, conductos) (×)
    INSECT_SPEED: 0.8,       // El Insecto (más lento que el resto, como tras las 3 AM)
  },

  // --- Camino B: reparar las cámaras ---
  REPAIR: {
    // v0.38: la CÁMARA DE SEGURIDAD de cada sala, en una esquina alta (solo
    // se ve con la linterna). Clic: vista de cerca; otro clic: vuelves a la
    // sala (lo hecho se conserva). Ratón sobre un tornillo + ESPACIO
    // mantenido: 4 tornillos fuera, la placa se repara, 4 tornillos dentro.
    ROOMS: ['eastHall', 'comms', 'hangar', 'medbay', 'reactor', 'lab', 'cryo', 'mess', 'greenhouse', 'westHall'],
    HOLD_TIME: 6,            // (v0.37, ya no se usa: ver SCREW_TIME)
    SCREW_TIME: 1.5,         // s de ESPACIO mantenido sobre cada tornillo (4 fuera + 4 dentro)
    // Al entrar en una sala NO hay enemigos (va rápido): solo aparecen
    // mientras se repara. Enemigos que pueden asomarse (mecánica de la
    // luz de la noche 2.5; solo tienen posturas para ella estos dos).
    ENEMIES: ['specimen', 'largo'],
    // --- Fase 1 del enemigo: SE ASOMA (como Rat y Cat en FNaC 3) ---
    // Mientras se repara, cada PEEK_EVERY s alguien puede llegar a una de
    // las puertas de la sala. NO hace ruido: solo se le ve si se mira.
    // Hay que soltar el panel (girarse) y alumbrar la esquina de esa
    // puerta: con PEEK_LIGHT s de luz encima se va. Si pasan PEEK_TIME s
    // asomado, entra en la sala (fase 2).
    PEEK_FIRST: [2.5, 4],    // s de botón mantenido hasta el primer aviso en cada sala
    PEEK_EVERY: [3.5, 7],    // s (de botón mantenido) entre un enemigo y el siguiente
    PEEK_TIME: 3.2,          // s asomado antes de entrar
    PEEK_LIGHT: 0.6,         // s de luz encima para que se vaya
    PEEK_CHANCE: 0.85,       // probabilidad de que llegue alguien cuando toca (si no, solo un ruido)
    // --- Fase 2 del enemigo: DENTRO DE LA SALA ---
    // La mecánica normal de la 2.5 (luz en la cara, postura, sitio).
    FIND_TIME: 3.5,          // (v0.38; ya no se usa: ver INSIDE_KILL)
    INSIDE_KILL: 5,          // s dentro de la sala sin que se le alumbre la cara hasta que ataca (v0.39)
    ENTER_VOLUME: 0.12,      // volumen del único sonido al entrar (paso suave, roce o respiración)
                             // (asomado en la puerta no hace NINGÚN ruido)
    POSE_WINDOW: 2.0,
    MOVE_WINDOW: 3.5,
    RETIRE_TIME: 2.4,
    // Rincón del panel en cada sala (abajo; las salidas están a media altura)
    CORNER: { eastHall: 'right', comms: 'left', hangar: 'right', medbay: 'left', reactor: 'right',
      lab: 'left', cryo: 'right', mess: 'right', greenhouse: 'left', westHall: 'left' },
  },

  // --- La vuelta: El Largo atacando a un slime ---
  // Con todas las cámaras reparadas, al ir hacia la oficina (desde un
  // corredor o, desde el Comedor, por el pasillo central) El Largo está
  // en esa sala atacando a Slaimi. Enfrentamiento con la mecánica de la
  // luz, más largo: tiene que cambiar de postura o de sitio CHANGES veces
  // (y acumular RETIRE_TIME s de luz en la cara) antes de retirarse.
  LARGO: {
    INTRO: 1.8,              // s viendo cómo ataca al slime antes de que se gire hacia ti
    CHANGES: 8,              // cambios de postura/sitio antes de retirarse
    FIND_TIME: 3,
    POSE_WINDOW: 1.8,
    MOVE_WINDOW: 3,
    RETIRE_TIME: 3,
    FOLLOW_TIME: 3.5,        // s de escena: Slaimi se acerca saltando y te sigue
  },

  // --- Slaimi en la oficina (camino B) ---
  // Salta en la pared de la oficina por la que está el enemigo más cercano
  // (izquierda, derecha, frente = conductos, atrás = pasillo central).
  // Cuanto más cerca, más rápido. No defiende: solo avisa.
  SLAIMI: {
    COLOR: '#8f6bff',        // su triángulo en el plano: violeta arándano (ningún otro personaje lo usa)
    HOP_SLOW: 1.6,           // s entre saltos con el enemigo más cercano lejos (FAR salas o más)
    HOP_FAST: 0.3,           // s entre saltos con el enemigo pegado a la oficina
    FAR: 6,                  // a partir de estas salas, salta lo más lento
    MOVE_TIME: 0.7,          // s que tarda en cambiar de pared
    DEAD_CAM: 'mess',        // camino A: en qué cámara aparece muerto (cuando vuelvan a funcionar, noche 5)
  },

  // --- Ruta A, 3 AM: ALUCINACIONES en las cámaras (src/systems/Hallucinations.js) ---
  // Las cámaras rotas muestran «grabaciones» de hace una semana (una
  // escena distinta por cámara; assets/alucinaciones/<sala>.webp, de
  // tools/3d/alucinaciones.py). Al acabar vuelven de golpe a «SIN SEÑAL».
  HALLU: {
    HOUR: 3,
    DURATION: 23,            // s
    FREEZE: true,            // true = los enemigos se quedan quietos (no atacan) mientras duran
    AGGRO: 0.6,              // (solo con FREEZE: false) siguen activos con este multiplicador de oportunidades
    FPS: 5,                  // imágenes por segundo de las grabaciones (cámara de seguridad)
    DATE: '11-10',           // fecha sobreimpresa (hace una semana)
  },

  // --- Ruta A, 4 AM: VOCES de la tripulación (src/systems/Voices4am.js) ---
  VOICES: {
    HOUR: 4,
    FIRST: [3, 6],           // s hasta la primera voz
    EVERY_START: [10, 16],   // s entre voces a las 4 AM…
    EVERY_END: [2, 4],       // …y al final de la noche (se acerca poco a poco)
    MAX_OVERLAP: 3,          // voces a la vez como mucho (al final)
    BURST: 0.5,              // probabilidad (× avance) de que entre otra voz casi a la vez
    NO_REPEAT: 6,            // frases distintas antes de repetir una
    VOLUME: 0.5,
  },

  // --- Ruta A, final: TE DUERMES (v0.38; src/ending/Night4Sleep.js) ---
  // Empieza a las START (antes de las 6:00), sin texto en pantalla.
  // Párpados de FNaF 3, la visión que se dilata a los DILATE_AT s, la frase
  // del protagonista, alucinaciones que no atacan y los enemigos de verdad
  // que solo avanzan con los ojos cerrados. Hay que volver a la taquilla
  // (pared de atrás) antes de DURATION s; si no, cae al suelo y El Largo se
  // acerca por el pasillo; se repite desde las 3 AM.
  SLEEP: {
    START: 5.5,              // hora a la que empieza (5.5 = 5:30)
    DURATION: 60,            // s que dura la fase hasta caer al suelo
    FIRST_BLINK: 2.0,        // s hasta el primer parpadeo
    BLINK_EVERY: [5.5, 2.2], // s entre parpadeos (al principio → al final)
    BLINK_CLOSED: [0.3, 1.5],// s con los ojos cerrados (al principio → al final)
    CLOSE_TIME: 0.75,        // s que tardan en cerrarse (pesados)
    OPEN_TIME: 1.15,         // s que tardan en abrirse (aún más lentos)
    DILATE_AT: 7,            // s hasta que la visión se dilata (borrosa, bordes que se cierran, ondas)
    DILATE_RAMP: 20,         // s hasta el máximo
    BLUR_MAX: 5,             // px de desenfoque al máximo
    WARP: 9,                 // px de ondulación de la imagen al máximo
    VOICE_AT: 2.5,           // s: el protagonista dice «Estoy cansado, debo ir a un sitio seguro.»
    TURN_SLOW: 0.45,         // velocidad de giro (× la normal)
    SWAY: 14,                // px de balanceo de la vista (cansancio)
    DARKNESS: 0.45,          // oscuridad fuera del haz de la linterna
    FAKE_EVERY: [6, 11],     // s entre enemigos FALSOS asomados (no atacan)
    FAKE_LIGHT: 0.45,        // s de linterna encima para que un falso se desvanezca
    GHOST_EVERY: [5, 10],    // s entre fantasmas de la tripulación
    GHOST_SPEED: 210,        // px/s al cruzar la oficina
    GHOST_ALPHA: 0.32,       // opacidad de los fantasmas
    FALL_DROP: 0.55,         // s que tarda la vista en caer al suelo
    FLOOR_TIME: 9,           // s en el suelo viendo a El Largo acercarse (luego fundido)
  },

  // --- Ruta B (Slaimi), FINAL: EL APAGÓN (v0.41; src/ending/Night4Dark.js) ---
  // 4:50: aviso (las luces parpadean, interferencias en la consola y un
  // zumbido lejano: El Errante, sin dejarse ver). 5:00: apagón total
  // (lo provoca él). La única luz es la de Slaimi y vienen a por él: hay que
  // cogerlo (clic), girarse a la pared de atrás y meterlo en la TAQUILLA
  // (clic). Luego, a oscuras con la linterna, de 5:00 a 6:00 entran por las
  // compuertas y el pasillo central (mecánica de la luz de la 2.5). Si uno
  // llega a la taquilla sin que lo alumbres, se lleva a Slaimi (escena corta
  // y se repite desde las 5:00). Slaimi se asusta de vez en cuando: gime y su
  // luz se escapa por las rendijas y los atrae; clic en la taquilla lo calma.
  // Solo UN enemigo atacando a la vez (v0.43). 6:00 (v0.43): las cámaras de
  // verdad se abren solas con la batería de emergencia (se cambian como en una
  // noche normal); la imagen se traba mientras se retiran todos; en la CAM 10
  // espera El Errante; alucinaciones en la oficina... y a la taquilla con
  // Slaimi a dormir. Si le miras STARE_LIMIT s seguidos (o tardas DAWN_LIMIT
  // s): FINAL DEL DESMAYO (cuenta como noche superada).
  DARK: {
    WARN_AT: 4 + 50 / 60,    // hora del aviso (4:50)
    START: 5,                // hora del apagón total
    WARN_FLICKER: [0.5, 2.0],// s entre parpadeos de las luces durante el aviso
    WARN_HUM: 0.06,          // volumen del zumbido lejano de El Errante durante el aviso
    // --- 5:00: apagón, la luz de Slaimi y esconderlo ---
    HIDE_LIMIT: 30,          // s para meter a Slaimi en la taquilla (si no, se lo llevan)
    THREAT_EVERY: [1.0, 2.4],// s entre pasos / arañazos / respiraciones que vienen a por él
    GLOW: 300,               // px de radio de la luz de Slaimi
    // --- 5:00 → 6:00: defensa (mecánica de la luz de la noche 2.5) ---
    DEFEND_TIME: 60,         // s reales de las 5:00 a las 6:00 (= una hora de juego)
    ENEMIES: ['specimen', 'largo'],   // los que tienen posturas para la mecánica de la luz
    ENTRY_EVERY: [[11, 16], [5, 8]],  // s entre entradas (a las 5:00 → a las 6:00)
    // (v0.43) Solo UN enemigo atacando a la vez (también el que va directo a la
    // taquilla): el siguiente no empieza a entrar hasta ENTRY_GAP s después de
    // que se vaya el anterior.
    ENTRY_GAP: 2,
    FIRST_ENTRY: [4, 6],     // s hasta el primero
    FIND: [7, 4.5],          // s para alumbrarle la cara antes de que llegue a la taquilla (5:00 → 6:00)
    POSE_WINDOW: [2.0, 1.6], // s para volver a enfocar la cara si cambia de POSTURA (5:00 → 6:00)
    MOVE_WINDOW: [3.5, 2.8], // s si cambia de SITIO (5:00 → 6:00)
    RETIRE_TIME: [2.2, 2.8], // s de luz en la cara para que se vaya (5:00 → 6:00)
    // --- Slaimi se asusta (en la taquilla) ---
    SCARE_FIRST: [10, 14],   // s hasta el primer susto
    SCARE_EVERY: [[20, 28], [9, 14]], // s entre sustos (5:00 → 6:00)
    CALM_LIMIT: 6,           // s para calmarlo (clic en la taquilla) antes de que uno vaya DIRECTO a ella
    CALM_COOLDOWN: 10,       // s tranquilo después de calmarlo (luz más débil, sin gemir)
    WHIMPER_EVERY: [0.9, 1.7], // s entre gemidos mientras está asustado
    ATTRACT: 0.45,           // mientras está asustado, el tiempo entre entradas × esto (menos = atrae más)
    LOCKER_FIND: 3.5,        // s para alumbrar al que va directo a la taquilla
    SLIT_GLOW: { normal: 0.35, scared: 1.0, calm: 0.12 },  // brillo de las rendijas
    SLIT_DARK: 0.5,          // s que se apaga la luz de las rendijas cuando uno pasa cerca
    TAKEN_TIME: 4.5,         // s de la escena «se llevan a Slaimi» antes de repetir desde las 5:00
    // --- 6:00: la escena final (sin texto de «6:00 AM"), v0.43 ---
    // Las cámaras REALES se abren solas (minimapa, teclas 0-9, como una noche
    // normal) con la batería de emergencia. En ellas, los enemigos se retiran
    // y El Errante espera en la CAM 10.
    FIRST_CAM: 'westHall',   // cámara con la que se abren
    LOWER_AFTER: 4,          // s antes de poder bajar el monitor
    // (la retirada: animaciones de caminar de tools/3d/andar/, assets/n4/retirada; v0.45)
    RETREAT_BRIGHT: 1.8,     // brillo de los enemigos que se retiran respecto a la imagen de la cámara
    ERRANTE_CAM: 'comms',       // cámara de El Errante (CAM 10, Comunicaciones)
    ERRANTE_JUMP: 2.4,          // s entre saltos de la imagen (en cada uno, más cerca; 4 imágenes)
    ERRANTE_GLITCH: 0.45,       // s que dura cada distorsión
    STARE_LIMIT: 8,          // s SEGUIDOS mirando a El Errante → salta encima → final del desmayo
    GUIDE_AFTER: 10,         // s sin encontrar su cámara → se oye su zumbido…
    GUIDE_RAMP: 14,          // …cada vez más fuerte durante estos s
    GUIDE_EVERY: [2.2, 3.2], // s entre zumbidos de guía
    GUIDE_VOLUME: [0.06, 0.7], // volumen del zumbido de guía (al empezar → al final de la rampa)
    // Imagen que se TRABA (la señal no da abasto: algo interfiere, El Errante).
    // k = cercanía de la cámara a la CAM 10 (1 = la misma, 0 = la más lejana del plano)
    STUTTER: {
      FPS: [9, 2.5],         // imágenes por segundo de la imagen (lejos → cerca)
      FREEZE_EVERY: [2.6, 0.8], // s entre congelaciones (lejos → cerca)
      FREEZE_TIME: [0.18, 0.7], // s que dura una congelación (lejos → cerca)
      DROP: [0.1, 0.45],     // probabilidad de perder una imagen (salta más) (lejos → cerca)
      STAGE: 0.12,           // + cercanía extra por cada imagen de El Errante más cerca (en la CAM 10)
    },
    DAWN_WORSEN: 26,         // s desde los que las alucinaciones (monitor bajado) empeoran
    DAWN_LIMIT: 45,          // s hasta el final del desmayo si no te metes en la taquilla con Slaimi
    SLEEP_TIME: 6,           // s dentro de la taquilla (Slaimi parpadea tranquilo, te duermes)
    JUMP_TIME: 1.7,          // s del susto (la cara de El Errante)
    OVERLAY: [0.1, 0.32],    // opacidad de la imagen de la cámara encima de la oficina (al principio → al empeorar)
    // --- Final alternativo: EL DESMAYO (v0.43) ---
    // Tras el susto: negro, cuerpo que cae, pitido de oído; parpadeos lentos
    // desde el suelo; Slaimi se acerca brillando y te arrastra a la taquilla;
    // fundido a negro, sin texto (v0.44). Cuenta como noche completada.
    FAINT: {
      BLACK: 2.6,            // s a oscuras tras el susto (cae, pitido)
      BLINKS: [[3.0, 4.2, 0.28], [5.6, 7.4, 0.5], [8.6, 12.6, 0.7]], // [abre, cierra, cuánto abre] (s desde el susto)
      DRAG_AT: 10.2,         // s: Slaimi lo envuelve y lo arrastra hacia la taquilla
      FADE_AT: 12.6,         // s: fundido a negro
      END_AT: 14.5,          // s: al menú (noche 5 desbloqueada)
      RING_TIME: 7,          // s que dura el pitido de oído
      RING_HZ: 4200,         // tono del pitido
    },
  },

  // Finales especiales que se guardan (flags de la partida) y se ven en el menú
  ENDINGS: [
    { flag: 'finalDesmayo', name: 'Desmayo' },
  ],

  // --- Puntos de control ('n4a', 'n4b', 'n4turno', 'n4reboot', 'n4tres', 'n4cinco', 'n4seis'): ver Game.js ---
};
