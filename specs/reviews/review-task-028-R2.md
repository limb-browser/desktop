# Review: Task 028 - Round 2

## Findings

- [process-revision-complete] **F1: `deactivateBranch` has no idempotency guard -- double-call causes storage data loss** -- The R1 fix correctly added idempotency guards to `activateBranch` (early return if already active, throw if children exist), but `deactivateBranch` has no equivalent guard. If called on a branch whose descendants are already removed from memory: (1) `getDescendants(branchRootId)` returns only the branch root since `childIds` is empty, (2) `storage.saveBranch()` DELETEs all existing stored nodes for the branch (InMemoryTreeStorage line 40, TreeStorage.mjs line 144) then inserts only the branch root with empty childIds, (3) the previously-stored complete subtree is permanently lost. The method should check `branchRoot.childIds.length === 0 && this.activeBranchId !== branchRootId` and early-return or throw when the branch is already deactivated. File: `src/limb/tree/BrowsingTree.ts:325`. Spec ref: `unified-tree.md S3.4`. Process fix: Added checklist item #38 (revision breadth) to implementation.md and verifier.md.

- [process-revision-complete] **F2: `activateBranch` does not restore branch root screenshot** -- The R1-F3 fix added screenshot restoration for descendant nodes, but the branch root itself is excluded from `loadedNodeIds` via the `continue` on line 280. After startup via `loadSummaries`, the branch root has `screenshot: null`. When `activateBranch` runs, the branch root's `childIds` and `descendantCount` are updated from storage, but its screenshot is never loaded. Per persistence.md S2.2 step 3 ("Restore screenshots for loaded nodes"), the branch root is part of the loaded data set and should have its screenshot restored. The branch root's screenshot should be loaded from storage either before the `continue` or via a separate load after the loop. File: `src/limb/tree/BrowsingTree.ts:276-280`. Spec ref: `persistence.md S2.2`. Process fix: Added checklist item #39 (loop-exclusion completeness) to implementation.md and verifier.md.

## Verdict

FAIL (2 findings)
