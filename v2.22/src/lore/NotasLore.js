// =============================================================
// lore/NotasLore.js — (v2.19, el lore, fase A) Las notas en los recorridos a pie en 3D (Libre3D): un papel pegado en la
// pared (una hoja impresa, una hoja arrancada, una nota a mano) o lo pintado en la pared del Laboratorio. Con un brillo
// leve al acercarse (y una «R» pequeña); con R se lee (Lectura.js: el juego se para). Solo en la historia; lo leído
// queda en el Archivo de Extras (ExtrasProgreso: lore.notas).
// =============================================================

import * as THREE from '../lib/three/three.module.min.js';
import { NOTAS } from './catalogo.js';
import { ExtrasProgreso } from '../core/ExtrasProgreso.js';
import { dice } from '../core/Idioma.js';

const CERCA = 1.9;          // m: a esta distancia se nota
const MIRA = 0.55;          // coseno: hay que estar mirándola (más o menos)

/** La cara del papel tal como se ve de lejos (no se lee: para leerla, R). */
function texPapel(n) {
  const cv = document.createElement('canvas');
  const pared = n.estilo === 'pared';
  cv.width = pared ? 1024 : 192;
  cv.height = pared ? 384 : 256;
  const c = cv.getContext('2d');
  if (pared) {
    // las letras, pintadas: rojo oscuro con chorreones (fondo transparente)
    c.clearRect(0, 0, cv.width, cv.height);
    c.fillStyle = 'rgba(120,18,12,0.92)';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    // (en el idioma del juego: es lo que se lee al acercarse)
    const [l1, l2 = ''] = dice('lore.n10_texto').split('|');
    for (const [txt, y, t0] of [[l1, 120, 120], [l2, 262, 86]]) {
      let t = t0;
      c.font = `bold ${t}px Impact, "Arial Black", sans-serif`;
      while (c.measureText(txt).width > 980 && t > 30) c.font = `bold ${(t -= 4)}px Impact, "Arial Black", sans-serif`;
      c.fillText(txt, 512, y);
    }
    for (let k = 0; k < 26; k++) c.fillRect(40 + Math.random() * 940, 150 + Math.random() * 40, 4, 30 + Math.random() * 90);
    return new THREE.CanvasTexture(cv);
  }
  const papel = n.estilo === 'mano' ? '#cfc6ad' : n.estilo === 'cuaderno' ? '#d8d3c2' : '#dcd6c4';
  c.fillStyle = papel;
  c.fillRect(0, 0, cv.width, cv.height);
  // renglones de texto (garabatos: de lejos no se lee)
  c.fillStyle = n.estilo === 'cuaderno' ? 'rgba(30,45,80,0.6)' : 'rgba(25,22,18,0.55)';
  for (let y = 30; y < cv.height - 20; y += n.estilo === 'mano' ? 26 : 18) {
    const largo = 40 + Math.random() * 110;
    c.fillRect(16, y, largo, n.estilo === 'mano' ? 3 : 4);
  }
  for (let k = 0; k < 3; k++) {
    c.fillStyle = `rgba(110,85,40,${0.08 + Math.random() * 0.1})`;
    c.beginPath();
    c.arc(Math.random() * cv.width, Math.random() * cv.height, 14 + Math.random() * 28, 0, Math.PI * 2);
    c.fill();
  }
  if (n.estilo === 'turnos') {
    // el pósit amarillo, encima
    c.fillStyle = '#d8c64a';
    c.fillRect(100, 150, 76, 76);
  }
  return new THREE.CanvasTexture(cv);
}

export class NotasLore {
  constructor(L) {
    this.L = L;
    this.mallas = [];
    this.cerca = null;
  }

