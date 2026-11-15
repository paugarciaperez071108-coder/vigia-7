// =============================================================
// SustoPuerta.js — El susto de El Congelado en la compuerta (v0.64).
//
// Pedido por el usuario: «el jugador se gira hacia el pasillo que viene y
// el congelado se le echa encima y lo mata, es para ser interactivo con la
// oficina». La vista se gira sola hacia la compuerta por la que llega y,
// encima de esa pared de la oficina (la de verdad, con su puerta y sus
// botones), corre por su pasillo, cruza la compuerta y se lanza a la lente.
//
// Fotogramas: tools/3d/andar/retirada.py --susto-left / --susto-right
// (desde la misma cámara que office_left/right de nave.py), en hojas
// (hojas.py → assets/sustos/puerta/indice.json; sala = 'left' / 'right').
// =============================================================

const HOJAS = {};
fetch('assets/sustos/puerta/indice.json').then((r) => (r.ok ? r.json() : [])).then((lista) => {
  for (const c of lista) {
    const img = new Image();
    img.onload = () => { HOJAS[c.sala] = { ...c, img }; };
    img.src = `assets/sustos/puerta/${c.archivo}`;
  }
}).catch(() => {});

/** ¿Están las imágenes del susto por esa compuerta? */
export function sustoPuertaListo(side) {
  return !!HOJAS[side];
}

// Fotograma en el que llega a la compuerta (lo que queda es el salto a la lente)
// (v0.66: los fotogramas acaban en la compuerta, a 2,2 m de la cámara; el salto
// lo hacen las 3 variantes de Jumpscare.js; el resto, si faltan)
const llegada = (c) => Math.max(1, c.n - 1);

/** Segundos que dura el salto desde la compuerta hasta la lente. */
export function sustoPuertaSalto(side) {
  const c = HOJAS[side];
  return c ? (c.n - llegada(c)) / c.fps : 0;
}

/**
 * El fotograma del instante t (s desde que la vista está en su compuerta),
 * encima de la pared. v0.66: la carrera por el pasillo se estira a P.MARGEN s
 * (el margen para cerrar), luego P.SILENCIO s quieto en la puerta y el salto.
 */
export function drawSustoPuerta(ctx, side, t, P) {
  const c = HOJAS[side];
  if (!c || t < 0) return;
  const L = llegada(c);
  let f;
  if (t < P.MARGEN) f = Math.floor((t / P.MARGEN) * L);
  else if (t < P.MARGEN + P.SILENCIO) f = L;
  else f = L + Math.floor((t - P.MARGEN - P.SILENCIO) * c.fps);
  f = Math.min(c.n - 1, f);
  ctx.drawImage(c.img, (f % c.cols) * c.fw, Math.floor(f / c.cols) * c.fh, c.fw, c.fh, c.x, c.y, c.w, c.h);
}
