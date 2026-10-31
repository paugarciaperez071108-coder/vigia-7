// =============================================================
// Night7Muerte.js — La muerte de El Dislocado en la noche 7 (v1.24, Fases B y C del plan aprobado,
// informes/plan_conductos_n7/PLAN_CONDUCTOS_N7.md). Valores: NIGHT7.MUERTE_DISLOCADO.
//
// Desde las 5:00, en cuanto está en un conducto (no asomado ni a punto de asomarse; si está asomado, se
// espera a que vuelva; a las 5:15, si está fuera, vuelve a un conducto para que ocurra):
//   aviso     un chillido metálico agudo, la cámara de ese conducto parpadea en el plano y la terminal
//             escribe «⚠ V3 – temperatura crítica» (no se toca el monitor)
//   fogonazo  la bocanada de fuego le alcanza de frente: se retuerce y chilla; sus intestinos prenden
//   arrastra  sigue hacia la oficina, ardiendo y cada vez más despacio (poses «ardiendo» de Blender en cada
//             conducto: poses.py --arde); sin mirar, se le oye: el arrastre torpe, el crepitar y los gemidos
//   rejilla   en el hueco de la oficina (tools/3d/n7/muerte_dislocado.py): asoma ardiendo, estira un brazo hacia
//             ti, se le queda a medio camino, tiembla, cierra los dedos y cae colgando; la cabeza se apoya en el
//             borde. No es un susto: ni grito encima ni pantalla de muerte.
//   cuelga    su cuerpo se queda en el hueco el resto de la noche (llamas pequeñas, brasas y humo, en bucle);
//             su triángulo se apaga; «Señal biológica perdida – conductos»; esa rejilla ya no explota;
//             flags.dislocadoMuertoN7. Y la Aberración se enfurece (Fase C): el rugido de muchas voces por
//             toda la nave, la oficina tiembla, las luces parpadean, «⚠ ACTIVIDAD ANÓMALA – PASILLO CENTRAL» y,
//             hasta las 6, Aberracion7.furia (NIGHT7.ABERRACION.FURIA).
// El Dislocado no cambia nada hasta su muerte: aquí se le toma (state 'muriendo' → 'muerto'), y su IA
// (Dislocado.js) no hace nada en esos estados.
// =============================================================

import { NIGHT7 } from '../night/night7.js';
import { VENTS, VENT_DIST, ventNeighbors } from '../world/StationMap.js';
import { GRILLE_VENT } from '../ai/enemies/Dislocado.js';
import { MINIMAP, miniBox } from '../render/MiniMap.js';

const K = NIGHT7.MUERTE_DISLOCADO;
const rand = ([a, b]) => a + Math.random() * (b - a);
const n2 = (n) => String(n).padStart(2, '0');
const PAN = { left: -0.75, right: 0.75 };

let INDICE = null;
const CACHE = {};
function im(ruta) {
  let i = CACHE[ruta];
  if (!i) {
    i = CACHE[ruta] = new Image();
    i.src = `assets/n7/muerte_dislocado/${ruta}.webp`;
  }
  return i.complete && i.naturalWidth ? i : null;
}

/** El camino más corto por los conductos de `desde` a `hasta` (sin pasar por la oficina). */
function camino(desde, hasta) {
  const prev = { [desde]: null };
  const cola = [desde];
  while (cola.length) {
    const c = cola.shift();
    if (c === hasta) break;
    for (const n of ventNeighbors(c)) {
      if (n === 'office' || n in prev) continue;
      prev[n] = c;
      cola.push(n);
    }
  }
  if (!(hasta in prev)) return [desde];
  const out = [];
  for (let c = hasta; c; c = prev[c]) out.unshift(c);
  return out;
}

export class Night7Muerte {
  constructor(n7) {
    this.n7 = n7;
    this.g = n7.g;
    this.reset(false);
  }

  reset(on) {
    this.on = on;
    this.fase = null;            // null | 'aviso' | 'fogonazo' | 'arrastra' | 'espera' | 'rejilla' | 'cuelga'
    this.t = 0;
    this.v = null;               // el conducto en el que está (o donde empezó)
    this.lado = null;            // la rejilla de la oficina por la que acaba
    this.ruta = [];
    this.paso = 0;
    this.pasoT = 0;
    this.sonIn = 0;
    this.sonidos = new Set();
    this.despues = 0;            // s desde que se quedó colgado
    this.luces = 0;              // s de parpadeo de las luces (la furia)
    if (on && !INDICE) {
      fetch('assets/n7/muerte_dislocado/indice.json').then((r) => (r.ok ? r.json() : null)).then((d) => { INDICE = d; }).catch(() => {});
    }
  }

  get dis() {
    return this.g.ai?.dislocado;
  }

