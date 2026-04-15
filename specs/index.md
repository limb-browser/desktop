# Limb Specifications

Limb is a tree-first browser built on Firefox. Browsing history is the visual interface. Every page is a node in a zoomable tree.

## How to Read These

Specs define WHAT the system does. Code implements specs. If they disagree, fix the spec first, then the code.

## Product Specs

| Spec | Path | Summary |
|---|---|---|
| **Vision** | [`vision.md`](vision.md) | Core concept, principles, non-goals |
| **Tree Model** | [`tree-model.md`](tree-model.md) | Domain model: nodes, edges, tree operations, invariants |
| **Zoom & LOD** | [`zoom-lod.md`](zoom-lod.md) | Zoom interaction, level-of-detail tiers, hysteresis |
| **Interaction Feel** | [`interaction-feel.md`](interaction-feel.md) | Momentum, easing, hover feedback, animation choreography |
| **Navigation** | [`navigation.md`](navigation.md) | Address bar, link interception, keyboard shortcuts |
| **Performance** | [`performance.md`](performance.md) | CPU/memory budgets, rendering strategy, measurement |
| **Settings** | [`settings.md`](settings.md) | User preferences via Firefox prefs system |
| **Persistence** | [`persistence.md`](persistence.md) | SessionStore integration, branch loading, screenshots |
| **Unified Tree** | [`unified-tree.md`](unified-tree.md) | Single persistent tree, branches, lazy loading, search |

## Architecture Specs

| Spec | Path | Summary |
|---|---|---|
| **Chrome Integration** | [`chrome-integration.md`](chrome-integration.md) | DOM structure, bootstrap sequence, build system rules |
| **Patch Strategy** | [`patch-strategy.md`](patch-strategy.md) | Which Firefox files we patch, why, principles for small patches |
| **Tree Rendering** | [`tree-rendering.md`](tree-rendering.md) | Canvas integration with Firefox chrome, rendering pipeline |
| **Tab Bridge** | [`tab-bridge.md`](tab-bridge.md) | How Firefox tabs map to tree nodes |
