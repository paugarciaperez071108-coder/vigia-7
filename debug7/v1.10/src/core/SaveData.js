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

/**
 * v0.82 (pedido del usuario: un solo estado de Slaimi que lean todas las
 * noches y el final). Devuelve { estado: 'vivo' | 'muerto', donde } o null si
 * todavía no lo conoces (antes de la noche 4):
 *   - vivo: lo salvaste en la noche 4 (ruta B) y, si ya pasó la noche 5, lo
 *     metiste en la taquilla;
 *   - muerto, donde 'n5': no lo escondiste en la fuga de la noche 5; su cuerpo
 *     congelado sigue junto al pasillo central (noches 6 y 7);
 *   - muerto, donde 'n4': ruta A o se lo llevaron en el apagón; desde entonces
 *     no aparece en ninguna noche (decisión del usuario).
 * Se calcula a partir de los flags de cada noche (slaimiAliado, slaimiMuerto,
 * slaimiTaquilla, slaimiCongelado), que siguen siendo los que se escriben, y
 * se guarda también en flags.slaimi. Así sirven las partidas de antes.
 */
export function slaimiDe(flags = {}) {
  const f = flags ?? {};
  if (f.slaimiCongelado) return { estado: 'muerto', donde: 'n5' };
  if (f.slaimiMuerto) return { estado: 'muerto', donde: 'n4' };
  if (f.slaimiTaquilla) return { estado: 'vivo', donde: null };
  if (f.slaimiAliado) return f.n5fuga ? { estado: 'muerto', donde: 'n5' } : { estado: 'vivo', donde: null };
  if (f.n4luz || f.n4camaras) return { estado: 'muerto', donde: 'n4' };
  // (sin los flags de cada noche: el que se guardó, p. ej. desde el modo debug)
  const g = f.slaimi;
  if (g && (g.estado === 'vivo' || g.estado === 'muerto')) return { estado: g.estado, donde: g.donde ?? null };
  return null;
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
      flags.slaimi = slaimiDe(flags);
      // (v0.76: se permite una noche más que las que hay: la noche 7 se guarda ya al acabar la 6 y el menú la anuncia)
      return { version: 1, night: Math.min(night, NIGHTS.length + 1), completed: d.completed === true, tapesHeard, checkpoint, flags };
    } catch {
      return null; // JSON roto o almacenamiento no disponible
    }
  },

  save(data) {
    if (data?.flags) data = { ...data, flags: { ...data.flags, slaimi: slaimiDe(data.flags) } };
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
