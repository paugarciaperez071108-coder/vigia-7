// =============================================================
// Spatial.js — De dónde viene un sonido (sala → lado, volumen y
// apagado), a partir del mapa de la estación (StationMap.js).
//
//   lado:     según la altura de la sala en el plano. Lo de arriba
//             (Corredor Este, compuerta derecha) suena a la derecha y
//             lo de abajo (Corredor Oeste, compuerta izquierda), a la
//             izquierda.
//   volumen:  según cuántas salas hay hasta la oficina (más lejos, más
//             flojo).
//   muffle:   cuanto más lejos, más apagado (se pierden los agudos, como
//             a través de paredes).
// =============================================================

import { ROOMS, LINKS, OFFICE_RECT, VENT_DIST } from '../world/StationMap.js';

const OFFICE_Y = OFFICE_RECT.y + OFFICE_RECT.h / 2;

// Saltos desde cada sala hasta la oficina (las compuertas están a 1)
const HOPS = (() => {
  const dist = { left_door: 1, right_door: 1 };
  const queue = ['left_door', 'right_door'];
  while (queue.length) {
    const cur = queue.shift();
    for (const [a, b] of LINKS) {
      const n = a === cur ? b : b === cur ? a : null;
      if (n && !(n in dist)) {
        dist[n] = dist[cur] + 1;
        queue.push(n);
      }
    }
  }
  return dist;
})();

/** { pan, volume, muffle } de un sonido que sale de `id` (sala, compuerta o conducto). */
export function placeOf(id) {
  if (id === 'left_door') return { pan: -0.85, volume: 1, muffle: 0 };
  if (id === 'right_door') return { pan: 0.85, volume: 1, muffle: 0 };
  if (id in VENT_DIST && id !== 'office') {
    // Conductos: V6/V7 entran en la oficina por la derecha
    const d = VENT_DIST[id];
    return { pan: d <= 1 ? 0.7 : 0.3, volume: [1, 0.9, 0.55, 0.4, 0.3][Math.min(d, 4)], muffle: Math.min(1, (d - 1) * 0.3) };
  }
  const room = ROOMS[id];
  if (!room) return { pan: (Math.random() * 2 - 1) * 0.6, volume: 0.3, muffle: 0.6 };
  const cy = room.mapRect.y + room.mapRect.h / 2;
  const hops = HOPS[id] ?? 5;
  return {
    pan: Math.max(-0.8, Math.min(0.8, (OFFICE_Y - cy) / 200)),
    volume: 1 / (1 + 0.55 * (hops - 1)),
    muffle: Math.min(1, (hops - 1) * 0.22),
  };
}
