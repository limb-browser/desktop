#!/usr/bin/env bash
# Limb Build Stats - tracks velocity, quality, and cost metrics across tasks.
# Usage: ./scripts/stats.sh [--json]
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TASKS_DIR="$REPO_ROOT/specs/tasks"
REVIEWS_DIR="$REPO_ROOT/specs/reviews"
WORKTREE_BASE="$REPO_ROOT/worktrees/workers"
JSON_MODE=false
[[ "${1:-}" == "--json" ]] && JSON_MODE=true

# --- Colors (disabled for JSON) ---
if $JSON_MODE; then
    BOLD="" DIM="" RESET="" GREEN="" YELLOW="" RED="" CYAN="" BLUE="" MAGENTA=""
else
    BOLD=$'\033[1m' DIM=$'\033[2m' RESET=$'\033[0m'
    GREEN=$'\033[32m' YELLOW=$'\033[33m' RED=$'\033[31m'
    CYAN=$'\033[36m' BLUE=$'\033[34m' MAGENTA=$'\033[35m'
fi

# --- Launch slow background jobs immediately so they overlap with local parsing ---
OUTLIER_GAP=3600  # 1 hour

# git log: single pass for per-task timing + global stats.
# Cache result in /tmp keyed by HEAD hash.
_HEAD_HASH=$(cd "$REPO_ROOT" && git rev-parse HEAD 2>/dev/null || echo "none")
_GIT_CACHE="/tmp/limb-stats-git-${_HEAD_HASH}.tsv"
_git_tmp=$(mktemp)
if [[ -f "$_GIT_CACHE" ]]; then
    cp "$_GIT_CACHE" "$_git_tmp" &
    _pid_git=$!
