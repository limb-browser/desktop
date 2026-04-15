---
title: "Implement tree navigation keyboard shortcuts"
spec_ref: "navigation.md S4.1 S4.2 S4.3"
depends_on:
  - task-009
  - task-007
progress: needs-revision
review: "specs/reviews/review-task-019-R1.md"
coverage_sections: []
commits: []
---

## Spec Excerpt

> | Shortcut | Action |
> |---|---|
> | `Alt + Up` | Focus parent node |
> | `Alt + Down` | Focus first child node |
> | `Alt + Left` | Focus previous sibling |
> | `Alt + Right` | Focus next sibling |
> | `Ctrl + 0` | Reset zoom to fit entire tree |
> | `Ctrl + 1` | Zoom to 100% on focused node |
> | `Escape` | When address bar focused: return focus to page. When zoomed out: zoom to focused node. |
>
> These tree navigation shortcuts work at any zoom level. After focusing, if `level >= 0.9`, the view animates to center on the new focused node.

## Current State

Focus sync (task-009) exists but no keyboard shortcuts navigate the tree structure. Firefox's default keyboard shortcuts are active.

## What To Build

1. Register keyboard event listeners for tree navigation:
   - `Alt+Up`: call `tree.focusNode(tree.nodes.get(focusedNodeId).parentId)` if parent exists.
   - `Alt+Down`: call `tree.focusNode(firstChildId)` if focused node has children.
   - `Alt+Left`: focus previous sibling in parent's `childIds`.
   - `Alt+Right`: focus next sibling in parent's `childIds`.
2. Register zoom shortcuts:
   - `Ctrl+0`: set zoom to fit entire tree in viewport.
   - `Ctrl+1`: animate zoom to 1.0 centered on focused node.
3. Handle `Escape`:
   - If address bar is focused: return focus to page content.
   - If zoomed out (`level < 0.9`): animate zoom to focused node (same as Ctrl+1).
4. After tree navigation focus change: if `level >= 0.9`, smoothly animate viewport to center on the newly focused node.
5. Write tests for:
   - Each shortcut focuses the correct node.
   - Edge cases: Alt+Up on root (no-op), Alt+Down on leaf (no-op).
   - Ctrl+0 fits entire tree.
   - Escape behavior depends on context.
