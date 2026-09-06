import { Download, Eraser, GraduationCap, PenLine, Pencil, SlidersHorizontal, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { TlButton } from '@/components/TlButton';
import { useStudio, useStudioState } from '@/hooks/useStudio';

/** Bottom-centre tool dock: the active tool takes the accent. */
export function ToolDock({ panelOpen, onTogglePanel, onPractice }: { panelOpen: boolean; onTogglePanel: () => void; onPractice: () => void }) {
  const studio = useStudio();
  const { tool, pencilOnly, color } = useStudioState((s) => s.settings);
  const inLesson = useStudioState((s) => s.practice !== null);

  return (
    <Card className="pointer-events-auto flex items-center p-1">
      <TlButton label="Brush" kbd="D" active={tool === 'brush'} onClick={() => studio.setTool('brush')}>
        <PenLine />
        <span aria-hidden className="absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full shadow-[0_0_0_1.5px_rgba(255,255,255,0.95)]" style={{ background: color }} />
      </TlButton>
      <TlButton label="Paper eraser" kbd="E" active={tool === 'eraser'} onClick={() => studio.setTool('eraser')}><Eraser /></TlButton>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <TlButton label="Draw a p5.brush sample stroke" kbd="T" onClick={studio.drawSampleStroke}><Sparkles /></TlButton>
      <TlButton label="Practice: trace a sample drawing" kbd="L" active={inLesson} onClick={onPractice}><GraduationCap /></TlButton>
      <TlButton label={pencilOnly ? 'Pencil only: finger touches ignored' : 'Accepting pencil and touch'} kbd="Q" active={pencilOnly} onClick={() => studio.setPencilOnly(!pencilOnly)}><Pencil /></TlButton>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <TlButton label="Export PNG" kbd="S" onClick={studio.exportPNG}><Download /></TlButton>
      {/* On phones the bottom-right "Show styles" pill is hidden, so the dock carries the toggle. */}
      <TlButton label={panelOpen ? 'Hide styles' : 'Show styles'} kbd="P" active={panelOpen} className="sm:hidden" onClick={onTogglePanel}><SlidersHorizontal /></TlButton>
    </Card>
  );
}
