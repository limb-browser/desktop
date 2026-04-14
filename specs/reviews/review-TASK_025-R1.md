# Review: Task 025 - Round 1

## Findings

- [-] **F1: `BranchInfo` missing `screenshotUrl` field (spec-type drift)** -- S2.2 requires "Screenshot thumbnail of the branch root (if available)." The `about-limb-home.mjs` `createBranchCard` reads `branch.screenshotUrl` (line 113–118), but the TypeScript `BranchInfo` type in `TimeGrouper.ts` does not declare this field, and `LauncherController.getBranches()` never populates it. If chrome code feeds `LauncherController` data to the MJS render function, screenshot thumbnails will never appear. File: `src/limb/launcher/TimeGrouper.ts:5`. Spec ref: `unified-tree.md S2.2`. [process-revision-complete] Added implementation checklist item 15 (TS/MJS coherence: shared types must be complete) and verifier target (shared type completeness).

- [-] **F2: MJS `relativeTime` missing weeks/months/years** -- The browser-rendered `relativeTime` in `about-limb-home.mjs:59-71` handles up to days but falls through to `${days} days ago` for all longer periods. A branch last visited 3 weeks ago shows "21 days ago"; one year ago shows "365 days ago". The tested TypeScript `relativeTimestamp` in `TimeGrouper.ts` correctly handles weeks, months, and years, but it is dead code (see F3). The user-facing code path is the incomplete MJS version. File: `src/limb/launcher/about-limb-home.mjs:59`. Spec ref: `unified-tree.md S2.2`. [process-revision-complete] Added implementation checklist item 15 (TS/MJS coherence: no duplicated logic) and verifier target (TS/MJS logic duplication).

- [-] **F3: Dead export `relativeTimestamp`** -- `relativeTimestamp` is exported from `TimeGrouper.ts` (line 145) but has no production consumer. It is only imported by `TimeGrouper.test.ts`. The `about-limb-home.mjs` file has its own `relativeTime` function instead. The tested code is never executed in production. File: `src/limb/launcher/TimeGrouper.ts:145`. Spec ref: N/A (dead code). [process-revision-complete] Added `scripts/check-dead-exports.sh` (detects exports only consumed by tests) and implementation checklist item 16 (dead export check).

- [-] **F4: Time-grouping tests cover unused code path** -- `TimeGrouper.test.ts` tests `groupBranchesByTime`, but the browser UI (`about-limb-home.mjs:161-193`) re-implements the grouping algorithm independently via `classifyTimestamp` and inline sorting/ordering. The tested TypeScript function is only called by `LauncherController.getTimeGroups()`, which the MJS `render` function does not use — it receives raw branches and groups them itself. The user-facing grouping logic is untested. File: `src/limb/launcher/about-limb-home.mjs:161`. Spec ref: `unified-tree.md S2.1`. [process-revision-complete] Added verifier target (test-production path alignment) and `scripts/check-dead-exports.sh` to both agent workflows.

## Verdict

FAIL (4 findings)
