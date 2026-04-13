# Task 029: Launcher page (about:limb-home)

**Spec:** unified-tree.md S1.1, S2.1, S2.2, S2.3, S2.4; navigation.md S5.1

**Spec excerpt:**

> Root node URL is `about:limb-home`. Created on first launch, never deleted.
> Launcher renders root's children grouped by time: Today, Yesterday, This Week, This Month, Older (sub-grouped by month).
> Branch cards show: favicon, name, node count, relative timestamp, screenshot thumbnail.
> "+" button or Ctrl+N creates new branch. Right-click delete with confirmation (if > 1 node).
> On startup: show about:limb-home (the launcher). New branch creates root node navigated to homepage.

**Depends on:** task-028

**Build context:** Requires `npm run build:ui` + about: page registration.

**Acceptance criteria:**
- `about:limb-home` registered as a Firefox about: page
- Launcher shows branch cards grouped by time periods
- Each card displays favicon, name, node count, timestamp, thumbnail
- Empty groups hidden; if no branches, show "Start Browsing" button
- Clicking a card activates that branch (loads subtree, focuses root, zooms in)
- "+" / Ctrl+N creates a new branch with configured homepage URL
- Right-click delete with confirmation dialog
- Search bar at top (placeholder, wired in task-032)

**Progress:** not-started

**Commits:**
