#!/usr/bin/env bash
# Analyze the event log for blog-ready metrics.
# Usage: ./scripts/analyze-events.sh [logs/events.jsonl]
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EVENT_LOG="${1:-$REPO_ROOT/logs/events.jsonl}"

if [ ! -f "$EVENT_LOG" ]; then
  echo "No event log found at $EVENT_LOG"
  exit 1
fi

BOLD=$'\033[1m' DIM=$'\033[2m' RESET=$'\033[0m'
GREEN=$'\033[32m' RED=$'\033[31m' CYAN=$'\033[36m'

total_events=$(wc -l < "$EVENT_LOG")
echo ""
echo "${BOLD}Limb Dev Loop Analysis${RESET}"
echo "${DIM}Source: $EVENT_LOG ($total_events events)${RESET}"
echo ""

# Timeline
first_ts=$(head -1 "$EVENT_LOG" | grep -oP '"ts":"[^"]+' | cut -d'"' -f4)
last_ts=$(tail -1 "$EVENT_LOG" | grep -oP '"ts":"[^"]+' | cut -d'"' -f4)
echo "${BOLD}Timeline${RESET}"
echo "  Started:  $first_ts"
echo "  Latest:   $last_ts"
echo ""

# Task completion
echo "${BOLD}Tasks${RESET}"
spawned=$(grep -c '"worker.spawn"' "$EVENT_LOG" 2>/dev/null || echo 0)
completed=$(grep -c '"worker.complete"' "$EVENT_LOG" 2>/dev/null || echo 0)
timeouts=$(grep -c '"worker.timeout"' "$EVENT_LOG" 2>/dev/null || echo 0)
errors=$(grep -c '"worker.error"' "$EVENT_LOG" 2>/dev/null || echo 0)
echo "  Spawned:     $spawned"
echo "  Completed:   ${GREEN}$completed${RESET}"
echo "  Timed out:   ${RED}$timeouts${RESET}"
echo "  Errors:      ${RED}$errors${RESET}"
echo ""

# Agent invocations
echo "${BOLD}Agent Invocations${RESET}"
impl_count=$(grep -c '"worker.implement.start"' "$EVENT_LOG" 2>/dev/null || echo 0)
verify_count=$(grep -c '"worker.verify.start"' "$EVENT_LOG" 2>/dev/null || echo 0)
pr_count=$(grep -c '"worker.process-revision.start"' "$EVENT_LOG" 2>/dev/null || echo 0)
pm_count=$(grep -c '"pm.start"' "$EVENT_LOG" 2>/dev/null || echo 0)
total_invocations=$((impl_count + verify_count + pr_count + pm_count))
echo "  Implementation:     $impl_count"
echo "  Verification:       $verify_count"
echo "  Process Revision:   $pr_count"
echo "  Project Manager:    $pm_count"
echo "  Total:              $total_invocations"
echo ""

# Time spent per agent type
echo "${BOLD}Time Per Agent Type${RESET}"
for agent in implement verify process-revision; do
  total_secs=$(grep "\"worker.$agent.done\"" "$EVENT_LOG" 2>/dev/null \
    | grep -oP '"duration_s":\K\d+' \
    | awk '{s+=$1} END {print s+0}')
  count=$(grep -c "\"worker.$agent.done\"" "$EVENT_LOG" 2>/dev/null || echo 0)
  if [ "$count" -gt 0 ]; then
    avg=$((total_secs / count))
    printf "  %-20s %5ds total  %4ds avg  (%d invocations)\n" "$agent" "$total_secs" "$avg" "$count"
  fi
done
pm_total=$(grep '"pm.done"' "$EVENT_LOG" 2>/dev/null \
  | grep -oP '"duration_s":\K\d+' \
  | awk '{s+=$1} END {print s+0}')
if [ "$pm_count" -gt 0 ]; then
  pm_avg=$((pm_total / pm_count))
  printf "  %-20s %5ds total  %4ds avg  (%d invocations)\n" "project-manager" "$pm_total" "$pm_avg" "$pm_count"
fi
echo ""

