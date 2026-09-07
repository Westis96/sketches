import { useEffect, useRef } from 'react';
import { compileTip } from '@/engine/tipShim';

/** Renders the custom tip function on a small 100×100-unit preview surface. */
export function TipPreview({ tipSource, onError }: { tipSource: string; onError?: (bad: boolean) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.save();
    ctx.translate(c.width / 2, c.height / 2);
    ctx.scale(c.width / 100, c.height / 100);
    ctx.strokeStyle = 'rgba(99,102,241,0.35)';
    ctx.lineWidth = 0.6;
    ctx.strokeRect(-50, -50, 100, 100);
    let bad = false;
    try {
      compileTip(tipSource)({ drawingContext: ctx });
    } catch {
      bad = true;
    }
    ctx.restore();
    onError?.(bad);
  }, [tipSource, onError]);

  return <canvas ref={ref} width={96} height={96} className="h-full w-full" />;
}
