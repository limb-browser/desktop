---
title: "Implement tab preloading budget"
spec_ref: "performance.md S4.2"
depends_on: []
progress: complete
review: "specs/reviews/review-task-050-R2.md"
coverage_sections: []
commits: []
---

## Spec Excerpt

> **performance.md S4.2 Preload Budget:**
> Preloading (warming up tabs that are approaching the Live tier)
> is limited to one concurrent preload at a time.

## Current State

`LODComputer.mjs` assigns LOD tiers based on node screen width.
When a node's tier transitions from Screenshot to Live, the
corresponding tab is restored/unsuspended by the tab lifecycle.

There is no preloading mechanism. Tabs only become live when they
cross the Live threshold (600px screen width). This means the
user may see a blank flash or loading delay when zooming in on
a node that was previously at Screenshot tier, because the tab
has to reload from scratch.

The spec calls for warming up ONE tab at a time when it
approaches the Live tier threshold, so that by the time it
crosses, the tab content is already loaded.

## What To Build

1. Create `TabPreloader.mjs` in `src/limb/tree/` — a domain
   module that decides which node to preload:

   - Input: current LOD tiers, node screen widths
   - Logic: find the node closest to the Live threshold (600px)
     that is currently at Screenshot-High tier (300-600px). If
     its screen width exceeds a preload threshold (e.g., 450px),
     mark it as the preload candidate.
   - Constraint: only one preload at a time. If a preload is
     already in progress, do not start another.
   - Output: `preloadNodeId: string | null`

2. Create `TabPreloaderProbe.ts` in `src/limb/ports/`:

   ```typescript
   export interface TabPreloaderProbe {
     preloadStarted(nodeId: string): void;
     preloadCompleted(nodeId: string): void;
     preloadCancelled(nodeId: string): void;
   }
   ```

3. Wire preloading in `LimbTreeView.#onFrame()` or in the LOD
   callback: after computing tiers, pass the tiers and screen
   widths to `TabPreloader`. If it returns a nodeId, call
   `tabBridge.syncFocusToTab()` (or a lighter preload-specific
   method) to warm up the tab without focusing it.

4. Register `TabPreloader.mjs` in `jar.inc.mn`.

5. Write tests:
   - With one node at 500px screen width (Screenshot-High),
     preloader returns it as the candidate.
   - With a preload already in progress, a second candidate is
     not preloaded (budget = 1).
   - When the preloaded node drops below 300px, the preload is
     cancelled and the tab is re-suspended.
