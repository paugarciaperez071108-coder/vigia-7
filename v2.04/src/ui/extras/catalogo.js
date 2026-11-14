// =============================================================
// catalogo.js — (v1.56) Lo que hay en el menú Extras: personajes, cintas, sustos y retos.
// Para añadir algo nuevo, una línea aquí (y su archivo en assets/).
// =============================================================

// --- Personajes (las fichas: src/ui/extras/Personajes.js) ---
export const PERSONAJES = [
  { id: 'frozen', nombre: 'El Congelado' },
  { id: 'specimen', nombre: 'El Espécimen' },
  { id: 'largo', nombre: 'El Largo' },
  { id: 'insecto', nombre: 'El Insecto' },
  { id: 'errante', nombre: 'El Errante' },
  { id: 'dislocado', nombre: 'El Dislocado' },
  { id: 'slaimi', nombre: 'Slaimi', aliado: true },
  { id: 'aberracion', nombre: 'La Aberración', bloqueo: 'aberracion' },   // hasta completar la Noche 7
];

// --- Cintas: id (el de CONFIG.TAPES o 'n6_N'), noche, ruta/momento, quién habla, el audio y sus subtítulos ---
const C = 'assets/audio/cintas/';
export const CINTAS = [
  { id: '1', noche: 1, que: 'Bienvenida', voz: 'hombre', base: C + 'noche1' },
  { id: '2', noche: 2, que: 'El turno', voz: 'hombre', base: C + 'noche2' },
  { id: 'mujer', noche: 2, que: 'La 2.5', voz: 'mujer', base: C + 'mujer_noche2' },
  { id: '3', noche: 3, que: 'El turno', voz: 'hombre', base: C + 'noche3' },
  { id: '3_5', noche: 3, que: '3 AM (cinta 3.5)', voz: 'hombre', base: C + 'noche3_5' },
  { id: '4', noche: 4, que: 'Inicio', voz: 'hombre', base: C + 'noche4', siExiste: true },   // (la está grabando el usuario)
  { id: '4A', noche: 4, que: 'Ruta A – el panel', voz: 'hombre', base: C + 'noche4_rutaA' },
  { id: '4B', noche: 4, que: 'Ruta B', voz: 'mujer', base: C + 'mujer_noche4' },
  { id: '5', noche: 5, que: 'El turno', voz: 'hombre', base: C + 'noche5' },
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: `n6_${n}`, noche: 6, que: `Los conductos – ${n}/7`, voz: 'mujer', base: C + `conductos_n6/frag_${n}`, frag: n })),
  { id: '7', noche: 7, que: 'La última cinta', voz: 'hombre', base: C + 'noche7' },
];

// --- Jumpscares (src/ui/extras/Sustos.js): id = el del atacante en el juego ---
export const SUSTOS = [
  { id: 'specimen', nombre: 'El Espécimen' },
  { id: 'frozen', nombre: 'El Congelado' },
  { id: 'largo', nombre: 'El Largo' },
  { id: 'insecto', nombre: 'El Insecto' },
  { id: 'errante', nombre: 'El Errante' },
  { id: 'dislocado', nombre: 'El Dislocado' },
  { id: 'aberracion', nombre: 'La Aberración', bloqueo: 'aberracion' },
];

// --- Retos (todavía no hay: «MÓDULO EN DESARROLLO») ---
// Cada reto: { id, nombre, texto, cumplido: (progreso) => bool }. Se guardan en ExtrasProgreso.retos.
export const RETOS = [];
