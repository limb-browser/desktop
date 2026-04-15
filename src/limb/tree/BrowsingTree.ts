// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import type { BrowsingTreeProbe } from '../ports/BrowsingTreeProbe';
import type { TreeStoragePort, StoredNode } from '../ports/TreeStoragePort';

export type NodeStatus = 'live' | 'screenshot' | 'favicon-only' | 'culled';

export interface TreeNode {
  id: string;
  url: string;
  title: string;
  favicon: string | null;
  screenshot: string | null;
  parentId: string | null;
  childIds: string[];
  status: NodeStatus;
  createdAt: number;
  lastVisitedAt: number;
  descendantCount: number;
}

export class BrowsingTree {
  rootId: string;
  nodes: Map<string, TreeNode>;
  focusedNodeId: string;
  activeBranchId: string | null = null;
  #probe: BrowsingTreeProbe | null;
  #warningFired = false;
  #suggestionFired = false;

  constructor(rootUrl: string, probe?: BrowsingTreeProbe) {
    this.#probe = probe ?? null;
    const now = Date.now();
    const rootId = crypto.randomUUID();
    const root: TreeNode = {
      id: rootId,
      url: rootUrl,
      title: '',
      favicon: null,
      screenshot: null,
      parentId: null,
      childIds: [],
      status: 'culled',
      createdAt: now,
      lastVisitedAt: now,
      descendantCount: 0,
    };
    this.rootId = rootId;
    this.focusedNodeId = rootId;
    this.nodes = new Map([[rootId, root]]);
  }

  setProbe(probe: BrowsingTreeProbe | null): void {
    this.#probe = probe;
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
      screenshot: null,
      parentId,
      childIds: [],
      status: 'culled',
      createdAt: now,
      lastVisitedAt: now,
      descendantCount: 0,
    };

    parent.childIds.push(child.id);
    this.nodes.set(child.id, child);
    this.#incrementAncestorCounts(parentId);
    this.#probe?.childAdded(parentId, child.id);
    this.#checkTreeSize();
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

    // Remove from parent's childIds and decrement ancestor counts
    const parent = this.nodes.get(node.parentId!);
    if (parent) {
      parent.childIds = parent.childIds.filter((id) => id !== nodeId);
    }
    const removedCount = 1 + descendantIds.length;
    this.#decrementAncestorCounts(node.parentId!, removedCount);

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
    const now = Date.now();
    this.nodes.get(nodeId)!.lastVisitedAt = now;

    // Propagate lastVisitedAt to branch root (direct child of root)
    const branchRootId = this.getBranchRootId(nodeId);
    if (branchRootId !== null && branchRootId !== nodeId) {
      this.nodes.get(branchRootId)!.lastVisitedAt = now;
    }

