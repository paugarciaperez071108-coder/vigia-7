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

/** Segundos que dura la carrera hasta la lente (sin el giro). */
export function sustoPuertaDuracion(side) {
  const c = HOJAS[side];
  return c ? c.n / c.fps : 0;
}

/** Segundos desde que empieza a correr hasta que llega a la compuerta (el grito). */
export function sustoPuertaGrito(side) {
  const c = HOJAS[side];
  return c ? Math.max(0, c.n - 9) / c.fps : 0;
}

/** El fotograma del instante t (s desde que empieza a correr), encima de la pared de la compuerta. */
export function drawSustoPuerta(ctx, side, t) {
  const c = HOJAS[side];
  if (!c || t < 0) return;
  const f = Math.min(c.n - 1, Math.floor(t * c.fps));
  ctx.drawImage(c.img, (f % c.cols) * c.fw, Math.floor(f / c.cols) * c.fh, c.fw, c.fh, c.x, c.y, c.w, c.h);
}
