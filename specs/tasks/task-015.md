# Task 015: Wire LimbTreeView + frame loop to canvas

**Spec:** tree-rendering.md S1.2

**Spec excerpt:**

> Each frame:
> 1. Tick momentum (zoom/pan physics)
> 2. Compute LOD (which nodes are visible, at what tier)
> 3. Update tab visibility (show/hide/suspend tabs based on LOD)
> 4. Paint canvas (tree edges, node frames, screenshots, labels)
> 5. Position focused tab (transform to fill viewport when zoomed in)

**Depends on:** task-011, task-014

**Build context:** Requires `npm run build:ui`.

**Acceptance criteria:**
- `LimbTreeView.mjs` uses the domain FrameLoop for demand-driven rendering
- Frame callback follows the 5-step pipeline from the spec (stubs for steps not yet implemented)
- Canvas resizes with window
- `markDirty()` triggers a repaint
- Browser launches, canvas renders, frame loop runs only when dirty
- Integration point: LimbTreeView imports domain modules from `src/limb/domain/`

**Progress:** not-started

**Commits:**
