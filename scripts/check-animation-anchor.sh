#!/usr/bin/env bash
# Check that animation-start code paths reset the timestamp anchor
# before calling markDirty().
#
# interaction-feel.md S7.1 requires no visual discontinuities. When a
# code path starts or resumes a frame-based animation (momentum,
# snap-back, zoom animation) after a potential idle gap, the animation
# timestamp anchor (e.g., #animationLastTime) must be reset to
# performance.now() before markDirty(). Without the reset, the first
# frame computes deltaMs from a stale timestamp, applying many frames'
# worth of change in a single frame.
#
# Strategy:
#   1. Find the animation host file (LimbTreeView.mjs).
#   2. Locate markDirty() calls preceded by an isActive check (the
#      pattern for starting a new animation) OUTSIDE #onFrame.
#   3. Verify that a timestamp reset appears between the isActive check
#      and the markDirty() call.
#
# Inside #onFrame, the timestamp is managed by the frame loop itself,
# so isActive + markDirty() patterns there are continuation (not start)
# and do not need a reset.
#
# The pattern that needs a reset (outside #onFrame):
#   someAnimatable.release(...) / .start(...) / .onRelease(...)
#   if (someAnimatable.isActive) {
#     this.#animationLastTime = performance.now();  // <-- REQUIRED
#     this.#frameScheduler?.markDirty();
#   }
#
# Usage: scripts/check-animation-anchor.sh
# Exit 1 if any animation-start markDirty() lacks a timestamp reset.

set -euo pipefail

exit_code=0
target="src/limb/tree/LimbTreeView.mjs"

if [ ! -f "$target" ]; then
  echo "SKIP: $target not found."
  exit 0
fi

# Find blocks where isActive is checked and markDirty() follows within
# a few lines, but no timestamp reset appears in between.
#
# We scan the file line by line, tracking whether we're inside an
# isActive-gated block and whether we're inside #onFrame.

in_onframe=0
onframe_brace_depth=0
in_active_block=0
active_line=0
found_reset=0
block_start_line=0

count_char() {
  local str="$1"
  local ch="$2"
  local stripped="${str//[^$ch]/}"
  echo "${#stripped}"
}

while IFS= read -r line; do
  active_line=$((active_line + 1))

  # Detect entry into #onFrame method
  if [[ "$line" == *"#onFrame"* ]] && [[ "$line" == *"("* ]]; then
    in_onframe=1
    onframe_brace_depth=0
  fi

  # Track brace depth inside #onFrame to detect its end
  if [ "$in_onframe" -eq 1 ]; then
    opens=$(count_char "$line" "{")
    closes=$(count_char "$line" "}")
    onframe_brace_depth=$((onframe_brace_depth + opens - closes))
    if [ "$onframe_brace_depth" -le 0 ] && [ $((opens + closes)) -gt 0 ]; then
      in_onframe=0
    fi
    continue
  fi

  # Detect start of an isActive-gated block (outside #onFrame)
  if [[ "$line" == *".isActive"* ]] && [[ "$line" == *"if"* ]]; then
    in_active_block=1
    found_reset=0
    block_start_line=$active_line
    continue
  fi

  if [ "$in_active_block" -eq 1 ]; then
    # Check for timestamp reset
    if [[ "$line" == *"#animationLastTime"*"performance.now()"* ]]; then
      found_reset=1
    fi

    # Check for markDirty() — this is the end of the pattern
    if [[ "$line" == *"markDirty()"* ]]; then
      if [ "$found_reset" -eq 0 ]; then
        echo "FAIL: $target:$active_line — markDirty() in isActive block (line $block_start_line) without timestamp reset."
        echo "      Add: this.#animationLastTime = performance.now(); before markDirty()."
        echo
        exit_code=1
      fi
      in_active_block=0
    fi

    # Closing brace ends the block search
    if [[ "$line" =~ ^[[:space:]]*\} ]]; then
      in_active_block=0
    fi
  fi
done < "$target"

if [ $exit_code -eq 0 ]; then
  echo "PASS: All animation-start markDirty() calls have timestamp resets."
fi

exit $exit_code
