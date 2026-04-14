// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect } from 'vitest';
import {
  groupBranchesByTime,
  relativeTimestamp,
  type BranchInfo,
} from './TimeGrouper';

// Wednesday, April 15, 2026, 12:00:00 (noon)
// Start of week (Monday): April 13
// Yesterday: April 14 (Tuesday)
// Start of month: April 1
const NOW = new Date(2026, 3, 15, 12, 0, 0).getTime();

function makeBranch(
  overrides: Partial<BranchInfo> & { lastVisitedAt: number }
): BranchInfo {
  return {
    id: crypto.randomUUID(),
    title: 'Test Branch',
    favicon: null,
    descendantCount: 0,
    ...overrides,
  };
}

function ts(
  year: number,
  month: number,
  day: number,
  hour = 12
): number {
  return new Date(year, month - 1, day, hour, 0, 0).getTime();
}

describe('groupBranchesByTime', () => {
  it('returns empty array for empty input', () => {
    const result = groupBranchesByTime([], NOW);
    expect(result).toEqual([]);
  });

  it('groups a branch visited today into "Today"', () => {
    const branch = makeBranch({ lastVisitedAt: ts(2026, 4, 15, 10) });
    const result = groupBranchesByTime([branch], NOW);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Today');
    expect(result[0].branches).toEqual([branch]);
  });

  it('groups a branch visited yesterday into "Yesterday"', () => {
    const branch = makeBranch({ lastVisitedAt: ts(2026, 4, 14, 15) });
    const result = groupBranchesByTime([branch], NOW);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Yesterday');
    expect(result[0].branches).toEqual([branch]);
  });

  it('groups a branch from earlier this week (not today/yesterday) into "This Week"', () => {
    // Monday April 13 — same week, not today or yesterday
    const branch = makeBranch({ lastVisitedAt: ts(2026, 4, 13, 9) });
    const result = groupBranchesByTime([branch], NOW);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('This Week');
    expect(result[0].branches).toEqual([branch]);
  });

  it('groups a branch from earlier this month (not this week) into "This Month"', () => {
    // April 5 — same month, before this week (April 13)
    const branch = makeBranch({ lastVisitedAt: ts(2026, 4, 5, 14) });
    const result = groupBranchesByTime([branch], NOW);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('This Month');
    expect(result[0].branches).toEqual([branch]);
  });

  it('groups a branch from an older month into "Month Year"', () => {
    const branch = makeBranch({ lastVisitedAt: ts(2026, 3, 20, 10) });
    const result = groupBranchesByTime([branch], NOW);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('March 2026');
    expect(result[0].branches).toEqual([branch]);
  });

  it('separates older branches by month', () => {
    const marchBranch = makeBranch({
      id: 'march',
      lastVisitedAt: ts(2026, 3, 20, 10),
    });
    const febBranch = makeBranch({
      id: 'feb',
      lastVisitedAt: ts(2026, 2, 10, 8),
    });
    const result = groupBranchesByTime([marchBranch, febBranch], NOW);
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('March 2026');
    expect(result[0].branches).toEqual([marchBranch]);
    expect(result[1].label).toBe('February 2026');
    expect(result[1].branches).toEqual([febBranch]);
  });

  it('distributes branches across all groups correctly', () => {
    const todayBranch = makeBranch({
      id: 'today',
      lastVisitedAt: ts(2026, 4, 15, 10),
    });
    const yesterdayBranch = makeBranch({
      id: 'yesterday',
      lastVisitedAt: ts(2026, 4, 14, 15),
    });
    const thisWeekBranch = makeBranch({
      id: 'this-week',
      lastVisitedAt: ts(2026, 4, 13, 9),
    });
    const thisMonthBranch = makeBranch({
      id: 'this-month',
      lastVisitedAt: ts(2026, 4, 5, 14),
    });
    const olderBranch = makeBranch({
      id: 'older',
      lastVisitedAt: ts(2026, 3, 20, 10),
    });

    const result = groupBranchesByTime(
      [todayBranch, yesterdayBranch, thisWeekBranch, thisMonthBranch, olderBranch],
      NOW
    );

    expect(result.map((g) => g.label)).toEqual([
      'Today',
      'Yesterday',
      'This Week',
      'This Month',
      'March 2026',
    ]);
    expect(result[0].branches).toEqual([todayBranch]);
    expect(result[1].branches).toEqual([yesterdayBranch]);
    expect(result[2].branches).toEqual([thisWeekBranch]);
    expect(result[3].branches).toEqual([thisMonthBranch]);
    expect(result[4].branches).toEqual([olderBranch]);
  });

  it('excludes empty groups', () => {
    // Only a today branch — no Yesterday, This Week, etc. groups
    const branch = makeBranch({ lastVisitedAt: ts(2026, 4, 15, 10) });
    const result = groupBranchesByTime([branch], NOW);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Today');
  });

  it('sorts branches within a group by lastVisitedAt descending', () => {
    const earlier = makeBranch({
      id: 'earlier',
      lastVisitedAt: ts(2026, 4, 15, 8),
    });
    const later = makeBranch({
      id: 'later',
      lastVisitedAt: ts(2026, 4, 15, 11),
    });
    const result = groupBranchesByTime([earlier, later], NOW);
    expect(result[0].branches[0].id).toBe('later');
    expect(result[0].branches[1].id).toBe('earlier');
  });

  it('handles a branch at the exact start of today', () => {
    const branch = makeBranch({
      lastVisitedAt: new Date(2026, 3, 15, 0, 0, 0).getTime(),
    });
    const result = groupBranchesByTime([branch], NOW);
    expect(result[0].label).toBe('Today');
  });

  it('handles a branch at the last millisecond of yesterday', () => {
    const branch = makeBranch({
      lastVisitedAt: new Date(2026, 3, 15, 0, 0, 0).getTime() - 1,
    });
    const result = groupBranchesByTime([branch], NOW);
    expect(result[0].label).toBe('Yesterday');
  });

  it('orders older month groups in reverse chronological order', () => {
    const jan = makeBranch({ id: 'jan', lastVisitedAt: ts(2026, 1, 15) });
    const feb = makeBranch({ id: 'feb', lastVisitedAt: ts(2026, 2, 10) });
    const mar = makeBranch({ id: 'mar', lastVisitedAt: ts(2026, 3, 5) });
    const result = groupBranchesByTime([jan, feb, mar], NOW);
    expect(result.map((g) => g.label)).toEqual([
      'March 2026',
      'February 2026',
      'January 2026',
    ]);
  });

  it('groups branches from different years correctly', () => {
    const branch2025 = makeBranch({
      id: '2025',
      lastVisitedAt: ts(2025, 12, 15),
    });
    const branch2026 = makeBranch({
      id: '2026',
      lastVisitedAt: ts(2026, 3, 5),
    });
    const result = groupBranchesByTime([branch2025, branch2026], NOW);
    expect(result.map((g) => g.label)).toEqual([
      'March 2026',
      'December 2025',
    ]);
  });
});

