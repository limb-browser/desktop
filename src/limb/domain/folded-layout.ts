import type { BrowsingTree } from './browsing-tree';
import type { FoldState } from './branch-folding';
import { computeLayout } from './layout';

export const ARCHIVE_FOLD_NODE_ID = '__archive_fold__';

export function computeFoldedLayout(
  tree: BrowsingTree,
  foldState: FoldState,
): Map<string, { x: number; y: number }> {
  const rootNode = tree.nodes.get(tree.rootId);
  if (!rootNode) return new Map();

  // When expanded or no archived branches, layout all children normally
  if (foldState.expanded || foldState.archivedCount === 0) {
    return computeLayout(tree);
  }

  // Folded: use recentBranchIds (sorted by recency) as visible children,
  // and append a fold node placeholder for the archived branches.
  return computeLayout(tree, {
    visibleChildIds: foldState.recentBranchIds,
    foldNodeId: ARCHIVE_FOLD_NODE_ID,
    showFoldNode: true,
  });
}
