# Review: Task 020 - Round 1

## Findings

- [ ] **F1: ScreenshotImage type lacks drawable image data** -- `ScreenshotImage` declares only `{ width, height }`. `LimbTreeView.mjs:496` casts the result of `getScreenshot()` to `CanvasImageSource` and passes it to `ctx.drawImage()`. The `InMemoryScreenshotCapturePort` returns a plain `{ width, height }` object that is NOT a valid `CanvasImageSource` -- `drawImage()` will throw `TypeError` at runtime. The spec says "Store as JPEG at the appropriate resolution" but only dimensions are stored, not image data. File: `src/limb/ports/ScreenshotCapturePort.ts:5`. Spec ref: `tree-rendering.md S3.3`.

- [ ] **F2: ScreenshotManager never invoked in production** -- `ScreenshotManager.onTierChanged` handles LOD tier transitions, but nothing in production calls it. `LODComputer.mjs:139` fires `probe.tierChanged()` for observability but this is not connected to `ScreenshotManager.onTierChanged()`. No code creates a `ScreenshotManager` instance. `setScreenshotManager()` has zero call sites. The module is tested but dead in production. File: `src/limb/tree/LimbTreeView.mjs:202`. Spec ref: `tree-rendering.md S3.3`.

- [ ] **F3: Tab restoration skips fresh screenshot capture** -- `tab-bridge.md S3.3` step 3: "Capture a fresh screenshot once loaded" after restoring a suspended tab. `ScreenshotManager.#restoreTab` (line 111) only calls `tabPort.restoreTab(tab)` -- it does not capture a screenshot afterward. No test asserts this behavior. File: `src/limb/tree/ScreenshotManager.mjs:111`. Spec ref: `tab-bridge.md S3.3`.

- [ ] **F4: Preload budget drops restores silently instead of deferring** -- `performance.md S4.2` says "limited to one concurrent preload at a time" -- implying serialization, not dropping. When the preload slot is occupied, `#restoreTab` (line 115) returns without restoring, queuing, or emitting a probe event. A node assigned Live tier by LODComputer will show with no active tab content. File: `src/limb/tree/ScreenshotManager.mjs:115`. Spec ref: `performance.md S4.2`.

## Verdict

FAIL (4 findings)
