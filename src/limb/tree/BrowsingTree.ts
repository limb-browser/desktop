// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import type { BrowsingTreeProbe } from '../ports/BrowsingTreeProbe';

export type NodeStatus = 'live' | 'screenshot' | 'favicon-only' | 'culled';

export interface TreeNode {
  id: string;
  url: string;
  title: string;
  favicon: string | null;
  parentId: string | null;
  childIds: string[];
  status: NodeStatus;
  createdAt: number;
  lastVisitedAt: number;
}

export class BrowsingTree {
  rootId: string;
  nodes: Map<string, TreeNode>;
  focusedNodeId: string;
  #probe: BrowsingTreeProbe | null;

  constructor(rootUrl: string, probe?: BrowsingTreeProbe) {
    this.#probe = probe ?? null;
    const now = Date.now();
    const rootId = crypto.randomUUID();
    const root: TreeNode = {
      id: rootId,
      url: rootUrl,
      title: '',
      favicon: null,
      parentId: null,
      childIds: [],
      status: 'culled',
      createdAt: now,
      lastVisitedAt: now,
    };
    this.rootId = rootId;
    this.focusedNodeId = rootId;
    this.nodes = new Map([[rootId, root]]);
  }

  addChild(parentId: string, url: string): TreeNode {
    const parent = this.nodes.get(parentId);
    if (!parent) {
      throw new Error(`Parent node "${parentId}" does not exist`);
    }

    const now = Date.now();
    const child: TreeNode = {
      id: crypto.randomUUID(),
      url,
      title: '',
      favicon: null,
      parentId,
      childIds: [],
      status: 'culled',
      createdAt: now,
      lastVisitedAt: now,
    };

    parent.childIds.push(child.id);
    this.nodes.set(child.id, child);
    this.#probe?.childAdded(parentId, child.id);
    return child;
  }

  removeNode(nodeId: string): void {
    if (nodeId === this.rootId) {
      throw new Error('Cannot remove the root node');
    }
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node "${nodeId}" does not exist`);
    }

    // Collect all descendants (breadth-first, excluding the node itself)
    const descendantIds: string[] = [];
    const queue = [...node.childIds];
    while (queue.length > 0) {
      const id = queue.shift()!;
      descendantIds.push(id);
      const descendant = this.nodes.get(id);
      if (descendant) {
        queue.push(...descendant.childIds);
      }
    }

    // If focused node is being removed (either the node itself or a descendant),
    // move focus to the removed node's parent.
    const focusMoving =
      this.focusedNodeId === nodeId ||
      descendantIds.includes(this.focusedNodeId);
    if (focusMoving) {
      this.focusedNodeId = node.parentId!;
      this.#probe?.nodeFocused(this.focusedNodeId);
    }

    // Remove from parent's childIds
    const parent = this.nodes.get(node.parentId!);
    if (parent) {
      parent.childIds = parent.childIds.filter((id) => id !== nodeId);
    }

    // Remove node and all descendants from the map
    this.nodes.delete(nodeId);
    for (const id of descendantIds) {
      this.nodes.delete(id);
    }

    this.#probe?.nodeRemoved(nodeId, descendantIds);
  }

  focusNode(nodeId: string): void {
    if (!this.nodes.has(nodeId)) {
      throw new Error(`Node "${nodeId}" does not exist`);
    }
    this.focusedNodeId = nodeId;
    this.nodes.get(nodeId)!.lastVisitedAt = Date.now();
    this.#probe?.nodeFocused(nodeId);
  }

  getAncestors(nodeId: string): TreeNode[] {
    if (!this.nodes.has(nodeId)) {
      throw new Error(`Node "${nodeId}" does not exist`);
    }
    const path: TreeNode[] = [];
    let current: TreeNode | undefined = this.nodes.get(nodeId);
    while (current) {
      path.push(current);
      current = current.parentId
        ? this.nodes.get(current.parentId)
        : undefined;
    }
    return path;
  }

  getDescendants(nodeId: string): TreeNode[] {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node "${nodeId}" does not exist`);
    }
    const result: TreeNode[] = [];
    const queue: TreeNode[] = [node];
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);
      for (const childId of current.childIds) {
        const child = this.nodes.get(childId);
        if (child) {
          queue.push(child);
        }
      }
    }
    return result;
  }

  getSubtreeDepth(nodeId: string): number {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node "${nodeId}" does not exist`);
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
      throw new Error(`Node "${nodeId}" does not exist`);
    }
    if (node.parentId === null) {
      return [];
    }
    const parent = this.nodes.get(node.parentId);
    if (!parent) {
      return [];
    }
    return parent.childIds
      .filter((id) => id !== nodeId)
      .map((id) => this.nodes.get(id)!)
      .filter(Boolean);
  }
}
