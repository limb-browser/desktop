---
title: "Remove testTreeData.mjs import from production bootstrap"
spec_ref: "chrome-integration.md S3.1"
depends_on: []
progress: not-started
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> **chrome-integration.md S3.1 browser-init.js onLoad:**
> 2. Import Limb modules (LimbTreeView, TabBridge, adapters)
>
> The bootstrap should import only production modules needed
> for the tree view lifecycle.

## Current State

`browser-init-js.patch` (line 22 of the patch) includes:

```js
ChromeUtils.importESModule(
  "chrome://browser/content/limb/tree/testTreeData.mjs",
  { global: "current" }
);
```

`testTreeData.mjs` exports `buildTestTreeData()`, a hardcoded
7-node tree used during initial development to verify the
rendering pipeline. The import's return value is never used in
the bootstrap — it is dead code.

The module is still registered in `jar.inc.mn` and used by tests,
but the production bootstrap should not import it.

## What To Build

1. Remove the `testTreeData.mjs` import from
   `browser-init-js.patch` (the 3-line `ChromeUtils.importESModule`
   block around line 22 of the patch).

2. Verify the module is NOT removed from `jar.inc.mn` — it may
   still be useful for debugging and is harmless as a registered
   but un-imported module.

3. Re-export the patch: edit `engine/browser/base/content/browser-init.js`,
   remove the import, run `npm run export -- browser/base/content/browser-init.js`.

4. Build and verify startup still works: `npm run build:ui && npm start`.
