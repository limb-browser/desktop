import type { TreeNode } from './tree-node';

export interface ZoomState {
  level: number;
  focusPoint: { x: number; y: number };
  viewportSize: { width: number; height: number };
}

export const EFFECTIVE_MIN_TREE_WIDTH = 5;

export function clampZoomLevel(level: number): number {
  return Math.max(0, Math.min(1, level));
}

export function computeNodeScreenWidth(
  _node: TreeNode,
  zoomState: ZoomState,
  layout: Map<string, { x: number; y: number }>
): number {
  const positions = [...layout.values()];
  const xs = positions.map(p => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const rawTreeWidth = Math.max(maxX - minX + 1, 1);

  // Minimum effective width so zoom works even with 1 node.
  // Without this, pow(1, level) = 1 for all levels and zoom does nothing.
  const treeWidth = Math.max(rawTreeWidth, EFFECTIVE_MIN_TREE_WIDTH);

  // Exponential interpolation between zoom extremes:
  // level 0.0 → viewportWidth / treeWidth (entire tree fits in viewport)
  // level 1.0 → viewportWidth (focused node fills viewport)
  const zoomScale = Math.pow(treeWidth, zoomState.level) / treeWidth;

  return zoomState.viewportSize.width * zoomScale;
}
