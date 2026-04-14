// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TreeStorage } from './TreeStorage.mjs';

/**
 * Fake Sqlite connection that records executed statements.
 * Used to verify schema creation and database path without
 * requiring Firefox's Sqlite.sys.mjs runtime.
 */
class FakeSqliteConnection {
  constructor() {
    this.executedStatements = [];
  }

  async execute(sql, params) {
    this.executedStatements.push({ sql: sql.trim(), params });
    return [];
  }

  async executeTransaction(fn) {
    await fn();
  }

  async close() {}
}

describe('TreeStorage (SQLite adapter)', () => {
  let capturedPath;
  let fakeConnection;

  beforeEach(() => {
    capturedPath = null;
    fakeConnection = new FakeSqliteConnection();

    globalThis.ChromeUtils = {
      importESModule() {
        return {
          Sqlite: {
            async openConnection(opts) {
              capturedPath = opts.path;
              return fakeConnection;
            },
          },
        };
      },
    };
  });

  afterEach(() => {
    delete globalThis.ChromeUtils;
  });

  it('creates database as limb-tree.sqlite in the profile directory on first access', async () => {
    const storage = new TreeStorage();
    await storage.getBranchSummaries();

    expect(capturedPath).toBe('limb-tree.sqlite');
  });

  it('creates schema tables on first access', async () => {
    const storage = new TreeStorage();
    await storage.getBranchSummaries();

    const sqlStatements = fakeConnection.executedStatements.map((s) => s.sql);
    const createTables = sqlStatements.filter((sql) =>
      sql.includes('CREATE TABLE')
    );

    expect(createTables.some((s) => s.includes('limb_meta'))).toBe(true);
    expect(createTables.some((s) => s.includes('limb_nodes'))).toBe(true);
    expect(createTables.some((s) => s.includes('limb_screenshots'))).toBe(
      true
    );
  });

  it('stores schema version using parameterized binding', async () => {
    const storage = new TreeStorage();
    await storage.getBranchSummaries();

    const versionInserts = fakeConnection.executedStatements.filter(
      (s) => s.sql.includes('limb_meta') && s.sql.includes('INSERT')
    );
    expect(versionInserts.length).toBeGreaterThan(0);
    expect(versionInserts[0].params).toEqual({ schemaVersion: '1' });
  });

  it('rejects nodes whose branchRootId does not match the parameter', async () => {
    const storage = new TreeStorage();
    const node = {
      id: 'child-1',
      url: 'https://example.com',
      title: 'Example',
      favicon: null,
      parentId: null,
      childIds: [],
      createdAt: 1000,
      lastVisitedAt: 2000,
      descendantCount: 0,
      branchRootId: 'wrong-root',
    };

    await expect(
      storage.saveBranch('correct-root', [node])
    ).rejects.toThrow('branchRootId');
  });
});
