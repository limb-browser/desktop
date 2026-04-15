---
title: "Implement same-tab navigation tracking"
spec_ref: "navigation.md S1.2 S1.4"
depends_on:
  - task-008
progress: complete
review: "specs/reviews/review-task-013-R1.md"
coverage_sections: []
commits: []
---

## Spec Excerpt

> When a user clicks a regular link (not Ctrl+click) within a focused tab:
> 1. The tab navigates normally (same browsing context).
> 2. Update the node's `url` and `title` to reflect the new page.
> 3. The tree structure does NOT change. This is in-place navigation, not branching.
> 4. Capture a fresh screenshot after the page loads.

## Current State

TabBridge (task-008) maps tabs to nodes. When a tab navigates within the same browsing context, the node's URL and title are not updated.

## What To Build

1. Listen for location change events on tabs:
   - Use `webProgress` listener or `TabAttrModified` events on `gBrowser`.
   - When a tab's URL changes (same-tab navigation), find the associated node via TabBridge.
   - Update the node's `url` property.
2. Listen for title changes:
   - When a tab's title updates, update the associated node's `title`.
3. Update `favicon` on the node when the tab's favicon changes.
4. Do NOT modify tree structure on same-tab navigation (no new nodes, no re-parenting).
5. Write tests verifying:
   - Navigating to a new URL in the same tab updates the node's `url`.
   - Title changes propagate to the node.
   - Favicon changes propagate to the node.
   - Tree structure remains unchanged after same-tab navigation.
