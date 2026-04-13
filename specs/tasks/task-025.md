# Task 025: Node hover feedback + focus ring

**Spec:** interaction-feel.md S3.1, S3.2

**Spec excerpt:**

> Hover feedback (when cursor over node, zoomLevel < 0.9): node elevates 2px, title text opacity 70%→100%, transition 100ms ease-out.
> Focus ring: currently focused node has subtle persistent highlight (thin colored border or gentle glow) visible at all zoom levels. "You are here" indicator.

**Depends on:** task-016

**Build context:** Requires `npm run build:ui`.

**Acceptance criteria:**
- Canvas hit-testing detects which node the cursor is over
- Hovered node renders with 2px elevation effect and full-opacity title
- Hover transition is 100ms ease-out
- Focused node always has a visible colored border (focus ring)
- Focus ring visible at all zoom levels
- Hover and focus ring are distinct visual treatments

**Progress:** not-started

**Commits:**
