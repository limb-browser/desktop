// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Browser chrome adapter that wires BranchFolder and FoldedTreeLayout
 * to LimbTreeView for branch folding at the root level.
 *
 * When the tree has branches older than 7 days, they are grouped by month
 * into fold nodes. Clicking a fold node expands it to show individual
 * branches. The folding is purely visual — the in-memory tree is unchanged.
 *
 * See spec unified-tree.md S4.
 */

import { BranchFolder } from "./BranchFolder.ts";
import { computeFoldedLayout, buildFoldedParentMap } from "./FoldedTreeLayout.ts";

export class BranchFoldAdapter {
  /** @type {import('./BranchFolder.ts').BranchFolder} */
  #branchFolder;
  /** @type {import('./LimbTreeView.mjs').LimbTreeView} */
  #treeView;
  /** @type {import('./BrowsingTree.ts').BrowsingTree} */
  #tree;

  /**
   * @param {import('./BrowsingTree.ts').BrowsingTree} tree
   * @param {import('./LimbTreeView.mjs').LimbTreeView} treeView
   * @param {import('../ports/BranchFoldProbe.ts').BranchFoldProbe} [probe]
   */
  constructor(tree, treeView, probe) {
    this.#branchFolder = new BranchFolder(probe);
    this.#treeView = treeView;
    this.#tree = tree;
  }

  /**
   * Compute fold state and update the tree view with folded layout.
   *
   * Reads branch metadata from the tree, groups older branches into
   * fold nodes, computes layout positions, and updates the view.
   */
  updateLayout() {
    const root = this.#tree.nodes.get(this.#tree.rootId);
    if (!root) return;

    const branches = root.childIds
      .map(id => this.#tree.nodes.get(id))
      .filter(Boolean)
      .map(node => ({ id: node.id, lastVisitedAt: node.lastVisitedAt }));

    const foldResult = this.#branchFolder.computeFolds(branches, Date.now());
    const foldNodeIds = new Set(foldResult.foldNodes.keys());
    const positions = computeFoldedLayout(
      this.#tree,
      foldResult.visibleChildIds,
      foldNodeIds,
    );
    const parentMap = buildFoldedParentMap(
      this.#tree,
      foldResult.visibleChildIds,
      foldNodeIds,
    );

    // Compute tree extent from positions
    let maxX = 0;
    let maxY = 0;
    for (const pos of positions.values()) {
      if (pos.x > maxX) maxX = pos.x;
      if (pos.y > maxY) maxY = pos.y;
    }
    const treeExtent = { width: maxX + 2, height: maxY + 2 };

    // Build titles map for visible nodes
    const titles = new Map();
    for (const [nodeId] of positions) {
      const node = this.#tree.nodes.get(nodeId);
      if (node) {
        titles.set(nodeId, node.title || node.url);
      }
    }

    this.#treeView.setFoldNodes(foldResult.foldNodes);
    this.#treeView.setTreeData(
      positions,
      parentMap,
      treeExtent,
      this.#tree.focusedNodeId,
      titles,
    );
  }

  /**
   * Handle a fold toggle event from the view.
   * Toggles the fold state and recomputes the layout.
   *
   * @param {string} foldId
   */
  handleFoldToggle(foldId) {
    this.#branchFolder.toggleFold(foldId);
    this.updateLayout();
  }
}
