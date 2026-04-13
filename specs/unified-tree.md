# Unified Tree

Limb uses a single, persistent tree. The root node is always `about:limb-home`. Every browsing session is a branch off the root. The tree grows over the lifetime of the browser and is the user's complete browsing history in spatial form.

## S1 Single Tree Model

### S1.1 Root Node

The root node's URL is `about:limb-home`. It is created on first launch and never deleted. It has no parent. All browsing starts as children of this root.

### S1.2 Branches

A "branch" is a top-level child of the root node. Each branch represents a browsing session. Creating a new branch is `tree.addChild(rootId, homeUrl)`.

There is no separate session manager. The tree is the only data structure. "Switching sessions" is just focusing a different branch and zooming in.

### S1.3 Branch Metadata

Branch metadata is derived from the tree itself, not stored separately:

| Property | Source |
|----------|--------|
| Name | Branch root node's `title` |
| Favicon | Branch root node's `favicon` |
| Node count | `descendantCount` (cached, updated incrementally) |
| Last accessed | Branch root's `lastVisitedAt` (updated when any descendant is focused) |
| Created | Branch root's `createdAt` |

## S2 Launcher (about:limb-home)

### S2.1 Layout

The launcher renders the root node's children grouped by time:

**Search bar** at the top. Placeholder text: "Search history..."

**Time groups**, each with a heading and a list of branch cards:
- **Today**
- **Yesterday**
- **This Week** (excluding today/yesterday)
- **This Month** (excluding this week)
- **Older** (sub-grouped by month: "March 2026", etc.)

Empty groups are hidden. If no branches exist, show a centered "Start Browsing" button.

### S2.2 Branch Cards

Each branch card shows:
- Favicon (or globe icon fallback)
- Branch name (bold)
- Node count in muted text (e.g., "12 pages")
- Relative timestamp (e.g., "2 hours ago")
- Screenshot thumbnail of the branch root (if available)

Clicking a card focuses that branch's root node and zooms in.

### S2.3 New Branch

A "+" button or prominent card creates a new branch. Keyboard shortcut: `Ctrl+N`.

### S2.4 Branch Deletion

Right-click or hover-reveal a delete button. Requires confirmation if the branch has more than one node.

## S3 Lazy Tree Loading

### S3.1 Motivation

A tree with thousands of nodes spanning months of browsing cannot all be in memory. Only the active branch needs to be fully materialized.

### S3.2 Load Levels

| Level | What's in memory | When |
|-------|-----------------|------|
| **Root + summaries** | Root node + branch roots with metadata | Always |
| **Active branch** | Full subtree | When user zooms into a branch |
| **Inactive branches** | Branch root only (summary) | All non-active branches |

### S3.3 Loading a Branch

When the user focuses a branch root:
1. Load the full subtree from storage.
2. Insert into the in-memory BrowsingTree.
3. Restore screenshots.
4. Compute layout.

### S3.4 Unloading a Branch

When switching to a different branch:
1. Save current branch state.
2. Remove descendants from memory (keep branch root for summary).
3. Free screenshots.

## S4 Branch Folding (Tree View)

### S4.1 At Root Level

When zoomed out to see all branches:

- **Recent branches** (last 7 days): shown as normal tree nodes, left-to-right by recency.
- **Older branches**: collapsed into a fold node showing a count (e.g., "142 older branches"). Clicking expands them.

### S4.2 Visual Treatment

Fold nodes render as a rounded rectangle with a stacked-cards appearance and a label like "Mar 2026 (23 branches)".

## S5 Search

### S5.1 Access

- Search bar on the launcher page.
- `Ctrl+K` from anywhere (opens `about:limb-search`).

### S5.2 Results

Results show node title, URL, branch name, timestamp, favicon. Clicking a result loads that branch and focuses the node.
