# Review: Task 046 - Round 1

## Findings

- [process-revision-complete] **F1: nodeCount off-by-one between active and summary branches** -- Active branches use `getDescendants(id).length` which includes the node itself (descendantCount + 1). Summary branches use `descendantCount` which excludes the node itself. The same branch shows a different page count depending on whether it's active or stored. For example, a branch with 2 children shows "3 pages" when active but "2 pages" when loaded from storage. The spec defines node count as `descendantCount` (unified-tree.md S1.3); both paths should use `node.descendantCount` consistently. File: `src/limb/home/LauncherDataSource.mjs:25-27`. Spec ref: `unified-tree.md S1.3, S2.2`. Process fix: added checklist item 58 (dual-path value equivalence) to implementation.md and verifier.md.

- [process-revision-complete] **F2: Clicking SessionStore-restored branch throws** -- The click handler uses `branchRootId !== tree.activeBranchId` to decide whether to call `switchBranch`. At startup, `activeBranchId` is `null` (TreeRestorer never sets it), so ALL branches appear inactive -- including SessionStore-restored ones that have children in memory. `activateBranch` (BrowsingTree.mjs:239-243) throws `"already has in-memory children; deactivate first"` when `branchRoot.childIds.length > 0`. The click handler should additionally check that the branch root has no loaded children (e.g., `node.childIds.length === 0`) before routing to `switchBranch`. File: `src/limb/home/limb-home.mjs:297-298`. Spec ref: `persistence.md S2.2`. Process fix: expanded checklist item 43 (branch activation state detection) to cover `activeBranchId === null` startup state; added checklist item 59 (callee precondition verification) to both prompts.

## Verdict

FAIL (2 findings)
