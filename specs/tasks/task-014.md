---
title: "Implement click-to-focus with zoom animation"
spec_ref: "zoom-lod.md S3.1 S4.1"
depends_on:
  - task-006
  - task-007
  - task-009
progress: not-started
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> Clicking a node in the tree view (when `level < 0.9`) sets it as `focusedNodeId` and animates zoom to `level = 1.0` centered on that node.
>
> Zoom animation: from current `level` to `1.0` over 350ms with ease-out timing (see interaction-feel.md S1.3 for the exact easing curve). During animation, LOD tiers update each frame.

## Current State

The canvas renders tree nodes (task-006) and zoom works (task-007). Focus sync exists (task-009). But there's no click detection on canvas nodes and no zoom animation.

## What To Build

1. Implement hit testing on the canvas:
   - On `click` event, convert screen coordinates to logical coordinates using ZoomState.
   - Find which node (if any) was clicked by checking if the click point is within any node's bounding rectangle.
2. When a node is clicked and `zoomLevel < 0.9`:
   - Call `BrowsingTree.focusNode(clickedNodeId)`.
   - Animate zoom from current level to 1.0 over 350ms using ease-out timing `cubic-bezier(0.25, 0.1, 0.25, 1.0)` (per interaction-feel.md S1.3).
   - Animate `focusPoint` to the clicked node's position.
3. Use `requestAnimationFrame` for the animation loop. Update LOD tiers each frame during animation.
4. If user clicks while an animation is running, cancel the current animation and start a new one.
5. Write tests for:
   - Hit testing returns correct node ID for a given click position.
   - Zoom animates from current level to 1.0.
   - Animation uses ease-out timing (not linear).
   - Clicking during animation cancels previous and starts new.
