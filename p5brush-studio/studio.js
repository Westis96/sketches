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
  function createTipShim(surface) {
    const ctx = surface.drawingContext;
    // Radians by default: a p5.Graphics keeps RADIANS even when the sketch calls angleMode(DEGREES).
    const st = { fill: 'rgb(255,255,255)', stroke: null, lineWidth: 1, degrees: false, rectMode: 'corner', ellipseMode: 'center', shape: null };
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
      random: brush.random,
      map(v, a, b, c, d) { return c + ((v - a) / (b - a)) * (d - c); },
      lerp(a, b, t) { return a + (b - a) * t; },
      radians(d) { return (d * Math.PI) / 180; },
      degrees(r) { return (r * 180) / Math.PI; },
      sin: Math.sin, cos: Math.cos, abs: Math.abs, min: Math.min, max: Math.max, sqrt: Math.sqrt, floor: Math.floor,
    };
    return m;
  }

  function compileTip(source) {
    // The tip body is authored exactly as in the Brush Maker: statements on `_m`.
    // eslint-disable-next-line no-new-func
    const fn = new Function('_m', source);
    return (surface) => fn(createTipShim(surface));
  }

  /** Throws if the tip source does not run on a scratch 2D surface. */
  function checkTip(source) {
    compileTip(source)({ drawingContext: document.createElement('canvas').getContext('2d') });
  }

  // Angle units are expressed *in* the tip source, as a leading angleMode() line,
  // so a spec round-trips through copy/paste and the p5 sketch export unchanged.
  const ANGLE_LINE = '_m.angleMode("degrees");';
  const tipUsesDegrees = (src) => /^\s*_m\.angleMode\s*\(\s*(["'])degrees\1/i.test(src);
  function setTipDegrees(src, degrees) {
    const lines = src.split('\n');
    if (lines.length && /^\s*_m\.angleMode\s*\(/.test(lines[0])) lines.shift();
    if (degrees) lines.unshift(ANGLE_LINE);
    return lines.join('\n');
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
      // Unbind what _begin/draw bound. p5.brush re-arms program, VAO and blend
      // state itself before every draw and composite pass.
      const gl = this.gl;
      gl.bindVertexArray(null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.useProgram(null);
      gl.enable(gl.BLEND);
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
      this._begin();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, this.w, this.h, 0);
      this._end();
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

  // ---------------------------------------------------------------------------
  // 5. Brush registration
  //    One p5.brush brush per distinct tip source (the only thing that needs the
  //    500×500 rasterisation). p5.brush reads the params object we hand to
  //    brush.add() by reference at stroke time — the same contract its own
  //    scaleBrushes() relies on — so per-stroke numbers are patched in place.
  // ---------------------------------------------------------------------------
  const POOL = 8;
  const registry = new Map(); // tipSource → { name, params, tick }
  let regTick = 0;

  function ensureRegistered(rec) {
    let entry = registry.get(rec.tipSource);
    if (!entry) {
      let name = 'studio-' + registry.size;
      if (registry.size >= POOL) {
        let oldestKey = null;
        for (const [k, e] of registry) if (oldestKey === null || e.tick < registry.get(oldestKey).tick) oldestKey = k;
        name = registry.get(oldestKey).name;
        registry.delete(oldestKey);
      }
      const params = Object.assign(clone(rec.spec), { tip: compileTip(rec.tipSource) });
      brush.add(name, params);
      entry = { name, params };
      registry.set(rec.tipSource, entry);
    }
    entry.tick = ++regTick;
    const { params } = entry, sp = rec.spec;
    params.weight = sp.weight; params.scatter = sp.scatter; params.opacity = sp.opacity;
    params.spacing = sp.spacing; params.noise = clamp(sp.noise, 0, 1);
    params.rotate = sp.rotate; params.markerTip = sp.markerTip;
    params.pressure = { type: 'gaussian', mode: 'gaussian', curve: sp.pressure.curve, min_max: sp.pressure.min_max };
    return entry.name;
  }

  // ---------------------------------------------------------------------------
  // 6. Path → segments (shared by rendering and the p5 sketch export)
  // ---------------------------------------------------------------------------
  function resamplePath(points, segLen) {
    // Uniform arc-length resampling. Segment boundaries then align with p5.brush's
    // stamping step (segLen is a multiple of spacing), avoiding integration drift.
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
    // A tap still needs a plot with length: make it a tiny dash.
    if (out.length < 2) out.push({ x: out[0].x + segLen, y: out[0].y, p: out[0].p });
    return out;
  }

  function segmentLengthFor(spacing) {
    return spacing * Math.max(1, Math.round(2 / spacing));
  }

  function mapStylus(p, sensitivity) {
    // Mouse/touch report 0.5 → 1.0. Pen force curves around that neutral point.
    return clamp(Math.pow(Math.max(p, 0.02) / 0.5, 0.75 * sensitivity), 0.3, 1.6);
  }

  /** { origin, segs: [{ a (deg), len, p }], endA, endP, stamps } for a brush record. */
  function strokeSegments(rec) {
    const pts = resamplePath(rec.points, segmentLengthFor(rec.spec.spacing));
    const pf = rec.pressureMode === 'gaussian' ? () => 1 : (pt) => mapStylus(pt.p, rec.sensitivity);
    const segs = [];
    let a = 0, stamps = 0;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      a = ((Math.atan2(-dy, dx) * 180) / Math.PI + 360) % 360;
      segs.push({ a, len, p: pf(pts[i - 1]) });
      stamps += len / rec.spec.spacing;
    }
    return { origin: pts[0], segs, endA: a, endP: pf(pts[pts.length - 1]), stamps: Math.round(stamps) };
  }

  // ---------------------------------------------------------------------------
  // 7. Rendering
  // ---------------------------------------------------------------------------
  /** Stamps a brush record on top of whatever is in the framebuffer. Returns stamp count. */
  function renderBrushStroke(rec) {
    const name = ensureRegistered(rec);
    const { origin, segs, endA, endP, stamps } = strokeSegments(rec);
    const plot = new brush.Plot('curve');
    for (const s of segs) plot.addSegment(s.a, s.len, s.p, true);
    plot.endPlot(endA, endP, true);
    brush.seed(rec.seed);
    brush.push();
    brush.translate(-glW / 2, -glH / 2); // p5.brush origin is the canvas centre
    brush.scale(dpr);                    // work in CSS pixels
    brush.set(name, rec.color, rec.size);
    plot.draw(origin.x, origin.y, 1);
    brush.pop();
    brush.render();
    return stamps;
  }

  /** Eraser dabs (device px) for the record's points from index `from` on. */
  function eraserDabs(rec, from) {
    const dabs = [];
    const r = (rec.size / 2) * dpr;
    const step = Math.max(0.75, rec.size * 0.12);
    const pts = rec.points;
    if (from === 0) dabs.push({ x: pts[0].x * dpr, y: pts[0].y * dpr, r });
    for (let i = Math.max(1, from); i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        dabs.push({ x: (a.x + (b.x - a.x) * t) * dpr, y: (a.y + (b.y - a.y) * t) * dpr, r });
      }
    }
    return dabs;
  }

  function renderRecord(rec) {
    if (rec.tool === 'eraser') sgl.eraseDabs(eraserDabs(rec, 0));
    else renderBrushStroke(rec);
  }

  /** Restores `baseTex`, draws `records` on top, and stores the result as committed. */
  function paint(baseTex, records) {
    sgl.blit(baseTex);
    for (const rec of records) renderRecord(rec);
    sgl.snapshot(sgl.committedTex);
  }

  /** Drops checkpoints taken after `count` strokes. */
  function truncateCheckpoints(count) {
    while (S.checkpoints.length && S.checkpoints[S.checkpoints.length - 1].count > count) {
      sgl.deleteTexture(S.checkpoints.pop().tex);
    }
  }

  /** Rebuilds the committed image for the current stroke list from the newest usable checkpoint. */
  function rebuild() {
    const n = S.strokes.length;
    truncateCheckpoints(n);
    const cp = S.checkpoints[S.checkpoints.length - 1];
    if (cp) paint(cp.tex, S.strokes.slice(cp.count));
    else paint(sgl.paperTex, S.strokes);
  }

  /** Appends a record whose pixels are already in the framebuffer. */
  function pushRecord(rec, { clearRedo = true } = {}) {
    sgl.snapshot(sgl.committedTex);
    S.strokes.push(rec);
    if (clearRedo) S.redo = [];
    const n = S.strokes.length;
    if (n % CHECKPOINT_EVERY === 0) {
      const tex = sgl.createTexture();
      sgl.snapshot(tex);
      S.checkpoints.push({ count: n, tex });
      while (S.checkpoints.length > MAX_CHECKPOINTS) sgl.deleteTexture(S.checkpoints.shift().tex);
    }
    updateHistoryButtons();
  }

  function commitRecord(rec, opts) {
    sgl.blit(sgl.committedTex);
    renderRecord(rec);
    pushRecord(rec, opts);
  }

  function undo() {
    if (!S.strokes.length) { showToast('Nothing to undo'); return; }
    S.redo.push(S.strokes.pop());
    rebuild();
    updateHistoryButtons();
    showToast('Undo');
  }

  function redo() {
    if (!S.redo.length) return;
    commitRecord(S.redo.pop(), { clearRedo: false });
    showToast('Redo');
  }

  function clearCanvas() {
    S.strokes = []; S.redo = [];
    rebuild();
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

  /** Paper changed: checkpoints embed the old paper, so replay everything. */
  function repaintPaper() {
    renderPaper();
    truncateCheckpoints(-1);
    rebuild();
  }

  // ---------------------------------------------------------------------------
  // 9. Canvas sizing + p5.brush target
  // ---------------------------------------------------------------------------
  function resize(force = false) {
    const desk = $('studio-desk');
    const nextW = desk.clientWidth || window.innerWidth;
    const nextH = desk.clientHeight || window.innerHeight;
    const nextDpr = Math.min(2, window.devicePixelRatio || 1);
    if (!force && nextW === cssW && nextH === cssH && nextDpr === dpr) return; // e.g. iOS keyboard viewport events
    cssW = nextW; cssH = nextH; dpr = nextDpr;
    glW = Math.max(1, Math.round(cssW * dpr));
    glH = Math.max(1, Math.round(cssH * dpr));
    canvas.width = glW; canvas.height = glH;
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    sgl.setSize(glW, glH);
    brush.load(canvas);      // (re)registers the target with its new size
    brush.noFill(); brush.noHatch(); brush.noField();
    repaintPaper();
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
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, p };
  }

  /** A record captures everything needed to replay the stroke deterministically. */
  function newRecord(tool, firstPt) {
    if (tool === 'eraser') return { tool, size: S.eraserSize, points: [firstPt] };
    const spec = clone(S.spec);
    // 'stylus' mode disables the simulated envelope so only plot pressure remains.
    if (S.pressureMode === 'stylus') spec.pressure = { mode: 'gaussian', curve: [0, 0], min_max: [1, 1] };
    return {
      tool,
      spec,
      tipSource: S.tipSource,
      size: S.size,
      color: S.color,
      pressureMode: S.pressureMode,
      sensitivity: S.forceSensitivity,
      seed: (Math.random() * 2147483647) | 0,
      points: [firstPt],
    };
  }

  function onPointerDown(e) {
    if (e.target !== canvas || live) return;
    if (S.pencilOnly && e.pointerType !== 'pen') { showToast('Pencil-only mode: touch ignored'); return; }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    const rect = canvas.getBoundingClientRect();
    const rec = newRecord(S.tool, pointFromEvent(e, rect));
    live = { id: e.pointerId, rect, rec, erasedUpTo: 0, pointerType: null };
    updateTelemetry(e);
    schedulePreview();
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
    schedulePreview();
  }

  function onPointerUp(e) {
    if (!live || e.pointerId !== live.id) return;
    e.preventDefault();
    const { rec } = live;
    // Points that arrived after the last preview frame are not on screen yet;
    // once the preview is current the framebuffer *is* the committed result.
    if (previewQueued) renderPreview();
    live = null;
    HUD.pressureBar.style.width = '0%';
    HUD.pressureVal.textContent = '0.00';
    pushRecord(rec);
  }

  function schedulePreview() {
    if (previewQueued) return;
    previewQueued = true;
    requestAnimationFrame(renderPreview);
  }

  /** Live view: brush strokes are re-stamped from the committed image (seeded, so
   *  stable); eraser dabs are applied incrementally since they are cumulative. */
  function renderPreview() {
    previewQueued = false;
    if (!live) return;
    const { rec } = live;
    if (rec.tool === 'eraser') {
      if (rec.points.length > live.erasedUpTo) {
        sgl.eraseDabs(eraserDabs(rec, live.erasedUpTo));
        live.erasedUpTo = rec.points.length;
      }
      return;
    }
    sgl.blit(sgl.committedTex);
    HUD.stamps.textContent = String(renderBrushStroke(rec));
  }

  const HUD = {};
  function updateTelemetry(e) {
    if (live && live.pointerType !== e.pointerType) {
      live.pointerType = e.pointerType;
      const isPen = e.pointerType === 'pen';
      HUD.badge.textContent = isPen ? 'APPLE PENCIL' : (e.pointerType || 'pointer').toUpperCase();
      HUD.badge.classList.toggle('is-pen', isPen);
    }
    const p = e.pressure > 0 ? e.pressure : 0;
    HUD.pressureBar.style.width = `${Math.round(clamp(p, 0, 1) * 100)}%`;
    HUD.pressureVal.textContent = p.toFixed(2);
    HUD.tilt.textContent = `${Math.round(e.tiltX || 0)}°, ${Math.round(e.tiltY || 0)}°`;
  }

  // ---------------------------------------------------------------------------
  // 11. Sample stroke (goes through the exact same pipeline)
  // ---------------------------------------------------------------------------
  function drawSampleStroke() {
    if (S.tool !== 'brush') setTool('brush');
    const cx = cssW / 2, cy = cssH / 2;
    const rx = Math.min(cssW * 0.32, 260), ry = Math.min(cssH * 0.22, 120);
    const points = [];
    const steps = 160;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, a = t * Math.PI * 2;
      points.push({ x: cx + Math.sin(a) * rx, y: cy + Math.sin(a * 2) * ry, p: 0.5 + 0.4 * Math.sin(a * 3) ** 2 });
    }
    const rec = newRecord('brush', points[0]);
    rec.points = points;
    commitRecord(rec);
    HUD.stamps.textContent = String(strokeSegments(rec).stamps);
    showToast('p5.brush sample stroke (lemniscate)');
  }

  // ---------------------------------------------------------------------------
  // 12. Spec code generation / import / p5 sketch export
  // ---------------------------------------------------------------------------
  function fmt(n) { return Number.isInteger(n) ? String(n) : String(+n.toFixed(3)); }

  function specCode(spec = S.spec, tipSource = S.tipSource, name = 'myBrush') {
    const p = spec.pressure;
    const tip = tipSource.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => '      ' + l).join('\n');
    return `brush.add("${name}", {
  type:    "custom",
  weight:  ${fmt(spec.weight)},
  scatter: ${fmt(spec.scatter)},
  opacity: ${fmt(spec.opacity)},
  spacing: ${fmt(spec.spacing)},
  noise:   ${fmt(spec.noise)},
  pressure: { mode: "gaussian", curve: [${fmt(p.curve[0])}, ${fmt(p.curve[1])}], min_max: [${fmt(p.min_max[0])}, ${fmt(p.min_max[1])}] },
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
    const bodyMatch = /^[^{]*\{([\s\S]*)\}\s*$/.exec(cfg.tip.toString());
    const tipSource = (bodyMatch ? bodyMatch[1] : '').split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
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
      spec.pressure = { mode: 'gaussian', curve: [0.2, 0.25], min_max: [Math.min(...pr), Math.max(...pr)] };
    }
    checkTip(tipSource);
    return { spec, tipSource, name: m[2] };
  }

  function sketchCode() {
    const conf = paperPresets[S.paper];
    const lines = [
      '// p5.js + p5.brush 2.2.2 — exported from p5.brush Realtime Studio',
      '// <script src="https://cdn.jsdelivr.net/npm/p5@1.11.3/lib/p5.min.js"></script>',
      '// <script src="https://cdn.jsdelivr.net/npm/p5.brush@2.2.2/dist/p5.brush.js"></script>',
      '',
      'function setup() {',
      `  createCanvas(${Math.round(cssW)}, ${Math.round(cssH)}, WEBGL);`,
      `  pixelDensity(${dpr});`,
      '  angleMode(DEGREES);',
      '  noLoop();',
      '}',
      '',
      'function draw() {',
      `  background("rgb(${conf.bg.join(', ')})");`,
      '  translate(-width / 2, -height / 2);',
    ];
    const names = new Map();
    for (const rec of S.strokes) {
      if (rec.tool !== 'brush') { lines.push('  // (eraser stroke omitted)'); continue; }
      const key = JSON.stringify(rec.spec) + '|' + rec.tipSource;
      let name = names.get(key);
      if (!name) {
        name = 'studioBrush' + names.size;
        names.set(key, name);
        lines.push('  ' + specCode(rec.spec, rec.tipSource, name).replace(/\n/g, '\n  '));
      }
      const { origin, segs, endA, endP } = strokeSegments(rec);
      lines.push(`  randomSeed(${rec.seed});`);
      lines.push(`  brush.set("${name}", "${rec.color}", ${fmt(rec.size)});`);
      lines.push(`  brush.beginStroke("curve", ${fmt(origin.x)}, ${fmt(origin.y)});`);
      for (const s of segs) lines.push(`  brush.move(${fmt(s.a)}, ${fmt(s.len)}, ${fmt(s.p)});`);
      lines.push(`  brush.endStroke(${fmt(endA)}, ${fmt(endP)});`);
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

  function setTipInvalid(bad) {
    $('tip-error').classList.toggle('hidden', !bad);
    $('tip-code').classList.toggle('is-invalid', bad);
  }

  function drawTipPreview() {
    const c = $('tip-preview-canvas');
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.save();
    ctx.translate(c.width / 2, c.height / 2);
    ctx.scale(c.width / 100, c.height / 100);
    ctx.strokeStyle = 'rgba(99,102,241,0.35)';
    ctx.lineWidth = 0.6;
    ctx.strokeRect(-50, -50, 100, 100);
    try {
      compileTip(S.tipSource)({ drawingContext: ctx });
      setTipInvalid(false);
    } catch (err) {
      setTipInvalid(true);
    }
    ctx.restore();
  }

  // Every numeric control in one table: refreshSpecUI and the input bindings both walk it.
  const two = (v) => v.toFixed(2);
  const CONTROLS = [
    { id: 'param-weight', get: () => S.spec.weight, set: (v) => { S.spec.weight = v; }, fmt },
    { id: 'param-opacity', get: () => S.spec.opacity, set: (v) => { S.spec.opacity = v; }, fmt },
    { id: 'param-scatter', get: () => S.spec.scatter, set: (v) => { S.spec.scatter = v; }, fmt: two },
    { id: 'param-spacing', get: () => S.spec.spacing, set: (v) => { S.spec.spacing = v; }, fmt: two },
    { id: 'param-noise', get: () => S.spec.noise, set: (v) => { S.spec.noise = v; }, fmt: two },
    { id: 'param-size', get: () => S.size, set: (v) => { S.size = v; }, fmt: (v) => two(v) + '×' },
    { id: 'param-force-sens', get: () => S.forceSensitivity, set: (v) => { S.forceSensitivity = v; }, fmt: (v) => two(v) + 'x' },
    { id: 'param-eraser', get: () => S.eraserSize, set: (v) => { S.eraserSize = v; }, fmt: (v) => `${fmt(v)}px` },
    { id: 'param-curve0', get: () => S.spec.pressure.curve[0], set: (v) => { S.spec.pressure.curve[0] = v; } },
    { id: 'param-curve1', get: () => S.spec.pressure.curve[1], set: (v) => { S.spec.pressure.curve[1] = v; } },
    { id: 'param-pmin', get: () => S.spec.pressure.min_max[0], set: (v) => { S.spec.pressure.min_max[0] = v; } },
    { id: 'param-pmax', get: () => S.spec.pressure.min_max[1], set: (v) => { S.spec.pressure.min_max[1] = v; } },
  ];

  let specCodeQueued = false;
  function refreshSpecCode() {
    if (specCodeQueued) return;
    specCodeQueued = true;
    requestAnimationFrame(() => {
      specCodeQueued = false;
      const area = $('spec-code');
      if (document.activeElement !== area) { area.value = specCode(); area.classList.remove('is-invalid'); }
      $('brush-size-badge').textContent = `${fmt(S.spec.weight)}px`;
    });
  }

  function refreshSpecUI() {
    for (const c of CONTROLS) {
      const v = c.get();
      $(c.id).value = v;
      if (c.label) c.label.textContent = c.fmt(v);
    }
    $('param-rotate').value = S.spec.rotate;
    $('param-markertip').checked = !!S.spec.markerTip;
    $('tip-angle-units').value = tipUsesDegrees(S.tipSource) ? 'degrees' : 'radians';
    if (document.activeElement !== $('tip-code')) $('tip-code').value = S.tipSource;
    refreshSpecCode();
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
    repaintPaper();
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

  function applyTipSource(src) {
    try {
      checkTip(src);
      S.tipSource = src;
      refreshSpecUI();
      showToast('Tip updated');
    } catch (err) {
      setTipInvalid(true);
      showToast('Tip code error: ' + err.message);
    }
  }

  function setupUI() {
    Object.assign(HUD, { badge: $('stylus-badge'), pressureBar: $('hud-pressure-bar'), pressureVal: $('hud-pressure-val'), tilt: $('hud-tilt'), stamps: $('hud-stamps') });

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

    // Numeric controls (sliders fire on input, number boxes on change)
    for (const c of CONTROLS) {
      const el = $(c.id);
      c.label = c.fmt ? $(c.id.replace('param-', 'val-')) : null;
      el.addEventListener(el.type === 'range' ? 'input' : 'change', () => {
        const v = parseFloat(el.value);
        if (!Number.isFinite(v)) return;
        c.set(v);
        if (c.label) c.label.textContent = c.fmt(v);
        refreshSpecCode();
      });
    }
    $('param-rotate').addEventListener('change', (e) => { S.spec.rotate = e.target.value; refreshSpecCode(); });
    $('param-markertip').addEventListener('change', (e) => { S.spec.markerTip = e.target.checked; refreshSpecCode(); });

    $('btn-reset-params').addEventListener('click', () => {
      S.spec = clone(DEFAULT_SPEC);
      S.tipSource = DEFAULT_TIP_SOURCE;
      S.size = 1;
      refreshSpecUI();
      showToast('myBrush defaults restored');
    });

    // Tip code editor
    const tipArea = $('tip-code');
    tipArea.addEventListener('blur', () => { if (tipArea.value !== S.tipSource) applyTipSource(tipArea.value); });
    tipArea.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') tipArea.blur(); });
    $('tip-angle-units').addEventListener('change', (e) => {
      const degrees = e.target.value === 'degrees';
      applyTipSource(setTipDegrees(S.tipSource, degrees));
      showToast(degrees ? 'Tip angles: degrees (Brush Maker preview look)' : 'Tip angles: radians (p5.Graphics / p5.brush actual)');
    });

    // Spec import / copy
    $('btn-apply-spec').addEventListener('click', () => {
      try {
        const parsed = parseSpecCode($('spec-code').value);
        S.spec = parsed.spec;
        S.tipSource = parsed.tipSource;
        $('brush-badge').textContent = `${parsed.name} · custom`;
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
      else if (k === '[' || k === ']') { S.spec.weight = clamp(S.spec.weight + (k === ']' ? 1 : -1), 1, 80); refreshSpecUI(); }
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
    resize(true);
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

  // Tiny debug/testing hook.
  window.__studio = {
    state: S,
    commit: (points, opts = {}) => {
      const rec = Object.assign(newRecord('brush', points[0]), opts, { points });
      commitRecord(rec);
      return rec;
    },
    strokes: () => S.strokes,
    undo, redo, clear: clearCanvas, sample: drawSampleStroke, sketchCode, specCode, setPaper, setPressureMode,
    rebuildAll: repaintPaper,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
