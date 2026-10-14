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
//     "savedAt": "2026-10-13T21:50:00.000Z" }
//
// Si el guardado no existe o está dañado, load() devuelve null y el
// juego se comporta como si no hubiera partida (nunca falla).
// =============================================================

import { NIGHTS } from '../night/nights.js';

const SAVE_KEY = 'vigia7.partida';

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
      return { version: 1, night: Math.min(night, NIGHTS.length), completed: d.completed === true, tapesHeard };
    } catch {
      return null; // JSON roto o almacenamiento no disponible
    }
  },

  save(data) {
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
    return { night: 1, completed: false, tapesHeard: {} };
  },
};
