import { useEffect, useRef } from 'react';
import { useStudio, useStudioState } from '@/hooks/useStudio';

/**
 * Size cursor: a ring showing the visible mark size of the brush (from the tip's
 * ink extent) or the eraser diameter. Follows the pointer through direct DOM
 * updates, so no React render per move; hidden for touch (no hover) and when
 * the pointer is over the UI.
 */
export function BrushCursor({ canvas }: { canvas: HTMLCanvasElement | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const studio = useStudio();
  const { tool, spec, size, eraserSize } = useStudioState((s) => s.settings);
  const tipExtent = useStudioState((s) => s.tipExtent);
  const zoom = useStudioState((s) => s.view.zoom);
  const diameter = (tool === 'eraser' ? eraserSize : Math.max(3, spec.weight * size * tipExtent * spec.pressure.min_max[1])) * zoom;

  useEffect(() => {
    const el = ref.current;
    if (!el || !canvas) return;
    let raf = 0, x = 0, y = 0, visible = false;
    const apply = () => {
      raf = 0;
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      el.style.opacity = visible ? '1' : '0';
    };
    const onMove = (e: PointerEvent) => {
      const overCanvas = e.target === canvas || (studio.isDrawing() && e.pointerType !== 'touch');
      visible = overCanvas && e.pointerType !== 'touch';
      x = e.clientX; y = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const hide = () => { visible = false; if (!raf) raf = requestAnimationFrame(apply); };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true });
    canvas.addEventListener('pointerleave', hide);
    window.addEventListener('blur', hide);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      canvas.removeEventListener('pointerleave', hide);
      window.removeEventListener('blur', hide);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [canvas, studio]);

  return (
    <div ref={ref} aria-hidden className="pointer-events-none fixed left-0 top-0 z-20 opacity-0 transition-opacity duration-100">
      <div
        className="rounded-full"
        style={{
          width: diameter, height: diameter,
          boxShadow: tool === 'eraser'
            ? '0 0 0 1px rgba(255,255,255,0.9), inset 0 0 0 1px rgba(0,0,0,0.55)'
            : '0 0 0 1px rgba(255,255,255,0.8), inset 0 0 0 1px rgba(0,0,0,0.45)',
          background: tool === 'eraser' ? 'rgba(255,255,255,0.25)' : 'transparent',
        }}
      />
      <div className="absolute left-1/2 top-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/70 shadow-[0_0_0_1px_rgba(255,255,255,0.8)]" />
    </div>
  );
}
