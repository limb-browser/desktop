// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach } from 'vitest';
import { TabBridge } from './TabBridge';
import { InMemoryTabPort } from './InMemoryTabPort';
import type { FakeTab } from './InMemoryTabPort';
import type { TabBridgeProbe } from '../ports/TabBridgeProbe';
import { BrowsingTree } from './BrowsingTree';

function createFakeProbe(): TabBridgeProbe & {
  calls: { method: string; args: unknown[] }[];
} {
  const calls: { method: string; args: unknown[] }[] = [];
  return {
    calls,
    tabCreated(nodeId: string) {
      calls.push({ method: 'tabCreated', args: [nodeId] });
    },
    tabClosed(nodeId: string) {
      calls.push({ method: 'tabClosed', args: [nodeId] });
    },
    focusSynced(nodeId: string) {
      calls.push({ method: 'focusSynced', args: [nodeId] });
    },
  };
}

describe('TabBridge', () => {
  let tabPort: InMemoryTabPort;
  let probe: ReturnType<typeof createFakeProbe>;
  let bridge: TabBridge<FakeTab>;

  beforeEach(() => {
    tabPort = new InMemoryTabPort();
    probe = createFakeProbe();
    bridge = new TabBridge(tabPort, probe);
  });

  describe('createTabForNode', () => {
    it('opens a tab via the port', async () => {
      await bridge.createTabForNode({ id: 'node-1', url: 'https://example.com' });
      expect(tabPort.tabs).toHaveLength(1);
      expect(tabPort.tabs[0].url).toBe('https://example.com');
    });

    it('sets limb-node-id on the created tab', async () => {
      await bridge.createTabForNode({ id: 'node-1', url: 'https://example.com' });
      const tab = bridge.getTabForNode('node-1')!;
      expect(tab.nodeId).toBe('node-1');
    });

    it('registers the node-to-tab association', async () => {
      await bridge.createTabForNode({ id: 'node-1', url: 'https://example.com' });
      expect(bridge.getTabForNode('node-1')).toBeDefined();
      expect(bridge.getTabForNode('node-1')).toBe(tabPort.tabs[0]);
    });

    it('registers the tab-to-node association', async () => {
      await bridge.createTabForNode({ id: 'node-1', url: 'https://example.com' });
      const tab = tabPort.tabs[0];
      expect(bridge.getNodeForTab(tab)).toBe('node-1');
    });

    it('fires tabCreated probe', async () => {
      await bridge.createTabForNode({ id: 'node-1', url: 'https://example.com' });
      expect(probe.calls).toContainEqual({
        method: 'tabCreated',
        args: ['node-1'],
      });
    });

    it('throws if node already has a tab', async () => {
      await bridge.createTabForNode({ id: 'node-1', url: 'https://example.com' });
      await expect(
        bridge.createTabForNode({ id: 'node-1', url: 'https://other.com' })
      ).rejects.toThrow();
    });

    it('creates a tab for the root node (startup scenario)', async () => {
      const tree = new BrowsingTree('https://start.com');
      const root = tree.nodes.get(tree.rootId)!;
      await bridge.createTabForNode({ id: root.id, url: root.url });
      expect(bridge.getTabForNode(root.id)).toBeDefined();
      expect(bridge.getTabForNode(root.id)!.url).toBe('https://start.com');
    });
  });

  describe('closeTabForNode', () => {
    it('closes the associated tab via the port', async () => {
      await bridge.createTabForNode({ id: 'node-1', url: 'https://example.com' });
      const tab = bridge.getTabForNode('node-1')!;
      await bridge.closeTabForNode('node-1');
      expect(tab.closed).toBe(true);
    });

    it('removes the node-to-tab association', async () => {
      await bridge.createTabForNode({ id: 'node-1', url: 'https://example.com' });
      await bridge.closeTabForNode('node-1');
      expect(bridge.getTabForNode('node-1')).toBeUndefined();
    });

    it('removes the tab-to-node association', async () => {
      await bridge.createTabForNode({ id: 'node-1', url: 'https://example.com' });
      const tab = tabPort.tabs[0];
      await bridge.closeTabForNode('node-1');
      expect(bridge.getNodeForTab(tab)).toBeUndefined();
    });

    it('fires tabClosed probe', async () => {
      await bridge.createTabForNode({ id: 'node-1', url: 'https://example.com' });
      probe.calls.length = 0;
      await bridge.closeTabForNode('node-1');
      expect(probe.calls).toContainEqual({
        method: 'tabClosed',
        args: ['node-1'],
      });
    });

    it('is a no-op if node has no tab', async () => {
      await bridge.closeTabForNode('nonexistent');
      expect(tabPort.tabs).toHaveLength(0);
      expect(probe.calls).toHaveLength(0);
    });
  });

  describe('onNodeRemoved', () => {
    it('closes the tab for the removed node', async () => {
      await bridge.createTabForNode({ id: 'node-1', url: 'https://example.com' });
      const tab = bridge.getTabForNode('node-1')!;
      await bridge.onNodeRemoved('node-1', []);
      expect(tab.closed).toBe(true);
    });

    it('closes tabs for all descendant nodes', async () => {
      await bridge.createTabForNode({ id: 'parent', url: 'https://parent.com' });
      await bridge.createTabForNode({ id: 'child', url: 'https://child.com' });
      await bridge.createTabForNode({
        id: 'grandchild',
        url: 'https://grandchild.com',
      });
      await bridge.onNodeRemoved('parent', ['child', 'grandchild']);
      expect(bridge.getTabForNode('parent')).toBeUndefined();
      expect(bridge.getTabForNode('child')).toBeUndefined();
      expect(bridge.getTabForNode('grandchild')).toBeUndefined();
      expect(tabPort.openTabs).toHaveLength(0);
    });

    it('skips nodes without tabs', async () => {
      await bridge.createTabForNode({ id: 'parent', url: 'https://parent.com' });
      // 'child-no-tab' has no tab (lower LOD tier)
      await bridge.onNodeRemoved('parent', ['child-no-tab']);
      expect(tabPort.openTabs).toHaveLength(0);
    });

    it('fires tabClosed probe for each node that had a tab', async () => {
      await bridge.createTabForNode({ id: 'parent', url: 'https://parent.com' });
      await bridge.createTabForNode({ id: 'child', url: 'https://child.com' });
      probe.calls.length = 0;
      await bridge.onNodeRemoved('parent', ['child']);
      const closeCalls = probe.calls.filter((c) => c.method === 'tabClosed');
      expect(closeCalls).toHaveLength(2);
      expect(closeCalls.map((c) => c.args[0])).toContain('parent');
      expect(closeCalls.map((c) => c.args[0])).toContain('child');
    });
  });

  describe('getTabForNode', () => {
    it('returns the associated tab', async () => {
      await bridge.createTabForNode({ id: 'node-1', url: 'https://example.com' });
      const tab = bridge.getTabForNode('node-1');
      expect(tab).toBeDefined();
      expect(tab!.url).toBe('https://example.com');
    });

    it('returns undefined for unknown nodeId', () => {
      expect(bridge.getTabForNode('nonexistent')).toBeUndefined();
    });
  });

  describe('getNodeForTab', () => {
    it('returns the associated nodeId', async () => {
      await bridge.createTabForNode({ id: 'node-1', url: 'https://example.com' });
      const tab = tabPort.tabs[0];
      expect(bridge.getNodeForTab(tab)).toBe('node-1');
    });

    it('returns undefined for unknown tab', () => {
      const unknownTab: FakeTab = { url: 'https://x.com', nodeId: 'x', closed: false, suspended: false };
      expect(bridge.getNodeForTab(unknownTab)).toBeUndefined();
    });
  });

  describe('BrowsingTree integration', () => {
    it('creates tabs when nodes are added to the tree', async () => {
      const tree = new BrowsingTree('https://root.com');
      const root = tree.nodes.get(tree.rootId)!;
      await bridge.createTabForNode({ id: root.id, url: root.url });

      const child = tree.addChild(tree.rootId, 'https://child.com');
      await bridge.createTabForNode({ id: child.id, url: child.url });

      expect(bridge.getTabForNode(root.id)).toBeDefined();
      expect(bridge.getTabForNode(child.id)).toBeDefined();
      expect(tabPort.openTabs).toHaveLength(2);
    });

    it('closes tabs when nodes are removed from the tree', async () => {
      const tree = new BrowsingTree('https://root.com');
      const root = tree.nodes.get(tree.rootId)!;
      await bridge.createTabForNode({ id: root.id, url: root.url });

      const child = tree.addChild(tree.rootId, 'https://child.com');
      await bridge.createTabForNode({ id: child.id, url: child.url });

      const grandchild = tree.addChild(child.id, 'https://grandchild.com');
      await bridge.createTabForNode({ id: grandchild.id, url: grandchild.url });

      // Simulate what happens when tree.removeNode is called:
      // the probe fires nodeRemoved(child.id, [grandchild.id])
      tree.removeNode(child.id);
      await bridge.onNodeRemoved(child.id, [grandchild.id]);

      expect(bridge.getTabForNode(child.id)).toBeUndefined();
      expect(bridge.getTabForNode(grandchild.id)).toBeUndefined();
      // Root tab still open
      expect(bridge.getTabForNode(root.id)).toBeDefined();
      expect(tabPort.openTabs).toHaveLength(1);
    });
  });

  describe('invariants', () => {
    it('every open tab has a corresponding node (no orphan tabs)', async () => {
      await bridge.createTabForNode({ id: 'n1', url: 'https://a.com' });
      await bridge.createTabForNode({ id: 'n2', url: 'https://b.com' });
      await bridge.createTabForNode({ id: 'n3', url: 'https://c.com' });
      await bridge.closeTabForNode('n2');

      for (const tab of tabPort.openTabs) {
        expect(bridge.getNodeForTab(tab)).toBeDefined();
      }
    });

    it('bidirectional maps are consistent', async () => {
      await bridge.createTabForNode({ id: 'n1', url: 'https://a.com' });
      await bridge.createTabForNode({ id: 'n2', url: 'https://b.com' });
      await bridge.closeTabForNode('n1');

      for (const [nodeId, tab] of bridge.nodeToTab) {
        expect(bridge.tabToNode.get(tab)).toBe(nodeId);
      }
      for (const [tab, nodeId] of bridge.tabToNode) {
        expect(bridge.nodeToTab.get(nodeId)).toBe(tab);
      }
    });

    it('every tracked node maps to an open tab', async () => {
      await bridge.createTabForNode({ id: 'n1', url: 'https://a.com' });
      await bridge.createTabForNode({ id: 'n2', url: 'https://b.com' });
      await bridge.closeTabForNode('n1');

      for (const [, tab] of bridge.nodeToTab) {
        expect(tab.closed).toBe(false);
      }
    });
  });

  describe('syncFocusToTab (tree → tab)', () => {
    it('selects the tab associated with the focused node', async () => {
      await bridge.createTabForNode({ id: 'node-1', url: 'https://example.com' });
      await bridge.syncFocusToTab('node-1', 'https://example.com');
      expect(tabPort.selectedTab).toBe(bridge.getTabForNode('node-1'));
    });

    it('creates a tab if none exists for the node', async () => {
      await bridge.syncFocusToTab('node-1', 'https://example.com');
      expect(bridge.getTabForNode('node-1')).toBeDefined();
      expect(tabPort.selectedTab).toBe(bridge.getTabForNode('node-1'));
    });

    it('fires tabCreated probe when creating a tab on focus', async () => {
      probe.calls.length = 0;
      await bridge.syncFocusToTab('node-1', 'https://example.com');
      expect(probe.calls).toContainEqual({
        method: 'tabCreated',
        args: ['node-1'],
      });
    });

    it('restores a suspended tab before selecting it', async () => {
      await bridge.createTabForNode({ id: 'node-1', url: 'https://example.com' });
      const tab = bridge.getTabForNode('node-1')!;
      tab.suspended = true;
      await bridge.syncFocusToTab('node-1', 'https://example.com');
      expect(tab.suspended).toBe(false);
      expect(tabPort.selectedTab).toBe(tab);
    });

    it('fires focusSynced probe', async () => {
      await bridge.createTabForNode({ id: 'node-1', url: 'https://example.com' });
      probe.calls.length = 0;
      await bridge.syncFocusToTab('node-1', 'https://example.com');
      expect(probe.calls).toContainEqual({
        method: 'focusSynced',
        args: ['node-1'],
      });
    });
  });

  describe('onExternalTabSelected (tab → tree)', () => {
    it('calls focusNode callback with the node id for the selected tab', async () => {
      await bridge.createTabForNode({ id: 'node-1', url: 'https://example.com' });
      const tab = bridge.getTabForNode('node-1')!;
      const focusCalls: string[] = [];
      bridge.onExternalTabSelected(tab, (nodeId) => focusCalls.push(nodeId));
      expect(focusCalls).toEqual(['node-1']);
    });

    it('updates the tree focused node when a tab is selected externally', async () => {
      const tree = new BrowsingTree('https://root.com');
      const child = tree.addChild(tree.rootId, 'https://child.com');
      await bridge.createTabForNode({ id: child.id, url: child.url });
      const tab = bridge.getTabForNode(child.id)!;

      bridge.onExternalTabSelected(tab, (nodeId) => tree.focusNode(nodeId));
      expect(tree.focusedNodeId).toBe(child.id);
    });

    it('fires focusSynced probe', async () => {
      await bridge.createTabForNode({ id: 'node-1', url: 'https://example.com' });
      const tab = bridge.getTabForNode('node-1')!;
      probe.calls.length = 0;
      bridge.onExternalTabSelected(tab, () => {});
      expect(probe.calls).toContainEqual({
        method: 'focusSynced',
        args: ['node-1'],
      });
    });

    it('is a no-op for an unknown tab', () => {
      const focusCalls: string[] = [];
      const unknownTab: FakeTab = { url: 'https://x.com', nodeId: 'x', closed: false, suspended: false };
      bridge.onExternalTabSelected(unknownTab, (nodeId) => focusCalls.push(nodeId));
      expect(focusCalls).toHaveLength(0);
    });
  });

  describe('loop guard', () => {
    it('syncFocusToTab is suppressed during onExternalTabSelected', async () => {
      await bridge.createTabForNode({ id: 'node-1', url: 'https://example.com' });
      const tab = bridge.getTabForNode('node-1')!;

      bridge.onExternalTabSelected(tab, () => {
        // Simulate: focusNode callback triggers a listener that calls syncFocusToTab
        bridge.syncFocusToTab('node-1', 'https://example.com');
      });

      // selectTab should NOT have been called (syncFocusToTab was guarded)
      expect(tabPort.selectedTab).toBeNull();
    });

    it('onExternalTabSelected is suppressed during syncFocusToTab', async () => {
      const tree = new BrowsingTree('https://root.com');
      const child = tree.addChild(tree.rootId, 'https://child.com');

      // Custom port that simulates TabSelect firing during selectTab
      const customPort = new InMemoryTabPort();
      const customBridge = new TabBridge(customPort, probe);
      await customBridge.createTabForNode({ id: child.id, url: child.url });
      const tab = customBridge.getTabForNode(child.id)!;

      let reEntryAttempted = false;
      const origSelectTab = customPort.selectTab.bind(customPort);
      customPort.selectTab = async (t: FakeTab) => {
        await origSelectTab(t);
        reEntryAttempted = true;
        // Simulate TabSelect event calling onExternalTabSelected
        customBridge.onExternalTabSelected(t, (nodeId) => tree.focusNode(nodeId));
      };

      await customBridge.syncFocusToTab(child.id, child.url);

      expect(reEntryAttempted).toBe(true);
      // tree.focusedNodeId should still be root — onExternalTabSelected was guarded
      expect(tree.focusedNodeId).toBe(tree.rootId);
      // But the tab should be selected
      expect(customPort.selectedTab!.nodeId).toBe(child.id);
    });

    it('focus sync is re-enterable after previous sync completes', async () => {
      await bridge.createTabForNode({ id: 'node-1', url: 'https://example.com' });
      await bridge.createTabForNode({ id: 'node-2', url: 'https://other.com' });

      // First sync completes
      await bridge.syncFocusToTab('node-1', 'https://example.com');
      expect(tabPort.selectedTab!.nodeId).toBe('node-1');

      // Second sync should work (guard is cleared)
      const focusCalls: string[] = [];
      const tab2 = bridge.getTabForNode('node-2')!;
      bridge.onExternalTabSelected(tab2, (nodeId) => focusCalls.push(nodeId));
      expect(focusCalls).toEqual(['node-2']);
    });
  });

  describe('without probe', () => {
    it('works when no probe is provided', async () => {
      const noProbeBridge = new TabBridge(tabPort);
      await noProbeBridge.createTabForNode({
        id: 'node-1',
        url: 'https://example.com',
      });
      await noProbeBridge.closeTabForNode('node-1');
      expect(tabPort.openTabs).toHaveLength(0);
    });

    it('syncFocusToTab works without a probe', async () => {
      const noProbeBridge = new TabBridge(tabPort);
      await noProbeBridge.createTabForNode({
        id: 'node-1',
        url: 'https://example.com',
      });
      await noProbeBridge.syncFocusToTab('node-1', 'https://example.com');
      expect(tabPort.selectedTab!.nodeId).toBe('node-1');
    });

    it('onExternalTabSelected works without a probe', async () => {
      const noProbeBridge = new TabBridge(tabPort);
      await noProbeBridge.createTabForNode({
        id: 'node-1',
        url: 'https://example.com',
      });
      const tab = noProbeBridge.getTabForNode('node-1')!;
      const focusCalls: string[] = [];
      noProbeBridge.onExternalTabSelected(tab, (nodeId) => focusCalls.push(nodeId));
      expect(focusCalls).toEqual(['node-1']);
    });
  });
});
