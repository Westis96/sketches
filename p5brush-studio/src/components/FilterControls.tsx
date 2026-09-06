import { Slider } from '@/components/ui/slider';
import { ToggleGroupItem } from '@/components/ui/toggle-group';
import { Kalman1D } from '@/engine/filters';
import { cn } from '@/lib/utils';

/** Shared controls for the input filters (Pencil tab in the style panel, Input filters card in the lab). */

export type QR = { q: number; r: number };
export interface FilterPreset extends QR { name: string; hint: string }

export const POSITION_PRESETS: FilterPreset[] = [
  { name: 'Responsive', hint: 'follows quick changes of direction', q: 0.2, r: 2 },
  { name: 'Balanced', hint: 'jitter gone, little lag', q: 0.02, r: 4 },
  { name: 'Smooth', hint: 'long, even curves', q: 0.005, r: 12 },
  { name: 'Heavy', hint: 'ruler-like, noticeable lag', q: 0.002, r: 30 },
];
export const PRESSURE_PRESETS: FilterPreset[] = [
  { name: 'Light', hint: 'keeps quick force changes', q: 0.002, r: 0.005 },
  { name: 'Medium', hint: 'takes the flicker out', q: 0.0005, r: 0.01 },
  { name: 'Heavy', hint: 'slow, even pressure', q: 0.0001, r: 0.03 },
];

export const presetMatches = (p: QR, current: QR) => Math.abs(p.q - current.q) / p.q < 0.05 && Math.abs(p.r - current.r) / p.r < 0.05;

/** One-tap parameter sets; sliders stay available for fine-tuning. */
export function Presets({ current, presets, onPick, extra }: { current: QR | null; presets: FilterPreset[]; onPick: (p: QR) => void; extra?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Presets">
      {presets.map((p) => {
        const active = !!current && presetMatches(p, current);
        return (
          <button key={p.name} type="button" title={p.hint} aria-pressed={active} onClick={() => onPick({ q: p.q, r: p.r })}
            className={cn('tl-opt h-7 rounded-[7px] px-2 text-[11px]', active && 'bg-[var(--tl-hint-strong)] text-[var(--tl-text-1)]')}>
            {p.name}
          </button>
        );
      })}
      {extra}
    </div>
  );
}

export function Mode({ value, children }: { value: string; children: React.ReactNode }) {
  return <ToggleGroupItem value={value} className="tl-opt h-7 rounded-[7px] px-2 text-[11px] data-[state=on]:bg-[var(--tl-hint-strong)] data-[state=on]:text-[var(--tl-text-1)]">{children}</ToggleGroupItem>;
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] text-[var(--tl-text-2)]">{label}</div>
      {children}
    </div>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return <div className="text-[10.5px] leading-snug text-[var(--tl-text-3)]">{children}</div>;
}

/** Slider on a log scale between min and max (for noise variances spanning decades). */
export function LogSlider({ label, unit, value, min, max, onChange }: { label: string; unit?: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const t = Math.round((Math.log(value / min) / Math.log(max / min)) * 200);
  const fmt = (v: number) => (v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toPrecision(2));
  return (
    <Row label={`${label} ${fmt(value)}${unit ? ' ' + unit : ''}`}>
      <Slider min={0} max={200} step={1} value={[Math.max(0, Math.min(200, t))]} onValueChange={([s]) => onChange(+(min * Math.pow(max / min, s / 200)).toPrecision(3))} />
    </Row>
  );
}

export function KalmanSliders({ q, r, unit, qRange, rRange, onChange }: { q: number; r: number; unit?: string; qRange: [number, number]; rRange: [number, number]; onChange: (p: { q?: number; r?: number }) => void }) {
  const gain = Kalman1D.steadyGain(q, r);
  return (
    <>
      <LogSlider label="Process noise q" unit={unit} value={q} min={qRange[0]} max={qRange[1]} onChange={(v) => onChange({ q: v })} />
      <LogSlider label="Measurement noise r" unit={unit} value={r} min={rRange[0]} max={rRange[1]} onChange={(v) => onChange({ r: v })} />
      <Note>Steady-state gain <span className={cn('font-mono', gain < 0.15 ? 'text-[var(--tl-danger)]' : 'text-[var(--tl-text-2)]')}>{Math.round(gain * 100)}%</span> of each new sample gets through{gain < 0.15 ? ' (heavy lag)' : ''}.</Note>
    </>
  );
}
