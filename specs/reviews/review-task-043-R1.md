# Review: Task 043 - Round 1

## Findings

- [ ] **F1: ZoomMomentum deleted — S1.1 inertial zoom removed** -- The task scope is S2 (pan momentum) only, but the implementation deletes `ZoomMomentum.mjs`, `ZoomMomentum.test.ts`, and `ZoomMomentumProbe.ts`, and removes all zoom momentum wiring from `LimbTreeView.mjs` (`onScroll` velocity tracking, `#scheduleMomentumRelease` timer, momentum advancement in `#onFrame`). Scroll-to-zoom no longer has inertial follow-through on gesture release. The task says "New zoom input cancels pan momentum," implying the two features coexist. Restore the ZoomMomentum module and its LimbTreeView integration alongside PanMomentum. File: `src/limb/tree/ZoomMomentum.mjs` (deleted). Spec ref: `interaction-feel.md S1.1`. [process-revision-complete] Process fix: added implementation checklist item 55 (scope containment — no out-of-scope deletions) and verifier target (scope containment — out-of-scope deletions).

- [ ] **F2: Production probe not wired for PanMomentum** -- The production `init()` call in `browser-init-js.patch` line 73 does not include `panMomentumProbe` in the options object. `PanMomentum` is instantiated with `options?.panMomentumProbe` which resolves to `undefined`, so all five probe events (`momentumStarted`, `momentumStopped`, `snapBackStarted`, `snapBackCompleted`, `cancelled`) are silently dropped in the running browser. File: `src/browser/base/content/browser-init-js.patch:73`. Spec ref: probe wiring in production. [process-revision-complete] Process fix: enhanced `scripts/check-probe-wiring.sh` with pass 1b (.mjs JSDoc probe detection) and pass 2 (options-passthrough verification against browser-init-js.patch); added implementation checklist item 56 (options-passthrough probe wiring) and verifier target (options-passthrough probe wiring).

## Verdict

FAIL (2 findings)
