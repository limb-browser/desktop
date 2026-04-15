---
title: "Implement performance probes"
spec_ref: "performance.md S6"
depends_on:
  - task-022
progress: complete
review: "specs/reviews/review-task-034-R2.md"
coverage_sections: []
commits: []
---

## Spec Excerpt

> The `PerformanceProbe` interface emits:
> - `frameBudgetExceeded(actualMs, budgetMs)` when a frame takes longer than 16ms.
> - `lodComputationTime(ms)` per frame.
> - `memorySnapshot(heapMB, screenshotsMB, tabCount)` periodic report.
>
> Any commit that increases idle CPU usage above the budget is a defect, not a tradeoff.

## Current State

Frame scheduler (task-022) manages the paint loop. No performance measurement or reporting exists.

## What To Build

1. Create `src/limb/tree/PerformanceProbe.mjs`:
   - `frameBudgetExceeded(actualMs, budgetMs)` — called when a frame takes > 16ms.
   - `lodComputationTime(ms)` — called after each LOD computation.
   - `memorySnapshot(heapMB, screenshotsMB, tabCount)` — called periodically.
2. Integrate with FrameScheduler:
   - Measure each frame's duration (start/end timestamps around paint).
   - If duration > 16ms, call `frameBudgetExceeded`.
3. Integrate with LODComputer:
   - Measure LOD computation time per frame.
   - Report via `lodComputationTime`.
4. Periodic memory snapshot:
   - Every 30 seconds, collect heap size, screenshot memory usage, active tab count.
   - Report via `memorySnapshot`.
5. Log probe data to browser console for debugging. Optionally expose via `about:limb-debug` or devtools.
6. Write tests for:
   - Probes fire when budget is exceeded.
   - LOD computation time is measured correctly.
   - Memory snapshots include correct data.
