#!/usr/bin/env bash
# Check that production instantiation sites of probe-accepting classes pass
# a probe argument.
#
# Catches the pattern where an agent instantiates a class that accepts an
# optional probe parameter (probe?: SomeProbe) but omits the probe argument,
# silently dropping observability data at runtime. Tests typically wire probes
# (to assert probe calls), so this bug is invisible to test suites.
#
# Strategy:
#   1. Find all .ts files in src/limb/ that export a class whose constructor
#      has an optional probe parameter (probe?: ...).
#   2. Extract the class name.
#   3. Find all `new ClassName(` calls in production files (.mjs, .ts),
#      excluding test files.
#   4. If the argument text does not contain "probe" (case-insensitive),
#      flag the call site as missing probe wiring.
#
# Excluded:
#   - Test files (.test.ts, .spec.ts, etc.)
#   - Test directories (/test/, /__tests__/)
#
# Usage: scripts/check-probe-wiring.sh
# Exit 1 if any production instantiation omits the probe argument.

set -euo pipefail

exit_code=0

# Find .ts files that export a class with a probe?: parameter.
mapfile -t probe_class_files < <(
  grep -rlP 'probe\?\s*:' src/limb/ --include='*.ts' 2>/dev/null \
  | xargs grep -lP '^\s*export\s+class\s+' 2>/dev/null \
  | sort -u
)

for ts_file in "${probe_class_files[@]}"; do
  [ -f "$ts_file" ] || continue

  # Skip test files.
  [[ "$ts_file" == *.test.* ]] && continue
  [[ "$ts_file" == *.spec.* ]] && continue

  # Extract class name from the export line.
  class_name=$(grep -P '^\s*export\s+class\s+\w+' "$ts_file" | head -1 | sed -E 's/.*export\s+class\s+(\w+).*/\1/')
  [ -z "$class_name" ] && continue

  # Verify this class actually has probe?: in its constructor area.
  grep -qP 'probe\?\s*:' "$ts_file" || continue

  # Search for production instantiation sites.
  while IFS=: read -r file line_no line_content; do
    [ -z "$file" ] && continue

    # Extract the part after "new ClassName(" to check arguments.
    args_part=$(echo "$line_content" | sed "s/.*new[[:space:]]*${class_name}(//")

    # Check if the argument list contains "probe" (case-insensitive).
    if ! echo "$args_part" | grep -qiP 'probe'; then
      echo "FAIL: $file:$line_no — 'new ${class_name}(...)' omits probe argument."
      exit_code=1
    fi
  done < <(
    grep -rnP "new\s+${class_name}\(" src/limb/ \
      --include='*.mjs' --include='*.ts' \
      2>/dev/null \
    | grep -v '\.test\.' \
    | grep -v '\.spec\.' \
    | grep -v '/test/' \
    | grep -v '/__tests__/' \
    || true
  )
done

if [ $exit_code -eq 0 ]; then
  echo "PASS: All production instantiation sites of probe-accepting classes pass a probe."
fi

exit $exit_code
