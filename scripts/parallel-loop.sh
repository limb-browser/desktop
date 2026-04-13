#!/usr/bin/env bash
# Parallel development loop for Limb Browser.
# Spawns up to MAX_WORKERS concurrent workers in git worktrees.
# Each worker handles one task's implement->verify cycle.
# Main loop merges completed worktrees back to dev.
set -uo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

LOG=/tmp/limb-loop.log
WORKTREE_BASE="/tmp/limb-workers"
MAX_WORKERS=6

log() {
  echo "[$(date '+%H:%M:%S')] [orchestrator] $*" >> "$LOG"
}

# --- Dependency resolution ---

task_is_complete() {
  local num="$1"
  local f="specs/tasks/task-${num}.md"
  [ -f "$f" ] && grep -qP '\*\*Progress:\*\*\s*`complete`' "$f" 2>/dev/null
}

deps_satisfied() {
  local task_file="$1"
  local deps
  deps=$(grep -oP 'Depends on:\*?\*?\s*\K.*' "$task_file" 2>/dev/null | head -1)
  [ -z "$deps" ] && return 0
  echo "$deps" | grep -q "none" && return 0

  for dep in $(echo "$deps" | tr ',' ' '); do
    dep=$(echo "$dep" | tr -d ' ' | sed 's/task-//')
    [ -z "$dep" ] && continue
    dep=$(printf "%03d" "$((10#$dep))")
    if ! task_is_complete "$dep"; then
      return 1
    fi
  done
  return 0
}

find_eligible_tasks() {
  # needs-revision first, then not-started with deps satisfied
  for f in specs/tasks/task-*.md; do
    [ -f "$f" ] || continue
    local status
    status=$(grep -oP 'Progress:\*?\*?\s*`\K[^`]+' "$f" 2>/dev/null)
    [ "$status" = "needs-revision" ] && echo "$f"
  done
  for f in specs/tasks/task-*.md; do
    [ -f "$f" ] || continue
    local status
    status=$(grep -oP 'Progress:\*?\*?\s*`\K[^`]+' "$f" 2>/dev/null)
    [ "$status" != "not-started" ] && continue
    deps_satisfied "$f" && echo "$f"
  done
}

# --- Worker management ---

declare -A ACTIVE_WORKERS=()
declare -A WORKER_PIDS=()

spawn_worker() {
  local task_file="$1"
  local task_name
  task_name=$(basename "$task_file" .md)
  local worktree="$WORKTREE_BASE/$task_name"

  git branch -D "worker/$task_name" 2>/dev/null

  git worktree add "$worktree" -b "worker/$task_name" HEAD 2>/dev/null
  if [ $? -ne 0 ]; then
    log "!!! Failed to create worktree for $task_name"
    return 1
  fi

  ACTIVE_WORKERS[$task_name]="$worktree"

  log ">>> Spawning worker: $task_name (worktree: $worktree)"
  tmux new-window -t limb-loop -n "$task_name" \
    "bash $REPO_DIR/scripts/worker.sh '$task_file' '$worktree'"

  return 0
}

check_worker_done() {
  local task_name="$1"
  local worktree="${ACTIVE_WORKERS[$task_name]}"
  [ -f "$worktree/.done" ]
}

merge_worker() {
  local task_name="$1"
  local worktree="${ACTIVE_WORKERS[$task_name]}"
  local branch="worker/$task_name"

  log "<<< Merging $task_name back to dev"

  if git merge "$branch" --no-edit -m "merge: integrate $task_name from parallel worker" 2>/dev/null; then
    log "    Merge successful"
  else
    log "    Merge conflict on $task_name -- attempting resolution"
    git checkout --theirs specs/tasks/ 2>/dev/null
    git add specs/tasks/ 2>/dev/null
    local conflicts
    conflicts=$(git diff --name-only --diff-filter=U 2>/dev/null)
    if [ -n "$conflicts" ]; then
      log "    Unresolvable conflicts in: $conflicts"
      git merge --abort 2>/dev/null
      log "    !!! Merge aborted for $task_name -- will retry next round"
      git worktree remove "$worktree" --force 2>/dev/null
      git branch -D "$branch" 2>/dev/null
      unset "ACTIVE_WORKERS[$task_name]"
      return 1
    fi
    git commit --no-edit 2>/dev/null
    log "    Conflict auto-resolved"
  fi

  if git push 2>/dev/null; then
    log "    Pushed to remote"
  else
    log "    Push failed (non-fatal)"
  fi

  git worktree remove "$worktree" --force 2>/dev/null
  git branch -d "$branch" 2>/dev/null
  unset "ACTIVE_WORKERS[$task_name]"
  log "    Cleaned up worktree for $task_name"
  return 0
}

cleanup_all() {
  log "Cleaning up all worktrees..."
  for task_name in "${!ACTIVE_WORKERS[@]}"; do
    local worktree="${ACTIVE_WORKERS[$task_name]}"
    git worktree remove "$worktree" --force 2>/dev/null
    git branch -D "worker/$task_name" 2>/dev/null
  done
  rm -rf "$WORKTREE_BASE" 2>/dev/null
}

trap cleanup_all EXIT

# --- Main loop ---

mkdir -p "$WORKTREE_BASE"
> "$LOG"
log "=== Limb Parallel Dev Loop Started (max $MAX_WORKERS workers) ==="

ITERATION=0
while true; do
  ITERATION=$((ITERATION + 1))
  log "--- Iteration $ITERATION (${#ACTIVE_WORKERS[@]} active workers) ---"

  # Check for completed workers and merge them
  for task_name in "${!ACTIVE_WORKERS[@]}"; do
    if check_worker_done "$task_name"; then
      merge_worker "$task_name"
    fi
  done

  # Spawn new workers for eligible tasks
  active=${#ACTIVE_WORKERS[@]}
  if [ "$active" -lt "$MAX_WORKERS" ]; then
    slots=$((MAX_WORKERS - active))
    eligible=$(find_eligible_tasks | head -$slots)

    for task_file in $eligible; do
      task_name=$(basename "$task_file" .md)
      [ -n "${ACTIVE_WORKERS[$task_name]:-}" ] && continue
      spawn_worker "$task_file" || true
    done
  fi

  # Check completion
  active=${#ACTIVE_WORKERS[@]}
  if [ "$active" -eq 0 ]; then
    remaining=$(find_eligible_tasks | wc -l)
    if [ "$remaining" -eq 0 ]; then
      not_started=$(grep -rlP 'Progress:\*?\*?\s*`not-started`' specs/tasks/ 2>/dev/null | wc -l)
      if [ "$not_started" -eq 0 ]; then
        log "=== All tasks complete! ==="
        break
      else
        log "    $not_started tasks remaining but blocked on dependencies. Waiting..."
      fi
    fi
  fi

  sleep 30
done
