// =============================================================
// CreatureArt.js — Dibujo procedural de las criaturas.
//
// Estilo: cuerpos alargados, proporciones que no encajan, rasgos
// casi humanos pero incorrectos (diseños originales).
//
// drawCreature(ctx, kind, x, y, h, t, opts)
//   (x, y) = punto de apoyo en el suelo, h = altura en píxeles.
// drawFace(ctx, kind, cx, cy, size, t)
//   Primer plano de la cara, para los sustos.
//
// Si en el futuro hay imágenes propias, se pueden registrar en
// assets/manifest.json con las claves creature_<kind> / face_<kind>.
// =============================================================

const SKIN = {
  specimen: '#b9c7b4',
  alto: '#d8d0c6',
  rastrero: '#cfc3b4',
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

function eye(ctx, x, y, r, glow = false) {
  ctx.fillStyle = '#050505';
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 1.25, 0, 0, Math.PI * 2);
  ctx.fill();
  if (glow) {
    ctx.fillStyle = '#e8f6ff';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawCreature(ctx, kind, x, y, h, t = 0, opts = {}) {
  ctx.save();
  const sway = Math.sin(t * 1.3 + x) * h * 0.01;
  ctx.translate(x + sway, y);
  ctx.globalAlpha = opts.alpha ?? 1; // <1 = medio oculto en la oscuridad
  switch (kind) {
    case 'specimen': specimen(ctx, h, t); break;
    case 'alto': alto(ctx, h, t); break;
    case 'rastrero': rastrero(ctx, h, t); break;
    case 'frozen':
      // Va tan rápido que la cámara lo capta con estela
      for (const [dx, a] of [[0.5, 0.15], [0.25, 0.3]]) {
        ctx.save();
        ctx.translate(dx * h * 0.4, 0);
        ctx.globalAlpha *= a;
        frozen(ctx, h, t);
        ctx.restore();
      }
      frozen(ctx, h, t);
      break;
  }
  ctx.restore();
}

// --- El Congelado: cuerpo escuálido azul pálido, corriendo
//     encorvado hacia delante, con escarcha y carámbanos colgando.
function frozen(ctx, h, t) {
  const c = SKIN.frozen;
  const u = h / 100;
  const run = Math.sin(t * 18); // zancadas rápidas
  // Piernas largas en plena carrera
  limb(ctx, [[0, -46 * u], [12 * u + run * 10 * u, -24 * u], [6 * u + run * 18 * u, 0]], 6 * u, c);
  limb(ctx, [[0, -46 * u], [-10 * u - run * 10 * u, -26 * u], [-18 * u - run * 14 * u, -4 * u]], 6 * u, c);
  // Torso inclinado hacia delante
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(8 * u, -62 * u, 11 * u, 22 * u, 0.6, 0, Math.PI * 2);
  ctx.fill();
  // Brazos largos echados hacia atrás, dedos finos
  limb(ctx, [[12 * u, -74 * u], [-8 * u, -62 * u + run * 6 * u], [-26 * u, -54 * u]], 4 * u, c);
  limb(ctx, [[14 * u, -72 * u], [30 * u, -58 * u - run * 6 * u], [44 * u, -64 * u]], 4 * u, c);
  // Cabeza adelantada, ladeada
  ctx.beginPath();
  ctx.ellipse(28 * u, -86 * u, 9 * u, 12 * u, 0.5, 0, Math.PI * 2);
  ctx.fill();
  eye(ctx, 31 * u, -89 * u, 2.2 * u, true);
  eye(ctx, 25 * u, -87 * u, 1.8 * u, true);
  // Boca abierta
  ctx.fillStyle = '#0d0505';
  ctx.beginPath();
  ctx.ellipse(31 * u, -78 * u, 3 * u, 4.5 * u, 0.4, 0, Math.PI * 2);
  ctx.fill();
  // Escarcha y carámbanos
  ctx.fillStyle = 'rgba(235,248,255,0.85)';
  for (const [x, y, l] of [[0, -78, 9], [8, -70, 6], [-4, -60, 8], [16, -56, 5], [22, -94, 5]]) {
    ctx.beginPath();
    ctx.moveTo(x * u - 1.5 * u, y * u);
    ctx.lineTo(x * u + 1.5 * u, y * u);
    ctx.lineTo(x * u, (y + l) * u);
    ctx.fill();
  }
}

// --- El Espécimen: piel translúcida verdosa, cuello larguísimo
//     inclinado hacia delante, brazos que arrastra por el suelo,
//     cabeza alargada con boca vertical.
function specimen(ctx, h, t) {
  const c = SKIN.specimen;
  const u = h / 100;
  // Piernas cortas y dobladas hacia atrás
  limb(ctx, [[-10 * u, 0], [-16 * u, -18 * u], [-6 * u, -34 * u]], 7 * u, c);
  limb(ctx, [[10 * u, 0], [18 * u, -18 * u], [8 * u, -34 * u]], 7 * u, c);
  // Torso estrecho
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(0, -48 * u, 14 * u, 20 * u, 0.15, 0, Math.PI * 2);
  ctx.fill();
  // Costillas marcadas
  ctx.strokeStyle = 'rgba(60,80,60,0.6)';
  ctx.lineWidth = 1.5 * u;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(0, -52 * u + i * 6 * u, 10 * u, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  // Brazos larguísimos hasta el suelo, con dedos largos
  limb(ctx, [[-12 * u, -62 * u], [-30 * u, -40 * u], [-34 * u, -2 * u]], 5 * u, c);
  limb(ctx, [[12 * u, -62 * u], [32 * u, -36 * u], [30 * u, -2 * u]], 5 * u, c);
  for (const s of [-1, 1]) {
    for (let f = -1; f <= 1; f++) {
      limb(ctx, [[s * 32 * u, -2 * u], [s * (36 + f * 5) * u, 2 * u]], 1.8 * u, c);
    }
  }
  // Cuello largo inclinado hacia delante
  const nod = Math.sin(t * 0.9) * 2 * u;
  limb(ctx, [[2 * u, -66 * u], [10 * u, -84 * u], [18 * u + nod, -92 * u]], 6 * u, c);
  // Cabeza alargada
  ctx.save();
  ctx.translate(20 * u + nod, -96 * u);
  ctx.rotate(0.35);
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8 * u, 14 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  eye(ctx, -3 * u, -5 * u, 1.8 * u, true);
  eye(ctx, 3.5 * u, -4 * u, 1.4 * u, true);
  // Boca vertical
  ctx.fillStyle = '#1a0a0a';
  ctx.beginPath();
  ctx.ellipse(0, 6 * u, 1.6 * u, 6 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// --- El Alto: altísimo y delgado, cabeza diminuta con una cara
//     humana demasiado sonriente, brazos hasta las rodillas.
function alto(ctx, h, t) {
  const c = SKIN.alto;
  const u = h / 100;
  const dark = '#1b1816';
  // Piernas muy largas (con "ropa" oscura raída)
  limb(ctx, [[-5 * u, 0], [-6 * u, -25 * u], [-4 * u, -50 * u]], 4.5 * u, dark);
  limb(ctx, [[5 * u, 0], [6 * u, -25 * u], [4 * u, -50 * u]], 4.5 * u, dark);
  // Torso estrecho y largo
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(-7 * u, -50 * u);
  ctx.lineTo(7 * u, -50 * u);
  ctx.lineTo(9 * u, -82 * u);
  ctx.lineTo(-9 * u, -82 * u);
  ctx.closePath();
  ctx.fill();
  // Brazos que cuelgan hasta las rodillas, con manos pálidas
  const swing = Math.sin(t * 1.1) * 1.5 * u;
  limb(ctx, [[-9 * u, -80 * u], [-12 * u, -55 * u], [-11 * u + swing, -28 * u]], 3 * u, dark);
  limb(ctx, [[9 * u, -80 * u], [12 * u, -55 * u], [11 * u - swing, -28 * u]], 3 * u, dark);
  ctx.fillStyle = c;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * (11 * u) + (s < 0 ? swing : -swing), -24 * u, 2.5 * u, 5 * u, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cuello fino
  limb(ctx, [[0, -82 * u], [0.5 * u, -90 * u]], 2.2 * u, c);
  // Cabeza pequeña, ligeramente ladeada
  ctx.save();
  ctx.translate(1 * u, -95 * u);
  ctx.rotate(-0.25 + Math.sin(t * 0.5) * 0.05);
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(0, 0, 4.5 * u, 5.5 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  eye(ctx, -1.6 * u, -1.2 * u, 0.7 * u);
  eye(ctx, 1.6 * u, -1.2 * u, 0.7 * u);
  // Sonrisa demasiado ancha, de lado a lado
  ctx.strokeStyle = '#2a0e0e';
  ctx.lineWidth = 0.8 * u;
  ctx.beginPath();
  ctx.arc(0, 1 * u, 3.6 * u, 0.15, Math.PI - 0.15);
  ctx.stroke();
  ctx.restore();
}

// --- El Rastrero: torso larguísimo en horizontal, cuatro
//     extremidades con codos altos como un insecto, cara humana
//     girada mirando a la cámara.
function rastrero(ctx, h, t) {
  const c = SKIN.rastrero;
  const u = h / 100;
  const crawl = Math.sin(t * 3) * 3 * u;
  // Extremidades (codos muy altos)
  for (const [bx, dir, ph] of [[-40, -1, 0], [-25, -1, 1], [25, 1, 2], [40, 1, 3]]) {
    const k = Math.sin(t * 3 + ph) * 2 * u;
    limb(ctx, [[bx * u, -28 * u], [(bx + dir * 6) * u, -70 * u + k], [(bx + dir * 16) * u, 0]], 3 * u, c);
  }
  // Torso alargado
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(0, -32 * u + crawl * 0.2, 50 * u, 9 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  // Columna marcada
  ctx.strokeStyle = 'rgba(70,55,45,0.6)';
  ctx.lineWidth = 1.5 * u;
  for (let i = -40; i <= 40; i += 8) {
    ctx.beginPath();
    ctx.moveTo(i * u, -40 * u);
    ctx.lineTo(i * u, -36 * u);
    ctx.stroke();
  }
  // Cuello y cara humana girada 90° hacia la cámara
  limb(ctx, [[45 * u, -34 * u], [56 * u, -40 * u]], 6 * u, c);
  ctx.save();
  ctx.translate(62 * u, -42 * u);
  ctx.rotate(Math.PI / 2 + Math.sin(t * 0.7) * 0.08);
  ctx.fillStyle = c;
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
  const c = SKIN[kind] ?? '#ccc';
  const s = size / 100;
  const j = (k) => Math.sin(t * 37 + k) * 1.2 * s; // temblor de los rasgos
  ctx.save();
  ctx.translate(cx, cy);

  // Proporciones de la cabeza: [ancho, alto]
  const [hw, hh] = {
    specimen: [34, 66],
    alto: [30, 60],
    rastrero: [44, 50],
    frozen: [38, 52],
  }[kind] ?? [40, 50];
  const tilt = kind === 'rastrero' ? 0.45 : kind === 'alto' ? -0.12 : 0;
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
    alto: [[-11, -28, 6], [11, -26, 6]],
    rastrero: [[-15, -14, 7], [14, -16, 7], [1, -34, 4]],
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
    case 'alto':
      // Sonrisa que llega casi a las orejas, más ancha que la cara
      mouth(ctx, 0, 18 * s, 40 * s, 15 * s, 'smile', t);
      break;
    case 'rastrero':
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
