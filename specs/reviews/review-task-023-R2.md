# Review: Task 023 - Round 2

## R1 Findings Status

All four R1 findings addressed:
- F1 (restoreTreeFromTabs never called): now called in patch with tree used for layout.
- F2 (TabCommandRouter missing tree attributes): all callers now pass parentId/createdAt.
- F3 (TreeRestorerProbe not wired): probe object created inline and passed.
- F4 (pre-Limb tab root hijack): synthesizedIds set now distinguishes real vs synthesized roots.

## Findings

- [verifier-fixed] **F1: null parentId serializes to string "null" in DOM, corrupting root on restore** -- `InMemoryTabPort.setTreeAttributes` stored `parentId: null` as a property value, which works in tests. But in a DOM context, `setAttribute("limb-tree-parent-id", null)` converts null to the string `"null"`. This string is truthy, so it survives the TabState collection (`|| undefined`), SessionStore round-trip, and TreeRestorerAdapter (`|| null`) as the literal string `"null"` instead of `null`. `TreeRestorer.restore()` then fails to find a root (`parentId === null` never matches `"null"`), creating a synthetic root and corrupting tree structure. Fix: skip setting parentId when null, modeling correct "don't set the attribute" behavior. File: `src/limb/tree/InMemoryTabPort.ts:55`. Spec ref: `persistence.md S1.3`.

## Verdict

PASS (1 finding, verifier-fixed)
