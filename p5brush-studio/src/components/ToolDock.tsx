import { Download, Eraser, PenLine, Pencil, Sparkles } from 'lucide-react';
import { TlButton } from '@/components/TlButton';
import { useStudio, useStudioState } from '@/hooks/useStudio';

/** Bottom-center tool dock, tldraw style: the active tool is blue. */
export function ToolDock() {
  const studio = useStudio();
  const { tool, pencilOnly } = useStudioState((s) => s.settings);

  return (
    <div className="tl-panel pointer-events-auto flex items-center p-1">
      <TlButton label="Brush" kbd="D" active={tool === 'brush'} onClick={() => studio.setTool('brush')}><PenLine /></TlButton>
      <TlButton label="Paper eraser" kbd="E" active={tool === 'eraser'} onClick={() => studio.setTool('eraser')}><Eraser /></TlButton>
      <span className="tl-divider" />
      <TlButton label="Draw a p5.brush sample stroke" kbd="T" onClick={studio.drawSampleStroke}><Sparkles /></TlButton>
      <TlButton label={pencilOnly ? 'Pencil only: finger touches ignored' : 'Accepting pencil and touch'} kbd="Q" active={pencilOnly} onClick={() => studio.setPencilOnly(!pencilOnly)}><Pencil /></TlButton>
      <span className="tl-divider" />
      <TlButton label="Export PNG" kbd="S" onClick={studio.exportPNG}><Download /></TlButton>
    </div>
  );
}