    this.#probe?.nodeFocused(nodeId);
  }

  getBranchRootId(nodeId: string): string | null {
    let current = this.nodes.get(nodeId);
    if (!current) return null;
    while (current.parentId !== null && current.parentId !== this.rootId) {
      current = this.nodes.get(current.parentId)!;
    }
    // If current's parent is root, current is a branch root
    if (current.parentId === this.rootId) {
      return current.id;
    }
    // nodeId is the root itself
    return null;
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

  async activateBranch(
    branchRootId: string,
    storage: TreeStoragePort
  ): Promise<void> {
    const branchRoot = this.nodes.get(branchRootId);
    if (!branchRoot) {
      throw new Error(`Branch root "${branchRootId}" does not exist`);
    }
    if (branchRoot.parentId !== this.rootId) {
      throw new Error(
        `Node "${branchRootId}" is not a branch root (not a direct child of root)`
      );
    }

    // F1: Idempotency — already active, nothing to do
    if (this.activeBranchId === branchRootId) {
      return;
    }

    // F1: Branch root already has in-memory children — activating would orphan them
    if (branchRoot.childIds.length > 0) {
      throw new Error(
        `Branch root "${branchRootId}" already has in-memory children; deactivate first`
      );
    }

    const storedNodes = await storage.loadBranch(branchRootId);

    // F2: Empty storage result — no subtree to load
    if (storedNodes.length === 0) {
      this.activeBranchId = branchRootId;
      this.#probe?.branchActivated(branchRootId, 0);
      return;
    }

    // Insert descendant nodes into the tree
    const loadedNodeIds: string[] = [];
    for (const stored of storedNodes) {
      if (stored.id === branchRootId) {
        // Update branch root from storage data
        branchRoot.childIds = [...stored.childIds];
        branchRoot.descendantCount = stored.descendantCount;
        // Include branch root for screenshot restoration
        loadedNodeIds.push(branchRootId);
        continue;
      }
      const node: TreeNode = {
        id: stored.id,
        url: stored.url,
        title: stored.title,
        favicon: stored.favicon,
        screenshot: null,
        parentId: stored.parentId,
        childIds: [...stored.childIds],
        status: 'culled',
        createdAt: stored.createdAt,
        lastVisitedAt: stored.lastVisitedAt,
        descendantCount: stored.descendantCount,
      };
      this.nodes.set(node.id, node);
      loadedNodeIds.push(node.id);
    }

    // Update root's descendantCount to include newly loaded nodes
    const loadedDescendants = storedNodes.length - 1; // exclude branch root itself
    const root = this.nodes.get(this.rootId)!;
    root.descendantCount += loadedDescendants;

    // F3: Restore screenshots for loaded nodes
    for (const nodeId of loadedNodeIds) {
      const data = await storage.loadScreenshot(nodeId, 'low');
      if (data) {
        this.nodes.get(nodeId)!.screenshot =
          BrowsingTree.#uint8ArrayToDataUrl(data);
      }
    }

    this.activeBranchId = branchRootId;
    this.#probe?.branchActivated(branchRootId, storedNodes.length);
  }

  static #uint8ArrayToDataUrl(data: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i]);
    }
    return `data:image/jpeg;base64,${btoa(binary)}`;
  }

  async deactivateBranch(
    branchRootId: string,
    storage: TreeStoragePort
  ): Promise<void> {
    const branchRoot = this.nodes.get(branchRootId);
    if (!branchRoot) {
      throw new Error(`Branch root "${branchRootId}" does not exist`);
    }
    if (branchRoot.parentId !== this.rootId) {
      throw new Error(
        `Node "${branchRootId}" is not a branch root (not a direct child of root)`
      );
    }

    // Idempotency: branch is already deactivated (no children in memory, not active)
    if (branchRoot.childIds.length === 0 && this.activeBranchId !== branchRootId) {
      return;
    }

    // Collect all descendants for saving
    const descendants = this.getDescendants(branchRootId);
    const storedNodes: StoredNode[] = descendants.map((node) => ({
      id: node.id,
      url: node.url,
      title: node.title,
      favicon: node.favicon,
      parentId: node.parentId,
      childIds: [...node.childIds],
      createdAt: node.createdAt,
      lastVisitedAt: node.lastVisitedAt,
      descendantCount: node.descendantCount,
      branchRootId,
    }));

    // Save to storage
    await storage.saveBranch(branchRootId, storedNodes);

    // Move focus to branch root if focused node is a descendant
    if (this.focusedNodeId !== branchRootId) {
      const focusedBranch = this.getBranchRootId(this.focusedNodeId);
      if (focusedBranch === branchRootId) {
        this.focusedNodeId = branchRootId;
        this.#probe?.nodeFocused(branchRootId);
      }
    }

    // Remove descendant nodes from memory (keep branch root)
    const descendantIds = descendants
      .filter((n) => n.id !== branchRootId)
      .map((n) => n.id);
    for (const id of descendantIds) {
      this.nodes.delete(id);
    }

    // Update root's descendantCount
    const root = this.nodes.get(this.rootId)!;
    root.descendantCount -= descendantIds.length;

    // Clear branch root's childIds but preserve descendantCount for summary
    branchRoot.childIds = [];

    // Clear active branch if this was it
    if (this.activeBranchId === branchRootId) {
      this.activeBranchId = null;
    }

    this.#probe?.branchDeactivated(branchRootId);
  }

  async switchBranch(
    newBranchRootId: string,
    storage: TreeStoragePort
  ): Promise<void> {
    // Deactivate current branch if one is active
    // In-memory screenshots are freed when deactivateBranch removes nodes.
    // Persistent screenshots are retained per S4.2 eviction policy.
    if (this.activeBranchId !== null) {
      await this.deactivateBranch(this.activeBranchId, storage);
    }

    // Activate new branch
    await this.activateBranch(newBranchRootId, storage);
  }

  async loadSummaries(storage: TreeStoragePort): Promise<void> {
    const summaries = await storage.getBranchSummaries();
    const root = this.nodes.get(this.rootId)!;

    let loaded = 0;
    for (const summary of summaries) {
      // Skip summaries already in tree (e.g. active branch restored from SessionStore)
      if (this.nodes.has(summary.id)) {
        continue;
      }
      const node: TreeNode = {
        id: summary.id,
        url: summary.url,
        title: summary.title,
        favicon: summary.favicon,
        screenshot: null,
        parentId: this.rootId,
        childIds: [],
        status: 'culled',
        createdAt: summary.createdAt,
        lastVisitedAt: summary.lastVisitedAt,
        descendantCount: summary.descendantCount,
      };
      this.nodes.set(node.id, node);
      root.childIds.push(node.id);
      loaded++;
    }

    root.descendantCount += loaded;
  }

  #incrementAncestorCounts(nodeId: string): void {
    let current = this.nodes.get(nodeId);
    while (current) {
      current.descendantCount++;
      current = current.parentId ? this.nodes.get(current.parentId) : undefined;
    }
  }

  #decrementAncestorCounts(nodeId: string, count: number): void {
    let current = this.nodes.get(nodeId);
    while (current) {
      current.descendantCount -= count;
      current = current.parentId ? this.nodes.get(current.parentId) : undefined;
    }
  }

  #checkTreeSize(): void {
    const count = this.nodes.size;
    if (!this.#suggestionFired && count > 200) {
      this.#suggestionFired = true;
      this.#probe?.treeSizeSuggestion(count);
    }
    if (!this.#warningFired && count > 100) {
      this.#warningFired = true;
      this.#probe?.treeSizeWarning(count);
    }
  }
}
