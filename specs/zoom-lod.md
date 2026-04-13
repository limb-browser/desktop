# Zoom & Level of Detail

## S1 Zoom Model

### S1.1 Zoom State

```typescript
interface ZoomState {
  level: number           // 0.0 (fully zoomed out) to 1.0 (fully zoomed in)
  focusPoint: { x: number, y: number }  // Center of viewport in tree-logical coordinates
  viewportSize: { width: number, height: number }  // Physical pixels
}
```

### S1.2 Zoom Interaction

- **Ctrl+Scroll** (or trackpad pinch): Continuously adjusts `level`. Scroll up = zoom in, scroll down = zoom out.
- **Zoom target:** The zoom focuses on `focusPoint`, which defaults to the focused node's position. When the cursor is over a specific node, zoom targets that node instead.
- **Zoom range:** `level` is clamped to `[0.0, 1.0]`.
  - At `level = 1.0`: The focused node fills the entire viewport. This is "normal browsing mode."
  - At `level = 0.0`: The entire tree fits within the viewport.
  - Intermediate levels show a subset of the tree at proportional sizes.

### S1.3 Node Screen Size

The **node screen size** is the width (in physical pixels) that a node occupies on screen at the current zoom level.

```
nodeScreenWidth = baseNodeWidth * zoomScale
```

where `zoomScale` is derived from `level` such that at `level = 1.0`, the focused node's width equals the viewport width.

## S2 Level of Detail Tiers

Each node is assigned an LOD tier based on its `nodeScreenWidth`. The tier determines what resources are allocated.

### S2.1 Tier Definitions

| Tier | Condition | Mode | Resources |
|---|---|---|---|
| **Culled** | Off-screen (outside viewport + margin) | Nothing | None |
| **Favicon** | On-screen, `nodeScreenWidth < 80px` | Favicon + title text | None |
| **Screenshot-Low** | `80px <= nodeScreenWidth < 300px` | Low-res screenshot | Stored image |
| **Screenshot-High** | `300px <= nodeScreenWidth < 600px` | High-res screenshot, refreshed on update | Stored image |
| **Live** | `nodeScreenWidth >= 600px` | Live tab content | Active renderer process |
| **Focused** | Is the `focusedNodeId` AND `level >= 0.9` | Full browsing with input | Active renderer process + input forwarding |

### S2.2 Tier Assignment Algorithm

On every frame (or on zoom/pan change):

1. Compute `nodeScreenWidth` for every node in the tree.
2. Determine viewport visibility (cull nodes fully outside viewport + 200px margin).
3. For each visible node, assign tier based on the thresholds in S2.1.
4. Apply hysteresis (S2.3).
5. Emit tier transitions to the observability probe.

### S2.3 Hysteresis

To prevent thrashing at tier boundaries, use a deadband:

| Transition | Enter threshold | Exit threshold |
|---|---|---|
| Favicon -> Screenshot-Low | `>= 80px` | `< 60px` |
| Screenshot-Low -> Screenshot-High | `>= 300px` | `< 250px` |
| Screenshot-High -> Live | `>= 600px` | `< 450px` |

A node that crossed into a higher tier stays there until it falls below the *exit* threshold, not the entry threshold.

### S2.4 Culling Margin

Nodes within 200px of the viewport edge (in screen space) are not culled, even if partially off-screen. This allows smooth scroll/pan without pop-in.

## S3 Focus Interaction

### S3.1 Click to Focus

Clicking a node in the tree view (when `level < 0.9`) sets it as `focusedNodeId` and animates zoom to `level = 1.0` centered on that node.

### S3.2 Zoom-to-Focus Threshold

When `level >= 0.9`, the focused node receives full input (mouse events, keyboard). Below `level = 0.9`, input goes to the tree canvas (for pan, click-to-focus, etc.).

### S3.3 Pan

When `level < 0.9`, click-and-drag pans the viewport (adjusts `focusPoint`). This allows navigating large trees at intermediate zoom levels.

## S4 Animation

### S4.1 Zoom Animation

When clicking a node to focus it, the zoom animates from current `level` to `1.0` over 300ms with ease-out timing. During animation, LOD tiers update each frame.

### S4.2 Layout Animation

When nodes are added or removed, the tree layout recomputes. Node positions animate from old to new positions over 200ms with ease-in-out timing. Nodes being added fade in. Nodes being removed fade out.

## S5 Invariants

1. **Every visible node has a tier.** No visible node is in an undefined state.
2. **Tier transitions are monotonic per frame.** A node changes at most one tier per LOD computation cycle.
3. **Focused node is always Live or Focused.** The `focusedNodeId` never drops below Live tier, regardless of zoom level.
4. **Hysteresis is symmetric.** Both promotion and demotion thresholds are defined for every tier boundary.
