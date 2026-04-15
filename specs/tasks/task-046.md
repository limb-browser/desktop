---
title: "Wire launcher to Places storage for inactive branch display"
spec_ref: "persistence.md S2.1; unified-tree.md S2"
depends_on:
  - task-025
  - task-027
  - task-028
progress: complete
review: "specs/reviews/review-TASK_046-R3.md"
coverage_sections: []
commits: []
---

## Spec Excerpt

> **persistence.md S2.1 Startup Load:**
> 1. Load root node and branch root summaries (immediate children
>    of root).
> 2. Display launcher with branch cards.
> 3. Do NOT load full branch subtrees yet.

> **unified-tree.md S2.1 Layout:**
> Branch cards show: favicon (or globe icon fallback), branch name
> (bold), node count in muted text (e.g., "12 pages"), relative
> timestamp (e.g., "2 hours ago"), screenshot thumbnail of branch
> root (if available). Clicking focuses branch's root node and
> zooms in.

> **unified-tree.md S2.2 Time Groups:**
> Today, Yesterday, This Week (excluding today/yesterday),
> This Month (excluding this week), Older (sub-grouped by month:
> "March 2026", etc.). Empty groups hidden.

## Current State

The infrastructure is complete but not wired:

- `BrowsingTree.loadSummaries(storage)` exists at
  `BrowsingTree.mjs:392` -- loads branch root summaries from
  `TreeStorage.getBranchSummaries()` and inserts them as children
  of the root node. Tested in `BrowsingTree.test.ts:1151`.
- `TreeStorage.getBranchSummaries()` at `TreeStorage.mjs:245`
  queries `limb_nodes WHERE id = branch_root_id` -- returns id,
  url, title, favicon, createdAt, lastVisitedAt, descendantCount.
- `LauncherDataSource.getLauncherData()` iterates
  `tree.rootId.childIds` -- only in-memory nodes (SessionStore).
- `browser-init-js.patch` line 150 creates `treeStorage` but
  **never calls** `browsingTree.loadSummaries(treeStorage)`.

Result: the launcher shows only branches restored from
SessionStore (current session tabs). Old/inactive branches saved
in SQLite are invisible until the user finds them via search.

**Deduplication concern:** `loadSummaries` blindly adds all
summaries to root.childIds. If the active branch's root was also
saved in storage (via a prior `deactivateBranch`), it will appear
twice -- once from SessionStore restore, once from storage. The
wiring must skip nodes already in the tree.

## What To Build

1. In `browser-init-js.patch`, after `restoreTreeFromTabs()` and
   `TreeStorage` creation (around line 151), add an async call:
   ```js
   await browsingTree.loadSummaries(treeStorage);
   ```
   This must run before `branchFoldAdapter.updateLayout()` so the
   fold computation sees all branches.

2. Fix `BrowsingTree.loadSummaries()` to skip summaries whose
   `id` already exists in `this.nodes` (prevents duplicating the
   active branch root that SessionStore already restored).

3. Verify `LauncherDataSource.getLauncherData()` correctly
   processes the newly-loaded summary nodes. The summary nodes
   have `status: 'culled'` and `childIds: []` but carry
   `descendantCount` -- the launcher card should display
   `descendantCount` as the node count (e.g., "12 pages"), not
   `childIds.length`.

4. Verify clicking a stored branch card triggers
   `tree.switchBranch(branchRootId, treeStorage)` which loads the
   full subtree. The launcher's click handler in `limb-home.mjs`
   already calls `focusNode` -- it may need to call
   `activateBranch` first if the branch is inactive (no loaded
   children).

5. Write tests:
   - `loadSummaries` skips nodes already in tree (deduplication).
   - Launcher shows both active and stored branches after
     `loadSummaries`.
   - Clicking an inactive branch card triggers activation.
