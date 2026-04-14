#!/usr/bin/env bash
# Parallel development loop for Limb Browser.
#
# Architecture:
#   Serial on main:  PM creates/updates tasks
#   Parallel in worktrees: workers run implement -> verify -> process-revision
#
# The PM runs on main each cycle to create tasks from specs. Workers are
# spawned in git worktrees (one per task) and run independently. Completed
# worktrees are merged back to dev.
#
# Prerequisites: tmux session (set LIMB_TMUX_SESSION, default "limb-loop").
# Usage: bash scripts/parallel-loop.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

LOG=/tmp/limb-loop.log
WORKTREE_BASE="$REPO_ROOT/worktrees/workers"
MAX_WORKERS=${LIMB_MAX_WORKERS:-6}
TMUX_SESSION=${LIMB_TMUX_SESSION:-limb-loop}

log() { echo "[$(date '+%H:%M:%S')] [orchestrator] $*" | tee -a "$LOG"; }
emit() { bash "$REPO_ROOT/scripts/emit-event.sh" "$@"; }

# --- Task metadata helpers ---

get_progress() {
  bash "$REPO_ROOT/scripts/task-field.sh" "$1" progress 2>/dev/null || echo ""
}

task_is_complete() {
  local f="$REPO_ROOT/specs/tasks/task-${1}.md"
  [ -f "$f" ] && [ "$(get_progress "$f")" = "complete" ]
}

deps_satisfied() {
  local task_file="$1"
  local deps
  deps=$(bash "$REPO_ROOT/scripts/task-field.sh" "$task_file" depends_on 2>/dev/null)
  [ -z "$deps" ] && return 0

  while IFS= read -r dep; do
    [ -z "$dep" ] && continue
    local num
    num=$(echo "$dep" | sed 's/task-//' | sed 's/^0*//')
    [ -z "$num" ] && continue
    num=$(printf "%03d" "$((10#$num))")
    if ! task_is_complete "$num"; then
      return 1
    fi
  done <<< "$deps"
  return 0
}

find_eligible_tasks() {
  # Priority 1: needs-revision tasks
  for f in "$REPO_ROOT"/specs/tasks/task-*.md; do
    [ -f "$f" ] || continue
    [ "$(get_progress "$f")" = "needs-revision" ] && echo "$f"
  done
  # Priority 2: in-progress tasks (stale from a previous loop run)
  for f in "$REPO_ROOT"/specs/tasks/task-*.md; do
    [ -f "$f" ] || continue
    [ "$(get_progress "$f")" = "in-progress" ] && echo "$f"
  done
  # Priority 3: not-started tasks with satisfied deps
  for f in "$REPO_ROOT"/specs/tasks/task-*.md; do
    [ -f "$f" ] || continue
    [ "$(get_progress "$f")" != "not-started" ] && continue
    deps_satisfied "$f" && echo "$f"
  done
}

# --- Worker management ---

declare -A ACTIVE_WORKERS=()

