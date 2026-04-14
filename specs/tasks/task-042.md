---
title: "Implement zoom momentum (inertial zoom with velocity tracking)"
spec_ref: "interaction-feel.md S1"
depends_on:
  - task-007
  - task-022
progress: not-started
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> Scroll-to-zoom has momentum. When the user releases the scroll/pinch gesture, the zoom continues decelerating smoothly rather than stopping abruptly.
>
> - Friction coefficient: Tunable. Default: the zoom velocity halves every 120ms.
> - Minimum velocity threshold: Momentum stops when velocity drops below 0.001 zoom-units/ms.
> - Interruption: Any new scroll/pinch input immediately cancels the active momentum and starts fresh from the new input velocity.
>
> Track the last 3 scroll events (within a 150ms window) to compute release velocity. Single isolated scroll ticks should NOT trigger momentum, only sustained gestures.
>
> When zooming programmatically (e.g., clicking a node to focus it):
> - Duration: 350ms
> - Easing: `cubic-bezier(0.25, 0.1, 0.25, 1.0)` (ease-out with slight overshoot feel)

## Current State

ZoomState (task-007) provides the basic Ctrl+Scroll zoom interaction, but zoom changes are instantaneous per scroll event. When the user stops scrolling, zoom stops immediately. There is no momentum, velocity tracking, or friction model.

## What To Build

1. Create `src/limb/tree/ZoomMomentum.mjs` implementing inertial zoom:
   - Track the last 3 scroll events with timestamps (within a 150ms window).
   - On scroll release (no new scroll events within 150ms), compute release velocity from the tracked events.
   - If only 1 isolated scroll tick occurred (not a sustained gesture), do NOT trigger momentum.
   - Apply exponential decay friction: velocity halves every 120ms.
   - Stop momentum when velocity drops below 0.001 zoom-units/ms.
2. Implement momentum interruption:
   - Any new scroll/pinch input immediately cancels active momentum.
   - Start fresh velocity tracking from the new input.
3. Integrate with ZoomState:
   - Momentum updates `ZoomState.level` each frame via FrameScheduler's `markDirty()`.
   - Clamp zoom level to [0.0, 1.0] during momentum.
4. Implement the programmatic zoom easing curve:
   - Duration: 350ms (not 300ms as task-014 initially assumed).
   - Easing: `cubic-bezier(0.25, 0.1, 0.25, 1.0)`.
   - Used by click-to-focus and other programmatic zoom animations.
5. Write tests for:
   - Sustained scroll gesture triggers momentum on release.
   - Single isolated scroll tick does NOT trigger momentum.
   - Velocity halves every 120ms during momentum.
   - Momentum stops at velocity threshold.
   - New scroll input cancels active momentum.
   - Zoom level remains clamped during momentum.
   - Programmatic zoom uses correct easing curve and duration.
