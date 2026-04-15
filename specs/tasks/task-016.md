---
title: "Implement pan interaction — click-drag when zoomed out"
spec_ref: "zoom-lod.md S3.3"
depends_on:
  - task-007
progress: ready-for-review
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> When `level < 0.9`, click-and-drag pans the viewport (adjusts `focusPoint`). This allows navigating large trees at intermediate zoom levels.

## Current State

ZoomState (task-007) has `focusPoint` but no way to change it via interaction. The canvas handles zoom (Ctrl+Scroll) but not pan.

## What To Build

1. Add `mousedown`, `mousemove`, `mouseup` event listeners on the canvas.
2. When `zoomLevel < 0.9` and the user clicks-and-drags (not on a node):
   - Track the drag start position in screen space.
   - On each mousemove, compute the delta in logical coordinates.
   - Update `ZoomState.focusPoint` by the delta.
   - Repaint the canvas.
3. Set `cursor: grab` when hovering over the canvas in pan mode, `cursor: grabbing` while dragging.
4. Ensure pan does not interfere with click-to-focus (distinguish a click from a drag by distance threshold, e.g., 5px).
5. Write tests verifying:
   - Dragging moves the viewport by the correct amount in logical space.
   - Pan only works when zoom < 0.9.
   - Short clicks (< 5px movement) are not treated as pans.
