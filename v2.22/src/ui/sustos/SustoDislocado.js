// =============================================================
// SustoDislocado.js — (v1.85) EL SUSTO NUEVO DE EL DISLOCADO (el usuario, 2026-11-11: «por las rejillas. La rejilla se
// arranca, sus manos agarran el borde y se arrastra a la mesa. Una mano tapa la cámara. Te agarra de las piernas y te
// arrastra hacia el interior del conducto, con la vista deslizándose hacia atrás hasta que la rejilla se cierra con sus
// dedos todavía fuera»). Sale por la rejilla que él rompió (en el juego, la rejilla ya está en el suelo: se la lleva y
// la cierra desde dentro). Fotogramas: tools/3d/sustos_v2/dislocado.py.
//   f00–f05 sus dedos en el borde del hueco · f06–f18 sale y cruza a la mesa · f19–f27 se arrastra hacia ti
//   f28–f35 UNA MANO TAPA LA CÁMARA · f36 EL GOLPE: te agarra de las piernas · f37–f58 te arrastra hasta el conducto
//   f59–f68 la rejilla se cierra desde dentro, con sus dedos entre las lamas
// (v2.09, el usuario: «el dislocado también necesita lo mismo que el insecto») Sus variantes de la noche 6 (VARIANTES_N6:
// 'conducto' | 'trampilla'; tools/3d/n6/susto_dislocado_n6.py), en la misma escena que su llegada y sin la oficina debajo:
//   f00–f07 quieto donde te alcanzó, la cabeza gacha · f08–f17 el brazo dislocado cruje y se estira hasta la lente
//   f16–f19 la palma llega · f20 SU MANO TAPA LA LENTE · f22 EL GOLPE: te agarra y tira · f23–f44 te arrastra, la vista
//   hacia atrás (conducto: la linterna se queda en el suelo; trampilla: te sube por la boca del conducto)
//   f45–f52 conducto: la linterna, lejos, parpadea y se apaga · trampilla: su mano baja la persiana desde dentro
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
// (v2.09) VINETA: el mismo haz de la linterna que pinta el juego en ese sitio (los de El Insecto, SustoInsecto.js), hasta el
// golpe; después la luz es la del render (la linterna, en el suelo). TAPA_ROJO: cuánta luz pasa roja por su mano (en el
// conducto, poca: detrás de él no hay luz). CALMA: desde aquí el temblor baja (ya no te arrastra). CIERRA: el cierre a
// negro (s desde el golpe), después de que se apague la linterna o se cierre la persiana.
export const VARIANTES_N6 = {
  conducto: { CARPETA: 'dislocado_n6_conducto', GOLPE: 22, ULTIMO: 52, TAPA: 20, SONIDO: 'sustos/dislocado_conducto', PIERDE: { 23: 22, 27: 26, 35: 34 }, SENAL: {},
    TAPA_ROJO: 0.22, CALMA: 45, CIERRA: [1.18, 1.3], VINETA: { x: 0.53, y: 0.56, r0: 0.108, r1: 0.57, medio: 0.62, borde: 0.88 } },
  trampilla: { CARPETA: 'dislocado_n6_trampilla', GOLPE: 22, ULTIMO: 52, TAPA: 20, SONIDO: 'sustos/dislocado_trampilla', PIERDE: { 23: 22, 27: 26, 41: 40 }, SENAL: {},
    TAPA_ROJO: 0.5, CALMA: 45, CIERRA: [1.18, 1.3], VINETA: { x: 0.5, y: 0.5, r0: 0.192, r1: 0.57, medio: null, borde: 0.65 } },
};

export function precargaDislocado() {
  for (const l of ['left', 'right']) carga(`dislocado_${l}`);
}
export const dislocadoListo = (lado = 'right') => listaCarpeta(`dislocado_${lado}`);
/** (v2.09) Los de la noche 6 (al empezar los conductos o la sala oculta). */
export function precargaDislocadoN6() {
  for (const v of Object.values(VARIANTES_N6)) carga(v.CARPETA, true);
}
/** (v2.09) ¿Están ya los fotogramas del susto de la noche 6 ('conducto' | 'trampilla')? Cargados de verdad (casi todos):
 * si no, el juego usa el susto antiguo en vez de enseñar negro. */
