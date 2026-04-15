# Review: Task 033 - Round 1

## Findings

- [ ] **F1: Inactive branch root clicks skip branch loading** -- Both click handlers (`limb-search.mjs:153` and `limb-home.mjs:258`) use `tree.nodes.has(nodeId)` to decide whether to focus directly vs. call `switchBranch`. Branch roots of inactive branches are always kept in memory (unified-tree.md S3.2: "Inactive branches: Branch root only"), so this check passes, causing the code to focus and zoom without loading the branch subtree. The user sees a branch root with no children. The spec says "Clicking a result loads that branch and focuses the node." The correct check should use `tree.activeBranchId` to determine whether `switchBranch` is needed. File: `src/limb/search/limb-search.mjs:153`. File: `src/limb/home/limb-home.mjs:258`. Spec ref: `unified-tree.md S5.2`.

- [ ] **F2: Launcher page SearchService missing probe** -- `limb-home.mjs:207` constructs `new SearchService(tree, storage)` without a probe. The dedicated search page (`limb-search.mjs:108`) passes a probe. SearchService accepts an optional probe and fires `searchExecuted` on every query -- without a probe, the launcher silently drops observability data. File: `src/limb/home/limb-home.mjs:207`. Spec ref: probe wiring guideline.

## Verdict

FAIL (2 findings)
