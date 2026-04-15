# Review: Task 044 - Round 1

## Findings

- [-] **F1: Pan animation (`#startAnimation`/`centerOnNode`) bypasses coordinator — property fighting risk** [process-revision-complete] -- The `centerOnNode()` method starts a pan animation via `#startAnimation()` that drives `zoom.focusPoint` (and optionally `zoom.level`) entirely outside the coordinator. This animation is not registered, so the coordinator's property exclusivity guarantee does not cover it. Task step 2 states: "No two animations should drive the same property simultaneously." A concrete conflict scenario exists: user clicks a node (coordinator-managed zoom animation starts on `'zoom'` property driving `focusPoint`), then immediately presses an arrow key — `KeyboardNavigationAdapter` calls `centerOnNode()`, which starts the pan animation on the same `focusPoint`. Both animations run in `#onFrame`: the coordinator's adapter sets `focusPoint`, then the pan animation overwrites it. Additionally, `#startAnimation()` calls `this.#zoomAnimator?.cancel()` directly, bypassing the coordinator — this leaves a stale coordinator registration (cleaned up on next tick) and does not cancel a `ZoomOutAndBackAnimator` if that is the active coordinator-managed animation. Fix: register the pan animation with the coordinator (e.g., as property `'focus'` or `'zoom'`), or cancel the coordinator's active `'zoom'` animation from within `centerOnNode`/`#startAnimation`. File: `src/limb/tree/LimbTreeView.mjs:1113`. Spec ref: `interaction-feel.md S7.4`.

## Verdict

FAIL (1 finding)
