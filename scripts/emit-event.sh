#!/usr/bin/env bash
# Emit a structured event to the JSONL event log.
# Usage: emit-event.sh <event_type> [key=value ...]
#
# Examples:
#   emit-event.sh worker.spawn task=task-001
#   emit-event.sh worker.implement.start task=task-001 round=1
#   emit-event.sh worker.verify.done task=task-001 round=2 verdict=FAIL findings=3
#   emit-event.sh merge.success task=task-001
#   emit-event.sh pm.done tasks_created=5 tasks_total=12
#
# Output: appends one JSON line to $LIMB_EVENT_LOG (default: logs/events.jsonl)
set -euo pipefail

# Resolve to the real repo root, not a worktree.
# git worktrees set core.worktree; commondir points to the main .git
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "$SCRIPT_DIR/.git" ]; then
  # This is a worktree -- .git is a file like "gitdir: /path/to/repo/.git/worktrees/name"
  # We need the repo root, which is 3 dirnames up from the gitdir path
  _gitdir=$(cat "$SCRIPT_DIR/.git" | sed 's/gitdir: //')
  REPO_ROOT="$(cd "$(dirname "$(dirname "$(dirname "$_gitdir")")")" && pwd)"
else
  REPO_ROOT="$SCRIPT_DIR"
fi
EVENT_LOG="${LIMB_EVENT_LOG:-$REPO_ROOT/logs/events.jsonl}"
mkdir -p "$(dirname "$EVENT_LOG")"

EVENT_TYPE="$1"
shift

# Build JSON object
TS=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
EPOCH=$(date '+%s')

JSON="{\"ts\":\"$TS\",\"epoch\":$EPOCH,\"event\":\"$EVENT_TYPE\""

for arg in "$@"; do
  key="${arg%%=*}"
  val="${arg#*=}"
  # Try to detect numbers
  if [[ "$val" =~ ^[0-9]+$ ]]; then
    JSON+=",\"$key\":$val"
  else
    # Escape quotes in value
    val="${val//\"/\\\"}"
    JSON+=",\"$key\":\"$val\""
  fi
done

JSON+="}"

echo "$JSON" >> "$EVENT_LOG"
