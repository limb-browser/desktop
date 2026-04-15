---
title: "Implement auto-save triggers"
spec_ref: "persistence.md S3"
depends_on:
  - task-023
progress: ready-for-review
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> The active branch auto-saves on:
> - Node addition or removal
> - Focus change
> - URL/title update
> - Every 30 seconds (periodic flush)
> - App quit / window close

## Current State

SessionStore tree persistence (task-023) can save and restore tree data via tab attributes. But saves only happen on Firefox's default SessionStore schedule, not on tree-specific events.

## What To Build

1. Create save trigger hooks in BrowsingTree:
   - After `addChild()`: trigger save.
   - After `removeNode()`: trigger save.
   - After `focusNode()`: trigger save.
   - After URL/title update: trigger save.
2. Implement periodic flush:
   - Set up a 30-second interval timer.
   - On each tick, flush tree state to SessionStore.
3. Hook into browser quit/close events:
   - Listen for `quit-application-requested` or `browser-lastwindow-close-requested` observer.
   - Save tree state before shutdown.
4. Debounce rapid saves: if multiple triggers fire within 1 second, batch them into a single save.
5. Write tests for:
   - Save is triggered on each tree operation.
   - Periodic flush fires every 30 seconds.
   - Rapid operations are debounced.
   - Save occurs before app quit.
