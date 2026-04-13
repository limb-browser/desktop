import type { TreeNode } from './tree-types';

export interface TreeProbe {
  nodeAdded(node: TreeNode): void;
  nodeRemoved(nodeId: string): void;
  nodeFocused(nodeId: string): void;
}
