// =============================================================
// SustoLargo.js — (v1.88) EL SUSTO DE EL LARGO, 2.ª versión (el usuario, 2026-11-12: «entra por el pasillo y te deforma
// el cuerpo, arrancándote partes… la imagen se estira y se curva como si tiraran de ti… un brazo sale de plano tirado
// hacia arriba y la imagen se inclina bruscamente; después el otro, y la cámara cae… sangre en la lente y la vista que
// gira hacia el techo… sus dedos largos rozan la lente al final… lo ves siempre desde abajo y por partes, sin que su
// cabeza llegue a entrar en el encuadre. Termina con las luces que se apagan, no con la pantalla roja con grietas»).
// Sustituye al de la v1.84 (los brazos que te rodeaban; en Extras > Beta: SustoLargoV184.js).
// Por el pasillo central (la vista de atrás), cuando llega guiado por el sonido (noches 3–6). Fotogramas enteros:
// tools/3d/sustos_v2/largo.py (f00–f29, el pasillo de la v1.84).
//   f00–f33 las lámparas revientan una a una mientras corre; la oficina se queda a oscuras · f30–f36 te agachas detrás
//   de la tableta (tus manos, abajo) · f34–f41 su mano en el marco · f42–f53 entra · f54 te coge por los antebrazos ·
//   f60–f71 te estira: la imagen se alarga y se curva, tus brazos se alargan y se retuercen · f72 EL GOLPE: te arranca el
//   brazo izquierdo (la imagen se inclina de golpe) · f78 el derecho · f80–f90 caes mirando al techo · f91–f98 sus dedos
//   rozan la lente · f96–f102 las luces se apagan a tirones hasta el negro.
// =============================================================

import * as L from './EfectosLente.js';
import { SustoFotos, carga, listaCarpeta, miniaturaDe, W, H } from './SustoFotos.js';

export const LARGO = {
  FPS: 24,
  PRE: 0.3,
  PRE_GIRO: 0.1,
  GOLPE: 72,
  ULTIMO: 104,
  NEGRO: 0.2,
  SENAL: { 0: 0.7, 1: 0.3 },     // (estática al pasar de recorte a imagen entera)
  APAGON: [70, 14, 10],          // (en el apagón: la luz normal × esto, medido entre normal_<cara> y normal_apagon_<cara>)
  SONIDO: 'sustos/largo',
  ESTALLIDOS: [11, 22, 31],      // (las lámparas que revientan: un respingo de la imagen)
  PIERDE: { 73: 72, 79: 78 },
  AGARRA: 54,
  ESTIRA: [60, 72],              // te estira (la imagen se alarga y se curva)
  SEGUNDO: 78,                   // el otro brazo
  SUELO: 89,
  APAGA: [96, 102],              // las luces se apagan
  TEMBLOR_PX: 60,
};
const C = LARGO;
const seg = (f) => (f - C.GOLPE) / C.FPS;       // s desde el golpe

export function precargaLargo() {
  carga('largo_back');
}
export const largoListo = () => listaCarpeta('largo_back');

// la sangre: donde te arranca cada brazo (abajo, a cada lado) y alguna gota que salta al centro
const SANGRE = [
  { t: 0.04, x: W * 0.16, y: H * 0.82, fuerza: 1.2 },
  { t: 0.09, x: W * 0.36, y: H * 0.56, fuerza: 0.55 },
  { t: seg(C.SEGUNDO) + 0.04, x: W * 0.84, y: H * 0.8, fuerza: 1.0 },
  { t: seg(C.SEGUNDO) + 0.1, x: W * 0.62, y: H * 0.45, fuerza: 0.5 },
];

export class SustoLargo extends SustoFotos {
  constructor(op = {}) {
    // (si la vista tiene que girarse hacia el pasillo, empieza 10 fotogramas más tarde: no pasa de 5 s)
    super((op.giro ?? 0) > 0 ? { ...C, DESDE: 10 } : C, op);
    this.carpeta = 'largo_back';
    this.fondoSrc = 'assets/salas/unica/normal_back.webp';
    carga(this.carpeta);
  }

  temblor(f, u) {
    if (f === null) return 0;
    if (u >= 0) {
      let k = 0.35 + 1.3 * Math.exp(-u / 0.15);                         // el primer brazo
      const b = u - seg(C.SEGUNDO);
      if (b >= 0) k += 0.9 * Math.exp(-b / 0.14);                       // el segundo
      const s = u - seg(C.SUELO);
      if (s >= 0) k += 0.6 * Math.exp(-s / 0.1);                        // el suelo
      return u > seg(C.APAGA[0]) ? k * 0.4 : k;
    }
    if (C.ESTALLIDOS.some((e) => f >= e && f < e + 2)) return 0.22;
    if (f >= C.AGARRA && f < C.AGARRA + 3) return 0.45;                  // te coge
    if (f >= C.ESTIRA[0]) return 0.12 + 0.25 * (f - C.ESTIRA[0]) / (C.ESTIRA[1] - C.ESTIRA[0]);   // tira de ti
    return 0;
  }

  lente(ctx, f, u, effects) {
    if (f === 'negro') return;
    if (u < 0) {
      if (f !== null && C.ESTALLIDOS.some((e) => f === e)) L.senal(ctx, effects, 0.35);
      // te estira: la imagen se alarga y se curva (cada vez más)
      if (typeof f === 'number' && f >= C.ESTIRA[0]) L.estira(ctx, 0.75 * L.suave(C.ESTIRA[0], C.ESTIRA[1], f));
      effects?.vignette?.(ctx, 0.75);
      return;
    }
    // te arranca los brazos: la imagen, aún estirada, vuelve de golpe; los colores se separan; sangre en la lente
    const k = Math.max(0, 0.75 * Math.exp(-u / 0.12));
    if (k > 0.02) L.estira(ctx, k, { hacia: -1 });
    const b = u - seg(C.SEGUNDO);
    if (b >= 0 && b < 0.5) L.estira(ctx, 0.5 * Math.exp(-b / 0.1), { hacia: 1 });
    L.separaColores(ctx, Math.max(0, 1 - u / 0.3) + (b >= 0 ? Math.max(0, 0.7 - b / 0.3) : 0));
    L.salpica(ctx, SANGRE, u, { semilla: 41 });
    L.senal(ctx, effects, 0.4 * Math.max(0, 1 - u / 0.25));
    effects?.vignette?.(ctx, 0.85);
    // las luces se apagan a tirones hasta el negro (ni golpe rojo ni grietas)
    L.apagaLuces(ctx, L.suave(seg(C.APAGA[0]), seg(C.APAGA[1]), u), u);
  }

  static miniatura(ctx, r) {
    miniaturaDe('largo')(ctx, r);
  }
}
