// =============================================================
// prologo.js — (v1.51–v1.53) Los valores del prólogo «La llegada» (plan aprobado por el usuario: «dale+»;
// informes/2026-11-03_21-08_plan-logo-y-prologo-la-llegada.md). Sale solo la primera vez que se abre el juego
// (SaveData: prologo_visto), después del logo y antes del menú.
//   Fase B · la llegada en nave (src/prologo/Llegada.js)
//   Fase C · el camino a la oficina: el recorrido «prologo» de Libre3D (las salas EN CALMA: tools/3d/final/prologo.py →
//            hornear_sala.py --prefijo=c_ → assets/final/tr/c_*)
//   Fase D · al entrar en la oficina, empieza la Noche 1 sin cinta
// =============================================================

import { NIGHT7 } from './night7.js';

export const PROLOGO = {
  // ---------------------------------------------------------------- Fase B: la llegada en nave
  LLEGADA: {
    EXTERIOR: 'vigia_fuera_intacta',     // (la misma estación que estalla en el final, el día que llegas)
    MIRA: [45.0, -45.0, 6.0],            // el centro de la estación
    MORRO: 0.2,                          // rad: el morro, algo por debajo de ella (que salga en el parabrisas)
    MIRA_ARRIBA: 0.08,
    MIRA_MAX: 0.2,                       // rad que el ratón puede apartar la vista
    // la nave (su pivote, coordenadas de Blender): de lejos, por debajo del Hangar, por el tubo, atracada
    // (desde el sur: la estación delante; se pasa por debajo mirando su panza y se entra en el tubo ya hacia el norte,
    // como queda atracada)
    DESDE: [20.0, -330.0, 40.0],
    CONTROL: [-2.0, -110.0, -50.0],
    BAJO: [-6.0, 3.6, -62.0],
    BOCA: [-6.0, 3.6, -18.5],
    PIVOTE: [-6.0, 3.6, 0.0],
    ABRE: 1.6,                           // m que se corre la compuerta al abrirse
    // s: la aproximación, el giro del morro, la subida, el tubo, los anclajes, la calma, la compuerta, de pie
    T: { GIRA: [4.5, 8.0], SUBE: [8.0, 11.5], TUBO: [11.5, 14.5], ANCLA: 14.5, CALMA: [14.5, 18.5], ABRE: [18.5, 20.5],
      PIE: [20.5, 22.0], FIN: 22.0 },
    SON: { motor: 0.4, bahia_abre: 6.5, tubo: 11.4, bahia_cierra: 14.9, abre: 18.5, respira: 16.0 },
    SALTA_S: 1.2,                        // s manteniendo una tecla para saltarla
  },
  // ---------------------------------------------------------------- Fase C: el camino (2–3 min)
  CAMINO: {
    PISTA_S: 22,                         // s en una sala sin encontrar el paso: la pista se aclara (como en la huida)
    LINTERNA: { TECLA: 'KeyF', ALCANCE: 14, ANGULO: 0.42, FUERZA: 9 },
  },
};

