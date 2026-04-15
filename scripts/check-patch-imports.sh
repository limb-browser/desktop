#!/usr/bin/env bash
# Check that every destructured import in .patch files is actually used
# in active (non-commented) code.
#
# Catches the pattern where an agent writes a ChromeUtils.importESModule line
# but never invokes the imported symbol in executing code — either because
# the symbol is truly dead, or because its only "usage" is inside a
# commented-out line (e.g., "// deferred: someCall(importedSymbol)").
#
# Strategy:
#   1. Find all .patch files in src/browser/.
#   2. Extract added lines (starting with +, ignoring ++ headers).
#   3. Strip full-line comments (lines where // is the first non-whitespace)
#      to produce "active lines" — code that actually executes at runtime.
#   4. For each destructured import (e.g., `const { Foo } = ChromeUtils.importESModule`),
#      verify the symbol appears at least once more in active lines
#      (beyond the import line itself).
#
# Usage: scripts/check-patch-imports.sh
# Exit 1 if any imported symbol is never referenced in active code.

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

  # Strip full-line comments to get active (executing) code only.
  # A full-line comment is any line whose first non-whitespace is //.
  # This prevents commented-out code from counting as a valid reference.
  active_lines=$(echo "$added_lines" | grep -vP '^\s*//' || true)
  [ -z "$active_lines" ] && continue

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

        # Count occurrences of this symbol in active lines (as a whole word).
        # Must appear more than once (the import itself is one occurrence).
        count=$(echo "$active_lines" | grep -cP "\b${symbol}\b" 2>/dev/null || echo 0)

        if [ "$count" -le 1 ]; then
          echo "FAIL: $patch_file — imported '$symbol' but never used in active (non-commented) code."
          exit_code=1
        fi
      done
    done <<< "$braces_content"
  done < <(echo "$active_lines" | grep 'ChromeUtils\.importESModule' || true)
done

if [ $exit_code -eq 0 ]; then
  echo "PASS: All patch imports are referenced in active code."
fi

exit $exit_code
