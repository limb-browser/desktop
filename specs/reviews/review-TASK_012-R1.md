# Review: Task 012 - Round 1

## Findings

- [ ] **F1: `registerExistingTab` missing guard for already-mapped tab** -- `TabBridge.registerExistingTab` guards against `nodeToTab.has(nodeId)` (line 42) but does not guard against `tabToNode.has(tab)`. Unlike `createTabForNode` where the tab is freshly created by `openTab`, `registerExistingTab` accepts a pre-existing tab that could already be mapped to a different node. If called with a tab already in `tabToNode`, the map silently overwrites the old entry while the old node's `nodeToTab` entry becomes stale, breaking the bidirectional map invariant. The caller (`TabCommandRouter.handleExternalTabOpen:69`) checks `getNodeForTab(tab)` before calling, but the method itself should enforce the invariant -- `createTabForNode` enforces its own guard, and `registerExistingTab` should too. Add `if (this.tabToNode.has(tab)) throw ...` and a corresponding test. File: `src/limb/tree/TabBridge.ts:41`. Spec ref: `tab-bridge.md S4.1`.

- [ ] **F2: `LimbTabCommandAdapter.mjs` not loaded in browser chrome** -- `scripts/check-chrome-wiring.sh` reports this module is not loaded by `browser-init-js.patch` or `zen-assets.inc.xhtml`. Without chrome wiring, the `TabOpen` listener added by `install()` never runs, so the link interception and `window.open()` routing implemented in this task have no effect in the running browser. This was flagged in review-TASK_010-R1 F2 and marked `process-revision-complete`, but the wiring was never added. The task's deliverable (intercepting new-tab links as child nodes) does not function. File: `src/browser/base/content/browser-init-js.patch`. Spec ref: `tab-bridge.md S1.3`.

## Verdict

FAIL (2 findings)
