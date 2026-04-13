# Navigation

## S1 Link Interception

### S1.1 New-Tab Links

When a user opens a link in a new tab (via Ctrl+click, middle-click, or right-click -> "Open in new tab"):

1. Intercept the new-tab event from the tabbrowser.
2. Call `BrowsingTree.addChild(currentNodeId, targetUrl)`.
3. Create a new Firefox tab associated with this tree node.
4. The new child node appears in the tree layout.
5. Focus the new child node.
6. If currently zoomed in (`level >= 0.9`), animate a brief zoom-out-and-back to show the branching, then zoom into the new node.

### S1.2 Same-Tab Navigation

When a user clicks a regular link (not Ctrl+click) within a focused tab:

1. The tab navigates normally (same browsing context).
2. Update the node's `url` and `title` to reflect the new page.
3. The tree structure does NOT change. This is in-place navigation, not branching.
4. Capture a fresh screenshot after the page loads.

### S1.3 Window.open()

JavaScript `window.open()` calls are treated the same as new-tab links (S1.1).

### S1.4 Form Submissions

Form submissions that navigate the current page are same-tab navigation (S1.2). Form submissions that open a new window/tab are new-tab links (S1.1).

## S2 Address Bar

Limb uses Firefox's built-in urlbar, patched to integrate with the tree view.

### S2.1 Visibility

The address bar is visible when `zoomLevel >= 0.85`. It fades in over the range `[0.85, 0.95]` (opacity 0.0 at 0.85, opacity 1.0 at 0.95). Below 0.85, no address bar is shown.

### S2.2 Content

The address bar displays:
- The focused node's favicon.
- The focused node's current URL (editable).
- Back/forward buttons (per-node history, see S3).
- A reload button (spinner while loading).

### S2.3 URL Entry

Typing a URL and pressing Enter:
- If the URL is `about:limb-home`, `about:limb-settings`, or `about:limb-search`, navigate to the internal page in-place.
- If the focused node has no children and was visited less than 5 seconds ago: navigate in-place.
- Otherwise: create a new child node with the entered URL (S1.1 behavior).

### S2.4 Keyboard

`Ctrl+L` focuses the address bar and selects all text.

## S3 Per-Node History

### S3.1 Back/Forward

Each node's tab maintains its own navigation history (Firefox's native tab history). Back/forward buttons navigate within that tab's history. This is standard browser behavior.

### S3.2 History and Tree

Navigating back within a node does NOT affect the tree structure. Children that were created from a page that the user has since navigated away from remain in the tree.

## S4 Keyboard Shortcuts

### S4.1 Zoom

| Shortcut | Action |
|---|---|
| `Ctrl + Scroll Up` | Zoom in |
| `Ctrl + Scroll Down` | Zoom out |
| `Ctrl + 0` | Reset zoom to fit entire tree |
| `Ctrl + 1` | Zoom to 100% on focused node |

### S4.2 Navigation

| Shortcut | Action |
|---|---|
| `Ctrl + Click` (on link) | Open link as child node |
| `Middle Click` (on link) | Open link as child node |
| `Click` (on tree node, when zoomed out) | Focus that node and zoom in |
| `Ctrl + W` | Close focused node (remove from tree) |
| `Ctrl + L` | Focus address bar and select all text |
| `Escape` | When address bar focused: return focus to page. When zoomed out: zoom to focused node. |

### S4.3 Tree Navigation

| Shortcut | Action |
|---|---|
| `Alt + Up` | Focus parent node |
| `Alt + Down` | Focus first child node |
| `Alt + Left` | Focus previous sibling |
| `Alt + Right` | Focus next sibling |

These tree navigation shortcuts work at any zoom level. After focusing, if `level >= 0.9`, the view animates to center on the new focused node.

## S5 Initial State

### S5.1 Startup

On launch, Limb shows `about:limb-home` (the launcher). If the user creates a new branch, a root node is created navigated to the configured homepage. The user is zoomed in on this node.

### S5.2 New Branch

`Ctrl+N` creates a new branch from anywhere. The current branch state is saved first.
