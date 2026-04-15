---
title: "Implement ZoomState and Ctrl+Scroll zoom interaction"
spec_ref: "zoom-lod.md S1"
depends_on:
  - task-005
progress: ready-for-review
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> ```typescript
> interface ZoomState {
>   level: number           // 0.0 (fully zoomed out) to 1.0 (fully zoomed in)
>   focusPoint: { x, y }   // Center of viewport in tree-logical coordinates
>   viewportSize: { width, height }  // Physical pixels
> }
> ```
>
> Ctrl+Scroll (or trackpad pinch): Continuously adjusts `level`. Scroll up = zoom in, scroll down = zoom out.
> Zoom target: the zoom focuses on `focusPoint`, which defaults to the focused node's position.
> Zoom range: `level` is clamped to `[0.0, 1.0]`.

## Current State

No zoom state or interaction exists. The canvas renders at a fixed viewport.

## What To Build

1. Create `src/limb/tree/ZoomState.mjs` with:
   - `level` (0.0 to 1.0), `focusPoint` ({x, y}), `viewportSize` ({width, height}).
   - Methods to compute `zoomScale` from `level` such that at level=1.0 the focused node fills the viewport.
   - Method `logicalToScreen(x, y)` converting logical coordinates to screen pixels.
   - Method `screenToLogical(x, y)` converting screen pixels to logical coordinates.
2. Wire Ctrl+Scroll event listener on the canvas:
   - Detect `wheel` events with `ctrlKey` held.
   - Adjust `level` based on scroll delta.
   - Clamp to [0.0, 1.0].
3. Update LimbTreeView to use ZoomState when painting: apply the zoom transform to all node/edge coordinates.
4. Implement cursor-anchored zoom (zoom-lod.md S1.2): the point under the cursor stays fixed on screen during zoom.
5. Trigger canvas repaint on zoom change.
6. Write tests for:
   - Zoom level clamping.
   - Coordinate transform correctness.
   - Cursor anchoring math (point under cursor stays fixed).
