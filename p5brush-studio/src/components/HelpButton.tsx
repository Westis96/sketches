import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { PENCIL_LAB } from '@/lab';

const shortcuts: Array<[string, string]> = [
  ['Brush', 'D'], ['Paper eraser', 'E'], ['Sample stroke', 'T'], ['Pencil only', 'Q'],
  ['Weight − / +', '[ ]'], ['Undo', '⌘ Z'], ['Redo', '⇧ ⌘ Z'], ['New sketch', 'C'],
  ['Export PNG', 'S'], ['Toggle style panel', 'P'], ['Cancel current stroke', 'Esc'],
  ['Practice lessons', 'L'], ['Skip lesson step', 'N'],
  ['Zoom in / out', '+ −'], ['Zoom 100%', '0'], ['Zoom to fit', 'F'], ['Pan', 'Space+drag'], ['Shortcuts', '?'],
  ...(PENCIL_LAB ? [['Lab panels', 'K'] as [string, string]] : []),
];

const gestures: Array<[string, string]> = [
  ['Pinch', 'zoom'], ['Two fingers drag', 'pan'], ['One finger (Pencil only)', 'pan'],
  ['Two-finger tap', 'undo'], ['Three-finger tap', 'redo'], ['Trackpad pinch / ctrl+scroll', 'zoom'],
];

/** Bottom-right "?" button with keyboard shortcuts and touch gestures. */
export function HelpButton({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={<Button variant="outline" aria-label="Keyboard shortcuts" className="ui-surface pointer-events-auto h-9 w-9 rounded-full p-0 text-[14px] font-semibold text-[var(--text-2)] ring-0 data-[popup-open]:bg-[var(--low)]" />}>
        ?
      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={8} className="tl-scroll max-h-[calc(var(--tl-vh)-5rem)] w-[min(30rem,calc(100vw-1rem))] overflow-y-auto">
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <div className="order-2 sm:order-1">
            <div className="mb-2 font-semibold text-[var(--text-1)]">Keyboard shortcuts</div>
            <ul className="space-y-1">
              {shortcuts.map(([label, key]) => (
                <li key={label} className="flex items-center justify-between text-[var(--text-2)]">
                  <span>{label}</span>
                  <Kbd className="tl-kbd-static">{key}</Kbd>
                </li>
              ))}
            </ul>
          </div>
          <div className="order-1 sm:order-2">
            <div className="mb-2 font-semibold text-[var(--text-1)]">Touch gestures</div>
            <ul className="space-y-1">
              {gestures.map(([label, key]) => (
                <li key={label} className="flex items-center justify-between text-[var(--text-2)]">
                  <span>{label}</span>
                  <span className="text-[11px] text-[var(--text-3)]">{key}</span>
                </li>
              ))}
            </ul>
            <Separator className="my-2.5" />
            <p className="mb-2 text-[11px] leading-snug text-[var(--text-3)]">
              Your drawing and settings autosave in this browser. Practice keeps a personal best per lesson.
            </p>
            <p className="text-[11px] leading-snug text-[var(--text-3)]">
              Strokes are stamped by the real p5.brush 2.2.2 engine and blended with its spectral pigment shader.
              Design tips in the <a className="underline" href="https://acamposuribe.github.io/p5.brush/tools/brush-maker.html" target="_blank" rel="noreferrer">Brush Maker</a> and paste the spec in the Code tab.
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
