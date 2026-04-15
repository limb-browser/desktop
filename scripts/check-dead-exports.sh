#!/usr/bin/env bash
# Check that exported domain modules in src/limb/ are imported by production code.
# Catches the pattern where an agent creates and tests a module but never wires it
# into the production code path — leaving a tested-but-dead module.
#
# Strategy:
#   1. Find exported classes/functions in src/limb/ (non-test, non-port, non-fake files).
#   2. For each export, check for at least one import in a non-test file other than itself.
#   3. Exports consumed only by test files are flagged as dead in production.
#
# Excluded from checking:
#   - Port interfaces (src/limb/ports/*) — consumed via type imports at compile time.
#   - Test doubles (InMemory*, Fake*, Stub*, Mock*) — expected to be test-only.
#   - .mjs files — loaded by browser chrome context via <script>, not ES import.
#
# Usage: scripts/check-dead-exports.sh
# Exit 1 if any domain module export is dead in production.

set -euo pipefail

exit_code=0

# Find candidate source files: .ts files in src/limb/, excluding tests, ports, and fakes.
mapfile -t source_files < <(
  find src/limb/ -type f -name '*.ts' \
    ! -name '*.test.*' ! -name '*.spec.*' \
    ! -name 'InMemory*' ! -name 'Fake*' ! -name 'Stub*' ! -name 'Mock*' \
    ! -path '*/ports/*' ! -path '*/test/*' ! -path '*/__tests__/*' \
    2>/dev/null | sort
)

for src_file in "${source_files[@]}"; do
  [ -f "$src_file" ] || continue

  # Extract exported symbol names
  exported_symbols=$(grep -Po '(?<=export class )\w+|(?<=export function )\w+|(?<=export const )\w+' "$src_file" 2>/dev/null || true)
  [ -z "$exported_symbols" ] && continue

  while IFS= read -r symbol; do
    [ -z "$symbol" ] && continue

    # Search for imports of this symbol in non-test production files (excluding the defining file).
    # Requires "import" keyword to avoid matching comments that mention the symbol name.
    prod_imports=$(
      grep -rl --include='*.ts' --include='*.mjs' --include='*.js' \
        -e "import.*$symbol" -e "new $symbol" \
        src/limb/ 2>/dev/null \
      | grep -v '\.test\.' \
      | grep -v '\.spec\.' \
      | grep -v '/test/' \
      | grep -v '/__tests__/' \
      | grep -v "^${src_file}$" \
      || true
    )

    if [ -z "$prod_imports" ]; then
      # Check if it's imported by test files (dead in prod, alive in tests = finding)
      test_imports=$(
        grep -rl --include='*.ts' --include='*.mjs' --include='*.js' \
          "import.*$symbol" \
          src/limb/ 2>/dev/null \
        | grep -E '\.test\.|\.spec\.|/test/|/__tests__/' \
        || true
      )

      if [ -n "$test_imports" ]; then
        echo "FAIL: $src_file — exported '$symbol' is imported only by test files, not by production code."
        echo "  Test consumers:"
        echo "$test_imports" | sed 's/^/    /'
        exit_code=1
      fi
    fi
  done <<< "$exported_symbols"
done

if [ $exit_code -eq 0 ]; then
  echo "PASS: All domain module exports are consumed by production code."
fi

exit $exit_code
