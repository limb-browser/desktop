// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import type { BrowsingTree } from './BrowsingTree';
import type { TabBridge } from './TabBridge';
import type { TabCommandRouterProbe } from '../ports/TabCommandRouterProbe';

export class TabCommandRouter<TTab> {
  #tree: BrowsingTree;
  #bridge: TabBridge<TTab>;
  #homepage: string;
  #probe: TabCommandRouterProbe | null;
  #creatingTab = false;

  constructor(
    tree: BrowsingTree,
    bridge: TabBridge<TTab>,
    homepage: string,
    probe?: TabCommandRouterProbe
  ) {
    this.#tree = tree;
    this.#bridge = bridge;
    this.#homepage = homepage;
    this.#probe = probe ?? null;
  }

  async handleNewTab(): Promise<void> {
    this.#creatingTab = true;
    try {
      const parentId = this.#tree.focusedNodeId;
      const child = this.#tree.addChild(parentId, this.#homepage);
      await this.#bridge.createTabForNode({ id: child.id, url: child.url, parentId: child.parentId, createdAt: child.createdAt });
      this.#tree.focusNode(child.id);
      await this.#bridge.syncFocusToTab(child.id, child.url, child.parentId, child.createdAt);
      this.#probe?.newTabRouted(parentId, child.id);
    } finally {
      this.#creatingTab = false;
    }
  }

  async handleCloseTab(): Promise<void> {
    const nodeId = this.#tree.focusedNodeId;
    if (nodeId === this.#tree.rootId) {
      return;
    }

    const descendants = this.#tree
      .getDescendants(nodeId)
      .filter((n) => n.id !== nodeId)
      .map((n) => n.id);

    this.#tree.removeNode(nodeId);
    await this.#bridge.onNodeRemoved(nodeId, descendants);

    const newFocused = this.#tree.nodes.get(this.#tree.focusedNodeId)!;
    await this.#bridge.syncFocusToTab(newFocused.id, newFocused.url, newFocused.parentId, newFocused.createdAt);
    this.#probe?.closeTabRouted(nodeId);
  }

  async handleExternalTabOpen(
    tab: TTab,
    url: string,
    openerTab: TTab | null
  ): Promise<void> {
    if (this.#creatingTab) {
      return;
    }
    if (this.#bridge.getNodeForTab(tab)) {
      return;
    }

    if (openerTab) {
      const openerNodeId = this.#bridge.getNodeForTab(openerTab);
      if (openerNodeId) {
        const child = this.#tree.addChild(openerNodeId, url);
        this.#bridge.registerExistingTab(tab, child.id, child.parentId, child.createdAt);
        this.#tree.focusNode(child.id);
        await this.#bridge.syncFocusToTab(child.id, url, child.parentId, child.createdAt);
        this.#probe?.linkIntercepted(openerNodeId, child.id);
        return;
      }
    }

    await this.#bridge.closeOrphanTab(tab);
    this.#probe?.orphanTabBlocked();
  }
}
