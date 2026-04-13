#!/usr/bin/env bash
# Limb Build Stats - tracks velocity, quality, and loop metrics.
# Usage: ./scripts/stats.sh [--json]
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TASKS_DIR="$REPO_ROOT/specs/tasks"
REVIEWS_DIR="$REPO_ROOT/specs/reviews"
WORKTREE_BASE="$REPO_ROOT/worktrees/workers"
JSON_MODE=false
[[ "${1:-}" == "--json" ]] && JSON_MODE=true

# --- Colors ---
if $JSON_MODE; then
    BOLD="" DIM="" RESET="" GREEN="" YELLOW="" RED="" CYAN="" BLUE="" MAGENTA=""
else
    BOLD=$'\033[1m' DIM=$'\033[2m' RESET=$'\033[0m'
    GREEN=$'\033[32m' YELLOW=$'\033[33m' RED=$'\033[31m'
    CYAN=$'\033[36m' BLUE=$'\033[34m' MAGENTA=$'\033[35m'
fi

# --- Task status counts ---
total_tasks=0; complete=0; in_review=0; in_progress=0; not_started=0; needs_revision=0
declare -a task_names=() task_statuses=() task_titles=()

for f in "$TASKS_DIR"/task-*.md; do
    [[ -f "$f" ]] || continue
    total_tasks=$((total_tasks + 1))
    name=$(basename "$f" .md)
    status=$(bash "$REPO_ROOT/scripts/task-field.sh" "$f" progress 2>/dev/null || echo "unknown")
    title=$(bash "$REPO_ROOT/scripts/task-field.sh" "$f" title 2>/dev/null || head -1 "$f" | sed 's/^# //')

    # Override with live worktree status if a worker is active
    wt_file="$WORKTREE_BASE/$name/specs/tasks/$name.md"
    if [[ -d "$WORKTREE_BASE/$name" ]] && [[ -f "$wt_file" ]]; then
        wt_status=$(bash "$REPO_ROOT/scripts/task-field.sh" "$wt_file" progress 2>/dev/null || echo "$status")
        [[ "$wt_status" == "not-started" ]] && wt_status="in-progress"
        status="$wt_status"
    fi

    # Truncate long titles
    if [[ ${#title} -gt 40 ]]; then
        title="${title:0:19}..${title: -19}"
    fi

    task_names+=("$name")
    task_statuses+=("$status")
    task_titles+=("$title")

    case "$status" in
        complete) complete=$((complete + 1)) ;;
        ready-for-review|in-review) in_review=$((in_review + 1)) ;;
        in-progress) in_progress=$((in_progress + 1)) ;;
        not-started) not_started=$((not_started + 1)) ;;
        needs-revision) needs_revision=$((needs_revision + 1)) ;;
    esac
done

if [[ $total_tasks -eq 0 ]]; then
    echo "No tasks found in $TASKS_DIR"
    exit 0
fi

