// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

<<<<<<<< HEAD:src/limb/tree/InMemoryTreeStorage.test.ts
describe('InMemoryTreeStorage', () => {
  let storage: InMemoryTreeStorage;
  let probe: ReturnType<typeof createFakeProbe>;
========
describe('TreeStorage', () => {
  const source = readFileSync(
    resolve(__dirname, 'TreeStorage.mjs'),
    'utf-8'
  );
>>>>>>>> e8cd7675f (fix: address all 6 review findings for task-027 TreeStorage):src/limb/tree/TreeStorage.test.ts

  it('uses limb-tree.sqlite as the database filename', () => {
    expect(source).toContain('const DB_FILENAME = "limb-tree.sqlite"');
  });

<<<<<<<< HEAD:src/limb/tree/InMemoryTreeStorage.test.ts
  describe('saveBranch and loadBranch', () => {
    it('round-trips all node fields correctly', async () => {
      const branchRoot = makeNode({
        id: 'root-1',
        url: 'https://root.com',
        title: 'Root Page',
        favicon: 'data:image/png;base64,abc',
        parentId: null,
        childIds: ['child-1', 'child-2'],
        createdAt: 1000,
        lastVisitedAt: 2000,
        descendantCount: 2,
        branchRootId: 'root-1',
      });
      const child1 = makeNode({
        id: 'child-1',
        url: 'https://child1.com',
        title: 'Child 1',
        favicon: null,
        parentId: 'root-1',
        childIds: [],
        createdAt: 1100,
        lastVisitedAt: 2100,
        descendantCount: 0,
        branchRootId: 'root-1',
      });
      const child2 = makeNode({
        id: 'child-2',
        url: 'https://child2.com',
        title: 'Child 2',
        favicon: 'data:image/png;base64,def',
        parentId: 'root-1',
        childIds: [],
        createdAt: 1200,
        lastVisitedAt: 2200,
        descendantCount: 0,
        branchRootId: 'root-1',
      });

      await storage.saveBranch('root-1', [branchRoot, child1, child2]);
      const loaded = await storage.loadBranch('root-1');

      expect(loaded).toHaveLength(3);
      const loadedById = new Map(loaded.map((n) => [n.id, n]));

      const lr = loadedById.get('root-1')!;
      expect(lr.url).toBe('https://root.com');
      expect(lr.title).toBe('Root Page');
      expect(lr.favicon).toBe('data:image/png;base64,abc');
      expect(lr.parentId).toBeNull();
      expect(lr.childIds).toEqual(['child-1', 'child-2']);
      expect(lr.createdAt).toBe(1000);
      expect(lr.lastVisitedAt).toBe(2000);
      expect(lr.descendantCount).toBe(2);
      expect(lr.branchRootId).toBe('root-1');

      const lc1 = loadedById.get('child-1')!;
      expect(lc1.url).toBe('https://child1.com');
      expect(lc1.parentId).toBe('root-1');
      expect(lc1.branchRootId).toBe('root-1');

      const lc2 = loadedById.get('child-2')!;
      expect(lc2.favicon).toBe('data:image/png;base64,def');
    });

    it('returns empty array when loading a non-existent branch', async () => {
      const loaded = await storage.loadBranch('nonexistent');
      expect(loaded).toEqual([]);
    });

    it('overwrites existing branch data on re-save', async () => {
      const node = makeNode({ id: 'n1', title: 'Original' });
      await storage.saveBranch('n1', [node]);

      const updated = makeNode({ id: 'n1', title: 'Updated' });
      await storage.saveBranch('n1', [updated]);

      const loaded = await storage.loadBranch('n1');
      expect(loaded).toHaveLength(1);
      expect(loaded[0].title).toBe('Updated');
    });

    it('fires branchSaved probe', async () => {
      const nodes = [
        makeNode({ id: 'r', childIds: ['c'] }),
        makeNode({ id: 'c', parentId: 'r', branchRootId: 'r' }),
      ];
      await storage.saveBranch('r', nodes);
      expect(probe.calls).toContainEqual({
        method: 'branchSaved',
        args: ['r', 2],
      });
    });

    it('fires branchLoaded probe', async () => {
      const nodes = [makeNode({ id: 'r' })];
      await storage.saveBranch('r', nodes);
      probe.calls.length = 0;
      await storage.loadBranch('r');
      expect(probe.calls).toContainEqual({
        method: 'branchLoaded',
        args: ['r', 1],
      });
    });

    it('rejects nodes whose branchRootId does not match the parameter', async () => {
      const node = makeNode({
        id: 'child-1',
        branchRootId: 'wrong-root',
      });
      await expect(
        storage.saveBranch('correct-root', [node])
      ).rejects.toThrow('branchRootId');
    });

    it('fires branchLoaded probe with 0 nodes for non-existent branch', async () => {
      await storage.loadBranch('missing');
      expect(probe.calls).toContainEqual({
        method: 'branchLoaded',
        args: ['missing', 0],
      });
    });
========
  it('passes DB_FILENAME as path to Sqlite.openConnection for profile directory placement', () => {
    expect(source).toContain('path: DB_FILENAME');
>>>>>>>> e8cd7675f (fix: address all 6 review findings for task-027 TreeStorage):src/limb/tree/TreeStorage.test.ts
  });

  it('creates schema on first access with a version number', () => {
    expect(source).toContain('const SCHEMA_VERSION = 1');
    expect(source).toContain("key = 'schema_version'");
  });

  it('uses parameterized binding for schema version insert', () => {
    expect(source).toContain(':schemaVersion');
    expect(source).not.toMatch(/VALUES\s*\([^)]*\$\{SCHEMA_VERSION\}/);
  });

  it('wraps deleteScreenshots in a transaction', () => {
    // Extract the deleteScreenshots method body and verify it uses executeTransaction
    const deleteScreenshotsMatch = source.match(
      /async deleteScreenshots[\s\S]*?(?=\n\s{2}\/\*\*|\n\s{2}async\s|\n})/
    );
    expect(deleteScreenshotsMatch).not.toBeNull();
    expect(deleteScreenshotsMatch![0]).toContain('executeTransaction');
  });

  it('validates branchRootId parameter against node branchRootId in saveBranch', () => {
    const saveBranchMatch = source.match(
      /async saveBranch[\s\S]*?(?=\n\s{2}\/\*\*|\n\s{2}async\s)/
    );
    expect(saveBranchMatch).not.toBeNull();
    expect(saveBranchMatch![0]).toContain('node.branchRootId !== branchRootId');
  });
});
