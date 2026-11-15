// =============================================================
// Night7Puertas.js — (v2.10) «NO TE ENCIERRES» en la noche 7. El usuario: «en la Noche 7, por las puertas solo viene
// la Aberración. Si el jugador mantiene las dos puertas cerradas a la vez durante 5 segundos, la Aberración se enfurece
// y golpea una de las dos. Es para que el jugador no se quede encerrado». Valores en NIGHT7.PUERTAS (night7.js).
//
//   - Con las dos cerradas (abajo del todo) cuenta. Mientras cuenta: su gruñido crece, las luces tiemblan cada vez más
//     (Night7.drawParpadeo), la puerta a la que va a golpear se abomba desde fuera a empujones cada vez más seguidos
//     (renders a<daño>_<k>), el borde de las dos puertas se enciende en rojo (render <cara>_rojo) y en pantalla, en
//     cualquier vista, «⚠ NO TE ENCIERRES · 3» con una barra; en la terminal, una vez, «AMBAS CERRADAS: 3 s».
//   - Si abre una antes de los 5 s, se calma y el contador vuelve a cero.
//   - A los 5 s golpea una (la más cercana a ella; a la misma distancia, la menos dañada) y la daña un grado: 1 (abollada,
//     chispas: baja en 1,0 s), 2 (muy abollada, humo, se atasca a mitad: 2,0 s + 0,5) y 3 (rota: se queda abierta).
//     Mientras baja no protege (Office.js). Cada grado se ve (renders) y se oye. Dura hasta el final de la noche; se
//     reinicia al reintentar. Con la puerta rota, la Aberración entra por ahí (te come); el audio señuelo la puede
//     desviar (Aberracion7._senuelo: la decisión del usuario, «5B»).
// =============================================================

import { dice } from '../core/Idioma.js';
import { NIGHT7 } from '../night/night7.js';
import { drawEscombro, nEscombro } from '../render/Escombros.js';

const P = NIGHT7.PUERTAS;
const LADOS = ['left', 'right'];
const lerp = (a, b, k) => a + (b - a) * k;
const rand = (par) => par[0] + Math.random() * (par[1] - par[0]);
const PAN = { left: -0.8, right: 0.8 };

let IND = null;
fetch('assets/salas/unica/puertas/indice.json').then((r) => (r.ok ? r.json() : null)).then((j) => { IND = j; }).catch(() => {});

export class Night7Puertas {
  constructor(n7) {
    this.n7 = n7;
    this.g = n7.g;
    this.reset(false);
  }

  reset(activa) {
    this.activa = activa;
    this.cuenta = 0;              // s con las dos cerradas
    this.avisada = false;         // (el aviso de la terminal, una vez por encierro)
    this.empujonIn = 0;           // s hasta el siguiente empujón
    this.abomba = { left: 0, right: 0 };   // s que lleva el empujón de cada lado (la hoja abombándose), −1 = nada
    this.abomba.left = this.abomba.right = -1;
    this.golpes = 0;
    this.chispas = [];
    this.humoT = 0;
    this.sonT = { left: 0, right: 0 };
    this.cerradaDesde = { left: null, right: null };
    this.g.muertePuertaRota = false;
    const of = this.g.office;
    of.dano = { left: 0, right: 0 };
    of.cierrePuerta = activa ? P.BAJADA : null;
    of.atascoPuerta = activa ? P.ATASCO : null;
    const v2 = this.g.ofv2;
    if (v2) {
      if (activa) v2.precargaPuertas?.();
      v2.hojaVar = { left: null, right: null };
      v2.hojaRota = { left: false, right: false };
      v2.bordeRojo = { left: 0, right: 0 };
    }
  }

  /** 0..1: cuánto falta para que se enfurezca (para el indicador, las luces y el gruñido). */
  get k() {
    return Math.min(1, this.cuenta / P.TIEMPO);
  }

  /** Lo que tiemblan las luces de la oficina (Night7.drawParpadeo). */
  get temblor() {
    return this.cuenta > 0 ? P.TEMBLOR * this.k ** 1.3 : 0;
  }

