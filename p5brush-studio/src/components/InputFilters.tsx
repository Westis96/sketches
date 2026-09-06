import { ChevronDown, ChevronUp, RotateCcw, Waves } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useStudio, useStudioState } from '@/hooks/useStudio';
import { usePersistedState } from '@/hooks/usePersistedState';
import { DEFAULT_FILTERS, Kalman1D, type FilterPatch, type FilterSettings } from '@/engine/filters';
import { cn } from '@/lib/utils';

/**
 * Input filters card (Pencil lab): per-channel filter choice and Kalman
 * parameters, a raw-versus-filtered readout of the stroke in progress, and a
 * switch to draw the raw path over the ink. Strokes keep the parameters they
 * were conditioned with.
 */
export function InputFilters({ defaultOpen = true }: { defaultOpen?: boolean }) {
  const studio = useStudio();
  const f = useStudioState((s) => s.settings.filters);
  const hud = useStudioState((s) => s.hud);
  const [open, setOpen] = usePersistedState('p5brush-studio:lab:filters', defaultOpen);
  const changed = JSON.stringify(f) !== JSON.stringify(DEFAULT_FILTERS);
  const set = (patch: FilterPatch) => studio.setFilters(patch);

  return (
    <div className="tl-panel pointer-events-auto w-[min(300px,calc(100vw-16px))] text-[12px]" data-testid="input-filters">
      <button type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Waves className="h-4 w-4 text-[var(--tl-selected)]" />
        <span className="flex-1 text-[13px] font-semibold text-[var(--tl-text-1)]">Input filters</span>
        {changed && <span className="rounded-full bg-[#e7f5ff] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--tl-selected)]">modified</span>}
        {open ? <ChevronUp className="h-4 w-4 text-[var(--tl-text-3)]" /> : <ChevronDown className="h-4 w-4 text-[var(--tl-text-3)]" />}
      </button>
      {open && (
        <div className="space-y-3 border-t border-[var(--tl-hint)] px-3 pb-3 pt-2.5">
          {/* raw → filtered readout */}
          <div className="rounded-[9px] bg-[var(--tl-low)] p-2 font-mono text-[10.5px] tabular-nums text-[var(--tl-text-2)]" aria-live="off">
            <div className="font-sans text-[11px] font-medium text-[var(--tl-text-3)]">raw → filtered (stroke in progress)</div>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
              <Pair label="force" raw={hud.pressure.toFixed(2)} out={hud.filtered ? hud.filtered.p.toFixed(2) : '–'} />
              <Pair label="altitude" raw={`${Math.round(hud.altitude)}°`} out={hud.filtered ? `${Math.round(hud.filtered.alt)}°` : '–'} />
              <Pair label="azimuth" raw={`${Math.round(hud.azimuth)}°`} out={hud.filtered ? `${Math.round(hud.filtered.az)}°` : '–'} />
              <Pair label="twist" raw={`${Math.round(hud.twist)}°`} out={hud.filtered ? `${Math.round(hud.filtered.tw)}°` : '–'} />
            </div>
          </div>

          <Channel title="Position" hint="Kalman: constant-velocity model per axis, one step per recorded sample. Streamline: the fixed pull toward each sample the app used before.">
            <ToggleGroup type="single" value={f.position.mode} aria-label="Position filter" onValueChange={(v) => v && set({ position: { mode: v as FilterSettings['position']['mode'] } })} className="justify-start gap-1">
              <Mode value="kalman">Kalman</Mode><Mode value="streamline">Streamline</Mode><Mode value="off">Off</Mode>
            </ToggleGroup>
            {f.position.mode === 'kalman' && (
              <>
                <Presets current={{ q: f.position.q, r: f.position.r }} presets={POSITION_PRESETS} onPick={(p) => set({ position: p })} />
                <LogSlider label="Process noise q" unit="px²" value={f.position.q} min={0.001} max={10} onChange={(q) => set({ position: { q } })} />
                <LogSlider label="Measurement noise r" unit="px²" value={f.position.r} min={0.1} max={200} onChange={(r) => set({ position: { r } })} />
                <Note>Lower q or higher r smooths more and lags more. r ≈ the jitter you see, in px².</Note>
              </>
            )}
            {f.position.mode === 'streamline' && (
              <Row label={`Streamline ${f.position.streamline.toFixed(2)}`}><Slider min={0.1} max={1} step={0.025} value={[f.position.streamline]} onValueChange={([v]) => set({ position: { streamline: v } })} /></Row>
            )}
          </Channel>

          <Channel title="Pressure" hint="Kalman: random-walk model on the force (also on simulated finger/mouse pressure). Average: the half-weight running average used before.">
            <ToggleGroup type="single" value={f.pressure.mode} aria-label="Pressure filter" onValueChange={(v) => v && set({ pressure: { mode: v as FilterSettings['pressure']['mode'] } })} className="justify-start gap-1">
              <Mode value="kalman">Kalman</Mode><Mode value="average">Average</Mode><Mode value="off">Off</Mode>
            </ToggleGroup>
            {f.pressure.mode === 'kalman' && (
              <>
                <Presets current={{ q: f.pressure.q, r: f.pressure.r }} presets={PRESSURE_PRESETS} onPick={(p) => set({ pressure: p })} />
                <KalmanSliders q={f.pressure.q} r={f.pressure.r} qRange={[0.00001, 0.05]} rRange={[0.0005, 0.5]} onChange={(p) => set({ pressure: p })} />
              </>
            )}
          </Channel>

          <Channel title="Tilt (altitude + azimuth)" hint="Random-walk Kalman on both angles; azimuth is unwrapped across 360° first.">
            <ToggleGroup type="single" value={f.tilt.mode} aria-label="Tilt filter" onValueChange={(v) => v && set({ tilt: { mode: v as FilterSettings['tilt']['mode'] } })} className="justify-start gap-1">
              <Mode value="kalman">Kalman</Mode><Mode value="off">Off</Mode>
            </ToggleGroup>
            {f.tilt.mode === 'kalman' && <KalmanSliders q={f.tilt.q} r={f.tilt.r} unit="deg²" qRange={[0.01, 50]} rRange={[0.5, 500]} onChange={(p) => set({ tilt: p })} />}
          </Channel>

          <Channel title="Twist" hint="Random-walk Kalman on the Pencil Pro barrel roll.">
            <ToggleGroup type="single" value={f.twist.mode} aria-label="Twist filter" onValueChange={(v) => v && set({ twist: { mode: v as FilterSettings['twist']['mode'] } })} className="justify-start gap-1">
              <Mode value="kalman">Kalman</Mode><Mode value="off">Off</Mode>
            </ToggleGroup>
            {f.twist.mode === 'kalman' && <KalmanSliders q={f.twist.q} r={f.twist.r} unit="deg²" qRange={[0.01, 50]} rRange={[0.5, 500]} onChange={(p) => set({ twist: p })} />}
          </Channel>

          <label className="flex cursor-pointer items-start gap-2.5">
            <div className="flex-1">
              <div className="text-[12px] font-medium text-[var(--tl-text-1)]">Show raw input path</div>
              <div className="mt-0.5 text-[11px] leading-snug text-[var(--tl-text-3)]">Draws the unfiltered samples in red over the stroke, kept until the next stroke.</div>
            </div>
            <Switch checked={f.showRaw} onCheckedChange={(v) => set({ showRaw: v })} aria-label="Show raw input path" className="mt-0.5" />
          </label>

          <div className="flex items-center justify-between border-t border-[var(--tl-hint)] pt-2 text-[10.5px] text-[var(--tl-text-3)]">
            <span>Strokes keep the filters they were drawn with.</span>
            <button type="button" className="tl-opt h-6 gap-1 px-1.5 text-[10.5px]" onClick={() => set({ ...DEFAULT_FILTERS })}><RotateCcw className="h-3 w-3" />Defaults</button>
          </div>
        </div>
      )}
    </div>
  );
}

