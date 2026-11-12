// =============================================================
// SustoCongelado.js — (v1.89) EL SUSTO DE EL CONGELADO, 2.ª versión (el usuario, 2026-11-12: «la entrada actual, por
// el pasillo y la compuerta… se queda. Termina como el susto antiguo (v0.66, el salto sobre la lente)… sin que se note
// el corte. Las palmas con marcas de hielo del susto actual se quitan… Que siga teniendo la escarcha de los bordes y su
// sonido propio. Que dure entre 3 y 4 s»). Sustituye al de la v1.82 (las dos palmas; en Extras > Beta:
// SustoCongeladoV182.js). Sale por SU compuerta (la de su ruta: izquierda o derecha). Fotogramas:
// tools/3d/sustos_v2/congelado.py (f00–f27, los de la v1.82; desde f28, el salto en la misma escena).
//   PRE   la cápsula vacía, un destello (el recuerdo de la carrera), y la compuerta quieta
//   f00–f27  por el pasillo, agachado y deslizándose; la escarcha por donde pasa; la luz de la puerta parpadea
//   f28–f30  EL SALTO desde el umbral (desenfoque de movimiento; la luz sigue parpadeando)
//   f31   EL GOLPE: se te echa encima, la cara llena la lente (el salto antiguo, rehecho en la misma escena)
//   f31–f54  empuja, la cabeza a espasmos, las garras se cierran desde los lados y la boca se abre más (como el
//            antiguo: temblor creciente, colores separados, estática)
//   f55–f58  como el antiguo: la imagen se queda quieta, se congela (velo blanco azulado) y se agrieta · negro
// =============================================================

import * as L from './EfectosLente.js';
import { SustoFotos, W, H, carga, listaCarpeta, imagen, lista, miniaturaDe, parpadeo } from './SustoFotos.js';

export const CONGELADO = {
  FPS: 24,
  PRE: 0.3,
  PRE_GIRO: 0.1,
  GOLPE: 31,
  ULTIMO: 58,
  CONGELA: 54,               // el último fotograma renderizado: f55–f58 se queda quieto, se congela y se agrieta
  NEGRO: 0.45,
  SENAL: { 26: 0.7, 27: 0.3 },   // (estática al pasar de recorte a imagen entera)
  APAGON: [42, 8, 5],            // (en el apagón: la luz normal × esto, medido entre normal_<cara> y normal_apagon_<cara>)
  APAGON_ENCIMA: [118, 84, 104], // (en el apagón, desde el golpe: su cara, con su luz fría, se ve algo más)
  SONIDO: 'sustos/congelado',
  SALTO: 28,
  TEMBLOR_PX: 46,
  DESTELLO: 0.16,            // s de la cápsula vacía al empezar
  CAPSULA: 'assets/salas/cam_cryo_vacia.jpg',
};
const C = CONGELADO;

export function precargaCongelado() {
  for (const l of ['left', 'right']) carga(`congelado_${l}`);
  imagen(C.CAPSULA);
}
export const congeladoListo = (lado = 'left') => listaCarpeta(`congelado_${lado}`);

/** (las grietas de hielo del final antiguo, Jumpscare.js v0.66) 3 centros con 9 ramas quebradas cada uno. */
function grietasHielo(semilla) {
  let s = semilla;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const lineas = [];
  for (let c = 0; c < 3; c++) {
    const ox = 300 + rnd() * 1000;
    const oy = 200 + rnd() * 500;
    for (let k = 0; k < 9; k++) {
      let a = rnd() * Math.PI * 2;
      let x = ox;
      let y = oy;
      const pts = [[x, y]];
      for (let j = 0; j < 7; j++) {
        a += (rnd() - 0.5) * 0.9;
        const l = 40 + rnd() * 110;
        x += Math.cos(a) * l;
        y += Math.sin(a) * l;
        pts.push([x, y]);
      }
      lineas.push(pts);
    }
  }
  return lineas;
}

