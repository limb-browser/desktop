# Task 004: Tree invariant validation

**Spec:** tree-model.md S4

**Spec excerpt:**

> These invariants hold at all times:
> 1. **Single root.** Exactly one node has `parentId === null`.
> 2. **Acyclic.** Following `parentId` from any node always reaches the root in finite steps.
> 3. **Referential integrity.** Every `parentId` references an existing node. Every entry in `childIds` references an existing node whose `parentId` points back.
> 4. **Unique IDs.** No two nodes share an ID.
> 5. **Exactly one focused node.** `focusedNodeId` always references an existing node.
> 6. **Ordered children.** `childIds` is ordered by `createdAt` of the child nodes.

**Depends on:** task-001, task-002, task-003

**Build context:** vitest only.

**Acceptance criteria:**
- `validateInvariants()` method on BrowsingTree that checks all 6 invariants
- Returns a list of violations (empty = valid)
- Tests verify each invariant is detected when violated (construct invalid states directly)
- Tests verify valid trees pass
- Consider calling validateInvariants in test afterEach hooks for all BrowsingTree tests

**Progress:** not-started

**Commits:**
