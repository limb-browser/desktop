---
title: "Implement lazy tree loading for inactive branches"
spec_ref: "unified-tree.md S3; persistence.md S2"
depends_on:
  - task-003
  - task-023
  - task-027
progress: not-started
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> A tree with thousands of nodes spanning months of browsing cannot all be in memory. Only the active branch needs to be fully materialized.
>
> Load levels:
> - Root + summaries: Root node + branch roots with metadata. Always in memory.
> - Active branch: Full subtree loaded when user zooms into a branch.
> - Inactive branches: Branch root only (summary).
>
> When switching branches: save current branch, remove descendants from memory, load new branch subtree.

## Current State

BrowsingTree (task-003) keeps all nodes in memory. SessionStore persistence (task-023) can save/restore tree data. But there's no concept of active vs. inactive branches or lazy loading.

## What To Build

1. Extend BrowsingTree with branch activation concept:
   - `activeBranchId` — the currently active branch root.
   - `activatesBranch(branchRootId)` — loads full subtree from storage into memory.
   - `deactivateBranch(branchRootId)` — saves and removes descendants from memory, keeps branch root with summary metadata.
2. Add `descendantCount` to TreeNode:
   - Cached count, updated incrementally on addChild/removeNode.
   - Persisted for inactive branches so launcher can display node counts without loading full subtrees.
3. Implement branch switch flow:
   - Save current active branch state.
   - Deactivate current branch (remove descendants from memory).
   - Activate new branch (load subtree from storage).
   - Free screenshots for deactivated branch.
4. On startup: load only root + branch roots (summaries). Load active branch subtree on demand.
5. Write tests for:
   - Branch activation loads full subtree.
   - Branch deactivation removes descendants from memory.
   - descendantCount is accurate after operations.
   - Switching branches preserves data integrity.
