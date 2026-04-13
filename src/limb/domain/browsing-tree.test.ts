import { describe, it, expect, beforeEach } from 'vitest';
import { BrowsingTree } from './browsing-tree';
import { FakeTreeProbe } from './__test-utils__/fake-tree-probe';
import type { TreeNode } from './tree-node';

describe('BrowsingTree.create', () => {
  let probe: FakeTreeProbe;

  beforeEach(() => {
    probe = new FakeTreeProbe();
  });

  it('produces a tree with exactly one root node', () => {
    const tree = BrowsingTree.create('https://example.com', probe);

    expect(tree.nodes.size).toBe(1);
    const root = tree.nodes.get(tree.rootId);
    expect(root).toBeDefined();
  });

  it('root node has parentId null, empty childIds, status culled', () => {
    const tree = BrowsingTree.create('https://example.com', probe);
    const root = tree.nodes.get(tree.rootId)!;

    expect(root.parentId).toBeNull();
    expect(root.childIds).toEqual([]);
    expect(root.status).toBe('culled');
  });

  it('root node has the provided URL and empty title', () => {
    const tree = BrowsingTree.create('https://example.com', probe);
    const root = tree.nodes.get(tree.rootId)!;

    expect(root.url).toBe('https://example.com');
    expect(root.title).toBe('');
    expect(root.favicon).toBeNull();
  });

  it('focusedNodeId equals the root id', () => {
    const tree = BrowsingTree.create('https://example.com', probe);

    expect(tree.focusedNodeId).toBe(tree.rootId);
  });

  it('createdAt and lastVisitedAt are set', () => {
    const before = Date.now();
    const tree = BrowsingTree.create('https://example.com', probe);
    const after = Date.now();
    const root = tree.nodes.get(tree.rootId)!;

    expect(root.createdAt).toBeGreaterThanOrEqual(before);
    expect(root.createdAt).toBeLessThanOrEqual(after);
    expect(root.lastVisitedAt).toBe(root.createdAt);
  });

  it('calls TreeProbe.nodeAdded with the root node', () => {
    const tree = BrowsingTree.create('https://example.com', probe);
    const root = tree.nodes.get(tree.rootId)!;

    expect(probe.addedNodes).toHaveLength(1);
    expect(probe.addedNodes[0]).toEqual(root);
  });

  it('calls TreeProbe.nodeFocused with the root id on creation', () => {
    const tree = BrowsingTree.create('https://example.com', probe);

    expect(probe.focusedNodeIds).toHaveLength(1);
    expect(probe.focusedNodeIds[0]).toBe(tree.rootId);
  });

  it('root node has a unique UUID-format id', () => {
    const tree = BrowsingTree.create('https://example.com', probe);
    const root = tree.nodes.get(tree.rootId)!;

    // UUID v4 format: 8-4-4-4-12 hex characters
    expect(root.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });
});

describe('BrowsingTree.addChild', () => {
  let probe: FakeTreeProbe;
  let tree: BrowsingTree;

  beforeEach(() => {
    probe = new FakeTreeProbe();
    tree = BrowsingTree.create('https://example.com', probe);
  });

  it('creates a child node with correct parentId', () => {
    const child = tree.addChild(tree.rootId, 'https://child.com');

    expect(child.parentId).toBe(tree.rootId);
  });

  it('child appears in parent childIds', () => {
    const child = tree.addChild(tree.rootId, 'https://child.com');
    const parent = tree.nodes.get(tree.rootId)!;

    expect(parent.childIds).toContain(child.id);
  });

  it('child is added to the tree nodes map', () => {
    const child = tree.addChild(tree.rootId, 'https://child.com');

    expect(tree.nodes.get(child.id)).toBe(child);
  });

  it('multiple children are ordered by createdAt', () => {
    const child1 = tree.addChild(tree.rootId, 'https://first.com');
    const child2 = tree.addChild(tree.rootId, 'https://second.com');
    const parent = tree.nodes.get(tree.rootId)!;

    expect(parent.childIds).toEqual([child1.id, child2.id]);
    expect(child1.createdAt).toBeLessThanOrEqual(child2.createdAt);
  });

  it('throws if parentId does not exist', () => {
    expect(() => tree.addChild('nonexistent-id', 'https://child.com'))
      .toThrow();
  });

  it('new node has status culled, unique ID, timestamps set', () => {
    const before = Date.now();
    const child = tree.addChild(tree.rootId, 'https://child.com');
    const after = Date.now();

    expect(child.status).toBe('culled');
    expect(child.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(child.id).not.toBe(tree.rootId);
    expect(child.createdAt).toBeGreaterThanOrEqual(before);
    expect(child.createdAt).toBeLessThanOrEqual(after);
    expect(child.lastVisitedAt).toBe(child.createdAt);
  });

  it('calls TreeProbe.nodeAdded with the new node', () => {
    const child = tree.addChild(tree.rootId, 'https://child.com');

    // probe.addedNodes[0] is the root from create(), [1] is the child
    expect(probe.addedNodes).toHaveLength(2);
    expect(probe.addedNodes[1]).toBe(child);
  });

  it('new node has empty title, null favicon, empty childIds', () => {
    const child = tree.addChild(tree.rootId, 'https://child.com');

    expect(child.title).toBe('');
    expect(child.favicon).toBeNull();
    expect(child.childIds).toEqual([]);
  });

  it('can add children to non-root nodes', () => {
    const child = tree.addChild(tree.rootId, 'https://child.com');
    const grandchild = tree.addChild(child.id, 'https://grandchild.com');

    expect(grandchild.parentId).toBe(child.id);
    const childNode = tree.nodes.get(child.id)!;
    expect(childNode.childIds).toContain(grandchild.id);
  });
});

describe('BrowsingTree.focusNode', () => {
  let probe: FakeTreeProbe;
  let tree: BrowsingTree;

  beforeEach(() => {
    probe = new FakeTreeProbe();
    tree = BrowsingTree.create('https://example.com', probe);
  });

  it('sets focusedNodeId to the given node', () => {
    const child = tree.addChild(tree.rootId, 'https://child.com');

    tree.focusNode(child.id);

    expect(tree.focusedNodeId).toBe(child.id);
  });

  it('updates lastVisitedAt on the target node', () => {
    const child = tree.addChild(tree.rootId, 'https://child.com');
    const originalLastVisited = child.lastVisitedAt;

    // Small delay to ensure Date.now() advances
    const before = Date.now();
    tree.focusNode(child.id);
    const after = Date.now();

    const node = tree.nodes.get(child.id)!;
    expect(node.lastVisitedAt).toBeGreaterThanOrEqual(before);
    expect(node.lastVisitedAt).toBeLessThanOrEqual(after);
  });

  it('throws if nodeId does not exist', () => {
    expect(() => tree.focusNode('nonexistent-id')).toThrow();
  });

  it('calls TreeProbe.nodeFocused with the node ID', () => {
    const child = tree.addChild(tree.rootId, 'https://child.com');
    const focusedBefore = probe.focusedNodeIds.length;

    tree.focusNode(child.id);

    expect(probe.focusedNodeIds).toHaveLength(focusedBefore + 1);
    expect(probe.focusedNodeIds[focusedBefore]).toBe(child.id);
  });

  it('focusing the already-focused node still updates lastVisitedAt', () => {
    // Root is already focused from create()
    const root = tree.nodes.get(tree.rootId)!;
    const originalLastVisited = root.lastVisitedAt;

    const before = Date.now();
    tree.focusNode(tree.rootId);
    const after = Date.now();

    const updatedRoot = tree.nodes.get(tree.rootId)!;
    expect(updatedRoot.lastVisitedAt).toBeGreaterThanOrEqual(before);
    expect(updatedRoot.lastVisitedAt).toBeLessThanOrEqual(after);
    // Also verify probe is called
    const focusedCount = probe.focusedNodeIds.filter(id => id === tree.rootId).length;
    expect(focusedCount).toBe(2); // once from create(), once from focusNode()
  });
});

describe('BrowsingTree.removeNode', () => {
  let probe: FakeTreeProbe;
  let tree: BrowsingTree;

  beforeEach(() => {
    probe = new FakeTreeProbe();
    tree = BrowsingTree.create('https://example.com', probe);
  });

  it('removes a leaf node and updates parent childIds', () => {
    const child = tree.addChild(tree.rootId, 'https://child.com');

    tree.removeNode(child.id);

    expect(tree.nodes.has(child.id)).toBe(false);
    const root = tree.nodes.get(tree.rootId)!;
    expect(root.childIds).not.toContain(child.id);
  });

  it('removes a node with children (entire subtree)', () => {
    const child = tree.addChild(tree.rootId, 'https://child.com');
    const grandchild1 = tree.addChild(child.id, 'https://gc1.com');
    const grandchild2 = tree.addChild(child.id, 'https://gc2.com');

    tree.removeNode(child.id);

    expect(tree.nodes.has(child.id)).toBe(false);
    expect(tree.nodes.has(grandchild1.id)).toBe(false);
    expect(tree.nodes.has(grandchild2.id)).toBe(false);
    expect(tree.nodes.size).toBe(1); // only root remains
  });

  it('throws when attempting to remove the root', () => {
    expect(() => tree.removeNode(tree.rootId)).toThrow();
  });

  it('moves focus to parent when focused node is removed', () => {
    const child = tree.addChild(tree.rootId, 'https://child.com');
    tree.focusNode(child.id);
    const focusedBefore = probe.focusedNodeIds.length;

    const before = Date.now();
    tree.removeNode(child.id);

    expect(tree.focusedNodeId).toBe(tree.rootId);
    expect(probe.focusedNodeIds).toHaveLength(focusedBefore + 1);
    expect(probe.focusedNodeIds[focusedBefore]).toBe(tree.rootId);
    const root = tree.nodes.get(tree.rootId)!;
    expect(root.lastVisitedAt).toBeGreaterThanOrEqual(before);
  });

  it('moves focus to parent when an ancestor of focused node is removed', () => {
    const child = tree.addChild(tree.rootId, 'https://child.com');
    const grandchild = tree.addChild(child.id, 'https://gc.com');
    tree.focusNode(grandchild.id);
    const focusedBefore = probe.focusedNodeIds.length;

    const before = Date.now();
    tree.removeNode(child.id);

    expect(tree.focusedNodeId).toBe(tree.rootId);
    expect(probe.focusedNodeIds).toHaveLength(focusedBefore + 1);
    expect(probe.focusedNodeIds[focusedBefore]).toBe(tree.rootId);
    const root = tree.nodes.get(tree.rootId)!;
    expect(root.lastVisitedAt).toBeGreaterThanOrEqual(before);
  });

  it('calls TreeProbe.nodeRemoved for each removed node', () => {
    const child = tree.addChild(tree.rootId, 'https://child.com');
    const grandchild = tree.addChild(child.id, 'https://gc.com');

    tree.removeNode(child.id);

    expect(probe.removedNodeIds).toContain(child.id);
    expect(probe.removedNodeIds).toContain(grandchild.id);
    expect(probe.removedNodeIds).toHaveLength(2);
  });

  it('throws for nonexistent nodeId', () => {
    expect(() => tree.removeNode('nonexistent-id')).toThrow();
  });
});

describe('BrowsingTree.getAncestors', () => {
  let probe: FakeTreeProbe;
  let tree: BrowsingTree;

  beforeEach(() => {
    probe = new FakeTreeProbe();
    tree = BrowsingTree.create('https://example.com', probe);
  });

  it('root returns [root]', () => {
    const root = tree.nodes.get(tree.rootId)!;

    const ancestors = tree.getAncestors(tree.rootId);

    expect(ancestors).toEqual([root]);
  });

  it('leaf at depth 3 returns [leaf, parent, grandparent, root]', () => {
    const root = tree.nodes.get(tree.rootId)!;
    const child = tree.addChild(tree.rootId, 'https://child.com');
    const grandchild = tree.addChild(child.id, 'https://grandchild.com');
    const leaf = tree.addChild(grandchild.id, 'https://leaf.com');

    const ancestors = tree.getAncestors(leaf.id);

    expect(ancestors).toEqual([leaf, grandchild, child, root]);
  });

  it('throws for nonexistent nodeId', () => {
    expect(() => tree.getAncestors('nonexistent-id')).toThrow();
  });
});

describe('BrowsingTree.getDescendants', () => {
  let probe: FakeTreeProbe;
  let tree: BrowsingTree;

  beforeEach(() => {
    probe = new FakeTreeProbe();
    tree = BrowsingTree.create('https://example.com', probe);
  });

  it('root of a 5-node tree returns all 5 in BFS order', () => {
    const root = tree.nodes.get(tree.rootId)!;
    const child1 = tree.addChild(tree.rootId, 'https://child1.com');
    const child2 = tree.addChild(tree.rootId, 'https://child2.com');
    const gc1 = tree.addChild(child1.id, 'https://gc1.com');
    const gc2 = tree.addChild(child2.id, 'https://gc2.com');

    const descendants = tree.getDescendants(tree.rootId);

    expect(descendants).toEqual([root, child1, child2, gc1, gc2]);
  });

  it('leaf returns [leaf]', () => {
    const child = tree.addChild(tree.rootId, 'https://child.com');

    const descendants = tree.getDescendants(child.id);

    expect(descendants).toEqual([child]);
  });

  it('throws for nonexistent nodeId', () => {
    expect(() => tree.getDescendants('nonexistent-id')).toThrow();
  });
});

describe('BrowsingTree.getSubtreeDepth', () => {
  let probe: FakeTreeProbe;
  let tree: BrowsingTree;

  beforeEach(() => {
    probe = new FakeTreeProbe();
    tree = BrowsingTree.create('https://example.com', probe);
  });

  it('single node returns 0', () => {
    expect(tree.getSubtreeDepth(tree.rootId)).toBe(0);
  });

  it('root with one child returns 1', () => {
    tree.addChild(tree.rootId, 'https://child.com');

    expect(tree.getSubtreeDepth(tree.rootId)).toBe(1);
  });

  it('deeper tree returns correct max depth', () => {
    const child1 = tree.addChild(tree.rootId, 'https://child1.com');
    tree.addChild(tree.rootId, 'https://child2.com');
    const gc = tree.addChild(child1.id, 'https://gc.com');
    tree.addChild(gc.id, 'https://ggc.com');

    // root -> child1 -> gc -> ggc = depth 3
    expect(tree.getSubtreeDepth(tree.rootId)).toBe(3);
  });

  it('throws for nonexistent nodeId', () => {
    expect(() => tree.getSubtreeDepth('nonexistent-id')).toThrow();
  });
});

describe('BrowsingTree.getSiblings', () => {
  let probe: FakeTreeProbe;
  let tree: BrowsingTree;

  beforeEach(() => {
    probe = new FakeTreeProbe();
    tree = BrowsingTree.create('https://example.com', probe);
  });

  it('node with 2 siblings returns them', () => {
    const child1 = tree.addChild(tree.rootId, 'https://child1.com');
    const child2 = tree.addChild(tree.rootId, 'https://child2.com');
    const child3 = tree.addChild(tree.rootId, 'https://child3.com');

    const siblings = tree.getSiblings(child2.id);

    expect(siblings).toEqual([child1, child3]);
  });

  it('root (no parent) returns []', () => {
    const siblings = tree.getSiblings(tree.rootId);

    expect(siblings).toEqual([]);
  });

  it('only child returns []', () => {
    const child = tree.addChild(tree.rootId, 'https://child.com');

    const siblings = tree.getSiblings(child.id);

    expect(siblings).toEqual([]);
  });

  it('throws for nonexistent nodeId', () => {
    expect(() => tree.getSiblings('nonexistent-id')).toThrow();
  });
});

describe('BrowsingTree descendantCount', () => {
  let probe: FakeTreeProbe;
  let tree: BrowsingTree;

  beforeEach(() => {
    probe = new FakeTreeProbe();
    tree = BrowsingTree.create('https://example.com', probe);
  });

  it('create() produces a root with descendantCount 0', () => {
    const root = tree.nodes.get(tree.rootId)!;
    expect(root.descendantCount).toBe(0);
  });

  it('addChild increments descendantCount on parent', () => {
    tree.addChild(tree.rootId, 'https://child.com');
    const root = tree.nodes.get(tree.rootId)!;
    expect(root.descendantCount).toBe(1);
  });

  it('addChild increments descendantCount on parent, grandparent, and root', () => {
    const child = tree.addChild(tree.rootId, 'https://child.com');
    const grandchild = tree.addChild(child.id, 'https://grandchild.com');

    const root = tree.nodes.get(tree.rootId)!;
    const childNode = tree.nodes.get(child.id)!;
    const grandchildNode = tree.nodes.get(grandchild.id)!;

    expect(root.descendantCount).toBe(2);
    expect(childNode.descendantCount).toBe(1);
    expect(grandchildNode.descendantCount).toBe(0);
  });

  it('descendantCount is 0 for leaf nodes', () => {
    const child = tree.addChild(tree.rootId, 'https://child.com');
    expect(child.descendantCount).toBe(0);
  });

  it('removeNode decrements descendantCount on all ancestors by the subtree size', () => {
    const child = tree.addChild(tree.rootId, 'https://child.com');
    tree.addChild(child.id, 'https://gc1.com');

    // root.descendantCount should be 2, child should be 1
    tree.removeNode(child.id);

    const root = tree.nodes.get(tree.rootId)!;
    expect(root.descendantCount).toBe(0);
  });

  it('removing a subtree of 3 nodes decrements ancestors by 3', () => {
    const child1 = tree.addChild(tree.rootId, 'https://child1.com');
    const child2 = tree.addChild(tree.rootId, 'https://child2.com');
    const gc1 = tree.addChild(child1.id, 'https://gc1.com');
    const gc2 = tree.addChild(child1.id, 'https://gc2.com');

    // root has 4 descendants, child1 has 2, child2 has 0
    expect(tree.nodes.get(tree.rootId)!.descendantCount).toBe(4);
    expect(tree.nodes.get(child1.id)!.descendantCount).toBe(2);

    // Remove child1 subtree (child1 + gc1 + gc2 = 3 nodes)
    tree.removeNode(child1.id);

    const root = tree.nodes.get(tree.rootId)!;
    expect(root.descendantCount).toBe(1); // only child2 remains
  });

  it('multiple addChild calls at same level accumulate descendantCount', () => {
    tree.addChild(tree.rootId, 'https://c1.com');
    tree.addChild(tree.rootId, 'https://c2.com');
    tree.addChild(tree.rootId, 'https://c3.com');

    const root = tree.nodes.get(tree.rootId)!;
    expect(root.descendantCount).toBe(3);
  });

  it('deep chain increments all ancestors', () => {
    const c = tree.addChild(tree.rootId, 'https://c.com');
    const gc = tree.addChild(c.id, 'https://gc.com');
    const ggc = tree.addChild(gc.id, 'https://ggc.com');

    expect(tree.nodes.get(tree.rootId)!.descendantCount).toBe(3);
    expect(tree.nodes.get(c.id)!.descendantCount).toBe(2);
    expect(tree.nodes.get(gc.id)!.descendantCount).toBe(1);
    expect(tree.nodes.get(ggc.id)!.descendantCount).toBe(0);
  });
});

describe('BrowsingTree.addExistingNode', () => {
  let probe: FakeTreeProbe;
  let tree: BrowsingTree;

  beforeEach(() => {
    probe = new FakeTreeProbe();
    tree = BrowsingTree.create('about::home', probe);
  });

  it('adds the node to the tree nodes map', () => {
    const node: TreeNode = {
      id: 'existing-1',
      url: 'https://example.com',
      title: 'Example',
      favicon: null,
      parentId: tree.rootId,
      childIds: [],
      status: 'culled',
      createdAt: 1000,
      lastVisitedAt: 2000,
      descendantCount: 0,
    };

    tree.addExistingNode(node);

    expect(tree.nodes.get('existing-1')).toBe(node);
  });

  it('adds the node id to parent childIds', () => {
    const node: TreeNode = {
      id: 'existing-1',
      url: 'https://example.com',
      title: 'Example',
      favicon: null,
      parentId: tree.rootId,
      childIds: [],
      status: 'culled',
      createdAt: 1000,
      lastVisitedAt: 2000,
      descendantCount: 0,
    };

    tree.addExistingNode(node);

    const root = tree.nodes.get(tree.rootId)!;
    expect(root.childIds).toContain('existing-1');
  });

  it('increments ancestor descendantCount by 1 + node.descendantCount', () => {
    const node: TreeNode = {
      id: 'branch-root',
      url: 'https://example.com',
      title: 'Branch Root',
      favicon: null,
      parentId: tree.rootId,
      childIds: [],
      status: 'culled',
      createdAt: 1000,
      lastVisitedAt: 2000,
      descendantCount: 5,
    };

    tree.addExistingNode(node);

    const root = tree.nodes.get(tree.rootId)!;
    expect(root.descendantCount).toBe(6); // 1 (the node) + 5 (its descendants)
  });

  it('fires TreeProbe.nodeAdded', () => {
    const node: TreeNode = {
      id: 'existing-1',
      url: 'https://example.com',
      title: 'Example',
      favicon: null,
      parentId: tree.rootId,
      childIds: [],
      status: 'culled',
      createdAt: 1000,
      lastVisitedAt: 2000,
      descendantCount: 0,
    };

    tree.addExistingNode(node);

    // probe.addedNodes[0] is root from create(), [1] is existing node
    expect(probe.addedNodes).toHaveLength(2);
    expect(probe.addedNodes[1]).toBe(node);
  });

  it('throws if parentId does not exist in the tree', () => {
    const node: TreeNode = {
      id: 'orphan',
      url: 'https://example.com',
      title: 'Orphan',
      favicon: null,
      parentId: 'nonexistent-parent',
      childIds: [],
      status: 'culled',
      createdAt: 1000,
      lastVisitedAt: 2000,
      descendantCount: 0,
    };

    expect(() => tree.addExistingNode(node)).toThrow();
  });

  it('preserves the node metadata (title, favicon, timestamps)', () => {
    const node: TreeNode = {
      id: 'existing-1',
      url: 'https://example.com',
      title: 'My Title',
      favicon: 'https://example.com/icon.png',
      parentId: tree.rootId,
      childIds: [],
      status: 'culled',
      createdAt: 1000,
      lastVisitedAt: 2000,
      descendantCount: 3,
    };

    tree.addExistingNode(node);

    const added = tree.nodes.get('existing-1')!;
    expect(added.title).toBe('My Title');
    expect(added.favicon).toBe('https://example.com/icon.png');
    expect(added.createdAt).toBe(1000);
    expect(added.lastVisitedAt).toBe(2000);
    expect(added.descendantCount).toBe(3);
  });

  it('multiple addExistingNode calls accumulate correctly', () => {
    const node1: TreeNode = {
      id: 'branch-1',
      url: 'https://a.com',
      title: 'A',
      favicon: null,
      parentId: tree.rootId,
      childIds: [],
      status: 'culled',
      createdAt: 1000,
      lastVisitedAt: 2000,
      descendantCount: 2,
    };
    const node2: TreeNode = {
      id: 'branch-2',
      url: 'https://b.com',
      title: 'B',
      favicon: null,
      parentId: tree.rootId,
      childIds: [],
      status: 'culled',
      createdAt: 1100,
      lastVisitedAt: 2100,
      descendantCount: 3,
    };

    tree.addExistingNode(node1);
    tree.addExistingNode(node2);

    expect(tree.nodes.size).toBe(3); // root + 2 branch roots
    const root = tree.nodes.get(tree.rootId)!;
    expect(root.childIds).toEqual(['branch-1', 'branch-2']);
    expect(root.descendantCount).toBe(7); // (1+2) + (1+3) = 7
  });
});

describe('BrowsingTree.loadSubtree', () => {
  let probe: FakeTreeProbe;
  let tree: BrowsingTree;

  beforeEach(() => {
    probe = new FakeTreeProbe();
    tree = BrowsingTree.create('about::home', probe);
  });

  it('inserts nodes into the tree', () => {
    const branchRoot = tree.addChild(tree.rootId, 'https://example.com');

    const child: TreeNode = {
      id: 'child-1',
      url: 'https://child.com',
      title: 'Child',
      favicon: null,
      parentId: branchRoot.id,
      childIds: [],
      status: 'culled',
      createdAt: 1000,
      lastVisitedAt: 2000,
      descendantCount: 0,
    };

    tree.loadSubtree([
      { ...branchRoot, childIds: ['child-1'] },
      child,
    ]);

    expect(tree.nodes.has('child-1')).toBe(true);
    expect(tree.nodes.get('child-1')).toBe(child);
  });

  it('wires parent-child relationships correctly', () => {
    const branchRoot = tree.addChild(tree.rootId, 'https://example.com');

    const child1: TreeNode = {
      id: 'child-1',
      url: 'https://child1.com',
      title: 'Child 1',
      favicon: null,
      parentId: branchRoot.id,
      childIds: ['grandchild-1'],
      status: 'culled',
      createdAt: 1000,
      lastVisitedAt: 2000,
      descendantCount: 1,
    };
    const grandchild1: TreeNode = {
      id: 'grandchild-1',
      url: 'https://grandchild.com',
      title: 'Grandchild',
      favicon: null,
      parentId: 'child-1',
      childIds: [],
      status: 'culled',
      createdAt: 1100,
      lastVisitedAt: 2100,
      descendantCount: 0,
    };

    tree.loadSubtree([
      { ...branchRoot, childIds: ['child-1'] },
      child1,
      grandchild1,
    ]);

    // Branch root should now have child-1 in childIds
    const updatedBranchRoot = tree.nodes.get(branchRoot.id)!;
    expect(updatedBranchRoot.childIds).toEqual(['child-1']);

    // child-1 should have grandchild-1 in childIds
    const loadedChild = tree.nodes.get('child-1')!;
    expect(loadedChild.childIds).toEqual(['grandchild-1']);

    // grandchild-1 should point to child-1 as parent
    const loadedGrandchild = tree.nodes.get('grandchild-1')!;
    expect(loadedGrandchild.parentId).toBe('child-1');
  });

  it('fires nodeAdded probe for each inserted node', () => {
    const branchRoot = tree.addChild(tree.rootId, 'https://example.com');
    const addedBefore = probe.addedNodes.length;

    const child: TreeNode = {
      id: 'child-1',
      url: 'https://child.com',
      title: 'Child',
      favicon: null,
      parentId: branchRoot.id,
      childIds: [],
      status: 'culled',
      createdAt: 1000,
      lastVisitedAt: 2000,
      descendantCount: 0,
    };
    const child2: TreeNode = {
      id: 'child-2',
      url: 'https://child2.com',
      title: 'Child 2',
      favicon: null,
      parentId: branchRoot.id,
      childIds: [],
      status: 'culled',
      createdAt: 1100,
      lastVisitedAt: 2100,
      descendantCount: 0,
    };

    tree.loadSubtree([
      { ...branchRoot, childIds: ['child-1', 'child-2'] },
      child,
      child2,
    ]);

    // Only child and child2 should fire nodeAdded (branch root is skipped)
    expect(probe.addedNodes.length).toBe(addedBefore + 2);
    expect(probe.addedNodes[addedBefore]).toBe(child);
    expect(probe.addedNodes[addedBefore + 1]).toBe(child2);
  });

  it('skips nodes already in tree without firing nodeAdded', () => {
    const branchRoot = tree.addChild(tree.rootId, 'https://example.com');
    const addedBefore = probe.addedNodes.length;

    const child: TreeNode = {
      id: 'child-1',
      url: 'https://child.com',
      title: 'Child',
      favicon: null,
      parentId: branchRoot.id,
      childIds: [],
      status: 'culled',
      createdAt: 1000,
      lastVisitedAt: 2000,
      descendantCount: 0,
    };

    tree.loadSubtree([
      { ...branchRoot, childIds: ['child-1'] },
      child,
    ]);

    // Only child should fire nodeAdded, not the already-present branch root
    expect(probe.addedNodes.length).toBe(addedBefore + 1);
    expect(probe.addedNodes[addedBefore]).toBe(child);
  });

  it('updates existing node childIds from loaded data', () => {
    const branchRoot = tree.addChild(tree.rootId, 'https://example.com');
    expect(branchRoot.childIds).toEqual([]);

    tree.loadSubtree([
      { ...branchRoot, childIds: ['child-1', 'child-2'] },
    ]);

    const updated = tree.nodes.get(branchRoot.id)!;
    expect(updated.childIds).toEqual(['child-1', 'child-2']);
  });

  it('does not change descendantCount on ancestors', () => {
    const branchRoot = tree.addChild(tree.rootId, 'https://example.com');
    const rootDescCountBefore = tree.nodes.get(tree.rootId)!.descendantCount;
    const branchDescCountBefore = branchRoot.descendantCount;

    const child: TreeNode = {
      id: 'child-1',
      url: 'https://child.com',
      title: 'Child',
      favicon: null,
      parentId: branchRoot.id,
      childIds: [],
      status: 'culled',
      createdAt: 1000,
      lastVisitedAt: 2000,
      descendantCount: 0,
    };

    tree.loadSubtree([
      { ...branchRoot, childIds: ['child-1'] },
      child,
    ]);

    expect(tree.nodes.get(tree.rootId)!.descendantCount).toBe(rootDescCountBefore);
    expect(tree.nodes.get(branchRoot.id)!.descendantCount).toBe(branchDescCountBefore);
  });
});

describe('BrowsingTree.unloadSubtree', () => {
  let probe: FakeTreeProbe;
  let tree: BrowsingTree;

  beforeEach(() => {
    probe = new FakeTreeProbe();
    tree = BrowsingTree.create('about::home', probe);
  });

  it('removes all descendants but keeps the target node', () => {
    const branchRoot = tree.addChild(tree.rootId, 'https://example.com');
    const child1 = tree.addChild(branchRoot.id, 'https://child1.com');
    const child2 = tree.addChild(branchRoot.id, 'https://child2.com');
    const grandchild = tree.addChild(child1.id, 'https://gc.com');

    tree.unloadSubtree(branchRoot.id);

    expect(tree.nodes.has(branchRoot.id)).toBe(true);
    expect(tree.nodes.has(child1.id)).toBe(false);
    expect(tree.nodes.has(child2.id)).toBe(false);
    expect(tree.nodes.has(grandchild.id)).toBe(false);
  });

  it('clears the target node childIds', () => {
    const branchRoot = tree.addChild(tree.rootId, 'https://example.com');
    tree.addChild(branchRoot.id, 'https://child1.com');
    tree.addChild(branchRoot.id, 'https://child2.com');

    tree.unloadSubtree(branchRoot.id);

    const updated = tree.nodes.get(branchRoot.id)!;
    expect(updated.childIds).toEqual([]);
  });

  it('fires nodeRemoved probe for each removed node', () => {
    const branchRoot = tree.addChild(tree.rootId, 'https://example.com');
    const child1 = tree.addChild(branchRoot.id, 'https://child1.com');
    const child2 = tree.addChild(branchRoot.id, 'https://child2.com');
    const removedBefore = probe.removedNodeIds.length;

    tree.unloadSubtree(branchRoot.id);

    expect(probe.removedNodeIds.length).toBe(removedBefore + 2);
    expect(probe.removedNodeIds).toContain(child1.id);
    expect(probe.removedNodeIds).toContain(child2.id);
  });

  it('does not fire nodeRemoved for the target node', () => {
    const branchRoot = tree.addChild(tree.rootId, 'https://example.com');
    tree.addChild(branchRoot.id, 'https://child1.com');

    tree.unloadSubtree(branchRoot.id);

    expect(probe.removedNodeIds).not.toContain(branchRoot.id);
  });

  it('moves focus to branch root when focused node is unloaded', () => {
    const branchRoot = tree.addChild(tree.rootId, 'https://example.com');
    const child = tree.addChild(branchRoot.id, 'https://child.com');
    tree.focusNode(child.id);
    const focusedBefore = probe.focusedNodeIds.length;

    tree.unloadSubtree(branchRoot.id);

    expect(tree.focusedNodeId).toBe(branchRoot.id);
    expect(probe.focusedNodeIds[focusedBefore]).toBe(branchRoot.id);
  });

  it('keeps focus unchanged if focused node is the branch root', () => {
    const branchRoot = tree.addChild(tree.rootId, 'https://example.com');
    tree.addChild(branchRoot.id, 'https://child.com');
    tree.focusNode(branchRoot.id);
    const focusedBefore = probe.focusedNodeIds.length;

    tree.unloadSubtree(branchRoot.id);

    expect(tree.focusedNodeId).toBe(branchRoot.id);
    // No additional focus event should fire
    expect(probe.focusedNodeIds.length).toBe(focusedBefore);
  });

  it('does not change descendantCount on any node', () => {
    const branchRoot = tree.addChild(tree.rootId, 'https://example.com');
    tree.addChild(branchRoot.id, 'https://child1.com');
    tree.addChild(branchRoot.id, 'https://child2.com');

    const rootDescCountBefore = tree.nodes.get(tree.rootId)!.descendantCount;
    const branchDescCountBefore = tree.nodes.get(branchRoot.id)!.descendantCount;

    tree.unloadSubtree(branchRoot.id);

    expect(tree.nodes.get(tree.rootId)!.descendantCount).toBe(rootDescCountBefore);
    expect(tree.nodes.get(branchRoot.id)!.descendantCount).toBe(branchDescCountBefore);
  });

  it('throws for nonexistent nodeId', () => {
    expect(() => tree.unloadSubtree('nonexistent-id')).toThrow();
  });
});
