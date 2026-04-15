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
    const parentId = this.#tree.focusedNodeId;
    const child = this.#tree.addChild(parentId, this.#homepage);
    await this.#bridge.createTabForNode({ id: child.id, url: child.url });
    this.#tree.focusNode(child.id);
    await this.#bridge.syncFocusToTab(child.id, child.url);
    this.#probe?.newTabRouted(parentId, child.id);
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
    await this.#bridge.syncFocusToTab(newFocused.id, newFocused.url);
    this.#probe?.closeTabRouted(nodeId);
  }

  async handleExternalTabOpen(tab: TTab): Promise<void> {
    if (this.#bridge.getNodeForTab(tab)) {
      return;
    }
    await this.#bridge.closeOrphanTab(tab);
    this.#probe?.orphanTabBlocked();
  }
}
