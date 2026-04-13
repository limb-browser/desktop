---
title: "Implement URL entry behavior — in-place vs child creation"
spec_ref: "navigation.md S2.3"
depends_on:
  - task-012
  - task-015
progress: not-started
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> Typing a URL and pressing Enter:
> - If the URL is `about:limb-home`, `about:limb-settings`, or `about:limb-search`, navigate to the internal page in-place.
> - If the focused node has no children and was visited less than 5 seconds ago: navigate in-place.
> - Otherwise: create a new child node with the entered URL (S1.1 behavior).

## Current State

Address bar visibility is tied to zoom level (task-015). Link interception creates child nodes for Ctrl+click and middle-click (task-012). But the URL entry behavior — what happens when the user types a URL and presses Enter — uses Firefox's default behavior (navigates the current tab in-place) regardless of tree context.

## What To Build

1. Hook into the urlbar's URL submission event:
   - Listen for the urlbar's `handleCommand` or equivalent submission handler.
   - Before the default navigation, evaluate the branching decision.
2. Implement the branching decision logic:
   - If the URL starts with `about:limb-`: always navigate in-place (update current node's URL).
   - Else if the focused node has no children AND `Date.now() - node.lastVisitedAt < 5000`: navigate in-place.
   - Else: create a new child node via `BrowsingTree.addChild(focusedNodeId, enteredUrl)` and focus it.
3. When navigating in-place: let Firefox's default URL loading proceed, then update the tree node's URL/title (task-013 handles the tracking).
4. When creating a child: prevent default navigation, create the child node, TabBridge creates a new tab for it.
5. Write tests for:
   - `about:limb-home` always navigates in-place.
   - Fresh node with no children navigates in-place.
   - Node with children creates a child.
   - Node visited more than 5 seconds ago creates a child (even if no children).
   - The 5-second window is based on `lastVisitedAt`, not arbitrary.
