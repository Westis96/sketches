import { Brush, Download, Eraser, PenLine, Redo2, SlidersHorizontal, SquareCheck, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useStudio, useStudioState } from '@/hooks/useStudio';
import { paperPresets } from '@/engine/Studio';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function Toolbar({ panelOpen, onTogglePanel }: { panelOpen: boolean; onTogglePanel: () => void }) {
  const studio = useStudio();
  const { tool, paper, pencilOnly } = useStudioState((s) => s.settings);
  const canUndo = useStudioState((s) => s.canUndo);
  const canRedo = useStudioState((s) => s.canRedo);

  return (
    <header className="pointer-events-none fixed left-3 right-3 top-3 z-30 flex items-start justify-between gap-2 sm:left-6 sm:right-6">
      <div className="paper-pill pointer-events-auto flex items-center gap-3 rounded-2xl px-3 py-1.5 sm:px-4 sm:py-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-indigo-700 shadow">
          <PenLine className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="whitespace-nowrap text-xs font-semibold tracking-tight text-slate-900 sm:text-sm">p5.brush Realtime</h1>
            <Badge variant="outline" className="hidden border-indigo-200 bg-indigo-50 font-mono text-[9px] uppercase tracking-wider text-indigo-700 sm:inline-flex">
              myBrush · custom
            </Badge>
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap text-[10px] text-slate-500">
            <span className="font-medium text-emerald-700">{paperPresets[paper].label}</span>
            <span>•</span>
            <span>p5.brush 2.2.2 · WebGL2</span>
          </div>
        </div>
      </div>

      <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
        <Tip label="Brush (B)">
          <Button variant={tool === 'brush' ? 'default' : 'outline'} size="sm" className={cn('h-9 rounded-xl sm:h-10', tool !== 'brush' && 'paper-pill')} onClick={() => studio.setTool('brush')}>
            <Brush className="h-3.5 w-3.5" /><span className="hidden sm:inline">Brush</span>
          </Button>
        </Tip>
        <Tip label="Paper eraser (E)">
          <Button variant={tool === 'eraser' ? 'default' : 'outline'} size="sm" className={cn('h-9 rounded-xl sm:h-10', tool !== 'eraser' && 'paper-pill')} onClick={() => studio.setTool('eraser')}>
            <Eraser className="h-3.5 w-3.5" /><span className="hidden sm:inline">Eraser</span>
          </Button>
        </Tip>
        <Tip label="Toggle Apple Pencil only (rejects finger touches)">
          <Button variant={pencilOnly ? 'default' : 'outline'} size="sm" className={cn('h-9 rounded-xl sm:h-10', !pencilOnly && 'paper-pill')} onClick={() => studio.setPencilOnly(!pencilOnly)}>
            <SquareCheck className={cn('h-3.5 w-3.5', !pencilOnly && 'text-emerald-600')} />
            <span className="hidden md:inline">{pencilOnly ? 'Pencil Only' : 'Stylus & Touch'}</span>
          </Button>
        </Tip>
        <Tip label="Draw a p5.brush sample stroke (T)">
          <Button variant="outline" size="sm" className="h-9 rounded-xl border-indigo-200 bg-indigo-50/90 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 sm:h-10" onClick={studio.drawSampleStroke}>
            <PenLine className="h-3.5 w-3.5" /><span className="hidden sm:inline">Sample</span>
          </Button>
        </Tip>
        <Tip label="Undo (Cmd/Ctrl+Z)">
          <Button variant="outline" size="icon" className="paper-pill h-9 w-9 rounded-xl sm:h-10 sm:w-10" disabled={!canUndo} onClick={studio.undo}>
            <Undo2 className="h-4 w-4" />
          </Button>
        </Tip>
        <Tip label="Redo (Cmd/Ctrl+Shift+Z)">
          <Button variant="outline" size="icon" className="paper-pill h-9 w-9 rounded-xl sm:h-10 sm:w-10" disabled={!canRedo} onClick={studio.redo}>
            <Redo2 className="h-4 w-4" />
          </Button>
        </Tip>
        <Tip label="Clear canvas (C)">
          <Button variant="outline" size="sm" className="paper-pill h-9 rounded-xl border-rose-200/70 text-rose-700 hover:bg-rose-50 hover:text-rose-800 sm:h-10" onClick={studio.clear}>
            <Trash2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Clear</span>
          </Button>
        </Tip>
        <Tip label="Export PNG (S)">
          <Button size="sm" className="h-9 rounded-xl shadow sm:h-10" onClick={studio.exportPNG}>
            <Download className="h-3.5 w-3.5" /><span className="hidden sm:inline">Export</span>
          </Button>
        </Tip>
        <Tip label="Toggle brush panel (P)">
          <Button variant={panelOpen ? 'secondary' : 'outline'} size="icon" className="paper-pill h-9 w-9 rounded-xl sm:h-10 sm:w-10" onClick={onTogglePanel}>
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </Tip>
      </div>
    </header>
  );
}
