#!/usr/bin/env bash
# Worker: implement -> verify -> process-revision for one task in a worktree.
# Runs up to MAX_ROUNDS cycles until the task reaches `complete`.
# Signals completion by touching $WORKTREE/.done
# Usage: worker.sh <task-file> <worktree-path>
set -uo pipefail

TASK_FILE="$1"
WORKTREE="$2"
TASK_NAME=$(basename "$TASK_FILE" .md)

cd "$WORKTREE"

# Use the worktree's own copy of emit-event.sh (it resolves the real repo root internally)
emit() { bash "$WORKTREE/scripts/emit-event.sh" "$@"; }

log() {
  echo "[$(date '+%H:%M:%S')] [$TASK_NAME] $*" >> "$WORKTREE/.worker.log"
  echo "[$(date '+%H:%M:%S')] [$TASK_NAME] $*" >> /tmp/limb-loop.log
}

get_status() {
  bash scripts/task-field.sh "$TASK_FILE" progress 2>/dev/null || echo "unknown"
}

git_stats() {
  # Compare against the point we branched from dev
  local base
  base=$(git merge-base HEAD FETCH_HEAD 2>/dev/null || git merge-base HEAD origin/dev 2>/dev/null || echo "")
  if [ -z "$base" ]; then
    echo "commits=0 files_changed=0 insertions=0 deletions=0"
    return
  fi
  local commits files_changed insertions deletions
  commits=$(git rev-list --count "$base"..HEAD 2>/dev/null || echo 0)
  local diffstat
  diffstat=$(git diff --shortstat "$base"..HEAD 2>/dev/null || echo "")
  files_changed=$(echo "$diffstat" | grep -oP '\d+ file' | grep -oP '\d+' || echo 0)
  insertions=$(echo "$diffstat" | grep -oP '\d+ insertion' | grep -oP '\d+' || echo 0)
  deletions=$(echo "$diffstat" | grep -oP '\d+ deletion' | grep -oP '\d+' || echo 0)
  echo "commits=$commits files_changed=$files_changed insertions=$insertions deletions=$deletions"
}

inject_task_prompt() {
  local prompt_file="$1" task_file="$2"
  cat "$prompt_file"
  printf '\n---\n\n## Pre-computed Target\n\n'
  printf 'Your target task file is: `%s` (%s).\n' "$task_file" "$TASK_NAME"
  printf 'Read this file first. Do not scan other task files to find work.\n'
}

MAX_ROUNDS=${LIMB_MAX_ROUNDS:-50}
ROUND=0

emit worker.spawn task="$TASK_NAME"

