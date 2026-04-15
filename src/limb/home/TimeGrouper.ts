// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export type TimeGroup = 'Today' | 'Yesterday' | 'This Week' | 'This Month' | 'Older';

function startOfDayUTC(ms: number): number {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function assignMonthLabel(timestamp: number): string {
  const d = new Date(timestamp);
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function assignTimeGroup(timestamp: number, now: number): TimeGroup {
  const todayStart = startOfDayUTC(now);
  const tsDay = startOfDayUTC(timestamp);
  const daysDiff = Math.floor((todayStart - tsDay) / 86_400_000);

  if (daysDiff === 0) return 'Today';
  if (daysDiff === 1) return 'Yesterday';
  if (daysDiff < 7) return 'This Week';
  if (daysDiff < 30) return 'This Month';
  return 'Older';
}
