// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import type { TreeStoragePort } from '../ports/TreeStoragePort';
import type { BrowsingTree } from './BrowsingTree';
import type { PrefsPort } from '../ports/PrefsPort';
import type { ScreenshotEvictorProbe } from '../ports/ScreenshotEvictorProbe';

const MEMORY_BUDGET_BYTES = 20 * 1024 * 1024; // 20MB
const EVICTION_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_RETENTION_DAYS = 7;

export class ScreenshotEvictor {
  #storage: TreeStoragePort;
  #tree: BrowsingTree;
  #prefs: PrefsPort;
  #probe: ScreenshotEvictorProbe | null;
  #intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    storage: TreeStoragePort,
    tree: BrowsingTree,
    prefs: PrefsPort,
    probe?: ScreenshotEvictorProbe
  ) {
    this.#storage = storage;
    this.#tree = tree;
    this.#prefs = prefs;
    this.#probe = probe ?? null;
  }

  async evict(): Promise<void> {
    this.#probe?.evictionStarted();
    let totalRemoved = 0;

    // Phase 1: Time-based retention
    totalRemoved += await this.#evictByRetention();

    // Phase 2: Memory budget enforcement
    totalRemoved += await this.#evictByBudget();

    this.#probe?.evictionCompleted(totalRemoved);
  }

  install(): void {
    if (this.#intervalId !== null) return;
    this.evict();
    this.#intervalId = setInterval(() => {
      this.evict();
    }, EVICTION_INTERVAL_MS);
  }

  uninstall(): void {
    if (this.#intervalId !== null) {
      clearInterval(this.#intervalId);
      this.#intervalId = null;
    }
  }

  async #evictByRetention(): Promise<number> {
    const retentionDays = this.#prefs.getIntPref(
      'limb.screenshots.retention-days',
      DEFAULT_RETENTION_DAYS
    );
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    const summaries = await this.#storage.getBranchSummaries();
    let totalRemoved = 0;

    for (const summary of summaries) {
      // Skip active branch
      if (summary.id === this.#tree.activeBranchId) {
        continue;
      }
      // Skip branches within retention window
      if (summary.lastVisitedAt > cutoff) {
        continue;
      }

      // Old branch: keep only root screenshot, delete descendants'
      const branchNodes = await this.#storage.loadBranch(summary.id);
      const nonRootNodeIds = branchNodes
        .filter((n) => n.id !== summary.id)
        .map((n) => n.id);

      if (nonRootNodeIds.length > 0) {
        await this.#storage.deleteScreenshots(nonRootNodeIds);
        totalRemoved += nonRootNodeIds.length;
        this.#probe?.retentionEvicted(summary.id, nonRootNodeIds.length);
      }
    }

    return totalRemoved;
  }

  async #evictByBudget(): Promise<number> {
    let usage = await this.#storage.getScreenshotMemoryUsage();
    if (usage <= MEMORY_BUDGET_BYTES) {
      return 0;
    }

    const entries = await this.#storage.getScreenshotEntries();

    // Determine which nodes are branch roots (protected from budget eviction)
    const summaries = await this.#storage.getBranchSummaries();
    const branchRootIds = new Set(summaries.map((s) => s.id));

    // Also protect the active branch's node IDs
    const activeBranchNodeIds = this.#getActiveBranchNodeIds();

    // Filter to evictable entries: non-root, not in active branch
    const evictable = entries.filter(
      (e) => !branchRootIds.has(e.nodeId) && !activeBranchNodeIds.has(e.nodeId)
    );

    // Sort oldest first
    evictable.sort((a, b) => a.capturedAt - b.capturedAt);

    // Group by nodeId to batch-delete and sum sizes
    const nodeEntrySizes = new Map<string, number>();
    for (const entry of evictable) {
      const current = nodeEntrySizes.get(entry.nodeId) ?? 0;
      nodeEntrySizes.set(entry.nodeId, current + entry.byteSize);
    }

    // Order nodes by their oldest entry's capturedAt
    const nodeOldest = new Map<string, number>();
    for (const entry of evictable) {
      const current = nodeOldest.get(entry.nodeId);
      if (current === undefined || entry.capturedAt < current) {
        nodeOldest.set(entry.nodeId, entry.capturedAt);
      }
    }

    const sortedNodeIds = [...nodeOldest.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([nodeId]) => nodeId);

    let totalRemoved = 0;

    for (const nodeId of sortedNodeIds) {
      if (usage <= MEMORY_BUDGET_BYTES) {
        break;
      }

      await this.#storage.deleteScreenshots([nodeId]);
      usage -= nodeEntrySizes.get(nodeId)!;
      totalRemoved++;
      this.#probe?.budgetEvicted(nodeId);
    }

    return totalRemoved;
  }

  #getActiveBranchNodeIds(): Set<string> {
    const activeBranchId = this.#tree.activeBranchId;
    if (activeBranchId === null) {
      return new Set();
    }

    // Collect all node IDs in the active branch from the tree
    const nodeIds = new Set<string>();
    const branchRoot = this.#tree.nodes.get(activeBranchId);
    if (!branchRoot) {
      return nodeIds;
    }

    const queue = [activeBranchId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      nodeIds.add(id);
      const node = this.#tree.nodes.get(id);
      if (node) {
        queue.push(...node.childIds);
      }
    }

    return nodeIds;
  }
}
