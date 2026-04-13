# Persistence

Limb uses Firefox's built-in persistence mechanisms (SessionStore, Places) extended with custom data for tree structure.

## S1 What Gets Persisted

### S1.1 Tree Structure

Each tree node stores:
- `id`, `url`, `title`, `favicon`, `parentId`, `childIds`
- `createdAt`, `lastVisitedAt`
- `descendantCount` (cached, for launcher display)

### S1.2 Where It Lives

| Data | Storage | Reason |
|------|---------|--------|
| Active branch nodes | SessionStore (in-memory + jsonlz4) | Fast access, restored on crash |
| Inactive branch nodes | Places database (SQLite) | Persistent, searchable |
| Screenshots | Separate table in Places or dedicated SQLite | Large blobs, evictable |
| Settings | Firefox prefs system (`about:config`) | Standard Firefox pattern |

### S1.3 SessionStore Integration

Firefox's SessionStore already persists tab state, history, scroll position, and form data. Limb extends this with tree metadata:

- `zen-tree-node-id` attribute on each tab
- `zen-tree-parent-id` for tree relationships
- `zen-tree-created-at` timestamp

On restore, Limb rebuilds the BrowsingTree from these attributes.

## S2 Branch Loading

### S2.1 Startup Load

On launch:
1. Load root node and branch root summaries (immediate children of root).
2. Display the launcher with branch cards.
3. Do NOT load full branch subtrees yet.

### S2.2 Branch Activation

When the user selects a branch:
1. Load the full subtree from storage.
2. Insert nodes into the in-memory BrowsingTree.
3. Restore screenshots for loaded nodes.
4. Compute layout.

### S2.3 Branch Deactivation

When switching to a different branch:
1. Save current branch state.
2. Remove descendant nodes from memory (keep branch root for summary).
3. Free screenshots.

## S3 Auto-Save

### S3.1 Save Triggers

The active branch auto-saves on:
- Node addition or removal
- Focus change
- URL/title update
- Every 30 seconds (periodic flush)
- App quit / window close

### S3.2 Crash Recovery

If the app crashes, SessionStore handles recovery of the active branch's tabs. Tree structure is reconstructed from the saved SessionStore data + Places entries.

## S4 Screenshot Storage

### S4.1 Format

- Low-res (320px wide): JPEG quality 60, ~15-30KB
- High-res (1024px wide): JPEG quality 85, ~80-150KB

### S4.2 Retention

| Branch age | Screenshot retention |
|-----------|---------------------|
| Active branch | All screenshots kept |
| Last 7 days | All screenshots kept |
| Older | Branch root screenshot only |

Eviction runs on startup and hourly.

## S5 Search

Full-text search across all persisted nodes (title, URL). Uses FTS5 if backed by SQLite, or Places' existing search infrastructure.

Results return: node title, URL, branch name, timestamp, favicon. Clicking a result loads that branch and focuses the node.
