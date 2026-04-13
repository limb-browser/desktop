import type { BrowsingTree } from './browsing-tree';

/** Depth step for active nodes. Must be >= NODE_WIDTH_RATIO (0.8) to avoid overlap. */
const ACTIVE_DEPTH_STEP = 1.0;

/** Depth step for inactive (screenshot) nodes. They collapse to a thin strip. */
const INACTIVE_WIDTH_MULTIPLIER = 0.12;

/**
 * Optional configuration for root-level branch folding.
 * When provided, the layout filters root children and optionally
 * appends a fold node placeholder.
 */
export interface LayoutFoldConfig {
  /** Root child IDs to include in layout (ordered by desired display order). */
  visibleChildIds: string[];
  /** ID to assign to the fold node placeholder. */
  foldNodeId: string;
  /** Whether to append a fold node after the visible children. */
  showFoldNode: boolean;
}

export function computeLayout(
  tree: BrowsingTree,
  foldConfig?: LayoutFoldConfig,
): Map<string, { x: number, y: number }> {
  const positions = new Map<string, { x: number, y: number }>();
  let leafCounter = 0;

  // Left-to-right layout: depth increases along x, siblings spread along y.
  // Root is at the left; children extend to the right.
  // Inactive (screenshot) nodes use a fractional depth step so they take less horizontal space.
  function layoutNode(nodeId: string, depth: number): number {
    const node = tree.nodes.get(nodeId)!;
    const isInactive = node.status === 'screenshot';
    // Inactive nodes occupy less horizontal space
    const depthStep = isInactive ? INACTIVE_WIDTH_MULTIPLIER : ACTIVE_DEPTH_STEP;

    // Determine which children to lay out
    let childIds: string[];
    if (foldConfig && nodeId === tree.rootId) {
      childIds = foldConfig.visibleChildIds;
    } else {
      childIds = node.childIds;
    }

    // Leaf node (or root with no visible children and no fold node)
    const hasFoldNode = foldConfig && nodeId === tree.rootId && foldConfig.showFoldNode;
    if (childIds.length === 0 && !hasFoldNode) {
      const y = leafCounter++;
      positions.set(nodeId, { x: depth, y });
      return y;
    }

    let firstChildY: number | undefined;
    let lastChildY = 0;

    for (let i = 0; i < childIds.length; i++) {
      const childY = layoutNode(childIds[i], depth + depthStep);
      if (firstChildY === undefined) firstChildY = childY;
      lastChildY = childY;
    }

    // Append fold node after visible children
    if (hasFoldNode) {
      const foldY = leafCounter++;
      positions.set(foldConfig!.foldNodeId, { x: depth + ACTIVE_DEPTH_STEP, y: foldY });
      if (firstChildY === undefined) firstChildY = foldY;
      lastChildY = foldY;
    }

    const y = ((firstChildY ?? 0) + lastChildY) / 2;
    positions.set(nodeId, { x: depth, y });
    return y;
  }

  layoutNode(tree.rootId, 0);

  return positions;
}
