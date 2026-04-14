// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach } from 'vitest';
import { BrowsingTree } from './BrowsingTree';
import { TabBridge } from './TabBridge';
import type { BrowserTab, BrowserTabPort } from '../ports/BrowserTabPort';
import type { TabBridgeProbe } from '../ports/TabBridgeProbe';

class FakeBrowserTab {
  url: string;
  #attributes = new Map<string, string>();

  constructor(url: string) {
    this.url = url;
  }

  getAttribute(name: string): string | null {
    return this.#attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.#attributes.set(name, value);
  }
}

class FakeBrowserTabPort implements BrowserTabPort {
  openTabs: FakeBrowserTab[] = [];
  closedTabs: FakeBrowserTab[] = [];

  addTab(url: string): FakeBrowserTab {
    const tab = new FakeBrowserTab(url);
    this.openTabs.push(tab);
    return tab;
  }

  removeTab(tab: BrowserTab): void {
    const index = this.openTabs.indexOf(tab as FakeBrowserTab);
    if (index !== -1) {
      this.openTabs.splice(index, 1);
      this.closedTabs.push(tab as FakeBrowserTab);
    }
  }

  setTabAttribute(tab: BrowserTab, name: string, value: string): void {
    (tab as FakeBrowserTab).setAttribute(name, value);
  }

  getTabAttribute(tab: BrowserTab, name: string): string | null {
    return (tab as FakeBrowserTab).getAttribute(name);
  }
}

function createFakeProbe(): TabBridgeProbe & {
  calls: { method: string; args: unknown[] }[];
} {
  const calls: { method: string; args: unknown[] }[] = [];
  return {
    calls,
    tabCreated(nodeId: string, url: string) {
      calls.push({ method: 'tabCreated', args: [nodeId, url] });
    },
    tabClosed(nodeId: string) {
      calls.push({ method: 'tabClosed', args: [nodeId] });
    },
  };
}

