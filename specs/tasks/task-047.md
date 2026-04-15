---
title: "Apply content deck CSS transform at zoom levels"
spec_ref: "chrome-integration.md S2.3; tree-rendering.md S3.1"
depends_on:
  - task-036
  - task-007
progress: complete
review: "specs/reviews/review-task-047-R1.md"
coverage_sections: []
commits: []
---

## Spec Excerpt

> **chrome-integration.md S2.3 Content Deck:**
> ```css
> #limb-content-deck {
>   position: relative;
>   z-index: 0;
>   flex: 1;
> }
> ```
> Wraps tabbrowser. Positioned/scaled by TabPositioner based on
> focused node's screen coordinates. At zoom >= 0.9: fills viewport
> (standard browsing). Lower zoom: TabPositioner transforms to show
> focused tab at tree position.

> **tree-rendering.md S3.1 Focused Tab Display:**
> When zoomLevel >= 0.9: focused tab's `<browser>` element
> positioned to fill viewport. Canvas still renders behind but
> mostly occluded.

> **tree-rendering.md S4.1 Zoom-Based Visibility:**
> | Zoom level | What's visible |
> |---|---|
> | >= 0.9 | Focused tab fills viewport, canvas behind |
> | 0.5 - 0.9 | Multiple nodes visible, canvas shows tree, focused tab smaller |
> | < 0.5 | Full tree visible, all nodes small |

## Current State

`TabPositioner.computeFrame()` (TabPositioner.mjs:102) correctly
computes positioning data: at zoom >= 0.9 the focused tab fills
the viewport (`width: viewportSize.width, height:
viewportSize.height`); at lower zoom, live tabs are positioned at
tree coordinates via `logicalToScreen()`.

`LimbTreeView.#applyTabPositions()` (LimbTreeView.mjs:1172)
applies these positions by setting `style.transform`,
`style.width`, and `style.height` on individual `<browser>`
elements. However, it **never references or transforms
`#limb-content-deck`** -- the wrapper div that contains the entire
tabbrowser.

Current behavior: at zoom < 0.9, individual browser elements are
translated to tree coordinates, but the content deck wrapper
remains at its default layout position (filling its flex parent).
The spec requires the content deck itself to be transformed so the
tabbrowser area is positioned and scaled to match the focused
node's location on the canvas.

## What To Build

1. In `LimbTreeView.init()`, acquire a reference to
   `document.getElementById("limb-content-deck")` and store it as
   a private field (e.g., `this.#contentDeck`).

2. In `#applyTabPositions()`, after computing the focused tab
   position, apply a CSS transform to `#limb-content-deck`:
   - **zoom >= 0.9:** Clear all transforms on the content deck
     (`transform = ""; width = ""; height = ""`). The deck fills
     the viewport normally. The focused `<browser>` element fills
     the deck at full size.
   - **zoom < 0.9:** Apply `transform: translate(Xpx, Ypx)
     scale(S)` to the content deck, where X/Y are the focused
     node's screen-space position and S is the ratio of the node's
     screen width to the viewport width. This places the entire
     tabbrowser area at the focused node's tree position on the
     canvas, scaled down to match the node frame size.

3. Set `transform-origin: 0 0` on `#limb-content-deck` in
   `limb-tree-canvas.css` so the transform math is predictable
   (top-left origin).

4. Ensure the content deck transition is smooth during zoom
   animation -- the transform updates every frame via the existing
   frame loop, so no CSS transition is needed (would fight the
   per-frame updates).

5. Update `TabPositioner.computeFrame()` return type to include a
   `contentDeckTransform` field (or compute it in
   `#applyTabPositions` directly from the existing `focusedTab`
   position data).

6. Write tests:
   - At zoom 1.0: content deck has no transform, fills viewport.
   - At zoom 0.5: content deck is translated and scaled to the
     focused node's screen position.
   - Zoom animation from 0.5 to 1.0: content deck transform
     interpolates smoothly each frame.
   - Content deck transform clears cleanly when returning to
     zoom >= 0.9.
