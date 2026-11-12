// =============================================================
// main.js — Punto de entrada.
// =============================================================

// (v1.81) el PRIMERO: el audio publicado va ofuscado y esto lo descifra para todo el juego (src/audio/Ofuscado.js)
import './audio/Ofuscado.js';
import { Game } from './core/Game.js';

const game = new Game(document.getElementById('game'));
// (v1.56) ?prueba=1: el juego normal, pero accesible para las pruebas automáticas (Chrome sin pantalla)
if (/[?&]prueba=1/.test(location.search)) window.game = game;
