import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';

const DISMISS_DISTANCE = 90;   // px pulled down
const DISMISS_VELOCITY = 0.11; // px per ms: a flick is enough

/**
 * Drag-to-dismiss for a bottom sheet. Attach `handleProps` to the grab area and
 * `sheetRef` to the sheet itself. While dragging, the transform is set on the sheet
 * directly (no transition); on release the sheet either dismisses or springs back
 * through its own CSS transition. Pulling up meets rising resistance rather than a wall.
 */
export function useSheetDrag(onDismiss: () => void, enabled = true) {
  const sheetRef = useRef<HTMLElement | null>(null);
  const drag = useRef<{ id: number; y0: number; t0: number; dy: number; moved: boolean } | null>(null);

  const setY = (y: number, animate: boolean) => {
    const el = sheetRef.current;
    if (!el) return;
    el.style.transition = animate ? '' : 'none';
    el.style.transform = y ? `translateY(${y}px)` : '';
  };

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    if (!enabled || drag.current) return; // a second finger never takes over
    drag.current = { id: e.pointerId, y0: e.clientY, t0: performance.now(), dy: 0, moved: false };
    // Capture at once so the move stream follows the finger even when it leaves the handle.
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [enabled]);

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const raw = e.clientY - d.y0;
    if (!d.moved) {
      if (Math.abs(raw) < 6) return;
      d.moved = true;
    }
    // Down follows the finger; up is damped so the sheet resists instead of stopping dead.
    d.dy = raw >= 0 ? raw : -Math.sqrt(-raw) * 3;
    setY(d.dy, false);
  }, []);

  const finish = useCallback((e: ReactPointerEvent, cancelled: boolean) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (!d.moved) return;
    const velocity = d.dy / Math.max(1, performance.now() - d.t0);
    const dismiss = !cancelled && (d.dy >= DISMISS_DISTANCE || velocity > DISMISS_VELOCITY);
    setY(0, true); // hand the position back to CSS: the close transition continues from here
    if (dismiss) onDismiss();
  }, [onDismiss]);

  const onPointerUp = useCallback((e: ReactPointerEvent) => finish(e, false), [finish]);
  const onPointerCancel = useCallback((e: ReactPointerEvent) => finish(e, true), [finish]);

  return { sheetRef, handleProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } };
}
