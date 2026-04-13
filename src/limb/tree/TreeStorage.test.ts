// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryTreeStorage } from './InMemoryTreeStorage';
import type { StoredNode } from '../ports/TreeStoragePort';
import type { TreeStorageProbe } from '../ports/TreeStorageProbe';

function createFakeProbe(): TreeStorageProbe & {
  calls: { method: string; args: unknown[] }[];
} {
  const calls: { method: string; args: unknown[] }[] = [];
  return {
    calls,
    branchSaved(branchRootId: string, nodeCount: number) {
      calls.push({ method: 'branchSaved', args: [branchRootId, nodeCount] });
    },
    branchLoaded(branchRootId: string, nodeCount: number) {
      calls.push({ method: 'branchLoaded', args: [branchRootId, nodeCount] });
    },
    branchDeleted(branchRootId: string) {
      calls.push({ method: 'branchDeleted', args: [branchRootId] });
    },
    screenshotSaved(nodeId: string, resolution: string, byteSize: number) {
      calls.push({
        method: 'screenshotSaved',
        args: [nodeId, resolution, byteSize],
      });
    },
    screenshotLoaded(nodeId: string, resolution: string) {
      calls.push({ method: 'screenshotLoaded', args: [nodeId, resolution] });
    },
    screenshotsDeleted(nodeIds: string[]) {
      calls.push({ method: 'screenshotsDeleted', args: [nodeIds] });
    },
  };
}

function makeNode(overrides: Partial<StoredNode> & { id: string }): StoredNode {
  return {
    url: 'https://example.com',
    title: 'Example',
    favicon: null,
    parentId: null,
    childIds: [],
    createdAt: 1000,
    lastVisitedAt: 2000,
    descendantCount: 0,
    branchRootId: overrides.id,
    ...overrides,
  };
}

