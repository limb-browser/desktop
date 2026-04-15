---
title: "Position tab browser elements based on zoom level and LOD tier"
spec_ref: "tree-rendering.md S3.1 S3.2 S4.1; zoom-lod.md S3.2; interaction-feel.md S7.1"
depends_on:
  - task-007
  - task-008
  - task-011
progress: ready-for-review
review: "specs/reviews/review-task-036-R1.md"
coverage_sections: []
commits: []
---

## Spec Excerpt

> When `zoomLevel >= 0.9`, the focused tab's `<browser>` element is positioned to fill the viewport. The canvas still renders behind it but is mostly occluded.
>
> Tabs at LOD tier Live but not focused are rendered as small browser elements positioned at their tree coordinates.
>
> When `level >= 0.9`, the focused node receives full input (mouse events, keyboard). Below `level = 0.9`, input goes to the tree canvas (for pan, click-to-focus, etc.).
>
> Tab appearance: cross-fade from screenshot to live content. No blank flash.

## Current State

ZoomState (task-007) provides zoom level and coordinate transforms. TabBridge (task-008) maps nodes to tabs. LODComputer (task-011) assigns tiers. But no code positions the actual `<browser>` DOM elements based on zoom level or controls input routing between canvas and tabs.

## What To Build

1. Create `src/limb/tree/TabPositioner.mjs`:
   - On each frame, position the focused tab's `<browser>` element using CSS transforms based on zoom level and viewport state.
   - At `level >= 0.9`: focused tab fills the viewport (transform to full width/height).
   - At intermediate zoom: focused tab scales down to its tree-coordinate size.
   - At low zoom: focused tab is hidden (canvas screenshot replaces it).
2. Position live non-focused tabs at their tree coordinates:
   - For each tab at Live LOD tier (but not focused), set CSS transform to position its `<browser>` element at the node's screen position and scale.
   - Respect the max live tabs limit from `limb.tree.max-live-tabs` pref.
3. Implement input mode switching:
   - When `level >= 0.9`: remove `pointer-events: none` from the focused tab, set it on the canvas.
   - When `level < 0.9`: set `pointer-events: none` on all tabs, enable pointer events on the canvas.
   - Transition must be clean — no frame where both canvas and tab accept input.
4. Implement cross-fade on tier transition:
   - When a tab transitions from Screenshot to Live: cross-fade from the screenshot image to the live browser element over 150ms.
   - When a tab transitions from Live to Screenshot: capture screenshot first, then cross-fade to the screenshot image.
5. Hide/show tab `<browser>` elements based on LOD tier:
   - Culled/Favicon/Screenshot tiers: `visibility: hidden` or `display: none` on the browser element.
   - Live/Focused tiers: visible and positioned.
6. Write tests for:
   - Focused tab fills viewport at zoom >= 0.9.
   - Focused tab scales down at intermediate zoom.
   - Input goes to tab at zoom >= 0.9, to canvas below 0.9.
   - Live non-focused tabs are positioned at tree coordinates.
   - Cross-fade occurs on tier transitions (no blank flash).
