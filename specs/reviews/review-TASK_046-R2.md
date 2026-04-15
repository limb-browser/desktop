# Review: Task 046 - Round 2

## Prior Findings

R1 F1 (nodeCount off-by-one): Fixed in implementation commit — `LauncherDataSource.mjs:23` now uses `node.descendantCount` uniformly.

R1 F2 (branch card click throws): Fixed in implementation commit — `limb-home.mjs:298-300` now checks `branchRoot.childIds.length === 0` before routing to `switchBranch`.

## Findings

- [ ] **F1: Search result click handler has same callee-precondition bug as R1 F2** -- The search result click handler at `limb-home.mjs:264` uses `branchRootId === tree.activeBranchId` to decide whether to call `switchBranch`. At startup, `activeBranchId` is `null`, so ALL search results fail the equality check and route to `switchBranch` → `activateBranch`. For SessionStore-restored branches that already have children in memory, `activateBranch` throws `"already has in-memory children; deactivate first"` (BrowsingTree.mjs:239-242). The branch card handler was correctly fixed (lines 298-300 check `childIds.length === 0`), but the search result handler — same file, same click listener, same bug class — was not. The handler needs the same guard: check the target branch root's `childIds.length` before deciding to call `switchBranch`. File: `src/limb/home/limb-home.mjs:264`. Spec ref: `persistence.md S2.2`.

## Verdict

FAIL (1 finding)
