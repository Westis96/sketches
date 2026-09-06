import { RotateCcw, Waves } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { useStudio, useStudioState } from '@/hooks/useStudio';
import { DEFAULT_FILTERS, sameFilterParams, type FilterPatch, type FilterSettings } from '@/engine/filters';
import { KalmanSliders, LogSlider, Mode, Note, POSITION_PRESETS, PRESSURE_PRESETS, Presets, Row } from '@/components/FilterControls';
import { LabCard } from '@/components/LabCard';

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
  const changed = !sameFilterParams(f, DEFAULT_FILTERS) || f.showRaw !== DEFAULT_FILTERS.showRaw;
  const set = (patch: FilterPatch) => studio.setFilters(patch);

  return (
    <LabCard id="filters" icon={Waves} title="Input filters" badge={changed ? 'modified' : null} defaultOpen={defaultOpen} testId="input-filters">
      {/* raw → filtered readout */}
      <div className="rounded-[10px] bg-[var(--low)] p-2 font-mono text-[10.5px] tabular-nums text-[var(--text-2)]" aria-live="off">
        <div className="font-sans text-[11px] font-medium text-[var(--text-3)]">raw → filtered (stroke in progress)</div>
        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
          <Pair label="force" raw={hud.pressure.toFixed(2)} out={hud.filtered ? hud.filtered.p.toFixed(2) : '–'} />
          <Pair label="altitude" raw={`${Math.round(hud.altitude)}°`} out={hud.filtered ? `${Math.round(hud.filtered.alt)}°` : '–'} />
          <Pair label="azimuth" raw={`${Math.round(hud.azimuth)}°`} out={hud.filtered ? `${Math.round(hud.filtered.az)}°` : '–'} />
          <Pair label="twist" raw={`${Math.round(hud.twist)}°`} out={hud.filtered ? `${Math.round(hud.filtered.tw)}°` : '–'} />
        </div>
      </div>

      <Channel title="Position" hint="Kalman: constant-velocity model per axis, one step per recorded sample. Streamline: the fixed pull toward each sample the app used before.">
        <ToggleGroup type="single" value={f.position.mode} aria-label="Position filter" onValueChange={(v) => v && set({ position: { mode: v as FilterSettings['position']['mode'] } })}>
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
        <ToggleGroup type="single" value={f.pressure.mode} aria-label="Pressure filter" onValueChange={(v) => v && set({ pressure: { mode: v as FilterSettings['pressure']['mode'] } })}>
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
        <ToggleGroup type="single" value={f.tilt.mode} aria-label="Tilt filter" onValueChange={(v) => v && set({ tilt: { mode: v as FilterSettings['tilt']['mode'] } })}>
          <Mode value="kalman">Kalman</Mode><Mode value="off">Off</Mode>
        </ToggleGroup>
        {f.tilt.mode === 'kalman' && <KalmanSliders q={f.tilt.q} r={f.tilt.r} unit="deg²" qRange={[0.01, 50]} rRange={[0.5, 500]} onChange={(p) => set({ tilt: p })} />}
      </Channel>

      <Channel title="Twist" hint="Random-walk Kalman on the Pencil Pro barrel roll.">
        <ToggleGroup type="single" value={f.twist.mode} aria-label="Twist filter" onValueChange={(v) => v && set({ twist: { mode: v as FilterSettings['twist']['mode'] } })}>
          <Mode value="kalman">Kalman</Mode><Mode value="off">Off</Mode>
        </ToggleGroup>
        {f.twist.mode === 'kalman' && <KalmanSliders q={f.twist.q} r={f.twist.r} unit="deg²" qRange={[0.01, 50]} rRange={[0.5, 500]} onChange={(p) => set({ twist: p })} />}
      </Channel>

      <label className="flex cursor-pointer items-start gap-2.5">
        <div className="flex-1">
          <div className="text-[12px] font-medium text-[var(--text-1)]">Show raw input path</div>
          <div className="mt-0.5 text-[11px] leading-snug text-[var(--text-3)]">Draws the unfiltered samples in red over the stroke, kept until the next stroke.</div>
        </div>
        <Switch checked={f.showRaw} onCheckedChange={(v) => set({ showRaw: v })} aria-label="Show raw input path" className="mt-0.5" />
      </label>

      <div className="flex items-center justify-between border-t border-[var(--hint)] pt-2 text-[10.5px] text-[var(--text-3)]">
        <span>Strokes keep the filters they were drawn with.</span>
        <Button variant="ghost" size="xs" onClick={() => set({ ...DEFAULT_FILTERS })}><RotateCcw />Defaults</Button>
      </div>
    </LabCard>
  );
}

function Channel({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[12px] font-medium text-[var(--text-1)]">{title}</div>
      <div className="mb-1.5 mt-0.5 text-[11px] leading-snug text-[var(--text-3)]">{hint}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Pair({ label, raw, out }: { label: string; raw: string; out: string }) {
  return <div className="flex justify-between"><span>{label}</span><span>{raw} <span className="text-[var(--text-3)]">→</span> <span className="text-[var(--accent-strong)]">{out}</span></span></div>;
}
