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

    it('counts descendants including branch root', () => {
      const branch = tree.addChild(tree.rootId, 'https://a.com');
      tree.addChild(branch.id, 'https://b.com');
      tree.addChild(branch.id, 'https://c.com');
      branch.lastVisitedAt = NOW;

      const data = getLauncherData(tree, NOW);
      expect(data.groups[0].branches[0].nodeCount).toBe(3);
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
      expect(labels).toEqual(['Today', 'This Week', 'Older']);
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
    it('orders groups chronologically: Today, Yesterday, This Week, This Month, Older', () => {
      const times = [
        { offset: 0, label: 'Today' },
        { offset: 1, label: 'Yesterday' },
        { offset: 3, label: 'This Week' },
        { offset: 10, label: 'This Month' },
        { offset: 45, label: 'Older' },
      ];

      for (const t of times) {
        const branch = tree.addChild(tree.rootId, `https://${t.label}.com`);
        branch.title = t.label;
        branch.lastVisitedAt = NOW - t.offset * 24 * 3600_000;
      }

      const data = getLauncherData(tree, NOW);
      const labels = data.groups.map(g => g.label);
      expect(labels).toEqual(['Today', 'Yesterday', 'This Week', 'This Month', 'Older']);
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
