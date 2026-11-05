// =============================================================
// main.js — Punto de entrada.
// =============================================================

import { Game } from './core/Game.js';

const game = new Game(document.getElementById('game'));
// (v1.56) ?prueba=1: el juego normal, pero accesible para las pruebas automáticas (Chrome sin pantalla)
if (/[?&]prueba=1/.test(location.search)) window.game = game;
