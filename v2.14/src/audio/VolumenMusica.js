// =============================================================
// VolumenMusica.js — (v1.99, el usuario: «que respete el volumen de música de las opciones») El volumen de TODA la
// música del juego (el menú, la noche 7 y la de los retos), de 0 a 1 en pasos del 10 %. Se cambia en OPCIONES del menú y
// en el menú de pausa. Se guarda aparte de la partida (localStorage 'vigia7.volMusica'; «New Game» no lo toca). Por
// defecto, 100 % (como antes de la v1.99). Quien suena se apunta con escucha() y se ajusta al momento.
// =============================================================

const CLAVE = 'vigia7.volMusica';
const oyentes = new Set();

let vol = 1;
try {
  const v = localStorage.getItem(CLAVE);
  if (v !== null && Number.isFinite(Number(v))) vol = Math.max(0, Math.min(1, Number(v)));
} catch { /* sin almacenamiento: 100 % */ }

export const VolumenMusica = {
  get: () => vol,
  /** El texto para las opciones: «80 %». */
  texto: () => `${Math.round(vol * 100)} %`,
  pon(v) {
    vol = Math.max(0, Math.min(1, Math.round(v * 10) / 10));
    try { localStorage.setItem(CLAVE, String(vol)); } catch { /* sin almacenamiento */ }
    for (const f of oyentes) f(vol);
    return vol;
  },
  /** dir +1 / −1: un 10 % más o menos (sin dar la vuelta); dir 0: +10 % y de 100 vuelve a 0 (Enter, clic). */
  cambia(dir) {
    if (dir === 0) return this.pon(vol >= 1 ? 0 : vol + 0.1);
    return this.pon(vol + 0.1 * Math.sign(dir));
  },
  escucha(f) {
    oyentes.add(f);
    return () => oyentes.delete(f);
  },
};
