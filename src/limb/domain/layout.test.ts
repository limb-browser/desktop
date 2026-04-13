import { describe, it, expect, beforeEach } from 'vitest';
import { BrowsingTree } from './browsing-tree';
import { FakeTreeProbe } from './__test-utils__/fake-tree-probe';
import { computeLayout } from './layout';

describe('computeLayout', () => {
  let probe: FakeTreeProbe;
  let tree: BrowsingTree;

  beforeEach(() => {
    probe = new FakeTreeProbe();
    tree = BrowsingTree.create('https://example.com', probe);
  });

  it('single root node gets a position', () => {
    const layout = computeLayout(tree);

    expect(layout.size).toBe(1);
    const pos = layout.get(tree.rootId);
    expect(pos).toBeDefined();
    expect(typeof pos!.x).toBe('number');
    expect(typeof pos!.y).toBe('number');
  });

  it('root is to the left of its children (parent.x < child.x)', () => {
    const child1 = tree.addChild(tree.rootId, 'https://child1.com');
    const child2 = tree.addChild(tree.rootId, 'https://child2.com');

    const layout = computeLayout(tree);

    const rootPos = layout.get(tree.rootId)!;
    const child1Pos = layout.get(child1.id)!;
    const child2Pos = layout.get(child2.id)!;

    expect(rootPos.x).toBeLessThan(child1Pos.x);
    expect(rootPos.x).toBeLessThan(child2Pos.x);
  });

  it('siblings are ordered top-to-bottom by creation order', () => {
    const child1 = tree.addChild(tree.rootId, 'https://first.com');
    const child2 = tree.addChild(tree.rootId, 'https://second.com');
    const child3 = tree.addChild(tree.rootId, 'https://third.com');

    const layout = computeLayout(tree);

    const pos1 = layout.get(child1.id)!;
    const pos2 = layout.get(child2.id)!;
    const pos3 = layout.get(child3.id)!;

    expect(pos1.y).toBeLessThan(pos2.y);
    expect(pos2.y).toBeLessThan(pos3.y);
  });

  it('no two nodes share the same position', () => {
    const child1 = tree.addChild(tree.rootId, 'https://child1.com');
    const child2 = tree.addChild(tree.rootId, 'https://child2.com');
    tree.addChild(child1.id, 'https://gc1.com');
    tree.addChild(child2.id, 'https://gc2.com');

    const layout = computeLayout(tree);
    const positions = [...layout.values()];

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const same = positions[i].x === positions[j].x && positions[i].y === positions[j].y;
        expect(same, `positions ${i} and ${j} must differ`).toBe(false);
      }
    }
  });

  it('layout is deterministic (same input = same output)', () => {
    const child1 = tree.addChild(tree.rootId, 'https://child1.com');
    const child2 = tree.addChild(tree.rootId, 'https://child2.com');
    tree.addChild(child1.id, 'https://gc1.com');

    const layout1 = computeLayout(tree);
    const layout2 = computeLayout(tree);

    for (const [id, pos1] of layout1) {
      const pos2 = layout2.get(id)!;
      expect(pos1.x).toBe(pos2.x);
      expect(pos1.y).toBe(pos2.y);
    }
  });

  it('subtrees of different sizes do not overlap', () => {
    // Build an asymmetric tree:
    //        root
    //       /    \
    //     A       B
    //    / \
    //   C   D
    //  /
    // E
    const a = tree.addChild(tree.rootId, 'https://a.com');
    const b = tree.addChild(tree.rootId, 'https://b.com');
    const c = tree.addChild(a.id, 'https://c.com');
    tree.addChild(a.id, 'https://d.com');
    tree.addChild(c.id, 'https://e.com');

    const layout = computeLayout(tree);
    const positions = [...layout.values()];

    // No two nodes at the same position
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const same = positions[i].x === positions[j].x && positions[i].y === positions[j].y;
        expect(same, `positions ${i} and ${j} must differ`).toBe(false);
      }
    }

    // Subtree of A should be entirely above B at the same depth
    const aPos = layout.get(a.id)!;
    const bPos = layout.get(b.id)!;
    expect(aPos.y).toBeLessThan(bPos.y);
  });

  it('every node in the tree has a position in the output map', () => {
    const child1 = tree.addChild(tree.rootId, 'https://child1.com');
    const child2 = tree.addChild(tree.rootId, 'https://child2.com');
    const gc = tree.addChild(child1.id, 'https://gc.com');

    const layout = computeLayout(tree);

    expect(layout.size).toBe(tree.nodes.size);
    for (const nodeId of tree.nodes.keys()) {
      expect(layout.has(nodeId), `node ${nodeId} should have a position`).toBe(true);
    }
  });

  it('parent x is strictly less than all descendants x', () => {
    const child = tree.addChild(tree.rootId, 'https://child.com');
    const gc = tree.addChild(child.id, 'https://gc.com');
    const ggc = tree.addChild(gc.id, 'https://ggc.com');

    const layout = computeLayout(tree);

    const rootX = layout.get(tree.rootId)!.x;
    const childX = layout.get(child.id)!.x;
    const gcX = layout.get(gc.id)!.x;
    const ggcX = layout.get(ggc.id)!.x;

    expect(rootX).toBeLessThan(childX);
    expect(childX).toBeLessThan(gcX);
    expect(gcX).toBeLessThan(ggcX);
  });

  it('handles a wide tree with many siblings', () => {
    const children = [];
    for (let i = 0; i < 10; i++) {
      children.push(tree.addChild(tree.rootId, `https://child${i}.com`));
    }

    const layout = computeLayout(tree);

    expect(layout.size).toBe(11); // root + 10 children

    // All siblings ordered top-to-bottom
    for (let i = 0; i < children.length - 1; i++) {
      const posA = layout.get(children[i].id)!;
      const posB = layout.get(children[i + 1].id)!;
      expect(posA.y).toBeLessThan(posB.y);
    }
  });
});
