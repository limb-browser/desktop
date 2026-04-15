// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach } from 'vitest';
import { BrowsingTree } from './BrowsingTree';
import type { BrowsingTreeProbe } from '../ports/BrowsingTreeProbe';
import { InMemoryTreeStorage } from './InMemoryTreeStorage';
import type { StoredNode } from '../ports/TreeStoragePort';

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
    branchActivated(branchRootId: string, nodeCount: number) {
      calls.push({ method: 'branchActivated', args: [branchRootId, nodeCount] });
    },
    branchDeactivated(branchRootId: string) {
      calls.push({ method: 'branchDeactivated', args: [branchRootId] });
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

    it('updates branch root lastVisitedAt when descendant is focused', () => {
      const branch = tree.addChild(tree.rootId, 'https://branch.com');
      const child = tree.addChild(branch.id, 'https://child.com');
      const grandchild = tree.addChild(child.id, 'https://grandchild.com');

      // Set branch root to a known old time
      tree.nodes.get(branch.id)!.lastVisitedAt = 1000;

      tree.focusNode(grandchild.id);

      const branchNode = tree.nodes.get(branch.id)!;
      const grandchildNode = tree.nodes.get(grandchild.id)!;
      // Branch root's lastVisitedAt should match the focused node's timestamp
      expect(branchNode.lastVisitedAt).toBe(grandchildNode.lastVisitedAt);
      expect(branchNode.lastVisitedAt).toBeGreaterThan(1000);
    });

    it('does not propagate lastVisitedAt when focusing the root itself', () => {
      const rootOldTime = tree.nodes.get(tree.rootId)!.lastVisitedAt;
      tree.focusNode(tree.rootId);
      // Root's lastVisitedAt should be updated (it's the focused node),
      // but there's no branch root to propagate to
      expect(tree.nodes.get(tree.rootId)!.lastVisitedAt).toBeGreaterThanOrEqual(rootOldTime);
    });

    it('updates branch root when focusing a direct child of root (branch root itself)', () => {
      const branch = tree.addChild(tree.rootId, 'https://branch.com');
      const before = Date.now();
      tree.focusNode(branch.id);
      const after = Date.now();

      // The branch root IS the focused node, so its lastVisitedAt is the same
      const branchNode = tree.nodes.get(branch.id)!;
      expect(branchNode.lastVisitedAt).toBeGreaterThanOrEqual(before);
      expect(branchNode.lastVisitedAt).toBeLessThanOrEqual(after);
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

  describe('descendantCount', () => {
    it('root starts with descendantCount 0', () => {
      const root = tree.nodes.get(tree.rootId)!;
      expect(root.descendantCount).toBe(0);
    });

    it('new child has descendantCount 0', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      expect(child.descendantCount).toBe(0);
    });

    it('increments parent descendantCount when child is added', () => {
      tree.addChild(tree.rootId, 'https://child.com');
      const root = tree.nodes.get(tree.rootId)!;
      expect(root.descendantCount).toBe(1);
    });

    it('increments all ancestors when deeply nested child is added', () => {
      const child = tree.addChild(tree.rootId, 'https://a.com');
      const grandchild = tree.addChild(child.id, 'https://b.com');
      tree.addChild(grandchild.id, 'https://c.com');

      expect(tree.nodes.get(tree.rootId)!.descendantCount).toBe(3);
      expect(tree.nodes.get(child.id)!.descendantCount).toBe(2);
      expect(tree.nodes.get(grandchild.id)!.descendantCount).toBe(1);
    });

    it('decrements parent descendantCount when leaf is removed', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      tree.removeNode(child.id);
      expect(tree.nodes.get(tree.rootId)!.descendantCount).toBe(0);
    });

    it('decrements all ancestors when subtree is removed', () => {
      const child = tree.addChild(tree.rootId, 'https://a.com');
      const grandchild = tree.addChild(child.id, 'https://b.com');
      tree.addChild(grandchild.id, 'https://c.com');

      // root=3, child=2, grandchild=1
      tree.removeNode(child.id);
      // root should now be 0 (lost child + grandchild + great-grandchild = 3)
      expect(tree.nodes.get(tree.rootId)!.descendantCount).toBe(0);
    });

    it('correctly tracks count with multiple branches', () => {
      const b1 = tree.addChild(tree.rootId, 'https://b1.com');
      tree.addChild(b1.id, 'https://b1c1.com');
      tree.addChild(b1.id, 'https://b1c2.com');

      const b2 = tree.addChild(tree.rootId, 'https://b2.com');
      tree.addChild(b2.id, 'https://b2c1.com');

      // root: 5 descendants (b1, b1c1, b1c2, b2, b2c1)
      expect(tree.nodes.get(tree.rootId)!.descendantCount).toBe(5);
      expect(tree.nodes.get(b1.id)!.descendantCount).toBe(2);
      expect(tree.nodes.get(b2.id)!.descendantCount).toBe(1);

      tree.removeNode(b1.id);
      expect(tree.nodes.get(tree.rootId)!.descendantCount).toBe(2);
    });

    it('is accurate after interleaved add and remove operations', () => {
      const c1 = tree.addChild(tree.rootId, 'https://a.com');
      const c2 = tree.addChild(tree.rootId, 'https://b.com');
      tree.addChild(c1.id, 'https://c.com');
      tree.removeNode(c2.id);
      // root has c1 and c1's child = 2 descendants
      expect(tree.nodes.get(tree.rootId)!.descendantCount).toBe(2);
      expect(tree.nodes.get(c1.id)!.descendantCount).toBe(1);
    });
  });

  describe('branch activation and deactivation', () => {
    let storage: InMemoryTreeStorage;

    function makeStoredNode(
      overrides: Partial<StoredNode> & { id: string; branchRootId: string }
    ): StoredNode {
      return {
        url: 'https://example.com',
        title: 'Example',
        favicon: null,
        parentId: null,
        childIds: [],
        createdAt: 1000,
        lastVisitedAt: 2000,
        descendantCount: 0,
        ...overrides,
      };
    }

    beforeEach(() => {
      storage = new InMemoryTreeStorage();
    });

    describe('activateBranch', () => {
      it('loads full subtree from storage into memory', async () => {
        const branch = tree.addChild(tree.rootId, 'https://branch.com');
        // Simulate storage having child nodes for this branch
        const storedNodes: StoredNode[] = [
          makeStoredNode({
            id: branch.id,
            url: 'https://branch.com',
            parentId: tree.rootId,
            childIds: ['child-1'],
            branchRootId: branch.id,
            descendantCount: 1,
          }),
          makeStoredNode({
            id: 'child-1',
            url: 'https://child.com',
            parentId: branch.id,
            branchRootId: branch.id,
          }),
        ];
        await storage.saveBranch(branch.id, storedNodes);

        await tree.activateBranch(branch.id, storage);

        expect(tree.activeBranchId).toBe(branch.id);
        expect(tree.nodes.has('child-1')).toBe(true);
        expect(tree.nodes.get('child-1')!.url).toBe('https://child.com');
      });

      it('sets activeBranchId', async () => {
        const branch = tree.addChild(tree.rootId, 'https://branch.com');
        await storage.saveBranch(branch.id, [
          makeStoredNode({
            id: branch.id,
            url: 'https://branch.com',
            parentId: tree.rootId,
            branchRootId: branch.id,
          }),
        ]);

        await tree.activateBranch(branch.id, storage);
        expect(tree.activeBranchId).toBe(branch.id);
      });

      it('fires branchActivated probe', async () => {
        const branch = tree.addChild(tree.rootId, 'https://branch.com');
        await storage.saveBranch(branch.id, [
          makeStoredNode({
            id: branch.id,
            url: 'https://branch.com',
            parentId: tree.rootId,
            childIds: ['c1'],
            branchRootId: branch.id,
            descendantCount: 1,
          }),
          makeStoredNode({
            id: 'c1',
            url: 'https://c1.com',
            parentId: branch.id,
            branchRootId: branch.id,
          }),
        ]);
        probe.calls.length = 0;

        await tree.activateBranch(branch.id, storage);

        expect(probe.calls).toContainEqual({
          method: 'branchActivated',
          args: [branch.id, 2],
        });
      });

      it('throws when branch root does not exist in tree', async () => {
        await expect(
          tree.activateBranch('nonexistent', storage)
        ).rejects.toThrow();
      });

      it('throws when branch root is not a direct child of root', async () => {
        const branch = tree.addChild(tree.rootId, 'https://branch.com');
        const child = tree.addChild(branch.id, 'https://child.com');

        await expect(
          tree.activateBranch(child.id, storage)
        ).rejects.toThrow();
      });

      it('is a no-op when called on the already-active branch', async () => {
        const branch = tree.addChild(tree.rootId, 'https://branch.com');
        await storage.saveBranch(branch.id, [
          makeStoredNode({
            id: branch.id,
            url: 'https://branch.com',
            parentId: tree.rootId,
            childIds: ['c1'],
            branchRootId: branch.id,
            descendantCount: 1,
          }),
          makeStoredNode({
            id: 'c1',
            url: 'https://c1.com',
            parentId: branch.id,
            branchRootId: branch.id,
          }),
        ]);

        await tree.activateBranch(branch.id, storage);
        const countAfterFirst = tree.nodes.get(tree.rootId)!.descendantCount;

        // Calling again should be a no-op — no double-counting
        await tree.activateBranch(branch.id, storage);

        expect(tree.activeBranchId).toBe(branch.id);
        expect(tree.nodes.get(tree.rootId)!.descendantCount).toBe(countAfterFirst);
      });

      it('throws when branch root already has in-memory children', async () => {
        const branch = tree.addChild(tree.rootId, 'https://branch.com');
        tree.addChild(branch.id, 'https://existing-child.com');

        // Branch root has children in memory — activating would orphan them
        await expect(
          tree.activateBranch(branch.id, storage)
        ).rejects.toThrow();
      });

      it('does not corrupt descendantCount when storage returns empty', async () => {
        const branch = tree.addChild(tree.rootId, 'https://branch.com');
        // storage has no data for this branch — loadBranch returns []
        const rootCountBefore = tree.nodes.get(tree.rootId)!.descendantCount;

        await tree.activateBranch(branch.id, storage);

        expect(tree.nodes.get(tree.rootId)!.descendantCount).toBe(rootCountBefore);
        expect(tree.activeBranchId).toBe(branch.id);
      });

      it('restores screenshots for loaded nodes', async () => {
        const branch = tree.addChild(tree.rootId, 'https://branch.com');
        await storage.saveBranch(branch.id, [
          makeStoredNode({
            id: branch.id,
            url: 'https://branch.com',
            parentId: tree.rootId,
            childIds: ['c1'],
            branchRootId: branch.id,
            descendantCount: 1,
          }),
          makeStoredNode({
            id: 'c1',
            url: 'https://c1.com',
            parentId: branch.id,
            branchRootId: branch.id,
          }),
        ]);
        // Save a screenshot for the child node
        await storage.saveScreenshot('c1', 'low', new Uint8Array([255, 216, 255]));

        await tree.activateBranch(branch.id, storage);

        // Screenshot should be restored on the loaded node
        expect(tree.nodes.get('c1')!.screenshot).not.toBeNull();
      });

      it('restores branch root screenshot during activation', async () => {
        const branch = tree.addChild(tree.rootId, 'https://branch.com');
        await storage.saveBranch(branch.id, [
          makeStoredNode({
            id: branch.id,
            url: 'https://branch.com',
            parentId: tree.rootId,
            childIds: ['c1'],
            branchRootId: branch.id,
            descendantCount: 1,
          }),
          makeStoredNode({
            id: 'c1',
            url: 'https://c1.com',
            parentId: branch.id,
            branchRootId: branch.id,
          }),
        ]);
        // Save screenshots for both the branch root and child
        await storage.saveScreenshot(branch.id, 'low', new Uint8Array([255, 216, 255]));
        await storage.saveScreenshot('c1', 'low', new Uint8Array([255, 216, 254]));

        await tree.activateBranch(branch.id, storage);

        // Branch root screenshot should also be restored
        expect(tree.nodes.get(branch.id)!.screenshot).not.toBeNull();
        expect(tree.nodes.get('c1')!.screenshot).not.toBeNull();
      });

      it('does not set screenshot when storage has none', async () => {
        const branch = tree.addChild(tree.rootId, 'https://branch.com');
        await storage.saveBranch(branch.id, [
          makeStoredNode({
            id: branch.id,
            url: 'https://branch.com',
            parentId: tree.rootId,
            childIds: ['c1'],
            branchRootId: branch.id,
            descendantCount: 1,
          }),
          makeStoredNode({
            id: 'c1',
            url: 'https://c1.com',
            parentId: branch.id,
            branchRootId: branch.id,
          }),
        ]);
        // No screenshot saved for c1

        await tree.activateBranch(branch.id, storage);

        expect(tree.nodes.get('c1')!.screenshot).toBeNull();
      });

      it('updates descendantCount on branch root after loading', async () => {
        const branch = tree.addChild(tree.rootId, 'https://branch.com');
        await storage.saveBranch(branch.id, [
          makeStoredNode({
            id: branch.id,
            url: 'https://branch.com',
            parentId: tree.rootId,
            childIds: ['c1', 'c2'],
            branchRootId: branch.id,
            descendantCount: 2,
          }),
          makeStoredNode({
            id: 'c1',
            url: 'https://c1.com',
            parentId: branch.id,
            branchRootId: branch.id,
          }),
          makeStoredNode({
            id: 'c2',
            url: 'https://c2.com',
            parentId: branch.id,
            branchRootId: branch.id,
          }),
        ]);

        await tree.activateBranch(branch.id, storage);

        expect(tree.nodes.get(branch.id)!.descendantCount).toBe(2);
        expect(tree.nodes.get(tree.rootId)!.descendantCount).toBe(3);
      });
    });

    describe('deactivateBranch', () => {
      it('removes descendants from memory but keeps branch root', async () => {
        const branch = tree.addChild(tree.rootId, 'https://branch.com');
        const child = tree.addChild(branch.id, 'https://child.com');
        const grandchild = tree.addChild(child.id, 'https://grandchild.com');

        await tree.deactivateBranch(branch.id, storage);

        expect(tree.nodes.has(branch.id)).toBe(true);
        expect(tree.nodes.has(child.id)).toBe(false);
        expect(tree.nodes.has(grandchild.id)).toBe(false);
      });

      it('saves branch to storage before removing', async () => {
        const branch = tree.addChild(tree.rootId, 'https://branch.com');
        tree.addChild(branch.id, 'https://child.com');

        await tree.deactivateBranch(branch.id, storage);

        const stored = await storage.loadBranch(branch.id);
        expect(stored).toHaveLength(2);
      });

      it('clears branch root childIds after deactivation', async () => {
        const branch = tree.addChild(tree.rootId, 'https://branch.com');
        tree.addChild(branch.id, 'https://child.com');

        await tree.deactivateBranch(branch.id, storage);

        expect(tree.nodes.get(branch.id)!.childIds).toEqual([]);
      });

      it('preserves branch root descendantCount after deactivation', async () => {
        const branch = tree.addChild(tree.rootId, 'https://branch.com');
        tree.addChild(branch.id, 'https://child.com');
        tree.addChild(branch.id, 'https://child2.com');

        await tree.deactivateBranch(branch.id, storage);

        // descendantCount should be preserved for launcher display
        expect(tree.nodes.get(branch.id)!.descendantCount).toBe(2);
      });

      it('fires branchDeactivated probe', async () => {
        const branch = tree.addChild(tree.rootId, 'https://branch.com');
        tree.addChild(branch.id, 'https://child.com');
        probe.calls.length = 0;

        await tree.deactivateBranch(branch.id, storage);

        expect(probe.calls).toContainEqual({
          method: 'branchDeactivated',
          args: [branch.id],
        });
      });

      it('moves focus to branch root if focused node is a descendant', async () => {
        const branch = tree.addChild(tree.rootId, 'https://branch.com');
        const child = tree.addChild(branch.id, 'https://child.com');
        tree.focusNode(child.id);

        await tree.deactivateBranch(branch.id, storage);

        expect(tree.focusedNodeId).toBe(branch.id);
      });

      it('clears activeBranchId when deactivating the active branch', async () => {
        const branch = tree.addChild(tree.rootId, 'https://branch.com');
        tree.activeBranchId = branch.id;

        await tree.deactivateBranch(branch.id, storage);

        expect(tree.activeBranchId).toBeNull();
      });

      it('is a no-op when called on an already-deactivated branch', async () => {
        const branch = tree.addChild(tree.rootId, 'https://branch.com');
        const child = tree.addChild(branch.id, 'https://child.com');

        // First deactivation — saves branch with child to storage
        await tree.deactivateBranch(branch.id, storage);

        const storedAfterFirst = await storage.loadBranch(branch.id);
        expect(storedAfterFirst).toHaveLength(2); // branch root + child

        // Second deactivation — should be a no-op, not overwrite storage
        await tree.deactivateBranch(branch.id, storage);

        const storedAfterSecond = await storage.loadBranch(branch.id);
        expect(storedAfterSecond).toHaveLength(2); // still intact
      });

      it('throws when branch root does not exist', async () => {
        await expect(
          tree.deactivateBranch('nonexistent', storage)
        ).rejects.toThrow();
      });

      it('throws when node is not a branch root', async () => {
        const branch = tree.addChild(tree.rootId, 'https://branch.com');
        const child = tree.addChild(branch.id, 'https://child.com');

        await expect(
          tree.deactivateBranch(child.id, storage)
        ).rejects.toThrow();
      });
    });

    describe('switchBranch', () => {
      it('deactivates current and activates new branch', async () => {
        const branch1 = tree.addChild(tree.rootId, 'https://b1.com');
        const b1Child = tree.addChild(branch1.id, 'https://b1c1.com');
        tree.activeBranchId = branch1.id;

        const branch2 = tree.addChild(tree.rootId, 'https://b2.com');
        await storage.saveBranch(branch2.id, [
          makeStoredNode({
            id: branch2.id,
            url: 'https://b2.com',
            parentId: tree.rootId,
            childIds: ['b2c1'],
            branchRootId: branch2.id,
            descendantCount: 1,
          }),
          makeStoredNode({
            id: 'b2c1',
            url: 'https://b2c1.com',
            parentId: branch2.id,
            branchRootId: branch2.id,
          }),
        ]);

        await tree.switchBranch(branch2.id, storage);

        // Old branch descendants removed
        expect(tree.nodes.has(b1Child.id)).toBe(false);
        // New branch descendants loaded
        expect(tree.nodes.has('b2c1')).toBe(true);
        expect(tree.activeBranchId).toBe(branch2.id);
      });

      it('preserves data integrity during switch', async () => {
        const branch1 = tree.addChild(tree.rootId, 'https://b1.com');
        tree.addChild(branch1.id, 'https://b1c1.com');
        tree.activeBranchId = branch1.id;

        const branch2 = tree.addChild(tree.rootId, 'https://b2.com');
        await storage.saveBranch(branch2.id, [
          makeStoredNode({
            id: branch2.id,
            url: 'https://b2.com',
            parentId: tree.rootId,
            branchRootId: branch2.id,
          }),
        ]);

        await tree.switchBranch(branch2.id, storage);

        // Branch1 data should be in storage
        const storedB1 = await storage.loadBranch(branch1.id);
        expect(storedB1.length).toBeGreaterThan(0);

        // Tree integrity: root still has both branch roots
        const root = tree.nodes.get(tree.rootId)!;
        expect(root.childIds).toContain(branch1.id);
        expect(root.childIds).toContain(branch2.id);
      });

      it('works when no branch is currently active', async () => {
        const branch = tree.addChild(tree.rootId, 'https://branch.com');
        await storage.saveBranch(branch.id, [
          makeStoredNode({
            id: branch.id,
            url: 'https://branch.com',
            parentId: tree.rootId,
            branchRootId: branch.id,
          }),
        ]);

        await tree.switchBranch(branch.id, storage);

        expect(tree.activeBranchId).toBe(branch.id);
      });

      it('preserves screenshots in persistent storage on branch switch', async () => {
        const branch1 = tree.addChild(tree.rootId, 'https://b1.com');
        const b1Child = tree.addChild(branch1.id, 'https://b1c1.com');
        tree.activeBranchId = branch1.id;

        // Store a screenshot for the child
        await storage.saveScreenshot(
          b1Child.id,
          'low',
          new Uint8Array([1, 2, 3])
        );

        const branch2 = tree.addChild(tree.rootId, 'https://b2.com');
        await storage.saveBranch(branch2.id, [
          makeStoredNode({
            id: branch2.id,
            url: 'https://b2.com',
            parentId: tree.rootId,
            branchRootId: branch2.id,
          }),
        ]);

        await tree.switchBranch(branch2.id, storage);

        // Screenshots remain in persistent storage (S4.2: eviction is separate)
        const screenshot = await storage.loadScreenshot(b1Child.id, 'low');
        expect(screenshot).not.toBeNull();
      });
    });

    describe('loadSummaries', () => {
      it('loads root and branch roots from storage on startup', async () => {
        // Create a fresh tree for startup simulation
        const startupTree = new BrowsingTree('about:limb-home', probe);

        // Simulate storage with two branches
        await storage.saveBranch('branch-a', [
          makeStoredNode({
            id: 'branch-a',
            url: 'https://a.com',
            title: 'Branch A',
            parentId: startupTree.rootId,
            childIds: ['a-child'],
            branchRootId: 'branch-a',
            descendantCount: 1,
          }),
          makeStoredNode({
            id: 'a-child',
            url: 'https://achild.com',
            parentId: 'branch-a',
            branchRootId: 'branch-a',
          }),
        ]);
        await storage.saveBranch('branch-b', [
          makeStoredNode({
            id: 'branch-b',
            url: 'https://b.com',
            title: 'Branch B',
            parentId: startupTree.rootId,
            branchRootId: 'branch-b',
            descendantCount: 0,
          }),
        ]);

        await startupTree.loadSummaries(storage);

        // Branch roots should be in memory
        expect(startupTree.nodes.has('branch-a')).toBe(true);
        expect(startupTree.nodes.has('branch-b')).toBe(true);
        // Branch A's child should NOT be loaded
        expect(startupTree.nodes.has('a-child')).toBe(false);
        // Root should have branch roots as children
        const root = startupTree.nodes.get(startupTree.rootId)!;
        expect(root.childIds).toContain('branch-a');
        expect(root.childIds).toContain('branch-b');
      });

      it('branch root preserves descendantCount from storage', async () => {
        const startupTree = new BrowsingTree('about:limb-home', probe);
        await storage.saveBranch('branch-a', [
          makeStoredNode({
            id: 'branch-a',
            url: 'https://a.com',
            parentId: startupTree.rootId,
            childIds: ['c1', 'c2', 'c3'],
            branchRootId: 'branch-a',
            descendantCount: 3,
          }),
          makeStoredNode({ id: 'c1', parentId: 'branch-a', branchRootId: 'branch-a' }),
          makeStoredNode({ id: 'c2', parentId: 'branch-a', branchRootId: 'branch-a' }),
          makeStoredNode({ id: 'c3', parentId: 'branch-a', branchRootId: 'branch-a' }),
        ]);

        await startupTree.loadSummaries(storage);

        expect(startupTree.nodes.get('branch-a')!.descendantCount).toBe(3);
      });

      it('no active branch after loading summaries', async () => {
        const startupTree = new BrowsingTree('about:limb-home', probe);
        await storage.saveBranch('branch-a', [
          makeStoredNode({
            id: 'branch-a',
            url: 'https://a.com',
            parentId: startupTree.rootId,
            branchRootId: 'branch-a',
          }),
        ]);

        await startupTree.loadSummaries(storage);

        expect(startupTree.activeBranchId).toBeNull();
      });

      it('skips summaries whose id already exists in tree (deduplication)', async () => {
        const startupTree = new BrowsingTree('about:limb-home', probe);

        // Simulate SessionStore having already restored this branch root
        const existingBranch = startupTree.addChild(
          startupTree.rootId,
          'https://existing.com'
        );
        existingBranch.title = 'Session Branch';
        const existingId = existingBranch.id;

        // Storage also has this branch (from a prior deactivateBranch)
        await storage.saveBranch(existingId, [
          makeStoredNode({
            id: existingId,
            url: 'https://existing.com',
            title: 'Storage Branch',
            parentId: startupTree.rootId,
            branchRootId: existingId,
            descendantCount: 5,
          }),
        ]);
        // And a different branch only in storage
        await storage.saveBranch('storage-only', [
          makeStoredNode({
            id: 'storage-only',
            url: 'https://stored.com',
            title: 'Stored Only',
            parentId: startupTree.rootId,
            branchRootId: 'storage-only',
            descendantCount: 3,
          }),
        ]);

        await startupTree.loadSummaries(storage);

        // The existing branch should NOT be duplicated
        const root = startupTree.nodes.get(startupTree.rootId)!;
        const occurrences = root.childIds.filter(
          (id: string) => id === existingId
        );
        expect(occurrences).toHaveLength(1);

        // The existing node should keep its in-memory title (not overwritten by storage)
        expect(startupTree.nodes.get(existingId)!.title).toBe('Session Branch');

        // The storage-only branch should be loaded
        expect(startupTree.nodes.has('storage-only')).toBe(true);
        expect(root.childIds).toContain('storage-only');
      });

      it('preserves existing descendantCount on root when merging summaries', async () => {
        const startupTree = new BrowsingTree('about:limb-home', probe);

        // SessionStore restored a branch with 2 children in memory
        const existing = startupTree.addChild(
          startupTree.rootId,
          'https://active.com'
        );
        startupTree.addChild(existing.id, 'https://child1.com');
        startupTree.addChild(existing.id, 'https://child2.com');
        const rootBefore = startupTree.nodes.get(startupTree.rootId)!;
        const countBefore = rootBefore.descendantCount; // 3 (branch + 2 children)

        // Storage has one additional branch
        await storage.saveBranch('stored-branch', [
          makeStoredNode({
            id: 'stored-branch',
            url: 'https://stored.com',
            parentId: startupTree.rootId,
            branchRootId: 'stored-branch',
            descendantCount: 10,
          }),
        ]);

        await startupTree.loadSummaries(storage);

        // Root descendantCount should include existing nodes + newly loaded summaries
        const rootAfter = startupTree.nodes.get(startupTree.rootId)!;
        expect(rootAfter.descendantCount).toBe(countBefore + 1);
      });

      it('clicking an inactive branch card triggers activation via switchBranch', async () => {
        const startupTree = new BrowsingTree('about:limb-home', probe);

        // Storage has a branch with children
        await storage.saveBranch('stored-branch', [
          makeStoredNode({
            id: 'stored-branch',
            url: 'https://stored.com',
            title: 'Stored',
            parentId: startupTree.rootId,
            childIds: ['child-1'],
            branchRootId: 'stored-branch',
            descendantCount: 1,
          }),
          makeStoredNode({
            id: 'child-1',
            url: 'https://child.com',
            parentId: 'stored-branch',
            branchRootId: 'stored-branch',
          }),
        ]);

        await startupTree.loadSummaries(storage);

        // The stored branch root is in memory but its children are not
        expect(startupTree.nodes.has('stored-branch')).toBe(true);
        expect(startupTree.nodes.has('child-1')).toBe(false);
        expect(startupTree.activeBranchId).toBeNull();

        // Simulate what the click handler should do: switchBranch
        await startupTree.switchBranch('stored-branch', storage);

        // After activation, the full subtree is loaded
        expect(startupTree.activeBranchId).toBe('stored-branch');
        expect(startupTree.nodes.has('child-1')).toBe(true);
      });
    });
  });
});
