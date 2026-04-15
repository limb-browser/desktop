// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ScreenshotEvictor } from './ScreenshotEvictor';
import { InMemoryTreeStorage } from './InMemoryTreeStorage';
import { BrowsingTree } from './BrowsingTree';
import { InMemoryPrefsPort } from '../settings/InMemoryPrefsPort';
import type { StoredNode } from '../ports/TreeStoragePort';
import type { ScreenshotEvictorProbe } from '../ports/ScreenshotEvictorProbe';

const MB = 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

interface ProbeEvent {
  method: string;
  args: unknown[];
}

function recordingProbe(): {
  probe: ScreenshotEvictorProbe;
  events: ProbeEvent[];
} {
  const events: ProbeEvent[] = [];
  const probe: ScreenshotEvictorProbe = {
    evictionStarted() {
      events.push({ method: 'evictionStarted', args: [] });
    },
    retentionEvicted(branchRootId, nodeCount) {
      events.push({
        method: 'retentionEvicted',
        args: [branchRootId, nodeCount],
      });
    },
    budgetEvicted(nodeId) {
      events.push({ method: 'budgetEvicted', args: [nodeId] });
    },
    evictionCompleted(screenshotsRemoved) {
      events.push({
        method: 'evictionCompleted',
        args: [screenshotsRemoved],
      });
    },
  };
  return { probe, events };
}

