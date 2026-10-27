// =============================================================
// night6.js — Valores de la NOCHE 6 (v0.72, por fases).
//
// Fase 1 (v0.72): CONDUCTOS. Sales de la oficina sellada por la rejilla
// que rompió El Dislocado y te arrastras por la ventilación hasta V4,
// donde está la sala oculta (src/ending/Night6Ducts.js). El recorrido
// sigue el plano de conductos V1–V7 (StationMap.js) con ramales ciegos
// (rejilla soldada) y la pila de repuesto en el desvío de V5.
// Fase 2 (v0.73): la sala oculta y las válvulas. Fase 3: Slaimi.
// Fase 4: el turno de 12 a 6. Fase 5: el final y la Aberración.
// =============================================================

export const NIGHT6 = {
  DUCTS: {
    // --- Arrastrarse ---
    SPEED: 0.42,             // m/s con W mantenida (media; va a empujones)
    BACK_SPEED: 0.34,        // m/s marcha atrás (S)
    PUSH: 1.05,              // s por empujón (un arrastre y un golpe de rodilla)
    BOB: 9,                  // px de balanceo de la vista
    TURN_TIME: 0.55,         // s girando en un cruce
    START_TIME: 2.2,         // s del inicio (entrar por la rejilla)
    EXIT_FPS: 12,            // fotogramas/s de la salida a la sala oculta
    BREATH_EVERY: [2.2, 3.4],// s entre respiraciones del vigilante

    // --- Linterna (ESPACIO mantenido) ---
    BATTERY: 20,             // s de luz al empezar
    SPARE: 10,               // s que añade la pila de repuesto (desvío de V5)
    BATTERY_MAX: 30,
    DARK: 0.76,              // oscuridad sin luz (1 = negro)
    EMPTY_FLICKER: [0.6, 1.6], // s entre chispazos con la pila a cero

    // --- Encuentros con El Insecto y El Dislocado ---
    FIRST: 11,               // s hasta el primero
    GAP: [7, 11],            // s entre uno y el siguiente
    FRONT: 0.6,              // probabilidad de que venga de frente (si no: por detrás o por un lado)
    SIDE: 0.4,               // de los que no vienen de frente, cuántos vienen por un lado (luego de frente)
    WARN: [2.6, 3.6],        // s que se le oye venir antes de aparecer
    ENEMIES: {
      insecto: {
        APPROACH: 5.2,       // s en llegar de lejos (5 m) hasta ti si no haces nada
        LIGHT: 1.6,          // s de luz para que se vaya
        LIT_SLOW: 0.3,       // velocidad mientras se le alumbra (× APPROACH)
        BACK: 7.5,           // s en alcanzarte por detrás
        CUE: [0.35, 0.6],    // s entre sonidos de patas
      },
      dislocado: {
        APPROACH: 7.5,
        LIGHT: 2.6,
        LIT_SLOW: 0.25,
        BACK: 10,
        CUE: [1.2, 1.8],
      },
    },
    START_DIST: 5.0,         // m a los que aparece de frente
    ATTACK_DIST: 0.85,       // m: te alcanza
    LIGHT_DECAY: 0.5,        // luz acumulada que se pierde por s sin alumbrarlo
  },

  // --- Fase 2 (v0.73): la sala oculta ---
  SALA: {
    VALVES: 3,               // válvulas que hay que cerrar (de las 3 grandes; las otras 9 son de paso)
    VALVE_TIME: 23,          // s girando el ratón en círculos sobre cada una
    VALVE_SPIN: 3.2,         // rad/s mínimos de giro del ratón para que cuente
    VALVE_BACK: 0.35,        // s de cierre que pierde por s si dejas de girar (vuelve atrás despacio)
    VALVE_RADIUS: 1.7,       // × el radio del volante en pantalla: zona donde cuenta el giro
    LEAK_START: 0.35,        // nivel del medidor al llegar (0–1)
    LEAK_RISE: 0.0085,       // lo que sube por s con las 3 abiertas (proporcional a las abiertas)
    LEAK_DROP: 0.14,         // lo que baja al cerrar cada válvula
    TURN_TIME: 0.45,         // s girándose (frente ↔ conducto)
    EDGE: 70,                // px del borde de la pantalla para girarse con el ratón
    EDGE_TIME: 0.35,         // s con el ratón en el borde
    GATE_TIME: 0.6,          // s que tarda la compuerta en cerrarse o abrirse
    // Los enemigos vuelven por el conducto por el que bajaste
    FIRST: 14,               // s hasta el primero
    EVERY: [15, 24],         // s entre uno y el siguiente
    WARN: [5, 6.5],          // s de aviso (arrastre cada vez más cerca) antes de asomarse
    DEEP: 1.6,               // s al fondo de la boca (solo se le ve con la linterna)
    ATTACK: 2.6,             // s asomado: si la compuerta sigue abierta, te alcanza
    BANGS: 3,                // golpes contra la compuerta cerrada antes de irse
    EXIT_FPS: 14,            // fotogramas/s al volver a subir al conducto
  },

  // --- Fase 3 (v0.74): vuelta a la oficina, Slaimi según la noche 5 ---
  VUELTA: {
    TIME: 3.2,               // s saliendo por la rejilla rota hasta la oficina
    SLAIMI_PIP: 0.55,        // volumen del aviso de Slaimi cuando algo llega a una puerta
    HIELO_EVERY: [28, 55],   // s entre crujidos de Slaimi congelado (suena como un enemigo)
    ESCARCHA: 0.22,          // escarcha que queda en la oficina (medio fundida; 1 = la de la fuga)
  },

  // --- Fase 4 (v0.75): el turno de 12 a 6 ---
  TURNO: {
    AGGRO: [0.82, 0.82],     // × intervalo entre oportunidades, × tiempo de reacción (más rápidos y menos margen)
    DISLOCADO_DESDE: 0,      // hora desde la que El Dislocado va por los conductos (rejillas ya rotas)
    // Desapariciones durante el turno: NINGUNA desde la v0.74 (el usuario: «la noche 6 es
    // igual que la 5 en tema de enemigos»; mueren todos en el final). Se deja el sistema por
    // si hace falta: con ids aquí, desaparecen a las HORAS de abajo.
    DESAPARECEN: [],
    HORAS: [2.3, 3.4, 4.5],  // horas de las tres desapariciones (cada una ± HORA_VAR)
    HORA_VAR: 0.2,
    ESPERA_MAX: 40,          // s que espera a que el enemigo deje de atacar (puerta, carrera) antes de desaparecer
    ULTIMA_HORA: 5.5,        // a esta hora desaparece aunque esté en una puerta (no queda ninguno para el final)
    PELEA: 4.5,              // s de ruido de pelea en su última cámara
    SUBE: { errante: 2, dislocado: 2 },   // niveles que suben El Errante y El Dislocado con cada desaparición
    ERRANTE_STEP: 0.85,      // × lo que tarda El Errante en cada sala, con cada desaparición
  },

  // --- Fase 5 (v0.76): el final en las cámaras (s de cada plano) ---
  FINAL: {
    MUERTE: 4.2,             // cada muerte, en su última cámara
    SILENCIO: 2.2,
    TIEMBLA: 3.4,            // CAM 02: la pared del fondo tiembla
    ROMPE: 3.2,              // rompe la puerta de la sala secreta (se ve solo una parte)
    MIRA: 2.6,               // se gira y mira a la cámara
    SIRVEN: 5.0,             // El Dislocado y El Errante se colocan a su lado
    CORTE: 1.2,              // se corta la señal
    NOCHE7: 3.4,             // «NOCHE 7»
  },
};
