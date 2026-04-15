// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import type { TabPort } from '../ports/TabPort';
import type { TabBridgeProbe } from '../ports/TabBridgeProbe';

export class TabBridge<TTab> {
  readonly nodeToTab = new Map<string, TTab>();
  readonly tabToNode = new Map<TTab, string>();
  #tabPort: TabPort<TTab>;
  #probe: TabBridgeProbe | null;

  constructor(tabPort: TabPort<TTab>, probe?: TabBridgeProbe) {
    this.#tabPort = tabPort;
    this.#probe = probe ?? null;
  }

  async createTabForNode(node: { id: string; url: string }): Promise<void> {
    if (this.nodeToTab.has(node.id)) {
      throw new Error(`Node "${node.id}" already has a tab`);
    }
    const tab = await this.#tabPort.openTab(node.url, node.id);
    this.nodeToTab.set(node.id, tab);
    this.tabToNode.set(tab, node.id);
    this.#probe?.tabCreated(node.id);
  }

  async closeTabForNode(nodeId: string): Promise<void> {
    const tab = this.nodeToTab.get(nodeId);
    if (!tab) {
      return;
    }
    await this.#tabPort.closeTab(tab);
    this.nodeToTab.delete(nodeId);
    this.tabToNode.delete(tab);
    this.#probe?.tabClosed(nodeId);
  }

  getTabForNode(nodeId: string): TTab | undefined {
    return this.nodeToTab.get(nodeId);
  }

  getNodeForTab(tab: TTab): string | undefined {
    return this.tabToNode.get(tab);
  }

  async onNodeRemoved(
    nodeId: string,
    descendantIds: string[]
  ): Promise<void> {
    await this.closeTabForNode(nodeId);
    for (const id of descendantIds) {
      await this.closeTabForNode(id);
    }
  }
}
