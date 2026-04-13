import { describe, it, expect } from 'vitest';
import { evictScreenshots, checkTreeSize } from './memory-management';
import { ScreenshotStore } from './screenshot-store';
import { BrowsingTree } from './browsing-tree';
import { FakeTreeProbe } from './__test-utils__/fake-tree-probe';
import { FakePerformanceProbe } from './__test-utils__/fake-performance-probe';
import type { LODTier } from '../ports/lod-probe';

const MB = 1024 * 1024;

function makeBuffer(bytes: number): Uint8Array {
  return new Uint8Array(bytes);
}

function buildTree(nodeCount: number): { tree: BrowsingTree; probe: FakeTreeProbe } {
  const probe = new FakeTreeProbe();
  const tree = BrowsingTree.create('https://root.example', probe);
  const rootId = tree.rootId;

  for (let i = 1; i < nodeCount; i++) {
    tree.addChild(rootId, `https://node-${i}.example`);
  }

  return { tree, probe };
}

describe('evictScreenshots', () => {
  it('returns empty array when total screenshot size is under 20MB', () => {
    const store = new ScreenshotStore();
    const treeProbe = new FakeTreeProbe();
    const tree = BrowsingTree.create('https://root.example', treeProbe);
    const rootId = tree.rootId;

    // Store 10MB — well under the 20MB threshold
    store.store(rootId, 'low', makeBuffer(10 * MB));

    const tiers = new Map<string, LODTier>();
    tiers.set(rootId, 'culled');

    const evicted = evictScreenshots(store, tree, tiers);

    expect(evicted).toEqual([]);
    // Screenshot should still be there
    expect(store.get(rootId, 'low')).toBeDefined();
  });

  it('evicts culled nodes oldest lastVisitedAt first when over 20MB', () => {
    const store = new ScreenshotStore();
    const treeProbe = new FakeTreeProbe();
    const tree = BrowsingTree.create('https://root.example', treeProbe);

    const child1 = tree.addChild(tree.rootId, 'https://child1.example');
    const child2 = tree.addChild(tree.rootId, 'https://child2.example');
    const child3 = tree.addChild(tree.rootId, 'https://child3.example');

    // Explicitly set lastVisitedAt to guarantee ordering
    const root = tree.nodes.get(tree.rootId)!;
    root.lastVisitedAt = 1000;
    child1.lastVisitedAt = 4000; // newest
    child2.lastVisitedAt = 3000;
    child3.lastVisitedAt = 2000; // oldest after root

    // Store 8MB per node = 32MB total (exceeds 20MB)
    store.store(tree.rootId, 'low', makeBuffer(8 * MB));
    store.store(child1.id, 'low', makeBuffer(8 * MB));
    store.store(child2.id, 'low', makeBuffer(8 * MB));
    store.store(child3.id, 'low', makeBuffer(8 * MB));

    const tiers = new Map<string, LODTier>();
    tiers.set(tree.rootId, 'culled');
    tiers.set(child1.id, 'culled');
    tiers.set(child2.id, 'culled');
    tiers.set(child3.id, 'culled');

    const evicted = evictScreenshots(store, tree, tiers);

    // Evict oldest first: root (1000), then child3 (2000)
    // After evicting root: 24MB, still over 20MB
    // After evicting child3: 16MB, under 20MB — stop
    expect(evicted.length).toBe(2);
    expect(evicted[0]).toBe(tree.rootId);
    expect(evicted[1]).toBe(child3.id);
    expect(store.totalSize()).toBeLessThan(20 * MB);
  });

  it('never evicts visible (non-culled) nodes screenshots', () => {
    const store = new ScreenshotStore();
    const treeProbe = new FakeTreeProbe();
    const tree = BrowsingTree.create('https://root.example', treeProbe);

    const child1 = tree.addChild(tree.rootId, 'https://child1.example');

    // root has oldest lastVisitedAt, child1 is newer
    // Store enough to exceed 20MB
    store.store(tree.rootId, 'low', makeBuffer(15 * MB));
    store.store(child1.id, 'low', makeBuffer(15 * MB));

    const tiers = new Map<string, LODTier>();
    tiers.set(tree.rootId, 'live'); // visible — never evict
    tiers.set(child1.id, 'culled'); // cullable

    const evicted = evictScreenshots(store, tree, tiers);

    // Only child1 should be evicted (it's culled)
    // root is live — must not be evicted even though it's older
    expect(evicted).toEqual([child1.id]);
    expect(store.get(tree.rootId, 'low')).toBeDefined();
    expect(store.get(child1.id, 'low')).toBeUndefined();
  });

  it('eviction continues until total is under 20MB', () => {
    const store = new ScreenshotStore();
    const treeProbe = new FakeTreeProbe();
    const tree = BrowsingTree.create('https://root.example', treeProbe);

    const children: ReturnType<typeof tree.addChild>[] = [];
    for (let i = 0; i < 5; i++) {
      children.push(tree.addChild(tree.rootId, `https://child-${i}.example`));
    }

    // Explicitly set lastVisitedAt — root oldest, children in order
    const root = tree.nodes.get(tree.rootId)!;
    root.lastVisitedAt = 1000;
    for (let i = 0; i < children.length; i++) {
      children[i].lastVisitedAt = 2000 + i * 1000;
    }

    // Store 7MB per node (6 nodes total = 42MB, exceeds 20MB)
    store.store(tree.rootId, 'low', makeBuffer(7 * MB));
    for (const child of children) {
      store.store(child.id, 'low', makeBuffer(7 * MB));
    }

    const tiers = new Map<string, LODTier>();
    tiers.set(tree.rootId, 'culled');
    for (const child of children) {
      tiers.set(child.id, 'culled');
    }

    const evicted = evictScreenshots(store, tree, tiers);

    // Need to go from 42MB to <= 20MB — must evict at least 4 nodes (28MB -> 14MB)
    // But 3 evictions = 21MB remaining (still > 20MB), so must evict 4
    // Evicts oldest first: root (1000), children[0] (2000), children[1] (3000), children[2] (4000)
    expect(evicted.length).toBe(4);
    expect(store.totalSize()).toBeLessThanOrEqual(20 * MB);
  });

  it('does not evict focused tier screenshots', () => {
    const store = new ScreenshotStore();
    const treeProbe = new FakeTreeProbe();
    const tree = BrowsingTree.create('https://root.example', treeProbe);

    const child1 = tree.addChild(tree.rootId, 'https://child1.example');

    store.store(tree.rootId, 'low', makeBuffer(15 * MB));
    store.store(child1.id, 'low', makeBuffer(15 * MB));

    const tiers = new Map<string, LODTier>();
    tiers.set(tree.rootId, 'focused');
    tiers.set(child1.id, 'culled');

    const evicted = evictScreenshots(store, tree, tiers);

    expect(evicted).toEqual([child1.id]);
    expect(store.get(tree.rootId, 'low')).toBeDefined();
  });

  it('does not evict screenshot-low tier screenshots', () => {
    const store = new ScreenshotStore();
    const treeProbe = new FakeTreeProbe();
    const tree = BrowsingTree.create('https://root.example', treeProbe);

    const child1 = tree.addChild(tree.rootId, 'https://child1.example');

    store.store(tree.rootId, 'low', makeBuffer(15 * MB));
    store.store(child1.id, 'low', makeBuffer(15 * MB));

    const tiers = new Map<string, LODTier>();
    tiers.set(tree.rootId, 'screenshot-low');
    tiers.set(child1.id, 'culled');

    const evicted = evictScreenshots(store, tree, tiers);

    expect(evicted).toEqual([child1.id]);
    expect(store.get(tree.rootId, 'low')).toBeDefined();
  });

  it('does not evict screenshot-high tier screenshots', () => {
    const store = new ScreenshotStore();
    const treeProbe = new FakeTreeProbe();
    const tree = BrowsingTree.create('https://root.example', treeProbe);

    const child1 = tree.addChild(tree.rootId, 'https://child1.example');

    store.store(tree.rootId, 'low', makeBuffer(15 * MB));
    store.store(child1.id, 'low', makeBuffer(15 * MB));

    const tiers = new Map<string, LODTier>();
    tiers.set(tree.rootId, 'screenshot-high');
    tiers.set(child1.id, 'culled');

    const evicted = evictScreenshots(store, tree, tiers);

    expect(evicted).toEqual([child1.id]);
    expect(store.get(tree.rootId, 'low')).toBeDefined();
  });

  it('stops eviction when all culled nodes are exhausted even if still over 20MB', () => {
    const store = new ScreenshotStore();
    const treeProbe = new FakeTreeProbe();
    const tree = BrowsingTree.create('https://root.example', treeProbe);

    const child1 = tree.addChild(tree.rootId, 'https://child1.example');

    // 25MB total but only 5MB is culled
    store.store(tree.rootId, 'low', makeBuffer(20 * MB));
    store.store(child1.id, 'low', makeBuffer(5 * MB));

    const tiers = new Map<string, LODTier>();
    tiers.set(tree.rootId, 'live');
    tiers.set(child1.id, 'culled');

    const evicted = evictScreenshots(store, tree, tiers);

    // Only child1 is culled, so only it gets evicted
    // Total is still 20MB (at threshold, not over), so eviction should still be needed
    // Wait — 20MB is at threshold. The spec says "exceeds 20MB". Let's check.
    // After evicting child1, total = 20MB. Spec says "exceeds 20MB" so 20MB is NOT over.
    expect(evicted).toEqual([child1.id]);
    expect(store.totalSize()).toBe(20 * MB);
  });

  it('handles nodes in tiers map that have no screenshots stored', () => {
    const store = new ScreenshotStore();
    const treeProbe = new FakeTreeProbe();
    const tree = BrowsingTree.create('https://root.example', treeProbe);

    const child1 = tree.addChild(tree.rootId, 'https://child1.example');
    const child2 = tree.addChild(tree.rootId, 'https://child2.example');

    // Explicitly set lastVisitedAt
    const root = tree.nodes.get(tree.rootId)!;
    root.lastVisitedAt = 1000;        // oldest
    child1.lastVisitedAt = 2000;      // middle
    child2.lastVisitedAt = 3000;      // newest

    // Only root and child2 have screenshots — child1 has none
    store.store(tree.rootId, 'low', makeBuffer(15 * MB));
    store.store(child2.id, 'low', makeBuffer(15 * MB));

    const tiers = new Map<string, LODTier>();
    tiers.set(tree.rootId, 'culled');
    tiers.set(child1.id, 'culled');
    tiers.set(child2.id, 'culled');

    const evicted = evictScreenshots(store, tree, tiers);

    // root is oldest — evicted first, bringing total to 15MB (under 20MB)
    // child1 has no screenshots — skipped (remove is a no-op, not counted)
    expect(evicted).toContain(tree.rootId);
    expect(store.totalSize()).toBeLessThan(20 * MB);
  });

  it('decouples eviction order from insertion order', () => {
    // Test orthogonality: insertion order !== visit order
    const store = new ScreenshotStore();
    const treeProbe = new FakeTreeProbe();
    const tree = BrowsingTree.create('https://root.example', treeProbe);

    const child1 = tree.addChild(tree.rootId, 'https://child1.example');
    const child2 = tree.addChild(tree.rootId, 'https://child2.example');

    // child2 was inserted AFTER child1, but we give child2 an OLDER visit time
    const root = tree.nodes.get(tree.rootId)!;
    root.lastVisitedAt = 1000;       // oldest
    child1.lastVisitedAt = 3000;     // newest — inserted first but visited last
    child2.lastVisitedAt = 2000;     // middle — inserted second but visited earlier

    // 11MB each = 33MB total
    store.store(tree.rootId, 'low', makeBuffer(11 * MB));
    store.store(child1.id, 'low', makeBuffer(11 * MB));
    store.store(child2.id, 'low', makeBuffer(11 * MB));

    const tiers = new Map<string, LODTier>();
    tiers.set(tree.rootId, 'culled');
    tiers.set(child1.id, 'culled');
    tiers.set(child2.id, 'culled');

    const evicted = evictScreenshots(store, tree, tiers);

    // Eviction order by lastVisitedAt (oldest first):
    // root (1000), then child2 (2000) — NOT child1 which was inserted first
    expect(evicted[0]).toBe(tree.rootId);
    expect(evicted[1]).toBe(child2.id);
    // child1 was visited most recently — should NOT be evicted
    // After evicting root + child2: 11MB < 20MB
    expect(store.totalSize()).toBe(11 * MB);
    expect(store.get(child1.id, 'low')).toBeDefined();
  });
});

