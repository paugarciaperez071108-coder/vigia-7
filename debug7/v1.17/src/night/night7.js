// =============================================================
// night7.js — Valores de la NOCHE 7, la noche final (v0.82, por fases;
// plan aprobado por el usuario el 2026-10-28).
//
// El hombre de las cintas murió intentando que el reactor explotara con los
// monstruos dentro. Esta noche el jugador termina lo que él empezó: el
// reactor tiene que llegar al 100 % y hay que sobrevivir mientras la nave
// se destruye. Dura lo que la canción «Flamewall» entera: 6:52 reales (de 12 a 6, ~68,7 s por hora; v1.00).
//
// Fases del trabajo: F1 esqueleto y Slaimi (v0.82) → F2 la cinta y la
// grabadora → F3 la música (remix de «Flamewall») → F4 los enemigos (la
// Aberración, El Errante solo cámaras, El Dislocado) → F5 la nave se rompe
// (3:00–5:59) → F6 Slaimi, el cuerpo, el ajuste y los vídeos.
// El sistema que lo mueve todo: src/systems/Night7.js.
// =============================================================

export const NIGHT7 = {
  SECONDS_PER_HOUR: 50,        // 5 minutos reales de 12 a 6

  // --- La cinta del hombre (F2) ---
  // Durante la cinta no se puede morir, los enemigos no se mueven y el reloj
  // está parado; se pueden mirar las cámaras. Al acabar (el clic final),
  // SILENCIO s de silencio total y empieza la noche con la música.
  CINTA: {
    SILENCIO: 1.0,
    ESPERA_MAX: 4,             // s que se espera a que cargue la cinta; sin cinta, la noche empieza ya
    // Lo que dice se ve en la nave (por las palabras del subtítulo que suena):
    LAB: 'laboratorio',        // «la cosa del laboratorio»: el monitor se abre en la CAM 02 (la pared rota)
    ERRANTE: 'Errante',        // «el Errante»: la cámara que se mira parpadea (estática)
    PARPADEO: 1.4,             // s de estática
  },

  // --- Las frases del hombre durante la noche ---
  // v0.86 (el usuario: quitar la grabadora del suelo y que suene sola): de vez en
  // cuando suena un trozo de una cinta anterior (tools/fragmentos_grabadora.py →
  // assets/audio/cintas/grabadora/), uno distinto cada vez, con su subtítulo.
  // Nunca durante la cinta. (El render de la grabadora, tools/3d/salas/grabadora.py,
  // queda sin usar en assets/n7/.)
  GRABADORA: {
    PRIMERA: 22,               // s de noche hasta la primera
    CADA: [38, 62],            // s entre una y la siguiente
    VOLUMEN: 0.75,
  },

  // --- El reactor (decisión del usuario, 2026-10-28) ---
  // Se calienta solo (y con las compuertas y las luces, como siempre); hasta
  // las 3:00 no pasa de TOPE. A las 3:00: si está a UMBRAL o más, salta al
  // 100 % (no explota todavía: la alarma de sabotaje); si no, la Aberración
  // ha ganado («NÚCLEO ESTABILIZADO»). Desde las 2:00 la Aberración lo enfría (F4).
  REACTOR: {
    START: 35,                 // % al empezar
    RATE: 0.5,                 // %/s solo (a las 2:00, sin nadie que lo enfríe: ~85 %)
    TOPE: 99,                  // no llega al 100 antes de las 3:00
    HORA_100: 3,               // a esta hora se decide
    UMBRAL: 70,                // % mínimo a esa hora
  },

  // --- Las horas (F4–F5 las llenan) ---
  HORAS: {
    ABERRACION_REACTOR: 2,     // la Aberración va a por el reactor
    NUCLEO: 3,                 // reactor al 100 %: alarma, luz roja, drop
    CALOR: 4,                  // las salas sufren el calor
    ROTURA: 5,                 // explosiones, fuego, humo
    SILENCIO: 5 + 59 / 60,     // 5:59: la música se corta
  },

  // --- v1.00: la oficina entera de Blender por estados (src/render/OficinaV2.js) ---
  OFICINA_V2: {
    LUZ: 0.75,                 // cuánto suma la luz del fuego simulado sobre la oficina
  },

  // --- Fase 6: el cuerpo del protagonista (src/systems/Night7Cuerpo.js) ---
  CUERPO: {
    MIEDO_HORA: [0.1, 0.45],   // el miedo de base: a las 12 → a las 6
    MIEDO_PASILLO: 0.35,       // + con la Aberración en el pasillo (× lo cerca que está)
    MIEDO_PUERTA: 0.6,         // + en la compuerta
    MIEDO_LADO: 0.5,           // + en una puerta de los lados
    OYE_DESDE: 0.28,           // por debajo, ni el corazón ni la respiración se oyen
    PULSO: [62, 145],          // pulsaciones por minuto: sin miedo → con todo
    LATIDO_VOL: 0.75,
    RESPIRA_CADA: [4.2, 1.6],  // s entre respiraciones: sin miedo → con todo
    RESPIRA_VOL: 0.55,
    BORDE_DESDE: 0.6,          // con más miedo, la vista late (borde oscuro)
  },

  // --- Fase 6: Slaimi vivo en la oficina (Night7._slaimi) ---
  SLAIMI: {
    ESCONDE: 4,                // s que se queda escondido bajo la mesa tras un susto
    ESCONDE_BAJA: 95,          // px que baja (se le ve solo la parte de arriba)
    AYUDA_ANTES: 2.5,          // a las 5, una vez: corre a la puerta cuando a la Aberración le quedan estos s para entrar
    AYUDA_FUERA: 9,            // s que está fuera de la oficina
    HIELO: { x: 1210, y: 830, size: 170 },   // (muerto en la noche 5: el bloque de hielo, como Night6.HIELO)
  },

  // --- Al acabar la cinta, van a por ti (v0.86, el usuario: «que la noche empiece al
  // acabar la cinta, es decir, los enemigos van a por ti»): s hasta que se mueven
  INICIO: {
    DISLOCADO: 7,              // por los conductos (antes, 18 s sin nada)
    ERRANTE: 5,                // sale de la Criogenia (antes, ~35 s)
  },

  // --- La Aberración (Fase 4; src/systems/Aberracion7.js) ---
  // Sale del Laboratorio (la pared rota), pasa por el Comedor y entra en el
  // pasillo central: 5 posiciones (0, al fondo → 4, pegada a la compuerta) y la
  // compuerta. Es muy rápida. La compuerta NO se cierra (decisión del usuario):
  // se la frena alumbrándola. Con la linterna encima no avanza y retrocede; con
  // LUZ_TOTAL s de luz seguidos (el anillo lleno) huye. Si se suelta antes, el
  // anillo baja (más despacio) y vuelve a avanzar. En la compuerta, antes de
  // atacar: dedos, respiraciones, el metal que se comba y, a veces, la voz del
  // hombre. Si se acaba su tiempo en la compuerta: jumpscare.
  // Desde las 2:00 y hasta el núcleo (3:00) va a por el reactor (CAM 04): lo
  // enfría (DRAIN %/s). El señuelo (el botón de la cámara) en una sala vecina
  // del reactor la saca de allí, pero entonces va hacia la oficina.
  ABERRACION: {
    CASA: 'lab',
    // v0.99: al cruzar una sala que arde se le pega el fuego (llamas encima y la carne en brasa)
    ARDE_PRENDE: 2.5,          // s en una sala con fuego hasta arder entera
    ARDE_DURA: 50,             // s que tarda en apagarse del todo
    // v0.92 (el usuario: «que aparezca por todas las cámaras para llegar a ti»): una ruta al
    // azar en cada viaje; se la ve en cada cámara por la que pasa. Todas acaban en el
    // Comedor, de donde sale al pasillo central.
    // v0.94 (el usuario: «tiene que aparecer la Aberración más por las puertas»): también por
    // los corredores hasta las puertas de los lados (C. Oeste → izquierda, C. Este → derecha),
    // que SÍ se cierran: cerrada, la golpea y se va; abierta, entra. Las de las puertas, las
    // que más salen. Las que acaban en el Comedor siguen al pasillo central (la compuerta).
    RUTAS: [
      ['lab', 'reactor', 'mess', 'greenhouse', 'westHall', 'left_door'],
      ['lab', 'reactor', 'mess', 'greenhouse', 'westHall', 'left_door'],
      ['lab', 'cryo', 'lab', 'reactor', 'mess', 'greenhouse', 'westHall', 'left_door'],
      ['lab', 'reactor', 'medbay', 'hangar', 'comms', 'eastHall', 'right_door'],
      ['lab', 'reactor', 'medbay', 'hangar', 'comms', 'eastHall', 'right_door'],
      ['lab', 'reactor', 'mess'],
      ['lab', 'reactor', 'mess'],
    ],
    EN_PUERTA_LADO: [[4.6, 5.8], [3.3, 4.1]],   // (v1.17: +0,5 s)
    // (s en una puerta de los lados antes de entrar; antes 4,0–5,2 / 2,8–3,6)
    REACTOR_VECINAS: ['medbay', 'mess', 'lab'],   // el señuelo, en una de estas, la saca del reactor
    EN_CASA: [[4, 7], [2, 4]],           // s en el Laboratorio [12 AM, 6 AM] (v0.93: antes 9–15 / 4–8)
    EN_SALA: [[2.0, 2.8], [1.2, 1.7]],   // s en cada sala de su ruta
    // v0.93 (el usuario: «podrá atacar el reactor desde el primer momento»): en cada viaje,
    // hasta el núcleo (3:00), esta probabilidad de ir a por el reactor en vez de a por ti
    A_POR_EL_REACTOR: 0.35,
    PASO: [[2.3, 3.1], [1.2, 1.7]],      // (v1.17: un poco más lenta; antes 2,0–2,8 / 1,0–1,5)
    // (s entre posiciones del pasillo: muy rápida)
    EN_PUERTA: [[4.6, 5.6], [3.3, 4.0]], // (v1.17: +0,5 s)
    // (s en la compuerta antes de atacar; antes 4,0–5,0 / 2,8–3,5)
    POSICIONES: 5,
    LUZ_TOTAL: 3.0,                      // s de luz seguidos para echarla (v1.17: antes 3,5)
    LUZ_BAJA: 0.5,                       // el anillo baja a esta velocidad (×) si se suelta
    RETROCEDE: 1.0,                      // s de luz por cada posición que retrocede
    DRAIN: 1.7,                          // %/s que enfría el reactor mientras está allí
    EN_REACTOR_MAX: 22,                  // s que se queda en el reactor si no la sacan; luego va a por ti (v0.93: antes 60)
    AVISO_REACTOR: 9,                    // s entre los avisos «temperatura descendiendo»
    VOZ_HOMBRE: 0.35,                    // probabilidad de que en la compuerta se oiga la voz del hombre
  },

  // --- El Errante (solo cámaras): la imagen se distorsiona antes de apagarse ---
  ERRANTE_AVISO: { DESDE: 0.35 },        // (fracción de su STARE_TIME desde la que la imagen falla)
  // v0.93 (el usuario: «el Errante atacará más desactivando las cámaras»): sustituye a los de NIGHT5.ERRANTE
  ERRANTE: {
    STARE_TIME: 5,                       // s mirándole antes de que las apague (noche 5: 7) (v1.17: antes 4)
    CAM_EVERY: [[20, 30], [10, 16]],     // s entre asomadas de su cara en la imagen (noche 5: 45–70 / 24–36)
  },
  // --- El Dislocado: su arrastre, más fuerte y más cerca que otras noches ---
  DISLOCADO_ARRASTRE: { VOL: 2.1, CERCA: 0.55 },   // (v1.17: VOL 1,7 → 2,1)
  // v1.17 (el usuario: «sube los audios de los enemigos»): × el volumen de los sonidos de la Aberración
  // (Night7.sonido) y de la estática de El Errante en las puertas
  ENEMIGOS_VOL: 1.35,

  // --- Enemigos (F4 los ajusta) ---
  AGGRO: [0.95, 0.95],         // (v1.17, el usuario: «bájale un poco la dificultad»; antes 0,85)
  // (como NIGHT6.TURNO.AGGRO: intervalos y reacciones; más bajo = más rápidos)

  // --- La nave se rompe (Fase 5; src/systems/Night7Rotura.js) ---
  ROTURA: {
    ALARMA_VOL: 0.45,                    // la alarma de sabotaje (desde el núcleo al 100 %)
    ALARMA_RAPIDA: 1.3,                  // a las 5:00, más rápida
    FUEGO_VOL: 0.35,                     // el fuego, de fondo, desde las 5:00
    CADA_CALOR: [3.0, 6.0],              // s entre sucesos de 4:00 a 5:00 (una sala cada vez)
    CADA_ROTURA: [2.2, 4.5],             // s entre sucesos de 5:00 a 6:00
    FUEGO_CRECE: 0.05,                   // por segundo (el fuego de una sala)
    HUMO_CRECE: 0.03,                    // por segundo (× el fuego)
    MUERE_HUMO: 0.9,                     // con este humo, la cámara se quema
    // v0.96 (el usuario: «el fuego no es creíble, no hay explosiones»)
    FUEGO_CRECE_4: 0.012,                // por segundo: los focos simulados de 4:00 a 5:00 (pequeños)…
    FUEGO_CRECE_5: 0.03,                 // …y de 5:00 a 6:00 (grandes)
    ENNEGRECE: 45,                       // s en ennegrecerse del todo la carne de un cadáver ardiendo
    EXPLOSION_4: [20, 30],               // s entre explosiones de 4:00 a 5:00 (pequeñas)
    EXPLOSION_5: [5, 10],                // s entre explosiones de 5:00 a 6:00 (a veces dos seguidas, alguna grande)
    RESPIRO: [3, 5],                     // s sin sucesos después de una explosión grande
    QUEMA_DURA: 7,                       // s que tarda una cámara en quemarse (sobreexposición → negro; v0.97: antes 3,2)
    QUEMADAS_FINAL: 7,                   // cámaras quemadas al final de las 5 (quedan 3 de 10)
    ATASCO: [3, 5],                      // s que se queda atascada una puerta (no se puede cerrar)
    VAHO_TIEMPO: 70,                     // s en empañarse del todo la ventana (desde las 4:00)
    TEMP: [36, 61],                      // °C del módulo: a las 4:00 → a las 6:00
    // v0.97 (el usuario: «a las 3 pon algo leve», «las cámaras se empiezan a quemar a partir de
    // las 4», «añade explosiones a las rejillas»)
    LEVE_CADA: [9, 16],                  // s entre sucesos leves de 3:00 a 4:00 (chispas, vapor, luces)
    FUEGO_LEVE: 0.12,                    // los cadáveres, de 3:00 a 4:00: solo arden un poco (y humean)
    PRIMERA_EXPLOSION: 3,                // s después de las 4:00, la primera explosión
    EXPLOSION_MIRADA: 0.35,              // probabilidad de que explote la sala que estás mirando
    REJILLA_4: [28, 42],                 // s entre explosiones de las rejillas de la oficina, 4:00–5:00…
    REJILLA_5: [12, 20],                 // …y 5:00–6:00
    REJILLA_ARDE: [8, 14],               // s que se queda ardiendo y echando humo la rejilla
    REJILLA_HUMO: 0.6,                   // (v1.14) el humo que sale del conducto mientras aún arde (0–1; después, entero)
    // (el usuario: «que empiecen a caer paneles del techo, fieles al techo y a las paredes»)
    TECHO_4: [14, 24],                   // s entre paneles del techo que caen, 4:00–5:00…
    TECHO_5: [6, 11],                    // …y 5:00–6:00
    // v0.98: el fuego simulado de cada cadáver, más grande y más brillante en su cámara (en la imagen de
    // Blender queda pequeño en las salas grandes). tam = escala desde el foco; luz = la luz que echa sobre la sala
    FUEGO_SALA: {
      cryo: { tam: 1, luz: 1 },
      lab: { tam: 1.7, luz: 1.6 },
      greenhouse: { tam: 1.9, luz: 1.8 },
      hangar: { tam: 1.7, luz: 1.6 },
      // (v0.99: las seis salas sin cadáver, su foco 'fuego', que prende con la explosión de la pared)
      reactor: { tam: 1.8, luz: 1.8, brillo: 1.4 },
      mess: { tam: 1.7, luz: 1.7, brillo: 1.3 },
      medbay: { tam: 1.7, luz: 1.7, brillo: 1.3 },
      comms: { tam: 1.1, luz: 1.2, brillo: 0.35 },   // (aquí el fuego queda cerca de la lente: con más, un borrón blanco)
      westHall: { tam: 1.25, luz: 1.4, brillo: 0.45 },   // (también muy cerca de la lente)
      eastHall: { tam: 1.7, luz: 1.7, brillo: 1.3 },
    },
    FUEGO_BRILLO: 0.7,                   // v0.99: la pasada de luz encima del fuego simulado (todas las salas)
    ROTOS_MAX: 6,
    // F6: los respiros entre subidas: [hora, s] sin sucesos, explosiones ni rejillas
    CALMAS: [[4.5, 7], [5.35, 6], [5.75, 5]],
    // v0.99: los sonidos nuevos (tools/sonidos_n7.py --nuevos)
    CREPITAR_VOL: 0.5,                   // el crepitar de cerca (el fuego de la cámara que miras)
    METAL_CADA: [10, 22],                // s entre gemidos del casco (desde las 4:00; a las 5, más seguidos)                        // huecos (techo y pared) como mucho por sala
  },

  // --- La música (F3): un único archivo configurable, para poder cambiarla ---
  // (sin extensión: se prueba .ogg y luego .mp3; sin archivo, la noche va sin música)
  // v0.87: el remix de «Flamewall» (Camellia), tools/musica/flamewall_remix.py (+ .json, el
  // proyecto); dura justo la noche (la canción entera, 412 s; v1.00) y se corta a las 5:59. Empieza al acabar la
  // cinta (con el reloj de la noche) y lo sigue siempre (si se salta de hora, salta con él).
  // Para cambiarla por otra pista: este archivo (sin extensión: .ogg o .mp3).
  MUSICA: {
    ARCHIVO: 'assets/audio/musica/noche7',
    VOLUMEN: 0.85,             // (v1.17, el usuario: «bájale un poco la música, a un 85»; v0.88: 1,0; antes 0,55)
    BAJADA: 0.5,               // con un aviso importante, baja a esto… (para que se oiga el enemigo)
    BAJADA_S: 2.6,             // …estos segundos
    DESFASE: 0.3,              // s de diferencia con el reloj a partir de los que se resincroniza
    // los avisos que la bajan (además de toda alerta de la terminal: Game.alerta)
    AVISOS: ['enemyAtDoor', 'doorBlocked', 'erranteDoor', 'erranteFace', 'erranteCams', 'dislocadoNoise', 'dislocadoPeek', 'blackout'],
  },

  // --- 6:00: el final (lo diseña el usuario más adelante) ---
  // Game._n7Final() emite el evento 'finalNoche7' con el estado de la partida
  // ({ slaimi, cadaveres, ... }) y, mientras no haya final, pone esta pantalla.
  FINAL: {
    PANTALLA: 6,               // s de la pantalla provisional antes de volver al menú
  },
};
