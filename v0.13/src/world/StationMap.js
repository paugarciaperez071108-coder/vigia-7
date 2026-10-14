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
// kind:    'room' = SALA, 'hall' = PASILLO. El Largo solo puede estar
//          en salas (nunca en pasillos) y los golpes metálicos que
//          suenan en un pasillo no le afectan.
// =============================================================

export const ROOMS = {
  hangar:     { cam: '01', name: 'Hangar',         kind: 'room', mapRect: { x: 1062, y: 492, w: 112, h: 54 } },
  lab:        { cam: '02', name: 'Laboratorio',    kind: 'room', mapRect: { x: 1062, y: 720, w: 112, h: 54 } },
  greenhouse: { cam: '03', name: 'Invernadero',    kind: 'room', mapRect: { x: 1186, y: 720, w: 112, h: 54 } },
  reactor:    { cam: '04', name: 'Reactor',        kind: 'room', mapRect: { x: 1062, y: 644, w: 112, h: 54 } },
  cryo:       { cam: '05', name: 'Criogenia',      kind: 'room', mapRect: { x: 1062, y: 806, w: 112, h: 54 } },
  mess:       { cam: '06', name: 'Comedor',        kind: 'room', mapRect: { x: 1186, y: 644, w: 112, h: 54 } },
  westHall:   { cam: '07', name: 'Corredor Oeste', kind: 'hall', mapRect: { x: 1310, y: 720, w: 112, h: 54 } },
  eastHall:   { cam: '08', name: 'Corredor Este',  kind: 'hall', mapRect: { x: 1310, y: 492, w: 112, h: 54 } },
  medbay:     { cam: '09', name: 'Enfermería',     kind: 'room', mapRect: { x: 1062, y: 568, w: 112, h: 54 } },
  comms:      { cam: '10', name: 'Comunicaciones', kind: 'room', mapRect: { x: 1186, y: 568, w: 112, h: 54 } },
};

export const isRoom = (id) => ROOMS[id]?.kind === 'room';

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
 * cuya rejilla, en la Enfermería, está arrancada: por ahí sale El
 * Congelado al escapar.
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

// =============================================================
// El Largo: salas ADYACENTES (solo salas, nunca pasillos).
// Si los golpes metálicos suenan en una sala adyacente a la suya,
// va hacia allí. Se recorren en ambos sentidos. Ajustable.
// =============================================================

export const ROOM_ADJACENCY_PAIRS = [
  ['hangar', 'medbay'],
  ['hangar', 'comms'],
  ['medbay', 'comms'],
  ['medbay', 'reactor'],
  ['comms', 'mess'],
  ['reactor', 'mess'],
  ['reactor', 'lab'],
  ['mess', 'greenhouse'],
  ['lab', 'greenhouse'],
  ['lab', 'cryo'],
];

/** { sala: [salas adyacentes] } construido a partir de los pares. */
export const ROOM_ADJACENCY = {};
for (const [a, b] of ROOM_ADJACENCY_PAIRS) {
  (ROOM_ADJACENCY[a] ??= []).push(b);
  (ROOM_ADJACENCY[b] ??= []).push(a);
}

// =============================================================
// Conductos de ventilación (noche 2 en adelante).
//
// Se ven con el botón TOGGLE del monitor. La red está a la izquierda
// de la oficina ("TÚ") y se junta en V1 (Bifurcación). Desde V1 salen
// dos conductos que rodean la oficina: uno por arriba (V6, Lateral
// norte) y otro por abajo (V7, Lateral sur), y entran en ella por su
// lado derecho. V6 y V7 son las ÚNICAS secciones con acceso a la
// oficina, y V1 es la única conectada con ellas: todo lo que llega a
// la oficina por los conductos tiene que pasar por V1.
//   mapRect:  botón de la cámara en el mapa de ventilación.
//   officeAccess: true = desde aquí se entra en la oficina (y es donde
//             se puede soltar insecticida, ver NIGHT2.GAS.VENTS).
// =============================================================

