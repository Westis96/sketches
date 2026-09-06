import { useEffect, useRef } from 'react';
import { useStudio, useStudioState } from '@/hooks/useStudio';
import { activeFx, eventTilt, tiltFactors } from '@/engine/pencil';

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
  const pencil = useStudioState((s) => s.settings.pencil);
  const diameter = (tool === 'eraser' ? eraserSize : Math.max(3, spec.weight * size * tipExtent * spec.pressure.min_max[1])) * zoom;
  // Pencil lab: the hover footprint shows the tilted mark (wider, turned with the
  // pencil's lean or the stroke) instead of the plain ring.
  const footprint = pencil.hover && tool === 'brush' ? activeFx(pencil) ?? null : null;
  const footRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !canvas) return;
    let raf = 0, x = 0, y = 0, visible = false, widen = 1, alpha = 1, angle = 0, tilted = false;
    const apply = () => {
      raf = 0;
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      el.style.opacity = visible ? '1' : '0';
      const f = footRef.current;
      if (f) {
        f.style.opacity = tilted ? '1' : '0';
        f.style.width = `${diameter * widen}px`;
        f.style.height = `${diameter * (tilted ? Math.max(0.35, 1 / widen) : 1)}px`;
        f.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
        f.style.background = `rgba(0,0,0,${0.18 * alpha})`;
      }
    };
    const onMove = (e: PointerEvent) => {
      const overCanvas = e.target === canvas || (studio.isDrawing() && e.pointerType !== 'touch');
      visible = overCanvas && e.pointerType !== 'touch';
      x = e.clientX; y = e.clientY;
      const tilt = footprint ? eventTilt(e) : null;
      tilted = !!tilt;
      if (tilt && footprint) {
        const k = tiltFactors(tilt.alt, footprint);
        widen = k.widen; alpha = k.fade;
        // Screen rotation: the azimuth is already clockwise on screen; a stroke-following
        // nib has no direction while hovering, so it shows the lean direction too.
        angle = tilt.az + (footprint.roll ? tilt.tw : 0);
      } else { widen = 1; alpha = 1; angle = 0; }
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
  }, [canvas, studio, footprint, diameter]);

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
      {footprint && <div ref={footRef} aria-hidden data-testid="hover-footprint" className="absolute left-1/2 top-1/2 rounded-full opacity-0 shadow-[0_0_0_1px_rgba(255,255,255,0.8)]" />}
      <div className="absolute left-1/2 top-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/70 shadow-[0_0_0_1px_rgba(255,255,255,0.8)]" />
    </div>
  );
}
