# Review: Task 033 - Round 2

## Findings

- [x] **F1: `gLimbTreeStorage` never exposed on window** [verifier-fixed] -- `browser-init-js.patch:109` creates `const treeStorage = new TreeStorage()` but never assigns it to `window.gLimbTreeStorage`. Both `limb-search.mjs:99` and `limb-home.mjs:205` reference `chromeWindow.gLimbTreeStorage ?? null`, which resolves to `null`. This means `SearchService` is always constructed with `null` storage, so stored nodes from inactive branches are never searched. Additionally, the click handler's branch-activation path (`if (nodeId && branchRootId && storage)`) never fires because `storage` is null. Search across inactive branches is entirely dead in production. Fixed by adding `window.gLimbTreeStorage = treeStorage;` to the patch. File: `src/browser/base/content/browser-init-js.patch:109`. Spec ref: `persistence.md S5`, `unified-tree.md S5.2`.

## Verdict

PASS (1 finding, verifier-fixed)
