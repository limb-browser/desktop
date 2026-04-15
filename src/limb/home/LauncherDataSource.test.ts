// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach } from 'vitest';
import { getLauncherData } from './LauncherDataSource';
import { BrowsingTree } from '../tree/BrowsingTree';

// Fixed "now": 2026-04-15 14:00:00 UTC
const NOW = Date.UTC(2026, 3, 15, 14, 0, 0);

describe('getLauncherData', () => {
  let tree: BrowsingTree;

  beforeEach(() => {
    tree = new BrowsingTree('about:limb-home');
  });

  describe('empty state', () => {
    it('returns isEmpty true when root has no children', () => {
      const data = getLauncherData(tree, NOW);
      expect(data.isEmpty).toBe(true);
      expect(data.groups).toEqual([]);
    });
  });

  describe('branch card data', () => {
    it('extracts branch name from node title', () => {
      const branch = tree.addChild(tree.rootId, 'https://example.com');
      branch.title = 'My Research';
      branch.lastVisitedAt = NOW;

      const data = getLauncherData(tree, NOW);
      expect(data.groups[0].branches[0].name).toBe('My Research');
    });

    it('extracts favicon from branch root', () => {
      const branch = tree.addChild(tree.rootId, 'https://example.com');
      branch.favicon = 'https://example.com/favicon.ico';
      branch.lastVisitedAt = NOW;

      const data = getLauncherData(tree, NOW);
      expect(data.groups[0].branches[0].favicon).toBe('https://example.com/favicon.ico');
    });

    it('returns null favicon when none exists', () => {
      const branch = tree.addChild(tree.rootId, 'https://example.com');
      branch.lastVisitedAt = NOW;

      const data = getLauncherData(tree, NOW);
      expect(data.groups[0].branches[0].favicon).toBeNull();
    });

    it('uses descendantCount for node count', () => {
      const branch = tree.addChild(tree.rootId, 'https://a.com');
      tree.addChild(branch.id, 'https://b.com');
      tree.addChild(branch.id, 'https://c.com');
      branch.lastVisitedAt = NOW;

      const data = getLauncherData(tree, NOW);
      // descendantCount = 2 (excludes branch root itself)
      expect(data.groups[0].branches[0].nodeCount).toBe(2);
    });

    it('includes lastVisitedAt timestamp', () => {
      const branch = tree.addChild(tree.rootId, 'https://example.com');
      branch.lastVisitedAt = NOW - 3600_000;

      const data = getLauncherData(tree, NOW);
      expect(data.groups[0].branches[0].lastVisitedAt).toBe(NOW - 3600_000);
    });

    it('includes branch root node id', () => {
      const branch = tree.addChild(tree.rootId, 'https://example.com');
      branch.lastVisitedAt = NOW;

      const data = getLauncherData(tree, NOW);
      expect(data.groups[0].branches[0].id).toBe(branch.id);
    });

    it('includes screenshot as null when not available on node', () => {
      const branch = tree.addChild(tree.rootId, 'https://example.com');
      branch.lastVisitedAt = NOW;

      const data = getLauncherData(tree, NOW);
      expect(data.groups[0].branches[0].screenshot).toBeNull();
    });

    it('includes screenshot data URL when available on node', () => {
      const branch = tree.addChild(tree.rootId, 'https://example.com');
      branch.lastVisitedAt = NOW;
      branch.screenshot = 'data:image/jpeg;base64,/9j/...';

      const data = getLauncherData(tree, NOW);
      expect(data.groups[0].branches[0].screenshot).toBe('data:image/jpeg;base64,/9j/...');
    });
  });

  describe('time grouping', () => {
    it('groups a branch accessed today under "Today"', () => {
      const branch = tree.addChild(tree.rootId, 'https://example.com');
      branch.lastVisitedAt = NOW - 3600_000; // 1 hour ago

      const data = getLauncherData(tree, NOW);
      expect(data.groups).toHaveLength(1);
      expect(data.groups[0].label).toBe('Today');
      expect(data.groups[0].branches).toHaveLength(1);
    });

    it('groups a branch accessed yesterday under "Yesterday"', () => {
      const branch = tree.addChild(tree.rootId, 'https://example.com');
      branch.lastVisitedAt = NOW - 24 * 3600_000; // ~24 hours ago

      const data = getLauncherData(tree, NOW);
      expect(data.groups[0].label).toBe('Yesterday');
    });

    it('groups branches into multiple time groups', () => {
      const today = tree.addChild(tree.rootId, 'https://today.com');
      today.title = 'Today Branch';
      today.lastVisitedAt = NOW - 3600_000;

      const lastWeek = tree.addChild(tree.rootId, 'https://week.com');
      lastWeek.title = 'Week Branch';
      lastWeek.lastVisitedAt = NOW - 4 * 24 * 3600_000; // 4 days ago

      const older = tree.addChild(tree.rootId, 'https://old.com');
      older.title = 'Old Branch';
      older.lastVisitedAt = NOW - 60 * 24 * 3600_000; // 60 days ago

      const data = getLauncherData(tree, NOW);
      const labels = data.groups.map(g => g.label);
      expect(labels).toEqual(['Today', 'This Week', 'February 2026']);
    });

    it('hides empty groups', () => {
      const branch = tree.addChild(tree.rootId, 'https://example.com');
      branch.lastVisitedAt = NOW - 3600_000; // Today

      const data = getLauncherData(tree, NOW);
      // Only "Today" should be present, not Yesterday/This Week/etc
      expect(data.groups).toHaveLength(1);
      expect(data.groups[0].label).toBe('Today');
    });

    it('sorts branches within a group by lastVisitedAt descending (most recent first)', () => {
      const earlier = tree.addChild(tree.rootId, 'https://a.com');
      earlier.title = 'Earlier';
      earlier.lastVisitedAt = NOW - 7200_000; // 2 hours ago

      const later = tree.addChild(tree.rootId, 'https://b.com');
      later.title = 'Later';
      later.lastVisitedAt = NOW - 1800_000; // 30 min ago

      const data = getLauncherData(tree, NOW);
      expect(data.groups[0].branches[0].name).toBe('Later');
      expect(data.groups[0].branches[1].name).toBe('Earlier');
    });
  });

  describe('group ordering', () => {
    it('orders groups chronologically: Today, Yesterday, This Week, This Month, then month labels', () => {
      const times = [
        { offset: 0, label: 'Today' },
        { offset: 1, label: 'Yesterday' },
        { offset: 3, label: 'This Week' },
        { offset: 10, label: 'This Month' },
        { offset: 45, label: 'March 2026' },
      ];

      for (const t of times) {
        const branch = tree.addChild(tree.rootId, `https://${t.label}.com`);
        branch.title = t.label;
        branch.lastVisitedAt = NOW - t.offset * 24 * 3600_000;
      }

      const data = getLauncherData(tree, NOW);
      const labels = data.groups.map(g => g.label);
      expect(labels).toEqual(['Today', 'Yesterday', 'This Week', 'This Month', 'March 2026']);
    });
  });

  describe('older month sub-grouping', () => {
    it('sub-groups older branches by month', () => {
      // Two branches in February 2026, one in January 2026
      const feb1 = tree.addChild(tree.rootId, 'https://feb1.com');
      feb1.title = 'Feb Branch 1';
      feb1.lastVisitedAt = Date.UTC(2026, 1, 15, 12, 0, 0);

      const feb2 = tree.addChild(tree.rootId, 'https://feb2.com');
      feb2.title = 'Feb Branch 2';
      feb2.lastVisitedAt = Date.UTC(2026, 1, 10, 12, 0, 0);

      const jan = tree.addChild(tree.rootId, 'https://jan.com');
      jan.title = 'Jan Branch';
      jan.lastVisitedAt = Date.UTC(2026, 0, 20, 12, 0, 0);

      const data = getLauncherData(tree, NOW);
      const labels = data.groups.map(g => g.label);
      expect(labels).toEqual(['February 2026', 'January 2026']);
    });

    it('orders month sub-groups most recent first', () => {
      const jan = tree.addChild(tree.rootId, 'https://jan.com');
      jan.lastVisitedAt = Date.UTC(2026, 0, 15, 12, 0, 0);

      const dec = tree.addChild(tree.rootId, 'https://dec.com');
      dec.lastVisitedAt = Date.UTC(2025, 11, 15, 12, 0, 0);

      const nov = tree.addChild(tree.rootId, 'https://nov.com');
      nov.lastVisitedAt = Date.UTC(2025, 10, 15, 12, 0, 0);

      const data = getLauncherData(tree, NOW);
      const labels = data.groups.map(g => g.label);
      expect(labels).toEqual(['January 2026', 'December 2025', 'November 2025']);
    });

    it('sorts branches within a month sub-group by lastVisitedAt descending', () => {
      const earlier = tree.addChild(tree.rootId, 'https://earlier.com');
      earlier.title = 'Earlier';
      earlier.lastVisitedAt = Date.UTC(2026, 1, 5, 12, 0, 0);

      const later = tree.addChild(tree.rootId, 'https://later.com');
      later.title = 'Later';
      later.lastVisitedAt = Date.UTC(2026, 1, 20, 12, 0, 0);

      const data = getLauncherData(tree, NOW);
      expect(data.groups[0].label).toBe('February 2026');
      expect(data.groups[0].branches[0].name).toBe('Later');
      expect(data.groups[0].branches[1].name).toBe('Earlier');
    });

    it('places month sub-groups after the fixed time groups', () => {
      const today = tree.addChild(tree.rootId, 'https://today.com');
      today.title = 'Today';
      today.lastVisitedAt = NOW - 3600_000;

      const old = tree.addChild(tree.rootId, 'https://old.com');
      old.title = 'Old';
      old.lastVisitedAt = Date.UTC(2026, 1, 15, 12, 0, 0);

      const data = getLauncherData(tree, NOW);
      const labels = data.groups.map(g => g.label);
      expect(labels).toEqual(['Today', 'February 2026']);
    });
  });

  describe('isEmpty', () => {
    it('returns isEmpty false when branches exist', () => {
      const branch = tree.addChild(tree.rootId, 'https://example.com');
      branch.lastVisitedAt = NOW;

      const data = getLauncherData(tree, NOW);
      expect(data.isEmpty).toBe(false);
    });
  });

  describe('summary node nodeCount', () => {
    it('uses descendantCount for culled branch roots with no loaded children', async () => {
      // Simulate a stored branch loaded via loadSummaries:
      // status: culled, childIds: [], descendantCount: 12
      const branch = tree.addChild(tree.rootId, 'https://stored.com');
      branch.title = 'Stored Branch';
      branch.lastVisitedAt = NOW;
      branch.childIds = [];
      branch.descendantCount = 12;

      const data = getLauncherData(tree, NOW);
      // Should show 12 (the descendantCount), not 1 (getDescendants length)
      expect(data.groups[0].branches[0].nodeCount).toBe(12);
    });

    it('shows both active and stored branches after loadSummaries', async () => {
      // Active branch with real children
      const active = tree.addChild(tree.rootId, 'https://active.com');
      active.title = 'Active Branch';
      active.lastVisitedAt = NOW;
      tree.addChild(active.id, 'https://child1.com');
      tree.addChild(active.id, 'https://child2.com');

      // Stored branch (summary only, no children loaded)
      const stored = tree.addChild(tree.rootId, 'https://stored.com');
      stored.title = 'Stored Branch';
      stored.lastVisitedAt = NOW - 3600_000;
      stored.childIds = [];
      stored.descendantCount = 8;

      const data = getLauncherData(tree, NOW);
      const allBranches = data.groups.flatMap(
        (g: { branches: { name: string; nodeCount: number }[] }) => g.branches
      );
      expect(allBranches).toHaveLength(2);

      const activeBranch = allBranches.find(
        (b: { name: string }) => b.name === 'Active Branch'
      )!;
      const storedBranch = allBranches.find(
        (b: { name: string }) => b.name === 'Stored Branch'
      )!;

      // Active branch: descendantCount = 2 (two children)
      expect(activeBranch.nodeCount).toBe(2);
      // Stored branch: uses descendantCount
      expect(storedBranch.nodeCount).toBe(8);
    });
  });

  describe('card navigation', () => {
    it('branch card id can be used to focus that branch in the tree', () => {
      const branch = tree.addChild(tree.rootId, 'https://example.com');
      branch.title = 'My Branch';
      branch.lastVisitedAt = NOW;

      const data = getLauncherData(tree, NOW);
      const cardId = data.groups[0].branches[0].id;

      tree.focusNode(cardId);
      expect(tree.focusedNodeId).toBe(branch.id);
    });
  });

  describe('root URL', () => {
    it('tree with about:limb-home root produces launcher data', () => {
      const homeTree = new BrowsingTree('about:limb-home');
      const branch = homeTree.addChild(homeTree.rootId, 'https://example.com');
      branch.lastVisitedAt = NOW;

      const data = getLauncherData(homeTree, NOW);
      expect(data.isEmpty).toBe(false);
      expect(homeTree.nodes.get(homeTree.rootId)!.url).toBe('about:limb-home');
    });
  });
});
