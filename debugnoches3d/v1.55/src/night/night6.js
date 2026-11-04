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
    FRONT: 0.6,              // probabilidad de que venga de frente (si no: por un lado, y luego de frente)
    BEHIND: false,           // v0.76 (pedido del usuario: «quita lo de que venga por detrás»): nunca por detrás
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
    FIRST: 18,               // s hasta el primero (v0.77: antes 14)
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
    ESCARCHA: 0.35,          // v0.77: escarcha que se queda, SOLO en los bordes (drawEdgeFrost)
    DESPEJE: 2.6,            // v0.77: s en despejarse el frío fuerte de la fuga al volver
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

  // --- Fase 5 (v0.78): la cinemática de las 6:00, INTERACTIVA (src/ending/Night6Final.js;
  // guion aprobado por el usuario el 2026-10-27). Tiempos en s desde las 6:00. ---
  CINE: {
    FPS: 15,                 // la cámara barata: 15 fotogramas por segundo (con saltos y congelados; v0.79)
    ALARMA: 6,               // s de la alarma grave del principio
    CARGA: 1.5,              // s máximos esperando a que se decodifiquen los clips (v0.79)
    TABLETA_SOLA: 2,         // s: la tableta se enciende sola en la primera cámara (v0.79)
    // Las cuatro muertes, en este orden y cada una en su sala (una cada 9 s;
    // ningún hueco de más de 4 s): aviso en la terminal y el plano, y el ataque
    // (dur s) unos segundos después. sonidos: [s desde el ataque, clave, volumen]
    VICTIMAS: [
      // saltos: s del ataque en que El Errante cambia de sitio de golpe (golpe de estática);
      // el 4.º elemento de un sonido, si lo hay, lo corta de golpe a esos s (el grito que se apaga)
      // v0.79 (3.ª versión, muerte_congelado_v3.py): rompe el cristal a puñetazos, lo saca del cuello,
      // lo estampa, lo remata y lo arrastra del tobillo a saltos; quieto mirando, y estática
      { id: 'frozen', room: 'cryo', aviso: 2, ataque: 4.5, dur: 6.6, saltos: [0.8, 3.55, 3.9, 4.25, 4.5, 5.6],
        sonidos: [[0, 'ambiente/interferencia', 0.6], [0.45, 'congelado/hielo', 0.6],
          [0.95, 'metal/golpe_pared', 1], [0.96, 'metal/cristal', 0.6], [1.3, 'metal/golpe_pared', 1], [1.31, 'metal/cristal', 0.8],
          [1.6, 'metal/cristal', 1], [1.62, 'caidas/caja', 0.8], [1.75, 'congelado/grito', 1, 0.75],
          [2.55, 'largo/golpe', 1], [2.56, 'congelado/hielo', 1], [2.58, 'caidas/caja', 0.9],
          [3.0, 'largo/golpe', 0.95], [3.35, 'largo/golpe', 1], [3.4, 'congelado/grito', 0.7, 0.35],
          [3.9, 'n6/dislocado_arrastre', 0.8], [4.25, 'n6/dislocado_arrastre', 0.8],
          [4.45, 'largo/golpe', 1], [4.65, 'largo/golpe', 1], [4.66, 'congelado/hielo', 0.7]] },
      // v0.80 (3.ª versión, muerte_especimen_v3.py): la rejilla del techo cae, El Dislocado se le echa
      // encima y lo derriba; forcejean (le pega con sus tres brazos); le muerde; El Errante le levanta la
      // muñeca y le pisa el pecho dos veces; El Dislocado lo arrastra del cuello al conducto del suelo
      { id: 'specimen', room: 'lab', aviso: 11, ataque: 13.5, dur: 6.4, saltos: [2.9, 4.05, 5.4],
        sonidos: [[0, 'n6/dislocado_respira', 0.5], [0.55, 'ambiente/crujido', 0.9], [0.9, 'metal/panel', 1],
          [1.25, 'largo/golpe', 1], [1.27, 'caidas/caja', 1], [1.3, 'criaturas/chillido', 0.8, 0.6],
          [1.85, 'largo/golpe', 0.8], [2.15, 'largo/golpe', 0.8], [2.4, 'largo/golpe', 0.85], [2.62, 'largo/golpe', 0.8],
          [2.78, 'criaturas/grunido', 0.9], [2.8, 'criaturas/chillido', 1, 0.5],
          [3.32, 'largo/golpe', 1], [3.33, 'metal/golpe_pared', 0.6], [3.72, 'largo/golpe', 1], [3.73, 'metal/golpe_pared', 0.6],
          [4.05, 'n6/dislocado_arrastre', 0.8], [4.5, 'n6/dislocado_arrastre', 0.8], [4.9, 'metal/panel', 0.6],
          [4.95, 'n6/dislocado_arrastre', 0.8], [5.5, 'n6/arrastre', 0.6]] },
      // v0.80 (muerte_insecto_v3.py): corre por el techo; El Errante le corta el paso; El Dislocado lo
      // derriba de un golpe; boca arriba, El Errante le arranca tres patas; se apaga la luz
      { id: 'insecto', room: 'greenhouse', aviso: 20, ataque: 22.5, dur: 6.0, saltos: [1.0, 2.3, 4.4, 5.3],
        sonidos: [[0, 'n6/insecto_patas', 0.9], [0.5, 'n6/insecto_patas', 0.8], [1.05, 'n6/insecto_chasquido', 1],
          [1.1, 'criaturas/chillido', 0.8, 0.5], [1.5, 'n6/dislocado_respira', 0.7], [1.7, 'largo/golpe', 1],
          [2.1, 'largo/golpe', 1], [2.11, 'caidas/caja', 1], [2.3, 'criaturas/chillido', 0.9, 0.4],
          [2.75, 'n6/insecto_chasquido', 1], [2.76, 'criaturas/chillido', 1, 0.45],
          [3.25, 'n6/insecto_chasquido', 1], [3.26, 'criaturas/chillido', 1, 0.45],
          [3.75, 'n6/insecto_chasquido', 1], [3.76, 'criaturas/chillido', 1, 0.6],
          [4.4, 'criaturas/grunido', 0.8], [4.9, 'ambiente/chispazo', 1], [5.2, 'n6/insecto_patas', 0.5]] },
      // v0.80 (muerte_largo_v3.py): se quita a El Dislocado de la espalda; El Errante le pega y lo derriba;
      // se levanta, corre y le da un puñetazo a la lente (4,4); en el suelo, El Errante le estampa la
      // cabeza; El Dislocado lo arrastra a la puerta (se agarra al marco) y a la oscuridad
      { id: 'largo', room: 'hangar', aviso: 29, ataque: 31.5, dur: 7.5, saltos: [2.4, 4.6, 5.8, 6.8],
        sonidos: [[0.3, 'largo/respiracion', 0.8], [0.95, 'largo/golpe', 0.9], [0.97, 'largo/grunido', 1],
          [1.3, 'n6/dislocado_respira', 0.8], [1.9, 'largo/grunido', 1], [2.25, 'largo/golpe', 1], [2.26, 'caidas/caja', 1],
          [2.6, 'largo/golpe', 1], [2.94, 'largo/golpe', 1], [3.2, 'largo/golpe', 1], [3.5, 'caidas/caja', 1],
          [3.6, 'largo/grunido', 0.9], [3.9, 'largo/pasos', 1], [4.4, 'metal/cristal', 1], [4.41, 'largo/golpe', 1],
          [4.8, 'largo/golpe', 1], [5.1, 'largo/golpe', 1], [5.4, 'largo/golpe', 1], [5.42, 'congelado/hielo', 0.5],
          [5.8, 'n6/dislocado_arrastre', 0.8], [6.15, 'metal/golpe_pared', 0.6], [6.2, 'n6/dislocado_arrastre', 0.8],
          [6.75, 'largo/grunido', 0.7, 0.4], [6.8, 'ambiente/interferencia', 0.5], [7.0, 'n6/arrastre', 0.7]] },
    ],
    LENTE_ROTA: 4.4,         // s del ataque de El Largo en que le da el puñetazo a la lente
    SENAL_UNICA: 40,         // muerto El Largo: todo a estática menos la CAM 02
    SALTA_SOLA: 6,           // s hasta que la tableta salta sola a la CAM 02
    // v0.79 (guion aprobado): espera, la pared se abomba, la rompe, te mira, los 5 segundos y el corte
    CAM02: { ESPERA: 4, PARED: 3, ROMPE: 4, MIRA: 3, SIRVEN: 5, CORTE: 0.8 },
    APAGON: 4,               // la tableta se apaga; la sombra pasa por la ventana (v0.79: 4 s, con el temblor y el crujido)
    FUNDIDO: 2.5,
    NOCHE7: 3.4,
  },

  // --- Fase 5 (v0.76, ya NO se usa: la sustituye CINE): el final en las cámaras ---
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
