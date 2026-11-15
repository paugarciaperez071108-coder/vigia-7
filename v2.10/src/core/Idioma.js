// =============================================================
// Idioma.js — (v1.92) Los textos del juego, en varios idiomas.
//
// Cada idioma es un archivo en programa/idiomas/ (es.json, en.json) con UNA CLAVE POR TEXTO
// (agrupadas por apartado: «menu.sin_partida», «avisos.apagon»…). En el código no se escribe
// ningún texto: se pide con dice('clave').
//
//   dice('hud.noche', { n: 3 }) → «Noche 3» / «Night 3»   (los huecos van como {n} en el archivo)
//   dice('crt.arranque')        → si el valor es una lista, devuelve la lista
//
// - El español es el idioma base. Si en el otro idioma falta una clave, sale el texto en español
//   y, en los modos de prueba (?debug, ?n4debug, ?novedades, ?prueba), se avisa en la consola.
// - El idioma elegido se guarda APARTE de la partida (localStorage 'vigia7.idioma'): «New Game»
//   no lo borra. `?idioma=en` (o es) lo fuerza para esa vez, sin guardarlo.
// - Se cambia al momento (Idioma.pon): casi todo el texto se pide en cada fotograma. Por eso
//   dice() NUNCA se llama al cargar un módulo (fuera de una función): se llama al dibujar o al decir.
// - En los modos de prueba: F2 cambia de idioma y `Idioma.faltan()` en la consola dice qué claves
//   no están traducidas.
// =============================================================

const KEY = 'vigia7.idioma';
const BASE = 'es';

/** Los idiomas que hay (el nombre, tal como se escribe en ese idioma). */
export const IDIOMAS = [
  { id: 'es', nombre: 'Español' },
  { id: 'en', nombre: 'English' },
];

const textos = { es: {}, en: {} };
// Los subtítulos de las cintas en los otros idiomas (idiomas/subtitulos_<id>.json): { cinta: [una línea por frase] }.
// En español salen del .json de cada audio (con sus tiempos), que es de donde se sacan también los tiempos.
const subs = {};
const avisadas = new Set();
const oyentes = new Set();
let actual = BASE;
let elegido = false;
let cargado = false;
let marca = false;           // (v1.94, debug del idioma) lo que sale en español por faltar, con «⟦ES⟧» delante
const MARCA = '⟦ES⟧ ';
const PRUEBAS = typeof location !== 'undefined' && /[?&](debug|n4debug|novedades|prueba)=/.test(location.search);

/** { menu: { a: 'x' } } → { 'menu.a': 'x' } (las listas se quedan como listas). */
function aplana(o, pre, out) {
  for (const [k, v] of Object.entries(o)) {
    if (k.startsWith('_')) continue;            // (_nota…: comentarios del archivo)
    const clave = pre ? `${pre}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) aplana(v, clave, out);
    else out[clave] = v;
  }
  return out;
}

const valido = (id) => IDIOMAS.some((i) => i.id === id);

function rellena(texto, v) {
  if (!v || typeof texto !== 'string') return texto;
  return texto.replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined ? String(v[k]) : m));
}

/**
 * El texto de una clave en el idioma actual. Los huecos {nombre} se rellenan con `v`.
 * Si falta en el idioma actual, el español; si tampoco está, la propia clave (para verla y arreglarla).
 */
export function dice(clave, v) {
  let s = textos[actual][clave];
  if (s === undefined) {
    if (actual !== BASE && cargado && !avisadas.has(`${actual}:${clave}`)) {
      avisadas.add(`${actual}:${clave}`);
      if (PRUEBAS) console.warn(`[idioma] falta en «${actual}»: ${clave}`);
    }
    s = textos[BASE][clave];
    if (marca && actual !== BASE && typeof s === 'string') s = MARCA + s;
  }
  if (s === undefined) {
    if (cargado && !avisadas.has(`?:${clave}`)) {
      avisadas.add(`?:${clave}`);
      console.warn(`[idioma] clave sin texto: ${clave}`);
    }
    return clave;
  }
  if (Array.isArray(s)) return v ? s.map((x) => rellena(x, v)) : s;
  return rellena(s, v);
}

/**
 * El subtítulo de una frase de una cinta en el idioma actual. Las voces están en español: en español se devuelve
 * la frase tal cual (textoEs); en otro idioma, la línea `i` de esa cinta en idiomas/subtitulos_<id>.json (va a
 * tiempo con el audio porque usa los tiempos de la frase española). Si falta, la española.
 */
export function subtitulo(cinta, i, textoEs) {
  if (actual === BASE || cinta == null) return textoEs;
  const s = subs[actual]?.[cinta]?.[i];
  if (typeof s === 'string') return s;
  if (cargado && !avisadas.has(`sub:${actual}:${cinta}:${i}`)) {
    avisadas.add(`sub:${actual}:${cinta}:${i}`);
    if (PRUEBAS) console.warn(`[idioma] subtítulo sin traducir en «${actual}»: ${cinta} #${i}`);
  }
  return marca ? MARCA + textoEs : textoEs;
}

