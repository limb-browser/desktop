// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach } from 'vitest';
import { UrlEntryRouter } from './UrlEntryRouter';
import { BrowsingTree } from './BrowsingTree';
import { TabBridge } from './TabBridge';
import { InMemoryTabPort } from './InMemoryTabPort';
import type { FakeTab } from './InMemoryTabPort';
import type { UrlEntryRouterProbe } from '../ports/UrlEntryRouterProbe';

function createFakeProbe(): UrlEntryRouterProbe & {
  calls: { method: string; args: unknown[] }[];
} {
  const calls: { method: string; args: unknown[] }[] = [];
  return {
    calls,
    navigatedInPlace(nodeId: string, url: string) {
      calls.push({ method: 'navigatedInPlace', args: [nodeId, url] });
    },
    childCreated(parentId: string, childId: string, url: string) {
      calls.push({ method: 'childCreated', args: [parentId, childId, url] });
    },
  };
}

describe('UrlEntryRouter', () => {
  let tree: BrowsingTree;
  let tabPort: InMemoryTabPort;
  let bridge: TabBridge<FakeTab>;
  let probe: ReturnType<typeof createFakeProbe>;
  let router: UrlEntryRouter<FakeTab>;

  beforeEach(async () => {
    tree = new BrowsingTree('https://root.example.com');
    tabPort = new InMemoryTabPort();
    bridge = new TabBridge(tabPort);
    probe = createFakeProbe();
    router = new UrlEntryRouter(tree, bridge, probe);

    // Create a tab for the root node (simulating browser startup)
    const root = tree.nodes.get(tree.rootId)!;
    await bridge.createTabForNode({ id: root.id, url: root.url });
  });

  describe('about:limb-* URLs always navigate in-place', () => {
    it('about:limb-home navigates in-place', async () => {
      const result = await router.handleUrlEntry('about:limb-home');
      expect(result).toBe('in-place');
    });

    it('about:limb-settings navigates in-place', async () => {
      const result = await router.handleUrlEntry('about:limb-settings');
      expect(result).toBe('in-place');
    });

    it('about:limb-search navigates in-place', async () => {
      const result = await router.handleUrlEntry('about:limb-search');
      expect(result).toBe('in-place');
    });

    it('about:limb-home navigates in-place even when node has children', async () => {
      // Add a child to the focused node so the "has children" path would normally create a child
      tree.addChild(tree.focusedNodeId, 'https://child.example.com');

      const result = await router.handleUrlEntry('about:limb-home');
      expect(result).toBe('in-place');
    });

    it('about:limb-home navigates in-place even when node was visited long ago', async () => {
      const node = tree.nodes.get(tree.focusedNodeId)!;
      node.lastVisitedAt = Date.now() - 60000; // 60 seconds ago

      const result = await router.handleUrlEntry('about:limb-home');
      expect(result).toBe('in-place');
    });

    it('fires navigatedInPlace probe for about:limb- URLs', async () => {
      const nodeId = tree.focusedNodeId;
      await router.handleUrlEntry('about:limb-home');
      expect(probe.calls).toContainEqual({
        method: 'navigatedInPlace',
        args: [nodeId, 'about:limb-home'],
      });
    });

    it('does not change the tree structure for about:limb- URLs', async () => {
      const nodeCountBefore = tree.nodes.size;
      await router.handleUrlEntry('about:limb-home');
      expect(tree.nodes.size).toBe(nodeCountBefore);
    });
  });

  describe('fresh node with no children navigates in-place', () => {
    it('navigates in-place when node has no children and was just visited', async () => {
      // focusNode sets lastVisitedAt to Date.now(), so node is fresh
      tree.focusNode(tree.focusedNodeId);
      const result = await router.handleUrlEntry('https://example.com');
      expect(result).toBe('in-place');
    });

    it('fires navigatedInPlace probe', async () => {
      tree.focusNode(tree.focusedNodeId);
      const nodeId = tree.focusedNodeId;
      await router.handleUrlEntry('https://example.com');
      expect(probe.calls).toContainEqual({
        method: 'navigatedInPlace',
        args: [nodeId, 'https://example.com'],
      });
    });

    it('does not change the tree structure', async () => {
      tree.focusNode(tree.focusedNodeId);
      const nodeCountBefore = tree.nodes.size;
      await router.handleUrlEntry('https://example.com');
      expect(tree.nodes.size).toBe(nodeCountBefore);
    });

    it('does not change the focused node', async () => {
      tree.focusNode(tree.focusedNodeId);
      const focusedBefore = tree.focusedNodeId;
      await router.handleUrlEntry('https://example.com');
      expect(tree.focusedNodeId).toBe(focusedBefore);
    });
  });

  describe('node with children creates a child', () => {
    it('creates a child when the focused node has children', async () => {
      tree.focusNode(tree.focusedNodeId); // ensure fresh
      tree.addChild(tree.focusedNodeId, 'https://existing-child.example.com');

      const result = await router.handleUrlEntry('https://new-page.example.com');
      expect(result).toBe('create-child');
    });

    it('adds a new child node to the tree', async () => {
      tree.focusNode(tree.focusedNodeId);
      tree.addChild(tree.focusedNodeId, 'https://existing-child.example.com');

      const nodeCountBefore = tree.nodes.size;
      await router.handleUrlEntry('https://new-page.example.com');
      expect(tree.nodes.size).toBe(nodeCountBefore + 1);
    });

    it('new child has the entered URL', async () => {
      tree.focusNode(tree.focusedNodeId);
      tree.addChild(tree.focusedNodeId, 'https://existing-child.example.com');

      await router.handleUrlEntry('https://new-page.example.com');
      const child = tree.nodes.get(tree.focusedNodeId)!;
      expect(child.url).toBe('https://new-page.example.com');
    });

    it('new child has the focused node as parent', async () => {
      const parentId = tree.focusedNodeId;
      tree.focusNode(parentId);
      tree.addChild(parentId, 'https://existing-child.example.com');

      await router.handleUrlEntry('https://new-page.example.com');
      const child = tree.nodes.get(tree.focusedNodeId)!;
      expect(child.parentId).toBe(parentId);
    });

    it('creates a tab for the new child', async () => {
      tree.focusNode(tree.focusedNodeId);
      tree.addChild(tree.focusedNodeId, 'https://existing-child.example.com');

      await router.handleUrlEntry('https://new-page.example.com');
      const childId = tree.focusedNodeId;
      expect(bridge.getTabForNode(childId)).toBeDefined();
    });

    it('focuses the new child node', async () => {
      const parentId = tree.focusedNodeId;
      tree.focusNode(parentId);
      tree.addChild(parentId, 'https://existing-child.example.com');

      await router.handleUrlEntry('https://new-page.example.com');
      expect(tree.focusedNodeId).not.toBe(parentId);
    });

    it('syncs focus to the new tab', async () => {
      tree.focusNode(tree.focusedNodeId);
      tree.addChild(tree.focusedNodeId, 'https://existing-child.example.com');

      await router.handleUrlEntry('https://new-page.example.com');
      const childId = tree.focusedNodeId;
      const tab = bridge.getTabForNode(childId)!;
      expect(tabPort.selectedTab).toBe(tab);
    });

    it('fires childCreated probe', async () => {
      const parentId = tree.focusedNodeId;
      tree.focusNode(parentId);
      tree.addChild(parentId, 'https://existing-child.example.com');

      await router.handleUrlEntry('https://new-page.example.com');
      const childId = tree.focusedNodeId;
      expect(probe.calls).toContainEqual({
        method: 'childCreated',
        args: [parentId, childId, 'https://new-page.example.com'],
      });
    });
  });

  describe('node visited more than 5 seconds ago creates a child', () => {
    it('creates a child when node has no children but was visited > 5s ago', async () => {
      const node = tree.nodes.get(tree.focusedNodeId)!;
      node.lastVisitedAt = Date.now() - 6000; // 6 seconds ago

      const result = await router.handleUrlEntry('https://example.com');
      expect(result).toBe('create-child');
    });

    it('adds a new child node to the tree', async () => {
      const node = tree.nodes.get(tree.focusedNodeId)!;
      node.lastVisitedAt = Date.now() - 6000;

      const nodeCountBefore = tree.nodes.size;
      await router.handleUrlEntry('https://example.com');
      expect(tree.nodes.size).toBe(nodeCountBefore + 1);
    });

    it('new child has the entered URL', async () => {
      const node = tree.nodes.get(tree.focusedNodeId)!;
      node.lastVisitedAt = Date.now() - 6000;

      await router.handleUrlEntry('https://example.com');
      const child = tree.nodes.get(tree.focusedNodeId)!;
      expect(child.url).toBe('https://example.com');
    });

    it('fires childCreated probe', async () => {
      const parentId = tree.focusedNodeId;
      const node = tree.nodes.get(parentId)!;
      node.lastVisitedAt = Date.now() - 6000;

      await router.handleUrlEntry('https://example.com');
      const childId = tree.focusedNodeId;
      expect(probe.calls).toContainEqual({
        method: 'childCreated',
        args: [parentId, childId, 'https://example.com'],
      });
    });
  });

  describe('5-second window is based on lastVisitedAt', () => {
    it('navigates in-place at exactly 4999ms', async () => {
      const node = tree.nodes.get(tree.focusedNodeId)!;
      node.lastVisitedAt = Date.now() - 4999;

      const result = await router.handleUrlEntry('https://example.com');
      expect(result).toBe('in-place');
    });

    it('creates child at exactly 5000ms (not less than)', async () => {
      const node = tree.nodes.get(tree.focusedNodeId)!;
      node.lastVisitedAt = Date.now() - 5000;

      const result = await router.handleUrlEntry('https://example.com');
      expect(result).toBe('create-child');
    });

    it('creates child at 5001ms', async () => {
      const node = tree.nodes.get(tree.focusedNodeId)!;
      node.lastVisitedAt = Date.now() - 5001;

      const result = await router.handleUrlEntry('https://example.com');
      expect(result).toBe('create-child');
    });

    it('uses node.lastVisitedAt not createdAt', async () => {
      const node = tree.nodes.get(tree.focusedNodeId)!;
      // Node was created long ago but visited recently
      node.createdAt = Date.now() - 60000;
      node.lastVisitedAt = Date.now() - 1000; // 1 second ago

      const result = await router.handleUrlEntry('https://example.com');
      expect(result).toBe('in-place');
    });
  });

  describe('without probe', () => {
    it('works when no probe is provided', async () => {
      const noprobeRouter = new UrlEntryRouter(tree, bridge);
      tree.focusNode(tree.focusedNodeId);
      const result = await noprobeRouter.handleUrlEntry('about:limb-home');
      expect(result).toBe('in-place');
    });

    it('creates child without probe', async () => {
      const noprobeRouter = new UrlEntryRouter(tree, bridge);
      const node = tree.nodes.get(tree.focusedNodeId)!;
      node.lastVisitedAt = Date.now() - 10000;

      const result = await noprobeRouter.handleUrlEntry('https://example.com');
      expect(result).toBe('create-child');
      expect(tree.nodes.size).toBe(2);
    });
  });
});
