import { useEffect, useState, type ReactNode } from 'react';
import { Check, ChevronRight, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TipPreview } from '@/components/TipPreview';
import { TlTip } from '@/components/TlButton';
import { useStudio, useStudioState } from '@/hooks/useStudio';
import { paperPresets } from '@/engine/Studio';
import { fmt, type PaperName, type PressureMode } from '@/engine/records';
import { setTipDegrees, tipUsesDegrees } from '@/engine/tipShim';
import { BRUSH_TEMPLATES, matchTemplate } from '@/engine/templates';
import { cn } from '@/lib/utils';

const swatches = [
  { name: 'Sumi ink', hex: '#1a1c23' },
  { name: 'Charcoal', hex: '#3b3e47' },
  { name: 'Burnt umber', hex: '#4d2c1d' },
  { name: 'Indigo', hex: '#1c325c' },
  { name: 'Vermillion', hex: '#992a22' },
  { name: 'Olive moss', hex: '#2b462f' },
  { name: 'Warm ochre', hex: '#9b681e' },
  { name: 'Cobalt teal', hex: '#1f6f7a' },
  { name: 'Violet', hex: '#5b3a8c' },
  { name: 'Rose madder', hex: '#b23a6a' },
  { name: 'Sap green', hex: '#5a7a2a' },
];

/** tldraw-like S / M / L / XL sizes → brush.set() strokeWeight multiplier. */
const sizes: Array<{ id: string; label: string; value: number }> = [
  { id: 's', label: 'S', value: 0.5 },
  { id: 'm', label: 'M', value: 1 },
  { id: 'l', label: 'L', value: 1.6 },
  { id: 'xl', label: 'XL', value: 2.4 },
];

const paperLabels: Record<PaperName, string> = { hotpress: 'Hot press', washi: 'Washi', bristol: 'White' };
const pressureHelp: Record<PressureMode, string> = {
  gaussian: 'Gaussian envelope simulated per stroke, exactly like brush.line() / brush.spline().',
  both: 'p5.brush envelope multiplied by live pen force.',
  stylus: 'Envelope off — stamp size follows pen force only (constant 1.0 for mouse/touch).',
};

function Section({ label, children, trailing }: { label: string; children: ReactNode; trailing?: ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="tl-label">{label}</div>
        {trailing}
      </div>
      {children}
    </div>
  );
}

