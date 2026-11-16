// =============================================================
// PasilloN7.js — (v2.12, el usuario: «en la Noche 7 la parte de la consola se va destrozando con las horas, pero el
// pasillo central se queda casi intacto. Al girarse, parece otra nave») EL PASILLO CENTRAL QUE SE DESTROZA, por etapas,
// a las mismas horas que la oficina (OficinaV2: 4am, 430, 5am, final). Renders de tools/3d/salas/pasillo_n7.py (la
// MISMA escena y cámara que la oficina única) → integrar_pasillo_n7.py → assets/salas/unica/pasillo/n7/ (indice.json).
//
//   4:00   la 1.ª lámpara parpadea (su luz se SUMA a ratos); la 2.ª, descolgada, se balancea (con la linterna);
//          un panel del techo suelto
//   4:30   en el mismo fogonazo que la oficina, cae el panel (animado, crujido y golpe); cables con chispas, una tubería
//          reventada con vapor, escombros junto a las paredes
//   5:00   el resplandor del fuego al fondo (se SUMA, en bucle), humo bajo el techo, cae parte del techo (animado)
//   rastro con el rugido de la Aberración (tras la muerte de El Dislocado) o con el estado final (5:35): arañazos
//          enormes en las paredes y el marco de la compuerta abollado desde fuera
// Cada estado es una capa con solo lo que cambia, encima del pasillo de siempre (oscuro.webp / luz.webp). Lo que se
// mueve va en bucle. Nada tapa el centro por debajo de 2,4 m; lo que está más cerca que la Aberración se pinta
// encima de ella (drawLuzDelante) y lo de detrás, debajo; sus renders de cada estado ya llevan los daños delante.
// Los sonidos (chispas, vapor, el crujido del techo, el metal al caer, el fuego) suenan desde el pasillo central.
// =============================================================

import { placeOf } from '../audio/Spatial.js';

const RUTA = 'assets/salas/unica/pasillo/n7/';
const ORDEN = ['4am', '430', '5am'];
// La distancia de la Aberración a la compuerta en cada posición (aberracion_n7.py: 34, 25, 17,5, 11,5, 8 y 6 m desde
// la cámara, que está a 5 m de la compuerta); p5 = en la compuerta
const DIST_AB = [29, 20, 12.5, 6.5, 3, 1];
const IMGS = {};
let IND = null;
fetch(`${RUTA}indice.json`).then((r) => (r.ok ? r.json() : null)).then((j) => { IND = j; }).catch(() => {});

function img(nombre) {
  if (!nombre) return null;
  let i = IMGS[nombre];
  if (!i) {
    i = IMGS[nombre] = new Image();
    i.src = `${RUTA}${nombre}.webp`;
  }
  return i.complete && i.naturalWidth ? i : null;
}
const n2 = (k) => String(k).padStart(2, '0');

/** El estado del pasillo que toca con el de la oficina (el final es el de las 5:00 + el rastro). */
function estadoDe(of) {
  if (of === '4am' || of === '430' || of === '5am') return of;
  if (of === 'final') return '5am';
  return null;
}

export class PasilloN7 {
  constructor(g) {
    this.g = g;
    this.reset();
  }

  reset() {
    this.t = 0;
    this.estado = null;          // '4am' | '430' | '5am' | null
    this.caida = null;           // { estado, t }
    this.flick = { on: false, t: 0.6 };
    this.furiaDesde = null;
    this.cargados = new Set();
    this.son = { vapor: 2.5, fuego: 3, lampara: 0, chispa: -1 };
  }

  get activo() {
    return !!(this.g.n7?.active && this.g.nightNumber === 7 && IND);
  }

  /** ¿Se ve el rastro de la Aberración? (con su rugido, tras un instante del parpadeo; o con el estado final) */
  get rastro() {
    if (this.g.ofv2?.actual === 'final') return true;
    return this.furiaDesde !== null && this.t - this.furiaDesde > 0.6;
  }

  // --- La carga, por partes (el estado de ahora y el siguiente) --------------------------------------------------
  _carga(e) {
    if (!IND || !e || this.cargados.has(e)) return;
    this.cargados.add(e);
    const B = IND.bucles ?? {};
    const lista = [];
    const est = IND.estados?.[e];
    if (est) lista.push(est.oscuro, est.luz);
    if (B.lampara?.[e]) lista.push(B.lampara[e]);
    const bal = B.balanceo?.[e];
    if (bal) for (let k = 0; k < bal.n; k++) lista.push(`${bal.pref}_${n2(k)}`);
    if (e === '430') {
      for (let k = 0; k < (B.chispas ?? 0); k++) lista.push(`chispas_${n2(k)}`);
      for (const q of ['vapor_oscuro', 'vapor_luz']) for (let k = 0; k < (B[q] ?? 0); k++) lista.push(`${q}_${n2(k)}`);
    }
    if (e === '5am') {
      for (let k = 0; k < (B.fuego ?? 0); k++) lista.push(`fuego_${n2(k)}`);
      for (const q of ['humo_oscuro', 'humo_luz']) for (let k = 0; k < (B[q] ?? 0); k++) lista.push(`${q}_${n2(k)}`);
      const r = IND.estados?.rastro;
      if (r) lista.push(r.oscuro, r.luz);
      for (const m of Object.values(IND.marco ?? {})) lista.push(m);
    }
    const c = IND.caidas?.[e];
    if (c) for (const nom of ['oscuro', 'luz']) for (let k = 0; k < (c[nom] ?? 0); k++) lista.push(`caida${e}_${nom}_${n2(k)}`);
    lista.forEach(img);
  }

