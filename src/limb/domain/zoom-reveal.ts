import type { BrowsingTree } from './browsing-tree';

/**
 * Computes the reveal order of nodes when zooming out from the focused node.
 *
 * Order: siblings first, then parent, then parent's siblings with their
 * subtrees, then grandparent, continuing up the tree. For the root node
 * (no ancestors), descendants are returned in breadth-first order.
 *
 * The focused node itself is never included in the result.
 */
export function computeRevealOrder(focusedNodeId: string, tree: BrowsingTree): string[] {
  const result: string[] = [];
  const included = new Set<string>([focusedNodeId]);

  let currentId = focusedNodeId;
  const currentNode = tree.nodes.get(currentId);
  if (!currentNode) return result;

  while (true) {
    const node = tree.nodes.get(currentId)!;
    if (node.parentId === null) break;

    const parent = tree.nodes.get(node.parentId)!;

    // Add siblings of current node (excluding current) with their subtrees
    for (const siblingId of parent.childIds) {
      if (included.has(siblingId)) continue;
      addSubtree(siblingId, tree, result, included);
    }

    // Add the parent
    if (!included.has(node.parentId)) {
      result.push(node.parentId);
      included.add(node.parentId);
    }

    currentId = node.parentId;
  }

  // If focused on root, add all descendants in BFS order
  if (focusedNodeId === tree.rootId) {
    const rootNode = tree.nodes.get(tree.rootId)!;
    for (const childId of rootNode.childIds) {
      addSubtree(childId, tree, result, included);
    }
  }

  return result;
}

function addSubtree(
  nodeId: string,
  tree: BrowsingTree,
  result: string[],
  included: Set<string>
): void {
  if (included.has(nodeId)) return;
  result.push(nodeId);
  included.add(nodeId);

  // BFS for children
  const queue = [nodeId];
  for (let i = 0; i < queue.length; i++) {
    const node = tree.nodes.get(queue[i])!;
    for (const childId of node.childIds) {
      if (included.has(childId)) continue;
      result.push(childId);
      included.add(childId);
      queue.push(childId);
    }
  }
}