export const VENTS = {
  v1: { cam: 'V1', name: 'Bifurcacion',    mapRect: { x: 1276, y: 632, w: 104, h: 50 } },
  v2: { cam: 'V2', name: 'Ramal norte',    mapRect: { x: 1160, y: 522, w: 104, h: 50 } },
  v3: { cam: 'V3', name: 'Ramal sur',      mapRect: { x: 1160, y: 742, w: 104, h: 50 } },
  v4: { cam: 'V4', name: 'Nudo central',   mapRect: { x: 1056, y: 632, w: 104, h: 50 } },
  v5: { cam: 'V5', name: 'Colector oeste', mapRect: { x: 1056, y: 812, w: 104, h: 50 } },
  v6: { cam: 'V6', name: 'Lateral norte',  mapRect: { x: 1413, y: 512, w: 104, h: 50 }, officeAccess: true },
  v7: { cam: 'V7', name: 'Lateral sur',    mapRect: { x: 1413, y: 772, w: 104, h: 50 }, officeAccess: true },
};
export const VENT_IDS = Object.keys(VENTS);
export const isVent = (id) => id in VENTS;

/** La oficina en el mapa de ventilación (más a la izquierda que en el
 *  de salas, para que quepan los conductos de su lado derecho). */
export const VENT_OFFICE_RECT = { x: 1420, y: 622, w: 90, h: 70 };

/**
 * Tramos de conducto (grafo por el que se mueve El Insecto; 'office'
 * = la oficina) y su recorrido en el mapa, con recodos en ángulo recto.
 */
export const VENT_LINKS = [
  ['v1', 'v2'],
  ['v1', 'v3'],
  ['v2', 'v4'],
  ['v3', 'v4'],
  ['v3', 'v5'],
  ['v4', 'v5'],
  ['v1', 'v6'],
  ['v1', 'v7'],
  ['v6', 'office'],
  ['v7', 'office'],
];
export const VENT_LINK_PATHS = {
  'v1|v2': [[1328, 657], [1212, 657], [1212, 547]],
  'v1|v3': [[1328, 657], [1212, 657], [1212, 767]],
  'v2|v4': [[1212, 547], [1108, 547], [1108, 657]],
  'v3|v4': [[1212, 767], [1108, 767], [1108, 657]],
  'v3|v5': [[1212, 767], [1212, 837], [1108, 837]],
  'v4|v5': [[1108, 657], [1108, 837]],
  // Rodean la oficina por arriba y por abajo y entran por su lado derecho
  'v1|v6': [[1328, 657], [1328, 537], [1465, 537]],
  'v1|v7': [[1328, 657], [1328, 797], [1465, 797]],
  'v6|office': [[1465, 537], [1545, 537], [1545, 642], [1510, 642]],
  'v7|office': [[1465, 797], [1545, 797], [1545, 672], [1510, 672]],
};

/** Vecinos de una sección de conducto (incluye 'office' si conecta). */
export function ventNeighbors(id) {
  const out = [];
  for (const [a, b] of VENT_LINKS) {
    if (a === id) out.push(b);
    else if (b === id) out.push(a);
  }
  return out;
}

/** Saltos desde cada sección hasta la oficina (búsqueda en anchura). */
export const VENT_DIST = (() => {
  const dist = { office: 0 };
  const queue = ['office'];
  while (queue.length) {
    const cur = queue.shift();
    for (const n of ventNeighbors(cur)) {
      if (!(n in dist)) {
        dist[n] = dist[cur] + 1;
        queue.push(n);
      }
    }
  }
  return dist;
})();

/**
 * Entrada de conducto de cada SALA: a qué sección de la red da.
 * Por aquí intenta meterse El Largo.
 */
export const ROOM_VENT = {
  hangar: 'v2', medbay: 'v2', comms: 'v2',
  reactor: 'v4', mess: 'v4',
  greenhouse: 'v3',
  lab: 'v5', cryo: 'v5',
};
