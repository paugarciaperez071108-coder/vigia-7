// =============================================================
// Random.js — Generador aleatorio con semilla (mulberry32).
//
// Con la misma semilla produce siempre la misma secuencia. Sirve
// para dibujos "aleatorios" que no cambian entre fotogramas (las
// estrellas) y, más adelante, para reproducir partidas al probar
// la IA.
// =============================================================

export class Random {
  constructor(seed = Date.now()) {
    this.state = seed >>> 0;
  }

  /** Número decimal en [0, 1). */
  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Decimal en [min, max). */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /** Entero en [min, max] (ambos incluidos). */
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }
}
