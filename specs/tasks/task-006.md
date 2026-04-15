---
title: "Render tree nodes and edges on canvas"
spec_ref: "tree-rendering.md S2.1 S2.2"
depends_on:
  - task-003
  - task-004
  - task-005
progress: complete
review: "specs/reviews/review-TASK_006-R1.md"
coverage_sections: []
commits: []
---

## Spec Excerpt

> Each visible node is painted as a rounded rectangle. Content depends on LOD tier.
>
> Parent-child connections are drawn as Bezier curves from the bottom-center of the parent to the top-center of the child. Stroke color: subtle gray. Stroke width: 1-2px, scaling with zoom.

## Current State

- BrowsingTree model (task-003) provides node data.
- TreeLayout (task-004) provides (x, y) positions.
- Canvas element wired in browser.xhtml (task-005).
- LimbTreeView.mjs currently paints only placeholder text.

## What To Build

1. Update `LimbTreeView.mjs` to accept a BrowsingTree and layout positions.
2. Implement node painting: rounded rectangles at each node's screen position, sized based on a configurable `baseNodeWidth`.
3. Implement edge painting: cubic Bezier curves from parent bottom-center to child top-center. Stroke color `#666`, width 1-2px.
4. Implement viewport-to-screen coordinate transform (logical position * zoom + viewport offset = screen position).
5. Create a test BrowsingTree with 5-10 nodes and render it on startup to verify the pipeline works end-to-end.
6. Write tests verifying:
   - Node rectangles are drawn at correct screen positions.
   - Edges connect correct parent-child pairs.
   - Off-screen nodes are not painted.
