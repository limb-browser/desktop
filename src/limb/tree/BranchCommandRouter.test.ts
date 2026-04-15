// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach } from 'vitest';
import { BranchCommandRouter } from './BranchCommandRouter';
import { BrowsingTree } from './BrowsingTree';
import { TabBridge } from './TabBridge';
import { InMemoryTabPort } from './InMemoryTabPort';
import { InMemoryConfirmationPort } from './InMemoryConfirmationPort';
import type { FakeTab } from './InMemoryTabPort';
import type { BranchCommandRouterProbe } from '../ports/BranchCommandRouterProbe';
import type { AutoSaveProbe } from '../ports/AutoSaveProbe';
import type { TimerPort } from '../ports/TimerPort';
import { AutoSaveTrigger } from './AutoSaveTrigger';

function createFakeProbe(): BranchCommandRouterProbe & {
  calls: { method: string; args: unknown[] }[];
} {
  const calls: { method: string; args: unknown[] }[] = [];
  return {
    calls,
    branchCreated(branchRootId: string) {
      calls.push({ method: 'branchCreated', args: [branchRootId] });
    },
    branchDeleted(branchRootId: string) {
      calls.push({ method: 'branchDeleted', args: [branchRootId] });
    },
    branchDeletionCancelled(branchRootId: string) {
      calls.push({ method: 'branchDeletionCancelled', args: [branchRootId] });
    },
  };
}

function createFakeTimer(): TimerPort {
  return {
    setTimeout: (cb: () => void) => { cb(); return 1; },
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
  };
}

