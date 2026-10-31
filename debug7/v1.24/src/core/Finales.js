// =============================================================
// Finales.js — Los 4 finales de VIGIA-7 (v1.10, final del juego, Fase 0).
//
// Cuál toca lo deciden dos datos de la partida:
//   - Slaimi: flags.slaimi.estado ('vivo' | 'muerto'; SaveData.slaimiDe);
//   - El Errante en tu cabeza: flags.erranteEnCabeza (src/systems/ErranteCabeza.js).
//
//            Slaimi vivo   Slaimi muerto
//   no            1              3
//   sí            2              4
//
// Los finales vistos se guardan APARTE de la partida, en su propia clave
// (FINALES_KEY): no se pierden al empezar una partida nueva. Se ven en el
// menú, en «FINALES (F)».
// =============================================================

const FINALES_KEY = 'vigia7_finales';

export const FINALES = [
  { n: 1, slaimi: 'vivo', errante: false, titulo: 'Escapaste con Slaimi.' },
  { n: 2, slaimi: 'vivo', errante: true, titulo: 'Te miró demasiado tiempo.' },
  { n: 3, slaimi: 'muerto', errante: false, titulo: 'Escapaste solo.' },
  { n: 4, slaimi: 'muerto', errante: true, titulo: 'Nadie te esperaba.' },
];

/** El número de final (1–4) que toca con estos flags. Sin datos de Slaimi, cuenta como muerto. */
export function finalQueToca(flags = {}) {
  const vivo = flags?.slaimi?.estado === 'vivo';
  const errante = !!flags?.erranteEnCabeza;
  return FINALES.find((f) => (f.slaimi === 'vivo') === vivo && f.errante === errante).n;
}

export const Finales = {
  /** Lista de los números de final vistos, ordenada. */
  vistos() {
    try {
      const d = JSON.parse(localStorage.getItem(FINALES_KEY) ?? '[]');
      return Array.isArray(d) ? [...new Set(d.filter((n) => FINALES.some((f) => f.n === n)))].sort() : [];
    } catch {
      return [];
    }
  },

  marcar(n) {
    if (!FINALES.some((f) => f.n === n)) return;
    const v = new Set(this.vistos());
    v.add(n);
    try {
      localStorage.setItem(FINALES_KEY, JSON.stringify([...v].sort()));
    } catch {}
  },

  /** (solo el modo debug) */
  borrar() {
    try {
      localStorage.removeItem(FINALES_KEY);
    } catch {}
  },
};