  get hora() {
    return this.g.clock.elapsed / this.g.clock.sph;
  }

  /** ¿Esa rejilla ya es suya (no debe explotar)? */
  bloquea(lado) {
    return !!this.fase && this.lado === lado;
  }

  get muerto() {
    return this.fase === 'cuelga';
  }

  _son(clave, o = {}) {
    this.g.audio?.lib?.play(clave, { volume: K.VOL * (o.volume ?? 1), pan: o.pan ?? 0, muffle: o.muffle ?? 0, pitchVar: 0.04 });
  }

  /** (debug / novedades) Que ocurra ya, en el conducto en el que esté o en V1. */
  forzar() {
    const d = this.dis;
    if (!d || this.fase) return;
    if (!['vent'].includes(d.state)) {
      d.state = 'vent';
      d.room = d.room && VENTS[d.room] && !VENTS[d.room].officeAccess ? d.room : 'v1';
      d.side = null;
    }
    this._empieza();
  }

  update(dt) {
    if (!this.on) return;
    const d = this.dis;
    if (!d || d.level <= 0 || this.g.n4dbg?.off?.has('dislocado')) return;
    this.luces = Math.max(0, this.luces - dt);
    if (!this.fase) {
      const h = this.hora;
      if (h < K.DESDE) return;
      // A las 5:15, si está fuera de los conductos, vuelve ya (para que ocurra en cuanto se pueda)
      if (h >= K.LIMITE && d.state === 'away') d.appear(this.g.world);
      if (d.state === 'vent' && d.room && VENTS[d.room] && !VENTS[d.room].officeAccess) this._empieza();
      else if (d.state === 'vent' && d.room && h >= K.LIMITE) this._empieza();
      return;
    }
    this.t += dt;
    if (this.fase === 'aviso' && this.t >= K.AVISO) this._fogonazo();
    else if (this.fase === 'fogonazo' && this.t >= K.FOGONAZO) this._arrastra();
    else if (this.fase === 'arrastra') this._arrastrando(dt);
    else if (this.fase === 'espera' && this.t >= K.EN_REJILLA) this._rejilla();
    else if (this.fase === 'rejilla') this._enRejilla();
    else if (this.fase === 'cuelga') this._colgado(dt);
  }

  _empieza() {
    const d = this.dis;
    this.v = d.room;
    d.state = 'muriendo';             // (desde aquí, su IA no hace nada: Dislocado.js no conoce este estado)
    // ¿Por qué rejilla acaba? La de su lado si ya está en un lateral; si no, la más cercana (la que no esté
    // explotando en ese momento)
    const rej = this.n7.rotura?.rejillas ?? {};
    const lados = ['left', 'right'].filter((l) => rej[l]?.estado !== 'explota');
    const opciones = (lados.length ? lados : ['left', 'right']).map((l) => ({ l, r: camino(this.v, GRILLE_VENT[l]) }));
    opciones.sort((a, b) => a.r.length - b.r.length || Math.random() - 0.5);
    this.lado = opciones[0].l;
    this.ruta = opciones[0].r;
    this.paso = 0;
    // (las capas de su muerte en esa rejilla, ya: el arrastre da tiempo a que lleguen)
    this._precarga();
    this.fase = 'aviso';
    this.t = 0;
    this._son('dislocado/aviso', { volume: 0.9, pan: 0, muffle: 0.3 });
    this.g.alerta?.(`⚠ ${VENTS[this.v]?.cam ?? this.v.toUpperCase()} – temperatura crítica`, 'danger');
  }

  _precarga() {
    if (!INDICE) return;
    for (const k of [this.lado, `${this.lado}_apagon`]) {
      const c = INDICE[k];
      if (!c) continue;
      for (let i = 0; i < c.muere; i++) im(`${k}/muere_${n2(i)}`);
      for (let i = 0; i < c.cuelga; i++) im(`${k}/cuelga_${n2(i)}`);
    }
  }

  _fogonazo() {
    this.fase = 'fogonazo';
    this.t = 0;
    // (la bocanada de fuego del caos, en su conducto: esta vez SÍ le alcanza)
    const c = this.n7.conductos?.c?.[this.v];
    if (c) { c.fog = 0; c.fogPend = false; }
    const mirando = this._mirando(this.v);
    this._son('conductos/fogonazo', { volume: mirando ? 0.9 : 0.4, muffle: mirando ? 0.1 : 0.6 });
    this._son('dislocado/arde', { volume: mirando ? 1 : 0.55, pan: this._pan(this.v), muffle: mirando ? 0 : 0.45 });
    this.g.cameras?.glitchIfWatching?.([this.v], 0.35);
  }

