// =============================================================
// Terminal.js — La computadora pequeña de la consola.
//
// Normalmente muestra el estado del sistema. Cuando el jugador la
// "enfoca" (Enter o clic sobre ella), el teclado escribe aquí en vez
// de controlar compuertas: así las letras de "/reset" (E, S...) no
// cierran puertas ni abren el monitor por accidente.
//   Enter → ejecutar el comando    Esc → salir sin escribir
// =============================================================

const MAX_LEN = 24;

export class Terminal {
  constructor() {
    this.reset();
  }

  reset() {
    this.focused = false;
    this.input = '';
    this.lines = [];
  }

  focus() {
    this.focused = true;
  }

  blur() {
    this.focused = false;
    this.input = '';
  }

  print(text) {
    this.lines.push(text);
    if (this.lines.length > 4) this.lines.shift();
  }

  /**
   * Procesa una tecla mientras está enfocada.
   * @returns {string|null} el comando si se pulsó Enter.
   */
  key(e) {
    if (e.key === 'Escape') {
      this.blur();
      return null;
    }
    if (e.key === 'Enter') {
      const cmd = this.input;
      this.print('> ' + cmd);
      this.input = '';
      return cmd;
    }
    if (e.key === 'Backspace') {
      this.input = this.input.slice(0, -1);
      return null;
    }
    if (e.key.length === 1 && this.input.length < MAX_LEN) this.input += e.key;
    return null;
  }
}
