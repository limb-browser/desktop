# Task 021: Click-to-focus + zoom animation

**Spec:** zoom-lod.md S3.1, S4.1; interaction-feel.md S5.1

**Spec excerpt:**

> Clicking a node in tree view (level < 0.9) sets it as focusedNodeId and animates zoom to level=1.0 centered on that node.
> Zoom animation: 300ms with ease-out timing (spec also says 350ms in interaction-feel — use 350ms). During animation, LOD tiers update each frame.
> During click-to-focus animation: other nodes scale down, target grows toward center, address bar fades in during last 30% of animation.

**Depends on:** task-018, task-019

**Build context:** Requires `npm run build:ui`.

**Acceptance criteria:**
- Clicking a node in tree view (when level < 0.9) triggers focus + zoom animation
- Animation: 350ms, cubic-bezier(0.25, 0.1, 0.25, 1.0)
- Zoom targets clicked node's center
- LOD tiers update each frame during animation
- Other nodes smoothly scale down during animation
- Address bar fades in during last 30% of animation
- Hit testing: canvas click correctly identifies which node was clicked

**Progress:** not-started

**Commits:**
