// =============================================================
// EasterEgg.js — Secreto: una cara en el ventanal durante el apagón.
//
// Solo con la oficina SIN LUZ (apagón activo): si se escribe /i en la
// consola, por el borde inferior del ventanal asoma la cara de alguien
// pegada al cristal por fuera y sube despacio (RISE_TIME) hasta
// quedarse mirándote. No da pistas: la consola solo
// responde con una línea críptica. Con la luz encendida, /i es un
// comando desconocido normal.
//
// Al volver la luz (evento 'blackout' {on: false}) la cara desaparece
// de golpe y todo se resetea: se puede repetir en otro apagón.
//
// No toca la jugabilidad: no gasta reactor, no bloquea controles ni
// cambia la IA. La imagen se carga solo la primera vez que se activa;
// si el archivo no existe, simplemente no se ve nada.
//
// Enganches (en Game.js):
//   - _runCommand → easterEgg.tryCommand(cmd, apagónActivo)
//   - OfficeView.draw (rama del apagón) → easterEgg.draw(ctx, ventanal)
// =============================================================

const EGG = {
  COMMAND: '/i',
  IMAGE: 'assets/easter/colega.png',
  CONSOLE_LINE: '...señal desconocida detectada',
  RISE_TIME: 7,        // segundos que tarda en subir desde abajo (y en llegar a MAX_ALPHA)
  MAX_ALPHA: 0.85,
  SCALE_TO: 1.05,      // luego se acerca muy poco al cristal (1.0 → 1.05)...
  SCALE_TIME: 20,      // ...en estos segundos
  FLICKER_EVERY: [2.5, 5],   // segundos entre parpadeos (al azar entre estos)
};

// Suavizado: empieza y acaba lento (seno)
const easeInOut = (k) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, k)));

export class EasterEgg {
  constructor(events) {
    this.events = events;
    this.image = null;      // lienzo ya procesado (tinte frío y bordes difuminados)
    this.loading = false;
    this.reset();
    // Al volver la luz, la cara desaparece en el acto
    events.on('blackout', ({ on }) => {
      if (!on) this.reset();
    });
  }

  reset() {
    if (this.active) this.events.emit('easterEgg', { on: false });
    this.active = false;
    this.time = 0;
    this.flickerIn = 3;
    this.flickerLeft = 0;
  }

  /**
   * Comando de la consola. Devuelve la línea a mostrar si es el comando
   * secreto y hay apagón; null en otro caso (Game sigue como siempre).
   */
  tryCommand(cmd, blackoutActive) {
    if (cmd !== EGG.COMMAND || !blackoutActive) return null;
    if (!this.active) {
      this.active = true;
      this.time = 0;
      this._load();
      this.events.emit('easterEgg', { on: true });
    }
    return EGG.CONSOLE_LINE;
  }

  update(dt) {
    if (!this.active) return;
    this.time += dt;
    this.flickerLeft = Math.max(0, this.flickerLeft - dt);
    this.flickerIn -= dt;
    if (this.flickerIn <= 0) {
      const [a, b] = EGG.FLICKER_EVERY;
      this.flickerIn = a + Math.random() * (b - a);
      this.flickerLeft = 0.08 + Math.random() * 0.12;
    }
  }

  /** Carga perezosa: solo la primera vez que se activa. */
  _load() {
    if (this.image || this.loading) return;
    this.loading = true;
    const img = new Image();
    img.onload = () => {
      this.image = this._process(img);
      this.loading = false;
    };
    img.onerror = () => {
      // Sin imagen: no se ve nada, el juego sigue igual
      this.loading = false;
    };
    img.src = EGG.IMAGE;
  }

  /**
   * Prepara la imagen una sola vez: blanco y negro con tinte azul frío,
   * más contraste y bordes difuminados en óvalo (pegada al cristal).
   */
  _process(img) {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    g.filter = 'grayscale(1) contrast(1.35) brightness(0.8)';
    g.drawImage(img, 0, 0, size, size);
    g.filter = 'none';
    // Tinte frío
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = '#7fa6d8';
    g.fillRect(0, 0, size, size);
    // Bordes: óvalo difuminado (lo de fuera se vuelve transparente)
    g.globalCompositeOperation = 'destination-in';
    const mask = g.createRadialGradient(size / 2, size * 0.48, size * 0.18, size / 2, size * 0.5, size * 0.5);
    mask.addColorStop(0, 'rgba(0,0,0,1)');
    mask.addColorStop(0.7, 'rgba(0,0,0,0.6)');
    mask.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = mask;
    g.fillRect(0, 0, size, size);
    return c;
  }

  /** Dibuja la cara dentro del ventanal (rectángulo `win`). */
  draw(ctx, win) {
    if (!this.active || !this.image) return;
    const t = this.time;
    const rise = easeInOut(t / EGG.RISE_TIME);       // 0 = escondida bajo el borde, 1 = arriba
    let alpha = EGG.MAX_ALPHA * Math.min(1, rise * 1.6);
    if (this.flickerLeft > 0) alpha *= 0.25;
    if (alpha <= 0.002) return;

    const scale = 1 + (EGG.SCALE_TO - 1) * easeInOut((t - EGG.RISE_TIME) / EGG.SCALE_TIME) + Math.sin(t * 0.7) * 0.004;
    const size = win.h * 1.05 * scale;
    const cx = win.x + win.w / 2 + Math.sin(t * 0.37) * 4;
    // Sube desde debajo del borde inferior del ventanal hasta el centro
    const hidden = win.y + win.h + size * 0.5;
    const shown = win.y + win.h / 2 + Math.sin(t * 0.53) * 3;
    const cy = hidden + (shown - hidden) * rise;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(win.x + 8, win.y + 8, win.w - 16, win.h - 16, 34);
    ctx.clip();
    ctx.globalAlpha = alpha;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.sin(t * 0.45) * 0.015);
    ctx.drawImage(this.image, -size / 2, -size / 2, size, size);
    ctx.restore();
    // Líneas de barrido y ruido por encima, para integrarla
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    for (let y = win.y; y < win.y + win.h; y += 3) ctx.fillRect(win.x, y, win.w, 1);
    ctx.globalAlpha = alpha * 0.25;
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? '#c8d8ff' : '#000';
      ctx.fillRect(win.x + Math.random() * win.w, win.y + Math.random() * win.h, 2, 2);
    }
    ctx.restore();
  }
}