  /** ¿Están las dos cerradas y abajo del todo? (las que bajan no cuentan: aún no protegen) */
  get encerrado() {
    const d = this.g.office.doors;
    return LADOS.every((s) => d[s].closed && !d[s].bajando);
  }

  /** La puerta a la que va a golpear: la más cercana a ella; a la misma distancia, la menos dañada. */
  objetivo() {
    const ab = this.n7.ab;
    const dano = this.g.office.dano;
    if (ab?.sala === 'lado' && ab.lado && (dano[ab.lado] ?? 0) < 3) return ab.lado;
    const sala = ab?.sala;
    const cerca = LADOS.find((s) => P.CERCA[s].includes(sala));
    if (cerca && dano[cerca] < 3) return cerca;
    const vivas = LADOS.filter((s) => dano[s] < 3);
    if (!vivas.length) return null;
    if (vivas.length === 1) return vivas[0];
    if (dano.left !== dano.right) return dano.left < dano.right ? 'left' : 'right';
    // (igual de dañadas: la que lleva más tiempo cerrada)
    const t = this.cerradaDesde;
    return (t.left ?? 1e9) <= (t.right ?? 1e9) ? 'left' : 'right';
  }

  update(dt) {
    if (!this.activa) return;
    const of = this.g.office;
    const t = this.g.clock.elapsed;
    for (const s of LADOS) {
      if (of.doors[s].closed && this.cerradaDesde[s] === null) this.cerradaDesde[s] = t;
      if (!of.doors[s].closed) this.cerradaDesde[s] = null;
    }
    const noche = this.n7.fase === 'noche' && !this.n7.sinEnemigos && !this.g.n4dbg?.off?.has('aberracion') && this.n7.ab?.activa;
    if (noche && this.encerrado) {
      if (this.cuenta === 0) this.empujonIn = rand(P.EMPUJON_CADA[0]) * 0.6;
      this.cuenta += dt;
      if (!this.avisada && this.cuenta >= P.AVISO_TERMINAL) {
        this.avisada = true;
        this.g.alerta?.(dice('n7.encerrado', { n: Math.max(1, Math.ceil(P.TIEMPO - this.cuenta)) }), 'danger');
      }
      this._avisos(dt);
      if (this.cuenta >= P.TIEMPO) this._golpe();
    } else {
      if (this.cuenta > 1.0) this.n7.sonido('respiraciones', { volume: 0.35, pan: 0 });   // (se calma: se aleja)
      this.cuenta = 0;
      this.avisada = false;
    }
    // la hoja abombándose (cada empujón dura P.EMPUJON s)
    for (const s of LADOS) {
      if (this.abomba[s] >= 0) {
        this.abomba[s] += dt;
        if (this.abomba[s] > P.EMPUJON) this.abomba[s] = -1;
      }
    }
    this._pinta(dt);
  }

  /** Mientras cuenta: el gruñido, los empujones (la hoja se abomba, el golpe sordo) y el borde rojo. */
  _avisos(dt) {
    const k = this.k;
    this.empujonIn -= dt;
    if (this.empujonIn <= 0) {
      const lado = this.objetivo();
      this.empujonIn = lerp(rand(P.EMPUJON_CADA[0]), rand(P.EMPUJON_CADA[1]), k);
      if (lado) {
        this.abomba[lado] = 0;
        this.abombaMax = k;
        this.g.audio.lib?.play('metal/golpe_pared', { volume: 0.35 + 0.5 * k, pan: PAN[lado], pitch: 0.85 + Math.random() * 0.2 });
        this.g.audio.lib?.play('aberracion/furia', { volume: lerp(P.GRUNIDO[0], P.GRUNIDO[1], k) * NIGHT7.ENEMIGOS_VOL, pitch: 0.55 + 0.15 * k, pan: PAN[lado] * 0.7 });
        if (Math.random() < 0.5) this.n7.sonido(Math.random() < 0.5 ? 'dedos' : 'respiraciones', { volume: 0.5 + 0.4 * k, pan: PAN[lado] });
        const ro = this.n7.rotura;
        if (ro) ro.sacudida = Math.max(ro.sacudida ?? 0, 0.15 + 0.35 * k);
      }
    }
  }

