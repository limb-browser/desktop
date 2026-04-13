import { describe, it, expect } from 'vitest';
import { FakePersistencePort } from './fake-persistence-port';
import type { SerializedNode } from '../../ports/persistence-port';

function makeNode(overrides: Partial<SerializedNode> = {}): SerializedNode {
  return {
    id: 'node-1',
    url: 'https://example.com',
    title: 'Example',
    favicon: null,
    parentId: null,
    childIds: [],
    status: 'live',
    createdAt: 1000,
    lastVisitedAt: 2000,
    descendantCount: 0,
    ...overrides,
  };
}

describe('FakePersistencePort', () => {
  describe('createRoot / getRootId', () => {
    it('createRoot returns a root ID and getRootId returns it', () => {
      const port = new FakePersistencePort();

      const rootId = port.createRoot();

      expect(rootId).toBeTruthy();
      expect(port.getRootId()).toBe(rootId);
    });

    it('getRootId returns null when no root exists', () => {
      const port = new FakePersistencePort();

      expect(port.getRootId()).toBeNull();
    });

    it('createRoot stores a root node with about::home url', () => {
      const port = new FakePersistencePort();
      const rootId = port.createRoot();

      // The root node should be loadable via loadBranch
      const branch = port.loadBranch(rootId);
      const rootNode = branch.nodes.find((n) => n.id === rootId);

      expect(rootNode).toBeDefined();
      expect(rootNode!.url).toBe('about::home');
      expect(rootNode!.parentId).toBeNull();
    });
  });

  describe('saveNode / loadBranchRoots', () => {
    it('saveNode stores a node and loadBranchRoots retrieves branch roots', () => {
      const port = new FakePersistencePort();
      const rootId = port.createRoot();

      const branchRoot = makeNode({
        id: 'branch-1',
        url: 'https://example.com',
        title: 'Branch 1',
        parentId: rootId,
      });
      port.saveNode(branchRoot);

      const roots = port.loadBranchRoots();
      expect(roots).toHaveLength(1);
      expect(roots[0].id).toBe('branch-1');
      expect(roots[0].parentId).toBe(rootId);
    });

    it('saveNode upserts existing node', () => {
      const port = new FakePersistencePort();

      const node = makeNode({ id: 'n1', title: 'Original' });
      port.saveNode(node);

      const updated = makeNode({ id: 'n1', title: 'Updated' });
      port.saveNode(updated);

      const branch = port.loadBranch('n1');
      expect(branch.nodes).toHaveLength(1);
      expect(branch.nodes[0].title).toBe('Updated');
    });
  });

  describe('saveBranch / loadBranch', () => {
    it('round-trips nodes and screenshots', () => {
      const port = new FakePersistencePort();
      const rootId = port.createRoot();

      const branchRoot = makeNode({
        id: 'branch-1',
        url: 'https://example.com',
        title: 'Root Page',
        parentId: rootId,
        childIds: ['child-1'],
        descendantCount: 1,
      });
      const child = makeNode({
        id: 'child-1',
        url: 'https://example.com/page',
        title: 'Child Page',
        parentId: 'branch-1',
      });
      const screenshots = new Map([
        ['branch-1', 'data:image/png;base64,abc'],
      ]);

      port.saveBranch('branch-1', [branchRoot, child], screenshots);

      const result = port.loadBranch('branch-1');
      expect(result.nodes).toHaveLength(2);
      expect(result.nodes.map((n) => n.id).sort()).toEqual(['branch-1', 'child-1']);
      expect(result.screenshots.get('branch-1')).toBe('data:image/png;base64,abc');
    });

    it('saveBranch upserts nodes', () => {
      const port = new FakePersistencePort();

      const node = makeNode({ id: 'b1', title: 'V1', parentId: null, childIds: [] });
      port.saveBranch('b1', [node], new Map());

      const updated = makeNode({ id: 'b1', title: 'V2', parentId: null, childIds: [] });
      port.saveBranch('b1', [updated], new Map());

      const result = port.loadBranch('b1');
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].title).toBe('V2');
    });

    it('loadBranch returns empty when branch root does not exist', () => {
      const port = new FakePersistencePort();

      const result = port.loadBranch('nonexistent');
      expect(result.nodes).toHaveLength(0);
      expect(result.screenshots.size).toBe(0);
    });
  });

  describe('getDescendantCount', () => {
    it('returns descendantCount for a stored node', () => {
      const port = new FakePersistencePort();

      const node = makeNode({ id: 'n1', descendantCount: 5 });
      port.saveNode(node);

      expect(port.getDescendantCount('n1')).toBe(5);
    });

    it('returns 0 for non-existent node', () => {
      const port = new FakePersistencePort();

      expect(port.getDescendantCount('nonexistent')).toBe(0);
    });
  });

  describe('deleteSubtree', () => {
    it('removes node and all descendants', () => {
      const port = new FakePersistencePort();
      const rootId = port.createRoot();

      const parent = makeNode({
        id: 'p1',
        parentId: rootId,
        childIds: ['c1'],
        descendantCount: 2,
      });
      const child = makeNode({
        id: 'c1',
        parentId: 'p1',
        childIds: ['gc1'],
        descendantCount: 1,
      });
      const grandchild = makeNode({
        id: 'gc1',
        parentId: 'c1',
        childIds: [],
      });

      port.saveNode(parent);
      port.saveNode(child);
      port.saveNode(grandchild);

      port.saveScreenshot('p1', 'data:p1');
      port.saveScreenshot('c1', 'data:c1');

      port.deleteSubtree('p1');

      // All nodes in the subtree should be gone
      expect(port.getDescendantCount('p1')).toBe(0);
      expect(port.getDescendantCount('c1')).toBe(0);
      expect(port.getDescendantCount('gc1')).toBe(0);

      // Screenshots should also be removed
      expect(port.loadScreenshot('p1')).toBeNull();
      expect(port.loadScreenshot('c1')).toBeNull();

      // Branch roots should not include deleted node
      expect(port.loadBranchRoots()).toHaveLength(0);
    });

    it('deleteSubtree on non-existent node is a no-op', () => {
      const port = new FakePersistencePort();

      // Should not throw
      port.deleteSubtree('nonexistent');
    });
  });

  describe('searchNodes', () => {
    it('finds matching nodes by title', () => {
      const port = new FakePersistencePort();
      const rootId = port.createRoot();

      port.saveNode(makeNode({
        id: 'n1',
        title: 'TypeScript Tutorial',
        url: 'https://ts.dev',
        parentId: rootId,
      }));
      port.saveNode(makeNode({
        id: 'n2',
        title: 'Rust Guide',
        url: 'https://rust.dev',
        parentId: rootId,
      }));

      const results = port.searchNodes('TypeScript', 10);

      expect(results).toHaveLength(1);
      expect(results[0].nodeId).toBe('n1');
      expect(results[0].title).toBe('TypeScript Tutorial');
      expect(results[0].url).toBe('https://ts.dev');
    });

    it('finds matching nodes by URL', () => {
      const port = new FakePersistencePort();

      port.saveNode(makeNode({
        id: 'n1',
        title: 'Page',
        url: 'https://example.com/search',
      }));

      const results = port.searchNodes('example.com', 10);

      expect(results).toHaveLength(1);
      expect(results[0].nodeId).toBe('n1');
      expect(results[0].url).toBe('https://example.com/search');
    });

    it('respects limit', () => {
      const port = new FakePersistencePort();

      for (let i = 0; i < 5; i++) {
        port.saveNode(makeNode({
          id: `n${i}`,
          title: `Match ${i}`,
          url: `https://match${i}.com`,
        }));
      }

      const results = port.searchNodes('Match', 3);
      expect(results).toHaveLength(3);
    });

    it('returns empty array for no matches', () => {
      const port = new FakePersistencePort();

      port.saveNode(makeNode({ id: 'n1', title: 'Hello', url: 'https://hello.com' }));

      const results = port.searchNodes('zzzznotfound', 10);
      expect(results).toHaveLength(0);
    });

    it('search is case-insensitive', () => {
      const port = new FakePersistencePort();

      port.saveNode(makeNode({ id: 'n1', title: 'TypeScript Docs' }));

      const results = port.searchNodes('typescript', 10);
      expect(results).toHaveLength(1);
    });

    it('search result includes branchRootTitle', () => {
      const port = new FakePersistencePort();
      const rootId = port.createRoot();

      const branchRoot = makeNode({
        id: 'br1',
        title: 'My Branch',
        parentId: rootId,
        childIds: ['child1'],
      });
      const child = makeNode({
        id: 'child1',
        title: 'Deep Page',
        url: 'https://deep.com',
        parentId: 'br1',
      });

      port.saveNode(branchRoot);
      port.saveNode(child);

      const results = port.searchNodes('Deep', 10);
      expect(results).toHaveLength(1);
      expect(results[0].branchRootTitle).toBe('My Branch');
    });
  });

  describe('evictOldScreenshots', () => {
    it('removes screenshots older than maxAgeDays', () => {
      const port = new FakePersistencePort();

      const now = Date.now();
      const oldTime = now - 31 * 24 * 60 * 60 * 1000; // 31 days ago

      port.saveNode(makeNode({ id: 'old-node', lastVisitedAt: oldTime }));
      port.saveScreenshot('old-node', 'data:old');

      port.saveNode(makeNode({ id: 'new-node', lastVisitedAt: now }));
      port.saveScreenshot('new-node', 'data:new');

      const evicted = port.evictOldScreenshots(30, null);

      expect(evicted).toBe(1);
      expect(port.loadScreenshot('old-node')).toBeNull();
      expect(port.loadScreenshot('new-node')).toBe('data:new');
    });

    it('excludes active branch from eviction', () => {
      const port = new FakePersistencePort();
      const rootId = port.createRoot();

      const now = Date.now();
      const oldTime = now - 31 * 24 * 60 * 60 * 1000;

      // Branch root that is excluded
      const branchRoot = makeNode({
        id: 'br1',
        parentId: rootId,
        childIds: ['br1-child'],
        lastVisitedAt: oldTime,
      });
      const branchChild = makeNode({
        id: 'br1-child',
        parentId: 'br1',
        lastVisitedAt: oldTime,
      });

      // Another old node not in excluded branch
      const otherNode = makeNode({
        id: 'other',
        parentId: rootId,
        lastVisitedAt: oldTime,
      });

      port.saveNode(branchRoot);
      port.saveNode(branchChild);
      port.saveNode(otherNode);

      port.saveScreenshot('br1', 'data:br1');
      port.saveScreenshot('br1-child', 'data:br1-child');
      port.saveScreenshot('other', 'data:other');

      const evicted = port.evictOldScreenshots(30, 'br1');

      expect(evicted).toBe(1);
      // Excluded branch screenshots are preserved
      expect(port.loadScreenshot('br1')).toBe('data:br1');
      expect(port.loadScreenshot('br1-child')).toBe('data:br1-child');
      // Other old screenshot is evicted
      expect(port.loadScreenshot('other')).toBeNull();
    });
  });

  describe('saveScreenshot / loadScreenshot', () => {
    it('saves and loads a screenshot', () => {
      const port = new FakePersistencePort();

      port.saveScreenshot('n1', 'data:image/png;base64,abc');
      expect(port.loadScreenshot('n1')).toBe('data:image/png;base64,abc');
    });

    it('returns null for non-existent screenshot', () => {
      const port = new FakePersistencePort();

      expect(port.loadScreenshot('nonexistent')).toBeNull();
    });
  });

  describe('cleanupOrphans', () => {
    it('removes nodes with non-existent parents', () => {
      const port = new FakePersistencePort();
      const rootId = port.createRoot();

      // Valid node under root
      const valid = makeNode({ id: 'valid', parentId: rootId });
      port.saveNode(valid);

      // Orphan node -- parent does not exist
      const orphan = makeNode({ id: 'orphan', parentId: 'nonexistent-parent' });
      port.saveNode(orphan);

      port.cleanupOrphans();

      // Valid node should remain
      const branch = port.loadBranch(rootId);
      const validNode = branch.nodes.find((n) => n.id === 'valid');
      expect(validNode).toBeDefined();

      // Orphan should be removed
      expect(port.getDescendantCount('orphan')).toBe(0);
      const orphanBranch = port.loadBranch('orphan');
      expect(orphanBranch.nodes).toHaveLength(0);
    });

    it('does not remove root node', () => {
      const port = new FakePersistencePort();
      const rootId = port.createRoot();

      port.cleanupOrphans();

      expect(port.getRootId()).toBe(rootId);
    });
  });
});
