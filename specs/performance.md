# Performance

Firefox is already resource-intensive. Limb must be surgical about what it adds on top. Every byte of memory, every millisecond of CPU must be justified.

## S1 Performance Budget

### S1.1 Baseline Overhead

Limb's overhead (excluding tab renderer processes) must not exceed:

- **Memory:** 50MB for tree management, canvas rendering, and LOD computation.
- **CPU (idle):** < 1% CPU when no animations are running and the user is browsing a single focused page.
- **CPU (animating):** < 10% CPU during zoom/pan animations.
- **Startup:** No additional delay beyond Firefox's normal startup time for the tree layer. Tab restoration can be lazy.

## S2 LOD Computation

### S2.1 Incremental Updates

Do NOT recompute LOD for every node on every frame. Instead:

- Maintain a spatial index of node positions.
- On zoom/pan change, query only nodes whose viewport status might have changed.
- Use a dirty flag per node. Only recompute nodes whose `nodeScreenWidth` crossed a tier boundary.

### S2.2 Layout Caching

The tree layout (node positions) is recomputed only when the tree structure changes (node add/remove). Zoom and pan do NOT trigger layout recomputation. They only change the viewport transform.

### S2.3 Frame Skipping

If LOD computation takes longer than 4ms in a single frame:

- Process only the highest-priority nodes (closest to viewport center) this frame.
- Defer remaining nodes to the next frame.
- Priority: focused node > ancestors > siblings > descendants > distant nodes.

## S3 Rendering

### S3.1 Canvas for Tree

The tree visualization (nodes, edges, labels) uses Canvas 2D. Reasons:

- DOM elements trigger layout recalculation on transform changes.
- Canvas redraws are cheaper for large numbers of elements.
- Canvas gives precise control over what is painted each frame.

Tabs themselves remain Firefox's native `<browser>` elements.

### S3.2 Off-Screen Culling

Nodes outside the viewport (+ 200px margin) are not rendered. Tab elements for culled nodes are hidden or suspended.

### S3.3 Demand-Driven Frame Loop

The frame loop should NOT run at unconditional 60fps. Instead:

- Run frames only when something changed (zoom, pan, animation, tree mutation).
- After 30 idle frames (~500ms), stop scheduling frames entirely.
- Resume on input events or state changes via a `markDirty()` call.

## S4 Tab Management

### S4.1 Tab Suspension

Non-visible tabs (LOD tier below Live) should be suspended using Firefox's built-in tab unloading. This frees renderer process memory.

### S4.2 Preload Budget

Preloading (warming up tabs that are approaching the Live tier) is limited to one concurrent preload at a time.

## S5 Memory Management

### S5.1 Screenshot Eviction

If total screenshot memory exceeds 20MB, evict the oldest screenshots from culled-tier nodes.

### S5.2 Tree Size Warning

Warn when the tree exceeds 100 nodes. Above 200 nodes, suggest closing unused branches. Do NOT auto-close.

## S6 Measurement

### S6.1 Performance Probes

The `PerformanceProbe` interface emits:

- `frameBudgetExceeded(actualMs, budgetMs)` when a frame takes longer than 16ms.
- `lodComputationTime(ms)` per frame.
- `memorySnapshot(heapMB, screenshotsMB, tabCount)` periodic report.

### S6.2 No Performance Regressions

Any commit that increases idle CPU usage above the budget is a defect, not a tradeoff.
