// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect } from 'vitest';
import { BrowsingTree } from './BrowsingTree';
import { computeLayout } from './TreeLayout';

describe('TreeLayout', () => {
  describe('every node has a position', () => {
    it('assigns a position to the root in a single-node tree', () => {
      const tree = new BrowsingTree('https://root.com');
      const layout = computeLayout(tree);
      expect(layout.has(tree.rootId)).toBe(true);
    });

    it('assigns positions to all nodes', () => {
      const tree = new BrowsingTree('https://root.com');
      const c1 = tree.addChild(tree.rootId, 'https://a.com');
      const c2 = tree.addChild(tree.rootId, 'https://b.com');
      tree.addChild(c1.id, 'https://c.com');
      tree.addChild(c2.id, 'https://d.com');
      const layout = computeLayout(tree);
      for (const nodeId of tree.nodes.keys()) {
        expect(layout.has(nodeId)).toBe(true);
      }
    });
  });

  describe('no two nodes at the same position', () => {
    it('all positions are unique in a simple tree', () => {
      const tree = new BrowsingTree('https://root.com');
      tree.addChild(tree.rootId, 'https://a.com');
      tree.addChild(tree.rootId, 'https://b.com');
      tree.addChild(tree.rootId, 'https://c.com');
      const layout = computeLayout(tree);
      const positions = [...layout.values()].map((p) => `${p.x},${p.y}`);
      expect(new Set(positions).size).toBe(positions.length);
    });

    it('all positions are unique in a deep tree', () => {
      const tree = new BrowsingTree('https://root.com');
      let parentId = tree.rootId;
      for (let i = 0; i < 10; i++) {
        const child = tree.addChild(parentId, `https://depth-${i}.com`);
        parentId = child.id;
      }
      const layout = computeLayout(tree);
      const positions = [...layout.values()].map((p) => `${p.x},${p.y}`);
      expect(new Set(positions).size).toBe(positions.length);
    });

    it('all positions are unique in a wide tree', () => {
      const tree = new BrowsingTree('https://root.com');
      for (let i = 0; i < 20; i++) {
        tree.addChild(tree.rootId, `https://child-${i}.com`);
      }
      const layout = computeLayout(tree);
      const positions = [...layout.values()].map((p) => `${p.x},${p.y}`);
      expect(new Set(positions).size).toBe(positions.length);
    });

    it('all positions are unique in a complex tree', () => {
      const tree = new BrowsingTree('https://root.com');
      const a = tree.addChild(tree.rootId, 'https://a.com');
      const b = tree.addChild(tree.rootId, 'https://b.com');
      tree.addChild(a.id, 'https://a1.com');
      tree.addChild(a.id, 'https://a2.com');
      tree.addChild(a.id, 'https://a3.com');
      const b1 = tree.addChild(b.id, 'https://b1.com');
      tree.addChild(b.id, 'https://b2.com');
      tree.addChild(b1.id, 'https://b1a.com');
      tree.addChild(b1.id, 'https://b1b.com');
      const layout = computeLayout(tree);
      const positions = [...layout.values()].map((p) => `${p.x},${p.y}`);
      expect(new Set(positions).size).toBe(positions.length);
    });
  });

  describe('parent y < child y', () => {
    it('root y is less than its children y', () => {
      const tree = new BrowsingTree('https://root.com');
      const c1 = tree.addChild(tree.rootId, 'https://a.com');
      const c2 = tree.addChild(tree.rootId, 'https://b.com');
      const layout = computeLayout(tree);
      const rootPos = layout.get(tree.rootId)!;
      expect(rootPos.y).toBeLessThan(layout.get(c1.id)!.y);
      expect(rootPos.y).toBeLessThan(layout.get(c2.id)!.y);
    });

    it('parent y < child y at every level', () => {
      const tree = new BrowsingTree('https://root.com');
      const a = tree.addChild(tree.rootId, 'https://a.com');
      const b = tree.addChild(a.id, 'https://b.com');
      tree.addChild(b.id, 'https://c.com');
      const layout = computeLayout(tree);
      for (const [nodeId, node] of tree.nodes) {
        if (node.parentId !== null) {
          const parentPos = layout.get(node.parentId)!;
          const childPos = layout.get(nodeId)!;
          expect(parentPos.y).toBeLessThan(childPos.y);
        }
      }
    });
  });

  describe('sibling x follows creation order', () => {
    it('first child is leftmost among siblings', () => {
      const tree = new BrowsingTree('https://root.com');
      const c1 = tree.addChild(tree.rootId, 'https://a.com');
      const c2 = tree.addChild(tree.rootId, 'https://b.com');
      const c3 = tree.addChild(tree.rootId, 'https://c.com');
      const layout = computeLayout(tree);
      expect(layout.get(c1.id)!.x).toBeLessThan(layout.get(c2.id)!.x);
      expect(layout.get(c2.id)!.x).toBeLessThan(layout.get(c3.id)!.x);
    });

    it('sibling order is preserved at deeper levels', () => {
      const tree = new BrowsingTree('https://root.com');
      const parent = tree.addChild(tree.rootId, 'https://parent.com');
      const s1 = tree.addChild(parent.id, 'https://s1.com');
      const s2 = tree.addChild(parent.id, 'https://s2.com');
      const s3 = tree.addChild(parent.id, 'https://s3.com');
      const layout = computeLayout(tree);
      expect(layout.get(s1.id)!.x).toBeLessThan(layout.get(s2.id)!.x);
      expect(layout.get(s2.id)!.x).toBeLessThan(layout.get(s3.id)!.x);
    });
  });

  describe('subtrees do not overlap', () => {
    it('two subtrees with different depths do not overlap', () => {
      const tree = new BrowsingTree('https://root.com');
      // Left subtree: deep chain
      const left = tree.addChild(tree.rootId, 'https://left.com');
      const l1 = tree.addChild(left.id, 'https://l1.com');
      const l2 = tree.addChild(l1.id, 'https://l2.com');
      tree.addChild(l2.id, 'https://l3.com');
      // Right subtree: wide
      const right = tree.addChild(tree.rootId, 'https://right.com');
      tree.addChild(right.id, 'https://r1.com');
      tree.addChild(right.id, 'https://r2.com');
      tree.addChild(right.id, 'https://r3.com');

      const layout = computeLayout(tree);
      // No two nodes should share the same position
      const positions = [...layout.values()].map((p) => `${p.x},${p.y}`);
      expect(new Set(positions).size).toBe(positions.length);

      // All nodes in the left subtree should have x < all nodes in the right subtree at the same depth
      const leftDescendants = tree.getDescendants(left.id);
      const rightDescendants = tree.getDescendants(right.id);
      for (const ln of leftDescendants) {
        for (const rn of rightDescendants) {
          const lp = layout.get(ln.id)!;
          const rp = layout.get(rn.id)!;
          if (lp.y === rp.y) {
            expect(lp.x).toBeLessThan(rp.x);
          }
        }
      }
    });

    it('many sibling subtrees do not overlap', () => {
      const tree = new BrowsingTree('https://root.com');
      // Create 5 subtrees, each with 3 children
      for (let i = 0; i < 5; i++) {
        const parent = tree.addChild(tree.rootId, `https://p${i}.com`);
        for (let j = 0; j < 3; j++) {
          tree.addChild(parent.id, `https://p${i}-c${j}.com`);
        }
      }
      const layout = computeLayout(tree);
      const positions = [...layout.values()].map((p) => `${p.x},${p.y}`);
      expect(new Set(positions).size).toBe(positions.length);
    });
  });

  describe('determinism', () => {
    it('same tree produces identical layout', () => {
      const tree = new BrowsingTree('https://root.com');
      const a = tree.addChild(tree.rootId, 'https://a.com');
      tree.addChild(tree.rootId, 'https://b.com');
      tree.addChild(a.id, 'https://c.com');
      tree.addChild(a.id, 'https://d.com');

      const layout1 = computeLayout(tree);
      const layout2 = computeLayout(tree);

      expect(layout1.size).toBe(layout2.size);
      for (const [nodeId, pos1] of layout1) {
        const pos2 = layout2.get(nodeId)!;
        expect(pos1.x).toBe(pos2.x);
        expect(pos1.y).toBe(pos2.y);
      }
    });
  });

  describe('root positioning', () => {
    it('root is at y=0', () => {
      const tree = new BrowsingTree('https://root.com');
      tree.addChild(tree.rootId, 'https://a.com');
      const layout = computeLayout(tree);
      expect(layout.get(tree.rootId)!.y).toBe(0);
    });

    it('single root node is at (0, 0)', () => {
      const tree = new BrowsingTree('https://root.com');
      const layout = computeLayout(tree);
      const pos = layout.get(tree.rootId)!;
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0);
    });
  });

  describe('linear chain', () => {
    it('all nodes have x=0 in a linear chain', () => {
      const tree = new BrowsingTree('https://root.com');
      let parentId = tree.rootId;
      for (let i = 0; i < 5; i++) {
        const child = tree.addChild(parentId, `https://d${i}.com`);
        parentId = child.id;
      }
      const layout = computeLayout(tree);
      for (const pos of layout.values()) {
        expect(pos.x).toBe(0);
      }
    });

    it('y increments with depth in a linear chain', () => {
      const tree = new BrowsingTree('https://root.com');
      const ids = [tree.rootId];
      let parentId = tree.rootId;
      for (let i = 0; i < 4; i++) {
        const child = tree.addChild(parentId, `https://d${i}.com`);
        ids.push(child.id);
        parentId = child.id;
      }
      const layout = computeLayout(tree);
      for (let i = 0; i < ids.length; i++) {
        expect(layout.get(ids[i])!.y).toBe(i);
      }
    });
  });
});
