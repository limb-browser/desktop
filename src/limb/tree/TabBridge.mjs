// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export class TabBridge {
  nodeToTab = new Map();
  tabToNode = new Map();
  #tabPort;
  #probe;
  #syncing = false;

  constructor(tabPort, probe) {
    this.#tabPort = tabPort;
    this.#probe = probe ?? null;
  }

  async createTabForNode(node) {
    if (this.nodeToTab.has(node.id)) {
      throw new Error(`Node "${node.id}" already has a tab`);
    }
    const tab = await this.#tabPort.openTab(node.url, node.id);
    if (node.parentId !== undefined && node.createdAt !== undefined) {
      this.#tabPort.setTreeAttributes(tab, node.parentId, node.createdAt);
    }
    this.nodeToTab.set(node.id, tab);
    this.tabToNode.set(tab, node.id);
    this.#probe?.tabCreated(node.id);
  }

  async closeTabForNode(nodeId) {
    const tab = this.nodeToTab.get(nodeId);
    if (!tab) {
      return;
    }
    await this.#tabPort.closeTab(tab);
    this.nodeToTab.delete(nodeId);
    this.tabToNode.delete(tab);
    this.#probe?.tabClosed(nodeId);
  }

  registerExistingTab(tab, nodeId, parentId, createdAt) {
    if (this.nodeToTab.has(nodeId)) {
      throw new Error(`Node "${nodeId}" already has a tab`);
    }
    if (this.tabToNode.has(tab)) {
      throw new Error(`Tab is already mapped to node "${this.tabToNode.get(tab)}"`);
    }
    if (parentId !== undefined && createdAt !== undefined) {
      this.#tabPort.setTreeAttributes(tab, parentId, createdAt);
    }
    this.nodeToTab.set(nodeId, tab);
    this.tabToNode.set(tab, nodeId);
    this.#probe?.tabCreated(nodeId);
  }

  getTabForNode(nodeId) {
    return this.nodeToTab.get(nodeId);
  }

  getNodeForTab(tab) {
    return this.tabToNode.get(tab);
  }

  async syncFocusToTab(nodeId, nodeUrl, parentId, createdAt) {
    if (this.#syncing) return;
    this.#syncing = true;
    try {
      let tab = this.nodeToTab.get(nodeId);
      if (!tab) {
        tab = await this.#tabPort.openTab(nodeUrl, nodeId);
        if (parentId !== undefined && createdAt !== undefined) {
          this.#tabPort.setTreeAttributes(tab, parentId, createdAt);
        }
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
    tab,
    focusNode
  ) {
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
    tab,
    newUrl,
    updateNode
  ) {
    const nodeId = this.tabToNode.get(tab);
    if (!nodeId) return;
    updateNode(nodeId);
    this.#probe?.locationChanged(nodeId, newUrl);
  }

  onTabTitleChanged(
    tab,
    newTitle,
    updateNode
  ) {
    const nodeId = this.tabToNode.get(tab);
    if (!nodeId) return;
    updateNode(nodeId);
    this.#probe?.titleChanged(nodeId, newTitle);
  }

  onTabFaviconChanged(
    tab,
    newFavicon,
    updateNode
  ) {
    const nodeId = this.tabToNode.get(tab);
    if (!nodeId) return;
    updateNode(nodeId);
    this.#probe?.faviconChanged(nodeId, newFavicon);
  }

  async closeOrphanTab(tab) {
    if (this.tabToNode.has(tab)) {
      return;
    }
    await this.#tabPort.closeTab(tab);
  }

  async onNodeRemoved(
    nodeId,
    descendantIds
  ) {
    await this.closeTabForNode(nodeId);
    for (const id of descendantIds) {
      await this.closeTabForNode(id);
    }
  }
}
