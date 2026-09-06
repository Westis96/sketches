/**
 * Sound effects: short synthesized cues, Duolingo-style, made with the Web Audio
 * API so the app stays a single file with no samples to load. Every cue is a
 * few sine or triangle partials with a fast envelope, tuned to a C pentatonic
 * scale so consecutive cues never clash. Nothing here is louder or longer than
 * it needs to be: the ink is the point, the sound confirms it.
 *
 * The context is created lazily on the first user gesture (autoplay policy) and
 * resumed whenever the page comes back. A preference (on by default) is kept in
 * localStorage; a log of the last cues exists for tests.
 */
export type SfxName =
  | 'click' | 'tap'                                   // UI: primary button, path node
  | 'clean' | 'great' | 'tip' | 'miss' | 'loop'       // a stroke was scored
  | 'stepDown' | 'stepUp' | 'streak' | 'undo'         // session events
  | 'complete' | 'star' | 'best'                      // results
  | 'slide' | 'penDown' | 'good' | 'bad';             // lesson

const KEY = 'p5brush-studio:sound';
// C pentatonic, in Hz.
const N = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, A6: 1760, C7: 2093 };

type Wave = OscillatorType;
interface ToneOpts { type?: Wave; at?: number; dur?: number; gain?: number; to?: number; attack?: number }

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private listeners = new Set<() => void>();
  /** The last cues asked for, newest last, with whether they were audible. For tests. */
  log: Array<{ name: SfxName; played: boolean }> = [];
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
    if (on) this.play('click');
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
  /** A short burst of filtered noise: the body of a tap or a thud. */
  private noise(o: { at?: number; dur?: number; gain?: number; freq?: number; q?: number } = {}) {
    const ctx = this.ctx!, out = this.master!;
    const t0 = ctx.currentTime + (o.at ?? 0), dur = o.dur ?? 0.04, gain = o.gain ?? 0.08;
    const n = Math.ceil(ctx.sampleRate * (dur + 0.01));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = o.freq ?? 1800; f.Q.value = o.q ?? 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0002, t0 + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  /** Plays a cue. `score` pitches the clean-stroke cue; `index` staggers the stars. */
  play(name: SfxName, opts: { score?: number; index?: number } = {}) {
    const audible = this.enabled && !!this.ensure() && this.ctx!.state === 'running';
    this.log.push({ name, played: audible });
    if (this.log.length > 60) this.log.shift();
    if (!audible) return;
    try { this.synth(name, opts); } catch { /* a cue is never worth an error */ }
  }

  private synth(name: SfxName, { score = 80, index = 0 }: { score?: number; index?: number }) {
    switch (name) {
      case 'click': this.noise({ dur: 0.03, gain: 0.07, freq: 2400 }); this.tone(1900, { dur: 0.035, gain: 0.05 }); break;
      case 'tap': this.noise({ dur: 0.035, gain: 0.07, freq: 1400 }); this.tone(1200, { dur: 0.05, gain: 0.06 }); break;
      case 'clean': {
        const f = score >= 97 ? N.C6 : score >= 90 ? N.A5 : score >= 80 ? N.G5 : N.E5;
        this.tone(f, { type: 'triangle', dur: 0.16, gain: 0.16 });
        this.tone(f * 2, { dur: 0.1, gain: 0.04 });
        break;
      }
      case 'great': this.tone(N.G5, { type: 'triangle', dur: 0.12, gain: 0.14 }); this.tone(N.C6, { type: 'triangle', at: 0.07, dur: 0.2, gain: 0.16 }); this.tone(N.C7, { at: 0.07, dur: 0.14, gain: 0.03 }); break;
      case 'tip': this.tone(N.E5, { dur: 0.1, gain: 0.12 }); this.tone(N.D5, { at: 0.09, dur: 0.14, gain: 0.11 }); break;
      case 'miss': this.tone(190, { dur: 0.2, gain: 0.16, to: 110 }); this.noise({ dur: 0.06, gain: 0.05, freq: 400, q: 0.6 }); break;
      case 'loop': this.tone(900, { dur: 0.04, gain: 0.06 }); break;
      case 'stepDown': this.tone(N.C5, { dur: 0.09, gain: 0.1 }); this.tone(N.E5, { at: 0.08, dur: 0.14, gain: 0.11 }); break;
      case 'stepUp': this.tone(N.E5, { dur: 0.09, gain: 0.08 }); this.tone(N.C5, { at: 0.08, dur: 0.16, gain: 0.08 }); break;
      case 'streak': [N.C5, N.E5, N.G5].forEach((f, i) => this.tone(f, { type: 'triangle', at: i * 0.055, dur: 0.11, gain: 0.1 })); break;
      case 'undo': this.tone(520, { dur: 0.07, gain: 0.07, to: 300 }); break;
      case 'complete': [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => { this.tone(f, { type: 'triangle', at: i * 0.075, dur: 0.42, gain: 0.12 }); this.tone(f * 2, { at: i * 0.075, dur: 0.25, gain: 0.025 }); }); break;
      case 'star': { const f = [N.C6, N.E6, N.G6][Math.min(2, index)]; this.tone(f, { type: 'triangle', at: 0.12 + index * 0.07, dur: 0.3, gain: 0.12 }); this.tone(f * 2, { at: 0.12 + index * 0.07, dur: 0.18, gain: 0.03 }); break; }
      case 'best': [N.C7, N.G6, N.C7, N.E6 * 2].forEach((f, i) => this.tone(f, { at: 0.5 + i * 0.06, dur: 0.35, gain: 0.05 })); break;
      case 'slide': this.noise({ dur: 0.05, gain: 0.05, freq: 900, q: 0.5 }); this.tone(700, { dur: 0.04, gain: 0.03 }); break;
      case 'penDown': this.tone(330, { dur: 0.05, gain: 0.1, to: 260 }); this.noise({ dur: 0.015, gain: 0.05, freq: 3000 }); break;
      case 'good': this.tone(N.E6, { type: 'triangle', dur: 0.22, gain: 0.12 }); this.tone(N.E6 * 2, { dur: 0.12, gain: 0.025 }); break;
      case 'bad': this.tone(150, { type: 'square', dur: 0.14, gain: 0.035 }); this.tone(152, { dur: 0.14, gain: 0.06 }); break;
    }
  }
}

export const sfx = new Sfx();
