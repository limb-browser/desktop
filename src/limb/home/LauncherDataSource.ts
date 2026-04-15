// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import type { BrowsingTree } from '../tree/BrowsingTree';
import { assignTimeGroup, assignMonthLabel, type TimeGroup } from './TimeGrouper';

const FIXED_GROUP_ORDER: TimeGroup[] = ['Today', 'Yesterday', 'This Week', 'This Month'];

export interface BranchCard {
  id: string;
  name: string;
  favicon: string | null;
  screenshot: string | null;
  nodeCount: number;
  lastVisitedAt: number;
}

export interface TimeGroupEntry {
  label: string;
  branches: BranchCard[];
}

export interface LauncherData {
  groups: TimeGroupEntry[];
  isEmpty: boolean;
}

export function getLauncherData(tree: BrowsingTree, now: number): LauncherData {
  const root = tree.nodes.get(tree.rootId)!;

  if (root.childIds.length === 0) {
    return { groups: [], isEmpty: true };
  }

  const fixedGrouped = new Map<TimeGroup, BranchCard[]>();
  const monthGrouped = new Map<string, BranchCard[]>();

  for (const childId of root.childIds) {
    const node = tree.nodes.get(childId)!;
    const group = assignTimeGroup(node.lastVisitedAt, now);

    const card: BranchCard = {
      id: node.id,
      name: node.title,
      favicon: node.favicon,
      screenshot: node.screenshot,
      nodeCount: tree.getDescendants(node.id).length,
      lastVisitedAt: node.lastVisitedAt,
    };

    if (group === 'Older') {
      const monthLabel = assignMonthLabel(node.lastVisitedAt);
      if (!monthGrouped.has(monthLabel)) {
        monthGrouped.set(monthLabel, []);
      }
      monthGrouped.get(monthLabel)!.push(card);
    } else {
      if (!fixedGrouped.has(group)) {
        fixedGrouped.set(group, []);
      }
      fixedGrouped.get(group)!.push(card);
    }
  }

  const groups: TimeGroupEntry[] = [];

  for (const label of FIXED_GROUP_ORDER) {
    const branches = fixedGrouped.get(label);
    if (branches && branches.length > 0) {
      branches.sort((a, b) => b.lastVisitedAt - a.lastVisitedAt);
      groups.push({ label, branches });
    }
  }

  // Sort month labels most recent first by comparing the latest timestamp in each group
  const monthLabels = [...monthGrouped.keys()];
  monthLabels.sort((a, b) => {
    const aMax = Math.max(...monthGrouped.get(a)!.map(c => c.lastVisitedAt));
    const bMax = Math.max(...monthGrouped.get(b)!.map(c => c.lastVisitedAt));
    return bMax - aMax;
  });

  for (const label of monthLabels) {
    const branches = monthGrouped.get(label)!;
    branches.sort((a, b) => b.lastVisitedAt - a.lastVisitedAt);
    groups.push({ label, branches });
  }

  return { groups, isEmpty: false };
}
