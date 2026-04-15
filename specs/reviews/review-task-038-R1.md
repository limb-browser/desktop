# Review: Task 038 - Round 1

## Findings

- [-] **F1: Missing opacity transition for appearing nodes (S7.1 violation)** [process-revision-complete] -- The reveal animation scales nodes from 90% to 100% over 150ms but includes no opacity transition. S7.1 requires: "No element should appear or disappear without an opacity transition of at least 100ms." During zoom-out, nodes transition from not-rendered (0% opacity) to fully opaque in a single frame, with only a scale cushion. `RevealAnimator.update()` should return an opacity value alongside scale, and `LimbTreeView.#paint()` should apply it via `ctx.globalAlpha`. S7.1 permits linear interpolation for opacity fades. File: `src/limb/tree/RevealAnimator.mjs:114`. Spec ref: `interaction-feel.md S7.1`.

## Verdict

FAIL (1 finding)
