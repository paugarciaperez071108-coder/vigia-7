// =============================================================
// nights.js — Configuración de cada noche (dificultad).
//
// ai:           nivel de IA inicial (0–20) de cada enemigo.
//                 0 = no aparece esa noche. El Alto y El Rastrero
//                 empiezan en la noche 2 (en la 1 están a 0).
// hourly:       subidas de IA a ciertas horas. {2: {alto: 1}} significa
//               "a las 2 AM, El Alto sube 1 nivel".
// reactorMultiplier: multiplica la subida del reactor.
// coolCharges:  enfriamientos del reactor disponibles esa noche.
// cryo:         El Congelado.
//   changeEveryHours: cada cuántas horas cambia el requisito (mín/máx).
//   driftInterval:    cada cuántos segundos la temperatura se desvía 1 °C
//                     (siempre en contra del requisito).
//   marginMin/Max:    con cuántos grados de margen empieza cada requisito.
//   grace:            segundos de alarma antes de que salga a por ti.
// blackouts:    cuántos apagones de la oficina hay esa noche.
// endingDuct:   true = al llegar a las 6 AM se oye algo metálico que se
//               acerca por el conducto y se va la luz antes de acabar
//               (anticipa la mecánica del ducto de la noche 2).
// =============================================================

export const NIGHTS = [
  {
    night: 1,
    // El Alto y El Rastrero, desactivados: aparecen a partir de la noche 2.
    ai: { specimen: 3, alto: 0, rastrero: 0 },
    hourly: { 4: { specimen: 1 } },
    reactorMultiplier: 1.0,
    coolCharges: 3,
    cryo: { changeEveryHours: 2, driftInterval: 7, marginMin: 4, marginMax: 6, grace: 20 },
    blackouts: 2,
    endingDuct: true,
  },
  {
    night: 2,
    ai: { specimen: 5, alto: 2, rastrero: 1 },
    hourly: { 2: { alto: 1 }, 3: { rastrero: 1, specimen: 1 }, 4: { alto: 1 } },
    reactorMultiplier: 1.1,
    coolCharges: 3,
    cryo: { changeEveryHours: 1.5, driftInterval: 6, marginMin: 4, marginMax: 5, grace: 16 },
    blackouts: 2,
  },
  {
    night: 3,
    ai: { specimen: 7, alto: 6, rastrero: 5 },
    hourly: { 2: { alto: 1 }, 3: { rastrero: 1 }, 4: { specimen: 1, alto: 1 } },
    reactorMultiplier: 1.2,
    coolCharges: 3,
    cryo: { changeEveryHours: 1, driftInterval: 5.5, marginMin: 3, marginMax: 5, grace: 14 },
    blackouts: 3,
  },
  {
    night: 4,
    ai: { specimen: 9, alto: 8, rastrero: 7 },
    hourly: { 2: { rastrero: 1 }, 3: { alto: 1 }, 4: { specimen: 1, rastrero: 1 } },
    reactorMultiplier: 1.3,
    coolCharges: 2,
    cryo: { changeEveryHours: 1, driftInterval: 5, marginMin: 3, marginMax: 4, grace: 12 },
    blackouts: 3,
  },
  {
    night: 5,
    ai: { specimen: 11, alto: 10, rastrero: 9 },
    hourly: { 2: { alto: 1 }, 3: { rastrero: 1, specimen: 1 }, 4: { alto: 1, specimen: 1 } },
    reactorMultiplier: 1.4,
    coolCharges: 2,
    cryo: { changeEveryHours: 0.75, driftInterval: 4.5, marginMin: 3, marginMax: 4, grace: 10 },
    blackouts: 4,
  },
];

export function getNight(n) {
  return NIGHTS[Math.min(Math.max(n, 1), NIGHTS.length) - 1];
}
