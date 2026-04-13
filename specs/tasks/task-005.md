# Task 005: Tree layout algorithm

**Spec:** tree-model.md S3.1, S3.2

**Spec excerpt:**

> The tree layout assigns (x, y) coordinates to each node for rendering. The layout is computed as pure data.
> **Input:** The BrowsingTree. **Output:** A `Map<string, { x: number, y: number }>` in logical coordinates.
> **Algorithm:** Top-down tree layout (similar to Reingold-Tilford): Root at top. Children below parent, spaced horizontally. Sibling order matches `childIds` order. Subtrees do not overlap. Deterministic: same structure always produces same coordinates.
>
> **Layout Invariants:**
> - Every node has a position.
> - No two nodes at the same position.
> - Parent y < all children y.
> - Sibling x follows creation order (leftmost = first created).

**Depends on:** task-001

**Build context:** vitest only.

**Acceptance criteria:**
- `computeLayout(tree)` returns `Map<string, { x: number, y: number }>`
- Implements Reingold-Tilford (or equivalent non-overlapping tree layout)
- All 4 layout invariants hold for any valid tree
- Deterministic: same input always produces same output
- Tests cover: single node, linear chain, balanced tree, unbalanced tree, wide tree
- Tests verify all layout invariants programmatically
- File: `src/limb/domain/layout.ts`, `src/limb/domain/layout.test.ts`

**Progress:** not-started

**Commits:**
