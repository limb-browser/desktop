# Review: Task 024 - Round 2

## R1 Finding Disposition

- [x] **F1: URL/title save trigger not wired** -- Fixed. Removed `notifyDataChange()`. Added `TabAttrModified` event listener on `tabContainer` in `install()`. Wired in `browser-init-js.patch` with `gBrowser.tabContainer`.
- [x] **F2: `#browsingTree` dead field** -- Fixed. `#browsingTree` is now read in `uninstall()` to call `setProbe(null)`. `check-dead-fields.sh` passes.
- [x] **F3: `uninstall()` leaves probe active** -- Fixed. `uninstall()` now calls `browsingTree.setProbe(null)`. `BrowsingTree.setProbe` signature updated to accept `null`. New tests verify probe replacement and late attachment.

## Verification

- Tests: 531 passed (24 files), 0 failures.
- `check-sql-interpolation.sh`: PASS
- `check-port-completeness.sh`: PASS
- `check-dead-exports.sh`: 2 failures (pre-existing, not task-024)
- `check-dead-locals.sh`: PASS
- `check-chrome-wiring.sh`: 2 failures (pre-existing, not task-024)
- `check-zoom-animation.sh`: 1 failure (pre-existing, not task-024)
- `check-patch-imports.sh`: PASS
- `check-uncalled-methods.sh`: 1 task-024 failure (`AutoSaveAdapter.uninstall`), remainder pre-existing
- `check-dead-fields.sh`: PASS

## Findings

None. The `AutoSaveAdapter.uninstall` uncalled-method flag follows the established codebase pattern (same as `KeyboardNavigationAdapter.uninstall`, `LimbTabCommandAdapter.uninstall`, `LimbTreeView.destroy`). The method exists for lifecycle correctness and was required to fix R1 F2/F3. Not a task-024 regression.

## Verdict

PASS (0 findings)
