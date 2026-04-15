// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * TreeStorage - SQLite-backed persistent storage for tree data and screenshots.
 *
 * Uses Firefox's Sqlite.sys.mjs API to store inactive branch nodes and
 * screenshots in a dedicated SQLite database (limb-tree.sqlite) within
 * the user's profile directory.
 *
 * Implements the TreeStoragePort interface defined in ports/TreeStoragePort.ts.
 *
 * Schema version is tracked for future migrations.
 *
 * @see specs/persistence.md S1.2, S4
 */

const SCHEMA_VERSION = 1;
const DB_FILENAME = "limb-tree.sqlite";

export class TreeStorage {
  /** @type {any} */
  #db = null;
  /** @type {Promise<any> | null} */
  #dbPromise = null;
  /** @type {any} */
  #probe = null;

  /**
   * @param {object} [probe] - Optional TreeStorageProbe for observability
   */
  constructor(probe) {
    this.#probe = probe ?? null;
  }

  /**
   * Get or initialize the database connection.
   * Creates the schema on first access.
   * @returns {Promise<any>}
   */
  async #getDb() {
    if (this.#db) {
      return this.#db;
    }
    if (this.#dbPromise) {
      return this.#dbPromise;
    }

    this.#dbPromise = this.#initDb();
    this.#db = await this.#dbPromise;
    this.#dbPromise = null;
    return this.#db;
  }

  async #initDb() {
    const { Sqlite } = ChromeUtils.importESModule(
      "resource://gre/modules/Sqlite.sys.mjs"
    );

    const db = await Sqlite.openConnection({
      path: DB_FILENAME,
    });

    await db.executeTransaction(async () => {
      // Schema versioning table
      await db.execute(`
        CREATE TABLE IF NOT EXISTS limb_meta (
          key TEXT PRIMARY KEY,
          value TEXT
        )
      `);

      const versionRows = await db.execute(
        "SELECT value FROM limb_meta WHERE key = 'schema_version'"
      );

      const currentVersion = versionRows.length > 0
        ? parseInt(versionRows[0].getResultByName("value"), 10)
        : 0;

      if (currentVersion < 1) {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS limb_nodes (
            id TEXT PRIMARY KEY,
            url TEXT,
            title TEXT,
            favicon TEXT,
            parent_id TEXT,
            child_ids TEXT,
            created_at INTEGER,
            last_visited_at INTEGER,
            descendant_count INTEGER,
            branch_root_id TEXT
          )
        `);

        await db.execute(`
          CREATE INDEX IF NOT EXISTS idx_limb_nodes_branch_root
          ON limb_nodes (branch_root_id)
        `);

        await db.execute(`
          CREATE TABLE IF NOT EXISTS limb_screenshots (
            node_id TEXT,
            resolution TEXT,
            data BLOB,
            captured_at INTEGER,
            PRIMARY KEY (node_id, resolution)
          )
        `);

        await db.execute(
          `INSERT OR REPLACE INTO limb_meta (key, value)
          VALUES ('schema_version', :schemaVersion)`,
          { schemaVersion: String(SCHEMA_VERSION) }
        );
      }
    });

    return db;
  }

  /**
   * Persist all nodes in a branch.
   * @param {string} branchRootId
   * @param {Array<object>} nodes - Array of StoredNode objects
   */
  async saveBranch(branchRootId, nodes) {
    for (const node of nodes) {
      if (node.branchRootId !== branchRootId) {
        throw new Error(
          "Node \"" + node.id + "\" has branchRootId \"" +
          node.branchRootId + "\" but saveBranch was called with \"" +
          branchRootId + "\""
        );
      }
    }

    const db = await this.#getDb();

    await db.executeTransaction(async () => {
      // Remove existing nodes for this branch
      await db.execute(
        "DELETE FROM limb_nodes WHERE branch_root_id = :branchRootId",
        { branchRootId }
      );

      // Insert all nodes
      for (const node of nodes) {
        await db.execute(
          `INSERT INTO limb_nodes
            (id, url, title, favicon, parent_id, child_ids, created_at,
             last_visited_at, descendant_count, branch_root_id)
          VALUES
            (:id, :url, :title, :favicon, :parentId, :childIds, :createdAt,
             :lastVisitedAt, :descendantCount, :branchRootId)`,
          {
            id: node.id,
            url: node.url,
            title: node.title,
            favicon: node.favicon,
            parentId: node.parentId,
            childIds: JSON.stringify(node.childIds),
            createdAt: node.createdAt,
            lastVisitedAt: node.lastVisitedAt,
            descendantCount: node.descendantCount,
            branchRootId: node.branchRootId,
          }
        );
      }
    });

    this.#probe?.branchSaved(branchRootId, nodes.length);
  }

  /**
   * Load all nodes for a branch.
   * @param {string} branchRootId
   * @returns {Promise<Array<object>>} Array of StoredNode objects
   */
  async loadBranch(branchRootId) {
    const db = await this.#getDb();

    const rows = await db.execute(
      "SELECT * FROM limb_nodes WHERE branch_root_id = :branchRootId",
      { branchRootId }
    );

    const nodes = rows.map((row) => ({
      id: row.getResultByName("id"),
      url: row.getResultByName("url"),
      title: row.getResultByName("title"),
      favicon: row.getResultByName("favicon"),
      parentId: row.getResultByName("parent_id"),
      childIds: JSON.parse(row.getResultByName("child_ids")),
      createdAt: row.getResultByName("created_at"),
      lastVisitedAt: row.getResultByName("last_visited_at"),
      descendantCount: row.getResultByName("descendant_count"),
      branchRootId: row.getResultByName("branch_root_id"),
    }));

    this.#probe?.branchLoaded(branchRootId, nodes.length);
    return nodes;
  }

  /**
   * Remove a branch and all its descendant nodes and screenshots.
   * @param {string} branchRootId
   */
  async deleteBranch(branchRootId) {
    const db = await this.#getDb();

    await db.executeTransaction(async () => {
      // Get node IDs for screenshot cleanup
      const nodeRows = await db.execute(
        "SELECT id FROM limb_nodes WHERE branch_root_id = :branchRootId",
        { branchRootId }
      );

      // Delete screenshots for branch nodes
      for (const row of nodeRows) {
        const nodeId = row.getResultByName("id");
        await db.execute(
          "DELETE FROM limb_screenshots WHERE node_id = :nodeId",
          { nodeId }
        );
      }

      // Delete all nodes in the branch
      await db.execute(
        "DELETE FROM limb_nodes WHERE branch_root_id = :branchRootId",
        { branchRootId }
      );
    });

    this.#probe?.branchDeleted(branchRootId);
  }

  /**
   * Return branch root nodes with metadata for launcher display.
   * Does not load full subtrees.
   * @returns {Promise<Array<object>>} Array of BranchSummary objects
   */
  async getBranchSummaries() {
    const db = await this.#getDb();

    const rows = await db.execute(
      `SELECT id, url, title, favicon, created_at, last_visited_at,
              descendant_count
       FROM limb_nodes
       WHERE id = branch_root_id`
    );

    return rows.map((row) => ({
      id: row.getResultByName("id"),
      url: row.getResultByName("url"),
      title: row.getResultByName("title"),
      favicon: row.getResultByName("favicon"),
      createdAt: row.getResultByName("created_at"),
      lastVisitedAt: row.getResultByName("last_visited_at"),
      descendantCount: row.getResultByName("descendant_count"),
    }));
  }

  /**
   * Persist a screenshot.
   * @param {string} nodeId
   * @param {string} resolution - 'low' or 'high'
   * @param {Uint8Array} jpegBlob
   */
  async saveScreenshot(nodeId, resolution, jpegBlob) {
    const db = await this.#getDb();

    await db.execute(
      `INSERT OR REPLACE INTO limb_screenshots
        (node_id, resolution, data, captured_at)
      VALUES
        (:nodeId, :resolution, :data, :capturedAt)`,
      {
        nodeId,
        resolution,
        data: jpegBlob,
        capturedAt: Date.now(),
      }
    );

    this.#probe?.screenshotSaved(nodeId, resolution, jpegBlob.byteLength);
  }

  /**
   * Retrieve a screenshot blob.
   * @param {string} nodeId
   * @param {string} resolution - 'low' or 'high'
   * @returns {Promise<Uint8Array|null>}
   */
  async loadScreenshot(nodeId, resolution) {
    const db = await this.#getDb();

    const rows = await db.execute(
      `SELECT data FROM limb_screenshots
       WHERE node_id = :nodeId AND resolution = :resolution`,
      { nodeId, resolution }
    );

    this.#probe?.screenshotLoaded(nodeId, resolution);

    if (rows.length === 0) {
      return null;
    }

    const blob = rows[0].getResultByName("data");
    return new Uint8Array(blob);
  }

  /**
   * Remove screenshots for given node IDs.
   * @param {string[]} nodeIds
   */
  async deleteScreenshots(nodeIds) {
    if (nodeIds.length === 0) {
      this.#probe?.screenshotsDeleted(nodeIds);
      return;
    }

    const db = await this.#getDb();

    await db.executeTransaction(async () => {
      for (const nodeId of nodeIds) {
        await db.execute(
          "DELETE FROM limb_screenshots WHERE node_id = :nodeId",
          { nodeId }
        );
      }
    });

    this.#probe?.screenshotsDeleted(nodeIds);
  }

  /**
   * Return metadata for all stored screenshots (without blob data).
   * @returns {Promise<Array<{nodeId: string, resolution: string, byteSize: number, capturedAt: number}>>}
   */
  async getScreenshotEntries() {
    const db = await this.#getDb();

    const rows = await db.execute(
      `SELECT node_id, resolution, LENGTH(data) AS byte_size, captured_at
       FROM limb_screenshots`
    );

    return rows.map((row) => ({
      nodeId: row.getResultByName("node_id"),
      resolution: row.getResultByName("resolution"),
      byteSize: row.getResultByName("byte_size"),
      capturedAt: row.getResultByName("captured_at"),
    }));
  }

  /**
   * Return total byte size of stored screenshots.
   * @returns {Promise<number>}
   */
  async getScreenshotMemoryUsage() {
    const db = await this.#getDb();

    const rows = await db.execute(
      "SELECT COALESCE(SUM(LENGTH(data)), 0) AS total FROM limb_screenshots"
    );

    return rows[0].getResultByName("total");
  }

  /**
   * Close the database connection.
   */
  async close() {
    if (this.#db) {
      await this.#db.close();
      this.#db = null;
    }
  }
}
