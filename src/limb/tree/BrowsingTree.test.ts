// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach } from 'vitest';
import { BrowsingTree } from './BrowsingTree';
import type { BrowsingTreeProbe } from '../ports/BrowsingTreeProbe';

function createFakeProbe(): BrowsingTreeProbe & {
  calls: { method: string; args: unknown[] }[];
} {
  const calls: { method: string; args: unknown[] }[] = [];
  return {
    calls,
    childAdded(parentId: string, childId: string) {
      calls.push({ method: 'childAdded', args: [parentId, childId] });
    },
    nodeRemoved(nodeId: string, descendantIds: string[]) {
      calls.push({ method: 'nodeRemoved', args: [nodeId, descendantIds] });
    },
    nodeFocused(nodeId: string) {
      calls.push({ method: 'nodeFocused', args: [nodeId] });
    },
    treeSizeWarning(nodeCount: number) {
      calls.push({ method: 'treeSizeWarning', args: [nodeCount] });
    },
    treeSizeSuggestion(nodeCount: number) {
      calls.push({ method: 'treeSizeSuggestion', args: [nodeCount] });
    },
  };
}

describe('BrowsingTree', () => {
  let tree: BrowsingTree;
  let probe: ReturnType<typeof createFakeProbe>;

  beforeEach(() => {
    probe = createFakeProbe();
    tree = new BrowsingTree('https://example.com', probe);
  });

  describe('construction', () => {
    it('creates a tree with a root node', () => {
      expect(tree.rootId).toBeDefined();
      expect(tree.nodes.size).toBe(1);
      const root = tree.nodes.get(tree.rootId)!;
      expect(root.url).toBe('https://example.com');
      expect(root.parentId).toBeNull();
      expect(root.childIds).toEqual([]);
      expect(root.status).toBe('culled');
    });

    it('sets the root as the focused node', () => {
      expect(tree.focusedNodeId).toBe(tree.rootId);
    });

    it('root node has correct timestamps', () => {
      const root = tree.nodes.get(tree.rootId)!;
      expect(root.createdAt).toBeTypeOf('number');
      expect(root.lastVisitedAt).toBeTypeOf('number');
      expect(root.createdAt).toBeLessThanOrEqual(Date.now());
    });

    it('root node has empty title and null favicon', () => {
      const root = tree.nodes.get(tree.rootId)!;
      expect(root.title).toBe('');
      expect(root.favicon).toBeNull();
    });
  });

  describe('addChild', () => {
    it('creates a child node under the parent', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      expect(child.url).toBe('https://child.com');
      expect(child.parentId).toBe(tree.rootId);
      expect(child.status).toBe('culled');
    });

    it('appends child to parent childIds', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      const root = tree.nodes.get(tree.rootId)!;
      expect(root.childIds).toContain(child.id);
    });

    it('assigns a unique ID to the child', () => {
      const child1 = tree.addChild(tree.rootId, 'https://a.com');
      const child2 = tree.addChild(tree.rootId, 'https://b.com');
      expect(child1.id).not.toBe(child2.id);
      expect(child1.id).not.toBe(tree.rootId);
    });

    it('sets createdAt and lastVisitedAt', () => {
      const before = Date.now();
      const child = tree.addChild(tree.rootId, 'https://child.com');
      const after = Date.now();
      expect(child.createdAt).toBeGreaterThanOrEqual(before);
      expect(child.createdAt).toBeLessThanOrEqual(after);
      expect(child.lastVisitedAt).toBe(child.createdAt);
    });

    it('throws if parentId does not exist', () => {
      expect(() => tree.addChild('nonexistent', 'https://x.com')).toThrow();
    });

    it('maintains child ordering by creation time', () => {
      const c1 = tree.addChild(tree.rootId, 'https://a.com');
      const c2 = tree.addChild(tree.rootId, 'https://b.com');
      const c3 = tree.addChild(tree.rootId, 'https://c.com');
      const root = tree.nodes.get(tree.rootId)!;
      expect(root.childIds).toEqual([c1.id, c2.id, c3.id]);
    });

    it('fires childAdded probe', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      expect(probe.calls).toContainEqual({
        method: 'childAdded',
        args: [tree.rootId, child.id],
      });
    });

    it('adds child node to the tree nodes map', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      expect(tree.nodes.has(child.id)).toBe(true);
      expect(tree.nodes.get(child.id)).toBe(child);
    });
  });

  describe('removeNode', () => {
    it('removes a leaf node', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      tree.removeNode(child.id);
      expect(tree.nodes.has(child.id)).toBe(false);
    });

    it('updates parent childIds on removal', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      tree.removeNode(child.id);
      const root = tree.nodes.get(tree.rootId)!;
      expect(root.childIds).not.toContain(child.id);
    });

    it('removes node and all descendants', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      const grandchild = tree.addChild(child.id, 'https://grandchild.com');
      const greatGrandchild = tree.addChild(
        grandchild.id,
        'https://great.com'
      );
      tree.removeNode(child.id);
      expect(tree.nodes.has(child.id)).toBe(false);
      expect(tree.nodes.has(grandchild.id)).toBe(false);
      expect(tree.nodes.has(greatGrandchild.id)).toBe(false);
    });

    it('throws when removing the root node', () => {
      expect(() => tree.removeNode(tree.rootId)).toThrow();
    });

    it('throws when node does not exist', () => {
      expect(() => tree.removeNode('nonexistent')).toThrow();
    });

    it('moves focus to parent when focused node is removed', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      tree.focusNode(child.id);
      expect(tree.focusedNodeId).toBe(child.id);
      tree.removeNode(child.id);
      expect(tree.focusedNodeId).toBe(tree.rootId);
    });

    it('moves focus to ancestor when focused descendant is removed', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      const grandchild = tree.addChild(child.id, 'https://grandchild.com');
      tree.focusNode(grandchild.id);
      tree.removeNode(child.id);
      expect(tree.focusedNodeId).toBe(tree.rootId);
    });

    it('fires nodeRemoved probe with descendant IDs', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      const grandchild = tree.addChild(child.id, 'https://grandchild.com');
      probe.calls.length = 0;
      tree.removeNode(child.id);
      const removeCall = probe.calls.find((c) => c.method === 'nodeRemoved');
      expect(removeCall).toBeDefined();
      expect(removeCall!.args[0]).toBe(child.id);
      expect(removeCall!.args[1]).toContain(grandchild.id);
    });

    it('fires nodeFocused probe when focus is implicitly moved', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      tree.focusNode(child.id);
      probe.calls.length = 0;
      tree.removeNode(child.id);
      const focusCalls = probe.calls.filter((c) => c.method === 'nodeFocused');
      expect(focusCalls).toHaveLength(1);
      expect(focusCalls[0].args[0]).toBe(tree.rootId);
    });

    it('fires nodeFocused probe when focused descendant is implicitly moved', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      const grandchild = tree.addChild(child.id, 'https://grandchild.com');
      tree.focusNode(grandchild.id);
      probe.calls.length = 0;
      tree.removeNode(child.id);
      const focusCalls = probe.calls.filter((c) => c.method === 'nodeFocused');
      expect(focusCalls).toHaveLength(1);
      expect(focusCalls[0].args[0]).toBe(tree.rootId);
    });

    it('does not fire nodeFocused probe when removed node is not focused', () => {
      const child1 = tree.addChild(tree.rootId, 'https://a.com');
      tree.addChild(tree.rootId, 'https://b.com');
      probe.calls.length = 0;
      tree.removeNode(child1.id);
      const focusCalls = probe.calls.filter((c) => c.method === 'nodeFocused');
      expect(focusCalls).toHaveLength(0);
    });

    it('preserves sibling order after removal', () => {
      const c1 = tree.addChild(tree.rootId, 'https://a.com');
      const c2 = tree.addChild(tree.rootId, 'https://b.com');
      const c3 = tree.addChild(tree.rootId, 'https://c.com');
      tree.removeNode(c2.id);
      const root = tree.nodes.get(tree.rootId)!;
      expect(root.childIds).toEqual([c1.id, c3.id]);
    });
  });

  describe('focusNode', () => {
    it('sets focusedNodeId', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      tree.focusNode(child.id);
      expect(tree.focusedNodeId).toBe(child.id);
    });

    it('updates lastVisitedAt on the target node', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      const before = Date.now();
      tree.focusNode(child.id);
      const after = Date.now();
      const node = tree.nodes.get(child.id)!;
      expect(node.lastVisitedAt).toBeGreaterThanOrEqual(before);
      expect(node.lastVisitedAt).toBeLessThanOrEqual(after);
    });

    it('throws when node does not exist', () => {
      expect(() => tree.focusNode('nonexistent')).toThrow();
    });

    it('fires nodeFocused probe', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      probe.calls.length = 0;
      tree.focusNode(child.id);
      expect(probe.calls).toContainEqual({
        method: 'nodeFocused',
        args: [child.id],
      });
    });
  });

  describe('getAncestors', () => {
    it('returns path from node to root (child-to-root order)', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      const grandchild = tree.addChild(child.id, 'https://grandchild.com');
      const ancestors = tree.getAncestors(grandchild.id);
      expect(ancestors.map((n) => n.id)).toEqual([
        grandchild.id,
        child.id,
        tree.rootId,
      ]);
    });

    it('returns just the root for the root node', () => {
      const ancestors = tree.getAncestors(tree.rootId);
      expect(ancestors).toHaveLength(1);
      expect(ancestors[0].id).toBe(tree.rootId);
    });

    it('throws when node does not exist', () => {
      expect(() => tree.getAncestors('nonexistent')).toThrow();
    });
  });

  describe('getDescendants', () => {
    it('returns subtree in breadth-first order', () => {
      const child1 = tree.addChild(tree.rootId, 'https://a.com');
      const child2 = tree.addChild(tree.rootId, 'https://b.com');
      const grandchild = tree.addChild(child1.id, 'https://c.com');
      const descendants = tree.getDescendants(tree.rootId);
      const ids = descendants.map((n) => n.id);
      // BFS: root, then all depth-1 (child1, child2), then depth-2 (grandchild)
      // DFS would produce: root, child1, grandchild, child2 — which must fail
      expect(ids).toEqual([tree.rootId, child1.id, child2.id, grandchild.id]);
    });

    it('returns just the node for a leaf', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      const descendants = tree.getDescendants(child.id);
      expect(descendants).toHaveLength(1);
      expect(descendants[0].id).toBe(child.id);
    });

    it('throws when node does not exist', () => {
      expect(() => tree.getDescendants('nonexistent')).toThrow();
    });
  });

  describe('getSubtreeDepth', () => {
    it('returns 0 for a leaf node', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      expect(tree.getSubtreeDepth(child.id)).toBe(0);
    });

    it('returns 1 for a node with only leaf children', () => {
      tree.addChild(tree.rootId, 'https://a.com');
      tree.addChild(tree.rootId, 'https://b.com');
      expect(tree.getSubtreeDepth(tree.rootId)).toBe(1);
    });

    it('returns max depth of deepest branch', () => {
      const child = tree.addChild(tree.rootId, 'https://a.com');
      const grandchild = tree.addChild(child.id, 'https://b.com');
      tree.addChild(grandchild.id, 'https://c.com');
      tree.addChild(tree.rootId, 'https://d.com'); // shallow sibling
      expect(tree.getSubtreeDepth(tree.rootId)).toBe(3);
    });

    it('returns 0 for root-only tree', () => {
      expect(tree.getSubtreeDepth(tree.rootId)).toBe(0);
    });

    it('throws when node does not exist', () => {
      expect(() => tree.getSubtreeDepth('nonexistent')).toThrow();
    });
  });

  describe('getSiblings', () => {
    it('returns siblings excluding self', () => {
      const c1 = tree.addChild(tree.rootId, 'https://a.com');
      const c2 = tree.addChild(tree.rootId, 'https://b.com');
      const c3 = tree.addChild(tree.rootId, 'https://c.com');
      const siblings = tree.getSiblings(c2.id);
      const ids = siblings.map((n) => n.id);
      expect(ids).toEqual([c1.id, c3.id]);
    });

    it('returns empty array for root (no parent)', () => {
      expect(tree.getSiblings(tree.rootId)).toEqual([]);
    });

    it('returns empty array for only child', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      expect(tree.getSiblings(child.id)).toEqual([]);
    });

    it('throws when node does not exist', () => {
      expect(() => tree.getSiblings('nonexistent')).toThrow();
    });
  });

  describe('invariants', () => {
    it('maintains single root', () => {
      tree.addChild(tree.rootId, 'https://a.com');
      tree.addChild(tree.rootId, 'https://b.com');
      const roots = [...tree.nodes.values()].filter(
        (n) => n.parentId === null
      );
      expect(roots).toHaveLength(1);
    });

    it('maintains acyclicity — ancestors always reach root', () => {
      const child = tree.addChild(tree.rootId, 'https://a.com');
      const grandchild = tree.addChild(child.id, 'https://b.com');
      const ancestors = tree.getAncestors(grandchild.id);
      expect(ancestors[ancestors.length - 1].id).toBe(tree.rootId);
    });

    it('maintains referential integrity — parent points back', () => {
      const child = tree.addChild(tree.rootId, 'https://a.com');
      const parent = tree.nodes.get(child.parentId!)!;
      expect(parent.childIds).toContain(child.id);
    });

    it('maintains referential integrity — child exists for every childId', () => {
      tree.addChild(tree.rootId, 'https://a.com');
      tree.addChild(tree.rootId, 'https://b.com');
      for (const node of tree.nodes.values()) {
        for (const childId of node.childIds) {
          expect(tree.nodes.has(childId)).toBe(true);
          expect(tree.nodes.get(childId)!.parentId).toBe(node.id);
        }
      }
    });

    it('maintains unique IDs across all nodes', () => {
      tree.addChild(tree.rootId, 'https://a.com');
      tree.addChild(tree.rootId, 'https://b.com');
      const ids = [...tree.nodes.keys()];
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('always has exactly one focused node that exists', () => {
      const child = tree.addChild(tree.rootId, 'https://a.com');
      tree.focusNode(child.id);
      expect(tree.nodes.has(tree.focusedNodeId)).toBe(true);
    });

    it('maintains ordered children by createdAt (S4.6)', () => {
      const c1 = tree.addChild(tree.rootId, 'https://a.com');
      const c2 = tree.addChild(tree.rootId, 'https://b.com');
      const c3 = tree.addChild(tree.rootId, 'https://c.com');
      const root = tree.nodes.get(tree.rootId)!;
      const childCreatedAts = root.childIds.map(
        (id) => tree.nodes.get(id)!.createdAt
      );
      for (let i = 1; i < childCreatedAts.length; i++) {
        expect(childCreatedAts[i]).toBeGreaterThanOrEqual(childCreatedAts[i - 1]);
      }
    });

    it('maintains ordered children by createdAt after removeNode (S4.6)', () => {
      const c1 = tree.addChild(tree.rootId, 'https://a.com');
      const c2 = tree.addChild(tree.rootId, 'https://b.com');
      const c3 = tree.addChild(tree.rootId, 'https://c.com');
      tree.removeNode(c2.id);
      const root = tree.nodes.get(tree.rootId)!;
      expect(root.childIds).toEqual([c1.id, c3.id]);
      const childCreatedAts = root.childIds.map(
        (id) => tree.nodes.get(id)!.createdAt
      );
      for (let i = 1; i < childCreatedAts.length; i++) {
        expect(childCreatedAts[i]).toBeGreaterThanOrEqual(childCreatedAts[i - 1]);
      }
    });

    it('focused node exists after removing the focused node', () => {
      const child = tree.addChild(tree.rootId, 'https://a.com');
      tree.focusNode(child.id);
      tree.removeNode(child.id);
      expect(tree.nodes.has(tree.focusedNodeId)).toBe(true);
    });
  });

  describe('tree size warnings', () => {
    function addNodes(tree: BrowsingTree, count: number): void {
      for (let i = 0; i < count; i++) {
        tree.addChild(tree.rootId, `https://node-${i}.com`);
      }
    }

    it('does not fire warning at 100 nodes or below', () => {
      addNodes(tree, 99); // 99 children + 1 root = 100 nodes
      const warnings = probe.calls.filter(
        (c) => c.method === 'treeSizeWarning'
      );
      expect(warnings).toHaveLength(0);
    });

    it('fires treeSizeWarning probe when tree exceeds 100 nodes', () => {
      addNodes(tree, 100); // 100 children + 1 root = 101 nodes
      const warnings = probe.calls.filter(
        (c) => c.method === 'treeSizeWarning'
      );
      expect(warnings).toHaveLength(1);
      expect(warnings[0].args[0]).toBe(101);
    });

    it('fires treeSizeSuggestion probe when tree exceeds 200 nodes', () => {
      addNodes(tree, 200); // 200 children + 1 root = 201 nodes
      const suggestions = probe.calls.filter(
        (c) => c.method === 'treeSizeSuggestion'
      );
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].args[0]).toBe(201);
    });

    it('fires warning only once per session', () => {
      addNodes(tree, 105); // will exceed 100 at the 100th child
      const warnings = probe.calls.filter(
        (c) => c.method === 'treeSizeWarning'
      );
      expect(warnings).toHaveLength(1);
    });

    it('fires suggestion only once per session', () => {
      addNodes(tree, 205); // will exceed 200 at the 200th child
      const suggestions = probe.calls.filter(
        (c) => c.method === 'treeSizeSuggestion'
      );
      expect(suggestions).toHaveLength(1);
    });

    it('fires both warning and suggestion at correct thresholds', () => {
      addNodes(tree, 200); // 201 total
      const warnings = probe.calls.filter(
        (c) => c.method === 'treeSizeWarning'
      );
      const suggestions = probe.calls.filter(
        (c) => c.method === 'treeSizeSuggestion'
      );
      expect(warnings).toHaveLength(1);
      expect(suggestions).toHaveLength(1);
    });
  });

  describe('without probe', () => {
    it('works when no probe is provided', () => {
      const noProbTree = new BrowsingTree('https://example.com');
      const child = noProbTree.addChild(noProbTree.rootId, 'https://a.com');
      noProbTree.focusNode(child.id);
      noProbTree.removeNode(child.id);
      expect(noProbTree.nodes.size).toBe(1);
    });
  });

  describe('setProbe', () => {
    it('attaches a probe after construction', () => {
      const lateTree = new BrowsingTree('https://example.com');
      const lateProbe = createFakeProbe();
      lateTree.setProbe(lateProbe);

      const child = lateTree.addChild(lateTree.rootId, 'https://a.com');
      expect(lateProbe.calls).toContainEqual({
        method: 'childAdded',
        args: [lateTree.rootId, child.id],
      });
    });

    it('replaces the existing probe', () => {
      const newProbe = createFakeProbe();
      tree.setProbe(newProbe);

      const child = tree.addChild(tree.rootId, 'https://a.com');
      expect(newProbe.calls).toContainEqual({
        method: 'childAdded',
        args: [tree.rootId, child.id],
      });
      // Original probe should not receive new events after setProbe
      const originalPostSetCalls = probe.calls.filter(
        (c) => c.args.includes(child.id)
      );
      expect(originalPostSetCalls).toHaveLength(0);
    });
  });
});
