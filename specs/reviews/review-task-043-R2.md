# Review: Task 043 - Round 2

## Findings

- [ ] **F1: Missing timestamp reset before pan momentum start** -- In `#onMouseUp`, when pan momentum starts, `this.#animationLastTime` is not reset to `performance.now()` before calling `markDirty()`. If the user pauses mid-drag (holds the mouse still), no frames are scheduled and `#animationLastTime` freezes at the time of the last drag frame. On release, the first momentum frame computes `deltaMs = now - staleAnimationLastTime`, which can be hundreds of milliseconds. This applies that entire duration of displacement and decay in a single frame -- a visual jump. Compare with `#scheduleMomentumRelease()` (line 596) which correctly resets `this.#animationLastTime = performance.now()` before `markDirty()` for zoom momentum. The fix is to add `this.#animationLastTime = performance.now();` before line 524. File: `src/limb/tree/LimbTreeView.mjs:524`. Spec ref: `interaction-feel.md S7.1`.

- [ ] **F2: Drag samples not expired by wall-clock time at release** -- `PanMomentum.release()` computes velocity from accumulated samples without checking their wall-clock age. The sample trimming in `recordDrag()` only runs when new samples are added. If the user drags (recording 3 samples over 48ms), then holds the mouse still for 2+ seconds and releases, those 48ms-old samples are still present because no new `recordDrag` call triggered trimming. `release()` computes a non-zero velocity from them and starts momentum -- despite the user visually having stopped. The fix: in `release()`, before computing velocity, check whether the time since the last recorded sample exceeds `SAMPLE_WINDOW_MS` and clear samples if so (this requires either tracking wall-clock timestamps per sample or receiving a `now` parameter). File: `src/limb/tree/PanMomentum.mjs:120`. Spec ref: task description ("Track pan velocity... from recent drag events").

## Verdict

FAIL (2 findings)
