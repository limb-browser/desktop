#!/usr/bin/env bash
# Check that every destructured import in .patch files is actually used.
#
# Catches the pattern where an agent writes a ChromeUtils.importESModule line
# to satisfy the "module integration" checklist item, but never invokes the
# imported symbol — leaving dead code in the browser init path.
#
# Strategy:
#   1. Find all .patch files in src/browser/.
#   2. Extract added lines (starting with +, ignoring ++ headers).
#   3. For each destructured import (e.g., `const { Foo } = ChromeUtils.importESModule`),
#      verify the symbol appears at least once more in the added lines of the
#      same patch (beyond the import line itself).
#
# Usage: scripts/check-patch-imports.sh
# Exit 1 if any imported symbol is never referenced.

set -euo pipefail

exit_code=0

mapfile -t patch_files < <(
  find src/browser/ -type f -name '*.patch' 2>/dev/null | sort
)

for patch_file in "${patch_files[@]}"; do
  [ -f "$patch_file" ] || continue

  # Extract all added lines (strip the leading +), excluding patch headers (+++).
  added_lines=$(grep '^+' "$patch_file" | grep -v '^+++' | sed 's/^+//' || true)
  [ -z "$added_lines" ] && continue

  # Find destructured imports: const { Foo } = ChromeUtils.importESModule
  # Also handles: const { Foo, Bar } = ...
  # Extract just the symbol names from inside the braces.
  while IFS= read -r import_line; do
    [ -z "$import_line" ] && continue

    # Extract the content between { and }
    braces_content=$(echo "$import_line" | grep -oP '\{\s*\K[^}]+' 2>/dev/null || true)
    [ -z "$braces_content" ] && continue

    # Split on comma to get individual symbols, trim whitespace
    while IFS=',' read -ra symbols; do
      for raw_symbol in "${symbols[@]}"; do
        symbol=$(echo "$raw_symbol" | xargs)  # trim whitespace
        [ -z "$symbol" ] && continue

        # Count occurrences of this symbol in all added lines (as a whole word).
        # Must appear more than once (the import itself is one occurrence).
        count=$(echo "$added_lines" | grep -cP "\b${symbol}\b" 2>/dev/null || echo 0)

        if [ "$count" -le 1 ]; then
          echo "FAIL: $patch_file — imported '$symbol' via ChromeUtils.importESModule but never used it."
          exit_code=1
        fi
      done
    done <<< "$braces_content"
  done < <(echo "$added_lines" | grep 'ChromeUtils\.importESModule' || true)
done

if [ $exit_code -eq 0 ]; then
  echo "PASS: All patch imports are referenced."
fi

exit $exit_code
