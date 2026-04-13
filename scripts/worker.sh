#!/usr/bin/env bash
# Worker script: runs implement->verify loop on a single task in a worktree.
# Usage: worker.sh <task-file> <worktree-path>
set -uo pipefail

TASK_FILE="$1"
WORKTREE="$2"
TASK_NAME=$(basename "$TASK_FILE" .md)
LOG="$WORKTREE/.worker.log"

cd "$WORKTREE"

log() {
  echo "[$(date '+%H:%M:%S')] [$TASK_NAME] $*" >> "$LOG"
  echo "[$(date '+%H:%M:%S')] [$TASK_NAME] $*" >> /tmp/limb-loop.log
}

inject_task_prompt() {
  local prompt_file="$1"
  local task_file="$2"
  {
    cat "$prompt_file"
    echo ""
    echo "---"
    echo ""
    echo "## Pre-computed Target"
    echo ""
    echo "Your target task file is: \`$task_file\` ($TASK_NAME)."
    echo "Read this file first. Do not scan other task files to find work."
  }
}

MAX_ROUNDS=6
ROUND=0

while [ $ROUND -lt $MAX_ROUNDS ]; do
  ROUND=$((ROUND + 1))
  status=$(grep -oP 'Progress:\*?\*?\s*`\K[^`]+' "$TASK_FILE" 2>/dev/null)

  case "$status" in
    not-started|needs-revision)
      log "--- Rebasing onto dev"
      git fetch origin dev 2>/dev/null && git rebase origin/dev 2>/dev/null || \
        log "!!! Rebase failed (may need manual resolution)"
      log ">>> Implementation (round $ROUND)"
      inject_task_prompt specs/prompts/implementation.md "$TASK_FILE" | \
        claude --model opus[1m] --dangerously-skip-permissions 2>/dev/null
      log "<<< Implementation done (exit=$?)"
      log "    Last commit: $(git log --oneline -1 2>/dev/null)"
      ;;
    ready-for-review)
      log ">>> Verifier (round $ROUND)"
      inject_task_prompt specs/prompts/verifier.md "$TASK_FILE" | \
        claude --model opus[1m] --dangerously-skip-permissions 2>/dev/null
      log "<<< Verifier done (exit=$?)"

      new_status=$(grep -oP 'Progress:\*?\*?\s*`\K[^`]+' "$TASK_FILE" 2>/dev/null)
      if [ "$new_status" = "needs-revision" ]; then
        log ">>> Process Revision"
        claude --model opus[1m] --dangerously-skip-permissions < specs/prompts/process-revision.md 2>/dev/null
        log "<<< Process Revision done"
      fi
      ;;
    complete)
      log "=== Task complete ==="
      touch "$WORKTREE/.done"
      exit 0
      ;;
    *)
      log "!!! Unknown status: $status"
      exit 1
      ;;
  esac
done

log "!!! Max rounds ($MAX_ROUNDS) reached without completion"
touch "$WORKTREE/.done"
exit 1
