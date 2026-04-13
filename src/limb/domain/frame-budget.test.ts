import { describe, it, expect } from 'vitest';
import { checkFrameBudget } from './frame-budget';
import { FakePerformanceProbe } from './__test-utils__/fake-performance-probe';

describe('checkFrameBudget', () => {
  it('does not emit when frame is under budget (15ms with 16ms budget)', () => {
    const probe = new FakePerformanceProbe();

    checkFrameBudget(15, 16, probe);

    expect(probe.frameBudgetExceededCalls).toHaveLength(0);
  });

  it('emits frameBudgetExceeded when frame exceeds budget (17ms with 16ms budget)', () => {
    const probe = new FakePerformanceProbe();

    checkFrameBudget(17, 16, probe);

    expect(probe.frameBudgetExceededCalls).toHaveLength(1);
    expect(probe.frameBudgetExceededCalls[0]).toEqual({ actualMs: 17, budgetMs: 16 });
  });

  it('does not emit at exact boundary (16ms with 16ms budget)', () => {
    const probe = new FakePerformanceProbe();

    checkFrameBudget(16, 16, probe);

    expect(probe.frameBudgetExceededCalls).toHaveLength(0);
  });
});
