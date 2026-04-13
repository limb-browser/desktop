# Task 003: focusNode + tree query operations

**Spec:** tree-model.md S2.3, S2.4, S2.5, S2.6, S2.7

**Spec excerpt:**

> `focusNode(nodeId)`: Sets `focusedNodeId` to `nodeId`. Updates `lastVisitedAt` on the target node. `nodeId` must exist.
> `getAncestors(nodeId)`: Returns path from node to root (inclusive), ordered child-to-root.
> `getDescendants(nodeId)`: Returns all nodes in subtree, breadth-first order.
> `getSubtreeDepth(nodeId)`: Returns max depth of subtree rooted at nodeId.
> `getSiblings(nodeId)`: Returns all children of the node's parent, excluding the node itself.

**Depends on:** task-001

**Build context:** vitest only.

**Acceptance criteria:**
- `focusNode` sets focusedNodeId and updates lastVisitedAt
- `focusNode` throws for nonexistent nodeId
- `getAncestors` returns child-to-root path including both endpoints
- `getDescendants` returns breadth-first subtree
- `getSubtreeDepth` returns correct depth (leaf = 0)
- `getSiblings` returns sibling nodes excluding self
- Tests cover all operations with edge cases (root ancestors, leaf descendants, single-child siblings)

**Progress:** not-started

**Commits:**
