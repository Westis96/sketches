import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { useMediaQuery, COARSE_QUERY, PHONE_QUERY } from '@/hooks/useMediaQuery';
import { PENCIL_LAB } from '@/lab';
import { cn } from '@/lib/utils';

const shortcuts: Array<[string, string]> = [
  ['Brush', 'D'], ['Paper eraser', 'E'], ['Sample stroke', 'T'], ['Pencil only', 'Q'],
  ['Weight − / +', '[ ]'], ['Undo', '⌘ Z'], ['Redo', '⇧ ⌘ Z'], ['New sketch', 'C'],
  ['Export PNG', 'S'], ['Toggle style panel', 'P'], ['Cancel current stroke', 'Esc'],
  ['Learn (lessons)', 'L'], ['Skip lesson step', 'N'],
  ['Zoom in / out', '+ −'], ['Zoom 100%', '0'], ['Zoom to fit', 'F'], ['Pan', 'Space+drag'], ['Shortcuts', '?'],
  ...(PENCIL_LAB ? [['Lab panels', 'K'] as [string, string]] : []),
];

const gestures: Array<[string, string]> = [
  ['Pinch', 'zoom'], ['Two fingers drag', 'pan'], ['One finger (Pencil only)', 'pan'],
  ['Two-finger tap', 'undo'], ['Three-finger tap', 'redo'], ['Trackpad pinch / ctrl+scroll', 'zoom'],
];

function Shortcuts() {
  return (
    <ul className="space-y-1">
      {shortcuts.map(([label, key]) => (
        <li key={label} className="flex items-center justify-between text-[var(--text-2)]">
          <span>{label}</span>
          <Kbd className="tl-kbd-static">{key}</Kbd>
        </li>
      ))}
    </ul>
  );
}

/** Shortcuts, gestures and a line on autosave. On touch devices the keyboard list folds away. */
function HelpBody({ coarse, phone }: { coarse: boolean; phone: boolean }) {
  return (
    <div className={cn('grid gap-x-6 gap-y-3', !phone && 'sm:grid-cols-2')}>
      <div className="order-2 sm:order-1">
        {coarse ? (
          <Collapsible>
            <CollapsibleTrigger className="group flex w-full items-center justify-between py-1 font-semibold text-[var(--text-1)]">
              Keyboard shortcuts
              <ChevronDown className="h-4 w-4 text-[var(--text-3)] transition-transform duration-200 ease-out group-data-[panel-open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent><div className="pt-1"><Shortcuts /></div></CollapsibleContent>
          </Collapsible>
        ) : (
          <>
            <div className="mb-2 font-semibold text-[var(--text-1)]">Keyboard shortcuts</div>
            <Shortcuts />
          </>
        )}
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
  );
}

/**
 * Bottom-right "?" with keyboard shortcuts and touch gestures. On phones the button
 * lives in the main menu and the content opens as a sheet.
 */
export function HelpButton({ open, instant, onOpenChange }: { open: boolean; instant?: boolean; onOpenChange: (o: boolean, viaKeyboard?: boolean) => void }) {
  const phone = useMediaQuery(PHONE_QUERY);
  const coarse = useMediaQuery(COARSE_QUERY);
  if (phone) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent aria-label="Help" instant={instant} className="tl-scroll max-h-[calc(var(--tl-vh)*0.85)] overflow-y-auto p-4">
          <DialogTitle className="mb-3">Help</DialogTitle>
          <HelpBody coarse={coarse} phone />
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Popover open={open} onOpenChange={(o, details) => onOpenChange(o, details.reason === 'escape-key')}>
      <PopoverTrigger render={<Button variant="outline" aria-label="Keyboard shortcuts" className="ui-surface pointer-events-auto h-9 w-9 rounded-full p-0 text-[14px] font-semibold text-[var(--text-2)] ring-0 data-[popup-open]:bg-[var(--low)]" />}>
        ?
      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={8} data-instant={instant || undefined} className="tl-scroll max-h-[calc(var(--tl-vh)-5rem)] w-[min(30rem,calc(100vw-1rem))] overflow-y-auto">
        <HelpBody coarse={coarse} phone={false} />
      </PopoverContent>
    </Popover>
  );
}
