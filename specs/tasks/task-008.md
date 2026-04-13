---
title: "Implement Tab Bridge core — node-tab association and lifecycle"
spec_ref: "tab-bridge.md S1"
depends_on:
  - task-003
  - task-002
progress: not-started
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> Every tree node that is at LOD tier Live or Focused has exactly one Firefox tab.
>
> Each Firefox tab carries a `limb-node-id` attribute that links it to its tree node.
>
> When the tree model creates a node (via `addChild`):
> 1. A new Firefox tab is opened (via `gBrowser.addTab()`).
> 2. The tab's `limb-node-id` attribute is set to the node's ID.
> 3. The tab is associated with the node in the tree model.
>
> When a node is removed from the tree:
> 1. If the node has an associated tab, close it.
> 2. Close tabs for all descendant nodes.

## Current State

No tab bridge exists. Firefox tabs are managed by Zen's workspace system (removed in task-001/002). The BrowsingTree model (task-003) has no connection to Firefox tabs.

## What To Build

1. Create `src/limb/tree/TabBridge.mjs` implementing:
   - `nodeToTab` Map tracking node ID → Firefox tab associations.
   - `tabToNode` Map tracking tab → node ID reverse lookup.
   - `createTabForNode(node)` — calls `gBrowser.addTab(node.url)`, sets `limb-node-id` attribute.
   - `closeTabForNode(nodeId)` — finds associated tab, calls `gBrowser.removeTab()`.
   - `getTabForNode(nodeId)` and `getNodeForTab(tab)` lookups.
2. Hook into BrowsingTree events:
   - On `addChild`: create a tab for the new node.
   - On `removeNode`: close tabs for the node and all descendants.
3. Set `limb-node-id` attribute on tab elements for SessionStore persistence.
4. Create a root node with the initial tab on browser startup.
5. Write tests verifying:
   - Tab creation sets `limb-node-id` attribute.
   - Node removal closes associated tabs.
   - Every active tab has a corresponding node (no orphans).
