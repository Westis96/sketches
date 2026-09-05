import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const shortcuts: Array<[string, string]> = [
  ['Brush', 'D'], ['Paper eraser', 'E'], ['Sample stroke', 'T'], ['Pencil only', 'Q'],
  ['Weight − / +', '[ ]'], ['Undo', '⌘ Z'], ['Redo', '⇧ ⌘ Z'], ['Clear canvas', 'C'],
  ['Export PNG', 'S'], ['Toggle style panel', 'P'], ['Shortcuts', '?'],
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
      <PopoverContent side="top" align="end" sideOffset={8} className="w-64 rounded-[11px] border-0 p-3 text-[12px] shadow-[var(--tl-shadow)]">
        <div className="mb-2 font-semibold text-[var(--tl-text-1)]">Keyboard shortcuts</div>
        <ul className="space-y-1">
          {shortcuts.map(([label, key]) => (
            <li key={label} className="flex items-center justify-between text-[var(--tl-text-2)]">
              <span>{label}</span>
              <kbd className="rounded bg-[var(--tl-low)] px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--tl-text-1)]">{key}</kbd>
            </li>
          ))}
        </ul>
        <div className="tl-hdivider" />
        <p className="text-[11px] leading-snug text-[var(--tl-text-3)]">
          Strokes are stamped by the real p5.brush 2.2.2 engine and blended with its spectral pigment shader.
          Design tips in the <a className="underline" href="https://acamposuribe.github.io/p5.brush/tools/brush-maker.html" target="_blank" rel="noreferrer">Brush Maker</a> and paste the spec in the Code tab.
        </p>
      </PopoverContent>
    </Popover>
  );
}
