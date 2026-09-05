import { Menu, Redo2, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TlButton } from '@/components/TlButton';
import { useStudio, useStudioState } from '@/hooks/useStudio';

async function copyText(text: string, label: string) {
  try { await navigator.clipboard.writeText(text); toast(`${label} copied to clipboard`); }
  catch { toast.error('Copy failed — clipboard unavailable'); }
}

/** Top-left: main menu + undo / redo / clear, like tldraw's quick actions bar. */
export function QuickActions({ onPractice }: { onPractice?: () => void }) {
  const studio = useStudio();
  const canUndo = useStudioState((s) => s.canUndo);
  const canRedo = useStudioState((s) => s.canRedo);

  return (
    <div className="tl-panel pointer-events-auto flex items-center p-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Menu" className="tl-btn data-[state=open]:bg-[var(--tl-low)]"><Menu /></button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6} className="w-64 rounded-[11px] border-0 p-1.5 text-[12px] shadow-[var(--tl-shadow)]">
          <DropdownMenuLabel className="px-2 py-1.5">
            <div className="text-[12px] font-semibold text-[var(--tl-text-1)]">p5.brush Realtime Studio</div>
            <div className="text-[11px] font-normal text-[var(--tl-text-3)]">Rendered by the p5.brush 2.2.2 engine</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-[var(--tl-hint)]" />
          <DropdownMenuItem className="rounded-[7px] py-1.5" onSelect={studio.exportPNG}>Export PNG<DropdownMenuShortcut>S</DropdownMenuShortcut></DropdownMenuItem>
          <DropdownMenuItem className="rounded-[7px] py-1.5" onSelect={() => copyText(studio.sketchCode(), 'p5.js sketch')}>Copy as p5.js sketch</DropdownMenuItem>
          <DropdownMenuItem className="rounded-[7px] py-1.5" onSelect={() => copyText(studio.specCode(), 'brush.add spec')}>Copy brush.add spec</DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[var(--tl-hint)]" />
          <DropdownMenuItem className="rounded-[7px] py-1.5" onSelect={() => studio.zoomToFit()}>Zoom to fit drawing<DropdownMenuShortcut>F</DropdownMenuShortcut></DropdownMenuItem>
          <DropdownMenuItem className="rounded-[7px] py-1.5" onSelect={() => studio.resetView()}>Reset view to 100%<DropdownMenuShortcut>0</DropdownMenuShortcut></DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[var(--tl-hint)]" />
          <DropdownMenuItem className="rounded-[7px] py-1.5" onSelect={studio.drawSampleStroke}>Draw sample stroke<DropdownMenuShortcut>T</DropdownMenuShortcut></DropdownMenuItem>
          <DropdownMenuItem className="rounded-[7px] py-1.5" onSelect={() => onPractice?.()}>Practice lessons…<DropdownMenuShortcut>L</DropdownMenuShortcut></DropdownMenuItem>
          <DropdownMenuItem className="rounded-[7px] py-1.5" onSelect={() => studio.resetDefaults()}>Reset brush to myBrush defaults</DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[var(--tl-hint)]" />
          <DropdownMenuItem className="rounded-[7px] py-1.5 text-[var(--tl-danger)] focus:text-[var(--tl-danger)]" onSelect={studio.clear}>Clear canvas<DropdownMenuShortcut>C</DropdownMenuShortcut></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="tl-divider" />
      <TlButton label="Undo" kbd="⌘Z" side="bottom" disabled={!canUndo} onClick={studio.undo}><Undo2 /></TlButton>
      <TlButton label="Redo" kbd="⇧⌘Z" side="bottom" disabled={!canRedo} onClick={studio.redo}><Redo2 /></TlButton>
      <TlButton label="Clear canvas" kbd="C" side="bottom" onClick={studio.clear}><Trash2 /></TlButton>
    </div>
  );
}
