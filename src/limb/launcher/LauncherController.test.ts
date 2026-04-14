// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach } from 'vitest';
import { LauncherController } from './LauncherController';
import { BrowsingTree } from '../tree/BrowsingTree';
import type { LauncherProbe } from '../ports/LauncherProbe';

function createFakeProbe(): LauncherProbe & {
  calls: { method: string; args: unknown[] }[];
} {
  const calls: { method: string; args: unknown[] }[] = [];
  return {
    calls,
    branchSelected(branchId: string) {
      calls.push({ method: 'branchSelected', args: [branchId] });
    },
    branchCreated(branchId: string) {
      calls.push({ method: 'branchCreated', args: [branchId] });
    },
  };
}

describe('LauncherController', () => {
  let tree: BrowsingTree;
  let probe: ReturnType<typeof createFakeProbe>;
  let controller: LauncherController;

  beforeEach(() => {
    tree = new BrowsingTree('about:limb-home');
    probe = createFakeProbe();
    controller = new LauncherController(tree, probe);
  });

  describe('root URL', () => {
    it('tree root node has about:limb-home as URL', () => {
      const root = tree.nodes.get(tree.rootId)!;
      expect(root.url).toBe('about:limb-home');
    });
  });

  describe('isEmpty', () => {
    it('returns true when root has no children', () => {
      expect(controller.isEmpty()).toBe(true);
    });

    it('returns false when root has children', () => {
      tree.addChild(tree.rootId, 'https://example.com');
      expect(controller.isEmpty()).toBe(false);
    });
  });

  describe('getBranches', () => {
    it('returns empty array when root has no children', () => {
      expect(controller.getBranches()).toEqual([]);
    });

    it('returns branch info for each root child', () => {
      const child1 = tree.addChild(tree.rootId, 'https://a.com');
      child1.title = 'Branch A';
      child1.favicon = 'https://a.com/favicon.ico';
      const child2 = tree.addChild(tree.rootId, 'https://b.com');
      child2.title = 'Branch B';

      const branches = controller.getBranches();
      expect(branches).toHaveLength(2);
      expect(branches[0].id).toBe(child1.id);
      expect(branches[0].title).toBe('Branch A');
      expect(branches[0].favicon).toBe('https://a.com/favicon.ico');
      expect(branches[0].descendantCount).toBe(0);
      expect(branches[0].screenshotUrl).toBeNull();
      expect(branches[1].id).toBe(child2.id);
      expect(branches[1].title).toBe('Branch B');
      expect(branches[1].screenshotUrl).toBeNull();
    });

    it('computes descendantCount from tree structure', () => {
      const branch = tree.addChild(tree.rootId, 'https://a.com');
      tree.addChild(branch.id, 'https://b.com');
      tree.addChild(branch.id, 'https://c.com');

      const branches = controller.getBranches();
      expect(branches[0].descendantCount).toBe(2);
    });
  });

  describe('getTimeGroups', () => {
    it('returns empty array when no branches exist', () => {
      const groups = controller.getTimeGroups(Date.now());
      expect(groups).toEqual([]);
    });

    it('groups branches by time using the tree data', () => {
      const now = Date.now();
      const child = tree.addChild(tree.rootId, 'https://a.com');
      child.title = 'Today Branch';

      const groups = controller.getTimeGroups(now);
      expect(groups).toHaveLength(1);
      expect(groups[0].label).toBe('Today');
      expect(groups[0].branches[0].title).toBe('Today Branch');
    });
  });

  describe('getRenderData', () => {
    it('returns empty array when no branches exist', () => {
      const data = controller.getRenderData(Date.now());
      expect(data).toEqual([]);
    });

    it('returns groups with relativeTime on each branch', () => {
      const now = Date.now();
      const child = tree.addChild(tree.rootId, 'https://a.com');
      child.title = 'Today Branch';
      child.lastVisitedAt = now - 5 * 60_000; // 5 minutes ago

      const data = controller.getRenderData(now);
      expect(data).toHaveLength(1);
      expect(data[0].label).toBe('Today');
      expect(data[0].branches[0].title).toBe('Today Branch');
      expect(data[0].branches[0].relativeTime).toBe('5 minutes ago');
      expect(data[0].branches[0].screenshotUrl).toBeNull();
    });

    it('computes relativeTime correctly for older branches', () => {
      const now = Date.now();
      const child = tree.addChild(tree.rootId, 'https://a.com');
      child.lastVisitedAt = now - 3 * 3_600_000; // 3 hours ago

      const data = controller.getRenderData(now);
      expect(data[0].branches[0].relativeTime).toBe('3 hours ago');
    });
  });

  describe('selectBranch', () => {
    it('focuses the branch in the tree', () => {
      const branch = tree.addChild(tree.rootId, 'https://example.com');
      controller.selectBranch(branch.id);
      expect(tree.focusedNodeId).toBe(branch.id);
    });

    it('fires branchSelected probe', () => {
      const branch = tree.addChild(tree.rootId, 'https://example.com');
      controller.selectBranch(branch.id);
      expect(probe.calls).toContainEqual({
        method: 'branchSelected',
        args: [branch.id],
      });
    });

    it('throws when branch does not exist', () => {
      expect(() => controller.selectBranch('nonexistent')).toThrow();
    });
  });

  describe('createBranch', () => {
    it('adds a child to the root node', () => {
      const branchId = controller.createBranch('https://new.com');
      const root = tree.nodes.get(tree.rootId)!;
      expect(root.childIds).toContain(branchId);
    });

    it('returns the new branch ID', () => {
      const branchId = controller.createBranch('https://new.com');
      expect(tree.nodes.has(branchId)).toBe(true);
      expect(tree.nodes.get(branchId)!.url).toBe('https://new.com');
    });

    it('fires branchCreated probe', () => {
      const branchId = controller.createBranch('https://new.com');
      expect(probe.calls).toContainEqual({
        method: 'branchCreated',
        args: [branchId],
      });
    });
  });

  describe('without probe', () => {
    it('works when no probe is provided', () => {
      const noProbController = new LauncherController(tree);
      tree.addChild(tree.rootId, 'https://a.com');
      const branchId = noProbController.createBranch('https://b.com');
      noProbController.selectBranch(branchId);
      expect(tree.focusedNodeId).toBe(branchId);
    });
  });
});
