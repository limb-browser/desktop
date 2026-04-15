# Review: Task 036 - Round 3

## Prior Findings

- [x] **R1-F1: Live-to-Screenshot cross-fade never applied to DOM** [fixed] -- `#applyTabPositions` now checks `posFrame.crossFades` before hiding a node; elements with active to-screenshot cross-fades remain visible at fading opacity.
- [x] **R1-F2: `setTabBridge` type annotation omits required `nodeToTab` property** [fixed] -- JSDoc type at line 142 now includes `nodeToTab: Map<string, any>`, matching runtime usage.

## Findings

- [x] **F1: Cross-fade animation freezes when no other animation drives the frame loop** [verifier-fixed] -- `TabPositioner.computeFrame()` produces cross-fade opacity values over 150ms, but `#paint()` never called `this.#frameScheduler?.markDirty()` when `posFrame.crossFades.size > 0`. The `FrameScheduler` only calls `#paint()` on dirty frames; idle frames skip painting entirely. Fixed by adding `if (posFrame.crossFades.size > 0) this.#frameScheduler?.markDirty();` after `#applyTabPositions()`. File: `src/limb/tree/LimbTreeView.mjs:770`. Spec ref: `interaction-feel.md S7.1`.

## Verdict

PASS (1 finding, verifier-fixed)