/** ¿Existe la clave (en el idioma actual o en español)? */
export const hayTexto = (clave) => textos[actual][clave] !== undefined || textos[BASE][clave] !== undefined;

export const Idioma = {
  /** Lee los archivos de idioma y lo que eligió el jugador. Se espera ANTES de arrancar el juego. */
  async carga() {
    await Promise.all(IDIOMAS.map(async ({ id }) => {
      try {
        const r = await fetch(`idiomas/${id}.json`, { cache: 'no-cache' });
        textos[id] = aplana(await r.json(), '', {});
      } catch (e) {
        console.warn(`[idioma] no se pudo leer idiomas/${id}.json`, e);
      }
    }));
    await Promise.all(IDIOMAS.filter((i) => i.id !== BASE).map(async ({ id }) => {
      try {
        const r = await fetch(`idiomas/subtitulos_${id}.json`, { cache: 'no-cache' });
        if (r.ok) subs[id] = await r.json();
      } catch (e) {
        console.warn(`[idioma] no se pudo leer idiomas/subtitulos_${id}.json`, e);
      }
    }));
    cargado = true;
    let guardado = null;
    try { guardado = localStorage.getItem(KEY); } catch { /* sin almacenamiento */ }
    if (valido(guardado)) { actual = guardado; elegido = true; }
    const forzado = new URLSearchParams(location.search).get('idioma');
    if (valido(forzado)) { actual = forzado; elegido = true; }
    document.documentElement.lang = actual;
    if (PRUEBAS) {
      window.Idioma = Idioma;
      window.addEventListener('keydown', (e) => {
        if (e.code !== 'F2') return;
        e.preventDefault();
        Idioma.siguiente(false);
        console.info(`[idioma] ${actual}`);
      });
    }
  },

  actual() { return actual; },
  /** ¿Ya se eligió alguna vez? (si no, sale el selector al abrir el juego) */
  elegido() { return elegido; },
  nombre(id = actual) { return IDIOMAS.find((i) => i.id === id)?.nombre ?? id; },

  /** Cambia de idioma al momento. guarda = false: solo para esta vez (pruebas). */
  pon(id, guarda = true) {
    if (!valido(id)) return;
    actual = id;
    document.documentElement.lang = id;
    if (guarda) {
      elegido = true;
      try { localStorage.setItem(KEY, id); } catch { /* sin almacenamiento */ }
    }
    for (const f of oyentes) { try { f(id); } catch (e) { console.warn(e); } }
  },

  /** El idioma siguiente de la lista (Opciones y F2 en las pruebas). */
  siguiente(guarda = true) {
    const i = IDIOMAS.findIndex((x) => x.id === actual);
    this.pon(IDIOMAS[(i + 1) % IDIOMAS.length].id, guarda);
  },

  /** (debug del idioma, v1.94) Marca con «⟦ES⟧» lo que sale en español porque falta en el idioma actual. */
  marca(si = !marca) { marca = !!si; for (const f of oyentes) { try { f(actual); } catch (e) { console.warn(e); } } return marca; },
  marcando() { return marca; },
  /** El prefijo de lo marcado (para los textos que no salen de dice: los de Extras). */
  MARCA,

  /** Avisa cuando cambia el idioma (para lo poco que no se pide en cada fotograma). */
  alCambiar(f) { oyentes.add(f); return () => oyentes.delete(f); },

  /** (pruebas) Las claves que están en español y no en `id`, y las que sobran. */
  faltan(id = 'en') {
    const base = Object.keys(textos[BASE]);
    const otro = textos[id] ?? {};
    return {
      faltan: base.filter((k) => otro[k] === undefined),
      sobran: Object.keys(otro).filter((k) => textos[BASE][k] === undefined),
      iguales: base.filter((k) => typeof otro[k] === 'string' && otro[k] === textos[BASE][k]),
    };
  },
};
