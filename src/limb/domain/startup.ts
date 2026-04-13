import type { TreeProbe } from '../ports/tree-probe';
import type { PersistencePort } from '../ports/persistence-port';
import type { ZoomState } from './zoom';
import { BranchManager } from './branch-manager';
import { computeLayout } from './layout';

const noopProbe: TreeProbe = {
  nodeAdded() {},
  nodeRemoved() {},
  nodeFocused() {},
};

export function createInitialState(
  persistence: PersistencePort,
  probe?: TreeProbe,
): { tree: import('./browsing-tree').BrowsingTree; zoomState: ZoomState } {
  const treeProbe = probe ?? noopProbe;
  const manager = new BranchManager();
  const { tree } = manager.initialize(persistence, treeProbe);
  const layout = computeLayout(tree);
  const rootPos = layout.get(tree.rootId)!;

  const zoomState: ZoomState = {
    level: 0.0,
    focusPoint: { x: rootPos.x, y: rootPos.y },
    viewportSize: { width: 0, height: 0 },
  };

  return { tree, zoomState };
}
