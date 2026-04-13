---
title: "Hide tab bar and route Ctrl+T/Ctrl+W through tree model"
spec_ref: "tab-bridge.md S4.3 S4.4"
depends_on:
  - task-008
progress: not-started
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> **Node creation is the only way to create tabs.** Users cannot create tabs through Firefox's normal UI (the tab bar is hidden). `Ctrl+T` creates a child of the focused node.
>
> **Tab close goes through the tree.** `Ctrl+W` removes the node (which closes the tab), not the reverse.

## Current State

Firefox's tab bar is visible (Zen's vertical tab bar). Ctrl+T opens a standard Firefox tab. Ctrl+W closes a tab directly. TabBridge (task-008) exists but doesn't intercept these actions.

## What To Build

1. Hide the tab bar:
   - Add CSS to hide `#tabbrowser-tabs` (or Zen's vertical tab strip) via a Limb stylesheet.
   - Ensure the tab bar is fully hidden, not just collapsed (prevent accidental interaction).
2. Override Ctrl+T:
   - Intercept the `cmd_newNavigatorTab` command (or equivalent key binding).
   - Instead of default behavior: call `BrowsingTree.addChild(focusedNodeId, homepage)`.
   - TabBridge creates the tab automatically.
3. Override Ctrl+W:
   - Intercept tab close command.
   - Instead of closing the tab directly: call `BrowsingTree.removeNode(focusedNodeId)`.
   - TabBridge closes the tab as part of removal.
   - Focus moves to the parent node.
4. Prevent other tab creation paths (Firefox menu "New Tab", etc.) from bypassing the tree.
5. Write tests verifying:
   - Tab bar is not visible.
   - Ctrl+T creates a child node in the tree.
   - Ctrl+W removes the focused node and its tab.
   - Cannot create orphan tabs.
