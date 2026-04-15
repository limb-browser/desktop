// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect } from 'vitest';
import { BrowsingTree } from './BrowsingTree';
import { computeFoldedLayout, buildFoldedParentMap } from './FoldedTreeLayout';

describe('computeFoldedLayout', () => {
  describe('fold nodes are positioned as leaves', () => {
    it('assigns a position to a fold node', () => {
      const tree = new BrowsingTree('https://root.com');
      const foldNodeIds = new Set(['fold:2026-03']);

      const positions = computeFoldedLayout(tree, ['fold:2026-03'], foldNodeIds);

      expect(positions.has('fold:2026-03')).toBe(true);
      expect(positions.get('fold:2026-03')!.y).toBe(1);
    });

    it('positions fold nodes as leaves alongside real branches', () => {
      const tree = new BrowsingTree('https://root.com');
      const branch = tree.addChild(tree.rootId, 'https://recent.com');
      const foldNodeIds = new Set(['fold:2026-03']);

      const positions = computeFoldedLayout(
        tree,
        [branch.id, 'fold:2026-03'],
        foldNodeIds,
      );

      // Both should have positions
      expect(positions.has(branch.id)).toBe(true);
      expect(positions.has('fold:2026-03')).toBe(true);
      // Branch is first (leftmost), fold node is second
      expect(positions.get(branch.id)!.x).toBeLessThan(
        positions.get('fold:2026-03')!.x,
      );
      // Both at depth 1
      expect(positions.get(branch.id)!.y).toBe(1);
      expect(positions.get('fold:2026-03')!.y).toBe(1);
    });
  });

  describe('root is centered above visible children', () => {
    it('centers root above a single fold node', () => {
      const tree = new BrowsingTree('https://root.com');
      const foldNodeIds = new Set(['fold:2026-03']);

      const positions = computeFoldedLayout(tree, ['fold:2026-03'], foldNodeIds);

      expect(positions.get(tree.rootId)!.x).toBe(
        positions.get('fold:2026-03')!.x,
      );
      expect(positions.get(tree.rootId)!.y).toBe(0);
    });

    it('centers root above mix of branches and fold nodes', () => {
      const tree = new BrowsingTree('https://root.com');
      const b1 = tree.addChild(tree.rootId, 'https://b1.com');
      const b2 = tree.addChild(tree.rootId, 'https://b2.com');
      const foldNodeIds = new Set(['fold:2026-03']);

      const visibleChildren = [b1.id, b2.id, 'fold:2026-03'];
      const positions = computeFoldedLayout(tree, visibleChildren, foldNodeIds);

      const firstX = positions.get(b1.id)!.x;
      const lastX = positions.get('fold:2026-03')!.x;
      expect(positions.get(tree.rootId)!.x).toBe((firstX + lastX) / 2);
    });
  });

  describe('folded branches are excluded from layout', () => {
    it('does not position branches hidden behind a fold node', () => {
      const tree = new BrowsingTree('https://root.com');
      const hidden = tree.addChild(tree.rootId, 'https://hidden.com');
      const foldNodeIds = new Set(['fold:2026-03']);

      // Only fold node is visible, not the hidden branch
      const positions = computeFoldedLayout(tree, ['fold:2026-03'], foldNodeIds);

      expect(positions.has(hidden.id)).toBe(false);
      expect(positions.has('fold:2026-03')).toBe(true);
    });
  });

  describe('expanded fold shows individual branches', () => {
    it('positions branches when fold is expanded', () => {
      const tree = new BrowsingTree('https://root.com');
      const b1 = tree.addChild(tree.rootId, 'https://b1.com');
      const b2 = tree.addChild(tree.rootId, 'https://b2.com');
      // No fold nodes - all expanded
      const foldNodeIds = new Set<string>();

      const positions = computeFoldedLayout(
        tree,
        [b1.id, b2.id],
        foldNodeIds,
      );

      expect(positions.has(b1.id)).toBe(true);
      expect(positions.has(b2.id)).toBe(true);
    });
  });

  describe('branch subtrees are laid out normally', () => {
    it('includes subtree positions for visible branches', () => {
      const tree = new BrowsingTree('https://root.com');
      const branch = tree.addChild(tree.rootId, 'https://branch.com');
      const child = tree.addChild(branch.id, 'https://child.com');
      const foldNodeIds = new Set<string>();

      const positions = computeFoldedLayout(tree, [branch.id], foldNodeIds);

      expect(positions.has(child.id)).toBe(true);
      expect(positions.get(child.id)!.y).toBe(2); // root=0, branch=1, child=2
    });
  });

  describe('empty visible children', () => {
    it('positions root at (0, 0) with no visible children', () => {
      const tree = new BrowsingTree('https://root.com');

      const positions = computeFoldedLayout(tree, [], new Set());

      expect(positions.get(tree.rootId)).toEqual({ x: 0, y: 0 });
    });
  });

  describe('multiple fold nodes', () => {
    it('assigns unique positions to multiple fold nodes', () => {
      const tree = new BrowsingTree('https://root.com');
      const foldNodeIds = new Set(['fold:2026-03', 'fold:2026-02', 'fold:2026-01']);

      const positions = computeFoldedLayout(
        tree,
        ['fold:2026-03', 'fold:2026-02', 'fold:2026-01'],
        foldNodeIds,
      );

      const allPositions = [...positions.values()].map(p => `${p.x},${p.y}`);
      expect(new Set(allPositions).size).toBe(allPositions.length);
    });
  });
});

describe('buildFoldedParentMap', () => {
  it('maps visible children to root', () => {
    const tree = new BrowsingTree('https://root.com');
    const branch = tree.addChild(tree.rootId, 'https://branch.com');

    const parentMap = buildFoldedParentMap(tree, [branch.id], new Set());

    expect(parentMap.get(branch.id)).toBe(tree.rootId);
  });

  it('maps fold nodes to root', () => {
    const tree = new BrowsingTree('https://root.com');
    const foldNodeIds = new Set(['fold:2026-03']);

    const parentMap = buildFoldedParentMap(tree, ['fold:2026-03'], foldNodeIds);

    expect(parentMap.get('fold:2026-03')).toBe(tree.rootId);
  });

  it('includes subtree edges for visible branches', () => {
    const tree = new BrowsingTree('https://root.com');
    const branch = tree.addChild(tree.rootId, 'https://branch.com');
    const child = tree.addChild(branch.id, 'https://child.com');

    const parentMap = buildFoldedParentMap(tree, [branch.id], new Set());

    expect(parentMap.get(child.id)).toBe(branch.id);
  });

  it('excludes edges for branches hidden behind fold nodes', () => {
    const tree = new BrowsingTree('https://root.com');
    const hidden = tree.addChild(tree.rootId, 'https://hidden.com');
    tree.addChild(hidden.id, 'https://hidden-child.com');
    const foldNodeIds = new Set(['fold:2026-03']);

    const parentMap = buildFoldedParentMap(tree, ['fold:2026-03'], foldNodeIds);

    expect(parentMap.has(hidden.id)).toBe(false);
  });
});
