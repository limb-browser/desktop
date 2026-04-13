# Task 006: ZoomState + viewport projection

**Spec:** zoom-lod.md S1.1, S1.2, S1.3

**Spec excerpt:**

> ```typescript
> interface ZoomState {
>   level: number           // 0.0 (fully zoomed out) to 1.0 (fully zoomed in)
>   focusPoint: { x, y }   // Center of viewport in tree-logical coordinates
>   viewportSize: { width, height }  // Physical pixels
> }
> ```
> Zoom range: `level` clamped to `[0.0, 1.0]`. At 1.0: focused node fills viewport. At 0.0: entire tree fits viewport.
> `nodeScreenWidth = baseNodeWidth * zoomScale` where zoomScale derived from level such that at level=1.0, focused node width = viewport width.

**Depends on:** task-005

**Build context:** vitest only.

**Acceptance criteria:**
- ZoomState type with level, focusPoint, viewportSize
- `logicalToScreen(point, zoomState)` transforms logical coordinates to screen pixels
- `screenToLogical(point, zoomState)` inverse transform
- `computeNodeScreenWidth(nodeLogicalPos, zoomState)` returns pixel width
- At level=1.0, focused node fills viewport width
- At level=0.0, entire tree fits in viewport
- Level is clamped to [0.0, 1.0]
- Tests verify transforms round-trip, boundary zoom levels, clamping
- File: `src/limb/domain/zoom.ts`, `src/limb/domain/zoom.test.ts`

**Progress:** not-started

**Commits:**
