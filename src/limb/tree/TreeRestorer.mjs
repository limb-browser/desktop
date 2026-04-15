// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { BrowsingTree } from './BrowsingTree.mjs';

export class TreeRestorer {
  #probe;

  constructor(probe) {
    this.#probe = probe ?? null;
  }

  restore(tabsData) {
    const now = Date.now();
    const { processed, synthesizedIds } = this.#processTabData(tabsData, now);

    // Prefer a tab with an original nodeId as root (not a synthesized pre-Limb tab)
    let rootData = processed.find(t => t.parentId === null && !synthesizedIds.has(t.nodeId))
      ?? processed.find(t => t.parentId === null);
    if (!rootData) {
      rootData = {
        nodeId: crypto.randomUUID(),
        parentId: null,
        createdAt: now,
        url: 'about:limb-home',
        title: '',
        favicon: null,
      };
      processed.unshift(rootData);
    }

    const tree = new BrowsingTree(rootData.url);
    tree.nodes.clear();
    tree.rootId = rootData.nodeId;
    tree.focusedNodeId = rootData.nodeId;

    const nodeIdSet = new Set(processed.map(t => t.nodeId));

    for (const tab of processed) {
      let parentId = tab.parentId;

      if (parentId !== null && !nodeIdSet.has(parentId)) {
        parentId = rootData.nodeId;
        if (tab.nodeId !== rootData.nodeId) {
          this.#probe?.orphanedNodeReparented(tab.nodeId);
        }
      }

      if (tab.nodeId !== rootData.nodeId && parentId === null) {
        parentId = rootData.nodeId;
      }

      const node = {
        id: tab.nodeId,
        url: tab.url,
        title: tab.title,
        favicon: tab.favicon,
        screenshot: null,
        parentId: tab.nodeId === rootData.nodeId ? null : parentId,
        childIds: [],
        status: 'culled',
        createdAt: tab.createdAt,
        lastVisitedAt: tab.createdAt,
        descendantCount: 0,
      };
      tree.nodes.set(tab.nodeId, node);
    }

    for (const [, node] of tree.nodes) {
      if (node.parentId !== null) {
        const parent = tree.nodes.get(node.parentId);
        if (parent) {
          parent.childIds.push(node.id);
        }
      }
    }

    // Compute descendantCount for each node bottom-up
    this.#computeDescendantCounts(tree);

    this.#probe?.treeRestored(tree.nodes.size);
    return tree;
  }

  #computeDescendantCounts(tree) {
    const computeCount = (nodeId) => {
      const node = tree.nodes.get(nodeId);
      if (!node) return 0;
      let count = 0;
      for (const childId of node.childIds) {
        count += 1 + computeCount(childId);
      }
      node.descendantCount = count;
      return count;
    };
    computeCount(tree.rootId);
  }

  #processTabData(
    tabsData,
    now
  ) {
    const synthesizedIds = new Set();
    const processed = tabsData.map(tab => {
      if (tab.nodeId === null) {
        const newId = crypto.randomUUID();
        synthesizedIds.add(newId);
        this.#probe?.preLimbTabAdopted(newId);
        return {
          nodeId: newId,
          parentId: null,
          createdAt: tab.createdAt ?? now,
          url: tab.url,
          title: tab.title,
          favicon: tab.favicon,
        };
      }
      return {
        nodeId: tab.nodeId,
        parentId: tab.parentId,
        createdAt: tab.createdAt ?? now,
        url: tab.url,
        title: tab.title,
        favicon: tab.favicon,
      };
    });
    return { processed, synthesizedIds };
  }
}
