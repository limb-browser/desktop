---
title: "Hide tab bar and route Ctrl+T/Ctrl+W through tree model"
spec_ref: "tab-bridge.md S4.3 S4.4"
depends_on:
  - task-008
progress: needs-revision
review: "specs/reviews/review-TASK_010-R1.md"
coverage_sections: []
commits: []
---

## Spec Excerpt

> **Node creation is the only way to create tabs.** Users cannot create tabs through Firefox's normal UI (the tab bar is hidden). `Ctrl+T` creates a child of the focused node.
>
> **Tab close goes through the tree.** `Ctrl+W` removes the node (which closes the tab), not the reverse.

## Current State

Review R1 found three issues. Two have been resolved by subsequent tasks:

- **F2 (adapter wiring)**: Fixed during task-012. `LimbTabCommandAdapter` is now imported via `ChromeUtils.importESModule` in `browser-init-js.patch:23-24`.
- **F3 (race condition)**: Fixed. `TabCommandRouter` uses a `#creatingTab` flag (line 14) to prevent `handleExternalTabOpen` from closing tree-initiated tabs as orphans.
- **F1 (CSS not loaded)**: STILL UNFIXED. `limb-hide-tabbar.css` exists at `src/limb/tree/limb-hide-tabbar.css` with correct rules (`display: none !important` on `#tabbrowser-tabs`, `#TabsToolbar`, `#zen-sidebar-tabs-wrapper`), but is never loaded in the browser. The tab bar remains visible.

## What To Build

1. Register `limb-hide-tabbar.css` in the resource manifest (`src/limb/jar.inc.mn`) so it is packaged as a chrome resource.
2. Add a `<link>` tag for `limb-hide-tabbar.css` in `src/browser/base/content/zen-assets.inc.xhtml` (same pattern as line 26 which loads `limb-tree-canvas.css`).
3. Verify the tab bar is hidden in the running browser after `npm run build:ui`.
4. Write or update tests verifying:
   - The CSS file is registered in `jar.inc.mn`.
   - The CSS file is linked in `zen-assets.inc.xhtml`.