function Param({ label, value, display, min, max, step, onChange }: {
  label: string; value: number; display: string; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[11px]">
        <span className="font-medium text-[var(--tl-text-3)]">{label}</span>
        <span className="font-mono tabular-nums text-[var(--tl-text-2)]">{display}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

function NumberField({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <label className="block font-mono text-[10px] text-[var(--tl-text-3)]">
      <span>{label}</span>
      <Input
        type="number" step="0.01" value={text} onChange={(e) => setText(e.target.value)}
        onBlur={() => { const v = parseFloat(text); if (Number.isFinite(v)) onCommit(v); else setText(String(value)); }}
        className="mt-0.5 h-7 rounded-[7px] border-0 bg-[var(--tl-low)] px-1.5 font-mono text-[11px] shadow-none focus-visible:ring-1"
      />
    </label>
  );
}

type Tab = 'style' | 'brush' | 'code';
const TAB_KEY = 'p5brush-studio:tab';

export function StylePanel({ open }: { open: boolean }) {
  const studio = useStudio();
  const s = useStudioState((st) => st.settings);
  const tipError = useStudioState((st) => st.tipError);
  const previews = useStudioState((st) => st.templatePreviews);
  const { spec } = s;
  const activeTemplate = matchTemplate(spec, s.tipSource);
  const [tab, setTab] = useState<Tab>(() => {
    try { const t = localStorage.getItem(TAB_KEY); return t === 'brush' || t === 'code' ? t : 'style'; } catch { return 'style'; }
  });
  const selectTab = (t: string) => { setTab(t as Tab); try { localStorage.setItem(TAB_KEY, t); } catch { /* ignore */ } };

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
    catch { toast.error('Copy failed — clipboard unavailable'); }
  };
  const applyTip = () => {
    if (tipDraft === s.tipSource) return;
    if (studio.setTipSource(tipDraft)) toast('Tip updated'); else toast.error('Tip code error');
  };
  const activeSize = sizes.find((z) => Math.abs(z.value - s.size) < 1e-6)?.id ?? '';
  const isCustomColor = !swatches.some((sw) => sw.hex === s.color.toLowerCase());
  const tipBad = !!tipError || tipPreviewBad;

  return (
    <aside
      className={cn(
        'tl-panel pointer-events-auto flex w-[min(16.5rem,calc(100vw-1rem))] max-h-[calc(var(--tl-vh)-5.25rem)] flex-col overflow-hidden transition-all duration-200 sm:max-h-[calc(var(--tl-vh)-4.25rem)]',
        !open && 'pointer-events-none translate-x-4 opacity-0',
      )}
    >
      <Tabs value={tab} onValueChange={selectTab} className="flex min-h-0 flex-col">
        <TabsList className="m-1.5 mb-0 grid h-8 grid-cols-3 rounded-[9px] bg-[var(--tl-low)] p-0.5">
          {(['style', 'brush', 'code'] as const).map((t) => (
            <TabsTrigger key={t} value={t} className="h-7 rounded-[7px] text-[11.5px] font-medium capitalize text-[var(--tl-text-2)] data-[state=active]:text-[var(--tl-text-1)] data-[state=active]:shadow-[var(--tl-shadow-sm)]">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="tl-scroll tl-scroll-fade min-h-0 overflow-y-auto overflow-x-hidden">
          {/* ------------------------------------------------------------ Style */}
          <TabsContent value="style" className="m-0 space-y-4 p-3">
            {/* Brush templates: previews are strokes rendered by the engine itself */}
            <Section label="Brush" trailing={
              <button type="button" onClick={() => selectTab('brush')} className="group inline-flex items-center gap-0.5 text-[11px] font-medium text-[var(--tl-selected)] hover:underline">
                {activeTemplate ? 'Customize' : 'Custom · edit'}<ChevronRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
              </button>
            }>
              <div className="grid grid-cols-2 gap-1">
                {BRUSH_TEMPLATES.map((t) => {
                  const on = activeTemplate?.id === t.id;
                  return (
                    <TlTip key={t.id} label={t.description} side="left">
                      <button
                        type="button"
                        data-active={on ? 'true' : undefined}
                        aria-label={`${t.name} brush`}
                        aria-pressed={on}
                        onClick={() => studio.applyTemplate(t.id)}
                        className="tl-opt h-auto min-w-0 flex-col items-stretch gap-1 p-1 text-left"
                      >
                        <span className="block h-10 w-full overflow-hidden rounded-[6px] bg-[#fffefa] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]">
                          {previews?.[t.id]
                            ? <img src={previews[t.id]} alt="" draggable={false} className="h-full w-full object-cover" />
                            : <span className="block h-full w-full animate-pulse bg-[var(--tl-low)]" />}
                        </span>
                        <span className="truncate px-0.5 text-[11px] font-medium leading-tight">{t.name}</span>
                      </button>
                    </TlTip>
                  );
                })}
                {/* The user's own brush: active whenever the settings no longer match a template */}
                <TlTip label={activeTemplate ? 'Your edited brush lives here once you change a template' : 'Your current brush: edit it in the Brush tab'} side="left">
                  <button
                    type="button"
                    data-active={!activeTemplate ? 'true' : undefined}
                    aria-label="Custom brush"
                    aria-pressed={!activeTemplate}
                    onClick={() => selectTab('brush')}
                    className="tl-opt h-auto min-w-0 flex-col items-stretch gap-1 p-1 text-left"
                  >
                    <span className="flex h-10 w-full items-center justify-center gap-1.5 overflow-hidden rounded-[6px] bg-[#fffefa] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]">
                      <span className="h-8 w-8 shrink-0 overflow-hidden rounded-[5px] bg-white shadow-[var(--tl-shadow-sm)]"><TipPreview tipSource={s.tipSource} onError={setTipPreviewBad} /></span>
                      <span className="font-mono text-[9.5px] leading-tight text-[var(--tl-text-3)]">{fmt(spec.weight)} px<br />op {fmt(spec.opacity)}</span>
                    </span>
                    <span className="truncate px-0.5 text-[11px] font-medium leading-tight">{activeTemplate ? 'Custom' : 'Custom (edited)'}{tipBad ? ' ⚠' : ''}</span>
                  </button>
                </TlTip>
              </div>
            </Section>

            <Section label="Color" trailing={<span className="font-mono text-[10px] text-[var(--tl-text-3)]">{s.color.toUpperCase()}</span>}>
              <div className="grid grid-cols-6 gap-0.5">
                {swatches.map((sw) => {
                  const on = s.color.toLowerCase() === sw.hex;
                  return (
                    <TlTip key={sw.hex} label={sw.name}>
                      <button type="button" aria-label={sw.name} data-active={on ? 'true' : undefined} onClick={() => studio.setColor(sw.hex)} className="tl-opt h-9 w-9 min-w-0 px-0">
                        <span className="h-[18px] w-[18px] rounded-full" style={{ backgroundColor: sw.hex }} />
                      </button>
                    </TlTip>
                  );
                })}
                <TlTip label="Custom color">
                  <label data-active={isCustomColor ? 'true' : undefined} className="tl-opt relative h-9 w-9 min-w-0 cursor-pointer px-0">
                    <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-dashed border-[var(--tl-text-3)]" style={isCustomColor ? { backgroundColor: s.color, borderStyle: 'solid', borderColor: 'transparent' } : undefined}>
                      {!isCustomColor && <Plus className="h-3 w-3 text-[var(--tl-text-3)]" />}
                    </span>
                    <input type="color" value={s.color} onChange={(e) => studio.setColor(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label="Pick a custom color" />
                  </label>
                </TlTip>
              </div>
            </Section>

            <Section label="Size" trailing={<span className="font-mono text-[10px] text-[var(--tl-text-3)]">×{s.size.toFixed(2)}</span>}>
              <ToggleGroup type="single" value={activeSize} onValueChange={(v) => { const z = sizes.find((x) => x.id === v); if (z) studio.setSize(z.value); }} className="grid grid-cols-4 gap-0.5">
                {sizes.map((z) => (
                  <ToggleGroupItem key={z.id} value={z.id} aria-label={`Size ${z.label}`} className="tl-opt h-9 rounded-[7px] data-[state=on]:bg-[var(--tl-hint-strong)] data-[state=on]:text-[var(--tl-text-1)] hover:bg-[var(--tl-low)] hover:text-[var(--tl-text-1)]">
                    <span className="rounded-full bg-current" style={{ width: 6 + z.value * 5, height: 6 + z.value * 5 }} />
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Section>

            <Param label="Opacity" value={spec.opacity} display={fmt(spec.opacity)} min={1} max={80} step={1} onChange={(v) => studio.setSpec({ opacity: v })} />
            <Param label="Weight" value={spec.weight} display={`${fmt(spec.weight)} px`} min={1} max={80} step={1} onChange={(v) => studio.setSpec({ weight: v })} />

            <Section label="Paper">
              <ToggleGroup type="single" value={s.paper} onValueChange={(v) => v && studio.setPaper(v as PaperName)} className="grid grid-cols-3 gap-0.5">
                {(Object.keys(paperPresets) as PaperName[]).map((p) => (
                  <ToggleGroupItem key={p} value={p} className="tl-opt h-8 gap-1.5 whitespace-nowrap rounded-[7px] px-1 text-[11px] data-[state=on]:bg-[var(--tl-hint-strong)] data-[state=on]:text-[var(--tl-text-1)] hover:bg-[var(--tl-low)]">
                    <span className="h-3 w-3 rounded-[3px] border border-black/10" style={{ backgroundColor: `rgb(${paperPresets[p].bg.join(',')})` }} />
                    {paperLabels[p]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Section>

            <Section label="Pressure">
              <ToggleGroup type="single" value={s.pressureMode} onValueChange={(v) => v && studio.setPressureMode(v as PressureMode)} className="grid grid-cols-3 gap-0.5">
                {(['gaussian', 'both', 'stylus'] as PressureMode[]).map((m) => (
                  <ToggleGroupItem key={m} value={m} className="tl-opt h-8 rounded-[7px] data-[state=on]:bg-[var(--tl-hint-strong)] data-[state=on]:text-[var(--tl-text-1)] hover:bg-[var(--tl-low)]">
                    {m === 'gaussian' ? 'p5.brush' : m === 'both' ? 'Both' : 'Pen'}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <p className="mt-1.5 text-[10.5px] leading-snug text-[var(--tl-text-3)]">{pressureHelp[s.pressureMode]}</p>
            </Section>

            <Param label="Pen force sensitivity" value={s.forceSensitivity} display={`${s.forceSensitivity.toFixed(2)}×`} min={0.5} max={2.5} step={0.05} onChange={(v) => studio.setForceSensitivity(v)} />
            <Param label="Eraser size" value={s.eraserSize} display={`${fmt(s.eraserSize)} px`} min={4} max={120} step={1} onChange={(v) => studio.setEraserSize(v)} />
            <div className="flex items-center justify-between text-[11.5px] text-[var(--tl-text-2)]">
              <span>Pencil only (ignore fingers)</span>
              <Switch checked={s.pencilOnly} onCheckedChange={(v) => studio.setPencilOnly(v)} className="data-[state=checked]:bg-[var(--tl-selected)]" />
            </div>
          </TabsContent>

          {/* ------------------------------------------------------------ Brush */}
          <TabsContent value="brush" className="m-0 space-y-4 p-3">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[9px] bg-white shadow-[var(--tl-shadow-sm)]">
                <TipPreview tipSource={s.tipSource} onError={setTipPreviewBad} />
              </div>
              <div className="min-w-0 text-[11px] leading-snug text-[var(--tl-text-3)]">
                <div className="text-[12px] font-semibold text-[var(--tl-text-1)]">{activeTemplate ? activeTemplate.name : 'Custom tip'}</div>
                {activeTemplate ? activeTemplate.description : '100×100 unit space, rasterised at 500 px. Dark = opaque ink.'}
              </div>
            </div>

            <Param label="weight" value={spec.weight} display={fmt(spec.weight)} min={1} max={80} step={1} onChange={(v) => studio.setSpec({ weight: v })} />
            <Param label="opacity" value={spec.opacity} display={fmt(spec.opacity)} min={1} max={80} step={1} onChange={(v) => studio.setSpec({ opacity: v })} />
            <Param label="scatter" value={spec.scatter} display={spec.scatter.toFixed(2)} min={0} max={10} step={0.05} onChange={(v) => studio.setSpec({ scatter: v })} />
            <Param label="spacing" value={spec.spacing} display={spec.spacing.toFixed(2)} min={0.1} max={15} step={0.1} onChange={(v) => studio.setSpec({ spacing: v })} />
            <Param label="noise" value={spec.noise} display={spec.noise.toFixed(2)} min={0} max={1} step={0.05} onChange={(v) => studio.setSpec({ noise: v })} />
            <Param label="brush.set size (strokeWeight)" value={s.size} display={`${s.size.toFixed(2)}×`} min={0.25} max={3} step={0.05} onChange={(v) => studio.setSize(v)} />

            <div className="grid grid-cols-2 items-end gap-2">
              <div>
                <div className="tl-label">rotate</div>
                <Select value={spec.rotate} onValueChange={(v) => studio.setSpec({ rotate: v as typeof spec.rotate })}>
                  <SelectTrigger className="h-8 rounded-[7px] border-0 bg-[var(--tl-low)] font-mono text-[11px] shadow-none focus:ring-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-[9px] border-0 shadow-[var(--tl-shadow)]">
                    <SelectItem value="none">"none"</SelectItem>
                    <SelectItem value="natural">"natural"</SelectItem>
                    <SelectItem value="random">"random"</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex h-8 items-center justify-between text-[11.5px] text-[var(--tl-text-2)]">
                <span className="font-mono">markerTip</span>
                <Switch checked={spec.markerTip} onCheckedChange={(v) => studio.setSpec({ markerTip: v })} className="data-[state=checked]:bg-[var(--tl-selected)]" />
              </div>
            </div>

            <Section label='pressure · mode: "gaussian"'>
              <div className="grid grid-cols-4 gap-1.5">
                <NumberField label="curve[0]" value={spec.pressure.curve[0]} onCommit={(v) => studio.setPressure({ curve: [v, spec.pressure.curve[1]] })} />
                <NumberField label="curve[1]" value={spec.pressure.curve[1]} onCommit={(v) => studio.setPressure({ curve: [spec.pressure.curve[0], v] })} />
                <NumberField label="min" value={spec.pressure.min_max[0]} onCommit={(v) => studio.setPressure({ min_max: [v, spec.pressure.min_max[1]] })} />
                <NumberField label="max" value={spec.pressure.min_max[1]} onCommit={(v) => studio.setPressure({ min_max: [spec.pressure.min_max[0], v] })} />
              </div>
            </Section>

            <Section label="tip: (_m) => { … }" trailing={tipBad ? <span className="font-mono text-[10px] text-[var(--tl-danger)]">syntax error</span> : null}>
              <Textarea
                value={tipDraft} spellCheck={false} rows={5} data-invalid={tipBad || undefined}
                onChange={(e) => setTipDraft(e.target.value)}
                onBlur={applyTip}
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') (e.target as HTMLTextAreaElement).blur(); }}
                className="code-area min-h-[92px] resize-y border-0 focus-visible:ring-0"
              />
              <div className="mt-2 flex items-center justify-between gap-2 text-[11.5px] text-[var(--tl-text-2)]">
                <span>rotate() units</span>
                <Select value={tipUsesDegrees(s.tipSource) ? 'degrees' : 'radians'} onValueChange={(v) => {
                  const degrees = v === 'degrees';
                  if (studio.setTipSource(setTipDegrees(s.tipSource, degrees))) {
                    toast(degrees ? 'Tip angles: degrees (Brush Maker preview look)' : 'Tip angles: radians (actual p5.brush output)');
                  }
                }}>
                  <SelectTrigger className="h-7 w-[8.5rem] rounded-[7px] border-0 bg-[var(--tl-low)] font-mono text-[11px] shadow-none focus:ring-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-[9px] border-0 shadow-[var(--tl-shadow)]">
                    <SelectItem value="radians">radians</SelectItem>
                    <SelectItem value="degrees">degrees</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="mt-1.5 text-[10.5px] leading-snug text-[var(--tl-text-3)]">
                p5-style surface: fill(gray, alpha), rect, circle, ellipse, line, triangle, beginShape… Applied on blur.
                A p5.Graphics ignores the sketch's angleMode(DEGREES), so <span className="font-mono">rotate(45)</span> is 45 rad in real p5.brush output.
              </p>
            </Section>

            <button type="button" className="text-[11px] font-medium text-[var(--tl-selected)] hover:underline" onClick={() => studio.resetDefaults()}>Reset to myBrush defaults</button>
          </TabsContent>

          {/* ------------------------------------------------------------- Code */}
          <TabsContent value="code" className="m-0 space-y-3 p-3">
            <Section label="brush.add(…) spec" trailing={
              <div className="flex gap-2 text-[11px] font-medium text-[var(--tl-selected)]">
                <button type="button" className="hover:underline" onClick={() => copy(studio.specCode(), 'brush.add spec')}>Copy</button>
                <button type="button" className="hover:underline" onClick={() => copy(studio.sketchCode(), 'p5.js sketch')}>Copy sketch</button>
              </div>
            }>
              <Textarea
                value={specDraft} spellCheck={false} rows={14} data-invalid={specInvalid || undefined}
                onFocus={() => setSpecEditing(true)}
                onChange={(e) => setSpecDraft(e.target.value)}
                className="code-area min-h-[220px] resize-y border-0 focus-visible:ring-0"
              />
            </Section>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] leading-snug text-[var(--tl-text-3)]">Paste a <span className="font-mono">brush.add(…)</span> from the Brush Maker and apply.</span>
              <div className="flex shrink-0 gap-1">
                {specEditing && <button type="button" className="tl-opt h-7 px-2 text-[11px]" onClick={() => setSpecEditing(false)}>Revert</button>}
                <button type="button" className="inline-flex h-7 items-center gap-1 rounded-[7px] bg-[var(--tl-selected)] px-2.5 text-[11px] font-medium text-white hover:bg-[#2a74d8]" onClick={() => {
                  try {
                    const name = studio.applySpecCode(specDraft);
                    setSpecInvalid(false); setSpecEditing(false);
                    toast(`brush.add("${name}") applied`);
                  } catch (err) {
                    setSpecInvalid(true);
                    toast.error('Could not parse: ' + (err as Error).message);
                  }
                }}><Check className="h-3.5 w-3.5" />Apply</button>
              </div>
            </div>
            <p className="text-[10.5px] leading-snug text-[var(--tl-text-3)]">
              “Copy sketch” gives a complete p5.js sketch that replays every stroke on this canvas with p5.brush, seeds included.
            </p>
          </TabsContent>
        </div>
      </Tabs>
    </aside>
  );
}
