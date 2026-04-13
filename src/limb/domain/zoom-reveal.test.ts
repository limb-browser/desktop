import { describe, it, expect } from 'vitest';
import { computeRevealOrder } from './zoom-reveal';
import { BrowsingTree } from './browsing-tree';
import { FakeTreeProbe } from './__test-utils__/fake-tree-probe';

function buildTree(): { tree: BrowsingTree; ids: Record<string, string> } {
  const probe = new FakeTreeProbe();
  const tree = BrowsingTree.create('https://root.example', probe);
  const rootId = tree.rootId;

  // Build:
  //        root
  //       /    \
  //      A      B
  //     / \    / \
  //    C   D  E   F
  const a = tree.addChild(rootId, 'https://a.example');
  const b = tree.addChild(rootId, 'https://b.example');
  const c = tree.addChild(a.id, 'https://c.example');
  const d = tree.addChild(a.id, 'https://d.example');
  const e = tree.addChild(b.id, 'https://e.example');
  const f = tree.addChild(b.id, 'https://f.example');

  return {
    tree,
    ids: { root: rootId, a: a.id, b: b.id, c: c.id, d: d.id, e: e.id, f: f.id },
  };
}

describe('computeRevealOrder', () => {
  it('does not include the focused node', () => {
    const { tree, ids } = buildTree();
    const order = computeRevealOrder(ids.c, tree);
    expect(order).not.toContain(ids.c);
  });

  it('siblings appear before parent', () => {
    const { tree, ids } = buildTree();
    const order = computeRevealOrder(ids.c, tree);

    const dIndex = order.indexOf(ids.d);
    const aIndex = order.indexOf(ids.a);
    expect(dIndex).toBeGreaterThanOrEqual(0);
    expect(aIndex).toBeGreaterThanOrEqual(0);
    expect(dIndex).toBeLessThan(aIndex);
  });

  it('parent appears before grandparent', () => {
    const { tree, ids } = buildTree();
    const order = computeRevealOrder(ids.c, tree);

    const aIndex = order.indexOf(ids.a);
    const rootIndex = order.indexOf(ids.root);
    expect(aIndex).toBeLessThan(rootIndex);
  });

  it('parent siblings (uncles) appear before grandparent', () => {
    const { tree, ids } = buildTree();
    const order = computeRevealOrder(ids.c, tree);

    const bIndex = order.indexOf(ids.b);
    const rootIndex = order.indexOf(ids.root);
    expect(bIndex).toBeLessThan(rootIndex);
  });

  it('includes all nodes except focused node', () => {
    const { tree, ids } = buildTree();
    const order = computeRevealOrder(ids.c, tree);

    // Should include: d, a, b, e, f, root (6 nodes)
    expect(order).toHaveLength(6);
    expect(order).toContain(ids.d);
    expect(order).toContain(ids.a);
    expect(order).toContain(ids.b);
    expect(order).toContain(ids.e);
    expect(order).toContain(ids.f);
    expect(order).toContain(ids.root);
  });

  it('uncle subtrees appear after uncle but before grandparent', () => {
    const { tree, ids } = buildTree();
    const order = computeRevealOrder(ids.c, tree);

    const bIndex = order.indexOf(ids.b);
    const eIndex = order.indexOf(ids.e);
    const fIndex = order.indexOf(ids.f);
    const rootIndex = order.indexOf(ids.root);

    // B's children (E, F) appear after B but before root
    expect(eIndex).toBeGreaterThan(bIndex);
    expect(fIndex).toBeGreaterThan(bIndex);
    expect(eIndex).toBeLessThan(rootIndex);
    expect(fIndex).toBeLessThan(rootIndex);
  });

  it('returns empty array for root with no other nodes', () => {
    const probe = new FakeTreeProbe();
    const tree = BrowsingTree.create('https://root.example', probe);
    const order = computeRevealOrder(tree.rootId, tree);
    expect(order).toEqual([]);
  });

  it('returns children when focused on root in a larger tree', () => {
    const { tree, ids } = buildTree();
    const order = computeRevealOrder(ids.root, tree);

    // Root has no parent, so no siblings/ancestors — only descendants
    // But the reveal order walks up from focused node, so for root there are no ancestors.
    // The root's children (A, B) and their descendants should still appear.
    expect(order).toHaveLength(6);
    expect(order).toContain(ids.a);
    expect(order).toContain(ids.b);
  });
});
