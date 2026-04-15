#!/usr/bin/env bash
# Check that adapter/handler code does not call setZoomLevel directly.
#
# interaction-feel.md S1.3 requires all programmatic zoom changes to
# animate (350ms, cubic-bezier(0.25, 0.1, 0.25, 1.0)).  Calling
# setZoomLevel from an adapter bypasses animation and causes an instant
# visual discontinuity.
#
# Strategy:
#   1. Find all .mjs files in src/limb/ that are NOT the LimbTreeView
#      definition itself and NOT test files.
#   2. Search for .setZoomLevel( calls.
#   3. Flag each as a FAIL — the caller should use animateToNode() or
#      ZoomAnimator.start() instead.
#
# Usage: scripts/check-zoom-animation.sh
# Exit 1 if any direct setZoomLevel call is found outside LimbTreeView.

set -euo pipefail

exit_code=0

mapfile -t mjs_files < <(
  find src/limb/ -type f -name '*.mjs' \
    ! -name '*.test.*' ! -name '*.spec.*' \
    ! -name 'LimbTreeView.mjs' \
    2>/dev/null | sort
)

for mjs_file in "${mjs_files[@]}"; do
  [ -f "$mjs_file" ] || continue

  while IFS=: read -r line_no line_content; do
    [ -z "$line_content" ] && continue
    echo "FAIL: $mjs_file:$line_no — direct setZoomLevel call bypasses S1.3 animation."
    echo "      ${line_content}"
    echo "      Use animateToNode() or ZoomAnimator.start() for animated zoom changes."
    echo
    exit_code=1
  done < <(grep -n '\.setZoomLevel(' "$mjs_file" 2>/dev/null || true)
done

if [ $exit_code -eq 0 ]; then
  echo "PASS: No direct setZoomLevel calls outside LimbTreeView."
fi

exit $exit_code
