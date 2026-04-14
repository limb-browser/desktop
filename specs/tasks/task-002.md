---
title: "Remove remaining conflicting Zen modules and clean up"
spec_ref: "patch-strategy.md S3.1 S3.3 S3.4"
depends_on:
  - task-001
progress: ready-for-review
review: "specs/reviews/review-TASK_002-R2.md"
coverage_sections: []
commits: []
---

## Spec Excerpt

> Modules to remove: Glance, Compact Mode, Split View, Folders, Live Folders, Mods, Welcome.
>
> After removing modules, audit remaining patches in `src/browser/` for dead code. A patch that adds a `zen-workspace-id` attribute is useless without the workspaces module. Remove the dead parts of patches, keeping only the hooks Limb needs.

## Current State

All seven modules exist in `src/zen/`:
- `glance/` — in moz.build DIRS, has actors, tests
- `compact-mode/` — NOT in moz.build DIRS, loaded via jar.inc.mn; `gZenCompactModeManager` in globals
- `split-view/` — NOT in moz.build DIRS, loaded via jar.inc.mn; `gZenViewSplitter` in globals
- `folders/` — NOT in moz.build DIRS; `gZenFolders` in globals
- `live-folders/` — in moz.build DIRS, has LiveFoldersComponents.manifest; `gZenLiveFoldersUI` in globals
- `mods/` — in moz.build DIRS, contains C++/IDL (nsZenModsBackend.cpp, ZenStyleSheetCache.cpp); requires full build
- `welcome/` — NOT in moz.build DIRS; loaded via jar.inc.mn

Related prefs exist in `prefs/zen/`: `glance.yaml`, `compact-mode.yaml` (as part of view.yaml), `split-view.yaml`, `folders.yaml`, `mods.yaml`, `welcome.yaml`.

`ZenComponents.manifest` references `live-folders/LiveFoldersComponents.manifest`.

## What To Build

1. Delete directories: `src/zen/glance/`, `src/zen/compact-mode/`, `src/zen/split-view/`, `src/zen/folders/`, `src/zen/live-folders/`, `src/zen/mods/`, `src/zen/welcome/`.
2. Remove `"glance"`, `"live-folders"`, `"mods"` from DIRS in `src/zen/moz.build`.
3. Remove their globals from `src/zen/zen.globals.mjs`: `gZenCompactModeManager`, `gZenGlanceManager`, `gZenViewSplitter`, `gZenFolders`, `gZenLiveFoldersUI`.
4. Remove `live-folders/LiveFoldersComponents.manifest` include from `src/zen/ZenComponents.manifest`.
5. Remove jar.inc.mn references in remaining modules that include deleted modules.
6. Delete related prefs: `prefs/zen/glance.yaml`, `prefs/zen/split-view.yaml`, `prefs/zen/folders.yaml`, `prefs/zen/mods.yaml`, `prefs/zen/welcome.yaml`. Audit `prefs/zen/compact-mode.yaml` if it exists separately.
7. Audit and clean patches in `src/browser/` for dead code referencing removed modules.
8. Build and verify no errors (`npm run build` — required due to C++ in mods/).
9. Write tests or verification confirming removed module code is gone and build succeeds.
