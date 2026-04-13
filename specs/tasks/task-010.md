# Task 010: Animation system

**Spec:** interaction-feel.md S4.1, S4.2, S4.3, S7.1, S7.4; zoom-lod.md S4.1, S4.2

**Spec excerpt:**

> Node addition: parent subtree shifts (200ms ease-in-out), new node fades in (150ms ease-out, 100ms delay), edge draws in (200ms ease-out).
> Node removal: node fades out (150ms), siblings fill gap (200ms ease-in-out after fade).
> Batch changes: all concurrent, total ≤ 400ms.
> Layout animation: positions animate 200ms ease-in-out. Add nodes fade in, remove nodes fade out.
> All animations use easing (no linear except opacity). No visual discontinuities. Concurrent animations use same time source, don't fight each other.

**Depends on:** task-005

**Build context:** vitest only.

**Acceptance criteria:**
- `Animation` class with start time, duration, easing function, progress tracking
- Standard easing functions: ease-out, ease-in-out, cubic-bezier(0.25, 0.1, 0.25, 1.0)
- `AnimationScheduler` manages concurrent animations with shared time source
- Layout transition animations: old positions → new positions over 200ms
- Node add/remove fade animations with correct timing and sequencing
- Batch mode: concurrent animations, capped at 400ms total
- Animation cancellation/interruption
- Tests cover: easing curves at key points, animation lifecycle, batch timing, cancellation
- File: `src/limb/domain/animation.ts`, `src/limb/domain/animation.test.ts`

**Progress:** not-started

**Commits:**
