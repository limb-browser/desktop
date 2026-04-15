# Review: Task 025 - Round 1

## Findings

- [x] **F1: limb-home.css leaks global styles into browser chrome** [verifier-fixed] -- `zen-assets.inc.xhtml` loads `limb-home.css` into the browser chrome, but this CSS contains `* { margin: 0; padding: 0; }` and `:root` custom properties that affect the main browser UI. The CSS is already correctly loaded via the about: page's own `<link>` tag in `limb-home.html:9`. Removed from `zen-assets.inc.xhtml`. File: `src/browser/base/content/zen-assets.inc.xhtml:28`. Spec ref: patch-strategy.md.

- [ ] **F2: Missing screenshot thumbnail in branch cards** [process-revision-complete] -- Spec S2.2 requires "Screenshot thumbnail of the branch root (if available)" but `BranchCard` interface has no screenshot field, and `createBranchCard()` in `limb-home.mjs` never creates a thumbnail element. File: `src/limb/home/LauncherDataSource.ts:10-16`, `src/limb/home/limb-home.mjs:31-75`. Spec ref: `unified-tree.md S2.2`.

- [ ] **F3: Missing "Older" month sub-grouping** [process-revision-complete] -- Spec S2.1 says the Older group should be "sub-grouped by month: 'March 2026', etc." but the implementation uses a flat `'Older'` group with no month subdivision. `TimeGroup` type is `'Today' | 'Yesterday' | 'This Week' | 'This Month' | 'Older'` with no month-level granularity. File: `src/limb/home/TimeGrouper.ts:5`. Spec ref: `unified-tree.md S2.1`.

- [x] **F4: Dead code -- unused `daysAgo` function** [verifier-fixed] -- `TimeGrouper.test.ts:11` defines `daysAgo()` helper but no test calls it. Removed. File: `src/limb/home/TimeGrouper.test.ts:11`.

- [x] **F5: Dead CSS -- `.branch-thumbnail` rules never applied** [verifier-fixed] -- `limb-home.css:147-154` defines styles for `.branch-thumbnail` but no element ever receives this class (consequence of F2). Removed dead CSS. File: `src/limb/home/limb-home.css:147-154`.

## Verdict

FAIL (2 findings: F2, F3)
