# Review: Task 028 - Round 1

## Findings

- [ ] **F1: `activateBranch` has no precondition guards** -- The method does not check whether the branch is already active (`this.activeBranchId === branchRootId`) or whether the branch root already has in-memory children (`branchRoot.childIds.length > 0`). Calling `activateBranch` twice on the same branch adds `storedNodes.length - 1` to `root.descendantCount` each time, inflating the count. Calling it on a branch that already has in-memory children overwrites `branchRoot.childIds` from storage, orphaning the existing children in the nodes map while also double-counting in `root.descendantCount`. The method must self-enforce its invariants rather than relying on `switchBranch` to pre-check. File: `src/limb/tree/BrowsingTree.ts:238`. Spec ref: `unified-tree.md S3.2`.

- [ ] **F2: `activateBranch` corrupts `root.descendantCount` when storage returns empty** -- When `storage.loadBranch()` returns an empty array (branch was never saved to storage), `storedNodes.length - 1` evaluates to `-1`. Line 281 then decrements `root.descendantCount` by 1 (`root.descendantCount += -1`). This corrupts the count. The method should handle the empty-result case (e.g., early return or guard `loadedDescendants` to be non-negative). File: `src/limb/tree/BrowsingTree.ts:279-281`. Spec ref: `persistence.md S2.2`.

- [ ] **F3: Missing screenshot restoration during branch activation** -- Spec unified-tree.md S3.3 step 3 and persistence.md S2.2 step 3 both require "Restore screenshots for loaded nodes" during branch activation. The `activateBranch` method loads the subtree but does not restore screenshots. The deactivation side correctly frees screenshots via `storage.deleteScreenshots()` in `switchBranch`, but the activation side has no corresponding restore call. File: `src/limb/tree/BrowsingTree.ts:238-285`. Spec ref: `unified-tree.md S3.3`, `persistence.md S2.2`.

## Verdict

FAIL (3 findings)
