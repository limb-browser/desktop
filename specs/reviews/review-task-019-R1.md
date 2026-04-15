# Review: Task 019 - Round 1

## Findings

- [ ] **F1: Focused node ID not synced to LimbTreeView after keyboard navigation** -- `KeyboardNavigationAdapter` calls `TreeNavigator.focusParent()` (etc.) which updates `BrowsingTree.focusedNodeId`, then calls `LimbTreeView.centerOnNode(newNodeId)`. But `centerOnNode()` only moves the viewport focus point -- it does not update `LimbTreeView.#focusedNodeId`. This field drives both the focus ring (via `computeFrame`) and LOD tier computation (via `computeTiers`). After any Alt+Arrow navigation, the focus ring stays on the old node and LOD tiers are computed relative to the old node. Fix: add a `setFocusedNodeId(id)` method to `LimbTreeView` and call it from the adapter before `centerOnNode`. File: `src/limb/tree/LimbTreeView.mjs:162`. Spec ref: `navigation.md S4.3`.

- [ ] **F2: Viewport centering snaps instead of animating** -- Spec S4.3 says "the view animates to center on the new focused node." The task's "What To Build" item 4 says "smoothly animate viewport to center." `LimbTreeView.centerOnNode()` sets `#zoom.focusPoint` directly and calls `#paint()` -- an instant snap with no interpolation or animation loop. Same issue applies to Ctrl+1 and Escape zoom-in. File: `src/limb/tree/LimbTreeView.mjs:162`. Spec ref: `navigation.md S4.3`.

## Verdict

FAIL (2 findings)
