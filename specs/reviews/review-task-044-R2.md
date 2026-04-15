# Review: Task 044 - Round 2

## Findings

- [-] **F1: Coordinator cancel handler double-cancels re-registered animations** [process-revision-complete] -- When a new animation is registered on property `'zoom'` while one is already active, `coordinator.register()` cancels the old registration by calling its `cancel()` handler. All three registration methods (`#registerZoomAnimation`, `#registerZoomOutAndBackAnimation`, `#registerPanAnimation`) create cancel handlers that close over the same shared mutable object (`this.#zoomAnimator`, `this.#zoomOutAndBackAnimator`, or `this.#animation`). Because callers start the animator *before* calling the register method (e.g., `this.#zoomAnimator.start(...)` then `this.#registerZoomAnimation()`), the old registration's cancel handler cancels the *newly-started* animation. Concrete trace for click-to-focus: (1) `#handleClickToFocus` calls `this.#zoomAnimator.start(...)` -- sets `#active = true`; (2) calls `#registerZoomAnimation()` which calls `coordinator.register('zoom', ...)`; (3) coordinator cancels the old `'zoom'` registration -- old cancel handler calls `zoomAnimator.cancel()` on the same `this.#zoomAnimator` instance -- sets `#active = false`; (4) new registration ticks -- `zoomAnimator.update()` returns `null` (`#active` is false) -- animation immediately completes without running. Result: camera freezes mid-animation. Same bug in `animateToNode` (Ctrl+1 / Escape), consecutive `centerOnNode` calls (keyboard navigation pan), and consecutive `playZoomOutAndBack` calls. Pre-task-044, `#startAnimationLoop()` did not interact with any cancel mechanism, so this is a regression. File: `src/limb/tree/LimbTreeView.mjs:554`. Spec ref: `interaction-feel.md S7.4`.

## Verdict

FAIL (1 finding)
