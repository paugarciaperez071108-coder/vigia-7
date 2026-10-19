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
export const OFFICE_NOTES = {
  front: [{ id: 'posit', rect: { x: 1080, y: 464, w: 58, h: 58 } }],
  back: [{ id: 'protocolo', rect: { x: 1160, y: 350, w: 160, h: 200 } }],
};
