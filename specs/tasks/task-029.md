---
title: "Implement node add/remove layout animations"
spec_ref: "interaction-feel.md S4"
depends_on:
  - task-006
  - task-004
progress: not-started
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> Node Addition: 1. Parent's subtree shifts to make room (200ms, ease-in-out). 2. New node fades in from 0% opacity (150ms, ease-out, starting 100ms after shift). 3. Edge draws in from parent to child (200ms, ease-out).
>
> Node Removal: 1. Node and subtree fade out (150ms). 2. Edge fades simultaneously. 3. Siblings shift to fill gap (200ms, ease-in-out, after fade).
>
> Batch changes: all animations play concurrently. Total time <= 400ms.

## Current State

Tree rendering (task-006) and layout (task-004) work but layout changes are instantaneous. Adding or removing a node snaps the tree to its new positions.

## What To Build

1. Create `src/limb/tree/LayoutAnimator.mjs`:
   - Tracks previous layout positions for each node.
   - When layout changes, interpolates from old positions to new positions over time.
   - Supports per-node opacity animation (fade in/out for add/remove).
2. Implement node addition animation:
   - Store old positions before layout recomputation.
   - After layout, animate existing nodes from old to new positions (200ms, ease-in-out).
   - New node fades in from opacity 0 (150ms, ease-out, 100ms delay).
   - New edge animates by drawing progressively from parent to child (200ms).
3. Implement node removal animation:
   - Removed node fades out (150ms).
   - Edge fades simultaneously.
   - After fade, remaining nodes animate to new positions (200ms, ease-in-out).
4. Handle batch changes: if multiple nodes change in one frame, animate all concurrently. Cap total animation at 400ms.
5. Integrate with FrameScheduler: animations call `markDirty()` each frame until complete.
6. Write tests for:
   - Positions interpolate smoothly from old to new.
   - New nodes fade in with correct delay.
   - Removed nodes fade out before siblings shift.
   - Batch animations complete within 400ms.
