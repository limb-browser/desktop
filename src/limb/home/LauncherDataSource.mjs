// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { assignTimeGroup, assignMonthLabel } from './TimeGrouper.mjs';

const FIXED_GROUP_ORDER = ['Today', 'Yesterday', 'This Week', 'This Month'];

export function getLauncherData(tree, now) {
  const root = tree.nodes.get(tree.rootId);

  if (root.childIds.length === 0) {
    return { groups: [], isEmpty: true };
  }

  const fixedGrouped = new Map();
  const monthGrouped = new Map();

  for (const childId of root.childIds) {
    const node = tree.nodes.get(childId);
    const group = assignTimeGroup(node.lastVisitedAt, now);

    const card = {
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
      monthGrouped.get(monthLabel).push(card);
    } else {
      if (!fixedGrouped.has(group)) {
        fixedGrouped.set(group, []);
      }
      fixedGrouped.get(group).push(card);
    }
  }

  const groups = [];

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
    const aMax = Math.max(...monthGrouped.get(a).map(c => c.lastVisitedAt));
    const bMax = Math.max(...monthGrouped.get(b).map(c => c.lastVisitedAt));
    return bMax - aMax;
  });

  for (const label of monthLabels) {
    const branches = monthGrouped.get(label);
    branches.sort((a, b) => b.lastVisitedAt - a.lastVisitedAt);
    groups.push({ label, branches });
  }

  return { groups, isEmpty: false };
}
