export interface PerformanceProbe {
  frameBudgetExceeded(actualMs: number, budgetMs: number): void;
  lodComputationTime(ms: number): void;
  memorySnapshot(heapMB: number, screenshotsMB: number, webviewCount: number): void;
  webviewLoadTime(nodeId: string, ms: number): void;
  treeSizeWarning(nodeCount: number): void;
  treeSizeCritical(nodeCount: number): void;
}
