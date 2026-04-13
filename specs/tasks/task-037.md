---
title: "Implement zoom-out reveal animation"
spec_ref: "interaction-feel.md S5.2"
depends_on:
  - task-006
  - task-007
progress: not-started
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> When zooming out from a focused node:
> - Sibling nodes appear first (they're closest), then the parent, then more distant relatives.
> - Nodes appear with a subtle scale-up (from 90% to 100%) as they enter the viewport.
> - This creates a "revealing" sensation rather than everything appearing at once.

## Current State

Tree rendering (task-006) draws all visible nodes the same way. ZoomState (task-007) handles zoom level changes. When zooming out, nodes pop in at full scale as soon as they enter the viewport — there is no revealing animation.

## What To Build

1. Track node "reveal progress" in the rendering pipeline:
   - When a node transitions from culled/off-screen to visible during a zoom-out, start a reveal animation for that node.
   - Reveal animation: scale from 90% to 100% over 150ms with ease-out timing.
   - Apply the reveal scale on top of the normal zoom transform when painting the node.
2. Order reveal priority by tree proximity to the focused node:
   - Siblings of the focused node reveal first (they appear closest in the viewport).
   - Parent node reveals next.
   - More distant relatives reveal later.
   - Stagger reveal start times by ~30ms per relationship distance.
3. Only trigger reveal animations during zoom-out (decreasing zoom level), not during pan or zoom-in.
4. Integrate with FrameScheduler: reveal animations call `markDirty()` until complete.
5. Write tests for:
   - Nodes entering viewport during zoom-out start at 90% scale.
   - Nodes reach 100% scale after 150ms.
   - Siblings reveal before parent during zoom-out.
   - No reveal animation on zoom-in or pan.
