// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach } from 'vitest';
import { TreeRestorer } from './TreeRestorer';
import type { RestoredTabData } from './TreeRestorer';
import type { TreeRestorerProbe } from '../ports/TreeRestorerProbe';

function createFakeProbe(): TreeRestorerProbe & {
  calls: { method: string; args: unknown[] }[];
} {
  const calls: { method: string; args: unknown[] }[] = [];
  return {
    calls,
    treeRestored(nodeCount: number) {
      calls.push({ method: 'treeRestored', args: [nodeCount] });
    },
    orphanedNodeReparented(nodeId: string) {
      calls.push({ method: 'orphanedNodeReparented', args: [nodeId] });
    },
    preLimbTabAdopted(nodeId: string) {
      calls.push({ method: 'preLimbTabAdopted', args: [nodeId] });
    },
  };
}

describe('TreeRestorer', () => {
  let probe: ReturnType<typeof createFakeProbe>;
  let restorer: TreeRestorer;

  beforeEach(() => {
    probe = createFakeProbe();
    restorer = new TreeRestorer(probe);
  });

  describe('basic tree reconstruction', () => {
    it('reconstructs a single-node tree (root only)', () => {
      const tabs: RestoredTabData[] = [
        { nodeId: 'root-1', parentId: null, createdAt: 1000, url: 'https://root.com', title: 'Root', favicon: null },
      ];
      const tree = restorer.restore(tabs);
      expect(tree.rootId).toBe('root-1');
      expect(tree.nodes.size).toBe(1);
      const root = tree.nodes.get('root-1')!;
      expect(root.url).toBe('https://root.com');
      expect(root.title).toBe('Root');
      expect(root.parentId).toBeNull();
      expect(root.createdAt).toBe(1000);
    });

    it('reconstructs a parent-child tree', () => {
      const tabs: RestoredTabData[] = [
        { nodeId: 'root-1', parentId: null, createdAt: 1000, url: 'https://root.com', title: 'Root', favicon: null },
        { nodeId: 'child-1', parentId: 'root-1', createdAt: 2000, url: 'https://child.com', title: 'Child', favicon: 'icon.png' },
      ];
      const tree = restorer.restore(tabs);
      expect(tree.nodes.size).toBe(2);
      const root = tree.nodes.get('root-1')!;
      expect(root.childIds).toEqual(['child-1']);
      const child = tree.nodes.get('child-1')!;
      expect(child.parentId).toBe('root-1');
      expect(child.url).toBe('https://child.com');
      expect(child.favicon).toBe('icon.png');
    });

    it('reconstructs a multi-level tree', () => {
      const tabs: RestoredTabData[] = [
        { nodeId: 'root', parentId: null, createdAt: 1000, url: 'https://root.com', title: 'Root', favicon: null },
        { nodeId: 'child-a', parentId: 'root', createdAt: 2000, url: 'https://a.com', title: 'A', favicon: null },
        { nodeId: 'child-b', parentId: 'root', createdAt: 3000, url: 'https://b.com', title: 'B', favicon: null },
        { nodeId: 'grandchild', parentId: 'child-a', createdAt: 4000, url: 'https://gc.com', title: 'GC', favicon: null },
      ];
      const tree = restorer.restore(tabs);
      expect(tree.nodes.size).toBe(4);
      expect(tree.nodes.get('root')!.childIds).toContain('child-a');
      expect(tree.nodes.get('root')!.childIds).toContain('child-b');
      expect(tree.nodes.get('child-a')!.childIds).toEqual(['grandchild']);
      expect(tree.nodes.get('grandchild')!.parentId).toBe('child-a');
    });

    it('sets focusedNodeId to the root', () => {
      const tabs: RestoredTabData[] = [
        { nodeId: 'root-1', parentId: null, createdAt: 1000, url: 'https://root.com', title: 'Root', favicon: null },
        { nodeId: 'child-1', parentId: 'root-1', createdAt: 2000, url: 'https://child.com', title: 'Child', favicon: null },
      ];
      const tree = restorer.restore(tabs);
      expect(tree.focusedNodeId).toBe('root-1');
    });

    it('sets node status to culled', () => {
      const tabs: RestoredTabData[] = [
        { nodeId: 'root-1', parentId: null, createdAt: 1000, url: 'https://root.com', title: 'Root', favicon: null },
      ];
      const tree = restorer.restore(tabs);
      expect(tree.nodes.get('root-1')!.status).toBe('culled');
    });
  });

  describe('orphaned nodes', () => {
    it('reparents nodes whose parent does not exist to the root', () => {
      const tabs: RestoredTabData[] = [
        { nodeId: 'root-1', parentId: null, createdAt: 1000, url: 'https://root.com', title: 'Root', favicon: null },
        { nodeId: 'orphan-1', parentId: 'missing-parent', createdAt: 2000, url: 'https://orphan.com', title: 'Orphan', favicon: null },
      ];
      const tree = restorer.restore(tabs);
      expect(tree.nodes.get('orphan-1')!.parentId).toBe('root-1');
      expect(tree.nodes.get('root-1')!.childIds).toContain('orphan-1');
    });

    it('fires orphanedNodeReparented probe for each orphan', () => {
      const tabs: RestoredTabData[] = [
        { nodeId: 'root-1', parentId: null, createdAt: 1000, url: 'https://root.com', title: 'Root', favicon: null },
        { nodeId: 'orphan-1', parentId: 'missing', createdAt: 2000, url: 'https://o1.com', title: 'O1', favicon: null },
        { nodeId: 'orphan-2', parentId: 'also-missing', createdAt: 3000, url: 'https://o2.com', title: 'O2', favicon: null },
      ];
      restorer.restore(tabs);
      const orphanCalls = probe.calls.filter(c => c.method === 'orphanedNodeReparented');
      expect(orphanCalls).toHaveLength(2);
      expect(orphanCalls.map(c => c.args[0])).toContain('orphan-1');
      expect(orphanCalls.map(c => c.args[0])).toContain('orphan-2');
    });
  });

  describe('pre-Limb tabs (missing nodeId)', () => {
    it('assigns a new nodeId and adds as child of root', () => {
      const tabs: RestoredTabData[] = [
        { nodeId: 'root-1', parentId: null, createdAt: 1000, url: 'https://root.com', title: 'Root', favicon: null },
        { nodeId: null, parentId: null, createdAt: null, url: 'https://preLimb.com', title: 'Pre-Limb', favicon: null },
      ];
      const tree = restorer.restore(tabs);
      expect(tree.nodes.size).toBe(2);
      const root = tree.nodes.get('root-1')!;
      expect(root.childIds).toHaveLength(1);
      const adoptedId = root.childIds[0];
      const adopted = tree.nodes.get(adoptedId)!;
      expect(adopted.url).toBe('https://preLimb.com');
      expect(adopted.title).toBe('Pre-Limb');
      expect(adopted.parentId).toBe('root-1');
    });

    it('fires preLimbTabAdopted probe', () => {
      const tabs: RestoredTabData[] = [
        { nodeId: 'root-1', parentId: null, createdAt: 1000, url: 'https://root.com', title: 'Root', favicon: null },
        { nodeId: null, parentId: null, createdAt: null, url: 'https://preLimb.com', title: 'Pre-Limb', favicon: null },
      ];
      restorer.restore(tabs);
      const adoptCalls = probe.calls.filter(c => c.method === 'preLimbTabAdopted');
      expect(adoptCalls).toHaveLength(1);
    });

    it('pre-Limb tab appearing before real root does not hijack root selection', () => {
      // Pre-Limb tab (no nodeId) appears BEFORE the real root in the array.
      // The real root (with original nodeId) should still be selected as root,
      // not the synthesized pre-Limb tab.
      const tabs: RestoredTabData[] = [
        { nodeId: null, parentId: null, createdAt: null, url: 'https://preLimb.com', title: 'Pre-Limb', favicon: null },
        { nodeId: 'real-root', parentId: null, createdAt: 1000, url: 'https://root.com', title: 'Root', favicon: null },
        { nodeId: 'child-1', parentId: 'real-root', createdAt: 2000, url: 'https://child.com', title: 'Child', favicon: null },
      ];
      const tree = restorer.restore(tabs);
      expect(tree.rootId).toBe('real-root');
      expect(tree.nodes.get('real-root')!.parentId).toBeNull();
      // Pre-Limb tab should be a child of the real root, not the root itself
      const realRoot = tree.nodes.get('real-root')!;
      expect(realRoot.childIds).toHaveLength(2); // child-1 + pre-Limb adopted
      // child-1 should still have real-root as parent
      expect(tree.nodes.get('child-1')!.parentId).toBe('real-root');
    });
  });

  describe('missing createdAt', () => {
    it('uses a default timestamp when createdAt is null', () => {
      const tabs: RestoredTabData[] = [
        { nodeId: 'root-1', parentId: null, createdAt: null, url: 'https://root.com', title: 'Root', favicon: null },
      ];
      const tree = restorer.restore(tabs);
      const root = tree.nodes.get('root-1')!;
      expect(root.createdAt).toBeGreaterThan(0);
    });
  });

  describe('no root node', () => {
    it('creates a synthetic root when no tab has null parentId', () => {
      const tabs: RestoredTabData[] = [
        { nodeId: 'child-1', parentId: 'missing-root', createdAt: 2000, url: 'https://child.com', title: 'Child', favicon: null },
        { nodeId: 'child-2', parentId: 'missing-root', createdAt: 3000, url: 'https://child2.com', title: 'Child2', favicon: null },
      ];
      const tree = restorer.restore(tabs);
      // Root is synthetic
      const root = tree.nodes.get(tree.rootId)!;
      expect(root.parentId).toBeNull();
      expect(root.url).toBe('about:blank');
      // Children reparented to synthetic root
      expect(root.childIds).toContain('child-1');
      expect(root.childIds).toContain('child-2');
      expect(tree.nodes.get('child-1')!.parentId).toBe(tree.rootId);
    });
  });

  describe('empty input', () => {
    it('creates a minimal tree with a synthetic root', () => {
      const tree = restorer.restore([]);
      expect(tree.nodes.size).toBe(1);
      const root = tree.nodes.get(tree.rootId)!;
      expect(root.parentId).toBeNull();
      expect(root.url).toBe('about:blank');
    });
  });

  describe('probe events', () => {
    it('fires treeRestored with the total node count', () => {
      const tabs: RestoredTabData[] = [
        { nodeId: 'root-1', parentId: null, createdAt: 1000, url: 'https://root.com', title: 'Root', favicon: null },
        { nodeId: 'child-1', parentId: 'root-1', createdAt: 2000, url: 'https://child.com', title: 'Child', favicon: null },
      ];
      restorer.restore(tabs);
      expect(probe.calls).toContainEqual({
        method: 'treeRestored',
        args: [2],
      });
    });
  });

  describe('without probe', () => {
    it('works when no probe is provided', () => {
      const noProbRestorer = new TreeRestorer();
      const tabs: RestoredTabData[] = [
        { nodeId: 'root-1', parentId: null, createdAt: 1000, url: 'https://root.com', title: 'Root', favicon: null },
        { nodeId: 'orphan', parentId: 'missing', createdAt: 2000, url: 'https://orphan.com', title: 'Orphan', favicon: null },
      ];
      const tree = noProbRestorer.restore(tabs);
      expect(tree.nodes.size).toBe(2);
    });
  });

  describe('crash recovery preserves tree structure', () => {
    it('round-trips a tree through tab attributes and restoration', () => {
      // Simulate: create a tree, extract tab data (as SessionStore would persist),
      // then restore and verify the structure matches.
      const originalTabs: RestoredTabData[] = [
        { nodeId: 'root', parentId: null, createdAt: 1000, url: 'https://root.com', title: 'Root', favicon: null },
        { nodeId: 'a', parentId: 'root', createdAt: 2000, url: 'https://a.com', title: 'A', favicon: 'a.ico' },
        { nodeId: 'b', parentId: 'root', createdAt: 3000, url: 'https://b.com', title: 'B', favicon: null },
        { nodeId: 'a1', parentId: 'a', createdAt: 4000, url: 'https://a1.com', title: 'A1', favicon: null },
        { nodeId: 'a2', parentId: 'a', createdAt: 5000, url: 'https://a2.com', title: 'A2', favicon: null },
      ];

      const tree = restorer.restore(originalTabs);

      expect(tree.rootId).toBe('root');
      expect(tree.nodes.size).toBe(5);
      expect(tree.nodes.get('root')!.childIds).toContain('a');
      expect(tree.nodes.get('root')!.childIds).toContain('b');
      expect(tree.nodes.get('a')!.childIds).toContain('a1');
      expect(tree.nodes.get('a')!.childIds).toContain('a2');
      expect(tree.nodes.get('a')!.parentId).toBe('root');
      expect(tree.nodes.get('b')!.parentId).toBe('root');
      expect(tree.nodes.get('a1')!.parentId).toBe('a');
      expect(tree.nodes.get('a2')!.parentId).toBe('a');

      // Verify data integrity
      expect(tree.nodes.get('a')!.favicon).toBe('a.ico');
      expect(tree.nodes.get('a')!.createdAt).toBe(2000);
    });
  });

  describe('BrowsingTree API compatibility', () => {
    it('restored tree supports addChild', () => {
      const tabs: RestoredTabData[] = [
        { nodeId: 'root-1', parentId: null, createdAt: 1000, url: 'https://root.com', title: 'Root', favicon: null },
      ];
      const tree = restorer.restore(tabs);
      const child = tree.addChild('root-1', 'https://new-child.com');
      expect(tree.nodes.size).toBe(2);
      expect(tree.nodes.get('root-1')!.childIds).toContain(child.id);
    });

    it('restored tree supports focusNode', () => {
      const tabs: RestoredTabData[] = [
        { nodeId: 'root-1', parentId: null, createdAt: 1000, url: 'https://root.com', title: 'Root', favicon: null },
        { nodeId: 'child-1', parentId: 'root-1', createdAt: 2000, url: 'https://child.com', title: 'Child', favicon: null },
      ];
      const tree = restorer.restore(tabs);
      tree.focusNode('child-1');
      expect(tree.focusedNodeId).toBe('child-1');
    });

    it('restored tree supports removeNode', () => {
      const tabs: RestoredTabData[] = [
        { nodeId: 'root-1', parentId: null, createdAt: 1000, url: 'https://root.com', title: 'Root', favicon: null },
        { nodeId: 'child-1', parentId: 'root-1', createdAt: 2000, url: 'https://child.com', title: 'Child', favicon: null },
      ];
      const tree = restorer.restore(tabs);
      tree.removeNode('child-1');
      expect(tree.nodes.size).toBe(1);
      expect(tree.nodes.get('root-1')!.childIds).toEqual([]);
    });

    it('restored tree supports getAncestors', () => {
      const tabs: RestoredTabData[] = [
        { nodeId: 'root', parentId: null, createdAt: 1000, url: 'https://root.com', title: 'Root', favicon: null },
        { nodeId: 'child', parentId: 'root', createdAt: 2000, url: 'https://child.com', title: 'Child', favicon: null },
        { nodeId: 'gc', parentId: 'child', createdAt: 3000, url: 'https://gc.com', title: 'GC', favicon: null },
      ];
      const tree = restorer.restore(tabs);
      const ancestors = tree.getAncestors('gc');
      expect(ancestors.map(n => n.id)).toEqual(['gc', 'child', 'root']);
    });
  });
});
