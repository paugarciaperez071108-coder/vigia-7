// =============================================================
// Terminal.js — La computadora pequeña de la consola.
//
// Normalmente muestra el estado del sistema. Cuando el jugador la
// "enfoca" (Enter o clic sobre ella), el teclado escribe aquí en vez
// de controlar compuertas: así las letras de "/reset" (E, S...) no
// cierran puertas ni abren el monitor por accidente.
//   Enter → ejecutar el comando    Esc → salir sin escribir
// Al abrirla arranca (BOOT_MS: «VIGIA-7 TERMINAL v2.3… OK»); mientras
// arranca no se puede escribir. Las respuestas son mensajes del sistema
// (en mayúsculas; los errores, en otro color). Se dibuja como un CRT:
// src/render/CRT.js. onType: sonido de tecla (lo pone el juego).
// =============================================================

const MAX_LEN = 24;
const BOOT_MS = 900;
const MAX_LINES = 6;

export class Terminal {
  constructor() {
    this.onType = null;
    this.reset();
  }

  reset() {
    this.focused = false;
    this.input = '';
    this.lines = [];
    this.log = [];          // v0.58: registro de avisos de la noche ({ text, kind })
    this.bootAt = -1e9;
  }

  /**
   * v0.58: un aviso del juego en el registro de la terminal, con la hora de
   * la noche delante. nivel: 'danger' (rojo) o 'warn' (amarillo).
   */
  alert(hora, text, nivel = 'warn') {
    const line = { text: `[${hora}] ${nivel === 'danger' ? '!!' : '⚠'} ${text}`.toUpperCase(), kind: nivel };
    this.log.push(line);
    if (this.log.length > 60) this.log.shift();
    // También entre las respuestas, para verlo mientras se escribe
    this.lines.push(line);
    if (this.lines.length > MAX_LINES) this.lines.shift();
  }

  /** ¿Está arrancando? (recién abierta) */
  get booting() {
    return performance.now() - this.bootAt < BOOT_MS;
  }

  get bootProgress() {
    return Math.min(1, (performance.now() - this.bootAt) / BOOT_MS);
  }

  focus() {
    if (!this.focused) this.bootAt = performance.now();
    this.focused = true;
  }

  blur() {
    this.focused = false;
    this.input = '';
  }

  /**
   * Una línea: lo escrito ('> …') o un mensaje del sistema. Los mensajes
   * van en mayúsculas; los que empiezan por «ERROR», «NO » o «COMANDO NO»
   * salen como error.
   */
  print(text) {
    const t = String(text);
    let line;
    if (t.startsWith('> ')) line = { text: t, kind: 'cmd' };
    else {
      const up = t.toUpperCase();
      line = { text: up, kind: /^(ERROR|NO |COMANDO NO|LAS CAMARAS FUNCIONAN)/.test(up) ? 'err' : 'info' };
    }
    this.lines.push(line);
    if (this.lines.length > MAX_LINES) this.lines.shift();
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
    if (this.booting) return null;
    if (e.key === 'Enter') {
      const cmd = this.input;
      this.print('> ' + cmd);
      this.input = '';
      this.onType?.();
      return cmd;
    }
    if (e.key === 'Backspace') {
      this.input = this.input.slice(0, -1);
      this.onType?.();
      return null;
    }
    if (e.key.length === 1 && this.input.length < MAX_LEN) {
      this.input += e.key;
      this.onType?.();
    }
    return null;
  }
}