spawn_worker() {
  local task_file="$1"
  local task_name
  task_name=$(basename "$task_file" .md)
  local worktree="$WORKTREE_BASE/$task_name"
  local branch="worker/$task_name"

  # Clean up any stale worktrees holding this branch (e.g. leftover Claude agent worktrees)
  local stale_wt
  stale_wt=$(git worktree list --porcelain | awk -v b="$branch" '
    /^worktree / { wt=$2 }
    /^branch / && $2 == "refs/heads/" b { print wt }
  ')
  if [ -n "$stale_wt" ]; then
    log "    Cleaning stale worktree for $branch at $stale_wt"
    git worktree remove "$stale_wt" --force 2>/dev/null
  fi

  # Also remove our own stale worktree directory if it exists
  if [ -d "$worktree" ]; then
    log "    Cleaning stale worktree directory $worktree"
    git worktree remove "$worktree" --force 2>/dev/null
    rm -rf "$worktree" 2>/dev/null
  fi

  git branch -D "$branch" 2>/dev/null

  if ! git worktree add "$worktree" -b "$branch" HEAD 2>/dev/null; then
    log "!!! Failed to create worktree for $task_name"
    return 1
  fi

  log ">>> Spawning worker: $task_name (worktree: $worktree)"

  if ! tmux new-window -t "$TMUX_SESSION" -n "$task_name" \
    "bash '$REPO_ROOT/scripts/worker.sh' '$task_file' '$worktree'; echo 'Worker $task_name exited'; sleep 5"; then
    log "!!! Failed to spawn tmux window for $task_name (session '$TMUX_SESSION' exists?)"
    git worktree remove "$worktree" --force 2>/dev/null
    git branch -D "worker/$task_name" 2>/dev/null
    return 1
  fi

  ACTIVE_WORKERS[$task_name]="$worktree"
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

  # Check if the task actually completed or just timed out
  local wt_task="$worktree/specs/tasks/$task_name.md"
  local wt_status=""
  if [ -f "$wt_task" ]; then
    wt_status=$(bash "$REPO_ROOT/scripts/task-field.sh" "$wt_task" progress 2>/dev/null || echo "unknown")
  fi

  if [ "$wt_status" != "complete" ] && [ "$wt_status" != "ready-for-review" ]; then
    log "<<< Skipping PR for $task_name (status: $wt_status -- incomplete/timed out)"
    git worktree remove "$worktree" --force 2>/dev/null
    git branch -D "$branch" 2>/dev/null
    unset "ACTIVE_WORKERS[$task_name]"
    return 1
  fi

  log "<<< Creating PR for $task_name (status: $wt_status)"

  # Push the worker branch to origin
  if ! git push origin "$branch" -u 2>/dev/null; then
    log "    !!! Push failed for $branch"
    git worktree remove "$worktree" --force 2>/dev/null
    git branch -D "$branch" 2>/dev/null
    unset "ACTIVE_WORKERS[$task_name]"
    return 1
  fi

  # Extract task title for PR
  local task_file="$REPO_ROOT/specs/tasks/$task_name.md"
  local task_title
  task_title=$(bash "$REPO_ROOT/scripts/task-field.sh" "$task_file" title 2>/dev/null || echo "$task_name")

  # Create PR via gh CLI
  local pr_url
  pr_url=$(gh pr create \
    --repo limb-browser/desktop \
    --head "$branch" \
    --base dev \
    --title "$task_title" \
    --body "$(cat <<PREOF
## Task

\`$task_name\` -- $task_title

## Changes

See commits on this branch for details. Task file: \`specs/tasks/$task_name.md\`

Generated by the Limb parallel dev loop.
PREOF
)" 2>&1) || true

  if echo "$pr_url" | grep -q 'https://'; then
    emit pr.created task="$task_name" url="$pr_url"
    log "    PR created: $pr_url"

    # Auto-merge if LIMB_AUTO_MERGE is set
    if [ "${LIMB_AUTO_MERGE:-}" = "1" ]; then
      if gh pr merge "$pr_url" --squash --delete-branch 2>/dev/null; then
        log "    PR auto-merged and branch deleted"
        git pull --rebase origin dev 2>/dev/null
        # Update task status on dev to reflect completion
        local task_on_dev="$REPO_ROOT/specs/tasks/$task_name.md"
        if [ -f "$task_on_dev" ]; then
          sed -i 's/^progress: .*/progress: complete/' "$task_on_dev"
          git add "$task_on_dev" && git commit -m "chore: mark $task_name complete after auto-merge" --no-verify 2>/dev/null
          git push origin dev 2>/dev/null
        fi
      else
        log "    Auto-merge failed (may need manual review)"
      fi
    fi
  else
    log "    PR creation failed: $pr_url"
    log "    Branch $branch is pushed -- create PR manually"
  fi

  git worktree remove "$worktree" --force 2>/dev/null
  # Keep branch if PR is open; delete if merged
  if [ "${LIMB_AUTO_MERGE:-}" = "1" ]; then
    git branch -D "$branch" 2>/dev/null
  fi
  unset "ACTIVE_WORKERS[$task_name]"
  log "    Cleaned up worktree for $task_name"
  return 0
}

cleanup_all() {
  log "Loop exiting -- detaching worktrees (branches preserved for recovery)"
  for task_name in "${!ACTIVE_WORKERS[@]}"; do
    local worktree="${ACTIVE_WORKERS[$task_name]}"
    git worktree remove "$worktree" --force 2>/dev/null
    log "    Detached worktree for $task_name (branch worker/$task_name intact)"
  done
  rm -rf "$WORKTREE_BASE" 2>/dev/null
}
trap cleanup_all EXIT

# --- Main loop ---

mkdir -p "$WORKTREE_BASE"
> "$LOG"
log "=== Limb Parallel Dev Loop Started (max $MAX_WORKERS workers) ==="
emit loop.start max_workers=$MAX_WORKERS

# Pre-flight: handle any ready-for-review tasks on main
for f in "$REPO_ROOT"/specs/tasks/task-*.md; do
  [ -f "$f" ] || continue
  status=$(get_progress "$f")
  [ "$status" = "ready-for-review" ] || continue
  task_name=$(basename "$f" .md)
  log ">>> Pre-flight: verifying $task_name on main"
  {
    cat specs/prompts/verifier.md
    printf '\n---\n\n## Pre-computed Target\n\nYour target task file is: `%s` (%s).\nRead this file first. Do not scan other task files to find work.\n' "$f" "$task_name"
  } | claude --model opus[1m] --dangerously-skip-permissions 2>/dev/null
  log "<<< Pre-flight verifier done for $task_name"

  new_status=$(get_progress "$f")
  if [ "$new_status" = "needs-revision" ]; then
    log ">>> Pre-flight: process revision for $task_name"
    claude --model opus[1m] --dangerously-skip-permissions < specs/prompts/process-revision.md 2>/dev/null
    log "<<< Pre-flight process revision done"
  fi
done

ITERATION=0
while true; do
  ITERATION=$((ITERATION + 1))
  log "--- Orchestrator cycle $ITERATION (${#ACTIVE_WORKERS[@]} active workers) ---"

  # 1. SERIAL: Project manager (creates/updates tasks on main)
  log ">>> Project Manager"
  emit pm.start iteration=$ITERATION
  pm_start=$(date '+%s')

  claude --model opus[1m] --dangerously-skip-permissions \
    < specs/prompts/project-manager.md 2>/dev/null

  pm_end=$(date '+%s')
  pm_duration=$((pm_end - pm_start))
  tasks_total=$(ls specs/tasks/task-*.md 2>/dev/null | wc -l)
  tasks_complete=0
  for _tf in specs/tasks/task-*.md; do
    [ -f "$_tf" ] && [ "$(get_progress "$_tf")" = "complete" ] && tasks_complete=$((tasks_complete + 1))
  done
  emit pm.done iteration=$ITERATION duration_s=$pm_duration tasks_total=$tasks_total tasks_complete=$tasks_complete
  log "<<< Project Manager done (${pm_duration}s, $tasks_total tasks)"

  # 1b. Propagate latest scripts to active worktrees
  for task_name in "${!ACTIVE_WORKERS[@]}"; do
    worktree="${ACTIVE_WORKERS[$task_name]}"
    cp "$REPO_ROOT/scripts/worker.sh" "$worktree/scripts/worker.sh" 2>/dev/null
    cp "$REPO_ROOT/scripts/emit-event.sh" "$worktree/scripts/emit-event.sh" 2>/dev/null
    cp "$REPO_ROOT/scripts/task-field.sh" "$worktree/scripts/task-field.sh" 2>/dev/null
  done

  # 2. Merge completed workers back to dev
  for task_name in "${!ACTIVE_WORKERS[@]}"; do
    if check_worker_done "$task_name"; then
      merge_worker "$task_name"
    fi
  done

  # 3. Spawn new workers for eligible tasks
  active=${#ACTIVE_WORKERS[@]}
  if [ "$active" -lt "$MAX_WORKERS" ]; then
    slots=$((MAX_WORKERS - active))
    eligible=$(find_eligible_tasks | head -"$slots")

    for task_file in $eligible; do
      task_name=$(basename "$task_file" .md)
      [ -n "${ACTIVE_WORKERS[$task_name]:-}" ] && continue
      spawn_worker "$task_file" || true
    done
  fi

  # 4. Chronicler (every 3rd cycle)
  if [ $((ITERATION % 3)) -eq 0 ] && [ -f logs/events.jsonl ]; then
    log ">>> Chronicler"
    emit chronicler.start iteration=$ITERATION
    claude --model sonnet --dangerously-skip-permissions \
      < specs/prompts/chronicler.md 2>/dev/null
    emit chronicler.done iteration=$ITERATION
    log "<<< Chronicler done"
  fi

  # 5. Status report
  active=${#ACTIVE_WORKERS[@]}
  log "    Active workers: $active"
  for task_name in "${!ACTIVE_WORKERS[@]}"; do
    log "      - $task_name"
  done

  # 5. Check convergence
  if [ "$active" -eq 0 ]; then
    remaining=$(find_eligible_tasks | wc -l)
    if [ "$remaining" -eq 0 ]; then
      not_started=$(grep -rl 'not-started' "$REPO_ROOT"/specs/tasks/ 2>/dev/null | wc -l)
      if [ "$not_started" -eq 0 ]; then
        log "=== All tasks complete ==="
        emit loop.complete iterations=$ITERATION
        break
      else
        log "    $not_started tasks remaining but blocked on dependencies"
      fi
    fi
  fi

  sleep 30
done

log "=== Loop complete after $ITERATION iterations ==="