while [ $ROUND -lt $MAX_ROUNDS ]; do
  ROUND=$((ROUND + 1))
  status=$(get_status)

  case "$status" in
    not-started|needs-revision|in-progress)
      # Rebase onto dev to pick up merged work from other workers.
      # Preserve our task/review files -- dev has stale versions.
      log "--- Rebasing onto dev (round $ROUND)"
      # Resolve main repo root: gitdir is like /path/to/repo/.git/worktrees/name (3 levels up)
      _gitdir=$(cat "$WORKTREE/.git" | sed 's/gitdir: //')
      MAIN_ROOT="$(cd "$(dirname "$(dirname "$(dirname "$_gitdir")")")" && pwd 2>/dev/null || echo "$WORKTREE")"
      cp "$TASK_FILE" "$TASK_FILE.bak" 2>/dev/null
      cp -r specs/reviews/ /tmp/limb-reviews-$TASK_NAME/ 2>/dev/null
      git fetch "$MAIN_ROOT" HEAD 2>/dev/null && git rebase FETCH_HEAD 2>/dev/null || \
        log "!!! Rebase failed (may need manual resolution)"
      # Restore our task/review state after rebase
      cp "$TASK_FILE.bak" "$TASK_FILE" 2>/dev/null && rm -f "$TASK_FILE.bak"
      cp -r /tmp/limb-reviews-$TASK_NAME/* specs/reviews/ 2>/dev/null
      rm -rf /tmp/limb-reviews-$TASK_NAME 2>/dev/null

      # Re-check status after rebase -- verifier may have set complete
      status=$(get_status)
      if [ "$status" = "complete" ]; then
        log "=== Task $TASK_NAME complete (detected after rebase) ==="
        emit worker.complete task="$TASK_NAME" rounds=$ROUND $(git_stats)
        touch "$WORKTREE/.done"
        exit 0
      fi
      if [ "$status" = "ready-for-review" ]; then
        log "    Status is ready-for-review after rebase -- skipping to verifier"
        continue
      fi

      log ">>> Implementation (round $ROUND, status=$status)"
      emit worker.implement.start task="$TASK_NAME" round=$ROUND status="$status"
      local_start=$(date '+%s')

      inject_task_prompt specs/prompts/implementation.md "$TASK_FILE" | \
        claude --model opus[1m] --dangerously-skip-permissions 2>/dev/null
      exit_code=$?

      local_end=$(date '+%s')
      duration=$((local_end - local_start))
      emit worker.implement.done task="$TASK_NAME" round=$ROUND exit_code=$exit_code duration_s=$duration $(git_stats)

      log "<<< Implementation done (exit=$exit_code, ${duration}s)"
      log "    Last commit: $(git log --oneline -1 2>/dev/null)"
      ;;

    ready-for-review)
      log ">>> Verifier (round $ROUND)"
      emit worker.verify.start task="$TASK_NAME" round=$ROUND
      local_start=$(date '+%s')

      inject_task_prompt specs/prompts/verifier.md "$TASK_FILE" | \
        claude --model opus[1m] --dangerously-skip-permissions 2>/dev/null
      exit_code=$?

      local_end=$(date '+%s')
      duration=$((local_end - local_start))

      log "<<< Verifier done (exit=$exit_code, ${duration}s)"
      log "    Last commit: $(git log --oneline -1 2>/dev/null)"

      new_status=$(get_status)

      # Count findings from review file if it exists
      findings=0
      review_file=$(ls -t specs/reviews/review-${TASK_NAME}*.md 2>/dev/null | head -1)
      if [ -n "$review_file" ]; then
        findings=$(grep -c '^\- \[ \]' "$review_file" 2>/dev/null || echo 0)
      fi

      if [ "$new_status" = "needs-revision" ]; then
        emit worker.verify.done task="$TASK_NAME" round=$ROUND verdict=FAIL findings=$findings duration_s=$duration

        log ">>> Process Revision (round $ROUND)"
        emit worker.process-revision.start task="$TASK_NAME" round=$ROUND
        pr_start=$(date '+%s')

        claude --model opus[1m] --dangerously-skip-permissions \
          < specs/prompts/process-revision.md 2>/dev/null

        pr_end=$(date '+%s')
        pr_duration=$((pr_end - pr_start))
        emit worker.process-revision.done task="$TASK_NAME" round=$ROUND duration_s=$pr_duration
        log "<<< Process Revision done (${pr_duration}s)"
      elif [ "$new_status" = "complete" ]; then
        emit worker.verify.done task="$TASK_NAME" round=$ROUND verdict=PASS findings=$findings duration_s=$duration
        # complete will be handled at top of next iteration
      elif [ "$new_status" = "ready-for-review" ]; then
        # Verifier didn't change status. Check the review file for verdict.
        review_verdict=""
        if [ -n "$review_file" ]; then
          review_verdict=$(grep -oP '^\s*(PASS|FAIL)' "$review_file" 2>/dev/null | tail -1)
        fi
        if [ "$review_verdict" = "PASS" ]; then
          log "    Verifier forgot to update status but review says PASS -- setting complete"
          emit worker.verify.done task="$TASK_NAME" round=$ROUND verdict=PASS findings=$findings duration_s=$duration
          sed -i 's/^progress: ready-for-review/progress: complete/' "$TASK_FILE"
        else
          log "    !!! Verifier did not update task status -- forcing needs-revision"
          emit worker.verify.done task="$TASK_NAME" round=$ROUND verdict=STUCK findings=$findings duration_s=$duration
          sed -i 's/^progress: ready-for-review/progress: needs-revision/' "$TASK_FILE"
        fi
      else
        emit worker.verify.done task="$TASK_NAME" round=$ROUND verdict=PASS findings=$findings duration_s=$duration
      fi
      ;;

    complete)
      log "=== Task $TASK_NAME complete ==="
      emit worker.complete task="$TASK_NAME" rounds=$ROUND $(git_stats)
      touch "$WORKTREE/.done"
      exit 0
      ;;


    *)
      log "!!! Unknown status: $status -- aborting"
      emit worker.error task="$TASK_NAME" status="$status" round=$ROUND
      touch "$WORKTREE/.done"
      exit 1
      ;;
  esac
done

log "!!! Max rounds ($MAX_ROUNDS) reached without completion for $TASK_NAME"
emit worker.timeout task="$TASK_NAME" rounds=$MAX_ROUNDS
touch "$WORKTREE/.done"
exit 1
