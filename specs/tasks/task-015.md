---
title: "Implement address bar visibility tied to zoom level"
spec_ref: "navigation.md S2.1 S2.2 S2.4"
depends_on:
  - task-007
progress: ready-for-review
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> The address bar is visible when `zoomLevel >= 0.85`. It fades in over the range `[0.85, 0.95]` (opacity 0.0 at 0.85, opacity 1.0 at 0.95). Below 0.85, no address bar is shown.
>
> The address bar displays: focused node's favicon, current URL (editable), back/forward buttons, reload button.

## Current State

Firefox's built-in urlbar exists (Zen's urlbar patches are in place). ZoomState (task-007) provides the current zoom level. The urlbar is always visible regardless of zoom.

## What To Build

1. Create a CSS class or stylesheet that controls urlbar visibility based on a `limb-zoom-level` attribute on the browser window or a container element.
2. When zoom level changes (via ZoomState observer):
   - Set the urlbar container's opacity: 0.0 below 0.85, linearly interpolated between 0.85-0.95, 1.0 above 0.95.
   - When opacity is 0.0, also set `pointer-events: none` to prevent interaction.
3. Handle `Ctrl+L` when zoomed out (navigation.md S2.4):
   - `Ctrl+L` is a keyboard shortcut, so it bypasses `pointer-events: none` and focuses the invisible urlbar.
   - When `Ctrl+L` fires and `zoomLevel < 0.85`, auto-zoom to 0.95 (enough for full urlbar visibility) before focusing the urlbar.
   - This ensures the user can always invoke the address bar via keyboard regardless of zoom level.
4. Ensure the urlbar displays the focused node's URL (this may already work via Firefox's native tab-urlbar sync).
5. Add CSS transition for smooth opacity changes (don't rely on per-frame JS for the fade).
6. Write tests verifying:
   - At zoom 1.0, address bar is fully visible.
   - At zoom 0.5, address bar is hidden.
   - At zoom 0.9, address bar is at 50% opacity.
   - Address bar is not interactive when hidden.
   - Ctrl+L when zoomed out auto-zooms to reveal the address bar.
