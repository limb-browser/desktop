# Review: Task 007 - Round 1

## Findings

- [process-revision-complete] **F1: ZoomState.ts is dead code -- LimbTreeView duplicates math instead of importing it** -- The task requires "Update LimbTreeView to use ZoomState when painting." Instead, LimbTreeView.mjs re-implements all zoom math (`#zoomScale`, `#logicalToScreen`, `#screenToLogical`, `#zoomAtCursor`, `#minScale`, `#maxScale`) as private methods, never importing ZoomState. The tested class is not the class that runs. File: `src/limb/tree/LimbTreeView.mjs:83-153`. Spec ref: `task-007.md item 3`.

- [process-revision-complete] **F2: No ZoomProbe fires during production zoom** -- ZoomProbe.zoomChanged is only called inside ZoomState.setLevel(). Since LimbTreeView doesn't use ZoomState, no probe fires during actual Ctrl+Scroll zoom interactions. The probe infrastructure is tested in isolation but dead in the production path. File: `src/limb/tree/LimbTreeView.mjs:74-81`. Spec ref: `zoom-lod.md S2.2 step 5` (emit tier transitions to observability probe).

- [process-revision-complete] **F3: Wheel listener attached to window, not canvas** -- The task says "Wire Ctrl+Scroll event listener on the canvas." Code attaches the listener to `window` (`window.addEventListener("wheel", ...)`), meaning any Ctrl+Scroll anywhere in the browser chrome triggers zoom, not just events over the tree canvas. File: `src/limb/tree/LimbTreeView.mjs:60`. Spec ref: `task-007.md item 2`.

## Verdict

FAIL (3 findings)