export function dislocadoN6Listo(sitio) {
  const v = VARIANTES_N6[sitio];
  if (!v || !listaCarpeta(v.CARPETA)) return false;
  const fotos = Object.values(carga(v.CARPETA).fotos);
  return fotos.filter(lista).length >= fotos.length * 0.9;
}

export class SustoDislocado extends SustoFotos {
  constructor({ lado = 'right', variante = null, ...op } = {}) {
    const v = VARIANTES_N6[variante] ? variante : null;
    super(v ? { ...C, ...VARIANTES_N6[v] } : C, v ? { ...op, fondo: false, oscuro: false } : op);
    this.variante = v;
    this.lado = lado === 'left' ? 'left' : 'right';
    this.carpeta = v ? this.C.CARPETA : `dislocado_${this.lado}`;
    this.fondoSrc = 'assets/salas/unica/normal_front.webp';
    if (v) this.conOficina = false;                  // (sin la oficina debajo: sus fotogramas son enteros)
    carga(this.carpeta);
  }

  /** (v2.09) En la noche 6, antes del primer fotograma, ese fotograma quieto (lo que se veía al alcanzarte). */
  fotograma(t) {
    const f = super.fotograma(t);
    return f === null && this.variante ? 0 : f;
  }

  fondo(ctx) {
    super.fondo(ctx);
    const r = imagen(`assets/salas/unica/n5/rejilla_${this.lado}_rota.webp`);
    const [x, y, w, h] = C.REJILLA_ROTA[this.lado];
    if (lista(r)) ctx.drawImage(r, x, y, w, h);
  }

  temblor(f, u) {
    if (u >= 0) return u < 0.25 ? 0.4 + Math.exp(-u / 0.15) : (f !== null && f < (this.C.CALMA ?? 59) ? 0.35 : 0.1);
    // (v2.09) el brazo que cruje en la parada y la palma que llega
    if (this.variante && (f === 11 || f === 12)) return 0.1;
    return 0;
  }

  /** (v2.09) El haz de la linterna del juego en ese sitio (hasta el golpe; luego se va). */
  _vineta(ctx, u) {
    const v = this.C.VINETA;
    const k = u < 0 ? 1 : Math.max(0, 1 - u / 0.12);
    if (!v || k <= 0) return;
    ctx.save();
    ctx.globalAlpha = k;
    const g = ctx.createRadialGradient(W * v.x, H * v.y, H * v.r0, W * v.x, H * v.y, H * v.r1);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    if (v.medio != null) g.addColorStop(0.55, `rgba(0,0,0,${v.medio})`);
    g.addColorStop(1, `rgba(0,0,0,${v.borde})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  lente(ctx, f, u, effects) {
    if (f === 'negro') return;
    const C = this.C;
    if (this.variante) this._vineta(ctx, u);
    if (u < 0) {
      if (f !== null && f >= C.TAPA) this._tapa(ctx, Math.min(1, (f - C.TAPA + 1) / 2));
      else if (this.variante && f >= 8) L.senal(ctx, effects, 0.03 + 0.08 * Math.min(1, (f - 8) / 9));   // (algo se acerca a la lente)
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
    const [c0, c1] = C.CIERRA ?? [1.05, 1.3];
    L.cierra(ctx, L.suave(c0, c1, u));
    effects?.vignette?.(ctx, 0.85);
  }

  /** La palma contra la lente: casi negro, la luz de la oficina pasa roja por la piel de los bordes y entre los dedos. */
  _tapa(ctx, k) {
    ctx.save();
    ctx.fillStyle = `rgba(4,0,0,${(0.97 * k).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
    const gr = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.25, W / 2, H * 0.55, H * 1.05);
    gr.addColorStop(0, 'rgba(60,6,4,0)');
    gr.addColorStop(1, `rgba(150,28,14,${((this.C.TAPA_ROJO ?? 0.55) * k).toFixed(3)})`);
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
      g2.addColorStop(0.5, `rgba(200,60,30,${(0.35 * (this.C.TAPA_ROJO ?? 0.55) / 0.55 * (1.15 - k)).toFixed(3)})`);
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
