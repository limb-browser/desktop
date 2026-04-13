import type { LODProbe, LODTier } from '../ports/lod-probe';
import type { PerformanceProbe } from '../ports/performance-probe';
import type { ZoomState } from './zoom';
import { computeNodeScreenWidth, EFFECTIVE_MIN_TREE_WIDTH } from './zoom';
import { computeNodeTier } from './lod';
import { SpatialIndex } from './spatial-index';

export const NodePriority = {
  FOCUSED: 0,
  ANCESTOR: 1,
  SIBLING: 2,
  DESCENDANT: 3,
  DISTANT: 4,
} as const;

const LOD_BUDGET_MS = 4;

interface TreeShape {
  focusedNodeId: string;
  getAncestorIds(nodeId: string): string[];
  getSiblingIds(nodeId: string): string[];
  getDescendantIds(nodeId: string): string[];
}

export class IncrementalLOD {
  private lodProbe: LODProbe;
  private perfProbe: PerformanceProbe;
  private now: () => number;
  private dirty: Set<string>;
  private tiers: Map<string, LODTier>;
  private spatialIndex: SpatialIndex;

  constructor(
    lodProbe: LODProbe,
    perfProbe: PerformanceProbe,
    now: () => number = () => performance.now()
  ) {
    this.lodProbe = lodProbe;
    this.perfProbe = perfProbe;
    this.now = now;
    this.dirty = new Set();
    this.tiers = new Map();
    this.spatialIndex = new SpatialIndex(1);
  }

  markDirty(nodeId: string): void {
    this.dirty.add(nodeId);
  }

  markAllDirty(nodeIds: string[]): void {
    for (const id of nodeIds) {
      this.dirty.add(id);
    }
  }

  hasDirtyNodes(): boolean {
    return this.dirty.size > 0;
  }

  syncIndex(layout: Map<string, { x: number; y: number }>): void {
    this.spatialIndex = new SpatialIndex(1);
    for (const [nodeId, pos] of layout) {
      this.spatialIndex.insert(nodeId, pos.x, pos.y);
    }
  }

  onViewportChange(
    zoomState: ZoomState,
    layout: Map<string, { x: number; y: number }>
  ): void {
    // Query nodes in and around the viewport using the spatial index.
    // Convert viewport bounds to tree-coordinate space.
    const positions = [...layout.values()];
    if (positions.length === 0) return;

    const xs = positions.map(p => p.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const rawTreeWidth = Math.max(maxX - minX + 1, 1);
    const treeWidth = Math.max(rawTreeWidth, EFFECTIVE_MIN_TREE_WIDTH);
    const zoomScale = Math.pow(treeWidth, zoomState.level) / treeWidth;
    const pixelsPerUnit = zoomState.viewportSize.width * zoomScale;

    if (pixelsPerUnit === 0) return;

    const { width: vw, height: vh } = zoomState.viewportSize;
    const { x: fpX, y: fpY } = zoomState.focusPoint;

    // Viewport bounds in tree coordinates, with a margin
    const margin = 200; // pixels
    const treeLeft = fpX - (vw / 2 + margin) / pixelsPerUnit;
    const treeTop = fpY - (vh / 2 + margin) / pixelsPerUnit;
    const treeRight = fpX + (vw / 2 + margin) / pixelsPerUnit;
    const treeBottom = fpY + (vh / 2 + margin) / pixelsPerUnit;

    const treeW = treeRight - treeLeft;
    const treeH = treeBottom - treeTop;

    // Query nodes in the expanded viewport region
    const viewportNodes = this.spatialIndex.queryRect(treeLeft, treeTop, treeW, treeH);

    // Mark all viewport-boundary nodes dirty — their visibility may have changed
    for (const nodeId of viewportNodes) {
      this.dirty.add(nodeId);
    }

    // Also mark all previously-tracked nodes that are now outside the viewport.
    // A node going from visible to non-visible has changed status and needs
    // its tier recomputed (e.g., transitioning to 'culled').
    const viewportNodeSet = new Set(viewportNodes);
    for (const [nodeId] of this.tiers) {
      if (!viewportNodeSet.has(nodeId)) {
        this.dirty.add(nodeId);
      }
    }
  }

  prioritizeNodes(nodeIds: string[], tree: TreeShape): string[] {
    const focusedId = tree.focusedNodeId;
    const ancestorSet = new Set(tree.getAncestorIds(focusedId));
    const siblingSet = new Set(tree.getSiblingIds(focusedId));
    const descendantSet = new Set(tree.getDescendantIds(focusedId));

    function getPriority(nodeId: string): number {
      if (nodeId === focusedId) return NodePriority.FOCUSED;
      if (ancestorSet.has(nodeId)) return NodePriority.ANCESTOR;
      if (siblingSet.has(nodeId)) return NodePriority.SIBLING;
      if (descendantSet.has(nodeId)) return NodePriority.DESCENDANT;
      return NodePriority.DISTANT;
    }

    return [...nodeIds].sort((a, b) => getPriority(a) - getPriority(b));
  }

  computeFrame(
    tree: TreeShape,
    layout: Map<string, { x: number; y: number }>,
    zoomState: ZoomState,
    visibility: Map<string, boolean>
  ): Map<string, LODTier> {
    const startTime = this.now();

    const dirtyList = this.prioritizeNodes([...this.dirty], tree);

    const nodeScreenWidth = computeNodeScreenWidth(null as any, zoomState, layout);

    for (const nodeId of dirtyList) {
      // Check frame budget before processing each node
      const elapsed = this.now() - startTime;
      if (elapsed > LOD_BUDGET_MS) {
        // Leave remaining nodes in dirty set for next frame
        break;
      }

      const isFocused = nodeId === tree.focusedNodeId;
      const isVisible = visibility.get(nodeId) ?? false;
      const previousTier = this.tiers.get(nodeId);

      const tier = computeNodeTier(isFocused, isVisible, zoomState.level, nodeScreenWidth, previousTier);

      this.tiers.set(nodeId, tier);
      this.lodProbe.tierAssigned(nodeId, tier);

      if (previousTier !== undefined && tier !== previousTier) {
        this.lodProbe.tierTransitioned(nodeId, previousTier, tier);
      }

      this.dirty.delete(nodeId);
    }

    const endTime = this.now();
    this.perfProbe.lodComputationTime(endTime - startTime);

    // Return full tier map (cached + freshly computed)
    return new Map(this.tiers);
  }
}
