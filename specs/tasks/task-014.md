# Task 014: Canvas + container structure in browser.xhtml

**Spec:** tree-rendering.md S1.1; patch-strategy.md S2.1, S2.4

**Spec excerpt:**

> The tree view is an HTML5 Canvas element in the Firefox chrome. It sits behind the tab content area.
> ```
> browser.xhtml
>   +-- limb-tree-canvas (Canvas 2D, full window, z-index below content)
>   +-- limb-content-deck (contains tab browser elements)
>   +-- limb-address-bar (overlay, visible when zoomed in)
> ```
> Patch browser.xhtml to add canvas element and Limb container elements. Add wrapper elements for tree view layout.

**Depends on:** task-013 (cleaner patch surface after Zen removal)

**Build context:** Requires `npm run build:ui`.

**Acceptance criteria:**
- `src/browser/base/content/browser-xhtml.patch` updated to add `limb-tree-canvas`, `limb-content-deck` container, `limb-address-bar` overlay
- Canvas element is full-window, z-indexed below tab content
- Container structure matches the spec hierarchy
- Patch includes comment header per patch-strategy S1.3 (what, why, spec reference)
- Browser launches and canvas element is present in DOM

**Progress:** not-started

**Commits:**
