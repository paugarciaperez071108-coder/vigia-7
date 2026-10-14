// =============================================================
// StationMap.js — Salas de la estación y sus conexiones.
//
// El mapa es un GRAFO: cada sala lista sus vecinas. La IA de la
// fase 3 usará estas conexiones para decidir a dónde moverse (así
// un enemigo puede ramificarse o retroceder, no solo seguir una
// lista fija).
//
// "left_door" y "right_door" son nodos especiales: estar ahí
// significa estar pegado a esa compuerta de la oficina.
//
// mapRect: posición del botón en el minimapa (coordenadas lógicas).
// =============================================================

export const ROOMS = {
  hangar:     { cam: '01', name: 'Hangar',            mapRect: { x: 1062, y: 492, w: 112, h: 54 } },
  lab:        { cam: '02', name: 'Laboratorio',       mapRect: { x: 1062, y: 720, w: 112, h: 54 } },
  greenhouse: { cam: '03', name: 'Invernadero',       mapRect: { x: 1186, y: 720, w: 112, h: 54 } },
  reactor:    { cam: '04', name: 'Reactor',           mapRect: { x: 1062, y: 644, w: 112, h: 54 } },
  cryo:       { cam: '05', name: 'Criogenia',         mapRect: { x: 1062, y: 806, w: 112, h: 54 } },
  mess:       { cam: '06', name: 'Comedor',           mapRect: { x: 1186, y: 644, w: 112, h: 54 } },
  westHall:   { cam: '07', name: 'Corredor Oeste',    mapRect: { x: 1310, y: 720, w: 112, h: 54 } },
  eastHall:   { cam: '08', name: 'Corredor Este',     mapRect: { x: 1310, y: 492, w: 112, h: 54 } },
  medbay:     { cam: '09', name: 'Enfermería',        mapRect: { x: 1062, y: 568, w: 112, h: 54 } },
  comms:      { cam: '10', name: 'Comunicaciones',    mapRect: { x: 1186, y: 568, w: 112, h: 54 } },
};

/** Conexiones visibles (pasillos). Se recorren en ambos sentidos. */
export const LINKS = [
  ['hangar', 'eastHall'],
  ['hangar', 'medbay'],
  ['medbay', 'comms'],
  ['medbay', 'reactor'],
  ['comms', 'eastHall'],
  ['reactor', 'mess'],
  ['reactor', 'lab'],
  ['lab', 'greenhouse'],
  ['mess', 'greenhouse'],
  ['greenhouse', 'westHall'],
  ['mess', 'westHall'],
  ['westHall', 'left_door'],
  ['eastHall', 'right_door'],
  // Pasillos añadidos para la ruta B de El Espécimen
  ['reactor', 'greenhouse'],
  ['greenhouse', 'comms'],
];

/**
 * Recorrido dibujado de algunos pasillos en el minimapa (si una
 * línea recta atravesaría otra sala). Puntos intermedios en orden.
 */
export const LINK_PATHS = {
  'greenhouse|comms': [[1298, 735], [1304, 735], [1304, 583], [1298, 583]],
};

/**
 * Conexiones ocultas: no se dibujan en el mapa (son conductos de
 * ventilación). Criogenia y la Enfermería están unidas por un conducto
 * cuya rejilla, en la Enfermería, está arrancada: por ahí salen El
 * Congelado (al escapar) y El Rastrero (que usa conductos).
 */
export const HIDDEN_LINKS = [
  ['cryo', 'medbay'],
];

/** Posición del Módulo de Control en el minimapa. */
export const OFFICE_RECT = { x: 1440, y: 604, w: 112, h: 84 };

/** Vecinas de una sala (incluidas las ocultas si se pide). */
export function neighbors(id, includeHidden = false) {
  const list = includeHidden ? [...LINKS, ...HIDDEN_LINKS] : LINKS;
  const out = [];
  for (const [a, b] of list) {
    if (a === id) out.push(b);
    else if (b === id) out.push(a);
  }
  return out;
}

export const ROOM_IDS = Object.keys(ROOMS);
