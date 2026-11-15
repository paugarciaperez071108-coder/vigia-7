// =============================================================
// registro.js — (v1.81) Los SUSTOS NUEVOS (encargo del 2026-11-11), en un solo sitio para Extras (galería y Beta) y
// el debug. Cada uno: su clase (constructor({ …variante, fondo, giro, oscuro }), .dura, .draw(ctx, t, effects),
// .sonido(audio, k), static miniatura(ctx, r)), su precarga y sus variantes (en Extras, cada vez la siguiente).
// v1.81 El Insecto · v1.82 El Congelado · v1.83 El Espécimen · v1.84 El Largo · v1.85 El Dislocado · v1.86 El Errante.
// (v1.87–v1.89, encargo del 2026-11-12) Rehechos El Espécimen (v1.87), El Largo (v1.88) y El Congelado (v1.89); los de antes, en
// ANTIGUOS: solo para Extras > Beta (reproducir y COMPARAR), con un solo lado.
// =============================================================

import { SustoInsecto, precargaInsecto } from './SustoInsecto.js';
import { SustoCongelado, precargaCongelado } from './SustoCongelado.js';
import { SustoCongeladoV182, precargaCongeladoV182 } from './SustoCongeladoV182.js';
import { SustoEspecimen, precargaEspecimen } from './SustoEspecimen.js';
import { SustoEspecimenV183, precargaEspecimenV183 } from './SustoEspecimenV183.js';
import { SustoLargoV184, precargaLargoV184 } from './SustoLargoV184.js';
import { SustoLargo, precargaLargo } from './SustoLargo.js';
import { SustoDislocado, precargaDislocado } from './SustoDislocado.js';
import { SustoErrante, precargaErrante } from './SustoErrante.js';

export const NUEVOS = {
  insecto: {
    Clase: SustoInsecto,
    precarga: precargaInsecto,
    version: 'v1.81',
    variantes: [
      { lado: 'right', nombre: 'rejilla derecha' },
      { lado: 'left', nombre: 'rejilla izquierda' },
      { lado: 'right', rota: true, nombre: 'rejilla derecha rota' },
      { lado: 'left', rota: true, nombre: 'rejilla izquierda rota' },
    ],
  },
  frozen: {
    Clase: SustoCongelado,
    precarga: precargaCongelado,
    version: 'v1.89',
    variantes: [
      { lado: 'left', nombre: 'compuerta izquierda' },
      { lado: 'right', nombre: 'compuerta derecha' },
    ],
  },
  specimen: {
    Clase: SustoEspecimen,
    precarga: precargaEspecimen,
    version: 'v1.87',
    variantes: [
      { lado: 'left', nombre: 'compuerta izquierda' },
      { lado: 'right', nombre: 'compuerta derecha' },
    ],
  },
  largo: {
    Clase: SustoLargo,
    precarga: precargaLargo,
    version: 'v1.88',
    variantes: [{ nombre: 'pasillo central' }],
  },
  dislocado: {
    Clase: SustoDislocado,
    precarga: precargaDislocado,
    version: 'v1.85',
    variantes: [
      { lado: 'right', nombre: 'rejilla derecha' },
      { lado: 'left', nombre: 'rejilla izquierda' },
    ],
  },
  errante: {
    Clase: SustoErrante,
    precarga: precargaErrante,
    version: 'v1.86',
    variantes: [
      { lado: 'left', nombre: 'CAM 07 · compuerta izquierda' },
      { lado: 'right', nombre: 'CAM 08 · compuerta derecha' },
    ],
  },
};

/** Un susto nuevo de ese enemigo (variante i, o la que toque), para Extras o el debug (pinta él su fondo). */
export function creaNuevo(id, i = 0, extra = {}) {
  const r = NUEVOS[id];
  if (!r) return null;
  r.precarga?.();
  const v = r.variantes[((i % r.variantes.length) + r.variantes.length) % r.variantes.length];
  return new r.Clase({ ...v, fondo: true, ...extra });
}

/** (v1.87) Los sustos nuevos que se han rehecho: el de antes, para Beta. Clave: `${id}_${version sin punto}`. */
export const ANTIGUOS = {
  specimen_v183: { Clase: SustoEspecimenV183, precarga: precargaEspecimenV183, version: 'v1.83' },
  largo_v184: { Clase: SustoLargoV184, precarga: precargaLargoV184, version: 'v1.84' },
  frozen_v182: { Clase: SustoCongeladoV182, precarga: precargaCongeladoV182, version: 'v1.82' },
};

/** El susto antiguo `clave` (Beta: pinta él su fondo). */
export function creaAntiguo(id, version, extra = {}) {
  const r = ANTIGUOS[`${id}_${version}`];
  if (!r) return null;
  r.precarga?.();
  return new r.Clase({ fondo: true, ...extra });
}
