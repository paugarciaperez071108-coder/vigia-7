// =============================================================
// night3.js — Valores ajustables de las mecánicas de la NOCHE 3
// (El Largo «por el oído», el inicio en el pasillo central, el evento
// de las 3 AM y el final de las taquillas).
//
// Las noches 4 y 5 usarán estas mismas mecánicas (largoMode: 'oido' en
// nights.js); su dificultad se ajusta allí con el nivel de IA.
// =============================================================

export const NIGHT3 = {
  // --- El Largo por el oído (src/ai/enemies/LargoOido.js) ---
  // No ve bien: se guía por el sonido. Se mueve por las conexiones del
  // plano (y por el pasillo central, detrás de la oficina). Su FASE
  // depende de cuántas salas le faltan para llegar a la oficina:
  //   cerca (1): Corredor Oeste, Corredor Este, pasillo central (tramo 3)
  //   medio (2): Invernadero, Comunicaciones, pasillo central (tramo 2)
  //   lejos (3): Comedor, Hangar, pasillo central (tramo 1)
  //   más lejos: deambula (velocidad de avance: INTERVAL e IA de la noche)
  // En cada fase espera su tiempo de reacción; si nadie lo aleja con un
  // audio, avanza una sala. Desde un corredor llega a la compuerta: si
  // está cerrada se retira lejos, si está abierta ataca. Desde el tramo 3
  // del pasillo central ataca directamente (no hay compuerta que cerrar).
  LARGO: {
    PHASE_TIME: { lejos: 5, medio: 3.5, cerca: 2 },   // s de reacción en cada fase
    INTERVAL: 6,             // velocidad de avance cuando deambula: s entre oportunidades (tirada 1-20 <= IA)
    FORWARD_BIAS: 0.65,      // al deambular, probabilidad de ir hacia la oficina
    STEP_TIME: 1.6,          // s que tarda en pasar de una sala a la siguiente al ir hacia un sonido
    // Audio (botón de la cámara, tecla G): va hacia la sala del sonido si
    // está a LURE_RANGE salas o menos de él. Recarga entre dos audios.
    LURE_RANGE: 3,
    LURE_COOLDOWN: 4,
    DOOR_WAIT: [3, 5],       // s que espera en una compuerta antes de intentar entrar
    // Al chocar con una compuerta cerrada se va a una de estas salas
    RETREAT_TO: ['reactor', 'medbay', 'lab', 'cryo'],
    START: 'cryo',           // dónde empieza si la noche no tiene inicio en el pasillo central
  },

  // --- Inicio de la noche 3: El Largo en el pasillo central ---
  // Se le oye detrás (pasos y respiración). Girándose hacia la pared de
  // atrás y encendiendo la linterna se le ve acercarse tramo a tramo.
  // Se le aleja con un audio en la CAM 06 (Comedor, la sala que da al
  // pasillo). Tiempos generosos: sirve para enseñar la mecánica.
  INTRO: {
    START: 'central1',
    SECTION_TIME: 12,        // s en cada tramo del pasillo antes de acercarse al siguiente
    SOUND_EVERY: [2.5, 4.5], // s entre pasos / respiración que se oyen detrás
    CALM_TIME: 20,           // s que se queda escuchando en el Comedor tras el primer audio
    HINT_CAM: 'mess',        // cámara que se sugiere en el aviso
  },

  // --- Evento de las 3 AM ---
  // El Largo rompe las cámaras de los corredores (golpe, imagen distorsionada
  // y SIN SEÑAL hasta el final de la noche). Desde entonces el minimapa
  // marca con un triángulo ⚠ las salas con enemigos y todos son más
  // agresivos. En las cámaras rotas no se pueden poner audios.
  EVENT_3AM: {
    HOUR: 3,
    BREAK: ['westHall', 'eastHall'],   // cámaras que rompe, en este orden
    BREAK_TIME: 1.4,         // s de golpes y distorsión antes de quedarse sin señal
    BREAK_GAP: 2.2,          // s entre la primera cámara rota y la segunda
    INTERVAL_MULT: 0.75,     // las oportunidades de moverse llegan antes (×)
    REACTION_MULT: 0.8,      // menos tiempo de reacción (fases de El Largo, compuertas, conductos) (×)
  },

  // --- Final de la noche 3: esconderse en las taquillas ---
  // A las 6 AM las cámaras siguen rotas y se va la luz. El Largo entra en
  // la oficina por el pasillo central: hay que girarse a la pared de
  // atrás y meterse en una taquilla antes de que llegue. Dentro, cuando se
  // acerca, hay que aguantar la respiración (mantener ESPACIO), pero el
  // aire se acaba: soltarlo mientras está delante de la taquilla = te oye.
  ENDING: {
    HIDE_TIME: 10,           // s para meterse en una taquilla
    INSIDE_TIME: 26,         // s escondido hasta que se va (y amanece)
    // Momentos (s desde que entras) en los que pasa por delante de la
    // taquilla: [empieza, acaba]. Hay que aguantar la respiración en ellos.
    PASSES: [[7, 11.5], [17, 22]],
    WARN_BEFORE: 1.6,        // s antes de cada pasada en que se oye que se acerca
    BREATH_MAX: 8,           // s que se puede aguantar la respiración
    BREATH_RECOVER: 1.5,     // s de aire recuperados por cada s respirando
  },
};
