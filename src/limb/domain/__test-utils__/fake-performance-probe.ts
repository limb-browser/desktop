import type { PerformanceProbe } from '../../ports/performance-probe';

export class FakePerformanceProbe implements PerformanceProbe {
  readonly frameBudgetExceededCalls: { actualMs: number; budgetMs: number }[] = [];
  readonly lodComputationTimeCalls: number[] = [];
  readonly memorySnapshotCalls: { heapMB: number; screenshotsMB: number; webviewCount: number }[] = [];
  readonly webviewLoadTimeCalls: { nodeId: string; ms: number }[] = [];
  readonly treeSizeWarningCalls: number[] = [];
  readonly treeSizeCriticalCalls: number[] = [];

  frameBudgetExceeded(actualMs: number, budgetMs: number): void {
    this.frameBudgetExceededCalls.push({ actualMs, budgetMs });
  }

  lodComputationTime(ms: number): void {
    this.lodComputationTimeCalls.push(ms);
  }

  memorySnapshot(heapMB: number, screenshotsMB: number, webviewCount: number): void {
    this.memorySnapshotCalls.push({ heapMB, screenshotsMB, webviewCount });
  }

  webviewLoadTime(nodeId: string, ms: number): void {
    this.webviewLoadTimeCalls.push({ nodeId, ms });
  }

  treeSizeWarning(nodeCount: number): void {
    this.treeSizeWarningCalls.push(nodeCount);
  }

  treeSizeCritical(nodeCount: number): void {
    this.treeSizeCriticalCalls.push(nodeCount);
  }
}
