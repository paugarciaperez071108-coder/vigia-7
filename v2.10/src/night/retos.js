// =============================================================
// retos.js — (v1.57) La noche de un reto o la noche personalizada: una noche de 12 a 6 en la oficina con cada enemigo a
// un nivel fijo (0 = no aparece · 20 = máximo). Los retos y sus textos: programa/extras.json. Sin la Aberración ni Slaimi.
//
// El Espécimen, El Insecto y El Largo ya usan el nivel de 0 a 20. Los otros tres se traducen aquí (ajustable):
//   El Congelado  su Criogenia (CRIO: valores en los niveles de referencia; entre uno y otro, a medias)
//   El Errante    lo que tarda en cada sala de su ruta (PASO_ERRANTE)
//   El Dislocado  su nivel, fijo toda la noche (en la noche 5 sube por horas)
// =============================================================

export const NOCHE_RETO = 99;    // (getNight lo reconoce; nunca se guarda en la partida)
export const ENEMIGOS_RETO = [
  ['frozen', 'El Congelado'], ['specimen', 'El Espécimen'], ['largo', 'El Largo'],
  ['insecto', 'El Insecto'], ['errante', 'El Errante'], ['dislocado', 'El Dislocado'],
];

// La Criogenia según el nivel de El Congelado (5 ≈ noche 2, 10 ≈ noche 5)
const CRIO = [
  [1, { changeEveryHours: 3, driftInterval: 8, marginMin: 5, marginMax: 7, grace: 24 }],
  [5, { changeEveryHours: 2, driftInterval: 6.5, marginMin: 4, marginMax: 6, grace: 18 }],
  [10, { changeEveryHours: 0.75, driftInterval: 4.5, marginMin: 3, marginMax: 4, grace: 10 }],
  [20, { changeEveryHours: 0.5, driftInterval: 3.5, marginMin: 2, marginMax: 3, grace: 6 }],
];
// El tiempo en cada sala de El Errante, por nivel (1 = lo de la noche 5, que es el nivel 10)
const PASO_ERRANTE = [[1, 1.7], [10, 1], [20, 0.55]];

function entre(tabla, n, f) {
  for (let i = 1; i < tabla.length; i++) {
    if (n <= tabla[i][0]) {
      const [a, va] = tabla[i - 1];
      const [b, vb] = tabla[i];
      return f(va, vb, Math.max(0, (n - a) / (b - a)));
    }
  }
  return tabla[tabla.length - 1][1];
}
const mezcla = (x, y, k) => x + (y - x) * k;

export function crioDeNivel(n) {
  return entre(CRIO, n, (a, b, k) => Object.fromEntries(Object.keys(a).map((c) => [c, mezcla(a[c], b[c], k)])));
}

// Extras de dificultad (extraId en extras.json):
export const EXTRA_RETO = {
  PUERTA_LENTA: 1,        // s que tarda en cerrarse la compuerta (el usuario); mientras baja, no protege
  MIRAR_ERRANTE: 0.6,     // s mirando su cámara para perder (lo justo para no matar por pasar de largo)
  UPDATE_TIEMPO: 10,      // s para escribir get-update cada hora
  AUDIOS: 10,             // «Sin ayudas»: audios para toda la noche (el usuario: ayudas limitadas)
  SOLTADAS: 8,            // «Sin ayudas»: soltadas de insecticida para toda la noche
  PASIVO_REACTOR: 0.8,    // «Reactor al límite»: calor pasivo un 20 % menor (el usuario)
};

export const pasoErrante = (n) => entre(PASO_ERRANTE, n, mezcla);

/** La configuración de la noche (como las de nights.js), con la de la noche 5 de base. */
export function nocheDeReto(def) {
  const N = def.niveles;
  const cryo = crioDeNivel(Math.max(1, N.frozen));
  if (def.extraId === 'crioMitad') {
    cryo.marginMin /= 2;
    cryo.marginMax /= 2;
  }
  return {
    night: NOCHE_RETO,
    reto: def,
    ambient: [7, 15],
    ai: { specimen: N.specimen, insecto: N.insecto, largo: N.largo, errante: N.errante, dislocado: N.dislocado },
    hourly: {},
    coolCharges: def.extraId === 'sinEnfriar' ? 0 : 2,
    cryo,
    blackouts: 2,
    vents: true,
    largoMode: 'oido',
    n5: true,
  };
}
