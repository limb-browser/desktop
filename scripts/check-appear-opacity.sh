#!/usr/bin/env bash
# Check that animation modules handling element appearance/disappearance
# include opacity transitions (interaction-feel.md S7.1).
#
# S7.1 requires: "No element should appear or disappear without an
# opacity transition of at least 100ms."
#
# Strategy:
#   1. Find .mjs files in src/limb/ (non-test) whose content indicates
#      they handle element appearance transitions (reveal, appear, enter
#      viewport, culled-to-visible).
#   2. Verify those files reference opacity/alpha in their animation output.
#   3. Flag files that animate appearance without opacity handling.
#
# Usage: scripts/check-appear-opacity.sh
# Exit 1 if any appearance/disappearance animation lacks opacity handling.

set -euo pipefail

exit_code=0

mapfile -t mjs_files < <(
  find src/limb/ -type f -name '*.mjs' \
    ! -name '*.test.*' ! -name '*.spec.*' \
    2>/dev/null | sort
)

for mjs_file in "${mjs_files[@]}"; do
  [ -f "$mjs_file" ] || continue

  # Check if file handles element appearance/disappearance transitions
  if grep -qiE '\b(reveal|appear|fade.?in|fade.?out|disappear)\b|culled.*to.*visible|not.rendered.*to|visibility.*transition|\benter.*(viewport|visible)' "$mjs_file" 2>/dev/null; then
    # Confirm it is an animation module (has timing/duration/elapsed)
    if grep -qE '(DURATION_MS|elapsed|easing|interpolat|animation.*progress|animation.*fraction)' "$mjs_file" 2>/dev/null; then
      # Verify it handles opacity
      if ! grep -qiE '(opacity|globalAlpha|alpha|OPACITY)' "$mjs_file" 2>/dev/null; then
        echo "FAIL: $mjs_file — appearance/disappearance animation without opacity transition."
        echo "      S7.1 requires: 'No element should appear or disappear without an"
        echo "      opacity transition of at least 100ms.' The animation must return opacity"
        echo "      alongside other animated properties and the paint path must apply it."
        echo
        exit_code=1
      fi
    fi
  fi
done

if [ $exit_code -eq 0 ]; then
  echo "PASS: All appearance/disappearance animations include opacity handling."
fi

exit $exit_code
