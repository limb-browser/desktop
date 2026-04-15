// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import type { BranchFoldProbe } from '../ports/BranchFoldProbe';

export interface FoldNode {
  id: string;
  monthLabel: string;
  branchCount: number;
  branchIds: string[];
}

export interface FoldResult {
  visibleChildIds: string[];
  foldNodes: Map<string, FoldNode>;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export class BranchFolder {
  #expandedFoldIds: Set<string> = new Set();
  #probe: BranchFoldProbe | null;

  constructor(probe?: BranchFoldProbe) {
    this.#probe = probe ?? null;
  }

  computeFolds(
    branches: { id: string; lastVisitedAt: number }[],
    now: number,
  ): FoldResult {
    const cutoff = now - SEVEN_DAYS_MS;
    const recent: { id: string; lastVisitedAt: number }[] = [];
    const olderByMonth = new Map<string, { id: string; lastVisitedAt: number }[]>();

    for (const branch of branches) {
      if (branch.lastVisitedAt >= cutoff) {
        recent.push(branch);
      } else {
        const date = new Date(branch.lastVisitedAt);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const monthKey = `${year}-${month}`;
        let group = olderByMonth.get(monthKey);
        if (!group) {
          group = [];
          olderByMonth.set(monthKey, group);
        }
        group.push(branch);
      }
    }

    // Sort recent by recency (most recent first)
    recent.sort((a, b) => b.lastVisitedAt - a.lastVisitedAt);

    const visibleChildIds: string[] = recent.map(b => b.id);
    const foldNodes = new Map<string, FoldNode>();

    // Sort month keys descending (most recent month first)
    const sortedMonths = [...olderByMonth.keys()].sort().reverse();

    for (const monthKey of sortedMonths) {
      const foldId = `fold:${monthKey}`;
      const monthBranches = olderByMonth.get(monthKey)!;

      if (this.#expandedFoldIds.has(foldId)) {
        // Expanded: show individual branches sorted by recency
        const sorted = [...monthBranches].sort(
          (a, b) => b.lastVisitedAt - a.lastVisitedAt,
        );
        for (const b of sorted) {
          visibleChildIds.push(b.id);
        }
      } else {
        // Collapsed: show fold node
        const [yearStr, monthStr] = monthKey.split('-');
        const monthIndex = parseInt(monthStr, 10) - 1;
        const monthLabel = `${MONTH_NAMES[monthIndex]} ${yearStr}`;

        foldNodes.set(foldId, {
          id: foldId,
          monthLabel,
          branchCount: monthBranches.length,
          branchIds: monthBranches.map(b => b.id),
        });
        visibleChildIds.push(foldId);
      }
    }

    this.#probe?.foldComputed(recent.length, foldNodes.size);
    return { visibleChildIds, foldNodes };
  }

  toggleFold(foldId: string): void {
    if (this.#expandedFoldIds.has(foldId)) {
      this.#expandedFoldIds.delete(foldId);
      this.#probe?.foldCollapsed(foldId);
    } else {
      this.#expandedFoldIds.add(foldId);
      this.#probe?.foldExpanded(foldId);
    }
  }

  isExpanded(foldId: string): boolean {
    return this.#expandedFoldIds.has(foldId);
  }
}
