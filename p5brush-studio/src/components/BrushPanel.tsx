import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TipPreview } from '@/components/TipPreview';
import { useStudio, useStudioState } from '@/hooks/useStudio';
import { paperPresets } from '@/engine/Studio';
import { fmt, type PaperName, type PressureMode } from '@/engine/records';
import { setTipDegrees, tipUsesDegrees } from '@/engine/tipShim';
import { cn } from '@/lib/utils';

const swatches = [
  { name: 'Sumi Ink', hex: '#1a1c23' },
  { name: 'Charcoal Slate', hex: '#3b3e47' },
  { name: 'Burnt Umber', hex: '#4d2c1d' },
  { name: 'Indigo Blue', hex: '#1c325c' },
  { name: 'Vermillion', hex: '#992a22' },
  { name: 'Olive Moss', hex: '#2b462f' },
  { name: 'Warm Ochre', hex: '#9b681e' },
  { name: 'Cobalt Teal', hex: '#1f6f7a' },
];

const pressureHelp: Record<PressureMode, string> = {
  gaussian: 'Gaussian envelope simulated per stroke, exactly like brush.line() / brush.spline().',
  both: 'p5.brush envelope multiplied by live Apple Pencil force (plot pressure).',
  stylus: 'Envelope disabled — stamp size follows pen force only (constant 1.0 for mouse/touch).',
};

function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
      <span>{children}</span>
      {action}
    </div>
  );
}

