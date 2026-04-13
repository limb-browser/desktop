import { describe, it, expect, beforeEach } from 'vitest';
import { BrowsingTree } from './browsing-tree';
import { FakeTreeProbe } from './__test-utils__/fake-tree-probe';
import { computeFoldState, toggleFold } from './branch-folding';
import type { FoldState } from './branch-folding';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

describe('computeFoldState', () => {
  let probe: FakeTreeProbe;
  let tree: BrowsingTree;

  beforeEach(() => {
    probe = new FakeTreeProbe();
    tree = BrowsingTree.create('about::home', probe);
  });

  it('returns empty state when root has no children', () => {
    const now = Date.now();
    const state = computeFoldState(tree, now);

    expect(state.recentBranchIds).toEqual([]);
    expect(state.archivedCount).toBe(0);
    expect(state.expanded).toBe(false);
  });

  it('classifies branches visited in last 7 days as recent', () => {
    const now = Date.now();
    const branch1 = tree.addChild(tree.rootId, 'https://recent1.com');
    const branch2 = tree.addChild(tree.rootId, 'https://recent2.com');
    // Both created just now, so lastVisitedAt is within 7 days

    const state = computeFoldState(tree, now);

    expect(state.recentBranchIds).toContain(branch1.id);
    expect(state.recentBranchIds).toContain(branch2.id);
    expect(state.archivedCount).toBe(0);
  });

  it('classifies branches older than 7 days as archived', () => {
    const now = Date.now();
    const branch1 = tree.addChild(tree.rootId, 'https://old1.com');
    const branch2 = tree.addChild(tree.rootId, 'https://old2.com');

    // Set lastVisitedAt to 8 days ago
    branch1.lastVisitedAt = now - SEVEN_DAYS_MS - 1;
    branch2.lastVisitedAt = now - SEVEN_DAYS_MS - 1;

    const state = computeFoldState(tree, now);

    expect(state.recentBranchIds).toEqual([]);
    expect(state.archivedCount).toBe(2);
  });

  it('returns archivedCount: 0 when no old branches exist', () => {
    const now = Date.now();
    tree.addChild(tree.rootId, 'https://recent.com');

    const state = computeFoldState(tree, now);

    expect(state.archivedCount).toBe(0);
  });

  it('returns archivedCount: 10 when 10 old branches exist', () => {
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      const branch = tree.addChild(tree.rootId, `https://old${i}.com`);
      branch.lastVisitedAt = now - SEVEN_DAYS_MS - 1;
    }

    const state = computeFoldState(tree, now);

    expect(state.archivedCount).toBe(10);
  });

  it('splits branches into recent and archived correctly', () => {
    const now = Date.now();

    // 3 recent branches
    const recent1 = tree.addChild(tree.rootId, 'https://recent1.com');
    const recent2 = tree.addChild(tree.rootId, 'https://recent2.com');
    const recent3 = tree.addChild(tree.rootId, 'https://recent3.com');

    // 5 old branches
    for (let i = 0; i < 5; i++) {
      const branch = tree.addChild(tree.rootId, `https://old${i}.com`);
      branch.lastVisitedAt = now - SEVEN_DAYS_MS - (i + 1) * 1000;
    }

    const state = computeFoldState(tree, now);

    expect(state.recentBranchIds.length).toBe(3);
    expect(state.recentBranchIds).toContain(recent1.id);
    expect(state.recentBranchIds).toContain(recent2.id);
    expect(state.recentBranchIds).toContain(recent3.id);
    expect(state.archivedCount).toBe(5);
  });

  it('uses lastVisitedAt, not createdAt, for classification', () => {
    const now = Date.now();

    // Branch created 30 days ago but visited recently
    const branch = tree.addChild(tree.rootId, 'https://old-but-recent.com');
    branch.createdAt = now - 30 * 24 * 60 * 60 * 1000;
    branch.lastVisitedAt = now - 1000; // visited 1 second ago

    const state = computeFoldState(tree, now);

    expect(state.recentBranchIds).toContain(branch.id);
    expect(state.archivedCount).toBe(0);
  });

  it('boundary: branch visited exactly 7 days ago is recent', () => {
    const now = Date.now();
    const branch = tree.addChild(tree.rootId, 'https://boundary.com');
    branch.lastVisitedAt = now - SEVEN_DAYS_MS;

    const state = computeFoldState(tree, now);

    expect(state.recentBranchIds).toContain(branch.id);
    expect(state.archivedCount).toBe(0);
  });

  it('orders recent branches by recency (most recent first)', () => {
    const now = Date.now();
    const branch1 = tree.addChild(tree.rootId, 'https://a.com');
    const branch2 = tree.addChild(tree.rootId, 'https://b.com');
    const branch3 = tree.addChild(tree.rootId, 'https://c.com');

    // Set different visit times within the 7-day window
    branch1.lastVisitedAt = now - 3 * 24 * 60 * 60 * 1000; // 3 days ago
    branch2.lastVisitedAt = now - 1 * 24 * 60 * 60 * 1000; // 1 day ago
    branch3.lastVisitedAt = now - 5 * 24 * 60 * 60 * 1000; // 5 days ago

    const state = computeFoldState(tree, now);

    // Most recent first: branch2, branch1, branch3
    expect(state.recentBranchIds[0]).toBe(branch2.id);
    expect(state.recentBranchIds[1]).toBe(branch1.id);
    expect(state.recentBranchIds[2]).toBe(branch3.id);
  });

  it('only inspects root children, not deeper descendants', () => {
    const now = Date.now();
    const branch = tree.addChild(tree.rootId, 'https://branch.com');

    // Add a child within the branch (a page navigated to)
    const page = tree.addChild(branch.id, 'https://page.com');
    page.lastVisitedAt = now - SEVEN_DAYS_MS - 1; // old

    const state = computeFoldState(tree, now);

    // Only the branch root counts, not its children
    expect(state.recentBranchIds).toContain(branch.id);
    expect(state.archivedCount).toBe(0);
    // The page should NOT be in recent list (it's not a branch root)
    expect(state.recentBranchIds).not.toContain(page.id);
  });

  it('defaults expanded to false', () => {
    const now = Date.now();
    tree.addChild(tree.rootId, 'https://a.com');

    const state = computeFoldState(tree, now);

    expect(state.expanded).toBe(false);
  });

  it('preserves expanded from prior state across recomputation', () => {
    const now = Date.now();
    const branch = tree.addChild(tree.rootId, 'https://recent.com');
    const old = tree.addChild(tree.rootId, 'https://old.com');
    old.lastVisitedAt = now - SEVEN_DAYS_MS - 1;

    // First computation defaults to collapsed
    const state1 = computeFoldState(tree, now);
    expect(state1.expanded).toBe(false);

    // User expands
    const expanded = toggleFold(state1);
    expect(expanded.expanded).toBe(true);

    // Tree changes (e.g., a page title updates), recompute fold state
    // The expanded flag should be preserved from the prior state
    const state2 = computeFoldState(tree, now, expanded);
    expect(state2.expanded).toBe(true);
    // Derived fields still recomputed correctly
    expect(state2.recentBranchIds).toContain(branch.id);
    expect(state2.archivedCount).toBe(1);
  });

  it('defaults expanded to false when no prior state is provided', () => {
    const now = Date.now();
    tree.addChild(tree.rootId, 'https://a.com');

    const state = computeFoldState(tree, now);
    expect(state.expanded).toBe(false);

    const stateExplicitUndefined = computeFoldState(tree, now, undefined);
    expect(stateExplicitUndefined.expanded).toBe(false);
  });
});

describe('toggleFold', () => {
  it('flips expanded from false to true', () => {
    const state: FoldState = {
      recentBranchIds: ['a', 'b'],
      archivedCount: 5,
      expanded: false,
    };

    const toggled = toggleFold(state);

    expect(toggled.expanded).toBe(true);
    expect(toggled.recentBranchIds).toEqual(['a', 'b']);
    expect(toggled.archivedCount).toBe(5);
  });

  it('flips expanded from true to false', () => {
    const state: FoldState = {
      recentBranchIds: ['x'],
      archivedCount: 10,
      expanded: true,
    };

    const toggled = toggleFold(state);

    expect(toggled.expanded).toBe(false);
    expect(toggled.recentBranchIds).toEqual(['x']);
    expect(toggled.archivedCount).toBe(10);
  });

  it('returns a new object, does not mutate the input', () => {
    const state: FoldState = {
      recentBranchIds: ['a'],
      archivedCount: 3,
      expanded: false,
    };

    const toggled = toggleFold(state);

    expect(toggled).not.toBe(state);
    expect(state.expanded).toBe(false); // original unchanged
  });
});
