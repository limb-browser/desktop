# Review: Task 041 - Round 1

## Findings

- [process-revision-complete] **F1: FrameScheduler exit-degraded test does not test exit** -- The test "exits degraded mode after 10 consecutive fast frames" (FrameScheduler.test.ts:408-420) only enters degraded mode and then ends. The test body contains a comment acknowledging the paint duration is hardcoded, so exit is never exercised. The only assertion (`isDegraded === true`) verifies entry, not exit. This is a test that doesn't test what it claims to test. File: `src/limb/tree/FrameScheduler.test.ts:408`. Spec ref: task-041 step 5 ("Degraded mode deactivates after consecutive fast frames"). Process fix: implementation.md item 50 (test assertion-description alignment), verifier.md (test assertion-description alignment target).

- [process-revision-complete] **F2: Animation skip uses global degraded frame count instead of per-animation frame count** -- Task step 2 says "any animation that has been running for more than 2 frames is skipped to its final state." The implementation at LimbTreeView.mjs:471 uses `this.#frameScheduler.degradedFrameCount > 2`, which counts paint frames since degraded mode entry, not frames since each animation started. An animation created 3+ frames into degraded mode is immediately skipped on its first frame (0 frames of running), violating the per-animation 2-frame threshold. Conversely, the first 2 frames of degraded mode never skip anything, even if an animation was already running for many frames before degraded mode was entered. File: `src/limb/tree/LimbTreeView.mjs:471`. Spec ref: task-041 step 2. Process fix: implementation.md item 51 (per-entity vs global state scope), verifier.md (per-entity vs global state scope target).

## Verdict

FAIL (2 findings)
