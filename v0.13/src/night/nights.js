// =============================================================
// nights.js — Configuración de cada noche (dificultad).
//
// ai:           nivel de IA inicial (0–20) de cada enemigo.
//                 0 = no aparece esa noche. El Insecto y El Largo
//                 empiezan en la noche 2 (en la 1 están a 0).
// hourly:       subidas de IA a ciertas horas. {4: {largo: 1}} significa
//               "a las 4 AM, El Largo sube 1 nivel".
// vents:        true = hay conductos de ventilación (botón TOGGLE del
//               monitor, El Insecto, El Largo, fuga de gas). La noche
//               empieza con el reloj parado hasta ahuyentar a El
//               Insecto (ver night2.js).
// reactorMultiplier: multiplica la subida del reactor.
// coolCharges:  enfriamientos del reactor disponibles esa noche.
// cryo:         El Congelado.
//   changeEveryHours: cada cuántas horas cambia el requisito (mín/máx).
//   driftInterval:    cada cuántos segundos la temperatura se desvía 1 °C
//                     (siempre en contra del requisito).
//   marginMin/Max:    con cuántos grados de margen empieza cada requisito.
//   grace:            segundos de alarma antes de que salga a por ti.
// blackouts:    cuántos apagones de la oficina hay esa noche.
// ambient:      [mín, máx] segundos entre ruidos de la nave (caídas,
//               crujidos, golpes lejanos...): más seguidos cada noche.
// endingDuct:   true = al llegar a las 6 AM se oye algo metálico que se
//               acerca por el conducto y se va la luz antes de acabar
//               (anticipa la mecánica del ducto de la noche 2).
// =============================================================

export const NIGHTS = [
  {
    night: 1,
    ambient: [22, 45],
    // El Insecto y El Largo, desactivados: aparecen a partir de la noche 2.
    ai: { specimen: 3, insecto: 0, largo: 0 },
    hourly: { 4: { specimen: 1 } },
    reactorMultiplier: 1.0,
    coolCharges: 3,
    cryo: { changeEveryHours: 2, driftInterval: 7, marginMin: 4, marginMax: 6, grace: 20 },
    blackouts: 2,
    endingDuct: true,
  },
  {
    night: 2,
    ambient: [16, 34],
    // El Espécimen y El Congelado, un poco más agresivos que en la noche 1.
    // El Largo se activa a las 2 AM (NIGHT2.LARGO.START_HOUR).
    ai: { specimen: 4, insecto: 6, largo: 7 },
    hourly: { 4: { specimen: 1, largo: 1 }, 5: { insecto: 1 } },
    reactorMultiplier: 1.05,
    coolCharges: 3,
    cryo: { changeEveryHours: 2, driftInterval: 6.5, marginMin: 4, marginMax: 6, grace: 18 },
    blackouts: 2,
    vents: true,
  },
  {
    night: 3,
    ambient: [12, 26],
    ai: { specimen: 7, insecto: 8, largo: 8 },
    hourly: { 3: { insecto: 1 }, 4: { specimen: 1, largo: 1 } },
    reactorMultiplier: 1.2,
    coolCharges: 3,
    cryo: { changeEveryHours: 1, driftInterval: 5.5, marginMin: 3, marginMax: 5, grace: 14 },
    blackouts: 3,
    vents: true,
  },
  {
    night: 4,
    ambient: [9, 20],
    ai: { specimen: 9, insecto: 10, largo: 10 },
    hourly: { 3: { largo: 1 }, 4: { specimen: 1, insecto: 1 } },
    reactorMultiplier: 1.3,
    coolCharges: 2,
    cryo: { changeEveryHours: 1, driftInterval: 5, marginMin: 3, marginMax: 4, grace: 12 },
    blackouts: 3,
    vents: true,
  },
  {
    night: 5,
    ambient: [7, 15],
    ai: { specimen: 11, insecto: 12, largo: 12 },
    hourly: { 3: { insecto: 1, specimen: 1 }, 4: { largo: 1, specimen: 1 } },
    reactorMultiplier: 1.4,
    coolCharges: 2,
    cryo: { changeEveryHours: 0.75, driftInterval: 4.5, marginMin: 3, marginMax: 4, grace: 10 },
    blackouts: 4,
    vents: true,
  },
];

export function getNight(n) {
  return NIGHTS[Math.min(Math.max(n, 1), NIGHTS.length) - 1];
}
