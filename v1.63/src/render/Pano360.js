// =============================================================
// Pano360.js — Una vista de 360° renderizada en Blender (v1.23; el final: al levantarte y en los cruces de la huida).
// La imagen es equirectangular (tools/3d/final/pano_f1.py): u = 0,5 el frente, hacia la derecha la derecha, v = 0 el
// techo. Se pinta con perspectiva de verdad en un WebGL aparte (sin librerías) y se copia al canvas del juego.
// Encima, una capa animada con transparencia (el fuego, el polvo), con fundido entre dos fotogramas para el bucle.
//   giro: 0 = el frente, + a la derecha (grados); incl: + arriba; campo: el ángulo horizontal (grados)
// =============================================================

const VS = `attribute vec2 p; varying vec2 v; void main() { v = p; gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `precision highp float;
varying vec2 v;
uniform sampler2D uBase, uCapa, uCapa2, uEsc;
uniform float uMezcla, uCapaA, uLuz;
uniform vec3 uF, uR, uU;
uniform vec2 uT;
void main() {
  vec3 d = normalize(uF + uR * v.x * uT.x + uU * v.y * uT.y);
  float lon = atan(d.y, d.x);
  float lat = asin(clamp(d.z, -1.0, 1.0));
  vec2 uv = vec2(lon / 6.2831853 + 0.5, 0.5 - lat / 3.14159265);
  vec3 c = texture2D(uBase, uv).rgb;
  vec4 e = texture2D(uEsc, uv);                            // (los escombros que han caído, encima de la sala)
  c = mix(c, e.rgb, clamp(e.a, 0.0, 1.0));
  vec4 f = mix(texture2D(uCapa, uv), texture2D(uCapa2, uv), uMezcla);
  c = mix(c, f.rgb, clamp(f.a, 0.0, 1.0) * uCapaA);      // (alfa sin premultiplicar, como integrar_f1.py)
  gl_FragColor = vec4(c * uLuz, 1.0);
}`;

const RAD = Math.PI / 180;

export class Pano360 {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    const gl = this.gl = this.canvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true });
    this.ok = !!gl;
    if (!gl) return;
    const sh = (tipo, src) => {
      const s = gl.createShader(tipo);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn('Pano360:', gl.getShaderInfoLog(s));
      return s;
    };
    const pr = this.pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr);
    gl.useProgram(pr);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    for (const n of ['uBase', 'uCapa', 'uCapa2', 'uEsc', 'uMezcla', 'uCapaA', 'uLuz', 'uF', 'uR', 'uU', 'uT']) this.u[n] = gl.getUniformLocation(pr, n);
    this.tex = [0, 1, 2, 3].map((i) => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, i ? 0 : 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return t;
    });
    gl.uniform1i(this.u.uBase, 0);
    gl.uniform1i(this.u.uCapa, 1);
    gl.uniform1i(this.u.uCapa2, 2);
    gl.uniform1i(this.u.uEsc, 3);
    this.cargadas = [null, null, null, null];
  }

  _sube(i, img, forzar = false) {
    if (!this.ok || !img || (this.cargadas[i] === img && !forzar)) return;
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[i]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    // (sin potencia de dos no se puede REPEAT: la costura de atrás se cubre con CLAMP; las imágenes son 2:1 y potencia de 2)
    const pot = (n) => (n & (n - 1)) === 0;
    const rep = pot(img.width) && pot(img.height) ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, rep);
    this.cargadas[i] = img;
  }

  /** La imagen de la sala y (opcional) la capa animada: dos fotogramas y cuánto del segundo. */
  pon(base, capa = null, capa2 = null, mezcla = 0) {
    this._sube(0, base);
    if (capa) this._sube(1, capa);
    if (capa2) this._sube(2, capa2);
    this.mezcla = capa2 ? mezcla : 0;
    this.conCapa = !!capa;
  }

  /** La capa de los escombros caídos (un canvas que se va dibujando): cambiada = hay que volver a subirla. */
  ponEscombros(canvas, cambiada) {
    this._sube(3, canvas, cambiada);
  }

  /** Pinta la vista (giro, incl., campo en grados) en ctx, ocupando (x, y, w, h). luz: × el brillo. */
  draw(ctx, giro, incl, campo = 90, luz = 1, x = 0, y = 0, w = this.w, h = this.h) {
    if (!this.ok || !this.cargadas[0]) return false;
    const gl = this.gl;
    const g = giro * RAD;
    const p = incl * RAD;
    const F = [Math.cos(p) * Math.cos(g), Math.cos(p) * Math.sin(g), Math.sin(p)];
    const R = [-Math.sin(g), Math.cos(g), 0];
    const U = [-Math.sin(p) * Math.cos(g), -Math.sin(p) * Math.sin(g), Math.cos(p)];
    const tx = Math.tan((campo * RAD) / 2);
    gl.viewport(0, 0, this.w, this.h);
    gl.uniform3fv(this.u.uF, F);
    gl.uniform3fv(this.u.uR, R);
    gl.uniform3fv(this.u.uU, U);
    gl.uniform2f(this.u.uT, tx, (tx * this.h) / this.w);
    gl.uniform1f(this.u.uMezcla, this.mezcla ?? 0);
    gl.uniform1f(this.u.uCapaA, this.conCapa ? 1 : 0);
    gl.uniform1f(this.u.uLuz, luz);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    ctx.drawImage(this.canvas, x, y, w, h);
    return true;
  }

  /** Lo lejos (en grados) que queda una dirección (giro, incl.) del centro de la vista. */
  static distancia(giro, incl, g2, i2) {
    const a = [Math.cos(incl * RAD) * Math.cos(giro * RAD), Math.cos(incl * RAD) * Math.sin(giro * RAD), Math.sin(incl * RAD)];
    const b = [Math.cos(i2 * RAD) * Math.cos(g2 * RAD), Math.cos(i2 * RAD) * Math.sin(g2 * RAD), Math.sin(i2 * RAD)];
    return Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) / RAD;
  }
}
