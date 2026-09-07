import { useEffect, useState } from 'react';
import { useStudioState } from '@/hooks/useStudio';
import { LESSON_BOX, stepWidth, type LessonStep } from '@/practice/lessons';
import { pathLength } from '@/practice/geometry';
import { DEFAULT_SPEED } from '@/practice/score';
import type { Point } from '@/engine/records';

const d = (pts: Point[]) => 'M' + pts.map((p) => `${p.x} ${p.y}`).join('L');

/**
 * The road: a closed outline around the reference whose width follows its
 * pressure, so the guide shows the mark the brush is expected to make (a taper
 * narrows, a swell widens) and not just where it goes. `base` is the brush's
 * visible width; `pad` is the constant margin in world units.
 */
export function roadPath(pts: Point[], base: number, pad: number): string {
  const n = pts.length;
  if (n < 2) return '';
  const L: string[] = [], R: string[] = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const w = (base * (0.3 + 1.1 * p.p)) / 2 + pad;
    L.push(`${(p.x - dy * w).toFixed(1)} ${(p.y + dx * w).toFixed(1)}`);
    R.push(`${(p.x + dy * w).toFixed(1)} ${(p.y - dx * w).toFixed(1)}`);
  }
  return 'M' + L.join('L') + 'L' + R.reverse().join('L') + 'Z';
}
const REVEAL_MS = 1200;

/**
 * On-canvas guide for the open session, drawn in world units under the camera
 * transform so it pans and zooms with the paper. What is drawn depends on the
 * assist tier:
 *
 *   full   road + flowing centreline + arrow + start dot + ghosts of the rest
 *   light  centreline + start dot, faint ghosts
 *   dots   start dot and end ring only (the ghosted-line exercise)
 *   blind  nothing until the pen lifts; then the reference appears for a second
 *
 * A small dot travels the centreline at the step's target speed (the speed
 * ghost). Everything for the current step hides while a stroke is being drawn.
 * After a Perform, the three costliest strokes are highlighted for the critique.
 */
