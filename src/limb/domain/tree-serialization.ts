import type { SerializedNode } from '../ports/persistence-port';
import type { TreeNode, NodeStatus } from './tree-node';
import type { TreeProbe } from '../ports/tree-probe';
import { BrowsingTree } from './browsing-tree';

export function serializeTree(tree: BrowsingTree): SerializedNode[] {
  const result: SerializedNode[] = [];
  for (const node of tree.nodes.values()) {
    result.push({
      id: node.id,
      url: node.url,
      title: node.title,
      favicon: node.favicon,
      parentId: node.parentId,
      childIds: [...node.childIds],
      status: node.status,
      createdAt: node.createdAt,
      lastVisitedAt: node.lastVisitedAt,
      descendantCount: node.descendantCount,
    });
  }
  return result;
}

export function reconstructTree(
  nodes: SerializedNode[],
  focusedNodeId: string,
  screenshotNodeIds: Set<string>,
  probe: TreeProbe,
): BrowsingTree {
  let rootId: string | null = null;
  const nodeMap = new Map<string, TreeNode>();

  for (const serialized of nodes) {
    const status: NodeStatus = screenshotNodeIds.has(serialized.id) ? 'screenshot' : 'favicon-only';
    const treeNode: TreeNode = {
      id: serialized.id,
      url: serialized.url,
      title: serialized.title,
      favicon: serialized.favicon,
      parentId: serialized.parentId,
      childIds: [...serialized.childIds],
      status,
      createdAt: serialized.createdAt,
      lastVisitedAt: serialized.lastVisitedAt,
      descendantCount: serialized.descendantCount,
    };

    nodeMap.set(treeNode.id, treeNode);

    if (serialized.parentId === null) {
      rootId = serialized.id;
    }
  }

  return BrowsingTree.reconstruct(rootId!, nodeMap, focusedNodeId, probe);
}
