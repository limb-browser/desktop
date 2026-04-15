---
title: "Implement SessionStore tree persistence and restoration"
spec_ref: "persistence.md S1; tab-bridge.md S1.2"
depends_on:
  - task-003
  - task-008
progress: needs-revision
review: "specs/reviews/review-task-023-R1.md"
coverage_sections: []
commits: []
---

## Spec Excerpt

> Firefox's SessionStore already persists tab state, history, scroll position, and form data. Limb extends this with tree metadata:
> - `limb-node-id` attribute on each tab
> - `limb-tree-parent-id` for tree relationships
> - `limb-tree-created-at` timestamp
>
> On restore, Limb rebuilds the BrowsingTree from these attributes.
>
> Active branch nodes: SessionStore (in-memory + jsonlz4).

## Current State

TabBridge (task-008) sets `limb-node-id` on tabs. Firefox's SessionStore persists tab attributes. But tree relationships (`parentId`, `createdAt`) are not persisted, so the tree cannot be rebuilt after restart.

## What To Build

1. Extend TabBridge to set additional attributes on each tab element:
   - `limb-tree-parent-id` — the node's parent ID.
   - `limb-tree-created-at` — creation timestamp.
   - These attributes are automatically captured by SessionStore.
2. Modify the SessionStore patches (`src/browser/components/sessionstore/`) to ensure these custom attributes are included in session data collection and restoration.
3. Create `src/limb/tree/TreeRestorer.mjs`:
   - On browser startup, read all tabs' `limb-node-id`, `limb-tree-parent-id`, `limb-tree-created-at` attributes.
   - Reconstruct the BrowsingTree from these attributes.
   - Handle edge cases: missing attributes (pre-Limb tabs), orphaned nodes, missing parents.
4. Integrate with browser init: after SessionStore restores tabs, call TreeRestorer to rebuild the tree.
5. Write tests for:
   - Tree attributes are set on tab elements.
   - Tree can be reconstructed from restored tab attributes.
   - Orphaned tabs (missing parent) are handled gracefully.
   - Crash recovery preserves tree structure.
