# Task 018: Tab Bridge — focus synchronization

**Spec:** tab-bridge.md S2.1, S2.2; tab-bridge.md S4 (invariants)

**Spec excerpt:**

> Tree to tabs: When tree focuses a node, find associated tab, create/restore if needed, set `gBrowser.selectedTab = tab`.
> Tabs to tree: If something outside Limb focuses a tab, read `limb-node-id` and call `tree.focusNode(nodeId)`.
> Invariants: Every active tab has a node. Focused tab matches focused node. Node creation is the only way to create tabs. Tab close goes through the tree.

**Depends on:** task-003, task-017

**Build context:** Requires `npm run build:ui`.

**Acceptance criteria:**
- Focusing a tree node selects the corresponding Firefox tab
- If tab is suspended, it is restored before selection
- External tab focus changes (extensions, shortcuts) sync back to tree model
- `gBrowser.selectedTab` always matches `tree.focusedNodeId`
- Tab bar is hidden (users cannot create tabs outside the tree)
- `Ctrl+T` creates a child of the focused node instead of a bare tab

**Progress:** not-started

**Commits:**
