// =============================================================
// Escombros.js — (v1.14) Los trozos, chispas y brasas de la noche 7, renderizados en Blender.
// tools/3d/n7/escombros.py → integrar_escombros.py → assets/n7/escombros/ (indice.json).
//
// El usuario (2026-10-30): «Elimínalos todos [los trozos dibujados a mano] […] Sustitúyelos solo
// por elementos renderizados en Blender […] Si hace falta movimiento (trozos que vuelan o caen), que
// sea una animación renderizada en Blender, no una forma movida por código». Aquí solo se ponen sus
// fotogramas en su sitio: el código decide DÓNDE y CUÁNDO, nunca la forma ni el movimiento.
//
// Cada animación: { n, w, h, ax, ay } (ax, ay: dónde cae el punto de anclaje dentro de la imagen, en
// px de 1600×900: el hueco, la lámpara o el chispazo).
//   techo_hueco, techo_cae   el hueco del techo y la plancha que cae (se queda en el suelo)
//   pared_hueco, pared_cae   el boquete de la pared y el trozo que sale despedido (se queda)
//   chispas                  un chispazo (las chispas caen, rebotan y se apagan)
//   lampara                  los cristales de una lámpara que revienta (se quedan en el suelo)
//   brasas                   brasas que suben de un fuego (en bucle)
// =============================================================

let IND = null;
const IMGS = {};
fetch('assets/n7/escombros/indice.json').then((r) => (r.ok ? r.json() : null)).then((j) => {
  IND = j;
  for (const [id, d] of Object.entries(IND ?? {})) for (let k = 0; k < d.n; k++) foto(id, k);
}).catch(() => {});

function foto(id, k) {
  const clave = `${id}_${String(k).padStart(2, '0')}`;
  let i = IMGS[clave];
  if (!i) {
    i = IMGS[clave] = new Image();
    i.src = `assets/n7/escombros/${clave}.webp`;
  }
  return i.complete && i.naturalWidth ? i : null;
}

/** Cuántos fotogramas tiene esa animación (0 si no está). */
export function nEscombro(id) {
  return IND?.[id]?.n ?? 0;
}

/** El fotograma k (el último se queda) de la animación id, con su ancla en (x, y), a escala e.
 * opts: { luz: true (sumada: chispas y brasas), alfa, filtro (la luz de la sala), bucle }. */
export function drawEscombro(ctx, id, k, x, y, e = 1, opts = {}) {
  const d = IND?.[id];
  if (!d) return false;
  const i = opts.bucle ? ((k % d.n) + d.n) % d.n : Math.max(0, Math.min(d.n - 1, k));
  const im = foto(id, i);
  if (!im) return true;
  ctx.save();
  if (opts.luz) ctx.globalCompositeOperation = 'lighter';
  if (opts.alfa !== undefined) ctx.globalAlpha = Math.max(0, Math.min(1, opts.alfa));
  if (opts.filtro) ctx.filter = opts.filtro;
  ctx.drawImage(im, x - d.ax * e, y - d.ay * e, d.w * e, d.h * e);
  ctx.restore();
  return true;
}