describe('BranchCommandRouter', () => {
  let tree: BrowsingTree;
  let tabPort: InMemoryTabPort;
  let bridge: TabBridge<FakeTab>;
  let confirmPort: InMemoryConfirmationPort;
  let probe: ReturnType<typeof createFakeProbe>;
  let saveCount: number;
  let autoSave: AutoSaveTrigger;
  let router: BranchCommandRouter<FakeTab>;

  beforeEach(() => {
    tree = new BrowsingTree('about:limb-home');
    tabPort = new InMemoryTabPort();
    bridge = new TabBridge(tabPort);
    confirmPort = new InMemoryConfirmationPort();
    probe = createFakeProbe();
    saveCount = 0;
    autoSave = new AutoSaveTrigger(() => { saveCount++; }, createFakeTimer());
    router = new BranchCommandRouter(
      tree,
      bridge,
      autoSave,
      confirmPort,
      'https://example.com',
      probe,
    );
  });

  describe('createBranch', () => {
    it('creates a new branch child of root', async () => {
      await router.createBranch();

      const root = tree.nodes.get(tree.rootId)!;
      expect(root.childIds).toHaveLength(1);
      const branchRoot = tree.nodes.get(root.childIds[0])!;
      expect(branchRoot.url).toBe('https://example.com');
      expect(branchRoot.parentId).toBe(tree.rootId);
    });

    it('focuses the new branch root node', async () => {
      await router.createBranch();

      const root = tree.nodes.get(tree.rootId)!;
      expect(tree.focusedNodeId).toBe(root.childIds[0]);
    });

    it('creates a tab for the new branch root via TabBridge', async () => {
      await router.createBranch();

      const root = tree.nodes.get(tree.rootId)!;
      const branchRootId = root.childIds[0];
      expect(bridge.getTabForNode(branchRootId)).toBeDefined();
      expect(tabPort.openTabs).toHaveLength(1);
    });

    it('saves current state before creating the branch', async () => {
      await router.createBranch();

      // AutoSaveTrigger with instant timer fires save immediately
      expect(saveCount).toBeGreaterThanOrEqual(1);
    });

    it('fires branchCreated probe', async () => {
      await router.createBranch();

      const root = tree.nodes.get(tree.rootId)!;
      const branchRootId = root.childIds[0];
      expect(probe.calls).toContainEqual({
        method: 'branchCreated',
        args: [branchRootId],
      });
    });

    it('uses the configured home URL', async () => {
      const customRouter = new BranchCommandRouter(
        tree,
        bridge,
        autoSave,
        confirmPort,
        'https://custom-home.com',
        probe,
      );

      await customRouter.createBranch();

      const root = tree.nodes.get(tree.rootId)!;
      const branchRoot = tree.nodes.get(root.childIds[0])!;
      expect(branchRoot.url).toBe('https://custom-home.com');
    });

    it('creates multiple branches as siblings under root', async () => {
      await router.createBranch();
      await router.createBranch();

      const root = tree.nodes.get(tree.rootId)!;
      expect(root.childIds).toHaveLength(2);
    });
  });

  describe('deleteBranch', () => {
    it('removes branch and all descendants', async () => {
      const branch = tree.addChild(tree.rootId, 'https://a.com');
      const child = tree.addChild(branch.id, 'https://b.com');
      tree.addChild(child.id, 'https://c.com');
      await bridge.createTabForNode({ id: branch.id, url: branch.url });
      await bridge.createTabForNode({ id: child.id, url: child.url });

      confirmPort.nextResponse = true;
      await router.deleteBranch(branch.id);

      expect(tree.nodes.has(branch.id)).toBe(false);
      expect(tree.nodes.has(child.id)).toBe(false);
    });

    it('closes all associated tabs', async () => {
      const branch = tree.addChild(tree.rootId, 'https://a.com');
      const child = tree.addChild(branch.id, 'https://b.com');
      await bridge.createTabForNode({ id: branch.id, url: branch.url });
      await bridge.createTabForNode({ id: child.id, url: child.url });

      confirmPort.nextResponse = true;
      await router.deleteBranch(branch.id);

      expect(bridge.getTabForNode(branch.id)).toBeUndefined();
      expect(bridge.getTabForNode(child.id)).toBeUndefined();
      expect(tabPort.openTabs).toHaveLength(0);
    });

    it('shows confirmation for multi-node branches', async () => {
      const branch = tree.addChild(tree.rootId, 'https://a.com');
      tree.addChild(branch.id, 'https://b.com');

      confirmPort.nextResponse = true;
      await router.deleteBranch(branch.id);

      expect(confirmPort.calls).toHaveLength(1);
    });

    it('deletes single-node branches without confirmation', async () => {
      const branch = tree.addChild(tree.rootId, 'https://a.com');

      await router.deleteBranch(branch.id);

      expect(confirmPort.calls).toHaveLength(0);
      expect(tree.nodes.has(branch.id)).toBe(false);
    });

    it('cancels deletion when confirmation is rejected', async () => {
      const branch = tree.addChild(tree.rootId, 'https://a.com');
      tree.addChild(branch.id, 'https://b.com');

      confirmPort.nextResponse = false;
      await router.deleteBranch(branch.id);

      expect(tree.nodes.has(branch.id)).toBe(true);
    });

    it('fires branchDeleted probe on successful deletion', async () => {
      const branch = tree.addChild(tree.rootId, 'https://a.com');

      await router.deleteBranch(branch.id);

      expect(probe.calls).toContainEqual({
        method: 'branchDeleted',
        args: [branch.id],
      });
    });

    it('fires branchDeletionCancelled probe when user cancels', async () => {
      const branch = tree.addChild(tree.rootId, 'https://a.com');
      tree.addChild(branch.id, 'https://b.com');

      confirmPort.nextResponse = false;
      await router.deleteBranch(branch.id);

      expect(probe.calls).toContainEqual({
        method: 'branchDeletionCancelled',
        args: [branch.id],
      });
    });

    it('moves focus to root when deleting the focused branch', async () => {
      const branch = tree.addChild(tree.rootId, 'https://a.com');
      tree.focusNode(branch.id);

      await router.deleteBranch(branch.id);

      expect(tree.focusedNodeId).toBe(tree.rootId);
    });

    it('does not change focus when deleting a non-focused branch', async () => {
      const branch1 = tree.addChild(tree.rootId, 'https://a.com');
      const branch2 = tree.addChild(tree.rootId, 'https://b.com');
      tree.focusNode(branch1.id);

      await router.deleteBranch(branch2.id);

      expect(tree.focusedNodeId).toBe(branch1.id);
    });

    it('throws when trying to delete the root node', async () => {
      await expect(router.deleteBranch(tree.rootId)).rejects.toThrow();
    });

    it('throws when trying to delete a non-existent node', async () => {
      await expect(router.deleteBranch('nonexistent')).rejects.toThrow();
    });
  });

  describe('without probe', () => {
    it('createBranch works without a probe', async () => {
      const noProbRouter = new BranchCommandRouter(
        tree,
        bridge,
        autoSave,
        confirmPort,
        'https://example.com',
      );

      await noProbRouter.createBranch();

      const root = tree.nodes.get(tree.rootId)!;
      expect(root.childIds).toHaveLength(1);
    });

    it('deleteBranch works without a probe', async () => {
      const noProbRouter = new BranchCommandRouter(
        tree,
        bridge,
        autoSave,
        confirmPort,
        'https://example.com',
      );
      const branch = tree.addChild(tree.rootId, 'https://a.com');

      await noProbRouter.deleteBranch(branch.id);

      expect(tree.nodes.has(branch.id)).toBe(false);
    });
  });
});
