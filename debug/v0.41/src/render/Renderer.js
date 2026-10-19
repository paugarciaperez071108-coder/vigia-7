// =============================================================
// Renderer.js — Canvas escalado a la ventana.
//
// Todo el juego dibuja en coordenadas LÓGICAS (1600×900). Aquí se
// calcula la escala y el desplazamiento para que quepa en la ventana
// sin deformarse (bandas negras si la proporción no coincide).
// =============================================================

import { CONFIG } from '../config.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
    this.scale = Math.min(this.canvas.width / CONFIG.WIDTH, this.canvas.height / CONFIG.HEIGHT);
    this.offsetX = (this.canvas.width - CONFIG.WIDTH * this.scale) / 2;
    this.offsetY = (this.canvas.height - CONFIG.HEIGHT * this.scale) / 2;
  }

  /** Prepara el canvas para dibujar en coordenadas lógicas. */
  begin() {
    const { ctx, canvas } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);
    // Recortamos al área lógica para que nada se salga a las bandas.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    ctx.clip();
  }

  end() {
    this.ctx.restore();
  }

  /** Convierte coordenadas de la ventana (clientX/Y) a lógicas. */
  toLogical(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * (this.canvas.width / rect.width);
    const py = (clientY - rect.top) * (this.canvas.height / rect.height);
    return { x: (px - this.offsetX) / this.scale, y: (py - this.offsetY) / this.scale };
  }
}
