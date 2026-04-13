# Task 001: TreeNode + BrowsingTree + addChild

**Spec:** tree-model.md S1.1, S1.2, S1.3, S2.1

**Spec excerpt:**

> A TreeNode represents a single browsing context (one webpage).
> ```typescript
> interface TreeNode {
>   id: string, url: string, title: string, favicon: string | null,
>   parentId: string | null, childIds: string[], status: NodeStatus,
>   createdAt: number, lastVisitedAt: number
> }
> type NodeStatus = 'live' | 'screenshot' | 'favicon-only' | 'culled'
> ```
> The BrowsingTree is the aggregate root. It owns all nodes and enforces tree invariants.
> `addChild(parentId, url)`: Creates a new child node under the given parent. The child is appended to `parentId.childIds`. The new node's status is initially `culled`.

**Build context:** vitest only (`npm test`). No Firefox build required.

**Acceptance criteria:**
- TreeNode type defined with all fields from S1.1
- NodeStatus type defined per S1.2
- BrowsingTree class with `rootId`, `nodes` Map, `focusedNodeId`
- `addChild(parentId, url)` creates a child node with unique ID, correct timestamps, status `culled`, and appends to parent's `childIds`
- Constructor creates a root node (parentId null, focused)
- Tests cover: adding a child, adding multiple children (order preserved), adding to nonexistent parent throws
- Files: `src/limb/domain/TreeNode.ts`, `src/limb/domain/BrowsingTree.ts`, `src/limb/domain/BrowsingTree.test.ts`

**Progress:** not-started

**Commits:**
