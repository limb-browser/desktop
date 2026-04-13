# Review: Task 035 - Round 1

## Findings

- [ ] **F1: Missing notification bar UI** -- Task item 2 requires "Display warnings as Firefox notification bars" with specific message text ("Your tree has 100+ pages...") and a "Show branches" button at 200 nodes. Only domain-layer probe emissions (`treeSizeWarning`, `treeSizeSuggestion`) are implemented. No `NotificationPort` interface, no `TreeSizeNotificationHandler`, and no Firefox chrome adapter exist. The probes fire but nothing subscribes to display notifications. This is missing required behavior. File: `src/limb/tree/BrowsingTree.ts:71-78`. Spec ref: `performance.md S5.2`, task item 2.

- [ ] **F2: Threshold spec drift — `>=` instead of `>`** -- `performance.md S5.2` says "Warn when the tree exceeds 100 nodes" and "Above 200 nodes, suggest closing unused branches." Both "exceeds" and "above" mean strictly greater than (`>`). Implementation uses `>=` (`this.nodes.size >= 100` and `this.nodes.size >= 200`), firing at exactly 100 and 200 nodes respectively. Tests assert warning at 100 nodes and suggestion at 200 nodes, should be 101 and 201. File: `src/limb/tree/BrowsingTree.ts:71,75`. Spec ref: `performance.md S5.2`.

## Verdict

FAIL (2 findings)
