import { FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useStudio, useStudioState } from '@/hooks/useStudio';
import { allPencilOff, anyPencilOn, tiltFlat } from '@/engine/pencil';
import { Calibration } from '@/components/PencilTab';
import { LabCard } from '@/components/LabCard';
import { Row } from '@/components/FilterControls';
import { cn } from '@/lib/utils';

/**
 * Pencil lab: switches for every Apple Pencil feature, with live telemetry so
 * it is obvious what the device reports. Effects apply to the next stroke;
 * each stroke keeps the effects it was drawn with.
 */
export function PencilLab({ defaultOpen = true }: { defaultOpen?: boolean }) {
  const studio = useStudio();
  const pencil = useStudioState((s) => s.settings.pencil);
  const hud = useStudioState((s) => s.hud);
  const isPen = hud.pointerType === 'pen';
  const flat = tiltFlat(hud.altitude);

  return (
    <LabCard id="pencil" icon={FlaskConical} title="Pencil lab" badge={anyPencilOn(pencil) ? 'active' : null} defaultOpen={defaultOpen} testId="pencil-lab">
      {/* Telemetry */}
      <div className="rounded-[10px] bg-[var(--low)] p-2 font-mono text-[10.5px] tabular-nums text-[var(--text-2)]" aria-live="off" data-testid="pencil-telemetry">
        <div className="flex items-center justify-between">
          <span className={cn('font-sans text-[11px] font-medium', isPen ? 'text-[var(--accent-strong)]' : 'text-[var(--text-3)]')}>
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

      <Calibration />

      <div className="flex items-center justify-between border-t border-[var(--hint)] pt-2 text-[10.5px] text-[var(--text-3)]">
        <span>Strokes remember the effects they were drawn with.</span>
        <Button variant="ghost" size="xs" onClick={() => studio.setPencil(allPencilOff(pencil))}>All off</Button>
      </div>
    </LabCard>
  );
}

function Feature({ title, hint, on, onChange, children }: { title: string; hint: string; on: boolean; onChange: (v: boolean) => void; children?: React.ReactNode }) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-2.5">
        <div className="flex-1">
          <div className="text-[12px] font-medium text-[var(--text-1)]">{title}</div>
          <div className="mt-0.5 text-[11px] leading-snug text-[var(--text-3)]">{hint}</div>
        </div>
        <Switch checked={on} onCheckedChange={onChange} aria-label={title} className="mt-0.5" />
      </label>
      {on && children && <div className="mt-2 space-y-2 pl-1">{children}</div>}
    </div>
  );
}

function Meter({ label, value, text }: { label: string; value: number; text: string }) {
  return (
    <div>
      <div className="flex justify-between"><span>{label}</span><span>{text}</span></div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[var(--hint-strong)]"><div className="h-full bg-[var(--accent)]" style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} /></div>
    </div>
  );
}

function Dial({ label, deg }: { label: string; deg: number }) {
  return (
    <div className="flex items-center justify-between gap-1">
      <span>{label}</span>
      <span className="relative inline-block h-4 w-4 rounded-full border border-[var(--hint-strong)]">
        <span className="absolute left-1/2 top-1/2 h-[1.5px] w-[7px] origin-left bg-[var(--accent)]" style={{ transform: `rotate(${deg}deg)` }} />
      </span>
      <span>{Math.round(deg)}°</span>
    </div>
  );
}
