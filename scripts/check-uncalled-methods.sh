#!/usr/bin/env bash
# Check that public methods on exported .mjs classes have at least one caller
# outside the defining file.
#
# Catches the pattern where an agent creates a public method (e.g.,
# notifyDataChange()) on a class that is used in production, but nothing
# actually invokes that specific method. The class passes the dead-exports
# check because it IS imported — but one of its methods is dead.
#
# Strategy:
#   1. Find all .mjs files in src/limb/ (excluding tests).
#   2. Extract public method names from exported classes.
#   3. For each method, search all non-test files in src/limb/ and
#      src/browser/ (patch files) for calls (`.methodName(` pattern).
#   4. If no external caller exists, flag as uncalled.
#
# Excluded:
#   - Private methods (#method) — internal by design.
#   - constructor — called implicitly via `new`.
#   - observe — nsIObserver interface, called by Firefox Services.obs.
#   - QueryInterface — XPCOM interface method.
#   - JavaScript keywords (if, for, while, switch, etc.).
#   - Test files.
#
# Usage: scripts/check-uncalled-methods.sh
# Exit 1 if any public method has zero external callers.

set -euo pipefail

exit_code=0

# Built-in method names that are called by framework/runtime, not user code.
FRAMEWORK_METHODS="constructor|observe|QueryInterface|toString|valueOf|toJSON"

# JavaScript keywords that match the method-extraction regex but are not methods.
JS_KEYWORDS="if|for|while|switch|return|throw|try|catch|finally|else|do|new|delete|typeof|void|in|of|case|default|break|continue|with|yield|await|class|function|const|let|var|export|import|static|super|this|true|false|null|undefined"

mapfile -t mjs_files < <(
  find src/limb/ -type f -name '*.mjs' \
    ! -name '*.test.*' ! -name '*.spec.*' \
    2>/dev/null | sort
)

for mjs_file in "${mjs_files[@]}"; do
  [ -f "$mjs_file" ] || continue

  # Only check files that export a class.
  grep -qP '^\s*export\s+class\s+' "$mjs_file" || continue

  # Extract public method names: lines like "  methodName(" or "  async methodName("
  # that are NOT preceded by # (private) and are inside a class body.
  while IFS= read -r method; do
    [ -z "$method" ] && continue

    # Skip framework methods.
    if echo "$method" | grep -qP "^($FRAMEWORK_METHODS)$"; then
      continue
    fi

    # Skip JavaScript keywords.
    if echo "$method" | grep -qP "^($JS_KEYWORDS)$"; then
      continue
    fi

    # Count external references: .methodName( in non-test files other than this one.
    # Search both src/limb/ (production modules) and src/browser/ (patch files).
    external_refs=$(
      {
        grep -rl --include='*.mjs' --include='*.ts' --include='*.js' --include='*.patch' --include='*.xhtml' \
          "\\.${method}(" src/limb/ src/browser/ 2>/dev/null || true
      } \
      | grep -v '\.test\.' \
      | grep -v '\.spec\.' \
      | grep -v '/test/' \
      | grep -v '/__tests__/' \
      | grep -v "^${mjs_file}$" \
      || true
    )

    if [ -z "$external_refs" ]; then
      line_no=$(grep -nP "^\s+(async\s+)?${method}\s*\(" "$mjs_file" 2>/dev/null | head -1 | cut -d: -f1)
      echo "FAIL: $mjs_file:${line_no:-?} — public method '$method' has no external callers."
      exit_code=1
    fi
  done < <(
    grep -P '^\s{2,}(async\s+)?(?!#)\w+\s*\(' "$mjs_file" 2>/dev/null \
    | grep -vP '^\s*(get|set)\s+' \
    | grep -vP '^\s*//' \
    | sed -E 's/^\s+(async\s+)?(\w+)\s*\(.*/\2/' \
    | sort -u
  )
done

if [ $exit_code -eq 0 ]; then
  echo "PASS: All public methods on exported classes have external callers."
fi

exit $exit_code
