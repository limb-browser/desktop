# Task 027: SessionStore tree metadata persistence

**Spec:** persistence.md S1.1, S1.2, S1.3, S3; patch-strategy.md S2.3

**Spec excerpt:**

> Each tree node stores: id, url, title, favicon, parentId, childIds, createdAt, lastVisitedAt, descendantCount.
> Active branch: SessionStore (in-memory + jsonlz4). Inactive branches: Places database (SQLite).
> SessionStore integration: extend with `zen-tree-node-id`, `zen-tree-parent-id`, `zen-tree-created-at` attributes on tabs.
> Auto-save triggers: node add/remove, focus change, URL/title update, every 30s, app quit.
> On restore, rebuild BrowsingTree from these attributes.

**Depends on:** task-017

**Build context:** Requires `npm run build:ui` + SessionStore patches.

**Acceptance criteria:**
- Tree metadata persisted in SessionStore via tab attributes
- Patch SessionStore files to collect/restore tree node metadata
- Auto-save on: node add/remove, focus change, URL/title update, 30s periodic, quit
- On startup, BrowsingTree reconstructed from SessionStore data
- Crash recovery: tree structure survives browser crash
- Inactive branches persisted to Places database (or SQLite)

**Progress:** not-started

**Commits:**
