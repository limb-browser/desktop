# Review: Task 040 - Round 1

## Findings

- [process-revision-complete] **F1: childAdded callback does not focus the child node** -- The `childAdded` callback in `browser-init-js.patch` calls `branchFoldAdapter.updateLayout()` then `playZoomOutAndBack(parentId, childId)`. At the time `childAdded` fires (inside `BrowsingTree.addChild`), `browsingTree.focusedNodeId` is still the parent. `updateLayout()` passes this stale parent ID to `setTreeData()`, so `LimbTreeView.#focusedNodeId` remains the parent throughout and after the 600ms animation. The `nodeFocused` callback is a no-op, so the subsequent `focusNode(childId)` call in `TabCommandRouter` never propagates to the view. Consequences: focus ring renders on the parent, LOD tiers are computed relative to the parent, and tab positioning uses the parent as focused. When `zoomLevel < 0.9` the animation is skipped but normal focus (e.g., `centerOnNode` or `animateToNode`) is also missing -- the task says "just focus the new node normally" in this case. File: `src/browser/base/content/browser-init-js.patch:72`. Spec ref: `navigation.md S1.1` steps 5-6.

- [process-revision-complete] **F2: Missing zoom-threshold tests** -- Task item 6 requires tests for "Animation triggers when a child is created at zoom >= 0.9" and "Animation does not trigger when zoom < 0.9." The threshold check at `LimbTreeView.playZoomOutAndBack():335` (`if (this.#zoom.level < 0.9) return`) has no test coverage. The test file only covers `ZoomOutAndBackAnimator` (the animation engine) and `computeIntermediateZoomLevel`, not the gating logic in `playZoomOutAndBack`. File: `src/limb/tree/ZoomOutAndBackAnimator.test.ts`. Spec ref: `navigation.md S1.1` step 6.

## Verdict

FAIL (2 findings)
