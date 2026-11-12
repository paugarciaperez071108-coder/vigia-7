// =============================================================
// SustoDislocado.js — (v1.85) EL SUSTO NUEVO DE EL DISLOCADO (el usuario, 2026-11-11: «por las rejillas. La rejilla se
// arranca, sus manos agarran el borde y se arrastra a la mesa. Una mano tapa la cámara. Te agarra de las piernas y te
// arrastra hacia el interior del conducto, con la vista deslizándose hacia atrás hasta que la rejilla se cierra con sus
// dedos todavía fuera»). Sale por la rejilla que él rompió (en el juego, la rejilla ya está en el suelo: se la lleva y
// la cierra desde dentro). Fotogramas: tools/3d/sustos_v2/dislocado.py.
//   f00–f05 sus dedos en el borde del hueco · f06–f18 sale y cruza a la mesa · f19–f27 se arrastra hacia ti
//   f28–f35 UNA MANO TAPA LA CÁMARA · f36 EL GOLPE: te agarra de las piernas · f37–f58 te arrastra hasta el conducto
//   f59–f68 la rejilla se cierra desde dentro, con sus dedos entre las lamas
// =============================================================

import * as L from './EfectosLente.js';
import { SustoFotos, carga, listaCarpeta, imagen, lista, miniaturaDe, W, H } from './SustoFotos.js';

export const DISLOCADO = {
  FPS: 24,
  PRE: 0.3,
  PRE_GIRO: 0.1,
  GOLPE: 36,
  ULTIMO: 68,
  NEGRO: 0.45,
  SENAL: { 18: 0.7, 19: 0.3 },   // (estática al pasar de recorte a imagen entera)
  APAGON: [50, 15, 16],            // (en el apagón: la luz normal × esto, medido entre normal_<cara> y normal_apagon_<cara>)
  SONIDO: 'sustos/dislocado',
  PIERDE: { 37: 36, 39: 38, 40: 41, 44: 43, 53: 52 },   // (39–40: la cámara atraviesa el lado de la mesa)
  SANGRE: [88, 8, 6],
  TAPA: 32,                  // desde aquí su mano tapa la lente (negro, y el rojo de la piel a contraluz)
  REJILLA_ROTA: { left: [36, 330, 384, 570], right: [1180, 330, 392, 570] },
};
const C = DISLOCADO;

export function precargaDislocado() {
  for (const l of ['left', 'right']) carga(`dislocado_${l}`);
}
export const dislocadoListo = (lado = 'right') => listaCarpeta(`dislocado_${lado}`);

export class SustoDislocado extends SustoFotos {
  constructor({ lado = 'right', ...op } = {}) {
    super(C, op);
    this.lado = lado === 'left' ? 'left' : 'right';
    this.carpeta = `dislocado_${this.lado}`;
    this.fondoSrc = 'assets/salas/unica/normal_front.webp';
    carga(this.carpeta);
  }

  fondo(ctx) {
    super.fondo(ctx);
    const r = imagen(`assets/salas/unica/n5/rejilla_${this.lado}_rota.webp`);
    const [x, y, w, h] = C.REJILLA_ROTA[this.lado];
    if (lista(r)) ctx.drawImage(r, x, y, w, h);
  }

  temblor(f, u) {
    if (u >= 0) return u < 0.25 ? 0.4 + Math.exp(-u / 0.15) : (f !== null && f < 59 ? 0.35 : 0.1);
    return 0;
  }

  lente(ctx, f, u, effects) {
    if (f === 'negro') return;
    if (u < 0) {
      if (f !== null && f >= C.TAPA) this._tapa(ctx, Math.min(1, (f - C.TAPA + 1) / 2));
      effects?.vignette?.(ctx, 0.72);
      return;
    }
    if (f <= C.GOLPE) this._tapa(ctx, 1);          // (el golpe, aún con su mano en la lente: te agarra de las piernas)
    // la mano deja su sangre en la lente; el golpe de la caída; arrastrado, la señal falla
    const centro = [[W * 0.5, H * 0.48], [W * 0.44, H * 0.3], [W * 0.57, H * 0.33]];
    L.manchas(ctx, centro, Math.min(1, 0.4 + u / 0.8), { color: C.SANGRE, semilla: 51, tam: 1.5, alfa: 0.75 });
    L.grietas(ctx, [[W * 0.52, H * 0.55]], Math.min(1, u / 0.1), { semilla: 53, tam: 520 });
    L.separaColores(ctx, Math.max(0, 1 - u / 0.3));
    L.golpeRojo(ctx, Math.max(0, 1 - u / 0.4));
    L.senal(ctx, effects, 0.15 + 0.35 * Math.max(0, 1 - u / 0.4));
    L.cierra(ctx, L.suave(1.05, 1.3, u));
    effects?.vignette?.(ctx, 0.85);
  }

  /** La palma contra la lente: casi negro, la luz de la oficina pasa roja por la piel de los bordes y entre los dedos. */
  _tapa(ctx, k) {
    ctx.save();
    ctx.fillStyle = `rgba(4,0,0,${(0.97 * k).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
    const gr = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.25, W / 2, H * 0.55, H * 1.05);
    gr.addColorStop(0, 'rgba(60,6,4,0)');
    gr.addColorStop(1, `rgba(150,28,14,${(0.55 * k).toFixed(3)})`);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
    // entre los dedos se cuela un poco de luz (cada vez menos)
    ctx.globalCompositeOperation = 'lighter';
    for (const [x0, a] of [[560, -0.22], [720, -0.07], [880, 0.08], [1040, 0.24]]) {
      ctx.save();
      ctx.translate(x0, H * 0.62);
      ctx.rotate(a);
      const g2 = ctx.createLinearGradient(-14, 0, 14, 0);
      g2.addColorStop(0, 'rgba(180,40,20,0)');
      g2.addColorStop(0.5, `rgba(200,60,30,${(0.35 * (1.15 - k)).toFixed(3)})`);
      g2.addColorStop(1, 'rgba(180,40,20,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(-14, -H * 0.7, 28, H * 0.55);
      ctx.restore();
    }
    ctx.restore();
  }

  static miniatura(ctx, r) {
    miniaturaDe('dislocado')(ctx, r);
  }
}
