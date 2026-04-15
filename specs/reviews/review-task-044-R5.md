# Review: Task 044 - Round 5

## Findings

- [ ] **F1: `register()` unconditionally resets `#lastTickTime`, corrupting delta for concurrent animations on different properties** -- `register()` at line 63 sets `this.#lastTickTime = this.#now()` on every registration, regardless of whether other animations are already ticking. When animation A on property 'zoom' is running and animation B registers on property 'layout' between ticks, `#lastTickTime` is overwritten to B's registration time. The next `tick()` computes `deltaMs = now - lastTickTime` from B's registration, not from A's last tick. Animation A loses the time between its last tick and B's registration. Concrete trace: (1) register A at t=0, `#lastTickTime=0`; (2) tick at t=16, A gets 16ms, `#lastTickTime=16`; (3) register B at t=20, `#lastTickTime=20` (reset); (4) tick at t=36, `deltaMs = 36-20 = 16`. A gets 16ms but its real elapsed since last tick is 20ms -- it lost 4ms. The test suite's concurrent animation tests (lines 118-158, 312-327) always register both animations at the same clock time, so the staggered registration case is never exercised and the bug is invisible to tests. Fix: only reset `#lastTickTime` when no other animations are active (e.g., `if (this.#animations.size === 0 || (this.#animations.size === 1 && existing))` before the set). File: `src/limb/tree/AnimationCoordinator.mjs:63`. Spec ref: `interaction-feel.md S7.4`.

## Verdict

FAIL (1 finding)
