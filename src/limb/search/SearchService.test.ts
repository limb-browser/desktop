// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach } from 'vitest';
import { BrowsingTree } from '../tree/BrowsingTree';
import { InMemoryTreeStorage } from '../tree/InMemoryTreeStorage';
import { SearchService } from './SearchService';
import type { SearchProbe } from '../ports/SearchProbe';

function createProbe(): SearchProbe & { calls: Array<{ method: string; args: unknown[] }> } {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  return {
    calls,
    searchExecuted(query: string, resultCount: number) {
      calls.push({ method: 'searchExecuted', args: [query, resultCount] });
    },
  };
}

describe('SearchService', () => {
  let tree: BrowsingTree;
  let storage: InMemoryTreeStorage;
  let probe: ReturnType<typeof createProbe>;
  let service: SearchService;

  beforeEach(() => {
    tree = new BrowsingTree('about:limb-home');
    storage = new InMemoryTreeStorage();
    probe = createProbe();
    service = new SearchService(tree, storage, probe);
  });

  it('returns empty results for empty query', async () => {
    tree.addChild(tree.rootId, 'https://example.com');
    const results = await service.search('');
    expect(results).toEqual([]);
  });

  it('returns empty results for whitespace-only query', async () => {
    tree.addChild(tree.rootId, 'https://example.com');
    const results = await service.search('   ');
    expect(results).toEqual([]);
  });

  it('finds nodes by title substring', async () => {
    const branch = tree.addChild(tree.rootId, 'https://example.com');
    branch.title = 'Mozilla Firefox Browser';

    const results = await service.search('firefox');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Mozilla Firefox Browser');
    expect(results[0].nodeId).toBe(branch.id);
  });

  it('finds nodes by URL substring', async () => {
    const branch = tree.addChild(tree.rootId, 'https://developer.mozilla.org/docs');
    branch.title = 'MDN Docs';

    const results = await service.search('mozilla.org');
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('https://developer.mozilla.org/docs');
    expect(results[0].nodeId).toBe(branch.id);
  });

  it('search is case-insensitive', async () => {
    const branch = tree.addChild(tree.rootId, 'https://example.com');
    branch.title = 'GitHub Repository';

    const results = await service.search('GITHUB');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('GitHub Repository');
  });

  it('results include correct branch name for branch root nodes', async () => {
    const branch = tree.addChild(tree.rootId, 'https://example.com');
    branch.title = 'My Research';

    const results = await service.search('Research');
    expect(results).toHaveLength(1);
    expect(results[0].branchName).toBe('My Research');
    expect(results[0].branchRootId).toBe(branch.id);
  });

  it('results include correct branch name for child nodes', async () => {
    const branch = tree.addChild(tree.rootId, 'https://example.com');
    branch.title = 'Shopping Session';
    const child = tree.addChild(branch.id, 'https://store.example.com/shoes');
    child.title = 'Running Shoes';

    const results = await service.search('shoes');
    expect(results).toHaveLength(1);
    expect(results[0].branchName).toBe('Shopping Session');
    expect(results[0].branchRootId).toBe(branch.id);
  });

  it('results include correct timestamp', async () => {
    const branch = tree.addChild(tree.rootId, 'https://example.com');
    branch.title = 'Test Page';
    branch.lastVisitedAt = 1700000000000;

    const results = await service.search('test');
    expect(results).toHaveLength(1);
    expect(results[0].timestamp).toBe(1700000000000);
  });

  it('results include favicon', async () => {
    const branch = tree.addChild(tree.rootId, 'https://example.com');
    branch.title = 'Example Site';
    branch.favicon = 'https://example.com/favicon.ico';

    const results = await service.search('example');
    expect(results).toHaveLength(1);
    expect(results[0].favicon).toBe('https://example.com/favicon.ico');
  });

  it('results sorted by timestamp descending', async () => {
    const older = tree.addChild(tree.rootId, 'https://docs.example.com');
    older.title = 'Docs A';
    older.lastVisitedAt = 1000;

    const newer = tree.addChild(tree.rootId, 'https://docs2.example.com');
    newer.title = 'Docs B';
    newer.lastVisitedAt = 2000;

    const results = await service.search('docs');
    expect(results).toHaveLength(2);
    expect(results[0].nodeId).toBe(newer.id);
    expect(results[1].nodeId).toBe(older.id);
  });

  it('does not include the root node in results', async () => {
    const root = tree.nodes.get(tree.rootId)!;
    root.title = 'about:limb-home';

    const results = await service.search('limb-home');
    expect(results).toHaveLength(0);
  });

  it('returns no results when nothing matches', async () => {
    const branch = tree.addChild(tree.rootId, 'https://example.com');
    branch.title = 'Example';

    const results = await service.search('zzzzz-no-match');
    expect(results).toHaveLength(0);
  });

  it('fires searchExecuted probe', async () => {
    const branch = tree.addChild(tree.rootId, 'https://example.com');
    branch.title = 'Test Page';

    await service.search('test');
    expect(probe.calls).toHaveLength(1);
    expect(probe.calls[0]).toEqual({
      method: 'searchExecuted',
      args: ['test', 1],
    });
  });

  it('does not fire probe for empty query', async () => {
    await service.search('');
    expect(probe.calls).toHaveLength(0);
  });

  describe('with stored nodes (inactive branches)', () => {
    beforeEach(async () => {
      // Set up an inactive branch in storage
      const branchRoot = tree.addChild(tree.rootId, 'https://research.example.com');
      branchRoot.title = 'Research Project';

      await storage.saveBranch(branchRoot.id, [
        {
          id: branchRoot.id,
          url: 'https://research.example.com',
          title: 'Research Project',
          favicon: null,
          parentId: tree.rootId,
          childIds: ['stored-child-1', 'stored-child-2'],
          createdAt: 1000,
          lastVisitedAt: 5000,
          descendantCount: 2,
          branchRootId: branchRoot.id,
        },
        {
          id: 'stored-child-1',
          url: 'https://research.example.com/paper',
          title: 'Quantum Computing Paper',
          favicon: 'https://research.example.com/fav.ico',
          parentId: branchRoot.id,
          childIds: [],
          createdAt: 2000,
          lastVisitedAt: 3000,
          descendantCount: 0,
          branchRootId: branchRoot.id,
        },
        {
          id: 'stored-child-2',
          url: 'https://research.example.com/notes',
          title: 'Lab Notes',
          favicon: null,
          parentId: branchRoot.id,
          childIds: [],
          createdAt: 3000,
          lastVisitedAt: 4000,
          descendantCount: 0,
          branchRootId: branchRoot.id,
        },
      ]);
    });

    it('finds stored nodes by title', async () => {
      const results = await service.search('quantum');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Quantum Computing Paper');
      expect(results[0].nodeId).toBe('stored-child-1');
    });

    it('finds stored nodes by URL', async () => {
      const results = await service.search('/notes');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Lab Notes');
    });

    it('stored results include correct branch name from in-memory tree', async () => {
      const results = await service.search('quantum');
      expect(results).toHaveLength(1);
      expect(results[0].branchName).toBe('Research Project');
    });

    it('stored results include favicon and timestamp', async () => {
      const results = await service.search('quantum');
      expect(results).toHaveLength(1);
      expect(results[0].favicon).toBe('https://research.example.com/fav.ico');
      expect(results[0].timestamp).toBe(3000);
    });

    it('deduplicates in-memory and stored nodes (in-memory wins)', async () => {
      // The branch root "Research Project" is in both memory and storage.
      // Searching for it should return only one result.
      const results = await service.search('Research Project');
      const rootResults = results.filter(r => r.title === 'Research Project');
      expect(rootResults).toHaveLength(1);
    });

    it('combines in-memory and stored results', async () => {
      // Add an in-memory node that also matches
      const activeBranch = tree.addChild(tree.rootId, 'https://quantum-lab.com');
      activeBranch.title = 'Quantum Lab';
      activeBranch.lastVisitedAt = 9000;

      const results = await service.search('quantum');
      expect(results).toHaveLength(2);
      // Most recent first
      expect(results[0].title).toBe('Quantum Lab');
      expect(results[1].title).toBe('Quantum Computing Paper');
    });
  });

  describe('without storage', () => {
    it('searches only in-memory tree when no storage provided', async () => {
      const serviceNoStorage = new SearchService(tree, null, probe);
      const branch = tree.addChild(tree.rootId, 'https://example.com');
      branch.title = 'Test Page';

      const results = await serviceNoStorage.search('test');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Test Page');
    });
  });

  describe('result activation', () => {
    it('clicking a result activates the correct branch and focuses the node', async () => {
      // Set up an inactive branch with children in storage
      const branchRoot = tree.addChild(tree.rootId, 'https://project.example.com');
      branchRoot.title = 'Project';
      const targetNodeId = 'target-node-id';

      await storage.saveBranch(branchRoot.id, [
        {
          id: branchRoot.id,
          url: 'https://project.example.com',
          title: 'Project',
          favicon: null,
          parentId: tree.rootId,
          childIds: [targetNodeId],
          createdAt: 1000,
          lastVisitedAt: 5000,
          descendantCount: 1,
          branchRootId: branchRoot.id,
        },
        {
          id: targetNodeId,
          url: 'https://project.example.com/design',
          title: 'Design Document',
          favicon: null,
          parentId: branchRoot.id,
          childIds: [],
          createdAt: 2000,
          lastVisitedAt: 3000,
          descendantCount: 0,
          branchRootId: branchRoot.id,
        },
      ]);

      // Search for the stored node
      const results = await service.search('design');
      expect(results).toHaveLength(1);
      expect(results[0].nodeId).toBe(targetNodeId);
      expect(results[0].branchRootId).toBe(branchRoot.id);

      // Simulate click: activate the branch, then focus the node
      await tree.switchBranch(results[0].branchRootId, storage);
      tree.focusNode(results[0].nodeId);

      // Verify the branch was activated and node is focused
      expect(tree.activeBranchId).toBe(branchRoot.id);
      expect(tree.focusedNodeId).toBe(targetNodeId);
      expect(tree.nodes.has(targetNodeId)).toBe(true);
    });
  });
});
