// =============================================================
// main.js — Punto de entrada.
// =============================================================

// (v1.81) el PRIMERO: el audio publicado va ofuscado y esto lo descifra para todo el juego (src/audio/Ofuscado.js)
import './audio/Ofuscado.js';
import { Idioma, dice } from './core/Idioma.js';
import { eligeIdioma } from './ui/SelectorIdioma.js';
import { Game } from './core/Game.js';
import { Libre3D } from './ending/Libre3D.js';

function arranca() {
  const game = new Game(document.getElementById('game'));
  // (v1.56) ?prueba=1: el juego normal, pero accesible para las pruebas automáticas (Chrome sin pantalla)
  if (/[?&]prueba=1/.test(location.search)) window.game = game;
}

// (v1.92) El selector de idioma (la PRIMERA vez, antes del logo): src/ui/SelectorIdioma.js (v1.94: aparte, para el debug del idioma).

// (v1.91) Sin WebGL2 (aceleración por hardware) el prólogo, las partes a pie y el final de la Noche 7 no
// se pueden ver: se avisa ANTES de empezar y se explica cómo activarla. Se puede jugar igualmente
// (las noches tienen su versión 2D). `?sin3d=1` enseña este aviso para probarlo.
function avisoSin3D() {
  const m = document.getElementById('msg');
  m.innerHTML = `
    <div class="aviso3d">
      <h1>${dice('aviso3d.titulo')}</h1>
      <p>${dice('aviso3d.texto')}</p>
      <h2>${dice('aviso3d.como')}</h2>
      <ul>
        <li>${dice('aviso3d.chrome')}</li>
        <li>${dice('aviso3d.edge')}</li>
        <li>${dice('aviso3d.firefox')}</li>
        <li>${dice('aviso3d.ya')}</li>
      </ul>
      <p>${dice('aviso3d.despues')}</p>
      <button id="jugar-igual" type="button">${dice('aviso3d.boton')}</button>
    </div>`;
  m.hidden = false;
  const boton = document.getElementById('jugar-igual');
  const sigue = (e) => {
    if (e.type === 'keydown' && e.code !== 'Enter' && e.code !== 'NumpadEnter' && e.code !== 'Space') return;
    e.preventDefault();
    window.removeEventListener('keydown', sigue);
    m.hidden = true;
    m.innerHTML = '';
    arranca();
  };
  boton.addEventListener('click', sigue);
  window.addEventListener('keydown', sigue);
  boton.focus();
}

async function inicio() {
  await Idioma.carga();
  // (los modos de prueba no preguntan: arrancan con el idioma guardado, o en español; `?idioma=en` lo fuerza)
  const sinPregunta = /[?&](debug|n4debug|novedades)=/.test(location.search);
  if (!Idioma.elegido() && !sinPregunta) await eligeIdioma();
  if (!Libre3D.soportado()) avisoSin3D();
  else arranca();
}

if (location.protocol === 'file:') { /* index.html ya explica cómo arrancarlo */ }
else inicio();
