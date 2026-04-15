# Review: Task 050 - Round 1

## Findings

- [process-revision-complete] **F1: Module integration — TabPreloader not wired in production** — `setTabPreloader()` and `setTabPort()` on `LimbTreeView` have zero production callers. The `TabPreloader` is instantiated only in test code. In `#paint()`, the preload block is guarded by `if (this.#tabPreloader && this.#tiers)` — since `#tabPreloader` is always `null` in production, the entire preloading feature is dead at runtime. The browser-init-js.patch already wires sibling modules at lines 114-116 (`setTabPositioner`, `setTabBridge`, `setMaxLiveTabs`); the omission of `setTabPreloader`/`setTabPort` means the task's deliverable does not function. The patch must create a `TabPreloader` instance (with a probe), call `gLimbTreeView.setTabPreloader(preloader)`, and pass a `FirefoxTabPort` (or reuse the existing one) via `gLimbTreeView.setTabPort(tabPort)`. File: `src/limb/tree/LimbTreeView.mjs:331`, `src/browser/base/content/browser-init-js.patch`. Spec ref: `performance.md S4.2`.

## Verdict

FAIL (1 finding)
