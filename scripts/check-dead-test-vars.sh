#!/usr/bin/env bash
# Check for unused variable declarations in test files.
#
# Catches the pattern where a test creates an object or binding
# (const foo = new Bar(...)) but never references foo after creation.
# Dead test objects that share mutable state with the SUT create
# confusion about which object produced side effects.
#
# Strategy:
#   1. Find all .test.ts files in src/limb/.
#   2. Extract const/let declarations (simple identifiers, not destructuring).
#   3. For each symbol, count occurrences in the same file.
#   4. If the symbol appears only once (the declaration), flag as dead.
#
# Excluded:
#   - Variables prefixed with _ (intentionally unused convention).
#   - Destructuring patterns (const { a, b } = ..., const [a] = ...).
#     The regex only matches simple `const name =` declarations.
#
# Usage: scripts/check-dead-test-vars.sh
# Exit 1 if any test variable is declared but never used.

set -euo pipefail

exit_code=0

mapfile -t test_files < <(
  find src/limb/ -type f -name '*.test.ts' 2>/dev/null | sort
)

for test_file in "${test_files[@]}"; do
  [ -f "$test_file" ] || continue

  while IFS=: read -r line_no line_content; do
    [ -z "$line_content" ] && continue

    # Extract variable name from const/let declaration.
    # The regex already excludes destructuring (only matches \w+ after const/let).
    symbol=$(echo "$line_content" | grep -Po '(?:const|let)\s+\K\w+' 2>/dev/null || true)
    [ -z "$symbol" ] && continue

    # Skip intentionally unused vars (prefixed with _)
    [[ "$symbol" == _* ]] && continue

    # Count total occurrences of this symbol as a whole word in the file
    total_count=$(grep -cP "\b${symbol}\b" "$test_file" 2>/dev/null || echo 0)

    if [ "$total_count" -le 1 ]; then
      echo "FAIL: $test_file:$line_no — '$symbol' is declared but never used."
      exit_code=1
    fi
  done < <(grep -nP '^\s*(?:const|let)\s+\w+\s*=' "$test_file" 2>/dev/null || true)
done

if [ $exit_code -eq 0 ]; then
  echo "PASS: No unused test variables found."
fi

exit $exit_code
