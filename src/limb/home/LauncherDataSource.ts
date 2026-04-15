// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import type { BrowsingTree } from '../tree/BrowsingTree';
import { assignTimeGroup, type TimeGroup } from './TimeGrouper';

const GROUP_ORDER: TimeGroup[] = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];

export interface BranchCard {
  id: string;
  name: string;
  favicon: string | null;
  nodeCount: number;
  lastVisitedAt: number;
}

export interface TimeGroupEntry {
  label: TimeGroup;
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

  const grouped = new Map<TimeGroup, BranchCard[]>();

  for (const childId of root.childIds) {
    const node = tree.nodes.get(childId)!;
    const group = assignTimeGroup(node.lastVisitedAt, now);

    const card: BranchCard = {
      id: node.id,
      name: node.title,
      favicon: node.favicon,
      nodeCount: tree.getDescendants(node.id).length,
      lastVisitedAt: node.lastVisitedAt,
    };

    if (!grouped.has(group)) {
      grouped.set(group, []);
    }
    grouped.get(group)!.push(card);
  }

  const groups: TimeGroupEntry[] = [];
  for (const label of GROUP_ORDER) {
    const branches = grouped.get(label);
    if (branches && branches.length > 0) {
      branches.sort((a, b) => b.lastVisitedAt - a.lastVisitedAt);
      groups.push({ label, branches });
    }
  }

  return { groups, isEmpty: false };
}
