import { describe, it, expect, beforeEach } from 'vitest';
import { BrowsingTree } from './browsing-tree';
import { FakeTreeProbe } from './__test-utils__/fake-tree-probe';
import { serializeTree, reconstructTree } from './tree-serialization';
import type { SerializedNode } from '../ports/persistence-port';

describe('serializeTree', () => {
  let probe: FakeTreeProbe;

  beforeEach(() => {
    probe = new FakeTreeProbe();
  });

  it('serializes a single-root tree', () => {
    const tree = BrowsingTree.create('https://example.com', probe);
    const root = tree.nodes.get(tree.rootId)!;

    const result = serializeTree(tree);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: root.id,
      url: 'https://example.com',
      title: '',
      favicon: null,
      parentId: null,
      childIds: [],
      status: 'culled',
      createdAt: root.createdAt,
      lastVisitedAt: root.lastVisitedAt,
      descendantCount: 0,
    });
  });

  it('serializes a multi-node tree with children and grandchildren', () => {
    const tree = BrowsingTree.create('https://root.com', probe);
    const child1 = tree.addChild(tree.rootId, 'https://child1.com');
    const child2 = tree.addChild(tree.rootId, 'https://child2.com');
    const grandchild = tree.addChild(child1.id, 'https://grandchild.com');

    const result = serializeTree(tree);

    expect(result).toHaveLength(4);

    const ids = result.map(n => n.id);
    expect(ids).toContain(tree.rootId);
    expect(ids).toContain(child1.id);
    expect(ids).toContain(child2.id);
    expect(ids).toContain(grandchild.id);

    const serializedRoot = result.find(n => n.id === tree.rootId)!;
    expect(serializedRoot.parentId).toBeNull();
    expect(serializedRoot.childIds).toEqual([child1.id, child2.id]);
    expect(serializedRoot.url).toBe('https://root.com');

    const serializedChild1 = result.find(n => n.id === child1.id)!;
    expect(serializedChild1.parentId).toBe(tree.rootId);
    expect(serializedChild1.childIds).toEqual([grandchild.id]);

    const serializedGrandchild = result.find(n => n.id === grandchild.id)!;
    expect(serializedGrandchild.parentId).toBe(child1.id);
    expect(serializedGrandchild.childIds).toEqual([]);
  });
});

