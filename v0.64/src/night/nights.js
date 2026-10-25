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
// (El reactor se calienta igual todas las noches: CONFIG.REACTOR en config.js.)
// coolCharges:  enfriamientos del reactor disponibles esa noche.
// cryo:         El Congelado.
//   changeEveryHours: cada cuántas horas cambia el requisito (mín/máx).
//   driftInterval:    cada cuántos segundos la temperatura se desvía 1 °C
//                     (siempre en contra del requisito).
//   marginMin/Max:    con cuántos grados de margen empieza cada requisito.
//   grace:            segundos de alarma antes de que salga a por ti.
// blackouts:    cuántos apagones de la oficina hay esa noche.
// doorWait:     [mín, máx] segundos que espera El Espécimen en la
//               compuerta antes de entrar (si no se pone: DOOR_WAIT_MIN/MAX
//               de config.js, 5-9 s). Más = más margen para cerrar.
// ambient:      [mín, máx] segundos entre ruidos de la nave (caídas,
//               crujidos, golpes lejanos...): más seguidos cada noche.
// ventsUpdate:  true = las cámaras de ventilación empiezan sin señal y hay
//               que escribir get-update (solo la noche 2). En las demás
//               noches con conductos ya están en línea desde el principio.
// finalSequence: true = a las 6 AM no se gana: empieza el final de la
//               noche 2 (linterna, ruta al reactor y enfriamiento; ver
//               night2ending.js). Solo la noche 2.
// largoMode:    'oido' = El Largo se guía por el sonido y llega por las
//               compuertas y el pasillo central (noche 3+, LargoOido.js;
//               valores en night3.js). Sin él, el de la noche 2.
// corridorStart: true = la noche empieza con El Largo al fondo del pasillo
//               central (inicio de la noche 3, NIGHT3.INTRO).
// event3am:     true = a las 3 AM El Largo rompe las cámaras de los
//               corredores, salen los triángulos ⚠ en el minimapa, todos
//               son más agresivos y suena la cinta 3.5 (NIGHT3.EVENT_3AM).
// lockersEnding: true = a las 6 AM las cámaras siguen rotas y hay que
//               esconderse en una taquilla (final de la noche 3, NIGHT3.ENDING).
// lockerStart:  true = la noche empieza dentro de la taquilla (inicio de la
//               noche 4): se elige reactivar la luz (A) o reparar las cámaras
//               (B). Valores en night4.js.
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
    coolCharges: 3,
    cryo: { changeEveryHours: 2, driftInterval: 7, marginMin: 4, marginMax: 6, grace: 20 },
    blackouts: 2,
    endingDuct: true,
  },
  {
    night: 2,
    ambient: [16, 34],
    // El Espécimen y El Congelado, un poco más agresivos que en la noche 1.
    // El Largo NO sale en las cámaras de la noche 2 (largo: 0): solo en el
    // final con linterna (noche 2.5, Night2Ending.js). Su lógica de cámaras
    // (Largo.js, NIGHT2.LARGO) sigue preparada para la noche 3.
    // Suavizada en v0.14 (dificultad ~4,5/10, medida con 1.000 partidas):
    // El Insecto 6 → 5, sin subida de El Espécimen a las 4 AM y 1 s más
    // de margen en la compuerta (5-9 s → 6-10 s).
    ai: { specimen: 4, insecto: 5, largo: 0 },
    hourly: { 5: { insecto: 1 } },
    doorWait: [6, 10],
    coolCharges: 3,
    cryo: { changeEveryHours: 2, driftInterval: 6.5, marginMin: 4, marginMax: 6, grace: 18 },
    blackouts: 2,
    vents: true,
    ventsUpdate: true,
    finalSequence: true,
  },
  {
    night: 3,
    ambient: [12, 26],
    // El Largo «por el oído» (su nivel de IA marca lo rápido que deambula
    // lejos de la oficina; sus tiempos de reacción, en night3.js).
    ai: { specimen: 6, insecto: 6, largo: 8 },
    hourly: { 4: { specimen: 1, largo: 1 } },
    coolCharges: 3,
    cryo: { changeEveryHours: 1.5, driftInterval: 6, marginMin: 3, marginMax: 5, grace: 16 },
    blackouts: 2,
    vents: true,
    largoMode: 'oido',
    corridorStart: true,
    event3am: true,
    lockersEnding: true,
  },
  {
    night: 4,
    ambient: [9, 20],
    ai: { specimen: 9, insecto: 10, largo: 10 },
    hourly: { 3: { largo: 1 }, 4: { specimen: 1, insecto: 1 } },
    coolCharges: 2,
    cryo: { changeEveryHours: 1, driftInterval: 5, marginMin: 3, marginMax: 4, grace: 12 },
    blackouts: 3,
    vents: true,
    largoMode: 'oido',
    lockerStart: true,
  },
  {
    // Noche 5 (v0.46): sales de la taquilla (con Slaimi si sigue vivo).
    // El Errante (puertas que solo se oyen y su cara en las cámaras) y El
    // Dislocado (rejillas del frente, desde las 2 AM). Final: fuga de
    // Criogenia (src/ending/Night5Leak.js). Valores propios en night5.js.
    night: 5,
    ambient: [7, 15],
    ai: { specimen: 9, insecto: 9, largo: 10, errante: 10, dislocado: 12 },
    hourly: { 3: { specimen: 1 }, 4: { largo: 1, insecto: 1 } },
    coolCharges: 2,
    cryo: { changeEveryHours: 0.75, driftInterval: 4.5, marginMin: 3, marginMax: 4, grace: 10 },
    blackouts: 3,
    vents: true,
    largoMode: 'oido',
    n5: true,
  },
  {
    // Noche 6: EN PREPARACIÓN. Empezará en el conducto camino de la sala
    // sellada (flags oficinaSellada / n5fuga; punto de control 'n6conducto').
    night: 6,
    placeholder: true,
    ai: {},
  },
];

export function getNight(n) {
  return NIGHTS[Math.min(Math.max(n, 1), NIGHTS.length) - 1];
}
