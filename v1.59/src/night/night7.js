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
    // (v1.24, Fase C del plan de los conductos) furiosa desde que muere El Dislocado y hasta las 6:00
    // (src/systems/Night7Muerte.js): más rápida por el pasillo, más luz para echarla y más viajes a por ti
    // (nunca al reactor). Se ajusta jugando para que siga siendo justo.
    FURIA: {
      PASO: 0.8,                         // × los s entre posiciones del pasillo
      LUZ_TOTAL: 3.6,                    // s de luz seguidos para echarla (en vez de LUZ_TOTAL)
      EN_CASA: 0.7,                      // × los s en el Laboratorio entre viaje y viaje
    },
  },

  // --- El Errante (solo cámaras): la imagen se distorsiona antes de apagarse ---
  ERRANTE_AVISO: { DESDE: 0.35 },        // (fracción de su STARE_TIME desde la que la imagen falla)
  // v0.93 (el usuario: «el Errante atacará más desactivando las cámaras»): sustituye a los de NIGHT5.ERRANTE
  ERRANTE: {
    // v1.18 (el usuario: «El Errante debe ser bufeado, no ataca casi»): se asoma mucho más y da menos margen
    STARE_TIME: 3.5,                     // s mirándole antes de que las apague (noche 5: 7; v1.17: 5)
    CAM_EVERY: [[9, 14], [5, 8]],        // s entre asomadas de su cara en la imagen (noche 5: 45–70 / 24–36; v1.17: 20–30 / 10–16)
    CAM_GRACE: 1.0,                      // s para quitar la cámara cuando se asoma (noche 5: 1,5)
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
    VOLUMEN: 0.4,              // (v1.22, el usuario: «baja la música»: 0,85 → 0,4; v1.17, el usuario: «bájale un poco la música, a un 85»; v0.88: 1,0; antes 0,55)
    BAJADA: 0.5,               // con un aviso importante, baja a esto… (para que se oiga el enemigo)
    BAJADA_S: 2.6,             // …estos segundos
    DESFASE: 0.3,              // s de diferencia con el reloj a partir de los que se resincroniza
    // los avisos que la bajan (además de toda alerta de la terminal: Game.alerta)
    AVISOS: ['enemyAtDoor', 'doorBlocked', 'erranteDoor', 'erranteFace', 'erranteCams', 'dislocadoNoise', 'dislocadoPeek', 'blackout'],
  },

  // --- v1.19: el caos de los conductos V1–V7 (4:00–6:00; src/systems/Night7Conductos.js). Solo imagen y
  // sonido: El Dislocado no cambia (plan aprobado, informes/plan_conductos_n7/) ---
  CONDUCTOS: {
    RETRASO: { v1: 0.02, v2: 0.06, v3: 0.1, v4: 0.04, v5: 0.13, v6: 0.08, v7: 0.03 },   // h tras cada cambio de hora
    FUNDE: 0.8,                          // s de fundido entre estados (sin evento)
    HUMO: { normal: 0, '4am': 0.35, '430': 0.75, '5am': 1 },   // el humo pegado al techo
    HUMO_DELANTE: 0.22,                  // el velo de humo por delante de El Dislocado (nunca le tapa)
    LUZ: { normal: 0, '4am': 0.6, '430': 0.85, '5am': 1 },     // la luz por la rejilla del suelo
    LUZ_DISLOCADO: { normal: 0, '4am': 0.1, '430': 0.16, '5am': 0.22 },   // el resplandor naranja sobre él
    AL_ROJO_LADO: { v1: 1, v3: -1, v4: 1 },
    FOGONAZO_CADA: [[38, 65], [14, 26]], // s entre fogonazos (antes de las 5 / desde las 5), en algún conducto
    INTERF: { DESDE: 5, CADA: [9, 18], DURA: [1, 2] },       // interferencias por el calor (s)
    TIC_CADA: [3, 8],                    // s entre los «tic» del metal
    VOL: 0.5,                            // todo el caos, por debajo del arrastre de El Dislocado
    VOL_MAX: 0.4,
    CREPITAR_VOL: 0.5,
    // las rejillas de la oficina antes de explotar: humo (4:00 → 5:00) y, a ratos, el resplandor de dentro
    REJILLAS_OFICINA: { HUMO: [0.18, 0.4], RESPLANDOR: 0.35, RESPLANDOR_VEL: 0.23 },
  },

  // --- v1.24 (Fases B y C del plan de los conductos): la muerte de El Dislocado (src/systems/Night7Muerte.js) ---
  MUERTE_DISLOCADO: {
    DESDE: 5,                            // h: desde aquí, en cuanto esté en un conducto (no asomado)
    LIMITE: 5.25,                        // h: a las 5:15, si está fuera de los conductos, vuelve para que ocurra
    AVISO: 1.6,                          // s del aviso (chillido metálico, la cámara parpadea en el plano)
    FOGONAZO: 1.6,                       // s del fogonazo que le alcanza (se retuerce y prende)
    PASO: [4.5, 7.5],                    // s en cada conducto, ardiendo (cada vez más despacio)
    SON_CADA: [1.4, 2.4],                // s entre sonidos de su arrastre torpe
    GEMIDO: 0.35,                        // probabilidad de que sea un gemido
    EN_REJILLA: 1.8,                     // s en V6/V7 antes de asomarse
    SILENCIO: 1.2,                       // s de silencio tras su último gemido (antes de quedarse colgado)
    FPS_ARDE: 8,                         // fotogramas/s de sus poses ardiendo (bucle de 8)
    ALERTA_TRAS: 1.0,                    // s colgado → «Señal biológica perdida – conductos»
    FURIA_TRAS: 2.4,                     // s colgado → el rugido de la Aberración
    TEMBLOR: 0.8,                        // la oficina tiembla
    LUCES: 1.8,                          // s de luces parpadeando
    VOL: 1.0,
  },

  // --- 6:00: el final (lo diseña el usuario más adelante) ---
  // Game._n7Final() emite el evento 'finalNoche7' con el estado de la partida
  // ({ slaimi, cadaveres, ... }) y, mientras no haya final, pone esta pantalla.
  FINAL: {
    PANTALLA: 6,               // s de la pantalla provisional antes de volver al menú
    // (v1.42, Fase 5 del final) los créditos (src/ending/Creditos.js), al acabar cualquiera de los 4 finales
    CREDITOS: {
      AUTOR: '',                 // (el nombre que va tras «UN JUEGO DE»; vacío: no sale esa línea)
      TRIPULACION: [['specimen', 'El Espécimen'], ['frozen', 'El Congelado'], ['insecto', 'El Insecto'], ['largo', 'El Largo'],
        ['errante', 'El Errante'], ['dislocado', 'El Dislocado'], ['aberracion', 'La Aberración'], ['slaimi', 'Slaimi']],
      HERRAMIENTAS: ['Blender', 'MPFB (MakeHuman)', 'three.js (licencia MIT)', 'Python'],
      ESPERA: 2.5,               // s de negro y estrellas antes de que suba el texto
      VELOCIDAD: 55,             // px/s que sube el texto
      RAPIDO: 5,                 // con Enter o Espacio pulsados, tantas veces más deprisa
      GRACIAS_S: 7,              // s de «Gracias por jugar.»
      VOLUMEN: 0.3,
      MUSICA_ENTRA: 4,           // s del fundido de entrada de la música
      ERRANTE_TONO: 0.84,        // (2 y 4) la música, más grave
    },
    // v1.20, Fase 1 del final: las 6:00 (src/ending/Final1.js)
    F1: {
      ATURDIDO_SLAIMI: 7,      // s tumbado y aturdido si Slaimi vive (llega él)
      ATURDIDO_SOLO: 10,       // … y si no (nadie viene)
      ACLARA_SOLO: 3.5,        // s que tarda en aclararse la vista sola (sin Slaimi)
      SLAIMI_LLEGA: 2.5,       // s hasta que se le oye por primera vez
      MIRA_PAUSA: 1.6,         // s mirando el charco de hielo antes de levantarse
      DE_PIE: 2.2,             // s de pie frente a la compuerta reventada
      PULSO_ATURDIDO: 52,      // pulsaciones por minuto, aturdido
      PULSO_DESPIERTO: 96,
      VUELVE_SONIDO: 9,        // s hasta que el fuego y la alarma vuelven del todo
      ACUFENO_VOL: 0.75,
      // (v1.23, el usuario) de pie, mirando alrededor con el ratón (la vista de 360°, Pano360.js): solo se puede salir
      // por la compuerta del pasillo central (el camino más largo al Hangar); las demás salidas están bloqueadas
      MIRA: {
        CAMPO: 90,               // grados de ángulo horizontal (los planos de Blender son de 90°)
        GIRO_MAX: 120,           // grados/s girando con el ratón en el borde de la pantalla
        BORDE: 0.28,             // fracción de media pantalla desde el centro en que empieza a girar
        INCL_MAX: 38,            // grados arriba/abajo (el ratón arriba/abajo)
        APUNTA: 22,              // grados desde el centro de la vista a una salida para ir hacia ella (W o clic)
        BUENA: 'compuerta',
        // lo que pasa al intentar una bloqueada, por orden y sin repetir seguidas
        REACCIONES: ['empuja', 'tose', 'slaimi'],
        SALE_S: 1.6,             // s andando hacia la compuerta antes del fundido
        AIRE_VOL: 0.5,           // el aire que entra por la buena, mirándola
        BRILLO_SLAIMI: 0.9,      // cuánto más brilla Slaimi mirando la buena
        BRAZOS_BAJA: 0.24,       // fracción de pantalla que bajas a Slaimi (en brazos) para mirar alrededor
      },
    },
    // Fase 2a del final: la huida, el camino tenso (src/ending/Huida.js; renders tools/3d/final/huida.py):
    // pasillo central → Comedor (cruce) → Reactor (cruce) → hasta la puerta del Laboratorio
    HUIDA: {
      VEL: 1.5,                // m/s andando (W pulsada)
      ACELERA: 3.0,            // m/s² al arrancar / frenar
      AGACHADO: 0.6,           // la velocidad agachado bajo la viga
      RATON: 1.0,              // cuánto mueve la vista el ratón (1 = todo el margen del render, un 10 %)
      AYUDA_S: 6,              // s de la ayuda de controles pequeña del principio
      PASO_M: 0.75,            // m entre pasos (el sonido)
      PULSO: 104,              // pulsaciones por minuto
      // el Reactor: a esta fracción del recorrido, una explosión lejana lo sacude todo y algo enorme se mueve
      // detrás de las paredes
      EXPLOSION_EN: 0.62,
      SACUDIDA_S: 1.6,
      // los cruces (vista de 360°, como al levantarte; el campo, como el de los recorridos para que no salte)
      CRUCE: {
        CAMPO: 68,
        BUENA: { mess: 'reactor', reactor: 'lab' },
        // lo que pasa al intentar una bloqueada (por orden); en la del fuego, el calor te echa atrás
        REACCIONES: { invernadero: ['calor', 'tose', 'slaimi'], enfermeria: ['empuja', 'tose', 'slaimi'] },
        SALE_S: 0.9,           // s girando hacia la salida buena antes de seguir andando
      },
      FIN_S: 2.0,              // s del fundido a negro en la puerta del Laboratorio (la persecución, Fase 2b, después)
    },
    // (v1.28, M0) el final en 3D en tiempo real: andar libre (src/ending/Libre3D.js; tools/3d/final/tr/)
    LIBRE: {
      LENTE: 74,               // grados en horizontal (como los renders)
      OJOS: 1.62,              // m, de pie (v1.56: el protagonista mide 1,75 m; los ojos, 13 cm más abajo)
      AGACHADO_OJOS: 0.95,     // m, agachado (bajo las vigas)
      RADIO: 0.3,              // m, el cuerpo (colisiones)
      PISA: 0.32,              // m: lo que no pasa de aquí se pisa por encima
      VEL: 2.1,                // m/s andando
      VEL_CORRE: 4.4,          // m/s corriendo (Shift)
      VEL_AGACHADO: 1.1,       // m/s agachado
      ACELERA: 9,              // (lo rápido que llega a la velocidad)
      FRENA: 11,
      AGUANTE_S: 6.0,          // s corriendo seguidos hasta quedarte sin aliento
      RECUPERA_S: 5.0,         // s parado para recuperarlo entero (andando, más)
      VUELVE_A_CORRER: 0.35,   // aguante para volver a correr tras agotarte
      PASO: 0.75,              // m por paso andando
      PASO_CORRE: 1.05,        // m por paso corriendo
      BALANCEO: 0.035,         // m, la cabeza al andar
      RATON: 0.0022,           // rad por píxel (con el ratón capturado)
      EXPOSICION: 1.0,         // (multiplica la exposición de la escena de Blender)
      AYUDA_S: 6,              // s de la ayuda de controles
      // (v1.29, M1) la huida entera en 3D
      USAR: true,              // al levantarte en la Fase 1, la huida en 3D (false: la de los renders, Huida.js)
      PISTA_S: 22,             // s en una sala sin encontrar la salida antes de que la pista se aclare
      PISTA_SUBE_S: 6,         // s que tarda en aclararse del todo
      FARO: 1.0,               // el resplandor verde del marco de la salida buena (0..1)
      LLAMA_ANCHO: 2.8,        // (el tamaño de cada llama: ×la de volumen de Blender)
      LLAMA_ALTO: 2.0,
      LLAMA_BRILLO: 0.55,
      LLAMA_ARCHIVO: 'llama_hd.webp',   // (v1.45) 512 × 768 por fotograma, animada de verdad (antes los 24 eran iguales)
      FIN_S: 1.2,              // s del fundido al cruzar la puerta del final del recorrido
      // (v1.31, M2) el humo de los fuegos
      HUMO_N: 260,             // partículas
      HUMO_RITMO: 26,          // nacen por segundo (repartidas entre los fuegos cercanos, según su fuerza)
      HUMO_LEJOS: 22,          // m: los fuegos más lejos no echan humo (no se ve)
      HUMO_VIDA: 9,            // s
      HUMO_TECHO: 4.2,         // m: donde se queda (si la sala no dice otra cosa)
      HUMO_ALFA: 0.5,
      HUMO_COLOR: [0.13, 0.12, 0.11],
      HUMO_AIRE: 0.9,          // lo que el aire de la salida buena arrastra el humo hacia ella
      HUMO_AIRE_R: 7,          // m alrededor de la salida buena
      // (v1.32, M3a) la persecución en 3D
      GATAS_OJOS: 0.45,        // m, a gatas (el conducto)
      // (v1.43) Slaimi en tus brazos en el 3D (la capa de tools/3d/final/slaimi_brazos.py): abajo a la derecha
      BRAZOS: { ARCHIVO: 'assets/final/huida/brazos_v143.webp', BAJA: 0.0, CENTRO: [971 / 1280, 547 / 720], RADIO: 0.26,
        MIEDO_DESDE: 0.2, TIEMBLA: 1.4, BRILLO_MIEDO: 1.4 },
      // (v1.45, el usuario: «algunas salas están vacías y muy oscuras») más luz en las que medían menos (brillo medio de
      // la imagen desde su entrada, 0–255: condb 19, central 29, lab 32, pas_mr 32, pas_lc 35, medbay 38; las demás, 43–79)
      // (v1.46: el pasillo central y el Laboratorio seguían muy oscuros; «plab» es el Laboratorio de la persecución, antes sin ajuste)
      // (v1.51) las salas del prólogo, en calma (c_*): la luz de siempre de las cámaras, algo subida para andar por ellas
      BRILLO_ZONA: { c_hangar: 2.4, condb: 1.9, central: 2.5, lab: 1.75, plab: 1.75, pas_mr: 1.7, pas_lc: 1.3, medbay: 1.2 },
      GATAS_BOCA: 0.8,         // (v1.43) m alrededor de las cajas «a gatas»: ya se choca como a gatas (para entrar por la boca)
      VEL_GATAS: 0.9,          // m/s a gatas
      SALTO_S: 1.1,            // s del fundido a negro al final del conducto (y otro tanto al salir)
      SALTO_CONDUCTO: 0.18,    // (v1.45) …ahora solo un parpadeo, sin soltar la W (el usuario: «que continúe usando la W»)
      // (v1.40, el usuario: «quitar la pausa… se sabe muy bien que va a aparecer algo») los fotogramas que se ven de
      // cada plano, [desde, hasta]: la pared revienta en cuanto te giras (fuera 18–39, mirando la pared intacta) y
      // el derrumbe explota nada más llegar (fuera 0–4, el plano quieto)
      PLANOS_SEC: { revienta: [[0, 17], [40, 95]], derrumbe: [[5, 35]] },
      // (v1.41) la memoria de la tarjeta: las texturas de luz, como mucho de este lado (las de 4096 ocupaban más de 3 GB
      // entre la huida y la persecución y la imagen se quedaba en negro al llegar al Reactor / Laboratorio)
      // (v1.45) la Aberración con el diseño de la biblia (aberracion_glb.py --sufijo=_v2 --relieve), su material y su luz
      AB_ARCHIVO: 'aberracion_v2',
      AB_MAT: { RELIEVE: 1.0, ASPEREZA: 0.5, METAL: 0.12 },
      AB_LUZ: { FUEGO: 18, FUEGO_COLOR: 0xffa060, ROJA: 4, ROJA_COLOR: 0xff4a38, FRIA: 7, FRIA_COLOR: 0x9fb4d0 },
      TEX_MAX: 2048,
      // (v1.41, el usuario: «básate en cómo sale Seek en Doors», «no debe de haber una cinemática») la Aberración sale
      // de la pared del Laboratorio justo antes del pasillo de la Criogenia: la vista se gira sola hacia ella un momento
      SALE: { MIRA_S: 1.1, MIRA_FUERZA: 7, LENTE: 0.82, RUGE_TRAS: 0.25, DESTELLO: 0.55, AVISO_ANTES: 0.9 },
      // (v1.41) el derrumbe de la puerta de evacuación de la Criogenia: explota de lejos, sin plano
      DERRUMBE: { DESTELLO: 0.8, SACUDE: 1.1, HUMO: 70 },
      PUERTA: { POR_W: 0.085, VUELVE: 0.12 },   // la puerta atascada: lo que abre cada W (de 1) y lo que vuelve por segundo
      AB_BORDES: 0.62,         // (v1.33) cerca a partir de la que sus brazos entran por los bordes de la pantalla
      // (v1.35, Fase 3) dentro de la nave de escape: la cabina, el botón y el despegue (src/ending/Cabina3D.js)
      CABINA: {
        ZONA: 'cabina',                       // (sus marcas: el botón, las pantallas, el hueco de Slaimi, el asiento)
        NAVE: ['nave', 'cabina', 'parabrisas'],   // lo que se mueve con la nave al despegar (y la compuerta)
        BAHIA: ['bahia_o', 'bahia_e'],        // las hojas de la trampilla del suelo del Hangar
        CRISTAL: ['parabrisas'],              // zonas de cristal (sin luz horneada)
        CRISTAL_OPACO: 0.16,
        ALARMA: ['cabina'],                   // zonas cuya capa que parpadea son las alarmas rojas
        ZUMBIDO: 0.32,                        // volumen del zumbido de la cabina
        GOLPES_CADA: [2.6, 4.4],              // s entre golpes en la compuerta (cada vez menos)
        GOLPES_MIN: 1.8,
        ABOLLA: 0.07,                         // m que hunde cada golpe
        ABOLLA_R: 0.28,                       // m, el tamaño de cada abolladura
        SENTARSE_R: 0.9,                      // m del asiento para sentarte
        MIRA_CONSOLA: -0.42,                  // rad: sentado, la vista baja hacia la consola
        DEJA_S: 1.4,                          // s dejando a Slaimi en el hueco
        VACIO_S: 1.3,                         // s mirando el asiento vacío (sin Slaimi)
        GIRO: 1.4,                            // rad que puedes girar la cabeza sentado
        PISTA_S: 18,                          // s sentado sin pulsar: la consola pita y el botón late más
        APUNTA: 0.13,                         // rad: lo que puedes fallar al apuntar al botón
        SLAIMI_ALTO: 0.55,                    // m (v1.42, el usuario: «slaimi es muy pequeño cuando está en la silla»: antes 0,36)
        SLAIMI_SUBE: 0.1,                     // m sobre el fondo del hueco (que se le vea entero)
        SLAIMI_EN: 'copiloto',                // (v1.39) dónde lo dejas: 'copiloto' (su asiento) o 'hueco' (la consola)
        SLAIMI_ASIENTO: [-0.08, -0.28],       // m desde la marca del copiloto: hacia el respaldo y hasta el cojín
        VENTANUCO: { R: 0.24, SUBE: 0.36 },   // (v1.47) el ventanuco de la escotilla: radio y altura sobre su centro (m)
        AB_BORDE: [-6.0, -2.3],               // dónde se asoma ella, al borde del agujero (al sur)
        AB_INCLINA: 0.5,                      // rad hacia el agujero
        // (v1.47, el usuario: «después de pulsar el botón no hay sensación de despegue… la cámara gira sola hacia la
        // pared de atrás… un segundo en negro») la salida sin cortes, plano a plano (plan aprobado: «me parece bien»):
        // S1 botón y alarma · S2 la escotilla (la Aberración golpea, su abolladura y sus dedos en el ventanuco) · S3 al
        // frente · S4 anclajes · S5 la caída por el tubo de lanzamiento · S6 los motores por el tubo · sigue Final4 (S7
        // fuera, el rugido se corta; S8 el silencio, la nave se gira y aparece la VIGIA-7)
        DESPEGUE: {                           // s desde el botón
          ALARMA: 0.3,                        // la alarma corta (y la luz roja de la cabina)
          ATRAS: [1.2, 1.8],                  // la vista se gira sola hacia la escotilla
          GOLPES: [2.0, 2.8, 3.5],            // la Aberración golpea (cada golpe abolla)
          ZOOM: [3.0, 3.8], ZOOM_LENTE: 0.5,  // la vista se acerca a la abolladura y a sus dedos (fov × 0,5)
          VUELVE: [4.0, 4.6],                 // al frente (lo lleva el golpe de los anclajes)
          ANCLAS: 4.6, BAHIA: 5.0, CAE: 5.6, IGNICION: 6.4,
          G: 6.0,                             // m/s² de la caída
          EMPUJE_TUBO: 34,                    // m/s² hacia abajo por el tubo (los motores de separación)
          SALE_Z: -17.5,                      // m: la nave ha salido del tubo (sigue Final4)
          MIRA_MAX: 0.2,                      // rad que puedes mover la vista con el ratón (nunca pierdes la acción)
          PEGA: 0.06, LENTE_MOTOR: 1.14,      // m que la cabeza va hacia atrás con los motores; fov × 1,14 (velocidad)
          ROJO: 0.85,                         // la luz roja de alarma sobre la escotilla
          ASOMA: [0.5, 0.2],                  // m: al girarte, la cabeza hacia el pasillo y arriba (que no tape el respaldo)
        },
        FUERA: { PANZA: 400, PANZA_Z: -3.2, HUECO: [-8.5, -3.5, -0.75, 8.0], LUZ_HUECO: 220, LUZ_PLANETA: 0.6,
          PLANETA_R: 1400, PLANETA_LEJOS: 260 },
      },
      // (v1.36, Fase 4) los 4 finales, desde la cabina (src/ending/Final4.js). Coordenadas de Blender.
      FINAL4: {
        USAR: true,
        MIRA: [45.0, -45.0, 6.0],          // el centro de la estación (adonde mira la nave)
        DESDE: [174.0, -4.0, 97.0],         // dónde está la nave (v1.44: más cerca, la estación más grande; antes 235, 15, 140)
        MORRO_BAJO: 0.32,                   // rad: el morro, por debajo de la estación (se la ve en el parabrisas)
        MIRA_ARRIBA: 0.1,                   // rad: tu cabeza (v1.43: 0,2 → 0,1, que se vea a Slaimi junto al cristal)
        MORRO: 0.2,                         // (v1.47) rad: el morro, por debajo de la estación (que salga en el parabrisas)
        ALTURA: 0.2,                        // (v1.47) rad: se la ve algo desde arriba (el planeta debajo)
        DERIVA: 14.0,                       // (v1.47) m/s: la nave se aleja (la VIGIA-7 se hace más pequeña; antes 3)
        // (v1.47) la salida, sin cortes desde la cabina (t = 0 al salir del tubo): los motores (S7), el corte del rugido
        // y el silencio en que la nave se gira hacia la estación (S8); luego la explosión, plano a plano
        SALIDA: { EMPUJE: 45, DURA: 1.4, GIRA: [1.4, 3.8], FRENA: 1.3 },
        E0: 3.8,                            // la estación entera, centrada, con el planeta debajo
        LEJOS: 9000,                        // m: lo más lejos que se dibuja
        BRILLO: 1.0,
        SOL: [0.55, 0.45, -0.7],            // (three: x, y, z) de dónde viene el sol
        PLANETA_R: 4000, HORIZONTE: 0.27,   // el planeta (de fondo): su borde, por debajo del horizonte (v1.47: 0,35 → 0,27: que se vea bajo la estación)
        NUBES: 70,                          // (lo menudas que son las nubes y los continentes)
        CIELO: 6000,
        BOLAS: 160,                         // bolas de fuego a la vez
        ENTRA_S: 2.5,                       // s del fundido de entrada
        CADENA: 6.8, CADENA_S: 0.7, CADENA_PARTE: 0.12,   // (v1.47) s: los fallos en cadena (3–4 s de un extremo a otro); s por cada 30 m; parte que salta
        REACTOR: 11.3,                      // s: el reactor estalla (v1.47: antes 15)
        TEMBLOR: 1.0,                       // (v1.47) s tras el fogonazo: el temblor grave que llega por el casco
        FOGONAZO_S: 2.2,                    // (v1.47) s que tarda en volver la imagen quemada
        ONDA_VEL: 150,                      // m/s de la onda
        VEL_REACTOR: 24,                    // m/s de los trozos (v1.47: antes 45; despacio, que se vean girar)
        TROZO: 16.0,                        // (v1.47) m: las placas vecinas saltan juntas, en secciones del casco (antes 7)
        TROZO_SUELTAS: 0.0,                 // la parte que salta sola (v1.47: antes 0,25: «confeti»)
        REACTOR_LATE: 1.0,                  // (v1.47) s antes del reactor: el núcleo pasa de rojo a blanco
        TROZOS_VOL: 30,                     // (v1.46) los trozos macizos (v1.58: 150 → 70: ahora hay vigas, paredes y muebles de verdad)
        // (v1.58, el usuario: «más realismo, que salgan elementos característicos del interior de la nave») src/ending/RestosInterior.js
        RESTOS: {
          USAR: true,
          POR_MODULO: [2, 3],               // muebles de esa sala que salen por la brecha en la cadena
          VEL: [7, 15],                     // m/s con los que salen
          FLOTA: 34,                        // muebles, vigas y paredes que lanza el reactor
          VEL_REACTOR: [9, 30],             // m/s
          GIRO: 0.7,                        // rad/s, como mucho
          CHORROS: 3,                       // chorros de aire por módulo
          CHORRO_S: [1.6, 3.2],             // s que dura cada chorro (se va quedando sin aire)
          VAPOR: 1600, VAPOR_S: 55, VAPOR_VEL: 34, VAPOR_VIDA: 1.5, VAPOR_TAM: 3.2, VAPOR_K: 0.55,
          PASA_FIN: 1.5,                    // m: al llegar aquí ya ha salido del parabrisas
          GOLPE: 0.32,                      // la sacudida del que roza la nave
          // los que pasan junto al parabrisas: t (s tras el reactor) cuando llega a tu altura, vel (m/s), x/y (m: a un lado y arriba),
          // giro (rad/s), luces (s que le dura la corriente)
          PASAN: [
            { tipo: 'silla', t: 4.0, vel: 30, x: -3.0, y: 1.0, giro: 1.7 },
            { tipo: 'camilla', t: 6.2, vel: 27, x: 3.6, y: 1.3, giro: 0.9 },
            { tipo: 'expendedora', t: 8.4, vel: 24, x: -4.8, y: 1.0, giro: 0.6, luces: 99 },
            { tipo: 'capsula', t: 11.0, vel: 20, x: 4.6, y: 1.5, giro: 0.42, luces: 99, quema: 0.1 },
            { tipo: 'panel', t: 13.2, vel: 26, x: 0.8, y: 2.6, giro: 0.9, choca: true },
            { tipo: 'servidor', t: 15.2, vel: 18, x: -3.4, y: 1.4, giro: 0.7, luces: 99 },
            { tipo: 'maceta', t: 17.4, vel: 15, x: -2.6, y: 1.5, giro: 0.5, quema: 0 },
          ],
        },
        CRISTALES: 900,                     // (v1.47) polvo y cristales que brillan
        FUGACES: 26,                        // (v1.47) restos que caen al planeta y arden al entrar (estrellas fugaces)
        SLAIMI_TE_MIRA: 999,                // (v1.47) la vista ya no se gira hacia Slaimi: se le ve abajo a la derecha
        // (v1.43, el usuario: «Slaimi tiene que verse junto a la ventanilla mientras explota la nave, iluminado por la
        // explosión, y después girarse hacia el protagonista y brillar. Dale 4-5 segundos y luz suficiente»)
        // (v1.47, el usuario: «Slaimi tapa el centro de la ventanilla… debería estar a un lado») abajo a la derecha
        SLAIMI_VENTANA: [-6.0, 6.75, 1.98],
        INCORPORA: [0, 0.05, 0.15],         // (v1.47) m: al girarte hacia la estación te incorporas (la consola tapa menos)
        SLAIMI_GIRA: 19.8,                   // s: se da la vuelta hacia ti (de espaldas, mirando fuera, a de frente)
        SLAIMI_GIRA_S: 0.9,                  // s que tarda en girarse
        SLAIMI_BRILLA_S: 4.0,                // s que brilla mirándote
        SLAIMI_LUZ: 0.7,                     // cuánto le ilumina la explosión (v1.47: 1,6 → 0,7: se quemaba en blanco)
        // (v1.43, el usuario: «en los momentos clave guía la vista hacia la ventanilla») la vista vuelve sola al parabrisas
        // si te apartas más de LIBRE rad, y no se aparta más de MAX (desde la cadena hasta que se calma)
        // (v1.47) la nave apunta a la estación: la vista, al frente, con ±0,12 rad de ratón (la ventanilla, recta)
        GUIA: { DESDE: 0, HASTA: 99, YAW: 0, LIBRE: 0.06, MAX: 0.12, FUERZA: 4 },
        MANO_TRAS: 9.5,                     // (3) s tras el reactor: tu mano en el cristal
        FIN: 33,                            // s: fin (con «VIGIA-7»): silencio 23,8–27,8, fundido 27,8–30,8, título
        ERRANTE: {                          // (2 y 4)
          // (v1.47) la misma explosión; su cara en el reflejo antes del fogonazo; la nave acelera recta hacia la estación
          CADENA: 6.8, REACTOR: 11.3,
          TUERCE: 7.0, REFLEJO: 7.4, CARA: 8.6, GIRA: 9.1, SLAIMI: 10.2, NEGRO: 11.35, FIN: 22.0,
          LUCHA: 0.25,                      // rad/s que consigues girar con A/D (al revés) — no basta
          EMPUJE: 95,                       // m/s² hacia la estación (v1.47: llegas justo cuando estalla)
        },
      },
      // Los recorridos (coordenadas de Blender: x, y en el suelo). Cajas [x0, y0, x1, y1].
      RECORRIDOS: {
        // (v1.32) la persecución: del Laboratorio (la pared revienta) al pasillo del Hangar
        persecucion: {
          // (v1.41) empieza en el Laboratorio intacto (lab, el de la huida) y sigue sin cortes desde la puerta; la pared
          // revienta (plab) al acercarte al pasillo de la Criogenia (el evento «sale»)
          zonas: ['lab', 'pas_rl', 'pas_lc', 'cryo_a', 'conda', 'condb', 'medbay', 'pas_mr', 'hoja', 'pas_hm', 'hangar', 'compuerta',
            'nave', 'cabina', 'parabrisas', 'bahia_o', 'bahia_e'],   // (v1.35: la nave va aparte: se mueve al despegar)
          inicio: { p: [24.5, -51.8], mira: [22.3, -70.0] },
          // (al reintentar: la pared ya reventada, cerca de la puerta del pasillo)
          reinicio: { p: [23.2, -64.5], mira: [22.3, -70.0] },
          caza_tras: 'sale',     // (la Aberración no está hasta que sale)
          gatas: [[15.0, -111.0, 27.2, -100.1], [9.8, -32.3, 13.2, -30.7]],
          // (v1.45) la boca del conducto de la Criogenia: delante, mirando hacia ella y con W, te metes (animación)
          boca: { zona: [24.6, -100.4, 27.4, -98.6], dentro: [26.0, -101.3], dura: 0.95, angulo: 1.1 },
          salas: [
            { n: 'lab', caja: [20.0, -70.0, 40.0, -50.0], buena: [22.3, -70.0, 1.9], pista_s: 8 },
            { n: 'cryo', caja: [20.0, -100.0, 40.0, -80.0], buena: [30.0, -100.0, 2.0], pista_s: 10 },
            { n: 'medbay', caja: [-10.0, -40.0, 10.0, -20.0], buena: [0.0, -20.0, 2.0], pista_s: 8 },
          ],
          bloqueos: [
            // (la puerta norte del Laboratorio, por donde entraste: la pared reventada ha echado fuego sobre ella)
            { n: 'lab_n', tipo: 'fuego', zona: [22.7, -51.8, 26.3, -50.2], solido: [22.8, -50.4, 26.2, -49.5], tras: 'sale' },
            // (v1.43) el fondo del conducto de la Criogenia: entre la tapa y las paredes quedaba un hueco por el que se salía a
            // gatas por fuera de las paredes (el usuario: «es un bug de los conductos que literalmente los puedo atravesar»)
            { n: 'cond_fondo', tipo: 'escombros', zona: [14.9, -110.15, 17.1, -110.0], solido: [14.9, -111.2, 17.1, -110.15] },
            // (v1.41) detrás de ti, el final del pasillo del Reactor (el Reactor ya no está cargado: no se vuelve)
            { n: 'vuelta', tipo: 'fuego', zona: [22.0, -42.2, 27.0, -41.0], solido: [22.0, -41.0, 27.0, -40.2] },
            // la puerta de evacuación de la Criogenia, derrumbada (después del derrumbe)
            { n: 'cryo_s', tipo: 'escombros', zona: [27.9, -99.9, 32.1, -97.3], tras: 'derrumbe' },
            // el pasillo del Reactor desde la Enfermería: arde (sin salida)
            { n: 'reactor', tipo: 'fuego', zona: [10.0, -25.4, 12.4, -21.6], solido: [12.5, -25.4, 13.1, -21.6] },
          ],
          // el suelo que arde en la Criogenia (a la izquierda, mirando al sur): quema si lo pisas
          fuego_suelo: [[30.3, -92.1, 31.9, -90.5]],
          eventos: [
            // (v1.41) la Aberración sale: revienta la pared este del Laboratorio detrás de ti, cerca de la puerta del pasillo
            { n: 'sale', caja: [20.0, -70.2, 40.0, -62.5], sale: { p: [39.2, -60.0, 2.0] }, quita: 'lab', pon: 'plab' },
            // (v1.41) el derrumbe de la puerta de evacuación, en cuanto entras en la Criogenia (de lejos, sin plano): la
            // buena pasa a ser la boca del conducto
            { n: 'derrumbe', caja: [20.0, -86.0, 40.0, -82.6], explota: { p: [30.0, -99.0, 1.6] }, quita: 'cryo_a', pon: 'cryo_d',
              buena: { sala: 'cryo', p: [26.0, -100.0, 0.5] }, ab_tras: 9 },
            // (v1.34) al entrar en el Hangar, la Aberración revienta la entrada detrás de ti
            { n: 'hangar', caja: [-3.0, -9.4, 3.0, -7.0], revienta: true, ab_tras: 6 },
            // el final del conducto: la oscuridad y sales por la rejilla de la Enfermería (otro tramo del carril)
            { n: 'conducto', caja: [15.0, -110.7, 17.0, -108.3], fin: { p: [12.75, -31.15], mira: [8.0, -31.15], gatas: true },
              carril: 1, ab_tras: 11 },
          ],
          // (v1.46: abierta del todo, se va hasta el fondo —recorre_libre—: con -0,95 quedaba un hueco estrecho a un lado y,
          // empujando por el centro, te quedabas clavado contra ella)
          puerta: { zona: 'hoja', empuje: [-1.6, -21.9, 1.6, -20.1], recorre: -0.95, recorre_libre: -1.9 },
          // (v1.34, Fase 2c) el final: la compuerta de la nave de escape (al oeste del Hangar, la rampa al sur)
          // (v1.35, Fase 3) dentro, el suelo a 1 m (piso); a los «cabina» s ya andas por la nave (Cabina3D.js)
          // (v1.46: empieza 0,6 m antes: el casco de la nave choca entero y no se llegaba a la caja de antes —te quedabas a
          // 0,9 m de la compuerta y te alcanzaba—; desde aquí la nave te mete sola)
          fin: { caja: [-6.75, -1.35, -5.25, 0.2], nave: { zona: 'compuerta', mira: [-6.0, -6.0], dentro: [-6.0, 0.4], piso: 1.0,
            abre: 1.6, cierra_s: 1.4, golpes: [2.3, 3.0], cabina: 3.4, fin_s: 6.5 } },
          // la Aberración: su carril (dos tramos: hasta el fondo del conducto y desde la rejilla de la Enfermería)
          caza: {
            carril: [
              [[39.2, -60.0], [31.0, -62.6], [24.0, -65.6], [22.3, -70.0], [22.3, -80.3], [26.2, -85.4], [28.75, -91.3], [29.6, -94.6], [26.0, -100.7],
                [26.0, -104.0], [16.0, -104.0], [16.0, -110.0]],
              [[12.75, -31.15], [9.5, -31.15], [6.6, -30.4], [3.0, -28.4], [0.6, -21.5], [0.0, -15.0], [0.0, -10.0], [-3.0, -5.5], [-6.0, -2.8], [-6.0, 0.0]],
            ],
            desfase: [0, 100],    // (el segundo tramo, más adelante en el camino)
            ventaja: 9,           // m de ventaja al empezar (y al reintentar)
            vel: 2.7,             // m/s: andando (2,1) te alcanza; corriendo (4,4) le sacas distancia
            goma: 16,             // m: si te alejas más, acelera
            lejos: 10,            // m: desde aquí se nota (el rojo, sus respiraciones)
            atrapa: 1.4,          // m: te alcanza
            mala: 1.6,            // m que se acerca al empujar una salida bloqueada
            quema: 2.5,           // m que se acerca si te quemas
            respiro_en: 3.0,      // m: Slaimi la ciega (una vez)
            respiro: 6.0,         // m que la echa atrás
            sin: [[15.0, -111.0, 27.2, -100.4], [9.8, -32.3, 13.2, -30.7]],   // (el conducto: no cabe)
            tras_conducto: ['condb', 'medbay', 'pas_mr', 'pas_hm', 'hangar'],   // (empezar ahí: el segundo tramo)
          },
        },
        huida: {
          // (v1.30) desde la oficina: al levantarte en la Fase 1 (girada para que su compuerta dé al pasillo)
          zonas: ['oficina', 'central', 'mess', 'pas_rm', 'reactor', 'pas_rl', 'lab'],
          inicio: { p: [86.9, -29.4], mira: [81.3, -30.0] },
          // cada sala: su caja y su salida buena [x, y, z] (la luz verde)
          salas: [
            { n: 'oficina', caja: [81.2, -35.0, 91.3, -25.0], buena: [81.2, -30.0, 2.0], pista_s: 16 },   // (5 salidas: antes)
            { n: 'central', caja: [70.2, -31.6, 81.1, -28.4], buena: [70.0, -30.0, 1.8] },
            { n: 'mess', caja: [50.0, -40.0, 70.0, -20.0], buena: [50.0, -36.0, 1.9] },
            { n: 'reactor', caja: [20.0, -40.0, 40.0, -20.0], buena: [24.5, -40.0, 1.9] },
          ],
          // las salidas bloqueadas: dónde se empujan (zona) y, si lo que las tapa no es sólido (fuego), su bloque
          bloqueos: [
            // la oficina: el C. Oeste arde; la puerta del C. Este, aplastada; las dos rejillas, enterradas
            { n: 'oeste', tipo: 'fuego', zona: [84.7, -26.6, 87.7, -25.0], solido: [84.7, -25.1, 87.7, -23.8] },
            { n: 'este', tipo: 'escombros', zona: [83.6, -35.3, 88.3, -32.9] },
            { n: 'rejilla_izq', tipo: 'escombros', zona: [88.8, -28.4, 91.2, -24.9] },
            { n: 'rejilla_der', tipo: 'escombros', zona: [88.8, -35.1, 91.2, -31.6] },
            { n: 'invernadero', tipo: 'fuego', zona: [50.4, -40.0, 54.2, -38.3], solido: [50.6, -41.0, 54.0, -39.75] },
            { n: 'enfermeria', tipo: 'escombros', zona: [20.0, -38.0, 25.0, -33.4] },
          ],
          fin: { caja: [22.9, -51.5, 26.1, -50.3], sigue: true },   // la puerta del Laboratorio: sigue la persecución (sin cortes)
        },
      },
    },
    // Fase 2b del final: la persecución de la Aberración (src/ending/Persecucion.js; renders
    // tools/3d/final/persecucion.py): Laboratorio → Criogenia → conducto → Enfermería (cruce) → pasillo del Hangar
    PERSECUCION: {
      VEL: 1.5,                // m/s andando (el Laboratorio, antes de que entre)
      CORRE: 3.2,              // m/s corriendo (W pulsada)
      GATAS: 0.8,              // m/s a gatas (el conducto)
      ACELERA: 5.0,
      AGACHADO: 0.55,          // bajo la viga (de la velocidad)
      RATON: 1.0,
      AYUDA_S: 5,
      PASO_M: 0.75,
      PASO_CORRE: 1.0,
      PULSO: 138,
      SACUDIDA_S: 1.6,
      ESQUIVA_ANTES: 16,       // fotogramas antes del fuego (a la izquierda) en los que D te aparta (A te mete en él)
      FORZAR: { POR_W: 1.6, VUELVE: 0.8 },  // fotogramas de la puerta por cada W; los que vuelve por segundo
      CRUCE: {
        CAMPO: 68,
        BUENA: { medbay: 'hangar' },
        REACCIONES: { reactor: ['tose', 'retrocede', 'slaimi'] },
        SALE_S: 0.7,
      },
      // La Aberración, detrás: la distancia (0 lejos, 1 te atrapa)
      ABERRACION: {
        INICIO: 0.4,           // al lanzarse (y al volver al punto de control)
        PARADO: 0.17,          // por segundo, parado
        CORRIENDO: 0.06,       // por segundo, corriendo a tope (baja)
        CONDUCTO: 0.1,         // por segundo en el conducto (no cabe: baja)
        CRUCE: 0.05,           // por segundo en el cruce de la Enfermería
        FORZAR: 0.075,         // por segundo forzando la puerta
        GOLPE: 0.2,            // contra la viga
        QUEMA: 0.2,            // el fuego del suelo
        MALA: 0.12,            // la salida mala del cruce
        DERRUMBE: 0.08,
        SALE: 0.5,             // al salir del conducto (ha dado la vuelta por fuera)
        MIN: 0.15,
        RESPIRO_EN: 0.82,      // Slaimi la ciega (una vez) al pasar de aquí…
        RESPIRO: 0.4,          // …y baja esto
      },
      FIN_S: 2.0,              // s del fundido a negro en la entrada del Hangar (la Fase 2c, después)
    },
  },
};
