import type { TreeNode } from './tree-node';
import type { TreeProbe } from '../ports/tree-probe';

export class BrowsingTree {
  rootId: string;
  nodes: Map<string, TreeNode>;
  focusedNodeId: string;

  private probe: TreeProbe;

  private constructor(rootId: string, nodes: Map<string, TreeNode>, focusedNodeId: string, probe: TreeProbe) {
    this.rootId = rootId;
    this.nodes = nodes;
    this.focusedNodeId = focusedNodeId;
    this.probe = probe;
  }

  static create(url: string, probe: TreeProbe): BrowsingTree {
    const id = crypto.randomUUID();
    const now = Date.now();

    const root: TreeNode = {
      id,
      url,
      title: '',
      favicon: null,
      parentId: null,
      childIds: [],
      status: 'culled',
      createdAt: now,
      lastVisitedAt: now,
      descendantCount: 0,
    };

    const nodes = new Map<string, TreeNode>();
    nodes.set(id, root);

    probe.nodeAdded(root);
    probe.nodeFocused(id);

    return new BrowsingTree(id, nodes, id, probe);
  }

  static reconstruct(rootId: string, nodes: Map<string, TreeNode>, focusedNodeId: string, probe: TreeProbe): BrowsingTree {
    for (const node of nodes.values()) {
      probe.nodeAdded(node);
    }
    probe.nodeFocused(focusedNodeId);
    return new BrowsingTree(rootId, nodes, focusedNodeId, probe);
  }

  removeNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    if (node.parentId === null) {
      throw new Error('Cannot remove the root node');
    }

    // Collect all descendants (breadth-first)
    const toRemove: string[] = [nodeId];
    for (let i = 0; i < toRemove.length; i++) {
      const current = this.nodes.get(toRemove[i])!;
      for (const childId of current.childIds) {
        toRemove.push(childId);
      }
    }

    // If focused node is in the subtree being removed, move focus to parent
    if (toRemove.includes(this.focusedNodeId)) {
      this.focusNode(node.parentId);
    }

    // Decrement descendantCount on all ancestors by the subtree size
    const subtreeSize = toRemove.length;
    let ancestor: TreeNode | undefined = node.parentId ? this.nodes.get(node.parentId) : undefined;
    while (ancestor) {
      ancestor.descendantCount -= subtreeSize;
      ancestor = ancestor.parentId ? this.nodes.get(ancestor.parentId) : undefined;
    }

    // Remove from parent's childIds
    const parent = this.nodes.get(node.parentId)!;
    const idx = parent.childIds.indexOf(nodeId);
    parent.childIds.splice(idx, 1);

    // Remove all nodes and fire probes
    for (const id of toRemove) {
      this.nodes.delete(id);
      this.probe.nodeRemoved(id);
    }
  }

  focusNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    node.lastVisitedAt = Date.now();
    this.focusedNodeId = nodeId;
    this.probe.nodeFocused(nodeId);
  }

  addExistingNode(node: TreeNode): void {
    const parent = this.nodes.get(node.parentId!);
    if (!parent) {
      throw new Error(`Parent node not found: ${node.parentId}`);
    }

    this.nodes.set(node.id, node);
    parent.childIds.push(node.id);

    // Walk up the parent chain and increment descendantCount by
    // 1 (the node itself) + node.descendantCount (its persisted subtree)
    const increment = 1 + node.descendantCount;
    let ancestor: TreeNode | undefined = parent;
    while (ancestor) {
      ancestor.descendantCount += increment;
      ancestor = ancestor.parentId ? this.nodes.get(ancestor.parentId) : undefined;
    }

    this.probe.nodeAdded(node);
  }

  loadSubtree(nodes: TreeNode[]): void {
    for (const node of nodes) {
      if (this.nodes.has(node.id)) {
        // Node already in tree (e.g., branch root) - restore childIds
        const existing = this.nodes.get(node.id)!;
        existing.childIds = node.childIds;
        continue;
      }

      this.nodes.set(node.id, node);
      this.probe.nodeAdded(node);
    }
  }

  unloadSubtree(branchRootId: string): void {
    const branchRoot = this.nodes.get(branchRootId);
    if (!branchRoot) {
      throw new Error(`Node not found: ${branchRootId}`);
    }

    // Collect all descendants (BFS, excluding the branch root itself)
    const toRemove: string[] = [];
    const queue = [...branchRoot.childIds];
    while (queue.length > 0) {
      const id = queue.shift()!;
      const node = this.nodes.get(id);
      if (!node) continue;
      toRemove.push(id);
      for (const childId of node.childIds) {
        queue.push(childId);
      }
    }

    // If focused node is in the unloaded subtree, move focus to branch root
    if (toRemove.includes(this.focusedNodeId)) {
      this.focusNode(branchRootId);
    }

    // Remove all descendants and fire probes
    for (const id of toRemove) {
      this.nodes.delete(id);
      this.probe.nodeRemoved(id);
    }

    // Clear childIds on the branch root
    branchRoot.childIds = [];
  }

  addChild(parentId: string, url: string): TreeNode {
    const parent = this.nodes.get(parentId);
    if (!parent) {
      throw new Error(`Parent node not found: ${parentId}`);
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    const child: TreeNode = {
      id,
      url,
      title: '',
      favicon: null,
      parentId,
      childIds: [],
      status: 'culled',
      createdAt: now,
      lastVisitedAt: now,
      descendantCount: 0,
    };

    this.nodes.set(id, child);
    parent.childIds.push(id);

    // Walk up the parent chain and increment descendantCount on every ancestor
    let ancestor: TreeNode | undefined = parent;
    while (ancestor) {
      ancestor.descendantCount++;
      ancestor = ancestor.parentId ? this.nodes.get(ancestor.parentId) : undefined;
    }

    this.probe.nodeAdded(child);

    return child;
  }

  getAncestors(nodeId: string): TreeNode[] {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    const ancestors: TreeNode[] = [];
    let current: TreeNode | undefined = node;
    while (current) {
      ancestors.push(current);
      current = current.parentId ? this.nodes.get(current.parentId) : undefined;
    }

    return ancestors;
  }

  getDescendants(nodeId: string): TreeNode[] {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    const result: TreeNode[] = [node];
    for (let i = 0; i < result.length; i++) {
      for (const childId of result[i].childIds) {
        result.push(this.nodes.get(childId)!);
      }
    }

    return result;
  }

  getSubtreeDepth(nodeId: string): number {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    if (node.childIds.length === 0) {
      return 0;
    }

    let maxChildDepth = 0;
    for (const childId of node.childIds) {
      const childDepth = this.getSubtreeDepth(childId);
      if (childDepth > maxChildDepth) {
        maxChildDepth = childDepth;
      }
    }

    return 1 + maxChildDepth;
  }

  getSiblings(nodeId: string): TreeNode[] {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    if (node.parentId === null) {
      return [];
    }

    const parent = this.nodes.get(node.parentId)!;
    return parent.childIds
      .filter(id => id !== nodeId)
      .map(id => this.nodes.get(id)!);
  }
}
