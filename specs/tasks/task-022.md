---
title: "Implement demand-driven frame loop"
spec_ref: "performance.md S3.3"
depends_on:
  - task-007
progress: ready-for-review
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> The frame loop should NOT run at unconditional 60fps. Instead:
> - Run frames only when something changed (zoom, pan, animation, tree mutation).
> - After 30 idle frames (~500ms), stop scheduling frames entirely.
> - Resume on input events or state changes via a `markDirty()` call.

## Current State

LimbTreeView paints on explicit calls (resize, init) but there's no frame loop. Zoom and pan (task-007, task-016) trigger repaints directly. There's no unified frame scheduling.

## What To Build

1. Create `src/limb/tree/FrameScheduler.mjs`:
   - `markDirty()` — signals that a repaint is needed.
   - Internally uses `requestAnimationFrame` to schedule the next paint.
   - Tracks consecutive idle frames (no dirty flag set).
   - After 30 idle frames, stop scheduling `requestAnimationFrame` entirely.
   - Resume scheduling on next `markDirty()` call.
2. Integrate with LimbTreeView:
   - All state changes (zoom, pan, tree mutation, animation tick) call `markDirty()` instead of painting directly.
   - The frame scheduler calls the paint function when a frame is needed.
3. Integrate with momentum and animation systems: ongoing animations call `markDirty()` each frame until complete.
4. Write tests for:
   - Frame loop runs when dirty.
   - Frame loop stops after 30 idle frames.
   - `markDirty()` resumes the loop.
   - No frames are scheduled when nothing has changed.
