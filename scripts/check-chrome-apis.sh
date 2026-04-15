#!/usr/bin/env bash
# Check for Chrome/V8-only APIs used in Firefox fork source files.
#
# Limb is a Firefox fork. Chrome/V8-only APIs silently fail or return
# undefined/0 at runtime. Optional chaining (?.) on these APIs masks
# the failure by falling back to a default value, making the feature
# appear to work while returning wrong data.
#
# Known Chrome-only APIs detected:
#   - performance.memory (V8 MemoryInfo; Firefox: Services.memory)
#   - performance.measureUserAgentSpecificMemory (Chrome 89+)
#   - navigator.userAgentData (Chrome 90+)
#   - chrome.tabs / chrome.runtime / chrome.storage (Chrome extensions API)
#
# Usage: scripts/check-chrome-apis.sh
# Exit 1 if any Chrome-only API is found.

set -euo pipefail

exit_code=0

# Each entry: "regex_pattern|human-readable description"
chrome_apis=(
  'performance\??\.memory\b|performance.memory is Chrome/V8-only. Firefox privileged code: use Services.memory.heapAllocated'
  'performance\??\.measureUserAgentSpecificMemory|performance.measureUserAgentSpecificMemory is Chrome 89+. No Firefox equivalent'
  'navigator\??\.userAgentData|navigator.userAgentData is Chrome 90+. Firefox: use navigator.userAgent'
  'chrome\??\.tabs\b|chrome.tabs is Chrome extension API. Firefox: use browser.tabs'
  'chrome\??\.runtime\b|chrome.runtime is Chrome extension API. Firefox: use browser.runtime'
  'chrome\??\.storage\b|chrome.storage is Chrome extension API. Firefox: use browser.storage'
)

# Search in src/limb/ and src/browser/ (excluding test files, node_modules)
mapfile -t source_files < <(
  find src/limb/ src/browser/ -type f \
    \( -name '*.mjs' -o -name '*.ts' -o -name '*.js' -o -name '*.patch' \) \
    ! -name '*.test.*' ! -name '*.spec.*' ! -path '*/node_modules/*' \
    2>/dev/null | sort
)

for api_entry in "${chrome_apis[@]}"; do
  pattern="${api_entry%%|*}"
  description="${api_entry#*|}"

  for src_file in "${source_files[@]}"; do
    [ -f "$src_file" ] || continue

    while IFS=: read -r line_no match_line; do
      echo "FAIL: $src_file:$line_no — $description"
      echo "  $match_line"
      exit_code=1
    done < <(grep -nP "$pattern" "$src_file" 2>/dev/null || true)
  done
done

if [ $exit_code -eq 0 ]; then
  echo "PASS: No Chrome/V8-only APIs found."
fi

exit $exit_code