  /** EL GOLPE: la Aberración, enfurecida, golpea una puerta y la daña un grado. */
  _golpe() {
    const of = this.g.office;
    this.cuenta = 0;
    this.avisada = false;
    const lado = this.objetivo();
    if (!lado) return;
    of.dano[lado] = Math.min(3, (of.dano[lado] ?? 0) + 1);
    this.golpes++;
    const n = of.dano[lado];
    const lib = this.g.audio.lib;
    lib?.play('aberracion/golpe_reactor', { volume: 1.0 * NIGHT7.ENEMIGOS_VOL, pan: PAN[lado] });
    lib?.play('puertas/golpe', { volume: 1.0, pan: PAN[lado] });
    lib?.play('aberracion/furia', { volume: 0.7 * NIGHT7.ENEMIGOS_VOL, pitch: 0.75, pan: PAN[lado] });
    const ro = this.n7.rotura;
    if (ro) ro.sacudida = Math.max(ro.sacudida ?? 0, 1.0);
    this.abomba[lado] = -1;
    this._chispazo(lado, 4);
    const suf = lado === 'left' ? 'izq' : 'der';
    if (n >= 3) {
      // rota: se queda abierta el resto de la noche
      of.doors[lado].closed = false;
      of.doors[lado].bajando = false;
      this.g.events.emit('door', { side: lado, closed: false });
      lib?.play('n7/forzada', { volume: 1.0, pan: PAN[lado] });
      this.g.alerta?.(dice(`n7.puerta_rota_${suf}`), 'danger');
    } else {
      lib?.play(n === 1 ? 'n7/chispas' : 'n7/vapor', { volume: 0.8, pan: PAN[lado] });
      this.g.alerta?.(dice(`n7.puerta_danada_${suf}`, { n }), 'danger');
    }
    this.g.events.emit('puertaDanada', { lado, dano: n });
    // (si estaba en esa puerta, el golpe ha sido su espera: se va, como al golpear una puerta cerrada)
    const ab = this.n7.ab;
    if (ab?.sala === 'lado' && ab.lado === lado && n < 3) ab._golpeaPuerta?.();
  }

  _chispazo(lado, cuantas = 1) {
    const c = IND?.caras?.[lado]?.chispas ?? [[800, 420], [800, 560]];
    for (let i = 0; i < cuantas; i++) {
      const [x, y] = c[Math.floor(Math.random() * c.length)];
      this.chispas.push({ lado, x: x + (Math.random() - 0.5) * 60, y: y + (Math.random() - 0.5) * 50, t: -Math.random() * 0.15, e: 0.4 + Math.random() * 0.3 });
    }
  }

  /** Cada fotograma: qué hoja se ve (daño, abombándose), la rota, el borde rojo, las chispas y el humo, y su sonido. */
  _pinta(dt) {
    const of = this.g.office;
    const v2 = this.g.ofv2;
    if (!v2) return;
    const k = this.k;
    for (const s of LADOS) {
      const d = of.dano[s] ?? 0;
      let v = d === 1 || d === 2 ? `d${d}` : null;
      if (this.abomba[s] >= 0 && d < 3) {
        // el empujón: 1 → máx → 1 (la máxima, según lo enfadada que esté)
        const u = this.abomba[s] / P.EMPUJON;
        const tope = Math.max(1, Math.round(1 + 2 * (this.abombaMax ?? 0)));
        const f = Math.max(1, Math.round(Math.sin(Math.PI * u) * tope));
        v = `a${d}_${f}`;
      }
      v2.hojaVar[s] = v;
      v2.hojaRota[s] = d >= 3;
      // el borde rojo: con las dos cerradas, encendido y parpadeando cada vez más deprisa
      v2.bordeRojo[s] = this.cuenta > 0 && of.doors[s].closed ? (0.35 + 0.65 * k) * (0.6 + 0.4 * Math.abs(Math.sin(this.cuenta * (3 + 9 * k)))) : 0;
      // sonido de cada grado (de vez en cuando): chispas (1), el humo y el metal (2), la rota que cruje (3)
      if (d > 0) {
        this.sonT[s] -= dt;
        if (this.sonT[s] <= 0) {
          this.sonT[s] = rand(P.SON_CADA);
          const vol = this.g.lookBack.face === s ? 0.35 : 0.15;
          if (d === 1) { this.g.audio.lib?.play('n7/chispas', { volume: vol, pan: PAN[s] }); this._chispazo(s, 1); }
          else if (d === 2) { this.g.audio.lib?.play('n7/vapor', { volume: vol * 0.7, pan: PAN[s] }); if (Math.random() < 0.5) this._chispazo(s, 1); }
          else this.g.audio.lib?.play('n7/crujido', { volume: vol, pan: PAN[s] });
        }
      }
    }
    this.humoT += dt;
    for (const c of this.chispas) c.t += dt;
    const n = nEscombro('chispas') || 18;
    this.chispas = this.chispas.filter((c) => c.t * 15 < n);
  }

