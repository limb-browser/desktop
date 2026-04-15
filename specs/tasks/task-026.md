---
title: "Implement branch creation and deletion"
spec_ref: "unified-tree.md S2.3 S2.4; navigation.md S5.2"
depends_on:
  - task-025
  - task-008
  - task-021
progress: not-started
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> `Ctrl+N` creates a new branch from anywhere. The current branch state is saved first.
>
> A "+" button or prominent card creates a new branch.
>
> Right-click or hover-reveal a delete button. Requires confirmation if the branch has more than one node.

## Current State

Launcher page (task-025) has UI for creating and viewing branches. TabBridge (task-008) creates tabs for nodes. But Ctrl+N is not wired, and branch deletion has no confirmation flow.

## What To Build

1. Implement `Ctrl+N` shortcut:
   - Save current branch state (call auto-save).
   - Call `BrowsingTree.addChild(rootId, homeUrl)` where `homeUrl` comes from `limb.home.url` pref.
   - Focus the new branch root node.
   - TabBridge creates a tab for it.
   - Zoom to the new node.
2. Implement branch deletion:
   - On the launcher page, add a delete button (hover-reveal or right-click context menu).
   - If branch has more than one node, show a confirmation dialog.
   - Call `BrowsingTree.removeNode(branchRootId)` which removes the branch and all its descendants.
   - TabBridge closes all associated tabs.
3. Update the launcher UI to reflect branch changes immediately.
4. Write tests for:
   - Ctrl+N creates a new branch child of root.
   - Branch deletion removes all descendants.
   - Confirmation is shown for multi-node branches.
   - Single-node branches delete without confirmation.
