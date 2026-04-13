# Task 019: Zoom interaction — Ctrl+Scroll + pinch wiring

**Spec:** zoom-lod.md S1.2, S3.3; interaction-feel.md S5.3; navigation.md S4.1

**Spec excerpt:**

> Ctrl+Scroll (or trackpad pinch): continuously adjusts zoom level. Scroll up = zoom in, down = zoom out.
> When level < 0.9, click-and-drag pans the viewport (adjusts focusPoint).
> Cursor anchoring: the point under the cursor stays fixed on screen during zoom (like Google Maps / Figma).
> Shortcuts: Ctrl+0 = fit tree, Ctrl+1 = zoom 100% on focused node.

**Depends on:** task-008, task-015

**Build context:** Requires `npm run build:ui`.

**Acceptance criteria:**
- Ctrl+Scroll events update ZoomState.level via ZoomMomentum
- Trackpad pinch events mapped to zoom
- Cursor anchoring: zoom expands/contracts around cursor position
- Click-and-drag pans when level < 0.9 (via PanMomentum)
- Ctrl+0 resets zoom to fit tree; Ctrl+1 zooms to focused node
- Input events route to tree canvas when level < 0.9, to tab when >= 0.9

**Progress:** not-started

**Commits:**
