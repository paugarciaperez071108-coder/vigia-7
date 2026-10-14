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
//   cam_v1 ... cam_v5 → cámaras de los conductos de ventilación
//                 Tamaño recomendado: 1600×900.
// (Los sonidos propios van en el mismo manifiesto, en "sounds":
//  ver AudioEngine.js.)
// =============================================================

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
  }

  has(key) {
    return this.images.has(key);
  }

  /** Dibuja la imagen si existe. Devuelve true si la ha dibujado. */
  draw(ctx, key, x, y, w, h) {
    const img = this.images.get(key);
    if (!img) return false;
    ctx.drawImage(img, x, y, w, h);
    return true;
  }
}
