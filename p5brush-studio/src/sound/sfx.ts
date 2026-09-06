/**
 * Sound effects: short synthesized cues, Duolingo-style, made with the Web Audio
 * API so the app stays a single file with no samples to load. Every cue is a
 * few sine or triangle partials with a fast envelope, tuned to a C pentatonic
 * scale so consecutive cues never clash. Nothing here is louder or longer than
 * it needs to be: the ink is the point, the sound confirms it.
 *
 * Under the cues sits the brush: a filtered noise bed that plays while a pen (or
 * a lesson demo) draws, its loudness following speed and pressure and its colour
 * following the brush in hand. It falls silent within a tenth of a second of the
 * pen stopping, so a held pen makes no sound.
 *
 * The context is created lazily on the first user gesture (autoplay policy) and
 * resumed whenever the page comes back. A preference (on by default) is kept in
 * localStorage; a log of the last cues exists for tests.
 */
export type SfxName =
  | 'click' | 'tap' | 'tool'                            // UI: primary button, path node, tool change
  | 'clean' | 'great' | 'tip' | 'miss' | 'loop'        // a stroke was scored
  | 'start' | 'stepDown' | 'stepUp' | 'streak' | 'undo' | 'redo' | 'lastTry' // session and studio events
  | 'complete' | 'star' | 'best' | 'unlock' | 'levelUp' // results and the path
  | 'slide' | 'penDown' | 'good' | 'bad'               // lesson
  | 'clear' | 'shutter'                                // studio
  | 'brush';                                           // the noise bed started (logged, not a cue)

export type BrushKind = 'pen' | 'pencil' | 'brush' | 'wash' | 'spray' | 'eraser';

const KEY = 'p5brush-studio:sound';
// C pentatonic, in Hz.
const N = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, A6: 1760, C7: 2093 };

/** The noise bed per brush family: filter shape, centre frequency, peak gain. */
const BRUSH: Record<BrushKind, { type: BiquadFilterType; f: number; q: number; gain: number }> = {
  pen: { type: 'bandpass', f: 4200, q: 0.9, gain: 0.03 },
  pencil: { type: 'bandpass', f: 1700, q: 0.7, gain: 0.055 },
  brush: { type: 'bandpass', f: 900, q: 0.5, gain: 0.045 },
  wash: { type: 'lowpass', f: 650, q: 0.6, gain: 0.04 },
  spray: { type: 'highpass', f: 3200, q: 0.5, gain: 0.045 },
  eraser: { type: 'bandpass', f: 1200, q: 0.6, gain: 0.03 },
};
/** Which family a brush template belongs to. */
export function brushKindOf(template: string | null, tool: 'brush' | 'eraser'): BrushKind {
  if (tool === 'eraser') return 'eraser';
  switch (template) {
    case 'graphite': case 'charcoal': return 'pencil';
    case 'bristle': case 'flat': case 'chisel': case 'brushpen': return 'brush';
    case 'wash': return 'wash';
    case 'spray': return 'spray';
    default: return 'pen';
  }
}