else
    # Only count commits after the fork point (first Limb commit, not Zen history)
    _FORK_POINT=$(cd "$REPO_ROOT" && git log --all --format="%at %s" --reverse 2>/dev/null | grep -m1 'Limb\|limb\|feat:.*rebrand\|chore:.*limb' | awk '{print $1}')
    _FORK_POINT=${_FORK_POINT:-0}
    (cd "$REPO_ROOT" && git log --all --format="%at %s" --reverse 2>/dev/null | awk -v gap="$OUTLIER_GAP" -v fork_ts="$_FORK_POINT" '
{
    ts = $1
    if (fork_ts > 0 && ts < fork_ts) next
    gl_count++
    if (gl_first == "") gl_first = ts
    gl_last = ts
    subj = substr($0, index($0, " ") + 1)
    if (index(subj, "fix(process)") > 0) gl_checklist++
    lc = tolower(subj)
    while (match(lc, /task-[0-9]+/)) {
        tid = substr(lc, RSTART, RLENGTH)
        if (tid in first_ts) {
            diff = ts - last_ts[tid]
            if (diff > 0 && diff < gap) active[tid] += diff
        } else {
            first_ts[tid] = ts
            cnt[tid] = 0
        }
        last_ts[tid] = ts
        cnt[tid]++
        lc = substr(lc, RSTART + RLENGTH)
    }
}
END {
    printf "_SUMMARY_\t%d\t%d\t%d\t%d\n", gl_first+0, gl_last+0, gl_checklist+0, gl_count+0
    for (t in first_ts)
        if (cnt[t] >= 2)
            printf "%s\t%d\t%d\t%d\t%d\n", t, first_ts[t], last_ts[t], active[t]+0, cnt[t]
}' | tee "$_GIT_CACHE") > "$_git_tmp" &
    _pid_git=$!
fi

# Code metrics: Limb-specific JS/MJS + patches
_CODE_CACHE="/tmp/limb-stats-code-${_HEAD_HASH}.tsv"
_code_tmp=$(mktemp)
if [[ -f "$_CODE_CACHE" ]]; then
    cp "$_CODE_CACHE" "$_code_tmp" &
    _pid_code=$!
else
    (
        limb_lines=$(find "$REPO_ROOT/src/limb" -name "*.mjs" -o -name "*.js" -o -name "*.ts" 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
        patch_count=$(find "$REPO_ROOT/src/browser" "$REPO_ROOT/src/external-patches" -name "*.patch" 2>/dev/null | wc -l)
        spec_lines=$(find "$REPO_ROOT/specs" -name "*.md" -not -path "*/tasks/*" -not -path "*/reviews/*" -not -path "*/prompts/*" 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
        echo "${limb_lines:-0}	${patch_count:-0}	${spec_lines:-0}"
    ) | tee "$_CODE_CACHE" > "$_code_tmp" &
    _pid_code=$!
fi

# --- Task status counts (fast local awk, runs while background jobs work) ---
total_tasks=0; complete=0; in_review=0; in_progress=0; not_started=0; needs_revision=0
declare -a task_names=() task_statuses=() task_titles=()

declare -A _task_status_map=() _task_title_map=()
if compgen -G "$TASKS_DIR/task-*.md" > /dev/null 2>&1; then
while IFS=$'\t' read -r name status title; do
    _task_status_map["$name"]="$status"
    _task_title_map["$name"]="$title"
done < <(awk '
    FNR == 1 {
        if (NR > 1 && file != "") _flush()
        file = FILENAME
        sub(".*/", "", file)
        sub(/\.md$/, "", file)
        in_fm = 0; fm_count = 0; status = "unknown"; title = ""
    }
    /^---$/ { fm_count++; in_fm = (fm_count == 1); next }
    !in_fm { next }
    /^progress:/ {
        status = substr($0, index($0, $2))
        gsub(/^[ \t"]+|[ \t"]+$/, "", status)
    }
    /^title:/ {
        status_tmp = $0
        sub(/^title:[ \t]*/, "", status_tmp)
        gsub(/^["]+|["]+$/, "", status_tmp)
        title = status_tmp
    }
    function _flush() { print file "\t" status "\t" title }
    END { if (file != "") _flush() }
' "$TASKS_DIR"/task-*.md)
fi

for f in "$TASKS_DIR"/task-*.md; do
    [[ -f "$f" ]] || continue
    total_tasks=$((total_tasks + 1))
    name=$(basename "$f" .md)
    status="${_task_status_map[$name]:-unknown}"

    # Override with live worktree status if a worker is active
    wt_file="$WORKTREE_BASE/$name/specs/tasks/$name.md"
    if [[ -d "$WORKTREE_BASE/$name" ]] && [[ -f "$wt_file" ]]; then
        wt_status=$(awk '/^---$/{c++; if(c==2) exit} c==1 && /^progress:/{s=$2; gsub(/^[ \t"]+|[ \t"]+$/, "", s); print s}' "$wt_file" 2>/dev/null)
        [[ -z "$wt_status" ]] && wt_status="$status"
        [[ "$wt_status" == "not-started" ]] && wt_status="in-progress"
        _task_status_map[$name]="$wt_status"
        status="$wt_status"
    fi
    title="${_task_title_map[$name]:-}"
    [[ -z "$title" ]] && title=$(head -1 "$f" | sed 's/^# //')
    # Title truncation handled by print_task_row using dynamic TITLE_WIDTH
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

# --- Review metrics per task (single awk pass over all review files) ---
declare -A review_rounds=() review_findings=()
if compgen -G "$REVIEWS_DIR/task-*.md" > /dev/null 2>&1; then
while IFS=$'\t' read -r name rounds findings; do
    review_rounds["$name"]=$rounds
    review_findings["$name"]=$findings
done < <(awk '
    FNR == 1 {
        if (NR > 1 && file != "") print file "\t" rounds "\t" findings
        file = FILENAME
        sub(".*/", "", file)
        sub(/\.md$/, "", file)
        rounds = 0; findings = 0
    }
    /^\#\# Round [0-9]/ { rounds++ }
    /^\#\# R[0-9]/       { rounds++ }
    /^\#\# Findings/     { rounds++ }
    /process-revision-complete/ { findings++ }
    END { if (file != "") print file "\t" rounds "\t" findings }
' "$REVIEWS_DIR"/task-*.md 2>/dev/null || true)
fi

# --- Harvest background results ---
wait $_pid_git $_pid_code 2>/dev/null

declare -A task_wall_clock=() task_first_commit=() task_last_commit=()
declare -A task_active_seconds=() task_commits=()
total_commits=0; first_commit_ts=0; last_commit_ts=0; checklist_items=0

while IFS=$'\t' read -r name first last active count; do
    if [[ "$name" == "_SUMMARY_" ]]; then
        first_commit_ts=$first
        last_commit_ts=$last
        checklist_items=$active
        total_commits=$count
    else
        task_first_commit["$name"]=$first
        task_last_commit["$name"]=$last
        task_wall_clock["$name"]=$((last - first))
        task_active_seconds["$name"]=$active
        task_commits["$name"]=$count
    fi
done < "$_git_tmp"
rm -f "$_git_tmp"

# Sanitize: ensure numeric values (strip whitespace, default to 0)
first_commit_ts=${first_commit_ts// /}; first_commit_ts=${first_commit_ts:-0}
last_commit_ts=${last_commit_ts// /}; last_commit_ts=${last_commit_ts:-0}
total_commits=${total_commits// /}; total_commits=${total_commits:-0}
checklist_items=${checklist_items// /}; checklist_items=${checklist_items:-0}
total_wall_seconds=$(( ${last_commit_ts:-0} - ${first_commit_ts:-0} ))

IFS=$'\t' read -r limb_lines patch_count spec_lines < "$_code_tmp"
limb_lines=${limb_lines:-0}
patch_count=${patch_count:-0}
spec_lines=${spec_lines:-0}

rm -f "$_code_tmp"

# --- Format helpers ---
fmt_duration() {
    local secs=$1
    local hrs=$((secs / 3600))
    local mins=$(( (secs % 3600) / 60 ))
    local s=$((secs % 60))
    if [[ $hrs -gt 0 ]]; then
        printf "%dh %dm %ds" "$hrs" "$mins" "$s"
    else
        printf "%dm %ds" "$mins" "$s"
    fi
}

progress_bar() {
    local total=$1 n_complete=$2 n_review=$3 n_progress=$4 n_not_started=$5
    local width=30
    local w_complete=$((n_complete * width / total))
    local w_review=$((n_review * width / total))
    local w_progress=$((n_progress * width / total))
    local w_not_started=$((width - w_complete - w_review - w_progress))
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
    for ((i=0; i<w_not_started; i++)); do seg+="-"; done
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
    echo "    \"total_commits\": $total_commits,"
    echo "    \"limb_lines\": $limb_lines,"
    echo "    \"patch_count\": $patch_count,"
    echo "    \"spec_lines\": $spec_lines,"
    echo "    \"total_wall_clock_seconds\": $total_wall_seconds,"
    echo "    \"checklist_items\": $checklist_items"
    echo "  },"
    echo "  \"tasks\": ["
    first=true
    for i in "${!task_names[@]}"; do
        name="${task_names[$i]}"
        status="${task_statuses[$i]}"
        rounds=${review_rounds[$name]:-0}
        findings=${review_findings[$name]:-0}
        active=${task_active_seconds[$name]:-0}
        wall=${task_wall_clock[$name]:-0}
        commits=${task_commits[$name]:-0}
        $first || echo ","
        first=false
        printf '    {"task": "%s", "status": "%s", "commits": %d, "review_rounds": %d, "findings": %d, "active_seconds": %d, "wall_seconds": %d}' \
            "$name" "$status" "$commits" "$rounds" "$findings" "$active" "$wall"
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
echo "${BOLD}Progress${RESET}"
printf "  [$(progress_bar $total_tasks $complete $in_review $in_progress $not_started)] %d%% (%d/%d tasks)\n" "$pct" "$complete" "$total_tasks"
echo "  ${GREEN}$complete complete${RESET}  ${MAGENTA}$in_review in review${RESET}  ${BLUE}$in_progress in progress${RESET}  ${RED}$needs_revision needs revision${RESET}  ${DIM}$not_started not started${RESET}"
echo ""

# Timeline
echo "${BOLD}Timeline${RESET}"
echo "  Total wall clock:  $(fmt_duration $total_wall_seconds)"
echo "  Total commits:     $total_commits"
echo "  Checklist items:   $checklist_items (accumulated process learnings)"
echo ""

# Code
echo "${BOLD}Code${RESET}"
echo "  Limb source:       $limb_lines lines (src/limb/)"
echo "  Firefox patches:   $patch_count patch files"
echo "  Spec prose:        $spec_lines lines"
echo ""

# Per-task breakdown (active tasks, then collapsed completed)
# Dynamic title width based on terminal width
TERM_WIDTH=$(tput cols 2>/dev/null || echo 120)
FIXED_COLS=74  # TASK(10) + STATUS(18) + COMMITS(9) + ROUNDS(8) + FINDINGS(10) + ACTIVE(16) + padding(3)
TITLE_WIDTH=$((TERM_WIDTH - FIXED_COLS))
[[ $TITLE_WIDTH -lt 20 ]] && TITLE_WIDTH=20
[[ $TITLE_WIDTH -gt 80 ]] && TITLE_WIDTH=80

echo "${BOLD}Task Breakdown${RESET}"
printf "  ${DIM}%-8s  %-${TITLE_WIDTH}s  %-16s  %7s  %6s  %8s  %14s${RESET}\n" "TASK" "TITLE" "STATUS" "COMMITS" "ROUNDS" "FINDINGS" "ACTIVE TIME"
SEP_WIDTH=$((TERM_WIDTH - 2))
printf "  ${DIM}%*s${RESET}\n" "$SEP_WIDTH" "" | tr ' ' '-'

total_rounds=0; total_findings=0; total_active=0; total_task_commits=0
done_rounds=0; done_findings=0; done_active=0; done_commits=0

print_task_row() {
    local name="$1" status="$2" title="$3" commits="$4" rounds="$5" findings="$6" active="$7"
    local status_color sc rpad rc fpad at cpad

    # Replace multi-byte dashes with plain dashes for consistent column width
    title="${title//—/-}"
    title="${title//–/-}"

    # Truncate title to dynamic width
    if [[ ${#title} -gt $TITLE_WIDTH ]]; then
        local half=$(( (TITLE_WIDTH - 2) / 2 ))
        title="${title:0:$half}..${title: -$half}"
    fi

    case "$status" in
        complete)         status_color="$GREEN" ;;
        ready-for-review) status_color="$MAGENTA" ;;
        needs-revision)   status_color="$RED" ;;
        in-review)        status_color="$YELLOW" ;;
        in-progress)      status_color="$BLUE" ;;
        not-started)      status_color="$DIM" ;;
        *)                status_color="" ;;
    esac
    sc="${status_color}$(printf '%-16s' "$status")${RESET}"

    rpad=$(printf "%6d" "$rounds")
    if [[ $rounds -eq 0 ]]; then
        rc="${DIM}${rpad}${RESET}"
    elif [[ $rounds -le 3 ]]; then
        rc="${GREEN}${rpad}${RESET}"
    elif [[ $rounds -le 7 ]]; then
        rc="${YELLOW}${rpad}${RESET}"
    else
        rc="${RED}${rpad}${RESET}"
    fi

    fpad=$(printf "%8d" "$findings")
    cpad=$(printf "%7d" "$commits")

    if [[ $active -gt 0 ]]; then
        at=$(printf "%14s" "$(fmt_duration $active)")
    else
        at="$(printf '%12s' '')${DIM}--${RESET}"
    fi

    printf "  %-8s  %-${TITLE_WIDTH}s  %s  %s  %s  %s  %s\n" "$name" "$title" "$sc" "$cpad" "$rc" "$fpad" "$at"
}

for i in "${!task_names[@]}"; do
    name="${task_names[$i]}"
    status="${task_statuses[$i]}"
    rounds=${review_rounds[$name]:-0}
    findings=${review_findings[$name]:-0}
    active=${task_active_seconds[$name]:-0}
    commits=${task_commits[$name]:-0}

    total_rounds=$((total_rounds + rounds))
    total_findings=$((total_findings + findings))
    total_active=$((total_active + active))
    total_task_commits=$((total_task_commits + commits))

    if [[ "$status" == "complete" ]]; then
        done_rounds=$((done_rounds + rounds))
        done_findings=$((done_findings + findings))
        done_active=$((done_active + active))
        done_commits=$((done_commits + commits))
    else
        print_task_row "$name" "$status" "${task_titles[$i]}" "$commits" "$rounds" "$findings" "$active"
    fi
done

# Collapsed completed row
if [[ $complete -gt 0 ]]; then
    print_task_row "${complete} done" "complete" "--- completed tasks (${complete}) ---" \
        "$done_commits" "$done_rounds" "$done_findings" "$done_active"
fi

printf "  ${DIM}%*s${RESET}\n" "$SEP_WIDTH" "" | tr ' ' '-'
printf "  ${BOLD}%-8s  %-${TITLE_WIDTH}s  %-16s  %7d  %6d  %8d  %14s${RESET}\n" "TOTAL" "" "" "$total_task_commits" "$total_rounds" "$total_findings" "$(fmt_duration $total_active)"
echo ""

# Review efficiency
if [[ $total_findings -gt 0 && $complete -gt 0 ]]; then
    echo "${BOLD}Review Efficiency${RESET}"
    echo "  Total findings:        $total_findings"
    echo "  Total review rounds:   $total_rounds"
    if [[ $total_rounds -gt 0 ]]; then
        echo "  Findings per round:    $(printf '%.1f' "$(echo "scale=1; $total_findings / $total_rounds" | bc)")"
    fi
    echo "  Avg rounds per task:   $(printf '%.1f' "$(echo "scale=1; $total_rounds / $complete" | bc)") (completed tasks only)"
    echo ""
fi

# Loop status
echo "${BOLD}Loop${RESET}"
if [ -f /tmp/limb-loop.log ]; then
    active_workers=0
    worker_names=""
    if [ -d "$WORKTREE_BASE" ]; then
        for wt in "$WORKTREE_BASE"/task-*/; do
            [ -d "$wt" ] || continue
            wt_name=$(basename "$wt")
            if [ ! -f "$wt/.done" ]; then
                active_workers=$((active_workers + 1))
                phase=$(grep "\[$wt_name\]" /tmp/limb-loop.log 2>/dev/null | tail -1 | grep -oP '>>>\s*\K\w+' || echo "working")
                worker_names+="    ${CYAN}$wt_name${RESET}  ${DIM}($phase)${RESET}\n"
            fi
        done
    fi

    if [ $active_workers -gt 0 ]; then
        echo "  Mode:               ${CYAN}parallel${RESET} ($active_workers workers)"
        echo -e "$worker_names"
    else
        last_line=$(tail -1 /tmp/limb-loop.log 2>/dev/null || echo "(empty)")
        echo "  Last action:        $last_line"
    fi

    iterations=$(grep -c "Orchestrator cycle" /tmp/limb-loop.log 2>/dev/null) || iterations=0
    echo "  Iterations:         $iterations"

    merges=$(grep -cE "PR created|Merge successful" /tmp/limb-loop.log 2>/dev/null) || merges=0
    [[ "$merges" -gt 0 ]] && echo "  PRs/merges:         $merges"
else
    echo "  ${DIM}(loop not running)${RESET}"
    echo "  ${DIM}Start: tmux new-session -s limb-loop && bash scripts/parallel-loop.sh${RESET}"
fi
echo ""
