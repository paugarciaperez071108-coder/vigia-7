// =============================================================
// Ofuscado.js — (v1.81) El audio publicado va con extensión propia y ofuscado (el usuario, 2026-11-11: «el audio con
// extensión y ofuscación como pide Camellia… todo el audio»; lo hace ofuscar_audio.py al publicar). Se carga el
// PRIMERO (main.js) y lo resuelve para TODO el juego sin tocar a nadie:
//   - fetch('assets/audio/…/x.ogg') → pide x.v7o y devuelve los bytes de verdad (decodeAudioData, HEAD, etc.);
//   - new Audio(url) y el.src = url (cintas, música, grabaciones) → lo mismo, como blob en memoria.
// Si no existe assets/audio/ofuscado.json (programa/ con servidor.py: los .ogg de siempre) no hace nada.
// =============================================================

const EXT = { '.ogg': '.v7o', '.mp3': '.v7m', '.wav': '.v7w', '.m4a': '.v7k' };
const TIPO = { '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4' };
const CABECERA = 'V7A1';
// (la misma clave que ofuscar_audio.py: sha256 de 'VIGIA-7/rewap-studios/audio/v1')
const CLAVE = Uint8Array.from('2585b21829d9d630afbe12797471bcf7dbf6e8eea6bc5870189ee93099f0a02b'.match(/../g), (h) => parseInt(h, 16));

const fetch0 = window.fetch.bind(window);
const listo = fetch0('assets/audio/ofuscado.json', { cache: 'no-store' }).then((r) => r.ok).catch(() => false);

/** ¿Es un audio del juego? → { ofuscada, ext } (la ruta con la extensión propia). */
function audio(url) {
  if (typeof url !== 'string' || url.startsWith('blob:') || url.startsWith('data:')) return null;
  const limpia = url.split(/[?#]/)[0];
  if (!/(^|\/)assets\/audio\//.test(limpia)) return null;
  const m = limpia.match(/\.(ogg|mp3|wav|m4a)$/i);
  if (!m) return null;
  const ext = `.${m[1].toLowerCase()}`;
  return { ofuscada: limpia.slice(0, -ext.length) + EXT[ext], ext };
}

function descifra(buf) {
  const a = new Uint8Array(buf);
  if (String.fromCharCode(a[0], a[1], a[2], a[3]) !== CABECERA) return buf;
  const out = new Uint8Array(a.length - 4);
  const k = CLAVE.length;
  for (let i = 0; i < out.length; i++) out[i] = a[i + 4] ^ CLAVE[i % k] ^ ((i * 31 + 7) & 0xff);
  return out.buffer;
}

window.fetch = async function fetchV7(entrada, opciones) {
  const url = typeof entrada === 'string' ? entrada : entrada?.url;
  const a = audio(url);
  if (!a || !(await listo)) return fetch0(entrada, opciones);
  const r = await fetch0(a.ofuscada, opciones);
  if (!r.ok || (opciones?.method ?? 'GET').toUpperCase() === 'HEAD') return r;
  return new Response(descifra(await r.arrayBuffer()), { status: 200, headers: { 'Content-Type': TIPO[a.ext] } });
};

// --- los elementos <audio> (new Audio(url), el.src = url) ---
// Sin ofuscar (programa/): el src de siempre, al momento. Ofuscado: el src de verdad (un blob) llega un poco después;
// mientras, play() espera a que esté (y un pause() lo anula) y el currentTime pedido se aplica al cargar.
let OFUSCADO = null;
listo.then((v) => { OFUSCADO = v; });
const SRC = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
const TIEMPO = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');
const play0 = HTMLMediaElement.prototype.play;
const pause0 = HTMLMediaElement.prototype.pause;
Object.defineProperty(HTMLMediaElement.prototype, 'src', {
  configurable: true,
  enumerable: SRC.enumerable,
  get() { return this._v7src ?? SRC.get.call(this); },
  set(v) {
    const a = audio(String(v));
    if (!a || OFUSCADO === false) {
      this._v7src = undefined;
      this._v7listo = null;
      SRC.set.call(this, v);
      return;
    }
    // (lo que se lee de el.src es la ruta de siempre, como sin ofuscar)
    this._v7src = new URL(String(v), document.baseURI).href;
    const pedido = {};
    this._v7pedido = pedido;
    const pon = (real) => {
      if (this._v7pedido !== pedido) return;
      SRC.set.call(this, real);
      if (this._v7t != null) {
        const t = this._v7t;
        this._v7t = null;
        this.addEventListener('loadedmetadata', () => { try { TIEMPO.set.call(this, t); } catch (e) { /* (fuera de rango) */ } }, { once: true });
      }
    };
    this._v7listo = listo.then(async (ok) => {
      if (!ok) return pon(v);
      try {
        const r = await window.fetch(String(v));
        if (!r.ok) throw new Error(r.status);
        pon(URL.createObjectURL(await r.blob()));
      } catch (e) {
        pon(v);   // (no está: que falle como siempre, con su evento de error)
      }
    }).finally(() => { if (this._v7pedido === pedido) this._v7listo = null; });
  },
});
Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
  configurable: true,
  enumerable: TIEMPO.enumerable,
  get() { return this._v7listo && this._v7t != null ? this._v7t : TIEMPO.get.call(this); },
  set(t) {
    if (this._v7listo) this._v7t = t;
    else TIEMPO.set.call(this, t);
  },
});
HTMLMediaElement.prototype.play = function playV7() {
  if (!this._v7listo) return play0.call(this);
  const tk = {};
  this._v7tk = tk;
  return this._v7listo.then(() => (this._v7tk === tk ? play0.call(this) : undefined));
};
HTMLMediaElement.prototype.pause = function pauseV7() {
  this._v7tk = null;
  return pause0.call(this);
};
const Audio0 = window.Audio;
function AudioV7(src) {
  const el = new Audio0();
  if (src !== undefined) el.src = src;
  return el;
}
AudioV7.prototype = Audio0.prototype;
window.Audio = AudioV7;

export const audioOfuscado = listo;
