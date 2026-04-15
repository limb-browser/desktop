// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach } from 'vitest';
import { TabCommandRouter } from './TabCommandRouter';
import { BrowsingTree } from './BrowsingTree';
import { TabBridge } from './TabBridge';
import { InMemoryTabPort } from './InMemoryTabPort';
import type { FakeTab } from './InMemoryTabPort';
import type { TabCommandRouterProbe } from '../ports/TabCommandRouterProbe';
import * as fs from 'node:fs';
import * as path from 'node:path';

function createFakeProbe(): TabCommandRouterProbe & {
  calls: { method: string; args: unknown[] }[];
} {
  const calls: { method: string; args: unknown[] }[] = [];
  return {
    calls,
    newTabRouted(parentId: string, childId: string) {
      calls.push({ method: 'newTabRouted', args: [parentId, childId] });
    },
    closeTabRouted(nodeId: string) {
      calls.push({ method: 'closeTabRouted', args: [nodeId] });
    },
    orphanTabBlocked() {
      calls.push({ method: 'orphanTabBlocked', args: [] });
    },
    linkIntercepted(parentId: string, childId: string) {
      calls.push({ method: 'linkIntercepted', args: [parentId, childId] });
    },
  };
}

describe('TabCommandRouter', () => {
  let tree: BrowsingTree;
  let tabPort: InMemoryTabPort;
  let bridge: TabBridge<FakeTab>;
  let probe: ReturnType<typeof createFakeProbe>;
  let router: TabCommandRouter<FakeTab>;
  const homepage = 'https://home.example.com';

  beforeEach(async () => {
    tree = new BrowsingTree('https://root.example.com');
    tabPort = new InMemoryTabPort();
    bridge = new TabBridge(tabPort);
    probe = createFakeProbe();
    router = new TabCommandRouter(tree, bridge, homepage, probe);

    // Create a tab for the root node (simulating browser startup)
    const root = tree.nodes.get(tree.rootId)!;
    await bridge.createTabForNode({ id: root.id, url: root.url });
  });

  describe('handleNewTab', () => {
    it('creates a child node of the focused node', async () => {
      const nodeCountBefore = tree.nodes.size;
      await router.handleNewTab();
      expect(tree.nodes.size).toBe(nodeCountBefore + 1);
    });

    it('new child has the focused node as parent', async () => {
      const parentId = tree.focusedNodeId;
      await router.handleNewTab();
      // The focused node is now the child
      const child = tree.nodes.get(tree.focusedNodeId)!;
      expect(child.parentId).toBe(parentId);
    });

    it('uses the homepage URL for new nodes', async () => {
      await router.handleNewTab();
      const child = tree.nodes.get(tree.focusedNodeId)!;
      expect(child.url).toBe(homepage);
    });

    it('creates a tab for the new child via TabBridge', async () => {
      await router.handleNewTab();
      const childId = tree.focusedNodeId;
      expect(bridge.getTabForNode(childId)).toBeDefined();
    });

    it('focuses the new child node in the tree', async () => {
      const rootId = tree.focusedNodeId;
      await router.handleNewTab();
      expect(tree.focusedNodeId).not.toBe(rootId);
    });

    it('syncs focus to the new tab', async () => {
      await router.handleNewTab();
      const childId = tree.focusedNodeId;
      const tab = bridge.getTabForNode(childId)!;
      expect(tabPort.selectedTab).toBe(tab);
    });

    it('fires newTabRouted probe', async () => {
      const parentId = tree.focusedNodeId;
      await router.handleNewTab();
      const childId = tree.focusedNodeId;
      expect(probe.calls).toContainEqual({
        method: 'newTabRouted',
        args: [parentId, childId],
      });
    });

    it('creates nested children when called multiple times', async () => {
      await router.handleNewTab();
      const firstChildId = tree.focusedNodeId;
      await router.handleNewTab();
      const secondChildId = tree.focusedNodeId;
      const secondChild = tree.nodes.get(secondChildId)!;
      expect(secondChild.parentId).toBe(firstChildId);
    });
  });

  describe('handleCloseTab', () => {
    it('removes the focused node from the tree', async () => {
      await router.handleNewTab();
      const childId = tree.focusedNodeId;
      await router.handleCloseTab();
      expect(tree.nodes.has(childId)).toBe(false);
    });

    it('closes the tab for the removed node', async () => {
      await router.handleNewTab();
      const childId = tree.focusedNodeId;
      const tab = bridge.getTabForNode(childId)!;
      await router.handleCloseTab();
      expect(tab.closed).toBe(true);
      expect(bridge.getTabForNode(childId)).toBeUndefined();
    });

    it('moves focus to the parent node', async () => {
      const rootId = tree.focusedNodeId;
      await router.handleNewTab();
      await router.handleCloseTab();
      expect(tree.focusedNodeId).toBe(rootId);
    });

    it('syncs focus to the parent tab', async () => {
      await router.handleNewTab();
      await router.handleCloseTab();
      const rootTab = bridge.getTabForNode(tree.rootId)!;
      expect(tabPort.selectedTab).toBe(rootTab);
    });

    it('fires closeTabRouted probe', async () => {
      await router.handleNewTab();
      const childId = tree.focusedNodeId;
      probe.calls.length = 0;
      await router.handleCloseTab();
      expect(probe.calls).toContainEqual({
        method: 'closeTabRouted',
        args: [childId],
      });
    });

    it('is a no-op when focused node is root', async () => {
      const nodeCountBefore = tree.nodes.size;
      await router.handleCloseTab();
      expect(tree.nodes.size).toBe(nodeCountBefore);
      expect(tree.focusedNodeId).toBe(tree.rootId);
    });

    it('does not fire closeTabRouted probe when focused node is root', async () => {
      probe.calls.length = 0;
      await router.handleCloseTab();
      const closeCalls = probe.calls.filter(
        (c) => c.method === 'closeTabRouted'
      );
      expect(closeCalls).toHaveLength(0);
    });

    it('closes tabs for descendant nodes', async () => {
      await router.handleNewTab(); // child of root
      const childId = tree.focusedNodeId;
      await router.handleNewTab(); // grandchild of root
      const grandchildId = tree.focusedNodeId;

      // Focus back to child, then close it (removing child + grandchild)
      tree.focusNode(childId);
      await router.handleCloseTab();

      expect(bridge.getTabForNode(childId)).toBeUndefined();
      expect(bridge.getTabForNode(grandchildId)).toBeUndefined();
    });
  });

  describe('handleExternalTabOpen', () => {
    it('closes tabs that have no node association and no opener', async () => {
      const orphanTab: FakeTab = {
        url: 'https://orphan.com',
        nodeId: '',
        closed: false,
        suspended: false,
      };
      tabPort.tabs.push(orphanTab);

      await router.handleExternalTabOpen(orphanTab, 'https://orphan.com', null);
      expect(orphanTab.closed).toBe(true);
    });

    it('fires orphanTabBlocked probe when no opener', async () => {
      const orphanTab: FakeTab = {
        url: 'https://orphan.com',
        nodeId: '',
        closed: false,
        suspended: false,
      };
      tabPort.tabs.push(orphanTab);

      probe.calls.length = 0;
      await router.handleExternalTabOpen(orphanTab, 'https://orphan.com', null);
      expect(probe.calls).toContainEqual({
        method: 'orphanTabBlocked',
        args: [],
      });
    });

    it('does nothing for tabs that have a node', async () => {
      const rootTab = bridge.getTabForNode(tree.rootId)!;
      probe.calls.length = 0;
      await router.handleExternalTabOpen(rootTab, 'https://root.example.com', null);
      expect(rootTab.closed).toBe(false);
      const blockCalls = probe.calls.filter(
        (c) => c.method === 'orphanTabBlocked'
      );
      expect(blockCalls).toHaveLength(0);
    });

    it('closes tabs when opener is not in the tree', async () => {
      const orphanTab: FakeTab = {
        url: 'https://orphan.com',
        nodeId: '',
        closed: false,
        suspended: false,
      };
      tabPort.tabs.push(orphanTab);
      const unknownOpener: FakeTab = {
        url: 'https://unknown.com',
        nodeId: '',
        closed: false,
        suspended: false,
      };

      await router.handleExternalTabOpen(orphanTab, 'https://orphan.com', unknownOpener);
      expect(orphanTab.closed).toBe(true);
    });
  });

  describe('link interception', () => {
    it('creates a child node when a tab opens with an opener in the tree', async () => {
      const rootTab = bridge.getTabForNode(tree.rootId)!;
      const newTab: FakeTab = {
        url: 'https://link.example.com',
        nodeId: '',
        closed: false,
        suspended: false,
      };
      tabPort.tabs.push(newTab);

      const nodeCountBefore = tree.nodes.size;
      await router.handleExternalTabOpen(newTab, 'https://link.example.com', rootTab);
      expect(tree.nodes.size).toBe(nodeCountBefore + 1);
    });

    it('new child has the opener node as parent', async () => {
      const rootTab = bridge.getTabForNode(tree.rootId)!;
      const newTab: FakeTab = {
        url: 'https://link.example.com',
        nodeId: '',
        closed: false,
        suspended: false,
      };
      tabPort.tabs.push(newTab);

      await router.handleExternalTabOpen(newTab, 'https://link.example.com', rootTab);
      const child = tree.nodes.get(tree.focusedNodeId)!;
      expect(child.parentId).toBe(tree.rootId);
    });

    it('uses the new tab URL for the child node', async () => {
      const rootTab = bridge.getTabForNode(tree.rootId)!;
      const newTab: FakeTab = {
        url: 'https://specific-page.example.com/article',
        nodeId: '',
        closed: false,
        suspended: false,
      };
      tabPort.tabs.push(newTab);

      await router.handleExternalTabOpen(newTab, 'https://specific-page.example.com/article', rootTab);
      const child = tree.nodes.get(tree.focusedNodeId)!;
      expect(child.url).toBe('https://specific-page.example.com/article');
    });

    it('registers the existing tab with the child node via TabBridge', async () => {
      const rootTab = bridge.getTabForNode(tree.rootId)!;
      const newTab: FakeTab = {
        url: 'https://link.example.com',
        nodeId: '',
        closed: false,
        suspended: false,
      };
      tabPort.tabs.push(newTab);

      await router.handleExternalTabOpen(newTab, 'https://link.example.com', rootTab);
      const childId = tree.focusedNodeId;
      expect(bridge.getTabForNode(childId)).toBe(newTab);
      expect(bridge.getNodeForTab(newTab)).toBe(childId);
    });

    it('focuses the new child node', async () => {
      const rootTab = bridge.getTabForNode(tree.rootId)!;
      const newTab: FakeTab = {
        url: 'https://link.example.com',
        nodeId: '',
        closed: false,
        suspended: false,
      };
      tabPort.tabs.push(newTab);

      await router.handleExternalTabOpen(newTab, 'https://link.example.com', rootTab);
      expect(tree.focusedNodeId).not.toBe(tree.rootId);
      const child = tree.nodes.get(tree.focusedNodeId)!;
      expect(child.url).toBe('https://link.example.com');
    });

    it('syncs focus to the new tab', async () => {
      const rootTab = bridge.getTabForNode(tree.rootId)!;
      const newTab: FakeTab = {
        url: 'https://link.example.com',
        nodeId: '',
        closed: false,
        suspended: false,
      };
      tabPort.tabs.push(newTab);

      await router.handleExternalTabOpen(newTab, 'https://link.example.com', rootTab);
      expect(tabPort.selectedTab).toBe(newTab);
    });

    it('fires linkIntercepted probe', async () => {
      const rootTab = bridge.getTabForNode(tree.rootId)!;
      const newTab: FakeTab = {
        url: 'https://link.example.com',
        nodeId: '',
        closed: false,
        suspended: false,
      };
      tabPort.tabs.push(newTab);

      probe.calls.length = 0;
      await router.handleExternalTabOpen(newTab, 'https://link.example.com', rootTab);
      const childId = tree.focusedNodeId;
      expect(probe.calls).toContainEqual({
        method: 'linkIntercepted',
        args: [tree.rootId, childId],
      });
    });

    it('does not fire orphanTabBlocked for intercepted links', async () => {
      const rootTab = bridge.getTabForNode(tree.rootId)!;
      const newTab: FakeTab = {
        url: 'https://link.example.com',
        nodeId: '',
        closed: false,
        suspended: false,
      };
      tabPort.tabs.push(newTab);

      probe.calls.length = 0;
      await router.handleExternalTabOpen(newTab, 'https://link.example.com', rootTab);
      const blockCalls = probe.calls.filter(
        (c) => c.method === 'orphanTabBlocked'
      );
      expect(blockCalls).toHaveLength(0);
    });

    it('window.open creates a child node the same as link clicks', async () => {
      const rootTab = bridge.getTabForNode(tree.rootId)!;
      const windowOpenTab: FakeTab = {
        url: 'https://popup.example.com',
        nodeId: '',
        closed: false,
        suspended: false,
      };
      tabPort.tabs.push(windowOpenTab);

      await router.handleExternalTabOpen(windowOpenTab, 'https://popup.example.com', rootTab);
      const child = tree.nodes.get(tree.focusedNodeId)!;
      expect(child.parentId).toBe(tree.rootId);
      expect(child.url).toBe('https://popup.example.com');
      expect(bridge.getTabForNode(child.id)).toBe(windowOpenTab);
    });

    it('no orphan tabs exist after link interception', async () => {
      const rootTab = bridge.getTabForNode(tree.rootId)!;
      const newTab: FakeTab = {
        url: 'https://link.example.com',
        nodeId: '',
        closed: false,
        suspended: false,
      };
      tabPort.tabs.push(newTab);

      await router.handleExternalTabOpen(newTab, 'https://link.example.com', rootTab);
      for (const tab of tabPort.openTabs) {
        expect(bridge.getNodeForTab(tab)).toBeDefined();
      }
    });

    it('creates nested children for chained link opens', async () => {
      const rootTab = bridge.getTabForNode(tree.rootId)!;
      const firstTab: FakeTab = {
        url: 'https://first.example.com',
        nodeId: '',
        closed: false,
        suspended: false,
      };
      tabPort.tabs.push(firstTab);

      await router.handleExternalTabOpen(firstTab, 'https://first.example.com', rootTab);
      const firstChildId = tree.focusedNodeId;

      const secondTab: FakeTab = {
        url: 'https://second.example.com',
        nodeId: '',
        closed: false,
        suspended: false,
      };
      tabPort.tabs.push(secondTab);

      await router.handleExternalTabOpen(secondTab, 'https://second.example.com', firstTab);
      const secondChild = tree.nodes.get(tree.focusedNodeId)!;
      expect(secondChild.parentId).toBe(firstChildId);
    });

    it('skips tab created during handleNewTab', async () => {
      // Simulate the race: TabOpen fires during bridge.createTabForNode
      // before the tab-to-node mapping is established
      tabPort.onTabCreated = (tab) => {
        // This simulates the TabOpen handler firing synchronously
        router.handleExternalTabOpen(tab, homepage, bridge.getTabForNode(tree.rootId)!);
      };

      const nodeCountBefore = tree.nodes.size;
      await router.handleNewTab();
      // Should have exactly 1 new node (from handleNewTab), not 2
      expect(tree.nodes.size).toBe(nodeCountBefore + 1);
    });
  });

  describe('without probe', () => {
    it('works when no probe is provided', async () => {
      const noprobeRouter = new TabCommandRouter(tree, bridge, homepage);
      await noprobeRouter.handleNewTab();
      expect(tree.nodes.size).toBe(2);
      await noprobeRouter.handleCloseTab();
      expect(tree.nodes.size).toBe(1);
    });
  });
});

describe('tab bar CSS', () => {
  it('hides the Firefox tab bar', () => {
    const cssPath = path.resolve(__dirname, 'limb-hide-tabbar.css');
    const css = fs.readFileSync(cssPath, 'utf-8');
    expect(css).toContain('#tabbrowser-tabs');
    expect(css).toContain('display: none');
  });
});
