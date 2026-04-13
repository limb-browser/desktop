---
title: "Remove Zen Spaces/Workspaces module"
spec_ref: "patch-strategy.md S3.1"
depends_on: []
progress: complete
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> **Workspaces/Spaces** | `src/zen/spaces/` | Limb uses tree branches, not workspaces
>
> For each module to remove:
> 1. Delete the directory from `src/zen/`.
> 2. Remove it from `src/zen/moz.build` DIRS list.
> 3. Remove any patches in `src/browser/` that only exist to support the removed module.
> 4. Remove related preferences from `prefs/`.
> 5. Remove references from `src/zen/common/` (startup scripts, manifest).
> 6. Build and verify no errors.

## Current State

- `src/zen/spaces/` exists with 13 files (ZenSpaceManager.mjs, ZenSpace.mjs, etc.)
- `src/zen/moz.build` lists `"spaces"` in DIRS
- `src/zen/zen.globals.mjs` exports `gZenWorkspaces`, `ZenWorkspacesEngine`, `ZenWorkspaceBookmarksStorage`
- `src/browser/base/content/browser-init-js.patch` calls `gZenWorkspaces.selectStartPage()`
- `prefs/zen/workspaces.yaml` exists
- Workspace-related references exist in patches (e.g., `zen-workspace-id` attributes)

## What To Build

1. Delete `src/zen/spaces/` directory.
2. Remove `"spaces"` from DIRS in `src/zen/moz.build`.
3. Remove `gZenWorkspaces`, `ZenWorkspacesEngine`, `ZenWorkspaceBookmarksStorage` from `src/zen/zen.globals.mjs`.
4. Remove `gZenWorkspaces.selectStartPage()` call from `src/browser/base/content/browser-init-js.patch`.
5. Delete `prefs/zen/workspaces.yaml`.
6. Remove workspace-related references from other patches (search for `workspace` in `src/browser/`).
7. Build and verify no errors (`npm run build`).
8. Write a verification script or checklist confirming no remaining workspace references.
