/*
 * p5.brush Realtime Studio
 * ------------------------
 * Freehand drawing rendered by the *real* p5.brush 2.2.2 engine (standalone build,
 * lib/brush.js). Every stroke you draw becomes a brush.Plot that p5.brush stamps
 * with your registered brush (custom tip texture, gaussian pressure envelope,
 * scatter, spacing, markerTip, per-stroke noise) and composites with its spectral
 * pigment-mixing shader — so the result matches brush.line()/brush.spline() in a
 * p5 sketch.
 *
 * Architecture
 *  - One WebGL2 canvas. p5.brush owns the compositing; the studio adds a tiny GL
 *    layer for the paper texture, snapshots (undo/preview) and a paper eraser.
 *  - Live preview: while the pointer is down the committed image is restored from
 *    a texture and the in-progress plot is re-stamped every frame with the same
 *    seed (brush.seed), so the stroke you see is the stroke you get on lift.
 *  - Strokes are stored as vector records (points, pressure, spec, seed) so undo,
 *    paper changes, resize and "copy sketch" all replay deterministically.
 */
(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // 0. Guards
  // ---------------------------------------------------------------------------
  const $ = (id) => document.getElementById(id);

  function fatal(msg) {
    const overlay = $('fatal-overlay');
    if (overlay) {
      $('fatal-text').textContent = msg;
      overlay.classList.add('is-visible');
    }
    console.error('[studio] ' + msg);
  }

  if (typeof brush === 'undefined') {
    fatal('lib/brush.js (p5.brush standalone build) did not load.');
    return;
  }

  // ---------------------------------------------------------------------------
  // 1. The user's brush specification — passed to brush.add() verbatim
  // ---------------------------------------------------------------------------
  const DEFAULT_TIP_SOURCE =
`_m.fill(0, 150);
_m.rotate(45);
_m.rect(-10, -10, 25, 25);
_m.rect(10, 10, 15, 15);`;

  const DEFAULT_SPEC = {
    type: 'custom',
    weight: 29,
    scatter: 0.45,
    opacity: 6,
    spacing: 0.4,
    noise: 1,
    pressure: { mode: 'gaussian', curve: [0.36, 0.25], min_max: [0.48, 1.06] },
    rotate: 'none',
    markerTip: true,
  };

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------------------------------------------------------------------------
  // 2. p5-style tip surface shim
  //    p5.brush (standalone) hands the tip function a minimal 2D surface whose
  //    fill() ignores alpha and whose rotate() is always radians. The Brush Maker
  //    runs in p5 with angleMode(DEGREES), so we wrap the surface with a p5-like
  //    API: fill(gray, alpha), fill(r,g,b,a), degrees, rectMode, shapes…
  // ---------------------------------------------------------------------------
  function createTipShim(surface, degrees = true) {
    const ctx = surface.drawingContext;
    const st = { fill: 'rgb(255,255,255)', stroke: null, lineWidth: 1, degrees, rectMode: 'corner', ellipseMode: 'center', shape: null };
    const stack = [];
    const ang = (a) => (st.degrees ? (a * Math.PI) / 180 : a);
    const n255 = (v) => clamp(Math.round(v), 0, 255);

    function toCss(args) {
      if (args.length === 1 && Array.isArray(args[0])) args = args[0];
      const a = args;
      if (a.length === 0) return 'rgb(0,0,0)';
      if (typeof a[0] === 'string') return a[0];
      if (a.length === 1) return `rgb(${n255(a[0])},${n255(a[0])},${n255(a[0])})`;
      if (a.length === 2) return `rgba(${n255(a[0])},${n255(a[0])},${n255(a[0])},${clamp(a[1] / 255, 0, 1)})`;
      if (a.length === 3) return `rgb(${n255(a[0])},${n255(a[1])},${n255(a[2])})`;
      return `rgba(${n255(a[0])},${n255(a[1])},${n255(a[2])},${clamp(a[3] / 255, 0, 1)})`;
    }
    function paint() {
      if (st.fill) { ctx.fillStyle = st.fill; ctx.fill(); }
      if (st.stroke) { ctx.strokeStyle = st.stroke; ctx.lineWidth = st.lineWidth; ctx.stroke(); }
    }
    function rectCoords(x, y, w, h) {
      switch (st.rectMode) {
        case 'center': return [x - w / 2, y - h / 2, w, h];
        case 'radius': return [x - w, y - h, w * 2, h * 2];
        case 'corners': return [x, y, w - x, h - y];
        default: return [x, y, w, h];
      }
    }
    function ellipseCoords(x, y, w, h) {
      switch (st.ellipseMode) {
        case 'corner': return [x + w / 2, y + h / 2, w, h];
        case 'radius': return [x, y, w * 2, h * 2];
        case 'corners': return [(x + w) / 2, (y + h) / 2, w - x, h - y];
        default: return [x, y, w, h];
      }
    }

    const m = {
      PI: Math.PI, TWO_PI: Math.PI * 2, TAU: Math.PI * 2, HALF_PI: Math.PI / 2, QUARTER_PI: Math.PI / 4,
      CLOSE: 'close', DEGREES: 'degrees', RADIANS: 'radians',
      CENTER: 'center', CORNER: 'corner', CORNERS: 'corners', RADIUS: 'radius',
      OPEN: 'open', CHORD: 'chord', PIE: 'pie',
      width: 100, height: 100, drawingContext: ctx,
      push() { ctx.save(); stack.push({ ...st }); },
      pop() { ctx.restore(); const s = stack.pop(); if (s) Object.assign(st, s); },
      translate(x, y = 0) { ctx.translate(x, y); },
      rotate(a) { ctx.rotate(ang(a)); },
      scale(x, y = x) { ctx.scale(x, y); },
      shearX() {}, shearY() {},
      angleMode(mode) { st.degrees = mode === 'degrees'; },
      rectMode(mode) { st.rectMode = mode; },
      ellipseMode(mode) { st.ellipseMode = mode; },
      fill(...a) { st.fill = toCss(a); },
      noFill() { st.fill = null; },
      stroke(...a) { st.stroke = toCss(a); },
      noStroke() { st.stroke = null; },
      strokeWeight(w) { st.lineWidth = w; },
      strokeCap(c) { ctx.lineCap = c === 'square' ? 'butt' : c === 'project' ? 'square' : 'round'; },
      strokeJoin(j) { ctx.lineJoin = j || 'miter'; },
      color(...a) { return toCss(a); },
      background(...a) {
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = toCss(a); ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.restore();
      },
      clear() {
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore();
      },
      rect(x, y, w, h = w, r) {
        const [rx, ry, rw, rh] = rectCoords(x, y, w, h);
        ctx.beginPath();
        if (r && ctx.roundRect) ctx.roundRect(rx, ry, rw, rh, r); else ctx.rect(rx, ry, rw, rh);
        paint();
      },
      square(x, y, s, r) { m.rect(x, y, s, s, r); },
      ellipse(x, y, w, h = w) {
        const [cx, cy, ew, eh] = ellipseCoords(x, y, w, h);
        ctx.beginPath(); ctx.ellipse(cx, cy, Math.abs(ew) / 2, Math.abs(eh) / 2, 0, 0, Math.PI * 2); paint();
      },
      circle(x, y, d) { m.ellipse(x, y, d, d); },
      arc(x, y, w, h, start, stop, mode) {
        const [cx, cy, ew, eh] = ellipseCoords(x, y, w, h);
        ctx.beginPath();
        if (mode === 'pie') ctx.moveTo(cx, cy);
        ctx.ellipse(cx, cy, Math.abs(ew) / 2, Math.abs(eh) / 2, 0, ang(start), ang(stop));
        if (mode === 'pie' || mode === 'chord') ctx.closePath();
        paint();
      },
      line(x1, y1, x2, y2) {
        if (!st.stroke) return;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        ctx.strokeStyle = st.stroke; ctx.lineWidth = st.lineWidth; ctx.stroke();
      },
      point(x, y) {
        if (!st.stroke) return;
        ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, st.lineWidth / 2), 0, Math.PI * 2);
        ctx.fillStyle = st.stroke; ctx.fill();
      },
      triangle(x1, y1, x2, y2, x3, y3) {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath(); paint();
      },
      quad(x1, y1, x2, y2, x3, y3, x4, y4) {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath(); paint();
      },
      bezier(x1, y1, x2, y2, x3, y3, x4, y4) {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.bezierCurveTo(x2, y2, x3, y3, x4, y4); paint();
      },
      beginShape() { ctx.beginPath(); st.shape = 0; },
      vertex(x, y) { if (st.shape) ctx.lineTo(x, y); else ctx.moveTo(x, y); st.shape = (st.shape || 0) + 1; },
      curveVertex(x, y) { m.vertex(x, y); },
      bezierVertex(x2, y2, x3, y3, x4, y4) { ctx.bezierCurveTo(x2, y2, x3, y3, x4, y4); st.shape++; },
      quadraticVertex(cx, cy, x, y) { ctx.quadraticCurveTo(cx, cy, x, y); st.shape++; },
      endShape(mode) { if (mode === 'close') ctx.closePath(); paint(); st.shape = null; },
      noSmooth() {}, smooth() {}, pixelDensity() { return 1; },
      random(a = 1, b) { return b === undefined ? Math.random() * a : a + Math.random() * (b - a); },
      map(v, a, b, c, d) { return c + ((v - a) / (b - a)) * (d - c); },
      lerp(a, b, t) { return a + (b - a) * t; },
      radians(d) { return (d * Math.PI) / 180; },
      degrees(r) { return (r * 180) / Math.PI; },
      sin: Math.sin, cos: Math.cos, abs: Math.abs, min: Math.min, max: Math.max, sqrt: Math.sqrt, floor: Math.floor,
    };
    return m;
  }

  function compileTip(source, degrees = false) {
    // The tip body is authored exactly as in the Brush Maker: statements on `_m`.
    // NOTE: a p5.Graphics keeps its own angleMode (RADIANS) even when the sketch
    // calls angleMode(DEGREES), so the faithful default is radians.
    // eslint-disable-next-line no-new-func
    const fn = new Function('_m', source);
    return (surface) => fn(createTipShim(surface, degrees));
  }

  // ---------------------------------------------------------------------------
  // 3. Studio GL layer: paper, snapshots, eraser (co-exists with p5.brush's GL)
  // ---------------------------------------------------------------------------
  const BLIT_VERT = `#version 300 es
    in vec2 a_pos; out vec2 v_uv;
    void main(){ v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }`;
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

  class StudioGL {
    constructor(gl) {
      this.gl = gl;
      this.w = 1; this.h = 1;
      this.blitProg = this._program(BLIT_VERT, BLIT_FRAG);
      this.eraseProg = this._program(ERASE_VERT, ERASE_FRAG);
      this.u = {
        blitTex: gl.getUniformLocation(this.blitProg, 'u_tex'),
        ePaper: gl.getUniformLocation(this.eraseProg, 'u_paper'),
        eCenter: gl.getUniformLocation(this.eraseProg, 'u_center'),
        eRadius: gl.getUniformLocation(this.eraseProg, 'u_radius'),
        eRes: gl.getUniformLocation(this.eraseProg, 'u_res'),
        eHard: gl.getUniformLocation(this.eraseProg, 'u_hard'),
      };
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(this.blitProg, 'a_pos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const loc2 = gl.getAttribLocation(this.eraseProg, 'a_pos');
      if (loc2 !== loc) { gl.enableVertexAttribArray(loc2); gl.vertexAttribPointer(loc2, 2, gl.FLOAT, false, 0, 0); }
      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      this.paperTex = this.createTexture();
      this.committedTex = this.createTexture();
    }
    _program(vs, fs) {
      const gl = this.gl, p = gl.createProgram();
      for (const [t, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
        const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        gl.attachShader(p, s);
      }
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      return p;
    }
    setSize(w, h) { this.w = w; this.h = h; }
    createTexture() {
      const gl = this.gl, t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture(gl.TEXTURE_2D, null);
      return t;
    }
    deleteTexture(t) { this.gl.deleteTexture(t); }
    uploadPaper(canvas2d) {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.paperTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas2d);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
    _begin() {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.w, this.h);
      gl.disable(gl.SCISSOR_TEST);
      gl.disable(gl.DEPTH_TEST);
      gl.bindVertexArray(this.vao);
      gl.activeTexture(gl.TEXTURE0);
    }
    _end() {
      // Leave GL the way p5.brush's standalone adapter expects to find it.
      const gl = this.gl;
      gl.bindVertexArray(null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.useProgram(null);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
    blit(tex) {
      const gl = this.gl;
      this._begin();
      gl.disable(gl.BLEND);
      gl.useProgram(this.blitProg);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(this.u.blitTex, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this._end();
    }
    snapshot(tex) {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, this.w, this.h, 0);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
    eraseDabs(dabs, hardness = 0.6) {
      // dabs: [{x, y, r}] in device pixels, y measured from the top.
      const gl = this.gl;
      this._begin();
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
      this._end();
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Studio state
  // ---------------------------------------------------------------------------
  const colorSwatches = [
    { name: 'Sumi Ink', hex: '#1a1c23' },
    { name: 'Charcoal Slate', hex: '#3b3e47' },
    { name: 'Burnt Umber', hex: '#4d2c1d' },
    { name: 'Indigo Blue', hex: '#1c325c' },
    { name: 'Vermillion', hex: '#992a22' },
    { name: 'Olive Moss', hex: '#2b462f' },
    { name: 'Warm Ochre', hex: '#9b681e' },
    { name: 'Cobalt Teal', hex: '#1f6f7a' },
  ];

  const paperPresets = {
    hotpress: { bg: [255, 254, 250], grain: 2.2, label: 'Hot Press Fine Art' },
    washi: { bg: [250, 247, 240], grain: 3.8, label: 'Warm Japanese Washi' },
    bristol: { bg: [255, 255, 255], grain: 1.0, label: 'Smooth Bristol Pure White' },
  };

  const S = {
    spec: clone(DEFAULT_SPEC),
    tipSource: DEFAULT_TIP_SOURCE,
    tipDegrees: false,       // false = p5.Graphics/standalone behaviour (radians)
    size: 1,                 // brush.set(name, color, size) → strokeWeight
    color: '#1a1c23',
    paper: 'hotpress',
    tool: 'brush',           // 'brush' | 'eraser'
    eraserSize: 24,
    pressureMode: 'gaussian',// 'gaussian' | 'both' | 'stylus'
    forceSensitivity: 1.25,
    pencilOnly: false,
    strokes: [],             // committed records
    redo: [],
    checkpoints: [],         // [{ count, tex }]
  };
  const CHECKPOINT_EVERY = 6;
  const MAX_CHECKPOINTS = 4;

  let canvas, gl, sgl;
  let cssW = 0, cssH = 0, dpr = 1, glW = 1, glH = 1;
  let live = null;          // in-progress stroke
  let previewQueued = false;
  let lastStampCount = 0;

  // ---------------------------------------------------------------------------
  // 5. Brush registration (bounded pool of p5.brush brush names)
  // ---------------------------------------------------------------------------
  const POOL = 24;
  const registry = new Map(); // key → { name, tick }
  let regTick = 0;

  function specForRecord(rec) {
    // The record carries the exact spec used; 'stylus' pressure mode swaps the
    // simulated envelope for a constant so only the plot pressure remains.
    const spec = clone(rec.spec);
    if (rec.pressureMode === 'stylus') {
      spec.pressure = { mode: 'gaussian', curve: [0, 0], min_max: [1, 1] };
    }
    return spec;
  }

  function brushKey(rec) {
    return JSON.stringify(specForRecord(rec)) + '|' + rec.tipSource + '|' + (rec.tipDegrees ? 'deg' : 'rad') + '|' + rec.pressureMode;
  }

  function ensureRegistered(rec) {
    const key = brushKey(rec);
    let entry = registry.get(key);
    if (entry) { entry.tick = ++regTick; return entry.name; }
    let name;
    if (registry.size < POOL) {
      name = 'studio-' + registry.size;
    } else {
      // Evict least-recently-used pool slot.
      let oldest = null, oldestKey = null;
      for (const [k, e] of registry) if (!oldest || e.tick < oldest.tick) { oldest = e; oldestKey = k; }
      registry.delete(oldestKey);
      name = oldest.name;
    }
    const params = specForRecord(rec);
    params.tip = compileTip(rec.tipSource, !!rec.tipDegrees);
    brush.add(name, params);
    registry.set(key, { name, tick: ++regTick });
    return name;
  }

  // ---------------------------------------------------------------------------
  // 6. Path → brush.Plot
  // ---------------------------------------------------------------------------
  function resamplePath(points, segLen) {
    // Uniform arc-length resampling. Segment boundaries then align with p5.brush's
    // stamping step (segLen is a multiple of spacing), avoiding integration drift.
    if (points.length === 0) return [];
    const out = [{ x: points[0].x, y: points[0].y, p: points[0].p }];
    let carry = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      let d = segLen - carry;
      while (d <= len) {
        const t = d / len;
        out.push({ x: a.x + dx * t, y: a.y + dy * t, p: a.p + (b.p - a.p) * t });
        d += segLen;
      }
      carry = len - (d - segLen);
    }
    const last = points[points.length - 1];
    const tail = out[out.length - 1];
    if (Math.hypot(last.x - tail.x, last.y - tail.y) > segLen * 0.35) out.push({ x: last.x, y: last.y, p: last.p });
    return out;
  }

  function segmentLengthFor(spacing) {
    const k = Math.max(1, Math.round(2 / spacing));
    return spacing * k;
  }

  function mapStylus(p, sensitivity) {
    // Mouse/touch report 0.5 → 1.0. Pen force curves around that neutral point.
    return clamp(Math.pow(Math.max(p, 0.02) / 0.5, 0.75 * sensitivity), 0.3, 1.6);
  }

  function pressureFnFor(rec) {
    if (rec.pressureMode === 'gaussian') return () => 1;
    const s = rec.sensitivity;
    return (pt) => mapStylus(pt.p, s);
  }

  function buildPlot(rec) {
    const segLen = segmentLengthFor(rec.spec.spacing);
    let pts = resamplePath(rec.points, segLen);
    if (pts.length < 2) {
      const p0 = pts[0] || rec.points[0];
      pts = [p0, { x: p0.x + segLen, y: p0.y, p: p0.p }];
    }
    const pf = pressureFnFor(rec);
    const plot = new brush.Plot('curve');
    let lastA = 0, stamps = 0;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      lastA = (Math.atan2(-dy, dx) * 180) / Math.PI;
      plot.addSegment(lastA, len, pf(pts[i - 1]), true);
      stamps += len / rec.spec.spacing;
    }
    plot.endPlot(lastA, pf(pts[pts.length - 1]), true);
    lastStampCount = Math.round(stamps);
    return { plot, origin: pts[0] };
  }

  // ---------------------------------------------------------------------------
  // 7. Rendering
  // ---------------------------------------------------------------------------
  function renderBrushStroke(rec) {
    const name = ensureRegistered(rec);
    const { plot, origin } = buildPlot(rec);
    brush.seed(rec.seed);
    brush.push();
    brush.translate(-glW / 2, -glH / 2); // p5.brush origin is the canvas centre
    brush.scale(dpr);                    // work in CSS pixels
    brush.set(name, rec.color, rec.size);
    plot.draw(origin.x, origin.y, 1);
    brush.pop();
    brush.render();
  }

  function eraserDabsFor(rec, fromIndex = 1) {
    const dabs = [];
    const r = (rec.size / 2) * dpr;
    const step = Math.max(0.75, rec.size * 0.12);
    const pts = rec.points;
    if (pts.length === 1 || fromIndex === 0) dabs.push({ x: pts[0].x * dpr, y: pts[0].y * dpr, r });
    for (let i = Math.max(1, fromIndex); i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const n = Math.max(1, Math.ceil(len / step));
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        dabs.push({ x: (a.x + (b.x - a.x) * t) * dpr, y: (a.y + (b.y - a.y) * t) * dpr, r });
      }
    }
    return dabs;
  }

  function renderRecord(rec) {
    if (rec.tool === 'eraser') sgl.eraseDabs(eraserDabsFor(rec, 0));
    else renderBrushStroke(rec);
  }

  function rebuildFrom(startCount, baseTex) {
    sgl.blit(baseTex);
    for (let i = startCount; i < S.strokes.length; i++) renderRecord(S.strokes[i]);
    sgl.snapshot(sgl.committedTex);
  }

  function rebuildAll() {
    // Checkpoints are resolution-bound; drop them and replay from the paper.
    for (const c of S.checkpoints) sgl.deleteTexture(c.tex);
    S.checkpoints = [];
    rebuildFrom(0, sgl.paperTex);
  }

  function maybeCheckpoint() {
    const n = S.strokes.length;
    if (n === 0 || n % CHECKPOINT_EVERY !== 0) return;
    const tex = sgl.createTexture();
    sgl.snapshot(tex);
    S.checkpoints.push({ count: n, tex });
    while (S.checkpoints.length > MAX_CHECKPOINTS) sgl.deleteTexture(S.checkpoints.shift().tex);
  }

  function commitRecord(rec) {
    sgl.blit(sgl.committedTex);
    renderRecord(rec);
    sgl.snapshot(sgl.committedTex);
    S.strokes.push(rec);
    S.redo = [];
    maybeCheckpoint();
    updateHistoryButtons();
  }

  function undo() {
    if (!S.strokes.length) { showToast('Nothing to undo'); return; }
    S.redo.push(S.strokes.pop());
    const n = S.strokes.length;
    while (S.checkpoints.length && S.checkpoints[S.checkpoints.length - 1].count > n) {
      sgl.deleteTexture(S.checkpoints.pop().tex);
    }
    const cp = S.checkpoints[S.checkpoints.length - 1];
    if (cp) rebuildFrom(cp.count, cp.tex); else rebuildFrom(0, sgl.paperTex);
    updateHistoryButtons();
    showToast('Undo');
  }

  function redo() {
    if (!S.redo.length) return;
    const rec = S.redo.pop();
    sgl.blit(sgl.committedTex);
    renderRecord(rec);
    sgl.snapshot(sgl.committedTex);
    S.strokes.push(rec);
    maybeCheckpoint();
    updateHistoryButtons();
    showToast('Redo');
  }

  function clearCanvas() {
    S.strokes = []; S.redo = [];
    for (const c of S.checkpoints) sgl.deleteTexture(c.tex);
    S.checkpoints = [];
    sgl.blit(sgl.paperTex);
    sgl.snapshot(sgl.committedTex);
    updateHistoryButtons();
    showToast('White paper pristine');
  }

  // ---------------------------------------------------------------------------
  // 8. Paper texture
  // ---------------------------------------------------------------------------
  function renderPaper() {
    const conf = paperPresets[S.paper] || paperPresets.hotpress;
    const c = document.createElement('canvas');
    c.width = glW; c.height = glH;
    const ctx = c.getContext('2d');
    ctx.fillStyle = `rgb(${conf.bg[0]}, ${conf.bg[1]}, ${conf.bg[2]})`;
    ctx.fillRect(0, 0, glW, glH);

    const grainSize = 256;
    const g = document.createElement('canvas');
    g.width = g.height = grainSize;
    const gctx = g.getContext('2d');
    const img = gctx.createImageData(grainSize, grainSize);
    const d = img.data;
    const amp = conf.grain * 7;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() + Math.random() - 1) * amp; // triangular noise
      d[i] = clamp(conf.bg[0] + n, 0, 255);
      d[i + 1] = clamp(conf.bg[1] + n, 0, 255);
      d[i + 2] = clamp(conf.bg[2] + n * 0.9, 0, 255);
      d[i + 3] = 255;
    }
    gctx.putImageData(img, 0, 0);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.fillStyle = ctx.createPattern(g, 'repeat');
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.restore();

    // Soft vignette + deckle edge
    const vg = ctx.createRadialGradient(glW / 2, glH / 2, Math.min(glW, glH) * 0.35, glW / 2, glH / 2, Math.hypot(glW, glH) * 0.6);
    vg.addColorStop(0, 'rgba(120,100,70,0)');
    vg.addColorStop(1, 'rgba(120,100,70,0.06)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, glW, glH);
    ctx.lineWidth = dpr;
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = `rgba(180,170,155,${0.12 - i * 0.025})`;
      ctx.strokeRect(i * dpr + 0.5, i * dpr + 0.5, glW - i * 2 * dpr - 1, glH - i * 2 * dpr - 1);
    }
    sgl.uploadPaper(c);
  }

  // ---------------------------------------------------------------------------
  // 9. Canvas sizing + p5.brush target
  // ---------------------------------------------------------------------------
  function resize() {
    const desk = $('studio-desk');
    cssW = desk.clientWidth || window.innerWidth;
    cssH = desk.clientHeight || window.innerHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    glW = Math.max(1, Math.round(cssW * dpr));
    glH = Math.max(1, Math.round(cssH * dpr));
    canvas.width = glW; canvas.height = glH;
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    sgl.setSize(glW, glH);
    brush.load(canvas);      // (re)registers the target with its new size
    brush.noFill(); brush.noHatch(); brush.noField();
    renderPaper();
    rebuildAll();
  }

  let resizeTimer = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (!live) resize(); }, 150);
  }

  // ---------------------------------------------------------------------------
  // 10. Input (Pointer Events, coalesced for Apple Pencil 120 Hz)
  // ---------------------------------------------------------------------------
  function pointFromEvent(e, rect) {
    let p = e.pressure;
    if (!(p > 0)) p = e.pointerType === 'pen' ? 0.02 : 0.5;
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, p, tx: e.tiltX || 0, ty: e.tiltY || 0 };
  }

  function newRecord(firstPt) {
    if (S.tool === 'eraser') {
      return { tool: 'eraser', size: S.eraserSize, points: [firstPt] };
    }
    return {
      tool: 'brush',
      spec: clone(S.spec),
      tipSource: S.tipSource,
      tipDegrees: S.tipDegrees,
      size: S.size,
      color: S.color,
      pressureMode: S.pressureMode,
      sensitivity: S.forceSensitivity,
      seed: (Math.random() * 2147483647) | 0,
      points: [firstPt],
    };
  }

  function onPointerDown(e) {
    if (e.target !== canvas) return;
    if (live) return;
    if (S.pencilOnly && e.pointerType !== 'pen') { showToast('Pencil-only mode: touch ignored'); return; }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    const rect = canvas.getBoundingClientRect();
    const pt = pointFromEvent(e, rect);
    live = { id: e.pointerId, rect, rec: newRecord(pt), erasedUpTo: 0 };
    updateTelemetry(e);
    if (live.rec.tool === 'eraser') {
      sgl.eraseDabs(eraserDabsFor(live.rec, 0));
      live.erasedUpTo = 1;
    } else {
      schedulePreview();
    }
  }

  function onPointerMove(e) {
    if (!live || e.pointerId !== live.id) return;
    e.preventDefault();
    updateTelemetry(e);
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null;
    const list = events && events.length ? events : [e];
    const pts = live.rec.points;
    for (const ev of list) {
      const pt = pointFromEvent(ev, live.rect);
      const last = pts[pts.length - 1];
      if (Math.abs(pt.x - last.x) < 0.15 && Math.abs(pt.y - last.y) < 0.15) { last.p = pt.p; continue; }
      pts.push(pt);
    }
    if (live.rec.tool === 'eraser') {
      if (pts.length > live.erasedUpTo) {
        sgl.eraseDabs(eraserDabsFor(live.rec, live.erasedUpTo));
        live.erasedUpTo = pts.length;
      }
    } else {
      schedulePreview();
    }
  }

  function onPointerUp(e) {
    if (!live || e.pointerId !== live.id) return;
    e.preventDefault();
    const rec = live.rec;
    live = null;
    previewQueued = false;
    $('hud-pressure-bar').style.width = '0%';
    $('hud-pressure-val').textContent = '0.00';
    if (rec.tool === 'eraser') {
      // Already applied live; freeze the result.
      sgl.snapshot(sgl.committedTex);
      S.strokes.push(rec); S.redo = [];
      maybeCheckpoint();
      updateHistoryButtons();
    } else {
      commitRecord(rec);
      $('hud-stamps').textContent = String(lastStampCount);
    }
  }

  function schedulePreview() {
    if (previewQueued) return;
    previewQueued = true;
    requestAnimationFrame(renderPreview);
  }

  function renderPreview() {
    previewQueued = false;
    if (!live || live.rec.tool !== 'brush') return;
    sgl.blit(sgl.committedTex);
    renderBrushStroke(live.rec);
    $('hud-stamps').textContent = String(lastStampCount);
  }

  function updateTelemetry(e) {
    const badge = $('stylus-badge');
    const isPen = e.pointerType === 'pen';
    badge.textContent = isPen ? 'APPLE PENCIL' : (e.pointerType || 'pointer').toUpperCase();
    badge.className = isPen
      ? 'px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200'
      : 'px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200';
    const p = e.pressure > 0 ? e.pressure : 0;
    $('hud-pressure-bar').style.width = `${Math.round(clamp(p, 0, 1) * 100)}%`;
    $('hud-pressure-val').textContent = p.toFixed(2);
    $('hud-tilt').textContent = `${Math.round(e.tiltX || 0)}°, ${Math.round(e.tiltY || 0)}°`;
  }

  // ---------------------------------------------------------------------------
  // 11. Sample stroke (goes through the exact same pipeline)
  // ---------------------------------------------------------------------------
  function drawSampleStroke() {
    const cx = cssW / 2, cy = cssH / 2;
    const rx = Math.min(cssW * 0.32, 260), ry = Math.min(cssH * 0.22, 120);
    const points = [];
    const steps = 160;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, a = t * Math.PI * 2;
      points.push({ x: cx + Math.sin(a) * rx, y: cy + Math.sin(a * 2) * ry, p: 0.5 + 0.4 * Math.sin(a * 3) ** 2 });
    }
    const rec = newRecord(points[0]);
    if (rec.tool === 'eraser') { setTool('brush'); return drawSampleStroke(); }
    rec.points = points;
    commitRecord(rec);
    $('hud-stamps').textContent = String(lastStampCount);
    showToast('p5.brush sample stroke (lemniscate)');
  }

  // ---------------------------------------------------------------------------
  // 12. Spec code generation / import / p5 sketch export
  // ---------------------------------------------------------------------------
  function fmt(n) { return Number.isInteger(n) ? String(n) : String(+n.toFixed(3)); }

  function specCode(spec = S.spec, tipSource = S.tipSource, name = 'myBrush', tipDegrees = S.tipDegrees) {
    const p = spec.pressure;
    const pressure = `{ mode: "gaussian", curve: [${fmt(p.curve[0])}, ${fmt(p.curve[1])}], min_max: [${fmt(p.min_max[0])}, ${fmt(p.min_max[1])}] }`;
    const tipLines = tipSource.split('\n').map((l) => l.trim()).filter(Boolean);
    if (tipDegrees) tipLines.unshift('_m.angleMode(_m.DEGREES ?? "degrees");');
    const tip = tipLines.map((l) => '      ' + l).join('\n');
    return `brush.add("${name}", {
  type:    "custom",
  weight:  ${fmt(spec.weight)},
  scatter: ${fmt(spec.scatter)},
  opacity: ${fmt(spec.opacity)},
  spacing: ${fmt(spec.spacing)},
  noise:   ${fmt(spec.noise)},
  pressure: ${pressure},
  rotate:  "${spec.rotate}",
  markerTip: ${spec.markerTip},
  tip: (_m) => {
${tip}
  },
});`;
  }

  function parseSpecCode(text) {
    const m = /brush\.add\s*\(\s*(["'`])([^"'`]*)\1\s*,\s*(\{[\s\S]*\})\s*\)\s*;?\s*$/.exec(text.trim());
    if (!m) throw new Error('Expected brush.add("name", { ... })');
    // eslint-disable-next-line no-new-func
    const cfg = new Function(`"use strict"; return (${m[3]});`)();
    if (cfg.type && cfg.type !== 'custom') throw new Error('Only type: "custom" brushes are supported here');
    if (typeof cfg.tip !== 'function') throw new Error('Missing tip: (_m) => { ... }');
    const src = cfg.tip.toString();
    const bodyMatch = /^[^{]*\{([\s\S]*)\}\s*$/.exec(src);
    let body = bodyMatch ? bodyMatch[1] : '';
    body = body.split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
    const spec = clone(DEFAULT_SPEC);
    for (const k of ['weight', 'scatter', 'opacity', 'spacing', 'noise']) if (typeof cfg[k] === 'number') spec[k] = cfg[k];
    if (cfg.vibration !== undefined && cfg.scatter === undefined) spec.scatter = cfg.vibration;
    if (cfg.rotate) spec.rotate = cfg.rotate;
    if (cfg.markerTip !== undefined) spec.markerTip = !!cfg.markerTip;
    const pr = cfg.pressure;
    if (pr && !Array.isArray(pr) && typeof pr === 'object' && Array.isArray(pr.curve) && Array.isArray(pr.min_max)) {
      spec.pressure = { mode: 'gaussian', curve: [+pr.curve[0], +pr.curve[1]], min_max: [+pr.min_max[0], +pr.min_max[1]] };
    } else if (Array.isArray(pr)) {
      // Simple [start, end] / [start, mid, end] ramps: approximate with a gaussian envelope.
      const lo = Math.min(...pr), hi = Math.max(...pr);
      spec.pressure = { mode: 'gaussian', curve: [0.2, 0.25], min_max: [lo, hi] };
    }
    // A leading angleMode(DEGREES) line (emitted by this studio) is folded into the toggle.
    let tipDegrees = false;
    const bodyLines = body.split('\n');
    if (bodyLines.length && /angleMode\s*\(/.test(bodyLines[0])) {
      tipDegrees = /degrees/i.test(bodyLines[0]);
      body = bodyLines.slice(1).join('\n');
    }
    compileTip(body, tipDegrees)({ drawingContext: document.createElement('canvas').getContext('2d') }); // syntax check
    return { spec, tipSource: body, tipDegrees, name: m[2] };
  }

  function sketchCode() {
    const W = Math.round(cssW), H = Math.round(cssH);
    const conf = paperPresets[S.paper];
    const bg = `rgb(${conf.bg.join(', ')})`;
    const lines = [];
    lines.push('// p5.js + p5.brush 2.2.2 — exported from p5.brush Realtime Studio');
    lines.push('// <script src="https://cdn.jsdelivr.net/npm/p5@1.11.3/lib/p5.min.js"></script>');
    lines.push('// <script src="https://cdn.jsdelivr.net/npm/p5.brush@2.2.2/dist/p5.brush.js"></script>');
    lines.push('');
    lines.push('const BRUSHES = {};');
    lines.push('function setup() {');
    lines.push(`  createCanvas(${W}, ${H}, WEBGL);`);
    lines.push(`  pixelDensity(${dpr});`);
    lines.push('  angleMode(DEGREES);');
    lines.push('  noLoop();');
    lines.push('}');
    lines.push('');
    lines.push('function draw() {');
    lines.push(`  background("${bg}");`);
    lines.push('  translate(-width / 2, -height / 2);');
    let names = new Map();
    for (const rec of S.strokes) {
      if (rec.tool !== 'brush') { lines.push('  // (eraser stroke omitted)'); continue; }
      const key = brushKey(rec);
      let name = names.get(key);
      if (!name) {
        name = 'studioBrush' + names.size;
        names.set(key, name);
        const sp = specForRecord(rec);
        lines.push('  ' + specCode(sp, rec.tipSource, name, !!rec.tipDegrees).replace(/\n/g, '\n  '));
      }
      const segLen = segmentLengthFor(rec.spec.spacing);
      let pts = resamplePath(rec.points, segLen);
      if (pts.length < 2) { const p0 = pts[0] || rec.points[0]; pts = [p0, { x: p0.x + segLen, y: p0.y, p: p0.p }]; }
      const pf = pressureFnFor(rec);
      lines.push(`  randomSeed(${rec.seed});`);
      lines.push(`  brush.set("${name}", "${rec.color}", ${fmt(rec.size)});`);
      lines.push(`  brush.beginStroke("curve", ${fmt(pts[0].x)}, ${fmt(pts[0].y)});`);
      let lastA = 0;
      for (let i = 1; i < pts.length; i++) {
        const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
        const len = Math.hypot(dx, dy);
        if (len < 1e-6) continue;
        lastA = ((Math.atan2(-dy, dx) * 180) / Math.PI + 360) % 360;
        lines.push(`  brush.move(${fmt(lastA)}, ${fmt(len)}, ${fmt(pf(pts[i - 1]))});`);
      }
      lines.push(`  brush.endStroke(${fmt(lastA)}, ${fmt(pf(pts[pts.length - 1]))});`);
    }
    lines.push('}');
    return lines.join('\n');
  }

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(label + ' copied to clipboard');
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); showToast(label + ' copied'); } catch (e) { showToast('Copy failed'); }
      ta.remove();
    }
  }

  // ---------------------------------------------------------------------------
  // 13. Export PNG
  // ---------------------------------------------------------------------------
  function exportPNG() {
    // Make sure the committed image is what gets exported (a stale preview could be up).
    sgl.blit(sgl.committedTex);
    canvas.toBlob((blob) => {
      if (!blob) { showToast('Export failed'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `p5brush-studio-${Date.now()}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      showToast(`Exported ${glW}×${glH} PNG`);
    }, 'image/png');
  }

  // ---------------------------------------------------------------------------
  // 14. UI
  // ---------------------------------------------------------------------------
  let toastTimer = 0;
  function showToast(msg) {
    const wrap = $('toast-wrap');
    $('toast-text').textContent = msg;
    wrap.classList.remove('is-hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => wrap.classList.add('is-hidden'), 2400);
  }

  function updateHistoryButtons() {
    $('btn-undo').disabled = S.strokes.length === 0;
    $('btn-redo').disabled = S.redo.length === 0;
  }

  function drawTipPreview() {
    const c = $('tip-preview-canvas');
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.save();
    ctx.translate(c.width / 2, c.height / 2);
    ctx.scale(c.width / 100, c.height / 100);
    ctx.strokeStyle = 'rgba(99,102,241,0.35)';
    ctx.lineWidth = 0.6;
    ctx.strokeRect(-50, -50, 100, 100);
    try {
      compileTip(S.tipSource, S.tipDegrees)({ drawingContext: ctx });
      $('tip-error').classList.add('hidden');
      $('tip-code').classList.remove('is-invalid');
    } catch (err) {
      $('tip-error').classList.remove('hidden');
      $('tip-code').classList.add('is-invalid');
    }
    ctx.restore();
  }

  function refreshSpecUI() {
    const sp = S.spec;
    $('param-weight').value = sp.weight; $('val-weight').textContent = fmt(sp.weight);
    $('param-opacity').value = sp.opacity; $('val-opacity').textContent = fmt(sp.opacity);
    $('param-scatter').value = sp.scatter; $('val-scatter').textContent = sp.scatter.toFixed(2);
    $('param-spacing').value = sp.spacing; $('val-spacing').textContent = sp.spacing.toFixed(2);
    $('param-noise').value = sp.noise; $('val-noise').textContent = sp.noise.toFixed(2);
    $('param-size').value = S.size; $('val-size').textContent = S.size.toFixed(2) + '×';
    $('param-rotate').value = sp.rotate;
    $('param-markertip').checked = !!sp.markerTip;
    $('param-curve0').value = sp.pressure.curve[0];
    $('param-curve1').value = sp.pressure.curve[1];
    $('param-pmin').value = sp.pressure.min_max[0];
    $('param-pmax').value = sp.pressure.min_max[1];
    $('brush-size-badge').textContent = `${fmt(sp.weight)}px`;
    $('tip-angle-units').value = S.tipDegrees ? 'degrees' : 'radians';
    if (document.activeElement !== $('tip-code')) $('tip-code').value = S.tipSource;
    if (document.activeElement !== $('spec-code')) { $('spec-code').value = specCode(); $('spec-code').classList.remove('is-invalid'); }
    drawTipPreview();
  }

  function setTool(tool) {
    S.tool = tool;
    $('btn-tool-brush').classList.toggle('is-active', tool === 'brush');
    $('btn-tool-eraser').classList.toggle('is-active', tool === 'eraser');
    canvas.classList.toggle('eraser', tool === 'eraser');
    showToast(tool === 'brush' ? 'Brush selected' : 'Paper eraser selected');
  }

  function selectColor(hex) {
    S.color = hex;
    $('native-color-picker').value = hex;
    $('hex-label').textContent = hex.toUpperCase();
    for (const el of $('swatch-container').children) {
      el.classList.toggle('is-active', el.dataset.hex.toLowerCase() === hex.toLowerCase());
    }
    if (S.tool === 'eraser') setTool('brush');
  }

  function setPaper(name) {
    S.paper = name;
    for (const b of document.querySelectorAll('.paper-btn')) b.classList.toggle('is-active', b.dataset.paper === name);
    $('paper-mode-name').textContent = paperPresets[name].label;
    renderPaper();
    rebuildAll();
    showToast(paperPresets[name].label);
  }

  function setPressureMode(mode) {
    S.pressureMode = mode;
    for (const b of document.querySelectorAll('#pressure-mode-group .seg-btn')) b.classList.toggle('is-active', b.dataset.pmode === mode);
    $('pressure-mode-help').textContent = {
      gaussian: 'Gaussian envelope simulated per stroke, exactly like brush.line() / brush.spline().',
      both: 'p5.brush envelope multiplied by live Apple Pencil force (plot pressure).',
      stylus: 'Envelope disabled — stamp size follows pen force only (constant 1.0 for mouse/touch).',
    }[mode];
  }

  function bindRange(id, onChange, format) {
    const el = $(id);
    el.addEventListener('input', () => {
      const v = parseFloat(el.value);
      onChange(v);
      const label = $(id.replace('param-', 'val-'));
      if (label) label.textContent = format(v);
    });
  }

  function applyTipSource(src) {
    try {
      compileTip(src, S.tipDegrees)({ drawingContext: document.createElement('canvas').getContext('2d') });
      S.tipSource = src;
      refreshSpecUI();
      showToast('Tip updated');
    } catch (err) {
      $('tip-error').classList.remove('hidden');
      $('tip-code').classList.add('is-invalid');
      showToast('Tip code error: ' + err.message);
    }
  }

  function setupUI() {
    // Swatches
    const box = $('swatch-container');
    for (const s of colorSwatches) {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.style.backgroundColor = s.hex;
      b.title = s.name;
      b.dataset.hex = s.hex;
      b.addEventListener('click', () => selectColor(s.hex));
      box.appendChild(b);
    }
    selectColor(S.color);
    $('native-color-picker').addEventListener('input', (e) => selectColor(e.target.value));

    // Tools
    $('btn-tool-brush').addEventListener('click', () => setTool('brush'));
    $('btn-tool-eraser').addEventListener('click', () => setTool('eraser'));
    $('btn-undo').addEventListener('click', undo);
    $('btn-redo').addEventListener('click', redo);
    $('btn-clear').addEventListener('click', clearCanvas);
    $('btn-save').addEventListener('click', exportPNG);
    $('btn-test-stroke').addEventListener('click', drawSampleStroke);
    $('btn-toggle-drawer').addEventListener('click', () => $('controls-drawer').classList.toggle('is-hidden'));

    const setPalm = (on) => {
      S.pencilOnly = on;
      $('toggle-palm').checked = on;
      $('palm-label').textContent = on ? 'Pencil Only' : 'Stylus & Touch';
      $('btn-palm-rejection').classList.toggle('is-active', on);
    };
    $('btn-palm-rejection').addEventListener('click', () => setPalm(!S.pencilOnly));
    $('toggle-palm').addEventListener('change', (e) => setPalm(e.target.checked));

    for (const b of document.querySelectorAll('.paper-btn')) b.addEventListener('click', () => setPaper(b.dataset.paper));
    for (const b of document.querySelectorAll('#pressure-mode-group .seg-btn')) b.addEventListener('click', () => setPressureMode(b.dataset.pmode));

    // brush.add parameters
    const spec = () => S.spec;
    bindRange('param-weight', (v) => { spec().weight = v; $('brush-size-badge').textContent = `${fmt(v)}px`; refreshCode(); }, fmt);
    bindRange('param-opacity', (v) => { spec().opacity = v; refreshCode(); }, fmt);
    bindRange('param-scatter', (v) => { spec().scatter = v; refreshCode(); }, (v) => v.toFixed(2));
    bindRange('param-spacing', (v) => { spec().spacing = v; refreshCode(); }, (v) => v.toFixed(2));
    bindRange('param-noise', (v) => { spec().noise = v; refreshCode(); }, (v) => v.toFixed(2));
    bindRange('param-size', (v) => { S.size = v; }, (v) => v.toFixed(2) + '×');
    bindRange('param-force-sens', (v) => { S.forceSensitivity = v; }, (v) => v.toFixed(2) + 'x');
    bindRange('param-eraser', (v) => { S.eraserSize = v; }, (v) => `${fmt(v)}px`);
    $('param-rotate').addEventListener('change', (e) => { spec().rotate = e.target.value; refreshCode(); });
    $('param-markertip').addEventListener('change', (e) => { spec().markerTip = e.target.checked; refreshCode(); });
    const num = (id, apply) => $(id).addEventListener('change', (e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) { apply(v); refreshCode(); } });
    num('param-curve0', (v) => { spec().pressure.curve[0] = v; });
    num('param-curve1', (v) => { spec().pressure.curve[1] = v; });
    num('param-pmin', (v) => { spec().pressure.min_max[0] = v; });
    num('param-pmax', (v) => { spec().pressure.min_max[1] = v; });

    function refreshCode() {
      if (document.activeElement !== $('spec-code')) $('spec-code').value = specCode();
    }

    $('btn-reset-params').addEventListener('click', () => {
      S.spec = clone(DEFAULT_SPEC);
      S.tipSource = DEFAULT_TIP_SOURCE;
      S.tipDegrees = false;
      S.size = 1;
      refreshSpecUI();
      showToast('myBrush defaults restored');
    });

    // Tip code editor
    const tipArea = $('tip-code');
    tipArea.addEventListener('blur', () => { if (tipArea.value !== S.tipSource) applyTipSource(tipArea.value); });
    tipArea.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') tipArea.blur(); });
    $('tip-angle-units').addEventListener('change', (e) => {
      S.tipDegrees = e.target.value === 'degrees';
      refreshSpecUI();
      showToast(S.tipDegrees ? 'Tip angles: degrees (Brush Maker preview look)' : 'Tip angles: radians (p5.Graphics / p5.brush actual)');
    });

    // Spec import / copy
    $('btn-apply-spec').addEventListener('click', () => {
      try {
        const parsed = parseSpecCode($('spec-code').value);
        S.spec = parsed.spec;
        S.tipSource = parsed.tipSource;
        S.tipDegrees = parsed.tipDegrees;
        $('brush-badge').textContent = `${parsed.name} · custom`;
        $('spec-code').classList.remove('is-invalid');
        refreshSpecUI();
        showToast(`brush.add("${parsed.name}") applied`);
      } catch (err) {
        $('spec-code').classList.add('is-invalid');
        showToast('Could not parse: ' + err.message);
      }
    });
    $('btn-copy-spec').addEventListener('click', () => copyText(specCode(), 'brush.add spec'));
    $('btn-copy-sketch').addEventListener('click', () => copyText(sketchCode(), 'p5.js sketch'));

    // Keyboard
    window.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if ((e.metaKey || e.ctrlKey) && k === 'y') { e.preventDefault(); redo(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (k === 'b') setTool('brush');
      else if (k === 'e') setTool('eraser');
      else if (k === 't') drawSampleStroke();
      else if (k === 'c') clearCanvas();
      else if (k === 's') exportPNG();
      else if (k === 'p') $('controls-drawer').classList.toggle('is-hidden');
      else if (k === '[') { S.spec.weight = clamp(S.spec.weight - 1, 1, 80); refreshSpecUI(); }
      else if (k === ']') { S.spec.weight = clamp(S.spec.weight + 1, 1, 80); refreshSpecUI(); }
    });

    // Small screens start with the drawer hidden.
    if (window.innerWidth < 700) $('controls-drawer').classList.add('is-hidden');

    refreshSpecUI();
    updateHistoryButtons();
  }

  // ---------------------------------------------------------------------------
  // 15. Boot
  // ---------------------------------------------------------------------------
  function init() {
    canvas = $('ink-canvas');
    gl = canvas.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false, depth: false, stencil: false });
    if (!gl) { fatal('WebGL2 is required (p5.brush renders its stamps and spectral blending on the GPU).'); return; }
    try {
      sgl = new StudioGL(gl);
    } catch (err) {
      fatal('Could not compile the studio shaders: ' + err.message);
      return;
    }

    setupUI();
    resize();
    window.addEventListener('resize', onResize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);

    canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: false });
    window.addEventListener('pointercancel', onPointerUp, { passive: false });
    canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fatal('WebGL context lost. Reload the page to continue.'); });

    setTimeout(drawSampleStroke, 120);
    showToast('p5.brush 2.2.2 engine ready — draw on the paper');
  }

  // Expose a tiny debug/testing hook.
  window.__studio = {
    state: S,
    commit: (points, opts = {}) => {
      const rec = Object.assign(newRecordFor(points[0]), opts, { points });
      commitRecord(rec);
      return rec;
    },
    strokes: () => S.strokes,
    undo, redo, clear: clearCanvas, sample: drawSampleStroke, sketchCode, specCode, rebuildAll,
    setPaper, setPressureMode,
  };
  function newRecordFor(pt) { return newRecord(pt); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