describe('checkTreeSize', () => {
  it('emits no warning when tree has fewer than 100 nodes', () => {
    const { tree } = buildTree(50);
    const perfProbe = new FakePerformanceProbe();

    checkTreeSize(tree, perfProbe);

    expect(perfProbe.treeSizeWarningCalls).toEqual([]);
    expect(perfProbe.treeSizeCriticalCalls).toEqual([]);
  });

  it('emits no warning at exactly 100 nodes', () => {
    const { tree } = buildTree(100);
    const perfProbe = new FakePerformanceProbe();

    checkTreeSize(tree, perfProbe);

    expect(perfProbe.treeSizeWarningCalls).toEqual([]);
    expect(perfProbe.treeSizeCriticalCalls).toEqual([]);
  });

  it('emits warning at exactly 101 nodes', () => {
    const { tree } = buildTree(101);
    const perfProbe = new FakePerformanceProbe();

    checkTreeSize(tree, perfProbe);

    expect(perfProbe.treeSizeWarningCalls).toEqual([101]);
    expect(perfProbe.treeSizeCriticalCalls).toEqual([]);
  });

  it('emits warning between 101 and 200 nodes', () => {
    const { tree } = buildTree(150);
    const perfProbe = new FakePerformanceProbe();

    checkTreeSize(tree, perfProbe);

    expect(perfProbe.treeSizeWarningCalls).toEqual([150]);
    expect(perfProbe.treeSizeCriticalCalls).toEqual([]);
  });

  it('emits critical warning at exactly 201 nodes', () => {
    const { tree } = buildTree(201);
    const perfProbe = new FakePerformanceProbe();

    checkTreeSize(tree, perfProbe);

    // At 201, the stronger warning fires (not the regular warning)
    expect(perfProbe.treeSizeCriticalCalls).toEqual([201]);
  });

  it('emits critical warning above 200 nodes', () => {
    const { tree } = buildTree(250);
    const perfProbe = new FakePerformanceProbe();

    checkTreeSize(tree, perfProbe);

    expect(perfProbe.treeSizeCriticalCalls).toEqual([250]);
  });

  it('never auto-prunes the tree', () => {
    const { tree } = buildTree(300);
    const perfProbe = new FakePerformanceProbe();
    const nodeCountBefore = tree.nodes.size;

    checkTreeSize(tree, perfProbe);

    // Tree must NOT be modified — no auto-close
    expect(tree.nodes.size).toBe(nodeCountBefore);
  });
});
