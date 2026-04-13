# Task 013: Remove Zen feature modules

**Spec:** patch-strategy.md S3.1, S3.2, S3.3, S3.4

**Spec excerpt:**

> Modules to remove: Workspaces/Spaces, Glance, Compact Mode, Split View, Folders, Live Folders, Mods, Welcome.
> For each module: delete directory from `src/zen/`, remove from `src/zen/moz.build` DIRS list, remove patches in `src/browser/` that only support the removed module, remove related prefs, remove references from `src/zen/common/`.
> After removing, audit patches for dead code (e.g., `zen-workspace-id` attributes without workspaces module).

**Depends on:** none (independent of domain tasks)

**Build context:** Requires full `npm run build` to verify no build errors.

**Acceptance criteria:**
- Directories deleted: `src/zen/spaces/`, `src/zen/glance/`, `src/zen/compact-mode/`, `src/zen/split-view/`, `src/zen/folders/`, `src/zen/live-folders/`, `src/zen/mods/`, `src/zen/welcome/`
- `src/zen/moz.build` updated (removed entries only reference kept modules)
- Patches in `src/browser/` that only supported removed modules are deleted or cleaned
- References in `src/zen/common/` (startup scripts, manifest) cleaned
- Related prefs removed from `prefs/`
- Build succeeds with no errors

**Progress:** not-started

**Commits:**
