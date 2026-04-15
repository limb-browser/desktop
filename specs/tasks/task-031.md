---
title: "Implement screenshot eviction and memory management"
spec_ref: "persistence.md S4.2; performance.md S5.1"
depends_on:
  - task-020
  - task-024
  - task-027
progress: needs-revision
review: "specs/reviews/review-task-031-R1.md"
coverage_sections: []
commits: []
---

## Spec Excerpt

> Screenshot retention:
> - Active branch: all screenshots kept.
> - Last 7 days: all screenshots kept.
> - Older: branch root screenshot only.
>
> Eviction runs on startup and hourly.
>
> If total screenshot memory exceeds 20MB, evict the oldest screenshots from culled-tier nodes.

## Current State

ScreenshotManager (task-020) captures and stores screenshots in memory. Auto-save (task-024) persists tree state. But there's no eviction policy — screenshots accumulate indefinitely.

## What To Build

1. Extend ScreenshotManager with eviction logic:
   - Track total screenshot memory usage (sum of blob sizes).
   - If total exceeds 20MB, evict screenshots starting from culled-tier nodes, oldest first.
2. Implement time-based retention:
   - Branches older than `limb.screenshots.retention-days` (default 7): keep only root screenshot.
   - Active branch and branches within retention window: keep all screenshots.
3. Run eviction:
   - On browser startup.
   - Every hour via `setInterval`.
4. Integrate with `limb.screenshots.retention-days` preference.
5. Write tests for:
   - Eviction removes screenshots when memory exceeds 20MB.
   - Old branches retain only root screenshot.
   - Recent branches retain all screenshots.
   - Eviction runs on startup and hourly.
