// =============================================================
// Notes.js — Notas con texto legible (pistas de lore, sin desvelar
// demasiado). Se leen al hacer clic en el papel (src/ui/NoteOverlay.js).
//
// Dónde están (las del modelo 3D salen en assets/salas/salidas.json,
// '_notas'; las de la oficina, en OFFICE_NOTES):
//   posit       oficina, frente: pósit junto a la consola
//   protocolo   oficina, atrás: placa junto a la compuerta del pasillo central
//   lab, medbay, hangar, greenhouse, cryo   suelo de esas salas (noche 2.5)
// En Comunicaciones no hay ninguna: su punto de lore está reservado.
// =============================================================

export const NOTES = {
  posit: {
    titulo: 'Pósit',
    texto: 'No apagues las luces del pasillo aunque te lo pidan por radio.\n\n—M.',
    estilo: 'posit',
  },
  protocolo: {
    titulo: 'PROTOCOLO DE CONTENCIÓN 7-B',
    texto: 'En caso de brecha, el Pasillo Central quedará sellado.\n\nNadie entra.\nNadie sale.',
    estilo: 'placa',
  },
  // v0.58: cada noche, su placa junto a la compuerta (PLACA_DE_NOCHE)
  protocolo_n12: {
    titulo: 'PROTOCOLO DE CONTENCIÓN 7-A',
    texto: 'Pasillo Central sellado por precaución.\n\nNo abrir la compuerta\nsin orden del puente.',
    estilo: 'placa',
  },
  protocolo_n3: {
    titulo: 'AVISO DE BRECHA 7-C',
    texto: 'El sello del Pasillo Central ha fallado.\n\nSi oyes pasos detrás,\nno te gires sin luz.',
    estilo: 'placa',
  },
  protocolo_n4: {
    titulo: 'ORDEN DE CUARENTENA 9',
    texto: 'Tripulación no localizada.\n\nAl amanecer, escóndete.\nNo abras a nadie.',
    estilo: 'placa',
  },
  lab: {
    titulo: 'Informe — Sujeto E-2',
    texto: 'Retrocede ante la luz directa.\n\nSubir la intensidad no lo calma.\nLo enfada.',
    estilo: 'hoja',
  },
  medbay: {
    titulo: 'Día 4',
    texto: 'Criogenia ya no contesta.\n\nAyer éramos once en el comedor.\nHoy he contado seis bandejas.',
    estilo: 'hoja',
  },
  hangar: {
    titulo: 'Hangar',
    texto: 'Lanzadera 2 sin combustible.\n\nLo siento.',
    estilo: 'hoja',
  },
  cryo: {
    titulo: 'Criogenia',
    texto: 'Cápsula 3: un grado más y se despierta.\n\nNO TOCAR EL PANEL.',
    estilo: 'hoja',
  },
  greenhouse: {
    titulo: 'Invernadero',
    texto: 'Las plantas se mueren desde que abrieron los conductos.\n\nAlgo se come las raíces.',
    estilo: 'hoja',
  },
};

// Notas de la oficina: pared → [{ id, rect }] (coordenadas 1600×900; las
// mismas que el pósit y la placa del modelo 3D, tools/3d/salas/nave.py)
// v0.58: la placa de la compuerta de atrás cambia cada noche (la 7-B, la
// de la contención levantada, es la de la noche 5)
export const PLACA_DE_NOCHE = { 1: 'protocolo_n12', 2: 'protocolo_n12', 3: 'protocolo_n3', 4: 'protocolo_n4', 5: 'protocolo' };

// El cartel rojo de encima de la compuerta, cada noche (cerrada / abierta)
export const CARTEL_DE_NOCHE = {
  1: ['ZONA EN CONTENCIÓN', 'ZONA EN CONTENCIÓN'],
  2: ['ZONA EN CONTENCIÓN', 'ZONA EN CONTENCIÓN'],
  3: ['BRECHA DETECTADA', 'BRECHA DETECTADA'],
  4: ['CUARENTENA', 'CUARENTENA'],
  5: ['ZONA EN CONTENCIÓN', 'CONTENCIÓN LEVANTADA'],
};

export const OFFICE_NOTES = {
  front: [{ id: 'posit', rect: { x: 1080, y: 464, w: 58, h: 58 } }],
  back: [{ id: 'protocolo', rect: { x: 1160, y: 350, w: 160, h: 200 } }],
};
