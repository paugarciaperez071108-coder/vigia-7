// =============================================================
// night5.js — Valores de la NOCHE 5 (v0.46).
//
// Inicio: sales de la taquilla (con Slaimi si lo salvaste en la noche 4,
// ruta B; si no, solo). Turno de cámaras con:
//   - EL ERRANTE (src/ai/enemies/Errante.js): ataca por las dos puertas
//     laterales sin dejarse ver (la luz no lo muestra); solo se le oye,
//     una estática distorsionada por el lado de esa puerta. Hay que
//     cerrarla mientras suene. En las cámaras, a veces su cara ocupa la
//     imagen: si no bajas el monitor o cambias de cámara a tiempo,
//     desactiva TODAS las cámaras (se reparan con «resetcam» en la
//     consola: 10 s con una barra de progreso). Su triángulo FALLA.
//   - EL DISLOCADO (src/ai/enemies/Dislocado.js): desde las 2 AM por los
//     conductos; se asoma por las rejillas rotas de la pared del frente y
//     hay que alumbrarlo (ratón encima de la rejilla ROTA) hasta que se vaya.
//     2 AM: rompe una rejilla; 4 AM: la otra (si está asomado, cuando se
//     retire). Las intactas no se alumbran (v0.53).
// Final (6:00, sin texto): fuga de Criogenia (src/ending/Night5Leak.js).
// =============================================================

import { COLORES } from '../core/Colores.js';

