---
title: "Implement tree size warnings"
spec_ref: "performance.md S5.2"
depends_on:
  - task-003
progress: complete
review: "specs/reviews/review-TASK_035-R1.md"
coverage_sections: []
commits: []
---

## Spec Excerpt

> Warn when the tree exceeds 100 nodes. Above 200 nodes, suggest closing unused branches. Do NOT auto-close.

## Current State

BrowsingTree (task-003) tracks all nodes but has no size monitoring or warnings.

## What To Build

1. Add a node count observer to BrowsingTree:
   - After `addChild()`, check total node count.
   - At 100 nodes: emit a warning notification.
   - At 200 nodes: emit a suggestion notification to close unused branches.
2. Display warnings as Firefox notification bars (the non-modal info bar below the urlbar):
   - 100 nodes: "Your tree has 100+ pages. Consider closing unused branches for best performance."
   - 200 nodes: "Your tree has 200+ pages. Close some branches to free memory." with a "Show branches" button linking to the launcher.
3. Only show each warning once per session (don't nag on every node addition above the threshold).
4. Do NOT auto-close any branches.
5. Write tests for:
   - Warning fires at 100 nodes.
   - Suggestion fires at 200 nodes.
   - Warning does not fire below threshold.
   - Warning fires only once per session per threshold.
