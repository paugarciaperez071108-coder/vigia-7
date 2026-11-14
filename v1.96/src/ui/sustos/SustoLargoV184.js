// =============================================================
// SustoLargoV184.js — (v1.88: el ANTIGUO, solo para Extras > Beta y COMPARAR) EL SUSTO DE EL LARGO DE LA v1.84 (el usuario, 2026-11-11: «por el pasillo y la puerta. Las luces del
// pasillo estallan una a una a medida que se acerca, y el techo le roza. Una mano enorme se agarra al marco y sus brazos
// largos te rodean desde los lados del encuadre. Su sombra lo cubre todo antes de que se le vea el cuerpo»).
// Por el pasillo central (la vista de atrás), cuando llega guiado por el sonido (noches 3–6). Sustituye al susto en 3D de
// la v1.78 (que era la cabeza que se acerca). Fotogramas enteros: tools/3d/sustos_v2/largo.py.
//   f00–f05 las lámparas se encienden a tirones · f06–f31 corre doblado: cada lámpara se enciende con el choque de su
//   cabeza, se balancea (su sombra corre hacia ti) y estalla; chispas en el techo · f28–f33 la oficina se queda a oscuras
//   (luz de emergencia) · f34–f41 la mano en el marco · f42–f55 los brazos te rodean · f56 EL GOLPE: se cierran
// =============================================================

import * as L from './EfectosLente.js';
import { SustoFotos, carga, aplasta, W, H } from './SustoFotos.js';

export const LARGO_V184 = {
  FPS: 24,
  PRE: 0.3,
  PRE_GIRO: 0.1,
  GOLPE: 56,
  ULTIMO: 64,
  NEGRO: 0.45,
  SENAL: { 0: 0.7, 1: 0.3 },   // (estática al pasar de recorte a imagen entera)
  APAGON: [70, 14, 10],            // (en el apagón: la luz normal × esto, medido entre normal_<cara> y normal_apagon_<cara>)
  SONIDO: 'sustos/largo_v184',
  ESTALLIDOS: [11, 22, 31],      // (las lámparas que revientan: un respingo de la imagen)
  PIERDE: { 57: 56, 61: 60 },
};
const C = LARGO_V184;

export function precargaLargoV184() {
  carga('largo_v184_back');
}

export class SustoLargoV184 extends SustoFotos {
  constructor(op = {}) {
    super(C, op);
    this.carpeta = 'largo_v184_back';
    this.fondoSrc = 'assets/salas/unica/normal_back.webp';
    carga(this.carpeta);
  }

  temblor(f, u) {
    if (u >= 0) return 0.5 + Math.exp(-u / 0.2);
    if (f !== null && C.ESTALLIDOS.some((e) => f >= e && f < e + 2)) return 0.22;
    return 0;
  }

  lente(ctx, f, u, effects) {
    if (f === 'negro') return;
    if (u < 0) {
      if (f !== null && C.ESTALLIDOS.some((e) => f === e)) L.senal(ctx, effects, 0.35);
      effects?.vignette?.(ctx, 0.75);
      return;
    }
    // te aprietan: los lados se cierran, el golpe rojo, la lente revienta desde donde aprietan sus manos
    aplasta(ctx, L.suave(0.0, 0.3, u) * 0.85);
    L.grietas(ctx, [[60, H * 0.45], [W - 60, H * 0.5], [W / 2, H * 0.55]], Math.min(1, u / 0.1), { semilla: 37, tam: 640 });
    L.separaColores(ctx, Math.max(0, 1 - u / 0.3));
    L.golpeRojo(ctx, Math.max(0, 1 - u / 0.45));
    L.senal(ctx, effects, 0.4 * Math.max(0, 1 - u / 0.4));
    L.cierra(ctx, L.suave(0.15, 0.4, u));
  }

  static miniatura() {}
}
