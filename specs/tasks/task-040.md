---
title: "Implement zoom-out-and-back animation on new child creation"
spec_ref: "navigation.md S1.1"
depends_on:
  - task-012
  - task-014
  - task-030
progress: ready-for-review
review: "specs/reviews/review-task-040-R1.md"
coverage_sections: []
commits: []
---

## Spec Excerpt

> When a user opens a link in a new tab (via Ctrl+click, middle-click, or right-click -> "Open in new tab"):
> ...
> 6. If currently zoomed in (`level >= 0.9`), animate a brief zoom-out-and-back to show the branching, then zoom into the new node.

## Current State

Link interception (task-012) creates child nodes for new-tab links. Click-to-focus (task-014) provides zoom animation infrastructure. But when a new child is created while zoomed in, the tree silently adds the node and focuses it — there is no visual indication of the branching to the user.

## What To Build

1. Hook into the child-creation flow (from task-012's link interception):
   - After `addChild` creates the new node, check if `zoomLevel >= 0.9`.
   - If zoomed in, trigger the zoom-out-and-back animation instead of an instant focus change.
2. Implement the zoom-out-and-back choreography:
   - Phase 1 (zoom out): Animate from current level (~1.0) to an intermediate level where both the parent and new child are visible (~0.6-0.7, computed from their positions). Duration: ~200ms, ease-out.
   - Phase 2 (hold): Brief pause at the intermediate level so the user sees the new branch. Duration: ~150ms.
   - Phase 3 (zoom in): Animate from intermediate level to 1.0 centered on the new child node. Duration: ~250ms, ease-out.
   - Total duration: ~600ms.
3. During the animation, the tree layout should update to show the new node (the add-node animation from task-030 plays concurrently with the zoom-out phase).
4. If the user initiates any input (scroll, click) during the animation, cancel and jump to the final state (zoomed into the new child).
5. Skip the animation when `zoomLevel < 0.9` (the user is already seeing the tree, so just focus the new node normally).
6. Write tests for:
   - Animation triggers when a child is created at zoom >= 0.9.
   - Animation does not trigger when zoom < 0.9.
   - Animation zooms out far enough to show both parent and child.
   - User input cancels the animation.
   - Final state is zoomed into the new child at level 1.0.
