#!/usr/bin/env bash
# Check for unused imports in .ts files.
#
# Catches the pattern where an agent adds an import statement but never
# references the imported symbol in the file — dead code that bloats the
# import block and confuses readers about actual dependencies.
#
# Strategy:
#   1. Find all .ts files in src/limb/ (including test files).
#   2. Extract named imports: { Foo, Bar } and { Foo as Baz }.
#   3. For each imported symbol (or its alias), count references in the
#      file excluding the import line itself.
#   4. If zero references, flag as unused.
#
# Excluded:
#   - Side-effect imports (import './module') — no symbol to check.
#   - Default imports (import Foo from ...) — rare in this codebase;
#     handled separately if present.
#   - Re-exports (export { Foo } from ...) — not dead imports.
#   - .mjs files — covered by check-dead-locals.sh.
#
# Usage: scripts/check-unused-imports.sh
# Exit 1 if any imported symbol is unused.

set -euo pipefail

exit_code=0

mapfile -t ts_files < <(
  find src/limb/ -type f -name '*.ts' 2>/dev/null | sort
)

for ts_file in "${ts_files[@]}"; do
  [ -f "$ts_file" ] || continue

  # Process each import line that has named imports: import { ... } or import type { ... }
  while IFS=: read -r line_no import_line; do
    [ -z "$import_line" ] && continue

    # Extract the symbols between { and }.
    symbols_block=$(echo "$import_line" | grep -oP '\{[^}]+\}' 2>/dev/null || true)
    [ -z "$symbols_block" ] && continue

    # Strip braces and split on commas
    symbols_str="${symbols_block#\{}"
    symbols_str="${symbols_str%\}}"

    IFS=',' read -ra symbol_entries <<< "$symbols_str"

    for entry in "${symbol_entries[@]}"; do
      # Trim whitespace
      entry=$(echo "$entry" | xargs)
      [ -z "$entry" ] && continue

      # Strip inline type qualifier: "type Foo" -> "Foo"
      entry=$(echo "$entry" | sed -E 's/^type\s+//')

      # Handle "Foo as Bar" — the local name is Bar
      if echo "$entry" | grep -qP '\bas\b'; then
        local_name=$(echo "$entry" | grep -oP '(?<=\bas\s)\s*\w+' | xargs)
      else
        local_name="$entry"
      fi

      [ -z "$local_name" ] && continue

      # Count occurrences of the symbol as a whole word in the file,
      # excluding the import line itself.
      ref_count=$(
        { grep -nP "\b${local_name}\b" "$ts_file" 2>/dev/null || true; } \
        | { grep -v "^${line_no}:" || true; } \
        | wc -l
      )

      if [ "$ref_count" -eq 0 ]; then
        echo "FAIL: $ts_file:$line_no — imported '$local_name' is never used."
        exit_code=1
      fi
    done
  done < <(grep -nP '^\s*import\s+(type\s+)?\{' "$ts_file" 2>/dev/null || true)
done

if [ $exit_code -eq 0 ]; then
  echo "PASS: No unused imports found."
fi

exit $exit_code
