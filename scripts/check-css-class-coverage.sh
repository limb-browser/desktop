#!/usr/bin/env bash
# Check that CSS classes assigned in .mjs files have selectors in .css files.
#
# Catches the pattern where an agent creates a DOM element and assigns a CSS
# class (e.g., `el.className = "branch-delete"`) but never defines a
# corresponding CSS selector — leaving the element unstyled.
#
# Strategy:
#   1. Find all .mjs files in src/limb/ (excluding tests).
#   2. Extract CSS class names from assignment patterns:
#      - el.className = "foo"  /  el.className = 'foo'
#      - el.classList.add("foo")  /  el.classList.add('foo')
#      - el.classList.toggle("foo")
#   3. For each class name, search all .css files in src/limb/ for a
#      selector containing .foo (the class selector).
#   4. If no CSS selector found, flag as missing.
#
# Excluded:
#   - classList.contains() / classList.remove() — read/removal operations
#     don't imply styling intent.
#   - Test files.
#   - Classes defined in external/Firefox stylesheets — only src/limb/ CSS
#     is checked since src/limb/ .mjs files should self-contain their styles.
#
# Usage: scripts/check-css-class-coverage.sh
# Exit 1 if any CSS class assigned in .mjs has no corresponding CSS selector.

set -euo pipefail

exit_code=0

mapfile -t mjs_files < <(
  find src/limb/ -type f -name '*.mjs' \
    ! -name '*.test.*' ! -name '*.spec.*' \
    2>/dev/null | sort
)

mapfile -t css_files < <(
  find src/limb/ -type f -name '*.css' 2>/dev/null | sort
)

# Bail early if no CSS files exist.
if [ ${#css_files[@]} -eq 0 ]; then
  echo "PASS: No CSS files found — nothing to check."
  exit 0
fi

# Build a combined index of all CSS selectors for fast lookup.
css_index=""
for css_file in "${css_files[@]}"; do
  css_index+=$(cat "$css_file" 2>/dev/null)
  css_index+=$'\n'
done

for mjs_file in "${mjs_files[@]}"; do
  [ -f "$mjs_file" ] || continue

  # Extract class names from className assignments: className = "foo bar"
  while IFS= read -r class_str; do
    [ -z "$class_str" ] && continue
    # Split space-separated classes
    for cls in $class_str; do
      [ -z "$cls" ] && continue
      if ! echo "$css_index" | grep -qP "\\.${cls}\b"; then
        line_no=$(grep -nP "className\s*=\s*[\"'].*\b${cls}\b" "$mjs_file" 2>/dev/null | head -1 | cut -d: -f1)
        echo "FAIL: $mjs_file:${line_no:-?} — CSS class '$cls' has no selector in any src/limb/ .css file."
        exit_code=1
      fi
    done
  done < <(
    grep -oP 'className\s*=\s*["\x27]([^"\x27]+)["\x27]' "$mjs_file" 2>/dev/null \
    | sed -E "s/className\s*=\s*[\"']([^\"']+)[\"']/\1/" \
    || true
  )

  # Extract class names from classList.add("foo") and classList.toggle("foo")
  while IFS= read -r cls; do
    [ -z "$cls" ] && continue
    if ! echo "$css_index" | grep -qP "\\.${cls}\b"; then
      line_no=$(grep -nP "classList\.(add|toggle)\([\"']${cls}[\"']" "$mjs_file" 2>/dev/null | head -1 | cut -d: -f1)
      echo "FAIL: $mjs_file:${line_no:-?} — CSS class '$cls' (via classList) has no selector in any src/limb/ .css file."
      exit_code=1
    fi
  done < <(
    grep -oP "classList\.(add|toggle)\([\"']([^\"']+)[\"']\)" "$mjs_file" 2>/dev/null \
    | grep -oP "(?<=\([\"'])[^\"']+(?=[\"']\))" \
    || true
  )
done

if [ $exit_code -eq 0 ]; then
  echo "PASS: All CSS classes assigned in .mjs files have selectors in .css files."
fi

exit $exit_code
