import type { PerformanceProbe } from '../ports/performance-probe';

export function checkFrameBudget(actualMs: number, budgetMs: number, probe: PerformanceProbe): void {
  if (actualMs > budgetMs) {
    probe.frameBudgetExceeded(actualMs, budgetMs);
  }
}