  /** Pone las notas del recorrido (por su nombre); quita las de antes. */
  monta(ruta) {
    for (const m of this.mallas) {
      this.L.escena.remove(m);
      m.geometry.dispose();
      m.material.map?.dispose();
      m.material.dispose();
    }
    this.mallas = [];
    this.cerca = null;
    this.ajustado = false;
    this.ruta = ruta;
    // (solo en la historia: el prólogo y las noches a pie lo son siempre; el debug también las pone)
    for (const n of NOTAS.filter((x) => x.ruta === ruta)) {
      const pared = n.estilo === 'pared';
      const mat = new THREE.MeshBasicMaterial({ map: texPapel(n), transparent: pared, depthWrite: !pared, toneMapped: false,
        polygonOffset: true, polygonOffsetFactor: -2 });
      mat.color.setScalar(pared ? 0.55 : 0.32);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(n.tam[0], n.tam[1]), mat);
      // (Blender (x, y, z) → three (x, z, -y)); el plano mira hacia la normal de la pared
      const sep = n.estilo === 'pared' ? 0.02 : 0.045;      // (separado de la pared: los paneles sobresalen un poco)
      m.position.set(n.p[0] + n.n[0] * sep, n.p[2], -(n.p[1] + n.n[1] * sep));
      m.rotation.y = Math.atan2(n.n[0], -n.n[1]);
      if (!pared) m.rotation.z = (Math.random() - 0.5) * 0.12;
      m.userData.nota = n;
      this.L.escena.add(m);
      this.mallas.push(m);
    }
  }

  /** Una vez cargadas las salas: cada papel, pegado a la superficie que se VE (un rayo desde delante contra las salas;
   *  la pared de los choques no siempre coincide con la que se ve: paneles, nervios, máquinas). */
  _ajusta() {
    const salas = Object.values(this.L.zonas ?? {}).map((z) => z?.malla).filter((m) => m && m.visible);
    if (!salas.length) return false;
    const ray = new THREE.Raycaster();
    for (const m of this.mallas) {
      const n = m.userData.nota;
      const dir = new THREE.Vector3(-n.n[0], 0, n.n[1]);
      const o = new THREE.Vector3(n.p[0], n.p[2], -n.p[1]).addScaledVector(dir, -1.2);
      ray.set(o, dir);
      ray.far = 2.4;
      const hit = ray.intersectObjects(salas, true)[0];
      if (hit) m.position.copy(hit.point).addScaledVector(dir, -(n.estilo === 'pared' ? 0.02 : 0.015));
    }
    return true;
  }

  /** Cada fotograma: cuál está cerca y delante; brilla un poco al acercarse. */
  update() {
    const L = this.L;
    this.cerca = null;
    if (!this.mallas.length || L.x === undefined) return;
    if (!this.ajustado && L.listo) this.ajustado = this._ajusta();
    const dx = Math.cos(L.yaw), dy = Math.sin(L.yaw);
    let mejor = null, md = CERCA;
    for (const m of this.mallas) {
      const n = m.userData.nota;
      const vx = n.p[0] - L.x, vy = n.p[1] - L.y;
      const d = Math.hypot(vx, vy);
      const base = n.estilo === 'pared' ? 0.55 : 0.32;
      let brillo = base;
      if (d < CERCA + 1.5) brillo = base + (1 - Math.max(0, d - 0.6) / (CERCA + 0.9)) * 0.35 * (0.8 + 0.2 * Math.sin(L.t * 3.2));
      m.material.color.setScalar(Math.max(base, brillo));
      const mira = d > 0.01 ? (vx * dx + vy * dy) / d : 1;
      const lim = n.estilo === 'pared' ? CERCA + 2.5 : CERCA;
      if (d < lim && mira > MIRA && d < md + (n.estilo === 'pared' ? 3 : 0)) { mejor = n; md = d; }
    }
    this.cerca = mejor;
  }

  /** R: leer la que está cerca. */
  tecla(code) {
    if (code !== 'KeyR' || !this.cerca || !this.L.g?.lectura) return false;
    const n = this.cerca;
    this.L.g.lectura.abre(n.id);
    if (!this.L.g.esReto?.()) ExtrasProgreso.loreDa('notas', n.id);
    return true;
  }

  /** La «R» pequeña junto al papel cercano (sin texto que diga qué hacer: solo la tecla). */
  draw(ctx) {
    if (!this.cerca || this.L.g?.lectura?.activa) return;
    const n = this.cerca;
    // (a la derecha del papel, a media altura; dentro de la pantalla)
    const lado = new THREE.Vector3(-n.n[1], 0, -n.n[0]);
    const p = new THREE.Vector3(n.p[0], n.p[2], -n.p[1]).addScaledVector(lado, n.tam[0] * 0.5 + 0.08);
    const v = p.project(this.L.cam);
    if (v.z > 1) return;
    const x = Math.max(40, Math.min(1560, (v.x + 1) / 2 * 1600)), y = Math.max(40, Math.min(830, (1 - v.y) / 2 * 900 - 15));
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = '#e8eef5';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 15, y, 30, 30);
    ctx.fillStyle = '#e8eef5';
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('R', x, y + 15);
    ctx.restore();
  }
}
