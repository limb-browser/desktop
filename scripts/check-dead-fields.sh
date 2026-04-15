#!/usr/bin/env bash
# Check for dead private class fields in .mjs files.
#
# Catches the pattern where an agent declares a private field (#field),
# assigns to it (this.#field = ...) and clears it, but never reads the
# value. The field is dead storage — it contributes nothing to behavior.
#
# Strategy:
#   1. Find all .mjs files in src/limb/ (excluding tests).
#   2. Extract private field declarations (#identifier).
#   3. Separate write-only occurrences (this.#field = ...) from reads.
#   4. If a field only appears in declarations and assignments, flag it.
#
# A "write" is any line matching: this.#field = (assignment).
# A "read" is any other occurrence of this.#field that is not a declaration
# or an assignment target.
#
# Usage: scripts/check-dead-fields.sh
# Exit 1 if any private field is written but never read.

set -euo pipefail

exit_code=0

mapfile -t mjs_files < <(
  find src/limb/ -type f -name '*.mjs' \
    ! -name '*.test.*' ! -name '*.spec.*' \
    2>/dev/null | sort
)

for mjs_file in "${mjs_files[@]}"; do
  [ -f "$mjs_file" ] || continue

  # Extract private field names from declarations: lines like "  #fieldName"
  # followed by = or ;
  while IFS= read -r field; do
    [ -z "$field" ] && continue

    # Count total occurrences of #field (as a whole word)
    total=$(grep -cP "#${field}\b" "$mjs_file" 2>/dev/null || true)
    total=${total:-0}

    # Count declarations: lines like "  #field =" or "  #field;" at class level
    decl_count=$(grep -cP "^\s+#${field}\b\s*[;=]" "$mjs_file" 2>/dev/null || true)
    decl_count=${decl_count:-0}

    # Count write-only occurrences: this.#field = (assignment target)
    write_count=$(grep -cP "this\.#${field}\s*=" "$mjs_file" 2>/dev/null || true)
    write_count=${write_count:-0}

    # Reads = total - declarations - writes
    read_count=$((total - decl_count - write_count))

    if [ "$read_count" -le 0 ] && [ "$total" -gt 0 ]; then
      line_no=$(grep -nP "^\s+#${field}\b" "$mjs_file" 2>/dev/null | head -1 | cut -d: -f1)
      echo "FAIL: $mjs_file:${line_no:-?} — private field '#${field}' is written but never read (dead field)."
      exit_code=1
    fi
  done < <(
    grep -oP '(?<=^\s{2})#\K\w+' "$mjs_file" 2>/dev/null \
    | sort -u
  )
done

if [ $exit_code -eq 0 ]; then
  echo "PASS: No dead private class fields found."
fi

exit $exit_code
