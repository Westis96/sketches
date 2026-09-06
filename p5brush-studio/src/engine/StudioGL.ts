/**
 * Studio GL layer: paper texture, committed-image snapshots and a paper eraser.
 * Shares the WebGL2 context with p5.brush, which re-arms its own program, VAO
 * and blend state before every draw and composite pass.
 */

const BLIT_VERT = `#version 300 es
in vec2 a_pos; out vec2 v_uv;
uniform vec4 u_rect; // x, y (from top), w, h in device px
uniform vec2 u_res;
void main(){
  v_uv = a_pos * 0.5 + 0.5;
  vec2 px = vec2(u_rect.x + v_uv.x * u_rect.z, u_rect.y + (1.0 - v_uv.y) * u_rect.w);
  gl_Position = vec4(px.x / u_res.x * 2.0 - 1.0, 1.0 - px.y / u_res.y * 2.0, 0.0, 1.0);
}`;
const BLIT_FRAG = `#version 300 es
precision highp float; in vec2 v_uv; uniform sampler2D u_tex; out vec4 o;
void main(){ o = texture(u_tex, v_uv); }`;
const ERASE_VERT = `#version 300 es
in vec2 a_pos; uniform vec2 u_center; uniform float u_radius; uniform vec2 u_res;
void main(){ vec2 p = u_center + a_pos * u_radius; gl_Position = vec4(p / u_res * 2.0 - 1.0, 0.0, 1.0); }`;
const ERASE_FRAG = `#version 300 es
precision highp float; uniform sampler2D u_paper; uniform vec2 u_center; uniform float u_radius; uniform vec2 u_res; uniform float u_hard; out vec4 o;
void main(){
  float d = length(gl_FragCoord.xy - u_center) / u_radius;
  float a = 1.0 - smoothstep(u_hard, 1.0, d);
  if (a <= 0.002) discard;
  vec4 paper = texture(u_paper, gl_FragCoord.xy / u_res);
  o = vec4(paper.rgb * a, a);
}`;

export interface Dab { x: number; y: number; r: number }

export class StudioGL {
  readonly gl: WebGL2RenderingContext;
  readonly paperTex: WebGLTexture;
  /** Mutable: undo/redo rotate texture handles instead of copying pixels. */
  committedTex: WebGLTexture;
  private w = 1;
  private h = 1;
  private readonly blitProg: WebGLProgram;
  private readonly eraseProg: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly u: Record<string, WebGLUniformLocation | null>;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.blitProg = this.program(BLIT_VERT, BLIT_FRAG);
    this.eraseProg = this.program(ERASE_VERT, ERASE_FRAG);
    this.u = {
      blitTex: gl.getUniformLocation(this.blitProg, 'u_tex'),
      blitRect: gl.getUniformLocation(this.blitProg, 'u_rect'),
      blitRes: gl.getUniformLocation(this.blitProg, 'u_res'),
      ePaper: gl.getUniformLocation(this.eraseProg, 'u_paper'),
      eCenter: gl.getUniformLocation(this.eraseProg, 'u_center'),
      eRadius: gl.getUniformLocation(this.eraseProg, 'u_radius'),
      eRes: gl.getUniformLocation(this.eraseProg, 'u_res'),
      eHard: gl.getUniformLocation(this.eraseProg, 'u_hard'),
    };
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    for (const prog of [this.blitProg, this.eraseProg]) {
      const loc = gl.getAttribLocation(prog, 'a_pos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    }
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this.paperTex = this.createTexture();
    this.committedTex = this.createTexture();
  }

  private program(vs: string, fs: string): WebGLProgram {
    const gl = this.gl;
    const p = gl.createProgram()!;
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader error');
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link error');
    return p;
  }

  setSize(w: number, h: number) { this.w = w; this.h = h; }

  createTexture(): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return t;
  }

  deleteTexture(t: WebGLTexture) { this.gl.deleteTexture(t); }

  uploadPaper(canvas2d: HTMLCanvasElement) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.paperTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas2d);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private begin() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
  }

  private end() {
    const gl = this.gl;
    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.useProgram(null);
    gl.enable(gl.BLEND);
  }

  /** Copies `tex` over the whole canvas. */
  blit(tex: WebGLTexture) {
    this.blitRect(tex, 0, 0, this.w, this.h);
  }

  /** Draws `tex` into a device-pixel rectangle (y from top); used for the cheap pan/zoom preview. */
  blitRect(tex: WebGLTexture, x: number, y: number, w: number, h: number) {
    const gl = this.gl;
    this.begin();
    gl.disable(gl.BLEND);
    gl.useProgram(this.blitProg);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(this.u.blitTex, 0);
    gl.uniform4f(this.u.blitRect, x, y, w, h);
    gl.uniform2f(this.u.blitRes, this.w, this.h);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.end();
  }

  private clampRegion(x: number, y: number, w: number, h: number) {
    const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.ceil(x + w)), y1 = Math.min(this.h, Math.ceil(y + h));
    return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
  }

  /** Fills the canvas with a flat colour (0..255 components). */
  clearColor(r: number, g: number, b: number) {
    const gl = this.gl;
    this.begin();
    gl.clearColor(r / 255, g / 255, b / 255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.end();
  }

  /** Mean red channel (0..255) of a device-pixel rectangle (y from top) of the canvas; for diagnostics. */
  meanRed(x: number, y: number, w: number, h: number): number {
    const r = this.clampRegion(x, y, w, h);
    if (!r) return -1;
    const gl = this.gl;
    const px = new Uint8Array(r.w * r.h * 4);
    gl.readPixels(r.x, this.h - r.y - r.h, r.w, r.h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += px[i];
    return Math.round(sum / (px.length / 4));
  }

  /** Copies the current canvas into `tex`. */
  snapshot(tex: WebGLTexture) {
    const gl = this.gl;
    this.begin();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, this.w, this.h, 0);
    this.end();
  }

  /** Paints the paper texture back through soft circular dabs (device px, y from top). */
  eraseDabs(dabs: Dab[], hardness = 0.6) {
    const gl = this.gl;
    this.begin();
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.eraseProg);
    gl.bindTexture(gl.TEXTURE_2D, this.paperTex);
    gl.uniform1i(this.u.ePaper, 0);
    gl.uniform2f(this.u.eRes, this.w, this.h);
    gl.uniform1f(this.u.eHard, hardness);
    for (const d of dabs) {
      gl.uniform2f(this.u.eCenter, d.x, this.h - d.y);
      gl.uniform1f(this.u.eRadius, d.r);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    this.end();
  }
}
