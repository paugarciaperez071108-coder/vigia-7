// =============================================================
// night2.js — Valores ajustables de las mecánicas de la NOCHE 2
// (conductos de ventilación, El Insecto, El Largo y fuga de gas).
//
// Las noches 3-5 usan las mismas mecánicas con estos valores; el
// nivel de IA de El Insecto y El Largo de cada noche está en
// nights.js (ai.insecto / ai.largo), igual que el resto de enemigos.
//
// El mapa (qué conductos hay, cómo se conectan y qué salas son
// adyacentes para El Largo) está en world/StationMap.js.
// =============================================================

export const NIGHT2 = {
  // --- Inicio de la noche ---
  // Ya no hay ataque de El Insecto al empezar (v0.32): aparece a los
  // INSECTO.FIRST_APPEAR s con su mecánica normal. En la noche 2 las
  // cámaras de ventilación empiezan sin señal hasta escribir get-update.
  UPDATE_COMMAND: 'get-update',

  // --- El Insecto (conductos) ---
  // Se mueve por el grafo VENT_LINKS (StationMap.js): para llegar a V6
  // o V7 (las entradas a la oficina) tiene que pasar por V1.
  INSECTO: {
    INTERVAL: 5,             // segundos entre oportunidades de moverse (tirada 1-20 <= IA)
    FIRST_APPEAR: [25, 45],  // s desde que empieza la noche hasta que aparece por primera vez
    // Tras ahuyentarlo, tarda entre estos segundos en volver a uno de
    // estos conductos (al azar).
    RETURN_MIN: 35,
    RETURN_MAX: 70,
    SPAWN_VENTS: ['v2', 'v3', 'v4', 'v5'],
    // Probabilidad de elegir el conducto que le acerca a la oficina
    // (el resto de veces va a uno vecino al azar).
    FORWARD_BIAS: 0.75,
    // Al llegar a V6 o V7 espera estos segundos y entra en la oficina
    // (game over) si no se le suelta insecticida antes.
    ENTER_TIME: 6,
    // Ruidos de patas en los conductos mientras está dentro: cada
    // cuántos segundos (entre MIN y MAX) se le oye.
    NOISE_MIN: 2.5,
    NOISE_MAX: 6,
  },

  // --- Insecticida ---
  GAS: {
    VENTS: ['v6', 'v7'],     // conductos donde se puede soltar (en el resto no sale la opción)
    COOLDOWN: 3,             // segundos entre dos soltadas
    CLOUD_TIME: 2.5,         // segundos que se ve la nube en la cámara
  },

  // --- Fuga de gas (evento aleatorio) ---
  // Cada soltada de insecticida cuenta. A partir de SAFE_USES soltadas,
  // cada nueva tiene un RISK_PER_USE más de probabilidad de provocar
  // una fuga (con tope MAX_RISK). Ej.: SAFE_USES 4, RISK_PER_USE 0.12 →
  // la 5.ª soltada 12 %, la 6.ª 24 %, la 7.ª 36 %...
  // Al arreglar una fuga, la cuenta vuelve a 0.
  LEAK: {
    SAFE_USES: 4,
    RISK_PER_USE: 0.12,
    MAX_RISK: 0.6,
    DELAY_MIN: 2,            // la fuga salta entre estos segundos tras la soltada
    DELAY_MAX: 5,
    COUNTDOWN: 7,            // segundos para escribir el comando antes de morir
    COMMAND: '/InsecP',
  },

  // --- El Largo (salas) ---
  LARGO: {
    START_HOUR: 2,           // se activa a las 2:00 AM
    INTERVAL: 5,             // segundos entre oportunidades (tirada 1-20 <= IA)
    BREAK_STAGES: 5,         // golpes que necesita para romper la entrada del conducto
    // En cada oportunidad, en vez de golpear la entrada, a veces se
    // va solo a una sala adyacente (así no siempre está donde lo dejaste).
    WANDER_CHANCE: 0.15,
    // Golpes metálicos (botón de la cámara): si suenan en una sala
    // ADYACENTE a la suya (ROOM_ADJACENCY en StationMap.js), desaparece
    // al instante de las cámaras (no va a la sala del sonido). Vuelve
    // a atacar tras HIDE_MIN-HIDE_MAX segundos en una sala al azar y
    // empieza de cero con la entrada de esa sala.
    HIDE_MIN: 25,
    HIDE_MAX: 45,
    LURE_COOLDOWN: 6,        // segundos entre dos usos del audio
    // Al romper la entrada se mete en los conductos: se le oye acercarse,
    // cada vez más grave y fuerte, durante CRAWL_TIME segundos y te mata.
    CRAWL_TIME: 7,
  },
};