describe('TabBridge', () => {
  let port: FakeBrowserTabPort;
  let probe: ReturnType<typeof createFakeProbe>;
  let bridge: TabBridge;
  let tree: BrowsingTree;

  beforeEach(() => {
    port = new FakeBrowserTabPort();
    probe = createFakeProbe();
    bridge = new TabBridge(port, probe);
    tree = new BrowsingTree('https://example.com', bridge);
    bridge.attach(tree);
  });

  describe('attach', () => {
    it('creates a tab for the root node on attach', () => {
      expect(port.openTabs).toHaveLength(1);
      const rootTab = bridge.getTabForNode(tree.rootId);
      expect(rootTab).toBeDefined();
    });

    it('sets limb-node-id on the root tab', () => {
      const rootTab = bridge.getTabForNode(tree.rootId)!;
      expect(port.getTabAttribute(rootTab, 'limb-node-id')).toBe(tree.rootId);
    });

    it('fires tabCreated probe for root node', () => {
      const rootCalls = probe.calls.filter((c) => c.method === 'tabCreated');
      expect(rootCalls).toHaveLength(1);
      expect(rootCalls[0].args[0]).toBe(tree.rootId);
      expect(rootCalls[0].args[1]).toBe('https://example.com');
    });
  });

  describe('tab creation on addChild', () => {
    it('creates a tab when a child node is added', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      expect(port.openTabs).toHaveLength(2);
      expect(bridge.getTabForNode(child.id)).toBeDefined();
    });

    it('sets limb-node-id attribute on the new tab', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      const tab = bridge.getTabForNode(child.id)!;
      expect(port.getTabAttribute(tab, 'limb-node-id')).toBe(child.id);
    });

    it('opens the tab with the correct URL', () => {
      tree.addChild(tree.rootId, 'https://child.com');
      const childTab = port.openTabs[1] as FakeBrowserTab;
      expect(childTab.url).toBe('https://child.com');
    });

    it('fires tabCreated probe for the new node', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      const createCalls = probe.calls.filter(
        (c) => c.method === 'tabCreated' && c.args[0] === child.id,
      );
      expect(createCalls).toHaveLength(1);
      expect(createCalls[0].args[1]).toBe('https://child.com');
    });

    it('creates tabs for deeply nested children', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      const grandchild = tree.addChild(child.id, 'https://grandchild.com');
      expect(port.openTabs).toHaveLength(3);
      expect(bridge.getTabForNode(grandchild.id)).toBeDefined();
    });
  });

  describe('tab closure on removeNode', () => {
    it('closes the tab when a leaf node is removed', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      const tab = bridge.getTabForNode(child.id);
      tree.removeNode(child.id);
      expect(port.openTabs).toHaveLength(1);
      expect(port.closedTabs).toContain(tab);
    });

    it('removes the node-tab association after closure', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      tree.removeNode(child.id);
      expect(bridge.getTabForNode(child.id)).toBeUndefined();
    });

    it('closes tabs for all descendants when a subtree is removed', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      const grandchild = tree.addChild(child.id, 'https://grandchild.com');
      const childTab = bridge.getTabForNode(child.id);
      const grandchildTab = bridge.getTabForNode(grandchild.id);

      tree.removeNode(child.id);

      expect(port.closedTabs).toContain(childTab);
      expect(port.closedTabs).toContain(grandchildTab);
      expect(port.openTabs).toHaveLength(1); // only root tab
    });

    it('fires tabClosed probe for the removed node', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      tree.removeNode(child.id);
      const closeCalls = probe.calls.filter(
        (c) => c.method === 'tabClosed' && c.args[0] === child.id,
      );
      expect(closeCalls).toHaveLength(1);
    });

    it('fires tabClosed probe for each descendant', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      const grandchild = tree.addChild(child.id, 'https://grandchild.com');
      tree.removeNode(child.id);

      const closeCalls = probe.calls.filter((c) => c.method === 'tabClosed');
      const closedIds = closeCalls.map((c) => c.args[0]);
      expect(closedIds).toContain(child.id);
      expect(closedIds).toContain(grandchild.id);
    });
  });

  describe('getTabForNode', () => {
    it('returns the tab for a known node', () => {
      const tab = bridge.getTabForNode(tree.rootId);
      expect(tab).toBeDefined();
    });

    it('returns undefined for an unknown node ID', () => {
      expect(bridge.getTabForNode('nonexistent')).toBeUndefined();
    });
  });

  describe('getNodeForTab', () => {
    it('returns the node ID for a known tab', () => {
      const tab = bridge.getTabForNode(tree.rootId)!;
      expect(bridge.getNodeForTab(tab)).toBe(tree.rootId);
    });

    it('returns undefined for an unknown tab', () => {
      const unknownTab = new FakeBrowserTab('https://unknown.com');
      expect(bridge.getNodeForTab(unknownTab)).toBeUndefined();
    });
  });

  describe('no orphan tabs invariant', () => {
    it('every open tab has a corresponding node after additions', () => {
      tree.addChild(tree.rootId, 'https://a.com');
      tree.addChild(tree.rootId, 'https://b.com');

      for (const tab of port.openTabs) {
        const nodeId = bridge.getNodeForTab(tab);
        expect(nodeId).toBeDefined();
        expect(tree.nodes.has(nodeId!)).toBe(true);
      }
    });

    it('every open tab has a corresponding node after removals', () => {
      const child = tree.addChild(tree.rootId, 'https://a.com');
      tree.addChild(tree.rootId, 'https://b.com');
      tree.removeNode(child.id);

      for (const tab of port.openTabs) {
        const nodeId = bridge.getNodeForTab(tab);
        expect(nodeId).toBeDefined();
        expect(tree.nodes.has(nodeId!)).toBe(true);
      }
    });

    it('every node with a tab has a corresponding open tab after removals', () => {
      const a = tree.addChild(tree.rootId, 'https://a.com');
      tree.addChild(a.id, 'https://b.com');
      tree.removeNode(a.id);

      // Only root should remain
      for (const [nodeId] of tree.nodes) {
        const tab = bridge.getTabForNode(nodeId);
        if (tab) {
          expect(port.openTabs).toContain(tab);
        }
      }
    });
  });

  describe('without probe', () => {
    it('works correctly when no probe is provided', () => {
      const portNp = new FakeBrowserTabPort();
      const bridgeNp = new TabBridge(portNp);
      const treeNp = new BrowsingTree('https://example.com', bridgeNp);
      bridgeNp.attach(treeNp);

      const child = treeNp.addChild(treeNp.rootId, 'https://child.com');
      expect(portNp.openTabs).toHaveLength(2);

      treeNp.removeNode(child.id);
      expect(portNp.openTabs).toHaveLength(1);
    });
  });
});
