# Tree Rendering

How the canvas-based tree view integrates with Firefox's browser chrome.

## S1 Architecture

### S1.1 Canvas in Chrome

The tree view is an HTML5 Canvas element rendered in the Firefox chrome (the browser UI layer, not web content). It sits behind the tab content area and becomes visible when zoomed out.

```
browser.xhtml
  +-- limb-tree-canvas (Canvas 2D, full window, z-index below content)
  +-- limb-content-deck (contains tab browser elements)
  +-- limb-address-bar (overlay, visible when zoomed in)
```

### S1.2 Rendering Pipeline

Each frame:
1. **Tick momentum** (zoom/pan physics)
2. **Compute LOD** (which nodes are visible, at what tier)
3. **Update tab visibility** (show/hide/suspend tabs based on LOD)
4. **Paint canvas** (tree edges, node frames, screenshots, labels)
5. **Position focused tab** (transform to fill viewport when zoomed in)

### S1.3 Coordinate Spaces

- **Tree-logical space:** Node positions from the layout algorithm. Unit-less.
- **Screen space:** Pixels on the display. Derived from logical space via zoom level + viewport offset.
- The canvas renders in screen space. The domain layer works in logical space.

## S2 What Gets Painted

### S2.1 Node Frames

Each visible node is painted as a rounded rectangle. Content depends on LOD tier:

| Tier | Painted content |
|---|---|
| Favicon | Small rounded rect with centered favicon + title below |
| Screenshot-Low | Rounded rect filled with low-res screenshot |
| Screenshot-High | Rounded rect filled with high-res screenshot |
| Live | Rounded rect border only (the actual tab content shows through) |
| Focused | Nothing on canvas (tab fills viewport) |

### S2.2 Edges

Parent-child connections are drawn as Bezier curves from the bottom-center of the parent to the top-center of the child. Stroke color: subtle gray. Stroke width: 1-2px, scaling with zoom.

### S2.3 Labels

Node titles are drawn below each node frame when the node is large enough to read (> 60px wide). Font size scales with zoom. Text is truncated with ellipsis when it would overflow.

### S2.4 Focus Ring

The focused node has a colored border (thin, ~2px) at all zoom levels.

## S3 Tab Content Integration

### S3.1 Focused Tab Display

When `zoomLevel >= 0.9`, the focused tab's `<browser>` element is positioned to fill the viewport. The canvas still renders behind it but is mostly occluded.

### S3.2 Live (Non-Focused) Tabs

Tabs at LOD tier Live but not focused are rendered as small browser elements positioned at their tree coordinates. This gives live previews of nearby pages.

**Constraint:** Firefox's process model limits how many renderer processes can be active. Default cap: 8 content processes. Live non-focused tabs share this pool.

### S3.3 Screenshot Capture

When a tab transitions from Live to Screenshot tier:
1. Capture a screenshot of the tab content (using `canvas.drawWindow()` or equivalent Firefox API).
2. Store as JPEG at the appropriate resolution.
3. The tab can then be suspended/unloaded.

## S4 Visibility Management

### S4.1 Zoom-Based Visibility

| Zoom level | What's visible |
|---|---|
| `>= 0.9` | Focused tab fills viewport. Canvas behind. Address bar visible. |
| `0.5 - 0.9` | Multiple nodes visible. Canvas shows tree. Focused tab is smaller. |
| `< 0.5` | Full tree visible. All nodes are small. No live tabs except focused. |

### S4.2 Tab Element Recycling

Firefox tabs that are in Culled or Favicon LOD tier should be suspended (unloaded from memory). When they re-enter a higher tier, they reload. This is Firefox's built-in tab discarding behavior.
