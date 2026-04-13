# Task 009: Pan momentum + boundary damping

**Spec:** interaction-feel.md S2.1, S2.2

**Spec excerpt:**

> Click-and-drag panning has momentum on release. Same friction model as zoom momentum.
> Pan velocity tracked as 2D vector { vx, vy }. Both axes decelerate independently.
>
> Boundary damping: Pan speed reduced 80% outside tree bounds. On release outside bounds, snap back with spring animation (200ms, ease-out). Tree should never fully leave viewport — at least 20% of tree bounding box remains visible.

**Depends on:** task-008 (shares friction model)

**Build context:** vitest only.

**Acceptance criteria:**
- `PanMomentum` class with 2D velocity tracking
- Same friction model as ZoomMomentum (extract shared physics)
- `tick(dt)` returns { dx, dy } pan delta
- Boundary damping: 80% speed reduction outside tree bounds
- Spring snapback on release outside bounds
- 20% minimum visibility constraint
- Tests cover: 2D decay, boundary damping factor, snapback animation, minimum visibility
- File: `src/limb/domain/momentum.ts` (extend), `src/limb/domain/pan-momentum.test.ts`

**Progress:** not-started

**Commits:**
