// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export interface StoredNode {
  id: string;
  url: string;
  title: string;
  favicon: string | null;
  parentId: string | null;
  childIds: string[];
  createdAt: number;
  lastVisitedAt: number;
  descendantCount: number;
  branchRootId: string;
}

export interface BranchSummary {
  id: string;
  url: string;
  title: string;
  favicon: string | null;
  createdAt: number;
  lastVisitedAt: number;
  descendantCount: number;
}

export type ScreenshotResolution = 'low' | 'high';

export interface ScreenshotEntry {
  nodeId: string;
  resolution: ScreenshotResolution;
  byteSize: number;
  capturedAt: number;
}

export interface TreeStoragePort {
  saveBranch(branchRootId: string, nodes: StoredNode[]): Promise<void>;
  loadBranch(branchRootId: string): Promise<StoredNode[]>;
  deleteBranch(branchRootId: string): Promise<void>;
  getBranchSummaries(): Promise<BranchSummary[]>;
  saveScreenshot(
    nodeId: string,
    resolution: ScreenshotResolution,
    jpegBlob: Uint8Array
  ): Promise<void>;
  loadScreenshot(
    nodeId: string,
    resolution: ScreenshotResolution
  ): Promise<Uint8Array | null>;
  deleteScreenshots(nodeIds: string[]): Promise<void>;
  searchNodes(query: string): Promise<StoredNode[]>;
  getScreenshotMemoryUsage(): Promise<number>;
  getScreenshotEntries(): Promise<ScreenshotEntry[]>;
  close(): Promise<void>;
}
