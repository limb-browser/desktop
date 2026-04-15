# Review: Task 023 - Round 1

## Findings

- [ ] **F1: restoreTreeFromTabs imported but never called** -- `browser-init-js.patch` imports `restoreTreeFromTabs` (line 42-45) but never invokes it. The code still creates a hardcoded test `BrowsingTree`. Task step 4 requires "after SessionStore restores tabs, call TreeRestorer to rebuild the tree." The function is dead code in production. File: `src/browser/base/content/browser-init-js.patch:42`. Spec ref: `persistence.md S1.3`.

- [ ] **F2: TabCommandRouter doesn't pass tree attributes to TabBridge** -- `TabCommandRouter` is the primary production caller of `createTabForNode`, `registerExistingTab`, and `syncFocusToTab`, but never passes the new `parentId`/`createdAt` parameters. This means tabs created during normal browsing (Ctrl+T, link intercept, focus sync) will not have `limb-tree-parent-id` or `limb-tree-created-at` attributes, so they won't survive restart or crash recovery. File: `src/limb/tree/TabCommandRouter.ts:33,35,57,77,79`. Spec ref: `persistence.md S1.3`.

- [ ] **F3: TreeRestorerProbe not wired in production** -- No `TreeRestorerProbe` instance is created in `browser-init-js.patch`. Even if `restoreTreeFromTabs` were called, the probe would be `undefined`, silently dropping all observability events (`treeRestored`, `orphanedNodeReparented`, `preLimbTabAdopted`). File: `src/browser/base/content/browser-init-js.patch`. Spec ref: `persistence.md S1.3`.

- [ ] **F4: Pre-Limb tab can hijack root selection** -- In `TreeRestorer.restore()`, `processed.find(t => t.parentId === null)` selects the first tab with null parentId as root. Pre-Limb tabs (no nodeId) are assigned `parentId: null` by `#processTabData`. If a pre-Limb tab appears before the real root in the tabs array, it becomes the root, causing the real tree structure to be reparented under a randomly-generated node. Root selection should prefer tabs that have an original nodeId over pre-Limb tabs. File: `src/limb/tree/TreeRestorer.ts:29`. Spec ref: `persistence.md S1.3`.

## Verdict

FAIL (4 findings)
