// =============================================================
// SustoEspecimen.js — (v1.87) EL SUSTO DE EL ESPÉCIMEN, 2.ª versión (el usuario, 2026-11-12: «te da un puñetazo en la
// cara y te come por la barriga… Lo violento se cuenta con lo que ve la lente, el sonido y lo que queda fuera de plano,
// no con anatomía a la vista… La imagen se apaga de a poco, no con un corte seco. Que dure entre 4 y 5 s»).
// Sustituye al de la v1.83 (el tirón y el arrastre; en Extras > Beta: SustoEspecimenV183.js).
// Solo con su compuerta ABIERTA (DoorEnemy: con ella cerrada se va). Fotogramas: tools/3d/sustos_v2/especimen.py.
//   f00–f05 nada (sus pasos se paran; la respiración por la nariz) · f06–f17 el tercer brazo (carne cosida) rodea el
//   marco · f18–f27 sale al hueco con la sonrisa · f28–f37 dos pasos tranquilos · f38–f49 de golpe, tres zancadas
//   rodeando la mesa (la vista le sigue) y se planta a 1,3 m · f50–f53 el puñetazo: su TERCER BRAZO sale disparado
//   con el puño cerrado · f53 EL GOLPE (destello blanco y rojo, visión doble, grietas y sangre desde el golpe, pitido y
//   el sonido amortiguado) · f54–f65 sales despedido y caes mirando al techo · f66–f73 de pie a tus pies; la cabeza se
//   gira hacia él (la luz de la puerta parpadea, los bordes se oscurecen) · f74–f81 se arrodilla y se encorva sobre ti
//   (su cabeza, fuera de plano) · f82–f99 te come: con cada mordisco, una sacudida y sangre en la lente; se apaga poco
//   a poco. Desde f74 los fotogramas van sobre f100 (el techo vacío, «base»).
// =============================================================

import * as L from './EfectosLente.js';
import { SustoFotos, carga, listaCarpeta, miniaturaDe, parpadeo, W, H } from './SustoFotos.js';

export const ESPECIMEN = {
  FPS: 24,
  PRE: 0.3,
  PRE_GIRO: 0.1,
  GOLPE: 53,
  ULTIMO: 99,
  NEGRO: 0.25,
  SENAL: { 18: 0.6, 19: 0.25 },  // (estática al pasar de recorte a imagen entera)
  APAGON: [42, 8, 5],            // (en el apagón: la luz normal × esto, medido entre normal_<cara> y normal_apagon_<cara>)
  SONIDO: 'sustos/especimen',
  PIERDE: { 54: 53, 57: 56 },
  TEMBLOR_PX: 70,
  PASOS: [40, 44, 48],           // las zancadas (un respingo de la imagen)
  SUELO: 63,                     // te das contra el suelo
  MORDISCOS: [83, 88, 93, 97],   // (los mismos que en el render)
  FUNDE: [84, 102],              // se apaga poco a poco entre estos fotogramas
  GOLPE_EN: [0.5, 0.5],          // dónde pega el puño (fracción de la imagen)
};
const C = ESPECIMEN;
const seg = (f) => (f - C.GOLPE) / C.FPS;       // s desde el golpe

export function precargaEspecimen() {
  for (const l of ['left', 'right']) carga(`especimen_${l}`);
}
export const especimenListo = (lado = 'left') => listaCarpeta(`especimen_${lado}`);

/** La sangre que salta a la lente: la del puñetazo y la de cada mordisco (desde abajo, desde tu barriga). */
function sangre() {
  const g = [{ t: 0.02, x: W * C.GOLPE_EN[0] + 30, y: H * C.GOLPE_EN[1] + 40, fuerza: 1.15 }];
  for (const m of C.MORDISCOS) {
    const r = L.azar(m * 3.1);
    g.push({ t: seg(m) + 0.05, x: W * (0.28 + 0.44 * r()), y: H * (0.62 + 0.26 * r()), fuerza: 0.5 + 0.45 * r() });
  }
  return g;
}
const SANGRE = sangre();

export class SustoEspecimen extends SustoFotos {
  constructor({ lado = 'left', ...op } = {}) {
    // (si la vista tiene que girarse hacia su compuerta, empieza 6 fotogramas más tarde: no pasa de 5 s)
    super((op.giro ?? 0) > 0 ? { ...C, DESDE: 6 } : C, op);
    this.lado = lado === 'right' ? 'right' : 'left';
    this.carpeta = `especimen_${this.lado}`;
    this.fondoSrc = `assets/salas/unica/normal_${this.lado}.webp`;
    carga(this.carpeta);
  }

  temblor(f, u) {
    if (u >= 0) {
      let k = u < 0.7 ? 0.25 + 1.5 * Math.exp(-u / 0.16) : 0;          // el puñetazo
      const s = u - seg(C.SUELO);
      if (s >= 0) k += 0.7 * Math.exp(-s / 0.09);                         // el suelo
      for (const m of C.MORDISCOS) {
        const b = u - seg(m);
        if (b >= 0) k += 0.55 * Math.exp(-b / 0.07);                      // cada mordisco te sacude
      }
      return k;
    }
    if (f === null) return 0;
    if (C.PASOS.some((p) => f >= p && f < p + 2)) return 0.16;          // sus zancadas, que retumban
    return 0;
  }

  lente(ctx, f, u, effects) {
    if (f === 'negro') return;
    if (u < 0) {
      // la luz de la puerta empieza a fallar cuando asoma el brazo
      if (f !== null && f >= 6) parpadeo(ctx, Math.min(0.6, 0.2 + 0.4 * (f - 6) / 20));
      effects?.vignette?.(ctx, 0.7);
      return;
    }
    // el golpe en la cara: la vista se desdobla y se recompone despacio; los colores se separan un instante
    L.desdobla(ctx, Math.max(0, 1 - u / 1.7));
    L.separaColores(ctx, Math.max(0, 1 - u / 0.35));
    // en la lente: las grietas desde donde pega el puño y la sangre (la del golpe y la de cada mordisco)
    L.grietas(ctx, [[W * C.GOLPE_EN[0], H * C.GOLPE_EN[1]]], Math.min(1, u / 0.08), { semilla: 53, tam: 620 });
    L.salpica(ctx, SANGRE, u, { semilla: 11 });
    // en el suelo: la luz de la puerta que parpadea; los bordes se oscurecen (late, a punto de perder el sentido)
    if (typeof f === 'number' && f >= 60) parpadeo(ctx, 0.35);
    L.oscureceBordes(ctx, 0.75 * L.suave(0.15, 1.2, u), 0.5 + 0.5 * Math.sin(u * 7.5));
    // el destello: blanco y luego rojo
    L.golpeRojo(ctx, Math.max(0, 1 - u / 0.42), { blanco: 0.35 });
    L.senal(ctx, effects, 0.35 * Math.max(0, 1 - u / 0.3));
    // se apaga poco a poco
    L.funde(ctx, L.suave(seg(C.FUNDE[0]), seg(C.FUNDE[1]), u));
  }

  static miniatura(ctx, r) {
    miniaturaDe('especimen')(ctx, r);
  }
}
