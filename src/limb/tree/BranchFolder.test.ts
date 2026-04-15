// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach } from 'vitest';
import { BranchFolder } from './BranchFolder';
import type { BranchFoldProbe } from '../ports/BranchFoldProbe';

function createFakeProbe(): BranchFoldProbe & { calls: { method: string, args: unknown[] }[] } {
  const calls: { method: string, args: unknown[] }[] = [];
  return {
    calls,
    foldComputed(recentCount, foldNodeCount) {
      calls.push({ method: 'foldComputed', args: [recentCount, foldNodeCount] });
    },
    foldExpanded(foldId) {
      calls.push({ method: 'foldExpanded', args: [foldId] });
    },
    foldCollapsed(foldId) {
      calls.push({ method: 'foldCollapsed', args: [foldId] });
    },
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe('BranchFolder', () => {
  let folder: BranchFolder;
  let probe: ReturnType<typeof createFakeProbe>;

  beforeEach(() => {
    probe = createFakeProbe();
    folder = new BranchFolder(probe);
  });

  describe('recent branches are not folded', () => {
    it('keeps branches visited within the last 7 days as individual nodes', () => {
      const now = Date.now();
      const branches = [
        { id: 'b1', lastVisitedAt: now - 1 * DAY_MS },
        { id: 'b2', lastVisitedAt: now - 3 * DAY_MS },
        { id: 'b3', lastVisitedAt: now - 6 * DAY_MS },
      ];

      const result = folder.computeFolds(branches, now);

      expect(result.visibleChildIds).toContain('b1');
      expect(result.visibleChildIds).toContain('b2');
      expect(result.visibleChildIds).toContain('b3');
      expect(result.foldNodes.size).toBe(0);
    });

    it('orders recent branches by recency (most recent first)', () => {
      const now = Date.now();
      const branches = [
        { id: 'b-oldest', lastVisitedAt: now - 5 * DAY_MS },
        { id: 'b-newest', lastVisitedAt: now - 1 * DAY_MS },
        { id: 'b-middle', lastVisitedAt: now - 3 * DAY_MS },
      ];

      const result = folder.computeFolds(branches, now);

      expect(result.visibleChildIds).toEqual(['b-newest', 'b-middle', 'b-oldest']);
    });
  });

  describe('branches older than 7 days are folded', () => {
    it('folds branches visited more than 7 days ago into fold nodes', () => {
      const now = new Date('2026-04-15T12:00:00Z').getTime();
      const branches = [
        { id: 'recent', lastVisitedAt: now - 2 * DAY_MS },
        { id: 'old1', lastVisitedAt: new Date('2026-03-10T12:00:00Z').getTime() },
        { id: 'old2', lastVisitedAt: new Date('2026-03-15T12:00:00Z').getTime() },
      ];

      const result = folder.computeFolds(branches, now);

      expect(result.visibleChildIds).toContain('recent');
      expect(result.visibleChildIds).not.toContain('old1');
      expect(result.visibleChildIds).not.toContain('old2');
      expect(result.foldNodes.size).toBe(1);
    });

    it('uses strict > for the 7-day threshold', () => {
      const now = Date.now();
      // Exactly 7 days ago is NOT older than 7 days
      const branches = [
        { id: 'exactly-7', lastVisitedAt: now - 7 * DAY_MS },
      ];

      const result = folder.computeFolds(branches, now);

      // 7 days ago is recent (not > 7 days)
      expect(result.visibleChildIds).toContain('exactly-7');
      expect(result.foldNodes.size).toBe(0);
    });

    it('folds a branch visited 8 days ago', () => {
      const now = new Date('2026-04-15T12:00:00Z').getTime();
      const branches = [
        { id: 'old', lastVisitedAt: now - 8 * DAY_MS },
      ];

      const result = folder.computeFolds(branches, now);

      expect(result.visibleChildIds).not.toContain('old');
      expect(result.foldNodes.size).toBe(1);
    });
  });

  describe('fold node displays correct month and count', () => {
    it('creates a fold node with month label and branch count', () => {
      const now = new Date('2026-04-15T12:00:00Z').getTime();
      const branches = [
        { id: 'old1', lastVisitedAt: new Date('2026-03-10T12:00:00Z').getTime() },
        { id: 'old2', lastVisitedAt: new Date('2026-03-20T12:00:00Z').getTime() },
        { id: 'old3', lastVisitedAt: new Date('2026-03-25T12:00:00Z').getTime() },
      ];

      const result = folder.computeFolds(branches, now);
      const foldNode = result.foldNodes.get('fold:2026-03');

      expect(foldNode).toBeDefined();
      expect(foldNode!.monthLabel).toBe('Mar 2026');
      expect(foldNode!.branchCount).toBe(3);
      expect(foldNode!.branchIds).toEqual(expect.arrayContaining(['old1', 'old2', 'old3']));
    });

    it('creates separate fold nodes for different months', () => {
      const now = new Date('2026-04-15T12:00:00Z').getTime();
      const branches = [
        { id: 'feb1', lastVisitedAt: new Date('2026-02-05T12:00:00Z').getTime() },
        { id: 'feb2', lastVisitedAt: new Date('2026-02-15T12:00:00Z').getTime() },
        { id: 'jan1', lastVisitedAt: new Date('2026-01-10T12:00:00Z').getTime() },
      ];

      const result = folder.computeFolds(branches, now);

      expect(result.foldNodes.size).toBe(2);
      const febFold = result.foldNodes.get('fold:2026-02');
      const janFold = result.foldNodes.get('fold:2026-01');
      expect(febFold).toBeDefined();
      expect(febFold!.monthLabel).toBe('Feb 2026');
      expect(febFold!.branchCount).toBe(2);
      expect(janFold).toBeDefined();
      expect(janFold!.monthLabel).toBe('Jan 2026');
      expect(janFold!.branchCount).toBe(1);
    });

    it('orders fold nodes by month with most recent first', () => {
      const now = new Date('2026-04-15T12:00:00Z').getTime();
      const branches = [
        { id: 'jan', lastVisitedAt: new Date('2026-01-10T12:00:00Z').getTime() },
        { id: 'mar', lastVisitedAt: new Date('2026-03-10T12:00:00Z').getTime() },
        { id: 'feb', lastVisitedAt: new Date('2026-02-10T12:00:00Z').getTime() },
      ];

      const result = folder.computeFolds(branches, now);

      // Fold node IDs should appear in recent-first order
      const foldIds = result.visibleChildIds.filter(id => id.startsWith('fold:'));
      expect(foldIds).toEqual(['fold:2026-03', 'fold:2026-02', 'fold:2026-01']);
    });

    it('places recent branches before fold nodes in visibleChildIds', () => {
      const now = new Date('2026-04-15T12:00:00Z').getTime();
      const branches = [
        { id: 'recent', lastVisitedAt: now - 1 * DAY_MS },
        { id: 'old', lastVisitedAt: new Date('2026-03-10T12:00:00Z').getTime() },
      ];

      const result = folder.computeFolds(branches, now);

      expect(result.visibleChildIds.indexOf('recent')).toBeLessThan(
        result.visibleChildIds.indexOf('fold:2026-03')
      );
    });
  });

  describe('clicking a fold node expands it', () => {
    it('toggleFold expands a collapsed fold', () => {
      const now = new Date('2026-04-15T12:00:00Z').getTime();
      const branches = [
        { id: 'old1', lastVisitedAt: new Date('2026-03-10T12:00:00Z').getTime() },
        { id: 'old2', lastVisitedAt: new Date('2026-03-20T12:00:00Z').getTime() },
      ];

      folder.computeFolds(branches, now);
      folder.toggleFold('fold:2026-03');

      expect(folder.isExpanded('fold:2026-03')).toBe(true);
    });

    it('expanded fold shows individual branches in recomputed folds', () => {
      const now = new Date('2026-04-15T12:00:00Z').getTime();
      const branches = [
        { id: 'old1', lastVisitedAt: new Date('2026-03-10T12:00:00Z').getTime() },
        { id: 'old2', lastVisitedAt: new Date('2026-03-20T12:00:00Z').getTime() },
      ];

      folder.computeFolds(branches, now);
      folder.toggleFold('fold:2026-03');
      const result = folder.computeFolds(branches, now);

      expect(result.visibleChildIds).toContain('old1');
      expect(result.visibleChildIds).toContain('old2');
      expect(result.visibleChildIds).not.toContain('fold:2026-03');
      expect(result.foldNodes.has('fold:2026-03')).toBe(false);
    });

    it('expanded fold branches are ordered by recency', () => {
      const now = new Date('2026-04-15T12:00:00Z').getTime();
      const branches = [
        { id: 'old-early', lastVisitedAt: new Date('2026-03-05T12:00:00Z').getTime() },
        { id: 'old-late', lastVisitedAt: new Date('2026-03-25T12:00:00Z').getTime() },
        { id: 'old-mid', lastVisitedAt: new Date('2026-03-15T12:00:00Z').getTime() },
      ];

      folder.computeFolds(branches, now);
      folder.toggleFold('fold:2026-03');
      const result = folder.computeFolds(branches, now);

      const idx = (id: string) => result.visibleChildIds.indexOf(id);
      expect(idx('old-late')).toBeLessThan(idx('old-mid'));
      expect(idx('old-mid')).toBeLessThan(idx('old-early'));
    });
  });

  describe('re-folding', () => {
    it('toggleFold collapses an expanded fold', () => {
      const now = new Date('2026-04-15T12:00:00Z').getTime();
      const branches = [
        { id: 'old1', lastVisitedAt: new Date('2026-03-10T12:00:00Z').getTime() },
      ];

      folder.computeFolds(branches, now);
      folder.toggleFold('fold:2026-03');
      expect(folder.isExpanded('fold:2026-03')).toBe(true);

      folder.toggleFold('fold:2026-03');
      expect(folder.isExpanded('fold:2026-03')).toBe(false);
    });

    it('re-folded fold shows the fold node again', () => {
      const now = new Date('2026-04-15T12:00:00Z').getTime();
      const branches = [
        { id: 'old1', lastVisitedAt: new Date('2026-03-10T12:00:00Z').getTime() },
      ];

      // Expand then collapse
      folder.computeFolds(branches, now);
      folder.toggleFold('fold:2026-03');
      folder.toggleFold('fold:2026-03');
      const result = folder.computeFolds(branches, now);

      expect(result.visibleChildIds).toContain('fold:2026-03');
      expect(result.visibleChildIds).not.toContain('old1');
      expect(result.foldNodes.has('fold:2026-03')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles empty branch list', () => {
      const result = folder.computeFolds([], Date.now());

      expect(result.visibleChildIds).toEqual([]);
      expect(result.foldNodes.size).toBe(0);
    });

    it('handles all branches being recent', () => {
      const now = Date.now();
      const branches = [
        { id: 'b1', lastVisitedAt: now - 1 * DAY_MS },
        { id: 'b2', lastVisitedAt: now - 2 * DAY_MS },
      ];

      const result = folder.computeFolds(branches, now);

      expect(result.visibleChildIds).toEqual(['b1', 'b2']);
      expect(result.foldNodes.size).toBe(0);
    });

    it('handles all branches being older than 7 days', () => {
      const now = new Date('2026-04-15T12:00:00Z').getTime();
      const branches = [
        { id: 'old1', lastVisitedAt: new Date('2026-03-10T12:00:00Z').getTime() },
        { id: 'old2', lastVisitedAt: new Date('2026-02-10T12:00:00Z').getTime() },
      ];

      const result = folder.computeFolds(branches, now);

      const branchIds = result.visibleChildIds.filter(id => !id.startsWith('fold:'));
      expect(branchIds).toEqual([]);
      expect(result.foldNodes.size).toBe(2);
    });

    it('handles branches spanning year boundaries', () => {
      const now = new Date('2026-02-15T12:00:00Z').getTime();
      const branches = [
        { id: 'dec', lastVisitedAt: new Date('2025-12-10T12:00:00Z').getTime() },
      ];

      const result = folder.computeFolds(branches, now);

      const foldNode = result.foldNodes.get('fold:2025-12');
      expect(foldNode).toBeDefined();
      expect(foldNode!.monthLabel).toBe('Dec 2025');
    });
  });

  describe('probe calls', () => {
    it('fires foldComputed when folds are computed', () => {
      const now = new Date('2026-04-15T12:00:00Z').getTime();
      const branches = [
        { id: 'recent', lastVisitedAt: now - 1 * DAY_MS },
        { id: 'old1', lastVisitedAt: new Date('2026-03-10T12:00:00Z').getTime() },
        { id: 'old2', lastVisitedAt: new Date('2026-02-10T12:00:00Z').getTime() },
      ];

      folder.computeFolds(branches, now);

      const foldComputedCalls = probe.calls.filter(c => c.method === 'foldComputed');
      expect(foldComputedCalls).toHaveLength(1);
      expect(foldComputedCalls[0].args).toEqual([1, 2]); // 1 recent, 2 fold nodes
    });

    it('fires foldExpanded on toggle open', () => {
      folder.toggleFold('fold:2026-03');

      const expandedCalls = probe.calls.filter(c => c.method === 'foldExpanded');
      expect(expandedCalls).toHaveLength(1);
      expect(expandedCalls[0].args).toEqual(['fold:2026-03']);
    });

    it('fires foldCollapsed on toggle close', () => {
      folder.toggleFold('fold:2026-03'); // expand
      folder.toggleFold('fold:2026-03'); // collapse

      const collapsedCalls = probe.calls.filter(c => c.method === 'foldCollapsed');
      expect(collapsedCalls).toHaveLength(1);
      expect(collapsedCalls[0].args).toEqual(['fold:2026-03']);
    });
  });

  describe('without probe', () => {
    it('works without a probe', () => {
      const folderNoProbe = new BranchFolder();
      const now = new Date('2026-04-15T12:00:00Z').getTime();
      const branches = [
        { id: 'old', lastVisitedAt: new Date('2026-03-10T12:00:00Z').getTime() },
      ];

      const result = folderNoProbe.computeFolds(branches, now);
      expect(result.foldNodes.size).toBe(1);

      folderNoProbe.toggleFold('fold:2026-03');
      expect(folderNoProbe.isExpanded('fold:2026-03')).toBe(true);
    });
  });
});
