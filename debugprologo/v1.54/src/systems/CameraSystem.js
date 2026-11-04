// =============================================================
// CameraSystem.js — Monitor de cámaras.
//
// Estado:
//   open     → el jugador ha subido el monitor (gasta 1 barra).
//   anim     → 0 = bajado, 1 = subido del todo (animación).
//   active   → id de la sala que se está viendo.
//   switchStatic → segundos de estática fuerte tras cambiar de cámara.
//   mapMode  → 'main' (salas de la nave) o 'vent' (conductos). Se
//              cambia con el botón TOGGLE (noches con conductos). Cada
//              mapa recuerda su última cámara.
//   ventsUnlocked → las cámaras de ventilación tienen señal (tras
//              escribir get-update en la consola).
//
// isWatching(room) es la consulta clave para la IA de la fase 3:
// solo cuenta como "mirando" cuando el monitor está subido DEL
// TODO y la estática del cambio de cámara ya ha pasado. Así, cambiar
// de cámara a toda velocidad no sirve para congelar a nadie.
// =============================================================

import { CONFIG } from '../config.js';
import { isVent } from '../world/StationMap.js';

const ANIM_TIME = CONFIG.MONITOR_ANIM_TIME;
const SWITCH_STATIC = CONFIG.CAMERA_SWITCH_STATIC;

export class CameraSystem {
  constructor(events) {
    this.events = events;
    this.reset();
  }

  reset() {
    this.open = false;
    this.anim = 0;
    this.active = 'hangar';
    this.switchStatic = 0;
    this.enabled = true;
    this.hasVents = false;
    this.hasLure = false;     // botón GOLPES METÁLICOS (El Largo en las cámaras)
    this.ventsUnlocked = false;
    this.mapMode = 'main';
    this.lastMain = 'hangar';
    this.lastVent = 'v1';
    // Noche 3, evento de las 3 AM (Night3Events.js): cámaras rotas (sin
    // imagen ni audio hasta el final de la noche), las que se están
    // rompiendo ahora mismo y los triángulos ⚠ del minimapa
    this.broken = new Set();
    this.breaking = {};
    this.warnings = false;
  }

  /** Cambia entre el mapa de salas y el de ventilación. */
  toggleMap() {
    if (!this.open || !this.hasVents) return false;
    if (this.mapMode === 'main') {
      this.lastMain = this.active;
      this.mapMode = 'vent';
      this.active = this.lastVent;
    } else {
      this.lastVent = this.active;
      this.mapMode = 'main';
      this.active = this.lastMain;
    }
    this.switchStatic = SWITCH_STATIC;
    this.events.emit('camSwitch', this.active);
    return true;
  }

  /** ¿Se ve con señal la cámara activa? (las de ventilación necesitan get-update) */
  get signal() {
    return !isVent(this.active) || this.ventsUnlocked;
  }

  toggle() {
    if (!this.enabled) return;
    this.open = !this.open;
    if (this.open) this.switchStatic = SWITCH_STATIC;
    this.events.emit('monitor', { open: this.open });
  }

  /** Baja el monitor a la fuerza (apagón, susto...). */
  forceClose() {
    if (this.open) {
      this.open = false;
      this.events.emit('monitor', { open: false });
    }
  }

  select(roomId) {
    if (!this.open || roomId === this.active) return;
    this.active = roomId;
    this.switchStatic = SWITCH_STATIC;
    this.events.emit('camSwitch', roomId);
  }

  /** Apagón de la oficina: monitor bajado e inutilizable (o restaurado). */
  setEnabled(on) {
    if (!on) this.forceClose();
    this.enabled = on;
  }

  /**
   * Si el jugador está viendo alguna de esas salas, la imagen se llena
   * de estática durante `seconds`: así sabe que algo se ha movido.
   */
  glitchIfWatching(rooms, seconds) {
    if (this.open && rooms.includes(this.active)) {
      this.switchStatic = Math.max(this.switchStatic, seconds);
    }
  }

  update(dt) {
    const target = this.open ? 1 : 0;
    const step = dt / ANIM_TIME;
    this.anim += Math.sign(target - this.anim) * Math.min(step, Math.abs(target - this.anim));
    this.switchStatic = Math.max(0, this.switchStatic - dt);
  }

  /** ¿Se está viendo con claridad la imagen de una sala? */
  isWatching(roomId) {
    return this.open && this.anim >= 1 && this.switchStatic <= 0 && this.signal && this.active === roomId;
  }

  /** ¿Se ve el monitor completo (para dibujar la imagen de cámara)? */
  get fullyOpen() {
    return this.anim >= 1;
  }
}
