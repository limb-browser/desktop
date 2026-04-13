---
title: "Implement BrowsingTree model with core operations"
spec_ref: "tree-model.md S1 S2 S4"
depends_on: []
progress: needs-revision
review: "specs/reviews/review-TASK_003-R1.md"
coverage_sections: []
commits: []
---

## Spec Excerpt

> A TreeNode represents a single browsing context (one webpage).
> The BrowsingTree is the aggregate root. It owns all nodes and enforces tree invariants.
>
> Operations: addChild, removeNode, focusNode, getAncestors, getDescendants, getSubtreeDepth, getSiblings.
>
> Invariants: Single root. Acyclic. Referential integrity. Unique IDs. Exactly one focused node. Ordered children.

## Current State

No tree model implementation exists. `src/limb/tree/LimbTreeView.mjs` is a canvas placeholder stub with no data model.

## What To Build

1. Create `src/limb/tree/BrowsingTree.mjs` implementing:
   - `TreeNode` with fields: `id`, `url`, `title`, `favicon`, `parentId`, `childIds`, `status`, `createdAt`, `lastVisitedAt`.
   - `NodeStatus` enum: `live`, `screenshot`, `favicon-only`, `culled`.
   - `BrowsingTree` class with `rootId`, `nodes` (Map), `focusedNodeId`.
2. Implement operations:
   - `addChild(parentId, url)` — creates child node, appends to parent's childIds.
   - `removeNode(nodeId)` — removes node and descendants, updates parent, moves focus if needed.
   - `focusNode(nodeId)` — sets focused node, updates lastVisitedAt.
   - `getAncestors(nodeId)` — returns path to root, child-to-root order.
   - `getDescendants(nodeId)` — returns subtree in breadth-first order.
   - `getSubtreeDepth(nodeId)` — returns max depth.
   - `getSiblings(nodeId)` — returns siblings excluding self.
3. Enforce all invariants from tree-model.md S4 (single root, acyclic, referential integrity, unique IDs, one focused node, ordered children).
4. Write tests for every operation and invariant, including edge cases (remove focused node, remove node with children, single-child tree).
