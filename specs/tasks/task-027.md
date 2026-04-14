---
title: "Implement Places DB persistent storage for tree data and screenshots"
spec_ref: "persistence.md S1.2 S4"
depends_on:
  - task-003
progress: needs-revision
review: "specs/reviews/review-TASK_027-R1.md"
coverage_sections: []
commits: []
---

## Spec Excerpt

> | Data | Storage | Reason |
> |------|---------|--------|
> | Inactive branch nodes | Places database (SQLite) | Persistent, searchable |
> | Screenshots | Separate table in Places or dedicated SQLite | Large blobs, evictable |
>
> Low-res (320px wide): JPEG quality 60, ~15-30KB
> High-res (1024px wide): JPEG quality 85, ~80-150KB

## Current State

BrowsingTree (task-003) manages tree data in memory only. SessionStore persistence (task-023) will persist active branch tabs via tab attributes. No persistent storage exists for inactive branch tree structure or screenshots across browser restarts. Tasks that need persistent storage (task-028 lazy loading, task-031 screenshot eviction, task-033 search) have no backend to read from or write to.

## What To Build

1. Create `src/limb/tree/TreeStorage.mjs` with a SQLite-backed storage layer:
   - Create a dedicated SQLite database using Firefox's `Sqlite.sys.mjs` API.
   - Database file: `limb-tree.sqlite` in the profile directory.
   - Table `limb_nodes`: `id` TEXT PRIMARY KEY, `url` TEXT, `title` TEXT, `favicon` TEXT, `parent_id` TEXT, `child_ids` TEXT (JSON array), `created_at` INTEGER, `last_visited_at` INTEGER, `descendant_count` INTEGER, `branch_root_id` TEXT.
   - Table `limb_screenshots`: `node_id` TEXT, `resolution` TEXT (low/high), `data` BLOB, `captured_at` INTEGER, PRIMARY KEY (`node_id`, `resolution`).
2. Implement storage API methods:
   - `saveBranch(branchRootId, nodes[])` — persist all nodes in a branch.
   - `loadBranch(branchRootId)` — load all nodes for a branch, return as TreeNode array.
   - `deleteBranch(branchRootId)` — remove a branch and all its descendant nodes and screenshots.
   - `getBranchSummaries()` — return branch root nodes with metadata (for launcher display without loading full subtrees).
   - `saveScreenshot(nodeId, resolution, jpegBlob)` — persist a screenshot.
   - `loadScreenshot(nodeId, resolution)` — retrieve a screenshot blob.
   - `deleteScreenshots(nodeIds[])` — remove screenshots for given nodes.
   - `getScreenshotMemoryUsage()` — return total byte size of stored screenshots.
3. Ensure database schema is created on first access and includes a version number for future migrations.
4. Write tests for:
   - Saving and loading a branch round-trips all node fields correctly.
   - Branch summaries return correct metadata without loading full subtrees.
   - Screenshots are stored and retrieved at correct resolutions.
   - Deleting a branch removes all associated nodes and screenshots.
   - `getScreenshotMemoryUsage()` returns accurate totals.
   - Database is created in the profile directory on first access.