type QR = { q: number; r: number };
const POSITION_PRESETS: Array<{ name: string; hint: string } & QR> = [
  { name: 'Responsive', hint: 'follows quick changes of direction', q: 0.2, r: 2 },
  { name: 'Balanced', hint: 'jitter gone, little lag', q: 0.02, r: 4 },
  { name: 'Smooth', hint: 'long, even curves', q: 0.005, r: 12 },
  { name: 'Heavy', hint: 'ruler-like, noticeable lag', q: 0.002, r: 30 },
];
const PRESSURE_PRESETS: Array<{ name: string; hint: string } & QR> = [
  { name: 'Light', hint: 'keeps quick force changes', q: 0.002, r: 0.005 },
  { name: 'Medium', hint: 'takes the flicker out', q: 0.0005, r: 0.01 },
  { name: 'Heavy', hint: 'slow, even pressure', q: 0.0001, r: 0.03 },
];

/** One-tap parameter sets; the sliders below stay available for fine-tuning. */
function Presets({ current, presets, onPick }: { current: QR; presets: Array<{ name: string; hint: string } & QR>; onPick: (p: QR) => void }) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Presets">
      {presets.map((p) => {
        const active = Math.abs(p.q - current.q) / p.q < 0.05 && Math.abs(p.r - current.r) / p.r < 0.05;
        return (
          <button key={p.name} type="button" title={p.hint} aria-pressed={active} onClick={() => onPick({ q: p.q, r: p.r })}
            className={cn('tl-opt h-7 rounded-[7px] px-2 text-[11px]', active && 'bg-[var(--tl-hint-strong)] text-[var(--tl-text-1)]')}>
            {p.name}
          </button>
        );
      })}
    </div>
  );
}

