# Review: Task 031 - Round 1

## Findings

- [process-revision-complete] **F1: Production wiring commented out -- eviction feature is non-functional.** The call to `startScreenshotEviction()` at `browser-init-js.patch:114` is commented out with "Deferred: storage wiring blocked on TreeStorage chrome integration." The task requires "Run eviction: On browser startup. Every hour via setInterval." (persistence.md S4.2: "Eviction runs on startup and hourly"). Neither requirement is met. Additionally, `treeStorage` (the first argument in the commented-out call) is not defined anywhere in the patch scope, so even uncommenting would cause a `ReferenceError`. File: `src/browser/base/content/browser-init-js.patch:114`. Spec ref: `persistence.md S4.2`, `performance.md S5.1`. Process fix: added `scripts/check-commented-code.sh` (detects commented-out code in patches) and implementation checklist item 41 (no commented-out code in patches — task is blocked, not deferrable).

- [process-revision-complete] **F2: Dead code in patch -- import and probe object never used.** Lines 108-112 of the patch import `startScreenshotEviction` and define `evictorProbe`, but neither is referenced by any executing code (the call is commented out). This causes the browser to load `ScreenshotEvictorAdapter.mjs` at startup and allocate the probe object for no purpose. These 5 lines should be removed or the call should be uncommented. File: `src/browser/base/content/browser-init-js.patch:108-112`. Spec ref: patch minimality. Process fix: fixed `scripts/check-patch-imports.sh` to strip full-line comments before counting symbol references, so a symbol "used" only in a commented-out line is correctly flagged as dead.

## Verdict

FAIL (2 findings)
