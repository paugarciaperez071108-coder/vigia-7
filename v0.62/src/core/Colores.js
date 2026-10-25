// =============================================================
// Colores.js — El color de cada criatura (biblia de personajes), en UN
// solo sitio (v0.58). Lo usan los triángulos del plano, la leyenda, los
// avisos y los brillos de cada noche: no se definen en ningún otro sitio.
// =============================================================

export const COLORES = {
  frozen: '#3fe6ff',      // El Congelado: cian
  specimen: '#ff3030',    // El Espécimen: rojo
  largo: '#ffb020',       // El Largo: ámbar
  insecto: '#a8ff2a',     // El Insecto: verde lima
  errante: '#a05cff',     // El Errante: violeta
  dislocado: '#ff2fd0',   // El Dislocado: magenta
  slaimi: '#ffffff',      // Slaimi: blanco (fijo)
};

export const NOMBRES = {
  frozen: 'Congelado', specimen: 'Especimen', largo: 'Largo', insecto: 'Insecto',
  errante: 'Errante', dislocado: 'Dislocado', slaimi: 'Slaimi',
};

/** Color de una criatura ('#rrggbb'); blanco si no tiene. */
export const colorDe = (id) => COLORES[id] ?? '#ffffff';

/** El mismo color como «r,g,b» (para rgba()). */
export function rgbDe(id) {
  const c = colorDe(id);
  return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)).join(',');
}
