import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const shortcuts: Array<[string, string]> = [
  ['Brush', 'D'], ['Paper eraser', 'E'], ['Sample stroke', 'T'], ['Pencil only', 'Q'],
  ['Weight − / +', '[ ]'], ['Undo', '⌘ Z'], ['Redo', '⇧ ⌘ Z'], ['Clear canvas', 'C'],
  ['Export PNG', 'S'], ['Toggle style panel', 'P'], ['Cancel current stroke', 'Esc'],
  ['Practice lessons', 'L'], ['Skip lesson step', 'N'],
  ['Zoom in / out', '+ −'], ['Zoom 100%', '0'], ['Zoom to fit', 'F'], ['Pan', 'Space+drag'], ['Shortcuts', '?'],
];

const gestures: Array<[string, string]> = [
  ['Pinch', 'zoom'], ['Two fingers drag', 'pan'], ['One finger (Pencil only)', 'pan'],
  ['Two-finger tap', 'undo'], ['Three-finger tap', 'redo'], ['Trackpad pinch / ctrl+scroll', 'zoom'],
];

/** Bottom-right "?" button with keyboard shortcuts, like tldraw's help menu. */
export function HelpButton({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Keyboard shortcuts" className="tl-panel-sm pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-semibold text-[var(--tl-text-2)] hover:bg-[var(--tl-low)] data-[state=open]:bg-[var(--tl-low)]">
          ?
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={8} className="tl-scroll max-h-[calc(var(--tl-vh)-5rem)] w-[min(30rem,calc(100vw-1rem))] overflow-y-auto rounded-[11px] border-0 p-3 text-[12px] shadow-[var(--tl-shadow)]">
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <div className="order-2 sm:order-1">
            <div className="mb-2 font-semibold text-[var(--tl-text-1)]">Keyboard shortcuts</div>
            <ul className="space-y-1">
              {shortcuts.map(([label, key]) => (
                <li key={label} className="flex items-center justify-between text-[var(--tl-text-2)]">
                  <span>{label}</span>
                  <kbd className="rounded bg-[var(--tl-low)] px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--tl-text-1)]">{key}</kbd>
                </li>
              ))}
            </ul>
          </div>
          <div className="order-1 sm:order-2">
            <div className="mb-2 font-semibold text-[var(--tl-text-1)]">Touch gestures</div>
            <ul className="space-y-1">
              {gestures.map(([label, key]) => (
                <li key={label} className="flex items-center justify-between text-[var(--tl-text-2)]">
                  <span>{label}</span>
                  <span className="text-[11px] text-[var(--tl-text-3)]">{key}</span>
                </li>
              ))}
            </ul>
            <div className="tl-hdivider" />
            <p className="mb-2 text-[11px] leading-snug text-[var(--tl-text-3)]">
              Your drawing and settings autosave in this browser. Practice keeps a personal best per lesson.
            </p>
            <p className="text-[11px] leading-snug text-[var(--tl-text-3)]">
          Strokes are stamped by the real p5.brush 2.2.2 engine and blended with its spectral pigment shader.
          Design tips in the <a className="underline" href="https://acamposuribe.github.io/p5.brush/tools/brush-maker.html" target="_blank" rel="noreferrer">Brush Maker</a> and paste the spec in the Code tab.
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
