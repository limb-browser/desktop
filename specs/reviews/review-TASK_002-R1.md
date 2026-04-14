# Review: Task 002 - Round 1

## Findings

- [ ] **F1: Build-breaking `%include` of deleted compact-mode CSS** -- `vertical-tabs-topbar.inc.css` lines 22 and 31 use `%include ../../compact-mode/windows-captions-fix-active.inc.css` and `%include ../../compact-mode/windows-captions-fix-default.inc.css`, but the `compact-mode/` directory was deleted. These includes will fail at build time. File: `src/zen/tabs/zen-tabs/vertical-tabs-topbar.inc.css:22`. Spec ref: `patch-strategy.md S3.3`.

- [ ] **F2: Build-breaking `#include` of deleted split-view and glance XHTML** -- `zen-tabbrowser-elements.inc.xhtml` lines 7-8 include `../../../zen/split-view/zen-splitview-overlay.inc.xhtml` and `../../../zen/glance/zen-glance.inc.xhtml`, but both directories were deleted. These includes will fail at build time. File: `src/browser/base/content/zen-tabbrowser-elements.inc.xhtml:7`. Spec ref: `patch-strategy.md S3.3`.

- [ ] **F3: Dead SessionStore patch code references removed globals** -- `SessionStore-sys-mjs.patch` still calls `aWindow.gZenViewSplitter?.storeDataForSessionStore()` (line 238), `aWindow.gZenFolders?.storeDataForSessionStore()` (line 246), `aWindow.gZenFolders?.restoreDataFromSessionStore()` (line 284), and `aWindow.gZenViewSplitter?.restoreDataFromSessionStore()` (line 285). These globals were removed; the calls are always no-ops. Dead patch code per S3.4. File: `src/browser/components/sessionstore/SessionStore-sys-mjs.patch:238`. Spec ref: `patch-strategy.md S3.4`.

- [ ] **F4: Dead keyboard shortcuts for removed modules** -- `ZenKeyboardShortcuts.mjs` defines shortcut groups and keybindings for compact-mode (lines 129, 692-709, 1041-1042, 1128-1130, 1192), split-view (lines 132, 755-794, 1045-1048, 1101-1107, 1170), and glance (line 1086). All three modules were removed. These shortcuts bind to commands (`cmd_zenCompactModeToggle`, `cmd_zenSplitViewGrid`, etc.) that no longer exist. File: `src/zen/kbs/ZenKeyboardShortcuts.mjs:129`. Spec ref: `patch-strategy.md S3.3`.

- [ ] **F5: Dead folder UI in popups and search panel** -- `zen-panels/popups.inc` contains the entire `zenFolderActions` menupopup (lines 12-33) and folder-create menuitem (line 6). `zen-panels/folders-search.inc` is a complete dead file for folder search UI. `zen-popupset.inc.xhtml` still includes `folders-search.inc` (line 7). All reference the deleted folders module. File: `src/browser/base/content/zen-panels/popups.inc:12`. Spec ref: `patch-strategy.md S3.3`.

- [ ] **F6: Dead Glance settings UI in preferences** -- `zenLooksAndFeel.inc.xhtml` lines 66-93 contain a full Glance settings panel with checkbox and trigger-method dropdown, referencing preferences `zen.glance.enabled` and `zen.glance.activation-method` for the removed Glance module. File: `src/browser/components/preferences/zenLooksAndFeel.inc.xhtml:66`. Spec ref: `patch-strategy.md S3.3`.

- [ ] **F7: Dead drag-and-drop code references removed module attributes** -- `ZenDragAndDrop.js` has 18 remaining references to `split-view-group`, `zen-glance-tab`, and `isZenFolder` attributes/properties from removed modules (e.g. lines 42, 48, 744, 745, 1149, 1236, 1263). These checks guard logic paths that can never trigger. File: `src/zen/drag-and-drop/ZenDragAndDrop.js:42`. Spec ref: `patch-strategy.md S3.4`.

- [ ] **F8: Dead ZenWindowSync code references removed module attributes** -- `ZenWindowSync.sys.mjs` references `zen-glance-tab` (line 584), `split-view-group` (lines 1089, 1530), and `isZenFolder` (lines 1529, 1563) from removed modules. File: `src/zen/sessionstore/ZenWindowSync.sys.mjs:584`. Spec ref: `patch-strategy.md S3.4`.

- [ ] **F9: Dead ZenPinnedTabManager code references removed module attributes** -- `ZenPinnedTabManager.mjs` has 9 references to `split-view-group`, `isZenFolder`, and `zen-folder` from removed modules (lines 274, 696, 724, 759, 851, 903, 918, 921). File: `src/zen/tabs/ZenPinnedTabManager.mjs:274`. Spec ref: `patch-strategy.md S3.4`.

- [ ] **F10: Dead compact-mode toggle button in ZenCustomizableUI** -- `ZenCustomizableUI.sys.mjs` registers `zen-toggle-compact-mode` as default placement (line 21) and creates the toolbar button widget (lines 76-82) with `command="cmd_toggleCompactModeIgnoreHover"`. The compact-mode module and its commands were removed. File: `src/zen/common/sys/ZenCustomizableUI.sys.mjs:21`. Spec ref: `patch-strategy.md S3.3`.

- [ ] **F11: Dead compact-mode and split-view references in ZenUIManager** -- `ZenUIManager.mjs` still has compact-mode button migration code (lines 132-147, referencing `zen-toggle-compact-mode`) and `split-view-group` attribute checks (lines 1003, 1068). File: `src/zen/common/modules/ZenUIManager.mjs:132`. Spec ref: `patch-strategy.md S3.4`.

## Verdict

FAIL (11 findings)
