---
title: "Implement zoom and pan momentum physics"
spec_ref: "interaction-feel.md S1 S2"
depends_on:
  - task-007
  - task-016
progress: not-started
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> Scroll-to-zoom has momentum. When the user releases the scroll/pinch gesture, the zoom continues decelerating smoothly. Friction coefficient: zoom velocity halves every 120ms. Minimum velocity threshold: 0.001 zoom-units/ms. Any new input cancels active momentum.
>
> Track the last 3 scroll events (within a 150ms window) to compute release velocity. Single isolated scroll ticks should NOT trigger momentum.
>
> Pan momentum: same friction model. Pan velocity is a 2D vector. Both axes decelerate independently.
>
> Boundary damping: pan speed reduced by 80% outside tree bounds. On release, snap back with spring animation (200ms, ease-out). At least 20% of tree bounding box remains visible.

## Current State

Zoom (task-007) and pan (task-016) work but stop immediately on input release. No momentum or inertia.

## What To Build

1. Create `src/limb/tree/Momentum.mjs` with a generic momentum engine:
   - Tracks velocity, applies exponential decay (halve every 120ms).
   - Stops when velocity drops below threshold.
   - Cancels on new input.
2. Implement zoom momentum:
   - Track last 3 scroll events within 150ms window to compute release velocity.
   - On scroll release, start momentum animation via `requestAnimationFrame`.
   - Apply velocity to ZoomState.level each frame with decay.
3. Implement pan momentum:
   - Track drag velocity as 2D vector during drag.
   - On drag release, apply 2D momentum with same friction model.
4. Implement boundary damping for pan:
   - Reduce pan speed by 80% when viewport center is outside tree bounding box.
   - On release outside bounds, spring back to nearest edge (200ms, ease-out).
   - Enforce: at least 20% of tree bounding box remains visible.
5. Write tests for:
   - Momentum decays exponentially.
   - Single scroll tick does not trigger momentum.
   - New input cancels active momentum.
   - Boundary damping reduces velocity correctly.
   - Snap-back animation triggers when pan exceeds bounds.
