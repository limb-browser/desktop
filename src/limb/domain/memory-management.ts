import type { ScreenshotStore } from './screenshot-store';
import type { BrowsingTree } from './browsing-tree';
import type { LODTier } from '../ports/lod-probe';
import type { PerformanceProbe } from '../ports/performance-probe';

const SCREENSHOT_MEMORY_BUDGET = 20 * 1024 * 1024; // 20MB
const TREE_SIZE_WARNING = 100;
const TREE_SIZE_CRITICAL = 200;

export function evictScreenshots(
  store: ScreenshotStore,
  tree: BrowsingTree,
  tiers: Map<string, LODTier>,
): string[] {
  if (store.totalSize() <= SCREENSHOT_MEMORY_BUDGET) {
    return [];
  }

  // Collect culled nodes that have screenshots
  const culledNodes: { id: string; lastVisitedAt: number }[] = [];
  for (const [nodeId, tier] of tiers) {
    if (tier !== 'culled') continue;
    const node = tree.nodes.get(nodeId);
    if (!node) continue;
    culledNodes.push({ id: nodeId, lastVisitedAt: node.lastVisitedAt });
  }

  // Sort by lastVisitedAt ascending (oldest first)
  culledNodes.sort((a, b) => a.lastVisitedAt - b.lastVisitedAt);

  const evicted: string[] = [];
  for (const candidate of culledNodes) {
    if (store.totalSize() <= SCREENSHOT_MEMORY_BUDGET) break;

    const sizeBefore = store.totalSize();
    store.remove(candidate.id);
    if (store.totalSize() < sizeBefore) {
      evicted.push(candidate.id);
    }
  }

  return evicted;
}

export function checkTreeSize(
  tree: BrowsingTree,
  probe: PerformanceProbe,
): void {
  const nodeCount = tree.nodes.size;

  if (nodeCount > TREE_SIZE_CRITICAL) {
    probe.treeSizeCritical(nodeCount);
  } else if (nodeCount > TREE_SIZE_WARNING) {
    probe.treeSizeWarning(nodeCount);
  }
}
