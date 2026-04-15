---
title: "Implement focus synchronization between tree and tabs"
spec_ref: "tab-bridge.md S2"
depends_on:
  - task-008
progress: ready-for-review
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> **Tree to Tabs:** When the tree model focuses a node: find the associated tab, if suspended restore it, call `gBrowser.selectedTab = tab`.
>
> **Tabs to Tree:** If something outside Limb focuses a tab (e.g., extension): read `limb-node-id`, call `tree.focusNode(nodeId)`.
>
> **Invariant:** Focused tab matches focused node. `gBrowser.selectedTab.limb-node-id === tree.focusedNodeId`.

## Current State

TabBridge (task-008) tracks node-tab associations but does not synchronize focus. BrowsingTree has `focusNode()` but it's disconnected from Firefox's tab selection.

## What To Build

1. Extend TabBridge with focus synchronization:
   - When `BrowsingTree.focusNode(nodeId)` is called, update `gBrowser.selectedTab` to the associated tab.
   - If the tab doesn't exist or is suspended, create/restore it first.
2. Listen for Firefox's `TabSelect` event on `gBrowser.tabContainer`:
   - Read the newly selected tab's `limb-node-id`.
   - Call `tree.focusNode(nodeId)` to sync the tree state.
   - Guard against infinite loops (tree->tab->tree).
3. Enforce invariant: `gBrowser.selectedTab` always has `limb-node-id === tree.focusedNodeId`.
4. Write tests for:
   - Focusing a node selects the correct tab.
   - Selecting a tab (externally) updates the tree's focused node.
   - No infinite loop on focus sync.
