# Review: Task 005 - Round 1

## Findings

- [x] **F1: Canvas buffer sized to window, not container** [verifier-fixed] -- `LimbTreeView.mjs:40-41` used `window.innerWidth`/`window.innerHeight` to set the canvas bitmap dimensions, but the canvas element is inside `#zen-appcontent-wrapper` which excludes the sidebar. The bitmap dimensions must match the element's display dimensions to avoid stretching. Fixed: changed to `this.#canvas.clientWidth`/`this.#canvas.clientHeight`. File: `src/limb/tree/LimbTreeView.mjs:43-44`. Spec ref: `tree-rendering.md S1.1`.
- [x] **F2: Resize listener not removed in destroy()** [verifier-fixed] -- `init()` added a resize listener using an anonymous arrow function that could never be removed. `destroy()` nulled `#canvas` and `#ctx` but left the listener attached, preventing GC and causing dead callbacks on resize. Fixed: stored handler in `#resizeHandler` field, removed in `destroy()`. File: `src/limb/tree/LimbTreeView.mjs:37-38,72-75`. Spec ref: `tree-rendering.md S1.1`.

## Verdict

PASS (2 findings, both verifier-fixed)
