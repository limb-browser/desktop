import { describe, it, expect, beforeEach } from 'vitest';
import { BrowsingTree } from './browsing-tree';
import { FakeTreeProbe } from './__test-utils__/fake-tree-probe';
import { computeFoldState } from './branch-folding';
import type { FoldState } from './branch-folding';
import { computeFoldedLayout, ARCHIVE_FOLD_NODE_ID } from './folded-layout';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

describe('computeFoldedLayout', () => {
  let probe: FakeTreeProbe;
  let tree: BrowsingTree;

  beforeEach(() => {
    probe = new FakeTreeProbe();
    tree = BrowsingTree.create('about::home', probe);
  });

  it('includes all nodes when no folding (no archived branches)', () => {
    const branch1 = tree.addChild(tree.rootId, 'https://a.com');
    const branch2 = tree.addChild(tree.rootId, 'https://b.com');

    const now = Date.now();
    const foldState = computeFoldState(tree, now);
    const layout = computeFoldedLayout(tree, foldState);

    expect(layout.has(tree.rootId)).toBe(true);
    expect(layout.has(branch1.id)).toBe(true);
    expect(layout.has(branch2.id)).toBe(true);
    expect(layout.has(ARCHIVE_FOLD_NODE_ID)).toBe(false);
  });

  it('replaces archived branches with a single fold node when folded', () => {
    const now = Date.now();
    const recent = tree.addChild(tree.rootId, 'https://recent.com');
    const old1 = tree.addChild(tree.rootId, 'https://old1.com');
    const old2 = tree.addChild(tree.rootId, 'https://old2.com');

    old1.lastVisitedAt = now - SEVEN_DAYS_MS - 1;
    old2.lastVisitedAt = now - SEVEN_DAYS_MS - 1;

    const foldState = computeFoldState(tree, now);
    expect(foldState.archivedCount).toBe(2);
    expect(foldState.expanded).toBe(false);

    const layout = computeFoldedLayout(tree, foldState);

    // Recent branch and root should be present
    expect(layout.has(tree.rootId)).toBe(true);
    expect(layout.has(recent.id)).toBe(true);

    // Archived branches should NOT be present
    expect(layout.has(old1.id)).toBe(false);
    expect(layout.has(old2.id)).toBe(false);

    // Archive fold node should be present
    expect(layout.has(ARCHIVE_FOLD_NODE_ID)).toBe(true);
  });

  it('includes all branches when expanded', () => {
    const now = Date.now();
    const recent = tree.addChild(tree.rootId, 'https://recent.com');
    const old1 = tree.addChild(tree.rootId, 'https://old1.com');
    const old2 = tree.addChild(tree.rootId, 'https://old2.com');

    old1.lastVisitedAt = now - SEVEN_DAYS_MS - 1;
    old2.lastVisitedAt = now - SEVEN_DAYS_MS - 1;

    const foldState: FoldState = {
      recentBranchIds: [recent.id],
      archivedCount: 2,
      expanded: true,
    };

    const layout = computeFoldedLayout(tree, foldState);

    // All branches present when expanded
    expect(layout.has(tree.rootId)).toBe(true);
    expect(layout.has(recent.id)).toBe(true);
    expect(layout.has(old1.id)).toBe(true);
    expect(layout.has(old2.id)).toBe(true);

    // No fold node when expanded
    expect(layout.has(ARCHIVE_FOLD_NODE_ID)).toBe(false);
  });

  it('fold node is positioned as a sibling of recent branches', () => {
    const now = Date.now();
    const recent = tree.addChild(tree.rootId, 'https://recent.com');
    const old1 = tree.addChild(tree.rootId, 'https://old1.com');

    old1.lastVisitedAt = now - SEVEN_DAYS_MS - 1;

    const foldState = computeFoldState(tree, now);
    const layout = computeFoldedLayout(tree, foldState);

    const rootPos = layout.get(tree.rootId)!;
    const recentPos = layout.get(recent.id)!;
    const foldPos = layout.get(ARCHIVE_FOLD_NODE_ID)!;

    // Fold node should be at the same depth as branches (to the right of root)
    expect(foldPos.x).toBeGreaterThan(rootPos.x);
    // Both recent and fold node should be at same x depth
    expect(foldPos.x).toBe(recentPos.x);
  });

  it('within a branch, no folding occurs (children of branches are in layout)', () => {
    const now = Date.now();
    const branch = tree.addChild(tree.rootId, 'https://branch.com');
    const page1 = tree.addChild(branch.id, 'https://page1.com');
    const page2 = tree.addChild(branch.id, 'https://page2.com');

    const foldState = computeFoldState(tree, now);
    const layout = computeFoldedLayout(tree, foldState);

    // All pages within the branch are in layout
    expect(layout.has(page1.id)).toBe(true);
    expect(layout.has(page2.id)).toBe(true);
  });

  it('all archived branches present means only fold node and root', () => {
    const now = Date.now();
    const old1 = tree.addChild(tree.rootId, 'https://old1.com');
    const old2 = tree.addChild(tree.rootId, 'https://old2.com');
    const old3 = tree.addChild(tree.rootId, 'https://old3.com');

    old1.lastVisitedAt = now - SEVEN_DAYS_MS - 1;
    old2.lastVisitedAt = now - SEVEN_DAYS_MS - 1;
    old3.lastVisitedAt = now - SEVEN_DAYS_MS - 1;

    const foldState = computeFoldState(tree, now);
    const layout = computeFoldedLayout(tree, foldState);

    expect(layout.has(tree.rootId)).toBe(true);
    expect(layout.has(ARCHIVE_FOLD_NODE_ID)).toBe(true);
    expect(layout.has(old1.id)).toBe(false);
    expect(layout.has(old2.id)).toBe(false);
    expect(layout.has(old3.id)).toBe(false);
  });

  it('positions recent branches by recency order, not insertion order', () => {
    const now = Date.now();

    // Insert in order: branch1, branch2, branch3
    const branch1 = tree.addChild(tree.rootId, 'https://first-inserted.com');
    const branch2 = tree.addChild(tree.rootId, 'https://second-inserted.com');
    const branch3 = tree.addChild(tree.rootId, 'https://third-inserted.com');

    // Make branch3 most recent, branch1 second, branch2 oldest (but still recent)
    branch3.lastVisitedAt = now;
    branch1.lastVisitedAt = now - 1 * 24 * 60 * 60 * 1000; // 1 day ago
    branch2.lastVisitedAt = now - 3 * 24 * 60 * 60 * 1000; // 3 days ago

    // Add an old branch so fold state is active
    const old = tree.addChild(tree.rootId, 'https://old.com');
    old.lastVisitedAt = now - SEVEN_DAYS_MS - 1;

    const foldState = computeFoldState(tree, now);

    // computeFoldState sorts by recency: branch3, branch1, branch2
    expect(foldState.recentBranchIds[0]).toBe(branch3.id);
    expect(foldState.recentBranchIds[1]).toBe(branch1.id);
    expect(foldState.recentBranchIds[2]).toBe(branch2.id);

    const layout = computeFoldedLayout(tree, foldState);

    const pos3 = layout.get(branch3.id)!;
    const pos1 = layout.get(branch1.id)!;
    const pos2 = layout.get(branch2.id)!;

    // Recency order (most recent first = top): branch3 < branch1 < branch2
    expect(pos3.y).toBeLessThan(pos1.y);
    expect(pos1.y).toBeLessThan(pos2.y);
  });

  it('layout has correct number of entries when folded', () => {
    const now = Date.now();
    // 2 recent branches, each with 1 child page
    const recent1 = tree.addChild(tree.rootId, 'https://r1.com');
    tree.addChild(recent1.id, 'https://r1-page.com');
    const recent2 = tree.addChild(tree.rootId, 'https://r2.com');
    tree.addChild(recent2.id, 'https://r2-page.com');

    // 3 old branches (no children loaded, just branch roots)
    for (let i = 0; i < 3; i++) {
      const old = tree.addChild(tree.rootId, `https://old${i}.com`);
      old.lastVisitedAt = now - SEVEN_DAYS_MS - 1;
    }

    const foldState = computeFoldState(tree, now);
    const layout = computeFoldedLayout(tree, foldState);

    // root + 2 recent branches + 2 child pages + 1 fold node = 6
    expect(layout.size).toBe(6);
  });
});
