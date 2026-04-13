# Tab Bridge

How Firefox tabs map to tree nodes. This is the critical integration layer.

## S1 Core Mapping

### S1.1 One Tab Per Node

Every tree node that is at LOD tier Live or Focused has exactly one Firefox tab. The tab's `linkedBrowser` element renders the page content.

Nodes at lower tiers (Screenshot, Favicon, Culled) may or may not have a tab. If they do, the tab is suspended (unloaded).

### S1.2 Node-Tab Association

Each Firefox tab carries a `limb-node-id` attribute that links it to its tree node. This attribute is:
- Set when the tab is created.
- Persisted in SessionStore for crash recovery.
- Used by the tree view to position the tab's browser element.

### S1.3 Tab Creation

When the tree model creates a node (via `addChild`):
1. A new Firefox tab is opened (via `gBrowser.addTab()`).
2. The tab's `limb-node-id` attribute is set to the node's ID.
3. The tab is associated with the node in the tree model.

When the user opens a link via Ctrl+click or middle-click:
1. Firefox's normal "open in new tab" fires.
2. Limb intercepts the new tab event.
3. A child node is created in the tree with the opener tab's node as parent.
4. The new tab gets the child node's ID.

### S1.4 Tab Destruction

When a node is removed from the tree:
1. If the node has an associated tab, close it.
2. Close tabs for all descendant nodes.
3. Firefox handles renderer process cleanup.

## S2 Focus Synchronization

### S2.1 Tree to Tabs

When the tree model focuses a node:
1. Find the associated tab.
2. If the tab doesn't exist or is suspended, create/restore it.
3. Call `gBrowser.selectedTab = tab`.
4. Firefox handles bringing the tab's content to front.

### S2.2 Tabs to Tree

If something outside Limb focuses a tab (e.g., an extension or keyboard shortcut):
1. Read the tab's `limb-node-id`.
2. Call `tree.focusNode(nodeId)`.
3. Update the tree view to reflect the new focus.

## S3 Tab Lifecycle

### S3.1 States

```
Created -> Active -> Suspended -> Active (on re-focus)
                  -> Destroyed (on node removal)
```

### S3.2 Suspension

Tabs that drop below Live LOD tier are suspended using Firefox's tab unloading (`browser.tabs.discard()` equivalent). This frees memory while preserving the tab's session data.

### S3.3 Restoration

When a suspended tab needs to become Live again:
1. Reload the tab from its URL (or from SessionStore cache if available).
2. Update the tree node's status.
3. Capture a fresh screenshot once loaded.

## S4 Invariants

1. **Every active tab has a node.** There are no "orphan" tabs without tree nodes.
2. **Focused tab matches focused node.** `gBrowser.selectedTab.limb-node-id === tree.focusedNodeId`.
3. **Node creation is the only way to create tabs.** Users cannot create tabs through Firefox's normal UI (the tab bar is hidden). `Ctrl+T` creates a child of the focused node.
4. **Tab close goes through the tree.** `Ctrl+W` removes the node (which closes the tab), not the reverse.
