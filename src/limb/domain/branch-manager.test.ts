import { describe, it, expect, beforeEach } from 'vitest';
import { BranchManager } from './branch-manager';
import { FakePersistencePort } from './__test-utils__/fake-persistence-port';
import { FakeTreeProbe } from './__test-utils__/fake-tree-probe';
import { ScreenshotStore } from './screenshot-store';
import type { SerializedNode } from '../ports/persistence-port';

describe('BranchManager', () => {
  let persistence: FakePersistencePort;
  let treeProbe: FakeTreeProbe;
  let manager: BranchManager;

  beforeEach(() => {
    persistence = new FakePersistencePort();
    treeProbe = new FakeTreeProbe();
    manager = new BranchManager();
  });

  describe('initialize', () => {
    it('with empty database creates root node', () => {
      const { tree } = manager.initialize(persistence, treeProbe);

      expect(tree.nodes.size).toBe(1);
      const root = tree.nodes.get(tree.rootId)!;
      expect(root.url).toBe('about::home');
      expect(root.parentId).toBeNull();
    });

    it('with empty database calls persistence.createRoot()', () => {
      expect(persistence.getRootId()).toBeNull();

      manager.initialize(persistence, treeProbe);

      expect(persistence.getRootId()).not.toBeNull();
    });

    it('root node URL is always about::home', () => {
      const { tree } = manager.initialize(persistence, treeProbe);
      const root = tree.nodes.get(tree.rootId)!;

      expect(root.url).toBe('about::home');
    });

    it('focused node is the root after initialization', () => {
      const { tree } = manager.initialize(persistence, treeProbe);

      expect(tree.focusedNodeId).toBe(tree.rootId);
    });

    it('with existing data loads root + branch roots', () => {
      // Seed the database with root + 2 branch roots
      const rootId = persistence.createRoot();
      const branch1: SerializedNode = {
        id: 'branch-1',
        url: 'https://a.com',
        title: 'Branch A',
        favicon: null,
        parentId: rootId,
        childIds: [],
        status: 'culled',
        createdAt: 1000,
        lastVisitedAt: 2000,
        descendantCount: 3,
      };
      const branch2: SerializedNode = {
        id: 'branch-2',
        url: 'https://b.com',
        title: 'Branch B',
        favicon: 'https://b.com/icon.png',
        parentId: rootId,
        childIds: [],
        status: 'culled',
        createdAt: 1100,
        lastVisitedAt: 2100,
        descendantCount: 0,
      };
      persistence.saveNode(branch1);
      persistence.saveNode(branch2);

      const { tree } = manager.initialize(persistence, treeProbe);

      expect(tree.nodes.size).toBe(3); // root + 2 branches
      expect(tree.nodes.has(rootId)).toBe(true);
      expect(tree.nodes.has('branch-1')).toBe(true);
      expect(tree.nodes.has('branch-2')).toBe(true);
    });

    it('tree after initialize contains only root + branch roots (no subtrees)', () => {
      // Seed root + branch + subtree
      const rootId = persistence.createRoot();
      const branch: SerializedNode = {
        id: 'branch-1',
        url: 'https://a.com',
        title: 'Branch A',
        favicon: null,
        parentId: rootId,
        childIds: ['deep-1'],
        status: 'culled',
        createdAt: 1000,
        lastVisitedAt: 2000,
        descendantCount: 1,
      };
      const deepNode: SerializedNode = {
        id: 'deep-1',
        url: 'https://deep.com',
        title: 'Deep',
        favicon: null,
        parentId: 'branch-1',
        childIds: [],
        status: 'culled',
        createdAt: 1200,
        lastVisitedAt: 1200,
        descendantCount: 0,
      };
      persistence.saveNode(branch);
      persistence.saveNode(deepNode);

      const { tree } = manager.initialize(persistence, treeProbe);

      // Only root + branch root should be in memory, not deep-1
      expect(tree.nodes.size).toBe(2);
      expect(tree.nodes.has('deep-1')).toBe(false);
    });

    it('branch root metadata is preserved', () => {
      const rootId = persistence.createRoot();
      const branch: SerializedNode = {
        id: 'branch-1',
        url: 'https://example.com',
        title: 'Example Site',
        favicon: 'https://example.com/icon.png',
        parentId: rootId,
        childIds: [],
        status: 'culled',
        createdAt: 1000,
        lastVisitedAt: 5000,
        descendantCount: 10,
      };
      persistence.saveNode(branch);

      const { tree } = manager.initialize(persistence, treeProbe);

      const branchNode = tree.nodes.get('branch-1')!;
      expect(branchNode.title).toBe('Example Site');
      expect(branchNode.favicon).toBe('https://example.com/icon.png');
      expect(branchNode.createdAt).toBe(1000);
      expect(branchNode.lastVisitedAt).toBe(5000);
      expect(branchNode.descendantCount).toBe(10);
    });

    it('does not call createRoot when root already exists', () => {
      const rootId = persistence.createRoot();

      manager.initialize(persistence, treeProbe);

      // getRootId should still return the same rootId (not a new one)
      expect(persistence.getRootId()).toBe(rootId);
    });

    it('activeBranchId is null after initialization', () => {
      manager.initialize(persistence, treeProbe);

      expect(manager.activeBranchId).toBeNull();
    });

    it('fires probe events for root and branch roots', () => {
      const rootId = persistence.createRoot();
      const branch: SerializedNode = {
        id: 'branch-1',
        url: 'https://a.com',
        title: 'A',
        favicon: null,
        parentId: rootId,
        childIds: [],
        status: 'culled',
        createdAt: 1000,
        lastVisitedAt: 2000,
        descendantCount: 0,
      };
      persistence.saveNode(branch);

      manager.initialize(persistence, treeProbe);

      // Should have nodeAdded for root + branch root
      expect(treeProbe.addedNodes.length).toBe(2);
      // Should have nodeFocused for root
      expect(treeProbe.focusedNodeIds).toContain(rootId);
    });
  });

  describe('createBranch', () => {
    it('adds child of root and persists it', () => {
      const { tree } = manager.initialize(persistence, treeProbe);

      const branch = manager.createBranch(tree, 'https://new.com', persistence);

      expect(branch.url).toBe('https://new.com');
      expect(branch.parentId).toBe(tree.rootId);
      expect(tree.nodes.has(branch.id)).toBe(true);
    });

    it('saved node is retrievable from persistence', () => {
      const { tree } = manager.initialize(persistence, treeProbe);

      const branch = manager.createBranch(tree, 'https://new.com', persistence);

      // loadBranchRoots should now include the new branch
      const roots = persistence.loadBranchRoots();
      expect(roots.find(r => r.id === branch.id)).toBeDefined();
    });

    it('returns the new branch root node', () => {
      const { tree } = manager.initialize(persistence, treeProbe);

      const branch = manager.createBranch(tree, 'https://example.com', persistence);

      expect(branch.id).toBeDefined();
      expect(branch.url).toBe('https://example.com');
      expect(branch.parentId).toBe(tree.rootId);
      expect(branch.childIds).toEqual([]);
      expect(branch.descendantCount).toBe(0);
    });

    it('fires TreeProbe.nodeAdded for the new branch', () => {
      const { tree } = manager.initialize(persistence, treeProbe);
      const addedBefore = treeProbe.addedNodes.length;

      manager.createBranch(tree, 'https://new.com', persistence);

      expect(treeProbe.addedNodes.length).toBe(addedBefore + 1);
    });
  });

  describe('deleteBranch', () => {
    it('removes branch from tree and persistence', () => {
      const { tree } = manager.initialize(persistence, treeProbe);
      const branch = manager.createBranch(tree, 'https://delete-me.com', persistence);

      manager.deleteBranch(tree, branch.id, persistence);

      expect(tree.nodes.has(branch.id)).toBe(false);
      // Persistence should also not have it
      const roots = persistence.loadBranchRoots();
      expect(roots.find(r => r.id === branch.id)).toBeUndefined();
    });

    it('fires TreeProbe.nodeRemoved', () => {
      const { tree } = manager.initialize(persistence, treeProbe);
      const branch = manager.createBranch(tree, 'https://delete-me.com', persistence);

      manager.deleteBranch(tree, branch.id, persistence);

      expect(treeProbe.removedNodeIds).toContain(branch.id);
    });
  });

  describe('activateBranch', () => {
    it('loads nodes from persistence into the tree', () => {
      const { tree } = manager.initialize(persistence, treeProbe);
      const branch = manager.createBranch(tree, 'https://example.com', persistence);

      // Save a child node in persistence under this branch
      const child: SerializedNode = {
        id: 'child-1',
        url: 'https://child.com',
        title: 'Child',
        favicon: null,
        parentId: branch.id,
        childIds: [],
        status: 'culled',
        createdAt: 1000,
        lastVisitedAt: 2000,
        descendantCount: 0,
      };
      persistence.saveNode(child);
      // Update branch root in persistence to reference the child
      persistence.saveNode({
        id: branch.id,
        url: branch.url,
        title: branch.title,
        favicon: branch.favicon,
        parentId: branch.parentId,
        childIds: ['child-1'],
        status: branch.status,
        createdAt: branch.createdAt,
        lastVisitedAt: branch.lastVisitedAt,
        descendantCount: 1,
      });

      const screenshotStore = new ScreenshotStore();
      manager.activateBranch(tree, branch.id, persistence, screenshotStore);

      expect(tree.nodes.has('child-1')).toBe(true);
      expect(tree.nodes.get('child-1')!.url).toBe('https://child.com');
    });

    it('loads screenshots into the store', () => {
      const { tree } = manager.initialize(persistence, treeProbe);
      const branch = manager.createBranch(tree, 'https://example.com', persistence);

      persistence.saveScreenshot(branch.id, 'data:image/png;base64,abc123');

      const screenshotStore = new ScreenshotStore();
      manager.activateBranch(tree, branch.id, persistence, screenshotStore);

      const screenshot = screenshotStore.get(branch.id, 'low');
      expect(screenshot).toBeDefined();
      const decoder = new TextDecoder();
      expect(decoder.decode(screenshot!)).toBe('data:image/png;base64,abc123');
    });

    it('sets activeBranchId to the branch root id', () => {
      const { tree } = manager.initialize(persistence, treeProbe);
      const branch = manager.createBranch(tree, 'https://example.com', persistence);
      const screenshotStore = new ScreenshotStore();

      manager.activateBranch(tree, branch.id, persistence, screenshotStore);

      expect(manager.activeBranchId).toBe(branch.id);
    });

    it('focuses the branch root node', () => {
      const { tree } = manager.initialize(persistence, treeProbe);
      const branch = manager.createBranch(tree, 'https://example.com', persistence);
      const screenshotStore = new ScreenshotStore();

      manager.activateBranch(tree, branch.id, persistence, screenshotStore);

      expect(tree.focusedNodeId).toBe(branch.id);
      expect(treeProbe.focusedNodeIds).toContain(branch.id);
    });

    it('deactivates current branch before activating new one', () => {
      const { tree } = manager.initialize(persistence, treeProbe);
      const branchA = manager.createBranch(tree, 'https://a.com', persistence);
      const branchB = manager.createBranch(tree, 'https://b.com', persistence);

      // Add a child to branch A in persistence
      const childA: SerializedNode = {
        id: 'child-a',
        url: 'https://child-a.com',
        title: 'Child A',
        favicon: null,
        parentId: branchA.id,
        childIds: [],
        status: 'culled',
        createdAt: 1000,
        lastVisitedAt: 2000,
        descendantCount: 0,
      };
      persistence.saveNode(childA);
      persistence.saveNode({
        id: branchA.id,
        url: branchA.url,
        title: branchA.title,
        favicon: branchA.favicon,
        parentId: branchA.parentId,
        childIds: ['child-a'],
        status: branchA.status,
        createdAt: branchA.createdAt,
        lastVisitedAt: branchA.lastVisitedAt,
        descendantCount: 1,
      });

      const screenshotStore = new ScreenshotStore();

      // Activate branch A
      manager.activateBranch(tree, branchA.id, persistence, screenshotStore);
      expect(tree.nodes.has('child-a')).toBe(true);

      // Activate branch B (should deactivate A first)
      manager.activateBranch(tree, branchB.id, persistence, screenshotStore);

      // Branch A's subtree should be unloaded
      expect(tree.nodes.has('child-a')).toBe(false);
      // Branch A root should still be in tree
      expect(tree.nodes.has(branchA.id)).toBe(true);
      // Active branch should be B
      expect(manager.activeBranchId).toBe(branchB.id);
      expect(tree.focusedNodeId).toBe(branchB.id);
    });
  });

  describe('deactivateBranch', () => {
    it('saves nodes and screenshots to persistence', () => {
      const { tree } = manager.initialize(persistence, treeProbe);
      const branch = manager.createBranch(tree, 'https://example.com', persistence);

      const screenshotStore = new ScreenshotStore();
      manager.activateBranch(tree, branch.id, persistence, screenshotStore);

      // Add a child node while the branch is active
      const child = tree.addChild(branch.id, 'https://child.com');

      // Store a screenshot
      const encoder = new TextEncoder();
      screenshotStore.store(child.id, 'low', encoder.encode('screenshot-data'));

      manager.deactivateBranch(tree, persistence, screenshotStore);

      // Verify the child was saved to persistence
      const loaded = persistence.loadBranch(branch.id);
      expect(loaded.nodes.find(n => n.id === child.id)).toBeDefined();
      expect(loaded.screenshots.get(child.id)).toBe('screenshot-data');
    });

    it('removes descendants from tree but keeps branch root', () => {
      const { tree } = manager.initialize(persistence, treeProbe);
      const branch = manager.createBranch(tree, 'https://example.com', persistence);

      const screenshotStore = new ScreenshotStore();
      manager.activateBranch(tree, branch.id, persistence, screenshotStore);

      const child = tree.addChild(branch.id, 'https://child.com');

      manager.deactivateBranch(tree, persistence, screenshotStore);

      expect(tree.nodes.has(branch.id)).toBe(true);
      expect(tree.nodes.has(child.id)).toBe(false);
    });

    it('frees screenshots from memory for removed nodes', () => {
      const { tree } = manager.initialize(persistence, treeProbe);
      const branch = manager.createBranch(tree, 'https://example.com', persistence);

      const screenshotStore = new ScreenshotStore();
      manager.activateBranch(tree, branch.id, persistence, screenshotStore);

      const child = tree.addChild(branch.id, 'https://child.com');

      const encoder = new TextEncoder();
      screenshotStore.store(child.id, 'low', encoder.encode('child-screenshot'));
      screenshotStore.store(branch.id, 'low', encoder.encode('branch-screenshot'));

      manager.deactivateBranch(tree, persistence, screenshotStore);

      // Child's screenshot should be freed
      expect(screenshotStore.get(child.id, 'low')).toBeUndefined();
      // Branch root's screenshot should remain (branch root is kept)
      expect(screenshotStore.get(branch.id, 'low')).toBeDefined();
    });

    it('sets activeBranchId to null', () => {
      const { tree } = manager.initialize(persistence, treeProbe);
      const branch = manager.createBranch(tree, 'https://example.com', persistence);

      const screenshotStore = new ScreenshotStore();
      manager.activateBranch(tree, branch.id, persistence, screenshotStore);
      expect(manager.activeBranchId).toBe(branch.id);

      manager.deactivateBranch(tree, persistence, screenshotStore);

      expect(manager.activeBranchId).toBeNull();
    });

    it('is a no-op when no branch is active', () => {
      const { tree } = manager.initialize(persistence, treeProbe);
      const screenshotStore = new ScreenshotStore();
      const nodeCountBefore = tree.nodes.size;

      manager.deactivateBranch(tree, persistence, screenshotStore);

      expect(tree.nodes.size).toBe(nodeCountBefore);
      expect(manager.activeBranchId).toBeNull();
    });
  });
});
