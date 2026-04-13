import type { BrowsingTree } from './browsing-tree';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface FoldState {
  recentBranchIds: string[];
  archivedCount: number;
  expanded: boolean;
}

export function computeFoldState(tree: BrowsingTree, now: number, previousState?: FoldState): FoldState {
  const root = tree.nodes.get(tree.rootId);
  if (!root) {
    return { recentBranchIds: [], archivedCount: 0, expanded: false };
  }

  const cutoff = now - SEVEN_DAYS_MS;
  const recent: { id: string; lastVisitedAt: number }[] = [];
  let archivedCount = 0;

  for (const childId of root.childIds) {
    const child = tree.nodes.get(childId);
    if (!child) continue;

    if (child.lastVisitedAt >= cutoff) {
      recent.push({ id: child.id, lastVisitedAt: child.lastVisitedAt });
    } else {
      archivedCount++;
    }
  }

  // Sort recent by recency (most recent first)
  recent.sort((a, b) => b.lastVisitedAt - a.lastVisitedAt);

  return {
    recentBranchIds: recent.map(r => r.id),
    archivedCount,
    expanded: previousState?.expanded ?? false,
  };
}

export function toggleFold(state: FoldState): FoldState {
  return {
    recentBranchIds: state.recentBranchIds,
    archivedCount: state.archivedCount,
    expanded: !state.expanded,
  };
}
