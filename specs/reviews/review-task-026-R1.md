# Review: Task 026 - Round 1

## Findings

- [process-revision-complete] **F1: Missing CSS for delete button — no hover-reveal behavior** — The delete button `.branch-delete` is created in `limb-home.mjs` but `limb-home.css` has no `.branch-delete` selector. The button renders unstyled and is always visible. The spec and task both require "hover-reveal or right-click context menu" but neither is implemented — the button lacks hide-on-idle / show-on-hover CSS and no context menu exists. File: `src/limb/home/limb-home.css`. Spec ref: `unified-tree.md S2.4`. **Process fix:** Added `scripts/check-css-class-coverage.sh` (catches CSS classes assigned in `.mjs` with no selector in `.css`) and checklist item #31 in implementation prompt.

- [process-revision-complete] **F2: Restored tabs not registered with TabBridge** — The patch creates a fresh `TabBridge(new FirefoxTabPort(gBrowser))` but does not register the tabs already present from `restoreTreeFromTabs`. When `deleteBranch` is called for an existing (restored) branch, `bridge.onNodeRemoved()` silently skips closing tabs because `nodeToTab` has no entries for them. The most common deletion scenario (deleting a branch from a previous session) leaves orphaned Firefox tabs open. File: `src/browser/base/content/browser-init-js.patch:92`. Spec ref: task-026 requirement "TabBridge closes all associated tabs". **Process fix:** Added checklist item #33 (adapter initialization completeness) in implementation prompt and corresponding verifier target.

- [process-revision-complete] **F3: Unused import `AutoSaveProbe` in test** — `AutoSaveProbe` is imported but never referenced. Dead code. File: `src/limb/tree/BranchCommandRouter.test.ts:13`. **Process fix:** Added `scripts/check-unused-imports.sh` (catches unused imports in `.ts` files including test files) and checklist item #32 in implementation prompt.

- [process-revision-complete] **F4: Duplicate `setupWithBranchRouter()` call in test** — `setupWithBranchRouter()` is called twice with the first result discarded, leaking a second adapter+listener pair. File: `src/limb/tree/KeyboardNavigationAdapter.test.ts:485`. **Process fix:** Added checklist item #34 (test setup hygiene) in implementation prompt and corresponding verifier target.

## Verdict

FAIL (4 findings)
