import { useEffect, useState } from 'react';
import { ChevronRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { useStudio, useStudioState } from '@/hooks/useStudio';
import { usePersistedState } from '@/hooks/usePersistedState';
import { DEFAULT_FILTERS, sameFilterParams, type FilterPatch } from '@/engine/filters';
import { Chip, KalmanSliders, LogSlider, POSITION_PRESETS, PRESSURE_PRESETS, Presets, presetMatches } from '@/components/FilterControls';

/**
 * Pencil tab of the style panel: input smoothing (one-tap presets with the
 * Kalman parameters behind an Advanced disclosure), hover footprint, predicted
 * tail and pressure calibration. Nib direction and barrel roll live with the
 * brush (Brush tab); tilt shading stays in the lab.
 */
export function PencilTab({ onBrushTab }: { onBrushTab: () => void }) {
  const studio = useStudio();
  const f = useStudioState((s) => s.settings.filters);
  const pencil = useStudioState((s) => s.settings.pencil);
  const hud = useStudioState((s) => s.hud);
  const [advanced, setAdvanced] = usePersistedState('p5brush-studio:pencil:advanced', false);
  const set = (patch: FilterPatch) => studio.setFilters(patch);
  const posPreset = f.position.mode === 'kalman' ? POSITION_PRESETS.find((p) => presetMatches(p, f.position)) : null;
  const prPreset = f.pressure.mode === 'kalman' ? PRESSURE_PRESETS.find((p) => presetMatches(p, f.pressure)) : null;
  const modified = !sameFilterParams(f, DEFAULT_FILTERS);

  return (
    <div className="space-y-4" data-testid="pencil-tab">
      <div>
        <div className="flex items-center justify-between">
          <div className="tl-label">Smoothing</div>
          {modified && <Button variant="ghost" size="xs" onClick={() => set({ ...DEFAULT_FILTERS, showRaw: f.showRaw })}><RotateCcw />Defaults</Button>}
        </div>
        <div className="mt-1 text-[11px] text-[var(--text-2)]">Position{posPreset ? '' : f.position.mode === 'kalman' ? ' · custom' : f.position.mode === 'streamline' ? ' · classic' : ' · off'}</div>
        <div className="mt-1">
          <Presets current={f.position.mode === 'kalman' ? f.position : null} presets={POSITION_PRESETS} onPick={(p) => set({ position: { mode: 'kalman', ...p } })}
            extra={<>
              <Chip on={f.position.mode === 'streamline'} title="The pull toward each sample the app used before" onClick={() => set({ position: { mode: 'streamline' } })}>Classic</Chip>
              <Chip on={f.position.mode === 'off'} title="No position smoothing" onClick={() => set({ position: { mode: 'off' } })}>Off</Chip>
            </>} />
        </div>
        <div className="mt-2.5 text-[11px] text-[var(--text-2)]">Pressure{prPreset ? '' : f.pressure.mode === 'kalman' ? ' · custom' : f.pressure.mode === 'average' ? ' · average' : ' · off'}</div>
        <div className="mt-1">
          <Presets current={f.pressure.mode === 'kalman' ? f.pressure : null} presets={PRESSURE_PRESETS} onPick={(p) => set({ pressure: { mode: 'kalman', ...p } })}
            extra={<>
              <Chip on={f.pressure.mode === 'average'} title="The running average the app used before" onClick={() => set({ pressure: { mode: 'average' } })}>Average</Chip>
              <Chip on={f.pressure.mode === 'off'} title="Raw pen force" onClick={() => set({ pressure: { mode: 'off' } })}>Off</Chip>
            </>} />
        </div>
        <div className="mt-2.5 flex items-center justify-between text-[11.5px] text-[var(--text-2)]">
          <span>Smooth tilt and roll</span>
          <Switch checked={f.tilt.mode === 'kalman'} onCheckedChange={(v) => set({ tilt: { mode: v ? 'kalman' : 'off' }, twist: { mode: v ? 'kalman' : 'off' } })} aria-label="Smooth tilt and roll" />
        </div>
        <p className="mt-1.5 text-[10.5px] leading-snug text-[var(--text-3)]">Kalman filters, one step per recorded sample. Each stroke keeps the settings it was drawn with. Picking a brush sets its own tuning.</p>

        <Collapsible open={advanced} onOpenChange={setAdvanced}>
          <CollapsibleTrigger render={<Button variant="link" size="none" className="group mt-2 gap-1 text-[11px]" />}>
            <ChevronRight className="h-3 w-3 transition-transform group-data-[panel-open]:rotate-90" />Advanced (q, r)
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-2 rounded-[10px] bg-[var(--low)] p-2">
              {f.position.mode === 'kalman' && (
                <>
                  <div className="text-[11px] font-medium text-[var(--text-2)]">Position</div>
                  <LogSlider label="Process noise q" unit="px²" value={f.position.q} min={0.001} max={10} onChange={(q) => set({ position: { q } })} />
                  <LogSlider label="Measurement noise r" unit="px²" value={f.position.r} min={0.1} max={200} onChange={(r) => set({ position: { r } })} />
                </>
              )}
              {f.position.mode === 'streamline' && (
                <LogSlider label="Streamline" value={f.position.streamline} min={0.1} max={1} onChange={(v) => set({ position: { streamline: v } })} />
              )}
              {f.pressure.mode === 'kalman' && (
                <>
                  <div className="pt-1 text-[11px] font-medium text-[var(--text-2)]">Pressure</div>
                  <KalmanSliders q={f.pressure.q} r={f.pressure.r} qRange={[0.00001, 0.05]} rRange={[0.0005, 0.5]} onChange={(p) => set({ pressure: p })} />
                </>
              )}
              {f.tilt.mode === 'kalman' && (
                <>
                  <div className="pt-1 text-[11px] font-medium text-[var(--text-2)]">Tilt and roll</div>
                  <KalmanSliders q={f.tilt.q} r={f.tilt.r} unit="deg²" qRange={[0.01, 50]} rRange={[0.5, 500]} onChange={(p) => set({ tilt: p, twist: p })} />
                </>
              )}
              <div className="flex items-center justify-between pt-1 text-[11px] text-[var(--text-2)]">
                <span>Show raw input path</span>
                <Switch checked={f.showRaw} onCheckedChange={(v) => set({ showRaw: v })} aria-label="Show raw input path" />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div>
        <div className="tl-label">Pencil</div>
        <div className="mt-1.5 space-y-2">
          <Toggle label="Hover footprint" hint="Shows the mark's footprint while a Pencil hovers." on={pencil.hover} onChange={(v) => studio.setPencil({ hover: v })} />
          <Toggle label="Predicted tail" hint="Light tail from the browser's predicted samples, replaced as they arrive." on={pencil.predict} onChange={(v) => studio.setPencil({ predict: v })} />
        </div>
        <p className="mt-2 text-[10.5px] leading-snug text-[var(--text-3)]">
          Nib direction and barrel roll belong to the brush: <Button variant="link" size="none" className="text-[10.5px]" onClick={onBrushTab}>Brush tab</Button>.
          {hud.pointerType === 'pen' && <> Pencil seen: force {hud.pressure.toFixed(2)}, altitude {Math.round(hud.altitude)}°.</>}
        </p>
      </div>

      <Calibration />
    </div>
  );
}

function Toggle({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-2 text-[11.5px] text-[var(--text-2)]">
      <span><span className="block">{label}</span><span className="block text-[10.5px] leading-snug text-[var(--text-3)]">{hint}</span></span>
      <Switch checked={on} onCheckedChange={onChange} aria-label={label} className="mt-0.5" />
    </label>
  );
}

/** Pressure calibration: a few seconds of drawing set the force range mapped onto the curve. */
export function Calibration() {
  const studio = useStudio();
  const calib = useStudioState((s) => s.settings.pencil.calib);
  const calibrating = useStudioState((s) => s.calibrating);
  const calibration = useStudioState((s) => s.calibration);
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!calibration) return;
    const id = window.setInterval(() => setNow(performance.now()), 100);
    return () => window.clearInterval(id);
  }, [calibration]);
  const remaining = calibration ? Math.max(0, (calibration.until - now) / 1000) : 0;
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="tl-label">Pressure calibration</div>
        {calib && <Button variant="ghost" size="xs" onClick={() => studio.setPencil({ calib: null })}><RotateCcw />Reset</Button>}
      </div>
      <div className="mt-1 text-[10.5px] leading-snug text-[var(--text-3)]">
        {calib
          ? <>Your range <span className="font-mono">{calib.min.toFixed(2)}–{calib.max.toFixed(2)}</span> is mapped to the full pressure curve.</>
          : 'Maps the force range you actually use to the full pressure curve.'}
      </div>
      <Button variant={calibrating ? 'secondary' : 'default'} size="sm" className="mt-1.5" disabled={calibrating} onClick={() => studio.startCalibration()} data-testid="calibrate">
        {calibrating ? (remaining > 0 ? `Draw light and hard strokes… ${Math.ceil(remaining)} s` : 'Lift the pencil to finish') : calib ? 'Calibrate again' : 'Calibrate (8 s)'}
      </Button>
      {calibration && <Progress className="mt-1.5" value={Math.round((1 - remaining / calibration.seconds) * 100)} aria-label="Calibration progress" />}
    </div>
  );
}
