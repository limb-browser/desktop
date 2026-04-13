# Review: Task 003 - Round 1

## Findings

- [ ] **F1: Missing probe call for implicit focus change during removeNode** -- When `removeNode` implicitly changes `focusedNodeId` (because the focused node or a descendant was removed), no `nodeFocused` probe fires. The `nodeRemoved` probe communicates *what* was deleted but not *where focus moved to*, making the focus state transition unobservable through the probe. File: `src/limb/tree/BrowsingTree.ts:99`. Spec ref: `tree-model.md S2.2`.
- [ ] **F2: Missing invariant test for S4.6 (ordered children)** -- The `invariants` describe block covers S4.1--S4.5 but omits S4.6 ("childIds is ordered by createdAt of the child nodes"). The test at line 99 in the `addChild` block checks insertion order but does not verify the `createdAt`-ordering property as an invariant, and does not verify it holds after `removeNode`. File: `src/limb/tree/BrowsingTree.test.ts:326`. Spec ref: `tree-model.md S4`.
- [ ] **F3: getDescendants BFS test does not distinguish BFS from DFS** -- The test "returns subtree in breadth-first order" only asserts that root is first, child1 precedes grandchild, and child2 is present. A depth-first traversal (root, child1, grandchild, child2) also satisfies all three assertions. The test should verify the complete ordering (root, child1, child2, grandchild) to actually test BFS. File: `src/limb/tree/BrowsingTree.test.ts:250`. Spec ref: `tree-model.md S2.5`.

## Verdict

FAIL (3 findings)
