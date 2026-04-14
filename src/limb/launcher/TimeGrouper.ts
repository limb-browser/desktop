// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export interface BranchInfo {
  id: string;
  title: string;
  favicon: string | null;
  descendantCount: number;
  lastVisitedAt: number;
  screenshotUrl: string | null;
}

export interface TimeGroup {
  label: string;
  branches: BranchInfo[];
}

export interface RenderableBranch extends BranchInfo {
  relativeTime: string;
}

export interface RenderableTimeGroup {
  label: string;
  branches: RenderableBranch[];
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function startOfDay(timestamp: number): number {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfYesterday(now: number): number {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeek(timestamp: number): number {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = (day + 6) % 7; // days since Monday (ISO week)
  d.setDate(d.getDate() - diff);
  return d.getTime();
}

function startOfMonth(timestamp: number): number {
  const d = new Date(timestamp);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function monthYearLabel(timestamp: number): string {
  const d = new Date(timestamp);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

export function groupBranchesByTime(
  branches: BranchInfo[],
  now: number
): TimeGroup[] {
  if (branches.length === 0) {
    return [];
  }

  const todayStart = startOfDay(now);
  const yesterdayStart = startOfYesterday(now);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);

  const today: BranchInfo[] = [];
  const yesterday: BranchInfo[] = [];
  const thisWeek: BranchInfo[] = [];
  const thisMonth: BranchInfo[] = [];
  const olderByMonth = new Map<string, BranchInfo[]>();

  for (const branch of branches) {
    const t = branch.lastVisitedAt;
    if (t >= todayStart) {
      today.push(branch);
    } else if (t >= yesterdayStart) {
      yesterday.push(branch);
    } else if (t >= weekStart) {
      thisWeek.push(branch);
    } else if (t >= monthStart) {
      thisMonth.push(branch);
    } else {
      const label = monthYearLabel(t);
      let bucket = olderByMonth.get(label);
      if (!bucket) {
        bucket = [];
        olderByMonth.set(label, bucket);
      }
      bucket.push(branch);
    }
  }

  const sortDescending = (a: BranchInfo, b: BranchInfo) =>
    b.lastVisitedAt - a.lastVisitedAt;

  const groups: TimeGroup[] = [];

  if (today.length > 0) {
    today.sort(sortDescending);
    groups.push({ label: 'Today', branches: today });
  }
  if (yesterday.length > 0) {
    yesterday.sort(sortDescending);
    groups.push({ label: 'Yesterday', branches: yesterday });
  }
  if (thisWeek.length > 0) {
    thisWeek.sort(sortDescending);
    groups.push({ label: 'This Week', branches: thisWeek });
  }
  if (thisMonth.length > 0) {
    thisMonth.sort(sortDescending);
    groups.push({ label: 'This Month', branches: thisMonth });
  }

  // Sort older month groups in reverse chronological order
  const olderEntries = [...olderByMonth.entries()].sort((a, b) => {
    // Compare by the latest branch in each month group
    const latestA = Math.max(...a[1].map((br) => br.lastVisitedAt));
    const latestB = Math.max(...b[1].map((br) => br.lastVisitedAt));
    return latestB - latestA;
  });

  for (const [label, bucket] of olderEntries) {
    bucket.sort(sortDescending);
    groups.push({ label, branches: bucket });
  }

  return groups;
}

export function relativeTimestamp(timestamp: number, now: number): string {
  const diffMs = now - timestamp;
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (minutes < 1) {
    return 'just now';
  }
  if (minutes === 1) {
    return '1 minute ago';
  }
  if (hours < 1) {
    return `${minutes} minutes ago`;
  }
  if (hours === 1) {
    return '1 hour ago';
  }
  if (days < 1) {
    return `${hours} hours ago`;
  }
  if (days === 1) {
    return '1 day ago';
  }
  if (weeks < 1) {
    return `${days} days ago`;
  }
  if (weeks === 1) {
    return '1 week ago';
  }
  if (months < 1) {
    return `${weeks} weeks ago`;
  }
  if (months === 1) {
    return '1 month ago';
  }
  if (years < 1) {
    return `${months} months ago`;
  }
  if (years === 1) {
    return '1 year ago';
  }
  return `${years} years ago`;
}
