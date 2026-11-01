// =============================================================
// CreatureArt.js — Dibujo procedural de las criaturas.
//
// Estilo: cuerpos alargados, proporciones que no encajan, rasgos
// casi humanos pero incorrectos (diseños originales).
//
// drawCreature(ctx, kind, x, y, h, t, opts)
//   (x, y) = punto de apoyo en el suelo, h = altura en píxeles.
//   opts.pose = postura: cada enemigo tiene varias y cada cámara usa
//   una distinta (tabla POSES en CameraView.js), como en los FNaF.
// drawFace(ctx, kind, cx, cy, size, t)
//   Primer plano de la cara, para los sustos.
//
// Imágenes 3D (Blender, tools/3d/enemigos/): si assets/manifest.json
// tiene crt_<kind>_<pose> o face_<kind>, se dibuja la imagen en vez del
// dibujo por código. Encuadre de las posturas (SPRITE_FRAME): la imagen
// mide 3,2 h de ancho y 1,6 h de alto, con el punto de apoyo en
// (50 %, 440/512 de la altura).
// =============================================================

let SPRITES = null;
/** Lo llama Game al arrancar con su Sprites (imágenes opcionales). */
export function setCreatureSprites(sprites) {
  SPRITES = sprites;
}
// Encuadre de cada enemigo: la imagen mide w × h veces su altura, con los
// pies en (ax, ay). El Insecto (tools/3d/enemigos/insecto.py) es apaisado;
// los de forma humana (especimen.py, congelado.py, largo.py), cuadrados.
const SPRITE_FRAMES = {
  insecto: { w: 3.2, h: 1.6, ax: 0.5, ay: 440 / 512 },
  specimen: { w: 1.3, h: 1.3, ax: 0.5, ay: 0.95 },
  frozen: { w: 1.3, h: 1.3, ax: 0.5, ay: 0.95 },
  largo: { w: 1.3, h: 1.3, ax: 0.5, ay: 0.95 },
};
const FACE_SCALE = 1.35;   // ancho de la imagen de la cara respecto a size
// Dónde quedan los ojos en cada postura 3D (assets/criaturas/<enemigo>.json):
// para el brillo con la linterna y la cara de la mecánica de la luz.
const SPRITE_EYES = {};
for (const kind of ['specimen', 'frozen', 'largo']) {
  fetch(`assets/criaturas/${kind}.json`).then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d) SPRITE_EYES[kind] = d.poses; }).catch(() => {});
}
/** Ojos [[x, y, r]] (unidades = 1 % de la altura) de una postura 3D, o null. */
export function spriteEyes(kind, pose) {
  if (!spriteFor(`crt_${kind}_${pose}`)) return null;
  return SPRITE_EYES[kind]?.[pose]?.eyes ?? null;
}

/** ¿Hay imagen 3D de esta postura? */
export const hasCreatureSprite = (kind, pose) => !!spriteFor(`crt_${kind}_${pose}`);

const _avisadas = new Set();
/** Aviso (una vez) de una imagen de criatura que falta. */
function avisaFalta(key) {
  if (_avisadas.has(key) || !SPRITES?.images) return;
  _avisadas.add(key);
  console.warn('Vigía-7: falta la imagen de criatura', key);
}

function spriteFor(key) {
  return SPRITES?.images?.get(key) ?? null;
}

const SKIN = {
  specimen: '#b9c7b4',
  largo: '#d8d0c6',
  insecto: '#cfc3b4',
  frozen: '#bcd6e8',
};

function limb(ctx, pts, width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}

// Ojos que brillan con la linterna, como los de un gato (final de la
// noche 2). Se activa solo mientras se dibuja un enemigo bajo el haz.
let eyeShine = false;
export function setEyeShine(on) {
  eyeShine = on;
}

