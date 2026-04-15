// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import type {
  TreeStoragePort,
  StoredNode,
  BranchSummary,
  ScreenshotResolution,
  ScreenshotEntry,
} from '../ports/TreeStoragePort';
import type { TreeStorageProbe } from '../ports/TreeStorageProbe';

interface StoredScreenshot {
  nodeId: string;
  resolution: ScreenshotResolution;
  data: Uint8Array;
  capturedAt: number;
}

export class InMemoryTreeStorage implements TreeStoragePort {
  #nodes = new Map<string, StoredNode>();
  #branchRoots = new Set<string>();
  #screenshots = new Map<string, StoredScreenshot>();
  #probe: TreeStorageProbe | null;

  constructor(probe?: TreeStorageProbe) {
    this.#probe = probe ?? null;
  }

  async saveBranch(branchRootId: string, nodes: StoredNode[]): Promise<void> {
    for (const node of nodes) {
      if (node.branchRootId !== branchRootId) {
        throw new Error(
          `Node "${node.id}" has branchRootId "${node.branchRootId}" but saveBranch was called with "${branchRootId}"`
        );
      }
    }

    // Remove existing nodes for this branch before saving
    for (const [id, node] of this.#nodes) {
      if (node.branchRootId === branchRootId) {
        this.#nodes.delete(id);
      }
    }

    this.#branchRoots.add(branchRootId);
    for (const node of nodes) {
      // Deep-copy to avoid shared references
      this.#nodes.set(node.id, {
        id: node.id,
        url: node.url,
        title: node.title,
        favicon: node.favicon,
        parentId: node.parentId,
        childIds: [...node.childIds],
        createdAt: node.createdAt,
        lastVisitedAt: node.lastVisitedAt,
        descendantCount: node.descendantCount,
        branchRootId: node.branchRootId,
      });
    }

    this.#probe?.branchSaved(branchRootId, nodes.length);
  }

  async loadBranch(branchRootId: string): Promise<StoredNode[]> {
    const result: StoredNode[] = [];
    for (const node of this.#nodes.values()) {
      if (node.branchRootId === branchRootId) {
        // Deep-copy to avoid shared references
        result.push({
          id: node.id,
          url: node.url,
          title: node.title,
          favicon: node.favicon,
          parentId: node.parentId,
          childIds: [...node.childIds],
          createdAt: node.createdAt,
          lastVisitedAt: node.lastVisitedAt,
          descendantCount: node.descendantCount,
          branchRootId: node.branchRootId,
        });
      }
    }

    this.#probe?.branchLoaded(branchRootId, result.length);
    return result;
  }

  async deleteBranch(branchRootId: string): Promise<void> {
    const nodeIdsToDelete: string[] = [];
    for (const [id, node] of this.#nodes) {
      if (node.branchRootId === branchRootId) {
        nodeIdsToDelete.push(id);
      }
    }

    for (const id of nodeIdsToDelete) {
      this.#nodes.delete(id);
    }
    this.#branchRoots.delete(branchRootId);

    // Remove screenshots for deleted nodes
    if (nodeIdsToDelete.length > 0) {
      for (const key of this.#screenshots.keys()) {
        const screenshot = this.#screenshots.get(key)!;
        if (nodeIdsToDelete.includes(screenshot.nodeId)) {
          this.#screenshots.delete(key);
        }
      }
    }

    this.#probe?.branchDeleted(branchRootId);
  }

  async getBranchSummaries(): Promise<BranchSummary[]> {
    const summaries: BranchSummary[] = [];
    for (const branchRootId of this.#branchRoots) {
      const rootNode = this.#nodes.get(branchRootId);
      if (rootNode) {
        summaries.push({
          id: rootNode.id,
          url: rootNode.url,
          title: rootNode.title,
          favicon: rootNode.favicon,
          createdAt: rootNode.createdAt,
          lastVisitedAt: rootNode.lastVisitedAt,
          descendantCount: rootNode.descendantCount,
        });
      }
    }
    return summaries;
  }

  async saveScreenshot(
    nodeId: string,
    resolution: ScreenshotResolution,
    jpegBlob: Uint8Array
  ): Promise<void> {
    const key = `${nodeId}:${resolution}`;
    this.#screenshots.set(key, {
      nodeId,
      resolution,
      data: new Uint8Array(jpegBlob),
      capturedAt: Date.now(),
    });

    this.#probe?.screenshotSaved(nodeId, resolution, jpegBlob.byteLength);
  }

  async loadScreenshot(
    nodeId: string,
    resolution: ScreenshotResolution
  ): Promise<Uint8Array | null> {
    const key = `${nodeId}:${resolution}`;
    const screenshot = this.#screenshots.get(key);

    this.#probe?.screenshotLoaded(nodeId, resolution);

    if (!screenshot) {
      return null;
    }
    return new Uint8Array(screenshot.data);
  }

  async deleteScreenshots(nodeIds: string[]): Promise<void> {
    const nodeIdSet = new Set(nodeIds);
    for (const key of this.#screenshots.keys()) {
      const screenshot = this.#screenshots.get(key)!;
      if (nodeIdSet.has(screenshot.nodeId)) {
        this.#screenshots.delete(key);
      }
    }

    this.#probe?.screenshotsDeleted(nodeIds);
  }

  async searchNodes(query: string): Promise<StoredNode[]> {
    const lowerQuery = query.toLowerCase();
    const results: StoredNode[] = [];
    for (const node of this.#nodes.values()) {
      if (
        node.title.toLowerCase().includes(lowerQuery) ||
        node.url.toLowerCase().includes(lowerQuery)
      ) {
        results.push({
          id: node.id,
          url: node.url,
          title: node.title,
          favicon: node.favicon,
          parentId: node.parentId,
          childIds: [...node.childIds],
          createdAt: node.createdAt,
          lastVisitedAt: node.lastVisitedAt,
          descendantCount: node.descendantCount,
          branchRootId: node.branchRootId,
        });
      }
    }
    return results;
  }

  async getScreenshotMemoryUsage(): Promise<number> {
    let total = 0;
    for (const screenshot of this.#screenshots.values()) {
      total += screenshot.data.byteLength;
    }
    return total;
  }

  async getScreenshotEntries(): Promise<ScreenshotEntry[]> {
    const entries: ScreenshotEntry[] = [];
    for (const screenshot of this.#screenshots.values()) {
      entries.push({
        nodeId: screenshot.nodeId,
        resolution: screenshot.resolution,
        byteSize: screenshot.data.byteLength,
        capturedAt: screenshot.capturedAt,
      });
    }
    return entries;
  }

  async close(): Promise<void> {
    // No-op for in-memory implementation
  }
}
