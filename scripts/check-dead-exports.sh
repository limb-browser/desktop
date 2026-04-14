#!/usr/bin/env bash
# Check for TS exports that are only consumed by test files.
#
# An export consumed only by *.test.ts is dead production code —
# the tested function never runs in the real application.
# This catches logic that was tested in isolation but bypassed
# by the actual production path (e.g., an MJS re-implementation).
#
# Usage: scripts/check-dead-exports.sh
# Scans src/limb/ for exported symbols in .ts files.

set -euo pipefail

exit_code=0

# Collect all non-test .ts files in src/limb/
# Exclude:
#   *.test.ts    — test files themselves
#   *.d.ts       — type declarations
#   InMemory*    — in-memory fakes designed as test doubles
#   Fake*        — test fakes
#   ports/*      — port interfaces (consumers are implementations, often test doubles)
mapfile -t ts_files < <(find src/limb/ -name '*.ts' \
  ! -name '*.test.ts' \
  ! -name '*.d.ts' \
  ! -name 'InMemory*' \
  ! -name 'Fake*' \
  ! -path '*/ports/*' \
  2>/dev/null)

for file in "${ts_files[@]}"; do
  [ -f "$file" ] || continue

  # Extract named exports: "export function foo", "export class Foo",
  # "export const foo", "export interface Foo", "export type Foo",
  # "export { foo }" inline re-exports.
  # Also handle "export function" on separate lines.
  exports=$(grep -Po '(?<=^export (?:function|class|const|let|interface|type|enum|async function) )\w+' "$file" 2>/dev/null || true)

  # Also match "export { Name }" style exports
  brace_exports=$(grep -Po '(?<=export \{ )\w+' "$file" 2>/dev/null || true)

  all_exports=$(echo -e "${exports}\n${brace_exports}" | sort -u | grep -v '^$' || true)

  [ -z "$all_exports" ] && continue

  for sym in $all_exports; do
    # Skip type-only exports (interfaces, type aliases) — they have no
    # runtime presence and can't be "dead" in the same way.
    if grep -Pq "^export (interface|type) ${sym}\b" "$file" 2>/dev/null; then
      continue
    fi

    # Find all files that import this symbol (excluding the defining file itself)
    importers=$(grep -rl --include='*.ts' --include='*.mjs' --include='*.js' "\b${sym}\b" src/limb/ 2>/dev/null \
      | grep -v "^${file}$" || true)

    if [ -z "$importers" ]; then
      echo "FAIL: ${file} — export '${sym}' has no consumers at all"
      exit_code=1
      continue
    fi

    # Check if ANY consumer is a non-test file
    has_prod_consumer=false
    while IFS= read -r importer; do
      if [[ "$importer" != *.test.ts && "$importer" != *.test.js ]]; then
        has_prod_consumer=true
        break
      fi
    done <<< "$importers"

    if [ "$has_prod_consumer" = false ]; then
      echo "FAIL: ${file} — export '${sym}' is only consumed by test files (dead production code)"
      exit_code=1
    fi
  done
done

if [ $exit_code -eq 0 ]; then
  echo "PASS: All exports have production consumers."
fi

exit $exit_code
