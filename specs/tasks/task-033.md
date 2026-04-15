---
title: "Implement search — about:limb-search and Ctrl+K"
spec_ref: "unified-tree.md S5; persistence.md S5"
depends_on:
  - task-023
  - task-025
  - task-027
progress: complete
review: "specs/reviews/review-task-033-R2.md"
coverage_sections: []
commits: []
---

## Spec Excerpt

> Full-text search across all persisted nodes (title, URL). Uses FTS5 if backed by SQLite, or Places' existing search infrastructure.
>
> Results return: node title, URL, branch name, timestamp, favicon. Clicking a result loads that branch and focuses the node.
>
> Search bar on the launcher page. `Ctrl+K` from anywhere opens `about:limb-search`.

## Current State

SessionStore persistence (task-023) stores tree data. Launcher page (task-025) has a search bar placeholder. No search implementation exists.

## What To Build

1. Register `about:limb-search` as a Firefox about: page.
2. Implement search backend:
   - Search across all persisted nodes (active and inactive branches).
   - Match against node `title` and `url` fields.
   - Use Firefox's Places database infrastructure if feasible, or implement a simple in-memory search for the initial version.
   - Return results with: title, URL, branch name (parent branch root's title), timestamp, favicon.
3. Implement search UI:
   - Text input with instant results (filter as you type).
   - Results list showing title, URL, branch name, timestamp, favicon.
   - Clicking a result: load that branch (if inactive), focus the node, zoom in.
4. Wire the launcher search bar to the same search logic.
5. Register `Ctrl+K` shortcut to navigate to `about:limb-search`.
6. Write tests for:
   - Search finds nodes by title substring.
   - Search finds nodes by URL substring.
   - Results include correct branch name and timestamp.
   - Clicking a result activates the correct branch and focuses the node.