  _arrastra() {
    this.fase = 'arrastra';
    this.t = 0;
    this.pasoT = K.PASO[0];
    this.sonIn = 0.4;
  }

  _arrastrando(dt) {
    this.pasoT -= dt;
    this.sonIn -= dt;
    const v = this.ruta[this.paso];
    if (this.sonIn <= 0) {
      this.sonIn = rand(K.SON_CADA);
      const dist = VENT_DIST[v] ?? 3;
      const cerca = Math.max(0.15, 1 - dist / 4);
      const mirando = this._mirando(v);
      const gime = Math.random() < K.GEMIDO;
      this._son(gime ? 'dislocado/gemido' : 'dislocado/torpe', { volume: (0.35 + 0.65 * cerca) * (mirando ? 1 : 0.8),
        pan: this._pan(v), muffle: mirando ? 0.1 : 0.5 - 0.3 * cerca });
    }
    if (this.pasoT > 0) return;
    if (this.paso >= this.ruta.length - 1) {
      this.fase = 'espera';
      this.t = 0;
      return;
    }
    const de = v;
    this.paso++;
    const a = this.ruta[this.paso];
    this.dis.room = a;
    this.g.cameras?.glitchIfWatching?.([de, a], 0.5);
    // (cada vez más despacio)
    this.pasoT = K.PASO[0] + (K.PASO[1] - K.PASO[0]) * Math.min(1, this.paso / Math.max(1, this.ruta.length - 1));
  }

  _rejilla() {
    this.fase = 'rejilla';
    this.t = 0;
    this.sonidos.clear();
    this.dis.room = null;
    this.dis.side = this.lado;
  }

  _enRejilla() {
    const c = INDICE?.[this.lado];
    const fps = c?.fps ?? 12;
    const f = this.t * fps;
    const pan = PAN[this.lado];
    const una = (clave, desde, fn) => {
      if (f >= desde && !this.sonidos.has(clave)) { this.sonidos.add(clave); fn(); }
    };
    una('torpe', 0, () => this._son('dislocado/torpe', { volume: 0.8, pan, muffle: 0.3 }));
    una('asoma', 24, () => this._son('dislocado/gemido', { volume: 0.85, pan, muffle: 0.1 }));
    una('estira', 40, () => this._son('dislocado/gemido', { volume: 1, pan }));
    una('brazo', 55, () => this._son('dislocado/brazo', { volume: 0.9, pan }));
    una('ultimo', 60, () => this._son('dislocado/ultimo', { volume: 1, pan }));
    if (f >= (c?.muere ?? 66) + K.SILENCIO * fps) this._muere();
  }

  _muere() {
    this.fase = 'cuelga';
    this.t = 0;
    this.despues = 0;
    const d = this.dis;
    d.state = 'muerto';
    d.room = null;
    // Lo que queda guardado (en la huida del final, su cuerpo sigue ahí)
    const g = this.g;
    g.save = { ...g.save, flags: { ...(g.save?.flags ?? {}), dislocadoMuertoN7: true } };
    g.events.emit('dislocadoMuerto', { lado: this.lado });
  }

  _colgado(dt) {
    const antes = this.despues;
    this.despues += dt;
    const paso = (s) => antes < s && this.despues >= s;
    if (paso(K.ALERTA_TRAS)) this.g.alerta?.('Señal biológica perdida – conductos', 'warn');
    if (paso(K.FURIA_TRAS)) {
      // (Fase C) La Aberración, furiosa: el rugido de muchas voces, la oficina tiembla y las luces parpadean
      this._son('aberracion/furia', { volume: NIGHT7.ENEMIGOS_VOL ?? 1 });
      const ro = this.n7.rotura;
      if (ro) ro.sacudida = Math.max(ro.sacudida, K.TEMBLOR);
      this.luces = K.LUCES;
      this.n7.slaimiSusto?.();
      this.g.alerta?.('⚠ ACTIVIDAD ANÓMALA – PASILLO CENTRAL', 'danger');
      this.n7.ab.furia = true;
      this.g.events.emit('aberracionFuria', {});
    }
  }

  _mirando(v) {
    const cams = this.g.cameras;
    return !!cams?.open && cams.mapMode === 'vent' && cams.active === v;
  }

  _pan(v) {
    return v === 'v6' ? 0.7 : v === 'v7' ? -0.7 : v === 'v2' ? 0.35 : v === 'v3' ? -0.35 : 0;
  }

