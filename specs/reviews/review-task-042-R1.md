# Review: Task 042 - Round 1

## Findings

- [ ] **F1: Stale `#animationLastTime` causes visual jump on first momentum frame** -- When `#scheduleMomentumRelease` fires ~150ms after the last scroll event, it calls `onRelease()` then `markDirty()` but does not reset `#animationLastTime`. The last frame rendered during the scroll gesture set `#animationLastTime` ~150ms prior. The first momentum frame computes `deltaMs = now - #animationLastTime ~ 166ms`, applying ~10 frames' worth of zoom delta in a single frame. For a typical release velocity of 0.0025 zoom-units/ms, this is a ~0.25 zoom-level jump in one frame -- a clear visual discontinuity. Fix: add `this.#animationLastTime = performance.now();` before `this.#frameScheduler?.markDirty()` in the release callback. File: `src/limb/tree/LimbTreeView.mjs:531`. Spec ref: `interaction-feel.md S7.1`.

- [ ] **F2: Clamping tests don't test clamping** -- The describe block "zoom level remains clamped during momentum" (line 188) has tests that only assert delta sign (`toBeGreaterThan(0)` / `toBeLessThan(0)`). `ZoomMomentum.update()` returns raw, unclamped deltas -- actual clamping is in `ZoomState.setLevel()`. The tests don't exercise momentum behavior at zoom boundaries (e.g., momentum pushing past 1.0 or below 0.0). The task requires a test for "Zoom level remains clamped during momentum" but no test verifies boundary clamping. File: `src/limb/tree/ZoomMomentum.test.ts:188`. Spec ref: `interaction-feel.md S1.1`.

## Verdict

FAIL (2 findings)