function Param({ label, hint, value, display, min, max, step, onChange }: {
  label: string; hint?: string; value: number; display: string; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-slate-700">
        <span>{label}{hint && <span className="text-slate-400"> {hint}</span>}</span>
        <span className="font-mono text-[11px] font-semibold text-indigo-700">{display}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

function NumberField({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <label className="space-y-0.5 font-mono text-[9px] text-slate-500">
      <span>{label}</span>
      <Input
        type="number" step="0.01" value={text} onChange={(e) => setText(e.target.value)}
        onBlur={() => { const v = parseFloat(text); if (Number.isFinite(v)) onCommit(v); else setText(String(value)); }}
        className="h-7 px-1.5 font-mono text-[11px]"
      />
    </label>
  );
}

export function BrushPanel({ open }: { open: boolean }) {
  const studio = useStudio();
  const s = useStudioState((st) => st.settings);
  const tipError = useStudioState((st) => st.tipError);
  const { spec } = s;

  const [tipDraft, setTipDraft] = useState(s.tipSource);
  useEffect(() => setTipDraft(s.tipSource), [s.tipSource]);
  const [tipPreviewBad, setTipPreviewBad] = useState(false);

  const [specDraft, setSpecDraft] = useState('');
  const [specEditing, setSpecEditing] = useState(false);
  const [specInvalid, setSpecInvalid] = useState(false);
  const liveSpecCode = studio.specCode();
  useEffect(() => { if (!specEditing) { setSpecDraft(liveSpecCode); setSpecInvalid(false); } }, [liveSpecCode, specEditing]);

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); toast(`${label} copied to clipboard`); }
    catch { toast('Copy failed — clipboard unavailable'); }
  };

  const applyTip = () => {
    if (tipDraft === s.tipSource) return;
    if (studio.setTipSource(tipDraft)) toast('Tip updated');
    else toast.error('Tip code error');
  };

  return (
    <aside
      className={cn(
        'paper-card fixed right-3 top-[4.5rem] z-40 flex w-[19.5rem] max-h-[calc(100vh-5.5rem)] flex-col transition-all duration-300 sm:right-6',
        !open && 'pointer-events-none translate-x-[120%] opacity-0',
      )}
    >
      <div className="custom-scroll max-h-[calc(100vh-5.5rem)] overflow-y-auto overflow-x-hidden">
        <div className="flex w-[19.5rem] flex-col gap-4 p-4">
          {/* Tip preview */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-paper-100 shadow-inner">
                <TipPreview tipSource={s.tipSource} onError={setTipPreviewBad} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Custom tip mask</div>
                <div className="font-mono text-[10px] text-indigo-700">100×100 space · 500px raster</div>
              </div>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-800">{fmt(spec.weight)}px</span>
          </div>
          <Separator />

          {/* Pigment */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>Pigment</span>
              <div className="flex items-center gap-1.5">
                <input type="color" value={s.color} onChange={(e) => studio.setColor(e.target.value)} className="h-6 w-6 cursor-pointer rounded border border-slate-300 bg-transparent" aria-label="Pick pigment colour" />
                <span className="font-mono text-[10px] text-slate-500">{s.color.toUpperCase()}</span>
              </div>
            </div>
            <div className="grid grid-cols-8 gap-1.5">
              {swatches.map((sw) => (
                <button
                  key={sw.hex} title={sw.name} aria-label={sw.name}
                  onClick={() => studio.setColor(sw.hex)}
                  style={{ backgroundColor: sw.hex }}
                  className={cn('h-7 w-7 rounded-lg border border-slate-300 transition hover:scale-110', s.color.toLowerCase() === sw.hex && 'scale-105 border-slate-900 ring-2 ring-indigo-500')}
                />
              ))}
            </div>
          </div>

          {/* Paper */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>Paper</span><span className="text-[10px] font-normal text-slate-400">Pigment mixes with paper</span>
            </div>
            <ToggleGroup type="single" value={s.paper} onValueChange={(v) => v && studio.setPaper(v as PaperName)} className="grid grid-cols-3 gap-1.5">
              {(Object.keys(paperPresets) as PaperName[]).map((p) => (
                <ToggleGroupItem key={p} value={p} variant="outline" size="sm" className="h-auto whitespace-normal px-2 py-1.5 text-xs data-[state=on]:bg-slate-900 data-[state=on]:text-white">
                  {p === 'hotpress' ? 'Hot Press' : p === 'washi' ? 'Warm Washi' : 'Pure White'}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <Separator />

          {/* brush.add parameters */}
          <div className="space-y-3">
            <SectionTitle action={<button className="font-mono text-[10px] normal-case tracking-normal text-indigo-600 hover:text-indigo-800" onClick={() => studio.resetDefaults()}>reset defaults</button>}>
              brush.add parameters
            </SectionTitle>
            <Param label="weight" value={spec.weight} display={fmt(spec.weight)} min={1} max={80} step={1} onChange={(v) => studio.setSpec({ weight: v })} />
            <Param label="opacity" hint="(0–255 per stamp)" value={spec.opacity} display={fmt(spec.opacity)} min={1} max={80} step={1} onChange={(v) => studio.setSpec({ opacity: v })} />
            <Param label="scatter" value={spec.scatter} display={spec.scatter.toFixed(2)} min={0} max={10} step={0.05} onChange={(v) => studio.setSpec({ scatter: v })} />
            <Param label="spacing" hint="(px between stamps)" value={spec.spacing} display={spec.spacing.toFixed(2)} min={0.1} max={15} step={0.1} onChange={(v) => studio.setSpec({ spacing: v })} />
            <Param label="noise" hint="(per-stroke opacity variation)" value={spec.noise} display={spec.noise.toFixed(2)} min={0} max={1} step={0.05} onChange={(v) => studio.setSpec({ noise: v })} />
            <Param label="brush.set size" hint="(strokeWeight)" value={s.size} display={s.size.toFixed(2) + '×'} min={0.25} max={3} step={0.05} onChange={(v) => studio.setSize(v)} />

            <div className="grid grid-cols-2 items-end gap-2">
              <div className="space-y-1 text-xs text-slate-700">
                <Label className="text-xs">rotate</Label>
                <Select value={spec.rotate} onValueChange={(v) => studio.setSpec({ rotate: v as typeof spec.rotate })}>
                  <SelectTrigger className="h-8 font-mono text-[11px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">"none"</SelectItem>
                    <SelectItem value="natural">"natural"</SelectItem>
                    <SelectItem value="random">"random"</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between pb-1.5 text-xs text-slate-700">
                <Label htmlFor="markertip" className="text-xs">markerTip</Label>
                <Switch id="markertip" checked={spec.markerTip} onCheckedChange={(v) => studio.setSpec({ markerTip: v })} />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs text-slate-700">pressure · <span className="font-mono text-[10px] text-slate-500">mode: "gaussian"</span></div>
              <div className="grid grid-cols-4 gap-1.5">
                <NumberField label="curve[0]" value={spec.pressure.curve[0]} onCommit={(v) => studio.setPressure({ curve: [v, spec.pressure.curve[1]] })} />
                <NumberField label="curve[1]" value={spec.pressure.curve[1]} onCommit={(v) => studio.setPressure({ curve: [spec.pressure.curve[0], v] })} />
                <NumberField label="min" value={spec.pressure.min_max[0]} onCommit={(v) => studio.setPressure({ min_max: [v, spec.pressure.min_max[1]] })} />
                <NumberField label="max" value={spec.pressure.min_max[1]} onCommit={(v) => studio.setPressure({ min_max: [spec.pressure.min_max[0], v] })} />
              </div>
            </div>
          </div>
          <Separator />

          {/* Tip code */}
          <div className="space-y-1.5">
            <SectionTitle action={(tipError || tipPreviewBad) ? <span className="font-mono text-[10px] normal-case tracking-normal text-rose-600">syntax error</span> : null}>
              <span className="normal-case tracking-normal">tip: (_m) =&gt; {'{ … }'}</span>
            </SectionTitle>
            <Textarea
              value={tipDraft} spellCheck={false} rows={5}
              onChange={(e) => setTipDraft(e.target.value)}
              onBlur={applyTip}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') (e.target as HTMLTextAreaElement).blur(); }}
              className={cn('code-area min-h-[84px] resize-y', (tipError || tipPreviewBad) && 'border-rose-400 bg-rose-50')}
            />
            <div className="flex items-center justify-between gap-2 text-xs text-slate-700">
              <span>rotate() units</span>
              <Select value={tipUsesDegrees(s.tipSource) ? 'degrees' : 'radians'} onValueChange={(v) => {
                const degrees = v === 'degrees';
                if (studio.setTipSource(setTipDegrees(s.tipSource, degrees))) {
                  toast(degrees ? 'Tip angles: degrees (Brush Maker preview look)' : 'Tip angles: radians (p5.Graphics / p5.brush actual)');
                }
              }}>
                <SelectTrigger className="h-8 w-[11.5rem] font-mono text-[11px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="radians">radians · p5.Graphics (actual)</SelectItem>
                  <SelectItem value="degrees">degrees · Brush Maker preview</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-[9px] leading-snug text-slate-400">
              Runs on a p5-style graphics surface: fill(gray, alpha) / stroke / rect / circle / ellipse / line / triangle / beginShape … Dark = opaque ink. Applied on blur.
              A p5.Graphics ignores the sketch's angleMode(DEGREES), so <span className="font-mono">rotate(45)</span> is 45 rad in real p5.brush output.
            </p>
          </div>
          <Separator />

          {/* Pressure source + pencil */}
          <div className="space-y-2.5">
            <SectionTitle>Stroke pressure source</SectionTitle>
            <ToggleGroup type="single" value={s.pressureMode} onValueChange={(v) => v && studio.setPressureMode(v as PressureMode)} className="grid grid-cols-3 gap-1.5">
              {(['gaussian', 'both', 'stylus'] as PressureMode[]).map((m) => (
                <ToggleGroupItem key={m} value={m} variant="outline" size="sm" className="text-[11px] data-[state=on]:bg-slate-900 data-[state=on]:text-white">
                  {m === 'gaussian' ? 'p5.brush' : m === 'both' ? 'Both' : 'Stylus'}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="text-[9px] leading-snug text-slate-400">{pressureHelp[s.pressureMode]}</p>
            <Param label="Stylus force sensitivity" value={s.forceSensitivity} display={s.forceSensitivity.toFixed(2) + 'x'} min={0.5} max={2.5} step={0.05} onChange={(v) => studio.setForceSensitivity(v)} />
            <div className="flex items-center justify-between text-xs text-slate-700">
              <Label htmlFor="pencil-only" className="text-xs">Strict Pencil-only mode</Label>
              <Switch id="pencil-only" checked={s.pencilOnly} onCheckedChange={(v) => studio.setPencilOnly(v)} />
            </div>
            <Param label="Eraser size" value={s.eraserSize} display={`${fmt(s.eraserSize)}px`} min={4} max={120} step={1} onChange={(v) => studio.setEraserSize(v)} />
          </div>
          <Separator />

          {/* Registered spec */}
          <div className="space-y-1.5">
            <SectionTitle action={
              <div className="flex gap-2 font-mono text-[10px] normal-case tracking-normal">
                <button className="text-indigo-600 hover:text-indigo-800" onClick={() => copy(studio.specCode(), 'brush.add spec')}>copy</button>
                <button className="text-indigo-600 hover:text-indigo-800" title="Copy a full p5.js sketch that replays this drawing with p5.brush" onClick={() => copy(studio.sketchCode(), 'p5.js sketch')}>copy sketch</button>
              </div>
            }>
              Registered spec
            </SectionTitle>
            <Textarea
              value={specDraft} spellCheck={false} rows={9}
              onFocus={() => setSpecEditing(true)}
              onChange={(e) => setSpecDraft(e.target.value)}
              className={cn('code-area min-h-[120px] resize-y', specInvalid && 'border-rose-400 bg-rose-50')}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] text-slate-400">Paste any <span className="font-mono">brush.add(…)</span> from the Brush Maker and apply.</span>
              <div className="flex gap-1.5">
                {specEditing && <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => { setSpecEditing(false); }}>revert</Button>}
                <Button size="sm" className="h-7 text-[10px]" onClick={() => {
                  try {
                    const name = studio.applySpecCode(specDraft);
                    setSpecInvalid(false); setSpecEditing(false);
                    toast(`brush.add("${name}") applied`);
                  } catch (err) {
                    setSpecInvalid(true);
                    toast.error('Could not parse: ' + (err as Error).message);
                  }
                }}>apply</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
