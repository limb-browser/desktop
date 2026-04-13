# Task 002: removeNode with cascade delete

**Spec:** tree-model.md S2.2

**Spec excerpt:**

> `removeNode(nodeId)`: Removes a node and all its descendants. Updates the parent's `childIds`.
> **Invariants:**
> - Cannot remove the root node.
> - All descendant nodes are also removed.
> - If the focused node is removed, focus moves to the removed node's parent.

**Depends on:** task-001

**Build context:** vitest only.

**Acceptance criteria:**
- `removeNode(nodeId)` removes the node and all descendants from the tree
- Parent's `childIds` is updated
- Removing root throws
- Removing a subtree removes all descendants
- If focused node is in the removed subtree, focus moves to the removed node's parent
- Tests cover: remove leaf, remove subtree, remove root throws, focus reassignment on removal

**Progress:** not-started

**Commits:**
