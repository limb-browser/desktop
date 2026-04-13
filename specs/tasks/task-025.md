---
title: "Register about:limb-home and implement launcher UI"
spec_ref: "unified-tree.md S1 S2"
depends_on:
  - task-002
  - task-003
progress: not-started
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> The root node's URL is `about:limb-home`. It is created on first launch and never deleted. All browsing starts as children of this root.
>
> The launcher renders the root node's children grouped by time: Today, Yesterday, This Week, This Month, Older.
>
> Branch cards show: favicon, branch name (bold), node count, relative timestamp, screenshot thumbnail.
>
> A "+" button or prominent card creates a new branch. Empty state: centered "Start Browsing" button.
> Search bar at top with placeholder "Search history..."

## Current State

No `about:limb-home` page is registered. No launcher UI exists. The browser starts with Firefox's default new tab.

## What To Build

1. Register `about:limb-home` as a Firefox about: page:
   - Create the about: page module in `src/limb/` following Firefox's about: page registration pattern.
   - Register in the component manifest.
2. Implement launcher HTML/CSS/JS:
   - Dark theme matching tree view aesthetic.
   - Search bar at top with placeholder text.
   - Branch cards grouped by time (Today, Yesterday, This Week, This Month, Older).
   - Each card: favicon, name, node count, relative timestamp, screenshot thumbnail.
   - "Start Browsing" button for empty state.
   - "+" card/button for new branch creation.
3. Wire launcher to BrowsingTree:
   - Read root node's children (branches) from the tree.
   - Compute time groups from `lastVisitedAt`.
   - Clicking a card focuses that branch root.
4. Set `about:limb-home` as the root node's URL on first launch.
5. Write tests for:
   - about:limb-home page loads.
   - Branch cards are grouped correctly by time.
   - Clicking a card navigates to the branch.
   - Empty state shows "Start Browsing".
