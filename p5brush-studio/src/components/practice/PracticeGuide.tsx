import { useStudioState } from '@/hooks/useStudio';
import { LESSON_BOX, lessonById, lessonSteps, stepWidth } from '@/practice/lessons';
import type { Point } from '@/engine/records';

const d = (pts: Point[]) => 'M' + pts.map((p) => `${p.x} ${p.y}`).join('L');

/**
 * On-canvas guide for the open lesson. The current reference stroke is a pale
 * "road" a little wider than the mark with a thin flowing dashed centreline, a
 * start dot and an arrowhead; the remaining strokes are faint ghosts. Nothing
 * opaque sits on the path, and the current stroke's guide disappears while a
 * stroke is being drawn (the ghosts only fade), so the ink is all you see. Drawn in world units under the
 * camera transform, so it pans and zooms with the paper. Pointer events pass
 * through to the canvas.
 */
export function PracticeGuide() {
  const practice = useStudioState((s) => s.practice);
  const view = useStudioState((s) => s.view);
  const drawing = useStudioState((s) => s.drawing);
  if (!practice) return null;
  const lesson = lessonById(practice.lessonId);
  if (!lesson) return null;
  const steps = lessonSteps(lesson);
  const active = practice.status === 'active';
  const cur = active ? steps[practice.step] : null;
  const showGhost = (i: number) => {
    if (!practice.guide) return false;
    if (!active) return true; // finished: the whole reference, for comparing
    return i > practice.step || (i < practice.step && practice.results[i] === null);
  };
  const z = view.zoom;
  let arrow: string | null = null;
  if (cur && cur.points.length >= 2) {
    const n = cur.points.length;
    const a = cur.points[Math.max(0, n - 4)], b = cur.points[n - 1];
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const L = 11 / z, W = 7 / z;
    const tip = { x: b.x + Math.cos(ang) * L * 0.6, y: b.y + Math.sin(ang) * L * 0.6 };
    const bx = tip.x - Math.cos(ang) * L, by = tip.y - Math.sin(ang) * L;
    const nx = -Math.sin(ang) * W, ny = Math.cos(ang) * W;
    arrow = `M${tip.x} ${tip.y}L${bx + nx} ${by + ny}L${bx - nx} ${by - ny}Z`;
  }
  const dim = drawing && active;

  return (
    <svg data-testid="practice-guide" aria-hidden className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible" data-dim={dim ? 'true' : undefined}>
      <g transform={`translate(${view.x} ${view.y}) scale(${z})`} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <rect x={0} y={0} width={LESSON_BOX.w} height={LESSON_BOX.h} rx={8 / z} stroke="rgba(0,0,0,0.09)" strokeWidth={1} strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
        <g className="guide-layer" style={{ opacity: dim ? 0.35 : 1 }}>
          {steps.map((st, i) => showGhost(i) && (
            <path key={i} data-guide="ghost" d={d(st.points)} stroke={st.color} strokeWidth={stepWidth(st)} opacity={active ? 0.1 : 0.28} />
          ))}
        </g>
        {cur && (
          <g data-guide="current">
            {/* the road: a pale band slightly wider than the mark, so the ink shows inside it */}
            <g className="guide-layer" style={{ opacity: dim ? 0 : 1 }}>
              <path d={d(cur.points)} stroke={cur.color} strokeWidth={stepWidth(cur) + 10 / z} opacity={0.08} />
            </g>
            {/* the centreline: thin, so it never hides the ink; fades while drawing */}
            <g className="guide-layer" style={{ opacity: dim ? 0 : 0.95 }}>
              <path className="guide-flow" d={d(cur.points)} stroke="var(--accent)" strokeWidth={1.75} strokeDasharray="8 7" vectorEffect="non-scaling-stroke" />
              {arrow && <path d={arrow} fill="var(--accent)" stroke="#fff" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
            </g>
            <circle className="guide-start" cx={cur.points[0].x} cy={cur.points[0].y} r={9 / z} fill="var(--accent)" stroke="#fff" strokeWidth={2.5} vectorEffect="non-scaling-stroke" style={{ opacity: dim ? 0 : 1 }} />
          </g>
        )}
      </g>
    </svg>
  );
}