describe('TreeStorage', () => {
  let storage: InMemoryTreeStorage;
  let probe: ReturnType<typeof createFakeProbe>;

  beforeEach(() => {
    probe = createFakeProbe();
    storage = new InMemoryTreeStorage(probe);
  });

  describe('saveBranch and loadBranch', () => {
    it('round-trips all node fields correctly', async () => {
      const branchRoot = makeNode({
        id: 'root-1',
        url: 'https://root.com',
        title: 'Root Page',
        favicon: 'data:image/png;base64,abc',
        parentId: null,
        childIds: ['child-1', 'child-2'],
        createdAt: 1000,
        lastVisitedAt: 2000,
        descendantCount: 2,
        branchRootId: 'root-1',
      });
      const child1 = makeNode({
        id: 'child-1',
        url: 'https://child1.com',
        title: 'Child 1',
        favicon: null,
        parentId: 'root-1',
        childIds: [],
        createdAt: 1100,
        lastVisitedAt: 2100,
        descendantCount: 0,
        branchRootId: 'root-1',
      });
      const child2 = makeNode({
        id: 'child-2',
        url: 'https://child2.com',
        title: 'Child 2',
        favicon: 'data:image/png;base64,def',
        parentId: 'root-1',
        childIds: [],
        createdAt: 1200,
        lastVisitedAt: 2200,
        descendantCount: 0,
        branchRootId: 'root-1',
      });

      await storage.saveBranch('root-1', [branchRoot, child1, child2]);
      const loaded = await storage.loadBranch('root-1');

      expect(loaded).toHaveLength(3);
      const loadedById = new Map(loaded.map((n) => [n.id, n]));

      const lr = loadedById.get('root-1')!;
      expect(lr.url).toBe('https://root.com');
      expect(lr.title).toBe('Root Page');
      expect(lr.favicon).toBe('data:image/png;base64,abc');
      expect(lr.parentId).toBeNull();
      expect(lr.childIds).toEqual(['child-1', 'child-2']);
      expect(lr.createdAt).toBe(1000);
      expect(lr.lastVisitedAt).toBe(2000);
      expect(lr.descendantCount).toBe(2);
      expect(lr.branchRootId).toBe('root-1');

      const lc1 = loadedById.get('child-1')!;
      expect(lc1.url).toBe('https://child1.com');
      expect(lc1.parentId).toBe('root-1');
      expect(lc1.branchRootId).toBe('root-1');

      const lc2 = loadedById.get('child-2')!;
      expect(lc2.favicon).toBe('data:image/png;base64,def');
    });

    it('returns empty array when loading a non-existent branch', async () => {
      const loaded = await storage.loadBranch('nonexistent');
      expect(loaded).toEqual([]);
    });

    it('overwrites existing branch data on re-save', async () => {
      const node = makeNode({ id: 'n1', title: 'Original' });
      await storage.saveBranch('n1', [node]);

      const updated = makeNode({ id: 'n1', title: 'Updated' });
      await storage.saveBranch('n1', [updated]);

      const loaded = await storage.loadBranch('n1');
      expect(loaded).toHaveLength(1);
      expect(loaded[0].title).toBe('Updated');
    });

    it('fires branchSaved probe', async () => {
      const nodes = [
        makeNode({ id: 'r', childIds: ['c'] }),
        makeNode({ id: 'c', parentId: 'r', branchRootId: 'r' }),
      ];
      await storage.saveBranch('r', nodes);
      expect(probe.calls).toContainEqual({
        method: 'branchSaved',
        args: ['r', 2],
      });
    });

    it('fires branchLoaded probe', async () => {
      const nodes = [makeNode({ id: 'r' })];
      await storage.saveBranch('r', nodes);
      probe.calls.length = 0;
      await storage.loadBranch('r');
      expect(probe.calls).toContainEqual({
        method: 'branchLoaded',
        args: ['r', 1],
      });
    });

    it('fires branchLoaded probe with 0 nodes for non-existent branch', async () => {
      await storage.loadBranch('missing');
      expect(probe.calls).toContainEqual({
        method: 'branchLoaded',
        args: ['missing', 0],
      });
    });
  });

  describe('getBranchSummaries', () => {
    it('returns empty array when no branches exist', async () => {
      const summaries = await storage.getBranchSummaries();
      expect(summaries).toEqual([]);
    });

    it('returns correct metadata for branch roots', async () => {
      const root1 = makeNode({
        id: 'branch-a',
        url: 'https://a.com',
        title: 'Branch A',
        favicon: 'fav-a',
        createdAt: 1000,
        lastVisitedAt: 3000,
        descendantCount: 5,
        branchRootId: 'branch-a',
      });
      const root2 = makeNode({
        id: 'branch-b',
        url: 'https://b.com',
        title: 'Branch B',
        favicon: null,
        createdAt: 2000,
        lastVisitedAt: 4000,
        descendantCount: 10,
        branchRootId: 'branch-b',
      });

      await storage.saveBranch('branch-a', [
        root1,
        makeNode({ id: 'a-child', parentId: 'branch-a', branchRootId: 'branch-a' }),
      ]);
      await storage.saveBranch('branch-b', [root2]);

      const summaries = await storage.getBranchSummaries();
      expect(summaries).toHaveLength(2);

      const summaryA = summaries.find((s) => s.id === 'branch-a')!;
      expect(summaryA.url).toBe('https://a.com');
      expect(summaryA.title).toBe('Branch A');
      expect(summaryA.favicon).toBe('fav-a');
      expect(summaryA.createdAt).toBe(1000);
      expect(summaryA.lastVisitedAt).toBe(3000);
      expect(summaryA.descendantCount).toBe(5);

      const summaryB = summaries.find((s) => s.id === 'branch-b')!;
      expect(summaryB.url).toBe('https://b.com');
      expect(summaryB.descendantCount).toBe(10);
    });

    it('does not load full subtrees', async () => {
      const root = makeNode({
        id: 'r',
        childIds: ['c1'],
        descendantCount: 1,
      });
      const child = makeNode({
        id: 'c1',
        parentId: 'r',
        branchRootId: 'r',
      });
      await storage.saveBranch('r', [root, child]);

      const summaries = await storage.getBranchSummaries();
      expect(summaries).toHaveLength(1);
      expect(summaries[0].id).toBe('r');
      // Summary should not contain childIds or full node data
      expect(summaries[0]).not.toHaveProperty('childIds');
      expect(summaries[0]).not.toHaveProperty('parentId');
    });
  });

  describe('deleteBranch', () => {
    it('removes all associated nodes', async () => {
      const nodes = [
        makeNode({ id: 'r', childIds: ['c1', 'c2'] }),
        makeNode({ id: 'c1', parentId: 'r', branchRootId: 'r' }),
        makeNode({ id: 'c2', parentId: 'r', branchRootId: 'r' }),
      ];
      await storage.saveBranch('r', nodes);
      await storage.deleteBranch('r');

      const loaded = await storage.loadBranch('r');
      expect(loaded).toEqual([]);
    });

    it('removes associated screenshots', async () => {
      const nodes = [makeNode({ id: 'r' })];
      await storage.saveBranch('r', nodes);
      await storage.saveScreenshot('r', 'low', new Uint8Array([1, 2, 3]));

      await storage.deleteBranch('r');

      const screenshot = await storage.loadScreenshot('r', 'low');
      expect(screenshot).toBeNull();
    });

    it('does not affect other branches', async () => {
      await storage.saveBranch('a', [makeNode({ id: 'a' })]);
      await storage.saveBranch('b', [makeNode({ id: 'b' })]);

      await storage.deleteBranch('a');

      const loadedB = await storage.loadBranch('b');
      expect(loadedB).toHaveLength(1);
    });

    it('fires branchDeleted probe', async () => {
      await storage.saveBranch('r', [makeNode({ id: 'r' })]);
      probe.calls.length = 0;
      await storage.deleteBranch('r');
      expect(probe.calls).toContainEqual({
        method: 'branchDeleted',
        args: ['r'],
      });
    });

    it('is a no-op for non-existent branch', async () => {
      await storage.deleteBranch('nonexistent');
      // Should not throw, probe still fires
      expect(probe.calls).toContainEqual({
        method: 'branchDeleted',
        args: ['nonexistent'],
      });
    });
  });

  describe('saveScreenshot and loadScreenshot', () => {
    it('stores and retrieves at low resolution', async () => {
      const blob = new Uint8Array([10, 20, 30, 40, 50]);
      await storage.saveScreenshot('node-1', 'low', blob);

      const loaded = await storage.loadScreenshot('node-1', 'low');
      expect(loaded).toEqual(blob);
    });

    it('stores and retrieves at high resolution', async () => {
      const blob = new Uint8Array([100, 200]);
      await storage.saveScreenshot('node-1', 'high', blob);

      const loaded = await storage.loadScreenshot('node-1', 'high');
      expect(loaded).toEqual(blob);
    });

    it('stores both resolutions independently', async () => {
      const lowBlob = new Uint8Array([1, 2, 3]);
      const highBlob = new Uint8Array([4, 5, 6, 7, 8, 9]);
      await storage.saveScreenshot('node-1', 'low', lowBlob);
      await storage.saveScreenshot('node-1', 'high', highBlob);

      const loadedLow = await storage.loadScreenshot('node-1', 'low');
      const loadedHigh = await storage.loadScreenshot('node-1', 'high');
      expect(loadedLow).toEqual(lowBlob);
      expect(loadedHigh).toEqual(highBlob);
    });

    it('returns null for non-existent screenshot', async () => {
      const loaded = await storage.loadScreenshot('missing', 'low');
      expect(loaded).toBeNull();
    });

    it('overwrites existing screenshot on re-save', async () => {
      await storage.saveScreenshot('n1', 'low', new Uint8Array([1]));
      await storage.saveScreenshot('n1', 'low', new Uint8Array([2, 3]));

      const loaded = await storage.loadScreenshot('n1', 'low');
      expect(loaded).toEqual(new Uint8Array([2, 3]));
    });

    it('fires screenshotSaved probe', async () => {
      const blob = new Uint8Array([10, 20, 30]);
      await storage.saveScreenshot('n1', 'low', blob);
      expect(probe.calls).toContainEqual({
        method: 'screenshotSaved',
        args: ['n1', 'low', 3],
      });
    });

    it('fires screenshotLoaded probe', async () => {
      await storage.saveScreenshot('n1', 'high', new Uint8Array([1]));
      probe.calls.length = 0;
      await storage.loadScreenshot('n1', 'high');
      expect(probe.calls).toContainEqual({
        method: 'screenshotLoaded',
        args: ['n1', 'high'],
      });
    });
  });

  describe('deleteScreenshots', () => {
    it('removes screenshots for given node IDs', async () => {
      await storage.saveScreenshot('a', 'low', new Uint8Array([1]));
      await storage.saveScreenshot('b', 'low', new Uint8Array([2]));
      await storage.saveScreenshot('a', 'high', new Uint8Array([3]));

      await storage.deleteScreenshots(['a']);

      expect(await storage.loadScreenshot('a', 'low')).toBeNull();
      expect(await storage.loadScreenshot('a', 'high')).toBeNull();
      expect(await storage.loadScreenshot('b', 'low')).toEqual(
        new Uint8Array([2])
      );
    });

    it('removes screenshots for multiple node IDs', async () => {
      await storage.saveScreenshot('a', 'low', new Uint8Array([1]));
      await storage.saveScreenshot('b', 'low', new Uint8Array([2]));
      await storage.saveScreenshot('c', 'low', new Uint8Array([3]));

      await storage.deleteScreenshots(['a', 'b']);

      expect(await storage.loadScreenshot('a', 'low')).toBeNull();
      expect(await storage.loadScreenshot('b', 'low')).toBeNull();
      expect(await storage.loadScreenshot('c', 'low')).toEqual(
        new Uint8Array([3])
      );
    });

    it('is a no-op for non-existent node IDs', async () => {
      await storage.deleteScreenshots(['nonexistent']);
      // Should not throw
    });

    it('fires screenshotsDeleted probe', async () => {
      await storage.saveScreenshot('a', 'low', new Uint8Array([1]));
      probe.calls.length = 0;
      await storage.deleteScreenshots(['a', 'b']);
      expect(probe.calls).toContainEqual({
        method: 'screenshotsDeleted',
        args: [['a', 'b']],
      });
    });
  });

  describe('getScreenshotMemoryUsage', () => {
    it('returns 0 when no screenshots exist', async () => {
      const usage = await storage.getScreenshotMemoryUsage();
      expect(usage).toBe(0);
    });

    it('returns accurate total byte size', async () => {
      await storage.saveScreenshot('a', 'low', new Uint8Array(100));
      await storage.saveScreenshot('b', 'high', new Uint8Array(250));
      await storage.saveScreenshot('a', 'high', new Uint8Array(50));

      const usage = await storage.getScreenshotMemoryUsage();
      expect(usage).toBe(400);
    });

    it('updates after screenshot deletion', async () => {
      await storage.saveScreenshot('a', 'low', new Uint8Array(100));
      await storage.saveScreenshot('b', 'low', new Uint8Array(200));

      await storage.deleteScreenshots(['a']);

      const usage = await storage.getScreenshotMemoryUsage();
      expect(usage).toBe(200);
    });

    it('updates after screenshot overwrite', async () => {
      await storage.saveScreenshot('a', 'low', new Uint8Array(100));
      await storage.saveScreenshot('a', 'low', new Uint8Array(50));

      const usage = await storage.getScreenshotMemoryUsage();
      expect(usage).toBe(50);
    });
  });

  describe('initial state', () => {
    it('starts with no branches', async () => {
      const summaries = await storage.getBranchSummaries();
      expect(summaries).toEqual([]);
    });

    it('starts with zero screenshot memory usage', async () => {
      const usage = await storage.getScreenshotMemoryUsage();
      expect(usage).toBe(0);
    });
  });

  describe('without probe', () => {
    it('works when no probe is provided', async () => {
      const noProbStorage = new InMemoryTreeStorage();
      const node = makeNode({ id: 'r' });
      await noProbStorage.saveBranch('r', [node]);
      const loaded = await noProbStorage.loadBranch('r');
      expect(loaded).toHaveLength(1);
      await noProbStorage.saveScreenshot('r', 'low', new Uint8Array([1]));
      const ss = await noProbStorage.loadScreenshot('r', 'low');
      expect(ss).toEqual(new Uint8Array([1]));
    });
  });
});
