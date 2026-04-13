# Task 032: Full-text search across nodes

**Spec:** unified-tree.md S5.1, S5.2; persistence.md S5

**Spec excerpt:**

> Search bar on launcher page. `Ctrl+K` from anywhere opens `about:limb-search`.
> Full-text search across all persisted nodes (title, URL). Uses FTS5 if SQLite or Places search.
> Results: node title, URL, branch name, timestamp, favicon. Clicking loads that branch and focuses the node.

**Depends on:** task-027, task-029

**Build context:** Requires `npm run build:ui` + about: page registration.

**Acceptance criteria:**
- `about:limb-search` registered as Firefox about: page
- `Ctrl+K` navigates to search page
- Search bar on launcher page wired to search functionality
- Full-text search across node titles and URLs
- Results display: title, URL, branch name, timestamp, favicon
- Clicking a result loads the branch and focuses the matching node
- Search uses Places infrastructure or FTS5

**Progress:** not-started

**Commits:**