describe('relativeTimestamp', () => {
  it('returns "just now" for timestamps less than 1 minute ago', () => {
    expect(relativeTimestamp(NOW - 30_000, NOW)).toBe('just now');
  });

  it('returns "1 minute ago" for 1 minute', () => {
    expect(relativeTimestamp(NOW - 60_000, NOW)).toBe('1 minute ago');
  });

  it('returns "X minutes ago" for multiple minutes', () => {
    expect(relativeTimestamp(NOW - 5 * 60_000, NOW)).toBe('5 minutes ago');
  });

  it('returns "1 hour ago" for 1 hour', () => {
    expect(relativeTimestamp(NOW - 3_600_000, NOW)).toBe('1 hour ago');
  });

  it('returns "X hours ago" for multiple hours', () => {
    expect(relativeTimestamp(NOW - 3 * 3_600_000, NOW)).toBe('3 hours ago');
  });

  it('returns "1 day ago" for 1 day', () => {
    expect(relativeTimestamp(NOW - 86_400_000, NOW)).toBe('1 day ago');
  });

  it('returns "X days ago" for multiple days', () => {
    expect(relativeTimestamp(NOW - 4 * 86_400_000, NOW)).toBe('4 days ago');
  });

  it('returns "1 week ago" for 7 days', () => {
    expect(relativeTimestamp(NOW - 7 * 86_400_000, NOW)).toBe('1 week ago');
  });

  it('returns "X weeks ago" for multiple weeks', () => {
    expect(relativeTimestamp(NOW - 21 * 86_400_000, NOW)).toBe('3 weeks ago');
  });

  it('returns "1 month ago" for 30 days', () => {
    expect(relativeTimestamp(NOW - 30 * 86_400_000, NOW)).toBe('1 month ago');
  });

  it('returns "X months ago" for multiple months', () => {
    expect(relativeTimestamp(NOW - 90 * 86_400_000, NOW)).toBe('3 months ago');
  });

  it('returns "1 year ago" for 365 days', () => {
    expect(relativeTimestamp(NOW - 365 * 86_400_000, NOW)).toBe('1 year ago');
  });

  it('returns "X years ago" for multiple years', () => {
    expect(relativeTimestamp(NOW - 730 * 86_400_000, NOW)).toBe('2 years ago');
  });
});