function eye(ctx, x, y, r, glow = false) {
  ctx.fillStyle = '#050505';
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 1.25, 0, 0, Math.PI * 2);
  ctx.fill();
  if (eyeShine) {
    ctx.save();
    ctx.shadowColor = 'rgba(220,255,150,1)';
    ctx.shadowBlur = r * 4;
    ctx.fillStyle = 'rgba(225,255,170,0.95)';
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.75, r * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x - r * 0.2, y - r * 0.3, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (glow) {
    ctx.fillStyle = '#e8f6ff';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Dibuja una criatura de cuerpo entero.
 *   opts.alpha  <1 = medio oculta en la oscuridad
 *   opts.pose   postura (cada cámara usa la suya, ver POSES en CameraView):
 *     specimen: 'stand' | 'crouch' | 'lean' | 'ceiling' | 'front' | 'hall'
 *     frozen:   'run' | 'crawl' | 'leap' | 'front'
 *     largo:    'hit' | 'claw' | 'kneel'   (+ opts.look: cara girada hacia la cámara)
 *     insecto:  'crawl' | 'ceiling' | 'coiled' | 'rear' | 'reach'
 *   opts.target El Largo: punto que golpea (la rejilla), en unidades de
 *               altura (h/100) relativas a sus pies.
 * Con 'ceiling', (x, y) es el punto de agarre en el techo: se dibuja boca abajo.
 */
export function drawCreature(ctx, kind, x, y, h, t = 0, opts = {}) {
  ctx.save();
  const pose = opts.pose ?? DEFAULT_POSE[kind];
  const sway = Math.sin(t * 1.3 + x) * h * 0.01;
  ctx.translate(x + sway, y);
  if (pose === 'ceiling') ctx.scale(1, -1);
  ctx.globalAlpha = opts.alpha ?? 1;
  const img = spriteFor(`crt_${kind}_${pose}`);
  if (img) {
    // Respira y se mueve un poco (la imagen es fija)
    const F = SPRITE_FRAMES[kind] ?? SPRITE_FRAMES.specimen;
    const bob = Math.sin(t * 2.1 + x * 0.01) * h * 0.012;
    const w = F.w * h;
    const hh = F.h * h;
    if (kind === 'frozen') {
      // Va tan rápido que la cámara lo capta con estela
      for (const [d, a] of [[0.5, 0.15], [0.25, 0.3]]) {
        ctx.save();
        if (pose === 'front') ctx.scale(1 - d * 0.5, 1 - d * 0.5);
        else ctx.translate(d * h * 0.4, 0);
        ctx.globalAlpha *= a;
        ctx.drawImage(img, -F.ax * w, -F.ay * hh + bob, w, hh);
        ctx.restore();
      }
    }
    ctx.drawImage(img, -F.ax * w, -F.ay * hh + bob, w, hh);
    // Con la linterna, los ojos brillan como los de un gato
    const eyes = eyeShine ? SPRITE_EYES[kind]?.[pose]?.eyes : null;
    if (eyes) {
      const u = h / 100;
      for (const [ex, ey] of eyes) {
        const g = ctx.createRadialGradient(ex * u, ey * u + bob, 0, ex * u, ey * u + bob, 3.2 * u);
        g.addColorStop(0, 'rgba(235,250,215,0.95)');
        g.addColorStop(0.35, 'rgba(200,235,170,0.45)');
        g.addColorStop(1, 'rgba(200,235,170,0)');
        ctx.fillStyle = g;
        ctx.fillRect(ex * u - 3.2 * u, ey * u + bob - 3.2 * u, 6.4 * u, 6.4 * u);
      }
    }
    ctx.restore();
    return;
  }
  // v0.51 (rediseño de criaturas): ya no hay dibujo 2D de reserva (era la
  // cabeza de huevo de antes). Si falta una imagen, no se dibuja nada.
  avisaFalta(`crt_${kind}_${pose}`);
  ctx.restore();
}

const DEFAULT_POSE = { specimen: 'stand', frozen: 'run', largo: 'hit', insecto: 'crawl' };

/** Mano con dedos largos y finos abiertos en abanico. */
function fingers(ctx, x, y, dir, len, w, color, spread = 0.5) {
  for (let f = -1; f <= 1; f++) {
    const a = dir + f * spread;
    limb(ctx, [[x, y], [x + Math.cos(a) * len, y + Math.sin(a) * len]], w, color);
  }
}

// --- El Congelado: cuerpo escuálido azul pálido, con escarcha y
//     carámbanos colgando. Siempre a toda velocidad.
function frozen(ctx, h, t, pose) {
  const c = SKIN.frozen;
  const u = h / 100;
  const run = Math.sin(t * 18); // zancadas rápidas
  ctx.fillStyle = c;
  if (pose === 'crawl') {
    // A cuatro patas, pegado al suelo, como un animal
    limb(ctx, [[-20 * u, -22 * u], [-34 * u - run * 10 * u, -12 * u], [-44 * u - run * 12 * u, 0]], 5 * u, c);
    limb(ctx, [[-14 * u, -22 * u], [-6 * u + run * 10 * u, -14 * u], [-16 * u + run * 14 * u, 0]], 5 * u, c);
    limb(ctx, [[18 * u, -26 * u], [30 * u - run * 8 * u, -12 * u], [40 * u - run * 12 * u, 0]], 4 * u, c);
    limb(ctx, [[22 * u, -26 * u], [40 * u + run * 8 * u, -16 * u], [52 * u + run * 10 * u, -1 * u]], 4 * u, c);
    ctx.beginPath();
    ctx.ellipse(0, -26 * u, 26 * u, 9 * u, -0.08, 0, Math.PI * 2);
    ctx.fill();
    frozenHead(ctx, 34 * u, -34 * u, 0.15, u, true);
    frost(ctx, u, [[-16, -34, 7], [-4, -35, 6], [8, -34, 8], [20, -32, 5]]);
    return;
  }
  if (pose === 'leap') {
    // En el aire, estirado en horizontal, brazos por delante
    ctx.save();
    ctx.translate(0, -34 * u);
    limb(ctx, [[-14 * u, -2 * u], [-34 * u, 4 * u], [-52 * u, 0]], 5 * u, c);
    limb(ctx, [[-14 * u, 2 * u], [-30 * u, 12 * u], [-48 * u, 16 * u]], 5 * u, c);
    ctx.beginPath();
    ctx.ellipse(4 * u, 0, 24 * u, 8 * u, -0.1, 0, Math.PI * 2);
    ctx.fill();
    limb(ctx, [[20 * u, -4 * u], [40 * u, -12 * u + run * 3 * u], [60 * u, -10 * u]], 4 * u, c);
    limb(ctx, [[20 * u, 0], [40 * u, 4 * u - run * 3 * u], [58 * u, 4 * u]], 4 * u, c);
    fingers(ctx, 60 * u, -10 * u, -0.1, 7 * u, 1.4 * u, c, 0.35);
    fingers(ctx, 58 * u, 4 * u, 0.1, 7 * u, 1.4 * u, c, 0.35);
    frozenHead(ctx, 32 * u, -12 * u, 0.3, u, true);
    frost(ctx, u, [[-6, 6, 8], [6, 6, 6], [16, 4, 5]]);
    ctx.restore();
    return;
  }
  if (pose === 'front') {
    // Corriendo de frente, directo a la cámara: brazos abiertos
    limb(ctx, [[-6 * u, -46 * u], [-14 * u, -24 * u + run * 6 * u], [-10 * u, 0]], 6 * u, c);
    limb(ctx, [[6 * u, -46 * u], [14 * u, -24 * u - run * 6 * u], [10 * u, 0]], 6 * u, c);
    ctx.beginPath();
    ctx.ellipse(0, -62 * u, 12 * u, 20 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    limb(ctx, [[-10 * u, -76 * u], [-30 * u, -66 * u - run * 8 * u], [-44 * u, -80 * u]], 4 * u, c);
    limb(ctx, [[10 * u, -76 * u], [30 * u, -66 * u + run * 8 * u], [44 * u, -80 * u]], 4 * u, c);
    fingers(ctx, -44 * u, -80 * u, -2.4, 7 * u, 1.4 * u, c);
    fingers(ctx, 44 * u, -80 * u, -0.7, 7 * u, 1.4 * u, c);
    frozenHead(ctx, 0, -90 * u, 0, u, true, 1.2);
    frost(ctx, u, [[-8, -78, 9], [6, -74, 7], [-2, -58, 8], [10, -60, 5]]);
    return;
  }
  // 'run': de perfil, encorvado hacia delante
  limb(ctx, [[0, -46 * u], [12 * u + run * 10 * u, -24 * u], [6 * u + run * 18 * u, 0]], 6 * u, c);
  limb(ctx, [[0, -46 * u], [-10 * u - run * 10 * u, -26 * u], [-18 * u - run * 14 * u, -4 * u]], 6 * u, c);
  ctx.beginPath();
  ctx.ellipse(8 * u, -62 * u, 11 * u, 22 * u, 0.6, 0, Math.PI * 2);
  ctx.fill();
  limb(ctx, [[12 * u, -74 * u], [-8 * u, -62 * u + run * 6 * u], [-26 * u, -54 * u]], 4 * u, c);
  limb(ctx, [[14 * u, -72 * u], [30 * u, -58 * u - run * 6 * u], [44 * u, -64 * u]], 4 * u, c);
  frozenHead(ctx, 28 * u, -86 * u, 0.5, u, false);
  frost(ctx, u, [[0, -78, 9], [8, -70, 6], [-4, -60, 8], [16, -56, 5], [22, -94, 5]]);
}

function frozenHead(ctx, x, y, rot, u, facing, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.fillStyle = SKIN.frozen;
  ctx.beginPath();
  ctx.ellipse(0, 0, 9 * u, 12 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  if (facing) {
    // Mirando a la cámara: dos ojos a la misma altura y boca muy abierta
    eye(ctx, -3.5 * u, -3 * u, 2.2 * u, true);
    eye(ctx, 3.5 * u, -3 * u, 2.2 * u, true);
    ctx.fillStyle = '#0d0505';
    ctx.beginPath();
    ctx.ellipse(0, 5.5 * u, 3.2 * u, 5 * u, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    eye(ctx, 3 * u, -3 * u, 2.2 * u, true);
    eye(ctx, -3 * u, -1 * u, 1.8 * u, true);
    ctx.fillStyle = '#0d0505';
    ctx.beginPath();
    ctx.ellipse(3 * u, 8 * u, 3 * u, 4.5 * u, -0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Escarcha y carámbanos: [x, y, largo] en unidades. */
function frost(ctx, u, list) {
  ctx.fillStyle = 'rgba(235,248,255,0.85)';
  for (const [x, y, l] of list) {
    ctx.beginPath();
    ctx.moveTo(x * u - 1.5 * u, y * u);
    ctx.lineTo(x * u + 1.5 * u, y * u);
    ctx.lineTo(x * u, (y + l) * u);
    ctx.fill();
  }
}

// --- El Espécimen: piel translúcida verdosa, cuello larguísimo,
//     brazos que arrastra por el suelo, cabeza alargada con boca vertical.
function specimen(ctx, h, t, pose) {
  const c = SKIN.specimen;
  const u = h / 100;
  const nod = Math.sin(t * 0.9) * 2 * u;
  if (pose === 'crouch' || pose === 'ceiling') {
    // A cuatro patas con los codos muy altos, como una araña; la cabeza
    // sube al final del cuello y mira a la cámara. (En el techo, igual
    // pero boca abajo: la cabeza cuelga.)
    limb(ctx, [[-22 * u, 0], [-30 * u, -16 * u], [-14 * u, -26 * u]], 7 * u, c);
    limb(ctx, [[-6 * u, 0], [-16 * u, -18 * u], [-2 * u, -28 * u]], 7 * u, c);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(2 * u, -32 * u, 24 * u, 12 * u, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ribs(ctx, u, [[-8, -40], [0, -42], [8, -43], [16, -44]], 7);
    limb(ctx, [[18 * u, -38 * u], [32 * u, -58 * u], [44 * u, 0]], 5 * u, c);
    limb(ctx, [[10 * u, -36 * u], [20 * u, -52 * u], [26 * u, -1 * u]], 5 * u, c);
    fingers(ctx, 44 * u, 0, 0, 6 * u, 1.8 * u, c, 0.4);
    fingers(ctx, 26 * u, -1 * u, Math.PI, 6 * u, 1.8 * u, c, 0.4);
    limb(ctx, [[22 * u, -40 * u], [32 * u, -54 * u], [38 * u + nod, -64 * u]], 6 * u, c);
    // En el techo la cabeza se gira del todo: la cara se ve del derecho
    specimenHead(ctx, 40 * u + nod, -70 * u, pose === 'ceiling' ? Math.PI : -0.1, u, true);
    return;
  }
  if (pose === 'front' || pose === 'hall') {
    // De frente, quieto, mirando fijamente a la cámara. En los pasillos,
    // con la cabeza muy ladeada.
    limb(ctx, [[-10 * u, 0], [-16 * u, -18 * u], [-6 * u, -34 * u]], 7 * u, c);
    limb(ctx, [[10 * u, 0], [16 * u, -18 * u], [6 * u, -34 * u]], 7 * u, c);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(0, -48 * u, 14 * u, 20 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    ribs(ctx, u, [[0, -56], [0, -50], [0, -44], [0, -38]], 10);
    limb(ctx, [[-12 * u, -62 * u], [-22 * u, -36 * u], [-24 * u, -2 * u]], 5 * u, c);
    limb(ctx, [[12 * u, -62 * u], [22 * u, -36 * u], [24 * u, -2 * u]], 5 * u, c);
    fingers(ctx, -24 * u, -2 * u, Math.PI / 2 + 0.3, 6 * u, 1.8 * u, c, 0.35);
    fingers(ctx, 24 * u, -2 * u, Math.PI / 2 - 0.3, 6 * u, 1.8 * u, c, 0.35);
    const tilt = pose === 'hall' ? 0.7 : 0.08 * Math.sin(t * 0.6);
    limb(ctx, [[0, -66 * u], [1 * u, -82 * u], [Math.sin(tilt) * 6 * u, -92 * u]], 6 * u, c);
    specimenHead(ctx, Math.sin(tilt) * 10 * u, -98 * u, tilt, u, true, 1.1);
    return;
  }
  if (pose === 'lean') {
    // Asomándose: todo el cuerpo inclinado de lado, la cabeza girada
    // casi del revés
    ctx.rotate(-0.38);
  }
  // 'stand': de perfil, cuello inclinado hacia delante
  limb(ctx, [[-10 * u, 0], [-16 * u, -18 * u], [-6 * u, -34 * u]], 7 * u, c);
  limb(ctx, [[10 * u, 0], [18 * u, -18 * u], [8 * u, -34 * u]], 7 * u, c);
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(0, -48 * u, 14 * u, 20 * u, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ribs(ctx, u, [[0, -52], [0, -46], [0, -40], [0, -34]], 10);
  limb(ctx, [[-12 * u, -62 * u], [-30 * u, -40 * u], [-34 * u, -2 * u]], 5 * u, c);
  limb(ctx, [[12 * u, -62 * u], [32 * u, -36 * u], [30 * u, -2 * u]], 5 * u, c);
  for (const s of [-1, 1]) fingers(ctx, s * 32 * u, -2 * u, Math.PI / 2 - s * 1.2, 5 * u, 1.8 * u, c, 0.4);
  limb(ctx, [[2 * u, -66 * u], [10 * u, -84 * u], [18 * u + nod, -92 * u]], 6 * u, c);
  specimenHead(ctx, 20 * u + nod, -96 * u, pose === 'lean' ? 1.9 : 0.35, u, false);
}

function ribs(ctx, u, list, r) {
  ctx.strokeStyle = 'rgba(60,80,60,0.6)';
  ctx.lineWidth = 1.5 * u;
  for (const [x, y] of list) {
    ctx.beginPath();
    ctx.arc(x * u, y * u, r * u, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
}

function specimenHead(ctx, x, y, rot, u, facing, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.fillStyle = SKIN.specimen;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8 * u, 14 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  if (facing) {
    eye(ctx, -3.2 * u, -5 * u, 1.9 * u, true);
    eye(ctx, 3.2 * u, -4.5 * u, 1.5 * u, true);
  } else {
    eye(ctx, -3 * u, -5 * u, 1.8 * u, true);
    eye(ctx, 3.5 * u, -4 * u, 1.4 * u, true);
  }
  // Boca vertical (de frente, más abierta)
  ctx.fillStyle = '#1a0a0a';
  ctx.beginPath();
  ctx.ellipse(0, 6 * u, (facing ? 2.2 : 1.6) * u, (facing ? 7 : 6) * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// --- El Largo: altísimo y delgado, cabeza diminuta con una cara
//     humana demasiado sonriente, brazos larguísimos. Siempre está
//     golpeando la entrada del conducto de la sala (opts.target).
function largo(ctx, h, t, pose, opts) {
  const c = SKIN.largo;
  const u = h / 100;
  const dark = '#37302a'; // ropa raída (no tan negra: si no, en cámara no se ve la postura)
  // Poses QUIETAS (final de la noche 2): los brazos cuelgan, no golpea.
  // Golpear/arañar (hit, claw, kneel) es solo para cuando quiere entrar
  // por los conductos (cámaras).
  //   stand  → de pie, brazos colgando     crouch → de rodillas, brazos al suelo
  //   lean   → ladeado, inclinado hacia un lado
  const still = pose === 'stand' || pose === 'crouch' || pose === 'lean';
  if (pose === 'lean') ctx.rotate(-0.3);
  const kneel = pose === 'kneel' || pose === 'crouch';
  const target = opts.target ?? { x: -30, y: kneel ? -50 : -80 };
  // Esqueleto: cadera, hombros y cabeza
  const hip = kneel ? [4, -24] : [0, -50];
  const sh = kneel ? [-12, -54] : [0, -82];
  const head = kneel ? [-17, -64] : [1, -95];
  // Piernas
  if (kneel) {
    limb(ctx, [[18 * u, 0], [-2 * u, -1 * u], [hip[0] * u, hip[1] * u]], 4.5 * u, dark);
    limb(ctx, [[26 * u, -1 * u], [8 * u, -3 * u], [(hip[0] + 4) * u, hip[1] * u]], 4.5 * u, dark);
  } else {
    limb(ctx, [[-5 * u, 0], [-6 * u, -25 * u], [-4 * u, -50 * u]], 4.5 * u, dark);
    limb(ctx, [[5 * u, 0], [6 * u, -25 * u], [4 * u, -50 * u]], 4.5 * u, dark);
  }
  // Torso estrecho y largo, de la cadera a los hombros
  const ax = sh[0] - hip[0];
  const ay = sh[1] - hip[1];
  const len = Math.hypot(ax, ay);
  const px = -ay / len;
  const py = ax / len;
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo((hip[0] - px * 7) * u, (hip[1] - py * 7) * u);
  ctx.lineTo((hip[0] + px * 7) * u, (hip[1] + py * 7) * u);
  ctx.lineTo((sh[0] + px * 9) * u, (sh[1] + py * 9) * u);
  ctx.lineTo((sh[0] - px * 9) * u, (sh[1] - py * 9) * u);
  ctx.closePath();
  ctx.fill();
  // Brazos: golpean la entrada (empujón rítmico hacia la rejilla)
  const pound = Math.max(0, Math.sin(t * 9));
  const arms = pose === 'hit' ? [[-1, 0]] : [[-1, -5], [1, 5]];
  const reach = (side, dy, k) => {
    const s = [sh[0] + side * 8, sh[1] + 2];
    const tx = target.x + 4 * (1 - k);
    const ty = target.y + dy;
    const elbow = [(s[0] + tx) / 2, (s[1] + ty) / 2 + 9];
    // Manga oscura hasta el codo y antebrazo pálido, huesudo
    limb(ctx, [[s[0] * u, s[1] * u], [elbow[0] * u, elbow[1] * u]], 3.2 * u, dark);
    limb(ctx, [[elbow[0] * u, elbow[1] * u], [tx * u, ty * u]], 2.2 * u, c);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(tx * u, ty * u, 2.8 * u, 4.2 * u, 0.6, 0, Math.PI * 2);
    ctx.fill();
    fingers(ctx, tx * u, ty * u, Math.PI + 0.2, 6 * u, 1.1 * u, c, 0.45);
  };
  if (still) {
    // Los dos brazos cuelgan, larguísimos, casi hasta el suelo
    for (const side of [-1, 1]) {
      const s = [sh[0] + side * 9, sh[1] + 2];
      const elbow = [sh[0] + side * 12, sh[1] + 27];
      const hand = [sh[0] + side * 11, Math.min(-3, sh[1] + 54)];
      limb(ctx, [[s[0] * u, s[1] * u], [elbow[0] * u, elbow[1] * u]], 3.2 * u, dark);
      limb(ctx, [[elbow[0] * u, elbow[1] * u], [hand[0] * u, hand[1] * u]], 2.2 * u, c);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(hand[0] * u, (hand[1] + 4) * u, 2.5 * u, 5 * u, 0, 0, Math.PI * 2);
      ctx.fill();
      fingers(ctx, hand[0] * u, (hand[1] + 7) * u, Math.PI / 2, 5 * u, 1.1 * u, c, 0.3);
    }
  } else arms.forEach(([side, dy], i) => reach(side, dy, i ? Math.max(0, Math.sin(t * 9 + 1.6)) : pound));
  if (pose === 'hit') {
    // El otro brazo cuelga, larguísimo
    const swing = Math.sin(t * 1.1) * 1.5 * u;
    limb(ctx, [[(sh[0] + 9) * u, (sh[1] + 2) * u], [(sh[0] + 12) * u, (sh[1] + 27) * u]], 3.2 * u, dark);
    limb(ctx, [[(sh[0] + 12) * u, (sh[1] + 27) * u], [(sh[0] + 11) * u + swing, (sh[1] + 54) * u]], 2.2 * u, c);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse((sh[0] + 11) * u + swing, (sh[1] + 58) * u, 2.5 * u, 5 * u, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cuello fino y cabeza pequeña
  limb(ctx, [[sh[0] * u, sh[1] * u], [(head[0] + 0.5) * u, (head[1] + 5) * u]], 2.2 * u, c);
  ctx.save();
  ctx.translate(head[0] * u, head[1] * u);
  // look: la cabeza gira del todo hacia la cámara, ladeada, mientras el
  // cuerpo sigue golpeando
  ctx.rotate(opts.look ? 0.45 + Math.sin(t * 0.5) * 0.04 : -0.25 + Math.sin(t * 0.5) * 0.05);
  const hs = opts.look ? 1.25 : 1;
  ctx.scale(hs, hs);
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(0, 0, 4.5 * u, 5.5 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  eye(ctx, -1.6 * u, -1.2 * u, 0.7 * u, opts.look);
  eye(ctx, 1.6 * u, -1.2 * u, 0.7 * u, opts.look);
  // Sonrisa demasiado ancha, de lado a lado (mirando, enseña los dientes)
  ctx.strokeStyle = '#2a0e0e';
  ctx.lineWidth = 0.8 * u;
  ctx.beginPath();
  ctx.arc(0, 1 * u, 3.6 * u, 0.15, Math.PI - 0.15);
  ctx.stroke();
  if (opts.look) {
    ctx.fillStyle = '#ddd5bd';
    ctx.beginPath();
    ctx.arc(0, 1 * u, 3.1 * u, 0.3, Math.PI - 0.3);
    ctx.arc(0, 1.6 * u, 2.4 * u, Math.PI - 0.35, 0.35, true);
    ctx.fill();
  }
  ctx.restore();
}

// --- El Insecto: torso larguísimo, cuatro extremidades con codos
//     altos como un insecto y cara humana.
function insecto(ctx, h, t, pose) {
  const c = SKIN.insecto;
  const u = h / 100;
  const crawl = Math.sin(t * 3) * 3 * u;
  if (pose === 'coiled') {
    // Enroscado en el suelo del conducto, la cara en el centro mirándote
    ctx.fillStyle = c;
    ctx.strokeStyle = c;
    ctx.lineWidth = 16 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, -24 * u, 22 * u, 0.3, Math.PI * 1.75);
    ctx.stroke();
    spine(ctx, u, Array.from({ length: 8 }, (_, i) => 0.5 + i * 0.6).map((a) => [Math.cos(a) * 30, -24 + Math.sin(a) * 30]));
    for (const [a, ph] of [[0.6, 0], [1.6, 1], [2.8, 2], [4.4, 3]]) {
      const k = Math.sin(t * 2 + ph) * 2;
      const bx = Math.cos(a) * 26;
      const by = -24 + Math.sin(a) * 26;
      limb(ctx, [[bx * u, by * u], [bx * 1.6 * u, (by - 26 + k) * u], [bx * 2.1 * u, Math.min(0, by + 20) * u]], 3 * u, c);
    }
    insectFace(ctx, 0, -26 * u, Math.sin(t * 0.7) * 0.1, u, 1.2);
    return;
  }
  if (pose === 'rear') {
    // Medio cuerpo levantado contra la pared del conducto, las patas
    // delanteras arañando hacia arriba
    for (const [bx, dir, ph] of [[-40, -1, 0], [-25, -1, 1]]) {
      const k = Math.sin(t * 3 + ph) * 2 * u;
      limb(ctx, [[bx * u, -24 * u], [(bx + dir * 6) * u, -60 * u + k], [(bx + dir * 16) * u, 0]], 3 * u, c);
    }
    ctx.save();
    ctx.translate(-18 * u, -26 * u);
    ctx.rotate(-1.0);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(30 * u, 0, 40 * u, 9 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    spine(ctx, u, Array.from({ length: 8 }, (_, i) => [i * 9, -7]));
    for (const [bx, ph] of [[46, 2], [56, 3]]) {
      const k = Math.sin(t * 4 + ph) * 4;
      limb(ctx, [[bx * u, 4 * u], [(bx + 4) * u, (34 + k) * u], [(bx + 20) * u, (26 - k) * u]], 3 * u, c);
    }
    ctx.restore();
    insectFace(ctx, 30 * u, -92 * u, 0.25 + Math.sin(t * 0.7) * 0.08, u, 1);
    return;
  }
  // 'crawl' / 'ceiling' / 'reach': arrastrándose
  const legs = pose === 'reach' ? [[-40, -1, 0], [-25, -1, 1], [25, 1, 2]] : [[-40, -1, 0], [-25, -1, 1], [25, 1, 2], [40, 1, 3]];
  for (const [bx, dir, ph] of legs) {
    const k = Math.sin(t * 3 + ph) * 2 * u;
    limb(ctx, [[bx * u, -28 * u], [(bx + dir * 6) * u, -70 * u + k], [(bx + dir * 16) * u, 0]], 3 * u, c);
  }
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(0, -32 * u + crawl * 0.2, 50 * u, 9 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  spine(ctx, u, Array.from({ length: 11 }, (_, i) => [-40 + i * 8, -38]));
  if (pose === 'reach') {
    // Una pata larguísima estirada hacia la cámara, con la mano abierta
    const k = Math.sin(t * 2.2) * 3;
    limb(ctx, [[40 * u, -30 * u], [62 * u, -64 * u], [96 * u + k * u, -20 * u]], 3.4 * u, c);
    fingers(ctx, (96 + k) * u, -20 * u, 0.7, 10 * u, 1.6 * u, c, 0.5);
  }
  limb(ctx, [[45 * u, -34 * u], [56 * u, -40 * u]], 6 * u, c);
  if (pose === 'crawl') {
    // Cara humana girada 90°, de lado
    insectFace(ctx, 62 * u, -42 * u, Math.PI / 2 + Math.sin(t * 0.7) * 0.08, u, 1);
  } else {
    // De frente (en el techo, la cabeza girada del todo: se ve del derecho)
    insectFace(ctx, 62 * u, -44 * u, (pose === 'ceiling' ? Math.PI : 0) + Math.sin(t * 0.7) * 0.08, u, pose === 'reach' ? 1.3 : 1.1);
  }
}

function spine(ctx, u, list) {
  ctx.strokeStyle = 'rgba(70,55,45,0.6)';
  ctx.lineWidth = 1.5 * u;
  for (const [x, y] of list) {
    ctx.beginPath();
    ctx.moveTo(x * u, (y - 2) * u);
    ctx.lineTo(x * u, (y + 2) * u);
    ctx.stroke();
  }
}

function insectFace(ctx, x, y, rot, u, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.fillStyle = SKIN.insecto;
  ctx.beginPath();
  ctx.ellipse(0, 0, 9 * u, 11 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  eye(ctx, -3.5 * u, -2.5 * u, 1.6 * u, true);
  eye(ctx, 3.5 * u, -2.5 * u, 1.6 * u, true);
  ctx.fillStyle = '#2a1414';
  ctx.fillRect(-3 * u, 4 * u, 6 * u, 1.2 * u);
  ctx.restore();
}

// =================================================================
// Caras para los sustos (también El Congelado en su cápsula)
//
// Rasgos casi humanos pero incorrectos: cuencas hundidas con pupilas
// diminutas, proporciones estiradas, dientes de tamaños distintos y
// rasgos que tiemblan ligeramente (no se están quietos nunca).
// =================================================================

// Dientes irregulares precalculados (siempre los mismos)
const TEETH = Array.from({ length: 16 }, (_, i) => 0.55 + ((i * 7919) % 13) / 20);

export function drawFace(ctx, kind, cx, cy, size, t = 0, opts = {}) {
  const img = spriteFor(`face_${kind}`);
  if (img) {
    const w = size * FACE_SCALE;
    ctx.drawImage(img, cx - w / 2, cy - w / 2, w, w);
    return;
  }
  // v0.51: sin la cara de huevo dibujada de antes (solo las caras 3D nuevas)
  avisaFalta(`face_${kind}`);
  if (!opts.dibujoViejo) return;
  const c = SKIN[kind] ?? '#ccc';
  const s = size / 100;
  const j = (k) => Math.sin(t * 37 + k) * 1.2 * s; // temblor de los rasgos
  ctx.save();
  ctx.translate(cx, cy);

  // Proporciones de la cabeza: [ancho, alto]
  const [hw, hh] = {
    specimen: [34, 66],
    largo: [30, 60],
    insecto: [44, 50],
    frozen: [38, 52],
  }[kind] ?? [40, 50];
  const tilt = kind === 'insecto' ? 0.45 : kind === 'largo' ? -0.12 : 0;
  ctx.rotate(tilt);

  // Cabeza con mandíbula estrecha (forma de gota invertida)
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(0, -hh * s);
  ctx.bezierCurveTo(hw * 1.15 * s, -hh * s, hw * 1.1 * s, hh * 0.35 * s, 0, hh * s);
  ctx.bezierCurveTo(-hw * 1.1 * s, hh * 0.35 * s, -hw * 1.15 * s, -hh * s, 0, -hh * s);
  ctx.fill();

  // Sombra fuerte: luz desde arriba, mitad inferior en penumbra
  const shade = ctx.createLinearGradient(0, -hh * s, 0, hh * s);
  shade.addColorStop(0, 'rgba(255,255,255,0.12)');
  shade.addColorStop(0.55, 'rgba(0,0,0,0.25)');
  shade.addColorStop(1, 'rgba(0,0,0,0.7)');
  ctx.fillStyle = shade;
  ctx.fill();

  // Venas / arrugas
  ctx.strokeStyle = 'rgba(60,40,40,0.35)';
  ctx.lineWidth = 1.2 * s;
  for (const [x1, y1, x2, y2] of [[-20, -40, -8, -28], [18, -44, 8, -30], [-24, 6, -14, 18], [22, 4, 12, 20], [-4, -52, 4, -40]]) {
    ctx.beginPath();
    ctx.moveTo(x1 * s, y1 * s);
    ctx.quadraticCurveTo((x1 + x2) / 2 * s + 4 * s, (y1 + y2) / 2 * s, x2 * s, y2 * s);
    ctx.stroke();
  }

  const eyesOpen = opts.eyesOpen ?? true;
  // Posición de los ojos por criatura: [x, y, radio] (deliberadamente asimétricos)
  const eyes = {
    specimen: [[-13, -24, 8], [11, -19, 6]],
    largo: [[-11, -28, 6], [11, -26, 6]],
    insecto: [[-15, -14, 7], [14, -16, 7], [1, -34, 4]],
    frozen: [[-13, -12, 7], [13, -12, 7]],
  }[kind] ?? [];

  for (const [ex, ey, er] of eyes) {
    // Cuenca hundida
    const sock = ctx.createRadialGradient(ex * s, ey * s, er * 0.3 * s, ex * s, ey * s, er * 2.1 * s);
    sock.addColorStop(0, 'rgba(0,0,0,0.95)');
    sock.addColorStop(0.55, 'rgba(10,5,5,0.7)');
    sock.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sock;
    ctx.beginPath();
    ctx.arc(ex * s, ey * s, er * 2.1 * s, 0, Math.PI * 2);
    ctx.fill();
    if (eyesOpen) {
      // Blanco del ojo amarillento y pupila diminuta que tiembla
      ctx.fillStyle = '#d9d2b8';
      ctx.beginPath();
      ctx.ellipse(ex * s, ey * s, er * s, er * 0.75 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#050505';
      ctx.beginPath();
      ctx.arc(ex * s + j(ex), ey * s + j(ey), er * 0.22 * s, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#3a4a55';
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.arc(ex * s, ey * s, er * s, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
  }

  // Nariz: dos rendijas, sin puente
  if (kind !== 'specimen') {
    ctx.fillStyle = 'rgba(20,8,8,0.8)';
    ctx.beginPath();
    ctx.ellipse(-3 * s, -2 * s, 1.4 * s, 3 * s, 0.3, 0, Math.PI * 2);
    ctx.ellipse(3 * s, -2 * s, 1.4 * s, 3 * s, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Boca
  switch (kind) {
    case 'specimen':
      // Boca vertical que se abre de arriba abajo
      mouth(ctx, 0, 20 * s + j(1), 10 * s, 32 * s, 'vertical', t);
      break;
    case 'largo':
      // Sonrisa que llega casi a las orejas, más ancha que la cara
      mouth(ctx, 0, 18 * s, 40 * s, 15 * s, 'smile', t);
      break;
    case 'insecto':
      mouth(ctx, 2 * s, 22 * s + j(2), 18 * s, 9 * s, 'open', t);
      break;
    case 'frozen':
      mouth(ctx, 0, 24 * s, 11 * s, eyesOpen ? 13 * s : 2 * s, 'open', t);
      // Escarcha alrededor de la cara
      ctx.strokeStyle = 'rgba(240,250,255,0.8)';
      ctx.lineWidth = 1.5 * s;
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2 + 0.3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * hw * s, Math.sin(a) * hh * s);
        ctx.lineTo(Math.cos(a) * (hw + 12) * s, Math.sin(a) * (hh + 14) * s);
        ctx.stroke();
      }
      break;
  }
  ctx.restore();
}

/** Boca oscura con encías y dientes de tamaños irregulares. */
function mouth(ctx, cx, cy, rx, ry, style, t) {
  ctx.save();
  ctx.fillStyle = '#5a1b1b'; // encías
  ctx.beginPath();
  if (style === 'smile') ctx.ellipse(cx, cy, rx * 1.05, ry * 1.2, 0, 0, Math.PI);
  else ctx.ellipse(cx, cy, rx * 1.1, ry * 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0d0303';
  ctx.beginPath();
  if (style === 'smile') ctx.ellipse(cx, cy + ry * 0.15, rx * 0.95, ry, 0, 0, Math.PI);
  else ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.clip();

  ctx.fillStyle = '#ddd5bd';
  if (style === 'vertical') {
    // Dientes a ambos lados, hacia el centro
    for (let i = 0; i < 8; i++) {
      const y = cy - ry + (i + 0.5) * (2 * ry / 8);
      const len = rx * 0.55 * TEETH[i];
      ctx.beginPath();
      ctx.moveTo(cx - rx, y - ry * 0.08);
      ctx.lineTo(cx - rx + len, y);
      ctx.lineTo(cx - rx, y + ry * 0.08);
      ctx.moveTo(cx + rx, y - ry * 0.08);
      ctx.lineTo(cx + rx - len, y + ry * 0.03);
      ctx.lineTo(cx + rx, y + ry * 0.08);
      ctx.fill();
    }
  } else {
    // Fila superior (y en 'open' también la inferior)
    const n = 14;
    for (let i = 0; i < n; i++) {
      const x = cx - rx + (i + 0.5) * (2 * rx / n);
      const w = rx / n * 0.9;
      const len = ry * 0.55 * TEETH[i];
      const top = style === 'smile' ? cy : cy - ry;
      ctx.beginPath();
      ctx.moveTo(x - w, top);
      ctx.lineTo(x, top + len);
      ctx.lineTo(x + w, top);
      ctx.fill();
      if (style === 'open') {
        ctx.beginPath();
        ctx.moveTo(x - w, cy + ry);
        ctx.lineTo(x, cy + ry - len * 0.8);
        ctx.lineTo(x + w, cy + ry);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}
