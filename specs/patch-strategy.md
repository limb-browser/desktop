# Patch Strategy

This spec defines which Firefox files Limb patches, why, and the principles for keeping patches small.

## S1 Principles

### S1.1 Minimize Patches

Every patch to Firefox source is maintenance debt. When Firefox releases a new version (every 4 weeks), patches must be rebased. Smaller patches rebase cleanly. Large patches cause merge conflicts.

**Rule:** If it can be done in `src/limb/` (new files), do it there. Only patch Firefox source when there is no alternative.

### S1.2 Prefer Hooks Over Rewrites

When patching, prefer adding a hook (a function call or event) that delegates to Limb code, rather than rewriting Firefox logic inline. This keeps the patch small and the Limb logic testable.

### S1.3 Document Every Patch

Each patch file in `src/browser/` must have a comment at the top explaining:
- What it changes
- Why it can't be done without patching
- Which spec section it implements

## S2 Required Patches

### S2.1 browser.xhtml

**What:** Add canvas element and Limb container elements to the main browser window.
**Why:** The tree canvas needs to be in the browser chrome, layered with the tab content.
**Spec:** tree-rendering.md

### S2.2 tabbrowser.js

**What:** Hook `addTab()`, `removeTab()`, and tab focus changes to notify the tree model.
**Why:** Limb needs to know when tabs are created/destroyed/focused to keep the tree in sync.
**Spec:** tab-bridge.md

### S2.3 SessionStore patches

**What:** Extend session data collection/restoration to include tree node metadata.
**Why:** Tree structure must survive restarts and crash recovery.
**Spec:** persistence.md

### S2.4 browser-xhtml container structure

**What:** Add wrapper elements for the tree view layout.
**Why:** The tree canvas and tab content areas need specific DOM structure for layering and visibility control.
**Spec:** tree-rendering.md

## S3 Zen Feature Removal

We inherit Zen's patches and feature modules. Zen features that Limb does not use must be removed to reduce maintenance burden during upstream rebases.

### S3.1 Modules to Remove

These live in `src/zen/` and have corresponding patches in `src/browser/`:

| Module | Directory | Why remove |
|---|---|---|
| Workspaces/Spaces | `src/zen/spaces/` | Limb uses tree branches, not workspaces |
| Glance | `src/zen/glance/` | Tab preview overlays, replaced by tree LOD |
| Compact Mode | `src/zen/compact-mode/` | Auto-hiding UI, not relevant to tree view |
| Split View | `src/zen/split-view/` | Multi-pane browsing, conflicts with tree model |
| Folders | `src/zen/folders/` | Tab grouping, replaced by tree hierarchy |
| Live Folders | `src/zen/live-folders/` | Dynamic tab groups, replaced by tree |
| Mods | `src/zen/mods/` | Zen's theme/mod system |
| Welcome | `src/zen/welcome/` | Zen's onboarding, replaced by Limb launcher |

### S3.2 Modules to Keep (Initially)

| Module | Directory | Why keep |
|---|---|---|
| Common | `src/zen/common/` | Startup, theming baseline, utility code |
| Tabs | `src/zen/tabs/` | Tab management hooks we build on |
| Urlbar | `src/zen/urlbar/` | URL bar customizations we may extend |
| SessionStore | `src/zen/sessionstore/` | Session persistence hooks we need |
| Toolkit | `src/zen/toolkit/` | Core toolkit patches |

### S3.3 Removal Process

For each module to remove:
1. Delete the directory from `src/zen/`.
2. Remove it from `src/zen/moz.build` DIRS list.
3. Remove any patches in `src/browser/` that only exist to support the removed module.
4. Remove related preferences from `prefs/`.
5. Remove references from `src/zen/common/` (startup scripts, manifest).
6. Build and verify no errors.

### S3.4 Patch Cleanup

After removing modules, audit remaining patches in `src/browser/` for dead code. A patch that adds a `zen-workspace-id` attribute is useless without the workspaces module. Remove the dead parts of patches, keeping only the hooks Limb needs.

## S4 Upstream Tracking

### S4.1 Rebase Process

When Zen merges a new Firefox version:
1. Fetch from `upstream` (zen-browser/desktop).
2. Rebase our `dev` branch on top.
3. Resolve conflicts (primarily in patches we've modified).
4. Run the build. Run tests.
5. If Zen has removed or changed patches we depend on, adapt.

### S4.2 Frequency

Track Zen's `dev` branch. Rebase at least once per Zen stable release. For security patches, rebase immediately.
