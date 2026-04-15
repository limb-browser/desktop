// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect } from 'vitest';
import { assignTimeGroup } from './TimeGrouper';

// Use a fixed "now" for deterministic tests: 2026-04-15 14:00:00 UTC (Wednesday)
const NOW = Date.UTC(2026, 3, 15, 14, 0, 0);

function daysAgo(days: number): number {
  return NOW - days * 24 * 60 * 60 * 1000;
}

describe('assignTimeGroup', () => {
  it('returns "Today" for a timestamp from earlier today', () => {
    // 2026-04-15 06:00:00 UTC — same day as NOW
    const earlier = Date.UTC(2026, 3, 15, 6, 0, 0);
    expect(assignTimeGroup(earlier, NOW)).toBe('Today');
  });

  it('returns "Today" for a timestamp equal to now', () => {
    expect(assignTimeGroup(NOW, NOW)).toBe('Today');
  });

  it('returns "Yesterday" for a timestamp from yesterday', () => {
    const yesterday = Date.UTC(2026, 3, 14, 20, 0, 0);
    expect(assignTimeGroup(yesterday, NOW)).toBe('Yesterday');
  });

  it('returns "This Week" for a timestamp 2 days ago', () => {
    const twoDaysAgo = Date.UTC(2026, 3, 13, 12, 0, 0);
    expect(assignTimeGroup(twoDaysAgo, NOW)).toBe('This Week');
  });

  it('returns "This Week" for a timestamp 6 days ago', () => {
    const sixDaysAgo = Date.UTC(2026, 3, 9, 12, 0, 0);
    expect(assignTimeGroup(sixDaysAgo, NOW)).toBe('This Week');
  });

  it('returns "This Month" for a timestamp 7 days ago', () => {
    const sevenDaysAgo = Date.UTC(2026, 3, 8, 12, 0, 0);
    expect(assignTimeGroup(sevenDaysAgo, NOW)).toBe('This Month');
  });

  it('returns "This Month" for a timestamp 29 days ago', () => {
    const twentyNineDaysAgo = Date.UTC(2026, 2, 17, 12, 0, 0);
    expect(assignTimeGroup(twentyNineDaysAgo, NOW)).toBe('This Month');
  });

  it('returns "Older" for a timestamp 30 days ago', () => {
    const thirtyDaysAgo = Date.UTC(2026, 2, 16, 12, 0, 0);
    expect(assignTimeGroup(thirtyDaysAgo, NOW)).toBe('Older');
  });

  it('returns "Older" for a timestamp many months ago', () => {
    const longAgo = Date.UTC(2025, 5, 1, 12, 0, 0);
    expect(assignTimeGroup(longAgo, NOW)).toBe('Older');
  });

  it('handles midnight boundary correctly — end of yesterday', () => {
    // 2026-04-14 23:59:59.999 UTC — still yesterday
    const endOfYesterday = Date.UTC(2026, 3, 14, 23, 59, 59, 999);
    expect(assignTimeGroup(endOfYesterday, NOW)).toBe('Yesterday');
  });

  it('handles midnight boundary correctly — start of today', () => {
    // 2026-04-15 00:00:00 UTC — today
    const startOfToday = Date.UTC(2026, 3, 15, 0, 0, 0);
    expect(assignTimeGroup(startOfToday, NOW)).toBe('Today');
  });

  it('handles start of yesterday boundary', () => {
    // 2026-04-14 00:00:00 UTC — yesterday
    const startOfYesterday = Date.UTC(2026, 3, 14, 0, 0, 0);
    expect(assignTimeGroup(startOfYesterday, NOW)).toBe('Yesterday');
  });

  it('handles end of "This Week" boundary — 6 days ago at end of day', () => {
    // 2026-04-09 23:59:59 — still "This Week" (6 days ago)
    const endOfSixthDay = Date.UTC(2026, 3, 9, 23, 59, 59);
    expect(assignTimeGroup(endOfSixthDay, NOW)).toBe('This Week');
  });

  it('handles start of "This Month" boundary — 7 days ago at start of day', () => {
    // 2026-04-08 00:00:00 — "This Month" (7 days ago)
    const startOfSeventhDay = Date.UTC(2026, 3, 8, 0, 0, 0);
    expect(assignTimeGroup(startOfSeventhDay, NOW)).toBe('This Month');
  });
});
