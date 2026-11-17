// =============================================================
// Input.js — Ratón y teclado.
//
// Convierte los clics a coordenadas LÓGICAS (1600×900) usando el
// Renderer, y avisa a Game mediante callbacks. También avisa al
// SOLTAR (botón del ratón o tecla), necesario para acciones de
// "mantener pulsado" como las barras de control del reactor.
// =============================================================

export class Input {
  constructor(canvas, renderer, { onClick, onRelease = () => {}, onKey, onKeyUp = () => {}, onMove }) {
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const p = renderer.toLogical(e.clientX, e.clientY);
      onClick(p.x, p.y);
    });
    window.addEventListener('pointerup', () => onRelease());
    window.addEventListener('pointercancel', () => onRelease());
    canvas.addEventListener('pointermove', (e) => {
      const p = renderer.toLogical(e.clientX, e.clientY);
      onMove(p.x, p.y);
    });
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'Backspace', 'Slash', 'Tab'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      onKey(e.code, e);
    });
    window.addEventListener('keyup', (e) => onKeyUp(e.code));
    window.addEventListener('blur', () => onRelease());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}
