#!/usr/bin/env bash
# Start the Limb dev loop in a tmux session.
# Usage: bash scripts/start-loop.sh
#
# Creates (or reattaches to) a tmux session, enables mouse,
# and launches the parallel loop.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SESSION=${LIMB_TMUX_SESSION:-limb-loop}

# Attach to existing session, or create a new one
if tmux has-session -t "$SESSION" 2>/dev/null; then
  tmux attach -t "$SESSION"
else
  tmux new-session -d -s "$SESSION" -c "$REPO_ROOT"
  tmux set-option -t "$SESSION" mouse on
  tmux send-keys -t "$SESSION" "LIMB_AUTO_MERGE=1 bash scripts/parallel-loop.sh" Enter
  tmux attach -t "$SESSION"
fi
