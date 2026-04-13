# Task 008: Zoom momentum physics

**Spec:** interaction-feel.md S1.1, S1.2, S1.3

**Spec excerpt:**

> Scroll-to-zoom has momentum. When the user releases, zoom continues decelerating smoothly.
> - Friction: zoom velocity halves every 120ms.
> - Minimum velocity: momentum stops below 0.001 zoom-units/ms.
> - Interruption: new input cancels active momentum immediately.
>
> Track last 3 scroll events within 150ms window for release velocity. Single ticks should NOT trigger momentum.
>
> Programmatic zoom (click-to-focus): 350ms duration, cubic-bezier(0.25, 0.1, 0.25, 1.0).

**Depends on:** task-006

**Build context:** vitest only.

**Acceptance criteria:**
- `ZoomMomentum` class tracks velocity from scroll events
- Exponential decay: velocity halves every 120ms
- Stops when velocity < 0.001 zoom-units/ms
- Velocity computed from last 3 events within 150ms window
- Single isolated scroll ticks do not trigger momentum
- New input cancels active momentum
- `tick(dt)` returns zoom delta for the frame
- Programmatic zoom easing: `easeZoom(t)` implements the specified cubic-bezier
- Tests cover: decay curve, minimum threshold, velocity tracking, interruption, single-tick rejection
- File: `src/limb/domain/momentum.ts`, `src/limb/domain/momentum.test.ts`

**Progress:** not-started

**Commits:**