  // --- Cada fotograma ---------------------------------------------------------------------------------------------
  update(dt) {
    if (!this.activo) {
      if (this.estado) this.reset();
      return;
    }
    this.t += dt;
    const g = this.g;
    const e = estadoDe(g.ofv2?.actual);
    // (lo de ahora y lo siguiente, cargando antes de hacer falta: desde las 3:30 el de las 4:00)
    const h = g.clock.elapsed / g.clock.sph;
    if (h >= 3.5) this._carga('4am');
    const i = ORDEN.indexOf(e);
    if (e) this._carga(e);
    if (i >= 0 && ORDEN[i + 1]) this._carga(ORDEN[i + 1]);
    if (e !== this.estado) {
      // al pasar de un estado al siguiente (el mismo fogonazo que la oficina): su caída, si la tiene
      const sigue = this.estado && ORDEN.indexOf(e) === ORDEN.indexOf(this.estado) + 1;
      if (sigue && IND.caidas?.[e]) {
        this.caida = { estado: e, t: 0, golpe: false, crujido: false };
      }
      this.estado = e;
    }
    if (this.caida) {
      const c = this.caida;
      c.t += dt;
      const n = IND.caidas[c.estado]?.oscuro ?? 20;
      if (!c.crujido) { c.crujido = true; this._son('crujido', 'central2', 0.8); }
      if (!c.golpe && c.t > (c.estado === '430' ? 0.72 : 0.8)) {
        c.golpe = true;
        this._son('metal', c.estado === '430' ? 'central3' : 'central2', 1.0);
        setTimeout(() => this._son('panel', 'central2', 0.55), 180);
      }
      if (c.t >= n / (IND.fps ?? 12)) this.caida = null;
    }
    if (g.n7?.ab?.furia && this.furiaDesde === null) this.furiaDesde = this.t;
    if (!g.n7?.ab?.furia) this.furiaDesde = null;
    if (!e) return;
    // La lámpara que parpadea: a ratos, encendidas cortas y seguidas
    const f = this.flick;
    f.t -= dt;
    if (f.t <= 0) {
      f.on = !f.on;
      f.t = f.on ? 0.04 + Math.random() * 0.2 : (Math.random() < 0.35 ? 0.05 + Math.random() * 0.12 : 0.6 + Math.random() * 2.6);
      if (f.on && f.t > 0.12 && Math.random() < 0.3) this._son('lampara', 'central3', 0.18);   // (solo en las encendidas largas)
    }
    // Los sonidos del pasillo (bajos: no tapan a la Aberración)
    const S = this.son;
    if (ORDEN.indexOf(e) >= 1) {
      S.vapor -= dt;
      if (S.vapor <= 0) { S.vapor = 2.8 + Math.random() * 2.4; this._son('vapor', 'central2', 0.32); }
      const k = this._fr(IND.bucles?.chispas ?? 24);
      if ([2, 15].includes(k) && S.chispa !== k && Math.random() < 0.7) this._son('chispas', 'central3', 0.34);   // (las dos ráfagas grandes del bucle)
      S.chispa = k;
    }
    if (ORDEN.indexOf(e) >= 2) {
      S.fuego -= dt;
      if (S.fuego <= 0) { S.fuego = 2.5 + Math.random() * 3; this._son('crepitar', 'central1', 0.4); }
    }
  }

  /** Un sonido del pasillo central (lugar: central1 lejos … central3 junto a la compuerta). Más bajo sin mirar atrás. */
  _son(clave, lugar, vol) {
    const p = placeOf(lugar);
    const k = this.g.lookBack?.facingBack ? 1 : 0.55;
    this.g.audio?.lib?.play(`n7/${clave}`, { volume: vol * p.volume * k, pan: p.pan, muffle: Math.min(1, p.muffle + (k < 1 ? 0.25 : 0)) });
  }

  /** El fotograma de un bucle de n (a los fps del índice). */
  _fr(n) {
    return Math.floor(this.t * (IND?.fps ?? 12)) % Math.max(1, n);
  }

  /** La distancia de la Aberración (o Infinity si no está en el pasillo). */
  get distAb() {
    const A = this.g.n7?.ab;
    if (!A?.enPasillo) return Infinity;
    return DIST_AB[A.sala === 'puerta' ? 5 : Math.max(0, Math.min(4, A.pos))];
  }

