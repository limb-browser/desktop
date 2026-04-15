#!/usr/bin/env bash
# Check that code which directly manipulates coordinator-managed animation
# state also cancels the coordinator registration.
#
# interaction-feel.md S7.4 requires the AnimationCoordinator to be the
# single owner of animation lifecycle. When code bypasses the coordinator
# to directly set final state (e.g., skip-to-end in degraded mode), it
# MUST also cancel the coordinator registration for that property.
# Otherwise, coordinator.tick() overwrites the final state on the next
# frame using the adapter's captured closure references.
#
# Strategy:
#   Within methods that call coordinator.tick(), find code that directly
#   nulls animation state (this.#animation = null) without a coordinator
#   cancel call between the null and the tick().
#
# The dangerous pattern (within #onFrame or similar):
#   this.#animation = null;          // Bypass: directly nulls state
#   // ... no coordinator cancel ...
#   this.#coordinator?.tick();       // Coordinator still ticks stale adapter
#
# The safe pattern:
#   this.#coordinator?.cancelAll();  // Cancel registrations first
#   this.#animation = null;          // Then clean up local state
#   // ... coordinator.tick() is now safe ...
#
# Usage: scripts/check-coordinator-bypass.sh
# Exit 1 if any coordinator-managed state is modified without coordinator cleanup.

set -euo pipefail

exit_code=0
target="src/limb/tree/LimbTreeView.mjs"

if [ ! -f "$target" ]; then
  echo "SKIP: $target not found."
  exit 0
fi

# First, check if the file uses a coordinator at all.
if ! grep -q '#coordinator' "$target"; then
  echo "SKIP: No coordinator usage found in $target."
  exit 0
fi

# Find methods that contain coordinator.tick(). Within each such method,
# check that any direct animation-state nulling has a coordinator cancel
# between it and the tick() call.
#
# Approach: extract the #onFrame method (the only method that should call
# tick()), then scan within it for the bypass pattern.

# Phase 1: Find line ranges of methods that call coordinator.tick().
# We detect method boundaries by tracking brace depth from the method
# signature line.

declare -a tick_method_ranges=()
line_no=0
in_method=0
method_start=0
method_brace_depth=0

while IFS= read -r line; do
  line_no=$((line_no + 1))

  # Detect method start (private method or regular method in a class)
  if [ "$in_method" -eq 0 ]; then
    if [[ "$line" =~ ^[[:space:]]+(#[a-zA-Z_][a-zA-Z0-9_]*|[a-zA-Z_][a-zA-Z0-9_]*)\( ]] && \
       [[ "$line" == *"{"* ]] || [[ "$line" == *"() {"* ]]; then
      # Check if this method contains a coordinator.tick() call
      # by lookahead. We'll record the method and check later.
      in_method=1
      method_start=$line_no
      method_brace_depth=0
    fi
  fi

  if [ "$in_method" -eq 1 ]; then
    opens="${line//[^\{]/}"
    closes="${line//[^\}]/}"
    method_brace_depth=$((method_brace_depth + ${#opens} - ${#closes}))
    if [ "$method_brace_depth" -le 0 ] && [ $((${#opens} + ${#closes})) -gt 0 ]; then
      tick_method_ranges+=("$method_start:$line_no")
      in_method=0
    fi
  fi
done < "$target"

# Phase 2: For each method range, check if it contains coordinator.tick().
# If so, scan within that range for the bypass pattern.
for range in "${tick_method_ranges[@]}"; do
  start="${range%%:*}"
  end="${range##*:}"

  # Extract the method body
  method_body=$(sed -n "${start},${end}p" "$target")

  # Skip methods without coordinator.tick()
  if ! echo "$method_body" | grep -q '#coordinator.*tick()'; then
    continue
  fi

  # Within this method, find animation-null lines that appear before
  # coordinator.tick() without an intervening coordinator cancel.
  in_cancel_callback=0
  cancel_brace_depth=0
  found_coordinator_cancel=0
  pending_null_lineno=0
  pending_null_line=""
  local_line=0

  while IFS= read -r mline; do
    local_line=$((local_line + 1))
    abs_line=$((start + local_line - 1))

    # Detect cancel() callback (adapter pattern in object literals)
    if [[ "$mline" =~ cancel\(\)[[:space:]]*\{ ]]; then
      in_cancel_callback=1
      cancel_brace_depth=1
      continue
    fi

    if [ "$in_cancel_callback" -eq 1 ]; then
      opens="${mline//[^\{]/}"
      closes="${mline//[^\}]/}"
      cancel_brace_depth=$((cancel_brace_depth + ${#opens} - ${#closes}))
      if [ "$cancel_brace_depth" -le 0 ]; then
        in_cancel_callback=0
      fi
      continue
    fi

    # Detect coordinator cancel calls within this method
    if [[ "$mline" == *"#coordinator"*"cancel"* ]] || \
       [[ "$mline" == *"coordinator"*"cancel"* ]]; then
      found_coordinator_cancel=1
      # A cancel resets any pending null (the null is now safe)
      pending_null_lineno=0
      pending_null_line=""
    fi

    # Detect direct animation state nulling
    if [[ "$mline" =~ this\.#animation[[:space:]]*=[[:space:]]*null ]]; then
      if [ "$in_cancel_callback" -eq 0 ]; then
        # Reset cancel tracking -- we need a cancel AFTER this null
        found_coordinator_cancel=0
        pending_null_line="$mline"
        pending_null_lineno=$abs_line
      fi
    fi

    # When we hit coordinator.tick(), check for unguarded nulls
    if [[ "$mline" == *"#coordinator"*"tick()"* ]]; then
      if [ "$pending_null_lineno" -gt 0 ] && [ "$found_coordinator_cancel" -eq 0 ]; then
        echo "FAIL: $target:$pending_null_lineno — animation state nulled without coordinator cancel before tick()."
        echo "      ${pending_null_line}"
        echo "      The coordinator still has an adapter registered that will overwrite the final state."
        echo "      Cancel the coordinator registration before or immediately after nulling the state."
        echo
        exit_code=1
      fi
      pending_null_lineno=0
      pending_null_line=""
      found_coordinator_cancel=0
    fi

  done <<< "$method_body"
done

if [ $exit_code -eq 0 ]; then
  echo "PASS: All animation state bypasses have corresponding coordinator cleanup."
fi

exit $exit_code