export function PracticeGuide() {
  const practice = useStudioState((s) => s.practice);
  const view = useStudioState((s) => s.view);
  const drawing = useStudioState((s) => s.drawing);
  // Blind tier: re-render once the reveal window closes.
  const revealAt = practice?.reveal?.at ?? 0;
  const [, tick] = useState(0);
  useEffect(() => {
    if (!revealAt) return;
    const t = window.setTimeout(() => tick((n) => n + 1), REVEAL_MS + 50);
    return () => window.clearTimeout(t);
  }, [revealAt]);
  // Memory missions: the subject leaves the paper when the look is over.
  const memoryUntil = practice?.memoryUntil ?? 0;
  useEffect(() => {
    if (!memoryUntil || Date.now() >= memoryUntil) return;
    const t = window.setTimeout(() => tick((n) => n + 1), memoryUntil - Date.now() + 50);
    return () => window.clearTimeout(t);
  }, [memoryUntil]);
  if (!practice) return null;
  const pr = practice;
  const steps = pr.steps;
  const active = pr.status === 'active';
  const cur: LessonStep | null = active ? steps[pr.step] : null;
  const tier = pr.tier;
  const z = view.zoom;
  // Seeing missions keep the subject on the paper: always for a blind contour or a
  // flipped copy, for the length of the look in a memory piece.
  const subject = active && (pr.seeing === 'blind' || pr.seeing === 'flipped' || (pr.seeing === 'memory' && memoryUntil > Date.now()));
  const showGhost = (i: number) => {
    if (!active) return pr.guide; // finished: the whole reference, for comparing
    if (subject) return true;
    if (!pr.guide || tier === 'dots' || tier === 'blind') return false;
    return i > pr.step || (i < pr.step && pr.results[i] === null);
  };
  const ghostOpacity = !active ? 0.28 : subject ? 0.3 : tier === 'full' ? 0.1 : 0.06;
  const dim = drawing && active;
  const reveal = pr.reveal && Date.now() - pr.reveal.at < REVEAL_MS ? steps[pr.reveal.step] : null;

  let arrow: string | null = null;
  let startTick: string | null = null;
  let ghostDur = 0;
  if (cur && cur.points.length >= 2) {
    const n = cur.points.length;
    {
      // Dots only: which way to leave the start dot, since there is no line to follow.
      const p0 = cur.points[0], p1 = cur.points[Math.min(3, n - 1)];
      const a0 = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      const L = 8 / z, Wd = 5 / z, off = 14 / z;
      const bx = p0.x + Math.cos(a0) * off, by = p0.y + Math.sin(a0) * off;
      const tx = bx + Math.cos(a0) * L, ty = by + Math.sin(a0) * L;
      const nx = -Math.sin(a0) * Wd, ny = Math.cos(a0) * Wd;
      startTick = `M${tx} ${ty}L${bx + nx} ${by + ny}L${bx - nx} ${by - ny}Z`;
    }
    const a = cur.points[Math.max(0, n - 4)], b = cur.points[n - 1];
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const L = 11 / z, W = 7 / z;
    const tip = { x: b.x + Math.cos(ang) * L * 0.6, y: b.y + Math.sin(ang) * L * 0.6 };
    const bx = tip.x - Math.cos(ang) * L, by = tip.y - Math.sin(ang) * L;
    const nx = -Math.sin(ang) * W, ny = Math.cos(ang) * W;
    arrow = `M${tip.x} ${tip.y}L${bx + nx} ${by + ny}L${bx - nx} ${by - ny}Z`;
    // The speed ghost takes as long as the stroke should, plus a beat at the end.
    ghostDur = pathLength(cur.points) / (cur.speed ?? DEFAULT_SPEED) / 1000;
  }
  const costly = !active && pr.summary?.costly?.length && pr.part === 'perform' ? pr.summary.costly : [];

  return (
    <svg data-testid="practice-guide" aria-hidden className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible" data-dim={dim ? 'true' : undefined} data-tier={tier} data-subject={subject ? 'true' : undefined}>
      <g transform={`translate(${view.x} ${view.y}) scale(${z})`} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <rect x={0} y={0} width={LESSON_BOX.w} height={LESSON_BOX.h} rx={8 / z} stroke="rgba(0,0,0,0.09)" strokeWidth={1} strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
        {pr.overlay && (
          <g data-guide="overlay">
            {pr.overlay.map((poly, i) => <path key={i} d={d(poly)} stroke="var(--text-2)" strokeWidth={1.5} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" opacity={0.75} />)}
          </g>
        )}
        <g className="guide-layer" style={{ opacity: dim ? 0.35 : 1 }}>
          {steps.map((st, i) => showGhost(i) && (
            st.shape
              ? <path key={i} data-guide="ghost" data-shape={st.shape.kind} d={d(st.points) + 'Z'} fill={st.shape.color} stroke={st.shape.color} strokeWidth={1.5 / z} opacity={ghostOpacity * 0.55} />
              : <path key={i} data-guide="ghost" d={d(st.points)} stroke={st.color} strokeWidth={stepWidth(st)} opacity={ghostOpacity} />
          ))}
        </g>
        {cur && tier !== 'blind' && (
          <g data-guide="current">
            {tier === 'full' && (
              <g className="guide-layer" style={{ opacity: dim ? 0 : 1 }}>
                <path data-guide="road" d={roadPath(cur.points, stepWidth(cur), 5 / z)} fill={cur.color} opacity={0.1} strokeLinejoin="round" />
              </g>
            )}
            {tier !== 'dots' && (
              <g className="guide-layer" style={{ opacity: dim ? 0 : 0.95 }}>
                <path className="guide-flow" d={d(cur.points)} stroke="var(--accent)" strokeWidth={1.75} strokeDasharray="8 7" vectorEffect="non-scaling-stroke" />
                {tier === 'full' && arrow && <path d={arrow} fill="var(--accent)" stroke="#fff" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
                {ghostDur > 0 && (
                  <circle data-guide="speed-ghost" r={4.5 / z} fill="var(--accent)" stroke="#fff" strokeWidth={1.5} vectorEffect="non-scaling-stroke" opacity={0.8}>
                    <animateMotion key={`${pr.step}-${pr.status}`} dur={`${(ghostDur + 0.6).toFixed(2)}s`} repeatCount="indefinite" path={d(cur.points)} keyPoints="0;1;1" keyTimes={`0;${(ghostDur / (ghostDur + 0.6)).toFixed(3)};1`} calcMode="linear" />
                  </circle>
                )}
              </g>
            )}
            {tier === 'dots' && startTick && (
              <path className="guide-layer" data-guide="start-tick" d={startTick} fill="var(--accent)" stroke="#fff" strokeWidth={1.5} vectorEffect="non-scaling-stroke" style={{ opacity: dim ? 0 : 0.9 }} />
            )}
            {tier === 'dots' && (
              <circle className="guide-layer" cx={cur.points[cur.points.length - 1].x} cy={cur.points[cur.points.length - 1].y} r={7 / z} stroke="var(--accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" style={{ opacity: dim ? 0.4 : 1 }} />
            )}
            <circle className="guide-start" cx={cur.points[0].x} cy={cur.points[0].y} r={9 / z} fill="var(--accent)" stroke="#fff" strokeWidth={2.5} vectorEffect="non-scaling-stroke" style={{ opacity: dim ? 0 : 1 }} />
          </g>
        )}
        {reveal && (
          <path key={pr.reveal!.at} className="guide-reveal" data-guide="reveal" d={d(reveal.points)} stroke="var(--accent)" strokeWidth={2} strokeDasharray="8 7" vectorEffect="non-scaling-stroke" />
        )}
        {costly.map((c) => (
          <path key={c.step} data-guide="costly" d={d(steps[c.step].points)} stroke="var(--accent)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" opacity={0.85} />
        ))}
      </g>
    </svg>
  );
}
