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

import { dice } from '../core/Idioma.js';

export const NOTES = {
  posit: {
    estilo: 'posit',
  },
  protocolo: {
    estilo: 'placa',
  },
  // v0.58: cada noche, su placa junto a la compuerta (PLACA_DE_NOCHE)
  protocolo_n12: {
    estilo: 'placa',
  },
  protocolo_n3: {
    estilo: 'placa',
  },
  protocolo_n4: {
    estilo: 'placa',
  },
  // v0.77: la de la noche 6 (después de la fuga de Criogenia)
  protocolo_n6: {
    estilo: 'placa',
  },
  lab: {
    estilo: 'hoja',
  },
  medbay: {
    estilo: 'hoja',
  },
  hangar: {
    estilo: 'hoja',
  },
  cryo: {
    estilo: 'hoja',
  },
  greenhouse: {
    estilo: 'hoja',
  },
};

// (v1.92) el título y el texto de cada nota, en idiomas/*.json («notas.<id>.titulo» y «.texto»): se piden al leerla
for (const [id, n] of Object.entries(NOTES)) {
  Object.defineProperty(n, 'titulo', { get: () => dice(`notas.${id}.titulo`), enumerable: true });
  Object.defineProperty(n, 'texto', { get: () => dice(`notas.${id}.texto`), enumerable: true });
}

// Notas de la oficina: pared → [{ id, rect }] (coordenadas 1600×900; las
// mismas que el pósit y la placa del modelo 3D, tools/3d/salas/nave.py)
// v0.58: la placa de la compuerta de atrás cambia cada noche (la 7-B, la
// de la contención levantada, es la de la noche 5)
export const PLACA_DE_NOCHE = { 1: 'protocolo_n12', 2: 'protocolo_n12', 3: 'protocolo_n3', 4: 'protocolo_n4', 5: 'protocolo', 6: 'protocolo_n6' };

// El cartel rojo de encima de la compuerta, cada noche (cerrada / abierta): las claves de idiomas/*.json
export const CARTEL_DE_NOCHE = {
  1: ['carteles.contencion', 'carteles.contencion'],
  2: ['carteles.contencion', 'carteles.contencion'],
  3: ['carteles.brecha', 'carteles.brecha'],
  4: ['carteles.cuarentena', 'carteles.cuarentena'],
  5: ['carteles.contencion', 'carteles.levantada'],
  6: ['carteles.emergencia', 'carteles.fuga_contenida'],   // v0.77 (aprobado por el usuario)
};

export const OFFICE_NOTES = {
  front: [{ id: 'posit', rect: { x: 1080, y: 464, w: 58, h: 58 } }],
  back: [{ id: 'protocolo', rect: { x: 1160, y: 350, w: 160, h: 200 } }],
};
