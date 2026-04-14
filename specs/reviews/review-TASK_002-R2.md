# Review: Task 002 - Round 2

## Findings

- [ ] **F1: Build-breaking syntax error in ZenWindowSync.sys.mjs** -- The R1 fix left a stray `});` in `on_ZenSplitViewTabsSplit`, causing a `SyntaxError: Unexpected token ')'` (confirmed via `node -c`). This prevents the entire module from loading, breaking window sync. The dead split-view event handlers (`on_ZenSplitViewTabsSplit`, `on_ZenTabRemovedFromSplit`) and their event registrations (lines 68-69) should be removed entirely. File: `src/zen/sessionstore/ZenWindowSync.sys.mjs:1581`. Spec ref: `patch-strategy.md S3.3`.

- [ ] **F2: Dead glance-tab references in tabbrowser-js.patch** -- The patch filters `zen-glance-tab` in `_numVisiblePinTabsWithoutCollapsed` (lines 30, 34), `_numZenEssentials` (lines 54, 57), `pinnedTabCount` (lines 67, 70), and `tabsWithoutGlance` (line 76). The Glance module was removed; no tab will ever have this attribute. These checks are always false and bloat the patch. File: `src/browser/components/tabbrowser/content/tabbrowser-js.patch:30`. Spec ref: `patch-strategy.md S3.4`.

- [ ] **F3: Dead split-view-group references in tabbrowser-js.patch** -- The patch adds `forSplitView` parameter to `createTabGroup` (line 329), sets `split-view-group` attribute (line 349), checks `isZenFolder` (line 353), and guards logic on `split-view-group` in 10+ locations (lines 453, 507, 774, 780, 783, 794, 801, 843, 889). The Split View module was removed; `forSplitView` is never true and no group will have this attribute. These are dead code paths. File: `src/browser/components/tabbrowser/content/tabbrowser-js.patch:349`. Spec ref: `patch-strategy.md S3.4`.

- [ ] **F4: Dead glance/live-folder/split-view state in SessionStore patches** -- `SessionStore-sys-mjs.patch` sets `zenIsGlance = false` and `zenGlanceId = null` (lines 185-186). `TabState-sys-mjs.patch` persists `zenGlanceId`, `zenIsGlance`, and `zenLiveFolderItemId` (lines 17-18, 21). `TabGroupState-sys-mjs.patch` persists `splitView` attribute (line 11). All three modules were removed; this data is never read. File: `src/browser/components/sessionstore/TabState-sys-mjs.patch:17`. Spec ref: `patch-strategy.md S3.4`.

- [ ] **F5: Dead glance references in tab-js.patch and tabbox-js.patch** -- `tab-js.patch` adds a `glanceTab` getter that queries `tab[zen-glance-tab]` (line 137) and checks `zen-glance-background` CSS class in `_visuallySelected` (line 51). `tabbox-js.patch` filters `zen-glance-tab` (line 58). Glance was removed; these always return null / are always false. File: `src/browser/components/tabbrowser/content/tab-js.patch:137`. Spec ref: `patch-strategy.md S3.4`.

- [ ] **F6: Dead live-folder references in ZenSessionStore.mjs and ZenWindowSync.sys.mjs** -- `ZenSessionStore.mjs` restores `zenLiveFolderItemId` attribute onto tabs (lines 17-19). `ZenWindowSync.sys.mjs` syncs `zen-live-folder-item-id` attribute between windows (lines 536-554) and references live folders in comments (line 1570). Live Folders was removed; no tab will have this attribute. File: `src/zen/common/modules/ZenSessionStore.mjs:17`. Spec ref: `patch-strategy.md S3.3`.

- [ ] **F7: Dead split-view drag-and-drop code in ZenDragAndDrop.js** -- Pref getters for `zen.splitView.enable-drag-over-split`, `zen.splitView.drag-over-split-threshold`, `zen.splitView.drag-over-split-delayMC` (lines 82-96). The `#handle_tabDragOverToSplit` method (lines 710-789) and `#createFakeTabSplit` (line 791+) use these prefs to create split-view interactions. Split View was removed; this entire code path is dead. File: `src/zen/drag-and-drop/ZenDragAndDrop.js:83`. Spec ref: `patch-strategy.md S3.3`.

- [ ] **F8: Dead split-view references in ZenWindowSync and ZenSessionManager** -- `ZenWindowSync.sys.mjs` references `tab?.splitView` (line 1313) and calls the broken `on_ZenSplitViewTabsSplit` handler (line 1314). `ZenSessionManager.sys.mjs` manages `splitViewData` throughout session restore/save (lines 753, 781-785, 795) and references `folders` (lines 752, 800, 805). Both Split View and Folders were removed. File: `src/zen/sessionstore/ZenWindowSync.sys.mjs:1313`. Spec ref: `patch-strategy.md S3.3`.

- [ ] **F9: Dead split-view-group references in drag-and-drop-js.patch, tabs-js.patch, tabgroup-js.patch** -- `drag-and-drop-js.patch` checks `split-view-group` in `elementToMove` (line 9) and `#getTarget` (line 167). `tabs-js.patch` checks `split-view-group` in `ariaFocusableItems` (line 151). `tabgroup-js.patch` guards `collapsed` setter on `split-view-group` (line 136). No group will have this attribute. File: `src/browser/components/tabbrowser/content/drag-and-drop-js.patch:9`. Spec ref: `patch-strategy.md S3.4`.

- [ ] **F10: Dead CSS for removed modules** -- `zen-browser-ui.css` has `.zen-split-view-splitter` rules (lines 248-299). `zen-browser-container.css` excludes `.zen-glance-overlay` (line 10). `vertical-tabs.css` filters `zen-glance-tab` and references undefined `--zen-folder-indent` variable (lines 326-327), and has 55 lines of glance tab styles (lines 373-452). `icons.css` defines `.zen-glance-sidebar-close`, `.zen-glance-sidebar-open`, `.zen-glance-sidebar-split` (lines 40, 265, 445). All reference removed modules. File: `src/zen/common/styles/zen-browser-ui.css:248`. Spec ref: `patch-strategy.md S3.4`.

## Verdict

FAIL (10 findings)
