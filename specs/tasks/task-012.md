---
title: "Implement link interception — new-tab links create child nodes"
spec_ref: "navigation.md S1.1 S1.3"
depends_on:
  - task-008
  - task-009
progress: needs-revision
review: "specs/reviews/review-TASK_012-R1.md"
coverage_sections: []
commits: []
---

## Spec Excerpt

> When a user opens a link in a new tab (via Ctrl+click, middle-click, or right-click -> "Open in new tab"):
> 1. Intercept the new-tab event from the tabbrowser.
> 2. Call `BrowsingTree.addChild(currentNodeId, targetUrl)`.
> 3. Create a new Firefox tab associated with this tree node.
> 4. The new child node appears in the tree layout.
> 5. Focus the new child node.
>
> JavaScript `window.open()` calls are treated the same as new-tab links.

## Current State

TabBridge (task-008) can create tabs for nodes. Focus sync (task-009) keeps tree and tabs aligned. But Firefox's default new-tab behavior still creates orphan tabs outside the tree model.

## What To Build

1. Hook into `gBrowser`'s tab creation to intercept new-tab events:
   - Listen for `TabOpen` events on `gBrowser.tabContainer`.
   - When a new tab opens, determine the opener tab's node ID.
   - Call `BrowsingTree.addChild(openerNodeId, newTabUrl)` to create the child.
   - Associate the new tab with the child node via TabBridge.
2. Handle `window.open()` calls similarly (they create new tabs in Firefox).
3. Prevent orphan tabs: any tab creation that didn't come through the tree model should be intercepted and routed through `addChild`.
4. Write tests verifying:
   - Ctrl+click on a link creates a child node in the tree.
   - The new node's parent is the focused node.
   - `window.open()` creates a child node.
   - No orphan tabs exist after link interception.