function makeNode(
  overrides: Partial<StoredNode> & { id: string }
): StoredNode {
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

function makeBlob(sizeBytes: number): Uint8Array {
  return new Uint8Array(sizeBytes);
}

interface TestContext {
  storage: InMemoryTreeStorage;
  tree: BrowsingTree;
  prefs: InMemoryPrefsPort;
  evictor: ScreenshotEvictor;
  probeEvents: ProbeEvent[];
}

function setup(): TestContext {
  const storage = new InMemoryTreeStorage();
  const tree = new BrowsingTree('about:blank');
  const prefs = new InMemoryPrefsPort();
  const { probe, events } = recordingProbe();
  const evictor = new ScreenshotEvictor(storage, tree, prefs, probe);
  return { storage, tree, prefs, evictor, probeEvents: events };
}

/** Save a branch to storage with a given lastVisitedAt on its root. */
async function saveBranchWithAge(
  ctx: TestContext,
  branchRootId: string,
  lastVisitedAt: number,
  childIds: string[] = []
): Promise<void> {
  const nodes: StoredNode[] = [
    makeNode({
      id: branchRootId,
      parentId: ctx.tree.rootId,
      childIds,
      lastVisitedAt,
      descendantCount: childIds.length,
      branchRootId,
    }),
    ...childIds.map((childId) =>
      makeNode({
        id: childId,
        parentId: branchRootId,
        lastVisitedAt,
        branchRootId,
      })
    ),
  ];
  await ctx.storage.saveBranch(branchRootId, nodes);

  // Add branch root to tree (simulating loadSummaries)
  const root = ctx.tree.nodes.get(ctx.tree.rootId)!;
  if (!ctx.tree.nodes.has(branchRootId)) {
    ctx.tree.nodes.set(branchRootId, {
      id: branchRootId,
      url: 'https://example.com',
      title: 'Example',
      favicon: null,
      screenshot: null,
      parentId: ctx.tree.rootId,
      childIds: [],
      status: 'culled',
      createdAt: 1000,
      lastVisitedAt,
      descendantCount: childIds.length,
    });
    root.childIds.push(branchRootId);
    root.descendantCount++;
  }
}

describe('ScreenshotEvictor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('time-based retention', () => {
    it('keeps all screenshots for branches within retention window', async () => {
      const now = Date.now();
      const ctx = setup();

      // Branch visited 3 days ago (within 7-day window)
      const recentTime = now - 3 * DAY_MS;
      await saveBranchWithAge(ctx, 'recent-branch', recentTime, [
        'child-1',
        'child-2',
      ]);
      await ctx.storage.saveScreenshot(
        'recent-branch',
        'low',
        makeBlob(100)
      );
      await ctx.storage.saveScreenshot('child-1', 'low', makeBlob(100));
      await ctx.storage.saveScreenshot('child-2', 'low', makeBlob(100));

      await ctx.evictor.evict();

      // All screenshots should be retained
      expect(await ctx.storage.loadScreenshot('recent-branch', 'low')).not.toBeNull();
      expect(await ctx.storage.loadScreenshot('child-1', 'low')).not.toBeNull();
      expect(await ctx.storage.loadScreenshot('child-2', 'low')).not.toBeNull();
    });

    it('keeps only root screenshot for branches older than retention days', async () => {
      const now = Date.now();
      const ctx = setup();

      // Branch visited 10 days ago (outside 7-day window)
      const oldTime = now - 10 * DAY_MS;
      await saveBranchWithAge(ctx, 'old-branch', oldTime, [
        'old-child-1',
        'old-child-2',
      ]);
      await ctx.storage.saveScreenshot('old-branch', 'low', makeBlob(100));
      await ctx.storage.saveScreenshot('old-child-1', 'low', makeBlob(100));
      await ctx.storage.saveScreenshot('old-child-2', 'low', makeBlob(100));

      await ctx.evictor.evict();

      // Root screenshot kept, children evicted
      expect(
        await ctx.storage.loadScreenshot('old-branch', 'low')
      ).not.toBeNull();
      expect(
        await ctx.storage.loadScreenshot('old-child-1', 'low')
      ).toBeNull();
      expect(
        await ctx.storage.loadScreenshot('old-child-2', 'low')
      ).toBeNull();
    });

    it('keeps all screenshots for the active branch regardless of age', async () => {
      const now = Date.now();
      const ctx = setup();

      // Old branch that is currently active
      const oldTime = now - 10 * DAY_MS;
      await saveBranchWithAge(ctx, 'active-old', oldTime, ['active-child']);
      await ctx.storage.saveScreenshot('active-old', 'low', makeBlob(100));
      await ctx.storage.saveScreenshot('active-child', 'low', makeBlob(100));

      ctx.tree.activeBranchId = 'active-old';

      await ctx.evictor.evict();

      // All screenshots retained because branch is active
      expect(
        await ctx.storage.loadScreenshot('active-old', 'low')
      ).not.toBeNull();
      expect(
        await ctx.storage.loadScreenshot('active-child', 'low')
      ).not.toBeNull();
    });

    it('respects custom retention-days preference', async () => {
      const now = Date.now();
      const ctx = setup();
      ctx.prefs.setIntPref('limb.screenshots.retention-days', 3);

      // Branch visited 5 days ago (outside custom 3-day window)
      const time = now - 5 * DAY_MS;
      await saveBranchWithAge(ctx, 'branch', time, ['child']);
      await ctx.storage.saveScreenshot('branch', 'low', makeBlob(100));
      await ctx.storage.saveScreenshot('child', 'low', makeBlob(100));

      await ctx.evictor.evict();

      // Root kept, child evicted (outside 3-day window)
      expect(await ctx.storage.loadScreenshot('branch', 'low')).not.toBeNull();
      expect(await ctx.storage.loadScreenshot('child', 'low')).toBeNull();
    });

    it('fires retentionEvicted probe for each evicted branch', async () => {
      const now = Date.now();
      const ctx = setup();

      const oldTime = now - 10 * DAY_MS;
      await saveBranchWithAge(ctx, 'old-1', oldTime, ['old-1-child']);
      await ctx.storage.saveScreenshot('old-1-child', 'low', makeBlob(100));

      await ctx.evictor.evict();

      expect(ctx.probeEvents).toContainEqual({
        method: 'retentionEvicted',
        args: ['old-1', 1],
      });
    });
  });

  describe('memory budget eviction', () => {
    it('evicts oldest screenshots when total exceeds 20MB', async () => {
      const now = Date.now();
      const ctx = setup();

      // Two recent branches, each with large screenshots
      const recentTime = now - 1 * DAY_MS;
      await saveBranchWithAge(ctx, 'branch-a', recentTime, ['a-child']);
      await saveBranchWithAge(ctx, 'branch-b', recentTime, ['b-child']);

      // Save screenshots totaling > 20MB
      // a-child: older screenshot (capturedAt set by saveScreenshot = Date.now())
      vi.setSystemTime(now - 2000);
      await ctx.storage.saveScreenshot('a-child', 'low', makeBlob(8 * MB));
      vi.setSystemTime(now - 1000);
      await ctx.storage.saveScreenshot('b-child', 'low', makeBlob(8 * MB));
      vi.setSystemTime(now);
      await ctx.storage.saveScreenshot('branch-a', 'low', makeBlob(5 * MB));
      await ctx.storage.saveScreenshot('branch-b', 'low', makeBlob(5 * MB));

      // Total: 26MB, budget is 20MB
      await ctx.evictor.evict();

      // a-child is oldest non-root, should be evicted first
      expect(await ctx.storage.loadScreenshot('a-child', 'low')).toBeNull();
      // branch roots should be retained
      expect(
        await ctx.storage.loadScreenshot('branch-a', 'low')
      ).not.toBeNull();
      expect(
        await ctx.storage.loadScreenshot('branch-b', 'low')
      ).not.toBeNull();
    });

    it('does not evict when under 20MB budget', async () => {
      const now = Date.now();
      const ctx = setup();

      const recentTime = now - 1 * DAY_MS;
      await saveBranchWithAge(ctx, 'branch', recentTime, ['child']);
      await ctx.storage.saveScreenshot('branch', 'low', makeBlob(5 * MB));
      await ctx.storage.saveScreenshot('child', 'low', makeBlob(5 * MB));

      // Total: 10MB, under budget
      await ctx.evictor.evict();

      expect(
        await ctx.storage.loadScreenshot('branch', 'low')
      ).not.toBeNull();
      expect(await ctx.storage.loadScreenshot('child', 'low')).not.toBeNull();
    });

    it('fires budgetEvicted probe for each evicted node', async () => {
      const now = Date.now();
      const ctx = setup();

      const recentTime = now - 1 * DAY_MS;
      await saveBranchWithAge(ctx, 'branch', recentTime, ['child']);

      vi.setSystemTime(now - 1000);
      await ctx.storage.saveScreenshot('child', 'low', makeBlob(15 * MB));
      vi.setSystemTime(now);
      await ctx.storage.saveScreenshot('branch', 'low', makeBlob(8 * MB));

      // Total: 23MB
      await ctx.evictor.evict();

      expect(ctx.probeEvents).toContainEqual({
        method: 'budgetEvicted',
        args: ['child'],
      });
    });

    it('does not evict active branch screenshots for memory budget', async () => {
      const now = Date.now();
      const ctx = setup();

      const recentTime = now - 1 * DAY_MS;
      await saveBranchWithAge(ctx, 'active', recentTime, ['active-child']);
      await saveBranchWithAge(ctx, 'inactive', recentTime, [
        'inactive-child',
      ]);

      ctx.tree.activeBranchId = 'active';
      // Simulate active branch having children loaded in tree
      const activeBranchRoot = ctx.tree.nodes.get('active')!;
      activeBranchRoot.childIds = ['active-child'];
      ctx.tree.nodes.set('active-child', {
        id: 'active-child',
        url: 'https://example.com',
        title: 'Child',
        favicon: null,
        screenshot: null,
        parentId: 'active',
        childIds: [],
        status: 'culled',
        createdAt: 1000,
        lastVisitedAt: recentTime,
        descendantCount: 0,
      });

      vi.setSystemTime(now - 2000);
      await ctx.storage.saveScreenshot(
        'active-child',
        'low',
        makeBlob(8 * MB)
      );
      vi.setSystemTime(now - 1000);
      await ctx.storage.saveScreenshot(
        'inactive-child',
        'low',
        makeBlob(8 * MB)
      );
      vi.setSystemTime(now);
      await ctx.storage.saveScreenshot('active', 'low', makeBlob(5 * MB));
      await ctx.storage.saveScreenshot('inactive', 'low', makeBlob(5 * MB));

      // Total: 26MB. active-child is oldest but in active branch.
      await ctx.evictor.evict();

      // Active branch screenshots preserved
      expect(
        await ctx.storage.loadScreenshot('active-child', 'low')
      ).not.toBeNull();
      // Inactive non-root evicted
      expect(
        await ctx.storage.loadScreenshot('inactive-child', 'low')
      ).toBeNull();
    });

    it('does not evict branch root screenshots for memory budget', async () => {
      const now = Date.now();
      const ctx = setup();

      const recentTime = now - 1 * DAY_MS;
      await saveBranchWithAge(ctx, 'branch-x', recentTime);

      vi.setSystemTime(now - 1000);
      await ctx.storage.saveScreenshot(
        'branch-x',
        'low',
        makeBlob(25 * MB)
      );
      vi.setSystemTime(now);

      // Total: 25MB, but only branch root screenshots exist
      await ctx.evictor.evict();

      // Branch root screenshots not evicted even over budget
      expect(
        await ctx.storage.loadScreenshot('branch-x', 'low')
      ).not.toBeNull();
    });
  });

  describe('eviction scheduling', () => {
    it('runs eviction on install (startup)', async () => {
      const now = Date.now();
      const ctx = setup();

      const oldTime = now - 10 * DAY_MS;
      await saveBranchWithAge(ctx, 'old', oldTime, ['old-child']);
      await ctx.storage.saveScreenshot('old-child', 'low', makeBlob(100));

      ctx.evictor.install();
      // Flush microtasks for the async eviction without advancing the clock
      await vi.advanceTimersByTimeAsync(0);

      // Old branch child should be evicted
      expect(await ctx.storage.loadScreenshot('old-child', 'low')).toBeNull();

      ctx.evictor.uninstall();
    });

    it('runs eviction every hour', async () => {
      const now = Date.now();
      const ctx = setup();

      ctx.evictor.install();
      await vi.advanceTimersByTimeAsync(0);

      // Add old branch data after initial eviction
      const oldTime = now - 10 * DAY_MS;
      await saveBranchWithAge(ctx, 'old', oldTime, ['old-child']);
      await ctx.storage.saveScreenshot('old-child', 'low', makeBlob(100));

      // Advance 1 hour
      await vi.advanceTimersByTimeAsync(HOUR_MS);

      // Hourly eviction should have cleaned up
      expect(await ctx.storage.loadScreenshot('old-child', 'low')).toBeNull();

      ctx.evictor.uninstall();
    });

    it('is idempotent when install is called twice', async () => {
      const ctx = setup();

      ctx.evictor.install();
      ctx.evictor.install(); // second call should be no-op
      await vi.advanceTimersByTimeAsync(0);

      // Only one eviction should have run (not two)
      const startEvents = ctx.probeEvents.filter(
        (e) => e.method === 'evictionStarted'
      );
      expect(startEvents).toHaveLength(1);

      ctx.evictor.uninstall();
    });

    it('stops hourly eviction on uninstall', async () => {
      const now = Date.now();
      const ctx = setup();

      ctx.evictor.install();
      await vi.advanceTimersByTimeAsync(0);

      ctx.evictor.uninstall();

      // Add old branch data after uninstall
      const oldTime = now - 10 * DAY_MS;
      await saveBranchWithAge(ctx, 'old', oldTime, ['old-child']);
      await ctx.storage.saveScreenshot('old-child', 'low', makeBlob(100));

      // Advance 1 hour - should NOT trigger eviction
      await vi.advanceTimersByTimeAsync(HOUR_MS);

      // Screenshot should still exist (no eviction ran)
      expect(
        await ctx.storage.loadScreenshot('old-child', 'low')
      ).not.toBeNull();
    });
  });

  describe('probe lifecycle', () => {
    it('fires evictionStarted and evictionCompleted', async () => {
      const ctx = setup();
      await ctx.evictor.evict();

      expect(ctx.probeEvents[0]).toEqual({
        method: 'evictionStarted',
        args: [],
      });
      expect(ctx.probeEvents[ctx.probeEvents.length - 1]).toEqual({
        method: 'evictionCompleted',
        args: [0],
      });
    });

    it('reports correct count of removed screenshots', async () => {
      const now = Date.now();
      const ctx = setup();

      const oldTime = now - 10 * DAY_MS;
      await saveBranchWithAge(ctx, 'old', oldTime, ['c1', 'c2']);
      await ctx.storage.saveScreenshot('c1', 'low', makeBlob(100));
      await ctx.storage.saveScreenshot('c2', 'low', makeBlob(100));

      await ctx.evictor.evict();

      const completed = ctx.probeEvents.find(
        (e) => e.method === 'evictionCompleted'
      );
      expect(completed).toEqual({
        method: 'evictionCompleted',
        args: [2],
      });
    });
  });

  describe('without probe', () => {
    it('operates correctly when no probe is provided', async () => {
      const now = Date.now();
      const storage = new InMemoryTreeStorage();
      const tree = new BrowsingTree('about:blank');
      const prefs = new InMemoryPrefsPort();
      const evictor = new ScreenshotEvictor(storage, tree, prefs);

      const oldTime = now - 10 * DAY_MS;
      const branchRootId = 'old-branch';
      const nodes: StoredNode[] = [
        makeNode({
          id: branchRootId,
          parentId: tree.rootId,
          childIds: ['child'],
          lastVisitedAt: oldTime,
          descendantCount: 1,
          branchRootId,
        }),
        makeNode({
          id: 'child',
          parentId: branchRootId,
          lastVisitedAt: oldTime,
          branchRootId,
        }),
      ];
      await storage.saveBranch(branchRootId, nodes);

      const root = tree.nodes.get(tree.rootId)!;
      tree.nodes.set(branchRootId, {
        id: branchRootId,
        url: 'https://example.com',
        title: 'Example',
        favicon: null,
        screenshot: null,
        parentId: tree.rootId,
        childIds: [],
        status: 'culled',
        createdAt: 1000,
        lastVisitedAt: oldTime,
        descendantCount: 1,
      });
      root.childIds.push(branchRootId);

      await storage.saveScreenshot('child', 'low', makeBlob(100));

      await evictor.evict();

      expect(await storage.loadScreenshot('child', 'low')).toBeNull();
    });
  });
});
