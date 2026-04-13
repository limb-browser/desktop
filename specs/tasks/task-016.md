# Task 016: Tree canvas rendering — edges, nodes, labels

**Spec:** tree-rendering.md S2.1, S2.2, S2.3, S2.4; interaction-feel.md S7.3

**Spec excerpt:**

> Node frames: rounded rectangles. Content depends on LOD tier (favicon, screenshot, live border, etc.).
> Edges: Bezier curves from bottom-center of parent to top-center of child. Subtle gray, 1-2px scaling with zoom.
> Labels: node titles below each frame when > 60px wide. Font scales with zoom. Truncated with ellipsis.
> Focus ring: colored border (~2px) on focused node at all zoom levels.
> Anti-aliasing enabled. Bezier curves smooth (no angular joints). Font rendering appropriate sizing.

**Depends on:** task-005, task-015

**Build context:** Requires `npm run build:ui`.

**Acceptance criteria:**
- Canvas paints node frames as rounded rectangles at computed layout positions
- Edges painted as Bezier curves between parent/child nodes
- Labels drawn below nodes when nodeScreenWidth > 60px, with ellipsis truncation
- Focus ring drawn on focused node
- Anti-aliasing enabled for strokes and curves
- Rendering uses LOD tiers to determine what to paint per node
- Visual verification: tree with 5+ nodes renders correctly in browser

**Progress:** not-started

**Commits:**
