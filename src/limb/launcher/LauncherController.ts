// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import type { BrowsingTree } from '../tree/BrowsingTree';
import type { LauncherProbe } from '../ports/LauncherProbe';
import { groupBranchesByTime, type BranchInfo, type TimeGroup } from './TimeGrouper';

export class LauncherController {
  #tree: BrowsingTree;
  #probe: LauncherProbe | null;

  constructor(tree: BrowsingTree, probe?: LauncherProbe) {
    this.#tree = tree;
    this.#probe = probe ?? null;
  }

  isEmpty(): boolean {
    const root = this.#tree.nodes.get(this.#tree.rootId)!;
    return root.childIds.length === 0;
  }

  getBranches(): BranchInfo[] {
    const root = this.#tree.nodes.get(this.#tree.rootId)!;
    return root.childIds.map((id) => {
      const node = this.#tree.nodes.get(id)!;
      const descendants = this.#tree.getDescendants(id);
      return {
        id: node.id,
        title: node.title,
        favicon: node.favicon,
        descendantCount: descendants.length - 1,
        lastVisitedAt: node.lastVisitedAt,
      };
    });
  }

  getTimeGroups(now: number): TimeGroup[] {
    return groupBranchesByTime(this.getBranches(), now);
  }

  selectBranch(branchId: string): void {
    this.#tree.focusNode(branchId);
    this.#probe?.branchSelected(branchId);
  }

  createBranch(url: string): string {
    const node = this.#tree.addChild(this.#tree.rootId, url);
    this.#probe?.branchCreated(node.id);
    return node.id;
  }
}
