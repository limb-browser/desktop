import type { ZoomState } from './zoom';

// Spec conflict: interaction-feel.md §5.1 says 350ms, zoom-lod.md §4.1 says 300ms.
// Using 350ms from interaction-feel.md §5.1 as it is the more specific section for
// click-to-focus animation behavior. See task-028.md "Spec Conflicts" section.
const DURATION_MS = 350;
const ADDRESS_BAR_FADE_WINDOW_RATIO = 0.3;

export interface FocusAnimationPlan {
  duration: number;
  startZoom: number;
  endZoom: number;
  startFocusPoint: { x: number; y: number };
  endFocusPoint: { x: number; y: number };
  addressBarFadeStart: number;
}

/**
 * Cubic-bezier ease-out: (0.25, 0.1, 0.25, 1.0)
 * Attempt to find y for a given x using Newton's method on the bezier curve.
 */
function cubicBezier(t: number, p1: number, p2: number): number {
  // B(t) = 3(1-t)^2*t*p1 + 3(1-t)*t^2*p2 + t^3
  return 3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t;
}

function solveCubicBezierX(x: number, x1: number, x2: number): number {
  // Newton's method to find t for given x on the bezier x-curve
  let t = x;
  for (let i = 0; i < 8; i++) {
    const currentX = cubicBezier(t, x1, x2);
    const dx = 3 * (1 - t) * (1 - t) * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t * t * (1 - x2);
    if (Math.abs(dx) < 1e-10) break;
    t -= (currentX - x) / dx;
    t = Math.max(0, Math.min(1, t));
  }
  return t;
}

function easeOut(progress: number): number {
  // cubic-bezier(0.25, 0.1, 0.25, 1.0)
  const t = solveCubicBezierX(progress, 0.25, 0.25);
  return cubicBezier(t, 0.1, 1.0);
}

export function planFocusAnimation(
  currentZoom: ZoomState,
  targetNodeId: string,
  layout: Map<string, { x: number; y: number }>
): FocusAnimationPlan {
  const targetPos = layout.get(targetNodeId)!;
  return {
    duration: DURATION_MS,
    startZoom: currentZoom.level,
    endZoom: 1.0,
    startFocusPoint: { x: currentZoom.focusPoint.x, y: currentZoom.focusPoint.y },
    endFocusPoint: { x: targetPos.x, y: targetPos.y },
    addressBarFadeStart: DURATION_MS - DURATION_MS * ADDRESS_BAR_FADE_WINDOW_RATIO,
  };
}

export function sampleFocusAnimation(
  plan: FocusAnimationPlan,
  timeMs: number
): { zoomLevel: number; focusPoint: { x: number; y: number }; addressBarOpacity: number } {
  // Clamp time to [0, duration]
  const t = Math.max(0, Math.min(plan.duration, timeMs));
  const rawProgress = plan.duration > 0 ? t / plan.duration : 1;
  const easedProgress = easeOut(rawProgress);

  // Interpolate zoom level
  const zoomLevel = plan.startZoom + (plan.endZoom - plan.startZoom) * easedProgress;

  // Interpolate focus point
  const focusPoint = {
    x: plan.startFocusPoint.x + (plan.endFocusPoint.x - plan.startFocusPoint.x) * easedProgress,
    y: plan.startFocusPoint.y + (plan.endFocusPoint.y - plan.startFocusPoint.y) * easedProgress,
  };

  // Address bar opacity: 0 before fadeStart, linear ramp from fadeStart to duration
  let addressBarOpacity = 0;
  if (t > plan.addressBarFadeStart) {
    const fadeWindow = plan.duration - plan.addressBarFadeStart;
    addressBarOpacity = fadeWindow > 0 ? (t - plan.addressBarFadeStart) / fadeWindow : 1;
  }

  return { zoomLevel, focusPoint, addressBarOpacity };
}
