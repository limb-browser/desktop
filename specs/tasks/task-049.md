---
title: "Fix launcher branch card click to zoom into tree view"
spec_ref: "unified-tree.md S2.2"
depends_on: []
progress: ready-for-review
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> **unified-tree.md S2.2 Branch Cards:**
> Clicking a card focuses that branch's root node and zooms in.

## Current State

In `limb-home.mjs` (lines 293-298), the branch card click
handler only calls `tree.focusNode(nodeId)`:

```js
const card = e.target.closest(".branch-card");
if (!card) return;
const nodeId = card.dataset.nodeId;
if (nodeId && tree.nodes.has(nodeId)) {
  tree.focusNode(nodeId);
}
```

It does NOT update the tree view or trigger a zoom animation.
Compare with the search result click handler (lines 265-270)
which correctly calls:

```js
tree.focusNode(nodeId);
if (treeView) {
  treeView.setFocusedNodeId(nodeId);
  treeView.animateToNode(nodeId, 1);
}
```

Result: clicking a branch card on the launcher page focuses the
node in the domain model but the tree view does not zoom in.
The user stays on the launcher page with no visual feedback.

## What To Build

1. In `limb-home.mjs`, update the branch card click handler to
   match the search result click handler pattern:

   ```js
   if (nodeId && tree.nodes.has(nodeId)) {
     tree.focusNode(nodeId);
     if (treeView) {
       treeView.setFocusedNodeId(nodeId);
       treeView.animateToNode(nodeId, 1);
     }
   }
   ```

2. For inactive branches (nodes loaded from storage with
   `childIds: []` and no tabs), the handler should call
   `tree.switchBranch(nodeId, storage)` first, then focus and
   zoom. This depends on task-046 wiring storage, so guard with
   an `if (storage)` check:

   ```js
   if (nodeId && tree.nodes.has(nodeId)) {
     const node = tree.nodes.get(nodeId);
     if (node.childIds.length === 0 && node.status === 'culled' && storage) {
       await tree.switchBranch(nodeId, storage);
     }
     tree.focusNode(nodeId);
     if (treeView) {
       treeView.setFocusedNodeId(nodeId);
       treeView.animateToNode(nodeId, 1);
     }
   }
   ```

3. Write a manual test plan:
   - Launch Limb with at least one active branch.
   - Navigate to about:limb-home.
   - Click a branch card.
   - Verify: tree view zooms into the clicked branch's root node.
