---
title: "Implement LOD tier computation with hysteresis"
spec_ref: "zoom-lod.md S2"
depends_on:
  - task-003
  - task-007
progress: ready-for-review
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> Each node is assigned an LOD tier based on its `nodeScreenWidth`:
> - Culled: off-screen
> - Favicon: < 80px
> - Screenshot-Low: 80-300px
> - Screenshot-High: 300-600px
> - Live: >= 600px
> - Focused: focusedNodeId AND level >= 0.9
>
> Hysteresis: Favicon->Screenshot-Low enters at >=80px, exits at <60px. Screenshot-Low->High enters >=300px, exits <250px. Screenshot-High->Live enters >=600px, exits <450px.

## Current State

ZoomState (task-007) provides zoom level and coordinate transforms. BrowsingTree (task-003) tracks `NodeStatus`. No LOD computation exists.

## What To Build

1. Create `src/limb/tree/LODComputer.mjs` implementing:
   - `computeTiers(tree, layout, zoomState)` — returns `Map<string, NodeStatus>`.
   - Compute `nodeScreenWidth` for each node given the current zoom.
   - Apply visibility culling: nodes outside viewport + 200px margin are `culled`.
   - Assign tier based on thresholds from zoom-lod.md S2.1.
   - Apply hysteresis: maintain previous tier state, use enter/exit thresholds.
2. Track previous frame's tier per node for hysteresis calculation.
3. Enforce invariants:
   - Focused node is always Live or Focused tier (overrides other rules).
   - Every visible node has a tier (no undefined state).
   - Tier transitions are monotonic: a non-focused node changes at most one tier per LOD computation cycle (e.g., Culled → Favicon, not Culled → Live in one frame). The focused node is exempt — it jumps directly to Live/Focused.
4. Integrate with LimbTreeView: call LOD computation each frame, use tiers to decide what to paint.
5. Write tests for:
   - Tier assignment at each threshold boundary.
   - Hysteresis prevents thrashing at boundaries.
   - Focused node never drops below Live.
   - Monotonic transitions: non-focused node steps through one tier at a time across frames.
   - Culling margin works correctly.
