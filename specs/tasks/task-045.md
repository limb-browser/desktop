---
title: "Add gZenMediaController to Zen global stubs"
spec_ref: "chrome-integration.md S1.1 S5.3"
depends_on:
  - task-002
progress: not-started
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> **S1.1 No Zen Dependencies:**
> No runtime code may reference gZenWorkspaces, gZenUIManager,
> gZenVerticalTabsManager, or other Zen globals.

> **S5.3 Zen Stubs:**
> `src/limb/tree/limb-zen-stubs.js` provides no-op globals for Zen
> references baked in the engine's base commit. If a `gZen*`
> ReferenceError appears, add the global name to the stubs file
> rather than guarding each call site.

## Current State

`limb-zen-stubs.js` stubs 12 Zen globals (gZenCommonActions,
gZenCompactModeManager, gZenFolders, gZenGlanceManager,
gZenPinnedTabManager, gZenSessionStore, gZenSiteDataPanel,
gZenUIManager, gZenVerticalTabsManager, gZenViewSplitter,
gZenWindowSync, gZenWorkspaces). However,
`src/browser/actors/WebRTCParent-sys-mjs.patch` line 9 calls
`browser.ownerGlobal.gZenMediaController.updateMediaSharing(state)`.
`gZenMediaController` is **not** in the stubs list, so any WebRTC
media-sharing state update will throw a ReferenceError.

## What To Build

1. Add `"gZenMediaController"` to the globals array in
   `src/limb/tree/limb-zen-stubs.js` (the `for...of` loop at
   line 34).
2. Verify the stub's Proxy handler already covers the
   `updateMediaSharing` method signature (it does -- the `get` trap
   returns `() => undefined` for any unrecognized property).
3. Grep the codebase for any other `gZen*` references not already
   stubbed. If found, add them to the same array.
4. No new tests required -- the stubs file is a global side-effect
   script. Confirm by running `npm run build:ui` and searching
   build output for "gZen" ReferenceErrors.