describe('reconstructTree', () => {
  let probe: FakeTreeProbe;

  beforeEach(() => {
    probe = new FakeTreeProbe();
  });

  it('reconstructs a valid BrowsingTree from serialized data', () => {
    const nodes: SerializedNode[] = [
      {
        id: 'root-1',
        url: 'https://root.com',
        title: 'Root',
        favicon: null,
        parentId: null,
        childIds: ['child-1'],
        status: 'favicon-only',
        createdAt: 1000,
        lastVisitedAt: 2000,
        descendantCount: 1,
      },
      {
        id: 'child-1',
        url: 'https://child.com',
        title: 'Child',
        favicon: 'data:image/png;base64,abc',
        parentId: 'root-1',
        childIds: [],
        status: 'favicon-only',
        createdAt: 1500,
        lastVisitedAt: 2500,
        descendantCount: 0,
      },
    ];

    const tree = reconstructTree(nodes, 'root-1', new Set<string>(), probe);

    expect(tree.rootId).toBe('root-1');
    expect(tree.nodes.size).toBe(2);

    const root = tree.nodes.get('root-1')!;
    expect(root.url).toBe('https://root.com');
    expect(root.title).toBe('Root');
    expect(root.parentId).toBeNull();
    expect(root.childIds).toEqual(['child-1']);
    expect(root.createdAt).toBe(1000);
    expect(root.lastVisitedAt).toBe(2000);

    const child = tree.nodes.get('child-1')!;
    expect(child.url).toBe('https://child.com');
    expect(child.parentId).toBe('root-1');
    expect(child.favicon).toBe('data:image/png;base64,abc');
  });

  it('sets focusedNodeId correctly on reconstruction', () => {
    const nodes: SerializedNode[] = [
      {
        id: 'root-1',
        url: 'https://root.com',
        title: 'Root',
        favicon: null,
        parentId: null,
        childIds: ['child-1'],
        status: 'favicon-only',
        createdAt: 1000,
        lastVisitedAt: 2000,
        descendantCount: 1,
      },
      {
        id: 'child-1',
        url: 'https://child.com',
        title: 'Child',
        favicon: null,
        parentId: 'root-1',
        childIds: [],
        status: 'favicon-only',
        createdAt: 1500,
        lastVisitedAt: 2500,
        descendantCount: 0,
      },
    ];

    const tree = reconstructTree(nodes, 'child-1', new Set<string>(), probe);

    expect(tree.focusedNodeId).toBe('child-1');
  });

  it('assigns screenshot status to nodes with screenshots', () => {
    const nodes: SerializedNode[] = [
      {
        id: 'root-1',
        url: 'https://root.com',
        title: 'Root',
        favicon: null,
        parentId: null,
        childIds: ['child-1'],
        status: 'live',
        createdAt: 1000,
        lastVisitedAt: 2000,
        descendantCount: 1,
      },
      {
        id: 'child-1',
        url: 'https://child.com',
        title: 'Child',
        favicon: null,
        parentId: 'root-1',
        childIds: [],
        status: 'live',
        createdAt: 1500,
        lastVisitedAt: 2500,
        descendantCount: 0,
      },
    ];

    const screenshotNodeIds = new Set(['root-1']);
    const tree = reconstructTree(nodes, 'root-1', screenshotNodeIds, probe);

    expect(tree.nodes.get('root-1')!.status).toBe('screenshot');
  });

  it('assigns favicon-only status to nodes without screenshots', () => {
    const nodes: SerializedNode[] = [
      {
        id: 'root-1',
        url: 'https://root.com',
        title: 'Root',
        favicon: null,
        parentId: null,
        childIds: ['child-1'],
        status: 'live',
        createdAt: 1000,
        lastVisitedAt: 2000,
        descendantCount: 1,
      },
      {
        id: 'child-1',
        url: 'https://child.com',
        title: 'Child',
        favicon: null,
        parentId: 'root-1',
        childIds: [],
        status: 'live',
        createdAt: 1500,
        lastVisitedAt: 2500,
        descendantCount: 0,
      },
    ];

    const tree = reconstructTree(nodes, 'root-1', new Set<string>(), probe);

    expect(tree.nodes.get('root-1')!.status).toBe('favicon-only');
    expect(tree.nodes.get('child-1')!.status).toBe('favicon-only');
  });

  it('calls TreeProbe.nodeAdded for each reconstructed node', () => {
    const nodes: SerializedNode[] = [
      {
        id: 'root-1',
        url: 'https://root.com',
        title: 'Root',
        favicon: null,
        parentId: null,
        childIds: ['child-1', 'child-2'],
        status: 'favicon-only',
        createdAt: 1000,
        lastVisitedAt: 2000,
        descendantCount: 2,
      },
      {
        id: 'child-1',
        url: 'https://child1.com',
        title: 'Child 1',
        favicon: null,
        parentId: 'root-1',
        childIds: [],
        status: 'favicon-only',
        createdAt: 1500,
        lastVisitedAt: 2500,
        descendantCount: 0,
      },
      {
        id: 'child-2',
        url: 'https://child2.com',
        title: 'Child 2',
        favicon: null,
        parentId: 'root-1',
        childIds: [],
        status: 'favicon-only',
        createdAt: 1600,
        lastVisitedAt: 2600,
        descendantCount: 0,
      },
    ];

    reconstructTree(nodes, 'root-1', new Set<string>(), probe);

    expect(probe.addedNodes).toHaveLength(3);
    const addedIds = probe.addedNodes.map(n => n.id);
    expect(addedIds).toContain('root-1');
    expect(addedIds).toContain('child-1');
    expect(addedIds).toContain('child-2');
  });

  it('calls TreeProbe.nodeFocused for the focused node', () => {
    const nodes: SerializedNode[] = [
      {
        id: 'root-1',
        url: 'https://root.com',
        title: 'Root',
        favicon: null,
        parentId: null,
        childIds: [],
        status: 'favicon-only',
        createdAt: 1000,
        lastVisitedAt: 2000,
        descendantCount: 0,
      },
    ];

    reconstructTree(nodes, 'root-1', new Set<string>(), probe);

    expect(probe.focusedNodeIds).toEqual(['root-1']);
  });

  it('round-trip: serialize then reconstruct produces equivalent tree structure', () => {
    const createProbe = new FakeTreeProbe();
    const original = BrowsingTree.create('https://root.com', createProbe);
    const child1 = original.addChild(original.rootId, 'https://child1.com');
    const child2 = original.addChild(original.rootId, 'https://child2.com');
    const grandchild = original.addChild(child1.id, 'https://grandchild.com');
    original.focusNode(child2.id);

    const serialized = serializeTree(original);

    const reconstructProbe = new FakeTreeProbe();
    const reconstructed = reconstructTree(
      serialized,
      original.focusedNodeId,
      new Set<string>(),
      reconstructProbe,
    );

    // Same structure
    expect(reconstructed.rootId).toBe(original.rootId);
    expect(reconstructed.focusedNodeId).toBe(original.focusedNodeId);
    expect(reconstructed.nodes.size).toBe(original.nodes.size);

    // Verify each node's relationships match
    for (const [id, originalNode] of original.nodes) {
      const reconstructedNode = reconstructed.nodes.get(id)!;
      expect(reconstructedNode).toBeDefined();
      expect(reconstructedNode.url).toBe(originalNode.url);
      expect(reconstructedNode.parentId).toBe(originalNode.parentId);
      expect(reconstructedNode.childIds).toEqual(originalNode.childIds);
      expect(reconstructedNode.createdAt).toBe(originalNode.createdAt);
      expect(reconstructedNode.lastVisitedAt).toBe(originalNode.lastVisitedAt);
      expect(reconstructedNode.descendantCount).toBe(originalNode.descendantCount);
    }
  });

  it('serialization round-trip preserves descendantCount', () => {
    const createProbe = new FakeTreeProbe();
    const original = BrowsingTree.create('https://root.com', createProbe);
    const child = original.addChild(original.rootId, 'https://child.com');
    original.addChild(child.id, 'https://grandchild.com');

    // root=2, child=1, grandchild=0
    expect(original.nodes.get(original.rootId)!.descendantCount).toBe(2);
    expect(original.nodes.get(child.id)!.descendantCount).toBe(1);

    const serialized = serializeTree(original);
    const reconstructProbe = new FakeTreeProbe();
    const reconstructed = reconstructTree(
      serialized,
      original.focusedNodeId,
      new Set<string>(),
      reconstructProbe,
    );

    expect(reconstructed.nodes.get(original.rootId)!.descendantCount).toBe(2);
    expect(reconstructed.nodes.get(child.id)!.descendantCount).toBe(1);
  });
});
