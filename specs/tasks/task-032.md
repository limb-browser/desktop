---
title: "Implement branch folding at root level"
spec_ref: "unified-tree.md S4"
depends_on:
  - task-006
progress: ready-for-review
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> When zoomed out to see all branches:
> - Recent branches (last 7 days): shown as normal tree nodes, left-to-right by recency.
> - Older branches: collapsed into a fold node showing a count (e.g., "142 older branches").
>
> Fold nodes render as a rounded rectangle with a stacked-cards appearance and a label like "Mar 2026 (23 branches)".
>
> Clicking a fold node expands them.

## Current State

Tree rendering (task-006) draws all nodes the same way. No concept of fold nodes or collapsed groups at the root level.

## What To Build

1. Extend the layout and rendering to support fold nodes:
   - When computing layout at the root level, group branches older than 7 days by month.
   - Replace each month's branches with a single "fold node" in the layout.
   - Fold node has a synthetic ID and metadata (month label, branch count).
2. Implement fold node rendering:
   - Draw as a rounded rectangle with a stacked-cards visual (2-3 overlapping rectangles offset by a few pixels).
   - Label: "Mar 2026 (23 branches)" format.
3. Implement fold node interaction:
   - Clicking a fold node expands it: replace the fold node with individual branch nodes.
   - Animate the expansion (fold node splits into individual cards).
   - Optionally allow re-folding.
4. Ensure fold/unfold does not affect the in-memory tree — only the visual representation.
5. Write tests for:
   - Branches older than 7 days are folded.
   - Fold node displays correct month and count.
   - Clicking a fold node expands it to show individual branches.
   - Recent branches are not folded.
