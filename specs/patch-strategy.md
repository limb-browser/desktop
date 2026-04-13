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

## S3 Patches We Inherit from Zen

We inherit Zen's patches initially. Over time, we will:
1. Remove patches for Zen features we don't use (workspaces, folders, glance, compact-mode, split-view).
2. Keep patches for infrastructure we build on (startup, theming baseline, tabbrowser hooks).
3. Add our own patches for tree-specific integration.

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