function Channel({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[12px] font-medium text-[var(--tl-text-1)]">{title}</div>
      <div className="mb-1.5 mt-0.5 text-[11px] leading-snug text-[var(--tl-text-3)]">{hint}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Mode({ value, children }: { value: string; children: React.ReactNode }) {
  return <ToggleGroupItem value={value} className="tl-opt h-7 rounded-[7px] px-2 text-[11px] data-[state=on]:bg-[var(--tl-hint-strong)] data-[state=on]:text-[var(--tl-text-1)]">{children}</ToggleGroupItem>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] text-[var(--tl-text-2)]">{label}</div>
      {children}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="text-[10.5px] leading-snug text-[var(--tl-text-3)]">{children}</div>;
}

function Pair({ label, raw, out }: { label: string; raw: string; out: string }) {
  return <div className="flex justify-between"><span>{label}</span><span>{raw} <span className="text-[var(--tl-text-3)]">→</span> <span className="text-[var(--tl-selected)]">{out}</span></span></div>;
}

/** Slider on a log scale between min and max (for noise variances spanning decades). */
function LogSlider({ label, unit, value, min, max, onChange }: { label: string; unit?: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const t = Math.round((Math.log(value / min) / Math.log(max / min)) * 200);
  const fmt = (v: number) => (v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toPrecision(2));
  return (
    <Row label={`${label} ${fmt(value)}${unit ? ' ' + unit : ''}`}>
      <Slider min={0} max={200} step={1} value={[Math.max(0, Math.min(200, t))]} onValueChange={([s]) => onChange(+(min * Math.pow(max / min, s / 200)).toPrecision(3))} />
    </Row>
  );
}

function KalmanSliders({ q, r, unit, qRange, rRange, onChange }: { q: number; r: number; unit?: string; qRange: [number, number]; rRange: [number, number]; onChange: (p: { q?: number; r?: number }) => void }) {
  const gain = Kalman1D.steadyGain(q, r);
  return (
    <>
      <LogSlider label="Process noise q" unit={unit} value={q} min={qRange[0]} max={qRange[1]} onChange={(v) => onChange({ q: v })} />
      <LogSlider label="Measurement noise r" unit={unit} value={r} min={rRange[0]} max={rRange[1]} onChange={(v) => onChange({ r: v })} />
      <Note>Steady-state gain <span className={cn('font-mono', gain < 0.15 ? 'text-[var(--tl-danger)]' : 'text-[var(--tl-text-2)]')}>{Math.round(gain * 100)}%</span> of each new sample gets through{gain < 0.15 ? ' (heavy lag)' : ''}.</Note>
    </>
  );
}
