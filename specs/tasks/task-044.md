---
title: "Implement animation coordination layer"
spec_ref: "interaction-feel.md S7.4"
depends_on:
  - task-022
  - task-014
progress: complete
review: "specs/reviews/review-task-044-R6.md"
coverage_sections: []
commits: []
---

## Spec Excerpt

> When multiple animations run concurrently (e.g., zoom + focus + LOD transitions):
> - All animations must use the same time source.
> - Animations must not fight each other. If zoom is animating toward a target and the user starts a new zoom gesture, the new gesture takes priority immediately.
> - Completed animations must clean up: no residual callbacks, no stale interpolation state.

## Current State

FrameScheduler (task-022) manages the demand-driven frame loop. Click-to-focus (task-014) introduces the first zoom animation. Subsequent tasks add more animation systems: layout animation (task-030), zoom-out reveal (task-038), zoom-out-and-back (task-040). Each animation manages its own state independently with no shared coordination. Frame budget enforcement (task-041) adds skip-to-end but does not address coordination between concurrent animations.

## What To Build

1. Create `src/limb/tree/AnimationCoordinator.mjs`:
   - Central registry for all active animations.
   - Provides a shared time source (`performance.now()`) that all animations reference for consistent timing.
   - Each animation registers with the coordinator when it starts and unregisters when it completes.
2. Implement cancellation priority:
   - Define priority rules: user input (scroll, click, drag) cancels any programmatic animation (zoom-to-focus, zoom-out-and-back).
   - When a new animation targets the same property (e.g., zoom level or focus point) as an active animation, the active animation is cancelled and the new one takes over.
   - No two animations should drive the same property simultaneously.
3. Implement cleanup guarantees:
   - On animation completion or cancellation, remove all residual state: cancel pending `requestAnimationFrame` callbacks, clear interpolation state, release references.
   - Provide a `cancelAll()` method for edge cases (e.g., tree mutation during animation).
4. Integrate with FrameScheduler:
   - The coordinator ticks all active animations on each frame using the shared time source.
   - When all animations complete, stop calling `markDirty()` (let the frame loop go idle).
5. Refactor existing animation code (task-014's zoom animation) to use the coordinator:
   - Register zoom animations with the coordinator.
   - Use the shared time source instead of independent `performance.now()` calls.
6. Write tests for:
   - Two animations on the same property: first is cancelled when second starts.
   - Animations on different properties run concurrently without interference.
   - User input cancels programmatic animations.
   - Completed animations are fully cleaned up (no residual callbacks).
   - `cancelAll()` stops all active animations.
   - Shared time source is consistent across concurrent animations.
