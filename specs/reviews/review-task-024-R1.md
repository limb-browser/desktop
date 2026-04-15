# Review: Task 024 - Round 1

## Findings

- [ ] **F1: URL/title save trigger not wired in production** -- persistence.md S3.1 requires auto-save on "URL/title update" and the task says "After URL/title update: trigger save." `AutoSaveAdapter.notifyDataChange()` exists (line 71) but no production code ever calls it. The method is exposed on `window.gLimbAutoSaveAdapter` but nothing invokes `.notifyDataChange()`. URL/title changes do not trigger auto-saves. File: `src/limb/tree/AutoSaveAdapter.mjs:71`. Spec ref: `persistence.md S3.1`.

- [ ] **F2: `AutoSaveAdapter.#browsingTree` is dead code** -- The `#browsingTree` field is set in `install()` (line 52) and cleared in `uninstall()` (line 91) but never read by any method in the class. Dead field. File: `src/limb/tree/AutoSaveAdapter.mjs:28`. Spec ref: N/A (dead code).

- [ ] **F3: `uninstall()` leaves probe callbacks active on tree** -- After `uninstall()`, the BrowsingTree still has the auto-save probe set via `setProbe()`. If the tree is mutated after `uninstall()`, the probe callbacks still invoke `this.#trigger.notifyChange()`, which creates new timeouts via `windowTimers` and eventually calls `saveFn()`. `dispose()` only clears current timers but does not prevent `notifyChange()` from scheduling new ones. The cleanup is incomplete. File: `src/limb/tree/AutoSaveAdapter.mjs:86`. Spec ref: N/A (correctness).

## Verdict

FAIL (3 findings)
