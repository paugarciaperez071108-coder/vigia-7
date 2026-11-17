// =============================================================
// lore/catalogo.js — (v2.19, el lore; encargo del 2026-11-16, referencia única: lore_vigia7.md) Lo que se puede
// encontrar: las notas (fase A), las fotos de la Noche 6 (fase B) y los patrones y las cintas ocultas (fase C).
// Todo es opcional: el juego se entiende y se termina sin encontrar nada. Se guarda en ExtrasProgreso (lore), aparte
// de la partida; los retos no dan nada.
// Los textos, en idiomas/*.json: lore.<id>_titulo y lore.<id>_texto ([o]…[/o] rodeado a mano, [u]…[/u] subrayado, |
// separa las líneas y, en la nota 1, ¶ empieza el pósit).
// =============================================================

/** Las notas. ruta: el recorrido a pie donde está (Libre3D) o '2d:<sitio>' (una escena 2D); p: dónde (Blender: x, y,
 *  z del centro), n: hacia dónde mira (la normal de la pared, en planta), tam: [ancho, alto] en m; estilo: el aspecto. */
export const NOTAS = [
  // el prólogo («La llegada»): el pasillo oeste, junto a la oficina, y el Hangar donde llegas
  { id: 'n1', ruta: 'prologo', p: [88.43, -55.0, 1.45], n: [1, 0], tam: [0.3, 0.4], estilo: 'turnos' },
  { id: 'n2', ruta: 'prologo', p: [9.82, -5.0, 1.55], n: [-1, 0], tam: [0.32, 0.44], estilo: 'aviso' },
  // la 2.5 (el final de la Noche 2): el Reactor, adonde se va
  { id: 'n3', ruta: 'noche2', p: [20.18, -24.0, 1.4], n: [1, 0], tam: [0.3, 0.4], estilo: 'parte' },
  { id: 'n4', ruta: 'noche2', p: [39.82, -31.5, 1.45], n: [-1, 0], tam: [0.28, 0.36], estilo: 'cuaderno' },
  { id: 'n5', ruta: 'noche2', p: [27.5, -39.82, 1.35], n: [0, 1], tam: [0.2, 0.26], estilo: 'mano' },
  // el inicio de la Noche 4: el pasillo central (por él pasan las dos rutas)
  { id: 'n6', ruta: 'noche4', p: [128.0, -46.38, 1.45], n: [0, 1], tam: [0.3, 0.4], estilo: 'parte' },
  { id: 'n7', ruta: 'noche4', p: [104.0, -43.62, 1.45], n: [0, -1], tam: [0.3, 0.4], estilo: 'parte' },
  // el inicio de la Noche 5: dentro de la taquilla, a la luz de la rendija (escena 2D: Night5Start)
  { id: 'n8', ruta: '2d:taquilla5', rect: { x: 300, y: 300, w: 150, h: 200 }, estilo: 'parte' },
  { id: 'n9', ruta: '2d:taquilla5', rect: { x: 1170, y: 360, w: 120, h: 150 }, estilo: 'mano' },
  // la huida (Noche 7): pintado en la pared del Laboratorio (se ve al empezar la persecución, antes de que reviente)
  { id: 'n10', ruta: 'persecucion', p: [28.0, -66.33, 1.95], n: [0, 1], tam: [2.8, 1.05], estilo: 'pared' },
];

/** (v2.20, fase B) Las fotos del laboratorio en los conductos de la Noche 6 (lore_vigia7.md, apartado 5), cada una cerca
 *  de un fragmento de la mujer: en un tramo (Night6Ducts.TRAMOS) a `s` m de su principio, en la pared izquierda (-1) o
 *  derecha (1), con su centro a `z` m del suelo del conducto. La 9 está al final de los tres tramos que llegan a V4 (solo
 *  se recorre uno). Imagen: assets/lore/fotos/<id>.webp (tools/3d/lore/fotos_lab.py → integrar_fotos.py); lo escrito a
 *  mano lo pinta el juego en cada idioma (lore.<id>_texto, en la zona `escribe` de la imagen, de 0 a 1). `nervio`: lo
 *  que tiembla la letra (las primeras, ordenadas; las últimas, nerviosas). */
export const FOTOS = [
  { id: 'f1', sitios: [['e0', 3.5, -1]], tipo: 'polaroid', nervio: 0 },
  { id: 'f2', sitios: [['e0', 9.5, 1]], tipo: 'polaroid', nervio: 0.05 },
  { id: 'f3', sitios: [['J1A', 2.5, 1]], tipo: 'monitor', nervio: 0.1 },
  { id: 'f4', sitios: [['J2A', 3.0, -1]], tipo: 'radiografia', nervio: 0.3 },
  { id: 'f5', sitios: [['J2D', 3.0, 1]], tipo: 'monitor', nervio: 0.35 },
  { id: 'f6', sitios: [['J1W', 2.5, -1]], tipo: 'polaroid', nervio: 0.5 },
  { id: 'f7', sitios: [['J1D', 1.2, 1]], tipo: 'polaroid', nervio: 0.75 },
  { id: 'f8', sitios: [['J3W', 6.2, -1]], tipo: 'polaroid', nervio: 0.8 },
  { id: 'f9', sitios: [['J4A', 8.0, 1], ['J3D', 8.0, 1], ['J3W', 12.0, 1]], tipo: 'polaroid', nervio: 1 },
];

/** El aspecto de cada estilo al leerlo (Lectura.js). */
export const ESTILOS = {
  turnos: { papel: '#d9d3c0', tinta: '#1f1b16', letra: 'impresa', w: 640, h: 560, posit: true },
  aviso: { papel: '#dcd8cc', tinta: '#1b1a18', letra: 'impresa', w: 680, h: 560, sello: true },
  parte: { papel: '#d6d0bd', tinta: '#22201c', letra: 'impresa', w: 640, h: 540 },
  cuaderno: { papel: '#d8d3c2', tinta: '#1d2a44', letra: 'mano', w: 600, h: 560, rayas: true, arrancada: true },
  mano: { papel: '#cfc6ad', tinta: '#2a2118', letra: 'mano', w: 600, h: 500 },
  pared: { papel: '#2b2e30', tinta: '#8a1a12', letra: 'pared', w: 1100, h: 520 },
};