  // ---------------------------------------------------------------
  // Dibujo
  // ---------------------------------------------------------------
  /** En la cámara de un conducto: él (true si lo ha pintado aquí; si no, se pinta como siempre: con su estado
   * 'muriendo' / 'muerto', Night5.drawVent ya no lo pinta). */
  drawVent(ctx, id) {
    if (!['aviso', 'fogonazo', 'arrastra', 'espera'].includes(this.fase)) return false;
    const aqui = this.fase === 'aviso' || this.fase === 'fogonazo' ? this.v : this.ruta[this.paso];
    if (id !== aqui) return true;
    const cv = this.g.cameraView;
    const poses = cv?.poses;
    const prog = { v4: 0.15, v5: 0.15, v2: 0.35, v3: 0.35, v1: 0.6, v6: 0.9, v7: 0.9 }[id] ?? 0.5;
    const tipo = prog >= 0.85 ? 'cerca' : prog >= 0.5 || this.paso > 0 ? 'media' : 'lejos';
    const n = this._arde(id, tipo);
    const fr = `${tipo}_${Math.floor(this.t * K.FPS_ARDE) % Math.max(1, n)}`;
    if (this.fase === 'aviso') {
      this._normal(ctx, id);                                  // (todavía como siempre)
      return true;
    }
    if (this.fase === 'fogonazo') {
      // Le alcanza: se retuerce (su pose de siempre, sacudida) y prende (la pose ardiendo aparece encima)
      const k = Math.min(1, this.t / (K.FOGONAZO * 0.7));
      ctx.save();
      ctx.translate((Math.random() - 0.5) * 18 * (1 - k * 0.5), (Math.random() - 0.5) * 10);
      ctx.globalAlpha = n ? 1 - k : 1;
      this._normal(ctx, id);
      if (n) {
        ctx.globalAlpha = k;
        poses.draw(ctx, 'dislocado_arde', id, fr, cv.time);
      }
      ctx.restore();
      return true;
    }
    if (!n) {
      this._normal(ctx, id);
      return true;
    }
    // Arrastrándose ardiendo: a sacudidas
    ctx.save();
    ctx.translate(Math.sin(this.t * 3.1) * 3, Math.abs(Math.sin(this.t * 1.7)) * 4);
    poses.draw(ctx, 'dislocado_arde', id, fr, cv.time);
    ctx.restore();
    return true;
  }

  /** Su pose de siempre (con la luz del fuego del caos), aunque su estado ya sea 'muriendo'. */
  _normal(ctx, id) {
    const d = this.dis;
    const [st, ro] = [d.state, d.room];
    d.state = 'vent';
    d.room = id;
    if (!this.n7.conductos?.drawDislocado(ctx, id, (c2) => this.g.n5?.drawVent(c2, id))) this.g.n5?.drawVent(ctx, id);
    d.state = st;
    d.room = ro;
  }

  /** Cuántos fotogramas ardiendo hay de esa pose (0 si no están). */
  _arde(id, tipo) {
    const sp = this.g.sprites;
    let n = 0;
    while (sp?.has?.(`pose_dislocado_arde_${id}_${tipo}_${n}`)) n++;
    return n;
  }

  /** En la pared del frente de la oficina (con el movimiento de la vista), encima de la rejilla. */
  drawRejilla(ctx) {
    if (!INDICE || !['rejilla', 'cuelga'].includes(this.fase)) return;
    const apagon = !!this.g.blackout?.active && INDICE[`${this.lado}_apagon`];
    const clave = apagon ? `${this.lado}_apagon` : this.lado;
    const c = INDICE[clave];
    if (!c) return;
    let f;
    if (this.fase === 'rejilla') f = im(`${clave}/muere_${n2(Math.min(c.muere - 1, Math.floor(this.t * c.fps)))}`);
    else f = im(`${clave}/cuelga_${n2(Math.floor(this.despues * c.fps * 0.8) % c.cuelga)}`);
    // (si el fotograma no ha llegado todavía, el último de la muerte: nunca un hueco vacío)
    f ??= im(`${clave}/muere_${n2(c.muere - 1)}`);
    if (f) ctx.drawImage(f, c.x, c.y, c.w, c.h);
  }

  /** El plano de los conductos: durante el aviso, la cámara de ese conducto parpadea. */
  drawMap(ctx) {
    if (this.fase !== 'aviso' && this.fase !== 'fogonazo') return;
    const r = miniBox(VENTS[this.v].mapRect, MINIMAP.BOX, MINIMAP.VENT);
    if (Math.floor(this.t * 7) % 2) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,90,40,0.95)';
    ctx.lineWidth = 3;
    ctx.strokeRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
    ctx.fillStyle = 'rgba(255,90,40,0.25)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }

  /** La oficina, mientras la Aberración ruge: las luces parpadean. */
  drawLuces(ctx, W, H) {
    if (this.luces <= 0) return;
    if (Math.random() < 0.45) {
      ctx.fillStyle = `rgba(0,0,0,${0.45 + Math.random() * 0.4})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}
