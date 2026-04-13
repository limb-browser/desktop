# Tree Model

## S1 Core Data Structure

### S1.1 TreeNode

A TreeNode represents a single browsing context (one webpage).

```typescript
interface TreeNode {
  id: string              // UUID, stable across sessions
  url: string             // Current URL of the page
  title: string           // Page title (from <title> tag), updated on navigation
  favicon: string | null  // Favicon URL, null if unavailable
  parentId: string | null // null only for root node
  childIds: string[]      // Ordered by creation time
  status: NodeStatus      // Current rendering tier
  createdAt: number       // Epoch ms
  lastVisitedAt: number   // Epoch ms
}
```

### S1.2 NodeStatus

```typescript
type NodeStatus = 'live' | 'screenshot' | 'favicon-only' | 'culled'
```

- `live`: A tab is rendering this node's content.
- `screenshot`: A captured image represents this node.
- `favicon-only`: Only the favicon and title are displayed.
- `culled`: Off-screen. No visual representation, no resources.

### S1.3 BrowsingTree

The BrowsingTree is the aggregate root. It owns all nodes and enforces tree invariants.

```typescript
interface BrowsingTree {
  rootId: string
  nodes: Map<string, TreeNode>
  focusedNodeId: string   // The node the user is currently "in"
}
```

## S2 Operations

### S2.1 addChild(parentId, url): TreeNode

Creates a new child node under the given parent. The child is appended to `parentId.childIds`. The new node's status is initially `culled` (the LOD system will promote it on the next frame).

**Invariants:**
- `parentId` must exist in the tree.
- The new node gets a unique ID.
- `createdAt` and `lastVisitedAt` are set to `Date.now()`.

### S2.2 removeNode(nodeId): void

Removes a node and all its descendants. Updates the parent's `childIds`.

**Invariants:**
- Cannot remove the root node.
- All descendant nodes are also removed.
- If the focused node is removed, focus moves to the removed node's parent.

### S2.3 focusNode(nodeId): void

Sets `focusedNodeId` to `nodeId`. Updates `lastVisitedAt` on the target node.

**Invariants:**
- `nodeId` must exist in the tree.

### S2.4 getAncestors(nodeId): TreeNode[]

Returns the path from the node to the root (inclusive), ordered child-to-root.

### S2.5 getDescendants(nodeId): TreeNode[]

Returns all nodes in the subtree rooted at `nodeId`, in breadth-first order.

### S2.6 getSubtreeDepth(nodeId): number

Returns the maximum depth of the subtree rooted at `nodeId`.

### S2.7 getSiblings(nodeId): TreeNode[]

Returns all children of the node's parent, excluding the node itself.

## S3 Layout

### S3.1 Layout Algorithm

The tree layout assigns (x, y) coordinates to each node for rendering. The layout is computed as pure data with no knowledge of screen coordinates or pixels.

**Input:** The BrowsingTree.
**Output:** A `Map<string, { x: number, y: number }>` in logical coordinates.

**Algorithm:** A top-down tree layout (similar to Reingold-Tilford):
- Root is at the top.
- Children are arranged below their parent, spaced horizontally.
- Sibling order matches `childIds` order (creation order).
- Subtrees do not overlap.

The layout is deterministic: same tree structure always produces the same coordinates.

### S3.2 Layout Invariants

- Every node in the tree has a position.
- No two nodes occupy the same position.
- A parent's y-coordinate is strictly less than all its children's y-coordinates (parent is above children).
- Sibling x-coordinates follow creation order (leftmost = first created).

## S4 Tree Invariants (Global)

These invariants hold at all times:

1. **Single root.** Exactly one node has `parentId === null`.
2. **Acyclic.** Following `parentId` from any node always reaches the root in finite steps.
3. **Referential integrity.** Every `parentId` references an existing node. Every entry in `childIds` references an existing node whose `parentId` points back.
4. **Unique IDs.** No two nodes share an ID.
5. **Exactly one focused node.** `focusedNodeId` always references an existing node.
6. **Ordered children.** `childIds` is ordered by `createdAt` of the child nodes.
