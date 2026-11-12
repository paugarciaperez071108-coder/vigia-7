// =============================================================
// SustoEspecimenV183.js — (v1.87: el ANTIGUO, solo para Extras > Beta y COMPARAR; lado izquierdo) EL SUSTO DE EL ESPÉCIMEN DE LA v1.83 (el usuario, 2026-11-11: «llega por la puerta, y la puerta
// tiene que estar abierta… No rompe la puerta ni la atraviesa. Se oye el sonido que lo atrae y en el hueco abierto
// aparece primero su tercer brazo, que agarra el marco y la cámara. Después entra con la sonrisa que no cierra al fondo.
// Te agarra y te arrastra hacia el pasillo, con el encuadre sacudiéndose y la luz de la puerta parpadeando»).
// Solo con la compuerta ABIERTA (DoorEnemy: con ella cerrada se va). Fotogramas: tools/3d/sustos_v2/especimen.py.
//   f00–f05 nada (sus pasos se paran; la respiración por la nariz) · f06–f17 el tercer brazo rodea el marco
//   f18–f27 cruza la oficina hasta la cámara · f28–f43 la agarra; él sale al hueco, al fondo, con la sonrisa
//   f44 EL GOLPE: el tirón · f45–f66 te arrastra por el suelo hacia el pasillo (sacudidas, la luz parpadea)
// =============================================================

import * as L from './EfectosLente.js';
import { SustoFotos, carga, parpadeo, W } from './SustoFotos.js';

export const ESPECIMEN_V183 = {
  FPS: 24,
  PRE: 0.3,
  PRE_GIRO: 0.1,
  GOLPE: 44,
  ULTIMO: 66,
  NEGRO: 0.45,
  SENAL: { 18: 0.7, 19: 0.3 },   // (estática al pasar de recorte a imagen entera)
  APAGON: [42, 8, 5],            // (en el apagón: la luz normal × esto, medido entre normal_<cara> y normal_apagon_<cara>)
  SONIDO: 'sustos/especimen_v183',
  PIERDE: { 45: 44, 50: 49, 57: 56 },
  TEMBLOR_PX: 60,
};
const C = ESPECIMEN_V183;

export function precargaEspecimenV183() {
  carga('especimen_v183_left');
}

export class SustoEspecimenV183 extends SustoFotos {
  constructor(op = {}) {
    super(C, op);
    this.lado = 'left';
    this.carpeta = 'especimen_v183_left';
    this.fondoSrc = 'assets/salas/unica/normal_left.webp';
    carga(this.carpeta);
  }

  temblor(f, u) {
    if (u >= 0) return 0.45 + 0.9 * Math.exp(-u / 0.2);             // (arrastrado: no para de sacudirse)
    if (f !== null && f >= 28) return 0.08;                          // (su mano en la cámara: tiembla un poco)
    return 0;
  }

  lente(ctx, f, u, effects) {
    if (f === 'negro') return;
    if (u < 0) {
      // la luz de la puerta empieza a fallar cuando asoma el brazo
      if (f !== null && f >= 6) parpadeo(ctx, 0.25 + 0.5 * Math.min(1, (f - 6) / 30));
      if (f !== null && f >= 28) L.senal(ctx, effects, 0.06);
      effects?.vignette?.(ctx, 0.7);
      return;
    }
    // el tirón: el golpe rojo, la lente agrietada donde la agarran sus dedos y la señal rota; arrastrado, parpadea
    const dedos = [[W * 0.42, 70], [W * 0.5, 60], [W * 0.58, 72]];
    L.grietas(ctx, dedos, Math.min(1, u / 0.1), { semilla: 23, tam: 480 });
    L.manchas(ctx, dedos, Math.min(1, u / 0.6), { color: [70, 6, 6], semilla: 29, tam: 0.8, alfa: 0.7 });
    L.separaColores(ctx, Math.max(0, 1 - u / 0.3));
    L.golpeRojo(ctx, Math.max(0, 1 - u / 0.4));
    parpadeo(ctx, 0.9);
    L.senal(ctx, effects, 0.25 + 0.3 * Math.max(0, 1 - u / 0.5) + (Math.random() < 0.15 ? 0.3 : 0));
    L.cierra(ctx, L.suave(0.6, 0.95, u));
    effects?.vignette?.(ctx, 0.8);
  }

  static miniatura() {}
}
