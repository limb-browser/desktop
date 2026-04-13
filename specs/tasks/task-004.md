---
title: "Implement tree layout algorithm"
spec_ref: "tree-model.md S3"
depends_on:
  - task-003
progress: ready-for-review
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> The tree layout assigns (x, y) coordinates to each node for rendering. The layout is computed as pure data with no knowledge of screen coordinates or pixels.
>
> Algorithm: A top-down tree layout (similar to Reingold-Tilford):
> - Root is at the top.
> - Children are arranged below their parent, spaced horizontally.
> - Sibling order matches `childIds` order (creation order).
> - Subtrees do not overlap.
>
> Layout Invariants: Every node has a position. No overlaps. Parent y < children y. Sibling x follows creation order.

## Current State

No layout algorithm exists. The BrowsingTree model from task-003 provides the tree data.

## What To Build

1. Create `src/limb/tree/TreeLayout.mjs` implementing a top-down tree layout:
   - Input: a BrowsingTree instance.
   - Output: `Map<string, { x: number, y: number }>` in logical (unit-less) coordinates.
2. Implement a Reingold-Tilford-style algorithm:
   - Root at top (y=0).
   - Children spaced horizontally below parent.
   - Subtrees shifted to avoid overlap.
   - Sibling order matches `childIds` (creation order).
3. Ensure the layout is deterministic: same tree always produces same coordinates.
4. Write tests verifying all layout invariants:
   - Every node has a position.
   - No two nodes at the same position.
   - Parent y < child y.
   - Sibling x order matches creation order.
   - Subtrees do not overlap (test with deep and wide trees).
   - Determinism: calling layout twice on the same tree produces identical output.