type Wave = OscillatorType;
interface ToneOpts { type?: Wave; at?: number; dur?: number; gain?: number; to?: number; attack?: number }
interface NoiseOpts { at?: number; dur?: number; gain?: number; freq?: number; to?: number; q?: number; type?: BiquadFilterType }

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private bed: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode; kind: BrushKind; level: number } | null = null;
  private listeners = new Set<() => void>();
  /** The last cues asked for, newest last, with whether they were audible. For tests. */
  log: Array<{ name: SfxName; played: boolean; kind?: BrushKind }> = [];
  enabled: boolean;

  constructor() {
    let on = true;
    try { const raw = localStorage.getItem(KEY); if (raw !== null) on = raw !== '0'; } catch { /* ignore */ }
    this.enabled = on;
  }

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  setEnabled(on: boolean) {
    if (on === this.enabled) return;
    this.enabled = on;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* ignore */ }
    for (const l of this.listeners) l();
    if (on) this.play('click'); else this.brushStop();
  }
  toggle() { this.setEnabled(!this.enabled); }

  /** Creates or resumes the context; call from a user gesture. */
  unlock() {
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => { /* ignore */ });
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      const ctx = new AC();
      const master = ctx.createGain();
      master.gain.value = 0.55;
      // A gentle limiter so overlapping cues never clip.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 20; comp.ratio.value = 6; comp.attack.value = 0.002; comp.release.value = 0.12;
      master.connect(comp).connect(ctx.destination);
      this.ctx = ctx; this.master = master;
      return ctx;
    } catch { return null; }
  }
  private get live(): boolean { return this.enabled && !!this.ensure() && this.ctx!.state === 'running'; }

  private tone(freq: number, o: ToneOpts = {}) {
    const ctx = this.ctx!, out = this.master!;
    const t0 = ctx.currentTime + (o.at ?? 0), dur = o.dur ?? 0.12, gain = o.gain ?? 0.18, attack = o.attack ?? 0.004;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0002, t0 + dur);
    osc.connect(g).connect(out);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }
  private noiseBuffer(): AudioBuffer {
    if (this.noiseBuf) return this.noiseBuf;
    const ctx = this.ctx!;
    const n = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    return buf;
  }
  /** A short burst of filtered noise: the body of a tap, a thud, a whoosh. */
  private noise(o: NoiseOpts = {}) {
    const ctx = this.ctx!, out = this.master!;
    const t0 = ctx.currentTime + (o.at ?? 0), dur = o.dur ?? 0.04, gain = o.gain ?? 0.08;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? 'bandpass'; f.frequency.setValueAtTime(o.freq ?? 1800, t0); f.Q.value = o.q ?? 0.8;
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0002, t0 + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t0, Math.random() * 1.5); src.stop(t0 + dur + 0.02);
  }

  /** Plays a cue. `score` pitches the clean-stroke cue; `index` staggers the stars. */
  play(name: SfxName, opts: { score?: number; index?: number } = {}) {
    const audible = this.live;
    this.log.push({ name, played: audible });
    if (this.log.length > 80) this.log.shift();
    if (!audible) return;
    try { this.synth(name, opts); } catch { /* a cue is never worth an error */ }
  }

  // -- The brush -------------------------------------------------------------
  /** The pen lands: start the noise bed for this brush family, silent until it moves. */
  brushStart(kind: BrushKind) {
    this.brushStop();
    const audible = this.live;
    this.log.push({ name: 'brush', played: audible, kind });
    if (this.log.length > 80) this.log.shift();
    if (!audible) return;
    try {
      const ctx = this.ctx!, k = BRUSH[kind];
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer(); src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = k.type; filter.frequency.value = k.f; filter.Q.value = k.q;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(this.master!);
      src.start(ctx.currentTime, Math.random() * 1.5);
      this.bed = { src, filter, gain, kind, level: 0 };
    } catch { this.bed = null; }
  }
  /** The pen moved: `speed` in screen px per ms, `pressure` 0..1. Decays on its own if no reading follows. */
  brushUpdate(speed: number, pressure: number) {
    const b = this.bed;
    if (!b) return;
    const ctx = this.ctx!, k = BRUSH[b.kind], t = ctx.currentTime;
    const v = Math.min(3, Math.max(0, speed));
    const drive = b.kind === 'spray' ? 0.5 + 0.5 * Math.min(1, v) : Math.min(1, Math.pow(v / 1.2, 0.6)) * (0.35 + 0.65 * Math.min(1, pressure));
    // Pencils and bristles get a little grain: the level flickers with speed.
    const grain = b.kind === 'pencil' || b.kind === 'brush' ? 0.85 + 0.15 * Math.sin(t * 173) : 1;
    b.level = k.gain * drive * grain;
    const g = b.gain.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(b.level, t, 0.03);
    g.setTargetAtTime(0, t + 0.1, 0.05); // holds still → fades, unless the next reading cancels this
    b.filter.frequency.setTargetAtTime(k.f * (0.85 + 0.3 * Math.min(1, v / 1.5)), t, 0.05);
  }
  /** The pen lifts. */
  brushStop() {
    const b = this.bed;
    if (!b) return;
    this.bed = null;
    try {
      const t = this.ctx!.currentTime;
      b.gain.gain.cancelScheduledValues(t);
      b.gain.gain.setTargetAtTime(0, t, 0.025);
      b.src.stop(t + 0.2);
    } catch { /* ignore */ }
  }
  /** For tests and the HUD: the bed in play, if any. */
  brushState(): { kind: BrushKind; level: number } | null { return this.bed ? { kind: this.bed.kind, level: this.bed.level } : null; }

  private synth(name: SfxName, { score = 80, index = 0 }: { score?: number; index?: number }) {
    switch (name) {
      case 'click': this.noise({ dur: 0.03, gain: 0.07, freq: 2400 }); this.tone(1900, { dur: 0.035, gain: 0.05 }); break;
      case 'tap': this.noise({ dur: 0.035, gain: 0.07, freq: 1400 }); this.tone(1200, { dur: 0.05, gain: 0.06 }); break;
      case 'tool': this.tone(1400, { dur: 0.03, gain: 0.05 }); this.noise({ dur: 0.02, gain: 0.04, freq: 3000 }); break;
      case 'clean': {
        const f = score >= 97 ? N.C6 : score >= 90 ? N.A5 : score >= 80 ? N.G5 : N.E5;
        this.tone(f, { type: 'triangle', dur: 0.16, gain: 0.16 });
        this.tone(f * 2, { dur: 0.1, gain: 0.04 });
        break;
      }
      case 'great': this.tone(N.G5, { type: 'triangle', dur: 0.12, gain: 0.14 }); this.tone(N.C6, { type: 'triangle', at: 0.07, dur: 0.2, gain: 0.16 }); this.tone(N.C7, { at: 0.07, dur: 0.14, gain: 0.03 }); break;
      case 'tip': this.tone(N.E5, { dur: 0.1, gain: 0.12 }); this.tone(N.D5, { at: 0.09, dur: 0.14, gain: 0.11 }); break;
      case 'miss': this.tone(190, { dur: 0.2, gain: 0.16, to: 110 }); this.noise({ dur: 0.06, gain: 0.05, freq: 400, q: 0.6 }); break;
      case 'lastTry': this.tone(220, { at: 0.26, dur: 0.07, gain: 0.1 }); this.tone(220, { at: 0.38, dur: 0.09, gain: 0.1 }); break;
      case 'loop': this.tone(900, { dur: 0.04, gain: 0.06 }); break;
      case 'start': this.tone(N.C5, { type: 'triangle', dur: 0.09, gain: 0.09 }); this.tone(N.G5, { type: 'triangle', at: 0.08, dur: 0.18, gain: 0.1 }); break;
      case 'stepDown': this.tone(N.C5, { dur: 0.09, gain: 0.1 }); this.tone(N.E5, { at: 0.08, dur: 0.14, gain: 0.11 }); break;
      case 'stepUp': this.tone(N.E5, { dur: 0.09, gain: 0.08 }); this.tone(N.C5, { at: 0.08, dur: 0.16, gain: 0.08 }); break;
      case 'streak': [N.C5, N.E5, N.G5].forEach((f, i) => this.tone(f, { type: 'triangle', at: i * 0.055, dur: 0.11, gain: 0.1 })); break;
      case 'undo': this.tone(520, { dur: 0.07, gain: 0.07, to: 300 }); break;
      case 'redo': this.tone(300, { dur: 0.07, gain: 0.07, to: 520 }); break;
      case 'clear': this.noise({ dur: 0.28, gain: 0.07, freq: 1600, to: 220, q: 0.7 }); break;
      case 'shutter': this.noise({ dur: 0.02, gain: 0.12, freq: 2600, q: 1.2 }); this.tone(2400, { dur: 0.02, gain: 0.04 }); this.noise({ at: 0.07, dur: 0.03, gain: 0.09, freq: 1300, q: 1 }); break;
      case 'complete': [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => { this.tone(f, { type: 'triangle', at: i * 0.075, dur: 0.42, gain: 0.12 }); this.tone(f * 2, { at: i * 0.075, dur: 0.25, gain: 0.025 }); }); break;
      case 'unlock': [N.E5, N.G5, N.C6].forEach((f, i) => this.tone(f, { type: 'triangle', at: 0.55 + i * 0.07, dur: 0.24, gain: 0.1 })); this.tone(N.C7, { at: 0.8, dur: 0.4, gain: 0.03 }); break;
      case 'levelUp': [N.C5, N.E5, N.G5, N.C6, N.E6, N.G6].forEach((f, i) => { this.tone(f, { type: 'triangle', at: i * 0.09, dur: 0.6, gain: 0.1 }); this.tone(f * 2, { at: i * 0.09, dur: 0.3, gain: 0.02 }); }); this.tone(N.C7, { at: 0.6, dur: 0.7, gain: 0.04 }); break;
      case 'star': { const f = [N.C6, N.E6, N.G6][Math.min(2, index)]; this.tone(f, { type: 'triangle', at: 0.12 + index * 0.07, dur: 0.3, gain: 0.12 }); this.tone(f * 2, { at: 0.12 + index * 0.07, dur: 0.18, gain: 0.03 }); break; }
      case 'best': [N.C7, N.G6, N.C7, N.E6 * 2].forEach((f, i) => this.tone(f, { at: 0.5 + i * 0.06, dur: 0.35, gain: 0.05 })); break;
      case 'slide': this.noise({ dur: 0.05, gain: 0.05, freq: 900, q: 0.5 }); this.tone(700, { dur: 0.04, gain: 0.03 }); break;
      case 'penDown': this.tone(330, { dur: 0.05, gain: 0.1, to: 260 }); this.noise({ dur: 0.015, gain: 0.05, freq: 3000 }); break;
      case 'good': this.tone(N.E6, { type: 'triangle', dur: 0.22, gain: 0.12 }); this.tone(N.E6 * 2, { dur: 0.12, gain: 0.025 }); break;
      case 'bad': this.tone(150, { type: 'square', dur: 0.14, gain: 0.035 }); this.tone(152, { dur: 0.14, gain: 0.06 }); break;
      case 'brush': break;
    }
  }
}

export const sfx = new Sfx();
