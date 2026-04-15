---
title: "Implement screenshot capture and tab suspension/restoration"
spec_ref: "tree-rendering.md S3.3; tab-bridge.md S3.2 S3.3; zoom-lod.md S2.1; performance.md S4.2"
depends_on:
  - task-011
  - task-008
progress: ready-for-review
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> When a tab transitions from Live to Screenshot tier:
> 1. Capture a screenshot of the tab content (using `canvas.drawWindow()` or equivalent).
> 2. Store as JPEG at the appropriate resolution.
> 3. The tab can then be suspended/unloaded.
>
> Tabs that drop below Live LOD tier are suspended using Firefox's tab unloading. When they re-enter a higher tier, they reload.
>
> Low-res: 320px wide, JPEG quality 60. High-res: 1024px wide, JPEG quality 85.

## Current State

LOD computation (task-011) assigns tiers to nodes but nothing happens on tier transitions. Tabs remain active regardless of LOD tier.

## What To Build

1. Create `src/limb/tree/ScreenshotManager.mjs`:
   - `captureScreenshot(tab, resolution)` — captures tab content as JPEG blob.
   - Use Firefox's `canvas.drawWindow()` API (or `browser.drawSnapshot()` in newer versions).
   - Store screenshots in memory (keyed by node ID and resolution).
   - Two resolutions: low-res (320px wide, quality 60) and high-res (1024px wide, quality 85).
2. On LOD tier transition (Live → Screenshot):
   - Capture a screenshot at the appropriate resolution.
   - Suspend the tab using Firefox's tab discarding API.
3. On LOD tier transition (Screenshot → Live):
   - Restore the tab: reload from URL or SessionStore cache.
   - Update the node's status.
   - Capture a fresh screenshot once loaded.
4. Enforce preload budget (performance.md S4.2): limit preloading (warming up tabs approaching Live tier) to one concurrent preload at a time.
5. Update canvas rendering to draw screenshots for nodes at Screenshot-Low and Screenshot-High tiers.
6. Write tests for:
   - Screenshot is captured when a tab transitions to Screenshot tier.
   - Tab is suspended after screenshot capture.
   - Tab is restored when promoted back to Live tier.
   - Correct resolution is used for each tier.
