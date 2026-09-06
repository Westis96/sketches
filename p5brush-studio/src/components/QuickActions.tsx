import { FilePlus2, Menu, Redo2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TlButton } from '@/components/TlButton';
import { useStudio, useStudioState } from '@/hooks/useStudio';

async function copyText(text: string, label: string) {
  try { await navigator.clipboard.writeText(text); toast(`${label} copied to clipboard`); }
  catch { toast.error('Copy failed — clipboard unavailable'); }
}

/** Top-left: main menu + undo / redo / new sketch. */
export function QuickActions({ onPractice, onHelp }: { onPractice?: () => void; onHelp?: () => void }) {
  const studio = useStudio();
  const canUndo = useStudioState((s) => s.canUndo);
  const canRedo = useStudioState((s) => s.canRedo);

  return (
    <Card className="pointer-events-auto flex items-center p-1">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="tool" aria-label="Menu"><Menu /></Button>} />
        <DropdownMenuContent align="start" sideOffset={8} className="w-72">
          <DropdownMenuLabel>
            <div className="text-[12.5px] font-semibold text-[var(--text-1)]">p5.brush Realtime Studio</div>
            <div className="text-[11px] font-normal text-[var(--text-3)]">Rendered by the p5.brush 2.2.2 engine</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={studio.exportPNG}>Export PNG<DropdownMenuShortcut>S</DropdownMenuShortcut></DropdownMenuItem>
          <DropdownMenuItem onSelect={() => copyText(studio.sketchCode(), 'p5.js sketch')}>Copy as p5.js sketch</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => copyText(studio.specCode(), 'brush.add spec')}>Copy brush.add spec</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => studio.zoomToFit()}>Zoom to fit drawing<DropdownMenuShortcut>F</DropdownMenuShortcut></DropdownMenuItem>
          <DropdownMenuItem onSelect={() => studio.resetView()}>Reset view to 100%<DropdownMenuShortcut>0</DropdownMenuShortcut></DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={studio.drawSampleStroke}>Draw sample stroke<DropdownMenuShortcut>T</DropdownMenuShortcut></DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onPractice?.()}>Practice lessons…<DropdownMenuShortcut>L</DropdownMenuShortcut></DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onHelp?.()}>Help &amp; gestures<DropdownMenuShortcut>?</DropdownMenuShortcut></DropdownMenuItem>
          <DropdownMenuItem onSelect={() => studio.resetDefaults()}>Reset brush to myBrush defaults</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => { void studio.copyDiagnostics(); }}>Copy diagnostics</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={studio.clear}>New sketch<DropdownMenuShortcut>C</DropdownMenuShortcut></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <TlButton label="Undo" kbd="⌘Z" side="bottom" disabled={!canUndo} onClick={studio.undo}><Undo2 /></TlButton>
      <TlButton label="Redo" kbd="⇧⌘Z" side="bottom" disabled={!canRedo} onClick={studio.redo}><Redo2 /></TlButton>
      <TlButton label="New sketch" kbd="C" side="bottom" onClick={studio.clear}><FilePlus2 /></TlButton>
    </Card>
  );
}
