#!/usr/bin/env bash
# Check for unused non-exported module-level definitions in .mjs files.
#
# Catches the pattern where an agent defines a constant, array, or helper
# function at module scope but never references it — dead code that passes
# the cross-file dead-exports check (which only covers exported symbols
# and excludes .mjs files entirely).
#
# Strategy:
#   1. Find all .mjs files in src/limb/ (excluding tests).
#   2. Extract non-exported top-level const/let/function declarations.
#   3. For each symbol, count occurrences of the identifier in the same file.
#   4. If the symbol appears only once (the definition), flag as dead.
#
# Excluded from checking:
#   - Exported definitions (export const, export function, export class) —
#     these are meant to be consumed externally and are covered by
#     check-dead-exports.sh.
#   - Test files (*.test.mjs, *.spec.mjs).
#
# Usage: scripts/check-dead-locals.sh
# Exit 1 if any non-exported module-level definition is unused.

set -euo pipefail

exit_code=0

mapfile -t mjs_files < <(
  find src/limb/ -type f -name '*.mjs' \
    ! -name '*.test.*' ! -name '*.spec.*' \
    2>/dev/null | sort
)

for mjs_file in "${mjs_files[@]}"; do
  [ -f "$mjs_file" ] || continue

  # Extract non-exported module-level const/let/function names.
  # These are lines starting with const/let/var/function (NOT preceded by export).
  # We use grep -P to extract the symbol name after the keyword.
  while IFS=: read -r line_no line_content; do
    [ -z "$line_content" ] && continue

    # Extract the symbol name from the declaration
    symbol=$(echo "$line_content" | grep -Po '(?:const|let|var|function)\s+\K\w+' 2>/dev/null || true)
    [ -z "$symbol" ] && continue

    # Count total occurrences of this symbol (as a whole word) in the file
    total_count=$(grep -cP "\b${symbol}\b" "$mjs_file" 2>/dev/null || echo 0)

    # If it appears only once, it's the definition with no usage
    if [ "$total_count" -le 1 ]; then
      echo "FAIL: $mjs_file:$line_no — '$symbol' is defined but never used in this file."
      exit_code=1
    fi
  done < <(grep -nP '^(?:const|let|var|function)\s+\w+' "$mjs_file" 2>/dev/null || true)
done

if [ $exit_code -eq 0 ]; then
  echo "PASS: No unused module-level definitions found."
fi

exit $exit_code
