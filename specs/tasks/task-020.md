# Task 020: LOD tier transitions + tab visibility management

**Spec:** zoom-lod.md S2.1-S2.4; tree-rendering.md S4.1, S4.2; performance.md S4.1

**Spec excerpt:**

> On every frame (or zoom/pan change): compute nodeScreenWidth, determine visibility, assign tiers, apply hysteresis, emit transitions to probe.
> Zoom-based visibility: >= 0.9 focused fills viewport; 0.5-0.9 multiple nodes; < 0.5 full tree.
> Tab suspension: non-visible tabs (below Live tier) suspended using Firefox's tab unloading.
> Preload budget: one concurrent preload at a time.

**Depends on:** task-007, task-016, task-017

**Build context:** Requires `npm run build:ui`.

**Acceptance criteria:**
- LOD tiers computed each frame and applied to tree nodes
- Tabs at Live tier are active; tabs below Live are suspended via `browser.tabs.discard()`
- Tier transitions emit to performance probe
- Tab elements hidden/shown based on LOD tier
- Live non-focused tabs positioned at their tree coordinates as small previews
- Preload limited to 1 concurrent tab warming up
- Hysteresis prevents thrashing at tier boundaries during smooth zoom

**Progress:** not-started

**Commits:**
