// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import type { BrowsingTreeProbe } from '../ports/BrowsingTreeProbe';
import type { BrowserTab, BrowserTabPort } from '../ports/BrowserTabPort';
import type { TabBridgeProbe } from '../ports/TabBridgeProbe';
import type { BrowsingTree } from './BrowsingTree';

export class TabBridge implements BrowsingTreeProbe {
  #port: BrowserTabPort;
  #probe: TabBridgeProbe | null;
  #tree: BrowsingTree | null = null;
  #nodeToTab = new Map<string, BrowserTab>();
  #tabToNode = new Map<BrowserTab, string>();

  constructor(port: BrowserTabPort, probe?: TabBridgeProbe) {
    this.#port = port;
    this.#probe = probe ?? null;
  }

  attach(tree: BrowsingTree): void {
    this.#tree = tree;
    const root = tree.nodes.get(tree.rootId);
    if (root) {
      this.createTabForNode(root);
    }
  }

  createTabForNode(node: { id: string; url: string }): void {
    const tab = this.#port.addTab(node.url);
    this.#port.setTabAttribute(tab, 'limb-node-id', node.id);
    this.#nodeToTab.set(node.id, tab);
    this.#tabToNode.set(tab, node.id);
    this.#probe?.tabCreated(node.id, node.url);
  }

  closeTabForNode(nodeId: string): void {
    const tab = this.#nodeToTab.get(nodeId);
    if (tab) {
      this.#port.removeTab(tab);
      this.#nodeToTab.delete(nodeId);
      this.#tabToNode.delete(tab);
      this.#probe?.tabClosed(nodeId);
    }
  }

  getTabForNode(nodeId: string): BrowserTab | undefined {
    return this.#nodeToTab.get(nodeId);
  }

  getNodeForTab(tab: BrowserTab): string | undefined {
    return this.#tabToNode.get(tab);
  }

  // BrowsingTreeProbe implementation

  childAdded(_parentId: string, childId: string): void {
    const node = this.#tree?.nodes.get(childId);
    if (node) {
      this.createTabForNode(node);
    }
  }

  nodeRemoved(nodeId: string, descendantIds: string[]): void {
    this.closeTabForNode(nodeId);
    for (const id of descendantIds) {
      this.closeTabForNode(id);
    }
  }

  nodeFocused(_nodeId: string): void {}
  treeSizeWarning(_nodeCount: number): void {}
  treeSizeSuggestion(_nodeCount: number): void {}
}
