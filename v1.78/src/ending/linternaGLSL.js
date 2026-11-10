// =============================================================
// linternaGLSL.js — (v1.76) EL HAZ DE LA LINTERNA en el 3D, una sola cuenta para todo lo que alumbra (las salas de
// Libre3D, El Largo de la 2.5, el panel de reinicio): cuánta luz le llega a un punto según el ángulo con el haz.
//   uLintPerfil 0: el haz de siempre (v1.59; con uLintSuave, el borde más difuminado del final de la 2.5).
//   uLintPerfil 1: (v1.76, el usuario: «el haz con el centro más brillante y el borde suave, no un disco de borde duro»)
//     una campana: lo más fuerte en el centro, que cae poco a poco hasta un borde que no se nota.
// Necesita los uniformes uLintDir (xyz: hacia dónde; w: el coseno de lo abierto), uLintSuave y uLintPerfil.
// =============================================================

export const LINT_UNIFORMES = `
uniform float uLintPerfil;
`;

export const LINT_CONO = `
float conoLint(vec3 rayo) {
  float ca = dot(rayo, uLintDir.xyz);
  if (uLintPerfil > 0.5) {
    float th0 = acos(uLintDir.w) * (1.0 + 0.7 * max(uLintSuave, 0.75));
    float x = acos(clamp(ca, -1.0, 1.0)) / th0;
    if (x >= 1.0) return 0.0;
    float q = 1.0 - x * x;
    return q * q * (0.45 + 0.55 * exp(-6.0 * x * x));
  }
  float wOut = uLintSuave > 0.0 ? cos(acos(uLintDir.w) * (1.0 + 0.7 * uLintSuave)) : uLintDir.w;
  float cono = smoothstep(wOut, mix(uLintDir.w, 1.0, 0.8 - 0.25 * uLintSuave), ca);
  return cono * cono * (0.62 + 0.38 * smoothstep(mix(uLintDir.w, 1.0, 0.55), 1.0, ca));
}
// (perfil 1) la luz se comprime menos: el centro no se aplana en un disco blanco
vec3 tonoLint(vec3 luz) {
  if (uLintPerfil > 0.5) return luz / (vec3(1.0) + luz * 0.85);
  return (vec3(1.0) - exp(-luz * 1.15)) * 0.82;
}
`;
