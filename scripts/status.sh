#!/usr/bin/env bash
# Show current status of all tasks and active workers.
set -uo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

echo "=== Limb Task Status ==="
echo ""

total=0
complete=0
in_progress=0
not_started=0
needs_revision=0

for f in specs/tasks/task-*.md; do
  [ -f "$f" ] || continue
  total=$((total + 1))
  name=$(basename "$f" .md)
  title=$(head -1 "$f" | sed 's/^# //')
  status=$(grep -oP 'Progress:\*?\*?\s*`\K[^`]+' "$f" 2>/dev/null || echo "unknown")

  case "$status" in
    complete) complete=$((complete + 1)); icon="[x]" ;;
    in-progress) in_progress=$((in_progress + 1)); icon="[>]" ;;
    needs-revision) needs_revision=$((needs_revision + 1)); icon="[!]" ;;
    not-started) not_started=$((not_started + 1)); icon="[ ]" ;;
    *) icon="[?]" ;;
  esac

  printf "%s %-15s %s\n" "$icon" "$name" "$title"
done

echo ""
echo "Total: $total | Complete: $complete | In Progress: $in_progress | Not Started: $not_started | Needs Revision: $needs_revision"
