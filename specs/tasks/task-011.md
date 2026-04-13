# Task 011: Demand-driven frame loop

**Spec:** performance.md S3.3

**Spec excerpt:**

> The frame loop should NOT run at unconditional 60fps. Instead:
> - Run frames only when something changed (zoom, pan, animation, tree mutation).
> - After 30 idle frames (~500ms), stop scheduling frames entirely.
> - Resume on input events or state changes via a `markDirty()` call.

**Depends on:** task-006

**Build context:** vitest only.

**Acceptance criteria:**
- `FrameLoop` class with `markDirty()`, `start()`, `stop()`
- Calls a render callback only when dirty
- Counts idle frames; stops after 30 consecutive idle frames
- Resumes on `markDirty()` after idle stop
- Uses `requestAnimationFrame` (mockable in tests)
- Tests cover: dirty triggers frame, idle countdown, auto-stop, resume after idle
- File: `src/limb/domain/frame-loop.ts`, `src/limb/domain/frame-loop.test.ts`

**Progress:** not-started

**Commits:**
