# Review: Task 023 - Round 1

## Findings

- [process-revision-complete] **F1: restoreTreeFromTabs imported but never called** -- `browser-init-js.patch` imports `restoreTreeFromTabs` (line 42-45) but never invokes it. The code still creates a hardcoded test `BrowsingTree`. Task step 4 requires "after SessionStore restores tabs, call TreeRestorer to rebuild the tree." The function is dead code in production. File: `src/browser/base/content/browser-init-js.patch:42`. Spec ref: `persistence.md S1.3`. Process fix: `scripts/check-patch-imports.sh` now catches unused imports in patch files.

- [process-revision-complete] **F2: TabCommandRouter doesn't pass tree attributes to TabBridge** -- `TabCommandRouter` is the primary production caller of `createTabForNode`, `registerExistingTab`, and `syncFocusToTab`, but never passes the new `parentId`/`createdAt` parameters. This means tabs created during normal browsing (Ctrl+T, link intercept, focus sync) will not have `limb-tree-parent-id` or `limb-tree-created-at` attributes, so they won't survive restart or crash recovery. File: `src/limb/tree/TabCommandRouter.ts:33,35,57,77,79`. Spec ref: `persistence.md S1.3`. Process fix: implementation checklist item #25 (caller completeness on signature changes) and matching verifier target.

- [process-revision-complete] **F3: TreeRestorerProbe not wired in production** -- No `TreeRestorerProbe` instance is created in `browser-init-js.patch`. Even if `restoreTreeFromTabs` were called, the probe would be `undefined`, silently dropping all observability events (`treeRestored`, `orphanedNodeReparented`, `preLimbTabAdopted`). File: `src/browser/base/content/browser-init-js.patch`. Spec ref: `persistence.md S1.3`. Process fix: downstream of F1 -- `check-patch-imports.sh` forces the import to be used, at which point existing checklist item #6 (probe wiring) applies.

- [process-revision-complete] **F4: Pre-Limb tab can hijack root selection** -- In `TreeRestorer.restore()`, `processed.find(t => t.parentId === null)` selects the first tab with null parentId as root. Pre-Limb tabs (no nodeId) are assigned `parentId: null` by `#processTabData`. If a pre-Limb tab appears before the real root in the tabs array, it becomes the root, causing the real tree structure to be reparented under a randomly-generated node. Root selection should prefer tabs that have an original nodeId over pre-Limb tabs. File: `src/limb/tree/TreeRestorer.ts:29`. Spec ref: `persistence.md S1.3`. Process fix: implementation checklist item #26 (synthesized data precedence) and matching verifier target.

## Verdict

FAIL (4 findings)
