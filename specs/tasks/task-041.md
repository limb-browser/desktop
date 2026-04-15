---
title: "Implement frame budget enforcement with graceful degradation"
spec_ref: "interaction-feel.md S6"
depends_on:
  - task-022
  - task-011
  - task-034
progress: ready-for-review
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> All animations must maintain 60fps. If a frame takes longer than 16ms, the system should:
>
> 1. Skip animation frames (jump to final state) rather than stutter.
> 2. Reduce LOD tier thresholds temporarily (show more screenshots, fewer live views).
> 3. Never block the main thread with layout computation.

## Current State

FrameScheduler (task-022) manages the demand-driven frame loop but does not monitor frame duration or trigger degradation. LODComputer (task-011) uses fixed tier thresholds. PerformanceProbe (task-034) detects budget overruns but only reports — it does not enforce. Animation tasks (task-014, task-030, task-038) have no skip-to-end capability.

## What To Build

1. Add frame budget monitoring to FrameScheduler:
   - Measure each frame's total duration (from start of tick to end of paint).
   - Track a rolling window of the last 5 frames.
   - If 3 of the last 5 frames exceed 16ms, enter "degraded mode".
   - Exit degraded mode after 10 consecutive frames under 12ms.
2. Implement animation skip-to-end:
   - Add a `skipToEnd()` method to the animation base (used by zoom animation, layout animation, reveal animation).
   - In degraded mode, any animation that has been running for more than 2 frames is skipped to its final state.
   - Ensure skipping produces no visual glitches (final state is applied atomically).
3. Implement temporary LOD threshold reduction:
   - In degraded mode, raise all LOD tier entry thresholds by 50% (e.g., Live threshold goes from 600px to 900px).
   - This causes more nodes to remain at Screenshot tier, reducing live tab rendering.
   - Restore original thresholds when exiting degraded mode.
4. Integrate with PerformanceProbe: emit a `degradedModeEntered` / `degradedModeExited` event for observability.
5. Write tests for:
   - Degraded mode activates after consecutive slow frames.
   - Degraded mode deactivates after consecutive fast frames.
   - Animations skip to final state in degraded mode.
   - LOD thresholds are raised in degraded mode.
   - LOD thresholds restore on exit from degraded mode.
   - No visual glitches when animations are skipped.
