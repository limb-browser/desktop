#!/usr/bin/env bash
# Check for commented-out code in .patch files.
#
# Catches the pattern where an agent comments out a function call, assignment,
# or declaration instead of removing it or wiring it properly — leaving dead
# code that inflates the patch, circumvents dead-code checks (symbols appear
# to be "used" inside the comment), and indicates the feature is non-functional.
#
# Heuristic: an added line whose first non-whitespace is // and that ends
# with a semicolon is almost certainly commented-out code, not a prose comment.
#
# Strategy:
#   1. Find all .patch files in src/browser/.
#   2. Extract added lines (starting with +, ignoring ++ headers).
#   3. Flag lines that match the commented-out-code heuristic.
#
# Usage: scripts/check-commented-code.sh
# Exit 1 if any commented-out code is found in patch added lines.

set -euo pipefail

exit_code=0

mapfile -t patch_files < <(
  find src/browser/ -type f -name '*.patch' 2>/dev/null | sort
)

for patch_file in "${patch_files[@]}"; do
  [ -f "$patch_file" ] || continue

  # Extract added lines (strip the leading +), excluding patch headers (+++).
  while IFS= read -r line; do
    # Heuristic: full-line comment (first non-ws is //) ending with ;
    if echo "$line" | grep -qP '^\s*//\s*.*;\s*$'; then
      echo "FAIL: $patch_file — commented-out code: $(echo "$line" | sed 's/^[[:space:]]*//')"
      exit_code=1
    fi
  done < <(grep '^+' "$patch_file" | grep -v '^+++' | sed 's/^+//' || true)
done

if [ $exit_code -eq 0 ]; then
  echo "PASS: No commented-out code in patches."
fi

exit $exit_code
