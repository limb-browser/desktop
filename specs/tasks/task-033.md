# Task 033: Tree size warning

**Spec:** performance.md S5.2

**Spec excerpt:**

> Warn when the tree exceeds 100 nodes. Above 200 nodes, suggest closing unused branches. Do NOT auto-close.

**Depends on:** task-001

**Build context:** vitest + `npm run build:ui` for UI notification.

**Acceptance criteria:**
- Tree tracks node count
- At 100 nodes: subtle warning (e.g., notification bar or console)
- At 200 nodes: prominent suggestion to close unused branches
- No automatic closure of branches
- Warning dismissable, doesn't block browsing

**Progress:** not-started

**Commits:**
