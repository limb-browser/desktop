# Task 007: LOD tier assignment + hysteresis

**Spec:** zoom-lod.md S2.1, S2.2, S2.3, S2.4

**Spec excerpt:**

> | Tier | Condition |
> |---|---|
> | Culled | Off-screen (outside viewport + margin) |
> | Favicon | On-screen, nodeScreenWidth < 80px |
> | Screenshot-Low | 80px <= nodeScreenWidth < 300px |
> | Screenshot-High | 300px <= nodeScreenWidth < 600px |
> | Live | nodeScreenWidth >= 600px |
> | Focused | Is focusedNodeId AND level >= 0.9 |
>
> Hysteresis deadbands: Favicon->Screenshot-Low enter 80px/exit 60px, etc.
> Culling margin: 200px beyond viewport edge.

**Depends on:** task-006

**Build context:** vitest only.

**Acceptance criteria:**
- `LODTier` type: `'culled' | 'favicon' | 'screenshot-low' | 'screenshot-high' | 'live' | 'focused'`
- `assignTiers(tree, layout, zoomState, previousTiers?)` returns `Map<string, LODTier>`
- Tier assignment follows thresholds from S2.1
- Hysteresis: nodes don't thrash at boundaries (uses enter/exit thresholds from S2.3)
- Culling: nodes outside viewport + 200px margin are culled
- Focused node is always at least Live tier
- Invariant S5.3: focused node never drops below Live
- Tests cover: each tier threshold, hysteresis behavior, culling, focused node override
- File: `src/limb/domain/lod.ts`, `src/limb/domain/lod.test.ts`

**Progress:** not-started

**Commits:**
