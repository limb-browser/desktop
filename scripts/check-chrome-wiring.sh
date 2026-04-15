#!/usr/bin/env bash
# Check that browser chrome artifacts in src/limb/ are wired into the
# browser's loading mechanism.
#
# Catches two patterns:
#   1. CSS files in src/limb/ not loaded via <link> in zen-assets.inc.xhtml.
#   2. .mjs entry-point modules in src/limb/ not loaded via ChromeUtils.importESModule
#      in browser-init-js.patch or <script> in zen-assets.inc.xhtml.
#
# An .mjs file is an "entry point" if no other non-test .mjs file imports it.
# Entry points must be explicitly loaded by the browser chrome.
#
# Usage: scripts/check-chrome-wiring.sh
# Exit 1 if any chrome artifact is unwired.

set -euo pipefail

exit_code=0

assets_file="src/browser/base/content/zen-assets.inc.xhtml"
patch_file="src/browser/base/content/browser-init-js.patch"

# --- CSS files ---
mapfile -t css_files < <(
  find src/limb/ -type f -name '*.css' 2>/dev/null | sort
)

for css_file in "${css_files[@]}"; do
  [ -f "$css_file" ] || continue

  # Convert src/limb/tree/foo.css -> limb/tree/foo.css (the chrome:// path component)
  chrome_path="${css_file#src/}"

  if ! grep -q "$chrome_path" "$assets_file" 2>/dev/null; then
    echo "FAIL: $css_file — not loaded in $assets_file."
    echo "  Add: <link rel=\"stylesheet\" type=\"text/css\" href=\"chrome://browser/content/$chrome_path\" />"
    exit_code=1
  fi
done

# --- .mjs entry-point modules ---
mapfile -t mjs_files < <(
  find src/limb/ -type f -name '*.mjs' \
    ! -name '*.test.*' ! -name '*.spec.*' \
    2>/dev/null | sort
)

for mjs_file in "${mjs_files[@]}"; do
  [ -f "$mjs_file" ] || continue

  basename_mjs=$(basename "$mjs_file")

  # Check if any other non-test .mjs file imports this module.
  # If so, it's transitively loaded and doesn't need direct wiring.
  importers=$(
    grep -rl --include='*.mjs' "$basename_mjs" src/limb/ 2>/dev/null \
    | grep -v '\.test\.' \
    | grep -v '\.spec\.' \
    | grep -v "^${mjs_file}$" \
    || true
  )

  if [ -n "$importers" ]; then
    # Transitively loaded by another module -- skip.
    continue
  fi

  # This is an entry point. It must appear in the patch or assets file.
  chrome_path="${mjs_file#src/}"

  found_in_patch=false
  found_in_assets=false

  if grep -q "$chrome_path" "$patch_file" 2>/dev/null; then
    found_in_patch=true
  fi
  if grep -q "$chrome_path" "$assets_file" 2>/dev/null; then
    found_in_assets=true
  fi

  if [ "$found_in_patch" = false ] && [ "$found_in_assets" = false ]; then
    echo "FAIL: $mjs_file — entry-point module not loaded by browser chrome."
    echo "  Not found in $patch_file or $assets_file."
    echo "  Add ChromeUtils.importESModule in the patch, or a <script> tag in assets."
    exit_code=1
  fi
done

if [ $exit_code -eq 0 ]; then
  echo "PASS: All browser chrome artifacts are wired."
fi

exit $exit_code
