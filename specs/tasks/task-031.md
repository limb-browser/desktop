# Task 031: Branch folding in tree view

**Spec:** unified-tree.md S4.1, S4.2

**Spec excerpt:**

> At root level: recent branches (last 7 days) shown as normal tree nodes, left-to-right by recency. Older branches collapsed into fold node showing count (e.g., "142 older branches"). Clicking expands.
> Fold nodes render as rounded rectangle with stacked-cards appearance and label like "Mar 2026 (23 branches)".

**Depends on:** task-016, task-029

**Build context:** Requires `npm run build:ui`.

**Acceptance criteria:**
- When zoomed out to root level, branches older than 7 days collapsed into fold nodes
- Fold nodes grouped by month with label (e.g., "Mar 2026 (23 branches)")
- Fold node renders as rounded rectangle with stacked-cards visual
- Clicking a fold node expands to show individual branches
- Recent branches (< 7 days) shown as normal nodes, ordered by recency

**Progress:** not-started

**Commits:**