  /** En la vista de cada puerta (su cara): las chispas (daño 1 y 2) y el humo (daño 2 y la rota), con la hoja bajada. */
  drawOffice(ctx, face) {
    if (!this.activa || (face !== 'left' && face !== 'right')) return;
    const of = this.g.office;
    const d = of.dano[face] ?? 0;
    if (!d) return;
    const bajada = (of.doors[face].anim ?? 0) > 0.55 || d >= 3;
    const c = IND?.caras?.[face];
    if (bajada && d >= 2 && c?.humo) {
      for (const [i, [x, y]] of c.humo.entries()) {
        const yy = d >= 3 ? (c.rota_y ?? y) : y;
        this.g.ofv2?.drawHumoEn?.(ctx, x, yy, this.humoT + i * 1.3, 0.42, d >= 3 ? 0.55 : 0.4);
      }
    }
    if (!bajada) return;
    for (const ch of this.chispas) {
      if (ch.lado !== face || ch.t < 0) continue;
      const kf = Math.max(0, 1 - ch.t / 0.12);
      if (kf > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(ch.x, ch.y, 0, ch.x, ch.y, 80);
        g.addColorStop(0, `rgba(255,220,170,${0.5 * kf})`);
        g.addColorStop(1, 'rgba(255,180,120,0)');
        ctx.fillStyle = g;
        ctx.fillRect(ch.x - 80, ch.y - 80, 160, 160);
        ctx.restore();
      }
      drawEscombro(ctx, 'chispas', Math.floor(ch.t * 15), ch.x, ch.y, ch.e, { luz: true });
    }
  }

  /** En pantalla, en cualquier vista (también con el monitor): «⚠ NO TE ENCIERRES · 3» y la barra que se llena. */
  drawHud(ctx, W) {
    if (!this.activa || this.cuenta <= 0) return;
    const k = this.k;
    const s = Math.max(1, Math.ceil(P.TIEMPO - this.cuenta));
    const txt = dice('n7.no_te_encierres', { n: s });
    const y = 128;
    ctx.save();
    ctx.font = 'bold 26px "Courier New", monospace';
    ctx.textAlign = 'center';
    const ancho = Math.max(360, ctx.measureText(txt).width + 60);
    const parpa = 0.75 + 0.25 * Math.abs(Math.sin(this.cuenta * (4 + 10 * k)));
    ctx.fillStyle = `rgba(20,0,0,${0.62 * parpa})`;
    ctx.fillRect(W / 2 - ancho / 2, y - 30, ancho, 58);
    ctx.strokeStyle = `rgba(255,60,40,${0.85 * parpa})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(W / 2 - ancho / 2, y - 30, ancho, 58);
    ctx.fillStyle = `rgba(255,${Math.round(110 - 70 * k)},${Math.round(90 - 60 * k)},${parpa})`;
    ctx.fillText(txt, W / 2, y + 2);
    // la barra: se llena hasta el golpe
    ctx.fillStyle = 'rgba(80,10,8,0.9)';
    ctx.fillRect(W / 2 - ancho / 2 + 14, y + 14, ancho - 28, 7);
    ctx.fillStyle = `rgba(255,${Math.round(90 - 60 * k)},40,0.95)`;
    ctx.fillRect(W / 2 - ancho / 2 + 14, y + 14, (ancho - 28) * k, 7);
    ctx.restore();
  }
}
