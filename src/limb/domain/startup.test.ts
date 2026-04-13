import { describe, it, expect } from 'vitest';
import { createInitialState } from './startup';
import { FakeTreeProbe } from './__test-utils__/fake-tree-probe';
import { FakePersistencePort } from './__test-utils__/fake-persistence-port';
import { computeLayout } from './layout';
import type { SerializedNode } from '../ports/persistence-port';

describe('createInitialState', () => {
  it('creates root at about::home on empty database', () => {
    const probe = new FakeTreeProbe();
    const persistence = new FakePersistencePort();
    const { tree } = createInitialState(persistence, probe);
    const root = tree.nodes.get(tree.rootId)!;

    expect(root.url).toBe('about::home');
  });

  it('sets zoom level to 0.0 (tree view)', () => {
    const probe = new FakeTreeProbe();
    const persistence = new FakePersistencePort();
    const { zoomState } = createInitialState(persistence, probe);

    expect(zoomState.level).toBe(0.0);
  });

  it('sets focus point at the root layout position', () => {
    const probe = new FakeTreeProbe();
    const persistence = new FakePersistencePort();
    const { tree, zoomState } = createInitialState(persistence, probe);
    const layout = computeLayout(tree);
    const rootPos = layout.get(tree.rootId)!;

    expect(zoomState.focusPoint).toEqual(rootPos);
  });

  it('tree has root as focused node', () => {
    const probe = new FakeTreeProbe();
    const persistence = new FakePersistencePort();
    const { tree } = createInitialState(persistence, probe);

    expect(tree.focusedNodeId).toBe(tree.rootId);
  });

  it('loads existing branch roots from persistence', () => {
    const probe = new FakeTreeProbe();
    const persistence = new FakePersistencePort();
    const rootId = persistence.createRoot();
    const branch: SerializedNode = {
      id: 'branch-1',
      url: 'https://example.com',
      title: 'Example',
      favicon: null,
      parentId: rootId,
      childIds: [],
      status: 'culled',
      createdAt: 1000,
      lastVisitedAt: 2000,
      descendantCount: 0,
    };
    persistence.saveNode(branch);

    const { tree } = createInitialState(persistence, probe);

    expect(tree.nodes.size).toBe(2); // root + branch
    expect(tree.nodes.has('branch-1')).toBe(true);
  });

  it('fires nodeAdded probe for the root', () => {
    const probe = new FakeTreeProbe();
    const persistence = new FakePersistencePort();
    const { tree } = createInitialState(persistence, probe);
    const root = tree.nodes.get(tree.rootId)!;

    expect(probe.addedNodes.length).toBeGreaterThanOrEqual(1);
    expect(probe.addedNodes[0].url).toBe('about::home');
  });

  it('fires nodeFocused probe for the root', () => {
    const probe = new FakeTreeProbe();
    const persistence = new FakePersistencePort();
    const { tree } = createInitialState(persistence, probe);

    expect(probe.focusedNodeIds.length).toBeGreaterThanOrEqual(1);
    expect(probe.focusedNodeIds[0]).toBe(tree.rootId);
  });
});
