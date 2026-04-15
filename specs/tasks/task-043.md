---
title: "Implement pan momentum and boundary damping"
spec_ref: "interaction-feel.md S2"
depends_on:
  - task-016
  - task-022
progress: complete
review: "specs/reviews/review-task-043-R3.md"
coverage_sections: []
commits: []
---

## Spec Excerpt

> Click-and-drag panning (when zoomed out) also has momentum on release.
>
> - Same friction model as zoom momentum (S1.1).
> - Pan velocity is tracked as a 2D vector `{ vx, vy }`.
> - Both axes decelerate independently.
>
> When panning beyond the tree's bounding box, apply elastic resistance:
> - Pan speed is reduced by 80% when the viewport center is outside the tree bounds.
> - On release, the viewport snaps back to the nearest edge of the tree bounds with a spring animation (200ms, ease-out).
> - The tree should never fully leave the viewport. At least 20% of the tree bounding box remains visible.

## Current State

Pan interaction (task-016) provides click-and-drag panning when zoomed out, but panning stops instantly on mouse release. There is no momentum, no velocity tracking, and no boundary enforcement. The user can pan the tree entirely off-screen.

## What To Build

1. Create `src/limb/tree/PanMomentum.mjs` implementing inertial pan:
   - Track pan velocity as a 2D vector `{ vx, vy }` from recent drag events.
   - On mouse release, apply momentum using the same friction model as zoom (velocity halves every 120ms per axis).
   - Both axes decelerate independently.
   - Stop momentum when velocity magnitude drops below a minimum threshold.
2. Implement boundary damping:
   - Compute the tree's bounding box from the layout.
   - When the viewport center moves outside the tree bounding box, reduce pan speed by 80%.
   - On release outside bounds, animate snap-back to the nearest edge (200ms, ease-out spring).
   - Enforce hard limit: at least 20% of the tree bounding box remains visible at all times.
3. Integrate with ZoomState:
   - Momentum updates `ZoomState.focusPoint` each frame via `markDirty()`.
   - Boundary enforcement applies both during drag and during momentum.
4. Handle momentum cancellation:
   - New drag input immediately cancels active pan momentum.
   - New zoom input cancels pan momentum (the zoom will reposition the viewport).
5. Write tests for:
   - Pan momentum applies on drag release.
   - Velocity decays correctly per axis (friction model).
   - Pan speed is reduced 80% outside tree bounds.
   - Snap-back animates to nearest edge on release outside bounds.
   - At least 20% of tree bounding box remains visible (hard limit).
   - New drag or zoom input cancels momentum.