export class SustoCongelado extends SustoFotos {
  constructor({ lado = 'left', ...op } = {}) {
    super(C, op);
    this.lado = lado === 'right' ? 'right' : 'left';
    this.carpeta = `congelado_${this.lado}`;
    this.fondoSrc = `assets/salas/unica/normal_${this.lado}.webp`;
    carga(this.carpeta);
    this.grietas = grietasHielo(7 + Math.floor(Math.random() * 1000));   // (distintas cada vez, como el antiguo)
    this.tCongela = this.t0 + (C.CONGELA + 1 - this.ini) / C.FPS;
    this.congelaDura = (C.ULTIMO - C.CONGELA) / C.FPS;
    this.hielo = this.oscuro ? 0.45 : 1;          // (en el apagón, la escarcha blanca hacía de niebla: más suave)
  }

  colorApagon(f) {
    return typeof f === 'number' && f >= C.GOLPE ? C.APAGON_ENCIMA : C.APAGON;
  }

  fotograma(t) {
    const f = super.fotograma(t);
    return typeof f === 'number' && f > C.CONGELA ? C.CONGELA : f;
  }

  /** (k 0 → 1) cuánto lleva encima de ti: el temblor, los colores y la estática crecen como en el antiguo. */
  _k(u) {
    return Math.min(1, Math.max(0, u / ((C.CONGELA - C.GOLPE) / C.FPS)));
  }

  temblor(f, u, t) {
    if (u >= 0) {
      if (u >= this.tCongela - this.tGolpe) return 0;                      // (congelado: ya no tiembla)
      return 0.3 + 0.95 * this._k(u) + 0.9 * Math.exp(-u / 0.1);          // (el antiguo: 12 → 58 px; el golpe, un pico)
    }
    if (f !== null && f >= C.SALTO) return 0.25;                          // (el salto: la imagen da un respingo)
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
    if (u < 0) {
      const k = f === null ? 0 : Math.min(1, f / 30);
      // el frío llega antes que él: hielo por los bordes y la luz de la puerta que parpadea (también en el salto)
      L.escarcha(ctx, (0.12 + 0.3 * k) * this.hielo, { semilla: 5 });
      if (f !== null) parpadeo(ctx, 0.6 + 0.4 * k);
      if (f !== null && f >= C.SALTO) {
        L.separaColores(ctx, 0.25 + 0.15 * (f - C.SALTO));
        L.senal(ctx, effects, 0.12);
      }
      effects?.vignette?.(ctx, 0.7);
      return;
    }
    const uc = u - (this.tCongela - this.tGolpe);
    if (uc < 0) {
      // encima de ti (como el salto antiguo): un destello frío en el golpe, los colores separados y la estática que
      // crecen, bandas rotas a ratos; el hielo sigue cerrándose por los bordes
      const k = this._k(u);
      if (u < 0.14) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(190,225,255,${(0.55 * (1 - u / 0.14)).toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
      L.escarcha(ctx, (0.3 + 0.18 * k) * this.hielo, { semilla: 5 });
      L.separaColores(ctx, 0.35 + 0.65 * k + Math.max(0, 0.6 - u / 0.2));
      L.senal(ctx, effects, 0.08 + 0.18 * k);
      effects?.vignette?.(ctx, 0.85);
      return;
    }
    // se congela (el final del antiguo): la imagen quieta, el velo blanco azulado y las grietas de hielo que se abren
    const v = Math.min(1, uc / this.congelaDura);
    L.escarcha(ctx, (0.55 + 0.35 * v) * this.hielo, { semilla: 5 });
    ctx.fillStyle = `rgba(200,225,255,${((0.18 + 0.22 * v) * this.hielo).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.strokeStyle = 'rgba(235,245,255,0.9)';
    ctx.shadowColor = 'rgba(160,210,255,0.9)';
    ctx.shadowBlur = 6;
    ctx.lineWidth = 2.2;
    for (const pts of this.grietas) {
      const n = Math.max(2, Math.ceil(pts.length * Math.min(1, v * 2.2)));
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let j = 1; j < n; j++) ctx.lineTo(pts[j][0], pts[j][1]);
      ctx.stroke();
    }
    ctx.restore();
    effects?.static?.(ctx, 0.12);
    effects?.vignette?.(ctx, 0.85);
  }

  static miniatura(ctx, r) {
    miniaturaDe('congelado')(ctx, r);
  }
}
