import type { TreeProbe } from '../../ports/tree-probe';
import type { TreeNode } from '../tree-node';

export class FakeTreeProbe implements TreeProbe {
  readonly addedNodes: TreeNode[] = [];
  readonly removedNodeIds: string[] = [];
  readonly focusedNodeIds: string[] = [];

  nodeAdded(node: TreeNode): void {
    this.addedNodes.push(node);
  }

  nodeRemoved(nodeId: string): void {
    this.removedNodeIds.push(nodeId);
  }

  nodeFocused(nodeId: string): void {
    this.focusedNodeIds.push(nodeId);
  }
}
