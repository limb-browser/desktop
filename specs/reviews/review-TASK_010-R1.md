# Review: Task 010 - Round 1

## Findings

- [ ] **F1: CSS stylesheet not loaded in browser chrome** -- `limb-hide-tabbar.css` exists with correct rules (`display: none !important` on `#tabbrowser-tabs`, `#TabsToolbar`, `#zen-sidebar-tabs-wrapper`) but is never loaded. The established pattern is a `<link>` tag in `zen-assets.inc.xhtml` (line 26 loads `limb-tree-canvas.css`). No such tag was added for `limb-hide-tabbar.css`. The tab bar remains visible in the running browser. The test at `TabCommandRouter.test.ts:241-248` only verifies the file contents on disk, not that the CSS is active in the browser. File: `src/browser/base/content/zen-assets.inc.xhtml`. Spec ref: `tab-bridge.md S4.3` ("the tab bar is hidden").

- [ ] **F2: LimbTabCommandAdapter not wired into browser init** -- `LimbTabCommandAdapter.mjs` is never imported or instantiated. The established pattern for Limb browser chrome modules is `ChromeUtils.importESModule` in `browser-init-js.patch` (lines 10-15 load `LimbTreeView.mjs`). No equivalent wiring was added for `LimbTabCommandAdapter`. Without it, Ctrl+T/Ctrl+W continue to use Firefox defaults and orphan tab blocking does not happen. Note: wiring requires a BrowsingTree and TabBridge in the chrome context, which may need to be addressed alongside or before this fix. File: `src/browser/base/content/browser-init-js.patch`. Spec ref: `tab-bridge.md S4.3, S4.4`.

- [ ] **F3: Race condition between tree-initiated tab creation and orphan detection** -- In `LimbTabCommandAdapter.mjs`, the keydown handler (line 79) fire-and-forgets `handleNewTab()`. This calls `bridge.createTabForNode()`, which calls `tabPort.openTab()`. In Firefox, `gBrowser.addTab()` fires a synchronous `TabOpen` event during execution. The adapter's `#tabOpenHandler` (line 90) receives this event and calls `handleExternalTabOpen(e.target)`. At that point, `TabBridge.createTabForNode` has not yet executed `tabToNode.set(tab, node.id)` (line 26 of `TabBridge.ts`, after the `await`), so `getNodeForTab(tab)` returns `undefined` and the tab is closed as an orphan. Every Ctrl+T would create and immediately destroy a tab. The InMemoryTabPort doesn't fire DOM events, so tests cannot detect this. File: `src/limb/tree/LimbTabCommandAdapter.mjs:79,90`. Spec ref: `tab-bridge.md S4.3`.

## Verdict

FAIL (3 findings)
