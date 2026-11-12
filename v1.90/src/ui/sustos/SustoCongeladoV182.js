// =============================================================
// SustoCongeladoV182.js — (v1.89: el ANTIGUO, solo para Extras > Beta y COMPARAR) EL SUSTO DE EL CONGELADO DE LA v1.82 (el usuario, 2026-11-11: «el susto tiene que salir por
// la puerta, no de la cápsula… Entra agachado (1,10 m), a toda velocidad, deslizándose por el suelo, y la escarcha se
// extiende por el suelo y las paredes a su paso. El hielo va cubriendo los bordes de la pantalla y le llegan las manos:
// dos palmas golpean y dejan marcas de hielo en la lente. La cápsula solo sale en el recuerdo de la carrera»).
// Sale por SU compuerta (la de su ruta: izquierda o derecha). Fotogramas: tools/3d/sustos_v2/congelado.py.
//   PRE   la cápsula vacía, un destello (el recuerdo de la carrera), y la compuerta quieta
//   f00–f27  por el pasillo, agachado y deslizándose; la escarcha por donde pasa; la luz de la puerta parpadea
//   f28–f33  cruza la compuerta y se levanta con los brazos por delante (la cabeza baja, fuera del encuadre)
//   f34   EL GOLPE: las dos palmas contra la lente (marcas de hielo, grietas, el destello frío)
//   f35–f60  los dedos se doblan y arañan; la imagen se congela, el hielo la cubre, se agrieta, negro
// =============================================================

import * as L from './EfectosLente.js';
import { SustoFotos, W, H, carga, imagen, lista, palmasHielo, aranazos, parpadeo } from './SustoFotos.js';

export const CONGELADO_V182 = {
  FPS: 24,
  PRE: 0.3,
  PRE_GIRO: 0.1,
  GOLPE: 34,
  ULTIMO: 60,
  CONGELA: 50,               // desde aquí la imagen se queda quieta (congelada)
  NEGRO: 0.45,
  SENAL: { 26: 0.7, 27: 0.3 },   // (estática al pasar de recorte a imagen entera)
  APAGON: [42, 8, 5],            // (en el apagón: la luz normal × esto, medido entre normal_<cara> y normal_apagon_<cara>)
  SONIDO: 'sustos/congelado_v182',
  PIERDE: { 35: 34, 41: 40 },
  DESTELLO: 0.16,            // s de la cápsula vacía al empezar
  CAPSULA: 'assets/salas/cam_cryo_vacia.jpg',
};
const C = CONGELADO_V182;

export function precargaCongeladoV182() {
  carga('congelado_v182_left');
  imagen(C.CAPSULA);
}

export class SustoCongeladoV182 extends SustoFotos {
  constructor({ lado = 'left', ...op } = {}) {
    super(C, op);
    this.lado = 'left';             // (en Beta, solo la compuerta izquierda)
    this.carpeta = 'congelado_v182_left';
    this.fondoSrc = 'assets/salas/unica/normal_left.webp';
    carga(this.carpeta);
    this.palmas = null;
  }

  fotograma(t) {
    const f = super.fotograma(t);
    return typeof f === 'number' && f > C.CONGELA ? C.CONGELA : f;
  }

  temblor(f, u) {
    if (u >= 0) return u < 0.5 ? 0.3 + Math.exp(-u / 0.18) : 0;      // (congelado: ya no tiembla)
    return f !== null && f >= 26 ? 0.12 : 0;
  }

  draw(ctx, t, effects = null) {
    super.draw(ctx, t, effects);
    // el recuerdo de la carrera: la cápsula vacía, un instante, entre estática
    const td = t - this.giro;
    if (td >= 0 && td < C.DESTELLO && this.fotograma(t) === null) {
      const im = imagen(C.CAPSULA);
      ctx.save();
      ctx.globalAlpha = 0.85;
      if (lista(im)) ctx.drawImage(im, 0, 0, W, H);
      ctx.restore();
      L.senal(ctx, effects, 0.8);
    }
  }

  lente(ctx, f, u, effects) {
    if (f === 'negro') return;
    const k = f === null ? 0 : Math.min(1, f / 33);
    if (u < 0) {
      // el frío llega antes que él: hielo por los bordes y la luz de la puerta que parpadea
      L.escarcha(ctx, 0.12 + 0.3 * k, { semilla: 5 });
      if (f !== null && f < 33) parpadeo(ctx, 0.6 + 0.4 * k);
      effects?.vignette?.(ctx, 0.7);
      return;
    }
    const fo = this.datos(Math.min(f, C.CONGELA));
    if (fo?.palmas) this.palmas = fo.palmas;
    const p = this.palmas ?? [[560, 470], [1040, 470]];
    // el golpe: un destello frío (no rojo), las marcas de las palmas y las grietas
    if (u < 0.22) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(190,225,255,${(0.8 * (1 - u / 0.22)).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    palmasHielo(ctx, p, Math.min(1, u / 0.12));
    L.grietas(ctx, p, Math.min(1, u / 0.08), { semilla: 13, tam: 520 });
    aranazos(ctx, p, L.suave(0.25, 0.9, u), { semilla: 41 });
    L.separaColores(ctx, Math.max(0, 1 - u / 0.25));
    // el hielo se come la imagen desde las palmas y los bordes; se congela (azul, quieta) y se cierra
    L.escarcha(ctx, 0.42 + 0.58 * L.suave(0.1, 0.9, u), { semilla: 7, desde: [...p, ...p] });
    if (u > 0.55) {
      ctx.save();
      ctx.globalCompositeOperation = 'color';
      ctx.fillStyle = `rgba(150,190,230,${(0.6 * L.suave(0.55, 0.9, u)).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      L.grietas(ctx, [[W / 2, H / 2], [W * 0.3, H * 0.7], [W * 0.75, H * 0.25]], L.suave(0.65, 0.8, u), { semilla: 17, tam: 700 });
    }
    L.senal(ctx, effects, 0.4 * Math.max(0, 1 - u / 0.3));
    L.cierra(ctx, L.suave(0.75, 1.05, u));
  }

  static miniatura() {}
}
