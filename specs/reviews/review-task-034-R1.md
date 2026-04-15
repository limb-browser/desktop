# Review: Task 034 - Round 1

## Findings

- [-] **F1: heapMB always 0 — uses Chrome-only `performance.memory` API in Firefox fork** [process-revision-complete] -- The patch snapshot callback uses `performance?.memory?.usedJSHeapSize ?? 0`, but `performance.memory` is a Chrome/V8-only API. Firefox does not expose it, even in privileged chrome context. The `?.` fallback means heapMB is always 0 in production. Firefox privileged code should use `Services.memory.heapAllocated` (nsIMemoryReporter) which is available and typed in `lib.gecko.xpcom.d.ts:17738`. File: `src/browser/base/content/browser-init-js.patch` (perfMonitor instantiation line). Spec ref: `performance.md S6.1`.

- [-] **F2: screenshotsMB hardcoded to 0 despite existing `getScreenshotMemoryUsage()` API** [process-revision-complete] -- The snapshot callback hardcodes `screenshotsMB: 0`, but `TreeStoragePort` declares `getScreenshotMemoryUsage(): Promise<number>` and both `TreeStorage` (line 394, SQL query) and `InMemoryTreeStorage` (line 204) implement it. The `treeStorage` instance is created 2 lines above the PerformanceMonitor instantiation in the patch, so the data is accessible. The async return type may require caching or making the snapshot callback async. File: `src/browser/base/content/browser-init-js.patch` (perfMonitor instantiation line). Spec ref: `performance.md S6.1`.

- [-] **F3: Dead LODComputer instance shares mutable probe state with tested instance** [process-revision-complete] -- The first test in the `performance probe: LOD computation timing` describe block creates `comp` (line 722) sharing the same `calls` array via `perfProbe` with `comp2` (line 742), but only `comp2` is used. Also creates a dangling `origCompute` binding (line 732) that is never referenced. Shared mutable state between an unused object and the SUT is a latent confusion bug per test setup hygiene. File: `src/limb/tree/LODComputer.test.ts:719-755`.

## Verdict

FAIL (3 findings)
