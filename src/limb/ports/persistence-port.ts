export interface SerializedNode {
  id: string;
  url: string;
  title: string;
  favicon: string | null;
  parentId: string | null;
  childIds: string[];
  status: string;
  createdAt: number;
  lastVisitedAt: number;
  descendantCount: number;
}

export interface SearchResult {
  nodeId: string;
  url: string;
  title: string;
  favicon: string | null;
  branchRootId: string;
  branchRootTitle: string;
  lastVisitedAt: number;
}

export interface PersistencePort {
  saveNode(node: SerializedNode): void;
  saveBranch(branchRootId: string, nodes: SerializedNode[], screenshots: Map<string, string>): void;
  loadBranchRoots(): SerializedNode[];
  loadBranch(branchRootId: string): { nodes: SerializedNode[]; screenshots: Map<string, string> };
  getDescendantCount(nodeId: string): number;
  deleteSubtree(nodeId: string): void;
  searchNodes(query: string, limit: number): SearchResult[];
  evictOldScreenshots(maxAgeDays: number, excludeBranchId: string | null): number;
  saveScreenshot(nodeId: string, dataUrl: string): void;
  loadScreenshot(nodeId: string): string | null;
  getRootId(): string | null;
  createRoot(): string;
  cleanupOrphans(): void;
}