export const NIGHT5 = {
  // Nombre elegido por el usuario (2026-10-19). En archivos (assets/n4/mira,
  // sfx/mira) se le sigue llamando «mira» (por «El Que Mira», el concepto A).
  ENEMY_NAME: 'El Errante',

  // --- Inicio: sales de la taquilla ---
  START: {
    INSIDE: 3.2,           // s dentro de la taquilla (rendijas; Slaimi brilla contigo)
    OPEN: 1.2,             // s de la puerta abriéndose
    TURN: 1.6,             // s girándote hacia el frente (ya en la oficina)
  },

  // --- El Errante ---
  ERRANTE: {
    COLOR: COLORES.errante,   // v0.58: su color de la biblia (src/core/Colores.js)
    FIRST: [25, 40],       // s hasta que se pone en marcha (y hasta su primera cara en las cámaras)
    // Su RUTA (como El Espécimen, v0.49): sale de la Criogenia, elige al azar
    // una de las dos y avanza una sala cada STEP s. Al final, la compuerta:
    // cerrada → vuelve a la Criogenia y elige ruta otra vez; abierta → entra.
    START: 'cryo',
    ROUTES: {
      A: ['lab', 'reactor', 'mess', 'greenhouse', 'westHall', 'left_door'],
      B: ['medbay', 'hangar', 'comms', 'eastHall', 'right_door'],
    },
    STEP: [[16, 22], [9, 13]],          // s en cada sala de la ruta (12 AM → 6 AM)
    // En la puerta
    DOOR_WINDOW: [6, 4.2], // s que suena la estática antes de entrar (12 AM → 6 AM)
    DOOR_AFTER: 1.0,       // s que tiene que seguir la puerta cerrada al acabar la estática
    STATIC_VOLUME: 0.55,
    // En las cámaras
    CAM_EVERY: [[45, 70], [24, 36]],    // s entre intentos de asomarse en la cámara (12 AM → 6 AM)
    CAM_GRACE: 1.5,        // s para bajar el monitor o cambiar de cámara antes de que las desactive
    CAM_MIN_OPEN: 1.2,     // s que tiene que llevar el monitor subido para que aparezca
    // Se le ve en las cámaras, en la sala donde está (v0.47)
    STARE_TIME: 7,         // s mirando su cámara (con él dentro) antes de que las desactive todas
    SEEN_JUMP: 0.45,       // veces por segundo (media) que salta a otro hueco de la sala entre fotogramas
    SEEN_DARK: 0.2,        // cuánto se le oscurece para que encaje con la sala (0 = nada)
    REPAIR_COMMAND: 'resetcam',
    REPAIR_TIME: 10,       // s que tarda la reparación (barra de progreso)
    // Su triángulo en el plano: solo con las cámaras desactivadas (v0.47), y NO es fiable
    TRI_ON: [0.25, 1.4],   // s visible (irregular)
    TRI_OFF: [0.2, 1.8],   // s oculto (irregular)
    TRI_FAKE: 0.3,         // probabilidad de que, al aparecer, salte a una sala falsa
    TRI_SPLIT: 0.2,        // probabilidad de que salga duplicado (un fantasma)
    TRI_HIDE_NEAR: 0.5,    // probabilidad de desaparecer justo cuando está en una puerta
  },

  // --- El Dislocado ---
  DISLOCADO: {
    COLOR: COLORES.dislocado,   // v0.58: su color de la biblia (src/core/Colores.js)
    // Las rejillas del frente (v0.53): intactas o golpeadas, como en las demás
    // noches (no se alumbran); ROTAS, el hueco a oscuras y solo se ve el
    // interior con el ratón encima (con luz o en el apagón)
    BLACKOUT_DARK: 0.9,    // oscuridad de la rejilla en el apagón (como la pared)
    HOLE_DARK: 0.96,       // oscuridad del interior del conducto (rejilla rota)
    LIT_DARK: 0.12,        // oscuridad que queda con el ratón encima
    N7_OSCURO: 0.92,       // (v1.16) noche 7: oscuridad del fondo del conducto roto sin alumbrar
    LIT_SPEED: 6,          // rapidez con la que se aclara / oscurece
    FROM_HOUR: 2,          // aparece a partir de esta hora (con el evento de las rejillas)
    INTERVAL: 4.2,         // s entre oportunidades de moverse por los conductos
    LEVEL: [12, 16],       // nivel de IA (2 AM → 6 AM)
    FORWARD_BIAS: 0.75,    // probabilidad de avanzar hacia la oficina
    SPAWN_VENTS: ['v2', 'v3', 'v4', 'v5'],
    RETURN: [14, 24],      // s fuera tras alumbrarlo, antes de volver a los conductos
    PEEK_DELAY: [1.5, 3],  // s en V6/V7 antes de asomarse por la rejilla
    LIGHT_TIME: 2.4,       // s alumbrándolo (ratón encima de la rejilla) para que se vaya
    LIGHT_DECAY: 0.6,      // lo alumbrado que se pierde por segundo sin luz
    ATTACK_TIME: 5.5,      // s asomado sin que se le alumbre del todo → ataca
    PEEK_CUE: [1.5, 2],    // s entre avisos (respiración y arrastre) mientras está asomado
    // Eventos de las rejillas (2 AM y 4 AM)
    EVENT: {
      HITS: 6,             // golpes hasta romperla
      HIT_EVERY: [0.9, 1.5], // s entre golpes
      BOTH_FIRST: 2,       // a las 2 AM, los primeros golpes van a las dos rejillas
      FALL_TIME: 0.7,      // s de la rejilla cayendo
      PEEK_AFTER: 0.8,     // s tras caer hasta que se asoma por el hueco
    },
    NOISE_EVERY: [2.5, 5], // s entre ruidos de arrastre mientras está en los conductos
  },

  // --- Final: fuga de Criogenia (6:00) ---
  LEAK: {
    STATIC_BLIP: 0.45,     // s de la estática de El Errante justo antes de reventar
    PA_AT: 1.6,            // s tras reventar: la megafonía
    PA_FILE: 'assets/audio/voces/megafonia_fuga.ogg',   // tools/generar_megafonia.py
    LOCK_AT: 3.5,          // s: se bloquean las puertas y el pasillo central
    TIME: 50,              // s desde la alarma hasta quedarse congelado (si no escapa)
    SLAIMI_TIME: 40,       // s hasta que Slaimi se congela si no está en la taquilla
    FOG_MAX: 0.42,         // niebla del suelo al final (0-1 de la altura; más, y no se ve la taquilla)
    DEATH_TIME: 3.2,       // s de la pantalla blanca de escarcha antes de repetir desde las 6:00
    DUCT_TIME: 7,          // s dentro del conducto antes del fundido
    VOICE_AT: 1.6,         // s dentro del conducto: la voz de la mujer
    VOICE_FILE: 'assets/audio/voces/mujer_conducto',          // + .ogg (o _mia.*)
    VOICE_FILE_DESMAYO: 'assets/audio/voces/mujer_conducto_desmayo',
    FADE: 2.2,             // s de fundido a negro al final
  },
};
