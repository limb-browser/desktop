# Review: Task 028 - Round 3

## Findings

- [ ] **F1: `switchBranch` deletes screenshots from persistent storage, contradicting S4.2 retention policy** -- `switchBranch` calls `storage.deleteScreenshots(descendantIds)` (line 414), permanently removing descendant screenshots from persistent storage. This contradicts `persistence.md S4.2` which specifies "Last 7 days: All screenshots kept" with "Eviction runs on startup and hourly" — screenshot cleanup is a separate eviction process, not part of branch switching. The spec term "Free screenshots" (`unified-tree.md S3.4` step 3) is in the context of memory management (step 2 says "Remove descendants from memory"), and in-memory screenshots are already released when `deactivateBranch` removes descendant nodes from the Map. The storage deletion makes screenshots unrestorable: when the user switches back, `activateBranch` calls `storage.loadScreenshot()` which returns null because the data was deleted. File: `src/limb/tree/BrowsingTree.ts:414`. Spec ref: `persistence.md S4.2`, `unified-tree.md S3.4`.

## Verdict

FAIL (1 finding)
