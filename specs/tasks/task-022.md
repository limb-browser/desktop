# Task 022: Link interception — new-tab links create child nodes

**Spec:** navigation.md S1.1, S1.2, S1.3, S1.4

**Spec excerpt:**

> New-tab links (Ctrl+click, middle-click, right-click "Open in new tab"):
> 1. Intercept new-tab event. 2. Call addChild(currentNodeId, targetUrl). 3. Create new Firefox tab. 4. Child appears in tree. 5. Focus new child. 6. If zoomed in, animate brief zoom-out-and-back.
>
> Same-tab navigation: tab navigates normally, update node url/title, no tree change. Capture fresh screenshot.
> window.open() treated as new-tab. Form submissions follow same rules.

**Depends on:** task-017

**Build context:** Requires `npm run build:ui`.

**Acceptance criteria:**
- Ctrl+click / middle-click on a link creates a child node in the tree
- New tab is created and associated with the child node
- Child node is focused after creation
- Same-tab navigation updates the node's url and title without changing tree structure
- `window.open()` creates a child node (same as new-tab)
- If zoomed in (level >= 0.9), brief zoom-out-and-back animation shows branching

**Progress:** not-started

**Commits:**
