---
title: "Add limb-tree-canvas to browser.xhtml and wire initialization"
spec_ref: "tree-rendering.md S1.1"
depends_on:
  - task-002
progress: ready-for-review
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> The tree view is an HTML5 Canvas element rendered in the Firefox chrome (the browser UI layer, not web content). It sits behind the tab content area and becomes visible when zoomed out.
>
> ```
> browser.xhtml
>   +-- limb-tree-canvas (Canvas 2D, full window, z-index below content)
>   +-- limb-content-deck (contains tab browser elements)
>   +-- limb-address-bar (overlay, visible when zoomed in)
> ```

## Current State

- `src/browser/base/content/browser-xhtml.patch` exists (Zen's patch adding `zen-main-app-wrapper`).
- `src/browser/base/content/browser-box-inc-xhtml.patch` defines the browser chrome structure.
- `src/limb/tree/LimbTreeView.mjs` exists as a stub.
- No canvas element exists in the browser chrome yet.

## What To Build

1. Modify `src/browser/base/content/browser-box-inc-xhtml.patch` (or create a new Limb-specific patch) to add:
   - `<html:canvas id="limb-tree-canvas">` as a full-window element behind the content deck, with appropriate z-index.
   - A wrapper `<html:div id="limb-content-deck">` around the tabbrowser-tabbox.
2. Add CSS for the canvas element: full window size, positioned absolutely behind content.
3. Modify `src/browser/base/content/browser-init-js.patch` to initialize LimbTreeView on browser load:
   - Import LimbTreeView.
   - Call `init()` with the canvas element after DOM ready.
4. Verify the canvas renders (the existing placeholder text from LimbTreeView.mjs should be visible when the browser opens).
5. Build with `npm run build:ui` and verify visually that the canvas appears behind the browser content.
