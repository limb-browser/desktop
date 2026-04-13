---
title: "Implement node labels, focus ring, and hover feedback"
spec_ref: "tree-rendering.md S2.3 S2.4; interaction-feel.md S3"
depends_on:
  - task-006
progress: not-started
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> Node titles are drawn below each node frame when the node is large enough to read (> 60px wide). Font size scales with zoom. Text is truncated with ellipsis when it would overflow.
>
> The focused node has a colored border (thin, ~2px) at all zoom levels.
>
> When cursor hovers over a node in tree view (zoomLevel < 0.9): node elevates slightly (2px translate-up or subtle shadow increase), title text becomes fully opaque (from 70% to 100%). Transition: 100ms ease-out.

## Current State

Canvas renders node rectangles and edges (task-006) but no labels, focus ring, or hover feedback.

## What To Build

1. Implement label rendering:
   - Draw node titles below each node frame.
   - Only draw labels when `nodeScreenWidth > 60px`.
   - Scale font size with zoom level.
   - Truncate text with ellipsis when too wide (measure text width with `ctx.measureText()`).
   - Default label opacity: 70%.
2. Implement focus ring:
   - Draw a colored border (2px, accent color) around the focused node.
   - Visible at all zoom levels.
3. Implement hover detection:
   - Track mouse position over the canvas.
   - Hit-test against node rectangles (reuse logic from click-to-focus if available).
   - When hovering a node: draw it shifted 2px up, label at 100% opacity.
4. Smooth transitions: use an animation interpolation for hover state (track per-node hover progress 0→1 over ~100ms).
5. Write tests for:
   - Labels appear only above 60px width threshold.
   - Text truncation works for long titles.
   - Focus ring is drawn on the correct node.
   - Hover state is detected for the correct node.
