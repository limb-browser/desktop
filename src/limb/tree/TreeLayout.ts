// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import type { BrowsingTree } from './BrowsingTree';

export interface NodePosition {
  x: number;
  y: number;
}

/**
 * Computes a top-down tree layout in logical (unit-less) coordinates.
 *
 * Algorithm: leaves are assigned consecutive integer x values in tree order.
 * Internal nodes are centered horizontally above their children (midpoint of
 * first and last child x). y equals the node's depth.
 *
 * Invariants guaranteed:
 * - Every node has a position.
 * - No two nodes share the same (x, y).
 * - Parent y < child y.
 * - Sibling x order matches childIds (creation) order.
 * - Subtrees do not overlap.
 * - Deterministic: same tree always yields the same layout.
 */
export function computeLayout(tree: BrowsingTree): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  let leafIndex = 0;

  function postOrder(nodeId: string, depth: number): void {
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

  postOrder(tree.rootId, 0);
  return positions;
}
