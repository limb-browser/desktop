# Vision

## What Limb Is

Limb is a browser that replaces tabs with a zoomable tree. Every webpage is a node. Opening a link branches a child. The tree IS the tab manager; there is no separate tab bar. You zoom in to browse, zoom out to see the rabbit hole.

Built as a Firefox fork with full extension support.

## Principles

1. **Tree-first.** The tree is the native browsing experience, not an overlay or sidebar. There is no tab bar. There is no split view. The tree IS the browser chrome.

2. **Seamless zoom.** The transition between "browsing a single page" and "viewing the tree" is a continuous zoom, not a mode switch. `Ctrl+Scroll` (or pinch) zooms between levels. At max zoom-in, one node fills the screen and it looks and feels like a normal browser. At max zoom-out, the entire tree is visible.

3. **Spatial memory.** Nodes have stable positions in the tree. Revisiting a rabbit hole means zooming into the same spatial location. The layout is deterministic: sibling order matches creation order, depth matches navigation depth.

4. **Progressive fidelity.** Distant nodes are cheap (favicon + title). Nearby nodes are screenshots. The focused node is a live webpage. Resources scale with visual prominence. The user never waits for off-screen content.

5. **Minimal chrome.** The address bar, back/forward, and reload belong to the focused node. They appear when zoomed in and fade when zoomed out. The tree view is clean: nodes, edges, titles.

6. **Real browser.** Full Firefox extension support. Standard web compatibility. No Electron compromises. This is Firefox with a different spatial model, not a demo.

## Non-Goals

- Limb does NOT modify web content. No built-in ad blocking, no reader mode, no content injection. Install an extension for that.
- Limb does NOT support multiple windows (initially). One window, one tree.

## User Stories

### S1: Research Rabbit Hole

A researcher starts at a Wikipedia article. They Ctrl+click three links, each opening as a child node. They Ctrl+scroll out to see the four nodes as a tree. They click a different branch to explore it. They zoom back out and can see the entire research session as a spatial map.

### S2: Zoom Transition

A user is reading an article (zoomed in, full screen). They hold Ctrl and scroll down. The page shrinks. Sibling nodes fade in. Parent node appears above. The tree layout materializes. They continue scrolling and the tree shrinks further, more of the tree becomes visible. They stop scrolling and click a distant node. The tree zooms into that node until it fills the screen.

### S3: Deep Tree

After 30 minutes of browsing, the tree has 40 nodes across 6 levels of depth. The user zooms fully out. Most nodes show as favicon + title. A few near the viewport center show screenshots. The focused node (last visited) pulses subtly. The user can see the shape of their research: which branches went deep, which were dead ends.

### S4: Session Resumption

A user closes Limb and comes back the next day. The launcher shows their previous branches with names, favicons, and timestamps. They click yesterday's research session. The tree loads with all nodes as screenshots. They click a node to zoom in, and the page loads live.

### S5: Extensions Work

A user installs uBlock Origin and Bitwarden from Firefox Add-ons. They work identically to Firefox. The tree view doesn't interfere with extension popups or content scripts.