// el recorrido «prologo» (en el mismo formato que los del final: NIGHT7.FINAL.LIBRE.RECORRIDOS)
NIGHT7.FINAL.LIBRE.RECORRIDOS.prologo = {
  llegada: true,          // (empieza sentado en la nave: Fase B)
  calma: true,            // (sin Aberración, sin humo, sin fuego: no se puede morir)
  linterna: PROLOGO.CAMINO.LINTERNA,   // (la linterna, con F: el Invernadero va a oscuras)
  zonas: ['nave', 'cabina', 'parabrisas', 'compuerta', 'bahia_o', 'bahia_e',
    'c_hangar', 'c_pas_hm', 'c_medbay', 'c_pas_mrz', 'c_reactor', 'c_pas_rl', 'c_lab', 'c_pas_lc', 'c_cryo_a', 'c_pas_rm', 'c_mess',
    'c_pc', 'c_pas_mg', 'c_greenhouse', 'c_pas_gw', 'c_westHall', 'c_pas_wo', 'c_oficina_c', 'n_central4', 'n_pas_eo', 'c_hoja'],
  // (v1.52) la primera puerta que se abre con E (o un clic): la de la Enfermería, al final del pasillo del Hangar
  // (tools/3d/final/prologo_puerta.py → c_hoja); caja: dónde hay que estar; recorre: m que se corre (a la izquierda)
  puertasE: [
    { n: 'enfermeria', zona: 'c_hoja', caja: [-1.9, -19.7, 1.9, -16.8], recorre: -3.15, dur: 1.3 },
  ],
  inicio: { p: [-6.55, 5.4], mira: [-6.55, 9.0] },
  // cada sala: su caja y su salida buena [x, y, z] (la luz verde); pista_s: cuándo se aclara la pista
  salas: [
    { n: 'hangar', caja: [-10.0, -9.9, 10.0, 13.0], buena: [0.0, -10.0, 1.8], pista_s: 25 },
    { n: 'medbay', caja: [-10.0, -40.0, 10.0, -20.0], buena: [10.0, -23.5, 1.8] },
    { n: 'reactor', caja: [20.0, -40.0, 40.0, -20.0], buena: [24.5, -40.0, 1.9] },
    { n: 'lab', caja: [20.0, -70.0, 40.0, -50.0], buena: [22.3, -70.0, 1.9] },
    { n: 'cryo', caja: [20.0, -100.0, 40.0, -80.0], buena: [22.3, -80.0, 1.9] },
    { n: 'mess', caja: [50.0, -40.0, 70.0, -20.0], buena: [70.0, -30.0, 1.8] },
    { n: 'greenhouse', caja: [50.0, -70.0, 70.0, -50.0], buena: [67.7, -70.0, 1.9], pista_s: 25 },
    { n: 'westHall', caja: [50.0, -100.0, 70.0, -80.0], buena: [70.0, -90.0, 1.8] },
  ],
  // lo que pasa al llegar a un sitio (una sola vez)
  eventos: [
    // la Criogenia vista: el camino vuelve por el Laboratorio y sigue por el Comedor
    { n: 'cryo_visto', caja: [26.0, -92.0, 40.0, -80.0], buena: { sala: 'reactor', p: [40.0, -36.0, 1.9] } },
    { n: 'cryo_visto2', caja: [26.0, -92.0, 40.0, -80.0], buena: { sala: 'lab', p: [24.5, -50.0, 1.9] } },
    // el Laboratorio: al pasar por delante de la pared sellada, UN golpe desde dentro (no vuelve a sonar)
    { n: 'golpe_lab', caja: [21.0, -64.0, 39.6, -56.0], golpe: { p: [40.2, -60.0, 2.0] } },   // (v1.52: en medio de la sala, por donde pases)
    // el pasillo central: la puerta de la oficina, sellada; hay que dar la vuelta (y el Comedor lleva al Invernadero)
    { n: 'central_visto', caja: [80.0, -32.0, 85.0, -28.0], buena: { sala: 'mess', p: [52.3, -40.0, 1.9] } },
    // el Invernadero, a oscuras: la tecla de la linterna, una vez y en pequeño
    { n: 'linterna', caja: [50.0, -57.0, 70.0, -50.0], linterna: true },
  ],
  // lo que no se abre: la compuerta de Comunicaciones (el camino de la puerta derecha) y la puerta del pasillo central
  // (v1.53) el casco de la nave no choca (es una caja que te encerraba al levantarte); dentro, sus paredes a mano
  sinChoque: ['nave'],
  bloqueos: [
    // la nave por dentro: los dos lados y el morro (la compuerta, al sur, abierta)
    { n: 'nave_o', tipo: 'pared', zona: [-99, -99, -99, -99], solido: [-7.9, -0.6, -7.35, 7.94] },
    { n: 'nave_e', tipo: 'pared', zona: [-99, -99, -99, -99], solido: [-4.65, -0.6, -4.1, 7.94] },
    { n: 'nave_morro', tipo: 'pared', zona: [-99, -99, -99, -99], solido: [-7.9, 7.45, -4.1, 8.0] },
    { n: 'comms', tipo: 'atascada', zona: [6.6, 6.1, 10.0, 9.3] },   // (v1.52: la placa que la sella está en x ≈ 7,5)
    { n: 'oficina_central', tipo: 'atascada', zona: [83.2, -31.6, 84.7, -28.4] },
    // (v1.59) tras estas dos compuertas de la oficina ya se ve el pasillo, pero no se puede pasar
    { n: 'oficina_atras', tipo: 'atascada', zona: [94.0, -47.6, 95.3, -42.4], solido: [95.05, -48.0, 95.7, -42.0] },
    { n: 'oficina_der', tipo: 'atascada', zona: [88.2, -40.8, 91.8, -39.4], solido: [88.2, -39.7, 91.8, -39.3] },
  ],
  // la puerta izquierda de la oficina: al cruzarla empieza la Noche 1 (Fase D)
  // (v1.53) hasta: dónde te quedas (dentro de la oficina); mira: hacia la consola y la ventana, la vista fija de la
  // oficina (yaw 0 = +x: en el modelo la compuerta de atrás está al este y el frente al oeste; la puerta izquierda, al sur)
  fin: { caja: [88.4, -50.6, 91.6, -49.4], prologo: { hasta: [91.3, -45.0], mira: Math.PI, anda_s: 1.6, gira_s: 2.2, cierra_s: 0.5, fin_s: 2.6 } },
};
