# Review: Task 044 - Round 4

## Findings

- [process-revision-complete] **F1: Degraded mode skip-to-end for pan animation does not cancel coordinator, so coordinator tick overwrites final state** -- The degraded-mode skip-to-end code (lines 793-800) handles the pan animation by setting `zoom.focusPoint` to `this.#animation.endFocus` and then `this.#animation = null`. However, the coordinator's `'zoom'` registration for the pan adapter remains active. The pan adapter's `tick()` closure captured a reference to the animation object at registration time (`const anim = this.#animation` at line 708). When `this.#coordinator?.tick()` executes at line 812, the adapter uses the captured `anim` (still a valid object despite `this.#animation` being null) to compute an intermediate focus point and overwrites `zoom.focusPoint`, defeating the skip-to-end. For `ZoomAnimator` and `ZoomOutAndBackAnimator`, the degraded code calls `skipToEnd()` / `cancel()` which sets `#active = false`; the adapter's next `update()` returns `null` and self-terminates without changing state. The pan adapter has no such guard -- it unconditionally computes and applies state from the captured `anim`. Concrete trace: (1) `centerOnNode` registers pan animation via `#registerPanAnimation`; (2) 3+ frames pass in degraded mode; (3) degraded code jumps `focusPoint` to end, nulls `this.#animation`; (4) `coordinator.tick()` calls pan adapter `tick(deltaMs)`, which accumulates `elapsed += deltaMs` (~64ms), computes `rawT = 64/300 = 0.21`, sets `focusPoint` to ~38% interpolated -- overwriting the end state; (5) adapter continues ticking for ~250ms more, visually undoing the skip. File: `src/limb/tree/LimbTreeView.mjs:793`. Spec ref: `interaction-feel.md S6`.

## Verdict

FAIL (1 finding)