# Review quality
echo "${BOLD}Review Quality${RESET}"
total_findings=$(grep '"worker.verify.done"' "$EVENT_LOG" 2>/dev/null \
  | grep -oP '"findings":\K\d+' \
  | awk '{s+=$1} END {print s+0}')
pass_count=$(grep '"worker.verify.done"' "$EVENT_LOG" 2>/dev/null \
  | grep -c '"verdict":"PASS"' || echo 0)
fail_count=$(grep '"worker.verify.done"' "$EVENT_LOG" 2>/dev/null \
  | grep -c '"verdict":"FAIL"' || echo 0)
echo "  Reviews:        $verify_count"
echo "  Passed:         ${GREEN}$pass_count${RESET}"
echo "  Failed:         ${RED}$fail_count${RESET}"
echo "  Total findings: $total_findings"
if [ "$verify_count" -gt 0 ]; then
  echo "  First-pass rate: $((pass_count * 100 / verify_count))%"
fi
echo ""

# Code output
echo "${BOLD}Code Output (from completed tasks)${RESET}"
total_insertions=$(grep '"worker.complete"' "$EVENT_LOG" 2>/dev/null \
  | grep -oP '"insertions":\K\d+' \
  | awk '{s+=$1} END {print s+0}')
total_deletions=$(grep '"worker.complete"' "$EVENT_LOG" 2>/dev/null \
  | grep -oP '"deletions":\K\d+' \
  | awk '{s+=$1} END {print s+0}')
total_commits=$(grep '"worker.complete"' "$EVENT_LOG" 2>/dev/null \
  | grep -oP '"commits":\K\d+' \
  | awk '{s+=$1} END {print s+0}')
echo "  Commits:     $total_commits"
echo "  Insertions:  +$total_insertions"
echo "  Deletions:   -$total_deletions"
echo ""

# PRs
prs_created=$(grep -c '"pr.created"' "$EVENT_LOG" 2>/dev/null || echo 0)
if [ "$prs_created" -gt 0 ]; then
  echo "${BOLD}Pull Requests${RESET}"
  echo "  Created: $prs_created"
  grep '"pr.created"' "$EVENT_LOG" 2>/dev/null | while read -r line; do
    task=$(echo "$line" | grep -oP '"task":"\K[^"]+')
    url=$(echo "$line" | grep -oP '"url":"\K[^"]+')
    echo "  $task  $url"
  done
  echo ""
fi

# Per-task breakdown
echo "${BOLD}Per-Task Breakdown${RESET}"
printf "  ${DIM}%-14s  %6s  %6s  %6s  %8s  %10s${RESET}\n" "TASK" "ROUNDS" "FINDS" "PASS?" "DURATION" "LINES"
printf "  ${DIM}%s${RESET}\n" "--------------------------------------------------------------"

grep '"worker.spawn"' "$EVENT_LOG" 2>/dev/null | grep -oP '"task":"\K[^"]+' | while read -r task; do
  rounds=$(grep "\"task\":\"$task\"" "$EVENT_LOG" | grep -c '"worker.implement.start"' || echo 0)
  finds=$(grep "\"task\":\"$task\"" "$EVENT_LOG" | grep '"worker.verify.done"' | grep -oP '"findings":\K\d+' | awk '{s+=$1} END {print s+0}')

  complete_line=$(grep "\"task\":\"$task\"" "$EVENT_LOG" | grep '"worker.complete"' | tail -1)
  if [ -n "$complete_line" ]; then
    passed="${GREEN}yes${RESET}"
    ins=$(echo "$complete_line" | grep -oP '"insertions":\K\d+' || echo 0)
  else
    passed="${RED}no${RESET}"
    ins=0
  fi

  # Total duration across all agent invocations for this task
  dur=$(grep "\"task\":\"$task\"" "$EVENT_LOG" | grep -oP '"duration_s":\K\d+' | awk '{s+=$1} END {print s+0}')
  dur_min=$((dur / 60))

  printf "  %-14s  %6d  %6d  %b  %6dm  %+9d\n" "$task" "$rounds" "$finds" "$passed   " "$dur_min" "$ins"
done
echo ""
