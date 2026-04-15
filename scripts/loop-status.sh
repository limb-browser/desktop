#!/usr/bin/env bash
# Quick status check for the limb development loop.
# Usage: bash scripts/loop-status.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

get_progress() {
  bash "$REPO_ROOT/scripts/task-field.sh" "$1" progress 2>/dev/null || echo ""
}

# Count task statuses
total=0 complete=0 not_started=0 in_progress=0 needs_revision=0 other=0
for f in specs/tasks/task-*.md; do
  [ -f "$f" ] || continue
  total=$((total + 1))
  status=$(get_progress "$f")
  case "$status" in
    complete) complete=$((complete + 1)) ;;
    not-started) not_started=$((not_started + 1)) ;;
    in-progress) in_progress=$((in_progress + 1)) ;;
    needs-revision) needs_revision=$((needs_revision + 1)) ;;
    *) other=$((other + 1)) ;;
  esac
done

pct=$((complete * 100 / total))

# Active workers
workers=$(tmux list-windows -t limb-loop -F '#{window_name}' 2>/dev/null | grep -c 'task-' || echo 0)
worker_list=$(tmux list-windows -t limb-loop -F '#{window_name}' 2>/dev/null | grep 'task-' | tr '\n' ' ' || echo "none")

# Last merge
last_merge=$(grep 'Merged.*into dev' /tmp/limb-loop.log 2>/dev/null | tail -1 || echo "none")
last_error=$(grep '!!!' /tmp/limb-loop.log 2>/dev/null | tail -1 || echo "none")

# Git state
commits_ahead=$(git log --oneline origin/dev..dev 2>/dev/null | wc -l)

echo "=== Limb Loop Status ==="
echo "Progress: $complete/$total ($pct%)"
echo "  complete=$complete  not-started=$not_started  in-progress=$in_progress  needs-revision=$needs_revision"
echo "Workers: $workers active [$worker_list]"
echo "Last merge: $last_merge"
echo "Last error: $last_error"
echo "Dev ahead of origin by: $commits_ahead commits"

# Check for death loop (same task completing multiple times)
if [ -f /tmp/limb-loop.log ]; then
  repeat_tasks=$(grep '=== Task .* complete ===' /tmp/limb-loop.log | sed 's/.*Task //' | sed 's/ complete.*//' | sort | uniq -c | sort -rn | head -3)
  if echo "$repeat_tasks" | grep -qP '^\s+[2-9]'; then
    echo "WARNING: Possible death loop detected:"
    echo "$repeat_tasks"
  fi
fi
