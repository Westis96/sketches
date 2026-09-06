import { useState } from 'react';
import { ChevronDown, ChevronUp, FlaskConical, RotateCcw } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useStudio, useStudioState } from '@/hooks/useStudio';
import { DEFAULT_PENCIL, tiltFlat } from '@/engine/pencil';
import { cn } from '@/lib/utils';

/**
 * Pencil lab: switches for every Apple Pencil feature under evaluation, with
 * live telemetry so it is obvious what the device reports. Effects apply to the
 * next stroke; each stroke keeps the effects it was drawn with.
 */
export function PencilLab() {
  const studio = useStudio();
  const pencil = useStudioState((s) => s.settings.pencil);
  const hud = useStudioState((s) => s.hud);
  const calibrating = useStudioState((s) => s.calibrating);
  const [open, setOpen] = useState(true);
  const isPen = hud.pointerType === 'pen';
  const flat = tiltFlat(hud.altitude);
  const changed = JSON.stringify(pencil) !== JSON.stringify(DEFAULT_PENCIL);

  return (
    <div className="tl-panel pointer-events-auto w-[min(300px,calc(100vw-16px))] text-[12px]" data-testid="pencil-lab">
      <button type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <FlaskConical className="h-4 w-4 text-[var(--tl-selected)]" />
        <span className="flex-1 text-[13px] font-semibold text-[var(--tl-text-1)]">Pencil lab</span>
        {changed && <span className="rounded-full bg-[#e7f5ff] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--tl-selected)]">modified</span>}
        {open ? <ChevronUp className="h-4 w-4 text-[var(--tl-text-3)]" /> : <ChevronDown className="h-4 w-4 text-[var(--tl-text-3)]" />}
      </button>
      {open && (
        <div className="space-y-3 border-t border-[var(--tl-hint)] px-3 pb-3 pt-2.5">
          {/* Telemetry */}
          <div className="rounded-[9px] bg-[var(--tl-low)] p-2 font-mono text-[10.5px] tabular-nums text-[var(--tl-text-2)]" aria-live="off" data-testid="pencil-telemetry">
            <div className="flex items-center justify-between">
              <span className={cn('font-sans text-[11px] font-medium', isPen ? 'text-[var(--tl-selected)]' : 'text-[var(--tl-text-3)]')}>
                {isPen ? (hud.hovering ? 'Pencil hovering' : 'Pencil') : hud.pointerType ? `${hud.pointerType} (no tilt)` : 'Waiting for input'}
              </span>
              <span>{hud.predicted > 0 ? `${hud.predicted} predicted` : ''}</span>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
              <Meter label="force" value={hud.pressure} text={hud.pressure.toFixed(2)} />
              <Meter label="altitude" value={1 - flat} text={`${Math.round(hud.altitude)}°`} />
              <Dial label="azimuth" deg={hud.azimuth} />
              <Dial label="twist" deg={hud.twist} />
            </div>
          </div>

          <Feature title="Tilt shading" hint="A flat pencil lays down a wider, lighter mark, like the side of a graphite stick." on={pencil.tiltShade} onChange={(v) => studio.setPencil({ tiltShade: v })}>
            <Row label={`Width ×${pencil.tiltWidth.toFixed(1)}`}><Slider min={1} max={4} step={0.1} value={[pencil.tiltWidth]} onValueChange={([v]) => studio.setPencil({ tiltWidth: v })} /></Row>
            <Row label={`Opacity when flat ${Math.round(pencil.tiltFade * 100)}%`}><Slider min={0.1} max={1} step={0.05} value={[pencil.tiltFade]} onValueChange={([v]) => studio.setPencil({ tiltFade: v })} /></Row>
          </Feature>

          <Feature title="Azimuth nib" hint="The tip turns with the pencil's lean, like a broad nib, instead of following the stroke. Try the calligraphy nib." on={pencil.nib === 'azimuth'} onChange={(v) => studio.setPencil({ nib: v ? 'azimuth' : 'stroke' })} />

          <Feature title="Barrel roll" hint="Rolling a Pencil Pro turns the tip (relative to how it was held at pen-down)." on={pencil.roll} onChange={(v) => studio.setPencil({ roll: v })} />

          <Feature title="Hover footprint" hint="While a Pencil hovers, the cursor shows the tilted footprint the mark would have." on={pencil.hover} onChange={(v) => studio.setPencil({ hover: v })} />

          <Feature title="Predicted tail" hint="Draws the browser's predicted samples ahead of the ink as a light tail; replaced as the real samples arrive." on={pencil.predict} onChange={(v) => studio.setPencil({ predict: v })} />

          <div>
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-medium text-[var(--tl-text-1)]">Pressure calibration</div>
              {pencil.calib && <button type="button" className="tl-opt h-6 gap-1 px-1.5 text-[10.5px]" onClick={() => studio.setPencil({ calib: null })}><RotateCcw className="h-3 w-3" />Reset</button>}
            </div>
            <div className="mt-0.5 text-[11px] leading-snug text-[var(--tl-text-3)]">
              {pencil.calib
                ? <>Your range <span className="font-mono">{pencil.calib.min.toFixed(2)}–{pencil.calib.max.toFixed(2)}</span> is mapped to the full pressure curve.</>
                : 'Maps the force range you actually use to the full pressure curve.'}
            </div>
            <button
              type="button"
              className={cn('mt-1.5 inline-flex h-8 items-center rounded-[8px] px-3 text-[11.5px] font-medium', calibrating ? 'bg-[var(--tl-hint-strong)] text-[var(--tl-text-2)]' : 'bg-[var(--tl-selected)] text-white hover:bg-[#2a74d8]')}
              disabled={calibrating}
              onClick={() => studio.startCalibration()}
              data-testid="calibrate"
            >
              {calibrating ? 'Draw light and hard strokes…' : pencil.calib ? 'Calibrate again' : 'Calibrate (8 s)'}
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--tl-hint)] pt-2 text-[10.5px] text-[var(--tl-text-3)]">
            <span>Strokes remember the effects they were drawn with.</span>
            <button type="button" className="tl-opt h-6 px-1.5 text-[10.5px]" onClick={() => studio.setPencil({ ...DEFAULT_PENCIL })}>All off</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Feature({ title, hint, on, onChange, children }: { title: string; hint: string; on: boolean; onChange: (v: boolean) => void; children?: React.ReactNode }) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-2.5">
        <div className="flex-1">
          <div className="text-[12px] font-medium text-[var(--tl-text-1)]">{title}</div>
          <div className="mt-0.5 text-[11px] leading-snug text-[var(--tl-text-3)]">{hint}</div>
        </div>
        <Switch checked={on} onCheckedChange={onChange} aria-label={title} className="mt-0.5" />
      </label>
      {on && children && <div className="mt-2 space-y-2 pl-1">{children}</div>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] text-[var(--tl-text-2)]">{label}</div>
      {children}
    </div>
  );
}

function Meter({ label, value, text }: { label: string; value: number; text: string }) {
  return (
    <div>
      <div className="flex justify-between"><span>{label}</span><span>{text}</span></div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[var(--tl-hint-strong)]"><div className="h-full bg-[var(--tl-selected)]" style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} /></div>
    </div>
  );
}

function Dial({ label, deg }: { label: string; deg: number }) {
  return (
    <div className="flex items-center justify-between gap-1">
      <span>{label}</span>
      <span className="relative inline-block h-4 w-4 rounded-full border border-[var(--tl-hint-strong)]">
        <span className="absolute left-1/2 top-1/2 h-[1.5px] w-[7px] origin-left bg-[var(--tl-selected)]" style={{ transform: `rotate(${deg}deg)` }} />
      </span>
      <span>{Math.round(deg)}°</span>
    </div>
  );
}
