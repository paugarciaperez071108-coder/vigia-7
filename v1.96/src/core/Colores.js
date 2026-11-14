// =============================================================
// Colores.js — El color de cada criatura (biblia de personajes), en UN
// solo sitio (v0.58). Lo usan los triángulos del plano, la leyenda, los
// avisos y los brillos de cada noche: no se definen en ningún otro sitio.
// =============================================================

import { dice } from './Idioma.js';

export const COLORES = {
  frozen: '#3fe6ff',      // El Congelado: cian
  specimen: '#ff3030',    // El Espécimen: rojo
  largo: '#ffb020',       // El Largo: ámbar
  insecto: '#a8ff2a',     // El Insecto: verde lima
  errante: '#a05cff',     // El Errante: violeta
  dislocado: '#ff2fd0',   // El Dislocado: magenta
  slaimi: '#ffffff',      // Slaimi: blanco (fijo)
  aberracion: '#8a0d0d',  // La Aberración (v0.72): triángulo NEGRO con este borde rojo oscuro, latiendo
};

// (v1.92) el nombre corto de cada criatura (la leyenda del plano), en idiomas/*.json («cortos.*»): se pide cada vez
export const NOMBRES = {};
for (const id of Object.keys(COLORES)) Object.defineProperty(NOMBRES, id, { get: () => dice(`cortos.${id}`), enumerable: true });

/** Color de una criatura ('#rrggbb'); blanco si no tiene. */
export const colorDe = (id) => COLORES[id] ?? '#ffffff';

/** El mismo color como «r,g,b» (para rgba()). */
export function rgbDe(id) {
  const c = colorDe(id);
  return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)).join(',');
}
