# Review: Task 036 - Round 1

## Findings

- [ ] **F1: Live-to-Screenshot cross-fade never applied to DOM** -- When a node transitions from Live/Focused tier to a Screenshot tier, `TabPositioner.computeFrame()` correctly computes cross-fade opacity values (1→0 over 150ms) in the `crossFades` map. However, `LimbTreeView.#applyTabPositions()` never applies these values because the node is excluded from both `focusedTab` and `liveTabs` once its tier changes to a screenshot tier. The "hide all other tabs" loop at line 817 immediately sets `visibility: hidden` on the browser element, causing an abrupt disappearance instead of a 150ms fade-out. The Screenshot-to-Live direction works correctly (the node enters `liveTabs` and its fade opacity is applied at line 810). The fix requires `#applyTabPositions` to check `posFrame.crossFades` before hiding a node -- if an active to-screenshot cross-fade exists, the element should remain visible with the fading opacity. File: `src/limb/tree/LimbTreeView.mjs:817`. Spec ref: `interaction-feel.md S7.1` ("No element should appear or disappear without an opacity transition of at least 100ms"), task item 4 ("cross-fade to the screenshot image").

- [ ] **F2: `setTabBridge` type annotation omits required `nodeToTab` property** -- The JSDoc type for `#tabBridge` at line 142 declares `{ getTabForNode(nodeId: string): any }`, and the `setTabBridge` parameter type at line 258 matches. However, `#applyTabPositions` at line 817 accesses `this.#tabBridge.nodeToTab` to iterate all mapped nodes for hiding. Any object satisfying the declared type but lacking `nodeToTab` would throw `TypeError` at runtime. The type must include `nodeToTab: Map<string, any>`. File: `src/limb/tree/LimbTreeView.mjs:142`. Spec ref: N/A (interface contract correctness).

## Verdict

FAIL (2 findings)
