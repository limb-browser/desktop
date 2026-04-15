// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import type { BrowsingTree } from './BrowsingTree';
import type { NodePosition } from './TreeLayout';

/**
 * Computes a tree layout that handles fold nodes at the root level.
 *
 * Fold nodes (identified by foldNodeIds) are positioned as leaves at depth 1.
 * Only branches listed in visibleRootChildren are laid out; branches hidden
 * behind fold nodes are excluded entirely.
 *
 * The layout algorithm is identical to TreeLayout.computeLayout except
 * at the root level, where visibleRootChildren replaces root.childIds.
 */
export function computeFoldedLayout(
  tree: BrowsingTree,
  visibleRootChildren: string[],
  foldNodeIds: Set<string>,
): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  let leafIndex = 0;

  function postOrder(nodeId: string, depth: number): void {
    if (foldNodeIds.has(nodeId)) {
      positions.set(nodeId, { x: leafIndex, y: depth });
      leafIndex++;
      return;
    }

    const node = tree.nodes.get(nodeId);
    if (!node) return;

    if (node.childIds.length === 0) {
      positions.set(nodeId, { x: leafIndex, y: depth });
      leafIndex++;
    } else {
      for (const childId of node.childIds) {
        postOrder(childId, depth + 1);
      }
      const firstChild = positions.get(node.childIds[0])!;
      const lastChild = positions.get(node.childIds[node.childIds.length - 1])!;
      positions.set(nodeId, {
        x: (firstChild.x + lastChild.x) / 2,
        y: depth,
      });
    }
  }

  if (visibleRootChildren.length === 0) {
    positions.set(tree.rootId, { x: 0, y: 0 });
  } else {
    for (const childId of visibleRootChildren) {
      postOrder(childId, 1);
    }
    const first = positions.get(visibleRootChildren[0])!;
    const last = positions.get(visibleRootChildren[visibleRootChildren.length - 1])!;
    positions.set(tree.rootId, {
      x: (first.x + last.x) / 2,
      y: 0,
    });
  }

  return positions;
}

/**
 * Builds a childId -> parentId map for the folded tree layout.
 *
 * Includes edges from root to visible children (branches and fold nodes),
 * and recursively walks subtrees of visible branches. Fold nodes and
 * branches hidden behind them are not walked.
 */
export function buildFoldedParentMap(
  tree: BrowsingTree,
  visibleRootChildren: string[],
  foldNodeIds: Set<string>,
): Map<string, string> {
  const parentMap = new Map<string, string>();

  function walk(nodeId: string): void {
    const node = tree.nodes.get(nodeId);
    if (!node) return;
    for (const childId of node.childIds) {
      parentMap.set(childId, nodeId);
      walk(childId);
    }
  }

  for (const childId of visibleRootChildren) {
    parentMap.set(childId, tree.rootId);
    if (!foldNodeIds.has(childId)) {
      walk(childId);
    }
  }

  return parentMap;
}
