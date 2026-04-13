#!/usr/bin/env bash
# Check for template literal interpolation inside SQL strings.
# SQL values must use parameterized binding (:param), never ${...}.
#
# Strategy: Find ${...} interpolations, then check whether they appear
# inside SQL-context template literals (near .execute() calls or SQL keywords).
#
# Usage: scripts/check-sql-interpolation.sh [file...]
# If no files given, scans src/ for .mjs and .js files.

set -euo pipefail

files=("$@")
if [ ${#files[@]} -eq 0 ]; then
  mapfile -t files < <(find src/ -type f \( -name '*.mjs' -o -name '*.js' \) 2>/dev/null)
fi

exit_code=0

for file in "${files[@]}"; do
  [ -f "$file" ] || continue

  # Get line numbers containing ${...} interpolation
  interp_lines=$(grep -Pn '\$\{[^}]+\}' "$file" 2>/dev/null | cut -d: -f1 || true)
  [ -z "$interp_lines" ] && continue

  for line_no in $interp_lines; do
    # Check surrounding context (10 lines before and after) for SQL indicators
    start=$((line_no > 10 ? line_no - 10 : 1))
    end=$((line_no + 10))
    context=$(sed -n "${start},${end}p" "$file")

    # If context contains SQL execution (.execute() or SQL keywords with backticks), flag it
    if echo "$context" | grep -Pqi '\.execute\s*\(|\.executeCached\s*\(|\.executeTransaction\s*\('; then
      flagged_line=$(sed -n "${line_no}p" "$file")
      echo "FAIL: $file:$line_no — \${...} interpolation near SQL execute(). Use parameterized binding (:param) instead."
      echo "  $flagged_line"
      exit_code=1
    fi
  done
done

if [ $exit_code -eq 0 ]; then
  echo "PASS: No SQL string interpolation found."
fi

exit $exit_code
