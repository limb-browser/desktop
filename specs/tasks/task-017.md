# Task 017: Tab Bridge — node-tab mapping + creation/destruction

**Spec:** tab-bridge.md S1.1, S1.2, S1.3, S1.4; patch-strategy.md S2.2

**Spec excerpt:**

> Every tree node at LOD Live or Focused has exactly one Firefox tab. Each tab carries a `limb-node-id` attribute.
> Tab creation: `gBrowser.addTab()`, set `limb-node-id`, associate with tree node.
> When user opens link via Ctrl+click: intercept new tab event, create child node, assign new tab the child node's ID.
> Tab destruction: when node removed, close associated tab and all descendant tabs.

**Depends on:** task-001, task-002, task-014

**Build context:** Requires `npm run build:ui` + tabbrowser.js patch.

**Acceptance criteria:**
- `TabBridge` class maps node IDs to Firefox tabs and vice versa
- `createTabForNode(node)` calls `gBrowser.addTab()` and sets `limb-node-id`
- `destroyTabForNode(nodeId)` closes the tab
- `getTabForNode(nodeId)` / `getNodeForTab(tab)` lookups
- Patch `src/browser/components/tabbrowser/content/tabbrowser-js.patch` to hook `addTab()` and `removeTab()` events
- New tabs created through Firefox get intercepted and routed through the tree model
- Closing a node closes its tab and all descendant tabs

**Progress:** not-started

**Commits:**
