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
  #syncing = false;

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

  registerExistingTab(tab: TTab, nodeId: string): void {
    if (this.nodeToTab.has(nodeId)) {
      throw new Error(`Node "${nodeId}" already has a tab`);
    }
    this.nodeToTab.set(nodeId, tab);
    this.tabToNode.set(tab, nodeId);
    this.#probe?.tabCreated(nodeId);
  }

  getTabForNode(nodeId: string): TTab | undefined {
    return this.nodeToTab.get(nodeId);
  }

  getNodeForTab(tab: TTab): string | undefined {
    return this.tabToNode.get(tab);
  }

  async syncFocusToTab(nodeId: string, nodeUrl: string): Promise<void> {
    if (this.#syncing) return;
    this.#syncing = true;
    try {
      let tab = this.nodeToTab.get(nodeId);
      if (!tab) {
        tab = await this.#tabPort.openTab(nodeUrl, nodeId);
        this.nodeToTab.set(nodeId, tab);
        this.tabToNode.set(tab, nodeId);
        this.#probe?.tabCreated(nodeId);
      } else if (await this.#tabPort.isTabSuspended(tab)) {
        await this.#tabPort.restoreTab(tab);
      }
      await this.#tabPort.selectTab(tab);
      this.#probe?.focusSynced(nodeId);
    } finally {
      this.#syncing = false;
    }
  }

  onExternalTabSelected(
    tab: TTab,
    focusNode: (nodeId: string) => void
  ): void {
    if (this.#syncing) return;
    this.#syncing = true;
    try {
      const nodeId = this.tabToNode.get(tab);
      if (nodeId) {
        focusNode(nodeId);
        this.#probe?.focusSynced(nodeId);
      }
    } finally {
      this.#syncing = false;
    }
  }

  onTabLocationChanged(
    tab: TTab,
    newUrl: string,
    updateNode: (nodeId: string) => void
  ): void {
    const nodeId = this.tabToNode.get(tab);
    if (!nodeId) return;
    updateNode(nodeId);
    this.#probe?.locationChanged(nodeId, newUrl);
  }

  onTabTitleChanged(
    tab: TTab,
    newTitle: string,
    updateNode: (nodeId: string) => void
  ): void {
    const nodeId = this.tabToNode.get(tab);
    if (!nodeId) return;
    updateNode(nodeId);
    this.#probe?.titleChanged(nodeId, newTitle);
  }

  onTabFaviconChanged(
    tab: TTab,
    newFavicon: string | null,
    updateNode: (nodeId: string) => void
  ): void {
    const nodeId = this.tabToNode.get(tab);
    if (!nodeId) return;
    updateNode(nodeId);
    this.#probe?.faviconChanged(nodeId, newFavicon);
  }

  async closeOrphanTab(tab: TTab): Promise<void> {
    if (this.tabToNode.has(tab)) {
      return;
    }
    await this.#tabPort.closeTab(tab);
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
