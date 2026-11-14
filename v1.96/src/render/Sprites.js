// =============================================================
// Sprites.js — Sistema para sustituir gráficos procedurales por
// imágenes propias más adelante.
//
// Funcionamiento:
//   1) assets/manifest.json lista las imágenes que existen:
//        { "images": { "cam_lab": "cams/lab.png", "office": "office.png" } }
//   2) Al arrancar, se cargan solo esas (así no hay errores 404 por
//      imágenes que todavía no has hecho).
//   3) Las vistas llaman a sprites.draw(clave, ...). Si la imagen
//      existe la dibuja y devuelve true; si no, devuelve false y la
//      vista dibuja la versión generada por código.
//
// Claves que se consultan ahora mismo:
//   cam_<sala>  → fondo de cada cámara (p. ej. cam_hangar, cam_lab)
//   cam_v1 ... cam_v7 → cámaras de los conductos de ventilación
//                 Tamaño recomendado: 1600×900.
// (Los sonidos propios van en el mismo manifiesto, en "sounds":
//  ver AudioEngine.js.)
//
// (v1.95) Imágenes por idioma: "idiomas": { "en": { "cam_hangar": "salas/en/cam_hangar.jpg", … } }.
// Con el juego en ese idioma, draw/has usan esa versión (las cámaras con los carteles en inglés);
// si falta, la de siempre. Se cargan al arrancar en ese idioma o al cambiar a él.
// =============================================================

import { Idioma } from '../core/Idioma.js';

export class Sprites {
  constructor() {
    this.images = new Map();
  }

  async load(manifestUrl = 'assets/manifest.json') {
    let manifest;
    try {
      const res = await fetch(manifestUrl);
      if (!res.ok) return;
      manifest = await res.json();
    } catch {
      return; // sin manifiesto: todo se dibuja por código
    }
    const entries = Object.entries(manifest.images ?? {});
    await Promise.all(entries.map(([key, path]) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { this.images.set(key, img); resolve(); };
      img.onerror = () => { console.warn(`Sprites: no se pudo cargar ${path}`); resolve(); };
      img.src = `assets/${path}`;
    })));
    this.porIdioma = manifest.idiomas ?? {};
    this.otros = {};
    Idioma.alCambiar(() => this._cargaIdioma());
    await this._cargaIdioma();
    this.listo = true;   // (v1.56) ya están todas (el debug espera a esto antes de empezar una noche)
  }

  /** (v1.95) Las imágenes propias del idioma actual (una vez por idioma). */
  async _cargaIdioma() {
    const id = Idioma.actual();
    const lista = this.porIdioma?.[id];
    if (!lista || this.otros[id]) return;
    const m = new Map();
    this.otros[id] = m;
    await Promise.all(Object.entries(lista).map(([key, path]) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { m.set(key, img); resolve(); };
      img.onerror = () => { console.warn(`Sprites: no se pudo cargar ${path}`); resolve(); };
      img.src = `assets/${path}`;
    })));
  }

  /** La imagen de esa clave: la del idioma actual si la hay; si no, la de siempre. */
  get(key) {
    return this.otros?.[Idioma.actual()]?.get(key) ?? this.images.get(key);
  }

  has(key) {
    return this.images.has(key) || !!this.otros?.[Idioma.actual()]?.has(key);
  }

  /** Dibuja la imagen si existe. Devuelve true si la ha dibujado. */
  draw(ctx, key, x, y, w, h) {
    const img = this.get(key);
    if (!img) return false;
    ctx.drawImage(img, x, y, w, h);
    return true;
  }
}
