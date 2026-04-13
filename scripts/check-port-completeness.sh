#!/usr/bin/env bash
# Check that port interfaces and their implementations are in sync.
# Verifies:
#   1. Every method in a *Port.ts interface exists on its implementations.
#   2. Every public async method on an implementation is declared in its port.
#
# Usage: scripts/check-port-completeness.sh
# Scans src/limb/ports/ for *Port.ts and finds matching implementations.

set -euo pipefail

exit_code=0

for port_file in src/limb/ports/*Port.ts; do
  [ -f "$port_file" ] || continue
  port_name=$(basename "$port_file" .ts)

  # Extract method names from the port interface (lines matching methodName(...): ...)
  port_methods=$(grep -Po '^\s+\K\w+(?=\()' "$port_file" || true)
  port_methods=$(echo "$port_methods" | sort -u | grep -v '^$' || true)

  if [ -z "$port_methods" ]; then
    continue
  fi

  # Find TypeScript implementation files that use "implements PortName"
  impl_files=$(grep -rl "implements $port_name" src/limb/ --include='*.ts' 2>/dev/null || true)
  # Find .mjs files that reference the port (likely implementing it)
  impl_mjs=$(grep -rl "$port_name" src/limb/ --include='*.mjs' 2>/dev/null | grep -v 'ports/' || true)

  all_impls=$(echo -e "${impl_files}\n${impl_mjs}" | sort -u | grep -v '^$' || true)

  for impl_file in $all_impls; do
    [ -f "$impl_file" ] || continue
    # Skip test files and port files themselves
    [[ "$impl_file" == *.test.* ]] && continue
    [[ "$impl_file" == */ports/* ]] && continue

    # Extract public async method names from the implementation
    impl_methods=$(grep -Po '^\s+async\s+\K\w+(?=\()' "$impl_file" 2>/dev/null || true)
    # Filter out private methods (starting with #)
    impl_methods=$(echo "$impl_methods" | grep -v '^#' | sort -u | grep -v '^$' || true)

    # Check: port methods missing from implementation
    while IFS= read -r method; do
      [ -z "$method" ] && continue
      if ! echo "$impl_methods" | grep -qx "$method"; then
        echo "FAIL: $impl_file — missing port method '$method' declared in $port_file"
        exit_code=1
      fi
    done <<< "$port_methods"

    # Check: implementation public async methods missing from port
    while IFS= read -r method; do
      [ -z "$method" ] && continue
      if ! echo "$port_methods" | grep -qx "$method"; then
        echo "FAIL: $impl_file — public method '$method' not declared in $port_file"
        exit_code=1
      fi
    done <<< "$impl_methods"
  done
done

if [ $exit_code -eq 0 ]; then
  echo "PASS: All port interfaces and implementations are in sync."
fi

exit $exit_code
