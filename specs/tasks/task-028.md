# Task 028: Branch loading + unloading

**Spec:** persistence.md S2; unified-tree.md S3.2, S3.3, S3.4

**Spec excerpt:**

> Startup: load root node + branch root summaries. Display launcher. Do NOT load full subtrees.
> Branch activation: load full subtree from storage, insert into BrowsingTree, restore screenshots, compute layout.
> Branch deactivation: save state, remove descendants from memory (keep branch root), free screenshots.
> Load levels: root+summaries always in memory. Active branch fully materialized. Inactive branches = root only.

**Depends on:** task-027

**Build context:** Requires `npm run build:ui`.

**Acceptance criteria:**
- On startup, only root + branch root summaries loaded (not full subtrees)
- Clicking a branch loads its full subtree from storage
- Previous active branch is deactivated: descendants removed, screenshots freed
- Branch root stays in memory with summary metadata (title, favicon, nodeCount, lastVisitedAt)
- Layout recomputed after branch load
- Memory stays bounded: only one branch fully materialized at a time

**Progress:** not-started

**Commits:**