# --- Code metrics ---
domain_lines=$(find "$REPO_ROOT/src/limb/domain" -name "*.ts" -not -name "*.test.ts" 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
domain_lines=${domain_lines:-0}
test_lines=$(find "$REPO_ROOT/src/limb/domain" -name "*.test.ts" 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
test_lines=${test_lines:-0}
tree_lines=$(find "$REPO_ROOT/src/limb/tree" -name "*.mjs" -o -name "*.js" -o -name "*.ts" 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
tree_lines=${tree_lines:-0}

# --- Review metrics ---
declare -A review_rounds=() review_findings=()
for rf in "$REVIEWS_DIR"/task-*.md; do
    [[ -f "$rf" ]] || continue
    rname=$(basename "$rf" .md)
    rounds=$(grep -c '## Round\|## R[0-9]\|## Findings' "$rf" 2>/dev/null || echo 0)
    findings=$(grep -c 'process-revision-complete' "$rf" 2>/dev/null || echo 0)
    review_rounds["$rname"]=$rounds
    review_findings["$rname"]=$findings
done

# --- Format helpers ---
progress_bar() {
    local total=$1 n_complete=$2 n_review=$3 n_progress=$4
    local width=30
    local w_complete=$((n_complete * width / total))
    local w_review=$((n_review * width / total))
    local w_progress=$((n_progress * width / total))
    local w_rest=$((width - w_complete - w_review - w_progress))
    local seg=""
    for ((i=0; i<w_complete; i++)); do seg+="#"; done
    printf "%s%s" "${GREEN}" "$seg"
    seg=""
    for ((i=0; i<w_review; i++)); do seg+="#"; done
    printf "%s%s" "${MAGENTA}" "$seg"
    seg=""
    for ((i=0; i<w_progress; i++)); do seg+="#"; done
    printf "%s%s" "${BLUE}" "$seg"
    seg=""
    for ((i=0; i<w_rest; i++)); do seg+="-"; done
    printf "%s%s%s" "${DIM}" "$seg" "${RESET}"
}

# --- JSON output ---
if $JSON_MODE; then
    echo "{"
    echo "  \"summary\": {"
    echo "    \"total_tasks\": $total_tasks,"
    echo "    \"complete\": $complete,"
    echo "    \"in_review\": $in_review,"
    echo "    \"in_progress\": $in_progress,"
    echo "    \"not_started\": $not_started,"
    echo "    \"needs_revision\": $needs_revision,"
    echo "    \"progress_pct\": $((complete * 100 / total_tasks)),"
    echo "    \"domain_lines\": $domain_lines,"
    echo "    \"test_lines\": $test_lines,"
    echo "    \"tree_lines\": $tree_lines"
    echo "  },"
    echo "  \"tasks\": ["
    first=true
    for i in "${!task_names[@]}"; do
        name="${task_names[$i]}"
        $first || echo ","
        first=false
        printf '    {"task": "%s", "status": "%s"}' "$name" "${task_statuses[$i]}"
    done
    echo ""
    echo "  ]"
    echo "}"
    exit 0
fi

# --- Human output ---
echo ""
echo "${BOLD}Limb Build Stats${RESET}"
echo "${DIM}$(date '+%Y-%m-%d %H:%M')${RESET}"
echo ""

# Progress
pct=$((complete * 100 / total_tasks))
printf "${BOLD}Progress${RESET}\n"
printf "  [$(progress_bar $total_tasks $complete $in_review $in_progress)] %d%% (%d/%d tasks)\n" "$pct" "$complete" "$total_tasks"
echo "  ${GREEN}$complete complete${RESET}  ${MAGENTA}$in_review in review${RESET}  ${BLUE}$in_progress in progress${RESET}  ${RED}$needs_revision needs revision${RESET}  ${DIM}$not_started not started${RESET}"
echo ""

# Code
echo "${BOLD}Code${RESET}"
echo "  Domain (production): $domain_lines lines"
echo "  Domain (tests):      $test_lines lines"
echo "  Tree UI:             $tree_lines lines"
total_code=$((domain_lines + test_lines))
if [[ $total_code -gt 0 ]]; then
    echo "  Test ratio:          $((test_lines * 100 / total_code))%"
fi
echo ""

# Per-task breakdown
echo "${BOLD}Tasks${RESET}"
printf "  ${DIM}%-12s  %-40s  %-16s${RESET}\n" "TASK" "TITLE" "STATUS"
printf "  ${DIM}%s${RESET}\n" "------------------------------------------------------------------------"

for i in "${!task_names[@]}"; do
    name="${task_names[$i]}"
    status="${task_statuses[$i]}"
    title="${task_titles[$i]}"

    case "$status" in
        complete)         sc="${GREEN}$(printf '%-16s' "$status")${RESET}" ;;
        ready-for-review) sc="${MAGENTA}$(printf '%-16s' "$status")${RESET}" ;;
        needs-revision)   sc="${RED}$(printf '%-16s' "$status")${RESET}" ;;
        in-progress)      sc="${BLUE}$(printf '%-16s' "$status")${RESET}" ;;
        not-started)      sc="${DIM}$(printf '%-16s' "$status")${RESET}" ;;
        *)                sc="$(printf '%-16s' "$status")" ;;
    esac

    printf "  %-12s  %-40s  %s\n" "$name" "$title" "$sc"
done
echo ""

# Loop status
echo "${BOLD}Loop${RESET}"
if [ -f /tmp/limb-loop.log ]; then
    active_workers=0
    if [ -d "$WORKTREE_BASE" ]; then
        for wt in "$WORKTREE_BASE"/task-*/; do
            [ -d "$wt" ] || continue
            [ ! -f "$wt/.done" ] && active_workers=$((active_workers + 1))
        done
    fi

    if [ $active_workers -gt 0 ]; then
        echo "  Mode:        ${CYAN}parallel${RESET} ($active_workers workers)"
        for wt in "$WORKTREE_BASE"/task-*/; do
            [ -d "$wt" ] || continue
            [ -f "$wt/.done" ] && continue
            wt_name=$(basename "$wt")
            phase=$(grep "\[$wt_name\]" /tmp/limb-loop.log 2>/dev/null | tail -1 | grep -oP '>>>\s*\K\w+' || echo "working")
            echo "    ${CYAN}$wt_name${RESET}  ${DIM}($phase)${RESET}"
        done
    else
        last_line=$(tail -1 /tmp/limb-loop.log 2>/dev/null || echo "(empty log)")
        echo "  Last action: $last_line"
    fi

    iterations=$(grep -c "Orchestrator cycle" /tmp/limb-loop.log 2>/dev/null || echo 0)
    echo "  Iterations:  $iterations"
else
    echo "  ${DIM}(loop not running)${RESET}"
    echo "  ${DIM}Start: tmux new-session -s limb-loop && bash scripts/parallel-loop.sh${RESET}"
fi
echo ""
