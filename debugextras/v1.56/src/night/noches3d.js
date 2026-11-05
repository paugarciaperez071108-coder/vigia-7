// =============================================================
// noches3d.js — (v1.55, plan «noches 2 y 4 con movimiento libre»: informes/2026-11-04_08-41_plan-noches-2-y-4-
// movimiento-libre.md; el usuario: «dale») Los recorridos de Libre3D de las noches 2 y 4.
//   Fase N1 (v1.55): la base. La estación entera, SIN ENERGÍA (la luz horneada casi a cero: solo se ve lo que cae en
//   la linterna), con el anillo de arriba horneado (C. Este, Comunicaciones y sus pasillos: tools/3d/final/noches.py
//   → hornear_sala.py --prefijo=n_) y los enemigos asomados (src/ending/Asomados3D.js, la mecánica de la luz de la
//   2.5). El recorrido «noches» es el de prueba (debug): libre por toda la estación desde la oficina.
//   Fases N2–N4 (la 2.5, el inicio de la noche 4 y la ruta B) usan lo mismo.
// =============================================================

import { NIGHT7 } from './night7.js';
import { NochesBase } from '../ending/Noches3D.js';
import { Noche2 } from '../ending/Noche2_3D.js';

export const NOCHES3D = {
  // (v1.56) la 2.5 en 3D en el juego (false: la de siempre, con las imágenes fijas)
  USAR_NOCHE2: true,
  // (v1.56) la huida de la 2.5 andando: en la de las imágenes eran 32 s de clic en clic; aquí, del reactor a la oficina
  // por el C. Oeste son unos 126 m (2,1 m/s andando, 4,4 corriendo con 6 s de aguante) y algún enemigo por el camino
  HUIDA_S: 75,
  // la luz horneada sin energía (× la de siempre): con la linterna (que la multiplica) se ve lo que alumbra
  BRILLO: 0.025,
  // la linterna: ESPACIO (como en las noches) y F (como en el 3D)
  // (v1.56, el usuario: «hazlo un 65 % más pequeño») ANGULO 0,36 → 0,131: el círculo al 35 % (tan 0,131 = 0,35 · tan 0,36)
  // (v1.56) APUNTA: el haz se mueve con el ratón dentro de este recuadro (rad a cada lado); al pasar del borde, gira la vista
  LINTERNA: { TECLA: ['Space', 'KeyF'], ALCANCE: 16, ANGULO: 0.131, FUERZA: 32, APUNTA: { X: 0.42, Y: 0.26 } },
  // los enemigos sin luz: nada (0); con la linterna, enteros
  VER_SIN_LUZ: 0.0,
  // recorrido de prueba: al entrar en una sala, esta probabilidad de que haya uno (y nunca dos seguidas sin ninguno)
  PRUEBA: { PROB: 0.5, PRIMERO_S: 6 },
  // las salas (cajas de Blender x0, y0, x1, y1) y su nombre (las de las cámaras)
  SALAS: [
    { n: 'hangar', caja: [-10.0, -9.9, 10.0, 13.0] },
    { n: 'comms', caja: [20.0, -10.0, 40.0, 10.0] },
    { n: 'eastHall', caja: [50.0, -10.0, 70.0, 10.0] },
    { n: 'medbay', caja: [-10.0, -40.0, 10.0, -20.0] },
    { n: 'reactor', caja: [20.0, -40.0, 40.0, -20.0] },
    { n: 'mess', caja: [50.0, -40.0, 70.0, -20.0] },
    { n: 'lab', caja: [20.0, -70.0, 40.0, -50.0] },
    { n: 'greenhouse', caja: [50.0, -70.0, 70.0, -50.0] },
    { n: 'cryo', caja: [20.0, -100.0, 40.0, -80.0] },
    { n: 'westHall', caja: [50.0, -100.0, 70.0, -80.0] },
    { n: 'office', caja: [84.3, -50.6, 95.35, -39.4] },
  ],
};

// las zonas de las noches: las del prólogo (en calma, sin daños) y, del anillo de arriba y lo que cambia, las n_*
export const ZONAS_NOCHES = [
  'n_hangar', 'n_pas_ch', 'n_comms', 'n_pas_ec', 'n_eastHall', 'n_pas_eo',
  'c_pas_hm', 'c_medbay', 'c_pas_mrz', 'c_reactor', 'c_pas_rl', 'c_lab', 'c_pas_lc', 'c_cryo_a', 'c_pas_rm', 'c_mess',
  'c_pc', 'c_pas_mg', 'n_greenhouse', 'c_pas_gw', 'c_westHall', 'c_pas_wo', 'c_oficina_c',
];

// el recorrido de prueba (debug): toda la estación a oscuras, desde la oficina, con asomados al entrar en las salas
NIGHT7.FINAL.LIBRE.RECORRIDOS.noches = {
  calma: true,            // (sin Aberración, humo ni fuego; si falta una sala, se sigue sin ella)
  brillo: NOCHES3D.BRILLO,
  linterna: NOCHES3D.LINTERNA,
  zonas: ZONAS_NOCHES,
  // (en la oficina, de pie, mirando a la consola y la ventana: yaw π = −x)
  inicio: { p: [91.3, -45.0], mira: [85.0, -45.0] },
  bloqueos: [
    { n: 'oficina_central', tipo: 'atascada', zona: [83.2, -31.6, 84.7, -28.4] },
    // la compuerta de atrás de la oficina (al pasillo central): en las noches 2 y 4 sin energía no se mueve
    { n: 'oficina_atras', tipo: 'atascada', zona: [94.0, -47.6, 95.3, -42.4], solido: [95.05, -48.0, 95.7, -42.0] },
  ],
  mod: (L, desde) => new NochesBase(L, { prueba: NOCHES3D.PRUEBA, salas: NOCHES3D.SALAS, verSinLuz: NOCHES3D.VER_SIN_LUZ }),
};

// (v1.56, fase N2) LA 2.5: el final de la noche 2 en 3D (src/ending/Noche2_3D.js). Empieza en la oficina, a oscuras.
NIGHT7.FINAL.LIBRE.RECORRIDOS.noche2 = {
  calma: true,
  brillo: NOCHES3D.BRILLO,
  linterna: NOCHES3D.LINTERNA,
  zonas: ZONAS_NOCHES,
  inicio: { p: [91.3, -45.0], mira: [85.0, -45.0] },
  bloqueos: NIGHT7.FINAL.LIBRE.RECORRIDOS.noches.bloqueos,
  mod: (L) => new Noche2(L, { salas: NOCHES3D.SALAS, verSinLuz: NOCHES3D.VER_SIN_LUZ, huidaS: NOCHES3D.HUIDA_S }),
};
