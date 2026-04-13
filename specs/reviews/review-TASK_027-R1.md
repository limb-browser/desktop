# Review: Task 027 - Round 1

## Findings

- [ ] **F1: SQL string interpolation in schema version insert** -- `TreeStorage.mjs:114` uses `${SCHEMA_VERSION}` template literal interpolation inside a SQL string instead of a parameterized query. While the value is a module constant and not exploitable, this violates secure coding practice. Should use `:schemaVersion` parameter binding. File: `src/limb/tree/TreeStorage.mjs:114`. Spec ref: N/A (coding practice).

- [ ] **F2: `saveBranch` does not enforce `branchRootId` parameter matches nodes' `branchRootId` field** -- The `branchRootId` parameter is used for DELETE (cleanup), but each node's own `branchRootId` field is stored as-is. If they differ, `getBranchSummaries` behavior diverges between TreeStorage.mjs (uses `WHERE id = branch_root_id` from stored data) and InMemoryTreeStorage (uses the `#branchRoots` set populated from the parameter). This is a missing invariant that causes the test double to behave differently from the production implementation on inconsistent inputs. File: `src/limb/tree/TreeStorage.mjs:128`. Spec ref: `persistence.md S2.1`.

- [ ] **F3: `close()` method missing from `TreeStoragePort` interface** -- TreeStorage.mjs defines a `close()` method (line 344) for lifecycle management, but `TreeStoragePort` does not declare it. Consumers coding to the port interface cannot manage connection lifecycle. File: `src/limb/ports/TreeStoragePort.ts:30-46`. Spec ref: N/A (port completeness).

- [ ] **F4: `deleteScreenshots` lacks transaction wrapping** -- `deleteScreenshots` (TreeStorage.mjs:309-325) issues individual DELETE statements in a loop without `executeTransaction`. `saveBranch` and `deleteBranch` correctly use transactions for multi-statement mutations. Inconsistent atomicity guarantees. File: `src/limb/tree/TreeStorage.mjs:309-325`. Spec ref: N/A (consistency).

- [ ] **F5: Missing test for "database is created in the profile directory on first access"** -- The task spec requires this test, but it is absent. All tests run against InMemoryTreeStorage which has no filesystem interaction. File: `src/limb/tree/TreeStorage.test.ts`. Spec ref: task-027 item 4.

- [ ] **F6: Test describe block and filename misname the SUT** -- `TreeStorage.test.ts:55` describes `'TreeStorage'` but all tests instantiate `InMemoryTreeStorage`. The file should be named `InMemoryTreeStorage.test.ts` or the describe block should reflect the actual SUT. File: `src/limb/tree/TreeStorage.test.ts:55`. Spec ref: N/A (test clarity).

## Verdict

FAIL (6 findings)
