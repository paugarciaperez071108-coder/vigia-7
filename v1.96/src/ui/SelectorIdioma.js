// =============================================================
// SelectorIdioma.js — (v1.92; aparte desde la v1.94) El selector de idioma de la primera vez, antes del logo.
// main.js lo abre si nunca se ha elegido; el debug del idioma lo enseña con { guarda: false } (no toca lo elegido).
// =============================================================

import { Idioma, IDIOMAS, dice } from '../core/Idioma.js';

// (v1.92) El selector de idioma: la PRIMERA vez que se abre el juego, antes del logo y del prólogo.
// Lo elegido se guarda aparte de la partida (Idioma.js); después se cambia en OPCIONES, en el menú.
// Cada botón va escrito en su propio idioma; el texto de arriba sigue al botón que está marcado.
export function eligeIdioma({ guarda = true } = {}) {
  return new Promise((listo) => {
    const m = document.getElementById('msg');
    let marcado = Math.max(0, IDIOMAS.findIndex((i) => i.id === Idioma.actual()));
    const pinta = () => {
      Idioma.pon(IDIOMAS[marcado].id, false);          // (solo para verlo: se guarda al aceptar)
      m.innerHTML = `
        <div class="idiomas">
          <h1>VIGIA-7</h1>
          <p class="elige">${dice('idioma.elige')}</p>
          <div class="botones">
            ${IDIOMAS.map((i, k) => `<button type="button" data-k="${k}" class="${k === marcado ? 'marcado' : ''}">${i.nombre}</button>`).join('')}
          </div>
          <p class="nota">${dice('idioma.despues')}</p>
          <p class="nota">${dice('idioma.ayuda')}</p>
        </div>`;
      for (const b of m.querySelectorAll('button')) {
        b.addEventListener('mouseenter', () => { if (marcado !== Number(b.dataset.k)) { marcado = Number(b.dataset.k); pinta(); } });
        b.addEventListener('click', () => { marcado = Number(b.dataset.k); acepta(); });
      }
    };
    const tecla = (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') { marcado = (marcado + IDIOMAS.length - 1) % IDIOMAS.length; pinta(); }
      else if (e.code === 'ArrowRight' || e.code === 'ArrowDown' || e.code === 'Tab') { marcado = (marcado + 1) % IDIOMAS.length; pinta(); }
      else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') acepta();
      else return;
      e.preventDefault();
    };
    const acepta = () => {
      window.removeEventListener('keydown', tecla);
      Idioma.pon(IDIOMAS[marcado].id, guarda);
      m.hidden = true;
      m.innerHTML = '';
      listo();
    };
    window.addEventListener('keydown', tecla);
    m.hidden = false;
    pinta();
  });
}
