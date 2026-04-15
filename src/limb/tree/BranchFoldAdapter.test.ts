// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach } from 'vitest';
import { BrowsingTree } from './BrowsingTree';
import { BranchFoldAdapter } from './BranchFoldAdapter.mjs';
import type { BranchFoldProbe } from '../ports/BranchFoldProbe';

const DAY_MS = 24 * 60 * 60 * 1000;

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

function createFakeTreeView() {
  const calls: { method: string, args: unknown[] }[] = [];
  return {
    calls,
    setTreeData(positions: Map<string, unknown>, parentMap: Map<string, string>, treeExtent: unknown, focusedNodeId: string, titles: Map<string, string>) {
      calls.push({ method: 'setTreeData', args: [positions, parentMap, treeExtent, focusedNodeId, titles] });
    },
    setFoldNodes(foldNodes: Map<string, unknown>) {
      calls.push({ method: 'setFoldNodes', args: [foldNodes] });
    },
  };
}

function createTreeWithBranches(now: number) {
  const tree = new BrowsingTree('about:limb-home');
  // Recent branch (2 days ago)
  const recent = tree.addChild(tree.rootId, 'https://recent.com');
  recent.lastVisitedAt = now - 2 * DAY_MS;
  recent.title = 'Recent Branch';

  // Old branch (30 days ago, March 2026)
  const old = tree.addChild(tree.rootId, 'https://old.com');
  old.lastVisitedAt = now - 30 * DAY_MS;
  old.title = 'Old Branch';

  return { tree, recent, old };
}

describe('BranchFoldAdapter', () => {
  let probe: ReturnType<typeof createFakeProbe>;
  let fakeView: ReturnType<typeof createFakeTreeView>;

  beforeEach(() => {
    probe = createFakeProbe();
    fakeView = createFakeTreeView();
  });

  describe('updateLayout', () => {
    it('calls setFoldNodes and setTreeData on the view', () => {
      const now = Date.now();
      const { tree } = createTreeWithBranches(now);
      const adapter = new BranchFoldAdapter(tree, fakeView, probe);

      adapter.updateLayout();

      const setFoldNodesCalls = fakeView.calls.filter(c => c.method === 'setFoldNodes');
      const setTreeDataCalls = fakeView.calls.filter(c => c.method === 'setTreeData');
      expect(setFoldNodesCalls).toHaveLength(1);
      expect(setTreeDataCalls).toHaveLength(1);
    });

    it('provides fold nodes for old branches', () => {
      const now = Date.now();
      const { tree } = createTreeWithBranches(now);
      const adapter = new BranchFoldAdapter(tree, fakeView, probe);

      adapter.updateLayout();

      const setFoldNodesCalls = fakeView.calls.filter(c => c.method === 'setFoldNodes');
      const foldNodes = setFoldNodesCalls[0].args[0] as Map<string, unknown>;
      expect(foldNodes.size).toBeGreaterThan(0);
    });

    it('provides positions that include the root and recent branches', () => {
      const now = Date.now();
      const { tree, recent } = createTreeWithBranches(now);
      const adapter = new BranchFoldAdapter(tree, fakeView, probe);

      adapter.updateLayout();

      const setTreeDataCalls = fakeView.calls.filter(c => c.method === 'setTreeData');
      const positions = setTreeDataCalls[0].args[0] as Map<string, unknown>;
      expect(positions.has(tree.rootId)).toBe(true);
      expect(positions.has(recent.id)).toBe(true);
    });

    it('fires the foldComputed probe event', () => {
      const now = Date.now();
      const { tree } = createTreeWithBranches(now);
      const adapter = new BranchFoldAdapter(tree, fakeView, probe);

      adapter.updateLayout();

      const foldComputedCalls = probe.calls.filter(c => c.method === 'foldComputed');
      expect(foldComputedCalls).toHaveLength(1);
    });
  });

  describe('handleFoldToggle', () => {
    it('toggles the fold and recomputes layout', () => {
      const now = Date.now();
      const { tree, old } = createTreeWithBranches(now);
      const adapter = new BranchFoldAdapter(tree, fakeView, probe);

      adapter.updateLayout();
      const firstFoldNodesCalls = fakeView.calls.filter(c => c.method === 'setFoldNodes');
      const foldNodes = firstFoldNodesCalls[0].args[0] as Map<string, unknown>;
      const foldId = [...foldNodes.keys()][0];

      // Toggle the fold
      adapter.handleFoldToggle(foldId);

      // After toggling, the old branch should be visible in positions
      const setTreeDataCalls = fakeView.calls.filter(c => c.method === 'setTreeData');
      const lastCall = setTreeDataCalls[setTreeDataCalls.length - 1];
      const positions = lastCall.args[0] as Map<string, unknown>;
      expect(positions.has(old.id)).toBe(true);
    });

    it('fires the foldExpanded probe event', () => {
      const now = Date.now();
      const { tree } = createTreeWithBranches(now);
      const adapter = new BranchFoldAdapter(tree, fakeView, probe);

      adapter.updateLayout();
      const firstFoldNodesCalls = fakeView.calls.filter(c => c.method === 'setFoldNodes');
      const foldNodes = firstFoldNodesCalls[0].args[0] as Map<string, unknown>;
      const foldId = [...foldNodes.keys()][0];

      adapter.handleFoldToggle(foldId);

      const expandedCalls = probe.calls.filter(c => c.method === 'foldExpanded');
      expect(expandedCalls).toHaveLength(1);
      expect(expandedCalls[0].args[0]).toBe(foldId);
    });
  });
});
