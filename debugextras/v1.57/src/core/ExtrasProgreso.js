// =============================================================
// ExtrasProgreso.js — (v1.56) Lo que desbloquea el menú Extras, guardado APARTE de la partida
// (localStorage 'vigia7.extras'): «New Game» no lo borra.
//
//   extras       se ha completado la Noche 5 (el botón Extras del menú)
//   n6           se ha completado la Noche 6 (las fichas añaden el «6»)
//   aberracion   se ha completado la Noche 7 (su ficha y su susto; las fichas añaden el «7»)
//   volSustos    { vol, mudo } el volumen del apartado Jumpscares
//   avisado      ya salió el aviso «EXTRAS DESBLOQUEADO»
//   cintas       { id: true }  las cintas que han empezado a sonar en el juego
//   sustos       { id: true }  los jumpscares que han salido en el juego
//   retos        { id: … }     preparado para los retos (todavía no hay)
//
// En el modo debug (N4Debug) va solo en memoria: la partida de verdad no se toca.
// =============================================================

const KEY = 'vigia7.extras';
const vacio = () => ({ v: 1, extras: false, n6: false, aberracion: false, avisado: false, importado: false, cintas: {}, sustos: {}, retos: {}, volSustos: { vol: 0.8, mudo: false } });

let datos = null;
let soloMemoria = false;
let slaimiDbg = null;       // (debug) 'vivo' | 'muerto' | 'sinver': sin mirar la partida

function carga() {
  if (datos) return datos;
  datos = vacio();
  try {
    const raw = soloMemoria ? null : localStorage.getItem(KEY);
    const d = raw ? JSON.parse(raw) : null;
    if (d && typeof d === 'object') {
      datos = { ...vacio(), ...d, cintas: { ...(d.cintas ?? {}) }, sustos: { ...(d.sustos ?? {}) }, retos: { ...(d.retos ?? {}) } };
    }
  } catch { /* sin almacenamiento: empieza vacío */ }
  return datos;
}

function guarda() {
  if (soloMemoria) return;
  try { localStorage.setItem(KEY, JSON.stringify(datos)); } catch { /* sin almacenamiento */ }
}

// Las cintas que suenan solas al empezar cada noche (para rellenar desde una partida ya empezada)
const CINTAS_DE_NOCHE = { 1: ['1'], 2: ['2', 'mujer'], 3: ['3', '3_5'], 4: [], 5: ['5'], 6: [], 7: ['7'] };

export const ExtrasProgreso = {
  /** (debug) A partir de aquí, solo en memoria (empieza con una copia de lo guardado). */
  soloEnMemoria() {
    carga();
    datos = JSON.parse(JSON.stringify(datos));
    soloMemoria = true;
  },

  datos() { return carga(); },
  extras() { return !!carga().extras; },
  aberracion() { return !!carga().aberracion; },
  n6() { return !!carga().n6 || !!carga().aberracion; },
  retoHecho(id) { return !!carga().retos[id]; },
  completaReto(id) { carga().retos[id] = true; guarda(); },
  nivelesPersonal() {
    const d = carga();
    d.personal ??= { frozen: 10, specimen: 10, largo: 10, insecto: 10, errante: 10, dislocado: 10 };
    return d.personal;
  },
  ponNivelPersonal(k, n) { this.nivelesPersonal()[k] = n; guarda(); },
  volSustos() { return carga().volSustos; },
  ponVolSustos(v) { carga().volSustos = v; guarda(); },
  slaimiDebug() { return slaimiDbg; },
  ponSlaimiDebug(e) { slaimiDbg = e; },
  cintaOida(id) { return !!carga().cintas[String(id)]; },
  sustoVisto(id) { return !!carga().sustos[String(id)]; },

  /** Se ha completado la Noche 5 ('extras'), la 6 ('n6') o la 7 ('aberracion'). */
  desbloquea(que) {
    const d = carga();
    if (que === 'n6') d.n6 = true;
    if (que === 'aberracion') { d.n6 = true; d.aberracion = true; }
    if (!d.extras) d.avisado = false;
    d.extras = true;
    guarda();
  },

  oyeCinta(id) {
    const d = carga();
    if (d.cintas[String(id)]) return;
    d.cintas[String(id)] = true;
    guarda();
  },

  veSusto(id) {
    const d = carga();
    if (!id || d.sustos[String(id)]) return;
    d.sustos[String(id)] = true;
    guarda();
  },

  /** El aviso «EXTRAS DESBLOQUEADO»: true una sola vez, la primera vez que se vuelve al menú. */
  tocaAviso() {
    const d = carga();
    if (!d.extras || d.avisado) return false;
    d.avisado = true;
    guarda();
    return true;
  },

  /**
   * La primera vez, con una partida ya empezada de antes de Extras: si va por la noche 6 o más,
   * Extras desbloqueado; las cintas de las noches ya pasadas, oídas. (Los sustos no se pueden saber.)
   */
  importa(save) {
    const d = carga();
    if (d.importado) return;
    d.importado = true;
    const n = save?.night ?? 0;
    if (n >= 6) { d.extras = true; d.avisado = true; }
    if (n >= 7) d.n6 = true;
    for (let k = 1; k < Math.min(n, 8); k++) for (const id of CINTAS_DE_NOCHE[k] ?? []) d.cintas[id] = true;
    for (const [k, v] of Object.entries(save?.tapesHeard ?? {})) if (v) d.cintas[k] = true;
    guarda();
  },

  // --- debug ---
  todo(cintas = [], sustos = []) {
    const d = carga();
    Object.assign(d, { extras: true, n6: true, aberracion: true, avisado: true });
    for (const id of cintas) d.cintas[id] = true;
    for (const id of sustos) d.sustos[id] = true;
    guarda();
  },
  bloquea() {
    const d = carga();
    Object.assign(d, { extras: false, n6: false, aberracion: false, avisado: false, cintas: {}, sustos: {}, retos: {} });
    guarda();
  },
  resetea() {
    datos = { ...vacio(), importado: true };
    guarda();
  },
};
