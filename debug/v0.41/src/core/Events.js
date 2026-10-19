// =============================================================
// Events.js — Bus de eventos mínimo.
//
// Los sistemas de juego (puertas, energía, IA...) NO llaman
// directamente al audio ni a los efectos: emiten un evento
// ("door", "powerOut"...) y quien esté interesado lo escucha.
// Así la lógica no depende de cómo se presenta.
// =============================================================

export class Events {
  constructor() {
    this.handlers = new Map();
  }

  on(name, fn) {
    if (!this.handlers.has(name)) this.handlers.set(name, []);
    this.handlers.get(name).push(fn);
  }

  emit(name, data) {
    for (const fn of this.handlers.get(name) ?? []) fn(data);
  }
}
