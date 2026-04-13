# Task 012: Performance probes

**Spec:** performance.md S6.1, S2.3

**Spec excerpt:**

> The `PerformanceProbe` interface emits:
> - `frameBudgetExceeded(actualMs, budgetMs)` when a frame takes longer than 16ms.
> - `lodComputationTime(ms)` per frame.
> - `memorySnapshot(heapMB, screenshotsMB, tabCount)` periodic report.
>
> LOD frame skipping: If LOD computation > 4ms, process only highest-priority nodes this frame. Priority: focused > ancestors > siblings > descendants > distant.

**Depends on:** task-007

**Build context:** vitest only.

**Acceptance criteria:**
- `PerformanceProbe` interface with the 3 methods above
- `ConsoleProbe` implementation that logs warnings
- `NullProbe` implementation for tests (collects events for assertion)
- LOD priority ordering: focused > ancestors > siblings > descendants > distant
- `prioritizeNodes(tree, focusedNodeId)` returns nodes in priority order
- Tests verify priority ordering for various tree shapes
- File: `src/limb/domain/probes.ts`, `src/limb/domain/probes.test.ts`

**Progress:** not-started

**Commits:**
