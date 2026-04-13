---
title: "Implement LOD performance optimizations — spatial index and frame skipping"
spec_ref: "performance.md S2.1 S2.3"
depends_on:
  - task-011
progress: not-started
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> Do NOT recompute LOD for every node on every frame. Instead:
> - Maintain a spatial index of node positions.
> - On zoom/pan change, query only nodes whose viewport status might have changed.
> - Use a dirty flag per node. Only recompute nodes whose `nodeScreenWidth` crossed a tier boundary.
>
> If LOD computation takes longer than 4ms in a single frame:
> - Process only the highest-priority nodes (closest to viewport center) this frame.
> - Defer remaining nodes to the next frame.
> - Priority: focused node > ancestors > siblings > descendants > distant nodes.

## Current State

LODComputer (task-011) recomputes tiers for all nodes on every frame. This works for small trees but will not scale to trees with hundreds of nodes.

## What To Build

1. Add a spatial index to LODComputer:
   - Index node positions for fast viewport intersection queries.
   - On zoom/pan change, query only nodes near the viewport boundary whose visibility status might have changed.
   - Interior nodes (fully visible or fully culled) skip recomputation if their `nodeScreenWidth` hasn't crossed a tier boundary.
2. Implement dirty flags per node:
   - Mark a node dirty when its `nodeScreenWidth` crosses a tier boundary threshold.
   - Only recompute tier for dirty nodes.
   - Clear dirty flags after processing.
3. Implement frame-budget-aware LOD processing:
   - Measure elapsed time during LOD computation.
   - If computation exceeds 4ms, stop and defer remaining nodes to the next frame.
   - Process nodes in priority order: focused node first, then ancestors, siblings, descendants, distant nodes.
4. Ensure deferred nodes retain their previous tier (no visual glitch from skipping a frame).
5. Write tests for:
   - Spatial index returns correct nodes for a given viewport.
   - Dirty flags are set when screen width crosses a threshold.
   - Frame skipping defers low-priority nodes.
   - Priority order is respected (focused node always processed first).
   - No visual artifacts from deferred computation.
