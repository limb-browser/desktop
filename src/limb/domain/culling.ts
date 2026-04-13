import type { TreeNode } from './tree-node';
import type { ZoomState } from './zoom';
import { EFFECTIVE_MIN_TREE_WIDTH } from './zoom';

const CULLING_MARGIN = 200;

export function computeVisibility(
  nodes: Map<string, TreeNode>,
  layout: Map<string, { x: number; y: number }>,
  zoomState: ZoomState,
  focusedNodeId?: string
): Map<string, boolean> {
  const result = new Map<string, boolean>();

  const positions = [...layout.values()];
  if (positions.length === 0) {
    for (const [nodeId] of nodes) {
      result.set(nodeId, false);
    }
    return result;
  }

  const xs = positions.map(p => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const rawTreeWidth = Math.max(maxX - minX + 1, 1);
  const treeWidth = Math.max(rawTreeWidth, EFFECTIVE_MIN_TREE_WIDTH);
  const zoomScale = Math.pow(treeWidth, zoomState.level) / treeWidth;
  const pixelsPerUnit = zoomState.viewportSize.width * zoomScale;

  const { width: vw, height: vh } = zoomState.viewportSize;
  const { x: fpX, y: fpY } = zoomState.focusPoint;

  for (const [nodeId] of nodes) {
    const pos = layout.get(nodeId);
    if (!pos) {
      result.set(nodeId, false);
      continue;
    }

    const screenX = (pos.x - fpX) * pixelsPerUnit + vw / 2;
    const screenY = (pos.y - fpY) * pixelsPerUnit + vh / 2;

    const visible =
      screenX >= -CULLING_MARGIN &&
      screenX <= vw + CULLING_MARGIN &&
      screenY >= -CULLING_MARGIN &&
      screenY <= vh + CULLING_MARGIN;

    // The focused node must NEVER be culled, even if off-screen during panning
    if (nodeId === focusedNodeId) {
      result.set(nodeId, true);
    } else {
      result.set(nodeId, visible);
    }
  }

  return result;
}