  _dibuja(ctx, nombre, r, aditivo = false, alfa = 1) {
    const im = img(nombre);
    if (!im) return false;
    ctx.save();
    if (aditivo) ctx.globalCompositeOperation = 'lighter';
    if (alfa < 1) ctx.globalAlpha = alfa;
    ctx.drawImage(im, r.x, r.y, r.w, r.h);
    ctx.restore();
    return true;
  }

  /** La caída en curso (el hueco entero), o false. */
  _drawCaida(ctx, r, pase) {
    const c = this.caida;
    if (!c) return false;
    const n = IND.caidas[c.estado]?.[pase] ?? 0;
    const k = Math.min(n - 1, Math.floor(c.t * (IND.fps ?? 12)));
    return n > 0 && this._dibuja(ctx, `caida${c.estado}_${pase}_${n2(k)}`, r);
  }

  /** El pasillo a oscuras (dentro del hueco, encima de oscuro.webp). */
  drawOscuro(ctx, r) {
    if (!this.activo || !this.estado) return;
    const e = this.estado;
    const B = IND.bucles ?? {};
    if (!this._drawCaida(ctx, r, 'oscuro')) {
      this._dibuja(ctx, IND.estados?.[e]?.oscuro, r);
      if (this.rastro) this._dibuja(ctx, IND.estados?.rastro?.oscuro, r);
    }
    this._bucles(ctx, r, 'oscuro', 0, Infinity);
    if (this.flick.on && B.lampara?.[e]) this._dibuja(ctx, B.lampara[e], r, true, 0.85);
  }

  /** Los bucles de un pase entre dos distancias (las que están detrás o delante de la Aberración). */
  _bucles(ctx, r, pase, desde, hasta) {
    const e = this.estado;
    const B = IND.bucles ?? {};
    const D = IND.dist ?? {};
    const i = ORDEN.indexOf(e);
    const entra = (q) => (D[q] ?? 0) >= desde && (D[q] ?? 0) < hasta;
    if (i >= 2 && B.fuego && entra('fuego')) this._dibuja(ctx, `fuego_${n2(this._fr(B.fuego))}`, r, true);
    if (i >= 1 && B.chispas && entra('chispas')) this._dibuja(ctx, `chispas_${n2(this._fr(B.chispas))}`, r, true);
    if (i >= 1 && B[`vapor_${pase}`] && entra('vapor')) this._dibuja(ctx, `vapor_${pase}_${n2(this._fr(B[`vapor_${pase}`]))}`, r);
    if (pase === 'luz' && B.balanceo?.[e] && entra('balanceo')) {
      const b = B.balanceo[e];
      this._dibuja(ctx, `${b.pref}_${n2(this._fr(b.n))}`, r);
    }
  }

  /** El pasillo alumbrado por la linterna (dentro del haz, encima de luz.webp): lo que está detrás de la Aberración. */
  drawLuz(ctx, r) {
    if (!this.activo || !this.estado) return;
    if (!this._drawCaida(ctx, r, 'luz')) {
      this._dibuja(ctx, IND.estados?.[this.estado]?.luz, r);
      if (this.rastro) this._dibuja(ctx, IND.estados?.rastro?.luz, r);
    }
    this._bucles(ctx, r, 'luz', this.distAb, Infinity);
    const B = IND.bucles ?? {};
    if (this.flick.on && B.lampara?.[this.estado]) this._dibuja(ctx, B.lampara[this.estado], r, true, 0.85);
  }

  /** Lo que está más cerca que la Aberración (se pinta encima de ella) y el humo bajo el techo. */
  drawLuzDelante(ctx, r) {
    if (!this.activo || !this.estado) return;
    if (this.distAb < Infinity) this._bucles(ctx, r, 'luz', 0, this.distAb);
    const B = IND.bucles ?? {};
    if (ORDEN.indexOf(this.estado) >= 2 && B.humo_luz) this._dibuja(ctx, `humo_luz_${n2(this._fr(B.humo_luz))}`, r);
  }

  /** El humo a oscuras (encima de todo lo del hueco). */
  drawHumoOscuro(ctx, r) {
    if (!this.activo || ORDEN.indexOf(this.estado) < 2) return;
    const B = IND.bucles ?? {};
    if (B.humo_oscuro) this._dibuja(ctx, `humo_oscuro_${n2(this._fr(B.humo_oscuro))}`, r);
  }

  /** El marco abollado (fuera del hueco: el recuadro grande), con la luz normal o la del apagón. */
  drawMarco(ctx, apagon = false) {
    if (!this.activo || !this.rastro || !IND.marco) return;
    const [x, y, w, h] = IND.rect;
    this._dibuja(ctx, IND.marco[apagon ? 'apagon' : 'normal'] ?? IND.marco.normal, { x, y, w, h });
  }
}

