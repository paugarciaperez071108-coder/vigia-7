// =============================================================
// SaveData.js — Guardado del progreso.
//
// Vigía-7 es un juego web: su "carpeta de datos de usuario" es el
// almacenamiento local del navegador (localStorage), que se conserva
// al cerrar y volver a abrir el juego. La partida se guarda ahí como
// un JSON bajo la clave SAVE_KEY:
//
//   { "version": 1,
//     "night": 2,                  ← noche a la que lleva "Continue"
//     "completed": false,          ← true si ya superó la última noche
//     "tapesHeard": { "1": true }, ← cintas escuchadas enteras
//     "checkpoint": "n2final",     ← punto de control: Continue va al
//                                    final de la noche 2 (6 AM), no al
//                                    principio de la noche
//     "flags": {                   ← cosas que pasan y se recuerdan
//       "pasilloAbierto": true,    ←   el pasillo sellado de la oficina
//                                      se abrió (final de la noche 2)
//       "grabadoraHombre": true }, ←   encontró la grabadora del hombre
//                                      en el reactor (PUNTO DE LORE)
//     "savedAt": "2026-10-13T21:50:00.000Z" }
//
// Si el guardado no existe o está dañado, load() devuelve null y el
// juego se comporta como si no hubiera partida (nunca falla).
// =============================================================

import { NIGHTS } from '../night/nights.js';

const SAVE_KEY = 'vigia7.partida';

/** Lo que se puede guardar en flags: true, texto, número, listas y objetos (nunca false ni null). */
function flagValida(v) {
  if (v === true || typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v))) return true;
  return typeof v === 'object' && v !== null;
}

// v0.82 (pedido del usuario): un solo estado de Slaimi que lean todas las noches y el final:
//   - vivo: lo salvaste en la noche 4 (ruta B) y, si ya pasó la noche 5, lo metiste en la taquilla;
//   - muerto en la noche 5: no lo escondiste en la fuga; su cuerpo congelado sigue junto al pasillo
//     central (noches 6 y 7);
//   - muerto en la noche 4: ruta A (no se repararon las cámaras); desde entonces no aparece.
// (v1.11, el usuario: «revisa que el estado de Slaimi sale de un único dato guardado y que la causa
// es coherente») UN SOLO DATO: flags.slaimi = { v: 2, estado, donde, causa }. Solo lo escribe
// ponSlaimi() (en los momentos de la historia y en el modo debug). Los flags sueltos de antes
// (slaimiAliado, slaimiTaquilla, slaimiMuerto, slaimiCongelado) se REESCRIBEN desde él, así que
// nunca pueden decir otra cosa; solo se leen una vez para convertir las partidas viejas.
export const SLAIMI_CAUSAS = {
  aliado: { estado: 'vivo', donde: null, texto: 'vivo (lo salvaste en la noche 4)' },
  salvado: { estado: 'vivo', donde: null, texto: 'vivo (escondido en la taquilla en la noche 5)' },
  n4: { estado: 'muerto', donde: 'n4', texto: 'muerto en la noche 4 (no se repararon las cámaras): no aparece' },
  n5: { estado: 'muerto', donde: 'n5', texto: 'muerto en la noche 5 (congelado en la fuga)' },
};

/** Los flags de antes, desde el dato único (para que el código que aún los lee diga lo mismo). */
function legado(f, causa) {
  for (const k of ['slaimiAliado', 'slaimiTaquilla', 'slaimiMuerto', 'slaimiCongelado']) delete f[k];
  if (causa === 'aliado') f.slaimiAliado = true;
  if (causa === 'salvado') { f.slaimiAliado = true; f.slaimiTaquilla = true; }
  if (causa === 'n4') f.slaimiMuerto = true;
  if (causa === 'n5') f.slaimiCongelado = true;
}

/** Fija el estado de Slaimi (causa: 'aliado' | 'salvado' | 'n4' | 'n5' | null = aún no le conoces). */
export function ponSlaimi(flags, causa) {
  const c = SLAIMI_CAUSAS[causa];
  if (!c) {
    delete flags.slaimi;
    legado(flags, null);
    return flags;
  }
  flags.slaimi = { v: 2, estado: c.estado, donde: c.donde, causa };
  legado(flags, causa);
  return flags;
}

/** La causa sacada de los flags de las partidas de antes de la v1.11 (solo para convertirlas). */
function causaVieja(f) {
  if (f.slaimiCongelado) return 'n5';
  if (f.slaimiMuerto) return 'n4';
  if (f.slaimiTaquilla) return 'salvado';
  if (f.slaimiAliado) return f.n5fuga ? 'n5' : 'aliado';
  if (f.n4luz) return 'n4';
  if (f.n4camaras) return f.n5fuga ? 'n5' : 'aliado';
  const g = f.slaimi;
  if (g?.estado === 'vivo') return 'aliado';
  if (g?.estado === 'muerto') return g.donde === 'n5' ? 'n5' : 'n4';
  return null;
}

/**
 * Estado de Slaimi: { estado: 'vivo' | 'muerto', donde: 'n4' | 'n5' | null, causa, texto } o null si
 * todavía no lo conoces (antes de la noche 4). Lee SOLO flags.slaimi; las partidas viejas se convierten.
 */
export function slaimiDe(flags = {}) {
  const f = flags ?? {};
  const causa = f.slaimi?.v === 2 ? f.slaimi.causa : causaVieja(f);
  const c = SLAIMI_CAUSAS[causa];
  return c ? { estado: c.estado, donde: c.donde, causa, texto: c.texto } : null;
}

/** Convierte (una vez) una partida vieja al dato único; las nuevas no cambian. */
export function normalizaSlaimi(flags) {
  if (flags?.slaimi?.v === 2) legado(flags, flags.slaimi.causa);
  else ponSlaimi(flags, causaVieja(flags ?? {}));
  return flags;
}

export const SaveData = {
  /** Partida guardada o null si no hay / está dañada. */
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      const night = Math.floor(Number(d?.night));
      if (!Number.isFinite(night) || night < 1) return null;
      const tapesHeard = {};
      if (d.tapesHeard && typeof d.tapesHeard === 'object') {
        for (const [k, v] of Object.entries(d.tapesHeard)) if (v === true) tapesHeard[k] = true;
      }
      const checkpoint = typeof d.checkpoint === 'string' ? d.checkpoint : null;
      const flags = {};
      if (d.flags && typeof d.flags === 'object') {
        // v0.82: antes solo se quedaban las que valían true, y los datos de la noche 6
        // (n6cadaveres, n6vistos, n6lenteRota, n6salas) se perdían al cargar
        for (const [k, v] of Object.entries(d.flags)) if (flagValida(v)) flags[k] = v;
      }
      normalizaSlaimi(flags);
      // (v0.76: se permite una noche más que las que hay: la noche 7 se guarda ya al acabar la 6 y el menú la anuncia)
      return { version: 1, night: Math.min(night, NIGHTS.length + 1), completed: d.completed === true, tapesHeard, checkpoint, flags };
    } catch {
      return null; // JSON roto o almacenamiento no disponible
    }
  },

  save(data) {
    if (data?.flags) data = { ...data, flags: normalizaSlaimi({ ...data.flags }) };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, version: 1, savedAt: new Date().toISOString() }));
    } catch {
      // Sin almacenamiento (modo privado estricto...): se juega sin guardar.
    }
  },

  clear() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {}
  },

  /** Partida nueva: noche 1, sin cintas escuchadas. */
  fresh() {
    return { night: 1, completed: false, tapesHeard: {}, flags: {} };
  },
};
